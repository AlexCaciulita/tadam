"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, AlertCircle, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { formatFileSize } from "@/lib/utils/image-resize";
import type { UploadFile } from "@/types/database";

interface UploadProgressProps {
  uploads: UploadFile[];
  isUploading: boolean;
  onClose: () => void;
}

export default function UploadProgress({
  uploads,
  isUploading,
  onClose,
}: UploadProgressProps) {
  const hasErrors = uploads.some((u) => u.status === "error");

  // Auto-dismiss only when all uploads succeeded (not when there are errors)
  useEffect(() => {
    if (uploads.length > 0 && !isUploading && !hasErrors) {
      const timer = setTimeout(onClose, 1500);
      return () => clearTimeout(timer);
    }
  }, [isUploading, uploads.length, hasErrors, onClose]);

  if (uploads.length === 0) return null;

  const completed = uploads.filter((u) => u.status === "success").length;
  const failed = uploads.filter((u) => u.status === "error").length;
  const total = uploads.length;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="fixed bottom-20 md:bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-white rounded-xl shadow-2xl border border-border z-40 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div>
            <h3 className="text-sm font-bold">
              {isUploading
                ? `Uploading ${completed}/${total}...`
                : failed > 0
                  ? `${failed} failed, ${completed} uploaded`
                  : `${completed}/${total} uploaded`}
            </h3>
          </div>
          {!isUploading && (
            <button
              onClick={onClose}
              className="p-1 rounded-full hover:bg-surface"
            >
              <X className="w-4 h-4 text-muted" />
            </button>
          )}
        </div>

        {/* Overall progress bar */}
        <div className="h-1 bg-surface">
          <motion.div
            className={cn("h-full", hasErrors ? "bg-danger" : "bg-primary")}
            initial={{ width: 0 }}
            animate={{
              width: `${total > 0 ? (completed / total) * 100 : 0}%`,
            }}
            transition={{ duration: 0.3 }}
          />
        </div>

        {/* File list */}
        <div className="max-h-60 overflow-y-auto">
          {uploads.map((upload) => (
            <div
              key={upload.id}
              className="flex items-center gap-3 px-4 py-2.5 border-b border-border/50 last:border-b-0"
            >
              {/* Thumbnail */}
              <div className="w-10 h-10 rounded-lg overflow-hidden bg-surface flex-shrink-0">
                <img
                  src={upload.preview}
                  alt=""
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">
                  {upload.file.name}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-[10px] text-muted">
                    {formatFileSize(upload.file.size)}
                  </p>
                  {upload.status === "compressing" && (
                    <p className="text-[10px] text-primary">Compressing...</p>
                  )}
                </div>

                {/* Error message */}
                {upload.status === "error" && upload.error && (
                  <p className="text-[10px] text-danger mt-0.5 truncate">
                    {upload.error}
                  </p>
                )}

                {/* Progress bar */}
                {(upload.status === "uploading" || upload.status === "compressing") && (
                  <div className="mt-1 h-1 bg-surface rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-primary rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${upload.progress}%` }}
                      transition={{ duration: 0.2 }}
                    />
                  </div>
                )}
              </div>

              {/* Status icon */}
              <div className="flex-shrink-0">
                {upload.status === "success" && (
                  <div className="w-6 h-6 rounded-full bg-success/10 flex items-center justify-center">
                    <Check className="w-3.5 h-3.5 text-success" />
                  </div>
                )}
                {upload.status === "error" && (
                  <div className="w-6 h-6 rounded-full bg-danger/10 flex items-center justify-center">
                    <AlertCircle className="w-3.5 h-3.5 text-danger" />
                  </div>
                )}
                {(upload.status === "uploading" || upload.status === "compressing") && (
                  <Loader2 className={cn("w-4 h-4 animate-spin text-primary")} />
                )}
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
