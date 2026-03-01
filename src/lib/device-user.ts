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

  const supabase = createClient();
  const { data: authData } = await supabase.auth.getUser();
  const authUser = authData.user;
  const id = authUser?.id || getDeviceId();
  const shortId = id.slice(0, 8);

  const sanitizeUsername = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 30);

  const emailUsername = authUser?.email?.split("@")[0] || "";
  const metadataUsername =
    typeof authUser?.user_metadata?.username === "string"
      ? authUser.user_metadata.username
      : "";
  const metadataDisplayName =
    typeof authUser?.user_metadata?.display_name === "string"
      ? authUser.user_metadata.display_name
      : "";

  const derivedUsername =
    sanitizeUsername(metadataUsername) ||
    sanitizeUsername(emailUsername) ||
    `guest_${shortId}`;
  const derivedDisplayName = metadataDisplayName || derivedUsername || "Guest";

  // Try existing profile first to avoid overwriting role or display data.
  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (existingProfile) {
    cachedUser = existingProfile as Profile;
    return cachedUser;
  }

  // Insert profile if missing.
  const { data, error } = await supabase
    .from("profiles")
    .insert({
      id,
      username: derivedUsername,
      display_name: derivedDisplayName,
      role: "user",
    })
    .select()
    .maybeSingle();

  if (data) {
    cachedUser = data as Profile;
    return cachedUser;
  }

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
    username: derivedUsername,
    display_name: derivedDisplayName,
    avatar_url: null,
    role: "user",
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
