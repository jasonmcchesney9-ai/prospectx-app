"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  Plus,
  Sparkles,
  Loader2,
  ChevronDown,
  ChevronUp,
  Clock,
  XIcon,
} from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import api from "@/lib/api";
import { getUser } from "@/lib/auth";

/* ── Types ────────────────────────────────────────────────── */
interface PlaybookBoard {
  id: string;
  title: string;
  category: string;
  description: string | null;
  board_layout: Record<string, unknown> | null;
  visibility: string;
  sort_order: number;
  created_at: string | null;
  updated_at: string | null;
}

interface PxiRecommendation {
  system_name: string;
  category: string;
  description: string;
}

/* ── Category config ──────────────────────────────────────── */
const CATEGORIES: { key: string; label: string }[] = [
  { key: "forecheck", label: "Forecheck" },
  { key: "breakout", label: "Breakout" },
  { key: "powerplay", label: "Power Play" },
  { key: "penaltykill", label: "Penalty Kill" },
  { key: "defensive_zone", label: "Defensive Zone" },
  { key: "offensive_zone", label: "Offensive Zone" },
  { key: "neutral_zone", label: "Neutral Zone" },
  { key: "faceoff", label: "Faceoffs" },
  { key: "other", label: "Other" },
];

/* ── Starter templates ────────────────────────────────────── */
const TEMPLATES = [
  { name: "1-2-2 Forecheck", category: "forecheck", elements: [
    { id: "t_1", type: "player_token", x: 450, y: 60, number: "F1", variant: "home" },
    { id: "t_2", type: "player_token", x: 370, y: 120, number: "F2", variant: "home" },
    { id: "t_3", type: "player_token", x: 530, y: 120, number: "F3", variant: "home" },
    { id: "t_4", type: "player_token", x: 350, y: 180, number: "D1", variant: "home" },
    { id: "t_5", type: "player_token", x: 550, y: 180, number: "D2", variant: "home" },
  ] },
  { name: "2-1-2 Forecheck", category: "forecheck", elements: [
    { id: "t_1", type: "player_token", x: 400, y: 60, number: "F1", variant: "home" },
    { id: "t_2", type: "player_token", x: 500, y: 60, number: "F2", variant: "home" },
    { id: "t_3", type: "player_token", x: 450, y: 130, number: "F3", variant: "home" },
    { id: "t_4", type: "player_token", x: 350, y: 190, number: "D1", variant: "home" },
    { id: "t_5", type: "player_token", x: 550, y: 190, number: "D2", variant: "home" },
  ] },
  { name: "Quick Up Breakout", category: "breakout", elements: [
    { id: "t_1", type: "player_token", x: 120, y: 200, number: "D1", variant: "home" },
    { id: "t_2", type: "player_token", x: 200, y: 200, number: "D2", variant: "home" },
    { id: "t_3", type: "player_token", x: 80, y: 120, number: "LW", variant: "home" },
    { id: "t_4", type: "player_token", x: 250, y: 120, number: "C", variant: "home" },
    { id: "t_5", type: "player_token", x: 350, y: 100, number: "RW", variant: "home" },
    { id: "t_6", type: "arrow", x1: 120, y1: 200, x2: 80, y2: 120, style: "solid", color: "#18B3A6", variant: "pass" },
    { id: "t_7", type: "arrow", x1: 80, y1: 120, x2: 250, y2: 120, style: "solid", color: "#18B3A6", variant: "pass" },
  ] },
  { name: "1-3-1 Power Play", category: "powerplay", elements: [
    { id: "t_1", type: "player_token", x: 190, y: 40, number: "QB", variant: "home" },
    { id: "t_2", type: "player_token", x: 80, y: 140, number: "LW", variant: "home" },
    { id: "t_3", type: "player_token", x: 190, y: 160, number: "SL", variant: "home" },
    { id: "t_4", type: "player_token", x: 300, y: 140, number: "RW", variant: "home" },
    { id: "t_5", type: "player_token", x: 190, y: 250, number: "NF", variant: "home" },
  ] },
  { name: "Box Penalty Kill", category: "penaltykill", elements: [
    { id: "t_1", type: "player_token", x: 130, y: 100, number: "F1", variant: "home" },
    { id: "t_2", type: "player_token", x: 250, y: 100, number: "F2", variant: "home" },
    { id: "t_3", type: "player_token", x: 130, y: 200, number: "D1", variant: "home" },
    { id: "t_4", type: "player_token", x: 250, y: 200, number: "D2", variant: "home" },
  ] },
  { name: "Blank", category: "other", elements: [] },
];

/* ── Helpers ──────────────────────────────────────────────── */
function formatDate(d: string | null): string {
  if (!d) return "";
  try {
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch { return ""; }
}

function elementCount(board: PlaybookBoard): number {
  if (!board.board_layout) return 0;
  const elements = (board.board_layout as Record<string, unknown>).elements;
  return Array.isArray(elements) ? elements.length : 0;
}

/* ── Page ─────────────────────────────────────────────────── */
export default function PlaybookPage() {
  const router = useRouter();
  const user = getUser();
  const orgName = user?.org_short_name || user?.org_name || "Your Organization";

  const [boards, setBoards] = useState<PlaybookBoard[]>([]);
  const [grouped, setGrouped] = useState<Record<string, PlaybookBoard[]>>({});
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  // New board modal
  const [showModal, setShowModal] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalCategory, setModalCategory] = useState("forecheck");
  const [modalDescription, setModalDescription] = useState("");
  const [modalTemplate, setModalTemplate] = useState("Blank");
  const [creating, setCreating] = useState(false);

  // PXI generation
  const [showPxi, setShowPxi] = useState(false);
  const [pxiLoading, setPxiLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<PxiRecommendation[]>([]);

  /* ── Fetch boards ──────────────────────────────────────── */
  useEffect(() => {
    api.get("/org-hub/playbook").then((res) => {
      setBoards(res.data?.boards || []);
      setGrouped(res.data?.grouped || {});
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  /* ── Toggle category collapse ──────────────────────────── */
  function toggleCategory(cat: string) {
    setCollapsed((prev) => ({ ...prev, [cat]: !prev[cat] }));
  }

  /* ── Create board ──────────────────────────────────────── */
  async function handleCreate() {
    if (!modalTitle.trim()) return;
    setCreating(true);
    try {
      const template = TEMPLATES.find((t) => t.name === modalTemplate);
      const isHalf = ["powerplay", "penaltykill", "defensive_zone", "offensive_zone"].includes(modalCategory);
      const boardLayout = {
        rinkType: isHalf ? "half" : "full",
        width: isHalf ? 380 : 600,
        height: isHalf ? 300 : 280,
        elements: template ? template.elements : [],
        version: 1,
        background: isHalf ? "half_rink" : "full_rink",
      };
      const res = await api.post("/org-hub/playbook", {
        title: modalTitle.trim(),
        category: modalCategory,
        description: modalDescription.trim() || undefined,
        board_layout: boardLayout,
      });
      const newId = res.data?.id;
      setShowModal(false);
      if (newId) {
        router.push(`/rink-builder?playbook_id=${newId}`);
      }
    } catch { /* ignore */ }
    setCreating(false);
  }

  /* ── Open create modal with prefill ────────────────────── */
  function openCreateModal(prefill?: { title?: string; category?: string; description?: string }) {
    setModalTitle(prefill?.title || "");
    setModalCategory(prefill?.category || "forecheck");
    setModalDescription(prefill?.description || "");
    setModalTemplate("Blank");
    setShowModal(true);
  }

  /* ── PXI generate ──────────────────────────────────────── */
  async function handlePxiGenerate() {
    setPxiLoading(true);
    setShowPxi(true);
    try {
      const res = await api.post("/org-hub/playbook/generate-from-identity", { team_name: orgName });
      setRecommendations(res.data?.recommendations || []);
    } catch {
      setRecommendations([]);
    }
    setPxiLoading(false);
  }

  /* ── Render ────────────────────────────────────────────── */
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
              <span className="w-2 h-2 rounded-full" style={{ background: "#5A7291" }} />
              <BookOpen size={16} className="text-white/80" />
              <h1
                className="font-bold uppercase text-white"
                style={{ fontSize: 14, fontFamily: "ui-monospace, monospace", letterSpacing: 2 }}
              >
                System Playbook
              </h1>
              <span className="text-xs text-white/40" style={{ fontFamily: "ui-monospace, monospace" }}>
                {orgName}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePxiGenerate}
                disabled={pxiLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-colors hover:opacity-90"
                style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 1, color: "#FFFFFF", background: "rgba(13,148,136,0.8)", border: "1px solid rgba(255,255,255,0.15)" }}
              >
                {pxiLoading ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                PXI Generate
              </button>
              <button
                onClick={() => openCreateModal()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-colors hover:opacity-90"
                style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 1, color: "#FFFFFF", background: "#0D9488" }}
              >
                <Plus size={11} />
                New Board
              </button>
            </div>
          </div>

          {/* ── PXI Recommendations ───────────────────────── */}
          {showPxi && (
            <div
              className="mb-6 overflow-hidden"
              style={{ borderRadius: 12, border: "1.5px solid rgba(13,148,136,0.25)" }}
            >
              <div
                className="flex items-center justify-between px-5 py-3 cursor-pointer"
                style={{ background: "rgba(13,148,136,0.06)" }}
                onClick={() => setShowPxi(false)}
              >
                <div className="flex items-center gap-2">
                  <Sparkles size={14} style={{ color: "#0D9488" }} />
                  <span
                    className="font-bold uppercase"
                    style={{ fontSize: 10, fontFamily: "ui-monospace, monospace", letterSpacing: 2, color: "#0D9488" }}
                  >
                    PXI Playbook Recommendations
                  </span>
                </div>
                <ChevronUp size={14} style={{ color: "#0D9488" }} />
              </div>
              <div className="bg-white px-5 py-4">
                {pxiLoading ? (
                  <div className="flex items-center justify-center py-8 gap-2">
                    <Loader2 size={16} className="animate-spin" style={{ color: "#0D9488" }} />
                    <span className="text-xs" style={{ color: "#5A7291" }}>Analysing team identity...</span>
                  </div>
                ) : recommendations.length === 0 ? (
                  <p className="text-xs text-center py-4" style={{ color: "#8BA4BB" }}>No recommendations generated. Try again.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {recommendations.map((rec, i) => {
                      const catLabel = CATEGORIES.find((c) => c.key === rec.category)?.label || rec.category;
                      return (
                        <div
                          key={i}
                          className="rounded-lg p-3"
                          style={{ border: "1.5px solid #DDE6EF", borderLeft: "3px solid #0D9488" }}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold" style={{ color: "#0F2942" }}>{rec.system_name}</span>
                            <span
                              className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded"
                              style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 1, color: "#0D9488", background: "rgba(13,148,136,0.08)" }}
                            >
                              {catLabel}
                            </span>
                          </div>
                          <p className="text-[11px] mb-2" style={{ color: "#5A7291", lineHeight: 1.4 }}>{rec.description}</p>
                          <button
                            onClick={() => openCreateModal({ title: rec.system_name, category: rec.category, description: rec.description })}
                            className="text-[10px] font-bold uppercase px-2 py-1 rounded"
                            style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 1, color: "#0D9488", background: "rgba(13,148,136,0.08)", border: "1px solid rgba(13,148,136,0.2)" }}
                          >
                            Create Board
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Loading state ─────────────────────────────── */}
          {loading && (
            <div className="flex items-center justify-center py-16 gap-2">
              <Loader2 size={18} className="animate-spin" style={{ color: "#0D9488" }} />
              <span className="text-sm" style={{ color: "#5A7291" }}>Loading playbook...</span>
            </div>
          )}

          {/* ── Category Sections ─────────────────────────── */}
          {!loading && CATEGORIES.map((cat) => {
            const catBoards = grouped[cat.key] || [];
            const isCollapsed = collapsed[cat.key] && catBoards.length > 0;
            return (
              <div
                key={cat.key}
                className="mb-4 overflow-hidden"
                style={{ borderRadius: 12, border: "1.5px solid #DDE6EF", borderLeft: "3px solid #0F2942" }}
              >
                {/* Category header */}
                <div
                  className="flex items-center justify-between px-5 py-3 cursor-pointer select-none"
                  style={{ background: "#0F2942" }}
                  onClick={() => toggleCategory(cat.key)}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ background: "#5A7291" }} />
                    <span
                      className="font-bold uppercase text-white"
                      style={{ fontSize: 10, fontFamily: "ui-monospace, monospace", letterSpacing: 2 }}
                    >
                      {cat.label}
                    </span>
                    <span className="text-[10px] text-white/40" style={{ fontFamily: "ui-monospace, monospace" }}>
                      {catBoards.length} board{catBoards.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  {catBoards.length > 0 && (
                    isCollapsed ? <ChevronDown size={14} className="text-white/40" /> : <ChevronUp size={14} className="text-white/40" />
                  )}
                </div>

                {/* Category content */}
                {!isCollapsed && (
                  <div className="bg-white px-5 py-4">
                    {catBoards.length === 0 ? (
                      <p className="text-xs text-center py-2" style={{ color: "#8BA4BB" }}>
                        No boards yet. Click &ldquo;New Board&rdquo; to add one.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {catBoards.map((board) => (
                          <Link
                            key={board.id}
                            href={`/org-hub/playbook/${board.id}`}
                            className="group block rounded-lg transition-all duration-200 hover:shadow-md"
                            style={{ border: "1.5px solid #DDE6EF", borderLeft: "3px solid #0F2942" }}
                            onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; }}
                            onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}
                          >
                            {/* Board thumbnail area */}
                            <div
                              className="flex items-center justify-center py-6"
                              style={{ background: "rgba(15,41,66,0.03)", borderBottom: "1px solid #DDE6EF" }}
                            >
                              <BookOpen size={28} style={{ color: "#DDE6EF" }} />
                              {elementCount(board) > 0 && (
                                <span
                                  className="ml-2 text-[9px] font-bold uppercase"
                                  style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 1, color: "#8BA4BB" }}
                                >
                                  {elementCount(board)} elements
                                </span>
                              )}
                            </div>
                            {/* Board info */}
                            <div className="px-3 py-2.5">
                              <p className="text-xs font-bold truncate" style={{ color: "#0F2942" }}>{board.title}</p>
                              {board.description && (
                                <p className="text-[11px] mt-0.5 truncate" style={{ color: "#5A7291" }}>{board.description}</p>
                              )}
                              <div className="flex items-center gap-1 mt-1.5">
                                <Clock size={9} style={{ color: "#8BA4BB" }} />
                                <span className="text-[9px]" style={{ color: "#8BA4BB" }}>{formatDate(board.updated_at)}</span>
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

        </div>
      </main>

      {/* ── New Board Modal ──────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div
            className="bg-white w-full max-w-lg mx-4 overflow-hidden"
            style={{ borderRadius: 12, border: "1.5px solid #DDE6EF" }}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-3" style={{ background: "#0F2942" }}>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ background: "#14B8A6" }} />
                <span
                  className="font-bold uppercase text-white"
                  style={{ fontSize: 10, fontFamily: "ui-monospace, monospace", letterSpacing: 2 }}
                >
                  New Playbook Board
                </span>
              </div>
              <button onClick={() => setShowModal(false)} className="text-white/50 hover:text-white/80">
                <XIcon size={14} />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              {/* Title */}
              <div>
                <label className="block text-[10px] font-bold uppercase mb-1" style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 1, color: "#5A7291" }}>
                  Board Title *
                </label>
                <input
                  value={modalTitle}
                  onChange={(e) => setModalTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ border: "1.5px solid #DDE6EF", color: "#0F2942", outline: "none" }}
                  placeholder="e.g. 1-2-2 Forecheck"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-[10px] font-bold uppercase mb-1" style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 1, color: "#5A7291" }}>
                  Category
                </label>
                <select
                  value={modalCategory}
                  onChange={(e) => setModalCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ border: "1.5px solid #DDE6EF", color: "#0F2942", outline: "none", background: "white" }}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.key} value={c.key}>{c.label}</option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-[10px] font-bold uppercase mb-1" style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 1, color: "#5A7291" }}>
                  Description
                </label>
                <textarea
                  value={modalDescription}
                  onChange={(e) => setModalDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm resize-none"
                  style={{ border: "1.5px solid #DDE6EF", color: "#0F2942", outline: "none" }}
                  rows={2}
                  placeholder="Key principles and personnel notes..."
                />
              </div>

              {/* Template selector */}
              <div>
                <label className="block text-[10px] font-bold uppercase mb-1" style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 1, color: "#5A7291" }}>
                  Template
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {TEMPLATES.map((tmpl) => (
                    <button
                      key={tmpl.name}
                      onClick={() => {
                        setModalTemplate(tmpl.name);
                        if (tmpl.name !== "Blank" && !modalTitle) setModalTitle(tmpl.name);
                        if (tmpl.category !== "other") setModalCategory(tmpl.category);
                      }}
                      className="px-2 py-2 rounded-lg text-[10px] font-bold text-center transition-colors"
                      style={{
                        fontFamily: "ui-monospace, monospace",
                        letterSpacing: 0.5,
                        color: modalTemplate === tmpl.name ? "#FFFFFF" : "#0F2942",
                        background: modalTemplate === tmpl.name ? "#0D9488" : "rgba(15,41,66,0.04)",
                        border: `1.5px solid ${modalTemplate === tmpl.name ? "#0D9488" : "#DDE6EF"}`,
                      }}
                    >
                      {tmpl.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-lg text-xs font-bold uppercase"
                  style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 1, color: "#5A7291", border: "1.5px solid #DDE6EF" }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={creating || !modalTitle.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold uppercase transition-colors hover:opacity-90"
                  style={{
                    fontFamily: "ui-monospace, monospace",
                    letterSpacing: 1,
                    color: "#FFFFFF",
                    background: "#0D9488",
                    opacity: creating || !modalTitle.trim() ? 0.6 : 1,
                  }}
                >
                  {creating && <Loader2 size={11} className="animate-spin" />}
                  Create & Open in Rink Builder
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </ProtectedRoute>
  );
}
