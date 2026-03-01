"use client";

import { useRef } from "react";
import { ImagePlus } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface UploadButtonProps {
  onFilesSelected: (files: FileList) => void;
  className?: string;
  variant?: "fab" | "inline" | "icon";
}

export default function UploadButton({
  onFilesSelected,
  className,
  variant = "fab",
}: UploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFilesSelected(e.target.files);
      // Reset input so same file can be selected again
      e.target.value = "";
    }
  };

  if (variant === "icon") {
    return (
      <>
        <button
          onClick={handleClick}
          className={cn(
            "p-2.5 rounded-xl border border-border bg-white hover:bg-surface transition-colors",
            className
          )}
        >
          <ImagePlus className="w-5 h-5 text-foreground" />
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          onChange={handleChange}
          className="hidden"
        />
      </>
    );
  }

  if (variant === "inline") {
    return (
      <>
        <button
          onClick={handleClick}
          className={cn(
            "inline-flex items-center gap-2 px-5 py-2.5 ig-gradient ig-gradient-hover text-white rounded-xl font-semibold text-sm transition-all shadow-sm",
            className
          )}
        >
          <ImagePlus className="w-4 h-4" />
          Add media
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          onChange={handleChange}
          className="hidden"
        />
      </>
    );
  }

  // FAB (floating action button)
  return (
    <>
      <button
        onClick={handleClick}
        className={cn(
          "fixed right-4 bottom-[calc(env(safe-area-inset-bottom)+84px)] md:bottom-6 md:right-6 w-14 h-14 ig-gradient ig-gradient-hover text-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-105 z-[60]",
          className
        )}
      >
        <ImagePlus className="w-6 h-6" />
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        onChange={handleChange}
        className="hidden"
      />
    </>
  );
}
