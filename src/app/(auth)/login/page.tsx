"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Button from "@/components/shared/Button";
import { useI18n } from "@/lib/i18n/LanguageProvider";

export default function LoginPage() {
  const { t } = useI18n();
  const [emailOrUsername, setEmailOrUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const ADMIN_USERNAME_ALIAS = "admin";
  const ADMIN_EMAIL =
    process.env.NEXT_PUBLIC_ADMIN_LOGIN_EMAIL || "admin@memoriesbox.app";

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const nextPath =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("next") || "/home"
        : "/home";

    const supabase = createClient();
    let loginEmail = emailOrUsername.trim().toLowerCase();

    if (!loginEmail) {
      setError(t("auth.emailOrUsernameRequired"));
      setLoading(false);
      return;
    }

    if (!loginEmail.includes("@")) {
      if (loginEmail === ADMIN_USERNAME_ALIAS) {
        loginEmail = ADMIN_EMAIL;
      } else {
        setError(t("auth.useEmailForLogin"));
        setLoading(false);
        return;
      }
    }

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    router.push(nextPath);
    router.refresh();
  };

  return (
    <div>
      <h2 className="text-xl font-bold text-foreground mb-6">{t("auth.welcomeBack")}</h2>

      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            {t("auth.emailOrUsername")}
          </label>
          <input
            type="text"
            value={emailOrUsername}
            onChange={(e) => setEmailOrUsername(e.target.value)}
            placeholder="admin or your@email.com"
            required
            className="w-full px-4 py-2.5 rounded-lg border border-border bg-white text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            {t("common.password")}
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            className="w-full px-4 py-2.5 rounded-lg border border-border bg-white text-sm"
          />
        </div>

        {error && (
          <p className="text-sm text-danger bg-danger/10 px-3 py-2 rounded-lg">
            {error}
          </p>
        )}

        <Button type="submit" isLoading={loading} className="w-full">
          {t("common.signIn")}
        </Button>
      </form>

      <p className="text-center text-sm text-muted mt-6">
        {t("auth.noAccount")}{" "}
        <Link href="/register" className="text-primary hover:underline font-medium">
          {t("common.signUp")}
        </Link>
      </p>
    </div>
  );
}
