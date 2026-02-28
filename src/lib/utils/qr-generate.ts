import QRCode from "qrcode";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export async function generateQRCodeFromUrl(url: string): Promise<string> {
  try {
    const dataUrl = await QRCode.toDataURL(url, {
      width: 1024,
      margin: 4,
      color: {
        dark: "#1a1a1a",
        light: "#ffffff",
      },
      errorCorrectionLevel: "H",
    });
    return dataUrl;
  } catch (error) {
    console.error("QR code generation failed:", error);
    throw error;
  }
}

export async function generateQRCode(joinCode: string): Promise<string> {
  return generateQRCodeFromUrl(`${APP_URL}/join/${joinCode}`);
}

export function generateAlbumPublicToken(length = 16): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < length; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

export function getAlbumJoinPath(publicToken?: string | null, joinCode?: string): string {
  if (publicToken) return `/join/a/${publicToken}`;
  if (!joinCode) return "/join";
  return `/join/${joinCode}`;
}

export function getAlbumJoinUrl(publicToken?: string | null, joinCode?: string): string {
  return `${APP_URL}${getAlbumJoinPath(publicToken, joinCode)}`;
}

export async function generateAlbumQRCode(
  publicToken?: string | null,
  joinCode?: string
): Promise<string> {
  return generateQRCodeFromUrl(getAlbumJoinUrl(publicToken, joinCode));
}

export function downloadDataUrl(dataUrl: string, fileName: string) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function generateJoinCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Excluded I, O, 0, 1 to avoid confusion
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export function getJoinUrl(joinCode: string): string {
  return `${APP_URL}/join/${joinCode}`;
}
