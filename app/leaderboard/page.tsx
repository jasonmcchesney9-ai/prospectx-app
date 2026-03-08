"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Trophy, ArrowLeft } from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import api from "@/lib/api";
import { getUser } from "@/lib/auth";
import { useBenchTalk } from "@/components/BenchTalkProvider";

// ── PXR Tier Definitions (from PXR Engine Spec v1.0, Section 6) ──
const PXR_TIERS = [
  { id: "1A", label: "ELITE",         min: 90, max: 100, color: "#18B3A6" },
  { id: "1B", label: "HIGH IMPACT",   min: 80, max: 89,  color: "#18B3A6" },
  { id: "2A", label: "SOLID STARTER", min: 70, max: 79,  color: "#0F2A3D" },
  { id: "2B", label: "DEPTH PLAYER",  min: 60, max: 69,  color: "#6B7280" },
  { id: "3A", label: "DEVELOPING",    min: 50, max: 59,  color: "#9CA3AF" },
  { id: "3B", label: "EARLY STAGE",   min: 0,  max: 49,  color: "#D1D5DB" },
];

function getTier(score: number | null) {
  if (score == null) return null;
  return PXR_TIERS.find((t) => score >= t.min && score <= t.max) || PXR_TIERS[PXR_TIERS.length - 1];
}

function TierBadge({ score, scoreType }: { score: number | null; scoreType?: string | null }) {
  const isEstimated = scoreType === 'estimated';
  const tier = getTier(score);
  if (!tier) return <span className="text-xs text-muted">—</span>;
  if (isEstimated) {
    return (
      <span
        className="inline-block px-1.5 py-0.5 rounded text-[10px] font-oswald font-bold uppercase tracking-wider"
        style={{ backgroundColor: "#F59E0B", color: "#422006" }}
        title="Estimated PXR — calculated from game stats. Full PXR requires advanced microstat data."
      >
        PXR~
      </span>
    );
  }
  return (
    <span
      className="inline-block px-1.5 py-0.5 rounded text-[10px] font-oswald font-bold uppercase tracking-wider text-white"
      style={{ backgroundColor: tier.color }}
    >
      {tier.id}
    </span>
  );
}

function ConfidenceBadge({ tier, gp }: { tier?: string | null; gp?: number | null }) {
  if (!tier) return null;
  if (tier === "high") {
    return (
      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-oswald font-bold uppercase tracking-wider bg-green-100 text-green-700">
        High
      </span>
    );
  }
  if (tier === "moderate") {
    return (
      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-oswald font-bold uppercase tracking-wider bg-amber-100 text-amber-700">
        Moderate
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-oswald font-bold uppercase tracking-wider bg-gray-100 text-gray-500">
      Small Sample{gp != null && gp < 15 ? ` (${gp} GP)` : ""}
    </span>
  );
}

// ── Types ──
interface LeaderboardPlayer {
  player_id: string;
  first_name: string;
  last_name: string;
  current_team: string | null;
  current_league: string | null;
  position: string | null;
  birth_year: string | null;
  position_group: string;
  pxr_score: number;
  league_percentile: number | null;
  cohort_percentile: number | null;
  age_modifier: number | null;
  p1_offense: number | null;
  p2_defense: number | null;
  p3_possession: number | null;
  p4_physical: number | null;
  data_completeness: number | null;
  season: string;
  ppg?: number;
  confidence_tier?: string | null;
  gp?: number | null;
  toi_minutes?: number | null;
  score_type?: string | null;
  pxi_intelligence?: number | null;
}

interface FilterOptions {
  leagues: string[];
  birth_years: (string | number)[];
  seasons: string[];
  positions: string[];
}

const TABS = ["By League", "By Cohort", "Undervalued", "Top Movers"] as const;
type Tab = (typeof TABS)[number];

export default function LeaderboardPage() {
  const router = useRouter();
  const currentUser = getUser();
  const { setActivePxiContext } = useBenchTalk();

  useEffect(() => {
    const u = getUser();
    setActivePxiContext({
      user: {
        id: u?.id || "",
        name: `${u?.first_name || ""} ${u?.last_name || ""}`.trim() || "User",
        role: (u?.hockey_role?.toUpperCase() || "SCOUT") as "COACH" | "PARENT" | "SCOUT" | "GM" | "AGENT" | "BROADCASTER" | "ANALYST",
        orgId: u?.org_id || "",
        orgName: "ProspectX",
      },
      page: { id: "LEADERBOARD", route: "/leaderboard" },
    });
    return () => { setActivePxiContext(null); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [allPlayers, setAllPlayers] = useState<LeaderboardPlayer[]>([]);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({ leagues: [], birth_years: [], seasons: [], positions: [] });
  const [loading, setLoading] = useState(true);
  const [ppgFallbackMode, setPpgFallbackMode] = useState(false);

  const [activeTab, setActiveTab] = useState<Tab>("By League");

  // View 1 filters
  const [selectedLeague, setSelectedLeague] = useState("");
  const [selectedPosition, setSelectedPosition] = useState("S");

  // View 2 filter
  const [selectedBirthYear, setSelectedBirthYear] = useState("");

  // Fetch all data once (no server-side filters — we filter client-side per tab)
  useEffect(() => {
    setLoading(true);
    api
      .get("/pxr/draft-board?season=2025-26")
      .then(async (res) => {
        const players: LeaderboardPlayer[] = res.data.players || [];
        if (res.data.filter_options) setFilterOptions(res.data.filter_options);
        // Default league/birthYear to first available
        if (res.data.filter_options?.leagues?.length > 0) {
          setSelectedLeague(res.data.filter_options.leagues[0]);
        }
        if (res.data.filter_options?.birth_years?.length > 0) {
          setSelectedBirthYear(String(res.data.filter_options.birth_years[0]));
        }

        // Check if ALL pxr_scores are NULL or 0 — PPG fallback
        const hasPxr = players.some((p) => p.pxr_score != null && p.pxr_score > 0);
        if (!hasPxr) {
          // Fetch scoring leaders as fallback
          try {
            const fallback = await api.get("/analytics/scoring-leaders?limit=25&min_gp=5");
            const ppgPlayers: LeaderboardPlayer[] = (fallback.data || []).map((r: { id: string; first_name: string; last_name: string; current_team: string | null; position: string | null; ppg: number; gp: number; g: number; a: number; p: number; season: string }) => ({
              player_id: r.id,
              first_name: r.first_name,
              last_name: r.last_name,
              current_team: r.current_team,
              current_league: null,
              position: r.position,
              birth_year: null,
              position_group: r.position === "G" ? "G" : (r.position === "LD" || r.position === "RD" || r.position === "D") ? "D" : "F",
              pxr_score: 0,
              league_percentile: null,
              cohort_percentile: null,
              age_modifier: null,
              p1_offense: null,
              p2_defense: null,
              p3_possession: null,
              p4_physical: null,
              data_completeness: null,
              season: r.season || "2025-26",
              ppg: r.ppg ?? (r.gp > 0 ? r.p / r.gp : 0),
            }));
            setAllPlayers(ppgPlayers);
            setPpgFallbackMode(true);
          } catch {
            setAllPlayers([]);
          }
        } else {
          setAllPlayers(players);
          setPpgFallbackMode(false);
        }
      })
      .catch(() => {
        setAllPlayers([]);
      })
      .finally(() => setLoading(false));
  }, []);

  // ── View 1: By League — Top 25 per position group in selected league ──
  const byLeaguePlayers = useMemo(() => {
    if (ppgFallbackMode) {
      let filtered = [...allPlayers];
      if (selectedPosition) {
        filtered = filtered.filter((p) => selectedPosition === "S" ? p.position_group !== "G" : p.position_group === selectedPosition);
      }
      return filtered
        .sort((a, b) => (b.ppg ?? 0) - (a.ppg ?? 0))
        .slice(0, 25);
    }
    if (!selectedLeague) return [];
    const leaguePlayers = allPlayers.filter((p) => p.current_league === selectedLeague);
    if (selectedPosition) {
      // Single position or Skaters selected — top 25 in that group
      return leaguePlayers
        .filter((p) => selectedPosition === "S" ? p.position_group !== "G" : p.position_group === selectedPosition)
        .sort((a, b) => (b.pxr_score ?? 0) - (a.pxr_score ?? 0))
        .slice(0, 25);
    }
    // No position filter: top 25 F + top 25 D + top 25 G, then merged and sorted
    const result: LeaderboardPlayer[] = [];
    for (const pos of ["F", "D", "G"]) {
      const posPlayers = leaguePlayers
        .filter((p) => p.position_group === pos)
        .sort((a, b) => (b.pxr_score ?? 0) - (a.pxr_score ?? 0))
        .slice(0, 25);
      result.push(...posPlayers);
    }
    return result.sort((a, b) => (b.pxr_score ?? 0) - (a.pxr_score ?? 0));
  }, [allPlayers, selectedLeague, selectedPosition, ppgFallbackMode]);

  // ── View 2: By Cohort — Top 25 per position group in selected birth year ──
  const byCohortPlayers = useMemo(() => {
    if (!selectedBirthYear) return [];
    const cohort = allPlayers.filter((p) => String(p.birth_year) === selectedBirthYear);
    // Top 25 F + top 25 D + top 25 G within this birth year, ranked by cohort_percentile
    const result: LeaderboardPlayer[] = [];
    for (const pos of ["F", "D", "G"]) {
      const posPlayers = cohort
        .filter((p) => p.position_group === pos)
        .sort((a, b) => (b.cohort_percentile ?? 0) - (a.cohort_percentile ?? 0))
        .slice(0, 25);
      result.push(...posPlayers);
    }
    return result.sort((a, b) => (b.cohort_percentile ?? 0) - (a.cohort_percentile ?? 0));
  }, [allPlayers, selectedBirthYear]);

  // ── View 3: Undervalued — cohort% >= 60 AND league% <= 45 ──
  const undervaluedPlayers = useMemo(() => {
    return allPlayers
      .filter(
        (p) =>
          p.cohort_percentile != null &&
          p.league_percentile != null &&
          p.cohort_percentile >= 60 &&
          p.league_percentile <= 45
      )
      .map((p) => ({
        ...p,
        gap: (p.cohort_percentile ?? 0) - (p.league_percentile ?? 0),
      }))
      .sort((a, b) => b.gap - a.gap);
  }, [allPlayers]);

  // ── View 4: Top Movers — max 5 per league, sorted by age_modifier desc ──
  const topMoversPlayers = useMemo(() => {
    const eligible = allPlayers
      .filter((p) => p.age_modifier != null && p.age_modifier > 0)
      .sort((a, b) => (b.age_modifier ?? 0) - (a.age_modifier ?? 0));
    // Cap at 5 per league to prevent one league dominating
    const perLeagueCount: Record<string, number> = {};
    const capped: LeaderboardPlayer[] = [];
    for (const p of eligible) {
      const league = p.current_league || "Unknown";
      perLeagueCount[league] = (perLeagueCount[league] || 0) + 1;
      if (perLeagueCount[league] <= 5) {
        capped.push(p);
      }
    }
    return capped;
  }, [allPlayers]);

  const handleRowClick = (playerId: string) => {
    router.push(`/players/${playerId}`);
  };

  return (
    <ProtectedRoute>
      <NavBar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/" className="flex items-center gap-1 text-sm text-muted hover:text-navy mb-3">
          <ArrowLeft size={14} /> Dashboard
        </Link>
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <Trophy size={28} className="text-teal" />
            <h1 className="text-2xl font-bold text-navy font-oswald uppercase tracking-wider">
              PXR Leaderboard
            </h1>
          </div>
          <p className="text-sm text-muted ml-[40px]">
            Players are ranked using the ProspectX Rating (PXR) — a proprietary scoring engine built on 57 advanced metrics across offense, defense, possession, and physicality.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 rounded-lg text-sm font-oswald uppercase tracking-wider transition-colors ${
                activeTab === tab
                  ? "bg-navy text-white"
                  : "bg-navy/5 text-navy hover:bg-navy/10"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* PPG Fallback Banner */}
        {ppgFallbackMode && !loading && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4">
            <p className="text-sm text-amber-800">
              PXR scores are being calculated. Showing PPG leaders in the meantime.
            </p>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center min-h-[30vh]">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-navy border-t-teal" />
          </div>
        ) : (
          <>
            {/* ═══════ VIEW 1: By League ═══════ */}
            {activeTab === "By League" && (
              <div>
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <select
                    value={selectedLeague}
                    onChange={(e) => setSelectedLeague(e.target.value)}
                    className="px-3 py-2 border border-border rounded-lg text-sm bg-white text-navy"
                  >
                    {filterOptions.leagues.map((l) => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                  <select
                    value={selectedPosition}
                    onChange={(e) => setSelectedPosition(e.target.value)}
                    className="px-3 py-2 border border-border rounded-lg text-sm bg-white text-navy"
                  >
                    <option value="S">Skaters</option>
                    <option value="">All Positions</option>
                    <option value="F">F</option>
                    <option value="D">D</option>
                    <option value="G">G</option>
                  </select>
                </div>

                <div className="bg-white rounded-xl border border-border overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-border">
                        <tr>
                          <th className="px-3 py-2.5 text-left text-[10px] font-oswald uppercase tracking-wider text-navy/60 w-12">#</th>
                          <th className="px-3 py-2.5 text-left text-[10px] font-oswald uppercase tracking-wider text-navy/60">Player</th>
                          <th className="px-3 py-2.5 text-left text-[10px] font-oswald uppercase tracking-wider text-navy/60">Team</th>
                          <th className="px-3 py-2.5 text-left text-[10px] font-oswald uppercase tracking-wider text-navy/60">{ppgFallbackMode ? "PPG" : "PXR Score"}</th>
                          {!ppgFallbackMode && <th className="px-3 py-2.5 text-left text-[10px] font-oswald uppercase tracking-wider text-navy/60" title="AI-generated score from PXI assessment. Requires a generated report.">PXI</th>}
                          <th className="px-3 py-2.5 text-left text-[10px] font-oswald uppercase tracking-wider text-navy/60 cursor-help" title={ppgFallbackMode ? undefined : "League Percentile — ranks this player among all same-position players in their league this season"}>{ppgFallbackMode ? "PXR Status" : "League %"}</th>
                          {!ppgFallbackMode && <th className="px-3 py-2.5 text-left text-[10px] font-oswald uppercase tracking-wider text-navy/60 cursor-help" title="Cohort Percentile — ranks this player among all same-position, same-birth-year players across all leagues">Cohort %</th>}
                          {!ppgFallbackMode && <th className="px-3 py-2.5 text-left text-[10px] font-oswald uppercase tracking-wider text-navy/60">Age Mod</th>}
                          {!ppgFallbackMode && <th className="px-3 py-2.5 text-left text-[10px] font-oswald uppercase tracking-wider text-navy/60">Tier</th>}
                          {!ppgFallbackMode && <th className="px-3 py-2.5 text-left text-[10px] font-oswald uppercase tracking-wider text-navy/60">Confidence</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {byLeaguePlayers.length === 0 ? (
                          <tr>
                            <td colSpan={ppgFallbackMode ? 5 : 10} className="px-4 py-12 text-center text-muted text-sm">
                              No players found for this league and position.
                            </td>
                          </tr>
                        ) : (
                          byLeaguePlayers.map((p, i) => {
                            const isSmallSample = p.confidence_tier === "small_sample";
                            return (
                            <tr
                              key={p.player_id}
                              onClick={() => handleRowClick(p.player_id)}
                              className={`cursor-pointer hover:bg-teal/5 transition-colors ${i % 2 === 0 ? "bg-white" : "bg-gray-50/40"}`}
                              style={isSmallSample ? { opacity: 0.55 } : undefined}
                            >
                              <td className="px-3 py-2.5 text-xs text-muted font-oswald">{i + 1}</td>
                              <td className="px-3 py-2.5">
                                <Link
                                  href={`/players/${p.player_id}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-sm font-semibold text-navy hover:text-teal transition-colors"
                                >
                                  {p.first_name} {p.last_name}
                                </Link>
                              </td>
                              <td className="px-3 py-2.5 text-xs text-muted">{p.current_team || "—"}</td>
                              {ppgFallbackMode ? (
                                <>
                                  <td className="px-3 py-2.5 text-sm font-bold text-teal font-oswald">{p.ppg?.toFixed(2) ?? "—"}</td>
                                  <td className="px-3 py-2.5">
                                    <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-oswald font-bold uppercase tracking-wider text-gray-400 bg-gray-100">
                                      PXR Pending
                                    </span>
                                  </td>
                                </>
                              ) : (
                                <>
                                  <td className="px-3 py-2.5">
                                    <span className="text-sm font-bold text-teal font-oswald">{p.pxr_score?.toFixed(1)}</span>
                                    {p.gp != null && p.gp < 15 && (
                                      <span className="ml-1 text-[9px] text-gray-400 font-oswald">{p.gp}GP</span>
                                    )}
                                  </td>
                                  <td className="px-3 py-2.5 text-sm font-bold font-oswald" style={{ color: "#14B8A8" }}>{p.pxi_intelligence != null ? p.pxi_intelligence.toFixed(1) : "—"}</td>
                                  <td className="px-3 py-2.5 text-xs text-muted">{p.league_percentile != null ? `${Math.round(p.league_percentile)}%` : "—"}</td>
                                  <td className="px-3 py-2.5 text-xs text-muted">{p.cohort_percentile != null ? `${Math.round(p.cohort_percentile)}%` : "—"}</td>
                                  <td className={`px-3 py-2.5 text-xs font-medium ${p.age_modifier != null && p.age_modifier > 0 ? "text-green-600" : p.age_modifier != null && p.age_modifier < 0 ? "text-orange" : "text-muted/40"}`}>
                                    {p.age_modifier != null ? (p.age_modifier > 0 ? `+${p.age_modifier.toFixed(1)}` : p.age_modifier.toFixed(1)) : "0.0"}
                                  </td>
                                  <td className="px-3 py-2.5"><TierBadge score={p.pxr_score} scoreType={p.score_type} /></td>
                                  <td className="px-3 py-2.5"><ConfidenceBadge tier={p.confidence_tier} gp={p.gp} /></td>
                                </>
                              )}
                            </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ═══════ VIEW 2: By Cohort ═══════ */}
            {activeTab === "By Cohort" && (
              <div>
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <select
                    value={selectedBirthYear}
                    onChange={(e) => setSelectedBirthYear(e.target.value)}
                    className="px-3 py-2 border border-border rounded-lg text-sm bg-white text-navy"
                  >
                    {filterOptions.birth_years.map((y) => (
                      <option key={String(y)} value={String(y)}>{y}</option>
                    ))}
                  </select>
                </div>

                <div className="bg-white rounded-xl border border-border overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-border">
                        <tr>
                          <th className="px-3 py-2.5 text-left text-[10px] font-oswald uppercase tracking-wider text-navy/60 w-12">#</th>
                          <th className="px-3 py-2.5 text-left text-[10px] font-oswald uppercase tracking-wider text-navy/60">Player</th>
                          <th className="px-3 py-2.5 text-left text-[10px] font-oswald uppercase tracking-wider text-navy/60">Team</th>
                          <th className="px-3 py-2.5 text-left text-[10px] font-oswald uppercase tracking-wider text-navy/60">League</th>
                          <th className="px-3 py-2.5 text-left text-[10px] font-oswald uppercase tracking-wider text-navy/60">PXR Score</th>
                          <th className="px-3 py-2.5 text-left text-[10px] font-oswald uppercase tracking-wider text-navy/60" title="AI-generated score from PXI assessment. Requires a generated report.">PXI</th>
                          <th className="px-3 py-2.5 text-left text-[10px] font-oswald uppercase tracking-wider text-navy/60 cursor-help" title="Cohort Percentile — ranks this player among all same-position, same-birth-year players across all leagues">Cohort %</th>
                          <th className="px-3 py-2.5 text-left text-[10px] font-oswald uppercase tracking-wider text-navy/60 cursor-help" title="League Percentile — ranks this player among all same-position players in their league this season">League %</th>
                          <th className="px-3 py-2.5 text-left text-[10px] font-oswald uppercase tracking-wider text-navy/60">Confidence</th>
                        </tr>
                      </thead>
                      <tbody>
                        {byCohortPlayers.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="px-4 py-12 text-center text-muted text-sm">
                              No players found for this birth year.
                            </td>
                          </tr>
                        ) : (
                          byCohortPlayers.map((p, i) => {
                            const playingDown =
                              p.cohort_percentile != null &&
                              p.league_percentile != null &&
                              p.cohort_percentile - p.league_percentile > 20;
                            const isSmallSample = p.confidence_tier === "small_sample";
                            return (
                              <tr
                                key={p.player_id}
                                onClick={() => handleRowClick(p.player_id)}
                                className={`cursor-pointer hover:bg-teal/5 transition-colors ${playingDown ? "bg-amber-50/60" : i % 2 === 0 ? "bg-white" : "bg-gray-50/40"}`}
                                style={isSmallSample ? { opacity: 0.55 } : undefined}
                              >
                                <td className="px-3 py-2.5 text-xs text-muted font-oswald">{i + 1}</td>
                                <td className="px-3 py-2.5">
                                  <Link
                                    href={`/players/${p.player_id}`}
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-sm font-semibold text-navy hover:text-teal transition-colors"
                                  >
                                    {p.first_name} {p.last_name}
                                  </Link>
                                  {playingDown && (
                                    <span className="ml-2 text-[10px] text-amber-600 font-oswald uppercase tracking-wider">Playing Down</span>
                                  )}
                                </td>
                                <td className="px-3 py-2.5 text-xs text-muted">
                                  {p.current_team ? <Link href={`/teams/${encodeURIComponent(p.current_team)}`} className="hover:text-teal transition-colors">{p.current_team}</Link> : "—"}
                                </td>
                                <td className="px-3 py-2.5 text-xs text-muted">
                                  {p.current_league ? <Link href={`/leagues?league=${encodeURIComponent(p.current_league)}`} className="hover:text-teal transition-colors">{p.current_league}</Link> : "—"}
                                </td>
                                <td className="px-3 py-2.5">
                                  <span className="text-sm font-bold text-teal font-oswald">{p.pxr_score?.toFixed(1)}</span>
                                  {p.gp != null && p.gp < 15 && (
                                    <span className="ml-1 text-[9px] text-gray-400 font-oswald">{p.gp}GP</span>
                                  )}
                                </td>
                                <td className="px-3 py-2.5 text-sm font-bold font-oswald" style={{ color: "#14B8A8" }}>{p.pxi_intelligence != null ? p.pxi_intelligence.toFixed(1) : "—"}</td>
                                <td className="px-3 py-2.5 text-xs text-muted">{p.cohort_percentile != null ? `${Math.round(p.cohort_percentile)}%` : "—"}</td>
                                <td className="px-3 py-2.5 text-xs text-muted">{p.league_percentile != null ? `${Math.round(p.league_percentile)}%` : "—"}</td>
                                <td className="px-3 py-2.5"><ConfidenceBadge tier={p.confidence_tier} gp={p.gp} /></td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ═══════ VIEW 3: Undervalued ═══════ */}
            {activeTab === "Undervalued" && (
              <div>
                <div className="bg-navy/5 border border-navy/10 rounded-xl px-4 py-3 mb-4">
                  <p className="text-sm text-navy/80">
                    These players rank higher in their birth year cohort than in their own league — a signal worth investigating.
                  </p>
                </div>

                <div className="bg-white rounded-xl border border-border overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-border">
                        <tr>
                          <th className="px-3 py-2.5 text-left text-[10px] font-oswald uppercase tracking-wider text-navy/60 w-12">#</th>
                          <th className="px-3 py-2.5 text-left text-[10px] font-oswald uppercase tracking-wider text-navy/60">Player</th>
                          <th className="px-3 py-2.5 text-left text-[10px] font-oswald uppercase tracking-wider text-navy/60">Team</th>
                          <th className="px-3 py-2.5 text-left text-[10px] font-oswald uppercase tracking-wider text-navy/60">League</th>
                          <th className="px-3 py-2.5 text-left text-[10px] font-oswald uppercase tracking-wider text-navy/60">Birth Year</th>
                          <th className="px-3 py-2.5 text-left text-[10px] font-oswald uppercase tracking-wider text-navy/60">PXR Score</th>
                          <th className="px-3 py-2.5 text-left text-[10px] font-oswald uppercase tracking-wider text-navy/60" title="AI-generated score from PXI assessment. Requires a generated report.">PXI</th>
                          <th className="px-3 py-2.5 text-left text-[10px] font-oswald uppercase tracking-wider text-navy/60 cursor-help" title="Cohort Percentile — ranks this player among all same-position, same-birth-year players across all leagues">Cohort %</th>
                          <th className="px-3 py-2.5 text-left text-[10px] font-oswald uppercase tracking-wider text-navy/60 cursor-help" title="League Percentile — ranks this player among all same-position players in their league this season">League %</th>
                          <th className="px-3 py-2.5 text-left text-[10px] font-oswald uppercase tracking-wider text-navy/60">Gap</th>
                          <th className="px-3 py-2.5 text-left text-[10px] font-oswald uppercase tracking-wider text-navy/60">Confidence</th>
                        </tr>
                      </thead>
                      <tbody>
                        {undervaluedPlayers.length === 0 ? (
                          <tr>
                            <td colSpan={11} className="px-4 py-12 text-center text-muted text-sm">
                              No undervalued players found with current data.
                            </td>
                          </tr>
                        ) : (
                          undervaluedPlayers.map((p, i) => {
                            const isSmallSample = p.confidence_tier === "small_sample";
                            return (
                            <tr
                              key={p.player_id}
                              onClick={() => handleRowClick(p.player_id)}
                              className={`cursor-pointer hover:bg-teal/5 transition-colors ${i % 2 === 0 ? "bg-white" : "bg-gray-50/40"}`}
                              style={isSmallSample ? { opacity: 0.55 } : undefined}
                            >
                              <td className="px-3 py-2.5 text-xs text-muted font-oswald">{i + 1}</td>
                              <td className="px-3 py-2.5">
                                <Link
                                  href={`/players/${p.player_id}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-sm font-semibold text-navy hover:text-teal transition-colors"
                                >
                                  {p.first_name} {p.last_name}
                                </Link>
                              </td>
                              <td className="px-3 py-2.5 text-xs text-muted">{p.current_team || "—"}</td>
                              <td className="px-3 py-2.5 text-xs text-muted">{p.current_league || "—"}</td>
                              <td className="px-3 py-2.5 text-xs text-muted">{p.birth_year || "—"}</td>
                              <td className="px-3 py-2.5">
                                <span className="text-sm font-bold text-teal font-oswald">{p.pxr_score?.toFixed(1)}</span>
                                {p.gp != null && p.gp < 15 && (
                                  <span className="ml-1 text-[9px] text-gray-400 font-oswald">{p.gp}GP</span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 text-sm font-bold font-oswald" style={{ color: "#14B8A8" }}>{p.pxi_intelligence != null ? p.pxi_intelligence.toFixed(1) : "—"}</td>
                              <td className="px-3 py-2.5 text-xs text-muted">{p.cohort_percentile != null ? `${Math.round(p.cohort_percentile)}%` : "—"}</td>
                              <td className="px-3 py-2.5 text-xs text-muted">{p.league_percentile != null ? `${Math.round(p.league_percentile)}%` : "—"}</td>
                              <td className="px-3 py-2.5 text-sm font-bold text-teal font-oswald">+{Math.round(p.gap)}</td>
                              <td className="px-3 py-2.5"><ConfidenceBadge tier={p.confidence_tier} gp={p.gp} /></td>
                            </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ═══════ VIEW 4: Top Movers ═══════ */}
            {activeTab === "Top Movers" && (
              <div>
                <div className="bg-navy/5 border border-navy/10 rounded-xl px-4 py-3 mb-4">
                  <p className="text-sm text-navy/80">
                    Ranked by age advantage — players born late in their cohort year playing above their age peers.
                  </p>
                </div>

                <div className="bg-white rounded-xl border border-border overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-border">
                        <tr>
                          <th className="px-3 py-2.5 text-left text-[10px] font-oswald uppercase tracking-wider text-navy/60 w-12">#</th>
                          <th className="px-3 py-2.5 text-left text-[10px] font-oswald uppercase tracking-wider text-navy/60">Player</th>
                          <th className="px-3 py-2.5 text-left text-[10px] font-oswald uppercase tracking-wider text-navy/60">Team</th>
                          <th className="px-3 py-2.5 text-left text-[10px] font-oswald uppercase tracking-wider text-navy/60">League</th>
                          <th className="px-3 py-2.5 text-left text-[10px] font-oswald uppercase tracking-wider text-navy/60">PXR Score</th>
                          <th className="px-3 py-2.5 text-left text-[10px] font-oswald uppercase tracking-wider text-navy/60" title="AI-generated score from PXI assessment. Requires a generated report.">PXI</th>
                          <th className="px-3 py-2.5 text-left text-[10px] font-oswald uppercase tracking-wider text-navy/60 cursor-help" title="Cohort Percentile — ranks this player among all same-position, same-birth-year players across all leagues">Cohort %</th>
                          <th className="px-3 py-2.5 text-left text-[10px] font-oswald uppercase tracking-wider text-navy/60">Age Advantage</th>
                          <th className="px-3 py-2.5 text-left text-[10px] font-oswald uppercase tracking-wider text-navy/60">Confidence</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topMoversPlayers.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="px-4 py-12 text-center text-muted text-sm">
                              No players with positive age advantage found.
                            </td>
                          </tr>
                        ) : (
                          topMoversPlayers.map((p, i) => {
                            const isSmallSample = p.confidence_tier === "small_sample";
                            return (
                            <tr
                              key={p.player_id}
                              onClick={() => handleRowClick(p.player_id)}
                              className={`cursor-pointer hover:bg-teal/5 transition-colors ${i % 2 === 0 ? "bg-white" : "bg-gray-50/40"}`}
                              style={isSmallSample ? { opacity: 0.55 } : undefined}
                            >
                              <td className="px-3 py-2.5 text-xs text-muted font-oswald">{i + 1}</td>
                              <td className="px-3 py-2.5">
                                <Link
                                  href={`/players/${p.player_id}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-sm font-semibold text-navy hover:text-teal transition-colors"
                                >
                                  {p.first_name} {p.last_name}
                                </Link>
                              </td>
                              <td className="px-3 py-2.5 text-xs text-muted">{p.current_team || "—"}</td>
                              <td className="px-3 py-2.5 text-xs text-muted">{p.current_league || "—"}</td>
                              <td className="px-3 py-2.5">
                                <span className="text-sm font-bold text-teal font-oswald">{p.pxr_score?.toFixed(1)}</span>
                                {p.gp != null && p.gp < 15 && (
                                  <span className="ml-1 text-[9px] text-gray-400 font-oswald">{p.gp}GP</span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 text-sm font-bold font-oswald" style={{ color: "#14B8A8" }}>{p.pxi_intelligence != null ? p.pxi_intelligence.toFixed(1) : "—"}</td>
                              <td className="px-3 py-2.5 text-xs text-muted">{p.cohort_percentile != null ? `${Math.round(p.cohort_percentile)}%` : "—"}</td>
                              <td className="px-3 py-2.5 text-sm font-semibold text-green-600">
                                +{p.age_modifier?.toFixed(1)}
                              </td>
                              <td className="px-3 py-2.5"><ConfidenceBadge tier={p.confidence_tier} gp={p.gp} /></td>
                            </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </ProtectedRoute>
  );
}
