"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Home,
  Images,
  Share2,
  Settings,
  Users,
  Heart,
  FolderOpen,
} from "lucide-react";
import Avatar from "@/components/shared/Avatar";
import BrandLogo from "@/components/shared/BrandLogo";
import { cn } from "@/lib/utils/cn";
import { createClient } from "@/lib/supabase/client";
import { getActiveAlbumId } from "@/lib/active-album";
import type { Profile } from "@/types/database";

interface SidebarProps {
  user: Profile | null;
}

const navItems = [
  { href: "/home", label: "My Wedding", icon: Home },
  { href: "/album", label: "Album", icon: Images },
  { href: "/share", label: "Share", icon: Share2 },
  { href: "/settings", label: "Settings", icon: Settings },
];

const adminNavItems = [
  { href: "/admin?tab=profiles", label: "Profiles", icon: Users, tab: "profiles" },
  { href: "/admin?tab=couples", label: "Couples", icon: Heart, tab: "couples" },
  { href: "/admin?tab=albums", label: "Albums", icon: FolderOpen, tab: "albums" },
];

export default function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [displayUser, setDisplayUser] = useState<Profile | null>(user);
  const isAdmin = user?.role === "platform_admin";
  const inAdminCenter = isAdmin && pathname.startsWith("/admin");
  const activeAdminTab = searchParams.get("tab") || "profiles";
  const albumIdFromQuery = searchParams.get("album") || "";
  const allNavItems = inAdminCenter ? adminNavItems : navItems;

  useEffect(() => {
    let cancelled = false;

    const resolveDisplayUser = async () => {
      if (!user) {
        setDisplayUser(null);
        return;
      }

      if (user.role !== "platform_admin" || inAdminCenter) {
        setDisplayUser(user);
        return;
      }

      const pathParts = pathname.split("/").filter(Boolean);
      const albumIdFromPath = pathParts[0] === "album" ? pathParts[1] : "";
      const activeAlbumId = albumIdFromPath || albumIdFromQuery || getActiveAlbumId();

      if (!activeAlbumId) {
        setDisplayUser(user);
        return;
      }

      try {
        const supabase = createClient();
        const { data: album } = await supabase
          .from("albums")
          .select("owner_id")
          .eq("id", activeAlbumId)
          .maybeSingle();

        if (!album?.owner_id || album.owner_id === user.id) {
          if (!cancelled) setDisplayUser(user);
          return;
        }

        const { data: ownerProfile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", album.owner_id)
          .maybeSingle();

        if (!cancelled) {
          setDisplayUser((ownerProfile as Profile | null) || user);
        }
      } catch {
        if (!cancelled) setDisplayUser(user);
      }
    };

    resolveDisplayUser();

    return () => {
      cancelled = true;
    };
  }, [user, pathname, inAdminCenter, albumIdFromQuery]);

  return (
    <aside className="hidden md:flex flex-col h-screen sticky top-0 w-64 border-r border-border/80 bg-white/85 backdrop-blur-sm py-6 px-4">
      <div className="flex items-center gap-2 mb-6 px-2">
        <BrandLogo size="md" />
        <p className="text-lg font-semibold tracking-tight text-foreground">MemoriesBox</p>
      </div>

      <div className="flex justify-center mb-6">
        <div className="text-center">
          <div className="ig-story-ring inline-flex">
            <Avatar
              src={displayUser?.avatar_url}
              alt={displayUser?.display_name || "User"}
              size="xl"
              className="border-2 border-white"
            />
          </div>
          <p className="mt-3 text-sm font-semibold text-foreground truncate max-w-[180px]">
            {displayUser?.display_name || "Your Wedding"}
          </p>
          <p className="text-xs text-muted truncate max-w-[180px]">
            {displayUser?.username ? `@${displayUser.username}` : "wedding account"}
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1.5">
        {allNavItems.map((item) => {
          const isActive = inAdminCenter
            ? "tab" in item && item.tab === activeAdminTab
            : pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors",
                isActive
                  ? "text-foreground bg-surface"
                  : "text-muted hover:text-foreground hover:bg-surface/65"
              )}
            >
              <Icon className={cn("w-5 h-5")} strokeWidth={isActive ? 2.5 : 2} />
              {item.label}
            </Link>
          );
        })}
      </nav>

    </aside>
  );
}
