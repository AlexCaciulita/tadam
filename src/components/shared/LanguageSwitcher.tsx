"use client";

import { useI18n } from "@/lib/i18n/LanguageProvider";

export default function LanguageSwitcher() {
  const { language, toggleLanguage } = useI18n();

  return (
    <button
      type="button"
      onClick={toggleLanguage}
      className="fixed top-3 right-3 z-[120] inline-flex items-center rounded-full border border-border bg-white/95 backdrop-blur-sm px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm hover:bg-surface transition-colors"
      aria-label="Toggle language"
      title={language === "en" ? "Switch to Romanian" : "Switch to English"}
    >
      <span className={language === "ro" ? "text-foreground" : "text-muted"}>RO</span>
      <span className="mx-1 text-muted">/</span>
      <span className={language === "en" ? "text-foreground" : "text-muted"}>EN</span>
    </button>
  );
}
