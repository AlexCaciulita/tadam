"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Trash2, X } from "lucide-react";
import MediaItem from "./MediaItem";
import { useRealtime } from "@/hooks/useRealtime";
import type { Media } from "@/types/database";

export type MediaGalleryView = "grid" | "feed" | "masonry";

interface MediaGalleryProps {
  albumId: string;
  initialMedia: Media[];
  view?: MediaGalleryView;
  canDelete?: boolean;
  onDeleteMedia?: (media: Media) => Promise<void> | void;
  onLightboxOpenChange?: (isOpen: boolean) => void;
}

export default function MediaGallery({
  albumId,
  initialMedia,
  view = "grid",
  canDelete = false,
  onDeleteMedia,
  onLightboxOpenChange,
}: MediaGalleryProps) {
  const [realtimeMedia, setRealtimeMedia] = useState<Media[]>([]);
  const [deletedMediaIds, setDeletedMediaIds] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [deletingMediaId, setDeletingMediaId] = useState<string | null>(null);
  const touchStartXRef = useRef<number | null>(null);
  const ignoreNextClickRef = useRef(false);

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

  const handleDeleteRequest = useCallback(
    async (mediaToDelete: Media) => {
      if (onDeleteMedia) {
        await onDeleteMedia(mediaToDelete);
      }
      handleDeleteMedia(mediaToDelete);
    },
    [onDeleteMedia, handleDeleteMedia]
  );

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

  const closeLightbox = useCallback(() => setLightboxIndex(null), []);
  const openLightboxAt = useCallback((index: number) => setLightboxIndex(index), []);

  const moveLightbox = useCallback(
    (direction: -1 | 1) => {
      if (lightboxIndex === null || media.length === 0) return;
      const next = (lightboxIndex + direction + media.length) % media.length;
      setLightboxIndex(next);
    },
    [lightboxIndex, media.length]
  );

  const lightboxMedia = lightboxIndex !== null ? media[lightboxIndex] : null;

  const handleLightboxTouchStart = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length !== 1) {
      touchStartXRef.current = null;
      return;
    }
    touchStartXRef.current = event.touches[0]?.clientX ?? null;
  }, []);

  const handleLightboxTouchEnd = useCallback(
    (event: React.TouchEvent<HTMLDivElement>) => {
      const startX = touchStartXRef.current;
      touchStartXRef.current = null;
      if (startX === null) return;

      const endX = event.changedTouches[0]?.clientX ?? startX;
      const deltaX = endX - startX;
      const threshold = 45;

      if (Math.abs(deltaX) < threshold) return;
      ignoreNextClickRef.current = true;
      moveLightbox(deltaX > 0 ? -1 : 1);
    },
    [moveLightbox]
  );

  const handleLightboxDelete = useCallback(async () => {
    if (!lightboxMedia || !canDelete || deletingMediaId) return;
    const confirmed = window.confirm("Delete this photo/video?");
    if (!confirmed) return;

    try {
      setDeletingMediaId(lightboxMedia.id);
      await handleDeleteRequest(lightboxMedia);
      if (media.length <= 1) {
        setLightboxIndex(null);
      } else {
        setLightboxIndex((prev) => (prev === null ? null : Math.min(prev, media.length - 2)));
      }
    } catch (error) {
      console.error("Failed to delete media:", error);
      const message =
        error instanceof Error && error.message ? error.message : "Failed to delete media";
      window.alert(message);
    } finally {
      setDeletingMediaId(null);
    }
  }, [lightboxMedia, canDelete, deletingMediaId, handleDeleteRequest, media.length]);

  useEffect(() => {
    const isOpen = lightboxIndex !== null;
    onLightboxOpenChange?.(isOpen);
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeLightbox();
      if (event.key === "ArrowLeft") moveLightbox(-1);
      if (event.key === "ArrowRight") moveLightbox(1);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      onLightboxOpenChange?.(false);
    };
  }, [lightboxIndex, closeLightbox, moveLightbox, onLightboxOpenChange]);

  useRealtime({
    table: "media",
    filter: `album_id=eq.${albumId}`,
    onInsert: handleNewMedia,
    onDelete: handleDeleteMedia,
  });

  if (media.length === 0) {
    return null;
  }

  const renderGrid = () => {
    if (view === "feed") {
      return (
        <div className="max-w-xl mx-auto space-y-4">
          <AnimatePresence>
            {media.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.25 }}
              >
                <MediaItem media={item} view="feed" onOpen={() => openLightboxAt(index)} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      );
    }

    if (view === "masonry") {
      return (
        <div className="columns-2 md:columns-3 gap-2.5 [column-fill:_balance]">
          <AnimatePresence>
            {media.map((item, index) => (
              <motion.div
                key={item.id}
                className="mb-2.5 break-inside-avoid"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.22 }}
              >
                <MediaItem media={item} view="masonry" onOpen={() => openLightboxAt(index)} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
        <AnimatePresence>
          {media.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.3 }}
            >
              <MediaItem media={item} view="grid" onOpen={() => openLightboxAt(index)} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <>
      {renderGrid()}

      {lightboxMedia && (
        <div
          className="fixed inset-0 z-[90] bg-black/95 flex items-center justify-center"
          onClick={() => {
            if (ignoreNextClickRef.current) {
              ignoreNextClickRef.current = false;
              return;
            }
            closeLightbox();
          }}
          onTouchStart={handleLightboxTouchStart}
          onTouchEnd={handleLightboxTouchEnd}
        >
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 text-white/80 hover:text-white z-10 p-2 rounded-full hover:bg-white/10 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>

          {media.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  moveLightbox(-1);
                }}
                className="absolute left-3 sm:left-5 top-1/2 -translate-y-1/2 text-white bg-white/15 hover:bg-white/25 p-2 rounded-full"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  moveLightbox(1);
                }}
                className="absolute right-3 sm:right-5 top-1/2 -translate-y-1/2 text-white bg-white/15 hover:bg-white/25 p-2 rounded-full"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </>
          )}

          {lightboxMedia.media_type === "video" ? (
            <video
              src={lightboxMedia.file_url}
              className="max-w-full max-h-full"
              controls
              autoPlay
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <img
              src={lightboxMedia.file_url}
              alt=""
              className="max-w-full max-h-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          )}

          {canDelete && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleLightboxDelete();
                }}
                disabled={deletingMediaId === lightboxMedia.id}
                className="inline-flex items-center gap-2 text-white bg-danger/70 backdrop-blur-sm px-4 py-2 rounded-full disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                {deletingMediaId === lightboxMedia.id ? "Deleting..." : "Delete"}
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
