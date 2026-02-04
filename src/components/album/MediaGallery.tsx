"use client";

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import MediaItem from "./MediaItem";
import { useRealtime } from "@/hooks/useRealtime";
import type { Media } from "@/types/database";

interface MediaGalleryProps {
  albumId: string;
  initialMedia: Media[];
}

export default function MediaGallery({ albumId, initialMedia }: MediaGalleryProps) {
  const [media, setMedia] = useState<Media[]>(initialMedia);

  // Sync with parent when initialMedia changes (e.g., demo uploads)
  useEffect(() => {
    setMedia((prev) => {
      // Merge: keep any realtime-added items + add new items from parent
      const existingIds = new Set(prev.map((m) => m.id));
      const newFromParent = initialMedia.filter((m) => !existingIds.has(m.id));
      if (newFromParent.length === 0 && prev.length === initialMedia.length) return prev;
      // Use parent's list as source of truth, but preserve realtime additions
      const parentIds = new Set(initialMedia.map((m) => m.id));
      const realtimeOnly = prev.filter((m) => !parentIds.has(m.id));
      return [...realtimeOnly, ...initialMedia];
    });
  }, [initialMedia]);

  const handleNewMedia = useCallback((newMedia: Media) => {
    setMedia((prev) => {
      // Avoid duplicates
      if (prev.some((m) => m.id === newMedia.id)) return prev;
      return [newMedia, ...prev];
    });
  }, []);

  const handleDeleteMedia = useCallback((deletedMedia: Media) => {
    setMedia((prev) => prev.filter((m) => m.id !== deletedMedia.id));
  }, []);

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

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      <AnimatePresence>
        {media.map((item) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.3 }}
          >
            <MediaItem media={item} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
