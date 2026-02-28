"use client";

import Link from "next/link";
import { cn } from "@/lib/utils/cn";
import type { Album } from "@/types/database";

interface AlbumStoryRailProps {
  albums: Album[];
  activeAlbumId?: string;
  getHref?: (album: Album) => string;
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

export default function AlbumStoryRail({
  albums,
  activeAlbumId,
  getHref = (album) => `/album/${album.id}`,
}: AlbumStoryRailProps) {
  if (albums.length === 0) return null;

  return (
    <div className="ig-card p-3 sm:p-4 ig-reveal">
      <div className="flex items-center gap-3 overflow-x-auto hide-scrollbar pb-1">
        {albums.map((album) => {
          const isActive = album.id === activeAlbumId;
          return (
            <Link
              key={album.id}
              href={getHref(album)}
              className={cn(
                "shrink-0 rounded-2xl px-2 py-1.5 flex items-center gap-2 transition-colors",
                isActive ? "bg-primary-light" : "hover:bg-surface"
              )}
            >
              <span className="ig-story-ring">
                <span className="w-12 h-12 rounded-full overflow-hidden bg-white flex items-center justify-center">
                  {album.cover_image_url ? (
                    <img src={album.cover_image_url} alt={album.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs font-semibold text-muted">{initials(album.name) || "MB"}</span>
                  )}
                </span>
              </span>
              <span className="pr-2">
                <span className="block text-xs font-semibold text-foreground max-w-[130px] truncate">
                  {album.name}
                </span>
                <span className="block text-[11px] text-muted">
                  {new Date(album.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
