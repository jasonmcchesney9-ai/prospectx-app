"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Film, Upload, Video, Scissors, Eye, Loader2, AlertCircle, Trash2, RefreshCw, ExternalLink, Plus, BarChart3, Tag, FileText, CheckCircle2 } from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import api from "@/lib/api";
import toast from "react-hot-toast";

interface FilmSession {
  id: string;
  title: string;
  name?: string;
  session_type: string;
  description: string | null;
  created_at: string;
  clip_count?: number;
  event_count?: number;
  pxi_status?: string;
  pxi_output?: string | null;
}

interface VideoUploadRow {
  id: string;
  title: string;
  status: string;
  created_at: string;
  upload_source: string;
  source_url?: string;
  session_id?: string | null;
  file_size_bytes?: number;
}

interface FilmStats {
  sessions: number;
  clips: number;
  events: number;
  film_reports: number;
}

const SESSION_TYPE_LABELS: Record<string, string> = {
  general: "General",
  game_review: "Game Review",
  opponent_prep: "Opponent Prep",
  practice: "Practice",
  recruitment: "Recruitment",
};

const SESSION_TYPE_COLORS: Record<string, string> = {
  game_review: "bg-teal/20 text-teal",
  opponent_prep: "bg-orange/20 text-orange",
  practice: "bg-blue-500/20 text-blue-400",
  recruitment: "bg-purple-500/20 text-purple-400",
  general: "bg-white/10 text-white/60",
};

const PXI_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  completed: { label: "PXI Ready", color: "bg-teal/20 text-teal" },
  processing: { label: "Analyzing...", color: "bg-orange/20 text-orange" },
  pending: { label: "No Analysis", color: "bg-white/10 text-white/40" },
};

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

function formatFileSize(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default function FilmRoomPage() {
  const [sessions, setSessions] = useState<FilmSession[]>([]);
  const [uploads, setUploads] = useState<VideoUploadRow[]>([]);
  const [stats, setStats] = useState<FilmStats | null>(null);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingUploads, setLoadingUploads] = useState(true);
  const [errorSessions, setErrorSessions] = useState("");
  const [errorUploads, setErrorUploads] = useState("");

  useEffect(() => {
    api
      .get("/film/sessions")
      .then((r) => setSessions(r.data))
      .catch((e) => {
        const msg = e.response?.data?.detail || "Failed to load sessions";
        setErrorSessions(msg);
        toast.error(msg);
      })
      .finally(() => setLoadingSessions(false));

    api
      .get("/film/uploads")
      .then((r) => setUploads(r.data))
      .catch((e) => {
        const msg = e.response?.data?.detail || "Failed to load uploads";
        setErrorUploads(msg);
        toast.error(msg);
      })
      .finally(() => setLoadingUploads(false));

    api.get("/film/stats").then((r) => setStats(r.data)).catch(() => {});
  }, []);

  const handleDeleteSession = async (id: string) => {
    if (!confirm("Delete this film session? This cannot be undone.")) return;
    try {
      await api.delete(`/film/sessions/${id}`);
      setSessions((prev) => prev.filter((s) => s.id !== id));
      toast.success("Session deleted");
    } catch {
      toast.error("Failed to delete session");
    }
  };

  const handleDeleteUpload = async (id: string) => {
    if (!confirm("Delete this upload? All linked clips and events will also be removed.")) return;
    try {
      await api.delete(`/film/uploads/${id}`);
      setUploads((prev) => prev.filter((u) => u.id !== id));
      toast.success("Upload deleted");
    } catch {
      toast.error("Failed to delete upload");
    }
  };

  const handleRefreshStatus = async (id: string) => {
    try {
      const { data } = await api.get(`/film/uploads/${id}/status`);
      setUploads((prev) =>
        prev.map((u) => (u.id === id ? { ...u, status: data.status || u.status } : u))
      );
      toast.success(`Status: ${data.status || "unknown"}`);
    } catch {
      toast.error("Failed to refresh status");
    }
  };

  const displaySessions = sessions.slice(0, 6);
  const displayUploads = uploads.slice(0, 6);

  return (
    <ProtectedRoute>
      <NavBar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* ── War Room Header ─────────────────────────────────── */}
        <div className="bg-[#0F2942] rounded-xl p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-teal/20 flex items-center justify-center">
                <Film size={20} className="text-teal" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-oswald uppercase tracking-wider text-white">Film Hub</h1>
                  <span className="text-[9px] font-oswald uppercase tracking-widest bg-teal/20 text-teal px-2 py-0.5 rounded">PXI</span>
                </div>
                <p className="text-xs text-white/50 mt-0.5">
                  Upload game footage, tag events, create clips, and generate PXI film analysis.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/film/upload"
                className="flex items-center gap-1.5 bg-teal text-white px-4 py-2 rounded-lg font-oswald uppercase tracking-wider text-xs hover:bg-teal/90 transition-colors"
              >
                <Upload size={14} />
                Upload Video
              </Link>
              <Link
                href="/film/sessions/new"
                className="flex items-center gap-1.5 border border-teal/40 text-teal px-4 py-2 rounded-lg font-oswald uppercase tracking-wider text-xs hover:bg-teal/10 transition-colors"
              >
                <Plus size={14} />
                Create Session
              </Link>
            </div>
          </div>
        </div>

        {/* ── Quick Stats Bar ─────────────────────────────────── */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white rounded-lg border border-border px-4 py-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded bg-navy/5 flex items-center justify-center">
                <Film size={14} className="text-navy/60" />
              </div>
              <div>
                <p className="text-lg font-oswald text-navy">{stats.sessions}</p>
                <p className="text-[10px] font-oswald uppercase tracking-wider text-muted">Sessions</p>
              </div>
            </div>
            <div className="bg-white rounded-lg border border-border px-4 py-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded bg-teal/10 flex items-center justify-center">
                <Scissors size={14} className="text-teal" />
              </div>
              <div>
                <p className="text-lg font-oswald text-navy">{stats.clips}</p>
                <p className="text-[10px] font-oswald uppercase tracking-wider text-muted">Clips</p>
              </div>
            </div>
            <div className="bg-white rounded-lg border border-border px-4 py-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded bg-orange/10 flex items-center justify-center">
                <Tag size={14} className="text-orange" />
              </div>
              <div>
                <p className="text-lg font-oswald text-navy">{stats.events}</p>
                <p className="text-[10px] font-oswald uppercase tracking-wider text-muted">Events</p>
              </div>
            </div>
            <div className="bg-white rounded-lg border border-border px-4 py-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded bg-purple-100 flex items-center justify-center">
                <FileText size={14} className="text-purple-600" />
              </div>
              <div>
                <p className="text-lg font-oswald text-navy">{stats.film_reports}</p>
                <p className="text-[10px] font-oswald uppercase tracking-wider text-muted">Reports</p>
              </div>
            </div>
          </div>
        )}

        {/* ── Recent Sessions ─────────────────────────────────── */}
        <section>
          <div className="bg-[#0F2942] rounded-t-xl px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-oswald uppercase tracking-widest text-white/80">Recent Sessions</h2>
              {!loadingSessions && sessions.length > 0 && (
                <span className="text-[9px] font-oswald bg-white/10 text-white/50 px-2 py-0.5 rounded">{sessions.length}</span>
              )}
            </div>
          </div>
          <div className="bg-white rounded-b-xl border border-t-0 border-border p-4">
            {loadingSessions ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={24} className="animate-spin text-teal" />
                <span className="ml-2 text-sm text-muted">Loading sessions...</span>
              </div>
            ) : errorSessions ? (
              <div className="flex items-center justify-center py-12 text-red-500 text-sm">
                <AlertCircle size={16} className="mr-2" />
                {errorSessions}
              </div>
            ) : sessions.length === 0 ? (
              <div className="text-center py-12">
                <Film size={36} className="mx-auto text-teal/30 mb-3" />
                <p className="text-sm text-muted mb-3">No film sessions yet. Upload a video to get started.</p>
                <Link
                  href="/film/upload"
                  className="inline-flex items-center gap-1.5 bg-teal text-white px-4 py-2 rounded-lg font-oswald uppercase tracking-wider text-xs hover:bg-teal/90 transition-colors"
                >
                  <Upload size={14} />
                  Upload Video
                </Link>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {displaySessions.map((s) => {
                    const sessionName = s.name || s.title;
                    const pxiCfg = PXI_STATUS_CONFIG[s.pxi_status || "pending"] || PXI_STATUS_CONFIG.pending;
                    const typeCfg = SESSION_TYPE_COLORS[s.session_type] || SESSION_TYPE_COLORS.general;
                    return (
                      <div key={s.id} className="rounded-xl border border-border overflow-hidden flex flex-col group">
                        {/* Card header — navy */}
                        <div className="bg-[#0F2942] px-4 py-3 flex items-center justify-between">
                          <h3 className="text-sm font-oswald uppercase tracking-wider text-white truncate flex-1 mr-2">
                            {sessionName}
                          </h3>
                          <button
                            onClick={(e) => { e.preventDefault(); handleDeleteSession(s.id); }}
                            className="p-1 rounded text-white/20 hover:text-red-400 hover:bg-white/10 transition-colors shrink-0"
                            title="Delete session"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                        {/* Card body — white */}
                        <Link href={`/film/sessions/${s.id}`} className="bg-white px-4 py-3 flex-1 flex flex-col hover:bg-navy/[0.02] transition-colors">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-[9px] font-oswald uppercase tracking-widest px-2 py-0.5 rounded ${typeCfg}`}>
                              {SESSION_TYPE_LABELS[s.session_type] || s.session_type}
                            </span>
                            <span className="text-[11px] text-muted">{formatDate(s.created_at)}</span>
                          </div>
                          <div className="flex items-center gap-3 mt-2.5 text-[11px] text-muted">
                            <span className="flex items-center gap-1">
                              <Scissors size={11} className="text-teal/60" />
                              {s.clip_count ?? 0} clip{(s.clip_count ?? 0) !== 1 ? "s" : ""}
                            </span>
                            <span className="flex items-center gap-1">
                              <Tag size={11} className="text-orange/60" />
                              {s.event_count ?? 0} event{(s.event_count ?? 0) !== 1 ? "s" : ""}
                            </span>
                          </div>
                          {/* PXI status badge */}
                          <div className="mt-auto pt-3">
                            <span className={`inline-flex items-center gap-1 text-[9px] font-oswald uppercase tracking-widest px-2 py-0.5 rounded ${pxiCfg.color}`}>
                              {s.pxi_status === "completed" ? <CheckCircle2 size={10} /> : <BarChart3 size={10} />}
                              {pxiCfg.label}
                            </span>
                          </div>
                        </Link>
                      </div>
                    );
                  })}
                </div>
                {sessions.length > 6 && (
                  <div className="text-center mt-4">
                    <Link href="/video-sessions" className="text-xs font-oswald uppercase tracking-wider text-teal hover:text-teal/80 transition-colors">
                      View All Sessions →
                    </Link>
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        {/* ── Recent Uploads ──────────────────────────────────── */}
        <section>
          <div className="bg-[#0F2942] rounded-t-xl px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-oswald uppercase tracking-widest text-white/80">Recent Uploads</h2>
              {!loadingUploads && uploads.length > 0 && (
                <span className="text-[9px] font-oswald bg-white/10 text-white/50 px-2 py-0.5 rounded">{uploads.length}</span>
              )}
            </div>
          </div>
          <div className="bg-white rounded-b-xl border border-t-0 border-border">
            {loadingUploads ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={24} className="animate-spin text-teal" />
                <span className="ml-2 text-sm text-muted">Loading uploads...</span>
              </div>
            ) : errorUploads ? (
              <div className="flex items-center justify-center py-12 text-red-500 text-sm">
                <AlertCircle size={16} className="mr-2" />
                {errorUploads}
              </div>
            ) : uploads.length === 0 ? (
              <div className="text-center py-12">
                <Video size={36} className="mx-auto text-muted/30 mb-3" />
                <p className="text-sm text-muted">No uploads yet. Click &ldquo;Upload Video&rdquo; to add game footage.</p>
              </div>
            ) : (
              <>
                <div className="divide-y divide-border">
                  {displayUploads.map((u) => (
                    <div key={u.id} className="flex items-center justify-between px-5 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {u.upload_source === "external_link" ? (
                          <ExternalLink size={16} className="text-teal/50 shrink-0" />
                        ) : (
                          <Video size={16} className="text-muted/50 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-navy truncate">{u.title}</p>
                          <p className="text-[11px] text-muted">
                            {formatDate(u.created_at)}
                            {u.file_size_bytes ? ` · ${formatFileSize(u.file_size_bytes)}` : ""}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <StatusBadge status={u.status} />
                        {(u.status === "processing" || u.status === "waiting") && (
                          <button
                            onClick={() => handleRefreshStatus(u.id)}
                            className="p-1.5 rounded-lg text-teal/60 hover:text-teal hover:bg-teal/10 transition-colors"
                            title="Refresh upload status"
                          >
                            <RefreshCw size={13} />
                          </button>
                        )}
                        {u.status === "ready" && u.upload_source === "external_link" && u.source_url ? (
                          <a
                            href={u.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-teal font-oswald uppercase tracking-wider hover:text-teal/80 transition-colors"
                          >
                            <ExternalLink size={12} />
                            Open
                          </a>
                        ) : u.status === "ready" && u.session_id ? (
                          <Link
                            href={`/film/sessions/${u.session_id}`}
                            className="flex items-center gap-1 text-xs text-teal font-oswald uppercase tracking-wider hover:text-teal/80 transition-colors"
                          >
                            <Eye size={13} />
                            View
                          </Link>
                        ) : u.status === "ready" ? (
                          <Link
                            href={`/film/sessions/new?upload=${u.id}`}
                            className="text-xs text-orange font-oswald uppercase tracking-wider hover:text-orange/80 transition-colors"
                          >
                            Create Session
                          </Link>
                        ) : null}
                        <button
                          onClick={() => handleDeleteUpload(u.id)}
                          className="p-1.5 rounded-lg text-muted/40 hover:text-red-500 hover:bg-red-50 transition-colors"
                          title="Delete upload"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                {uploads.length > 6 && (
                  <div className="text-center py-3 border-t border-border">
                    <Link href="/film/upload" className="text-xs font-oswald uppercase tracking-wider text-teal hover:text-teal/80 transition-colors">
                      View All Uploads →
                    </Link>
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </main>
    </ProtectedRoute>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; color: string }> = {
    processing: { label: "Processing", color: "bg-orange/10 text-orange" },
    waiting: { label: "Processing", color: "bg-orange/10 text-orange" },
    ready: { label: "Ready", color: "bg-teal/10 text-teal" },
    error: { label: "Error", color: "bg-red-100 text-red-600" },
    errored: { label: "Error", color: "bg-red-100 text-red-600" },
  };
  const c = config[status] || { label: status, color: "bg-gray-100 text-gray-600" };
  return (
    <span
      className={`text-[10px] font-oswald uppercase tracking-wider px-2 py-0.5 rounded-full ${c.color}`}
    >
      {c.label}
    </span>
  );
}
