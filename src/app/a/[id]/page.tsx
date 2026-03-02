import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import GuestAlbumView from "./GuestAlbumView";
import type { Album, Media, MediaTask } from "@/types/database";

interface GuestAlbumPageProps {
  params: Promise<{ id: string }>;
}

export default async function GuestAlbumPage({ params }: GuestAlbumPageProps) {
  const { id } = await params;

  const supabase = await createClient();

  const { data: album, error: albumError } = await supabase
    .from("albums")
    .select("*")
    .eq("id", id)
    .single();

  if (albumError || !album) {
    notFound();
  }

  const { data: mediaData } = await supabase
    .from("media")
    .select("*")
    .eq("album_id", id)
    .order("created_at", { ascending: false });

  const media = (mediaData || []) as Media[];

  const { data: tasksData } = await supabase
    .from("media_tasks")
    .select("*")
    .eq("album_id", id)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  const tasks = (tasksData || []) as MediaTask[];

  return (
    <GuestAlbumView
      album={album as Album}
      initialMedia={media}
      tasks={tasks}
      albumOwnerId={album.owner_id}
    />
  );
}
