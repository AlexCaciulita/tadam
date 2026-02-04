"use client";

import { Camera, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { MediaTask } from "@/types/database";

interface PromptCardProps {
  task: MediaTask;
  onUpload?: () => void;
  className?: string;
}

export default function PromptCard({ task, onUpload, className }: PromptCardProps) {
  return (
    <div
      className={cn(
        "bg-primary-light border border-primary/20 rounded-xl p-4",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground">{task.title}</p>
          {onUpload && (
            <button
              onClick={onUpload}
              className="mt-3 inline-flex items-center gap-2 text-sm text-primary font-medium hover:text-primary-hover transition-colors"
            >
              <Camera className="w-4 h-4" />
              Upload for this task
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
