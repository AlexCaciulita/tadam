import EmptyState from "@/components/shared/EmptyState";
import { Heart } from "lucide-react";

export default function NotificationsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">Notifications</h1>

      <EmptyState
        title="No new notifications"
        description="When your friends comment, like, or upload new posts in your albums, it will appear here."
        icon={<Heart className="w-12 h-12 text-primary fill-primary" />}
      />
    </div>
  );
}
