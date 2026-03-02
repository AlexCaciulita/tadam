"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  MoreHorizontal,
  Share2,
  Presentation,
  LayoutGrid,
  Rows3,
  GalleryVerticalEnd,
  Download,
  Pencil,
  Type,
} from "lucide-react";
import Button from "@/components/shared/Button";
import EmptyState from "@/components/shared/EmptyState";
import Modal from "@/components/shared/Modal";
import MediaGallery from "@/components/album/MediaGallery";
import UploadButton from "@/components/album/UploadButton";
import UploadProgress from "@/components/album/UploadProgress";
import LiveSlideshow from "@/components/album/LiveSlideshow";
import PromptList from "@/components/prompts/PromptList";
import CreatePrompt from "@/components/prompts/CreatePrompt";
import { useUpload } from "@/hooks/useUpload";
import { createClient } from "@/lib/supabase/client";
import {
  generateQRCodeFromUrl,
  getAlbumJoinPath,
} from "@/lib/utils/qr-generate";
import { createZipBlob } from "@/lib/utils/zip";
import { getDeviceId, getDeviceUser } from "@/lib/device-user";
import { setActiveAlbumId } from "@/lib/active-album";
import type { Album, Media, MediaTask } from "@/types/database";
import type { MediaGalleryView } from "@/components/album/MediaGallery";

interface AlbumDetailClientProps {
  album: Album;
  initialMedia: Media[];
  tasks: MediaTask[];
  albumOwnerId: string;
}

export default function AlbumDetailClient({
  album,
  initialMedia,
  tasks: initialTasks,
  albumOwnerId,
}: AlbumDetailClientProps) {
  const [showQR, setShowQR] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [showSlideshow, setShowSlideshow] = useState(false);
  const [showPrompts] = useState(false);
  const [showCreatePrompt, setShowCreatePrompt] = useState(false);
  const [tasks, setTasks] = useState<MediaTask[]>(initialTasks);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [localMedia, setLocalMedia] = useState<Media[]>([]);
  const [copied, setCopied] = useState(false);
  const [mediaView, setMediaView] = useState<MediaGalleryView>("grid");
  const [canManageMedia, setCanManageMedia] = useState(false);
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(album.cover_image_url || null);
  const [albumName, setAlbumName] = useState(album.name);
  const [renameDraft, setRenameDraft] = useState(album.name);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [downloadingImages, setDownloadingImages] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const moreMenuRef = useRef<HTMLDivElement | null>(null);

  // Determine ownership client-side via device ID.
  const isOwner = getDeviceId() === albumOwnerId;

  // Persist active album context for Album/Share hub pages.
  useEffect(() => {
    setActiveAlbumId(album.id);
  }, [album.id]);

  useEffect(() => {
    let cancelled = false;

    const resolvePermissions = async () => {
      try {
        const user = await getDeviceUser();
        const canManage = user?.role === "platform_admin";
        if (!cancelled) setCanManageMedia(canManage);
      } catch {
        if (!cancelled) setCanManageMedia(false);
      }
    };

    resolvePermissions();
    return () => {
      cancelled = true;
    };
  }, [albumOwnerId]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!showMoreMenu) return;
      if (moreMenuRef.current?.contains(event.target as Node)) return;
      setShowMoreMenu(false);
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [showMoreMenu]);

  // Detect guest name from localStorage (set during the /join flow).
  const guestName = typeof window !== "undefined"
    ? localStorage.getItem(`tadam_guest_album_${album.id}`) || undefined
    : undefined;

  const handleUploadComplete = useCallback((media: Media) => {
    setLocalMedia((prev) => {
      if (prev.some((m) => m.id === media.id)) return prev;
      return [media, ...prev];
    });
  }, []);

  const { uploads, uploadFiles, isUploading, reset } = useUpload({
    albumId: album.id,
    guestName,
    onUploadComplete: handleUploadComplete,
  });

  const handleFilesSelected = (files: FileList) => {
    uploadFiles(files);
  };

  const handleShowQR = async () => {
    const dataUrl = await generateQRCodeFromUrl(joinUrl);
    setQrDataUrl(dataUrl);
    setShowQR(true);
    setShowMoreMenu(false);
  };

  // Combine initial media with locally uploaded media
  const allMedia = [...localMedia, ...initialMedia];

  const joinPath = getAlbumJoinPath(album.public_token, album.join_code);
  const joinUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}${joinPath}`
      : joinPath;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const input = document.createElement("input");
      input.value = joinUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: albumName,
          text: `Join my album "${albumName}" on MemoriesBox!`,
          url: joinUrl,
        });
      } catch {
        // User cancelled or share failed — fall back to copy
        handleCopyLink();
      }
    } else {
      handleCopyLink();
    }
  };

  const handleDeleteMedia = useCallback(async (media: Media) => {
    const response = await fetch(`/api/media/${media.id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(payload.error || "Failed to delete media");
    }
  }, []);

  const handleHeroUploadClick = () => {
    coverInputRef.current?.click();
  };

  const handleRenameAlbum = async () => {
    if (!canManageMedia || renaming) return;
    const nextName = renameDraft.trim();
    if (!nextName || nextName === albumName) {
      setShowRenameModal(false);
      return;
    }

    setRenaming(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("albums")
        .update({ name: nextName })
        .eq("id", album.id);
      if (error) throw error;
      setAlbumName(nextName);
      setRenameDraft(nextName);
      setShowRenameModal(false);
    } catch (error) {
      console.error("Failed to rename album", error);
      window.alert("Failed to rename album.");
    } finally {
      setRenaming(false);
    }
  };

  const handleHeroImageSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !canManageMedia) return;

    event.target.value = "";

    if (!file.type.startsWith("image/")) {
      window.alert("Please select an image file.");
      return;
    }

    try {
      // Step 1: Get presigned upload URL (small JSON request, no file body)
      const presignResponse = await fetch("/api/uploads/r2/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          albumId: album.id,
          fileName: file.name,
          contentType: file.type,
          fileSize: file.size,
        }),
      });

      if (!presignResponse.ok) {
        const payload = (await presignResponse.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error || "Failed to upload hero image");
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
        .from("albums")
        .update({ cover_image_url: fileUrl })
        .eq("id", album.id);

      if (updateError) throw updateError;

      setCoverImageUrl(fileUrl);
    } catch (error) {
      console.error("Failed to update hero image", error);
      const message =
        error instanceof Error && error.message ? error.message : "Failed to update hero image";
      window.alert(message);
    }
  };

  const handleDownloadImages = async () => {
    if (downloadingImages) return;
    setShowMoreMenu(false);

    const imageMedia = allMedia.filter((item) => item.media_type === "photo");
    if (imageMedia.length === 0) {
      window.alert("No images found in this album.");
      return;
    }

    setDownloadingImages(true);
    try {
      const files = await Promise.all(
        imageMedia.map(async (item, index) => {
          const response = await fetch(item.file_url);
          if (!response.ok) {
            throw new Error(`Failed to fetch image ${index + 1}`);
          }

          const buffer = await response.arrayBuffer();
          const bytes = new Uint8Array(buffer);
          const urlPath = item.file_url.split("?")[0] || "";
          const extMatch = urlPath.match(/\.([a-zA-Z0-9]+)$/);
          const ext = (extMatch?.[1] || "jpg").toLowerCase();
          const fileName = `image-${String(index + 1).padStart(3, "0")}.${ext}`;
          return { name: fileName, data: bytes };
        })
      );

      const zipBlob = createZipBlob(files);
      const safeAlbum = albumName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const zipName = `${safeAlbum || "album"}-images.zip`;

      const url = URL.createObjectURL(zipBlob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = zipName;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to download images ZIP", error);
      window.alert("Failed to prepare ZIP download.");
    } finally {
      setDownloadingImages(false);
    }
  };

  return (
    <div className="space-y-0">
      {/* Action bar */}
      <div className="flex items-center justify-end gap-2 mb-4">
        {!lightboxOpen && (
          <UploadButton onFilesSelected={handleFilesSelected} variant="icon" />
        )}
        <button
          onClick={handleShowQR}
          className="p-2.5 rounded-xl border border-border bg-white hover:bg-surface transition-colors"
          title="Share Album"
        >
          <Share2 className="w-5 h-5 text-foreground" />
        </button>
        <div ref={moreMenuRef} className="relative">
          <button
            onClick={() => setShowMoreMenu(!showMoreMenu)}
            className="p-2.5 rounded-xl border border-border bg-white hover:bg-surface transition-colors"
          >
            <MoreHorizontal className="w-5 h-5 text-foreground" />
          </button>
          {showMoreMenu && (
            <div className="absolute right-0 mt-1 w-48 bg-white rounded-xl shadow-lg border border-border py-1 z-20 min-w-[200px]">
              <button
                onClick={handleShowQR}
                className="flex items-center gap-2 w-full px-4 py-2.5 text-sm hover:bg-surface text-left"
              >
                <Share2 className="w-4 h-4" />
                Share QR Code
              </button>
              <button
                onClick={() => {
                  setShowSlideshow(true);
                  setShowMoreMenu(false);
                }}
                className="flex items-center gap-2 w-full px-4 py-2.5 text-sm hover:bg-surface text-left"
              >
                <Presentation className="w-4 h-4" />
                Live Slideshow
              </button>
              <button
                onClick={handleDownloadImages}
                disabled={downloadingImages}
                className="flex items-center gap-2 w-full px-4 py-2.5 text-sm hover:bg-surface text-left disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                {downloadingImages ? "Preparing ZIP..." : "Download images"}
              </button>
              {canManageMedia && (
                <>
                  <button
                    onClick={() => {
                      setRenameDraft(albumName);
                      setShowRenameModal(true);
                      setShowMoreMenu(false);
                    }}
                    className="flex items-center gap-2 w-full px-4 py-2.5 text-sm hover:bg-surface text-left"
                  >
                    <Type className="w-4 h-4" />
                    Rename Album
                  </button>
                  <button
                    onClick={() => {
                      handleHeroUploadClick();
                      setShowMoreMenu(false);
                    }}
                    className="flex items-center gap-2 w-full px-4 py-2.5 text-sm hover:bg-surface text-left"
                  >
                    <Pencil className="w-4 h-4" />
                    Change Album Image
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Album hero card */}
      <div className="ig-feature-card mb-6 overflow-hidden">
        <div className="relative h-44 sm:h-56 bg-surface">
          {coverImageUrl ? (
            <img src={coverImageUrl} alt={album.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary-light via-white to-surface" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 w-full px-4">
            <h1 className="text-center text-xl sm:text-2xl font-bold text-white drop-shadow">
              {albumName}
            </h1>
          </div>
        </div>
      </div>

      <input
        ref={coverInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleHeroImageSelected}
      />

      {/* Media section header + view toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-foreground">Shared Media</h2>
          <span className="text-xs text-muted">{allMedia.length}</span>
        </div>

        {allMedia.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted">View</span>
            <div className="flex bg-white border border-border rounded-xl p-1">
              <button
                type="button"
                onClick={() => setMediaView("grid")}
                className={`p-2 rounded-lg transition-colors ${
                  mediaView === "grid"
                    ? "bg-primary-light text-primary"
                    : "text-muted hover:text-foreground"
                }`}
                title="Grid View"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setMediaView("feed")}
                className={`p-2 rounded-lg transition-colors ${
                  mediaView === "feed"
                    ? "bg-primary-light text-primary"
                    : "text-muted hover:text-foreground"
                }`}
                title="Feed View"
              >
                <Rows3 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setMediaView("masonry")}
                className={`p-2 rounded-lg transition-colors ${
                  mediaView === "masonry"
                    ? "bg-primary-light text-primary"
                    : "text-muted hover:text-foreground"
                }`}
                title="Masonry View"
              >
                <GalleryVerticalEnd className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Prompts section */}
      {showPrompts && (
        <div className="mb-6 p-4 ig-card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-sm">Media Tasks</h3>
            {isOwner && (
              <Button size="sm" onClick={() => setShowCreatePrompt(true)}>
                Add Task
              </Button>
            )}
          </div>
          <PromptList tasks={tasks} albumId={album.id} isOwner={isOwner} />
        </div>
      )}

      {allMedia.length > 0 ? (
        <MediaGallery
          albumId={album.id}
          initialMedia={allMedia}
          view={mediaView}
          canDelete={canManageMedia}
          onDeleteMedia={handleDeleteMedia}
          onLightboxOpenChange={setLightboxOpen}
        />
      ) : (
        <EmptyState
          title="Let's start sharing memories"
          description="You can start inviting contributors or start adding your media to the album."
          action={
            <div className="flex gap-3">
              <Button variant="outline" onClick={handleShowQR}>
                Invite
              </Button>
              <UploadButton
                onFilesSelected={handleFilesSelected}
                variant="inline"
              />
            </div>
          }
        />
      )}

      {/* FAB for mobile upload */}
      {!lightboxOpen && <UploadButton onFilesSelected={handleFilesSelected} variant="fab" />}

      {/* Upload progress */}
      <UploadProgress
        uploads={uploads}
        isUploading={isUploading}
        onClose={reset}
      />

      {/* QR Code Modal */}
      <Modal isOpen={showQR} onClose={() => setShowQR(false)} title="Share Album">
        <div className="flex flex-col items-center gap-4">
          <div className="w-full flex items-center justify-center gap-2">
            <Button
              variant="outline"
              className="min-w-[128px] justify-center"
              onClick={handleCopyLink}
            >
              {copied ? "Copied!" : "Copy Link"}
            </Button>
            <Button
              variant="outline"
              className="min-w-[128px] justify-center"
              onClick={handleNativeShare}
            >
              <Share2 className="w-4 h-4" />
              Share Link
            </Button>
          </div>
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="QR Code" className="w-52 h-52 max-w-full" />
          ) : (
            <p className="text-sm text-muted">Generating QR...</p>
          )}
        </div>
      </Modal>

      <Modal
        isOpen={showRenameModal}
        onClose={() => setShowRenameModal(false)}
        title="Rename Album"
      >
        <div className="space-y-3">
          <label className="block text-sm text-muted">Album name</label>
          <input
            value={renameDraft}
            onChange={(e) => setRenameDraft(e.target.value)}
            placeholder="Album name"
            className="w-full px-3 py-2 rounded-lg border border-border text-sm"
            maxLength={120}
          />
          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowRenameModal(false)}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleRenameAlbum} isLoading={renaming}>
              Save
            </Button>
          </div>
        </div>
      </Modal>

      {/* Create Prompt Modal */}
      <Modal
        isOpen={showCreatePrompt}
        onClose={() => setShowCreatePrompt(false)}
        title="Add Media Task"
      >
        <CreatePrompt
          albumId={album.id}
          onCreated={(task) => {
            setTasks((prev) => [task, ...prev]);
            setShowCreatePrompt(false);
          }}
        />
      </Modal>

      {/* Live Slideshow */}
      {showSlideshow && (
        <LiveSlideshow
          albumId={album.id}
          initialMedia={allMedia}
          albumName={albumName}
          onClose={() => setShowSlideshow(false)}
        />
      )}
    </div>
  );
}
