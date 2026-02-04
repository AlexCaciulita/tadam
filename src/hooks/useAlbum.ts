"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Album, AlbumMember, Media } from "@/types/database";

interface UseAlbumOptions {
  albumId?: string;
  joinCode?: string;
}

export function useAlbum({ albumId, joinCode }: UseAlbumOptions = {}) {
  const [album, setAlbum] = useState<Album | null>(null);
  const [members, setMembers] = useState<AlbumMember[]>([]);
  const [media, setMedia] = useState<Media[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const fetchAlbum = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      let query = supabase.from("albums").select("*");

      if (albumId) {
        query = query.eq("id", albumId);
      } else if (joinCode) {
        query = query.eq("join_code", joinCode.toUpperCase());
      } else {
        setLoading(false);
        return;
      }

      const { data, error: fetchError } = await query.single();

      if (fetchError) {
        setError("Album not found");
        setLoading(false);
        return;
      }

      setAlbum(data as Album);

      // Fetch members
      const { data: membersData } = await supabase
        .from("album_members")
        .select("*, profile:profiles(*)")
        .eq("album_id", data.id);

      setMembers((membersData as AlbumMember[]) || []);

      // Fetch media
      const { data: mediaData } = await supabase
        .from("media")
        .select("*")
        .eq("album_id", data.id)
        .order("created_at", { ascending: false });

      setMedia((mediaData as Media[]) || []);
    } catch {
      setError("Failed to load album");
    } finally {
      setLoading(false);
    }
  }, [albumId, joinCode, supabase]);

  useEffect(() => {
    fetchAlbum();
  }, [fetchAlbum]);

  const joinAlbumByCode = useCallback(
    async (code: string, guestName?: string) => {
      try {
        const { data: albumData, error: albumError } = await supabase
          .from("albums")
          .select("*")
          .eq("join_code", code.toUpperCase())
          .single();

        if (albumError || !albumData) {
          return { success: false, error: "Album not found" };
        }

        // Add as member
        const user = (await supabase.auth.getUser()).data.user;

        const { error: memberError } = await supabase
          .from("album_members")
          .insert({
            album_id: albumData.id,
            user_id: user?.id || null,
            guest_name: guestName || null,
            role: user ? "member" : "guest",
          });

        if (memberError && !memberError.message.includes("duplicate")) {
          return { success: false, error: "Failed to join album" };
        }

        setAlbum(albumData as Album);
        return { success: true, albumId: albumData.id };
      } catch {
        return { success: false, error: "Failed to join album" };
      }
    },
    [supabase]
  );

  const addMedia = useCallback((newMedia: Media) => {
    setMedia((prev) => [newMedia, ...prev]);
  }, []);

  const removeMedia = useCallback((mediaId: string) => {
    setMedia((prev) => prev.filter((m) => m.id !== mediaId));
  }, []);

  return {
    album,
    members,
    media,
    loading,
    error,
    refetch: fetchAlbum,
    joinAlbumByCode,
    addMedia,
    removeMedia,
  };
}
