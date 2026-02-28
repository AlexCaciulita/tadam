"use client";

const ACTIVE_ALBUM_STORAGE_KEY = "tadam_active_album_id";

export function setActiveAlbumId(albumId: string) {
  if (typeof window === "undefined") return;
  if (!albumId) return;
  localStorage.setItem(ACTIVE_ALBUM_STORAGE_KEY, albumId);
}

export function getActiveAlbumId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACTIVE_ALBUM_STORAGE_KEY);
}
