"use client";

import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/types/database";

const STORAGE_KEY = "tadam_device_id";

let cachedUser: Profile | null = null;

/**
 * Get or create a device ID (UUID v4) stored in localStorage.
 * Synchronous — returns immediately.
 */
export function getDeviceId(): string {
  if (typeof window === "undefined") return "server";

  let id = localStorage.getItem(STORAGE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}

/**
 * Get or create a device user with a profile row in Supabase.
 * Uses upsert to avoid race conditions between select/insert.
 * Caches the result in memory.
 */
export async function getDeviceUser(): Promise<Profile> {
  if (cachedUser) return cachedUser;

  const id = getDeviceId();
  const shortId = id.slice(0, 8);
  const supabase = createClient();

  // Upsert — creates if missing, returns existing if found
  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      {
        id,
        username: `user_${shortId}`,
        display_name: `User ${shortId}`,
      },
      { onConflict: "id", ignoreDuplicates: true }
    )
    .select()
    .single();

  if (data) {
    cachedUser = data as Profile;
    return cachedUser;
  }

  // If upsert didn't return data (ignoreDuplicates=true skips returning),
  // fetch the existing row
  if (error || !data) {
    const { data: existing } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", id)
      .single();

    if (existing) {
      cachedUser = existing as Profile;
      return cachedUser;
    }
  }

  // Final fallback: return synthetic profile (won't be in DB)
  cachedUser = {
    id,
    username: `user_${shortId}`,
    display_name: `User ${shortId}`,
    avatar_url: null,
    created_at: new Date().toISOString(),
  };
  return cachedUser;
}

/**
 * Clear the cached user so the next getDeviceUser() re-fetches from DB.
 * Useful after profile updates.
 */
export function clearDeviceUserCache() {
  cachedUser = null;
}
