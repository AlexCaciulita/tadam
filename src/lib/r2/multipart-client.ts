"use client";

const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_CONCURRENCY = 4;
const MAX_RETRIES = 3;

interface MultipartUploadOptions {
  file: File | Blob;
  albumId: string;
  fileName: string;
  contentType: string;
}

interface MultipartUploadResult {
  fileUrl: string;
  objectKey: string;
}

type ProgressCallback = (progress: { loaded: number; total: number }) => void;

export interface MultipartUploadController {
  promise: Promise<MultipartUploadResult>;
  onProgress: (callback: ProgressCallback) => void;
  abort: () => void;
}

async function abortUpload(objectKey: string, uploadId: string): Promise<void> {
  try {
    await fetch("/api/uploads/r2/multipart/abort", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ objectKey, uploadId }),
    });
  } catch {
    // Best-effort cleanup
  }
}

export function startMultipartUpload(
  options: MultipartUploadOptions
): MultipartUploadController {
  let progressCallback: ProgressCallback | null = null;
  let aborted = false;
  const activeXHRs = new Set<XMLHttpRequest>();
  let uploadId: string | null = null;
  let objectKey: string | null = null;

  async function uploadChunkXHR(
    url: string,
    chunk: Blob,
    onChunkProgress: (loaded: number) => void
  ): Promise<{ etag: string }> {
    // Read chunk into memory first — on iOS Safari, file handles from the
    // photo picker can become invalid, causing silent network errors.
    let buffer: ArrayBuffer;
    try {
      buffer = await chunk.arrayBuffer();
    } catch {
      throw new Error("Failed to read file data — file may no longer be accessible");
    }

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      activeXHRs.add(xhr);

      xhr.open("PUT", url);
      xhr.timeout = 120_000; // 2 min per 10MB chunk

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          onChunkProgress(event.loaded);
        }
      };

      xhr.onload = () => {
        activeXHRs.delete(xhr);
        if (xhr.status >= 200 && xhr.status < 300) {
          const etag = xhr.getResponseHeader("ETag");
          if (!etag) {
            reject(
              new Error(
                "Missing ETag in part upload response — check R2 CORS ExposeHeaders"
              )
            );
            return;
          }
          resolve({ etag });
        } else {
          reject(new Error(`Part upload failed (HTTP ${xhr.status})`));
        }
      };

      xhr.onerror = () => {
        activeXHRs.delete(xhr);
        reject(new Error("Part upload network error — possible CORS issue"));
      };

      xhr.ontimeout = () => {
        activeXHRs.delete(xhr);
        reject(new Error("Part upload timed out"));
      };

      xhr.onabort = () => {
        activeXHRs.delete(xhr);
        reject(new Error("Upload aborted"));
      };

      xhr.send(buffer);
    });
  }

  const promise = (async (): Promise<MultipartUploadResult> => {
    const { file, albumId, fileName, contentType } = options;
    const totalSize = file.size;
    const totalParts = Math.ceil(totalSize / CHUNK_SIZE);

    // Step 1: Create multipart upload
    const createResponse = await fetch("/api/uploads/r2/multipart/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        albumId,
        fileName,
        contentType,
        fileSize: totalSize,
      }),
    });

    if (!createResponse.ok) {
      const err = (await createResponse.json().catch(() => ({}))) as {
        error?: string;
      };
      throw new Error(err.error || "Failed to create multipart upload");
    }

    const createResult = (await createResponse.json()) as {
      uploadId: string;
      objectKey: string;
      fileUrl: string;
    };

    uploadId = createResult.uploadId;
    objectKey = createResult.objectKey;
    const fileUrl = createResult.fileUrl;

    if (aborted) {
      await abortUpload(objectKey, uploadId);
      throw new Error("Upload aborted");
    }

    // Step 2: Sign all part URLs in batches of 10
    const partNumbers = Array.from({ length: totalParts }, (_, i) => i + 1);
    const signedUrls: Record<number, string> = {};

    for (let i = 0; i < partNumbers.length; i += 10) {
      if (aborted) {
        await abortUpload(objectKey, uploadId);
        throw new Error("Upload aborted");
      }

      const batch = partNumbers.slice(i, i + 10);
      const signResponse = await fetch("/api/uploads/r2/multipart/sign-part", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objectKey, uploadId, partNumbers: batch }),
      });

      if (!signResponse.ok) {
        await abortUpload(objectKey, uploadId);
        throw new Error("Failed to sign part URLs");
      }

      const signResult = (await signResponse.json()) as {
        urls: Record<number, string>;
      };
      Object.assign(signedUrls, signResult.urls);
    }

    // Step 3: Upload chunks with concurrency pool
    const completedParts: { partNumber: number; etag: string }[] = [];
    const partProgress: Record<number, number> = {};

    const reportProgress = () => {
      if (!progressCallback) return;
      const loaded = Object.values(partProgress).reduce(
        (sum, v) => sum + v,
        0
      );
      progressCallback({ loaded, total: totalSize });
    };

    const uploadPart = async (partNumber: number): Promise<void> => {
      const start = (partNumber - 1) * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, totalSize);
      const chunk = file.slice(start, end);
      const url = signedUrls[partNumber];

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        if (aborted) throw new Error("Upload aborted");

        try {
          const { etag } = await uploadChunkXHR(
            url,
            chunk,
            (loaded) => {
              partProgress[partNumber] = loaded;
              reportProgress();
            }
          );
          completedParts.push({ partNumber, etag });
          return;
        } catch (error) {
          if (aborted) throw new Error("Upload aborted");
          if (attempt === MAX_RETRIES) throw error;
          // Exponential backoff: 1s, 2s, 4s
          await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
        }
      }
    };

    // Worker pool: each worker pulls from the queue sequentially
    const queue = [...partNumbers];
    let fatalError: Error | null = null;

    const runWorker = async (): Promise<void> => {
      while (queue.length > 0 && !fatalError && !aborted) {
        const partNumber = queue.shift()!;
        try {
          await uploadPart(partNumber);
        } catch (error) {
          fatalError =
            error instanceof Error ? error : new Error(String(error));
          return;
        }
      }
    };

    const workers = Array.from(
      { length: Math.min(MAX_CONCURRENCY, totalParts) },
      () => runWorker()
    );
    await Promise.all(workers);

    if (aborted) {
      await abortUpload(objectKey, uploadId);
      throw new Error("Upload aborted");
    }

    if (fatalError) {
      aborted = true;
      activeXHRs.forEach((xhr) => xhr.abort());
      await abortUpload(objectKey, uploadId);
      throw fatalError;
    }

    // Step 4: Complete multipart upload
    const completeResponse = await fetch(
      "/api/uploads/r2/multipart/complete",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objectKey, uploadId, parts: completedParts }),
      }
    );

    if (!completeResponse.ok) {
      await abortUpload(objectKey, uploadId);
      throw new Error("Failed to complete multipart upload");
    }

    return { fileUrl, objectKey };
  })();

  return {
    promise,
    onProgress: (callback) => {
      progressCallback = callback;
    },
    abort: () => {
      aborted = true;
      activeXHRs.forEach((xhr) => xhr.abort());
      if (objectKey && uploadId) {
        abortUpload(objectKey, uploadId).catch(() => {});
      }
    },
  };
}
