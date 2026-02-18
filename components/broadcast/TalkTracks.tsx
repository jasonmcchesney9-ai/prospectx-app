"use client";

import { useState, useCallback } from "react";
import { Copy, Check } from "lucide-react";
import type { TalkTrack, TalkTrackCategory } from "@/types/api";

interface Props {
  data: Record<string, TalkTrack[]> | null;
}

const CATEGORY_TABS: { key: TalkTrackCategory; label: string }[] = [
  { key: "team_storyline", label: "Team" },
  { key: "matchup_storyline", label: "Matchup" },
  { key: "player_storyline", label: "Player" },
  { key: "streak_milestone", label: "Streak / Milestone" },
];

export default function TalkTracks({ data }: Props) {
  const [activeCategory, setActiveCategory] = useState<TalkTrackCategory>("team_storyline");
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const tracks = data?.[activeCategory] || [];

  const copyTrack = useCallback(async (track: TalkTrack, idx: number) => {
    const text = `${track.headline}\n\n${track.twenty_sec_read}\n\n${track.stat_hook}`;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // fallback
    }
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  }, []);

  if (!data) {
    return <p className="text-sm text-muted/50 text-center py-4">No talk tracks. Generate to populate.</p>;
  }

  return (
    <div className="space-y-3">
      {/* Category tabs */}
      <div className="flex bg-navy/[0.04] rounded-lg p-0.5">
        {CATEGORY_TABS.map((tab) => {
          const count = (data[tab.key] || []).length;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveCategory(tab.key)}
              className={`flex-1 px-2 py-1.5 rounded-md text-[10px] font-oswald font-bold uppercase tracking-wider transition-colors ${
                activeCategory === tab.key
                  ? "bg-white text-navy shadow-sm"
                  : "text-muted/50 hover:text-muted"
              }`}
            >
              {tab.label} {count > 0 && <span className="text-muted/40 ml-0.5">({count})</span>}
            </button>
          );
        })}
      </div>

      {/* Tracks */}
      {tracks.length === 0 ? (
        <p className="text-xs text-muted/40 text-center py-3">No tracks in this category.</p>
      ) : (
        <div className="space-y-3">
          {tracks.map((track, i) => (
            <div key={i} className="border border-border/50 rounded-lg p-3 hover:border-border transition-colors">
              <div className="flex items-start justify-between gap-2">
                <h4 className="text-sm font-oswald font-bold text-navy leading-tight">
                  {track.headline}
                </h4>
                <button
                  onClick={() => copyTrack(track, i)}
                  className="shrink-0 p-1 rounded text-muted/40 hover:text-navy transition-colors"
                  title="Copy track"
                >
                  {copiedIdx === i ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
                </button>
              </div>
              <p className="text-xs text-navy/80 mt-1.5 leading-relaxed">
                {track.twenty_sec_read}
              </p>
              <p className="text-[11px] text-teal italic mt-1.5">
                {track.stat_hook}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
