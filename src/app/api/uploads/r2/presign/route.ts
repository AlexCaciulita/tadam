import { NextRequest, NextResponse } from "next/server";
import { buildObjectKey, createUploadUrl } from "@/lib/r2/server";

const ALLOWED_MIME_PREFIXES = ["image/", "video/"];
const MAX_FILE_SIZE_BYTES = 500 * 1024 * 1024; // 500 MB

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      albumId?: string;
      fileName?: string;
      contentType?: string;
      fileSize?: number;
    };

    const albumId = body.albumId?.trim();
    const fileName = body.fileName?.trim();
    const contentType = body.contentType?.trim();
    const fileSize = body.fileSize;

    if (!albumId || !fileName || !contentType) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!ALLOWED_MIME_PREFIXES.some((prefix) => contentType.startsWith(prefix))) {
      return NextResponse.json({ error: "Unsupported media type" }, { status: 400 });
    }

    if (typeof fileSize === "number" && fileSize > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ error: "File too large" }, { status: 413 });
    }

    // Give more time for larger files (min 5 min, ~15s per MB, up to 1 hour)
    const sizeBytes = typeof fileSize === "number" ? fileSize : 0;
    const expiresInSeconds = Math.min(
      Math.max(300, Math.ceil(sizeBytes / (1024 * 1024)) * 15),
      3600
    );

    const objectKey = buildObjectKey(albumId, fileName);
    const { uploadUrl, fileUrl } = await createUploadUrl({
      objectKey,
      expiresInSeconds,
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
