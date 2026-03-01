"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ImagePlus } from "lucide-react";
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
        <div className="aspect-[4/3] md:aspect-square relative bg-surface">
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

          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/0 to-transparent" />
          <div className="absolute bottom-2.5 left-2.5 right-2.5">
            <p className="text-sm md:text-base font-semibold text-white truncate drop-shadow">
              {album.name}
            </p>
          </div>
        </div>
      </article>
    </Link>
  );
}
