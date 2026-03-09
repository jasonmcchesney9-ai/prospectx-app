"use client";

import { useState, useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import api from "@/lib/api";
import { getUser } from "@/lib/auth";
import ProtectedRoute from "@/components/ProtectedRoute";

const LEAGUE_OPTIONS: { code: string; label: string; full: string }[] = [
  { code: "ahl", label: "AHL", full: "American Hockey League" },
  { code: "echl", label: "ECHL", full: "ECHL" },
  { code: "sphl", label: "SPHL", full: "Southern Professional Hockey League" },
  { code: "pwhl", label: "PWHL", full: "Professional Women's Hockey League" },
  { code: "ohl", label: "OHL", full: "Ontario Hockey League" },
  { code: "whl", label: "WHL", full: "Western Hockey League" },
  { code: "lhjmq", label: "QMJHL", full: "Quebec Major Junior Hockey League" },
  { code: "bchl", label: "BCHL", full: "British Columbia Hockey League" },
  { code: "ajhl", label: "AJHL", full: "Alberta Junior Hockey League" },
  { code: "sjhl", label: "SJHL", full: "Saskatchewan Junior Hockey League" },
  { code: "mjhl", label: "MJHL", full: "Manitoba Junior Hockey League" },
  { code: "ushl", label: "USHL", full: "United States Hockey League" },
  { code: "ojhl", label: "OJHL", full: "Ontario Junior Hockey League" },
  { code: "cchl", label: "CCHL", full: "Central Canada Hockey League" },
  { code: "nojhl", label: "NOJHL", full: "Northern Ontario Junior Hockey League" },
  { code: "mhl", label: "MHL", full: "Maritime Hockey League" },
  { code: "gojhl", label: "GOJHL", full: "Greater Ontario Junior Hockey League" },
  { code: "kijhl", label: "KIJHL", full: "Kootenay International Junior Hockey League" },
  { code: "pjhl", label: "PJHL", full: "Provincial Junior Hockey League" },
  { code: "vijhl", label: "VIJHL", full: "Vancouver Island Junior Hockey League" },
];

interface MonteCarloResult {
  team_name: string;
  team_id: number;
  current_points: number;
  current_gp: number;
  projected_points_p50: number;
  projected_points_p10: number;
  projected_points_p90: number;
  playoff_pct: number;
  avg_final_rank: number;
  best_rank: number;
  worst_rank: number;
  simulations: number;
  confidence: string;
  remaining_games: number;
  total_games: number;
  calculated_at: string;
}

interface MonteCarloResponse {
  league: string;
  results: MonteCarloResult[];
  calculated_at: string | null;
}

function cleanTeamName(name: string): string {
  return name.replace(/^[a-z]{1,3}\s*-\s*/i, "").trim();
}

function confidenceBadge(confidence: string) {
  switch (confidence) {
    case "high":
    case "final":
      return { bg: "rgba(13,148,136,.15)", color: "#0D9488", label: confidence === "final" ? "FINAL" : "HIGH" };
    case "medium":
      return { bg: "rgba(217,119,6,.15)", color: "#D97706", label: "MEDIUM" };
    case "low":
      return { bg: "rgba(107,114,128,.15)", color: "#6B7280", label: "LOW" };
    default:
      return { bg: "rgba(107,114,128,.15)", color: "#6B7280", label: confidence.toUpperCase() };
  }
}

function playoffBarColor(pct: number): string {
  if (pct > 70) return "#0D9488";
  if (pct >= 40) return "#D97706";
  return "#DC2626";
}

export default function SeasonProjectionPage() {
  const [league, setLeague] = useState("gojhl");
  const [data, setData] = useState<MonteCarloResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortCol, setSortCol] = useState<string>("playoff_pct");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const user = getUser();

  useEffect(() => {
    loadData();
  }, [league]);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<MonteCarloResponse>(`/league-hub/${league}/monte-carlo`);
      setData(res.data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load projection data";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  function handleSort(col: string) {
    if (sortCol === col) {
      setSortDir(sortDir === "desc" ? "asc" : "desc");
    } else {
      setSortCol(col);
      setSortDir("desc");
    }
  }

  const sortedResults = (data?.results || []).slice().sort((a, b) => {
    const aVal = (a as unknown as Record<string, number>)[sortCol] ?? 0;
    const bVal = (b as unknown as Record<string, number>)[sortCol] ?? 0;
    return sortDir === "desc" ? bVal - aVal : aVal - bVal;
  });

  // Determine if early season
  const avgGP = sortedResults.length > 0
    ? sortedResults.reduce((sum, r) => sum + r.current_gp, 0) / sortedResults.length
    : 0;
  const isEarlySeason = avgGP > 0 && avgGP < 15;

  const leagueInfo = LEAGUE_OPTIONS.find((l) => l.code === league) || LEAGUE_OPTIONS[0];

  return (
    <ProtectedRoute>
      <div style={{ minHeight: "100vh", background: "#F0F4F8" }}>
        {/* ── Page Header ── */}
        <div style={{ background: "linear-gradient(135deg, #091C30 0%, #0F2942 50%, #1A3A5C 100%)", padding: "32px 32px 28px" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <span style={{ fontFamily: "'Oswald', sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: ".15em", textTransform: "uppercase", color: "#0D9488" }}>
                  LEAGUE INTELLIGENCE
                </span>
                <h1 style={{ fontFamily: "'Oswald', sans-serif", fontSize: 28, fontWeight: 700, color: "#FFFFFF", margin: "4px 0 6px", letterSpacing: ".02em" }}>
                  SEASON PROJECTION
                </h1>
                <p style={{ fontFamily: "'Source Serif 4', serif", fontSize: 14, color: "rgba(255,255,255,.55)", margin: 0 }}>
                  Monte Carlo simulation — 10,000 season outcomes per team
                </p>
              </div>

              {/* League Selector */}
              <select
                value={league}
                onChange={(e) => setLeague(e.target.value)}
                style={{
                  background: "rgba(255,255,255,.08)",
                  border: "1px solid rgba(255,255,255,.15)",
                  borderRadius: 8,
                  padding: "8px 32px 8px 12px",
                  color: "#FFFFFF",
                  fontFamily: "'Oswald', sans-serif",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                  appearance: "none",
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "right 10px center",
                }}
              >
                {LEAGUE_OPTIONS.map((opt) => (
                  <option key={opt.code} value={opt.code} style={{ background: "#0F2942", color: "#FFF" }}>
                    {opt.label} — {opt.full}
                  </option>
                ))}
              </select>
            </div>

            {/* Last updated timestamp */}
            {data?.calculated_at && (
              <div style={{ marginTop: 12, fontFamily: "'JetBrains Mono', 'DM Mono', monospace", fontSize: 11, color: "rgba(255,255,255,.4)" }}>
                Last updated: {new Date(data.calculated_at).toLocaleString()}
              </div>
            )}
          </div>
        </div>

        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 32px 48px" }}>
          {/* Early season callout */}
          {isEarlySeason && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", background: "rgba(217,119,6,.08)", border: "1px solid rgba(217,119,6,.25)", borderRadius: 10, marginBottom: 20 }}>
              <AlertTriangle size={16} style={{ color: "#D97706", flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: "#92400E", fontFamily: "'Source Serif 4', serif" }}>
                Early season: projections will stabilize after 15+ games played
              </span>
            </div>
          )}

          {/* Loading state */}
          {loading && (
            <div style={{ textAlign: "center", padding: "60px 0", color: "#6B7280" }}>
              <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 14, fontWeight: 600, letterSpacing: ".05em", textTransform: "uppercase" }}>
                Loading projections...
              </div>
            </div>
          )}

          {/* Error state */}
          {error && !loading && (
            <div style={{ textAlign: "center", padding: "60px 0", color: "#DC2626" }}>
              <div style={{ fontSize: 14 }}>{error}</div>
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && sortedResults.length === 0 && (
            <div style={{ textAlign: "center", padding: "60px 0", color: "#6B7280" }}>
              <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 14, fontWeight: 600, letterSpacing: ".05em", textTransform: "uppercase", marginBottom: 8 }}>
                No projection data available
              </div>
              <div style={{ fontSize: 13, fontFamily: "'Source Serif 4', serif" }}>
                Run a Monte Carlo simulation for {leagueInfo.label} from the admin panel first.
              </div>
            </div>
          )}

          {/* Projection table */}
          {!loading && !error && sortedResults.length > 0 && (
            <div style={{ background: "#FFFFFF", borderRadius: 12, border: "1px solid #DDE6EF", overflow: "hidden" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#0F2942" }}>
                      {[
                        { key: "rank", label: "#", sortable: false, width: 40 },
                        { key: "team_name", label: "TEAM", sortable: false, width: undefined },
                        { key: "current_gp", label: "GP", sortable: true, width: 55 },
                        { key: "current_points", label: "PTS", sortable: true, width: 55 },
                        { key: "projected_points_p50", label: "PROJ PTS", sortable: true, width: 110 },
                        { key: "playoff_pct", label: "PLAYOFF %", sortable: true, width: 180 },
                        { key: "avg_final_rank", label: "AVG RANK", sortable: true, width: 80 },
                        { key: "confidence", label: "CONFIDENCE", sortable: false, width: 95 },
                      ].map(({ key, label, sortable, width }) => (
                        <th
                          key={key}
                          onClick={sortable ? () => handleSort(key) : undefined}
                          style={{
                            padding: "10px 12px",
                            textAlign: key === "team_name" ? "left" : "center",
                            fontFamily: "'Oswald', sans-serif",
                            fontSize: 11,
                            fontWeight: 600,
                            letterSpacing: ".08em",
                            textTransform: "uppercase",
                            color: "#FFFFFF",
                            cursor: sortable ? "pointer" : "default",
                            userSelect: "none",
                            width: width || undefined,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {label}
                          {sortable && sortCol === key && (
                            <span style={{ marginLeft: 4, fontSize: 10 }}>
                              {sortDir === "desc" ? "\u25BC" : "\u25B2"}
                            </span>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedResults.map((r, idx) => {
                      const badge = confidenceBadge(r.confidence);
                      const barColor = playoffBarColor(r.playoff_pct);
                      const rowBg = idx % 2 === 0 ? "#FFFFFF" : "#F5F5F5";

                      return (
                        <tr key={r.team_id} style={{ background: rowBg }}>
                          {/* Rank */}
                          <td style={{ padding: "10px 12px", textAlign: "center", fontFamily: "'Oswald', sans-serif", fontSize: 13, fontWeight: 600, color: "#0F2942" }}>
                            {idx + 1}
                          </td>

                          {/* Team Name */}
                          <td style={{ padding: "10px 12px", fontFamily: "'Oswald', sans-serif", fontSize: 13, fontWeight: 600, color: "#0F2942" }}>
                            {cleanTeamName(r.team_name)}
                          </td>

                          {/* GP */}
                          <td style={{ padding: "10px 12px", textAlign: "center", fontFamily: "'JetBrains Mono', 'DM Mono', monospace", fontSize: 12, color: "#374151" }}>
                            {r.current_gp}
                          </td>

                          {/* PTS */}
                          <td style={{ padding: "10px 12px", textAlign: "center", fontFamily: "'Oswald', sans-serif", fontSize: 13, fontWeight: 700, color: "#0D9488" }}>
                            {r.current_points}
                          </td>

                          {/* PROJ PTS with range */}
                          <td style={{ padding: "10px 12px", textAlign: "center" }}>
                            <span style={{ fontFamily: "'Oswald', sans-serif", fontSize: 13, fontWeight: 700, color: "#0F2942" }}>
                              {r.projected_points_p50}
                            </span>
                            {r.projected_points_p10 !== r.projected_points_p90 && (
                              <span style={{ fontFamily: "'JetBrains Mono', 'DM Mono', monospace", fontSize: 10, color: "#9CA3AF", marginLeft: 6 }}>
                                ({r.projected_points_p10}-{r.projected_points_p90})
                              </span>
                            )}
                          </td>

                          {/* PLAYOFF % with bar */}
                          <td style={{ padding: "10px 12px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <div style={{ flex: 1, height: 18, background: "#F3F4F6", borderRadius: 4, position: "relative", overflow: "hidden" }}>
                                <div
                                  style={{
                                    position: "absolute",
                                    left: 0,
                                    top: 0,
                                    bottom: 0,
                                    width: `${r.playoff_pct}%`,
                                    background: barColor,
                                    borderRadius: 4,
                                    transition: "width 0.3s ease",
                                  }}
                                />
                              </div>
                              <span style={{ fontFamily: "'Oswald', sans-serif", fontSize: 13, fontWeight: 700, color: barColor, minWidth: 48, textAlign: "right" }}>
                                {r.playoff_pct}%
                              </span>
                            </div>
                          </td>

                          {/* AVG RANK */}
                          <td style={{ padding: "10px 12px", textAlign: "center", fontFamily: "'JetBrains Mono', 'DM Mono', monospace", fontSize: 12, color: "#374151" }}>
                            {r.avg_final_rank}
                          </td>

                          {/* CONFIDENCE */}
                          <td style={{ padding: "10px 12px", textAlign: "center" }}>
                            <span
                              title={
                                badge.label === "HIGH" || badge.label === "FINAL"
                                  ? "Season 70%+ complete with strong data"
                                  : badge.label === "MEDIUM"
                                  ? "Season in progress, projections moderately reliable"
                                  : "Early season or limited data, projections may shift significantly"
                              }
                              style={{
                                display: "inline-block",
                                padding: "2px 8px",
                                borderRadius: 4,
                                fontFamily: "'Oswald', sans-serif",
                                fontSize: 10,
                                fontWeight: 600,
                                letterSpacing: ".08em",
                                background: badge.bg,
                                color: badge.color,
                                cursor: "help",
                              }}
                            >
                              {badge.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Footer */}
              <div style={{ padding: "12px 16px", borderTop: "1px solid #DDE6EF", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontFamily: "'JetBrains Mono', 'DM Mono', monospace", fontSize: 11, color: "#9CA3AF" }}>
                  {sortedResults[0]?.simulations?.toLocaleString() || "10,000"} simulations per team
                </span>
                <span style={{ fontFamily: "'JetBrains Mono', 'DM Mono', monospace", fontSize: 11, color: "#9CA3AF" }}>
                  {sortedResults[0]?.remaining_games || 0} games remaining of {sortedResults[0]?.total_games || 0}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
