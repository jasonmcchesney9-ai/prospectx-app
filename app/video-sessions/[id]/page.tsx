"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Trash2,
  Edit3,
  X,
  Play,
  Video,
} from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import VideoPlayer from "@/components/VideoPlayer";
import api from "@/lib/api";

/* ── Types ─────────────────────────────────────────────────── */
interface VideoEvent {
  id: string;
  game_date: string;
  team_name: string;
  opponent_name: string;
  player_id: string | null;
  player_name: string | null;
  period: number;
  clock_time: string;
  start_s: number;
  end_s: number | null;
  action: string;
  result: string | null;
  zone: string | null;
  short_description: string;
  pos_x: number | null;
  pos_y: number | null;
  order_index?: number;
}

interface SessionDetail {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
  clip_count: number;
  events: VideoEvent[];
}

/* ── Page ──────────────────────────────────────────────────── */
export default function VideoSessionDetailPage() {
  return (
    <ProtectedRoute>
      <NavBar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <SessionContent />
      </main>
    </ProtectedRoute>
  );
}

function SessionContent() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;

  const [session, setSession] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);

  /* ── Edit state ──────────────────────────────────────────── */
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [saving, setSaving] = useState(false);

  /* ── Delete state ────────────────────────────────────────── */
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  /* ── Clip list scroll ref ────────────────────────────────── */
  const clipListRef = useRef<HTMLDivElement>(null);
  const clipRefs = useRef<(HTMLDivElement | null)[]>([]);

  /* ── Load session ────────────────────────────────────────── */
  useEffect(() => {
    api.get<SessionDetail>(`/video/sessions/${sessionId}`)
      .then((r) => {
        setSession(r.data);
        setEditName(r.data.name);
        setEditDescription(r.data.description || "");
      })
      .catch(() => router.push("/video-sessions"))
      .finally(() => setLoading(false));
  }, [sessionId, router]);

  /* ── Auto-scroll active clip into view ──────────────────── */
  useEffect(() => {
    const el = clipRefs.current[currentIndex];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [currentIndex]);

  /* ── Navigation handlers ─────────────────────────────────── */
  const handleNext = useCallback(() => {
    if (session && currentIndex < session.events.length - 1) {
      setCurrentIndex((i) => i + 1);
    }
  }, [session, currentIndex]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
    }
  }, [currentIndex]);

  /* ── Edit session ────────────────────────────────────────── */
  const handleSave = async () => {
    if (!editName.trim()) return;
    setSaving(true);
    try {
      await api.patch(`/video/sessions/${sessionId}`, {
        name: editName.trim(),
        description: editDescription.trim() || null,
      });
      setSession((s) => s ? { ...s, name: editName.trim(), description: editDescription.trim() || null } : s);
      setEditing(false);
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  /* ── Delete session ──────────────────────────────────────── */
  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/video/sessions/${sessionId}`);
      router.push("/video-sessions");
    } catch { setDeleting(false); }
  };

  /* ── Helpers ─────────────────────────────────────────────── */
  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    try {
      const d = new Date(dateStr + (dateStr.includes("T") ? "" : "T00:00:00"));
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    } catch { return dateStr; }
  };

  const periodLabel = (p: number) => {
    if (p === 1) return "1st";
    if (p === 2) return "2nd";
    if (p === 3) return "3rd";
    if (p === 4) return "OT";
    return `P${p}`;
  };

  const formatAction = (action: string) => {
    const singular: Record<string, string> = {
      "Goals": "Goal", "Assists": "Assist", "Shots on goal": "Shot on goal",
      "Faceoffs won": "Faceoff won", "Faceoffs lost": "Faceoff lost",
      "Hits": "Hit", "Penalties": "Penalty", "Saves": "Save",
      "Blocked shots": "Blocked shot", "Shots blocking": "Shot block",
    };
    return singular[action] || action;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 gap-2 text-muted text-sm">
        <span className="animate-spin rounded-full h-4 w-4 border-2 border-teal border-t-transparent" />
        Loading session...
      </div>
    );
  }

  if (!session) return null;

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/video-sessions"
          className="text-sm text-teal hover:text-teal/70 flex items-center gap-1 mb-3 transition-colors"
        >
          <ArrowLeft size={14} /> Video Sessions
        </Link>

        <div className="flex items-start justify-between">
          <div className="flex-1">
            {editing ? (
              <div className="space-y-3">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="text-2xl font-bold font-oswald text-navy border border-teal/20 rounded-lg px-3 py-1 w-full focus:outline-none focus:ring-2 focus:ring-teal/30"
                />
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Description (optional)"
                  rows={2}
                  className="w-full border border-teal/20 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal/30 resize-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSave}
                    disabled={saving || !editName.trim()}
                    className="px-3 py-1.5 bg-teal text-white text-sm font-oswald uppercase tracking-wider rounded-lg hover:bg-teal/90 disabled:opacity-50 transition-colors"
                  >
                    {saving ? "Saving..." : "Save"}
                  </button>
                  <button
                    onClick={() => { setEditing(false); setEditName(session.name); setEditDescription(session.description || ""); }}
                    className="px-3 py-1.5 text-sm text-navy hover:text-navy/70 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h1 className="text-2xl font-bold font-oswald text-navy">{session.name}</h1>
                {session.description && (
                  <p className="text-sm text-muted mt-1">{session.description}</p>
                )}
                <p className="text-xs text-muted/60 mt-2">
                  Click any clip to jump to it. Use Next and Previous to step through during a meeting or 1-on-1 session.
                </p>
              </>
            )}
          </div>

          {!editing && (
            <div className="flex items-center gap-2 ml-4">
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-navy border border-teal/20 rounded-lg hover:bg-navy/[0.03] transition-colors font-oswald uppercase tracking-wider"
              >
                <Edit3 size={14} /> Edit Name
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors font-oswald uppercase tracking-wider"
              >
                <Trash2 size={14} /> Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-20 gap-6">
        {/* Left: Video player (65%) */}
        <div className="lg:col-span-13">
          <VideoPlayer
            events={session.events}
            currentIndex={currentIndex}
            onNext={handleNext}
            onPrev={handlePrev}
            onSelectIndex={setCurrentIndex}
          />
        </div>

        {/* Right: Clip list (35%) */}
        <div className="lg:col-span-7">
          <div className="bg-white rounded-xl border border-teal/20 overflow-hidden">
            <div className="px-4 py-3 border-b border-teal/10">
              <h3 className="text-sm font-oswald uppercase tracking-wider text-navy flex items-center gap-2">
                <Play size={14} className="text-teal" /> Clips ({session.events.length})
              </h3>
            </div>
            <div ref={clipListRef} className="max-h-[600px] overflow-y-auto">
              {session.events.map((ev, idx) => (
                <div
                  key={ev.id}
                  ref={(el) => { clipRefs.current[idx] = el; }}
                  onClick={() => setCurrentIndex(idx)}
                  className={`px-4 py-3 cursor-pointer transition-colors border-l-3 ${
                    idx === currentIndex
                      ? "bg-teal/5 border-l-teal"
                      : "border-l-transparent hover:bg-navy/[0.02]"
                  } ${idx > 0 ? "border-t border-teal/5" : ""}`}
                >
                  <p className="text-sm font-semibold text-navy">
                    {periodLabel(ev.period)} · {ev.clock_time}
                  </p>
                  <p className="text-xs text-muted mt-0.5">
                    {formatAction(ev.action)}{ev.player_name ? ` – ${ev.player_name}` : ""}
                  </p>
                  <p className="text-xs text-muted/60 mt-0.5">
                    {ev.team_name} vs {ev.opponent_name} · {formatDate(ev.game_date)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-teal/20 p-6 w-full max-w-sm">
            <h3 className="text-lg font-oswald font-bold text-navy mb-2">Delete Session?</h3>
            <p className="text-sm text-muted mb-4">
              This will permanently delete &ldquo;{session.name}&rdquo; and all its clips. This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-sm text-navy hover:text-navy/70 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 text-white text-sm font-oswald font-semibold uppercase tracking-wider rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Delete Session"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
