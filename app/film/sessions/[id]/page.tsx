"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  Send,
  Plus,
  Trash2,
  Play,
  Clock,
} from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import VideoPlayer from "@/components/film/VideoPlayer";
import ClipPanel from "@/components/film/ClipPanel";
import EventTagger from "@/components/film/EventTagger";
import api from "@/lib/api";
import toast from "react-hot-toast";

interface SessionData {
  id: string;
  title: string;
  session_type: string;
  description: string | null;
  status: string;
  created_at: string;
}

interface UploadData {
  id: string;
  playback_id: string | null;
  status: string;
  title: string;
}

interface Comment {
  id: string;
  user_id: string;
  comment_text: string;
  timestamp_seconds: number | null;
  created_at: string;
}

const SESSION_TYPE_LABELS: Record<string, string> = {
  general: "General",
  game_review: "Game Review",
  opponent_prep: "Opponent Prep",
  practice: "Practice",
  recruitment: "Recruitment",
};

function formatTimestamp(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return "";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
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

export default function FilmSessionViewerPage() {
  const params = useParams();
  const sessionId = params.id as string;

  const [session, setSession] = useState<SessionData | null>(null);
  const [upload, setUpload] = useState<UploadData | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Comment form
  const [commentText, setCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);

  // Video player ref for getting current time
  const currentTimeRef = useRef<number>(0);

  const getCurrentTime = useCallback(() => currentTimeRef.current, []);

  const handleTimeUpdate = useCallback((seconds: number) => {
    currentTimeRef.current = seconds;
  }, []);

  // Load session data
  useEffect(() => {
    const loadData = async () => {
      try {
        const sessionRes = await api.get(`/film/sessions/${sessionId}`);
        const sessionData = sessionRes.data;
        setSession(sessionData);

        // Try to load the first upload attached to this session
        // The session may have uploads listed via video_upload_id or via the uploads list
        try {
          const uploadsRes = await api.get(`/film/uploads`);
          const uploads = uploadsRes.data as UploadData[];
          // Find the first ready upload — for now pick the most recent ready one
          const readyUpload = uploads.find(
            (u: UploadData) => u.status === "ready" && u.playback_id
          );
          if (readyUpload) {
            setUpload(readyUpload);
          }
        } catch {
          // No uploads or error — that's fine
        }

        // Load comments
        try {
          const commentsRes = await api.get(
            `/film/sessions/${sessionId}/comments`
          );
          setComments(commentsRes.data);
        } catch {
          // Comments may not exist yet
        }
      } catch (e: unknown) {
        const msg =
          (e as { response?: { data?: { detail?: string } } }).response?.data
            ?.detail || "Failed to load session";
        setError(msg);
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [sessionId]);

  const loadComments = useCallback(async () => {
    try {
      const res = await api.get(`/film/sessions/${sessionId}/comments`);
      setComments(res.data);
    } catch {
      // Silently fail on comment refresh
    }
  }, [sessionId]);

  const handleSubmitComment = useCallback(async () => {
    if (!commentText.trim()) return;
    setSubmittingComment(true);
    try {
      await api.post(`/film/sessions/${sessionId}/comments`, {
        comment_text: commentText.trim(),
        timestamp_seconds: Math.floor(currentTimeRef.current) || null,
      });
      setCommentText("");
      toast.success("Comment added");
      loadComments();
    } catch {
      toast.error("Failed to add comment");
    } finally {
      setSubmittingComment(false);
    }
  }, [sessionId, commentText, loadComments]);

  const handleDeleteComment = useCallback(
    async (commentId: string) => {
      try {
        await api.delete(
          `/film/sessions/${sessionId}/comments/${commentId}`
        );
        setComments((prev) => prev.filter((c) => c.id !== commentId));
        toast.success("Comment deleted");
      } catch {
        toast.error("Failed to delete comment");
      }
    },
    [sessionId]
  );

  if (loading) {
    return (
      <ProtectedRoute>
        <NavBar />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center py-24">
            <Loader2 size={28} className="animate-spin text-teal" />
            <span className="ml-2 text-sm text-muted">Loading session...</span>
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
          <div className="flex items-center justify-center py-24 text-red-500 text-sm">
            <AlertCircle size={16} className="mr-2" />
            {error || "Session not found"}
          </div>
        </main>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <NavBar />
      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Top bar */}
        <div className="flex items-center gap-3 mb-4">
          <Link
            href="/film/sessions"
            className="text-muted hover:text-navy transition-colors"
          >
            <ArrowLeft size={20} />
          </Link>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-navy font-oswald uppercase tracking-wider truncate">
              {session.title}
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] font-oswald uppercase tracking-wider bg-teal/10 text-teal px-2 py-0.5 rounded-full">
                {SESSION_TYPE_LABELS[session.session_type] || session.session_type}
              </span>
              <span className="text-[11px] text-muted">
                {formatDate(session.created_at)}
              </span>
            </div>
          </div>
        </div>

        {/* Split layout */}
        <div className="flex gap-4" style={{ minHeight: "calc(100vh - 180px)" }}>
          {/* LEFT PANEL — 65% */}
          <div className="w-[65%] flex flex-col gap-4">
            {/* Video Player */}
            <VideoPlayer
              playbackId={upload?.playback_id || null}
              onTimeUpdate={handleTimeUpdate}
            />

            {/* Event Tag Bar */}
            {upload?.playback_id && (
              <EventTagger
                sessionId={sessionId}
                uploadId={upload.id}
                getCurrentTime={getCurrentTime}
              />
            )}

            {/* Comments */}
            <div className="bg-white rounded-xl border border-border p-4">
              <h3 className="text-xs font-oswald uppercase tracking-wider text-navy mb-3">
                Comments
              </h3>

              {/* Comment input */}
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmitComment();
                    }
                  }}
                  placeholder="Add a comment..."
                  className="flex-1 border border-border rounded-lg px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
                />
                <button
                  onClick={handleSubmitComment}
                  disabled={submittingComment || !commentText.trim()}
                  className={`px-3 py-2 rounded-lg transition-colors ${
                    submittingComment || !commentText.trim()
                      ? "bg-border text-muted/50 cursor-not-allowed"
                      : "bg-teal text-white hover:bg-teal/90"
                  }`}
                >
                  {submittingComment ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Send size={14} />
                  )}
                </button>
              </div>

              {/* Comment list */}
              {comments.length === 0 ? (
                <p className="text-[11px] text-muted/50 text-center py-4">
                  No comments yet.
                </p>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {comments.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-start justify-between gap-2 py-2 border-b border-border last:border-0"
                    >
                      <div className="min-w-0">
                        <p className="text-sm text-navy">{c.comment_text}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {c.timestamp_seconds !== null && (
                            <span className="flex items-center gap-1 text-[10px] text-teal font-mono">
                              <Clock size={10} />
                              {formatTimestamp(c.timestamp_seconds)}
                            </span>
                          )}
                          <span className="text-[10px] text-muted">
                            {formatDate(c.created_at)}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteComment(c.id)}
                        className="text-muted/30 hover:text-red-500 transition-colors shrink-0 mt-0.5"
                        title="Delete comment"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT PANEL — 35% */}
          <div className="w-[35%] flex flex-col gap-4">
            {/* Session info */}
            <div className="bg-white rounded-xl border border-border p-4">
              <h3 className="text-xs font-oswald uppercase tracking-wider text-navy mb-2">
                Session Info
              </h3>
              {session.description && (
                <p className="text-sm text-muted mb-2">{session.description}</p>
              )}
              <div className="text-[11px] text-muted/60">
                Status: {session.status || "active"}
              </div>
            </div>

            {/* Clip Panel */}
            <ClipPanel
              sessionId={sessionId}
              uploadId={upload?.id || ""}
              getCurrentTime={getCurrentTime}
            />
          </div>
        </div>
      </main>
    </ProtectedRoute>
  );
}
