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

export async function compressImage(
  file: File,
  options?: CompressionOptions
): Promise<File> {
  // Don't compress videos
  if (file.type.startsWith("video/")) {
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

    if (file.type.startsWith("video/")) {
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
