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
 * On first call, upserts a profile row. Caches the result.
 */
export async function getDeviceUser(): Promise<Profile> {
  if (cachedUser) return cachedUser;

  const id = getDeviceId();
  const supabase = createClient();

  // Try to fetch existing profile
  const { data: existing } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .single();

  if (existing) {
    cachedUser = existing as Profile;
    return cachedUser;
  }

  // Create profile
  const shortId = id.slice(0, 8);
  const { data: newProfile, error } = await supabase
    .from("profiles")
    .insert({
      id,
      username: `user_${shortId}`,
      display_name: `User ${shortId}`,
    })
    .select()
    .single();

  if (error) {
    // If insert fails (e.g. race condition), try fetching again
    const { data: retry } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", id)
      .single();

    if (retry) {
      cachedUser = retry as Profile;
      return cachedUser;
    }

    // Fallback: return a synthetic profile
    cachedUser = {
      id,
      username: `user_${shortId}`,
      display_name: `User ${shortId}`,
      avatar_url: null,
      created_at: new Date().toISOString(),
    };
    return cachedUser;
  }

  cachedUser = newProfile as Profile;
  return cachedUser;
}

/**
 * Clear the cached user so the next getDeviceUser() re-fetches from DB.
 * Useful after profile updates.
 */
export function clearDeviceUserCache() {
  cachedUser = null;
}
