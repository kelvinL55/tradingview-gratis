"use client";

import { Watchlist } from "@/components/watchlist/Watchlist";

export function RightSidebar() {
  return (
    <aside className="hidden md:flex w-64 flex-col h-full min-h-0 overflow-hidden border-l border-tv-border bg-tv-panel">
      <Watchlist />
    </aside>
  );
}
