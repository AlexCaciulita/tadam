import imageCompression from "browser-image-compression";

export interface CompressionOptions {
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
  useWebWorker?: boolean;
}

const defaultOptions: CompressionOptions = {
  maxSizeMB: 2,
  maxWidthOrHeight: 2048,
  useWebWorker: true,
};

const VIDEO_EXTENSIONS = new Set([
  "mov", "mp4", "m4v", "avi", "wmv", "flv", "mkv", "webm", "3gp", "3g2",
]);
const IMAGE_EXTENSIONS = new Set([
  "jpg", "jpeg", "png", "gif", "webp", "heic", "heif", "bmp", "tiff", "tif", "svg", "avif",
]);

/**
 * Detect MIME type from file — uses file.type if available,
 * falls back to file extension (critical for iOS Safari where
 * file.type is often empty for gallery-selected videos).
 */
export function detectMimeType(file: File): string {
  if (file.type) return file.type;

  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  if (VIDEO_EXTENSIONS.has(ext)) {
    const map: Record<string, string> = {
      mov: "video/quicktime", mp4: "video/mp4", m4v: "video/x-m4v",
      avi: "video/x-msvideo", wmv: "video/x-ms-wmv", flv: "video/x-flv",
      mkv: "video/x-matroska", webm: "video/webm", "3gp": "video/3gpp",
      "3g2": "video/3gpp2",
    };
    return map[ext] || "video/mp4";
  }
  if (IMAGE_EXTENSIONS.has(ext)) {
    const map: Record<string, string> = {
      jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
      gif: "image/gif", webp: "image/webp", heic: "image/heic",
      heif: "image/heif", bmp: "image/bmp", tiff: "image/tiff",
      tif: "image/tiff", svg: "image/svg+xml", avif: "image/avif",
    };
    return map[ext] || "image/jpeg";
  }
  return "application/octet-stream";
}

/** Check if a file is a video, handling empty file.type on iOS */
export function isVideoFile(file: File): boolean {
  if (file.type) return file.type.startsWith("video/");
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  return VIDEO_EXTENSIONS.has(ext);
}

export async function compressImage(
  file: File,
  options?: CompressionOptions
): Promise<File> {
  // Don't compress videos (handle empty file.type on iOS)
  if (isVideoFile(file)) {
    return file;
  }

  // Don't compress if already small enough
  if (file.size < 500 * 1024) {
    return file;
  }

  const mergedOptions = { ...defaultOptions, ...options };

  try {
    const compressedFile = await imageCompression(file, mergedOptions);
    return compressedFile;
  } catch (error) {
    console.error("Image compression failed:", error);
    return file; // Return original if compression fails
  }
}

export function getImageDimensions(
  file: File
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    // Scale timeout with file size: 15s base, +1s per 10MB, max 120s
    const timeoutMs = Math.min(15_000 + Math.ceil(file.size / (10 * 1024 * 1024)) * 1000, 120_000);
    const timeout = setTimeout(() => {
      reject(new Error("Timed out reading dimensions"));
    }, timeoutMs);

    if (isVideoFile(file)) {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () => {
        clearTimeout(timeout);
        URL.revokeObjectURL(video.src);
        resolve({ width: video.videoWidth, height: video.videoHeight });
      };
      video.onerror = () => { clearTimeout(timeout); reject(new Error("Failed to read video dimensions")); };
      video.src = URL.createObjectURL(file);
    } else {
      const img = new Image();
      img.onload = () => {
        clearTimeout(timeout);
        URL.revokeObjectURL(img.src);
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
      };
      img.onerror = () => { clearTimeout(timeout); reject(new Error("Failed to read image dimensions")); };
      img.src = URL.createObjectURL(file);
    }
  });
}

export function createFilePreview(file: File): string {
  return URL.createObjectURL(file);
}

export function revokeFilePreview(url: string): void {
  URL.revokeObjectURL(url);
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}
