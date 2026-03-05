"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  Trash2,
  Loader2,
  PenLine,
  Check,
  X as XIcon,
} from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import RinkCanvas from "@/components/RinkCanvas";
import type { RinkCanvasHandle, BackgroundMode } from "@/components/RinkCanvas";
import type { RinkDiagramData } from "@/types/rink";
import api from "@/lib/api";

/* ── Category labels ──────────────────────────────────────── */
const CAT_LABELS: Record<string, string> = {
  forecheck: "Forecheck",
  breakout: "Breakout",
  powerplay: "Power Play",
  penaltykill: "Penalty Kill",
  defensive_zone: "Defensive Zone",
  offensive_zone: "Offensive Zone",
  neutral_zone: "Neutral Zone",
  faceoff: "Faceoffs",
  other: "Other",
};

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

/* ── Page ─────────────────────────────────────────────────── */
export default function PlaybookBoardPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" style={{ background: "#F0F4F8" }} />}>
      <PlaybookBoardInner />
    </Suspense>
  );
}

function PlaybookBoardInner() {
  const params = useParams();
  const router = useRouter();
  const boardId = params?.id as string;

  const [board, setBoard] = useState<PlaybookBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Inline editing
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState("");
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Canvas
  const canvasRef = useRef<RinkCanvasHandle>(null);
  const [diagramData, setDiagramData] = useState<RinkDiagramData | undefined>(undefined);
  const [bgMode, setBgMode] = useState<BackgroundMode>("full_rink");
  const [canvasKey, setCanvasKey] = useState(0);

  /* ── Fetch board ───────────────────────────────────────── */
  useEffect(() => {
    if (!boardId) return;
    api.get(`/org-hub/playbook/${boardId}`).then((res) => {
      const b = res.data as PlaybookBoard;
      setBoard(b);
      if (b.board_layout) {
        const layout = b.board_layout as Record<string, unknown>;
        if (layout.background && typeof layout.background === "string" && ["full_rink", "half_rink", "blank"].includes(layout.background)) {
          setBgMode(layout.background as BackgroundMode);
        }
        setDiagramData(layout as unknown as RinkDiagramData);
        setCanvasKey((k) => k + 1);
      }
    }).catch(() => {
      setNotFound(true);
    }).finally(() => setLoading(false));
  }, [boardId]);

  /* ── Save title ────────────────────────────────────────── */
  async function saveTitle() {
    if (!board || !titleDraft.trim()) return;
    setSaving(true);
    try {
      await api.patch(`/org-hub/playbook/${board.id}`, { title: titleDraft.trim() });
      setBoard({ ...board, title: titleDraft.trim() });
      setEditingTitle(false);
    } catch { /* ignore */ }
    setSaving(false);
  }

  /* ── Save description ──────────────────────────────────── */
  async function saveDescription() {
    if (!board) return;
    setSaving(true);
    try {
      await api.patch(`/org-hub/playbook/${board.id}`, { description: descDraft.trim() });
      setBoard({ ...board, description: descDraft.trim() || null });
      setEditingDesc(false);
    } catch { /* ignore */ }
    setSaving(false);
  }

  /* ── Delete board ──────────────────────────────────────── */
  async function handleDelete() {
    if (!board) return;
    setDeleting(true);
    try {
      await api.delete(`/org-hub/playbook/${board.id}`);
      router.push("/org-hub/playbook");
    } catch { /* ignore */ }
    setDeleting(false);
  }

  /* ── Render ────────────────────────────────────────────── */
  if (loading) {
    return (
      <ProtectedRoute>
        <NavBar />
        <main className="min-h-screen" style={{ background: "#F0F4F8" }}>
          <div className="flex items-center justify-center py-24 gap-2">
            <Loader2 size={18} className="animate-spin" style={{ color: "#0D9488" }} />
            <span className="text-sm" style={{ color: "#5A7291" }}>Loading board...</span>
          </div>
        </main>
      </ProtectedRoute>
    );
  }

  if (notFound || !board) {
    return (
      <ProtectedRoute>
        <NavBar />
        <main className="min-h-screen" style={{ background: "#F0F4F8" }}>
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center">
            <p className="text-sm" style={{ color: "#5A7291" }}>Board not found.</p>
            <Link href="/org-hub/playbook" className="text-xs underline mt-2 inline-block" style={{ color: "#0D9488" }}>
              Back to Playbook
            </Link>
          </div>
        </main>
      </ProtectedRoute>
    );
  }

  const catLabel = CAT_LABELS[board.category] || board.category;

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
              <Link href="/org-hub/playbook" className="hover:opacity-70 transition-opacity" style={{ color: "rgba(255,255,255,0.6)" }}>
                <ArrowLeft size={20} />
              </Link>
              <span className="w-2 h-2 rounded-full" style={{ background: "#5A7291" }} />
              <BookOpen size={16} className="text-white/80" />

              {/* Inline title editing */}
              {editingTitle ? (
                <div className="flex items-center gap-1.5">
                  <input
                    autoFocus
                    value={titleDraft}
                    onChange={(e) => setTitleDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") saveTitle(); if (e.key === "Escape") setEditingTitle(false); }}
                    className="px-2 py-0.5 rounded text-sm font-bold text-white"
                    style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", outline: "none", minWidth: 180 }}
                  />
                  <button onClick={saveTitle} disabled={saving} className="text-white/60 hover:text-white"><Check size={14} /></button>
                  <button onClick={() => setEditingTitle(false)} className="text-white/60 hover:text-white"><XIcon size={14} /></button>
                </div>
              ) : (
                <h1
                  className="font-bold uppercase text-white cursor-pointer hover:text-white/80"
                  style={{ fontSize: 14, fontFamily: "ui-monospace, monospace", letterSpacing: 2 }}
                  onClick={() => { setTitleDraft(board.title); setEditingTitle(true); }}
                  title="Click to edit title"
                >
                  {board.title}
                </h1>
              )}

              {/* Category badge */}
              <span
                className="px-2 py-0.5 rounded text-[9px] font-bold uppercase"
                style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 1, color: "#0D9488", background: "rgba(13,148,136,0.15)" }}
              >
                {catLabel}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href={`/rink-builder?playbook_id=${board.id}`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-colors hover:opacity-90"
                style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 1, color: "#FFFFFF", background: "#0D9488" }}
              >
                <PenLine size={11} />
                Edit in Rink Builder
              </Link>
              {!confirmDelete ? (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-colors hover:opacity-90"
                  style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 1, color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.15)" }}
                >
                  <Trash2 size={10} />
                  Delete
                </button>
              ) : (
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-bold uppercase"
                    style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 1, color: "#FFFFFF", background: "#DC2626" }}
                  >
                    {deleting ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />}
                    Confirm
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="px-2 py-1.5 rounded-lg text-[10px] font-bold uppercase text-white/50"
                    style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 1, border: "1px solid rgba(255,255,255,0.15)" }}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ── Diagram ───────────────────────────────────── */}
          <div
            className="mb-6 overflow-hidden"
            style={{ borderRadius: 12, border: "1.5px solid #DDE6EF", borderLeft: "3px solid #0F2942" }}
          >
            <div className="flex items-center gap-2 px-5 py-3" style={{ background: "#0F2942" }}>
              <span className="w-2 h-2 rounded-full" style={{ background: "#14B8A6" }} />
              <span
                className="font-bold uppercase text-white"
                style={{ fontSize: 10, fontFamily: "ui-monospace, monospace", letterSpacing: 2 }}
              >
                Diagram
              </span>
            </div>
            <div className="bg-white p-4 flex justify-center">
              {diagramData ? (
                <div style={{ maxWidth: 700, width: "100%" }}>
                  <RinkCanvas
                    key={canvasKey}
                    ref={canvasRef}
                    initialData={diagramData}
                    showToolbar={false}
                    editable={false}
                    backgroundMode={bgMode}
                  />
                </div>
              ) : (
                <div className="py-12 text-center">
                  <BookOpen size={36} style={{ color: "#DDE6EF" }} className="mx-auto mb-3" />
                  <p className="text-xs" style={{ color: "#8BA4BB" }}>No diagram data. Open in Rink Builder to create one.</p>
                </div>
              )}
            </div>
          </div>

          {/* ── Description ───────────────────────────────── */}
          <div
            className="overflow-hidden"
            style={{ borderRadius: 12, border: "1.5px solid #DDE6EF", borderLeft: "3px solid #0F2942" }}
          >
            <div className="flex items-center gap-2 px-5 py-3" style={{ background: "#0F2942" }}>
              <span className="w-2 h-2 rounded-full" style={{ background: "#5A7291" }} />
              <span
                className="font-bold uppercase text-white"
                style={{ fontSize: 10, fontFamily: "ui-monospace, monospace", letterSpacing: 2 }}
              >
                Description
              </span>
            </div>
            <div className="bg-white px-5 py-4">
              {editingDesc ? (
                <div className="space-y-2">
                  <textarea
                    autoFocus
                    value={descDraft}
                    onChange={(e) => setDescDraft(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm resize-none"
                    style={{ border: "1.5px solid #DDE6EF", color: "#0F2942", outline: "none" }}
                    rows={3}
                    placeholder="Describe this system — formation, key principles, personnel deployment..."
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={saveDescription}
                      disabled={saving}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase"
                      style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 1, color: "#FFFFFF", background: "#0D9488" }}
                    >
                      {saving && <Loader2 size={10} className="animate-spin" />}
                      Save
                    </button>
                    <button
                      onClick={() => setEditingDesc(false)}
                      className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase"
                      style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 1, color: "#5A7291", border: "1.5px solid #DDE6EF" }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  className="cursor-pointer group"
                  onClick={() => { setDescDraft(board.description || ""); setEditingDesc(true); }}
                  title="Click to edit description"
                >
                  {board.description ? (
                    <p className="text-sm group-hover:text-navy/70" style={{ color: "#0F2942", lineHeight: 1.6 }}>
                      {board.description}
                    </p>
                  ) : (
                    <p className="text-xs italic" style={{ color: "#8BA4BB" }}>
                      No description. Click to add one.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

        </div>
      </main>
    </ProtectedRoute>
  );
}
