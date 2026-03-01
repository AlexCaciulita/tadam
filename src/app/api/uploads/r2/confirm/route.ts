import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      albumId?: string;
      guestName?: string;
      fileUrl?: string;
      objectKey?: string;
      mediaType?: string;
      fileSize?: number;
      width?: number;
      height?: number;
    };

    const albumId = body.albumId?.trim();
    const fileUrl = body.fileUrl?.trim();
    const objectKey = body.objectKey?.trim();

    if (!albumId || !fileUrl) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ media: null });
    }

    const supabaseAdmin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);
    const mediaType = body.mediaType === "video" ? "video" : "photo";

    const { data, error } = await supabaseAdmin
      .from("media")
      .insert({
        album_id: albumId,
        uploader_id: null,
        guest_name: body.guestName || null,
        file_url: fileUrl,
        storage_provider: "r2",
        storage_key: objectKey || null,
        media_type: mediaType,
        file_size: body.fileSize || null,
        width: body.width || null,
        height: body.height || null,
      })
      .select()
      .single();

    if (!error && data) {
      return NextResponse.json({ media: data });
    }

    // Fallback for environments where storage columns migration is not applied.
    if (error) {
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
            guest_name: body.guestName || null,
            file_url: fileUrl,
            media_type: mediaType,
            file_size: body.fileSize || null,
            width: body.width || null,
            height: body.height || null,
          })
          .select()
          .single();

        if (!fallback.error && fallback.data) {
          return NextResponse.json({ media: fallback.data });
        }
      }
    }

    return NextResponse.json({ media: null });
  } catch (error) {
    console.error("Failed to confirm media upload", error);
    return NextResponse.json({ error: "Failed to confirm upload" }, { status: 500 });
  }
}
