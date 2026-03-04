"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Film, Upload, Video, Clock, Scissors, Eye, Loader2, AlertCircle, Trash2, RefreshCw } from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import api from "@/lib/api";
import toast from "react-hot-toast";

interface FilmSession {
  id: string;
  title: string;
  session_type: string;
  description: string | null;
  created_at: string;
  clip_count?: number;
}

interface VideoUploadRow {
  id: string;
  title: string;
  status: string;
  created_at: string;
  upload_source: string;
}

const SESSION_TYPE_LABELS: Record<string, string> = {
  general: "General",
  game_review: "Game Review",
  opponent_prep: "Opponent Prep",
  practice: "Practice",
  recruitment: "Recruitment",
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

export default function FilmRoomPage() {
  const [sessions, setSessions] = useState<FilmSession[]>([]);
  const [uploads, setUploads] = useState<VideoUploadRow[]>([]);
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

  return (
    <ProtectedRoute>
      <NavBar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-navy font-oswald uppercase tracking-wider">
              Film Room
            </h1>
            <p className="text-sm text-muted mt-1">
              Upload game film, create sessions, and tag key moments.
            </p>
          </div>
          <Link
            href="/film/upload"
            className="flex items-center gap-2 bg-orange text-white px-5 py-2.5 rounded-lg font-oswald uppercase tracking-wider text-sm hover:bg-orange/90 transition-colors"
          >
            <Upload size={16} />
            New Upload
          </Link>
        </div>

        {/* Section 1 — Recent Sessions */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-navy font-oswald uppercase tracking-wider mb-4">
            Recent Sessions
          </h2>

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
            <div className="text-center py-12 bg-white rounded-xl border border-border">
              <Film size={36} className="mx-auto text-teal/40 mb-3" />
              <p className="text-sm text-muted">
                No film sessions yet. Upload a video to get started.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sessions.map((s) => (
                <div
                  key={s.id}
                  className="bg-white rounded-xl border border-border p-5 flex flex-col"
                >
                  <h3 className="text-sm font-bold text-navy font-oswald uppercase tracking-wider truncate">
                    {s.title}
                  </h3>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[10px] font-oswald uppercase tracking-wider bg-teal/10 text-teal px-2 py-0.5 rounded-full">
                      {SESSION_TYPE_LABELS[s.session_type] || s.session_type}
                    </span>
                    <span className="text-[11px] text-muted">
                      {formatDate(s.created_at)}
                    </span>
                  </div>
                  {s.clip_count !== undefined && s.clip_count > 0 && (
                    <div className="flex items-center gap-1 mt-2 text-[11px] text-muted">
                      <Scissors size={12} />
                      {s.clip_count} clip{s.clip_count !== 1 ? "s" : ""}
                    </div>
                  )}
                  <div className="mt-auto pt-4 flex items-center gap-2">
                    <Link
                      href={`/film/sessions/${s.id}`}
                      className="flex items-center justify-center gap-1.5 flex-1 bg-navy/5 text-navy px-3 py-2 rounded-lg text-xs font-oswald uppercase tracking-wider hover:bg-navy/10 transition-colors"
                    >
                      <Eye size={13} />
                      View Session
                    </Link>
                    <button
                      onClick={() => handleDeleteSession(s.id)}
                      className="p-2 rounded-lg text-muted/40 hover:text-red-500 hover:bg-red-50 transition-colors"
                      title="Delete session"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Section 2 — Recent Uploads */}
        <section>
          <h2 className="text-lg font-bold text-navy font-oswald uppercase tracking-wider mb-4">
            Recent Uploads
          </h2>

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
            <div className="text-center py-12 bg-white rounded-xl border border-border">
              <Video size={36} className="mx-auto text-muted/30 mb-3" />
              <p className="text-sm text-muted">No uploads yet.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-border divide-y divide-border">
              {uploads.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between px-5 py-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Video size={16} className="text-muted/50 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-navy truncate">
                        {u.title}
                      </p>
                      <p className="text-[11px] text-muted">
                        {formatDate(u.created_at)}
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
                    {u.status === "ready" && (
                      <Link
                        href={`/film/sessions/new?upload=${u.id}`}
                        className="text-xs text-teal font-oswald uppercase tracking-wider hover:text-teal/80 transition-colors"
                      >
                        View
                      </Link>
                    )}
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
          )}
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
