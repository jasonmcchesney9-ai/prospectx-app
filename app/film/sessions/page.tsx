"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Eye,
  Trash2,
  Loader2,
  AlertCircle,
  Film,
  Scissors,
} from "lucide-react";
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

export default function FilmSessionsListPage() {
  const [sessions, setSessions] = useState<FilmSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    try {
      const res = await api.get("/film/sessions");
      setSessions(res.data);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { detail?: string } } }).response?.data?.detail ||
        "Failed to load sessions";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const handleDelete = useCallback(
    async (id: string, title: string) => {
      if (!confirm(`Delete session "${title}"? This cannot be undone.`)) return;
      setDeletingId(id);
      try {
        await api.delete(`/film/sessions/${id}`);
        setSessions((prev) => prev.filter((s) => s.id !== id));
        toast.success("Session deleted");
      } catch {
        toast.error("Failed to delete session");
      } finally {
        setDeletingId(null);
      }
    },
    []
  );

  return (
    <ProtectedRoute>
      <NavBar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link href="/film" className="text-muted hover:text-navy transition-colors">
              <ArrowLeft size={20} />
            </Link>
            <h1 className="text-2xl font-bold text-navy font-oswald uppercase tracking-wider">
              Film Sessions
            </h1>
          </div>
          <Link
            href="/film/sessions/new"
            className="flex items-center gap-2 bg-teal text-white px-5 py-2.5 rounded-lg font-oswald uppercase tracking-wider text-sm hover:bg-teal/90 transition-colors"
          >
            <Plus size={14} />
            New Session
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-teal" />
            <span className="ml-2 text-sm text-muted">Loading sessions...</span>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-16 text-red-500 text-sm">
            <AlertCircle size={16} className="mr-2" />
            {error}
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-border">
            <Film size={36} className="mx-auto text-teal/40 mb-3" />
            <p className="text-sm text-muted">No film sessions yet.</p>
            <Link
              href="/film/sessions/new"
              className="inline-flex items-center gap-1.5 mt-4 text-sm text-teal font-oswald uppercase tracking-wider hover:text-teal/80 transition-colors"
            >
              <Plus size={14} />
              Create your first session
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-border overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-navy/[0.02]">
                  <th className="text-left px-5 py-3 text-[10px] font-oswald uppercase tracking-wider text-muted">
                    Title
                  </th>
                  <th className="text-left px-5 py-3 text-[10px] font-oswald uppercase tracking-wider text-muted">
                    Type
                  </th>
                  <th className="text-left px-5 py-3 text-[10px] font-oswald uppercase tracking-wider text-muted">
                    Date
                  </th>
                  <th className="text-left px-5 py-3 text-[10px] font-oswald uppercase tracking-wider text-muted">
                    Clips
                  </th>
                  <th className="text-right px-5 py-3 text-[10px] font-oswald uppercase tracking-wider text-muted">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sessions.map((s) => (
                  <tr key={s.id} className="hover:bg-navy/[0.01] transition-colors">
                    <td className="px-5 py-3">
                      <p className="text-sm font-medium text-navy truncate max-w-[300px]">
                        {s.title}
                      </p>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-[10px] font-oswald uppercase tracking-wider bg-teal/10 text-teal px-2 py-0.5 rounded-full">
                        {SESSION_TYPE_LABELS[s.session_type] || s.session_type}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-[11px] text-muted">
                      {formatDate(s.created_at)}
                    </td>
                    <td className="px-5 py-3">
                      {(s.clip_count ?? 0) > 0 ? (
                        <span className="flex items-center gap-1 text-[11px] text-muted">
                          <Scissors size={11} />
                          {s.clip_count}
                        </span>
                      ) : (
                        <span className="text-[11px] text-muted/40">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/film/sessions/${s.id}`}
                          className="text-navy/50 hover:text-teal transition-colors"
                          title="View session"
                        >
                          <Eye size={15} />
                        </Link>
                        <button
                          onClick={() => handleDelete(s.id, s.title)}
                          disabled={deletingId === s.id}
                          className="text-navy/50 hover:text-red-500 transition-colors disabled:opacity-40"
                          title="Delete session"
                        >
                          {deletingId === s.id ? (
                            <Loader2 size={15} className="animate-spin" />
                          ) : (
                            <Trash2 size={15} />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </ProtectedRoute>
  );
}
