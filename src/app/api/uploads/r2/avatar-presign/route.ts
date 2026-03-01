import { NextRequest, NextResponse } from "next/server";
import { createUploadUrl } from "@/lib/r2/server";

const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024;

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
    const body = (await request.json()) as {
      profileId?: string;
      fileName?: string;
      contentType?: string;
      fileSize?: number;
    };

    const profileId = body.profileId?.trim();
    const fileName = body.fileName?.trim();
    const contentType = body.contentType?.trim();

    if (!profileId || !fileName || !contentType) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!contentType.startsWith("image/")) {
      return NextResponse.json({ error: "Only image files are allowed" }, { status: 400 });
    }

    if (typeof body.fileSize === "number" && body.fileSize > MAX_AVATAR_SIZE_BYTES) {
      return NextResponse.json({ error: "Avatar file is too large" }, { status: 413 });
    }

    const objectKey = buildAvatarObjectKey(profileId, fileName);
    const { uploadUrl, fileUrl } = await createUploadUrl({
      objectKey,
      expiresInSeconds: 120,
    });

    return NextResponse.json({ uploadUrl, fileUrl, objectKey });
  } catch (error) {
    console.error("Failed to create avatar upload URL", error);
    return NextResponse.json({ error: "Failed to create upload URL" }, { status: 500 });
  }
}
