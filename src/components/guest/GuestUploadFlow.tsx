"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, ImageIcon, Check, Plus } from "lucide-react";
import Button from "@/components/shared/Button";
import PromptCard from "@/components/prompts/PromptCard";
import GuestNameForm from "./GuestNameForm";
import { useUpload } from "@/hooks/useUpload";
import { createClient } from "@/lib/supabase/client";
import { formatFileSize } from "@/lib/utils/image-resize";
import type { Album, MediaTask } from "@/types/database";

interface GuestUploadFlowProps {
  album: Album;
  tasks: MediaTask[];
  joinCode: string;
}

type Step = "name" | "picker" | "uploading" | "success";

export default function GuestUploadFlow({
  album,
  tasks,
  joinCode,
}: GuestUploadFlowProps) {
  const [guestName, setGuestName] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem(`tadam_guest_${joinCode}`) || "";
  });
  const [step, setStep] = useState<Step>(() => {
    if (typeof window === "undefined") return "name";
    return localStorage.getItem(`tadam_guest_${joinCode}`) ? "picker" : "name";
  });
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const { uploads, uploadFiles, isUploading, reset, completedCount, totalCount } =
    useUpload({
      albumId: album.id,
      guestName,
      joinCode,
    });

  const handleNameSubmit = async (name: string) => {
    setGuestName(name);
    localStorage.setItem(`tadam_guest_${joinCode}`, name);

    // Join album as guest
    const supabase = createClient();
    await supabase.from("album_members").insert({
      album_id: album.id,
      guest_name: name,
      role: "guest",
    });

    setStep("picker");
  };

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      uploadFiles(e.target.files);
      setStep("uploading");
      e.target.value = "";
    }
  };

  // Auto-transition to success when all done
  useEffect(() => {
    if (!isUploading && totalCount > 0 && completedCount === totalCount) {
      const timer = setTimeout(() => setStep("success"), 800);
      return () => clearTimeout(timer);
    }
  }, [isUploading, completedCount, totalCount]);

  return (
    <div className="min-h-screen bg-white">
      <AnimatePresence mode="wait">
        {/* Step 1: Name */}
        {step === "name" && (
          <GuestNameForm
            key="name"
            albumName={album.name}
            onSubmit={handleNameSubmit}
          />
        )}

        {/* Step 2: Media Picker */}
        {step === "picker" && (
          <motion.div
            key="picker"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex flex-col items-center justify-center min-h-screen px-6"
          >
            <div className="w-full max-w-sm">
              {/* Header */}
              <div className="text-center mb-8">
                <h1 className="text-2xl font-bold text-foreground mb-1">
                  {album.name}
                </h1>
                <p className="text-sm text-muted">
                  Hi {guestName}! Add your photos & videos
                </p>
              </div>

              {/* Tasks */}
              {tasks.length > 0 && (
                <div className="mb-6 space-y-2">
                  {tasks.map((task) => (
                    <PromptCard key={task.id} task={task} />
                  ))}
                </div>
              )}

              {/* Camera button */}
              <button
                onClick={() => cameraInputRef.current?.click()}
                className="w-full flex items-center gap-4 p-5 rounded-xl border-2 border-dashed border-primary/30 hover:border-primary hover:bg-primary-light/50 transition-all mb-3"
              >
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Camera className="w-6 h-6 text-primary" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-foreground">Take Photo</p>
                  <p className="text-xs text-muted">Open camera</p>
                </div>
              </button>

              {/* Gallery button */}
              <button
                onClick={() => galleryInputRef.current?.click()}
                className="w-full flex items-center gap-4 p-5 rounded-xl border-2 border-dashed border-border hover:border-primary hover:bg-primary-light/50 transition-all"
              >
                <div className="w-12 h-12 rounded-full bg-surface flex items-center justify-center">
                  <ImageIcon className="w-6 h-6 text-muted" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-foreground">Choose from Gallery</p>
                  <p className="text-xs text-muted">Select multiple photos or videos</p>
                </div>
              </button>

              {/* Hidden inputs */}
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFilesSelected}
                className="hidden"
              />
              <input
                ref={galleryInputRef}
                type="file"
                accept="image/*,video/*"
                multiple
                onChange={handleFilesSelected}
                className="hidden"
              />
            </div>
          </motion.div>
        )}

        {/* Step 3: Uploading */}
        {step === "uploading" && (
          <motion.div
            key="uploading"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex flex-col min-h-screen px-6 py-8"
          >
            <div className="w-full max-w-sm mx-auto">
              {/* Header */}
              <div className="text-center mb-6">
                <h1 className="text-xl font-bold text-foreground">
                  {isUploading
                    ? `Uploading ${completedCount}/${totalCount}...`
                    : `${completedCount}/${totalCount} uploaded`}
                </h1>
              </div>

              {/* Overall progress */}
              <div className="h-2 bg-surface rounded-full overflow-hidden mb-6">
                <motion.div
                  className="h-full bg-primary rounded-full"
                  initial={{ width: 0 }}
                  animate={{
                    width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%`,
                  }}
                  transition={{ duration: 0.3 }}
                />
              </div>

              {/* File list */}
              <div className="space-y-3">
                {uploads.map((upload) => (
                  <div
                    key={upload.id}
                    className="flex items-center gap-3 p-3 bg-surface rounded-xl"
                  >
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-white flex-shrink-0">
                      <img
                        src={upload.preview}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {upload.file.name}
                      </p>
                      <p className="text-xs text-muted">
                        {formatFileSize(upload.file.size)}
                      </p>
                      {(upload.status === "uploading" || upload.status === "compressing") && (
                        <div className="mt-1 h-1.5 bg-white rounded-full overflow-hidden">
                          <motion.div
                            className="h-full bg-primary rounded-full"
                            animate={{ width: `${upload.progress}%` }}
                            transition={{ duration: 0.2 }}
                          />
                        </div>
                      )}
                    </div>
                    <div className="flex-shrink-0">
                      {upload.status === "success" && (
                        <div className="w-7 h-7 rounded-full bg-success flex items-center justify-center">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      )}
                      {upload.status === "error" && (
                        <div className="w-7 h-7 rounded-full bg-danger flex items-center justify-center">
                          <span className="text-white text-xs">!</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* Step 4: Success */}
        {step === "success" && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex flex-col items-center justify-center min-h-screen px-6"
          >
            <div className="w-full max-w-sm text-center">
              {/* Success animation */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 10 }}
                className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-6"
              >
                <Check className="w-10 h-10 text-success" />
              </motion.div>

              <h1 className="text-2xl font-bold text-foreground mb-2">
                Photos uploaded!
              </h1>
              <p className="text-sm text-muted mb-8">
                {completedCount} {completedCount === 1 ? "photo" : "photos"} added
                to {album.name}
              </p>

              <div className="space-y-3">
                <Button
                  onClick={() => {
                    reset();
                    setStep("picker");
                  }}
                  className="w-full"
                  size="lg"
                >
                  <Plus className="w-4 h-4" />
                  Add More
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    reset();
                    setStep("picker");
                  }}
                  className="w-full"
                  size="lg"
                >
                  Done
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
