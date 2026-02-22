"use client";

import { useState, useCallback } from "react";
import { Copy, Check, Filter } from "lucide-react";
import type { TalkTrack, TalkTrackCategory, TalkTrackSegment, TalkTrackContentTag, BroadcastAudience } from "@/types/api";

const SEGMENT_LABELS: { key: TalkTrackSegment; label: string; color: string }[] = [
  { key: "opening", label: "Opening", color: "bg-purple-100 text-purple-700" },
  { key: "color", label: "Color", color: "bg-blue-100 text-blue-700" },
  { key: "bench_hit", label: "Bench Hit", color: "bg-orange/10 text-orange" },
  { key: "panel", label: "Panel", color: "bg-green-100 text-green-700" },
  { key: "feature", label: "Feature", color: "bg-rose-100 text-rose-700" },
];

const CONTENT_TAG_LABELS: { key: TalkTrackContentTag; label: string; color: string }[] = [
  { key: "human_story", label: "Human Story", color: "bg-rose-50 text-rose-600 border-rose-200" },
  { key: "analytics", label: "Analytics", color: "bg-blue-50 text-blue-600 border-blue-200" },
  { key: "tactical", label: "Tactical", color: "bg-amber-50 text-amber-600 border-amber-200" },
  { key: "milestone", label: "Milestone", color: "bg-green-50 text-green-600 border-green-200" },
  { key: "rivalry", label: "Rivalry", color: "bg-purple-50 text-purple-600 border-purple-200" },
];

interface Props {
  data: Record<string, TalkTrack[]> | null;
  audience?: BroadcastAudience;
}

const CATEGORY_TABS: { key: TalkTrackCategory; label: string }[] = [
  { key: "team_storyline", label: "Team" },
  { key: "matchup_storyline", label: "Matchup" },
  { key: "player_storyline", label: "Player" },
  { key: "streak_milestone", label: "Streak / Milestone" },
];

export default function TalkTracks({ data, audience = "informed" }: Props) {
  const [activeCategory, setActiveCategory] = useState<TalkTrackCategory>("team_storyline");
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [segmentFilter, setSegmentFilter] = useState<Set<TalkTrackSegment>>(new Set());
  const [tagFilter, setTagFilter] = useState<Set<TalkTrackContentTag>>(new Set());
  const [showFilters, setShowFilters] = useState(false);

  const allTracks = data?.[activeCategory] || [];

  // Apply filters
  const tracks = allTracks.filter((t) => {
    if (segmentFilter.size > 0 && t.segment_type && !segmentFilter.has(t.segment_type)) return false;
    if (tagFilter.size > 0 && t.content_tags) {
      if (!t.content_tags.some((tag) => tagFilter.has(tag))) return false;
    }
    return true;
  });

  function toggleSegment(s: TalkTrackSegment) {
    setSegmentFilter((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s); else next.add(s);
      return next;
    });
  }

  function toggleTag(t: TalkTrackContentTag) {
    setTagFilter((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t); else next.add(t);
      return next;
    });
  }

  // Get audience-appropriate text
  function getTrackText(track: TalkTrack): string {
    if (audience === "casual" && track.text_casual) return track.text_casual;
    if (audience === "hardcore" && track.text_hardcore) return track.text_hardcore;
    if (audience === "informed" && track.text_informed) return track.text_informed;
    return track.twenty_sec_read;
  }

  const copyTrack = useCallback(async (track: TalkTrack, idx: number) => {
    const displayText = getTrackText(track);
    const text = `${track.headline}\n\n${displayText}\n\n${track.stat_hook}`;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // fallback
    }
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audience]);

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

      {/* Filter bar */}
      <div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-1 text-[10px] font-oswald uppercase tracking-wider px-2 py-1 rounded-lg transition-colors ${
            showFilters || segmentFilter.size > 0 || tagFilter.size > 0 ? "bg-teal/10 text-teal" : "text-muted/40 hover:text-muted"
          }`}
        >
          <Filter size={10} />
          Filters {(segmentFilter.size + tagFilter.size) > 0 && `(${segmentFilter.size + tagFilter.size})`}
        </button>
        {showFilters && (
          <div className="mt-2 space-y-2 bg-navy/[0.02] rounded-lg p-2">
            <div className="flex flex-wrap gap-1">
              <span className="text-[9px] text-muted/50 font-oswald uppercase tracking-wider w-full">Segment</span>
              {SEGMENT_LABELS.map((s) => (
                <button key={s.key} onClick={() => toggleSegment(s.key)}
                  className={`text-[9px] px-2 py-0.5 rounded-full font-bold transition-colors ${segmentFilter.has(s.key) ? s.color : "bg-gray-100 text-gray-400"}`}
                >{s.label}</button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1">
              <span className="text-[9px] text-muted/50 font-oswald uppercase tracking-wider w-full">Tags</span>
              {CONTENT_TAG_LABELS.map((t) => (
                <button key={t.key} onClick={() => toggleTag(t.key)}
                  className={`text-[9px] px-2 py-0.5 rounded-full font-medium border transition-colors ${tagFilter.has(t.key) ? t.color : "bg-gray-50 text-gray-400 border-gray-200"}`}
                >{t.label}</button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Tracks */}
      {tracks.length === 0 ? (
        <p className="text-xs text-muted/40 text-center py-3">{allTracks.length > 0 ? "No tracks match filters." : "No tracks in this category."}</p>
      ) : (
        <div className="space-y-3">
          {tracks.map((track, i) => {
            const segCfg = track.segment_type ? SEGMENT_LABELS.find((s) => s.key === track.segment_type) : null;
            return (
              <div key={i} className="border border-teal/10 rounded-lg p-3 hover:border-teal/20 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-oswald font-bold text-navy leading-tight">
                      {track.headline}
                    </h4>
                    {segCfg && (
                      <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold ${segCfg.color}`}>{segCfg.label}</span>
                    )}
                  </div>
                  <button
                    onClick={() => copyTrack(track, i)}
                    className="shrink-0 p-1 rounded text-muted/40 hover:text-navy transition-colors"
                    title="Copy track"
                  >
                    {copiedIdx === i ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
                  </button>
                </div>
                <p className="text-xs text-navy/80 mt-1.5 leading-relaxed">
                  {getTrackText(track)}
                </p>
                <p className="text-[11px] text-teal italic mt-1.5">
                  {track.stat_hook}
                </p>
                {track.content_tags && track.content_tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {track.content_tags.map((tag) => {
                      const cfg = CONTENT_TAG_LABELS.find((t) => t.key === tag);
                      return cfg ? (
                        <span key={tag} className={`text-[8px] px-1.5 py-0.5 rounded border ${cfg.color}`}>{cfg.label}</span>
                      ) : null;
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
