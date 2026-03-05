"use client";

import { useState, useCallback } from "react";
import { compressImage, getImageDimensions, createFilePreview, revokeFilePreview } from "@/lib/utils/image-resize";
import type { UploadFile, Media } from "@/types/database";

interface UseUploadOptions {
  albumId: string;
  guestName?: string;
  joinCode?: string;
  onUploadComplete?: (media: Media) => void;
}

const isDemoMode = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  return !url || url.includes("your-project");
};

const MULTIPART_THRESHOLD = 50 * 1024 * 1024; // 50MB

export function useUpload({ albumId, guestName, joinCode, onUploadComplete }: UseUploadOptions) {
  const [uploads, setUploads] = useState<UploadFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const updateUpload = useCallback((id: string, updates: Partial<UploadFile>) => {
    setUploads((prev) =>
      prev.map((u) => (u.id === id ? { ...u, ...updates } : u))
    );
  }, []);

  const uploadFileDemo = useCallback(
    async (uploadFile: UploadFile) => {
      try {
        // Step 1: Compress image
        updateUpload(uploadFile.id, { status: "compressing", progress: 10 });
        const compressed = await compressImage(uploadFile.file);

        // Step 2: Get dimensions (optional — continue without on failure)
        let dimensions: { width: number; height: number } | null = null;
        try {
          dimensions = await getImageDimensions(compressed);
        } catch {
          // Continue without dimensions
        }
        updateUpload(uploadFile.id, { progress: 30 });

        // Step 3: Simulate upload delay
        updateUpload(uploadFile.id, { status: "uploading", progress: 50 });
        await new Promise((r) => setTimeout(r, 600));
        updateUpload(uploadFile.id, { progress: 75 });
        await new Promise((r) => setTimeout(r, 400));

        const mediaType = compressed.type.startsWith("video/") ? "video" : "photo";
        const localUrl = createFilePreview(compressed);
        const mediaId = `demo-${Date.now()}-${Math.random().toString(36).slice(2)}`;

        updateUpload(uploadFile.id, {
          status: "success",
          progress: 100,
          url: localUrl,
        });

        // Create a demo Media object and notify parent
        const demoMedia: Media = {
          id: mediaId,
          album_id: albumId,
          uploader_id: guestName ? null : "demo-user",
          guest_name: guestName || null,
          file_url: localUrl,
          thumbnail_url: null,
          media_type: mediaType as "photo" | "video",
          width: dimensions?.width ?? null,
          height: dimensions?.height ?? null,
          file_size: compressed.size,
          created_at: new Date().toISOString(),
          reaction_count: 0,
          user_has_reacted: false,
        };

        onUploadComplete?.(demoMedia);
      } catch (error) {
        console.error("Upload failed:", error);
        updateUpload(uploadFile.id, {
          status: "error",
          error: error instanceof Error ? error.message : "Upload failed",
        });
      }
    },
    [albumId, guestName, updateUpload, onUploadComplete]
  );

  const uploadFileReal = useCallback(
    async (uploadFile: UploadFile) => {
      try {
        // Step 1: Compress images (videos are uploaded as-is)
        updateUpload(uploadFile.id, { status: "compressing", progress: 5 });

        const isVideo = uploadFile.file.type.startsWith("video/");
        const compressed = isVideo ? uploadFile.file : await compressImage(uploadFile.file);

        // Step 2: Get dimensions (skip for videos — loading metadata blocks on mobile)
        updateUpload(uploadFile.id, { progress: 22 });
        let dimensions: { width: number; height: number } | null = null;
        if (!isVideo) {
          try {
            dimensions = await getImageDimensions(compressed);
          } catch {
            // Dimensions are nullable in DB — continue upload without them
          }
        }
        updateUpload(uploadFile.id, { progress: 25 });

        // Step 3: Upload to R2
        updateUpload(uploadFile.id, { status: "uploading", progress: 28 });

        const mediaType = compressed.type.startsWith("video/") ? "video" : "photo";
        let fileUrl: string;
        let objectKey: string;

        if (compressed.size > MULTIPART_THRESHOLD) {
          // Multipart upload for large files (>50MB)
          const { startMultipartUpload } = await import("@/lib/r2/multipart-client");
          const controller = startMultipartUpload({
            file: compressed,
            albumId,
            fileName: compressed.name || "upload.bin",
            contentType: compressed.type || "application/octet-stream",
          });

          controller.onProgress(({ loaded, total }) => {
            const pct = Math.round(28 + (loaded / total) * 42);
            updateUpload(uploadFile.id, { progress: pct });
          });

          const result = await controller.promise;
          fileUrl = result.fileUrl;
          objectKey = result.objectKey;
        } else {
          // Single PUT for small files (<=50MB)
          const presignResponse = await fetch("/api/uploads/r2/presign", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              albumId,
              fileName: compressed.name || "upload.bin",
              contentType: compressed.type || "application/octet-stream",
              fileSize: compressed.size,
            }),
          });

          if (!presignResponse.ok) {
            const errorData = (await presignResponse.json().catch(() => ({}))) as { error?: string };
            throw new Error(errorData.error || "Failed to get upload URL");
          }

          const presignResult = (await presignResponse.json()) as {
            uploadUrl: string;
            fileUrl: string;
            objectKey: string;
          };
          fileUrl = presignResult.fileUrl;
          objectKey = presignResult.objectKey;

          updateUpload(uploadFile.id, { progress: 35 });

          // Upload file directly from browser to R2 via XHR for real progress tracking
          await new Promise<void>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open("PUT", presignResult.uploadUrl);
            xhr.setRequestHeader("Content-Type", compressed.type || "application/octet-stream");
            const sizeMB = Math.ceil(compressed.size / (1024 * 1024));
            xhr.timeout = Math.min(Math.max(120_000, sizeMB * 15_000), 3_600_000);

            xhr.upload.onprogress = (event) => {
              if (event.lengthComputable) {
                const pct = Math.round(35 + (event.loaded / event.total) * 35);
                updateUpload(uploadFile.id, { progress: pct });
              }
            };

            xhr.onload = () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                resolve();
              } else {
                reject(new Error(`Upload to storage failed (HTTP ${xhr.status})`));
              }
            };

            xhr.onerror = () => reject(new Error("Upload failed — check your network connection"));
            xhr.ontimeout = () => reject(new Error(`Upload timed out (${sizeMB}MB file)`));

            xhr.send(compressed);
          });
        }

        updateUpload(uploadFile.id, { progress: 70 });

        // Step 5: Confirm upload and insert media record server-side (small JSON request)
        let media: Media | null = null;
        try {
          const confirmResponse = await fetch("/api/uploads/r2/confirm", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              albumId,
              guestName: guestName || undefined,
              fileUrl,
              objectKey,
              mediaType,
              fileSize: compressed.size,
              width: dimensions?.width,
              height: dimensions?.height,
            }),
          });

          if (confirmResponse.ok) {
            const result = (await confirmResponse.json()) as { media?: Media | null };
            media = result.media ?? null;
          }
        } catch {
          // Server-side confirm failed; fall back to client-side insert below.
        }

        // Step 6: Client-side DB insert fallback
        if (!media) {
          const { createClient } = await import("@/lib/supabase/client");
          const supabase = createClient();

          // Use existing auth user if available, but never create new profiles
          let uploaderId: string | null = null;
          if (!guestName) {
            try {
              const { data: authData } = await supabase.auth.getUser();
              uploaderId = authData.user?.id || null;
            } catch {
              uploaderId = null;
            }
          }

          const primaryInsert = await supabase
            .from("media")
            .insert({
              album_id: albumId,
              uploader_id: uploaderId,
              guest_name: guestName || null,
              file_url: fileUrl,
              storage_provider: "r2",
              storage_key: objectKey,
              media_type: mediaType,
              width: dimensions?.width,
              height: dimensions?.height,
              file_size: compressed.size,
            })
            .select()
            .single();

          let mediaData = primaryInsert.data;
          let dbError = primaryInsert.error;

          if (dbError) {
            const code = String((dbError as { code?: string })?.code || "");
            const msg = String((dbError as { message?: string })?.message || "");

            if (code === "42703" || /storage_provider|storage_key/i.test(msg)) {
              const fallback = await supabase
                .from("media")
                .insert({
                  album_id: albumId,
                  uploader_id: uploaderId,
                  guest_name: guestName || null,
                  file_url: fileUrl,
                  media_type: mediaType,
                  width: dimensions?.width,
                  height: dimensions?.height,
                  file_size: compressed.size,
                })
                .select()
                .single();
              mediaData = fallback.data;
              dbError = fallback.error;
            }
          }

          if (dbError) {
            const code = String((dbError as { code?: string })?.code || "");
            const msg = String((dbError as { message?: string })?.message || "");

            if (code === "23503" || /uploader_id|foreign key/i.test(msg)) {
              const fkFallback = await supabase
                .from("media")
                .insert({
                  album_id: albumId,
                  uploader_id: null,
                  guest_name: guestName || null,
                  file_url: fileUrl,
                  storage_provider: "r2",
                  storage_key: objectKey,
                  media_type: mediaType,
                  width: dimensions?.width,
                  height: dimensions?.height,
                  file_size: compressed.size,
                })
                .select()
                .single();
              mediaData = fkFallback.data;
              dbError = fkFallback.error;
            }
          }

          if (dbError) throw dbError;
          media = mediaData as Media;
        }

        updateUpload(uploadFile.id, { progress: 85 });
        updateUpload(uploadFile.id, {
          status: "success",
          progress: 100,
          url: fileUrl,
        });

        onUploadComplete?.(media as Media);
      } catch (error) {
        console.error("Upload failed:", error);
        updateUpload(uploadFile.id, {
          status: "error",
          error: error instanceof Error ? error.message : "Upload failed",
        });
      }
    },
    [albumId, guestName, updateUpload, onUploadComplete]
  );

  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      setIsUploading(true);

      // Create upload entries
      const newUploads: UploadFile[] = fileArray.map((file) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        preview: createFilePreview(file),
        progress: 0,
        status: "pending" as const,
      }));

      setUploads((prev) => [...prev, ...newUploads]);

      const doUpload = isDemoMode() ? uploadFileDemo : uploadFileReal;

      // Upload concurrently: 3 at a time for small files, 1 at a time if any file > 50MB
      const hasLargeFile = fileArray.some((f) => f.size > 50 * 1024 * 1024);
      const batchSize = hasLargeFile ? 1 : 3;
      for (let i = 0; i < newUploads.length; i += batchSize) {
        const batch = newUploads.slice(i, i + batchSize);
        await Promise.all(batch.map(doUpload));
      }

      setIsUploading(false);
    },
    [uploadFileDemo, uploadFileReal]
  );

  const reset = useCallback(() => {
    setUploads((prev) => {
      prev.forEach((u) => { if (u.preview) revokeFilePreview(u.preview); });
      return [];
    });
    setIsUploading(false);
  }, []);

  const completedCount = uploads.filter((u) => u.status === "success").length;
  const totalCount = uploads.length;
  const hasErrors = uploads.some((u) => u.status === "error");

  return {
    uploads,
    uploadFiles,
    isUploading,
    reset,
    completedCount,
    totalCount,
    hasErrors,
  };
}
