"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronUp, ChevronDown, Download, RotateCcw, ArrowLeft, Star } from "lucide-react";
import ProtectedRoute from "@/components/ProtectedRoute";
import api from "@/lib/api";
import { getUser } from "@/lib/auth";
import { useBenchTalk } from "@/components/BenchTalkProvider";
import PXRConfidenceBadge from "@/components/PXRConfidenceBadge";

// ── PXR Tier Definitions (from PXR Engine Spec v1.0, Section 6) ──
const PXR_TIERS = [
  { id: "1A", label: "ELITE",          min: 90, max: 100, color: "#18B3A6", borderColor: "border-teal",     bgColor: "bg-teal/5" },
  { id: "1B", label: "HIGH IMPACT",    min: 80, max: 89,  color: "#18B3A6", borderColor: "border-teal/50",  bgColor: "bg-teal/3" },
  { id: "2A", label: "SOLID STARTER",  min: 70, max: 79,  color: "#0F2A3D", borderColor: "border-navy",     bgColor: "bg-navy/5" },
  { id: "2B", label: "DEPTH PLAYER",   min: 60, max: 69,  color: "#6B7280", borderColor: "border-gray-400", bgColor: "bg-gray-50" },
  { id: "3A", label: "DEVELOPING",     min: 50, max: 59,  color: "#9CA3AF", borderColor: "border-gray-300", bgColor: "bg-gray-50/50" },
  { id: "3B", label: "EARLY STAGE",    min: 0,  max: 49,  color: "#D1D5DB", borderColor: "border-gray-200", bgColor: "bg-white" },
];

function getTier(score: number | null) {
  if (score == null) return null;
  return PXR_TIERS.find((t) => score >= t.min && score <= t.max) || PXR_TIERS[PXR_TIERS.length - 1];
}

// ── Types ──
interface DraftPlayer {
  player_id: string;
  first_name: string;
  last_name: string;
  name?: string;
  current_team: string | null;
  current_league: string | null;
  position: string | null;
  birth_year: string | null;
  position_group: string;
  pxr_score: number;
  score_type?: string | null;
  pxr_tier?: string | null;
  league_percentile: number | null;
  cohort_percentile: number | null;
  age_modifier: number | null;
  p1_offense: number | null;
  p2_defense: number | null;
  p3_possession: number | null;
  p4_physical: number | null;
  data_completeness: number | null;
  season: string;
  confidence_tier?: string | null;
  gp?: number | null;
  toi_minutes?: number | null;
}

interface FilterOptions {
  leagues: string[];
  birth_years: (string | number)[];
  seasons: string[];
  positions: string[];
}

type SortKey = "pxr_score" | "league_percentile" | "cohort_percentile" | "age_modifier" | "p1_offense" | "p2_defense" | "p3_possession" | "p4_physical" | "player_name" | "current_team" | "current_league";

// ── Column sorting helper ──
function sortPlayers(players: DraftPlayer[], key: SortKey, asc: boolean): DraftPlayer[] {
  return [...players].sort((a, b) => {
    let va: string | number | null;
    let vb: string | number | null;
    if (key === "player_name") {
      va = `${a.last_name} ${a.first_name}`;
      vb = `${b.last_name} ${b.first_name}`;
    } else if (key === "current_team") {
      va = a.current_team;
      vb = b.current_team;
    } else if (key === "current_league") {
      va = a.current_league;
      vb = b.current_league;
    } else {
      va = a[key];
      vb = b[key];
    }
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    if (typeof va === "string" && typeof vb === "string") {
      return asc ? va.localeCompare(vb) : vb.localeCompare(va);
    }
    return asc ? (va as number) - (vb as number) : (vb as number) - (va as number);
  });
}

// ── Skeleton Row ──
function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      {Array.from({ length: 12 }).map((_, i) => (
        <td key={i} className="px-3 py-3">
          <div className="h-4 bg-gray-200 rounded w-full" />
        </td>
      ))}
    </tr>
  );
}

// ── Page Component ──
export default function DraftBoardPage() {
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
      page: { id: "DRAFT_BOARD", route: "/draft-board" },
    });
    return () => { setActivePxiContext(null); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [players, setPlayers] = useState<DraftPlayer[]>([]);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({ leagues: [], birth_years: [], seasons: [], positions: [] });
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  // Filters
  const [league, setLeague] = useState("");
  const [position, setPosition] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [season, setSeason] = useState("2025-26");
  const [scoreType, setScoreType] = useState("");
  const [tierFilter, setTierFilter] = useState("");
  const [unfilteredTotal, setUnfilteredTotal] = useState(0);

  // Sort
  const [sortKey, setSortKey] = useState<SortKey>("pxr_score");
  const [sortAsc, setSortAsc] = useState(false);

  // Fetch data
  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("season", season);
    if (league) params.set("league", league);
    if (position) params.set("position_group", position);
    if (birthYear) params.set("birth_year", birthYear);
    if (scoreType) params.set("score_type", scoreType);
    if (tierFilter) params.set("tier", tierFilter);

    api
      .get(`/pxr/draft-board?${params.toString()}`)
      .then((res) => {
        setPlayers(res.data.players || []);
        setTotal(res.data.total || 0);
        if (res.data.filter_options) setFilterOptions(res.data.filter_options);
      })
      .catch(() => {
        setPlayers([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, [season, league, position, birthYear, scoreType, tierFilter]);

  // Fetch unfiltered total once for results summary
  useEffect(() => {
    api.get(`/pxr/draft-board?season=${season}`)
      .then((res) => setUnfilteredTotal(res.data.total || 0))
      .catch(() => {});
  }, [season]);

  // Top Prospects star toggle
  const userRole = currentUser?.hockey_role || "scout";
  const canManageTP = new Set(["scout", "gm", "coach", "admin"]).has(userRole);
  const [tpIds, setTpIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    api.get("/watchlist/top-prospects")
      .then((res) => {
        const ids = new Set<string>((res.data || []).map((r: { player_id: string }) => r.player_id));
        setTpIds(ids);
      })
      .catch(() => {});
  }, []);

  async function toggleTopProspect(e: React.MouseEvent, playerId: string) {
    e.stopPropagation();
    if (tpIds.has(playerId)) {
      try {
        await api.delete(`/watchlist/top-prospects/${playerId}`);
        setTpIds((prev) => { const n = new Set(prev); n.delete(playerId); return n; });
      } catch { /* ignore */ }
    } else {
      try {
        await api.post("/watchlist/top-prospects/add", { player_id: playerId });
        setTpIds((prev) => new Set(prev).add(playerId));
      } catch { /* ignore */ }
    }
  }

  // Sorted + grouped by tier
  const sorted = useMemo(() => sortPlayers(players, sortKey, sortAsc), [players, sortKey, sortAsc]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const resetFilters = () => {
    setLeague("");
    setPosition("");
    setBirthYear("");
    setSeason("2025-26");
    setScoreType("");
    setTierFilter("");
  };

  const hasFilters = league || position || birthYear || season !== "2025-26" || scoreType || tierFilter;

  // Insert tier divider rows into the sorted list
  type TierRow = { type: "tier"; tier: typeof PXR_TIERS[0] };
  type PlayerRow = { type: "player"; player: DraftPlayer; rank: number };
  type BoardRow = TierRow | PlayerRow;

  const rowsWithTiers = useMemo((): BoardRow[] => {
    // Group players by tier to skip headers for empty tiers
    const tierPlayerMap = new Map<string, typeof sorted>();
    for (const p of sorted) {
      const tier = getTier(p.pxr_score);
      if (tier) {
        if (!tierPlayerMap.has(tier.id)) tierPlayerMap.set(tier.id, []);
        tierPlayerMap.get(tier.id)!.push(p);
      }
    }
    const result: BoardRow[] = [];
    let lastTierId = "";
    let rank = 0;
    for (const p of sorted) {
      const tier = getTier(p.pxr_score);
      if (tier && tier.id !== lastTierId) {
        // Only show tier header if this tier has players
        if (tierPlayerMap.has(tier.id) && tierPlayerMap.get(tier.id)!.length > 0) {
          result.push({ type: "tier", tier });
        }
        lastTierId = tier.id;
      }
      rank++;
      result.push({ type: "player", player: p, rank });
    }
    return result;
  }, [sorted]);

  // Column header component
  const SortHeader = ({ label, sortId, className }: { label: string; sortId: SortKey; className?: string }) => (
    <th
      className={`px-3 py-2.5 text-left text-[10px] font-oswald uppercase tracking-wider text-navy/60 cursor-pointer hover:text-navy select-none whitespace-nowrap ${className || ""}`}
      onClick={() => handleSort(sortId)}
    >
      <span className="inline-flex items-center gap-0.5">
        {label}
        {sortKey === sortId && (sortAsc ? <ChevronUp size={10} /> : <ChevronDown size={10} />)}
      </span>
    </th>
  );

  return (
    <ProtectedRoute>
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Link href="/" className="flex items-center gap-1 text-sm text-muted hover:text-navy mb-3 no-print">
          <ArrowLeft size={14} /> Dashboard
        </Link>
        {/* Header */}
        <div className="flex items-center justify-between mb-5 no-print">
          <div>
            <h1 className="text-2xl font-bold text-navy font-oswald uppercase tracking-wider">
              Draft Board
            </h1>
            <p className="text-sm text-muted mt-0.5">
              Players ranked by PXR score across all leagues. Filter by position, birth year, and league to build your draft list. {total.toLocaleString()} players scored.
            </p>
          </div>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-navy text-white text-sm font-oswald font-semibold uppercase tracking-wider rounded-lg hover:bg-navy/90 transition-colors"
          >
            <Download size={14} />
            Export PDF
          </button>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center gap-3 mb-4 no-print">
          <select
            value={league}
            onChange={(e) => setLeague(e.target.value)}
            className="px-3 py-2 border border-border rounded-lg text-sm bg-white text-navy"
          >
            <option value="">All Leagues</option>
            {filterOptions.leagues.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>

          <select
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            className="px-3 py-2 border border-border rounded-lg text-sm bg-white text-navy"
          >
            <option value="">All Positions</option>
            {filterOptions.positions.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>

          <select
            value={birthYear}
            onChange={(e) => setBirthYear(e.target.value)}
            className="px-3 py-2 border border-border rounded-lg text-sm bg-white text-navy"
          >
            <option value="">All Birth Years</option>
            {filterOptions.birth_years.map((y) => (
              <option key={String(y)} value={String(y)}>{y}</option>
            ))}
          </select>

          <select
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value)}
            className="px-3 py-2 border border-border rounded-lg text-sm bg-white text-navy"
          >
            <option value="">All Tiers</option>
            <option value="1A">1A — Elite (90+)</option>
            <option value="1B">1B — High Impact (80–89)</option>
            <option value="2A">2A — Solid Starter (70–79)</option>
            <option value="2B">2B — Depth (60–69)</option>
            <option value="3A">3A — Developing (50–59)</option>
            <option value="3B">3B — Early Stage (&lt;50)</option>
          </select>

          <select
            value={scoreType}
            onChange={(e) => setScoreType(e.target.value)}
            className="px-3 py-2 border border-border rounded-lg text-sm bg-white text-navy"
          >
            <option value="">All Scores</option>
            <option value="full">Full PXR Only</option>
            <option value="estimated">Estimated Only</option>
          </select>

          <select
            value={season}
            onChange={(e) => setSeason(e.target.value)}
            className="px-3 py-2 border border-border rounded-lg text-sm bg-white text-navy"
          >
            {filterOptions.seasons.length > 0 ? (
              filterOptions.seasons.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))
            ) : (
              <option value="2025-26">2025-26</option>
            )}
          </select>

          {hasFilters && (
            <button
              onClick={resetFilters}
              className="flex items-center gap-1 text-xs text-muted hover:text-navy transition-colors font-oswald uppercase tracking-wider"
            >
              <RotateCcw size={12} />
              Reset
            </button>
          )}
        </div>

        {/* Print Header (hidden on screen, shown on print) */}
        <div className="hidden print-only mb-4">
          <h1 className="text-xl font-bold text-navy font-oswald uppercase tracking-wider">
            ProspectX Draft Board — {season} — Generated {new Date().toLocaleDateString()}
          </h1>
        </div>

        {/* Results Summary */}
        {!loading && (
          <p className="text-xs text-muted mb-3 no-print">
            Showing <span className="font-semibold text-navy">{total.toLocaleString()}</span> players
            {hasFilters && unfilteredTotal > 0 && ` — filtered from ${unfilteredTotal.toLocaleString()} scored`}
          </p>
        )}

        {/* Tier Legend */}
        <div className="flex flex-wrap gap-2 mb-4 print-visible">
          {PXR_TIERS.map((tier) => (
            <div key={tier.id} className="flex items-center gap-1.5">
              <span
                className="w-3 h-3 rounded-sm border"
                style={{ backgroundColor: tier.color, borderColor: tier.color, opacity: 0.7 }}
              />
              <span className="text-[10px] font-oswald uppercase tracking-wider text-muted">
                {tier.id} {tier.label} ({tier.min}–{tier.max === 100 ? "100" : tier.max})
              </span>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-gray-50 border-b border-border">
                <tr>
                  <th className="px-3 py-2.5 text-left text-[10px] font-oswald uppercase tracking-wider text-navy/60 w-12">#</th>
                  {canManageTP && <th className="px-2 py-2.5 w-8" title="Top Prospects" />}
                  <SortHeader label="Player" sortId="player_name" />
                  <SortHeader label="Team" sortId="current_team" />
                  <SortHeader label="League" sortId="current_league" />
                  <SortHeader label="PXR" sortId="pxr_score" />
                  <th className="px-3 py-2.5 text-left text-[10px] font-oswald uppercase tracking-wider text-navy/60 whitespace-nowrap" title="AI-generated score from PXI assessment. Requires a generated report.">PXI</th>
                  <SortHeader label="League %" sortId="league_percentile" />
                  <SortHeader label="Cohort %" sortId="cohort_percentile" />
                  <SortHeader label="Age Mod" sortId="age_modifier" />
                  <SortHeader label="P1 Off" sortId="p1_offense" />
                  <SortHeader label="P2 Def" sortId="p2_defense" />
                  <SortHeader label="P3 Poss" sortId="p3_possession" />
                  <SortHeader label="P4 Phys" sortId="p4_physical" />
                  <th className="px-3 py-2.5 text-left text-[10px] font-oswald uppercase tracking-wider text-navy/60">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
                ) : rowsWithTiers.length === 0 ? (
                  <tr>
                    <td colSpan={canManageTP ? 15 : 14} className="px-4 py-12 text-center text-muted text-sm">
                      No players match these filters. Try adjusting your criteria.
                    </td>
                  </tr>
                ) : (
                  rowsWithTiers.map((row, idx) => {
                    if (row.type === "tier") {
                      return (
                        <tr key={`tier-${row.tier.id}`} className="border-t-2" style={{ borderColor: row.tier.color }}>
                          <td colSpan={canManageTP ? 15 : 14} className={`px-4 py-1.5 ${row.tier.bgColor}`}>
                            <span
                              className="text-[10px] font-oswald font-bold uppercase tracking-widest"
                              style={{ color: row.tier.color }}
                            >
                              {row.tier.id} — {row.tier.label} TIER — PXR {row.tier.min}+
                            </span>
                          </td>
                        </tr>
                      );
                    }

                    const p = row.player;
                    const tier = getTier(p.pxr_score);
                    const isEstimated = p.score_type === "estimated";
                    const ageMod = p.age_modifier;
                    const ageModStr = ageMod != null && ageMod !== 0 ? (ageMod > 0 ? `+${ageMod.toFixed(1)}` : ageMod.toFixed(1)) : "0.0";
                    const ageModColor = ageMod != null && ageMod > 0 ? "text-green-600" : ageMod != null && ageMod < 0 ? "text-orange" : "text-muted/40";

                    return (
                      <tr
                        key={`player-${p.player_id}-${idx}`}
                        onClick={() => router.push(`/players/${p.player_id}`)}
                        className={`cursor-pointer hover:bg-teal/5 transition-colors ${
                          idx % 2 === 0 ? "bg-white" : "bg-gray-50/40"
                        }`}
                        style={{
                          borderLeftWidth: "3px",
                          borderLeftColor: isEstimated ? "#F59E0B" : tier?.color || "#E2EAF3",
                          borderLeftStyle: "solid",
                          ...(p.confidence_tier === "small_sample" ? { opacity: 0.55 } : {}),
                        }}
                      >
                        <td className="px-3 py-2.5 text-xs text-muted font-oswald">{row.rank}</td>
                        {canManageTP && (
                          <td className="px-2 py-2.5 text-center">
                            <button
                              onClick={(e) => toggleTopProspect(e, p.player_id)}
                              className="transition-colors"
                              title={tpIds.has(p.player_id) ? "Remove from Top Prospects" : "Add to Top Prospects"}
                            >
                              <Star
                                size={14}
                                fill={tpIds.has(p.player_id) ? "#0D9488" : "none"}
                                stroke={tpIds.has(p.player_id) ? "#0D9488" : "rgba(255,255,255,.4)"}
                                className={tpIds.has(p.player_id) ? "" : "text-muted/30 hover:text-teal/60"}
                              />
                            </button>
                          </td>
                        )}
                        <td className="px-3 py-2.5">
                          <Link
                            href={`/players/${p.player_id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-sm font-semibold text-navy hover:text-teal transition-colors"
                          >
                            {p.first_name} {p.last_name}
                          </Link>
                          {p.birth_year && (
                            <span className="ml-1.5 text-[10px] text-muted">({p.birth_year})</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-muted">{p.current_team || "—"}</td>
                        <td className="px-3 py-2.5 text-xs text-muted">{p.current_league || "—"}</td>
                        <td className="px-3 py-2.5">
                          <span className={`text-sm font-bold font-oswald ${isEstimated ? "" : "text-teal"}`} style={isEstimated ? { color: "#F59E0B" } : {}}>
                            {isEstimated ? "~" : ""}{p.pxr_score?.toFixed(1)}
                          </span>
                          {isEstimated && (
                            <span
                              className="ml-1 inline-flex items-center px-1 py-0.5 rounded text-[8px] font-oswald font-bold uppercase tracking-wider"
                              style={{ backgroundColor: "#FEF3C7", color: "#92400E" }}
                              title="Estimated PXR — calculated from game stats. Full PXR requires advanced microstat data."
                            >
                              Est.
                            </span>
                          )}
                          {!isEstimated && p.gp != null && p.gp < 15 && (
                            <span className="ml-1 text-[9px] text-gray-400 font-oswald">{p.gp}GP</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-sm font-bold font-oswald" style={{ color: "#14B8A8" }}>—</td>
                        <td className="px-3 py-2.5 text-xs text-muted">
                          {p.league_percentile != null ? `Top ${Math.max(1, Math.round(100 - p.league_percentile))}%` : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-muted">
                          {p.cohort_percentile != null ? `Top ${Math.max(1, Math.round(100 - p.cohort_percentile))}%` : "—"}
                        </td>
                        <td className={`px-3 py-2.5 text-xs font-medium ${ageModColor}`}>
                          {ageModStr}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-muted">{p.p1_offense?.toFixed(1) ?? "—"}</td>
                        <td className="px-3 py-2.5 text-xs text-muted">{p.p2_defense?.toFixed(1) ?? "—"}</td>
                        <td className="px-3 py-2.5 text-xs text-muted">{p.p3_possession?.toFixed(1) ?? "—"}</td>
                        <td className="px-3 py-2.5 text-xs text-muted">{p.p4_physical?.toFixed(1) ?? "—"}</td>
                        <td className="px-3 py-2.5"><PXRConfidenceBadge confidence_tier={p.confidence_tier ?? ""} score_type={p.score_type} compact /></td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Print stylesheet */}
      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          .print-visible { display: flex !important; }
          .print-only { display: block !important; }
          .hidden.print-only { display: block !important; }
          nav { display: none !important; }
          main { max-width: 100% !important; padding: 0 !important; }
          table { font-size: 9px !important; }
          th, td { padding: 2px 4px !important; }
          tr { page-break-inside: avoid; }
        }
      `}</style>
    </ProtectedRoute>
  );
}
