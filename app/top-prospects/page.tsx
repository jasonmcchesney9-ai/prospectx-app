"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import api from "@/lib/api";
import { BarChart3, ArrowLeft } from "lucide-react";

// ── PXR Tier Definitions ──
const PXR_TIERS = [
  { id: "1A", label: "ELITE", min: 90, max: 100, color: "#18B3A6" },
  { id: "1B", label: "HIGH IMPACT", min: 80, max: 89, color: "#18B3A6" },
  { id: "2A", label: "SOLID STARTER", min: 70, max: 79, color: "#0F2A3D" },
  { id: "2B", label: "DEPTH PLAYER", min: 60, max: 69, color: "#6B7280" },
  { id: "3A", label: "DEVELOPING", min: 50, max: 59, color: "#9CA3AF" },
  { id: "3B", label: "EARLY STAGE", min: 0, max: 49, color: "#D1D5DB" },
];

function getTierLabel(score: number | null): string {
  if (score == null) return "—";
  const tier = PXR_TIERS.find((t) => score >= t.min && score <= t.max);
  return tier ? `${tier.id} ${tier.label}` : "—";
}

interface DraftPlayer {
  player_id: string;
  first_name: string;
  last_name: string;
  position: string | null;
  current_team: string | null;
  current_league: string | null;
  birth_year: string | number | null;
  pxr_score: number | null;
  score_type?: string | null;
  pxr_tier?: string | null;
  confidence_tier?: string | null;
  cohort_percentile: number | null;
  league_percentile: number | null;
  gp?: number | null;
  position_group?: string | null;
}

interface FilterOptions {
  leagues: string[];
  birth_years: (string | number)[];
  positions: string[];
}

export default function TopProspectsPage() {
  const [prospects, setProspects] = useState<DraftPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({ leagues: [], birth_years: [], positions: [] });
  const [league, setLeague] = useState("");
  const [position, setPosition] = useState("");
  const [birthYear, setBirthYear] = useState("");

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (league) params.set("league", league);
    if (position) params.set("position_group", position);
    if (birthYear) params.set("birth_year", birthYear);
    api
      .get(`/pxr/draft-board?${params.toString()}`)
      .then((res) => {
        setProspects(res.data.players || []);
        setTotal(res.data.total || 0);
        if (res.data.filter_options) setFilterOptions(res.data.filter_options);
      })
      .catch(() => setProspects([]))
      .finally(() => setLoading(false));
  }, [league, position, birthYear]);

  return (
    <ProtectedRoute>
      <NavBar />
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Link href="/" className="flex items-center gap-1 text-sm text-muted hover:text-navy mb-3">
          <ArrowLeft size={14} /> Dashboard
        </Link>

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-2xl font-bold text-navy font-oswald uppercase tracking-wider">
              Top Prospects
            </h1>
            <p className="text-sm text-muted mt-0.5">
              {!loading
                ? `${total} prospect${total !== 1 ? "s" : ""} ranked by PXR score across all leagues.`
                : "Loading prospects..."}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <select
            value={league}
            onChange={(e) => setLeague(e.target.value)}
            className="text-xs border rounded-lg px-3 py-2 font-oswald uppercase tracking-wider"
            style={{ borderColor: "#E2EAF3", color: "#0F2A3D" }}
          >
            <option value="">All Leagues</option>
            {filterOptions.leagues.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
          <select
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            className="text-xs border rounded-lg px-3 py-2 font-oswald uppercase tracking-wider"
            style={{ borderColor: "#E2EAF3", color: "#0F2A3D" }}
          >
            <option value="">All Positions</option>
            {filterOptions.positions.map((pos) => (
              <option key={pos} value={pos}>{pos === "F" ? "Forwards" : pos === "D" ? "Defense" : pos === "G" ? "Goalies" : pos}</option>
            ))}
          </select>
          <select
            value={birthYear}
            onChange={(e) => setBirthYear(e.target.value)}
            className="text-xs border rounded-lg px-3 py-2 font-oswald uppercase tracking-wider"
            style={{ borderColor: "#E2EAF3", color: "#0F2A3D" }}
          >
            <option value="">All Birth Years</option>
            {filterOptions.birth_years.map((y) => (
              <option key={String(y)} value={String(y)}>{y}</option>
            ))}
          </select>
          {(league || position || birthYear) && (
            <button
              onClick={() => { setLeague(""); setPosition(""); setBirthYear(""); }}
              className="text-xs px-3 py-2 rounded-lg font-oswald uppercase tracking-wider"
              style={{ color: "#0D9488" }}
            >
              Reset
            </button>
          )}
        </div>

        {/* Table */}
        {loading ? (
          <div className="bg-white rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-border">
                  <tr>
                    {["#", "Player", "Pos", "Team / League", "Born", "PXR", "Tier", "League %", "Cohort %", "GP"].map((h) => (
                      <th key={h} className="px-3 py-2.5 text-left text-[10px] font-oswald uppercase tracking-wider text-navy/60">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      {Array.from({ length: 10 }).map((_, j) => (
                        <td key={j} className="px-3 py-3"><div className="h-4 bg-gray-200 rounded w-full" /></td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : prospects.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-border">
            <BarChart3 size={40} className="mx-auto mb-4" style={{ color: "rgba(13,148,136,.3)" }} />
            <h2 className="text-lg font-bold text-navy font-oswald uppercase tracking-wider mb-2">
              No PXR-scored prospects found
            </h2>
            <p className="text-sm text-muted max-w-md mx-auto">
              No players with PXR scores found. Scores are calculated nightly — check back after the next PXR recalculation.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-gray-50 border-b border-border">
                  <tr>
                    <th className="px-3 py-2.5 text-left text-[10px] font-oswald uppercase tracking-wider text-navy/60 w-12">#</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-oswald uppercase tracking-wider text-navy/60">Player</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-oswald uppercase tracking-wider text-navy/60">Pos</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-oswald uppercase tracking-wider text-navy/60">Team / League</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-oswald uppercase tracking-wider text-navy/60">Born</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-oswald uppercase tracking-wider text-navy/60">PXR</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-oswald uppercase tracking-wider text-navy/60">Tier</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-oswald uppercase tracking-wider text-navy/60">League %</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-oswald uppercase tracking-wider text-navy/60">Cohort %</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-oswald uppercase tracking-wider text-navy/60">GP</th>
                  </tr>
                </thead>
                <tbody>
                  {prospects.map((p, idx) => {
                    const isEstimated = p.score_type === "estimated" || p.confidence_tier === "estimated";
                    return (
                      <tr
                        key={p.player_id}
                        className={`hover:bg-teal/5 transition-colors ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/40"}`}
                        style={{
                          borderLeftWidth: "3px",
                          borderLeftColor: isEstimated ? "#F59E0B" : "#0D9488",
                          borderLeftStyle: "solid",
                        }}
                      >
                        <td className="px-3 py-2.5 text-xs text-muted font-oswald">{idx + 1}</td>
                        <td className="px-3 py-2.5">
                          <Link
                            href={`/players/${p.player_id}`}
                            className="text-sm font-semibold text-navy hover:text-teal transition-colors"
                          >
                            {p.first_name} {p.last_name}
                          </Link>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-muted">{p.position || "—"}</td>
                        <td className="px-3 py-2.5 text-xs text-muted">
                          {p.current_team || "—"}{p.current_league ? ` · ${p.current_league}` : ""}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-muted font-oswald">{p.birth_year || "—"}</td>
                        <td className="px-3 py-2.5">
                          <span
                            className="text-sm font-bold font-oswald"
                            style={{ color: isEstimated ? "#F59E0B" : "#0D9488" }}
                          >
                            {isEstimated ? "~" : ""}{p.pxr_score != null ? p.pxr_score.toFixed(1) : "—"}
                          </span>
                          {isEstimated && (
                            <span
                              className="ml-1 inline-flex items-center px-1 py-0.5 rounded text-[8px] font-oswald font-bold uppercase tracking-wider"
                              style={{ backgroundColor: "#FEF3C7", color: "#92400E" }}
                            >
                              Est.
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-muted font-oswald uppercase">{p.pxr_tier ? `${p.pxr_tier} ${(PXR_TIERS.find(t => t.id === p.pxr_tier)?.label) || ""}` : getTierLabel(p.pxr_score)}</td>
                        <td className="px-3 py-2.5 text-xs text-muted">
                          {p.league_percentile != null ? `Top ${Math.max(1, Math.round(100 - p.league_percentile))}%` : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-muted">
                          {p.cohort_percentile != null ? `Top ${Math.max(1, Math.round(100 - p.cohort_percentile))}%` : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-muted font-oswald">{p.gp != null ? p.gp : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </ProtectedRoute>
  );
}
