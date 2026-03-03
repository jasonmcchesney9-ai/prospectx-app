"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  Upload,
  Save,
  Archive,
  Scissors,
  Video,
} from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import api from "@/lib/api";

/* ── Types ─────────────────────────────────────────────────── */
interface SessionData {
  id: string;
  title: string;
  session_type: string;
  description: string | null;
  status: string;
  team_id?: string;
  created_at: string;
  mux_asset_id?: string | null;
  mux_playback_id?: string | null;
}

const SESSION_TYPE_LABELS: Record<string, string> = {
  general: "General",
  game_review: "Game Review",
  opponent_prep: "Opponent Prep",
  practice: "Practice",
  recruitment: "Recruitment",
  pre_game: "Pre-Game",
  post_game: "Post-Game",
  opponent_study: "Opponent Study",
  free_view: "Free View",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600 border-gray-200",
  active: "bg-green-100 text-green-700 border-green-200",
  archived: "bg-blue-100 text-blue-700 border-blue-200",
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

/* ── Page ──────────────────────────────────────────────────── */
export default function FilmRoomSessionDetailPage() {
  const params = useParams();
  const sessionId = params.id as string;

  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /* Coach notes */
  const [notes, setNotes] = useState("");
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);

  /* Upload state */
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState("");
  const [polling, setPolling] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* Load session */
  useEffect(() => {
    api
      .get(`/film/sessions/${sessionId}`)
      .then((r) => {
        setSession(r.data);
        setNotes(r.data.description || "");
      })
      .catch(() => setError("Session not found"))
      .finally(() => setLoading(false));
  }, [sessionId]);

  /* Archive */
  const handleArchive = async () => {
    if (!session) return;
    try {
      await api.patch(`/film/sessions/${sessionId}`, { status: "archived" });
      setSession({ ...session, status: "archived" });
    } catch {
      /* ignore */
    }
  };

  /* Save notes */
  const handleSaveNotes = async () => {
    setNotesSaving(true);
    try {
      await api.patch(`/film/sessions/${sessionId}`, { description: notes });
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 3000);
    } catch {
      /* ignore */
    } finally {
      setNotesSaving(false);
    }
  };

  /* Upload flow: get Mux direct upload URL, upload file, poll for readiness */
  const handleUpload = async (file: File) => {
    setUploading(true);
    setUploadProgress(0);
    setUploadError("");

    try {
      /* Step 1: Get Mux direct upload URL */
      const { data } = await api.post("/film/uploads/create-url", {
        title: file.name,
        session_id: sessionId,
      });
      const uploadUrl = data.upload_url;
      const uploadId = data.upload_id;

      if (!uploadUrl) {
        setUploadError("Failed to get upload URL. Is Mux configured?");
        setUploading(false);
        return;
      }

      /* Step 2: Upload file directly to Mux */
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            setUploadProgress(Math.round((e.loaded / e.total) * 100));
          }
        };
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("Upload failed")));
        xhr.onerror = () => reject(new Error("Upload failed"));
        xhr.send(file);
      });

      /* Step 3: Poll for Mux processing */
      setPolling(true);
      setUploadProgress(100);

      let attempts = 0;
      const maxAttempts = 60; // 5 min max
      const pollInterval = setInterval(async () => {
        attempts++;
        try {
          const statusRes = await api.get(`/film/uploads/${uploadId}/status`);
          const status = statusRes.data?.status;
          const playbackId = statusRes.data?.mux_playback_id;

          if (status === "ready" && playbackId) {
            clearInterval(pollInterval);
            setPolling(false);
            setUploading(false);
            // Refresh session data
            const refreshed = await api.get(`/film/sessions/${sessionId}`);
            setSession(refreshed.data);
          } else if (status === "errored" || status === "error") {
            clearInterval(pollInterval);
            setPolling(false);
            setUploading(false);
            setUploadError("Mux processing failed. Try again.");
          } else if (attempts >= maxAttempts) {
            clearInterval(pollInterval);
            setPolling(false);
            setUploading(false);
            setUploadError("Processing timed out. Check back later.");
          }
        } catch {
          // Keep polling on network errors
        }
      }, 5000);
    } catch {
      setUploadError("Upload failed. Please try again.");
      setUploading(false);
    }
  };

  const hasVideo = session?.mux_playback_id;

  /* Loading / error */
  if (loading) {
    return (
      <ProtectedRoute>
        <NavBar />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center py-24">
            <Loader2 size={28} className="animate-spin text-teal" />
          </div>
        </main>
      </ProtectedRoute>
    );
  }

  if (error || !session) {
    return (
      <ProtectedRoute>
        <NavBar />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-24">
            <p className="text-sm text-red-500 mb-3">{error || "Session not found"}</p>
            <Link href="/film-room" className="text-sm text-teal hover:underline">
              ← Back to Film Room
            </Link>
          </div>
        </main>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <NavBar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Session header */}
        <div className="bg-white px-5 py-4 flex items-center justify-between mb-4 rounded-xl border border-gray-200">
          <div className="flex items-center gap-3">
            <Link href="/film-room" className="text-muted hover:text-navy transition-colors">
              <ArrowLeft size={20} />
            </Link>
            <span
              className="px-2.5 py-1 rounded-md text-white font-bold uppercase"
              style={{ fontSize: 10, fontFamily: "ui-monospace, monospace", letterSpacing: 2, background: "#EA580C" }}
            >
              {SESSION_TYPE_LABELS[session.session_type] || session.session_type}
            </span>
            <div>
              <h1 className="text-lg font-bold text-navy">{session.title}</h1>
              <p className="text-xs text-muted">{formatDate(session.created_at)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`px-3 py-1 rounded-lg text-xs font-bold uppercase border ${
                STATUS_COLORS[session.status] || STATUS_COLORS.active
              }`}
              style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 1 }}
            >
              {session.status || "active"}
            </span>
            <button
              onClick={handleArchive}
              className="flex items-center gap-1 px-3 py-2 text-xs font-oswald uppercase tracking-wider text-muted border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Archive size={12} />
              Archive
            </button>
          </div>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* LEFT — Video panel (60%) */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {hasVideo ? (
                /* Mux Player */
                <div style={{ aspectRatio: "16/9", background: "#000" }}>
                  <iframe
                    src={`https://stream.mux.com/${session.mux_playback_id}.m3u8`}
                    style={{ width: "100%", height: "100%", border: "none" }}
                    title="Video player"
                    allowFullScreen
                  />
                </div>
              ) : (
                /* Placeholder */
                <div
                  className="flex flex-col items-center justify-center"
                  style={{ aspectRatio: "16/9", background: "#E5E7EB" }}
                >
                  <Video size={40} className="text-muted/30 mb-3" />
                  <p className="text-sm text-muted font-semibold mb-3">No video uploaded yet</p>

                  {uploading ? (
                    <div className="w-64">
                      <div className="flex items-center justify-between text-xs text-muted mb-1">
                        <span>{polling ? "Processing..." : "Uploading..."}</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <div className="w-full bg-gray-300 rounded-full h-2">
                        <div
                          className="bg-teal rounded-full h-2 transition-all duration-300"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-2 px-5 py-2.5 bg-teal text-white text-sm font-oswald uppercase tracking-wider rounded-lg hover:bg-teal/90 transition-colors"
                      >
                        <Upload size={14} />
                        Upload Video
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="video/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleUpload(file);
                        }}
                      />
                    </>
                  )}

                  {uploadError && (
                    <p className="text-xs text-red-500 mt-2">{uploadError}</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT — Notes panel (40%) */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-xs font-oswald uppercase tracking-wider text-navy mb-3">
                Session Notes
              </h3>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add coaching notes, observations, key takeaways..."
                rows={12}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal resize-none"
              />
              <div className="flex items-center justify-between mt-3">
                {notesSaved && (
                  <span className="text-xs text-green-600">Saved</span>
                )}
                {!notesSaved && <span />}
                <button
                  onClick={handleSaveNotes}
                  disabled={notesSaving}
                  className="flex items-center gap-1.5 px-4 py-2 bg-teal text-white text-xs font-oswald uppercase tracking-wider rounded-lg hover:bg-teal/90 transition-colors disabled:opacity-50"
                >
                  {notesSaving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                  Save Notes
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Clips list — below two columns */}
        <div className="mt-4 bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-xs font-oswald uppercase tracking-wider text-navy mb-3 flex items-center gap-2">
            <Scissors size={14} className="text-teal" />
            Clips
          </h3>
          <div className="text-center py-8">
            <Scissors size={28} className="mx-auto text-muted/20 mb-2" />
            <p className="text-sm text-muted">No clips tagged yet</p>
            <p className="text-xs text-muted/60 mt-1">
              Upload a video first, then tag clips during playback
            </p>
          </div>
        </div>
      </main>
    </ProtectedRoute>
  );
}
