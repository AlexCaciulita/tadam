"use client";

import { useState } from "react";
import { Heart, Play } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { Media } from "@/types/database";

const isDemoMode = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  return !url || url.includes("your-project");
};

interface MediaItemProps {
  media: Media;
  view?: "grid" | "feed" | "masonry";
  onOpen?: () => void;
}

export default function MediaItem({
  media,
  view = "grid",
  onOpen,
}: MediaItemProps) {
  const [liked, setLiked] = useState(media.user_has_reacted || false);
  const [likeCount, setLikeCount] = useState(media.reaction_count || 0);

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (isDemoMode()) {
      // Demo mode — toggle like locally
      if (liked) {
        setLiked(false);
        setLikeCount((prev) => Math.max(0, prev - 1));
      } else {
        setLiked(true);
        setLikeCount((prev) => prev + 1);
      }
      return;
    }

    // Real Supabase mode
    const { createClient } = await import("@/lib/supabase/client");
    const { getDeviceId } = await import("@/lib/device-user");
    const supabase = createClient();
    const deviceId = getDeviceId();

    if (liked) {
      await supabase
        .from("reactions")
        .delete()
        .eq("media_id", media.id)
        .eq("user_id", deviceId);
      setLiked(false);
      setLikeCount((prev) => Math.max(0, prev - 1));
    } else {
      await supabase.from("reactions").insert({
        media_id: media.id,
        user_id: deviceId,
        type: "heart",
      });
      setLiked(true);
      setLikeCount((prev) => prev + 1);
    }
  };

  const mediaPreview = (
    <>
      {media.media_type === "video" ? (
        <>
          <video
            src={media.file_url}
            className="w-full h-full object-cover"
            muted
            playsInline
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-10 h-10 rounded-full bg-black/50 flex items-center justify-center">
              <Play className="w-5 h-5 text-white fill-white ml-0.5" />
            </div>
          </div>
        </>
      ) : (
        <img
          src={media.file_url}
          alt=""
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />
      )}
    </>
  );

  return (
    <>
      {view === "feed" ? (
        <article className="ig-card overflow-hidden">
          <div
            className="relative aspect-[4/5] overflow-hidden bg-surface cursor-pointer group"
            onClick={onOpen}
          >
            {mediaPreview}
            <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-black/0 to-transparent opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity" />
          </div>
          <div className="px-3.5 py-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {media.guest_name || "Wedding Guest"}
              </p>
              <p className="text-xs text-muted">
                {new Date(media.created_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            </div>
            <button
              onClick={handleLike}
              className="flex items-center gap-1.5 text-foreground bg-surface px-2.5 py-1.5 rounded-full hover:bg-surface/80 transition-colors"
            >
              <Heart
                className={cn(
                  "w-4 h-4 transition-all",
                  liked ? "fill-danger text-danger scale-110" : "text-muted"
                )}
              />
              <span className="text-xs font-medium">{likeCount}</span>
            </button>
          </div>
        </article>
      ) : view === "masonry" ? (
        <article
          className="relative rounded-xl overflow-hidden bg-surface cursor-pointer group border border-border shadow-[0_1px_2px_rgba(15,23,42,0.05)]"
          onClick={onOpen}
        >
          {media.media_type === "video" ? (
            <div className="relative aspect-[4/5]">
              <video
                src={media.file_url}
                className="w-full h-full object-cover"
                muted
                playsInline
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-10 h-10 rounded-full bg-black/50 flex items-center justify-center">
                  <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                </div>
              </div>
            </div>
          ) : (
            <img
              src={media.file_url}
              alt=""
              className="w-full h-auto block transition-transform duration-300 group-hover:scale-[1.02]"
              loading="lazy"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/0 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
              <button
                onClick={handleLike}
                className="flex items-center gap-1.5 text-white bg-black/30 backdrop-blur-sm px-2.5 py-1 rounded-full"
              >
                <Heart
                  className={cn(
                    "w-4 h-4 transition-all",
                    liked ? "fill-danger text-danger scale-110" : "text-white"
                  )}
                />
                {likeCount > 0 && (
                  <span className="text-xs font-medium">{likeCount}</span>
                )}
              </button>
            </div>
          </div>
        </article>
      ) : (
        <div
          className="relative aspect-square rounded-xl overflow-hidden bg-surface cursor-pointer group border border-border shadow-[0_1px_2px_rgba(15,23,42,0.05)]"
          onClick={onOpen}
        >
          {mediaPreview}

          {/* Hover overlay with heart */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/0 to-transparent opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
            <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
              <button
                onClick={handleLike}
                className="flex items-center gap-1.5 text-white bg-black/30 backdrop-blur-sm px-2.5 py-1 rounded-full"
              >
                <Heart
                  className={cn(
                    "w-4 h-4 transition-all",
                    liked ? "fill-danger text-danger scale-110" : "text-white"
                  )}
                />
                {likeCount > 0 && (
                  <span className="text-xs font-medium">{likeCount}</span>
                )}
              </button>
              {media.guest_name && (
                <span className="text-[11px] text-white/90 bg-black/30 backdrop-blur-sm px-2 py-1 rounded-full">
                  {media.guest_name}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
