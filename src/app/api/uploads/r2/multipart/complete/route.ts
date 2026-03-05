import { NextRequest, NextResponse } from "next/server";
import { completeMultipartUpload } from "@/lib/r2/server";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      objectKey?: string;
      uploadId?: string;
      parts?: { partNumber: number; etag: string }[];
    };

    const { objectKey, uploadId, parts } = body;

    if (!objectKey || !uploadId || !Array.isArray(parts) || parts.length === 0) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    await completeMultipartUpload({ objectKey, uploadId, parts });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to complete multipart upload", error);
    return NextResponse.json({ error: "Failed to complete multipart upload" }, { status: 500 });
  }
}
