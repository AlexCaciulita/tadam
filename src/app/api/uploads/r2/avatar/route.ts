import { NextRequest, NextResponse } from "next/server";
import { createUploadUrl } from "@/lib/r2/server";
import { createClient } from "@/lib/supabase/server";

const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024;

export const runtime = "nodejs";

function sanitizeExt(fileName: string) {
  const ext = fileName.split(".").pop()?.toLowerCase() || "jpg";
  return ext.replace(/[^a-z0-9]/g, "") || "jpg";
}

function buildAvatarObjectKey(profileId: string, fileName: string) {
  const ext = sanitizeExt(fileName);
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 10);
  return `avatars/${profileId}/${timestamp}-${random}.${ext}`;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const formData = await request.formData();
    const profileId = String(formData.get("profileId") || "").trim();
    const file = formData.get("file");

    if (!profileId || !file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "Missing profileId or file" }, { status: 400 });
    }

    const fileType = "type" in file ? file.type : "";
    const fileSize = "size" in file ? file.size : 0;
    const fileName =
      "name" in file && typeof file.name === "string" && file.name ? file.name : "avatar.jpg";

    if (!fileType.startsWith("image/")) {
      return NextResponse.json({ error: "Only image files are allowed" }, { status: 400 });
    }

    if (fileSize > MAX_AVATAR_SIZE_BYTES) {
      return NextResponse.json({ error: "Avatar file is too large" }, { status: 413 });
    }

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const requesterId = authData.user.id;
    const { data: requesterProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", requesterId)
      .maybeSingle();
    const isAdmin = requesterProfile?.role === "platform_admin";
    const canUploadAvatar = requesterId === profileId || isAdmin;
    if (!canUploadAvatar) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const objectKey = buildAvatarObjectKey(profileId, fileName);
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
      console.error("Avatar R2 upload failed", uploadResponse.status, responseText);
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
    console.error("Failed to upload avatar", error);
    const message =
      error instanceof Error && error.message ? error.message : "Failed to upload avatar";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
