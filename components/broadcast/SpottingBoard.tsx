"use client";

import { useState } from "react";
import type { SpottingBoardData } from "@/types/api";

interface Props {
  data: SpottingBoardData | null;
  onPlayerClick?: (playerName: string) => void;
}

export default function SpottingBoard({ data, onPlayerClick }: Props) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showPronunciation, setShowPronunciation] = useState(false);
  const [fontSize, setFontSize] = useState<"compact" | "standard" | "large">("standard");
  const [activeTeam, setActiveTeam] = useState<"home" | "away">("home");

  if (!data) {
    return <p className="text-sm text-muted/50 text-center py-4">No spotting board data. Generate to populate.</p>;
  }

  const team = activeTeam === "home" ? data.home : data.away;
  const textSize = fontSize === "compact" ? "text-[10px]" : fontSize === "large" ? "text-sm" : "text-xs";

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Team tabs */}
        <div className="flex bg-navy/[0.04] rounded-lg p-0.5">
          <button
            onClick={() => setActiveTeam("home")}
            className={`px-3 py-1 rounded-md text-[10px] font-oswald font-bold uppercase tracking-wider transition-colors ${
              activeTeam === "home" ? "bg-white text-navy shadow-sm" : "text-muted/50"
            }`}
          >
            {data.home.team_name}
          </button>
          <button
            onClick={() => setActiveTeam("away")}
            className={`px-3 py-1 rounded-md text-[10px] font-oswald font-bold uppercase tracking-wider transition-colors ${
              activeTeam === "away" ? "bg-white text-navy shadow-sm" : "text-muted/50"
            }`}
          >
            {data.away.team_name}
          </button>
        </div>

        <div className="flex-1" />

        {/* Toggles */}
        <label className="flex items-center gap-1 text-[10px] text-muted cursor-pointer">
          <input type="checkbox" checked={showAdvanced} onChange={(e) => setShowAdvanced(e.target.checked)} className="rounded border-teal/20" />
          Advanced
        </label>
        <label className="flex items-center gap-1 text-[10px] text-muted cursor-pointer">
          <input type="checkbox" checked={showPronunciation} onChange={(e) => setShowPronunciation(e.target.checked)} className="rounded border-teal/20" />
          Pronunciation
        </label>

        {/* Font size */}
        <div className="flex bg-navy/[0.04] rounded p-0.5">
          {(["compact", "standard", "large"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFontSize(s)}
              className={`px-1.5 py-0.5 rounded text-[9px] font-oswald uppercase ${
                fontSize === s ? "bg-white text-navy shadow-sm" : "text-muted/40"
              }`}
            >
              {s[0].toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className={`w-full ${textSize}`}>
          <thead>
            <tr className="bg-navy/[0.04] text-muted uppercase tracking-wider font-oswald">
              <th className="text-left px-2 py-1.5">#</th>
              <th className="text-left px-2 py-1.5">Name</th>
              <th className="text-center px-1.5 py-1.5">Pos</th>
              <th className="text-center px-1.5 py-1.5">Hand</th>
              <th className="text-center px-1.5 py-1.5">GP</th>
              <th className="text-center px-1.5 py-1.5">G</th>
              <th className="text-center px-1.5 py-1.5">A</th>
              <th className="text-center px-1.5 py-1.5">P</th>
              <th className="text-left px-2 py-1.5">Key Stat</th>
              <th className="text-left px-2 py-1.5">Archetype</th>
              {showPronunciation && <th className="text-left px-2 py-1.5">Pronunciation</th>}
              {showAdvanced && (
                <>
                  <th className="text-center px-1.5 py-1.5">xG</th>
                  <th className="text-center px-1.5 py-1.5">CF%</th>
                  <th className="text-center px-1.5 py-1.5">OZ%</th>
                </>
              )}
              <th className="text-left px-2 py-1.5 min-w-[200px]">Broadcast Note</th>
            </tr>
          </thead>
          <tbody>
            {team.players.map((p, i) => (
              <tr
                key={i}
                className={`border-t border-teal/8 ${i % 2 === 0 ? "bg-white" : "bg-navy/[0.015]"} hover:bg-teal/[0.03] transition-colors`}
              >
                <td className="px-2 py-1 font-mono text-muted/60">{p.jersey}</td>
                <td className="px-2 py-1 font-medium text-navy whitespace-nowrap">
                  {onPlayerClick ? (
                    <button onClick={() => onPlayerClick(p.name)} className="hover:text-teal hover:underline transition-colors text-left">
                      {p.name}
                    </button>
                  ) : p.name}
                </td>
                <td className="text-center px-1.5 py-1 text-muted">{p.position}</td>
                <td className="text-center px-1.5 py-1">
                  {p.shoots ? (
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${p.shoots.toUpperCase() === "L" ? "bg-teal/10 text-teal" : "bg-orange/10 text-orange"}`}>
                      {p.shoots.toUpperCase()}
                    </span>
                  ) : "—"}
                </td>
                <td className="text-center px-1.5 py-1 font-mono">{p.gp}</td>
                <td className="text-center px-1.5 py-1 font-mono">{p.g}</td>
                <td className="text-center px-1.5 py-1 font-mono">{p.a}</td>
                <td className="text-center px-1.5 py-1 font-mono font-bold">{p.p}</td>
                <td className="px-2 py-1 text-teal">{p.key_stat}</td>
                <td className="px-2 py-1 text-muted/70 italic">{p.archetype}</td>
                {showPronunciation && <td className="px-2 py-1 text-muted/50">{p.pronunciation || "—"}</td>}
                {showAdvanced && (
                  <>
                    <td className="text-center px-1.5 py-1 font-mono">{p.xg != null ? p.xg.toFixed(1) : "—"}</td>
                    <td className="text-center px-1.5 py-1 font-mono">{p.cf_pct != null ? `${p.cf_pct.toFixed(1)}%` : "—"}</td>
                    <td className="text-center px-1.5 py-1 font-mono">{p.zone_starts_oz_pct != null ? `${p.zone_starts_oz_pct.toFixed(0)}%` : "—"}</td>
                  </>
                )}
                <td className="px-2 py-1 text-navy/80">{p.broadcast_note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {team.players.length === 0 && (
        <p className="text-xs text-muted/50 text-center py-3">No players in spotting board.</p>
      )}
    </div>
  );
}
