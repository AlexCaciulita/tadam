"use client";

import { Search } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}

export default function SearchInput({
  value,
  onChange,
  placeholder = "Search...",
  className,
  autoFocus = false,
}: SearchInputProps) {
  return (
    <div className={cn("relative", className)}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-white text-sm placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/10"
      />
    </div>
  );
}
