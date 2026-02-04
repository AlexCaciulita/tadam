"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Lock,
  ImagePlus,
  CheckCircle,
  Bookmark,
  MoreHorizontal,
  UserPlus,
  Share2,
  Presentation,
} from "lucide-react";
import Avatar from "@/components/shared/Avatar";
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
import { generateQRCode } from "@/lib/utils/qr-generate";
import { getDeviceId } from "@/lib/device-user";
import type { Album, AlbumMember, Media, MediaTask } from "@/types/database";

interface AlbumDetailClientProps {
  album: Album;
  members: AlbumMember[];
  initialMedia: Media[];
  tasks: MediaTask[];
  albumOwnerId: string;
}

export default function AlbumDetailClient({
  album,
  members,
  initialMedia,
  tasks: initialTasks,
  albumOwnerId,
}: AlbumDetailClientProps) {
  const [isOwner, setIsOwner] = useState(false);
  const [activeTab, setActiveTab] = useState<"media" | "activities">("media");
  const [showQR, setShowQR] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [showSlideshow, setShowSlideshow] = useState(false);
  const [showPrompts, setShowPrompts] = useState(false);
  const [showCreatePrompt, setShowCreatePrompt] = useState(false);
  const [tasks, setTasks] = useState<MediaTask[]>(initialTasks);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [localMedia, setLocalMedia] = useState<Media[]>([]);

  // Determine ownership client-side via device ID
  useEffect(() => {
    const deviceId = getDeviceId();
    setIsOwner(deviceId === albumOwnerId);
  }, [albumOwnerId]);

  const handleUploadComplete = useCallback((media: Media) => {
    setLocalMedia((prev) => {
      if (prev.some((m) => m.id === media.id)) return prev;
      return [media, ...prev];
    });
  }, []);

  const { uploads, uploadFiles, isUploading, reset } = useUpload({
    albumId: album.id,
    onUploadComplete: handleUploadComplete,
  });

  const handleFilesSelected = (files: FileList) => {
    uploadFiles(files);
  };

  const handleShowQR = async () => {
    const dataUrl = await generateQRCode(album.join_code);
    setQrDataUrl(dataUrl);
    setShowQR(true);
    setShowMoreMenu(false);
  };

  // Combine initial media with locally uploaded media
  const allMedia = [...localMedia, ...initialMedia];

  return (
    <div>
      {/* Action bar */}
      <div className="flex items-center justify-end gap-2 mb-4">
        <UploadButton onFilesSelected={handleFilesSelected} variant="icon" />
        <button
          onClick={() => setShowPrompts(!showPrompts)}
          className="p-2 rounded-lg hover:bg-surface transition-colors"
          title="Media Tasks"
        >
          <CheckCircle className="w-6 h-6 text-foreground" />
        </button>
        <button className="p-2 rounded-lg hover:bg-surface transition-colors">
          <Bookmark className="w-6 h-6 text-foreground" />
        </button>
        <div className="relative">
          <button
            onClick={() => setShowMoreMenu(!showMoreMenu)}
            className="p-2 rounded-lg hover:bg-surface transition-colors"
          >
            <MoreHorizontal className="w-6 h-6 text-foreground" />
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
            </div>
          )}
        </div>
      </div>

      {/* Album header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          {album.is_private && <Lock className="w-4 h-4 text-muted" />}
          <h1 className="text-xl font-bold text-foreground">{album.name}</h1>
        </div>
        <p className="text-sm text-muted">
          {new Date(album.created_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </p>

        {/* Members row */}
        <div className="flex items-center gap-2 mt-3">
          <button className="flex items-center gap-1 text-muted hover:text-foreground transition-colors">
            <UserPlus className="w-5 h-5" />
          </button>
          <div className="flex -space-x-2">
            {members.slice(0, 5).map((member) => (
              <Avatar
                key={member.id}
                src={member.profile?.avatar_url}
                size="sm"
                className="border-2 border-white"
              />
            ))}
          </div>
          {members.length > 5 && (
            <span className="text-xs text-muted">+{members.length - 5}</span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border mb-6">
        <button
          onClick={() => setActiveTab("media")}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "media"
              ? "border-primary text-primary"
              : "border-transparent text-muted hover:text-foreground"
          }`}
        >
          Shared Media
        </button>
        <button
          onClick={() => setActiveTab("activities")}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "activities"
              ? "border-primary text-primary"
              : "border-transparent text-muted hover:text-foreground"
          }`}
        >
          Activities
        </button>
      </div>

      {/* Prompts section */}
      {showPrompts && (
        <div className="mb-6 p-4 bg-surface rounded-xl">
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

      {/* Tab content */}
      {activeTab === "media" ? (
        allMedia.length > 0 ? (
          <MediaGallery albumId={album.id} initialMedia={allMedia} />
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
        )
      ) : (
        <EmptyState
          title="No activity yet"
          description="Activity will show up here when members interact with the album."
        />
      )}

      {/* FAB for mobile upload */}
      <UploadButton onFilesSelected={handleFilesSelected} variant="fab" />

      {/* Upload progress */}
      <UploadProgress
        uploads={uploads}
        isUploading={isUploading}
        onClose={reset}
      />

      {/* QR Code Modal */}
      <Modal isOpen={showQR} onClose={() => setShowQR(false)} title="Share Album">
        <div className="text-center">
          {qrDataUrl && (
            <img src={qrDataUrl} alt="QR Code" className="mx-auto mb-4" />
          )}
          <div className="bg-surface rounded-lg p-4 mb-4">
            <p className="text-sm text-muted mb-1">Join Code</p>
            <p className="text-2xl font-bold tracking-widest text-primary">
              {album.join_code}
            </p>
          </div>
          <p className="text-sm text-muted">
            Share this QR code or join code with your guests
          </p>
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
          albumName={album.name}
          onClose={() => setShowSlideshow(false)}
        />
      )}
    </div>
  );
}
