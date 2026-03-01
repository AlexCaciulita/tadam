"use client";

import { useState, useCallback } from "react";
import { compressImage, getImageDimensions, createFilePreview } from "@/lib/utils/image-resize";
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

        // Step 2: Get dimensions
        const dimensions = await getImageDimensions(compressed);
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
          width: dimensions.width,
          height: dimensions.height,
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
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();

      try {
        // Step 1: Compress image
        updateUpload(uploadFile.id, { status: "compressing", progress: 10 });
        const compressed = await compressImage(uploadFile.file);

        // Step 2: Get dimensions
        const dimensions = await getImageDimensions(compressed);
        updateUpload(uploadFile.id, { progress: 20 });

        // Step 3: Upload file to R2 through same-origin API route
        updateUpload(uploadFile.id, { status: "uploading", progress: 30 });

        const mediaType = compressed.type.startsWith("video/") ? "video" : "photo";
        const formData = new FormData();
        formData.append("albumId", albumId);
        if (joinCode) {
          formData.append("joinCode", joinCode);
        }
        formData.append("file", compressed, compressed.name);

        const uploadApiResponse = await fetch("/api/uploads/r2/upload", {
          method: "POST",
          body: formData,
        });

        if (!uploadApiResponse.ok) {
          const contentType = uploadApiResponse.headers.get("content-type") || "";
          let errorMessage = "Failed to upload file";

          if (contentType.includes("application/json")) {
            const errorData = (await uploadApiResponse.json().catch(() => ({}))) as {
              error?: string;
            };
            errorMessage = errorData.error || errorMessage;
          } else {
            const errorText = await uploadApiResponse.text().catch(() => "");
            if (errorText) {
              errorMessage = errorText;
            }
          }

          throw new Error(errorMessage);
        }

        const { fileUrl, objectKey } = (await uploadApiResponse.json()) as {
          fileUrl: string;
          objectKey: string;
        };

        updateUpload(uploadFile.id, { progress: 70 });

        let uploaderId: string | null = null;
        if (!guestName) {
          try {
            // Ensure uploader_id points to an existing profile row.
            const { getDeviceUser } = await import("@/lib/device-user");
            uploaderId = (await getDeviceUser()).id;
          } catch {
            const { data: authData } = await supabase.auth.getUser();
            uploaderId = authData.user?.id || null;
          }
        }

        // Step 5: Insert media record
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
            width: dimensions.width,
            height: dimensions.height,
            file_size: compressed.size,
          })
          .select()
          .single();

        let mediaData = primaryInsert.data;
        let dbError = primaryInsert.error;

        // Fallback for environments where storage columns migration wasn't applied yet.
        if (dbError) {
          const maybeCode =
            dbError && typeof dbError === "object" && "code" in dbError
              ? String((dbError as { code?: string }).code || "")
              : "";
          const maybeMessage =
            dbError && typeof dbError === "object" && "message" in dbError
              ? String((dbError as { message?: string }).message || "")
              : "";
          const missingStorageColumns =
            maybeCode === "42703" || /storage_provider|storage_key/i.test(maybeMessage);

          if (missingStorageColumns) {
            const fallbackInsert = await supabase
              .from("media")
              .insert({
                album_id: albumId,
                uploader_id: uploaderId,
                guest_name: guestName || null,
                file_url: fileUrl,
                media_type: mediaType,
                width: dimensions.width,
                height: dimensions.height,
                file_size: compressed.size,
              })
              .select()
              .single();

            mediaData = fallbackInsert.data;
            dbError = fallbackInsert.error;
          }
        }

        if (dbError) throw dbError;
        updateUpload(uploadFile.id, { progress: 85 });

        updateUpload(uploadFile.id, {
          status: "success",
          progress: 100,
          url: fileUrl,
        });

        onUploadComplete?.(mediaData as Media);
      } catch (error) {
        console.error("Upload failed:", error);
        updateUpload(uploadFile.id, {
          status: "error",
          error: error instanceof Error ? error.message : "Upload failed",
        });
      }
    },
    [albumId, guestName, joinCode, updateUpload, onUploadComplete]
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

      // Upload all files concurrently (max 3 at a time)
      const batchSize = 3;
      for (let i = 0; i < newUploads.length; i += batchSize) {
        const batch = newUploads.slice(i, i + batchSize);
        await Promise.all(batch.map(doUpload));
      }

      setIsUploading(false);
    },
    [uploadFileDemo, uploadFileReal]
  );

  const reset = useCallback(() => {
    setUploads([]);
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
