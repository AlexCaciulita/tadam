"use client";

import Image from "next/image";
import { cn } from "@/lib/utils/cn";

interface AvatarProps {
  src?: string | null;
  alt?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  showChangeOverlay?: boolean;
  onClick?: () => void;
}

const sizeClasses = {
  xs: "w-6 h-6",
  sm: "w-8 h-8",
  md: "w-10 h-10",
  lg: "w-16 h-16",
  xl: "w-28 h-28",
};

const imageSizes = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 64,
  xl: 112,
};

export default function Avatar({
  src,
  alt = "Avatar",
  size = "md",
  className,
  showChangeOverlay = false,
  onClick,
}: AvatarProps) {
  return (
    <div
      className={cn(
        "relative rounded-full overflow-hidden bg-accent/30 flex-shrink-0",
        sizeClasses[size],
        onClick && "cursor-pointer",
        className
      )}
      onClick={onClick}
    >
      {src ? (
        <Image
          src={src}
          alt={alt}
          width={imageSizes[size]}
          height={imageSizes[size]}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full bg-accent/30 flex items-center justify-center">
          <svg
            className={cn(
              "text-accent/60",
              size === "xl" ? "w-16 h-16" : size === "lg" ? "w-10 h-10" : "w-5 h-5"
            )}
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
          </svg>
        </div>
      )}
      {showChangeOverlay && (
        <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-end pb-2 opacity-0 hover:opacity-100 transition-opacity">
          <svg className="w-5 h-5 text-white mb-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="text-white text-[10px] font-medium">Change avatar</span>
        </div>
      )}
    </div>
  );
}
