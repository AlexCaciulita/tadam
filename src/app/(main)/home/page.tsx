"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getDeviceUser } from "@/lib/device-user";
import AlbumGrid from "@/components/album/AlbumGrid";
import EmptyState from "@/components/shared/EmptyState";
import type { Album, Profile } from "@/types/database";

export default function HomePage() {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const deviceUser = await getDeviceUser();
        setProfile(deviceUser);

        const supabase = createClient();

        // Fetch albums the user owns
        const { data: ownedAlbums } = await supabase
          .from("albums")
          .select("*")
          .eq("owner_id", deviceUser.id)
          .order("created_at", { ascending: false });

        // Fetch albums the user is a member of (but doesn't own)
        const { data: memberships } = await supabase
          .from("album_members")
          .select("album_id")
          .eq("user_id", deviceUser.id);

        const memberAlbumIds = (memberships || [])
          .map((m: { album_id: string }) => m.album_id)
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

        // Combine and deduplicate
        const allAlbums = [...(ownedAlbums || []), ...memberAlbums] as Album[];
        const seen = new Set<string>();
        setAlbums(
          allAlbums.filter((a) => {
            if (seen.has(a.id)) return false;
            seen.add(a.id);
            return true;
          })
        );
      } catch (err) {
        console.error("Failed to fetch home data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div>
      {/* Profile header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">
          {profile?.display_name || "Welcome"}
        </h1>
        {profile?.username && (
          <p className="text-primary text-sm">@{profile.username}</p>
        )}
      </div>

      {/* Albums */}
      {albums.length > 0 ? (
        <AlbumGrid albums={albums} />
      ) : (
        <EmptyState
          title="No albums yet"
          description="Create your first album and start sharing memories with friends and family."
        />
      )}
    </div>
  );
}
