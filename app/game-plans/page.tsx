"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Swords,
  Plus,
  Calendar,
  Search,
  X,
} from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import api from "@/lib/api";
import type { GamePlan, SessionType } from "@/types/api";
import { SESSION_TYPES } from "@/types/api";

type StatusFilter = "all" | "draft" | "active" | "completed";
type SessionFilter = "all" | SessionType;

export default function GamePlansPage() {
  return (
    <ProtectedRoute>
      <NavBar />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ChalkTalkList />
      </main>
    </ProtectedRoute>
  );
}

const SESSION_TYPE_BADGE_COLORS: Record<SessionType, string> = {
  pre_game: "bg-teal/10 text-teal",
  post_game: "bg-orange/10 text-orange",
  practice: "bg-navy/10 text-navy",
  season_notes: "bg-gray-100 text-gray-600",
};

function ChalkTalkList() {
  const [plans, setPlans] = useState<GamePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sessionFilter, setSessionFilter] = useState<SessionFilter>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const params = new URLSearchParams();
        if (statusFilter !== "all") params.set("status", statusFilter);
        if (sessionFilter !== "all") params.set("session_type", sessionFilter);
        const qs = params.toString();
        const { data } = await api.get<GamePlan[]>(`/game-plans${qs ? `?${qs}` : ""}`);
        setPlans(data);
      } catch {
        // handle error
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [statusFilter, sessionFilter]);

  const filtered = plans.filter((p) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      p.team_name.toLowerCase().includes(s) ||
      p.opponent_team_name.toLowerCase().includes(s)
    );
  });

  const statusColors: Record<string, string> = {
    draft: "bg-gray-100 text-gray-600",
    active: "bg-green-100 text-green-700",
    completed: "bg-blue-100 text-blue-700",
  };

  function getSessionTypeLabel(type: SessionType): string {
    const found = SESSION_TYPES.find((st) => st.value === type);
    return found ? found.label : type;
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-navy flex items-center gap-2">
            <Swords size={24} className="text-teal" />
            Chalk Talk
          </h1>
          <p className="text-muted text-sm mt-1">
            Pre-game plans, post-game reviews, practice notes, and season strategy
          </p>
        </div>
        <Link
          href="/game-plans/new"
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-teal to-teal/80 text-white font-oswald font-semibold uppercase tracking-wider text-sm rounded-lg hover:shadow-md transition-shadow"
        >
          <Plus size={16} />
          New Session
        </Link>
      </div>

      {/* Session Type Filter */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setSessionFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-oswald uppercase tracking-wider transition-colors ${
              sessionFilter === "all"
                ? "bg-white text-navy shadow-sm"
                : "text-muted hover:text-navy"
            }`}
          >
            All
          </button>
          {SESSION_TYPES.map((st) => (
            <button
              key={st.value}
              onClick={() => setSessionFilter(st.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-oswald uppercase tracking-wider transition-colors ${
                sessionFilter === st.value
                  ? "bg-white text-navy shadow-sm"
                  : "text-muted hover:text-navy"
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>
      </div>

      {/* Status Filter + Search */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {(["all", "draft", "active", "completed"] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-oswald uppercase tracking-wider transition-colors ${
                statusFilter === s
                  ? "bg-white text-navy shadow-sm"
                  : "text-muted hover:text-navy"
              }`}
            >
              {s === "all" ? "All" : s}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-2 text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search teams..."
            className="w-full border border-border rounded-lg pl-9 pr-8 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2 top-2 text-muted hover:text-navy">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-navy border-t-teal" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-gray-50 border border-border rounded-xl p-8 text-center">
          <Swords size={32} className="mx-auto text-muted mb-3" />
          <h3 className="font-oswald font-semibold text-navy">No Chalk Talk Sessions</h3>
          <p className="text-muted text-sm mt-1">
            Create your first Chalk Talk session to start preparing strategies and tracking notes.
          </p>
          <Link
            href="/game-plans/new"
            className="inline-flex items-center gap-1 mt-4 text-sm text-teal hover:underline"
          >
            <Plus size={14} />
            Create Chalk Talk Session
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((plan) => (
            <Link
              key={plan.id}
              href={`/game-plans/${plan.id}`}
              className="bg-white rounded-xl border border-border p-5 hover:shadow-md hover:border-teal/30 transition-all group"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] px-2 py-0.5 rounded font-medium uppercase ${statusColors[plan.status] || "bg-gray-100 text-gray-600"}`}>
                    {plan.status}
                  </span>
                  {plan.session_type && (
                    <span className={`text-[10px] px-2 py-0.5 rounded font-medium uppercase ${SESSION_TYPE_BADGE_COLORS[plan.session_type] || "bg-gray-100 text-gray-600"}`}>
                      {getSessionTypeLabel(plan.session_type)}
                    </span>
                  )}
                </div>
                {plan.game_date && (
                  <span className="text-[10px] text-muted flex items-center gap-1">
                    <Calendar size={10} />
                    {new Date(plan.game_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                )}
              </div>

              <h3 className="font-oswald font-semibold text-navy text-sm uppercase tracking-wider mb-1 group-hover:text-teal transition-colors">
                {plan.team_name} vs {plan.opponent_team_name}
              </h3>

              {plan.our_strategy && (
                <p className="text-xs text-muted line-clamp-2 mt-2">
                  {plan.our_strategy.slice(0, 120)}{plan.our_strategy.length > 120 ? "..." : ""}
                </p>
              )}

              <div className="text-[10px] text-muted/60 mt-3">
                Updated {new Date(plan.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
