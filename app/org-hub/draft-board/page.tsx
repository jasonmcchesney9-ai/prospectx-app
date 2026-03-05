"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Trophy,
  Plus,
  Sparkles,
  Loader2,
  ChevronUp,
  GripVertical,
  Search,
  XIcon,
  MoreVertical,
  List,
  Layers,
} from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import api from "@/lib/api";
import { getUser } from "@/lib/auth";

/* ── Types ────────────────────────────────────────────────── */
interface DraftEntry {
  id: string;
  player_id: string;
  board_rank: number;
  tier: string;
  scout_grade: string | null;
  notes: string | null;
  tags: string[];
  first_name: string;
  last_name: string;
  position: string | null;
  current_team: string | null;
  current_league: string | null;
  birth_year: number | null;
  jersey_number: string | null;
  image_url: string | null;
  gp: number | null;
  g: number | null;
  a: number | null;
  pts: number | null;
  ppg: number | null;
  pxr_score: number | null;
  pxr_confidence: string | null;
}

interface SearchResult {
  id: string;
  first_name: string;
  last_name: string;
  position: string | null;
  current_team: string | null;
  jersey_number: string | null;
}

/* ── Constants ────────────────────────────────────────────── */
const TIERS: { key: string; label: string; color: string; bg: string }[] = [
  { key: "target", label: "Target", color: "#0D9488", bg: "rgba(13,148,136,0.1)" },
  { key: "watch", label: "Watch", color: "#0F2942", bg: "rgba(15,41,66,0.08)" },
  { key: "sleeper", label: "Sleeper", color: "#EA580C", bg: "rgba(234,88,12,0.1)" },
  { key: "pass", label: "Pass", color: "#8BA4BB", bg: "rgba(139,164,187,0.15)" },
];

type ViewMode = "flat" | "tier";

/* ── Helpers ──────────────────────────────────────────────── */
function pxrColor(score: number | null): string {
  if (!score) return "#8BA4BB";
  if (score >= 75) return "#16A34A";
  if (score >= 50) return "#0D9488";
  if (score >= 25) return "#EA580C";
  return "#DC2626";
}

function playerAge(birthYear: number | null): string {
  if (!birthYear) return "";
  return `${2026 - birthYear}`;
}

function tierConfig(tier: string) {
  return TIERS.find((t) => t.key === tier) || TIERS[1];
}

/* ── Page ─────────────────────────────────────────────────── */
export default function DraftBoardPage() {
  const user = getUser();
  const orgName = user?.org_short_name || user?.org_name || "Your Organization";

  const [entries, setEntries] = useState<DraftEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [posFilter, setPosFilter] = useState("All");
  const [leagueFilter, setLeagueFilter] = useState("All");
  const [yearFilter, setYearFilter] = useState("All");
  const [tierFilter, setTierFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("flat");

  // Add player modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addSearch, setAddSearch] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<SearchResult | null>(null);
  const [addTier, setAddTier] = useState("watch");
  const [addNotes, setAddNotes] = useState("");
  const [adding, setAdding] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // PXI analysis
  const [showPxi, setShowPxi] = useState(false);
  const [pxiLoading, setPxiLoading] = useState(false);
  const [analysis, setAnalysis] = useState("");

  // Drag state
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // Action menus
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [editTierId, setEditTierId] = useState<string | null>(null);

  /* ── Fetch entries ─────────────────────────────────────── */
  const fetchEntries = useCallback(() => {
    api.get("/org-hub/draft-board").then((res) => {
      setEntries(res.data?.entries || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  /* ── Derived filter data ───────────────────────────────── */
  const leagues = Array.from(new Set(entries.map((e) => e.current_league).filter(Boolean) as string[])).sort();
  const years = Array.from(new Set(entries.map((e) => e.birth_year).filter(Boolean) as number[])).sort();

  /* ── Filtered entries ──────────────────────────────────── */
  const filtered = entries.filter((e) => {
    if (posFilter !== "All") {
      const pos = (e.position || "").toUpperCase();
      if (posFilter === "F" && !["LW", "C", "RW", "F", "W"].includes(pos)) return false;
      if (posFilter === "D" && !["LD", "RD", "D"].includes(pos)) return false;
      if (posFilter === "G" && pos !== "G") return false;
    }
    if (leagueFilter !== "All" && e.current_league !== leagueFilter) return false;
    if (yearFilter !== "All" && String(e.birth_year) !== yearFilter) return false;
    if (tierFilter !== "All" && e.tier !== tierFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const name = `${e.first_name} ${e.last_name}`.toLowerCase();
      if (!name.includes(q)) return false;
    }
    return true;
  });

  /* ── Player search for add modal ───────────────────────── */
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

  /* ── Add player to board ───────────────────────────────── */
  async function handleAddPlayer() {
    if (!selectedPlayer) return;
    setAdding(true);
    try {
      await api.post("/org-hub/draft-board", {
        player_id: selectedPlayer.id,
        tier: addTier,
        notes: addNotes.trim() || undefined,
      });
      setShowAddModal(false);
      setSelectedPlayer(null);
      setAddSearch("");
      setAddNotes("");
      setAddTier("watch");
      fetchEntries();
    } catch { /* ignore — likely 409 duplicate */ }
    setAdding(false);
  }

  /* ── Change tier ───────────────────────────────────────── */
  async function changeTier(entryId: string, newTier: string) {
    setEditTierId(null);
    setOpenMenuId(null);
    await api.patch(`/org-hub/draft-board/${entryId}`, { tier: newTier }).catch(() => {});
    setEntries((prev) => prev.map((e) => e.id === entryId ? { ...e, tier: newTier } : e));
  }

  /* ── Remove from board ─────────────────────────────────── */
  async function removeEntry(entryId: string) {
    setOpenMenuId(null);
    await api.delete(`/org-hub/draft-board/${entryId}`).catch(() => {});
    setEntries((prev) => prev.filter((e) => e.id !== entryId));
  }

  /* ── Drag & Drop ───────────────────────────────────────── */
  function handleDragStart(id: string) { setDragId(id); }
  function handleDragOver(e: React.DragEvent, id: string) { e.preventDefault(); setDragOverId(id); }
  function handleDragEnd() { setDragId(null); setDragOverId(null); }

  async function handleDrop(targetId: string) {
    if (!dragId || dragId === targetId) { setDragId(null); setDragOverId(null); return; }
    const newList = [...entries];
    const fromIdx = newList.findIndex((e) => e.id === dragId);
    const toIdx = newList.findIndex((e) => e.id === targetId);
    if (fromIdx === -1 || toIdx === -1) { setDragId(null); setDragOverId(null); return; }
    const [moved] = newList.splice(fromIdx, 1);
    newList.splice(toIdx, 0, moved);
    // Reassign ranks
    const ranked = newList.map((e, i) => ({ ...e, board_rank: i + 1 }));
    setEntries(ranked);
    setDragId(null);
    setDragOverId(null);
    // Persist
    await api.post("/org-hub/draft-board/reorder", {
      ranks: ranked.map((e) => ({ id: e.id, board_rank: e.board_rank })),
    }).catch(() => {});
  }

  /* ── PXI analysis ──────────────────────────────────────── */
  async function handlePxiAnalyse() {
    setPxiLoading(true);
    setShowPxi(true);
    try {
      const res = await api.post("/org-hub/draft-board/analyse", { team_name: orgName });
      setAnalysis(res.data?.analysis || "No analysis generated.");
    } catch { setAnalysis("Failed to generate analysis."); }
    setPxiLoading(false);
  }

  /* ── Render an entry row ───────────────────────────────── */
  function EntryRow({ entry }: { entry: DraftEntry }) {
    const tc = tierConfig(entry.tier);
    const isDragging = dragId === entry.id;
    const isDragOver = dragOverId === entry.id;
    return (
      <div
        draggable
        onDragStart={() => handleDragStart(entry.id)}
        onDragOver={(e) => handleDragOver(e, entry.id)}
        onDragEnd={handleDragEnd}
        onDrop={() => handleDrop(entry.id)}
        className="flex items-center gap-3 px-4 py-3 transition-all"
        style={{
          borderBottom: "1px solid #DDE6EF",
          background: isDragOver ? "rgba(13,148,136,0.05)" : isDragging ? "rgba(15,41,66,0.03)" : "white",
          opacity: isDragging ? 0.5 : 1,
          borderLeft: isDragOver ? "3px solid #0D9488" : "3px solid transparent",
        }}
      >
        {/* Drag handle + Rank */}
        <div className="flex items-center gap-2 shrink-0" style={{ width: 56 }}>
          <GripVertical size={14} className="cursor-grab" style={{ color: "#8BA4BB" }} />
          <span className="text-lg font-bold" style={{ color: "#0D9488", fontFamily: "ui-monospace, monospace" }}>
            {entry.board_rank}
          </span>
        </div>

        {/* Player info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/players/${entry.player_id}`}
              className="text-sm font-bold hover:underline truncate"
              style={{ color: "#0F2942" }}
            >
              {entry.first_name} {entry.last_name}
            </Link>
            {entry.position && (
              <span
                className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded"
                style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 1, color: "#0F2942", background: "rgba(15,41,66,0.06)", border: "1px solid #DDE6EF" }}
              >
                {entry.position}
              </span>
            )}
            {entry.current_team && (
              <Link href={`/teams/${encodeURIComponent(entry.current_team)}`} className="text-[11px] truncate hover:text-teal transition-colors" style={{ color: "#5A7291" }}>
                {entry.current_team}
              </Link>
            )}
            {entry.current_league && (
              <Link href={`/leagues?league=${encodeURIComponent(entry.current_league)}`} className="text-[10px] hover:text-teal transition-colors" style={{ color: "#8BA4BB" }}>
                {entry.current_league}
              </Link>
            )}
            {entry.birth_year && (
              <span className="text-[10px]" style={{ color: "#8BA4BB" }}>
                Age {playerAge(entry.birth_year)}
              </span>
            )}
          </div>
          {/* Stats row */}
          <div className="flex items-center gap-3 mt-0.5">
            {entry.gp != null && (
              <span className="text-[10px]" style={{ color: "#5A7291", fontFamily: "ui-monospace, monospace" }}>
                {entry.gp}GP {entry.g}G {entry.a}A {entry.pts}P
              </span>
            )}
            {entry.ppg != null && (
              <span className="text-[10px]" style={{ color: "#5A7291", fontFamily: "ui-monospace, monospace" }}>
                {entry.ppg.toFixed(2)} PPG
              </span>
            )}
            {entry.scout_grade && (
              <span className="text-[10px] font-bold" style={{ color: "#0D9488" }}>
                Grade: {entry.scout_grade}
              </span>
            )}
          </div>
        </div>

        {/* PXR badge */}
        <div className="shrink-0 text-center" style={{ width: 48 }}>
          {entry.pxr_score != null ? (
            <span
              className="inline-block px-2 py-1 rounded-md text-xs font-bold"
              style={{ color: "white", background: pxrColor(entry.pxr_score), fontFamily: "ui-monospace, monospace" }}
            >
              {entry.pxr_score.toFixed(1)}
            </span>
          ) : (
            <span className="text-[9px]" style={{ color: "#8BA4BB" }}>—</span>
          )}
        </div>

        {/* Tier badge */}
        <div className="shrink-0" style={{ width: 64 }}>
          <span
            className="inline-block px-2 py-1 rounded text-[9px] font-bold uppercase text-center w-full"
            style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 1, color: tc.color, background: tc.bg }}
          >
            {tc.label}
          </span>
        </div>

        {/* Action menu */}
        <div className="shrink-0 relative" style={{ width: 28 }}>
          <button
            onClick={() => setOpenMenuId(openMenuId === entry.id ? null : entry.id)}
            className="p-1 rounded hover:bg-gray-100"
          >
            <MoreVertical size={14} style={{ color: "#8BA4BB" }} />
          </button>
          {openMenuId === entry.id && (
            <div
              className="absolute right-0 top-8 z-40 bg-white shadow-lg rounded-lg py-1 w-48"
              style={{ border: "1.5px solid #DDE6EF" }}
            >
              <button
                onClick={() => { setEditTierId(entry.id); setOpenMenuId(null); }}
                className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50"
                style={{ color: "#0F2942" }}
              >
                Change Tier
              </button>
              <Link
                href={`/reports/generate?player_id=${entry.player_id}`}
                className="block w-full text-left px-3 py-2 text-xs hover:bg-gray-50"
                style={{ color: "#0F2942" }}
              >
                Generate Scout Report
              </Link>
              <button
                onClick={() => removeEntry(entry.id)}
                className="w-full text-left px-3 py-2 text-xs hover:bg-red-50"
                style={{ color: "#DC2626" }}
              >
                Remove from Board
              </button>
            </div>
          )}
          {/* Tier picker sub-menu */}
          {editTierId === entry.id && (
            <div
              className="absolute right-0 top-8 z-40 bg-white shadow-lg rounded-lg py-1 w-36"
              style={{ border: "1.5px solid #DDE6EF" }}
            >
              {TIERS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => changeTier(entry.id, t.key)}
                  className="w-full text-left px-3 py-2 text-xs font-bold uppercase hover:bg-gray-50"
                  style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 1, color: t.color }}
                >
                  {t.label}
                </button>
              ))}
              <button
                onClick={() => setEditTierId(null)}
                className="w-full text-left px-3 py-1.5 text-[10px] hover:bg-gray-50 border-t"
                style={{ color: "#8BA4BB", borderColor: "#DDE6EF" }}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ── Main Render ───────────────────────────────────────── */
  return (
    <ProtectedRoute>
      <NavBar />
      <main className="min-h-screen" style={{ background: "#F0F4F8" }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

          {/* ── Header ────────────────────────────────────── */}
          <div
            className="flex items-center justify-between mb-6"
            style={{ borderRadius: 12, border: "1.5px solid #DDE6EF", background: "#0F2942", padding: "16px 20px" }}
          >
            <div className="flex items-center gap-3">
              <Link href="/org-hub" className="hover:opacity-70 transition-opacity" style={{ color: "rgba(255,255,255,0.6)" }}>
                <ArrowLeft size={20} />
              </Link>
              <span className="w-2 h-2 rounded-full" style={{ background: "#14B8A6" }} />
              <Trophy size={16} className="text-white/80" />
              <h1
                className="font-bold uppercase text-white"
                style={{ fontSize: 14, fontFamily: "ui-monospace, monospace", letterSpacing: 2 }}
              >
                Draft Board
              </h1>
              <span className="text-xs text-white/40" style={{ fontFamily: "ui-monospace, monospace" }}>
                {orgName}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePxiAnalyse}
                disabled={pxiLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-colors hover:opacity-90"
                style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 1, color: "#FFFFFF", background: "rgba(13,148,136,0.8)", border: "1px solid rgba(255,255,255,0.15)" }}
              >
                {pxiLoading ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                PXI Analyse
              </button>
              <button
                onClick={() => { setShowAddModal(true); setAddSearch(""); setSearchResults([]); setSelectedPlayer(null); setAddTier("watch"); setAddNotes(""); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-colors hover:opacity-90"
                style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 1, color: "#FFFFFF", background: "#0D9488" }}
              >
                <Plus size={11} />
                Add Player
              </button>
            </div>
          </div>

          {/* ── PXI Analysis ──────────────────────────────── */}
          {showPxi && (
            <div className="mb-6 overflow-hidden" style={{ borderRadius: 12, border: "1.5px solid rgba(13,148,136,0.25)" }}>
              <div
                className="flex items-center justify-between px-5 py-3 cursor-pointer"
                style={{ background: "rgba(13,148,136,0.06)" }}
                onClick={() => setShowPxi(false)}
              >
                <div className="flex items-center gap-2">
                  <Sparkles size={14} style={{ color: "#0D9488" }} />
                  <span className="font-bold uppercase" style={{ fontSize: 10, fontFamily: "ui-monospace, monospace", letterSpacing: 2, color: "#0D9488" }}>
                    PXI Draft Analysis
                  </span>
                </div>
                <ChevronUp size={14} style={{ color: "#0D9488" }} />
              </div>
              <div className="bg-white px-5 py-4">
                {pxiLoading ? (
                  <div className="flex items-center justify-center py-8 gap-2">
                    <Loader2 size={16} className="animate-spin" style={{ color: "#0D9488" }} />
                    <span className="text-xs" style={{ color: "#5A7291" }}>Analysing draft board...</span>
                  </div>
                ) : (
                  <pre className="text-xs whitespace-pre-wrap" style={{ color: "#0F2942", lineHeight: 1.6, fontFamily: "inherit" }}>
                    {analysis}
                  </pre>
                )}
              </div>
            </div>
          )}

          {/* ── Filter Bar ────────────────────────────────── */}
          <div className="mb-4 overflow-hidden" style={{ borderRadius: 12, border: "1.5px solid #DDE6EF" }}>
            <div className="bg-white px-4 py-3 flex flex-wrap items-center gap-2">
              {/* Search */}
              <div className="relative flex-1 min-w-[140px]">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "#8BA4BB" }} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-7 pr-2 py-1.5 rounded-lg text-xs"
                  style={{ border: "1.5px solid #DDE6EF", color: "#0F2942", outline: "none" }}
                  placeholder="Search by name..."
                />
              </div>

              {/* Position */}
              {["All", "F", "D", "G"].map((p) => (
                <button
                  key={p}
                  onClick={() => setPosFilter(p)}
                  className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase"
                  style={{
                    fontFamily: "ui-monospace, monospace", letterSpacing: 1,
                    color: posFilter === p ? "#FFFFFF" : "#0F2942",
                    background: posFilter === p ? "#0F2942" : "rgba(15,41,66,0.04)",
                    border: `1px solid ${posFilter === p ? "#0F2942" : "#DDE6EF"}`,
                  }}
                >
                  {p}
                </button>
              ))}

              {/* League */}
              <select
                value={leagueFilter}
                onChange={(e) => setLeagueFilter(e.target.value)}
                className="px-2 py-1.5 rounded-lg text-[10px] font-bold uppercase"
                style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 1, border: "1px solid #DDE6EF", color: "#0F2942", outline: "none", background: "white" }}
              >
                <option value="All">All Leagues</option>
                {leagues.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>

              {/* Birth Year */}
              <select
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value)}
                className="px-2 py-1.5 rounded-lg text-[10px] font-bold uppercase"
                style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 1, border: "1px solid #DDE6EF", color: "#0F2942", outline: "none", background: "white" }}
              >
                <option value="All">All Years</option>
                {years.map((y) => <option key={y} value={String(y)}>{y}</option>)}
              </select>

              {/* Tier */}
              <select
                value={tierFilter}
                onChange={(e) => setTierFilter(e.target.value)}
                className="px-2 py-1.5 rounded-lg text-[10px] font-bold uppercase"
                style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 1, border: "1px solid #DDE6EF", color: "#0F2942", outline: "none", background: "white" }}
              >
                <option value="All">All Tiers</option>
                {TIERS.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>

              {/* View toggle */}
              <div className="flex items-center rounded-lg overflow-hidden" style={{ border: "1px solid #DDE6EF" }}>
                <button
                  onClick={() => setViewMode("flat")}
                  className="px-2 py-1.5"
                  style={{ background: viewMode === "flat" ? "#0F2942" : "white" }}
                  title="Flat List"
                >
                  <List size={12} style={{ color: viewMode === "flat" ? "white" : "#8BA4BB" }} />
                </button>
                <button
                  onClick={() => setViewMode("tier")}
                  className="px-2 py-1.5"
                  style={{ background: viewMode === "tier" ? "#0F2942" : "white" }}
                  title="Tier View"
                >
                  <Layers size={12} style={{ color: viewMode === "tier" ? "white" : "#8BA4BB" }} />
                </button>
              </div>

              {/* Count */}
              <span className="text-[10px]" style={{ color: "#8BA4BB", fontFamily: "ui-monospace, monospace" }}>
                {filtered.length} prospect{filtered.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>

          {/* ── Loading ───────────────────────────────────── */}
          {loading && (
            <div className="flex items-center justify-center py-16 gap-2">
              <Loader2 size={18} className="animate-spin" style={{ color: "#0D9488" }} />
              <span className="text-sm" style={{ color: "#5A7291" }}>Loading draft board...</span>
            </div>
          )}

          {/* ── Flat View ─────────────────────────────────── */}
          {!loading && viewMode === "flat" && (
            <div className="overflow-hidden" style={{ borderRadius: 12, border: "1.5px solid #DDE6EF" }}>
              <div className="flex items-center gap-2 px-5 py-3" style={{ background: "#0F2942" }}>
                <span className="w-2 h-2 rounded-full" style={{ background: "#14B8A6" }} />
                <span className="font-bold uppercase text-white" style={{ fontSize: 10, fontFamily: "ui-monospace, monospace", letterSpacing: 2 }}>
                  Prospect Rankings
                </span>
                <span className="text-[10px] text-white/40" style={{ fontFamily: "ui-monospace, monospace" }}>
                  {filtered.length}
                </span>
              </div>
              {filtered.length === 0 ? (
                <div className="bg-white px-5 py-12 text-center">
                  <Trophy size={36} style={{ color: "#DDE6EF" }} className="mx-auto mb-3" />
                  <p className="text-xs" style={{ color: "#8BA4BB" }}>
                    {entries.length === 0 ? 'No prospects on the board. Click "Add Player" to start.' : "No prospects match your filters."}
                  </p>
                </div>
              ) : (
                <div>
                  {filtered.map((entry) => (
                    <EntryRow key={entry.id} entry={entry} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Tier View ─────────────────────────────────── */}
          {!loading && viewMode === "tier" && (
            <div className="space-y-4">
              {TIERS.map((tier) => {
                const tierEntries = filtered.filter((e) => e.tier === tier.key);
                return (
                  <div key={tier.key} className="overflow-hidden" style={{ borderRadius: 12, border: "1.5px solid #DDE6EF", borderLeft: `3px solid ${tier.color}` }}>
                    <div className="flex items-center gap-2 px-5 py-3" style={{ background: "#0F2942" }}>
                      <span className="w-2 h-2 rounded-full" style={{ background: tier.color }} />
                      <span className="font-bold uppercase text-white" style={{ fontSize: 10, fontFamily: "ui-monospace, monospace", letterSpacing: 2 }}>
                        {tier.label}
                      </span>
                      <span className="text-[10px] text-white/40" style={{ fontFamily: "ui-monospace, monospace" }}>
                        {tierEntries.length}
                      </span>
                    </div>
                    {tierEntries.length === 0 ? (
                      <div className="bg-white px-5 py-6 text-center">
                        <p className="text-[11px]" style={{ color: "#8BA4BB" }}>No prospects in this tier.</p>
                      </div>
                    ) : (
                      <div>
                        {tierEntries.map((entry) => (
                          <EntryRow key={entry.id} entry={entry} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

        </div>
      </main>

      {/* ── Add Player Modal ─────────────────────────────── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white w-full max-w-lg mx-4 overflow-hidden" style={{ borderRadius: 12, border: "1.5px solid #DDE6EF" }}>
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-3" style={{ background: "#0F2942" }}>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ background: "#14B8A6" }} />
                <span className="font-bold uppercase text-white" style={{ fontSize: 10, fontFamily: "ui-monospace, monospace", letterSpacing: 2 }}>
                  Add to Draft Board
                </span>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-white/50 hover:text-white/80">
                <XIcon size={14} />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              {/* Search */}
              <div>
                <label className="block text-[10px] font-bold uppercase mb-1" style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 1, color: "#5A7291" }}>
                  Search Player
                </label>
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
                  <div className="mt-1 max-h-48 overflow-y-auto rounded-lg" style={{ border: "1.5px solid #DDE6EF" }}>
                    {searching && (
                      <div className="flex items-center gap-2 px-3 py-2">
                        <Loader2 size={12} className="animate-spin" style={{ color: "#0D9488" }} />
                        <span className="text-xs" style={{ color: "#5A7291" }}>Searching...</span>
                      </div>
                    )}
                    {searchResults.map((p) => {
                      const alreadyOnBoard = entries.some((e) => e.player_id === p.id);
                      return (
                        <button
                          key={p.id}
                          onClick={() => { if (!alreadyOnBoard) setSelectedPlayer(p); }}
                          disabled={alreadyOnBoard}
                          className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 flex items-center gap-2 border-b last:border-b-0"
                          style={{ borderColor: "#DDE6EF", opacity: alreadyOnBoard ? 0.4 : 1 }}
                        >
                          <span className="font-bold" style={{ color: "#0F2942" }}>{p.first_name} {p.last_name}</span>
                          {p.position && <span className="text-[9px] uppercase" style={{ color: "#5A7291" }}>{p.position}</span>}
                          {p.current_team && <span className="text-[10px]" style={{ color: "#8BA4BB" }}>{p.current_team}</span>}
                          {alreadyOnBoard && <span className="text-[9px] ml-auto" style={{ color: "#8BA4BB" }}>On board</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
                {/* Selected player */}
                {selectedPlayer && (
                  <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: "rgba(13,148,136,0.06)", border: "1.5px solid rgba(13,148,136,0.2)" }}>
                    <span className="text-sm font-bold" style={{ color: "#0F2942" }}>{selectedPlayer.first_name} {selectedPlayer.last_name}</span>
                    {selectedPlayer.position && <span className="text-[10px]" style={{ color: "#5A7291" }}>{selectedPlayer.position}</span>}
                    <button onClick={() => { setSelectedPlayer(null); setAddSearch(""); }} className="ml-auto"><XIcon size={12} style={{ color: "#8BA4BB" }} /></button>
                  </div>
                )}
              </div>

              {/* Tier */}
              <div>
                <label className="block text-[10px] font-bold uppercase mb-1" style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 1, color: "#5A7291" }}>
                  Tier
                </label>
                <div className="flex gap-2">
                  {TIERS.filter((t) => t.key !== "pass").map((t) => (
                    <button
                      key={t.key}
                      onClick={() => setAddTier(t.key)}
                      className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase"
                      style={{
                        fontFamily: "ui-monospace, monospace", letterSpacing: 1,
                        color: addTier === t.key ? "#FFFFFF" : t.color,
                        background: addTier === t.key ? t.color : t.bg,
                        border: `1.5px solid ${addTier === t.key ? t.color : "transparent"}`,
                      }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-[10px] font-bold uppercase mb-1" style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 1, color: "#5A7291" }}>
                  Notes (optional)
                </label>
                <textarea
                  value={addNotes}
                  onChange={(e) => setAddNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm resize-none"
                  style={{ border: "1.5px solid #DDE6EF", color: "#0F2942", outline: "none" }}
                  rows={2}
                  placeholder="Initial scouting notes..."
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg text-xs font-bold uppercase"
                  style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 1, color: "#5A7291", border: "1.5px solid #DDE6EF" }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddPlayer}
                  disabled={adding || !selectedPlayer}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold uppercase transition-colors hover:opacity-90"
                  style={{
                    fontFamily: "ui-monospace, monospace", letterSpacing: 1,
                    color: "#FFFFFF", background: "#0D9488",
                    opacity: adding || !selectedPlayer ? 0.6 : 1,
                  }}
                >
                  {adding && <Loader2 size={11} className="animate-spin" />}
                  Add to Board
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Close menus on outside click */}
      {(openMenuId || editTierId) && (
        <div className="fixed inset-0 z-30" onClick={() => { setOpenMenuId(null); setEditTierId(null); }} />
      )}
    </ProtectedRoute>
  );
}
