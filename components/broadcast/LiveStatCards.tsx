"use client";

import { useState, useCallback } from "react";
import { Copy, Check } from "lucide-react";
import type { StatCard } from "@/types/api";

interface Props {
  data: StatCard[];
}

const TYPE_LABELS: Record<string, string> = {
  player_vs_player: "Player vs Player",
  line_vs_line: "Line vs Line",
  special_teams: "Special Teams",
  goalie: "Goalie Comparison",
  team_trend: "Team Trend",
};

export default function LiveStatCards({ data }: Props) {
  const [copiedIdx, setCopiedIdx] = useState<string | null>(null);

  const copyText = useCallback(async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // fallback
    }
    setCopiedIdx(key);
    setTimeout(() => setCopiedIdx(null), 2000);
  }, []);

  if (!data || data.length === 0) {
    return <p className="text-sm text-muted/50 text-center py-4">No stat cards. Generate to populate.</p>;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {data.map((card, i) => (
        <div key={i} className="bg-white border border-teal/20 rounded-xl p-4 hover:shadow-sm transition-shadow">
          {/* Type badge */}
          <span className="text-[9px] font-oswald uppercase tracking-wider text-muted/50">
            {TYPE_LABELS[card.card_type] || card.card_type}
          </span>

          {/* Headline stat */}
          <div className="mt-1.5 mb-2">
            <span className="text-[10px] font-oswald uppercase tracking-wider text-muted/60 block">
              {card.headline_stat}
            </span>
            <span className="text-3xl font-oswald font-bold text-navy">
              {card.headline_value}
            </span>
          </div>

          {/* Support stats */}
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mb-2">
            {card.support_stats.map((s, j) => (
              <div key={j} className="text-[11px]">
                <span className="text-muted/60">{s.label}: </span>
                <span className="font-mono font-medium text-navy">{s.value}</span>
              </div>
            ))}
          </div>

          {/* Interpretation */}
          <p className="text-xs text-navy/80 italic mb-2">{card.interpretation}</p>

          {/* Graphic caption */}
          <div className="bg-navy/[0.03] rounded-lg px-2.5 py-1.5 text-[11px] text-navy/70 mb-2">
            {card.graphic_caption}
          </div>

          {/* Copy buttons */}
          <div className="flex gap-1">
            <button
              onClick={() => copyText(card.graphic_caption, `cap-${i}`)}
              className="text-[9px] font-oswald uppercase tracking-wider text-muted/50 hover:text-navy px-1.5 py-0.5 rounded bg-navy/[0.03] hover:bg-navy/[0.06] transition-colors flex items-center gap-1"
            >
              {copiedIdx === `cap-${i}` ? <Check size={9} className="text-green-600" /> : <Copy size={9} />}
              Caption
            </button>
            <button
              onClick={() =>
                copyText(
                  card.support_stats.map((s) => `${s.label}: ${s.value}`).join("\n"),
                  `stats-${i}`
                )
              }
              className="text-[9px] font-oswald uppercase tracking-wider text-muted/50 hover:text-navy px-1.5 py-0.5 rounded bg-navy/[0.03] hover:bg-navy/[0.06] transition-colors flex items-center gap-1"
            >
              {copiedIdx === `stats-${i}` ? <Check size={9} className="text-green-600" /> : <Copy size={9} />}
              Stats
            </button>
            <button
              onClick={() =>
                copyText(
                  `${card.headline_stat}: ${card.headline_value}\n${card.support_stats.map((s) => `${s.label}: ${s.value}`).join("\n")}\n${card.interpretation}\n${card.graphic_caption}`,
                  `all-${i}`
                )
              }
              className="text-[9px] font-oswald uppercase tracking-wider text-muted/50 hover:text-navy px-1.5 py-0.5 rounded bg-navy/[0.03] hover:bg-navy/[0.06] transition-colors flex items-center gap-1"
            >
              {copiedIdx === `all-${i}` ? <Check size={9} className="text-green-600" /> : <Copy size={9} />}
              All
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
