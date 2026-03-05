"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowLeftRight,
  Plus,
  Sparkles,
  Loader2,
  ChevronUp,
  GripVertical,
  Search,
  XIcon,
  MoreVertical,
  Eye,
  Target,
  Package,
} from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import api from "@/lib/api";
import { getUser } from "@/lib/auth";
import MicButton from "@/components/MicButton";

/* ── Types ────────────────────────────────────────────────── */
interface TradeEntry {
  id: string;
  player_id: string;
  board_type: string;
  priority: number;
  asking_price: string | null;
  notes: string | null;
  tags: string[];
  status: string;
  first_name: string;
  last_name: string;
  position: string | null;
  current_team: string | null;
  current_league: string | null;
  birth_year: number | null;
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

/* ── Column config ────────────────────────────────────────── */
const COLUMNS: { key: string; label: string; icon: React.ElementType; color: string; accent: string; bg: string }[] = [
  { key: "target", label: "Targets", icon: Target, color: "#0D9488", accent: "#0D9488", bg: "rgba(13,148,136,0.06)" },
  { key: "watching", label: "Watching", icon: Eye, color: "#0F2942", accent: "#5A7291", bg: "rgba(15,41,66,0.04)" },
  { key: "available", label: "Available", icon: Package, color: "#EA580C", accent: "#EA580C", bg: "rgba(234,88,12,0.06)" },
];

const BOARD_TYPES = ["target", "watching", "available"];

/* ── Helpers ──────────────────────────────────────────────── */
function pxrColor(score: number | null): string {
  if (!score) return "#8BA4BB";
  if (score >= 75) return "#16A34A";
  if (score >= 50) return "#0D9488";
  if (score >= 25) return "#EA580C";
  return "#DC2626";
}

function colConfig(key: string) {
  return COLUMNS.find((c) => c.key === key) || COLUMNS[0];
}

/* ── Page ─────────────────────────────────────────────────── */
export default function TradeBoardPage() {
  const user = getUser();
  const orgName = user?.org_short_name || user?.org_name || "Your Organization";

  const [entries, setEntries] = useState<TradeEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Add modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addSearch, setAddSearch] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<SearchResult | null>(null);
  const [addBoardType, setAddBoardType] = useState("target");
  const [addAskingPrice, setAddAskingPrice] = useState("");
  const [addNotes, setAddNotes] = useState("");
  const [adding, setAdding] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // PXI analysis
  const [showPxi, setShowPxi] = useState(false);
  const [pxiLoading, setPxiLoading] = useState(false);
  const [analysis, setAnalysis] = useState("");

  // Inline editing
  const [editPriceId, setEditPriceId] = useState<string | null>(null);
  const [editPriceVal, setEditPriceVal] = useState("");
  const [expandedNotes, setExpandedNotes] = useState<string | null>(null);

  // Action menus
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Drag state
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

  /* ── Fetch ───────────────────────────────────────────────── */
  const fetchEntries = useCallback(() => {
    api.get("/org-hub/trade-board").then((res) => {
      setEntries(res.data?.entries || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  /* ── Grouped entries ─────────────────────────────────────── */
  function grouped(type: string): TradeEntry[] {
    return entries.filter((e) => e.board_type === type);
  }

  /* ── Player search ───────────────────────────────────────── */
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

  /* ── Add player ──────────────────────────────────────────── */
  async function handleAddPlayer() {
    if (!selectedPlayer) return;
    setAdding(true);
    try {
      await api.post("/org-hub/trade-board", {
        player_id: selectedPlayer.id,
        board_type: addBoardType,
        asking_price: addAskingPrice.trim() || undefined,
        notes: addNotes.trim() || undefined,
      });
      setShowAddModal(false);
      setSelectedPlayer(null);
      setAddSearch("");
      setAddAskingPrice("");
      setAddNotes("");
      setAddBoardType("target");
      fetchEntries();
    } catch { /* 409 duplicate */ }
    setAdding(false);
  }

  /* ── Move between columns ────────────────────────────────── */
  async function moveEntry(entryId: string, newType: string) {
    setOpenMenuId(null);
    await api.patch(`/org-hub/trade-board/${entryId}`, { board_type: newType }).catch(() => {});
    setEntries((prev) => prev.map((e) => e.id === entryId ? { ...e, board_type: newType } : e));
  }

  /* ── Remove ──────────────────────────────────────────────── */
  async function removeEntry(entryId: string) {
    setOpenMenuId(null);
    await api.delete(`/org-hub/trade-board/${entryId}`).catch(() => {});
    setEntries((prev) => prev.filter((e) => e.id !== entryId));
  }

  /* ── Inline price edit ───────────────────────────────────── */
  async function savePrice(entryId: string) {
    setEditPriceId(null);
    const val = editPriceVal.trim() || null;
    await api.patch(`/org-hub/trade-board/${entryId}`, { asking_price: val }).catch(() => {});
    setEntries((prev) => prev.map((e) => e.id === entryId ? { ...e, asking_price: val } : e));
  }

  /* ── Drag & Drop between columns ─────────────────────────── */
  function handleDragStart(id: string) { setDragId(id); }
  function handleDragEnd() { setDragId(null); setDragOverCol(null); }

  function handleColumnDragOver(e: React.DragEvent, colKey: string) {
    e.preventDefault();
    setDragOverCol(colKey);
  }

  async function handleColumnDrop(colKey: string) {
    if (!dragId) return;
    const entry = entries.find((e) => e.id === dragId);
    if (entry && entry.board_type !== colKey) {
      await moveEntry(dragId, colKey);
    }
    setDragId(null);
    setDragOverCol(null);
  }

  /* ── PXI analysis ────────────────────────────────────────── */
  async function handlePxiAnalyse() {
    setPxiLoading(true);
    setShowPxi(true);
    try {
      const res = await api.post("/org-hub/trade-board/analyse", { team_name: orgName });
      setAnalysis(res.data?.analysis || "No analysis generated.");
    } catch { setAnalysis("Failed to generate analysis."); }
    setPxiLoading(false);
  }

  /* ── Render a trade card ─────────────────────────────────── */
  function TradeCard({ entry, colAccent }: { entry: TradeEntry; colAccent: string }) {
    const isDragging = dragId === entry.id;
    return (
      <div
        draggable
        onDragStart={() => handleDragStart(entry.id)}
        onDragEnd={handleDragEnd}
        className="bg-white px-4 py-3 transition-all"
        style={{
          borderBottom: "1px solid #DDE6EF",
          borderLeft: `3px solid ${colAccent}`,
          opacity: isDragging ? 0.4 : 1,
        }}
      >
        <div className="flex items-start gap-2">
          {/* Drag handle */}
          <GripVertical size={14} className="cursor-grab mt-0.5 shrink-0" style={{ color: "#8BA4BB" }} />

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
                <Link href={`/teams/${encodeURIComponent(entry.current_team)}`} className="text-[10px] truncate hover:text-teal transition-colors" style={{ color: "#5A7291" }}>
                  {entry.current_team}
                </Link>
              )}
            </div>

            {/* Stats */}
            <div className="flex items-center gap-3 mt-0.5 flex-wrap">
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
            </div>

            {/* Asking price */}
            <div className="mt-1.5">
              {editPriceId === entry.id ? (
                <div className="flex items-center gap-1">
                  <input
                    autoFocus
                    value={editPriceVal}
                    onChange={(e) => setEditPriceVal(e.target.value)}
                    onBlur={() => savePrice(entry.id)}
                    onKeyDown={(e) => { if (e.key === "Enter") savePrice(entry.id); if (e.key === "Escape") setEditPriceId(null); }}
                    className="px-2 py-0.5 rounded text-[10px] w-32"
                    style={{ border: "1.5px solid #0D9488", color: "#0F2942", outline: "none" }}
                    placeholder="e.g. 2nd round pick"
                  />
                </div>
              ) : (
                <button
                  onClick={() => { setEditPriceId(entry.id); setEditPriceVal(entry.asking_price || ""); }}
                  className="text-[10px] font-bold uppercase hover:underline"
                  style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 1, color: entry.asking_price ? "#0D9488" : "#8BA4BB" }}
                >
                  {entry.asking_price ? `💰 ${entry.asking_price}` : "+ Set Price"}
                </button>
              )}
            </div>

            {/* Notes (expandable) */}
            {entry.notes && (
              <button
                onClick={() => setExpandedNotes(expandedNotes === entry.id ? null : entry.id)}
                className="text-[10px] mt-1 text-left"
                style={{ color: "#5A7291" }}
              >
                {expandedNotes === entry.id ? entry.notes : `${entry.notes.substring(0, 50)}${entry.notes.length > 50 ? "..." : ""}`}
              </button>
            )}
          </div>

          {/* PXR badge */}
          <div className="shrink-0 text-center" style={{ width: 42 }}>
            {entry.pxr_score != null ? (
              <span
                className="inline-block px-1.5 py-0.5 rounded-md text-[10px] font-bold"
                style={{ color: "white", background: pxrColor(entry.pxr_score), fontFamily: "ui-monospace, monospace" }}
              >
                {entry.pxr_score.toFixed(1)}
              </span>
            ) : (
              <span className="text-[9px]" style={{ color: "#8BA4BB" }}>—</span>
            )}
          </div>

          {/* Action menu */}
          <div className="shrink-0 relative">
            <button
              onClick={() => setOpenMenuId(openMenuId === entry.id ? null : entry.id)}
              className="p-1 rounded hover:bg-gray-100"
            >
              <MoreVertical size={14} style={{ color: "#8BA4BB" }} />
            </button>
            {openMenuId === entry.id && (
              <div
                className="absolute right-0 top-7 z-40 bg-white shadow-lg rounded-lg py-1 w-48"
                style={{ border: "1.5px solid #DDE6EF" }}
              >
                {BOARD_TYPES.filter((t) => t !== entry.board_type).map((t) => {
                  const cfg = colConfig(t);
                  return (
                    <button
                      key={t}
                      onClick={() => moveEntry(entry.id, t)}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 font-bold uppercase"
                      style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 1, color: cfg.color }}
                    >
                      Move to {cfg.label}
                    </button>
                  );
                })}
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
          </div>
        </div>
      </div>
    );
  }

  /* ── Main Render ─────────────────────────────────────────── */
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
              <span className="w-2 h-2 rounded-full" style={{ background: "#F97316" }} />
              <ArrowLeftRight size={16} className="text-white/80" />
              <h1
                className="font-bold uppercase text-white"
                style={{ fontSize: 14, fontFamily: "ui-monospace, monospace", letterSpacing: 2 }}
              >
                Trade Board
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
                PXI Trade Analysis
              </button>
              <button
                onClick={() => { setShowAddModal(true); setAddSearch(""); setSearchResults([]); setSelectedPlayer(null); setAddBoardType("target"); setAddAskingPrice(""); setAddNotes(""); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-colors hover:opacity-90"
                style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 1, color: "#FFFFFF", background: "#0D9488" }}
              >
                <Plus size={11} />
                Add Player
              </button>
            </div>
          </div>

          {/* ── PXI Analysis ────────────────────────────────── */}
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
                    PXI Trade Analysis
                  </span>
                </div>
                <ChevronUp size={14} style={{ color: "#0D9488" }} />
              </div>
              <div className="bg-white px-5 py-4">
                {pxiLoading ? (
                  <div className="flex items-center justify-center py-8 gap-2">
                    <Loader2 size={16} className="animate-spin" style={{ color: "#0D9488" }} />
                    <span className="text-xs" style={{ color: "#5A7291" }}>Analysing trade board...</span>
                  </div>
                ) : (
                  <pre className="text-xs whitespace-pre-wrap" style={{ color: "#0F2942", lineHeight: 1.6, fontFamily: "inherit" }}>
                    {analysis}
                  </pre>
                )}
              </div>
            </div>
          )}

          {/* ── Loading ─────────────────────────────────────── */}
          {loading && (
            <div className="flex items-center justify-center py-16 gap-2">
              <Loader2 size={18} className="animate-spin" style={{ color: "#0D9488" }} />
              <span className="text-sm" style={{ color: "#5A7291" }}>Loading trade board...</span>
            </div>
          )}

          {/* ── Three-column layout ─────────────────────────── */}
          {!loading && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {COLUMNS.map((col) => {
                const colEntries = grouped(col.key);
                const Icon = col.icon;
                const isDropTarget = dragOverCol === col.key;
                return (
                  <div
                    key={col.key}
                    className="overflow-hidden transition-all"
                    style={{
                      borderRadius: 12,
                      border: isDropTarget ? `2px solid ${col.accent}` : "1.5px solid #DDE6EF",
                      borderTop: `3px solid ${col.accent}`,
                      background: isDropTarget ? col.bg : undefined,
                    }}
                    onDragOver={(e) => handleColumnDragOver(e, col.key)}
                    onDragLeave={() => setDragOverCol(null)}
                    onDrop={() => handleColumnDrop(col.key)}
                  >
                    {/* Column header */}
                    <div className="flex items-center gap-2 px-4 py-3" style={{ background: "#0F2942" }}>
                      <span className="w-2 h-2 rounded-full" style={{ background: col.accent }} />
                      <Icon size={13} style={{ color: "rgba(255,255,255,0.7)" }} />
                      <span
                        className="font-bold uppercase text-white"
                        style={{ fontSize: 10, fontFamily: "ui-monospace, monospace", letterSpacing: 2 }}
                      >
                        {col.label}
                      </span>
                      <span className="text-[10px] text-white/40 ml-auto" style={{ fontFamily: "ui-monospace, monospace" }}>
                        {colEntries.length}
                      </span>
                    </div>

                    {/* Cards */}
                    {colEntries.length === 0 ? (
                      <div className="bg-white px-4 py-10 text-center">
                        <Icon size={28} style={{ color: "#DDE6EF" }} className="mx-auto mb-2" />
                        <p className="text-[11px]" style={{ color: "#8BA4BB" }}>
                          {col.key === "target" && "No trade targets. Add players you want to acquire."}
                          {col.key === "watching" && "No players being watched. Add players to monitor."}
                          {col.key === "available" && "No available players. Add players you'd trade."}
                        </p>
                      </div>
                    ) : (
                      <div>
                        {colEntries.map((entry) => (
                          <TradeCard key={entry.id} entry={entry} colAccent={col.accent} />
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

      {/* ── Add Player Modal ───────────────────────────────── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white w-full max-w-lg mx-4 overflow-hidden" style={{ borderRadius: 12, border: "1.5px solid #DDE6EF" }}>
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-3" style={{ background: "#0F2942" }}>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ background: "#F97316" }} />
                <span className="font-bold uppercase text-white" style={{ fontSize: 10, fontFamily: "ui-monospace, monospace", letterSpacing: 2 }}>
                  Add to Trade Board
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

              {/* Board Type */}
              <div>
                <label className="block text-[10px] font-bold uppercase mb-1" style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 1, color: "#5A7291" }}>
                  Board
                </label>
                <div className="flex gap-2">
                  {COLUMNS.map((col) => (
                    <button
                      key={col.key}
                      onClick={() => setAddBoardType(col.key)}
                      className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase"
                      style={{
                        fontFamily: "ui-monospace, monospace", letterSpacing: 1,
                        color: addBoardType === col.key ? "#FFFFFF" : col.color,
                        background: addBoardType === col.key ? col.color : col.bg,
                        border: `1.5px solid ${addBoardType === col.key ? col.color : "transparent"}`,
                      }}
                    >
                      {col.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Asking Price */}
              <div>
                <label className="block text-[10px] font-bold uppercase mb-1" style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 1, color: "#5A7291" }}>
                  Asking Price (optional)
                </label>
                <input
                  value={addAskingPrice}
                  onChange={(e) => setAddAskingPrice(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ border: "1.5px solid #DDE6EF", color: "#0F2942", outline: "none" }}
                  placeholder="e.g. 2nd round pick + prospect"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-[10px] font-bold uppercase mb-1" style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 1, color: "#5A7291" }}>
                  Notes (optional)
                </label>
                <div className="flex items-center gap-1">
                  <textarea
                    value={addNotes}
                    onChange={(e) => setAddNotes(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg text-sm resize-none"
                    style={{ border: "1.5px solid #DDE6EF", color: "#0F2942", outline: "none" }}
                    rows={2}
                    placeholder="Trade notes, concerns, leverage..."
                  />
                  <MicButton onTranscript={(t) => setAddNotes((p) => (p ? p + " " + t : t))} />
                </div>
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
      {openMenuId && (
        <div className="fixed inset-0 z-30" onClick={() => setOpenMenuId(null)} />
      )}
    </ProtectedRoute>
  );
}
