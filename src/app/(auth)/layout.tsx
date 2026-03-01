"use client";

import BrandLogo from "@/components/shared/BrandLogo";
import { useI18n } from "@/lib/i18n/LanguageProvider";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { t } = useI18n();

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-3">
            <BrandLogo size="lg" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">MemoriesBox</h1>
          <p className="text-sm text-muted mt-1">{t("auth.tagline")}</p>
        </div>

        {/* Auth Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-border p-8">
          {children}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-muted mt-6">
          © 2026 Playlog Group Inc. All rights reserved.
        </p>
      </div>
    </div>
  );
}
