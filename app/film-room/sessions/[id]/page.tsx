"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
  Trash2,
  Play,
  Clock,
  Plus,
  Tag,
  Sparkles,
  Copy,
  RefreshCw,
  X,
} from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import api from "@/lib/api";
import MuxPlayer from "@mux/mux-player-react";

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

interface Clip {
  id: string;
  title: string;
  description?: string | null;
  start_time_seconds: number;
  end_time_seconds: number;
  clip_type?: string;
  player_ids?: string[];
  tags?: string[];
  created_at: string;
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

const FILM_REPORT_TYPES = [
  { value: "film_post_game_review", label: "Post-Game Review" },
  { value: "film_opponent_prep", label: "Opponent Prep" },
  { value: "film_player_analysis", label: "Player Analysis" },
  { value: "film_practice_review", label: "Practice Review" },
];

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

  /* Mux player ref for current time */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const muxPlayerRef = useRef<any>(null);
  const currentTimeRef = useRef<number>(0);

  /* Clip tagging state */
  const [clips, setClips] = useState<Clip[]>([]);
  const [tagging, setTagging] = useState(false);
  const [clipTitle, setClipTitle] = useState("");
  const [clipStart, setClipStart] = useState<number | null>(null);
  const [clipEnd, setClipEnd] = useState<number | null>(null);
  const [clipNote, setClipNote] = useState("");
  const [savingClip, setSavingClip] = useState(false);

  /* PXI analysis state */
  const [generating, setGenerating] = useState(false);
  const [analysisText, setAnalysisText] = useState("");
  const [showTypeSelector, setShowTypeSelector] = useState(false);

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

  /* Load clips for this session */
  const loadClips = useCallback(async () => {
    try {
      const r = await api.get(`/film/clips`, { params: { session_id: sessionId } });
      setClips(Array.isArray(r.data) ? r.data : []);
    } catch {
      /* ignore */
    }
  }, [sessionId]);

  useEffect(() => {
    loadClips();
  }, [loadClips]);

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

  /* Capture current playback time */
  const captureTime = (): number => {
    if (muxPlayerRef.current?.currentTime != null) {
      return muxPlayerRef.current.currentTime;
    }
    return currentTimeRef.current;
  };

  /* Format seconds → m:ss */
  const formatTime = (s: number): string => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  /* Save clip */
  const handleSaveClip = async () => {
    if (clipStart === null || clipEnd === null || !clipTitle.trim()) return;
    setSavingClip(true);
    try {
      await api.post("/film/clips", {
        title: clipTitle.trim(),
        description: clipNote.trim() || null,
        start_time_seconds: clipStart,
        end_time_seconds: clipEnd,
        session_id: sessionId,
        clip_type: "manual",
      });
      setClipTitle("");
      setClipStart(null);
      setClipEnd(null);
      setClipNote("");
      setTagging(false);
      loadClips();
    } catch {
      /* ignore */
    } finally {
      setSavingClip(false);
    }
  };

  /* Delete clip */
  const handleDeleteClip = async (clipId: string) => {
    try {
      await api.delete(`/film/clips/${clipId}`);
      setClips((prev) => prev.filter((c) => c.id !== clipId));
    } catch {
      /* ignore */
    }
  };

  /* Seek player to time */
  const handleSeekTo = (seconds: number) => {
    if (muxPlayerRef.current) {
      muxPlayerRef.current.currentTime = seconds;
      muxPlayerRef.current.play?.().catch(() => {});
    }
  };

  /* Generate PXI film analysis */
  const handleGenerateAnalysis = async (reportType: string) => {
    setGenerating(true);
    setShowTypeSelector(false);
    try {
      const res = await api.post(`/film/sessions/${sessionId}/generate-report`, {
        report_type: reportType,
      });
      const reportId = res.data?.report_id;
      if (reportId) {
        // Fetch the generated report text
        const reportRes = await api.get(`/reports/${reportId}`);
        const content = reportRes.data?.content || reportRes.data?.output || "";
        setAnalysisText(typeof content === "string" ? content : JSON.stringify(content, null, 2));
      }
    } catch {
      setAnalysisText("Failed to generate analysis. Make sure you have clips tagged first.");
    } finally {
      setGenerating(false);
    }
  };

  /* Copy analysis to session notes */
  const handleCopyToNotes = () => {
    if (!analysisText) return;
    const combined = notes ? `${notes}\n\n--- PXI Analysis ---\n${analysisText}` : analysisText;
    setNotes(combined);
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
                <MuxPlayer
                  ref={muxPlayerRef}
                  playbackId={session.mux_playback_id!}
                  streamType="on-demand"
                  style={{ width: "100%", aspectRatio: "16/9" }}
                  onTimeUpdate={() => {
                    if (muxPlayerRef.current?.currentTime != null) {
                      currentTimeRef.current = muxPlayerRef.current.currentTime;
                    }
                  }}
                />
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

            {/* Clip tagging bar — only shown when video exists */}
            {hasVideo && (
              <div className="mt-2 bg-white rounded-xl border border-gray-200 p-4">
                {!tagging ? (
                  <button
                    onClick={() => {
                      setTagging(true);
                      setClipStart(Math.floor(captureTime()));
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-teal text-white text-xs font-oswald uppercase tracking-wider rounded-lg hover:bg-teal/90 transition-colors"
                  >
                    <Tag size={12} />
                    Tag Clip
                  </button>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-xs font-oswald uppercase tracking-wider text-navy">
                      <Tag size={12} className="text-teal" />
                      Tag a Clip
                    </div>

                    {/* Time controls */}
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-muted uppercase font-oswald tracking-wider">Start</span>
                        <span className="bg-navy/5 px-2 py-1 rounded text-xs font-mono text-navy min-w-[48px] text-center">
                          {clipStart !== null ? formatTime(clipStart) : "--:--"}
                        </span>
                        <button
                          onClick={() => setClipStart(Math.floor(captureTime()))}
                          className="text-[10px] text-teal hover:underline"
                        >
                          Set
                        </button>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-muted uppercase font-oswald tracking-wider">End</span>
                        <span className="bg-navy/5 px-2 py-1 rounded text-xs font-mono text-navy min-w-[48px] text-center">
                          {clipEnd !== null ? formatTime(clipEnd) : "--:--"}
                        </span>
                        <button
                          onClick={() => setClipEnd(Math.floor(captureTime()))}
                          className="text-[10px] text-teal hover:underline"
                        >
                          Set
                        </button>
                      </div>
                    </div>

                    {/* Title + Note */}
                    <input
                      type="text"
                      value={clipTitle}
                      onChange={(e) => setClipTitle(e.target.value)}
                      placeholder="Clip title (required)"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
                    />
                    <input
                      type="text"
                      value={clipNote}
                      onChange={(e) => setClipNote(e.target.value)}
                      placeholder="Note (optional)"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
                    />

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleSaveClip}
                        disabled={savingClip || clipStart === null || clipEnd === null || !clipTitle.trim()}
                        className="flex items-center gap-1.5 px-4 py-2 bg-teal text-white text-xs font-oswald uppercase tracking-wider rounded-lg hover:bg-teal/90 transition-colors disabled:opacity-50"
                      >
                        {savingClip ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                        Save Clip
                      </button>
                      <button
                        onClick={() => {
                          setTagging(false);
                          setClipTitle("");
                          setClipStart(null);
                          setClipEnd(null);
                          setClipNote("");
                        }}
                        className="px-4 py-2 text-xs font-oswald uppercase tracking-wider text-muted border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
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

            {/* PXI Film Analysis panel */}
            <div className="mt-4 bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="bg-navy px-5 py-3 flex items-center justify-between">
                <h3 className="text-xs font-oswald uppercase tracking-wider text-white flex items-center gap-2">
                  <Sparkles size={14} className="text-orange-400" />
                  PXI Film Analysis
                </h3>
              </div>
              <div className="p-5">
                {analysisText ? (
                  <div>
                    <div className="bg-navy/[0.02] border border-gray-100 rounded-lg p-4 max-h-[400px] overflow-y-auto mb-3">
                      <pre className="text-sm text-navy whitespace-pre-wrap font-sans leading-relaxed">
                        {analysisText}
                      </pre>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <button
                          onClick={() => setShowTypeSelector(!showTypeSelector)}
                          disabled={generating}
                          className="flex items-center gap-1.5 px-3 py-2 text-xs font-oswald uppercase tracking-wider text-muted border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                        >
                          {generating ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                          Regenerate
                        </button>
                        {showTypeSelector && !generating && (
                          <div className="absolute left-0 bottom-full mb-1 w-48 bg-white rounded-xl border border-gray-200 shadow-lg z-20 py-1">
                            {FILM_REPORT_TYPES.map((rt) => (
                              <button
                                key={rt.value}
                                onClick={() => handleGenerateAnalysis(rt.value)}
                                className="w-full text-left px-4 py-2 text-sm text-navy hover:bg-navy/[0.03] transition-colors font-oswald tracking-wider"
                              >
                                {rt.label}
                              </button>
                            ))}
                            <div className="border-t border-gray-100 mt-1 pt-1">
                              <button
                                onClick={() => setShowTypeSelector(false)}
                                className="w-full text-left px-4 py-1.5 text-xs text-muted hover:text-navy transition-colors flex items-center gap-1.5"
                              >
                                <X size={10} />
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                      <button
                        onClick={handleCopyToNotes}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs font-oswald uppercase tracking-wider text-muted border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <Copy size={12} />
                        Copy to Notes
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <Sparkles size={24} className="mx-auto text-muted/20 mb-2" />
                    <p className="text-xs text-muted mb-3">
                      Generate AI analysis from tagged clips and session data
                    </p>
                    <div className="relative inline-block">
                      <button
                        onClick={() => setShowTypeSelector(!showTypeSelector)}
                        disabled={generating}
                        className={`flex items-center gap-2 px-5 py-2.5 text-sm font-oswald uppercase tracking-wider rounded-lg transition-colors ${
                          generating
                            ? "bg-orange-400/50 text-white cursor-not-allowed"
                            : "bg-orange-500 text-white hover:bg-orange-500/90"
                        }`}
                      >
                        {generating ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Sparkles size={14} />
                        )}
                        {generating ? "Generating..." : "Generate Analysis"}
                      </button>
                      {showTypeSelector && !generating && (
                        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1 w-48 bg-white rounded-xl border border-gray-200 shadow-lg z-20 py-1">
                          {FILM_REPORT_TYPES.map((rt) => (
                            <button
                              key={rt.value}
                              onClick={() => handleGenerateAnalysis(rt.value)}
                              className="w-full text-left px-4 py-2 text-sm text-navy hover:bg-navy/[0.03] transition-colors font-oswald tracking-wider"
                            >
                              {rt.label}
                            </button>
                          ))}
                          <div className="border-t border-gray-100 mt-1 pt-1">
                            <button
                              onClick={() => setShowTypeSelector(false)}
                              className="w-full text-left px-4 py-1.5 text-xs text-muted hover:text-navy transition-colors flex items-center gap-1.5"
                            >
                              <X size={10} />
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Clips list — below two columns */}
        <div className="mt-4 bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-xs font-oswald uppercase tracking-wider text-navy mb-3 flex items-center gap-2">
            <Scissors size={14} className="text-teal" />
            Clips
            {clips.length > 0 && (
              <span className="text-[10px] bg-teal/10 text-teal px-2 py-0.5 rounded-full font-semibold">
                {clips.length}
              </span>
            )}
          </h3>

          {clips.length === 0 ? (
            <div className="text-center py-8">
              <Scissors size={28} className="mx-auto text-muted/20 mb-2" />
              <p className="text-sm text-muted">No clips tagged yet</p>
              <p className="text-xs text-muted/60 mt-1">
                {hasVideo
                  ? "Use the Tag Clip button above the video to create clips"
                  : "Upload a video first, then tag clips during playback"}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {clips.map((clip) => (
                <div
                  key={clip.id}
                  className="flex items-center justify-between gap-3 py-2.5 px-3 rounded-lg border border-gray-100 hover:border-teal/20 hover:bg-teal/[0.02] transition-all group"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {hasVideo && (
                      <button
                        onClick={() => handleSeekTo(clip.start_time_seconds)}
                        className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-teal/10 text-teal hover:bg-teal hover:text-white transition-colors"
                        title={`Seek to ${formatTime(clip.start_time_seconds)}`}
                      >
                        <Play size={12} />
                      </button>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-navy truncate">{clip.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="flex items-center gap-1 text-[10px] text-teal font-mono">
                          <Clock size={10} />
                          {formatTime(clip.start_time_seconds)} — {formatTime(clip.end_time_seconds)}
                        </span>
                        {clip.description && (
                          <span className="text-[10px] text-muted truncate">{clip.description}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteClip(clip.id)}
                    className="shrink-0 text-muted/30 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                    title="Delete clip"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </ProtectedRoute>
  );
}
