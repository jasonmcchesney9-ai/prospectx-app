"use client";

import { useState, useEffect, useCallback } from "react";
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
  reels?: number;
}

interface ReelRow {
  id: string;
  title: string;
  status: string;
  clip_count: number;
  created_at: string;
}

type HubTab = "sessions" | "uploads" | "reels";
type StatsFilter = "all" | "clips" | "events" | "reports";

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

function formatLastOpened(iso: string): string | null {
  try {
    const opened = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - opened.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "Opened today";
    if (diffDays === 1) return "Opened yesterday";
    if (diffDays <= 14) return `Opened ${diffDays} days ago`;
    return `Opened ${opened.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  } catch {
    return null;
  }
}

export default function FilmRoomPage() {
  const [sessions, setSessions] = useState<FilmSession[]>([]);
  const [uploads, setUploads] = useState<VideoUploadRow[]>([]);
  const [stats, setStats] = useState<FilmStats | null>(null);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingUploads, setLoadingUploads] = useState(true);
  const [errorSessions, setErrorSessions] = useState("");
  const [errorUploads, setErrorUploads] = useState("");
  const [activeTab, setActiveTab] = useState<HubTab>(() => {
    try {
      const stored = sessionStorage.getItem("film_hub_tab");
      if (stored === "uploads" || stored === "reels") return stored;
    } catch { /* */ }
    return "sessions";
  });
  const [activeFilter, setActiveFilter] = useState<StatsFilter>(() => {
    try {
      const stored = sessionStorage.getItem("film_hub_filter");
      if (stored === "clips" || stored === "events" || stored === "reports") return stored;
    } catch { /* */ }
    return "all";
  });
  const [reels, setReels] = useState<ReelRow[]>([]);
  const [loadingReels, setLoadingReels] = useState(true);

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

    api.get("/film/stats").then(async (r) => {
      const s = r.data;
      try {
        const reelsRes = await api.get("/highlight-reels");
        const reelData = Array.isArray(reelsRes.data) ? reelsRes.data : [];
        s.reels = reelData.length;
        setReels(
          reelData.map((rr: { id: string; title: string; status: string; clip_ids?: string | string[]; created_at: string }) => ({
            id: rr.id,
            title: rr.title,
            status: rr.status || "draft",
            clip_count: Array.isArray(rr.clip_ids) ? rr.clip_ids.length : 0,
            created_at: rr.created_at,
          }))
        );
      } catch { s.reels = 0; }
      setStats(s);
      setLoadingReels(false);
    }).catch(() => { setLoadingReels(false); });
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

  const handleDeleteReel = useCallback(async (reelId: string) => {
    if (!confirm("Delete this reel?")) return;
    try {
      await api.delete(`/highlight-reels/${reelId}`);
      setReels((prev) => prev.filter((r) => r.id !== reelId));
      toast.success("Reel deleted");
    } catch {
      toast.error("Failed to delete reel");
    }
  }, []);

  const filteredSessions = activeFilter === "all"
    ? sessions
    : activeFilter === "clips"
    ? sessions.filter((s) => (s.clip_count ?? 0) > 0)
    : activeFilter === "events"
    ? sessions.filter((s) => (s.event_count ?? 0) > 0)
    : sessions.filter((s) => s.pxi_status === "completed");

  const displaySessions = filteredSessions.slice(0, 6);
  const displayUploads = uploads.slice(0, 6);

  return (
    <ProtectedRoute>
      <NavBar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* ── War Room Header ─────────────────────────────────── */}
        <div className="bg-[#0F2942] rounded-xl py-4 px-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-teal/20 flex items-center justify-center">
                <Film size={20} className="text-teal" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-oswald uppercase tracking-wider text-white" style={{ fontSize: 20 }}>Film Hub</h1>
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

        {/* ── Quick Stats Bar (clickable filters) ─────────────── */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {([
              { key: "all" as StatsFilter, label: "Sessions", value: stats.sessions, icon: <Film size={14} />, iconBg: "rgba(15,41,66,0.05)", iconColor: "rgba(15,41,66,0.6)" },
              { key: "clips" as StatsFilter, label: "Clips", value: stats.clips, icon: <Scissors size={14} />, iconBg: "rgba(13,148,136,0.1)", iconColor: "#0D9488" },
              { key: "events" as StatsFilter, label: "Events", value: stats.events, icon: <Tag size={14} />, iconBg: "rgba(234,88,12,0.1)", iconColor: "#EA580C" },
              { key: "reports" as StatsFilter, label: "Reports", value: stats.film_reports, icon: <FileText size={14} />, iconBg: "rgba(147,51,234,0.1)", iconColor: "#9333EA" },
            ]).map((pill) => {
              const isActive = activeFilter === pill.key && pill.key !== "all";
              return (
                <button
                  key={pill.key}
                  onClick={() => {
                    const next = activeFilter === pill.key ? "all" : pill.key;
                    setActiveFilter(next);
                    if (next !== "all") setActiveTab("sessions");
                    try { sessionStorage.setItem("film_hub_filter", next); } catch { /* */ }
                  }}
                  className="rounded-lg px-4 py-3 flex items-center gap-3 transition-colors text-left"
                  style={{
                    background: isActive ? "#0D9488" : "#FFFFFF",
                    border: isActive ? "1px solid #0D9488" : "1px solid #E2EAF3",
                    cursor: "pointer",
                  }}
                >
                  <div className="w-8 h-8 rounded flex items-center justify-center" style={{ background: isActive ? "rgba(255,255,255,0.2)" : pill.iconBg, color: isActive ? "#FFFFFF" : pill.iconColor }}>
                    {pill.icon}
                  </div>
                  <div>
                    <p className="text-lg font-oswald" style={{ color: isActive ? "#FFFFFF" : "#0F2942" }}>{pill.value}</p>
                    <p className="text-[10px] font-oswald uppercase tracking-wider" style={{ color: isActive ? "rgba(255,255,255,0.7)" : "#5A7291" }}>{pill.label}</p>
                  </div>
                </button>
              );
            })}
            <button
              onClick={() => {
                setActiveTab("reels");
                setActiveFilter("all");
                try { sessionStorage.setItem("film_hub_tab", "reels"); sessionStorage.setItem("film_hub_filter", "all"); } catch { /* */ }
              }}
              className="rounded-lg px-4 py-3 flex items-center gap-3 transition-colors text-left"
              style={{
                background: activeTab === "reels" ? "#0D9488" : "#FFFFFF",
                border: activeTab === "reels" ? "1px solid #0D9488" : "1px solid #E2EAF3",
                cursor: "pointer",
              }}
            >
              <div className="w-8 h-8 rounded flex items-center justify-center" style={{ background: activeTab === "reels" ? "rgba(255,255,255,0.2)" : "rgba(234,88,12,0.1)", color: activeTab === "reels" ? "#FFFFFF" : "#EA580C" }}>
                <Film size={14} />
              </div>
              <div>
                <p className="text-lg font-oswald" style={{ color: activeTab === "reels" ? "#FFFFFF" : "#0F2942" }}>{stats.reels ?? 0}</p>
                <p className="text-[10px] font-oswald uppercase tracking-wider" style={{ color: activeTab === "reels" ? "rgba(255,255,255,0.7)" : "#5A7291" }}>Reels</p>
              </div>
            </button>
          </div>
        )}

        {/* ── Tab Bar ─────────────────────────────────────────── */}
        <div className="flex items-center gap-1" style={{ borderBottom: "2px solid #E2EAF3" }}>
          {([
            { key: "sessions" as HubTab, label: "Sessions" },
            { key: "uploads" as HubTab, label: "Uploads" },
            { key: "reels" as HubTab, label: "Reels" },
          ]).map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key);
                if (tab.key !== "sessions") { setActiveFilter("all"); try { sessionStorage.setItem("film_hub_filter", "all"); } catch { /* */ } }
                try { sessionStorage.setItem("film_hub_tab", tab.key); } catch { /* */ }
              }}
              className="px-4 py-2.5 text-xs font-oswald uppercase tracking-widest transition-colors"
              style={{
                color: activeTab === tab.key ? "#0D9488" : "#5A7291",
                fontWeight: activeTab === tab.key ? 700 : 400,
                borderBottom: activeTab === tab.key ? "2px solid #0D9488" : "2px solid transparent",
                marginBottom: -2,
                background: "none",
                border: "none",
                borderBottomWidth: 2,
                borderBottomStyle: "solid",
                borderBottomColor: activeTab === tab.key ? "#0D9488" : "transparent",
                cursor: "pointer",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Sessions Tab ──────────────────────────────────────── */}
        {activeTab === "sessions" && (
        <section>
          <div className="bg-[#0F2942] rounded-t-xl px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-oswald uppercase tracking-widest text-white/80">Recent Sessions</h2>
              {!loadingSessions && filteredSessions.length > 0 && (
                <span className="text-[9px] font-oswald bg-white/10 text-white/50 px-2 py-0.5 rounded">{filteredSessions.length}{activeFilter !== "all" ? ` / ${sessions.length}` : ""}</span>
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
            ) : filteredSessions.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-sm" style={{ color: "#8BA4BB" }}>No sessions match this filter.</p>
                <button
                  onClick={() => { setActiveFilter("all"); try { sessionStorage.setItem("film_hub_filter", "all"); } catch { /* */ } }}
                  className="mt-2 text-xs font-oswald uppercase tracking-wider transition-colors"
                  style={{ color: "#0D9488", background: "none", border: "none", cursor: "pointer" }}
                >
                  Clear filter
                </button>
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
                          {(() => {
                            try {
                              const ts = localStorage.getItem(`film_session_opened_${s.id}`);
                              if (ts) {
                                const hint = formatLastOpened(ts);
                                if (hint) return (
                                  <p style={{ fontSize: 9, fontFamily: "'JetBrains Mono', monospace", color: "#8BA4BB", marginTop: 2 }}>
                                    {hint}
                                  </p>
                                );
                              }
                            } catch { /* */ }
                            return null;
                          })()}
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
                {filteredSessions.length > 6 && (
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
        )}

        {/* ── Uploads Tab ───────────────────────────────────────── */}
        {activeTab === "uploads" && (
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
        )}

        {/* ── Reels Tab ─────────────────────────────────────────── */}
        {activeTab === "reels" && (
        <section>
          <div className="bg-[#0F2942] rounded-t-xl px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-oswald uppercase tracking-widest text-white/80">Reels</h2>
              {reels.length > 0 && (
                <span className="text-[9px] font-oswald bg-white/10 text-white/50 px-2 py-0.5 rounded">{reels.length}</span>
              )}
            </div>
          </div>
          <div className="bg-white rounded-b-xl border border-t-0 border-border">
            {loadingReels ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={24} className="animate-spin text-teal" />
                <span className="ml-2 text-sm text-muted">Loading reels...</span>
              </div>
            ) : reels.length === 0 ? (
              <div className="text-center py-12">
                <Film size={36} className="mx-auto mb-3" style={{ color: "rgba(234,88,12,0.3)" }} />
                <p className="text-sm mb-3" style={{ color: "#5A7291" }}>No reels yet &mdash; build one from any session.</p>
                <button
                  onClick={() => { setActiveTab("sessions"); try { sessionStorage.setItem("film_hub_tab", "sessions"); } catch { /* */ } }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg font-oswald uppercase tracking-wider text-xs transition-colors"
                  style={{ background: "#0D9488", color: "#FFFFFF", border: "none", cursor: "pointer" }}
                >
                  <Film size={14} />
                  Go to Sessions
                </button>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {reels.map((reel) => {
                  const statusStyle = reel.status === "ready"
                    ? { background: "rgba(13,148,136,0.1)", color: "#0D9488" }
                    : reel.status === "shared"
                    ? { background: "rgba(234,88,12,0.1)", color: "#EA580C" }
                    : { background: "rgba(15,41,66,0.06)", color: "#5A7291" };
                  return (
                    <div key={reel.id} className="flex items-center justify-between px-5 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <Film size={14} style={{ color: "#EA580C", flexShrink: 0 }} />
                        <div className="min-w-0">
                          <Link
                            href={`/highlight-reels/${reel.id}`}
                            className="text-sm font-medium truncate block transition-colors"
                            style={{ color: "#0F2942" }}
                          >
                            {reel.title}
                          </Link>
                          <p className="text-[11px]" style={{ color: "#5A7291" }}>
                            {formatDate(reel.created_at)}
                            {" · "}
                            {reel.clip_count} clip{reel.clip_count !== 1 ? "s" : ""}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span
                          className="text-[9px] font-bold uppercase px-2 py-0.5 rounded"
                          style={{ fontFamily: "ui-monospace, monospace", ...statusStyle }}
                        >
                          {reel.status}
                        </span>
                        <button
                          onClick={() => handleDeleteReel(reel.id)}
                          className="p-1.5 rounded-lg transition-colors"
                          style={{ color: "rgba(90,114,145,0.4)" }}
                          title="Delete reel"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
        )}
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
