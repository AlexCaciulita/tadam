"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Camera, X } from "lucide-react";
import Button from "./Button";
import { cn } from "@/lib/utils/cn";

interface QRScannerProps {
  onScan: (result: string) => void;
  onClose: () => void;
  className?: string;
}

export default function QRScanner({ onScan, onClose, className }: QRScannerProps) {
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scannerId = "qr-reader";

    const startScanner = async () => {
      try {
        const scanner = new Html5Qrcode(scannerId);
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1,
          },
          (decodedText) => {
            // Extract join code from URL or use as-is
            const match = decodedText.match(/\/join\/([A-Z0-9]{6})/i);
            const code = match ? match[1] : decodedText;
            onScan(code.toUpperCase());
            scanner.stop().catch(console.error);
          },
          () => {
            // Scan failure - ignore (continuous scanning)
          }
        );
      } catch (err) {
        console.error("QR Scanner error:", err);
        setError("Unable to access camera. Please check permissions.");
      }
    };

    startScanner();

    return () => {
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(console.error);
      }
    };
  }, [onScan]);

  return (
    <div className={cn("relative", className)}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold">Scan QR Code</h3>
        <button
          onClick={onClose}
          className="p-1 rounded-full hover:bg-surface"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div
        ref={containerRef}
        className="relative rounded-xl overflow-hidden bg-black"
      >
        <div id="qr-reader" className="w-full" />
      </div>

      {error && (
        <div className="mt-4 p-3 bg-danger/10 text-danger text-sm rounded-lg flex items-center gap-2">
          <Camera className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <p className="mt-4 text-sm text-muted text-center">
        Point your camera at the QR code to join the album
      </p>

      <Button variant="outline" onClick={onClose} className="w-full mt-4">
        Enter code manually instead
      </Button>
    </div>
  );
}
