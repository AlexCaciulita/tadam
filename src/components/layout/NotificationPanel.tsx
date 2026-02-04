"use client";

import Link from "next/link";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { Notification } from "@/types/database";

interface NotificationPanelProps {
  notifications: Notification[];
  className?: string;
}

export default function NotificationPanel({
  notifications,
  className,
}: NotificationPanelProps) {
  return (
    <aside
      className={cn(
        "hidden lg:flex flex-col h-screen sticky top-0 w-80 border-l border-border bg-white py-6 px-5",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold">Notifications</h2>
        <Link
          href="/notifications"
          className="text-sm text-primary hover:text-primary-hover font-medium flex items-center gap-1"
        >
          View more
          <span className="text-xs">→</span>
        </Link>
      </div>

      {/* Content */}
      {notifications.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
          <h3 className="font-bold text-foreground mb-2">
            No new notifications
          </h3>
          <p className="text-sm text-muted mb-8">
            When your friends comment, like, or upload new posts in your albums, it will appear here.
          </p>
          {/* Heart balloon illustration placeholder */}
          <div className="flex flex-col items-center">
            <Heart className="w-12 h-12 text-primary fill-primary mb-2" />
            <div className="w-px h-8 bg-muted/30" />
            <div className="text-4xl mt-1">🧑‍🚀</div>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-3 hide-scrollbar">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={cn(
                "p-3 rounded-lg text-sm transition-colors",
                notification.is_read ? "bg-white" : "bg-primary-light"
              )}
            >
              <p className="text-foreground">{notification.message}</p>
              <p className="text-xs text-muted mt-1">
                {new Date(notification.created_at).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="mt-auto pt-6 text-center text-xs text-muted">
        <p>© 2026 Playlog Group Inc. All rights reserved.</p>
        <div className="flex items-center justify-center gap-2 mt-1">
          <Link href="#" className="text-primary hover:underline">
            Privacy Policy
          </Link>
          <span>|</span>
          <Link href="#" className="text-primary hover:underline">
            Terms of Service
          </Link>
        </div>
      </div>
    </aside>
  );
}
