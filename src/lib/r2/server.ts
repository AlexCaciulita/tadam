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

async function createSignedObjectUrl(options: {
  objectKey: string;
  method: "PUT" | "DELETE";
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
    options.method,
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

  return `${endpoint}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

// ─── Multipart Upload ──────────────────────────────────────────────

/**
 * AWS4-signed fetch to R2 using Authorization header.
 * Used for multipart lifecycle requests (create, complete, abort).
 */
async function signedR2Fetch(options: {
  method: string;
  objectKey: string;
  queryString?: string;
  body?: string;
  contentType?: string;
}): Promise<Response> {
  const bucket = getRequiredEnv("CLOUDFLARE_R2_BUCKET", R2_BUCKET);
  const { endpoint, accessKeyId, secretAccessKey } = getR2Client();
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

  const bodyHash = crypto
    .createHash("sha256")
    .update(options.body || "")
    .digest("hex");

  const canonicalQuery = options.queryString || "";

  const hdrs: Record<string, string> = {
    host,
    "x-amz-content-sha256": bodyHash,
    "x-amz-date": isoDate,
  };
  if (options.contentType) {
    hdrs["content-type"] = options.contentType;
  }

  const signedHeaderNames = Object.keys(hdrs).sort().join(";");
  const canonicalHeaders =
    Object.keys(hdrs)
      .sort()
      .map((key) => `${key}:${hdrs[key]}`)
      .join("\n") + "\n";

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;

  const canonicalRequest = [
    options.method,
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    signedHeaderNames,
    bodyHash,
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

  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaderNames}, Signature=${signature}`;

  const fetchHeaders: Record<string, string> = {
    Authorization: authorization,
    "x-amz-content-sha256": bodyHash,
    "x-amz-date": isoDate,
  };
  if (options.contentType) {
    fetchHeaders["Content-Type"] = options.contentType;
  }

  const url = `${endpoint}${canonicalUri}${canonicalQuery ? `?${canonicalQuery}` : ""}`;
  return fetch(url, {
    method: options.method,
    headers: fetchHeaders,
    body: options.body || undefined,
  });
}

export async function createMultipartUpload(objectKey: string): Promise<{ uploadId: string }> {
  const response = await signedR2Fetch({
    method: "POST",
    objectKey,
    queryString: "uploads=",
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`R2 CreateMultipartUpload failed (${response.status}): ${body}`);
  }

  const xml = await response.text();
  const match = xml.match(/<UploadId>(.+?)<\/UploadId>/);
  if (!match?.[1]) {
    throw new Error("R2 CreateMultipartUpload: no UploadId in response");
  }

  return { uploadId: match[1] };
}

export async function createPartUploadUrl(options: {
  objectKey: string;
  uploadId: string;
  partNumber: number;
  expiresInSeconds?: number;
}): Promise<string> {
  const bucket = getRequiredEnv("CLOUDFLARE_R2_BUCKET", R2_BUCKET);
  const { endpoint, accessKeyId, secretAccessKey } = getR2Client();
  const expires = options.expiresInSeconds ?? 3600;
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
    partNumber: String(options.partNumber),
    uploadId: options.uploadId,
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

  return `${endpoint}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

export async function completeMultipartUpload(options: {
  objectKey: string;
  uploadId: string;
  parts: { partNumber: number; etag: string }[];
}): Promise<void> {
  const partsXml = options.parts
    .sort((a, b) => a.partNumber - b.partNumber)
    .map(
      (p) =>
        `<Part><PartNumber>${p.partNumber}</PartNumber><ETag>${p.etag}</ETag></Part>`
    )
    .join("");
  const body = `<CompleteMultipartUpload>${partsXml}</CompleteMultipartUpload>`;

  const response = await signedR2Fetch({
    method: "POST",
    objectKey: options.objectKey,
    queryString: `uploadId=${encodeURIComponent(options.uploadId)}`,
    body,
    contentType: "application/xml",
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`R2 CompleteMultipartUpload failed (${response.status}): ${text}`);
  }
}

export async function abortMultipartUpload(options: {
  objectKey: string;
  uploadId: string;
}): Promise<void> {
  const response = await signedR2Fetch({
    method: "DELETE",
    objectKey: options.objectKey,
    queryString: `uploadId=${encodeURIComponent(options.uploadId)}`,
  });

  if (!response.ok && response.status !== 404) {
    const text = await response.text().catch(() => "");
    throw new Error(`R2 AbortMultipartUpload failed (${response.status}): ${text}`);
  }
}

export async function deleteObject(objectKey: string) {
  const deleteUrl = await createSignedObjectUrl({
    objectKey,
    method: "DELETE",
    expiresInSeconds: 90,
  });

  const response = await fetch(deleteUrl, { method: "DELETE" });
  if (!response.ok && response.status !== 404) {
    const body = await response.text().catch(() => "");
    throw new Error(`R2 delete failed (${response.status}): ${body}`);
  }
}
