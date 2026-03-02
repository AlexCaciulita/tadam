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
    const timeout = setTimeout(() => {
      reject(new Error("Timed out reading dimensions"));
    }, 15_000);

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

// ---------------------------------------------------------------------------
// Video compression via Canvas + MediaRecorder (browser-native, no deps)
// ---------------------------------------------------------------------------

const VIDEO_COMPRESS_THRESHOLD = 20 * 1024 * 1024; // Skip videos < 20 MB
const TARGET_VIDEO_HEIGHT = 1080;
const TARGET_VIDEO_BITRATE = 8_000_000; // 8 Mbps

/**
 * Re-encode a video at 1080p / 8 Mbps using MediaRecorder.
 * Falls back to the original file if the browser doesn't support it or
 * the compressed version ends up larger.
 */
export async function compressVideo(
  file: File,
  onProgress?: (fraction: number) => void
): Promise<File> {
  if (file.size <= VIDEO_COMPRESS_THRESHOLD) return file;
  if (typeof MediaRecorder === "undefined") return file;

  return new Promise<File>((resolve) => {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";

    const objectUrl = URL.createObjectURL(file);
    video.src = objectUrl;

    const cleanup = () => URL.revokeObjectURL(objectUrl);

    // On any error, just return the original file
    video.onerror = () => { cleanup(); resolve(file); };

    video.onloadedmetadata = async () => {
      try {
        const needsScale = video.videoHeight > TARGET_VIDEO_HEIGHT;
        const scale = needsScale ? TARGET_VIDEO_HEIGHT / video.videoHeight : 1;
        // Ensure even dimensions (required by some codecs)
        const width = Math.round((video.videoWidth * scale) / 2) * 2;
        const height = Math.round((video.videoHeight * scale) / 2) * 2;

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d")!;

        // Video track from canvas
        const canvasStream = canvas.captureStream(30);
        const tracks: MediaStreamTrack[] = [...canvasStream.getVideoTracks()];

        // Try to capture audio
        let audioCtx: AudioContext | null = null;
        try {
          audioCtx = new AudioContext();
          const source = audioCtx.createMediaElementSource(video);
          const dest = audioCtx.createMediaStreamDestination();
          source.connect(dest);
          tracks.push(...dest.stream.getAudioTracks());
        } catch {
          // Audio capture not supported — continue without audio
        }

        const combinedStream = new MediaStream(tracks);

        // Pick best supported codec
        const mimeType = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"]
          .find((m) => MediaRecorder.isTypeSupported(m)) || "video/webm";

        const chunks: Blob[] = [];
        const recorder = new MediaRecorder(combinedStream, {
          mimeType,
          videoBitsPerSecond: TARGET_VIDEO_BITRATE,
        });

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };

        const stopTracks = () => combinedStream.getTracks().forEach((t) => t.stop());

        recorder.onstop = () => {
          stopTracks();
          audioCtx?.close().catch(() => {});
          cleanup();

          const blob = new Blob(chunks, { type: mimeType });
          const compressed = new File(
            [blob],
            file.name.replace(/\.[^.]+$/, ".webm"),
            { type: mimeType }
          );

          // Only use compressed if it's actually smaller
          resolve(compressed.size < file.size ? compressed : file);
        };

        recorder.onerror = () => {
          stopTracks();
          audioCtx?.close().catch(() => {});
          cleanup();
          resolve(file);
        };

        // Draw video frames to canvas
        const drawFrame = () => {
          if (video.ended || video.paused) return;
          ctx.drawImage(video, 0, 0, width, height);
          if (onProgress && video.duration) {
            onProgress(Math.min(video.currentTime / video.duration, 1));
          }
          requestAnimationFrame(drawFrame);
        };

        recorder.start(100);
        try {
          await video.play();
        } catch {
          // play() failed — stop the recorder so onstop fires and cleans up
          recorder.stop();
          return;
        }
        drawFrame();

        video.onended = () => {
          setTimeout(() => recorder.stop(), 200);
        };
      } catch {
        cleanup();
        resolve(file);
      }
    };
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
