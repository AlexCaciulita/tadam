import { NextRequest, NextResponse } from "next/server";
import { abortMultipartUpload } from "@/lib/r2/server";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      objectKey?: string;
      uploadId?: string;
    };

    const { objectKey, uploadId } = body;

    if (!objectKey || !uploadId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    await abortMultipartUpload({ objectKey, uploadId });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to abort multipart upload", error);
    return NextResponse.json({ error: "Failed to abort multipart upload" }, { status: 500 });
  }
}
