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

export default function JoinAlbumTokenPage() {
  const { t } = useI18n();
  const router = useRouter();
  const params = useParams();
  const token = (params.token as string).toLowerCase();
  const [album, setAlbum] = useState<Album | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAlbum = async () => {
      const supabase = createClient();

      const { data, error: fetchError } = await supabase
        .from("albums")
        .select("*")
        .eq("public_token", token)
        .single();

      if (fetchError || !data) {
        setError(t("join.albumNotFoundLink"));
        setLoading(false);
        return;
      }

      const albumData = data as Album;
      setAlbum(albumData);

      const storedName = localStorage.getItem(`${GUEST_KEY_PREFIX}${albumData.id}`);
      if (storedName) {
        router.replace(`/album/${albumData.id}`);
        return;
      }

      setLoading(false);
    };

    fetchAlbum();
  }, [token, t, router]);

  const handleNameSubmit = async (name: string) => {
    if (!album) return;

    localStorage.setItem(`${GUEST_KEY_PREFIX}${album.id}`, name);

    const supabase = createClient();
    await supabase.from("album_members").insert({
      album_id: album.id,
      guest_name: name,
      role: "guest",
    });

    router.replace(`/album/${album.id}`);
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
          {t("join.tryAgainLink")}
        </Link>
      </div>
    );
  }

  return <GuestNameForm albumName={album.name} onSubmit={handleNameSubmit} />;
}
