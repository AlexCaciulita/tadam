import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AlbumDetailClient from "./AlbumDetailClient";
import type { Album, AlbumMember, Media, MediaTask } from "@/types/database";

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

  // Fetch members with profiles
  const { data: membersData } = await supabase
    .from("album_members")
    .select("*, profile:profiles(*)")
    .eq("album_id", id);

  const members = (membersData || []) as AlbumMember[];

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
      members={members}
      initialMedia={media}
      tasks={tasks}
      albumOwnerId={album.owner_id}
    />
  );
}
