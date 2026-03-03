"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Film, Camera, Plus, Loader2, Scissors } from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import api from "@/lib/api";

/* ── Types ─────────────────────────────────────────────────── */
interface FilmSession {
  id: string;
  title: string;
  session_type: string;
  description: string | null;
  team_id?: string;
  status?: string;
  created_at: string;
  clip_count?: number;
}

interface SimpleTeam {
  id: string;
  name: string;
}

/* ── Constants ─────────────────────────────────────────────── */
const SESSION_TYPE_LABELS: Record<string, string> = {
  general: "General",
  game_review: "Game Review",
  opponent_prep: "Opponent Prep",
  practice: "Practice",
  recruitment: "Recruitment",
  pre_game: "Pre-Game",
  post_game: "Post-Game",
  opponent_study: "Opponent Study",
};

const FILTER_OPTIONS = [
  { value: "", label: "All" },
  { value: "pre_game", label: "Pre-Game" },
  { value: "post_game", label: "Post-Game" },
  { value: "practice", label: "Practice" },
  { value: "opponent_study", label: "Opponent Study" },
  { value: "game_review", label: "Game Review" },
];

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  active: "bg-green-100 text-green-700",
  archived: "bg-blue-100 text-blue-700",
  completed: "bg-blue-100 text-blue-700",
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

/* ── Page ──────────────────────────────────────────────────── */
export default function FilmRoomPage() {
  const [sessions, setSessions] = useState<FilmSession[]>([]);
  const [teams, setTeams] = useState<SimpleTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    api
      .get("/film/sessions")
      .then((r) => setSessions(Array.isArray(r.data) ? r.data : []))
      .catch(() => setSessions([]))
      .finally(() => setLoading(false));

    api
      .get("/teams")
      .then((r) => setTeams(Array.isArray(r.data) ? r.data : []))
      .catch(() => {});
  }, []);

  const teamName = (id?: string) => teams.find((t) => t.id === id)?.name || "";

  const filtered = filter
    ? sessions.filter((s) => s.session_type === filter)
    : sessions;

  return (
    <ProtectedRoute>
      <NavBar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-navy font-oswald uppercase tracking-wider flex items-center gap-2">
              <Film size={24} className="text-teal" />
              Film Room
            </h1>
            <p className="text-sm text-muted mt-0.5">
              Upload game film, review sessions, and tag key moments
            </p>
          </div>
          <Link
            href="/film-room/sessions/new"
            className="flex items-center gap-2 px-5 py-2.5 bg-teal text-white text-sm font-oswald uppercase tracking-wider rounded-lg hover:bg-teal/90 transition-colors"
          >
            <Plus size={14} />
            New Session
          </Link>
        </div>

        {/* Filter pills */}
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-oswald uppercase tracking-wider font-semibold transition-colors ${
                filter === opt.value
                  ? "bg-teal text-white"
                  : "bg-white text-navy border border-gray-200 hover:border-teal/30"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-teal" />
            <span className="ml-2 text-sm text-muted">Loading sessions...</span>
          </div>
        ) : filtered.length === 0 ? (
          /* Empty state */
          <div className="text-center py-20 bg-white rounded-xl border border-gray-200">
            <Camera size={40} className="mx-auto text-muted/30 mb-4" />
            <h2 className="text-lg font-bold text-navy font-oswald uppercase tracking-wider mb-1">
              No film sessions yet
            </h2>
            <p className="text-sm text-muted mb-4">
              {filter
                ? "No sessions match this filter."
                : "Create your first session to start reviewing film."}
            </p>
            {!filter && (
              <Link
                href="/film-room/sessions/new"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal text-white text-sm font-oswald uppercase tracking-wider rounded-lg hover:bg-teal/90 transition-colors"
              >
                <Plus size={14} />
                Create your first session
              </Link>
            )}
          </div>
        ) : (
          /* Session cards grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((s) => (
              <Link
                key={s.id}
                href={`/film-room/sessions/${s.id}`}
                className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col hover:border-teal/30 hover:shadow-sm transition-all group"
              >
                <h3 className="text-sm font-bold text-navy font-oswald uppercase tracking-wider truncate group-hover:text-teal transition-colors">
                  {s.title}
                </h3>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className="text-[10px] font-oswald uppercase tracking-wider bg-orange/10 text-orange px-2 py-0.5 rounded-full font-semibold">
                    {SESSION_TYPE_LABELS[s.session_type] || s.session_type}
                  </span>
                  {s.status && (
                    <span
                      className={`text-[10px] font-oswald uppercase tracking-wider px-2 py-0.5 rounded-full font-semibold ${
                        STATUS_COLORS[s.status] || "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {s.status}
                    </span>
                  )}
                </div>
                {teamName(s.team_id) && (
                  <p className="text-xs text-navy/70 mt-2">{teamName(s.team_id)}</p>
                )}
                <div className="flex items-center gap-3 mt-2 text-[11px] text-muted">
                  <span>{formatDate(s.created_at)}</span>
                  {s.clip_count !== undefined && s.clip_count > 0 && (
                    <span className="flex items-center gap-1">
                      <Scissors size={11} />
                      {s.clip_count} clip{s.clip_count !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </ProtectedRoute>
  );
}
