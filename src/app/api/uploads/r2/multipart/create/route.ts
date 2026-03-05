import { NextRequest, NextResponse } from "next/server";
import { buildObjectKey, buildPublicFileUrl, createMultipartUpload } from "@/lib/r2/server";

const ALLOWED_MIME_PREFIXES = ["image/", "video/"];
const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB

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

    const objectKey = buildObjectKey(albumId, fileName);
    const { uploadId } = await createMultipartUpload(objectKey);
    const fileUrl = buildPublicFileUrl(objectKey);

    return NextResponse.json({ uploadId, objectKey, fileUrl });
  } catch (error) {
    console.error("Failed to create multipart upload", error);
    return NextResponse.json({ error: "Failed to create multipart upload" }, { status: 500 });
  }
}
