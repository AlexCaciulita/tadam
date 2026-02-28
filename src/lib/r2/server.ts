import crypto from "node:crypto";

const R2_ACCOUNT_ID = process.env.CLOUDFLARE_R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
const R2_BUCKET = process.env.CLOUDFLARE_R2_BUCKET;
const R2_PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;

function getRequiredEnv(name: string, value: string | undefined) {
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function getR2Client() {
  const accountId = getRequiredEnv("CLOUDFLARE_R2_ACCOUNT_ID", R2_ACCOUNT_ID);
  const accessKeyId = getRequiredEnv(
    "CLOUDFLARE_R2_ACCESS_KEY_ID",
    R2_ACCESS_KEY_ID
  );
  const secretAccessKey = getRequiredEnv(
    "CLOUDFLARE_R2_SECRET_ACCESS_KEY",
    R2_SECRET_ACCESS_KEY
  );

  return {
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    accessKeyId,
    secretAccessKey,
  };
}

function sanitizeExt(fileName: string) {
  const ext = fileName.split(".").pop()?.toLowerCase() || "bin";
  return ext.replace(/[^a-z0-9]/g, "") || "bin";
}

export function buildObjectKey(albumId: string, fileName: string) {
  const ext = sanitizeExt(fileName);
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 10);
  return `albums/${albumId}/${timestamp}-${random}.${ext}`;
}

export function buildPublicFileUrl(objectKey: string) {
  const baseUrl = getRequiredEnv("NEXT_PUBLIC_R2_PUBLIC_URL", R2_PUBLIC_URL).replace(/\/$/, "");
  const safeKey = objectKey.replace(/^\//, "");
  return `${baseUrl}/${safeKey}`;
}

export async function createUploadUrl(options: {
  objectKey: string;
  expiresInSeconds?: number;
}) {
  const bucket = getRequiredEnv("CLOUDFLARE_R2_BUCKET", R2_BUCKET);
  const { endpoint, accessKeyId, secretAccessKey } = getR2Client();
  const expires = options.expiresInSeconds ?? 60;
  const service = "s3";
  const region = "auto";
  const now = new Date();
  const isoDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = isoDate.slice(0, 8);
  const host = new URL(endpoint).host;

  const encodedKey = options.objectKey
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  const canonicalUri = `/${bucket}/${encodedKey}`;

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const queryParams = new URLSearchParams({
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${accessKeyId}/${credentialScope}`,
    "X-Amz-Date": isoDate,
    "X-Amz-Expires": String(expires),
    "X-Amz-SignedHeaders": "host",
  });

  const canonicalQuery = [...queryParams.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`
    )
    .join("&");

  const canonicalHeaders = `host:${host}\n`;
  const canonicalRequest = [
    "PUT",
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    "host",
    "UNSIGNED-PAYLOAD",
  ].join("\n");

  const hashedCanonicalRequest = crypto
    .createHash("sha256")
    .update(canonicalRequest)
    .digest("hex");

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    isoDate,
    credentialScope,
    hashedCanonicalRequest,
  ].join("\n");

  const hmac = (key: Buffer | string, data: string) =>
    crypto.createHmac("sha256", key).update(data).digest();
  const kDate = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  const kSigning = hmac(kService, "aws4_request");
  const signature = crypto
    .createHmac("sha256", kSigning)
    .update(stringToSign)
    .digest("hex");

  const uploadUrl = `${endpoint}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;

  return {
    uploadUrl,
    fileUrl: buildPublicFileUrl(options.objectKey),
  };
}
