"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, UserPlus } from "lucide-react";
import Button from "@/components/shared/Button";
import Toggle from "@/components/shared/Toggle";
import Avatar from "@/components/shared/Avatar";
import { generateAlbumPublicToken, generateJoinCode } from "@/lib/utils/qr-generate";
import { getOrCreateDeviceUser } from "@/lib/device-user";

export default function CreateAlbumPage() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const deviceUser = await getOrCreateDeviceUser();

      // Generate stable invite identifiers
      const joinCode = generateJoinCode();
      const publicToken = generateAlbumPublicToken();

      // Insert the album
      const { data: newAlbum, error: insertError } = await supabase
        .from("albums")
        .insert({
          name: name.trim(),
          description: description.trim() || null,
          join_code: joinCode,
          public_token: publicToken,
          is_private: isPrivate,
          owner_id: deviceUser.id,
        })
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }

      // Add the creator as an owner member
      await supabase.from("album_members").insert({
        album_id: newAlbum.id,
        user_id: deviceUser.id,
        role: "owner",
      });

      // Redirect to the new album
      router.push(`/album/${newAlbum.id}`);
    } catch (err: unknown) {
      console.error("Failed to create album:", err);
      const msg =
        err instanceof Error
          ? err.message
          : typeof err === "object" && err !== null && "message" in err
            ? String((err as { message: string }).message)
            : "Failed to create album. Please try again.";
      setError(msg);
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">Create album</h1>

      {/* Avatar with change overlay */}
      <div className="flex justify-center mb-6 md:hidden">
        <Avatar size="xl" showChangeOverlay />
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Album name */}
        <div>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Album name"
            required
            className="w-full px-4 py-3 rounded-lg border border-border bg-white text-base placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/10"
          />
        </div>

        {/* Description */}
        <div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            rows={4}
            className="w-full px-4 py-3 rounded-lg border border-border bg-white text-base placeholder:text-muted resize-none focus:border-primary focus:ring-2 focus:ring-primary/10"
          />
        </div>

        {/* Invite list */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-primary font-medium text-sm">Invite list</span>
            <span className="text-sm font-semibold text-foreground">
              0 friends selected
            </span>
          </div>
          <button
            type="button"
            className="w-16 h-16 rounded-full bg-accent/20 flex flex-col items-center justify-center hover:bg-accent/30 transition-colors"
          >
            <UserPlus className="w-6 h-6 text-accent" />
            <span className="text-[10px] font-medium text-foreground mt-0.5">
              Search
            </span>
          </button>
        </div>

        {/* Private album toggle */}
        <div className="flex items-center justify-between py-4 border-t border-border">
          <div>
            <h3 className="font-semibold text-foreground">Private album</h3>
            <p className="text-sm text-muted mt-0.5">
              Album is hidden to the public. Only members can view album content.
            </p>
          </div>
          <Toggle
            checked={isPrivate}
            onChange={setIsPrivate}
            icon={<Lock className="w-3 h-3" />}
          />
        </div>

        {error && (
          <p className="text-sm text-danger bg-danger/10 px-3 py-2 rounded-lg">
            {error}
          </p>
        )}

        {/* Confirm button */}
        <Button
          type="submit"
          isLoading={loading}
          disabled={!name.trim()}
          className="w-full"
          variant={name.trim() ? "primary" : "ghost"}
        >
          Confirm
        </Button>
      </form>
    </div>
  );
}
