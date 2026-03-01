import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AlbumDetailClient from "./AlbumDetailClient";
import type { Album, Media, MediaTask } from "@/types/database";

interface AlbumPageProps {
  params: Promise<{ id: string }>;
}

export default async function AlbumPage({ params }: AlbumPageProps) {
  const { id } = await params;

  const supabase = await createClient();

  // Fetch album (no auth needed — RLS is disabled)
  const { data: album, error: albumError } = await supabase
    .from("albums")
    .select("*")
    .eq("id", id)
    .single();

  if (albumError || !album) {
    notFound();
  }

  // Fetch media
  const { data: mediaData } = await supabase
    .from("media")
    .select("*")
    .eq("album_id", id)
    .order("created_at", { ascending: false });

  const media = (mediaData || []) as Media[];

  // Fetch active tasks
  const { data: tasksData } = await supabase
    .from("media_tasks")
    .select("*")
    .eq("album_id", id)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  const tasks = (tasksData || []) as MediaTask[];

  return (
    <AlbumDetailClient
      album={album as Album}
      initialMedia={media}
      tasks={tasks}
      albumOwnerId={album.owner_id}
    />
  );
}
