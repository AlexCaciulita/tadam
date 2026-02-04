"use client";

import { useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils/cn";

interface CodeInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  onComplete?: (code: string) => void;
  className?: string;
}

export default function CodeInput({
  length = 6,
  value,
  onChange,
  onComplete,
  className,
}: CodeInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const handleChange = useCallback(
    (index: number, char: string) => {
      const sanitized = char.toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (!sanitized && char !== "") return;

      const newValue = value.split("");
      newValue[index] = sanitized;
      const joined = newValue.join("").slice(0, length);
      onChange(joined);

      if (sanitized && index < length - 1) {
        inputRefs.current[index + 1]?.focus();
      }

      if (joined.length === length && onComplete) {
        onComplete(joined);
      }
    },
    [value, length, onChange, onComplete]
  );

  const handleKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Backspace" && !value[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
        const newValue = value.split("");
        newValue[index - 1] = "";
        onChange(newValue.join(""));
      }
    },
    [value, onChange]
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      e.preventDefault();
      const pasted = e.clipboardData
        .getData("text")
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, length);
      onChange(pasted);
      if (pasted.length === length) {
        inputRefs.current[length - 1]?.focus();
        onComplete?.(pasted);
      } else {
        inputRefs.current[pasted.length]?.focus();
      }
    },
    [length, onChange, onComplete]
  );

  return (
    <div className={cn("flex gap-2 justify-center", className)}>
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => { inputRefs.current[i] = el; }}
          type="text"
          inputMode="text"
          maxLength={1}
          value={value[i] || ""}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          onFocus={() => setFocusedIndex(i)}
          onBlur={() => setFocusedIndex(-1)}
          className={cn(
            "w-12 h-14 text-center text-xl font-bold rounded-lg border-2 bg-white transition-all",
            focusedIndex === i
              ? "border-primary shadow-sm"
              : value[i]
              ? "border-primary/50"
              : "border-border"
          )}
        />
      ))}
    </div>
  );
}
