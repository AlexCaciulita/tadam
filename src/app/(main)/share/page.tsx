"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { Copy, Download, ExternalLink, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getDeviceUser } from "@/lib/device-user";
import { getActiveAlbumId, setActiveAlbumId } from "@/lib/active-album";
import EmptyState from "@/components/shared/EmptyState";
import {
  downloadDataUrl,
  generateQRCodeFromUrl,
  getAlbumJoinPath,
} from "@/lib/utils/qr-generate";
import type { Album } from "@/types/database";

function dedupeAlbums(albums: Album[]) {
  const seen = new Set<string>();
  return albums.filter((album) => {
    if (seen.has(album.id)) return false;
    seen.add(album.id);
    return true;
  });
}

export default function SharePage() {
  const searchParams = useSearchParams();
  const selectedFromQuery = searchParams.get("album") || "";

  const [albums, setAlbums] = useState<Album[]>([]);
  const [selectedAlbumId, setSelectedAlbumId] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [qrLoading, setQrLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchAlbums = async () => {
      try {
        const deviceUser = await getDeviceUser();
        const supabase = createClient();

        const [ownedAlbumsRes, membershipsRes] = await Promise.all([
          supabase
            .from("albums")
            .select("*")
            .eq("owner_id", deviceUser.id)
            .order("created_at", { ascending: false }),
          supabase.from("album_members").select("album_id").eq("user_id", deviceUser.id),
        ]);

        const memberAlbumIds = (membershipsRes.data || [])
          .map((member: { album_id: string }) => member.album_id)
          .filter(Boolean);

        let memberAlbums: Album[] = [];
        if (memberAlbumIds.length > 0) {
          const { data: memberAlbumsData } = await supabase
            .from("albums")
            .select("*")
            .in("id", memberAlbumIds)
            .neq("owner_id", deviceUser.id)
            .order("created_at", { ascending: false });

          memberAlbums = (memberAlbumsData || []) as Album[];
        }

        const allAlbums = dedupeAlbums([
          ...((ownedAlbumsRes.data || []) as Album[]),
          ...memberAlbums,
        ]);

        let resolvedAlbums = allAlbums;

        // Admin fallback: preserve currently opened album context.
        if (resolvedAlbums.length === 0 && deviceUser.role === "platform_admin") {
          const fallbackAlbumId = selectedFromQuery || getActiveAlbumId();
          if (fallbackAlbumId) {
            const { data: fallbackAlbum } = await supabase
              .from("albums")
              .select("*")
              .eq("id", fallbackAlbumId)
              .maybeSingle();

            if (fallbackAlbum) {
              resolvedAlbums = [fallbackAlbum as Album];
            }
          }
        }

        setAlbums(resolvedAlbums);

        if (resolvedAlbums.length > 0) {
          const validQueryAlbum =
            selectedFromQuery && resolvedAlbums.some((album) => album.id === selectedFromQuery)
              ? selectedFromQuery
              : resolvedAlbums[0].id;

          setSelectedAlbumId(validQueryAlbum);
        }
      } catch (error) {
        console.error("Failed to load albums for sharing", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAlbums();
  }, [selectedFromQuery]);

  const selectedAlbum = useMemo(
    () => albums.find((album) => album.id === selectedAlbumId) || null,
    [albums, selectedAlbumId]
  );

  useEffect(() => {
    const generateShareData = async () => {
      if (!selectedAlbum) return;
      setActiveAlbumId(selectedAlbum.id);

      const joinPath = getAlbumJoinPath(selectedAlbum.public_token, selectedAlbum.join_code);
      const url =
        typeof window !== "undefined"
          ? `${window.location.origin}${joinPath}`
          : joinPath;

      setShareUrl(url);
      setQrDataUrl(null);
      setQrLoading(true);
      setMessage(null);

      try {
        const qr = await generateQRCodeFromUrl(url);
        setQrDataUrl(qr);
      } catch (error) {
        console.error("Failed to generate QR code", error);
        setMessage("Failed to generate QR code. You can still copy the permanent link.");
      } finally {
        setQrLoading(false);
      }
    };

    generateShareData();
  }, [selectedAlbum]);

  const handleCopyLink = async () => {
    if (!shareUrl) return;

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const input = document.createElement("input");
      input.value = shareUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownloadQR = () => {
    if (!selectedAlbum || !qrDataUrl) return;
    const safeName = selectedAlbum.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    downloadDataUrl(qrDataUrl, `${safeName || "album"}-qr.png`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  if (albums.length === 0 || !selectedAlbum) {
    return (
      <EmptyState
        title="No album to share"
        description="Once your wedding album is ready, the permanent link and QR will appear here."
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="ig-card p-5">
        <h1 className="text-2xl font-bold text-foreground">Share</h1>
        <p className="text-sm text-muted mt-1">
          Permanent link and QR code for print cards and guest access.
        </p>
      </div>

      <div className="ig-card p-4 sm:p-5 space-y-4">
        {albums.length > 1 && (
          <div>
            <label className="block text-xs text-muted mb-1">Select album</label>
            <select
              value={selectedAlbumId}
              onChange={(e) => setSelectedAlbumId(e.target.value)}
              className="w-full md:w-[320px] px-3 py-2 rounded-xl border border-border bg-white text-sm"
            >
              {albums.map((album) => (
                <option key={album.id} value={album.id}>
                  {album.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <p className="text-sm font-semibold text-foreground">{selectedAlbum.name}</p>
          <p className="text-xs text-muted">Join code: {selectedAlbum.join_code}</p>
        </div>

        <div className="text-xs break-all rounded-xl border border-border bg-surface/60 px-3 py-2.5">
          {shareUrl}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleCopyLink}
            className="text-xs px-3 py-1.5 rounded-xl border border-border hover:bg-surface inline-flex items-center gap-1"
          >
            <Copy className="w-3 h-3" /> {copied ? "Copied" : "Copy Link"}
          </button>
          <button
            type="button"
            onClick={handleDownloadQR}
            disabled={!qrDataUrl}
            className="text-xs px-3 py-1.5 rounded-xl border border-border hover:bg-surface disabled:opacity-50 inline-flex items-center gap-1"
          >
            <Download className="w-3 h-3" /> Download QR
          </button>
          <a
            href={shareUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs px-3 py-1.5 rounded-xl border border-border hover:bg-surface inline-flex items-center gap-1"
          >
            <ExternalLink className="w-3 h-3" /> Open Link
          </a>
          <Link
            href={`/album/${selectedAlbum.id}`}
            className="text-xs px-3 py-1.5 rounded-xl border border-border hover:bg-surface inline-flex items-center gap-1"
          >
            <ExternalLink className="w-3 h-3" /> Open Album
          </Link>
        </div>

        {message && <p className="text-xs text-danger">{message}</p>}

        {qrLoading && (
          <div className="flex items-center gap-2 text-xs text-muted">
            <Loader2 className="w-4 h-4 animate-spin" />
            Generating QR...
          </div>
        )}

        {qrDataUrl && (
          <div className="ig-soft-card p-4 inline-block">
            <Image
              src={qrDataUrl}
              alt="Album QR"
              width={208}
              height={208}
              className="w-52 h-52 bg-white border border-border rounded-lg p-2"
            />
          </div>
        )}
      </div>
    </div>
  );
}
