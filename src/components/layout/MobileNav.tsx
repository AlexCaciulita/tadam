"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Home, Images, Share2, User, Users, Heart, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useEffect, useState } from "react";
import { getDeviceUser } from "@/lib/device-user";
import { useI18n } from "@/lib/i18n/LanguageProvider";

export default function MobileNav() {
  const { t } = useI18n();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isAdmin, setIsAdmin] = useState(false);
  const navItems = [
    { href: "/home", label: t("sidebar.wedding"), icon: Home },
    { href: "/album", label: t("common.album"), icon: Images },
    { href: "/share", label: t("common.share"), icon: Share2 },
    { href: "/settings", label: t("common.settings"), icon: User },
  ];

  const adminNavItems = [
    { href: "/admin?tab=profiles", label: t("common.profiles"), icon: Users, tab: "profiles" },
    { href: "/admin?tab=couples", label: t("common.couples"), icon: Heart, tab: "couples" },
    { href: "/admin?tab=albums", label: t("common.albums"), icon: FolderOpen, tab: "albums" },
  ];

  useEffect(() => {
    const init = async () => {
      const user = await getDeviceUser();
      setIsAdmin(user.role === "platform_admin");
    };
    init();
  }, []);

  const inAdminCenter = isAdmin && pathname.startsWith("/admin");
  const activeAdminTab = searchParams.get("tab") || "profiles";
  const items = inAdminCenter ? adminNavItems : navItems;

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-border z-40 pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around py-2 px-2">
        {items.map((item) => {
          const isActive = inAdminCenter
            ? "tab" in item && item.tab === activeAdminTab
            : pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-colors min-w-[58px]",
                isActive ? "text-primary bg-primary-light" : "text-muted"
              )}
            >
              <Icon className={cn("w-5 h-5")} strokeWidth={isActive ? 2.5 : 1.8} />
              <span className="text-[11px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
