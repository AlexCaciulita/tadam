"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import Avatar from "@/components/shared/Avatar";
import Button from "@/components/shared/Button";
import { getDeviceUser, clearDeviceUserCache } from "@/lib/device-user";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/types/database";

export default function SettingsPage() {
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch profile on mount
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const deviceUser = await getDeviceUser();
        setDeviceId(deviceUser.id);
        setDisplayName(deviceUser.display_name || "");
        setUsername(deviceUser.username || "");
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

  if (fetching) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">Settings</h1>

      {/* Avatar */}
      <div className="flex justify-center mb-8">
        <Avatar size="xl" showChangeOverlay />
      </div>

      {/* Profile form */}
      <form onSubmit={handleSave} className="space-y-4 max-w-md mx-auto">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Display name
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your name"
            className="w-full px-4 py-2.5 rounded-lg border border-border bg-white text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none"
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
            className="w-full px-4 py-2.5 rounded-lg border border-border bg-white text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none"
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

      {/* Logout */}
      <div className="mt-12 pt-6 border-t border-border">
        <Button variant="danger" className="w-full max-w-md mx-auto">
          Log out
        </Button>
      </div>
    </div>
  );
}
