"use client";

import { useEffect, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";

type PostgresChangeEvent = "INSERT" | "UPDATE" | "DELETE" | "*";

interface UseRealtimeOptions {
  table: string;
  filter?: string;
  event?: PostgresChangeEvent;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onInsert?: (payload: any) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onUpdate?: (payload: any) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onDelete?: (payload: any) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onChange?: (payload: any) => void;
  enabled?: boolean;
}

const isDemoMode = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  return !url || url.includes("your-project");
};

export function useRealtime({
  table,
  filter,
  event = "*",
  onInsert,
  onUpdate,
  onDelete,
  onChange,
  enabled = true,
}: UseRealtimeOptions) {
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    // Skip realtime subscription in demo mode
    if (!enabled || isDemoMode()) return;

    const initChannel = async () => {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const channelName = `${table}-${filter || "all"}-${Date.now()}`;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const channelConfig: any = {
        event,
        schema: "public",
        table,
      };

      if (filter) {
        channelConfig.filter = filter;
      }

      const channel = supabase
        .channel(channelName)
        .on(
          "postgres_changes" as never,
          channelConfig,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (payload: any) => {
            onChange?.(payload);

            if (payload.eventType === "INSERT" && onInsert) {
              onInsert(payload.new);
            } else if (payload.eventType === "UPDATE" && onUpdate) {
              onUpdate(payload.new);
            } else if (payload.eventType === "DELETE" && onDelete) {
              onDelete(payload.old);
            }
          }
        )
        .subscribe();

      channelRef.current = channel;

      return () => {
        supabase.removeChannel(channel);
      };
    };

    const cleanupPromise = initChannel();

    return () => {
      cleanupPromise.then((cleanup) => cleanup?.());
    };
  }, [table, filter, event, enabled, onInsert, onUpdate, onDelete, onChange]);

  return channelRef.current;
}
