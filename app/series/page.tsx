"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Trophy,
  Plus,
  Search,
  X,
} from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import api from "@/lib/api";
import type { SeriesPlan } from "@/types/api";
import { SERIES_FORMATS } from "@/types/api";

type StatusFilter = "all" | "active" | "won" | "lost";

export default function SeriesPage() {
  return (
    <ProtectedRoute>
      <NavBar />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <SeriesList />
      </main>
    </ProtectedRoute>
  );
}

function SeriesList() {
  const [plans, setPlans] = useState<SeriesPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const params = new URLSearchParams();
        if (statusFilter !== "all") params.set("status", statusFilter);
        const qs = params.toString();
        const { data } = await api.get<SeriesPlan[]>(`/series${qs ? `?${qs}` : ""}`);
        setPlans(data);
      } catch {
        // handle error
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [statusFilter]);

  const filtered = plans.filter((p) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      p.team_name.toLowerCase().includes(s) ||
      p.opponent_team_name.toLowerCase().includes(s) ||
      (p.series_name && p.series_name.toLowerCase().includes(s))
    );
  });

  const statusColors: Record<string, string> = {
    active: "bg-green-100 text-green-700",
    won: "bg-teal/10 text-teal",
    lost: "bg-red-100 text-red-700",
    completed: "bg-blue-100 text-blue-700",
  };

  function getFormatLabel(format: string): string {
    const found = SERIES_FORMATS.find((f) => f.value === format);
    return found ? found.label : format;
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-navy flex items-center gap-2">
            <Trophy size={24} className="text-teal" />
            Series Plans
          </h1>
          <p className="text-muted text-sm mt-1">
            Manage playoff and tournament series strategies
          </p>
        </div>
        <Link
          href="/series/new"
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-teal to-teal/80 text-white font-oswald font-semibold uppercase tracking-wider text-sm rounded-lg hover:shadow-md transition-shadow"
        >
          <Plus size={16} />
          New Series
        </Link>
      </div>

      {/* Status Filter + Search */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {(["all", "active", "won", "lost"] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-oswald uppercase tracking-wider transition-colors ${
                statusFilter === s
                  ? "bg-white text-navy shadow-sm"
                  : "text-muted hover:text-navy"
              }`}
            >
              {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
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
          <Trophy size={32} className="mx-auto text-muted mb-3" />
          <h3 className="font-oswald font-semibold text-navy">No Series Plans</h3>
          <p className="text-muted text-sm mt-1">
            Create your first series plan to start tracking playoff and tournament strategies.
          </p>
          <Link
            href="/series/new"
            className="inline-flex items-center gap-1 mt-4 text-sm text-teal hover:underline"
          >
            <Plus size={14} />
            Create Series Plan
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((plan) => (
            <Link
              key={plan.id}
              href={`/series/${plan.id}`}
              className="bg-white rounded-xl border border-border p-5 hover:shadow-md hover:border-teal/30 transition-all group"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] px-2 py-0.5 rounded font-medium uppercase ${statusColors[plan.status] || "bg-gray-100 text-gray-600"}`}>
                    {plan.status}
                  </span>
                  {plan.series_format && (
                    <span className="text-[10px] px-2 py-0.5 rounded font-medium uppercase bg-navy/10 text-navy">
                      {getFormatLabel(plan.series_format)}
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-muted">
                  {new Date(plan.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </span>
              </div>

              <h3 className="font-oswald font-semibold text-navy text-sm uppercase tracking-wider mb-1 group-hover:text-teal transition-colors">
                {plan.series_name || `${plan.team_name} vs ${plan.opponent_team_name}`}
              </h3>

              {plan.series_name && (
                <p className="text-xs text-muted mb-2">
                  {plan.team_name} vs {plan.opponent_team_name}
                </p>
              )}

              {/* Current Score */}
              {plan.current_score && (
                <div className="mt-2 mb-1">
                  <span className="text-2xl font-oswald font-bold text-navy">
                    {plan.current_score}
                  </span>
                </div>
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
