"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
  const [reelsPulse, setReelsPulse] = useState(false);
  const reelsPulsed = useRef(false);

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

  // Pulse the reels badge once on first load when reel_count > 0
  useEffect(() => {
    if (stats && (stats.reels ?? 0) > 0 && !reelsPulsed.current) {
      reelsPulsed.current = true;
      setReelsPulse(true);
      const t = setTimeout(() => setReelsPulse(false), 3000);
      return () => clearTimeout(t);
    }
  }, [stats]);

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
              { key: "all" as StatsFilter, label: "Sessions", value: stats.sessions, valueColor: "#F97316" },
              { key: "clips" as StatsFilter, label: "Clips", value: stats.clips, valueColor: "#22D3EE" },
              { key: "events" as StatsFilter, label: "Events", value: stats.events, valueColor: "#A5B4FC" },
              { key: "reports" as StatsFilter, label: "Reports", value: stats.film_reports, valueColor: "#34D399" },
            ]).map((pill) => (
              <button
                key={pill.key}
                onClick={() => {
                  const next = activeFilter === pill.key ? "all" : pill.key;
                  setActiveFilter(next);
                  if (next !== "all") setActiveTab("sessions");
                  try { sessionStorage.setItem("film_hub_filter", next); } catch { /* */ }
                }}
                style={{
                  background: "#0F2942",
                  borderRadius: 10,
                  padding: "12px 16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  cursor: "pointer",
                  border: "none",
                  textAlign: "left",
                  transition: "background 0.15s, box-shadow 0.15s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#102C4A"; e.currentTarget.style.boxShadow = "0 0 0 1px rgba(20,184,166,0.5)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "#0F2942"; e.currentTarget.style.boxShadow = "none"; }}
              >
                <span style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 600, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.6)" }}>
                  {pill.label}
                </span>
                <span style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 22, color: pill.valueColor }}>
                  {pill.value}
                </span>
              </button>
            ))}
            <button
              onClick={() => {
                setActiveTab("reels");
                setActiveFilter("all");
                try { sessionStorage.setItem("film_hub_tab", "reels"); sessionStorage.setItem("film_hub_filter", "all"); } catch { /* */ }
              }}
              style={{
                background: "#0F2942",
                borderRadius: 10,
                padding: "12px 16px",
                display: "flex",
                flexDirection: "column",
                gap: 4,
                cursor: "pointer",
                border: "none",
                textAlign: "left",
                transition: "background 0.15s, box-shadow 0.15s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#102C4A"; e.currentTarget.style.boxShadow = "0 0 0 1px rgba(20,184,166,0.5)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "#0F2942"; e.currentTarget.style.boxShadow = "none"; }}
            >
              <span style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 600, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.6)" }}>
                Reels
              </span>
              <span style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 22, color: "#F97316" }}>
                {stats.reels ?? 0}
              </span>
            </button>
          </div>
        )}

        {/* ── Tab Bar ─────────────────────────────────────────── */}
        <style>{`@keyframes reels-pulse { 0%,100% { box-shadow: 0 0 0 2px rgba(249,115,22,0.5) } 50% { box-shadow: 0 0 0 4px rgba(249,115,22,0.8) } }`}</style>
        <div className="flex items-center gap-1" style={{ background: "transparent", borderBottom: "1px solid rgba(15,41,66,0.6)", padding: "0 16px" }}>
          {([
            { key: "sessions" as HubTab, label: "Sessions" },
            { key: "uploads" as HubTab, label: "Uploads" },
            { key: "reels" as HubTab, label: "Reels" },
          ]).map((tab) => {
            const isActive = activeTab === tab.key;
            const reelCount = stats?.reels ?? 0;
            return (
              <button
                key={tab.key}
                onClick={() => {
                  setActiveTab(tab.key);
                  if (tab.key !== "sessions") { setActiveFilter("all"); try { sessionStorage.setItem("film_hub_filter", "all"); } catch { /* */ } }
                  try { sessionStorage.setItem("film_hub_tab", tab.key); } catch { /* */ }
                }}
                style={{
                  padding: "8px 14px",
                  borderRadius: 999,
                  fontFamily: "'Oswald', sans-serif",
                  fontWeight: 600,
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                  color: "#FFFFFF",
                  background: isActive ? "#0F2942" : "#14B8A8",
                  boxShadow: isActive ? "0 0 0 1px #14B8A8" : "none",
                  border: "none",
                  cursor: "pointer",
                  transition: "background 0.15s, color 0.15s, box-shadow 0.15s",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
                onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.background = "#0F8C82"; } }}
                onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.background = "#14B8A8"; } }}
              >
                {tab.label}
                {tab.key === "reels" && reelCount > 0 && (
                  <span
                    style={{
                      background: "#F97316",
                      color: "#0F172A",
                      borderRadius: 999,
                      padding: "0 6px",
                      fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                      fontSize: 10,
                      fontWeight: 700,
                      lineHeight: "16px",
                      animation: reelsPulse ? "reels-pulse 0.6s ease-in-out infinite" : "none",
                    }}
                  >
                    {reelCount}
                  </span>
                )}
              </button>
            );
          })}
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
                            href={`/reels/${reel.id}`}
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
