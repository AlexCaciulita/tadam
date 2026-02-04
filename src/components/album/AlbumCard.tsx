"use client";

import Link from "next/link";
import { Lock } from "lucide-react";
import Avatar from "@/components/shared/Avatar";
import { cn } from "@/lib/utils/cn";
import type { Album } from "@/types/database";

interface AlbumCardProps {
  album: Album;
  className?: string;
}

export default function AlbumCard({ album, className }: AlbumCardProps) {
  return (
    <Link href={`/album/${album.id}`} className={cn("group block", className)}>
      <div className="relative bg-surface rounded-xl overflow-hidden transition-transform group-hover:scale-[1.02]">
        {/* Cover Image */}
        <div className="aspect-[4/3] relative">
          {album.cover_image_url ? (
            <img
              src={album.cover_image_url}
              alt={album.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-surface p-4">
              <span className="text-sm text-accent font-medium mb-2">Stay tuned!</span>
              <div className="text-4xl">🧑‍🚀</div>
            </div>
          )}

          {/* Private badge */}
          {album.is_private && (
            <div className="absolute top-3 left-3 w-8 h-8 bg-accent rounded-lg flex items-center justify-center shadow-sm">
              <Lock className="w-4 h-4 text-white" />
            </div>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="mt-2 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-foreground text-sm group-hover:text-primary transition-colors">
            {album.name}
          </h3>
          <p className="text-xs text-muted">
            {new Date(album.created_at).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </div>
        {album.owner && (
          <Avatar src={album.owner.avatar_url} size="xs" />
        )}
      </div>
    </Link>
  );
}
