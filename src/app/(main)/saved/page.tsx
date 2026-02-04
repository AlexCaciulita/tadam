import EmptyState from "@/components/shared/EmptyState";
import { Bookmark } from "lucide-react";

export default function SavedAlbumsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">Saved albums</h1>

      <EmptyState
        title="No saved albums"
        description="Albums you bookmark will appear here."
        icon={<Bookmark className="w-12 h-12 text-muted" />}
      />
    </div>
  );
}
