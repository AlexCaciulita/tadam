"use client";

import { useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import MediaItem from "./MediaItem";
import { useRealtime } from "@/hooks/useRealtime";
import type { Media } from "@/types/database";

export type MediaGalleryView = "grid" | "feed";

interface MediaGalleryProps {
  albumId: string;
  initialMedia: Media[];
  view?: MediaGalleryView;
}

export default function MediaGallery({
  albumId,
  initialMedia,
  view = "grid",
}: MediaGalleryProps) {
  const [realtimeMedia, setRealtimeMedia] = useState<Media[]>([]);
  const [deletedMediaIds, setDeletedMediaIds] = useState<string[]>([]);

  const handleNewMedia = useCallback((newMedia: Media) => {
    setDeletedMediaIds((prev) => prev.filter((id) => id !== newMedia.id));
    setRealtimeMedia((prev) => {
      if (prev.some((m) => m.id === newMedia.id)) {
        return prev.map((m) => (m.id === newMedia.id ? newMedia : m));
      }
      return [newMedia, ...prev];
    });
  }, []);

  const handleDeleteMedia = useCallback((deletedMedia: Media) => {
    setDeletedMediaIds((prev) => {
      if (prev.includes(deletedMedia.id)) return prev;
      return [...prev, deletedMedia.id];
    });
    setRealtimeMedia((prev) => prev.filter((m) => m.id !== deletedMedia.id));
  }, []);

  const media = useMemo(() => {
    const hiddenIds = new Set(deletedMediaIds);
    const merged = new Map<string, Media>();

    for (const item of initialMedia) {
      if (!hiddenIds.has(item.id)) merged.set(item.id, item);
    }

    for (const item of realtimeMedia) {
      if (!hiddenIds.has(item.id)) merged.set(item.id, item);
    }

    return Array.from(merged.values()).sort(
      (a, b) => +new Date(b.created_at) - +new Date(a.created_at)
    );
  }, [initialMedia, realtimeMedia, deletedMediaIds]);

  // Real-time subscription
  useRealtime({
    table: "media",
    filter: `album_id=eq.${albumId}`,
    onInsert: handleNewMedia,
    onDelete: handleDeleteMedia,
  });

  if (media.length === 0) {
    return null;
  }

  if (view === "feed") {
    return (
      <div className="max-w-xl mx-auto space-y-4">
        <AnimatePresence>
          {media.map((item) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.25 }}
            >
              <MediaItem media={item} view="feed" />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
      <AnimatePresence>
        {media.map((item) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.3 }}
          >
            <MediaItem media={item} view="grid" />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
