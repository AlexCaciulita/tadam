"use client";

import Link from "next/link";
import { useState, useEffect, useMemo } from "react";
import { CalendarDays, FolderOpen, Images, Loader2, Share2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getDeviceUser } from "@/lib/device-user";
import { getActiveAlbumId, setActiveAlbumId } from "@/lib/active-album";
import AlbumGrid from "@/components/album/AlbumGrid";
import AlbumStoryRail from "@/components/album/AlbumStoryRail";
import EmptyState from "@/components/shared/EmptyState";
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
        const supabase = createClient();
        let contextProfile: Profile = deviceUser;

        // Admin context: when an active album is selected, show that couple's data.
        if (deviceUser.role === "platform_admin") {
          const activeAlbumId = getActiveAlbumId();
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
          setActiveAlbumId(allAlbums[0].id);
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
  }, []);

  const albumNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const album of albums) {
      map.set(album.id, album.name);
    }
    return map;
  }, [albums]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 ig-reveal">
      <section className="ig-feature-card p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {profile?.display_name || "My Wedding"}
            </h1>
            <p className="text-primary text-sm font-medium mt-1">
              {profile?.username ? `@${profile.username}` : "Wedding dashboard"}
            </p>
            <p className="text-sm text-muted mt-2">
              Capture every table, dance, toast, and candid moment.
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/album"
              className="text-xs sm:text-sm px-3.5 py-2 rounded-xl border border-border bg-white hover:bg-surface inline-flex items-center gap-2"
            >
              <Images className="w-4 h-4" />
              Open Album
            </Link>
            <Link
              href="/share"
              className="text-xs sm:text-sm px-3.5 py-2 rounded-xl ig-gradient ig-gradient-hover text-white inline-flex items-center gap-2 shadow-sm"
            >
              <Share2 className="w-4 h-4" />
              Share
            </Link>
          </div>
        </div>
      </section>

      {albums.length > 0 && (
        <AlbumStoryRail albums={albums} activeAlbumId={albums[0]?.id} />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="ig-card p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted">Albums</p>
            <FolderOpen className="w-4 h-4 text-muted" />
          </div>
          <p className="text-2xl font-bold text-foreground">{albums.length}</p>
        </div>
        <div className="ig-card p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted">Total Uploads</p>
            <Images className="w-4 h-4 text-muted" />
          </div>
          <p className="text-2xl font-bold text-foreground">{mediaCount}</p>
        </div>
        <div className="ig-card p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted">Last 7 Days</p>
            <CalendarDays className="w-4 h-4 text-muted" />
          </div>
          <p className="text-2xl font-bold text-foreground">{uploadsThisWeek}</p>
        </div>
      </div>

      {albums.length > 0 ? (
        <>
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">My Albums</h2>
            <AlbumGrid albums={albums} />
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">Recent Uploads</h2>
            {recentMedia.length > 0 ? (
              <div className="space-y-3">
                {recentMedia.map((item) => (
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
                      <p className="text-sm font-medium text-foreground truncate">
                        {albumNameById.get(item.album_id) || "Album"}
                      </p>
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
                <p className="text-sm text-muted">No uploads yet.</p>
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
