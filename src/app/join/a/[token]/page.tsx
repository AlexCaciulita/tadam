"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import GuestUploadFlow from "@/components/guest/GuestUploadFlow";
import type { Album, MediaTask } from "@/types/database";
import { Loader2 } from "lucide-react";

export default function JoinAlbumTokenPage() {
  const params = useParams();
  const token = (params.token as string).toLowerCase();
  const [album, setAlbum] = useState<Album | null>(null);
  const [tasks, setTasks] = useState<MediaTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAlbum = async () => {
      const supabase = createClient();

      const { data, error: fetchError } = await supabase
        .from("albums")
        .select("*")
        .eq("public_token", token)
        .single();

      if (fetchError || !data) {
        setError("Album not found. Please check the link and try again.");
        setLoading(false);
        return;
      }

      setAlbum(data as Album);

      const { data: tasksData } = await supabase
        .from("media_tasks")
        .select("*")
        .eq("album_id", data.id)
        .eq("is_active", true);

      setTasks((tasksData as MediaTask[]) || []);
      setLoading(false);
    };

    fetchAlbum();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !album) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white px-6">
        <div className="text-4xl mb-4">😕</div>
        <h1 className="text-xl font-bold text-foreground mb-2">Album not found</h1>
        <p className="text-sm text-muted text-center mb-6">{error}</p>
        <Link href="/join" className="text-primary font-medium hover:underline">
          Try joining again
        </Link>
      </div>
    );
  }

  return (
    <GuestUploadFlow album={album} tasks={tasks} joinCode={album.join_code} />
  );
}
