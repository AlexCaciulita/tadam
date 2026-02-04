"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Button from "@/components/shared/Button";
import type { MediaTask } from "@/types/database";

interface CreatePromptProps {
  albumId: string;
  onCreated: (task: MediaTask) => void;
}

export default function CreatePrompt({ albumId, onCreated }: CreatePromptProps) {
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setLoading(true);
    const supabase = createClient();
    const { getDeviceId } = await import("@/lib/device-user");

    const { data, error } = await supabase
      .from("media_tasks")
      .insert({
        album_id: albumId,
        title: title.trim(),
        created_by: getDeviceId(),
      })
      .select()
      .single();

    if (!error && data) {
      onCreated(data as MediaTask);
      setTitle("");
    }

    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">
          Task description
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g., Take a photo of the best-dressed guest"
          required
          className="w-full px-4 py-2.5 rounded-lg border border-border bg-white text-sm"
        />
      </div>
      <p className="text-xs text-muted">
        Guests will see this task when they open the album and can upload media in response.
      </p>
      <Button type="submit" isLoading={loading} disabled={!title.trim()} className="w-full">
        Add Task
      </Button>
    </form>
  );
}
