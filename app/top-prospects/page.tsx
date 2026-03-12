"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import api from "@/lib/api";
import { getUser } from "@/lib/auth";
import { Star, X, ArrowLeft } from "lucide-react";

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

const MANAGE_ROLES = new Set(["scout", "gm", "coach", "admin"]);

interface TopProspect {
  id: string;
  player_id: string;
  first_name: string;
  last_name: string;
  position: string | null;
  current_team: string | null;
  current_league: string | null;
  dob: string | null;
  pxr_score: number | null;
  confidence_tier: string | null;
  cohort_percentile: number | null;
  league_percentile: number | null;
  latest_note: string | null;
}

export default function TopProspectsPage() {
  const currentUser = getUser();
  const userRole = currentUser?.hockey_role || "scout";
  const canManage = MANAGE_ROLES.has(userRole);

  const [prospects, setProspects] = useState<TopProspect[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/watchlist/top-prospects")
      .then((res) => setProspects(res.data))
      .catch(() => setProspects([]))
      .finally(() => setLoading(false));
  }, []);

  async function handleRemove(playerId: string) {
    try {
      await api.delete(`/watchlist/top-prospects/${playerId}`);
      setProspects((prev) => prev.filter((p) => p.player_id !== playerId));
    } catch {
      /* ignore */
    }
  }

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
                ? `${prospects.length} prospect${prospects.length !== 1 ? "s" : ""} on your org's curated list, ranked by PXR score.`
                : "Loading prospects..."}
            </p>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="bg-white rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-border">
                  <tr>
                    {["#", "Player", "Pos", "Team / League", "PXR", "Tier", "Cohort %", "Latest Note", ""].map((h) => (
                      <th key={h} className="px-3 py-2.5 text-left text-[10px] font-oswald uppercase tracking-wider text-navy/60">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      {Array.from({ length: 9 }).map((_, j) => (
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
            <Star size={40} className="mx-auto mb-4" style={{ color: "rgba(13,148,136,.3)" }} />
            <h2 className="text-lg font-bold text-navy font-oswald uppercase tracking-wider mb-2">
              No top prospects yet
            </h2>
            <p className="text-sm text-muted max-w-md mx-auto">
              Add players from their profile page or the{" "}
              <Link href="/draft-board" className="text-teal hover:underline">Draft Board</Link>.
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
                    <th className="px-3 py-2.5 text-left text-[10px] font-oswald uppercase tracking-wider text-navy/60">PXR</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-oswald uppercase tracking-wider text-navy/60">Tier</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-oswald uppercase tracking-wider text-navy/60">Cohort %</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-oswald uppercase tracking-wider text-navy/60">Latest Note</th>
                    {canManage && (
                      <th className="px-3 py-2.5 text-left text-[10px] font-oswald uppercase tracking-wider text-navy/60 w-12" />
                    )}
                  </tr>
                </thead>
                <tbody>
                  {prospects.map((p, idx) => {
                    const isEstimated = p.confidence_tier === "estimated";
                    return (
                      <tr
                        key={p.id}
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
                        <td className="px-3 py-2.5 text-xs text-muted font-oswald uppercase">{getTierLabel(p.pxr_score)}</td>
                        <td className="px-3 py-2.5 text-xs text-muted">
                          {p.cohort_percentile != null ? `Top ${Math.max(1, Math.round(100 - p.cohort_percentile))}%` : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-muted max-w-[250px]">
                          {p.latest_note ? (
                            <span className="truncate block" title={p.latest_note}>
                              {p.latest_note.length > 80 ? `${p.latest_note.slice(0, 80)}…` : p.latest_note}
                            </span>
                          ) : (
                            <span className="text-muted/40">—</span>
                          )}
                        </td>
                        {canManage && (
                          <td className="px-3 py-2.5 text-center">
                            <button
                              onClick={() => handleRemove(p.player_id)}
                              className="text-muted/40 hover:text-red-500 transition-colors"
                              title="Remove from Top Prospects"
                            >
                              <X size={14} />
                            </button>
                          </td>
                        )}
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
