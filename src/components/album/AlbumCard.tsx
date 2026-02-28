"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ImagePlus, Lock } from "lucide-react";
import Avatar from "@/components/shared/Avatar";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils/cn";
import type { Album } from "@/types/database";

interface AlbumCardProps {
  album: Album;
  className?: string;
}

export default function AlbumCard({ album, className }: AlbumCardProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(album.cover_image_url || null);

  useEffect(() => {
    let cancelled = false;

    const resolvePreview = async () => {
      if (album.cover_image_url) {
        setPreviewUrl(album.cover_image_url);
        return;
      }

      try {
        const supabase = createClient();
        const { data } = await supabase
          .from("media")
          .select("file_url, media_type")
          .eq("album_id", album.id)
          .order("created_at", { ascending: false })
          .limit(12);

        const rows = (data || []) as Array<{ file_url: string; media_type: string }>;
        const preferred = rows.find((row) => row.media_type === "photo") || rows[0];
        if (!cancelled) {
          setPreviewUrl(preferred?.file_url || null);
        }
      } catch {
        if (!cancelled) setPreviewUrl(null);
      }
    };

    resolvePreview();

    return () => {
      cancelled = true;
    };
  }, [album.id, album.cover_image_url]);

  return (
    <Link href={`/album/${album.id}`} className={cn("group block", className)}>
      <article className="ig-card overflow-hidden transition-transform group-hover:scale-[1.01]">
        <div className="flex items-center justify-between p-3.5 border-b border-border">
          <div className="flex items-center gap-2 min-w-0">
            <Avatar src={album.owner?.avatar_url} size="sm" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{album.name}</p>
              <p className="text-xs text-muted">
                {new Date(album.created_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            </div>
          </div>
          {album.is_private && (
            <span className="inline-flex items-center gap-1 rounded-full bg-surface px-2 py-1 text-[11px] text-muted">
              <Lock className="w-3 h-3" />
              Private
            </span>
          )}
        </div>

        <div className="aspect-square relative bg-surface">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt={album.name}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-surface to-primary-light p-4">
              <span className="w-11 h-11 rounded-full bg-white inline-flex items-center justify-center mb-2 shadow-sm">
                <ImagePlus className="w-5 h-5 text-primary" />
              </span>
              <span className="text-sm text-muted font-medium">Waiting for first upload</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between p-3">
          <p className="text-xs text-muted">Open album</p>
          <p className="text-xs font-semibold text-primary group-hover:text-primary-hover">
            View
          </p>
        </div>
      </article>
    </Link>
  );
}
