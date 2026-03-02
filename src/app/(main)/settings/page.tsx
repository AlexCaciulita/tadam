"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import Avatar from "@/components/shared/Avatar";
import Button from "@/components/shared/Button";
import { getDeviceUser, clearDeviceUserCache } from "@/lib/device-user";
import { createClient } from "@/lib/supabase/client";
import { getActiveAlbumId } from "@/lib/active-album";
import { useI18n } from "@/lib/i18n/LanguageProvider";

export default function SettingsPage() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const selectedFromQuery = searchParams.get("album") || "";
  const [displayName, setDisplayName] = useState("");
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
        if (!deviceUser) {
          setFetching(false);
          return;
        }
        const supabase = createClient();
        let targetProfile = deviceUser;

        if (deviceUser.role === "platform_admin") {
          const activeAlbumId = selectedFromQuery || getActiveAlbumId();
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
        setAvatarUrl(targetProfile.avatar_url || null);
      } catch (err) {
        console.error("Failed to fetch profile:", err);
      } finally {
        setFetching(false);
      }
    };

    fetchProfile();
  }, [selectedFromQuery]);

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
      // Step 1: Get presigned upload URL (small JSON request, no file body)
      const presignResponse = await fetch("/api/uploads/r2/avatar-presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId: deviceId,
          fileName: file.name,
          contentType: file.type,
        }),
      });

      if (!presignResponse.ok) {
        const payload = (await presignResponse.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error || "Failed to get upload URL");
      }

      const { uploadUrl, fileUrl } = (await presignResponse.json()) as {
        uploadUrl: string;
        fileUrl: string;
      };

      // Step 2: Upload directly from browser to R2
      const r2Response = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });

      if (!r2Response.ok) {
        throw new Error(`Upload to storage failed (${r2Response.status})`);
      }

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
    <div className="space-y-6 ig-reveal">
      <div className="ig-feature-card p-6">
        <h1 className="text-2xl font-bold text-foreground">{t("settings.title")}</h1>
        <p className="text-sm text-muted mt-1">{t("settings.subtitle")}</p>
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
            {t("common.editAvatar")}
          </Button>
        </div>
      </div>

      <form onSubmit={handleSave} className="ig-card p-5 sm:p-6 space-y-4 max-w-xl">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            {t("common.displayName")}
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your name"
            className="w-full px-4 py-2.5 rounded-xl border border-border bg-white text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none"
          />
        </div>

        {success && (
          <p className="text-sm text-success bg-success/10 px-3 py-2 rounded-lg">
            {t("settings.profileUpdated")}
          </p>
        )}

        {error && (
          <p className="text-sm text-danger bg-danger/10 px-3 py-2 rounded-lg">
            {error}
          </p>
        )}

        <Button type="submit" isLoading={loading} className="w-full">{t("common.saveChanges")}</Button>
      </form>
    </div>
  );
}
