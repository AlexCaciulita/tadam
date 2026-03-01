import type { Metadata } from "next";
import LanguageSwitcher from "@/components/shared/LanguageSwitcher";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "MemoriesBox — Share Moments Together",
  description: "Frictionless, collaborative photo and video sharing for events. Create albums, share QR codes, and relive memories together.",
  keywords: ["photo sharing", "event photos", "collaborative album", "QR code", "wedding photos"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <LanguageProvider>
          <LanguageSwitcher />
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
