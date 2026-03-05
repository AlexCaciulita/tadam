"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2 } from "lucide-react";
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
  const [preparing, setPreparing] = useState(false);

  const handleClick = () => {
    setPreparing(true);
    inputRef.current?.click();
    // If user cancels the picker, reset after a timeout
    // (no reliable "cancel" event exists for file inputs)
    setTimeout(() => setPreparing(false), 60_000);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPreparing(false);
    if (e.target.files && e.target.files.length > 0) {
      onFilesSelected(e.target.files);
      // Reset input so same file can be selected again
      e.target.value = "";
    }
  };

  // On mobile, the picker losing focus fires a window focus event
  // Use this to clear the preparing state if no files were selected
  const handleWindowFocus = () => {
    // Small delay — onChange fires slightly after focus on some browsers
    setTimeout(() => setPreparing(false), 500);
  };

  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      accept="image/*,video/*"
      multiple
      onChange={handleChange}
      onBlur={() => {
        window.addEventListener("focus", handleWindowFocus, { once: true });
      }}
      className="hidden"
    />
  );

  if (variant === "icon") {
    return (
      <>
        <button
          onClick={handleClick}
          disabled={preparing}
          className={cn(
            "p-2.5 rounded-xl border border-border bg-white hover:bg-surface transition-colors",
            className
          )}
        >
          {preparing ? (
            <Loader2 className="w-5 h-5 text-muted animate-spin" />
          ) : (
            <ImagePlus className="w-5 h-5 text-foreground" />
          )}
        </button>
        {fileInput}
      </>
    );
  }

  if (variant === "inline") {
    return (
      <>
        <button
          onClick={handleClick}
          disabled={preparing}
          className={cn(
            "inline-flex items-center gap-2 px-5 py-2.5 ig-gradient ig-gradient-hover text-white rounded-xl font-semibold text-sm transition-all shadow-sm",
            className
          )}
        >
          {preparing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <ImagePlus className="w-4 h-4" />
          )}
          {preparing ? "Preparing..." : "Add media"}
        </button>
        {fileInput}
      </>
    );
  }

  // FAB (floating action button)
  return (
    <>
      <button
        onClick={handleClick}
        disabled={preparing}
        className={cn(
          "fixed right-4 bottom-[calc(env(safe-area-inset-bottom)+84px)] md:bottom-6 md:right-6 w-14 h-14 ig-gradient ig-gradient-hover text-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-105 z-[60]",
          className
        )}
      >
        {preparing ? (
          <Loader2 className="w-6 h-6 animate-spin" />
        ) : (
          <ImagePlus className="w-6 h-6" />
        )}
      </button>
      {fileInput}
    </>
  );
}
