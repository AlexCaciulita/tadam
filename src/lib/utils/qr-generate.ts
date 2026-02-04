import QRCode from "qrcode";

export async function generateQRCode(joinCode: string): Promise<string> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const joinUrl = `${appUrl}/join/${joinCode}`;

  try {
    const dataUrl = await QRCode.toDataURL(joinUrl, {
      width: 300,
      margin: 2,
      color: {
        dark: "#1a1a1a",
        light: "#ffffff",
      },
      errorCorrectionLevel: "M",
    });
    return dataUrl;
  } catch (error) {
    console.error("QR code generation failed:", error);
    throw error;
  }
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
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${appUrl}/join/${joinCode}`;
}
