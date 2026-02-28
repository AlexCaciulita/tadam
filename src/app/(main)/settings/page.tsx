"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import Avatar from "@/components/shared/Avatar";
import Button from "@/components/shared/Button";
import { getDeviceUser, clearDeviceUserCache } from "@/lib/device-user";
import { createClient } from "@/lib/supabase/client";
import { getActiveAlbumId } from "@/lib/active-album";

export default function SettingsPage() {
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Fetch profile on mount
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const deviceUser = await getDeviceUser();
        const supabase = createClient();
        let targetProfile = deviceUser;

        if (deviceUser.role === "platform_admin") {
          const activeAlbumId = getActiveAlbumId();
          if (activeAlbumId) {
            const { data: activeAlbum } = await supabase
              .from("albums")
              .select("id, owner_id")
              .eq("id", activeAlbumId)
              .maybeSingle();

            if (activeAlbum?.owner_id && activeAlbum.owner_id !== deviceUser.id) {
              const { data: ownerProfile } = await supabase
                .from("profiles")
                .select("*")
                .eq("id", activeAlbum.owner_id)
                .maybeSingle();

              if (ownerProfile) {
                targetProfile = ownerProfile;
              }
            }
          }
        }

        setDeviceId(targetProfile.id);
        setDisplayName(targetProfile.display_name || "");
        setUsername(targetProfile.username || "");
        setAvatarUrl(targetProfile.avatar_url || null);
      } catch (err) {
        console.error("Failed to fetch profile:", err);
      } finally {
        setFetching(false);
      }
    };

    fetchProfile();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deviceId) return;

    setLoading(true);
    setSuccess(false);
    setError(null);

    try {
      const supabase = createClient();

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          display_name: displayName.trim() || null,
          username: username.trim(),
        })
        .eq("id", deviceId);

      if (updateError) {
        throw updateError;
      }

      // Clear cache so next getDeviceUser() re-fetches
      clearDeviceUserCache();

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error("Failed to update profile:", err);
      setError(
        err instanceof Error ? err.message : "Failed to update profile. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !deviceId) return;

    event.target.value = "";
    setError(null);
    setSuccess(false);

    if (!file.type.startsWith("image/")) {
      setError("Please select an image file.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Avatar must be smaller than 5MB.");
      return;
    }

    setAvatarUploading(true);

    try {
      const formData = new FormData();
      formData.append("profileId", deviceId);
      formData.append("file", file, file.name);

      const uploadResponse = await fetch("/api/uploads/r2/avatar", {
        method: "POST",
        body: formData,
      });

      if (!uploadResponse.ok) {
        const contentType = uploadResponse.headers.get("content-type") || "";
        let message = "Failed to upload avatar";
        if (contentType.includes("application/json")) {
          const payload = (await uploadResponse.json().catch(() => ({}))) as { error?: string };
          message = payload.error || message;
        } else {
          const text = await uploadResponse.text().catch(() => "");
          if (text) message = text;
        }
        throw new Error(message);
      }

      const { fileUrl } = (await uploadResponse.json()) as { fileUrl: string };

      const supabase = createClient();
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: fileUrl })
        .eq("id", deviceId);

      if (updateError) {
        throw updateError;
      }

      setAvatarUrl(fileUrl);
      clearDeviceUserCache();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error("Failed to update avatar:", err);
      setError(err instanceof Error ? err.message : "Failed to update avatar.");
    } finally {
      setAvatarUploading(false);
    }
  };

  if (fetching) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="ig-card p-5">
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted mt-1">Manage your profile and wedding account details.</p>
      </div>

      <div className="ig-card p-6">
        <div className="flex flex-col items-center gap-3">
          <div className="ig-story-ring">
            <Avatar
              src={avatarUrl}
              size="xl"
              showChangeOverlay
              onClick={handleAvatarClick}
              className="border-2 border-white"
            />
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarSelected}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAvatarClick}
            isLoading={avatarUploading}
          >
            Edit avatar
          </Button>
        </div>
      </div>

      <form onSubmit={handleSave} className="ig-card p-5 sm:p-6 space-y-4 max-w-xl">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Display name
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your name"
            className="w-full px-4 py-2.5 rounded-xl border border-border bg-white text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Username
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) =>
              setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))
            }
            placeholder="username"
            className="w-full px-4 py-2.5 rounded-xl border border-border bg-white text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none"
          />
        </div>

        {success && (
          <p className="text-sm text-success bg-success/10 px-3 py-2 rounded-lg">
            Profile updated successfully!
          </p>
        )}

        {error && (
          <p className="text-sm text-danger bg-danger/10 px-3 py-2 rounded-lg">
            {error}
          </p>
        )}

        <Button type="submit" isLoading={loading} className="w-full">
          Save changes
        </Button>
      </form>
    </div>
  );
}
