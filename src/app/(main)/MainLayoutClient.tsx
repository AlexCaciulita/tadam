"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import MobileNav from "@/components/layout/MobileNav";
import NotificationPanel from "@/components/layout/NotificationPanel";
import { getDeviceUser } from "@/lib/device-user";
import type { Profile, Notification } from "@/types/database";

interface MainLayoutClientProps {
  user: Profile | null;
  notifications: Notification[];
  children: React.ReactNode;
}

export default function MainLayoutClient({
  user: initialUser,
  notifications,
  children,
}: MainLayoutClientProps) {
  const [user, setUser] = useState<Profile | null>(initialUser);
  const [loading, setLoading] = useState(!initialUser);

  useEffect(() => {
    if (initialUser) {
      setUser(initialUser);
      setLoading(false);
      return;
    }

    const init = async () => {
      try {
        const deviceUser = await getDeviceUser();
        setUser(deviceUser);
      } catch (err) {
        console.error("Failed to init device user:", err);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [initialUser]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-sm text-muted">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="flex">
        {/* Left Sidebar */}
        <Sidebar user={user} />

        {/* Main Content */}
        <main className="flex-1 min-h-screen border-r border-border lg:border-r-0 pb-20 md:pb-0">
          <div className="max-w-4xl mx-auto px-4 md:px-6 py-6">
            {children}
          </div>
        </main>

        {/* Right Sidebar - Notifications */}
        <NotificationPanel notifications={notifications} />
      </div>

      {/* Mobile Bottom Nav */}
      <MobileNav />
    </div>
  );
}
