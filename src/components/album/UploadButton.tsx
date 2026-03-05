"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface UploadButtonProps {
  onFilesSelected: (files: File[]) => void;
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
    // If user cancels the picker, reset after a generous timeout.
    // On iOS the system may take 1-2+ minutes to export large videos
    // from the photo library before onChange fires.
    setTimeout(() => setPreparing(false), 180_000);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      // Copy file references immediately before resetting the input.
      // On some mobile browsers, resetting the input can invalidate the FileList.
      const fileArray = Array.from(files);
      // Reset input so the same file can be selected again
      e.target.value = "";
      setPreparing(false);
      onFilesSelected(fileArray);
    } else {
      setPreparing(false);
    }
  };

  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      accept="image/*,video/*"
      multiple
      onChange={handleChange}
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
