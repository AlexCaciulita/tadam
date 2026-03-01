"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, ExternalLink, Share2, Images } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getDeviceUser } from "@/lib/device-user";
import { getActiveAlbumId, setActiveAlbumId } from "@/lib/active-album";
import AlbumStoryRail from "@/components/album/AlbumStoryRail";
import EmptyState from "@/components/shared/EmptyState";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import type { Album } from "@/types/database";

function dedupeAlbums(albums: Album[]) {
  const seen = new Set<string>();
  return albums.filter((album) => {
    if (seen.has(album.id)) return false;
    seen.add(album.id);
    return true;
  });
}

export default function AlbumHubPage() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedFromQuery = searchParams.get("album") || "";
  const [albums, setAlbums] = useState<Album[]>([]);
  const [albumMediaCounts, setAlbumMediaCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAlbums = async () => {
      try {
        const deviceUser = await getDeviceUser();
        const supabase = createClient();

        const [ownedAlbumsRes, membershipsRes] = await Promise.all([
          supabase
            .from("albums")
            .select("*")
            .eq("owner_id", deviceUser.id)
            .order("created_at", { ascending: false }),
          supabase.from("album_members").select("album_id").eq("user_id", deviceUser.id),
        ]);

        const memberAlbumIds = (membershipsRes.data || [])
          .map((member: { album_id: string }) => member.album_id)
          .filter(Boolean);

        let memberAlbums: Album[] = [];
        if (memberAlbumIds.length > 0) {
          const { data: memberAlbumsData } = await supabase
            .from("albums")
            .select("*")
            .in("id", memberAlbumIds)
            .neq("owner_id", deviceUser.id)
            .order("created_at", { ascending: false });

          memberAlbums = (memberAlbumsData || []) as Album[];
        }

        const allAlbums = dedupeAlbums([
          ...((ownedAlbumsRes.data || []) as Album[]),
          ...memberAlbums,
        ]);

        let resolvedAlbums = allAlbums;

        // Admin fallback: if not member/owner albums are empty, keep context from query/local storage.
        if (resolvedAlbums.length === 0 && deviceUser.role === "platform_admin") {
          const fallbackAlbumId = selectedFromQuery || getActiveAlbumId();
          if (fallbackAlbumId) {
            const { data: fallbackAlbum } = await supabase
              .from("albums")
              .select("*")
              .eq("id", fallbackAlbumId)
              .maybeSingle();

            if (fallbackAlbum) {
              resolvedAlbums = [fallbackAlbum as Album];
            }
          }
        }

        setAlbums(resolvedAlbums);

        if (resolvedAlbums.length > 0) {
          setActiveAlbumId(resolvedAlbums[0].id);
          const { data: mediaRows } = await supabase
            .from("media")
            .select("album_id")
            .in(
              "album_id",
              resolvedAlbums.map((album) => album.id)
            );

          const counts: Record<string, number> = {};
          for (const row of (mediaRows || []) as Array<{ album_id: string }>) {
            counts[row.album_id] = (counts[row.album_id] || 0) + 1;
          }
          setAlbumMediaCounts(counts);
        }
      } catch (error) {
        console.error("Failed to load album hub", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAlbums();
  }, [selectedFromQuery]);

  useEffect(() => {
    if (!loading && albums.length === 1) {
      router.replace(`/album/${albums[0].id}`);
    }
  }, [loading, albums, router]);

  const sortedAlbums = useMemo(
    () => [...albums].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)),
    [albums]
  );

  if (loading || (!loading && albums.length === 1)) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  if (albums.length === 0) {
    return (
      <EmptyState
        title={t("album.noAlbumAvailable")}
        description={t("album.noAlbumDescription")}
      />
    );
  }

  const activeAlbumId = selectedFromQuery || albums[0]?.id;

  return (
    <div className="space-y-6 ig-reveal">
      <div className="ig-feature-card p-6">
        <h1 className="text-2xl font-bold text-foreground">{t("common.album")}</h1>
        <p className="text-sm text-muted mt-1">
          {t("album.hubSubtitle")}
        </p>
      </div>

      <AlbumStoryRail
        albums={sortedAlbums}
        activeAlbumId={activeAlbumId}
        getHref={(album) => `/album/${album.id}`}
      />

      <div className="space-y-3">
        {sortedAlbums.map((album) => (
          <div
            key={album.id}
            className="ig-card overflow-hidden"
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-14 h-14 rounded-xl overflow-hidden bg-surface shrink-0 border border-border">
                  {album.cover_image_url ? (
                    <img
                      src={album.cover_image_url}
                      alt={album.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-surface to-primary-light" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{album.name}</p>
                  <p className="text-xs text-muted">
                    {new Date(album.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                    {" · "}
                    {albumMediaCounts[album.id] || 0} {t("album.uploads")}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Link
                  href={`/album/${album.id}`}
                  className="text-xs px-3 py-1.5 rounded-xl border border-border hover:bg-surface inline-flex items-center gap-1"
                >
                  <Images className="w-3 h-3" /> {t("album.openGallery")}
                </Link>
                <Link
                  href={`/share?album=${album.id}`}
                  className="text-xs px-3 py-1.5 rounded-xl border border-border hover:bg-surface inline-flex items-center gap-1"
                >
                  <Share2 className="w-3 h-3" /> {t("common.share")}
                </Link>
                <Link
                  href={`/album/${album.id}`}
                  className="text-xs px-2 py-1.5 rounded-xl border border-border hover:bg-surface inline-flex items-center gap-1"
                >
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
