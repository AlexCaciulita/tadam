"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import GuestNameForm from "@/components/guest/GuestNameForm";
import type { Album } from "@/types/database";
import { Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n/LanguageProvider";

const GUEST_KEY_PREFIX = "tadam_guest_album_";
const ROLE_PREFIX = "tadam_album_role_";

export default function JoinCodePage() {
  const { t } = useI18n();
  const router = useRouter();
  const params = useParams();
  const code = (params.code as string).toUpperCase();
  const [album, setAlbum] = useState<Album | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAlbum = async () => {
      const supabase = createClient();

      const { data, error: fetchError } = await supabase
        .from("albums")
        .select("*")
        .eq("join_code", code)
        .single();

      if (fetchError || !data) {
        setError(t("join.albumNotFoundCode"));
        setLoading(false);
        return;
      }

      const albumData = data as Album;
      setAlbum(albumData);

      // If name is already stored, redirect straight to the album.
      const storedName = localStorage.getItem(`${GUEST_KEY_PREFIX}${albumData.id}`);
      if (storedName) {
        // Ensure role is set to member for the couple code path.
        localStorage.setItem(`${ROLE_PREFIX}${albumData.id}`, "member");
        router.replace(`/a/${albumData.id}`);
        return;
      }

      setLoading(false);
    };

    fetchAlbum();
  }, [code, t, router]);

  const handleNameSubmit = async (name: string) => {
    if (!album) return;

    // Store name and role (couple = member) so the album page can read it.
    localStorage.setItem(`${GUEST_KEY_PREFIX}${album.id}`, name);
    localStorage.setItem(`${ROLE_PREFIX}${album.id}`, "member");

    // Join album as member (couple)
    const supabase = createClient();
    await supabase.from("album_members").insert({
      album_id: album.id,
      guest_name: name,
      role: "member",
    });

    router.replace(`/a/${album.id}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !album) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white px-6">
        <div className="text-4xl mb-4">😕</div>
        <h1 className="text-xl font-bold text-foreground mb-2">{t("join.albumNotFound")}</h1>
        <p className="text-sm text-muted text-center mb-6">{error}</p>
        <Link href="/join" className="text-primary font-medium hover:underline">
          {t("join.tryAgainCode")}
        </Link>
      </div>
    );
  }

  return <GuestNameForm albumName={album.name} onSubmit={handleNameSubmit} />;
}
