import { NextRequest, NextResponse } from "next/server";
import { buildObjectKey, createUploadUrl } from "@/lib/r2/server";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_MIME_PREFIXES = ["image/", "video/"];
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = (await request.json()) as {
      albumId?: string;
      fileName?: string;
      contentType?: string;
      fileSize?: number;
      joinCode?: string;
    };

    const albumId = body.albumId?.trim();
    const fileName = body.fileName?.trim();
    const contentType = body.contentType?.trim();
    const fileSize = body.fileSize;
    const joinCode = body.joinCode?.trim().toUpperCase() || "";

    if (!albumId || !fileName || !contentType) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!ALLOWED_MIME_PREFIXES.some((prefix) => contentType.startsWith(prefix))) {
      return NextResponse.json({ error: "Unsupported media type" }, { status: 400 });
    }

    if (typeof fileSize === "number" && fileSize > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ error: "File too large" }, { status: 413 });
    }

    const { data: album, error: albumError } = await supabase
      .from("albums")
      .select("id, owner_id, join_code")
      .eq("id", albumId)
      .maybeSingle();
    if (albumError) throw albumError;
    if (!album) {
      return NextResponse.json({ error: "Album not found" }, { status: 404 });
    }

    const { data: authData } = await supabase.auth.getUser();
    const authUser = authData.user;

    let canUpload = false;
    if (authUser) {
      const [{ data: membership }, { data: profile }] = await Promise.all([
        supabase
          .from("album_members")
          .select("id")
          .eq("album_id", albumId)
          .eq("user_id", authUser.id)
          .maybeSingle(),
        supabase.from("profiles").select("role").eq("id", authUser.id).maybeSingle(),
      ]);

      const isAdmin = profile?.role === "platform_admin";
      const isOwner = album.owner_id === authUser.id;
      const isMember = Boolean(membership);
      canUpload = isAdmin || isOwner || isMember;
    } else {
      canUpload = Boolean(joinCode) && joinCode === (album.join_code || "").toUpperCase();
    }

    if (!canUpload) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const objectKey = buildObjectKey(albumId, fileName);
    const { uploadUrl, fileUrl } = await createUploadUrl({
      objectKey,
      expiresInSeconds: 120,
    });

    return NextResponse.json({
      uploadUrl,
      fileUrl,
      objectKey,
    });
  } catch (error) {
    console.error("Failed to create R2 upload URL", error);
    return NextResponse.json({ error: "Failed to create upload URL" }, { status: 500 });
  }
}
