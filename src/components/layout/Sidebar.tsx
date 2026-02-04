"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  PlusSquare,
  ScanLine,
  Bell,
  Search,
  Users,
  Bookmark,
  Settings,
  LogOut,
} from "lucide-react";
import Avatar from "@/components/shared/Avatar";
import { cn } from "@/lib/utils/cn";
import type { Profile } from "@/types/database";

interface SidebarProps {
  user: Profile | null;
}

const navItems = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/create-album", label: "Create album", icon: PlusSquare },
  { href: "/join", label: "Join album", icon: ScanLine },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/find-friends", label: "Find friends", icon: Search },
  { href: "/friends", label: "View friends", icon: Users },
  { href: "/saved", label: "Saved albums", icon: Bookmark },
];

const bottomItems = [
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex flex-col h-screen sticky top-0 w-60 border-r border-border bg-white py-6 px-4">
      {/* Avatar */}
      <div className="flex justify-center mb-6">
        <Avatar
          src={user?.avatar_url}
          alt={user?.display_name || "User"}
          size="xl"
        />
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "text-foreground bg-surface"
                  : "text-muted hover:text-foreground hover:bg-surface/50"
              )}
            >
              <Icon
                className={cn("w-5 h-5", isActive && "fill-current")}
                strokeWidth={isActive ? 2.5 : 2}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom items */}
      <div className="space-y-1 pt-4 border-t border-border">
        {bottomItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "text-foreground bg-surface"
                  : "text-muted hover:text-foreground hover:bg-surface/50"
              )}
            >
              <Icon className="w-5 h-5" />
              {item.label}
            </Link>
          );
        })}
        <button
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted hover:text-foreground hover:bg-surface/50 transition-colors w-full"
        >
          <LogOut className="w-5 h-5" />
          Log out
        </button>
      </div>
    </aside>
  );
}
