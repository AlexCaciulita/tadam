"use client";

import { cn } from "@/lib/utils/cn";

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  className?: string;
}

export default function Toggle({
  checked,
  onChange,
  label,
  icon,
  disabled = false,
  className,
}: ToggleProps) {
  return (
    <label
      className={cn(
        "flex items-center gap-3 cursor-pointer",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      {label && (
        <div className="flex-1">
          <span className="text-sm font-medium text-foreground">{label}</span>
        </div>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={cn(
          "relative inline-flex h-7 w-12 items-center rounded-full transition-colors",
          checked ? "bg-primary" : "bg-disabled"
        )}
      >
        <span
          className={cn(
            "inline-flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-sm transition-transform",
            checked ? "translate-x-6" : "translate-x-1"
          )}
        >
          {icon && checked && (
            <span className="text-primary/70">{icon}</span>
          )}
        </span>
      </button>
    </label>
  );
}
