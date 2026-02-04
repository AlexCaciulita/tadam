export interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface Album {
  id: string;
  name: string;
  description: string | null;
  join_code: string;
  is_private: boolean;
  owner_id: string;
  cover_image_url: string | null;
  created_at: string;
  // Joined fields
  owner?: Profile;
  member_count?: number;
  media_count?: number;
}

export interface AlbumMember {
  id: string;
  album_id: string;
  user_id: string | null;
  guest_name: string | null;
  role: "owner" | "member" | "guest";
  joined_at: string;
  // Joined fields
  profile?: Profile;
}

export interface Media {
  id: string;
  album_id: string;
  uploader_id: string | null;
  guest_name: string | null;
  file_url: string;
  thumbnail_url: string | null;
  media_type: "photo" | "video";
  width: number | null;
  height: number | null;
  file_size: number | null;
  created_at: string;
  // Joined fields
  uploader?: Profile;
  reaction_count?: number;
  user_has_reacted?: boolean;
}

export interface Reaction {
  id: string;
  media_id: string;
  user_id: string | null;
  guest_name: string | null;
  type: string;
  created_at: string;
}

export interface MediaTask {
  id: string;
  album_id: string;
  title: string;
  created_by: string | null;
  is_active: boolean;
  created_at: string;
  // Joined fields
  response_count?: number;
}

export interface Notification {
  id: string;
  user_id: string;
  type: "comment" | "like" | "upload" | "invite" | "task" | "friend_request";
  message: string;
  related_album_id: string | null;
  related_media_id: string | null;
  is_read: boolean;
  created_at: string;
  // Joined fields
  album?: Album;
}

export interface Friendship {
  id: string;
  user_id: string;
  friend_id: string;
  status: "pending" | "accepted";
  created_at: string;
  // Joined fields
  friend?: Profile;
  user?: Profile;
}

// Upload tracking types
export interface UploadFile {
  id: string;
  file: File;
  preview: string;
  progress: number;
  status: "pending" | "compressing" | "uploading" | "success" | "error";
  url?: string;
  error?: string;
}

// Guest session
export interface GuestSession {
  name: string;
  albumId: string;
  joinCode: string;
}
