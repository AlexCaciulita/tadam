"use client";

import { cn } from "@/lib/utils/cn";

interface BrandLogoProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: "w-7 h-7 text-[10px]",
  md: "w-8 h-8 text-[11px]",
  lg: "w-10 h-10 text-xs",
};

export default function BrandLogo({ size = "md", className }: BrandLogoProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full ig-gradient text-white font-bold tracking-tight shadow-sm select-none",
        sizeClasses[size],
        className
      )}
      aria-label="MemoriesBox logo"
      title="MemoriesBox"
    >
      MB
    </span>
  );
}
