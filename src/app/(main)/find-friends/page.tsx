"use client";

import { useState } from "react";
import SearchInput from "@/components/shared/SearchInput";
import EmptyState from "@/components/shared/EmptyState";

export default function FindFriendsPage() {
  const [query, setQuery] = useState("");

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">Search</h1>

      <SearchInput
        value={query}
        onChange={setQuery}
        placeholder="Search friends"
        autoFocus
      />

      <div className="mt-6">
        <EmptyState
          title="Create your community"
          description="Search and discover new friends to share more memories together."
        />
      </div>
    </div>
  );
}
