import { NextRequest, NextResponse } from "next/server";
import { createPartUploadUrl } from "@/lib/r2/server";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      objectKey?: string;
      uploadId?: string;
      partNumbers?: number[];
    };

    const { objectKey, uploadId, partNumbers } = body;

    if (!objectKey || !uploadId || !Array.isArray(partNumbers) || partNumbers.length === 0) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (partNumbers.length > 20) {
      return NextResponse.json({ error: "Max 20 parts per request" }, { status: 400 });
    }

    const urls: Record<number, string> = {};
    await Promise.all(
      partNumbers.map(async (partNumber) => {
        urls[partNumber] = await createPartUploadUrl({
          objectKey,
          uploadId,
          partNumber,
          expiresInSeconds: 3600,
        });
      })
    );

    return NextResponse.json({ urls });
  } catch (error) {
    console.error("Failed to sign part URLs", error);
    return NextResponse.json({ error: "Failed to sign part URLs" }, { status: 500 });
  }
}
