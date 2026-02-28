"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Copy,
  Download,
  ExternalLink,
  Loader2,
  PlusCircle,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getDeviceUser } from "@/lib/device-user";
import {
  downloadDataUrl,
  generateAlbumPublicToken,
  generateJoinCode,
  generateQRCodeFromUrl,
  getAlbumJoinUrl,
} from "@/lib/utils/qr-generate";
import type { Album, Media, Profile } from "@/types/database";

type CoupleSummary = {
  ownerId: string;
  ownerName: string;
  ownerUsername: string;
  role: Profile["role"];
  albumCount: number;
  mediaCount: number;
};

type AdminOverview = {
  profileCount: number;
  coupleCount: number;
  albumCount: number;
  profiles: Profile[];
  albums: Album[];
  media: Media[];
  couples: CoupleSummary[];
};

type AdminSection = "new_wedding" | "profiles" | "couples" | "albums";

type CreatedWedding = {
  owner: Profile;
  album: Album;
  joinUrl: string;
  qrDataUrl: string | null;
};

const normalizeUsername = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 30);

export default function AdminPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [adminId, setAdminId] = useState<string | null>(null);
  const [data, setData] = useState<AdminOverview | null>(null);
  const [ownerFilter, setOwnerFilter] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const [clientUsername, setClientUsername] = useState("");
  const [clientDisplayName, setClientDisplayName] = useState("");
  const [albumName, setAlbumName] = useState("");
  const [weddingDate, setWeddingDate] = useState("");
  const [description, setDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(true);
  const [createdWedding, setCreatedWedding] = useState<CreatedWedding | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [shareAlbum, setShareAlbum] = useState<Album | null>(null);
  const [shareUrl, setShareUrl] = useState("");
  const [shareQrDataUrl, setShareQrDataUrl] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  const requestedSection = searchParams.get("tab");
  const activeSection: AdminSection =
    requestedSection === "profiles" ||
    requestedSection === "couples" ||
    requestedSection === "albums" ||
    requestedSection === "new_wedding"
      ? requestedSection
      : "profiles";

  const setSection = (section: AdminSection) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", section);
    router.replace(`${pathname}?${params.toString()}`);
  };

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setMessage(null);

      try {
        const deviceUser = await getDeviceUser();

        if (deviceUser.role !== "platform_admin") {
          setAllowed(false);
          setLoading(false);
          return;
        }

        setAllowed(true);
        setAdminId(deviceUser.id);

        const supabase = createClient();

        const [profilesCountRes, albumsCountRes, profilesRes, albumsRes, mediaRes] =
          await Promise.all([
            supabase.from("profiles").select("id", { count: "exact", head: true }),
            supabase.from("albums").select("id", { count: "exact", head: true }),
            supabase.from("profiles").select("*").order("created_at", { ascending: false }),
            supabase.from("albums").select("*").order("created_at", { ascending: false }),
            supabase.from("media").select("*").order("created_at", { ascending: false }),
          ]);

        const profiles = (profilesRes.data || []) as Profile[];
        const albums = (albumsRes.data || []) as Album[];
        const media = (mediaRes.data || []) as Media[];

        const profileById = new Map<string, Profile>();
        for (const profile of profiles) {
          profileById.set(profile.id, profile);
        }

        const mediaCountByAlbumId = new Map<string, number>();
        for (const item of media) {
          mediaCountByAlbumId.set(item.album_id, (mediaCountByAlbumId.get(item.album_id) || 0) + 1);
        }

        const albumsByOwner = new Map<string, Album[]>();
        for (const album of albums) {
          const existing = albumsByOwner.get(album.owner_id) || [];
          existing.push(album);
          albumsByOwner.set(album.owner_id, existing);
        }

        const couples: CoupleSummary[] = Array.from(albumsByOwner.entries()).map(
          ([ownerId, ownerAlbums]) => {
            const profile = profileById.get(ownerId);
            const mediaCount = ownerAlbums.reduce(
              (sum, album) => sum + (mediaCountByAlbumId.get(album.id) || 0),
              0
            );

            return {
              ownerId,
              ownerName: profile?.display_name || profile?.username || ownerId.slice(0, 8),
              ownerUsername: profile?.username || "unknown",
              role: profile?.role || "user",
              albumCount: ownerAlbums.length,
              mediaCount,
            };
          }
        );

        couples.sort((a, b) => b.albumCount - a.albumCount || b.mediaCount - a.mediaCount);

        setData({
          profileCount: profilesCountRes.count || profiles.length,
          coupleCount: couples.length,
          albumCount: albumsCountRes.count || albums.length,
          profiles,
          albums,
          media,
          couples,
        });
      } catch (error) {
        console.error("Failed to load admin overview", error);
        setMessage("Failed to load admin data.");
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [refreshTick]);

  const refresh = () => setRefreshTick((prev) => prev + 1);

  const filteredAlbums = useMemo(() => {
    if (!data?.albums) return [];
    if (!ownerFilter) return data.albums;
    return data.albums.filter((album) => album.owner_id === ownerFilter);
  }, [data?.albums, ownerFilter]);

  const handleSetRole = async (profileId: string, role: Profile["role"]) => {
    setBusy(`role-${profileId}`);
    setMessage(null);

    try {
      const supabase = createClient();
      const { error } = await supabase.from("profiles").update({ role }).eq("id", profileId);
      if (error) throw error;
      setMessage(`Updated role to ${role}.`);
      refresh();
    } catch (error) {
      console.error("Failed to update role", error);
      setMessage("Failed to update role.");
    } finally {
      setBusy(null);
    }
  };

  const getAlbumShareUrl = (album: Album) => getAlbumJoinUrl(album.public_token, album.join_code);

  const copyToClipboard = async (value: string, onCopied: () => void) => {
    try {
      await navigator.clipboard.writeText(value);
      onCopied();
    } catch {
      const input = document.createElement("input");
      input.value = value;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      onCopied();
    }
  };

  const openAlbumShare = async (album: Album) => {
    const url = getAlbumShareUrl(album);
    setShareAlbum(album);
    setShareUrl(url);
    setShareQrDataUrl(null);
    setShareCopied(false);
    setShareLoading(true);

    try {
      const qr = await generateQRCodeFromUrl(url);
      setShareQrDataUrl(qr);
    } catch (error) {
      console.error("Failed to generate QR for album share", error);
      setMessage("Album was created, but QR generation failed. You can still copy the link.");
    } finally {
      setShareLoading(false);
    }
  };

  const handleCopyShareLink = async () => {
    if (!shareUrl) return;
    await copyToClipboard(shareUrl, () => {
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    });
  };

  const handleDownloadShareQR = () => {
    if (!shareAlbum || !shareQrDataUrl) return;
    const safeName = shareAlbum.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    downloadDataUrl(shareQrDataUrl, `${safeName || "album"}-qr.png`);
  };

  const handleDeleteAlbum = async (album: Album) => {
    const confirmed = window.confirm(`Delete album \"${album.name}\" and all its media?`);
    if (!confirmed) return;

    setBusy(`album-${album.id}`);
    setMessage(null);

    try {
      const supabase = createClient();
      const { error } = await supabase.from("albums").delete().eq("id", album.id);
      if (error) throw error;
      setMessage(`Deleted album \"${album.name}\".`);
      refresh();
    } catch (error) {
      console.error("Failed to delete album", error);
      setMessage("Failed to delete album.");
    } finally {
      setBusy(null);
    }
  };


  const handleCreateWedding = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    setCopiedLink(false);

    const normalizedUsername = normalizeUsername(clientUsername);
    if (!normalizedUsername) {
      setMessage("Client username is required.");
      return;
    }
    if (!albumName.trim()) {
      setMessage("Album name is required.");
      return;
    }

    setBusy("create-wedding");

    try {
      const supabase = createClient();

      const { data: existingUsername } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", normalizedUsername)
        .maybeSingle();

      if (existingUsername) {
        setMessage("That username already exists. Choose another username.");
        setBusy(null);
        return;
      }

      const ownerId = crypto.randomUUID();
      const { data: ownerData, error: ownerError } = await supabase
        .from("profiles")
        .insert({
          id: ownerId,
          username: normalizedUsername,
          display_name: clientDisplayName.trim() || normalizedUsername,
          role: "user",
        })
        .select("*")
        .single();

      if (ownerError) throw ownerError;

      let createdAlbum: Album | null = null;
      for (let i = 0; i < 8; i++) {
        const generatedJoinCode = generateJoinCode();
        const generatedPublicToken = generateAlbumPublicToken();

        const albumDescription = [description.trim(), weddingDate ? `Wedding date: ${weddingDate}` : ""]
          .filter(Boolean)
          .join("\n") || null;

        const { data: albumData, error: albumError } = await supabase
          .from("albums")
          .insert({
            name: albumName.trim(),
            description: albumDescription,
            join_code: generatedJoinCode,
            public_token: generatedPublicToken,
            is_private: isPrivate,
            owner_id: ownerId,
          })
          .select("*")
          .single();

        if (!albumError && albumData) {
          createdAlbum = albumData as Album;
          break;
        }

        const errorCode =
          albumError && typeof albumError === "object" && "code" in albumError
            ? String((albumError as { code?: string }).code)
            : "";

        if (errorCode !== "23505") {
          throw albumError;
        }
      }

      if (!createdAlbum) {
        throw new Error("Could not generate unique invite codes. Please retry.");
      }

      const { error: memberError } = await supabase.from("album_members").insert({
        album_id: createdAlbum.id,
        user_id: ownerId,
        role: "owner",
      });

      if (memberError) throw memberError;

      const joinUrl = getAlbumShareUrl(createdAlbum);
      let qrDataUrl: string | null = null;
      try {
        qrDataUrl = await generateQRCodeFromUrl(joinUrl);
      } catch (error) {
        console.error("QR generation failed after wedding creation", error);
      }

      setCreatedWedding({
        owner: ownerData as Profile,
        album: createdAlbum,
        joinUrl,
        qrDataUrl,
      });
      setShareAlbum(createdAlbum);
      setShareUrl(joinUrl);
      setShareQrDataUrl(qrDataUrl);
      setShareLoading(false);

      setMessage(
        qrDataUrl
          ? "Wedding workspace created successfully."
          : "Wedding workspace created. QR generation failed; use the link or regenerate from Albums > Share."
      );
      setClientUsername("");
      setClientDisplayName("");
      setAlbumName("");
      setWeddingDate("");
      setDescription("");
      setIsPrivate(true);
      refresh();
    } catch (error) {
      console.error("Failed to create wedding workspace", error);
      setMessage("Failed to create wedding workspace.");
    } finally {
      setBusy(null);
    }
  };

  const handleCopyLink = async () => {
    if (!createdWedding?.joinUrl) return;
    await copyToClipboard(createdWedding.joinUrl, () => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    });
  };

  const handleDownloadQR = () => {
    if (!createdWedding || !createdWedding.qrDataUrl) return;
    const safeName = createdWedding.album.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    downloadDataUrl(createdWedding.qrDataUrl, `${safeName || "wedding"}-qr.png`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="max-w-xl mx-auto py-14 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-danger/10 mb-4">
          <ShieldAlert className="w-6 h-6 text-danger" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Admin access only</h1>
        <p className="text-muted mb-6">Your account does not have platform admin permissions.</p>
        <p className="text-sm text-muted">
          Set <code>profiles.role = &apos;platform_admin&apos;</code> for your profile in Supabase.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
          <p className="text-sm text-muted mt-1">
            Create a wedding workspace with permanent link and QR in one step.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setSection("new_wedding")}
            className="px-3 py-2 rounded-lg bg-primary text-white text-sm hover:bg-primary/90 transition-colors"
          >
            <span className="inline-flex items-center gap-1.5">
              <PlusCircle className="w-4 h-4" />
              New Wedding
            </span>
          </button>
          <button
            type="button"
            onClick={refresh}
            className="px-3 py-2 rounded-lg border border-border text-sm hover:bg-surface transition-colors"
          >
            <span className="inline-flex items-center gap-1.5">
              <RefreshCw className="w-4 h-4" />
              Refresh
            </span>
          </button>
        </div>
      </div>

      {message && (
        <div className="text-sm rounded-lg border border-border bg-surface/60 px-3 py-2">{message}</div>
      )}
      {activeSection === "new_wedding" && (
        <section className="rounded-xl border border-border bg-white p-4">
          <h2 className="text-lg font-semibold text-foreground mb-3">New Wedding Setup</h2>
          <form onSubmit={handleCreateWedding} className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted mb-1">Client username *</label>
              <input
                value={clientUsername}
                onChange={(e) => setClientUsername(normalizeUsername(e.target.value))}
                placeholder="anna_mihai"
                className="w-full px-3 py-2 rounded-lg border border-border text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Client display name</label>
              <input
                value={clientDisplayName}
                onChange={(e) => setClientDisplayName(e.target.value)}
                placeholder="Anna & Mihai"
                className="w-full px-3 py-2 rounded-lg border border-border text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Album name *</label>
              <input
                value={albumName}
                onChange={(e) => setAlbumName(e.target.value)}
                placeholder="Anna & Mihai Wedding"
                className="w-full px-3 py-2 rounded-lg border border-border text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Wedding date</label>
              <input
                type="date"
                value={weddingDate}
                onChange={(e) => setWeddingDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border text-sm"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-muted mb-1">Description (optional)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Short note for this wedding album"
                className="w-full px-3 py-2 rounded-lg border border-border text-sm resize-none"
              />
            </div>
            <label className="md:col-span-2 inline-flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
              />
              Private album
            </label>
            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={busy === "create-wedding"}
                className="px-4 py-2 rounded-lg bg-primary text-white text-sm disabled:opacity-50"
              >
                {busy === "create-wedding" ? "Creating..." : "Create Wedding Workspace"}
              </button>
            </div>
          </form>

          {createdWedding && (
            <div className="mt-5 grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4 p-4 rounded-lg border border-border bg-surface/40">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground mb-1">Ready to share</p>
                <p className="text-xs text-muted mb-1">
                  Client: @{createdWedding.owner.username} · Album: {createdWedding.album.name}
                </p>
                <p className="text-xs text-muted mb-2">Join code: {createdWedding.album.join_code}</p>
                <div className="text-xs break-all rounded border border-border bg-white px-2 py-1.5 mb-2">
                  {createdWedding.joinUrl}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="text-xs px-2 py-1 rounded border border-border hover:bg-white inline-flex items-center gap-1"
                  >
                    <Copy className="w-3 h-3" /> {copiedLink ? "Copied" : "Copy Link"}
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadQR}
                    disabled={!createdWedding.qrDataUrl}
                    className="text-xs px-2 py-1 rounded border border-border hover:bg-white inline-flex items-center gap-1"
                  >
                    <Download className="w-3 h-3" /> Download QR
                  </button>
                  <Link
                    href={`/album/${createdWedding.album.id}`}
                    className="text-xs px-2 py-1 rounded border border-border hover:bg-white inline-flex items-center gap-1"
                  >
                    <ExternalLink className="w-3 h-3" /> Open Album
                  </Link>
                </div>
              </div>
              {createdWedding.qrDataUrl ? (
                <Image
                  src={createdWedding.qrDataUrl}
                  alt="Album QR"
                  width={176}
                  height={176}
                  className="w-44 h-44 bg-white border border-border rounded-lg p-2"
                />
              ) : (
                <div className="w-44 h-44 bg-surface border border-border rounded-lg p-2 flex items-center justify-center text-xs text-muted text-center">
                  QR unavailable.
                  <br />
                  Use link now, regenerate later from Albums &gt; Share.
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {activeSection === "profiles" && (
        <section className="rounded-xl border border-border bg-white p-4">
          <h2 className="text-lg font-semibold text-foreground mb-3">Profiles</h2>
          <div className="space-y-2">
            {(data?.profiles || []).slice(0, 100).map((profile) => {
              const isCurrentAdmin = profile.id === adminId;
              return (
                <div
                  key={profile.id}
                  className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-surface/60"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {profile.display_name || profile.username}
                    </p>
                    <p className="text-xs text-muted truncate">@{profile.username}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted">{profile.role}</span>
                    {!isCurrentAdmin && profile.role !== "platform_admin" && (
                      <button
                        type="button"
                        disabled={busy === `role-${profile.id}`}
                        onClick={() => handleSetRole(profile.id, "platform_admin")}
                        className="text-xs px-2 py-1 rounded border border-border hover:bg-white"
                      >
                        Make Admin
                      </button>
                    )}
                    {!isCurrentAdmin && profile.role === "platform_admin" && (
                      <button
                        type="button"
                        disabled={busy === `role-${profile.id}`}
                        onClick={() => handleSetRole(profile.id, "user")}
                        className="text-xs px-2 py-1 rounded border border-border hover:bg-white"
                      >
                        Make User
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {activeSection === "couples" && (
        <section className="rounded-xl border border-border bg-white p-4">
          <h2 className="text-lg font-semibold text-foreground mb-3">Couples</h2>
          <div className="space-y-2">
            {(data?.couples || []).map((couple) => (
              <div
                key={couple.ownerId}
                className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-surface/60"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{couple.ownerName}</p>
                  <p className="text-xs text-muted truncate">@{couple.ownerUsername}</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted">
                  <span>{couple.albumCount} albums</span>
                  <span>{couple.mediaCount} media</span>
                  <button
                    type="button"
                    onClick={() => {
                      setOwnerFilter(couple.ownerId);
                      setSection("albums");
                    }}
                    className="px-2 py-1 rounded border border-border hover:bg-white"
                  >
                    View Albums
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {activeSection === "albums" && (
        <section className="rounded-xl border border-border bg-white p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="text-lg font-semibold text-foreground">Albums</h2>
            {ownerFilter && (
              <button
                type="button"
                onClick={() => setOwnerFilter(null)}
                className="text-xs px-2 py-1 rounded border border-border hover:bg-surface"
              >
                Clear owner filter
              </button>
            )}
          </div>
          <div className="space-y-2">
            {filteredAlbums.slice(0, 150).map((album) => (
              <div
                key={album.id}
                className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-surface/60"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{album.name}</p>
                  <p className="text-xs text-muted truncate">Code: {album.join_code}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/album/${album.id}`}
                    className="text-xs px-2 py-1 rounded border border-border hover:bg-white inline-flex items-center gap-1"
                  >
                    <ExternalLink className="w-3 h-3" /> Open
                  </Link>
                  <button
                    type="button"
                    onClick={() => openAlbumShare(album)}
                    className="text-xs px-2 py-1 rounded border border-border hover:bg-white"
                  >
                    Share
                  </button>
                  <button
                    type="button"
                    disabled={busy === `album-${album.id}`}
                    onClick={() => handleDeleteAlbum(album)}
                    className="text-xs px-2 py-1 rounded border border-danger/30 text-danger hover:bg-danger/5"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
            {filteredAlbums.length === 0 && <p className="text-sm text-muted">No albums found.</p>}
          </div>

          {shareAlbum && (
            <div className="mt-4 p-4 rounded-lg border border-border bg-surface/40">
              <p className="text-sm font-semibold text-foreground mb-1">
                Share: {shareAlbum.name}
              </p>
              <p className="text-xs text-muted mb-2">Permanent link</p>
              <div className="text-xs break-all rounded border border-border bg-white px-2 py-1.5 mb-2">
                {shareUrl}
              </div>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <button
                  type="button"
                  onClick={handleCopyShareLink}
                  className="text-xs px-2 py-1 rounded border border-border hover:bg-white inline-flex items-center gap-1"
                >
                  <Copy className="w-3 h-3" /> {shareCopied ? "Copied" : "Copy Link"}
                </button>
                <button
                  type="button"
                  onClick={handleDownloadShareQR}
                  disabled={!shareQrDataUrl}
                  className="text-xs px-2 py-1 rounded border border-border hover:bg-white disabled:opacity-50 inline-flex items-center gap-1"
                >
                  <Download className="w-3 h-3" /> Save QR
                </button>
                <a
                  href={shareUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs px-2 py-1 rounded border border-border hover:bg-white inline-flex items-center gap-1"
                >
                  <ExternalLink className="w-3 h-3" /> Open Link
                </a>
              </div>
              {shareLoading && <p className="text-xs text-muted">Generating QR...</p>}
              {shareQrDataUrl && (
                <Image
                  src={shareQrDataUrl}
                  alt="Share QR"
                  width={144}
                  height={144}
                  className="w-36 h-36 bg-white border border-border rounded-lg p-2"
                />
              )}
            </div>
          )}
        </section>
      )}

    </div>
  );
}
