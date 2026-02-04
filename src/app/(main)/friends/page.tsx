import EmptyState from "@/components/shared/EmptyState";

export default function FriendsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">View friends</h1>

      <EmptyState
        title="No friends yet"
        description="Find and add friends to start sharing albums together."
      />
    </div>
  );
}
