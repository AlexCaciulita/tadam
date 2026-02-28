"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { QrCode, ArrowRight } from "lucide-react";
import BrandLogo from "@/components/shared/BrandLogo";
import CodeInput from "@/components/shared/CodeInput";
import QRScanner from "@/components/shared/QRScanner";
import Button from "@/components/shared/Button";

export default function JoinPage() {
  const [code, setCode] = useState("");
  const [showScanner, setShowScanner] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleJoin = (joinCode?: string) => {
    const finalCode = joinCode || code;
    if (finalCode.length !== 6) {
      setError("Please enter a 6-digit code");
      return;
    }
    setError(null);
    router.push(`/join/${finalCode.toUpperCase()}`);
  };

  const handleScan = (result: string) => {
    setShowScanner(false);
    try {
      const url = new URL(result);
      const tokenMatch = url.pathname.match(/^\/join\/a\/([a-z0-9]+)$/i);
      if (tokenMatch) {
        router.push(`/join/a/${tokenMatch[1].toLowerCase()}`);
        return;
      }

      const codeMatch = url.pathname.match(/^\/join\/([A-Z0-9]{6})$/i);
      if (codeMatch) {
        router.push(`/join/${codeMatch[1].toUpperCase()}`);
        return;
      }
    } catch {
      const tokenMatch = result.match(/\/join\/a\/([a-z0-9]+)/i);
      if (tokenMatch) {
        router.push(`/join/a/${tokenMatch[1].toLowerCase()}`);
        return;
      }
      const codeMatch = result.match(/\/join\/([A-Z0-9]{6})/i);
      if (codeMatch) {
        router.push(`/join/${codeMatch[1].toUpperCase()}`);
        return;
      }
      if (result.length === 6) {
        router.push(`/join/${result.toUpperCase()}`);
        return;
      }
    }

    setError("Invalid QR code");
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <div className="text-center pt-12 pb-8 px-6">
        <div className="flex justify-center mb-3">
          <BrandLogo size="lg" />
        </div>
        <h1 className="text-3xl font-bold text-foreground mb-2">MemoriesBox</h1>
        <p className="text-muted">Join an album to start sharing photos</p>
      </div>

      <div className="flex-1 flex flex-col items-center px-6 max-w-md mx-auto w-full">
        {showScanner ? (
          <div className="w-full">
            <QRScanner
              onScan={handleScan}
              onClose={() => setShowScanner(false)}
            />
          </div>
        ) : (
          <>
            {/* Code Input */}
            <div className="w-full mb-8">
              <h2 className="text-lg font-bold text-center mb-4">
                Enter album code
              </h2>
              <CodeInput
                value={code}
                onChange={setCode}
                onComplete={handleJoin}
              />
              {error && (
                <p className="text-sm text-danger text-center mt-3">{error}</p>
              )}
            </div>

            {/* Join button */}
            <Button
              onClick={() => handleJoin()}
              disabled={code.length !== 6}
              className="w-full max-w-xs mb-6"
              size="lg"
            >
              Join Album
              <ArrowRight className="w-4 h-4" />
            </Button>

            {/* Divider */}
            <div className="flex items-center gap-4 w-full mb-6">
              <div className="flex-1 h-px bg-border" />
              <span className="text-sm text-muted">or</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* QR Scanner button */}
            <Button
              variant="outline"
              onClick={() => setShowScanner(true)}
              className="w-full max-w-xs"
              size="lg"
            >
              <QrCode className="w-5 h-5" />
              Scan QR Code
            </Button>
          </>
        )}

        {/* Login link */}
        <div className="mt-auto py-8 text-center">
          <p className="text-sm text-muted">
            Have an account?{" "}
            <a href="/login" className="text-primary font-medium hover:underline">
              Sign in
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
