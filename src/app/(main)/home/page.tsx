"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { CalendarDays, FolderOpen, Images, Loader2, Share2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getDeviceUser } from "@/lib/device-user";
import { getActiveAlbumId, setActiveAlbumId } from "@/lib/active-album";
import AlbumGrid from "@/components/album/AlbumGrid";
import AlbumStoryRail from "@/components/album/AlbumStoryRail";
import EmptyState from "@/components/shared/EmptyState";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import type { Album, Media, Profile } from "@/types/database";

function dedupeAlbums(albums: Album[]) {
  const seen = new Set<string>();
  return albums.filter((album) => {
    if (seen.has(album.id)) return false;
    seen.add(album.id);
    return true;
  });
}

export default function HomePage() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const selectedFromQuery = searchParams.get("album") || "";
  const [albums, setAlbums] = useState<Album[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [recentMedia, setRecentMedia] = useState<Media[]>([]);
  const [mediaCount, setMediaCount] = useState(0);
  const [uploadsThisWeek, setUploadsThisWeek] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const deviceUser = await getDeviceUser();
        if (!deviceUser) {
          setLoading(false);
          return;
        }
        const supabase = createClient();
        let contextProfile: Profile = deviceUser;

        // Admin context: when an active album is selected, show that couple's data.
        const contextAlbumId = selectedFromQuery || getActiveAlbumId() || "";
        if (deviceUser.role === "platform_admin") {
          const activeAlbumId = contextAlbumId;
          if (activeAlbumId) {
            const { data: activeAlbum } = await supabase
              .from("albums")
              .select("id, owner_id")
              .eq("id", activeAlbumId)
              .maybeSingle();

            if (activeAlbum?.owner_id) {
              const { data: ownerProfile } = await supabase
                .from("profiles")
                .select("*")
                .eq("id", activeAlbum.owner_id)
                .maybeSingle();

              if (ownerProfile) {
                contextProfile = ownerProfile as Profile;
              }
            }
          }
        }

        setProfile(contextProfile);

        const [ownedAlbumsRes, membershipsRes] = await Promise.all([
          supabase
            .from("albums")
            .select("*")
            .eq("owner_id", contextProfile.id)
            .order("created_at", { ascending: false }),
          supabase.from("album_members").select("album_id").eq("user_id", contextProfile.id),
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
            .neq("owner_id", contextProfile.id)
            .order("created_at", { ascending: false });

          memberAlbums = (memberAlbumsData || []) as Album[];
        }

        const allAlbums = dedupeAlbums([
          ...((ownedAlbumsRes.data || []) as Album[]),
          ...memberAlbums,
        ]);
        setAlbums(allAlbums);
        if (allAlbums.length > 0) {
          const currentAlbumId =
            (contextAlbumId && allAlbums.some((album) => album.id === contextAlbumId)
              ? contextAlbumId
              : allAlbums[0].id) || allAlbums[0].id;
          setActiveAlbumId(currentAlbumId);
        }

        if (allAlbums.length > 0) {
          const albumIds = allAlbums.map((album) => album.id);
          const weekAgoIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

          const [mediaCountRes, weekCountRes, recentMediaRes] = await Promise.all([
            supabase
              .from("media")
              .select("id", { count: "exact", head: true })
              .in("album_id", albumIds),
            supabase
              .from("media")
              .select("id", { count: "exact", head: true })
              .in("album_id", albumIds)
              .gte("created_at", weekAgoIso),
            supabase
              .from("media")
              .select("*")
              .in("album_id", albumIds)
              .order("created_at", { ascending: false })
              .limit(12),
          ]);

          setMediaCount(mediaCountRes.count || 0);
          setUploadsThisWeek(weekCountRes.count || 0);
          setRecentMedia((recentMediaRes.data || []) as Media[]);
        }
      } catch (err) {
        console.error("Failed to fetch home data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedFromQuery]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 ig-reveal">
      <section className="ig-feature-card p-6 hidden sm:block">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {profile?.display_name || t("sidebar.myWedding")}
            </h1>
            <p className="text-primary text-sm font-medium mt-1">
              {profile?.username ? `@${profile.username}` : t("home.weddingDashboard")}
            </p>
            <p className="text-sm text-muted mt-2">
              {t("home.captureLine")}
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/album"
              className="text-xs sm:text-sm px-3.5 py-2 rounded-xl border border-border bg-white hover:bg-surface inline-flex items-center gap-2"
            >
              <Images className="w-4 h-4" />
              {t("common.openAlbum")}
            </Link>
            <Link
              href="/share"
              className="text-xs sm:text-sm px-3.5 py-2 rounded-xl ig-gradient ig-gradient-hover text-white inline-flex items-center gap-2 shadow-sm"
            >
              <Share2 className="w-4 h-4" />
              {t("common.share")}
            </Link>
          </div>
        </div>
      </section>

      {albums.length > 0 && (
        <div className="space-y-2 sm:space-y-3">
          <AlbumStoryRail
            albums={albums}
            activeAlbumId={albums[0]?.id}
            overrideImageUrl={profile?.avatar_url || null}
          />
          <div className="sm:hidden grid grid-cols-2 gap-2">
            <Link
              href="/album"
              className="text-xs px-3 py-2 rounded-lg border border-border bg-white hover:bg-surface inline-flex items-center justify-center gap-1.5"
            >
              <Images className="w-3.5 h-3.5" />
              {t("common.openAlbum")}
            </Link>
            <Link
              href="/share"
              className="text-xs px-3 py-2 rounded-lg ig-gradient ig-gradient-hover text-white inline-flex items-center justify-center gap-1.5 shadow-sm"
            >
              <Share2 className="w-3.5 h-3.5" />
              {t("common.share")}
            </Link>
          </div>
        </div>
      )}

      {albums.length > 0 ? (
        <>
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">{t("home.myAlbums")}</h2>
            <AlbumGrid albums={albums} />
          </section>

          {/* Compact mobile stats */}
          <section className="sm:hidden">
            <div className="ig-card p-3">
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-surface/70 p-2.5 text-center">
                  <p className="text-[11px] text-muted">{t("common.albums")}</p>
                  <p className="text-lg font-bold text-foreground">{albums.length}</p>
                </div>
                <div className="rounded-xl bg-surface/70 p-2.5 text-center">
                  <p className="text-[11px] text-muted">Uploads</p>
                  <p className="text-lg font-bold text-foreground">{mediaCount}</p>
                </div>
                <div className="rounded-xl bg-surface/70 p-2.5 text-center">
                  <p className="text-[11px] text-muted">{t("home.days7Short")}</p>
                  <p className="text-lg font-bold text-foreground">{uploadsThisWeek}</p>
                </div>
              </div>
            </div>
          </section>

          {/* Desktop/tablet stats */}
          <div className="hidden sm:grid grid-cols-3 gap-4">
            <div className="ig-card p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted">{t("common.albums")}</p>
                <FolderOpen className="w-4 h-4 text-muted" />
              </div>
              <p className="text-2xl font-bold text-foreground">{albums.length}</p>
            </div>
            <div className="ig-card p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted">{t("home.totalUploads")}</p>
                <Images className="w-4 h-4 text-muted" />
              </div>
              <p className="text-2xl font-bold text-foreground">{mediaCount}</p>
            </div>
            <div className="ig-card p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted">{t("home.last7Days")}</p>
                <CalendarDays className="w-4 h-4 text-muted" />
              </div>
              <p className="text-2xl font-bold text-foreground">{uploadsThisWeek}</p>
            </div>
          </div>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">{t("home.recentUploads")}</h2>
            {recentMedia.length > 0 ? (
              <div className="space-y-3">
                {recentMedia.slice(0, 8).map((item) => (
                  <Link
                    key={item.id}
                    href={`/album/${item.album_id}`}
                    className="ig-card flex items-center gap-3 p-2.5 hover:bg-surface/40 transition-colors"
                  >
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-surface flex items-center justify-center shrink-0">
                      {item.media_type === "photo" ? (
                        <img src={item.file_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[10px] text-muted font-medium">VIDEO</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-muted">
                        {new Date(item.created_at).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="ig-card p-4">
                <p className="text-sm text-muted">{t("common.noUploadsYet")}</p>
              </div>
            )}
          </section>
        </>
      ) : (
        <EmptyState
          title="No wedding album yet"
          description="Your planner can create your wedding album and share it with you."
        />
      )}
    </div>
  );
}
