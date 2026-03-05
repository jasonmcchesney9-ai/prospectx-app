"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  TrendingUp,
  Search,
  Loader2,
  RefreshCw,
  Sparkles,
  Eye,
  CircleDot,
  Filter,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  UserPlus,
  XIcon,
  Trash2,
} from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import api from "@/lib/api";
import { getUser } from "@/lib/auth";

/* ── Types ────────────────────────────────────────────────── */
interface DevPlayer {
  player_id: string;
  first_name: string;
  last_name: string;
  position: string | null;
  current_team: string | null;
  team_id: string | null;
  source: "roster" | "tracked";
  has_dev_plan: boolean;
  plan_id: string | null;
  plan_status: string;
  plan_version: number | null;
  last_updated: string | null;
  key_focus: string;
  overall_status: "on_track" | "needs_attention" | "behind";
  sections: Record<string, string>;
}

interface SearchResult {
  id: string;
  first_name: string;
  last_name: string;
  position: string | null;
  current_team: string | null;
}

interface DashboardData {
  players: DevPlayer[];
  summary: { on_track: number; needs_attention: number; behind: number };
  total: number;
  teams: string[];
}

/* ── Helpers ──────────────────────────────────────────────── */
const MONO = "ui-monospace, monospace";

const STATUS_CONFIG = {
  on_track: { label: "On Track", color: "#10B981", bg: "rgba(16,185,129,0.12)", icon: CheckCircle2 },
  needs_attention: { label: "Attention", color: "#F59E0B", bg: "rgba(245,158,11,0.12)", icon: AlertTriangle },
  behind: { label: "Behind", color: "#EF4444", bg: "rgba(239,68,68,0.12)", icon: XCircle },
} as const;

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days}d ago`;
  if (days < 60) return "1 month ago";
  return `${Math.floor(days / 30)}mo ago`;
}

/* ── Component ────────────────────────────────────────────── */
export default function DevelopmentDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters
  const [search, setSearch] = useState("");
  const [posFilter, setPosFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [teamFilter, setTeamFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState<"all" | "roster" | "tracked">("all");

  // Add player modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addSearch, setAddSearch] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<SearchResult | null>(null);
  const [adding, setAdding] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Bulk generate
  const [generating, setGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState({ done: 0, total: 0 });
  const [showGenConfirm, setShowGenConfirm] = useState(false);

  // Single row generating
  const [genRow, setGenRow] = useState<string | null>(null);

  const user = getUser();

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/org-hub/development-dashboard");
      setData(res.data);
    } catch {
      setError("Failed to load development dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  /* ── Filtered players ─────────────────────────────────── */
  const filtered = (data?.players || []).filter((p) => {
    if (posFilter !== "all" && p.position !== posFilter) return false;
    if (statusFilter !== "all" && p.overall_status !== statusFilter) return false;
    if (teamFilter !== "all" && p.current_team !== teamFilter) return false;
    if (sourceFilter !== "all" && p.source !== sourceFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const name = `${p.first_name} ${p.last_name}`.toLowerCase();
      if (!name.includes(q)) return false;
    }
    return true;
  });

  const positions = Array.from(new Set((data?.players || []).map((p) => p.position).filter(Boolean))).sort();

  /* ── Player search for add modal ─────────────────────── */
  function handleAddSearch(q: string) {
    setAddSearch(q);
    setSelectedPlayer(null);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (q.length < 2) { setSearchResults([]); return; }
    searchTimeout.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await api.get(`/players/search/autocomplete?q=${encodeURIComponent(q)}&limit=12`);
        setSearchResults(res.data?.results || []);
      } catch { setSearchResults([]); }
      setSearching(false);
    }, 300);
  }

  async function handleAddPlayer() {
    if (!selectedPlayer) return;
    setAdding(true);
    try {
      await api.post("/org-hub/dev-tracking", { player_id: selectedPlayer.id });
      setShowAddModal(false);
      setSelectedPlayer(null);
      setAddSearch("");
      await fetchDashboard();
    } catch { /* 409 duplicate */ }
    setAdding(false);
  }

  async function handleRemoveTracking(playerId: string) {
    if (!confirm("Remove this player from development tracking?")) return;
    try {
      await api.delete(`/org-hub/dev-tracking/${playerId}`);
      await fetchDashboard();
    } catch { /* ignore */ }
  }

  /* ── Generate single plan ──────────────────────────────── */
  const handleGenerate = async (playerId: string) => {
    setGenRow(playerId);
    try {
      await api.post(`/players/${playerId}/development-plans/generate`);
      await fetchDashboard();
    } catch {
      // silent
    } finally {
      setGenRow(null);
    }
  };

  /* ── Bulk generate missing plans ───────────────────────── */
  const handleBulkGenerate = async () => {
    setShowGenConfirm(false);
    const missing = (data?.players || []).filter((p) => !p.has_dev_plan);
    if (missing.length === 0) return;
    setGenerating(true);
    setGenProgress({ done: 0, total: missing.length });
    for (let i = 0; i < missing.length; i++) {
      try {
        await api.post(`/players/${missing[i].player_id}/development-plans/generate`);
      } catch {
        // continue on error
      }
      setGenProgress({ done: i + 1, total: missing.length });
    }
    setGenerating(false);
    await fetchDashboard();
  };

  const missingCount = (data?.players || []).filter((p) => !p.has_dev_plan).length;

  return (
    <ProtectedRoute>
      <NavBar />
      <main className="min-h-screen" style={{ background: "#F0F4F8" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

          {/* ── Header ──────────────────────────────────────── */}
          <div
            className="flex items-center justify-between mb-6"
            style={{ borderRadius: 12, border: "1.5px solid #DDE6EF", background: "#0F2942", padding: "16px 20px" }}
          >
            <div className="flex items-center gap-3">
              <Link href="/org-hub" className="hover:opacity-70 transition-opacity" style={{ color: "rgba(255,255,255,0.6)" }}>
                <ArrowLeft size={20} />
              </Link>
              <span className="w-2 h-2 rounded-full" style={{ background: "#14B8A6" }} />
              <TrendingUp size={16} className="text-white/80" />
              <div>
                <h1
                  className="font-bold uppercase text-white"
                  style={{ fontSize: 14, fontFamily: MONO, letterSpacing: 2 }}
                >
                  Development Dashboard
                </h1>
                <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.5)" }}>See every player&apos;s development status at a glance.</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {user && (
                <span
                  className="px-2.5 py-1 rounded-md text-white/60 font-bold uppercase hidden sm:block"
                  style={{ fontSize: 9, fontFamily: MONO, letterSpacing: 1, background: "rgba(255,255,255,0.1)" }}
                >
                  {user.org_name || "My Org"}
                </span>
              )}
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white font-bold uppercase transition-colors hover:opacity-90"
                style={{ fontSize: 10, fontFamily: MONO, letterSpacing: 1, background: "#EA580C" }}
              >
                <UserPlus size={12} />
                Add Player
              </button>
              {missingCount > 0 && !generating && (
                <button
                  onClick={() => setShowGenConfirm(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white font-bold uppercase transition-colors hover:opacity-90"
                  style={{ fontSize: 10, fontFamily: MONO, letterSpacing: 1, background: "#0D9488" }}
                >
                  <Sparkles size={12} />
                  Generate Missing ({missingCount})
                </button>
              )}
              {generating && (
                <span
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white/80 font-bold uppercase"
                  style={{ fontSize: 10, fontFamily: MONO, letterSpacing: 1, background: "rgba(255,255,255,0.1)" }}
                >
                  <Loader2 size={12} className="animate-spin" />
                  {genProgress.done}/{genProgress.total}
                </span>
              )}
            </div>
          </div>

          {/* ── Loading / Error ──────────────────────────────── */}
          {loading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={28} className="animate-spin" style={{ color: "#0D9488" }} />
            </div>
          )}
          {error && (
            <div className="text-center py-12">
              <p className="text-sm" style={{ color: "#EF4444" }}>{error}</p>
              <button onClick={fetchDashboard} className="mt-3 text-xs underline" style={{ color: "#0D9488" }}>
                Retry
              </button>
            </div>
          )}

          {!loading && !error && data && (
            <>
              {/* ── Summary Bar ──────────────────────────────── */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                {(["on_track", "needs_attention", "behind"] as const).map((key) => {
                  const cfg = STATUS_CONFIG[key];
                  const Icon = cfg.icon;
                  return (
                    <button
                      key={key}
                      onClick={() => setStatusFilter(statusFilter === key ? "all" : key)}
                      className="flex items-center gap-3 px-4 py-3.5 transition-all"
                      style={{
                        borderRadius: 12,
                        border: statusFilter === key ? `2px solid ${cfg.color}` : "1.5px solid #DDE6EF",
                        background: "#FFFFFF",
                        cursor: "pointer",
                      }}
                    >
                      <div
                        className="flex items-center justify-center"
                        style={{ width: 36, height: 36, borderRadius: 8, background: cfg.bg }}
                      >
                        <Icon size={18} style={{ color: cfg.color }} />
                      </div>
                      <div className="text-left">
                        <div
                          className="font-bold"
                          style={{ fontSize: 22, color: "#0F2942", fontFamily: MONO }}
                        >
                          {data.summary[key]}
                        </div>
                        <div
                          className="font-bold uppercase"
                          style={{ fontSize: 9, fontFamily: MONO, letterSpacing: 1.5, color: "#5A7291" }}
                        >
                          {cfg.label}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* ── Filter Bar ───────────────────────────────── */}
              <div
                className="flex flex-wrap items-center gap-3 mb-5 px-4 py-3"
                style={{ borderRadius: 12, border: "1.5px solid #DDE6EF", background: "#FFFFFF" }}
              >
                <Filter size={14} style={{ color: "#5A7291" }} />
                {/* Search */}
                <div className="relative flex-1 min-w-[180px]">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "#8BA4BB" }} />
                  <input
                    type="text"
                    placeholder="Search players…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 rounded-md text-xs"
                    style={{ border: "1px solid #DDE6EF", color: "#0F2942", fontFamily: MONO, background: "#F8FAFC" }}
                  />
                </div>
                {/* Position filter */}
                <select
                  value={posFilter}
                  onChange={(e) => setPosFilter(e.target.value)}
                  className="px-2.5 py-1.5 rounded-md text-xs font-bold uppercase"
                  style={{ border: "1px solid #DDE6EF", color: "#0F2942", fontFamily: MONO, letterSpacing: 1, background: "#F8FAFC" }}
                >
                  <option value="all">All Positions</option>
                  {positions.map((pos) => (
                    <option key={pos} value={pos!}>{pos}</option>
                  ))}
                </select>
                {/* Team filter */}
                <select
                  value={teamFilter}
                  onChange={(e) => setTeamFilter(e.target.value)}
                  className="px-2.5 py-1.5 rounded-md text-xs font-bold uppercase"
                  style={{ border: "1px solid #DDE6EF", color: "#0F2942", fontFamily: MONO, letterSpacing: 1, background: "#F8FAFC" }}
                >
                  <option value="all">All Teams</option>
                  {(data?.teams || []).map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                {/* Status filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-2.5 py-1.5 rounded-md text-xs font-bold uppercase"
                  style={{ border: "1px solid #DDE6EF", color: "#0F2942", fontFamily: MONO, letterSpacing: 1, background: "#F8FAFC" }}
                >
                  <option value="all">All Status</option>
                  <option value="on_track">On Track</option>
                  <option value="needs_attention">Needs Attention</option>
                  <option value="behind">Behind</option>
                </select>
                {/* Source filter */}
                <div className="flex items-center rounded-md overflow-hidden" style={{ border: "1px solid #DDE6EF" }}>
                  {(["all", "roster", "tracked"] as const).map((sf) => (
                    <button
                      key={sf}
                      onClick={() => setSourceFilter(sf)}
                      className="px-2.5 py-1.5 text-xs font-bold uppercase transition-colors"
                      style={{
                        fontFamily: MONO,
                        letterSpacing: 1,
                        background: sourceFilter === sf ? "#0F2942" : "#F8FAFC",
                        color: sourceFilter === sf ? "#FFFFFF" : "#5A7291",
                      }}
                    >
                      {sf === "all" ? "All" : sf === "roster" ? "Roster" : "Tracked"}
                    </button>
                  ))}
                </div>
                {/* Refresh */}
                <button
                  onClick={fetchDashboard}
                  className="p-1.5 rounded-md hover:opacity-70 transition-opacity"
                  style={{ border: "1px solid #DDE6EF", color: "#5A7291" }}
                  title="Refresh"
                >
                  <RefreshCw size={13} />
                </button>
              </div>

              {/* ── Roster Grid ──────────────────────────────── */}
              <div
                className="overflow-hidden"
                style={{ borderRadius: 12, border: "1.5px solid #DDE6EF" }}
              >
                {/* Table header */}
                <div
                  className="flex items-center gap-2 px-5 py-3"
                  style={{ background: "#0F2942" }}
                >
                  <span className="w-2 h-2 rounded-full" style={{ background: "#14B8A6" }} />
                  <span
                    className="font-bold uppercase text-white"
                    style={{ fontSize: 10, fontFamily: MONO, letterSpacing: 2 }}
                  >
                    Roster Development Status
                  </span>
                  <span
                    className="ml-auto text-white/40 font-bold uppercase"
                    style={{ fontSize: 9, fontFamily: MONO, letterSpacing: 1 }}
                  >
                    {filtered.length} player{filtered.length !== 1 ? "s" : ""}
                  </span>
                </div>

                {/* Column headers */}
                <div
                  className="grid items-center px-5 py-2.5"
                  style={{
                    gridTemplateColumns: "2fr 1.2fr 80px 80px 100px 2fr 140px",
                    background: "#F8FAFC",
                    borderBottom: "1px solid #DDE6EF",
                  }}
                >
                  {["Player", "Team", "Status", "Version", "Updated", "Key Focus", "Actions"].map((h) => (
                    <span
                      key={h}
                      className="font-bold uppercase"
                      style={{ fontSize: 9, fontFamily: MONO, letterSpacing: 1.5, color: "#5A7291" }}
                    >
                      {h}
                    </span>
                  ))}
                </div>

                {/* Rows */}
                {filtered.length === 0 ? (
                  <div className="bg-white px-5 py-12 text-center">
                    <CircleDot size={28} style={{ color: "#DDE6EF" }} className="mx-auto mb-3" />
                    <p className="text-xs" style={{ color: "#8BA4BB" }}>
                      {(data?.players || []).length === 0 ? 'No players found. Click "Add Player" or sync your roster from the dashboard.' : "No players match your filters."}
                    </p>
                  </div>
                ) : (
                  filtered.map((p, idx) => {
                    const cfg = STATUS_CONFIG[p.overall_status];
                    const Icon = cfg.icon;
                    const isGen = genRow === p.player_id;
                    return (
                      <div
                        key={p.player_id}
                        className="grid items-center px-5 py-3 transition-colors hover:bg-gray-50/50"
                        style={{
                          gridTemplateColumns: "2fr 1.2fr 80px 80px 100px 2fr 140px",
                          background: idx % 2 === 0 ? "#FFFFFF" : "#FAFCFE",
                          borderBottom: "1px solid #F0F4F8",
                        }}
                      >
                        {/* Player */}
                        <div className="flex items-center gap-2 min-w-0">
                          <Link
                            href={`/players/${p.player_id}`}
                            className="font-bold text-xs hover:underline truncate"
                            style={{ color: "#0F2942" }}
                          >
                            {p.last_name}, {p.first_name}
                          </Link>
                          {p.position && (
                            <span
                              className="shrink-0 px-1.5 py-0.5 rounded font-bold uppercase"
                              style={{ fontSize: 8, fontFamily: MONO, letterSpacing: 1, color: "#5A7291", background: "#F0F4F8" }}
                            >
                              {p.position}
                            </span>
                          )}
                          <span
                            className="shrink-0 px-1.5 py-0.5 rounded font-bold uppercase"
                            style={{
                              fontSize: 7,
                              fontFamily: MONO,
                              letterSpacing: 0.5,
                              color: p.source === "roster" ? "#0D9488" : "#EA580C",
                              background: p.source === "roster" ? "rgba(13,148,136,0.1)" : "rgba(234,88,12,0.1)",
                            }}
                          >
                            {p.source === "roster" ? "Roster" : "Tracked"}
                          </span>
                        </div>

                        {/* Team */}
                        <div className="min-w-0">
                          {p.current_team ? (
                            <Link
                              href={`/teams/${encodeURIComponent(p.current_team)}`}
                              className="text-xs hover:underline truncate block"
                              style={{ color: "#0F2942" }}
                            >
                              {p.current_team}
                            </Link>
                          ) : (
                            <span className="text-xs" style={{ color: "#CCD6E0" }}>—</span>
                          )}
                        </div>

                        {/* Status traffic light */}
                        <div className="flex items-center gap-1.5">
                          <div
                            className="flex items-center gap-1 px-2 py-0.5 rounded-full"
                            style={{ background: cfg.bg }}
                          >
                            <Icon size={11} style={{ color: cfg.color }} />
                            <span
                              className="font-bold uppercase"
                              style={{ fontSize: 8, fontFamily: MONO, letterSpacing: 0.5, color: cfg.color }}
                            >
                              {p.overall_status === "on_track" ? "OK" : p.overall_status === "needs_attention" ? "ATN" : "!"}
                            </span>
                          </div>
                        </div>

                        {/* Version */}
                        <span
                          className="font-bold"
                          style={{ fontSize: 11, fontFamily: MONO, color: p.has_dev_plan ? "#0F2942" : "#CCD6E0" }}
                        >
                          {p.has_dev_plan ? `v${p.plan_version}` : "—"}
                        </span>

                        {/* Updated */}
                        <span
                          className="font-bold"
                          style={{ fontSize: 10, fontFamily: MONO, color: "#5A7291" }}
                        >
                          {timeAgo(p.last_updated)}
                        </span>

                        {/* Key Focus */}
                        <span
                          className="text-xs truncate"
                          style={{ color: "#5A7291" }}
                          title={p.key_focus || "No focus areas set"}
                        >
                          {p.key_focus || (
                            <span style={{ color: "#CCD6E0", fontStyle: "italic" }}>No plan</span>
                          )}
                        </span>

                        {/* Actions */}
                        <div className="flex items-center gap-1.5 justify-end">
                          {p.has_dev_plan && (
                            <Link
                              href={`/players/${p.player_id}?tab=devplan`}
                              className="flex items-center gap-1 px-2 py-1 rounded-md text-white font-bold uppercase transition-colors hover:opacity-90"
                              style={{ fontSize: 8, fontFamily: MONO, letterSpacing: 0.5, background: "#0D9488" }}
                            >
                              <Eye size={10} />
                              View
                            </Link>
                          )}
                          {!p.has_dev_plan && (
                            <button
                              onClick={() => handleGenerate(p.player_id)}
                              disabled={isGen}
                              className="flex items-center gap-1 px-2 py-1 rounded-md text-white font-bold uppercase transition-colors hover:opacity-90 disabled:opacity-50"
                              style={{ fontSize: 8, fontFamily: MONO, letterSpacing: 0.5, background: "#EA580C" }}
                            >
                              {isGen ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
                              Generate
                            </button>
                          )}
                          {p.has_dev_plan && (
                            <button
                              onClick={() => handleGenerate(p.player_id)}
                              disabled={isGen}
                              className="flex items-center gap-1 px-1.5 py-1 rounded-md font-bold uppercase transition-colors hover:opacity-70 disabled:opacity-50"
                              style={{ fontSize: 8, fontFamily: MONO, letterSpacing: 0.5, color: "#5A7291", border: "1px solid #DDE6EF" }}
                              title="Regenerate plan"
                            >
                              {isGen ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
                            </button>
                          )}
                          {p.source === "tracked" && (
                            <button
                              onClick={() => handleRemoveTracking(p.player_id)}
                              className="flex items-center gap-1 px-1.5 py-1 rounded-md font-bold uppercase transition-colors hover:opacity-70"
                              style={{ fontSize: 8, fontFamily: MONO, letterSpacing: 0.5, color: "#EF4444", border: "1px solid rgba(239,68,68,0.2)" }}
                              title="Remove from tracking"
                            >
                              <Trash2 size={10} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}

          {/* ── Bulk Generate Confirmation Modal ──────────── */}
          {showGenConfirm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
              <div
                className="mx-4 w-full max-w-md"
                style={{ borderRadius: 12, border: "1.5px solid #DDE6EF", background: "#FFFFFF", overflow: "hidden" }}
              >
                <div className="flex items-center gap-2 px-5 py-3" style={{ background: "#0F2942" }}>
                  <Sparkles size={14} className="text-white/80" />
                  <span
                    className="font-bold uppercase text-white"
                    style={{ fontSize: 11, fontFamily: MONO, letterSpacing: 2 }}
                  >
                    Generate Missing Plans
                  </span>
                </div>
                <div className="px-5 py-5">
                  <p className="text-sm" style={{ color: "#0F2942" }}>
                    This will generate AI development plans for <strong>{missingCount}</strong> player{missingCount !== 1 ? "s" : ""} without a current plan.
                  </p>
                  <p className="text-xs mt-2" style={{ color: "#8BA4BB" }}>
                    Each plan takes a few seconds to generate. This process will run in the background.
                  </p>
                  <div className="flex items-center justify-end gap-2 mt-5">
                    <button
                      onClick={() => setShowGenConfirm(false)}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold uppercase"
                      style={{ fontFamily: MONO, letterSpacing: 1, color: "#5A7291", border: "1px solid #DDE6EF" }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleBulkGenerate}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-bold uppercase transition-colors hover:opacity-90"
                      style={{ fontFamily: MONO, letterSpacing: 1, background: "#0D9488" }}
                    >
                      <Sparkles size={11} />
                      Generate All
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Add Player Modal ───────────────────────── */}
          {showAddModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
              <div
                className="mx-4 w-full max-w-md"
                style={{ borderRadius: 12, border: "1.5px solid #DDE6EF", background: "#FFFFFF", overflow: "hidden" }}
              >
                <div className="flex items-center justify-between px-5 py-3" style={{ background: "#0F2942" }}>
                  <div className="flex items-center gap-2">
                    <UserPlus size={14} className="text-white/80" />
                    <span
                      className="font-bold uppercase text-white"
                      style={{ fontSize: 11, fontFamily: MONO, letterSpacing: 2 }}
                    >
                      Add Player to Tracking
                    </span>
                  </div>
                  <button onClick={() => { setShowAddModal(false); setSelectedPlayer(null); setAddSearch(""); }} className="text-white/50 hover:text-white/80">
                    <XIcon size={14} />
                  </button>
                </div>
                <div className="px-5 py-5 space-y-3">
                  <p className="text-xs" style={{ color: "#5A7291" }}>
                    Search for a player to add to your development tracking list.
                  </p>
                  {/* Search input */}
                  <div className="relative">
                    <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "#8BA4BB" }} />
                    <input
                      value={addSearch}
                      onChange={(e) => handleAddSearch(e.target.value)}
                      className="w-full pl-7 pr-3 py-2 rounded-lg text-sm"
                      style={{ border: "1.5px solid #DDE6EF", color: "#0F2942", outline: "none" }}
                      placeholder="Type player name..."
                      autoFocus
                    />
                  </div>
                  {/* Results */}
                  {(searchResults.length > 0 || searching) && !selectedPlayer && (
                    <div className="max-h-48 overflow-y-auto rounded-lg" style={{ border: "1.5px solid #DDE6EF" }}>
                      {searching && (
                        <div className="flex items-center gap-2 px-3 py-2">
                          <Loader2 size={12} className="animate-spin" style={{ color: "#0D9488" }} />
                          <span className="text-xs" style={{ color: "#5A7291" }}>Searching...</span>
                        </div>
                      )}
                      {searchResults.map((sr) => {
                        const alreadyTracked = (data?.players || []).some((dp) => dp.player_id === sr.id);
                        return (
                          <button
                            key={sr.id}
                            onClick={() => { if (!alreadyTracked) setSelectedPlayer(sr); }}
                            disabled={alreadyTracked}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 flex items-center gap-2 border-b last:border-b-0"
                            style={{ borderColor: "#DDE6EF", opacity: alreadyTracked ? 0.4 : 1 }}
                          >
                            <span className="font-bold" style={{ color: "#0F2942" }}>{sr.first_name} {sr.last_name}</span>
                            {sr.position && <span className="text-[9px] uppercase" style={{ color: "#5A7291" }}>{sr.position}</span>}
                            {sr.current_team && <span className="text-[10px]" style={{ color: "#8BA4BB" }}>{sr.current_team}</span>}
                            {alreadyTracked && <span className="text-[9px] ml-auto" style={{ color: "#8BA4BB" }}>Already on list</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {/* Selected player */}
                  {selectedPlayer && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: "rgba(13,148,136,0.06)", border: "1.5px solid rgba(13,148,136,0.2)" }}>
                      <span className="text-sm font-bold" style={{ color: "#0F2942" }}>{selectedPlayer.first_name} {selectedPlayer.last_name}</span>
                      {selectedPlayer.position && <span className="text-[10px]" style={{ color: "#5A7291" }}>{selectedPlayer.position}</span>}
                      {selectedPlayer.current_team && <span className="text-[10px]" style={{ color: "#8BA4BB" }}>{selectedPlayer.current_team}</span>}
                      <button onClick={() => { setSelectedPlayer(null); setAddSearch(""); }} className="ml-auto"><XIcon size={12} style={{ color: "#8BA4BB" }} /></button>
                    </div>
                  )}
                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      onClick={() => { setShowAddModal(false); setSelectedPlayer(null); setAddSearch(""); }}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold uppercase"
                      style={{ fontFamily: MONO, letterSpacing: 1, color: "#5A7291", border: "1px solid #DDE6EF" }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddPlayer}
                      disabled={!selectedPlayer || adding}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-bold uppercase transition-colors hover:opacity-90 disabled:opacity-50"
                      style={{ fontFamily: MONO, letterSpacing: 1, background: "#0D9488" }}
                    >
                      {adding && <Loader2 size={11} className="animate-spin" />}
                      Add to Tracking
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>
    </ProtectedRoute>
  );
}
