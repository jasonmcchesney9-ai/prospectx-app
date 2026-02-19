"use client";

import { useState } from "react";
import { RefreshCw, X, Loader2, Rss } from "lucide-react";
import api from "@/lib/api";
import type { CalendarFeed } from "@/types/api";
import { CALENDAR_PROVIDERS } from "@/types/api";

interface ConnectedFeedsProps {
  feeds: CalendarFeed[];
  onFeedRemoved: (feedId: string) => void;
  onFeedSynced: () => void;
}

export default function ConnectedFeeds({ feeds, onFeedRemoved, onFeedSynced }: ConnectedFeedsProps) {
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);

  async function handleSync(feedId: string) {
    setSyncingId(feedId);
    try {
      await api.post(`/api/calendar/feeds/${feedId}/sync`);
      onFeedSynced();
    } catch (err) {
      console.error("Sync failed:", err);
    } finally {
      setSyncingId(null);
    }
  }

  async function handleSyncAll() {
    setSyncingAll(true);
    for (const feed of feeds) {
      if (feed.active) {
        try {
          await api.post(`/api/calendar/feeds/${feed.id}/sync`);
        } catch (err) {
          console.error(`Sync failed for ${feed.label}:`, err);
        }
      }
    }
    onFeedSynced();
    setSyncingAll(false);
  }

  async function handleRemove(feedId: string) {
    if (!confirm("Remove this feed and all its imported events?")) return;
    try {
      await api.delete(`/api/calendar/feeds/${feedId}`);
      onFeedRemoved(feedId);
    } catch (err) {
      console.error("Remove failed:", err);
    }
  }

  if (feeds.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[10px] font-oswald font-bold text-muted uppercase tracking-wider">
        Connected:
      </span>

      {feeds.map((feed) => {
        const provider = CALENDAR_PROVIDERS[feed.provider] || CALENDAR_PROVIDERS.ICAL_GENERIC;
        const isSyncing = syncingId === feed.id || syncingAll;

        return (
          <div
            key={feed.id}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-border rounded-full text-xs group"
          >
            <Rss size={10} style={{ color: provider.color }} />
            <span className="font-medium text-navy">{feed.label}</span>
            <span className="text-muted/50">({feed.event_count})</span>

            <button
              onClick={() => handleSync(feed.id)}
              disabled={isSyncing}
              className="p-0.5 hover:bg-navy/5 rounded transition-colors ml-0.5"
              title="Sync"
            >
              {isSyncing ? (
                <Loader2 size={10} className="text-teal animate-spin" />
              ) : (
                <RefreshCw size={10} className="text-muted/40 hover:text-teal" />
              )}
            </button>

            <button
              onClick={() => handleRemove(feed.id)}
              className="p-0.5 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100"
              title="Remove feed"
            >
              <X size={10} className="text-muted/40 hover:text-red-500" />
            </button>
          </div>
        );
      })}

      {feeds.length > 1 && (
        <button
          onClick={handleSyncAll}
          disabled={syncingAll}
          className="flex items-center gap-1 px-2.5 py-1 bg-teal/10 text-teal border border-teal/20 rounded-full text-xs font-medium hover:bg-teal/20 transition-colors disabled:opacity-50"
        >
          {syncingAll ? (
            <Loader2 size={10} className="animate-spin" />
          ) : (
            <RefreshCw size={10} />
          )}
          Sync All
        </button>
      )}
    </div>
  );
}
