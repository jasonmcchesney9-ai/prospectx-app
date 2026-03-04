"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Swords,
  Plus,
  Calendar,
  Search,
  X,
  PenTool,
  Trash2,
  ExternalLink,
  Info,
} from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import api from "@/lib/api";
import type { ChalkTalkSession } from "@/types/api";

/* ── Session type badges ───────────────────────────────────── */
const SESSION_TYPE_LABELS: Record<string, string> = {
  "Pre-Game": "Pre-Game",
  "Post-Game": "Post-Game",
  Practice: "Practice",
  "Season Notes": "Season Notes",
};

const SESSION_TYPE_BADGE: Record<string, string> = {
  "Pre-Game": "bg-teal/10 text-teal",
  "Post-Game": "bg-orange/10 text-orange",
  Practice: "bg-navy/10 text-navy",
  "Season Notes": "bg-gray-100 text-gray-600",
};

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  active: "bg-green-100 text-green-700",
  completed: "bg-blue-100 text-blue-700",
};

const SESSION_TYPE_FILTERS = [
  { value: "", label: "All" },
  { value: "Pre-Game", label: "Pre-Game" },
  { value: "Post-Game", label: "Post-Game" },
  { value: "Practice", label: "Practice" },
  { value: "Season Notes", label: "Season Notes" },
];

interface SimpleTeam {
  id: string;
  name: string;
}

export default function ChalkTalkSessionsPage() {
  return (
    <ProtectedRoute>
      <NavBar />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <SessionList />
      </main>
    </ProtectedRoute>
  );
}

function SessionList() {
  const [sessions, setSessions] = useState<ChalkTalkSession[]>([]);
  const [teams, setTeams] = useState<SimpleTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [teamFilter, setTeamFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);

  /* Fetch teams once */
  useEffect(() => {
    api.get<SimpleTeam[]>("/teams").then(({ data }) => setTeams(data)).catch(() => {});
  }, []);

  /* Fetch sessions */
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (typeFilter) params.set("session_type", typeFilter);
        if (teamFilter) params.set("team_id", teamFilter);
        const qs = params.toString();
        const { data } = await api.get<ChalkTalkSession[]>(`/chalk-talk-sessions${qs ? `?${qs}` : ""}`);
        setSessions(data);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [typeFilter, teamFilter]);

  /* Team name lookup */
  const teamName = (id: string | null) => {
    if (!id) return "";
    const t = teams.find((t) => t.id === id);
    return t ? t.name : "";
  };

  /* Client-side search + status filter */
  const filtered = sessions.filter((s) => {
    if (statusFilter && s.status !== statusFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    const tName = teamName(s.team_id).toLowerCase();
    const oName = teamName(s.opponent_team_id).toLowerCase();
    const bName = (s.board_name || "").toLowerCase();
    return tName.includes(q) || oName.includes(q) || bName.includes(q) || s.session_type.toLowerCase().includes(q);
  });

  /* Delete handler */
  const handleDelete = async (id: string) => {
    if (!confirm("Delete this session? The linked whiteboard will be preserved.")) return;
    setDeleting(id);
    try {
      await api.delete(`/chalk-talk-sessions/${id}`);
      setSessions((prev) => prev.filter((s) => s.id !== id));
    } catch {
      // silent
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-navy flex items-center gap-2">
            <Swords size={24} className="text-teal" />
            Game Plans
          </h1>
          <p className="text-muted text-sm mt-1">
            Pre-game prep, post-game reviews, practice notes, and season strategy
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/rink-builder?mode=chalk_talk"
            className="flex items-center gap-2 px-4 py-2 border border-navy/20 text-navy font-oswald font-semibold uppercase tracking-wider text-sm rounded-lg hover:bg-navy/[0.04] transition-colors"
          >
            <Plus size={16} />
            Free Board
          </Link>
          <Link
            href="/chalk-talk/new"
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-teal to-teal/80 text-white font-oswald font-semibold uppercase tracking-wider text-sm rounded-lg hover:shadow-md transition-shadow"
          >
            <Plus size={16} />
            New Game Plan
          </Link>
        </div>
      </div>

      {/* Helper */}
      <div className="bg-navy/5 border border-navy/10 rounded-lg px-4 py-3 mb-6 flex items-start gap-3">
        <Info size={16} className="text-teal mt-0.5 shrink-0" />
        <div className="text-xs text-navy/70 leading-relaxed">
          <span className="font-semibold text-navy">Sessions capture your coaching context.</span>{" "}
          Each session links to a whiteboard — the session is the brain, the board is the picture.
          Use <span className="font-semibold text-teal">Quick Board</span> for fast scratchpad drawings without a session.
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {/* Session type pills */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {SESSION_TYPE_FILTERS.map((st) => (
            <button
              key={st.value}
              onClick={() => setTypeFilter(st.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-oswald uppercase tracking-wider transition-colors ${
                typeFilter === st.value
                  ? "bg-white text-navy shadow-sm"
                  : "text-muted hover:text-navy"
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>
      </div>

      {/* Status + Team + Search */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {["", "draft", "active", "completed"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-oswald uppercase tracking-wider transition-colors ${
                statusFilter === s
                  ? "bg-white text-navy shadow-sm"
                  : "text-muted hover:text-navy"
              }`}
            >
              {s || "All"}
            </button>
          ))}
        </div>

        {teams.length > 0 && (
          <select
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
            className="border border-teal/20 rounded-lg px-3 py-1.5 text-xs font-oswald uppercase tracking-wider bg-white focus:outline-none focus:ring-2 focus:ring-teal/30 appearance-none"
          >
            <option value="">All Teams</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        )}

        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-2 text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search sessions..."
            className="w-full border border-teal/20 rounded-lg pl-9 pr-8 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2 top-2 text-muted hover:text-navy">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-navy border-t-teal" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-gray-50 border border-teal/20 rounded-xl p-8 text-center">
          <Swords size={32} className="mx-auto text-muted mb-3" />
          <h3 className="font-oswald font-semibold text-navy">No Sessions Found</h3>
          <p className="text-muted text-sm mt-1 max-w-md mx-auto">
            Create your first chalk talk session to capture coaching context and link it to a whiteboard.
          </p>
          <Link
            href="/chalk-talk/new"
            className="inline-flex items-center gap-1 mt-4 text-sm text-teal hover:underline"
          >
            <Plus size={14} />
            New Session
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((s) => {
            const tName = teamName(s.team_id);
            const oName = teamName(s.opponent_team_id);
            const isGame = s.session_type === "Pre-Game" || s.session_type === "Post-Game";
            const title = isGame && oName
              ? `${tName} vs ${oName}`
              : tName || s.board_name || "Untitled";

            return (
              <div
                key={s.id}
                className="bg-white rounded-xl border border-teal/20 p-5 hover:shadow-md hover:border-teal/30 transition-all group relative"
              >
                {/* Badges */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded font-medium uppercase ${STATUS_BADGE[s.status] || "bg-gray-100 text-gray-600"}`}>
                      {s.status}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-medium uppercase ${SESSION_TYPE_BADGE[s.session_type] || "bg-gray-100 text-gray-600"}`}>
                      {SESSION_TYPE_LABELS[s.session_type] || s.session_type}
                    </span>
                  </div>
                  {s.game_date && (
                    <span className="text-[10px] text-muted flex items-center gap-1">
                      <Calendar size={10} />
                      {new Date(s.game_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                  )}
                </div>

                {/* Title */}
                <h3 className="font-oswald font-semibold text-navy text-sm uppercase tracking-wider mb-1">
                  {title}
                </h3>

                {/* Board name */}
                {s.board_name && s.board_name !== title && (
                  <p className="text-[10px] text-muted mb-1">{s.board_name}</p>
                )}

                {/* Strategy preview */}
                {s.our_strategy && (
                  <p className="text-xs text-muted line-clamp-2 mt-2">
                    {s.our_strategy.slice(0, 120)}{(s.our_strategy.length || 0) > 120 ? "..." : ""}
                  </p>
                )}

                {/* Tactical chips */}
                {(s.forecheck || s.breakout || s.defensive_system) && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {s.forecheck && (
                      <span className="text-[9px] px-1.5 py-0.5 bg-teal/5 text-teal rounded">{s.forecheck}</span>
                    )}
                    {s.breakout && (
                      <span className="text-[9px] px-1.5 py-0.5 bg-navy/5 text-navy rounded">{s.breakout}</span>
                    )}
                    {s.defensive_system && (
                      <span className="text-[9px] px-1.5 py-0.5 bg-orange/5 text-orange rounded">{s.defensive_system}</span>
                    )}
                  </div>
                )}

                {/* Footer: date + actions */}
                <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-50">
                  <span className="text-[10px] text-muted/60">
                    Updated {new Date(s.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {s.chalk_talk_id && (
                      <Link
                        href={`/rink-builder?mode=chalk_talk&session_id=${s.id}`}
                        className="p-1.5 rounded hover:bg-teal/10 text-teal transition-colors"
                        title="Open Whiteboard"
                      >
                        <PenTool size={13} />
                      </Link>
                    )}
                    <Link
                      href={`/chalk-talk/sessions/${s.id}`}
                      className="p-1.5 rounded hover:bg-navy/10 text-navy transition-colors"
                      title="View Details"
                    >
                      <ExternalLink size={13} />
                    </Link>
                    <button
                      onClick={() => handleDelete(s.id)}
                      disabled={deleting === s.id}
                      className="p-1.5 rounded hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors disabled:opacity-30"
                      title="Delete Session"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
