import { NextRequest, NextResponse } from "next/server";
import { buildObjectKey, createUploadUrl } from "@/lib/r2/server";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_MIME_PREFIXES = ["image/", "video/"];
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const formData = await request.formData();
    const albumId = String(formData.get("albumId") || "").trim();
    const joinCode = String(formData.get("joinCode") || "").trim().toUpperCase();
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

    return NextResponse.json({
      fileUrl,
      objectKey,
    });
  } catch (error) {
    console.error("Failed to upload file to R2", error);
    const message =
      error instanceof Error && error.message ? error.message : "Failed to upload file";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
