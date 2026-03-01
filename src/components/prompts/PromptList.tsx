"use client";

import { CheckCircle2, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils/cn";
import type { MediaTask } from "@/types/database";

interface PromptListProps {
  tasks: MediaTask[];
  isOwner: boolean;
}

export default function PromptList({ tasks, isOwner }: PromptListProps) {
  const handleDelete = async (taskId: string) => {
    const supabase = createClient();
    await supabase.from("media_tasks").delete().eq("id", taskId);
    // Note: In a real app, we'd update state via parent callback
    window.location.reload();
  };

  if (tasks.length === 0) {
    return (
      <p className="text-sm text-muted text-center py-4">
        No media tasks yet. {isOwner ? "Create one to get started!" : ""}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {tasks.map((task) => (
        <div
          key={task.id}
          className={cn(
            "flex items-center gap-3 p-3 rounded-lg bg-white border border-border/50"
          )}
        >
          <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
          <p className="flex-1 text-sm font-medium">{task.title}</p>
          {isOwner && (
            <button
              onClick={() => handleDelete(task.id)}
              className="p-1 rounded hover:bg-danger/10 transition-colors"
            >
              <Trash2 className="w-4 h-4 text-muted hover:text-danger" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
