"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Film,
  Loader2,
  Sparkles,
  Clock,
  User,
  Trash2,
  Play,
  Edit2,
  Check,
  X,
} from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import api from "@/lib/api";
import toast from "react-hot-toast";

interface ClipData {
  id: string;
  title: string;
  description?: string;
  start_time_seconds: number;
  end_time_seconds: number;
  clip_type?: string;
  tags?: string[];
  upload_id?: string;
  session_id?: string;
}

interface PxiSuggestions {
  suggested_order?: string[];
  section_breaks?: { after_clip_index: number; label: string }[];
  opening_note?: string;
  closing_note?: string;
  cut_suggestions?: string[];
  duration_estimate_seconds?: number;
  notes?: string;
  raw_response?: string;
}

interface ReelData {
  id: string;
  title: string;
  description?: string;
  level: string;
  player_id?: string;
  player_first_name?: string;
  player_last_name?: string;
  clip_ids: string[];
  clip_order: string[];
  player_info: Record<string, string>;
  pxi_suggestions: PxiSuggestions;
  pxi_status: string;
  visibility: string;
  status: string;
  clips: ClipData[];
  created_at: string;
  updated_at?: string;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const STATUS_OPTIONS = ["draft", "ready", "shared"];

export default function HighlightReelViewerPage() {
  const params = useParams();
  const router = useRouter();
  const reelId = params.id as string;

  const [reel, setReel] = useState<ReelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [generatingSuggestions, setGeneratingSuggestions] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState("");

  /* ─── Load reel ─── */
  useEffect(() => {
    async function loadReel() {
      try {
        const res = await api.get(`/highlight-reels/${reelId}`);
        setReel(res.data);
      } catch {
        setError("Highlight reel not found");
      } finally {
        setLoading(false);
      }
    }
    loadReel();
  }, [reelId]);

  /* ─── Generate PXI suggestions ─── */
  const handleGenerateSuggestions = useCallback(async () => {
    if (!reel) return;
    setGeneratingSuggestions(true);
    try {
      const res = await api.post(`/highlight-reels/${reelId}/generate-suggestions`);
      // Reload reel to get updated suggestions
      const updated = await api.get(`/highlight-reels/${reelId}`);
      setReel(updated.data);
      toast.success("PXI suggestions generated!");
    } catch {
      toast.error("Failed to generate suggestions");
    } finally {
      setGeneratingSuggestions(false);
    }
  }, [reel, reelId]);

  /* ─── Update status ─── */
  const handleStatusChange = useCallback(async (newStatus: string) => {
    if (!reel) return;
    try {
      await api.patch(`/highlight-reels/${reelId}`, { status: newStatus });
      setReel((prev) => prev ? { ...prev, status: newStatus } : prev);
      toast.success(`Status updated to ${newStatus}`);
    } catch {
      toast.error("Failed to update status");
    }
  }, [reel, reelId]);

  /* ─── Update title ─── */
  const handleSaveTitle = useCallback(async () => {
    if (!editTitle.trim()) return;
    try {
      await api.patch(`/highlight-reels/${reelId}`, { title: editTitle.trim() });
      setReel((prev) => prev ? { ...prev, title: editTitle.trim() } : prev);
      setEditingTitle(false);
      toast.success("Title updated");
    } catch {
      toast.error("Failed to update title");
    }
  }, [editTitle, reelId]);

  /* ─── Delete ─── */
  const handleDelete = useCallback(async () => {
    if (!confirm("Delete this highlight reel? This cannot be undone.")) return;
    try {
      await api.delete(`/highlight-reels/${reelId}`);
      toast.success("Reel deleted");
      router.push("/highlight-reels");
    } catch {
      toast.error("Failed to delete reel");
    }
  }, [reelId, router]);

  /* ─── Loading / Error ─── */
  if (loading) {
    return (
      <ProtectedRoute>
        <NavBar />
        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center py-20">
            <Loader2 size={32} className="animate-spin" style={{ color: "#0D9488" }} />
          </div>
        </main>
      </ProtectedRoute>
    );
  }

  if (error || !reel) {
    return (
      <ProtectedRoute>
        <NavBar />
        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-20">
            <Film size={48} className="mx-auto mb-4" style={{ color: "#DDE6EF" }} />
            <p className="text-lg" style={{ color: "#5A7291" }}>{error || "Reel not found"}</p>
            <Link href="/highlight-reels" className="text-sm mt-2 inline-block" style={{ color: "#0D9488" }}>
              Back to Highlight Reels
            </Link>
          </div>
        </main>
      </ProtectedRoute>
    );
  }

  const totalDuration = reel.clips.reduce(
    (sum, c) => sum + (c.end_time_seconds - c.start_time_seconds), 0
  );
  const pxi = reel.pxi_suggestions || {};

  return (
    <ProtectedRoute>
      <NavBar />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* ═══ Header ═══ */}
        <div className="px-5 py-4 flex items-center justify-between mb-4" style={{ borderRadius: 12, border: "1.5px solid #DDE6EF", background: "#0F2942" }}>
          <div className="flex items-center gap-3">
            <Link href="/highlight-reels" className="hover:opacity-70 transition-opacity" style={{ color: "rgba(255,255,255,0.6)" }}>
              <ArrowLeft size={20} />
            </Link>
            <span className="px-2.5 py-1 rounded-md text-white font-bold uppercase" style={{ fontSize: 10, fontFamily: "ui-monospace, monospace", letterSpacing: 2, background: "#EA580C" }}>
              HIGHLIGHT REEL
            </span>
            <div>
              {editingTitle ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleSaveTitle(); if (e.key === "Escape") setEditingTitle(false); }}
                    className="text-lg font-bold bg-white/10 text-white px-2 py-0.5 rounded focus:outline-none"
                    autoFocus
                  />
                  <button onClick={handleSaveTitle} className="text-white/60 hover:text-white"><Check size={14} /></button>
                  <button onClick={() => setEditingTitle(false)} className="text-white/60 hover:text-white"><X size={14} /></button>
                </div>
              ) : (
                <h1 className="text-lg font-bold text-white flex items-center gap-2">
                  {reel.title}
                  <button
                    onClick={() => { setEditTitle(reel.title); setEditingTitle(true); }}
                    className="opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity"
                    style={{ color: "rgba(255,255,255,0.4)" }}
                  >
                    <Edit2 size={12} />
                  </button>
                </h1>
              )}
              <div className="flex items-center gap-2 mt-0.5">
                {reel.player_first_name && (
                  <span className="flex items-center gap-1 text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>
                    <User size={10} />
                    {reel.player_first_name} {reel.player_last_name}
                  </span>
                )}
                <span className="px-2 py-0.5 rounded text-white font-bold uppercase" style={{ fontSize: 9, fontFamily: "ui-monospace, monospace", letterSpacing: 1, background: "rgba(234,88,12,0.4)" }}>
                  {reel.level}
                </span>
                <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                  {formatDate(reel.created_at)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Status selector */}
            <select
              value={reel.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="px-2 py-1 rounded-lg text-xs font-bold uppercase"
              style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 1, background: "rgba(255,255,255,0.1)", color: "#FFFFFF", border: "1px solid rgba(255,255,255,0.2)" }}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s} style={{ color: "#0F2942" }}>{s}</option>
              ))}
            </select>

            {/* PXI Suggest button */}
            <button
              onClick={handleGenerateSuggestions}
              disabled={generatingSuggestions || reel.clips.length === 0}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold uppercase transition-colors hover:opacity-90 disabled:opacity-50"
              style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 1, background: "rgba(13,148,136,0.1)", color: "#0D9488", border: "1.5px solid rgba(13,148,136,0.2)" }}
            >
              {generatingSuggestions ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              {generatingSuggestions ? "Generating..." : "PXI Suggest"}
            </button>

            {/* Delete */}
            <button
              onClick={handleDelete}
              className="p-2 rounded-lg transition-colors hover:bg-white/10"
              style={{ color: "rgba(255,255,255,0.4)" }}
              title="Delete reel"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        {/* ═══ Content Grid ═══ */}
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Left: Clip List */}
          <div className="w-full lg:w-[65%]">
            <div className="overflow-hidden" style={{ borderRadius: 12, border: "1.5px solid #DDE6EF", borderLeft: "3px solid #EA580C" }}>
              <div className="flex items-center justify-between px-5 py-3" style={{ background: "#0F2942" }}>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ background: "#EA580C" }} />
                  <span className="font-bold uppercase text-white" style={{ fontSize: 10, fontFamily: "ui-monospace, monospace", letterSpacing: 2 }}>
                    CLIPS
                  </span>
                </div>
                <span className="font-bold uppercase" style={{ fontSize: 9, fontFamily: "ui-monospace, monospace", letterSpacing: 1, color: "rgba(255,255,255,0.5)" }}>
                  {reel.clips.length} CLIPS &middot; {formatDuration(totalDuration)}
                </span>
              </div>
              <div className="bg-white divide-y" style={{ borderColor: "#DDE6EF" }}>
                {reel.clips.length === 0 ? (
                  <div className="text-center py-12">
                    <Film size={32} className="mx-auto mb-2" style={{ color: "#DDE6EF" }} />
                    <p className="text-sm" style={{ color: "#5A7291" }}>No clips in this reel yet.</p>
                  </div>
                ) : (
                  reel.clips.map((clip, idx) => (
                    <div key={clip.id} className="px-5 py-3 flex items-center gap-3 group hover:bg-slate-50/50 transition-colors">
                      <span className="text-sm font-bold w-6 text-center shrink-0" style={{ fontFamily: "ui-monospace, monospace", color: "#EA580C" }}>
                        {idx + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate" style={{ color: "#0F2942" }}>
                          {clip.title}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="flex items-center gap-1 text-[10px]" style={{ fontFamily: "ui-monospace, monospace", color: "#0D9488" }}>
                            <Clock size={9} />
                            {formatDuration(clip.start_time_seconds)} - {formatDuration(clip.end_time_seconds)}
                          </span>
                          <span className="text-[10px]" style={{ color: "#8BA4BB" }}>
                            ({formatDuration(clip.end_time_seconds - clip.start_time_seconds)})
                          </span>
                          {clip.tags && clip.tags.length > 0 && (
                            <div className="flex gap-1">
                              {clip.tags.slice(0, 3).map((tag) => (
                                <span key={tag} className="px-1.5 py-0.5 rounded text-[9px]" style={{ background: "rgba(13,148,136,0.06)", color: "#0D9488" }}>
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      {clip.session_id && (
                        <Link
                          href={`/film/sessions/${clip.session_id}?t=${clip.start_time_seconds}`}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-teal/5"
                          style={{ color: "#0D9488" }}
                          title="View in Film Room"
                        >
                          <Play size={14} />
                        </Link>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right: Details + PXI */}
          <div className="w-full lg:w-[35%] space-y-4">
            {/* Player Info */}
            {reel.player_info && Object.values(reel.player_info).some((v) => v) && (
              <div className="overflow-hidden" style={{ borderRadius: 12, border: "1.5px solid #DDE6EF", borderLeft: "3px solid #0D9488" }}>
                <div className="flex items-center gap-2 px-5 py-3" style={{ background: "#0F2942" }}>
                  <span className="w-2 h-2 rounded-full" style={{ background: "#0D9488" }} />
                  <span className="font-bold uppercase text-white" style={{ fontSize: 10, fontFamily: "ui-monospace, monospace", letterSpacing: 2 }}>
                    PLAYER INFO
                  </span>
                </div>
                <div className="bg-white px-5 py-4 space-y-2">
                  {reel.player_info.height && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs" style={{ color: "#8BA4BB" }}>Height</span>
                      <span className="text-sm font-medium" style={{ color: "#0F2942" }}>{reel.player_info.height}</span>
                    </div>
                  )}
                  {reel.player_info.weight && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs" style={{ color: "#8BA4BB" }}>Weight</span>
                      <span className="text-sm font-medium" style={{ color: "#0F2942" }}>{reel.player_info.weight}</span>
                    </div>
                  )}
                  {reel.player_info.shoots && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs" style={{ color: "#8BA4BB" }}>Shoots</span>
                      <span className="text-sm font-medium" style={{ color: "#0F2942" }}>{reel.player_info.shoots}</span>
                    </div>
                  )}
                  {reel.player_info.highlights && (
                    <div className="pt-2" style={{ borderTop: "1px solid #DDE6EF" }}>
                      <span className="text-xs block mb-1" style={{ color: "#8BA4BB" }}>Highlights</span>
                      <p className="text-sm" style={{ color: "#0F2942" }}>{reel.player_info.highlights}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* PXI Suggestions */}
            {reel.pxi_status === "completed" && pxi && (
              <div className="overflow-hidden" style={{ borderRadius: 12, border: "1.5px solid rgba(13,148,136,0.2)", borderLeft: "3px solid #0D9488" }}>
                <div className="flex items-center gap-2 px-5 py-3" style={{ background: "#0F2942" }}>
                  <Sparkles size={10} style={{ color: "#0D9488" }} />
                  <span className="font-bold uppercase text-white" style={{ fontSize: 10, fontFamily: "ui-monospace, monospace", letterSpacing: 2 }}>
                    PXI SUGGESTIONS
                  </span>
                </div>
                <div className="bg-white px-5 py-4 space-y-3">
                  {pxi.opening_note && (
                    <div>
                      <p className="font-bold uppercase mb-0.5" style={{ fontSize: 9, fontFamily: "ui-monospace, monospace", letterSpacing: 1, color: "#8BA4BB" }}>
                        Opening
                      </p>
                      <p className="text-sm" style={{ color: "#0F2942" }}>{pxi.opening_note}</p>
                    </div>
                  )}
                  {pxi.closing_note && (
                    <div>
                      <p className="font-bold uppercase mb-0.5" style={{ fontSize: 9, fontFamily: "ui-monospace, monospace", letterSpacing: 1, color: "#8BA4BB" }}>
                        Closing
                      </p>
                      <p className="text-sm" style={{ color: "#0F2942" }}>{pxi.closing_note}</p>
                    </div>
                  )}
                  {pxi.section_breaks && pxi.section_breaks.length > 0 && (
                    <div>
                      <p className="font-bold uppercase mb-1" style={{ fontSize: 9, fontFamily: "ui-monospace, monospace", letterSpacing: 1, color: "#8BA4BB" }}>
                        Section Breaks
                      </p>
                      <div className="space-y-1">
                        {pxi.section_breaks.map((sb, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <span className="text-[10px]" style={{ fontFamily: "ui-monospace, monospace", color: "#EA580C" }}>
                              After clip {sb.after_clip_index + 1}:
                            </span>
                            <span className="text-xs" style={{ color: "#0F2942" }}>{sb.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {pxi.notes && (
                    <div className="pt-2" style={{ borderTop: "1px solid #DDE6EF" }}>
                      <p className="font-bold uppercase mb-0.5" style={{ fontSize: 9, fontFamily: "ui-monospace, monospace", letterSpacing: 1, color: "#8BA4BB" }}>
                        Notes
                      </p>
                      <p className="text-sm" style={{ color: "#5A7291" }}>{pxi.notes}</p>
                    </div>
                  )}
                  {pxi.duration_estimate_seconds && (
                    <p className="text-[10px]" style={{ fontFamily: "ui-monospace, monospace", color: "#8BA4BB" }}>
                      Estimated duration: {formatDuration(pxi.duration_estimate_seconds)}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Reel metadata */}
            <div className="overflow-hidden" style={{ borderRadius: 12, border: "1.5px solid #DDE6EF" }}>
              <div className="flex items-center gap-2 px-5 py-3" style={{ background: "#0F2942" }}>
                <span className="w-2 h-2 rounded-full" style={{ background: "#8BA4BB" }} />
                <span className="font-bold uppercase text-white" style={{ fontSize: 10, fontFamily: "ui-monospace, monospace", letterSpacing: 2 }}>
                  DETAILS
                </span>
              </div>
              <div className="bg-white px-5 py-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span style={{ color: "#8BA4BB" }}>Created</span>
                  <span style={{ color: "#0F2942" }}>{formatDate(reel.created_at)}</span>
                </div>
                {reel.updated_at && (
                  <div className="flex justify-between">
                    <span style={{ color: "#8BA4BB" }}>Updated</span>
                    <span style={{ color: "#0F2942" }}>{formatDate(reel.updated_at)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span style={{ color: "#8BA4BB" }}>Visibility</span>
                  <span className="capitalize" style={{ color: "#0F2942" }}>{reel.visibility}</span>
                </div>
                {reel.description && (
                  <div className="pt-2" style={{ borderTop: "1px solid #DDE6EF" }}>
                    <span className="block text-xs mb-0.5" style={{ color: "#8BA4BB" }}>Description</span>
                    <p style={{ color: "#5A7291" }}>{reel.description}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </ProtectedRoute>
  );
}
