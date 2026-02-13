"use client";

import { useState } from "react";
import type { LineCombination } from "@/types/api";
import { LINE_TYPE_LABELS } from "@/types/api";

interface Props {
  lines: LineCombination[];
  availableTypes?: string[];
}

function formatTOI(seconds: number): string {
  if (!seconds) return "-";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatVal(val: number | string | null | undefined): string {
  if (val === null || val === undefined || val === "-") return "-";
  if (typeof val === "number") {
    if (Number.isInteger(val)) return String(val);
    return val.toFixed(1);
  }
  return String(val);
}

export default function LineCombinations({ lines, availableTypes }: Props) {
  const types = availableTypes || [...new Set(lines.map((l) => l.line_type))];
  const [activeType, setActiveType] = useState(types[0] || "full");

  const filtered = lines
    .filter((l) => l.line_type === activeType)
    .sort((a, b) => b.toi_seconds - a.toi_seconds);

  if (lines.length === 0) {
    return (
      <p className="text-muted text-sm py-4 text-center">
        No line combination data available.
      </p>
    );
  }

  return (
    <div>
      {/* Type Tabs */}
      <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
        {types.map((t) => {
          const count = lines.filter((l) => l.line_type === t).length;
          return (
            <button
              key={t}
              onClick={() => setActiveType(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-oswald font-semibold uppercase tracking-wider whitespace-nowrap transition-colors ${
                activeType === t
                  ? "bg-navy text-white"
                  : "bg-navy/5 text-navy hover:bg-navy/10"
              }`}
            >
              {LINE_TYPE_LABELS[t] || t} ({count})
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 px-2 text-xs font-oswald uppercase tracking-wider text-muted">
                Line
              </th>
              <th className="text-center py-2 px-1 text-xs font-oswald uppercase tracking-wider text-muted">
                TOI
              </th>
              <th className="text-center py-2 px-1 text-xs font-oswald uppercase tracking-wider text-muted">
                Shifts
              </th>
              <th className="text-center py-2 px-1 text-xs font-oswald uppercase tracking-wider text-teal">
                GF
              </th>
              <th className="text-center py-2 px-1 text-xs font-oswald uppercase tracking-wider text-orange">
                GA
              </th>
              <th className="text-center py-2 px-1 text-xs font-oswald uppercase tracking-wider text-muted">
                +/-
              </th>
              <th className="text-center py-2 px-1 text-xs font-oswald uppercase tracking-wider text-muted">
                SF
              </th>
              <th className="text-center py-2 px-1 text-xs font-oswald uppercase tracking-wider text-muted">
                SA
              </th>
              <th className="text-center py-2 px-1 text-xs font-oswald uppercase tracking-wider text-muted">
                CF%
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 50).map((line) => {
              const ext = (line.extended_stats || {}) as Record<string, unknown>;
              const corsiPct = ext.corsi_for && ext.corsi_against
                ? (
                    ((ext.corsi_for as number) /
                      ((ext.corsi_for as number) + (ext.corsi_against as number))) *
                    100
                  ).toFixed(1)
                : ext.corsi
                ? String(ext.corsi)
                : "-";

              // Parse player refs for nicer display
              const players = line.player_refs || [];
              const playerDisplay =
                players.length > 0
                  ? players.map((p) => `#${p.jersey} ${p.name}`).join(", ")
                  : line.player_names;

              return (
                <tr
                  key={line.id}
                  className="border-b border-border/30 hover:bg-navy/[0.02]"
                >
                  <td className="py-2 px-2 text-xs text-navy max-w-xs truncate" title={playerDisplay}>
                    {playerDisplay}
                  </td>
                  <td className="py-2 px-1 text-center text-xs text-navy font-medium">
                    {formatTOI(line.toi_seconds)}
                  </td>
                  <td className="py-2 px-1 text-center text-xs text-muted">
                    {line.shifts || "-"}
                  </td>
                  <td className="py-2 px-1 text-center text-xs text-teal font-semibold">
                    {formatVal(line.goals_for)}
                  </td>
                  <td className="py-2 px-1 text-center text-xs text-orange">
                    {formatVal(line.goals_against)}
                  </td>
                  <td className="py-2 px-1 text-center text-xs">
                    <span
                      className={
                        line.plus_minus && parseFloat(line.plus_minus) > 0
                          ? "text-green-600"
                          : line.plus_minus && parseFloat(line.plus_minus) < 0
                          ? "text-red-500"
                          : "text-muted"
                      }
                    >
                      {line.plus_minus || "-"}
                    </span>
                  </td>
                  <td className="py-2 px-1 text-center text-xs text-muted">
                    {formatVal(ext.shots_for as number | undefined) || formatVal(ext.sog_for as number | undefined) || "-"}
                  </td>
                  <td className="py-2 px-1 text-center text-xs text-muted">
                    {formatVal(ext.shots_against as number | undefined) || formatVal(ext.sog_against as number | undefined) || "-"}
                  </td>
                  <td className="py-2 px-1 text-center text-xs font-medium text-navy">
                    {corsiPct !== "-" ? `${corsiPct}%` : "-"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length > 50 && (
          <p className="text-xs text-muted text-center py-2">
            Showing top 50 of {filtered.length} combinations (sorted by TOI)
          </p>
        )}
      </div>
    </div>
  );
}
