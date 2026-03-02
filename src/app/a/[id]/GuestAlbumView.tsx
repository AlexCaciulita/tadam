"use client";

import { useState, useCallback } from "react";
import BrandLogo from "@/components/shared/BrandLogo";
import GuestNameForm from "@/components/guest/GuestNameForm";
import AlbumDetailClient from "@/app/(main)/album/[id]/AlbumDetailClient";
import { createClient } from "@/lib/supabase/client";
import type { Album, Media, MediaTask } from "@/types/database";

const GUEST_NAME_PREFIX = "tadam_guest_album_";
const ROLE_PREFIX = "tadam_album_role_";

interface GuestAlbumViewProps {
  album: Album;
  initialMedia: Media[];
  tasks: MediaTask[];
  albumOwnerId: string;
}

export default function GuestAlbumView({
  album,
  initialMedia,
  tasks,
  albumOwnerId,
}: GuestAlbumViewProps) {
  const storedName =
    typeof window !== "undefined"
      ? localStorage.getItem(`${GUEST_NAME_PREFIX}${album.id}`)
      : null;
  const storedRole =
    typeof window !== "undefined"
      ? localStorage.getItem(`${ROLE_PREFIX}${album.id}`)
      : null;

  const [guestName, setGuestName] = useState<string | null>(storedName);
  const [viewerRole, setViewerRole] = useState<"member" | "guest">(
    storedRole === "member" ? "member" : "guest"
  );

  const handleNameSubmit = useCallback(
    async (name: string) => {
      localStorage.setItem(`${GUEST_NAME_PREFIX}${album.id}`, name);
      localStorage.setItem(`${ROLE_PREFIX}${album.id}`, "guest");

      const supabase = createClient();
      await supabase.from("album_members").insert({
        album_id: album.id,
        guest_name: name,
        role: "guest",
      });

      setGuestName(name);
      setViewerRole("guest");
    },
    [album.id]
  );

  if (!guestName) {
    return <GuestNameForm albumName={album.name} onSubmit={handleNameSubmit} />;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-5 md:py-8 pb-24">
        <header className="mb-5 px-1 flex items-center gap-2">
          <BrandLogo size="md" />
          <p className="text-lg font-semibold tracking-tight text-foreground">
            MemoriesBox
          </p>
        </header>

        <AlbumDetailClient
          album={album}
          initialMedia={initialMedia}
          tasks={tasks}
          albumOwnerId={albumOwnerId}
          viewerRole={viewerRole}
        />
      </div>
    </div>
  );
}
