import { NextRequest, NextResponse } from "next/server";
import { buildObjectKey, createUploadUrl } from "@/lib/r2/server";
import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js";

const ALLOWED_MIME_PREFIXES = ["image/", "video/"];
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const albumId = String(formData.get("albumId") || "").trim();
    const guestName = String(formData.get("guestName") || "").trim();
    const file = formData.get("file");

    if (!albumId || !file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "Missing albumId or file" }, { status: 400 });
    }

    const fileType = "type" in file ? file.type : "";
    const fileSize = "size" in file ? file.size : 0;
    const fileName =
      "name" in file && typeof file.name === "string" && file.name ? file.name : "upload.bin";

    if (!ALLOWED_MIME_PREFIXES.some((prefix) => fileType.startsWith(prefix))) {
      return NextResponse.json({ error: "Unsupported media type" }, { status: 400 });
    }

    if (fileSize > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ error: "File too large" }, { status: 413 });
    }

    const objectKey = buildObjectKey(albumId, fileName);
    const { uploadUrl, fileUrl } = await createUploadUrl({
      objectKey,
      expiresInSeconds: 120,
    });

    const uploadResponse = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": fileType || "application/octet-stream",
      },
      body: file,
    });

    if (!uploadResponse.ok) {
      const responseText = await uploadResponse.text();
      console.error("R2 upload failed", uploadResponse.status, responseText);
      return NextResponse.json(
        { error: `Upload to R2 failed (${uploadResponse.status})` },
        { status: 502 }
      );
    }

    // Prefer server-side media insert when service role key is configured.
    // This makes uploads resilient for fresh devices/sessions where client-side DB insert can fail.
    let media: Record<string, unknown> | null = null;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (supabaseUrl && serviceRoleKey) {
      try {
        const supabaseAdmin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);
        const mediaType = fileType.startsWith("video/") ? "video" : "photo";
        const { data, error } = await supabaseAdmin
          .from("media")
          .insert({
            album_id: albumId,
            uploader_id: null,
            guest_name: guestName || null,
            file_url: fileUrl,
            storage_provider: "r2",
            storage_key: objectKey,
            media_type: mediaType,
            file_size: fileSize || null,
          })
          .select()
          .single();

        if (!error && data) {
          media = data as Record<string, unknown>;
        } else if (error) {
          // Fallback for environments where storage columns migration is not applied.
          const code = String((error as { code?: string })?.code || "");
          const message = String((error as { message?: string })?.message || "");
          const missingStorageColumns =
            code === "42703" || /storage_provider|storage_key/i.test(message);

          if (missingStorageColumns) {
            const fallback = await supabaseAdmin
              .from("media")
              .insert({
                album_id: albumId,
                uploader_id: null,
                guest_name: guestName || null,
                file_url: fileUrl,
                media_type: mediaType,
                file_size: fileSize || null,
              })
              .select()
              .single();
            if (!fallback.error && fallback.data) {
              media = fallback.data as Record<string, unknown>;
            }
          }
        }
      } catch (insertError) {
        console.warn("Server-side media insert skipped", insertError);
      }
    }

    return NextResponse.json({
      fileUrl,
      objectKey,
      media,
    });
  } catch (error) {
    console.error("Failed to upload file to R2", error);
    const message =
      error instanceof Error && error.message ? error.message : "Failed to upload file";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
