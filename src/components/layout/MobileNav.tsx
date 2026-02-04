"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, PlusSquare, Bell, ScanLine, User } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const navItems = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/join", label: "Scan", icon: ScanLine },
  { href: "/create-album", label: "Create", icon: PlusSquare },
  { href: "/notifications", label: "Alerts", icon: Bell },
  { href: "/settings", label: "Profile", icon: User },
];

export default function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-border z-40 pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around py-2 px-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-0.5 py-1 px-3 rounded-lg transition-colors min-w-[48px]",
                isActive ? "text-primary" : "text-muted"
              )}
            >
              <Icon
                className={cn("w-5 h-5", isActive && "fill-current")}
                strokeWidth={isActive ? 2.5 : 1.5}
              />
              <span className="text-[11px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
