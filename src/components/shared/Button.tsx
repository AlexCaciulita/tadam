"use client";

import { cn } from "@/lib/utils/cn";
import { Loader2 } from "lucide-react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
  children: React.ReactNode;
}

export default function Button({
  variant = "primary",
  size = "md",
  isLoading = false,
  children,
  className,
  disabled,
  ...props
}: ButtonProps) {
  const variants = {
    primary:
      "bg-primary text-white hover:bg-primary-hover disabled:bg-disabled disabled:text-white/70",
    outline:
      "border border-primary text-primary hover:bg-primary/5 disabled:border-disabled disabled:text-disabled",
    ghost:
      "text-foreground hover:bg-surface disabled:text-disabled",
    danger:
      "bg-danger text-white hover:bg-danger/90 disabled:bg-disabled",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-5 py-2.5 text-sm",
    lg: "px-6 py-3 text-base",
  };

  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all",
        "focus:outline-none focus:ring-2 focus:ring-primary/20",
        variants[variant],
        sizes[size],
        isLoading && "cursor-wait",
        className
      )}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
}
