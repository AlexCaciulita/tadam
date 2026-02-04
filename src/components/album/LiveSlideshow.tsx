"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { useRealtime } from "@/hooks/useRealtime";
import type { Media } from "@/types/database";

interface LiveSlideshowProps {
  albumId: string;
  initialMedia: Media[];
  albumName: string;
  onClose: () => void;
}

export default function LiveSlideshow({
  albumId,
  initialMedia,
  albumName,
  onClose,
}: LiveSlideshowProps) {
  const [media, setMedia] = useState<Media[]>(
    initialMedia.filter((m) => m.media_type === "photo")
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [direction, setDirection] = useState(1);

  // Real-time new photos
  useRealtime({
    table: "media",
    filter: `album_id=eq.${albumId}`,
    onInsert: (newMedia) => {
      if (newMedia.media_type === "photo") {
        setMedia((prev) => [...prev, newMedia]);
      }
    },
  });

  // Auto-advance
  useEffect(() => {
    if (!isPlaying || media.length <= 1) return;

    const timer = setInterval(() => {
      setDirection(1);
      setCurrentIndex((prev) => (prev + 1) % media.length);
    }, 5000);

    return () => clearInterval(timer);
  }, [isPlaying, media.length]);

  const goNext = useCallback(() => {
    setDirection(1);
    setCurrentIndex((prev) => (prev + 1) % media.length);
  }, [media.length]);

  const goPrev = useCallback(() => {
    setDirection(-1);
    setCurrentIndex((prev) => (prev - 1 + media.length) % media.length);
  }, [media.length]);

  // Keyboard controls
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === " ") {
        e.preventDefault();
        setIsPlaying((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, goNext, goPrev]);

  const currentMedia = media[currentIndex];

  if (media.length === 0) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
        <button onClick={onClose} className="absolute top-4 right-4 text-white/80 hover:text-white">
          <X className="w-8 h-8" />
        </button>
        <p className="text-white/60 text-lg">No photos to display</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
      >
        <X className="w-6 h-6 text-white" />
      </button>

      {/* Album name watermark */}
      <div className="absolute top-4 left-4 z-10">
        <p className="text-white/50 text-sm font-medium">{albumName}</p>
      </div>

      {/* Photo */}
      <div className="w-full h-full flex items-center justify-center">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.img
            key={currentMedia?.id || currentIndex}
            src={currentMedia?.file_url}
            alt=""
            custom={direction}
            initial={{ opacity: 0, x: direction * 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -direction * 100 }}
            transition={{ duration: 0.5 }}
            className="max-w-full max-h-full object-contain"
          />
        </AnimatePresence>
      </div>

      {/* Controls */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 z-10">
        <button
          onClick={goPrev}
          className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-white" />
        </button>
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className="p-3 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
        >
          {isPlaying ? (
            <Pause className="w-5 h-5 text-white" />
          ) : (
            <Play className="w-5 h-5 text-white ml-0.5" />
          )}
        </button>
        <button
          onClick={goNext}
          className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
        >
          <ChevronRight className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* Progress dots */}
      <div className="absolute bottom-20 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
        {media.slice(0, 20).map((_, i) => (
          <div
            key={i}
            className={`w-1.5 h-1.5 rounded-full transition-colors ${
              i === currentIndex ? "bg-white" : "bg-white/30"
            }`}
          />
        ))}
        {media.length > 20 && (
          <span className="text-white/50 text-xs ml-1">+{media.length - 20}</span>
        )}
      </div>

      {/* Counter */}
      <div className="absolute bottom-6 right-6 z-10">
        <p className="text-white/50 text-sm">
          {currentIndex + 1} / {media.length}
        </p>
      </div>
    </div>
  );
}
