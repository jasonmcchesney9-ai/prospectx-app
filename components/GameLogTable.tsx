"use client";

import { useState } from "react";
import { Calendar, Flame, Snowflake, ChevronLeft, ChevronRight } from "lucide-react";
import type { GameStatsResponse, PlayerGameStat } from "@/types/api";

interface Props {
  data: GameStatsResponse;
  onPageChange?: (offset: number) => void;
  currentOffset?: number;
  pageSize?: number;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
}

function PointsBadge({ points }: { points: number }) {
  if (points >= 3) return <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-teal/15 text-teal text-[10px] font-bold"><Flame size={9} />{points}P</span>;
  if (points === 2) return <span className="inline-flex px-1.5 py-0.5 rounded bg-teal/10 text-teal text-[10px] font-bold">{points}P</span>;
  if (points === 1) return <span className="inline-flex px-1.5 py-0.5 rounded bg-navy/[0.06] text-navy text-[10px] font-semibold">{points}P</span>;
  return <span className="text-[10px] text-muted/40"><Snowflake size={9} className="inline" /></span>;
}

export default function GameLogTable({ data, onPageChange, currentOffset = 0, pageSize = 50 }: Props) {
  const { games, total, source } = data;

  if (!games || games.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-teal/20 p-6 text-center">
        <Calendar size={32} className="mx-auto text-muted/30 mb-2" />
        <p className="text-sm text-muted">No game-by-game data available.</p>
        <p className="text-xs text-muted/60 mt-1">Sync game logs from Live Stats & Data to see per-game stats.</p>
      </div>
    );
  }

  const totalPages = Math.ceil(total / pageSize);
  const currentPage = Math.floor(currentOffset / pageSize) + 1;

  return (
    <div className="space-y-3">
      {/* Source badge + count */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted">{total} game{total !== 1 ? "s" : ""}</span>
          <span className={`inline-flex px-2 py-0.5 rounded text-[9px] font-oswald uppercase tracking-wider ${
            source === "hockeytech" ? "bg-teal/10 text-teal" : source === "instat" ? "bg-orange/10 text-orange" : "bg-gray-100 text-muted"
          }`}>
            {source}
          </span>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center gap-1 text-xs text-muted">
            <button
              onClick={() => onPageChange?.(Math.max(0, currentOffset - pageSize))}
              disabled={currentOffset === 0}
              className="p-1 rounded hover:bg-navy/[0.05] disabled:opacity-30"
            >
              <ChevronLeft size={14} />
            </button>
            <span>{currentPage} / {totalPages}</span>
            <button
              onClick={() => onPageChange?.(currentOffset + pageSize)}
              disabled={currentOffset + pageSize >= total}
              className="p-1 rounded hover:bg-navy/[0.05] disabled:opacity-30"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Game log table */}
      <div className="bg-white rounded-xl border border-teal/20 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-teal/20 bg-navy/[0.03]">
                <th className="text-left px-3 py-2 text-[10px] font-oswald uppercase tracking-wider text-muted">Date</th>
                <th className="text-left px-3 py-2 text-[10px] font-oswald uppercase tracking-wider text-muted">Opp</th>
                <th className="text-center px-2 py-2 text-[10px] font-oswald uppercase tracking-wider text-muted">H/A</th>
                <th className="text-right px-3 py-2 text-[10px] font-oswald uppercase tracking-wider text-muted">G</th>
                <th className="text-right px-3 py-2 text-[10px] font-oswald uppercase tracking-wider text-muted">A</th>
                <th className="text-right px-3 py-2 text-[10px] font-oswald uppercase tracking-wider text-muted">P</th>
                <th className="text-right px-3 py-2 text-[10px] font-oswald uppercase tracking-wider text-muted">+/-</th>
                <th className="text-right px-3 py-2 text-[10px] font-oswald uppercase tracking-wider text-muted">PIM</th>
                <th className="text-right px-3 py-2 text-[10px] font-oswald uppercase tracking-wider text-muted">SOG</th>
              </tr>
            </thead>
            <tbody>
              {games.map((g, i) => {
                const goals = g.goals ?? 0;
                const assists = g.assists ?? 0;
                const points = g.points ?? (goals + assists);
                return (
                  <tr key={g.id || i} className="border-b border-teal/10 hover:bg-navy/[0.02]">
                    <td className="px-3 py-2 text-xs text-navy">{formatDate(g.game_date)}</td>
                    <td className="px-3 py-2 text-xs font-medium text-navy truncate max-w-[120px]" title={g.opponent || ""}>
                      {g.opponent || "—"}
                    </td>
                    <td className="px-2 py-2 text-center">
                      <span className={`text-[9px] font-oswald uppercase ${g.home_away === "home" ? "text-teal" : "text-navy/50"}`}>
                        {g.home_away === "home" ? "H" : g.home_away === "away" ? "A" : "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-medium">{goals}</td>
                    <td className="px-3 py-2 text-right font-medium">{assists}</td>
                    <td className="px-3 py-2 text-right">
                      <PointsBadge points={points} />
                    </td>
                    <td className="px-3 py-2 text-right text-xs">{g.plus_minus || 0}</td>
                    <td className="px-3 py-2 text-right text-xs">{g.pim || 0}</td>
                    <td className="px-3 py-2 text-right text-xs">{g.shots || 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
