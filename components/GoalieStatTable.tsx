"use client";

import type { GoalieStats } from "@/types/api";

interface Props {
  stats: GoalieStats[];
}

function formatTOI(seconds: number): string {
  if (!seconds) return "-";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function GoalieStatTable({ stats }: Props) {
  if (!stats || stats.length === 0) {
    return (
      <p className="text-muted text-sm py-4 text-center">
        No goalie stats available.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-teal/20">
            <th className="text-left py-2 px-2 text-xs font-oswald uppercase tracking-wider text-muted">
              Season
            </th>
            <th className="text-center py-2 px-2 text-xs font-oswald uppercase tracking-wider text-muted">
              GP
            </th>
            <th className="text-center py-2 px-2 text-xs font-oswald uppercase tracking-wider text-muted">
              TOI/GP
            </th>
            <th className="text-center py-2 px-2 text-xs font-oswald uppercase tracking-wider text-muted">
              GA
            </th>
            <th className="text-center py-2 px-2 text-xs font-oswald uppercase tracking-wider text-muted">
              SA
            </th>
            <th className="text-center py-2 px-2 text-xs font-oswald uppercase tracking-wider text-muted">
              SV
            </th>
            <th className="text-center py-2 px-2 text-xs font-oswald uppercase tracking-wider text-teal font-bold">
              SV%
            </th>
            <th className="text-center py-2 px-2 text-xs font-oswald uppercase tracking-wider text-muted">
              GAA
            </th>
            {stats.some((s) => s.extended_stats && typeof s.extended_stats === "object" && "xg_conceded" in (s.extended_stats as Record<string, unknown>)) && (
              <th className="text-center py-2 px-2 text-xs font-oswald uppercase tracking-wider text-muted">
                xGA
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {stats.map((s) => {
            const ext = (s.extended_stats || {}) as Record<string, unknown>;
            return (
              <tr key={s.id} className="border-b border-teal/10 hover:bg-navy/[0.02]">
                <td className="py-2 px-2 text-navy font-medium">
                  {s.season || "-"}
                </td>
                <td className="py-2 px-2 text-center text-navy">{s.gp || "-"}</td>
                <td className="py-2 px-2 text-center text-muted">
                  {s.toi_seconds ? formatTOI(s.toi_seconds) : "-"}
                </td>
                <td className="py-2 px-2 text-center text-navy">
                  {s.ga != null ? (typeof s.ga === "number" ? s.ga.toFixed(2) : s.ga) : "-"}
                </td>
                <td className="py-2 px-2 text-center text-navy">
                  {s.sa != null ? (typeof s.sa === "number" ? s.sa.toFixed(1) : s.sa) : "-"}
                </td>
                <td className="py-2 px-2 text-center text-navy">
                  {s.sv != null ? (typeof s.sv === "number" ? s.sv.toFixed(1) : s.sv) : "-"}
                </td>
                <td className="py-2 px-2 text-center font-bold text-teal">
                  {s.sv_pct || "-"}
                </td>
                <td className="py-2 px-2 text-center text-navy">
                  {s.gaa != null ? s.gaa.toFixed(2) : (s.ga != null && s.gp ? (s.ga as number).toFixed(2) : "-")}
                </td>
                {stats.some((st) => st.extended_stats && typeof st.extended_stats === "object" && "xg_conceded" in (st.extended_stats as Record<string, unknown>)) && (
                  <td className="py-2 px-2 text-center text-muted">
                    {ext.xg_conceded != null
                      ? typeof ext.xg_conceded === "number"
                        ? (ext.xg_conceded as number).toFixed(2)
                        : String(ext.xg_conceded)
                      : "-"}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
