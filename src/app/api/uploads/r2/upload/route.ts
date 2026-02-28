import { NextRequest, NextResponse } from "next/server";
import { buildObjectKey, createUploadUrl } from "@/lib/r2/server";

const ALLOWED_MIME_PREFIXES = ["image/", "video/"];
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const albumId = String(formData.get("albumId") || "").trim();
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
