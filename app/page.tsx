"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Swords,
  Users,
  Target,
  Zap,
  Upload,
  FileText,
  Crown,
  Trophy,
  CalendarDays,
  ChevronRight,
} from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import LandingPage from "@/components/LandingPage";
import ReportCard from "@/components/ReportCard";
import BenchTalkUsage from "@/components/BenchTalkUsage";
import api from "@/lib/api";
import { getUser, isAuthenticated } from "@/lib/auth";
import type { Report, GamePlan, SeriesPlan, ScoutingListItem } from "@/types/api";
import { SESSION_TYPES } from "@/types/api";

export default function HomePage() {
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    setAuthed(isAuthenticated());
  }, []);

  // Still checking auth
  if (authed === null) {
    return (
      <div className="min-h-screen bg-navy flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-navy border-t-teal" />
      </div>
    );
  }

  // Not logged in — show public landing page
  if (!authed) {
    return <LandingPage />;
  }

  // Logged in — show dashboard
  return (
    <ProtectedRoute>
      <Dashboard />
    </ProtectedRoute>
  );
}

// ── Skeleton loaders ─────────────────────────────────────────
function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="bg-white rounded-xl border border-border p-5 animate-pulse">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={`h-3 bg-navy/5 rounded ${i === 0 ? "w-2/3 mb-3" : i === lines - 1 ? "w-1/2 mt-2" : "w-full mt-2"}`}
        />
      ))}
    </div>
  );
}

// ── Session type helpers ─────────────────────────────────────
const SESSION_TYPE_MAP: Record<string, string> = Object.fromEntries(
  SESSION_TYPES.map((s) => [s.value, s.label])
);

const SESSION_BADGE_COLORS: Record<string, string> = {
  pre_game: "bg-teal/10 text-teal",
  post_game: "bg-orange/10 text-orange",
  practice: "bg-blue-50 text-blue-600",
  season_notes: "bg-navy/5 text-navy/70",
};

// ── Priority color dot ───────────────────────────────────────
const PRIORITY_DOT: Record<string, string> = {
  high: "bg-red-500",
  medium: "bg-amber-400",
  low: "bg-green-500",
};

// ── Series format labels ─────────────────────────────────────
const FORMAT_LABELS: Record<string, string> = {
  best_of_3: "Bo3",
  best_of_5: "Bo5",
  best_of_7: "Bo7",
  round_robin: "RR",
  single_elim: "SE",
};

// ── Dashboard (authenticated users) ──────────────────────────
function Dashboard() {
  const [recentReports, setRecentReports] = useState<Report[]>([]);
  const [activeSeries, setActiveSeries] = useState<SeriesPlan[]>([]);
  const [activeGamePlans, setActiveGamePlans] = useState<GamePlan[]>([]);
  const [scoutingList, setScoutingList] = useState<ScoutingListItem[]>([]);

  const [loadingReports, setLoadingReports] = useState(true);
  const [loadingSeries, setLoadingSeries] = useState(true);
  const [loadingGamePlans, setLoadingGamePlans] = useState(true);
  const [loadingScouting, setLoadingScouting] = useState(true);

  const [error, setError] = useState("");
  const user = getUser();

  useEffect(() => {
    async function load() {
      const results = await Promise.allSettled([
        api.get<Report[]>("/reports?limit=5"),
        api.get<SeriesPlan[]>("/series?status=active"),
        api.get<GamePlan[]>("/game-plans?status=active"),
        api.get<ScoutingListItem[]>("/scouting-list?limit=5"),
      ]);

      // Reports
      if (results[0].status === "fulfilled") {
        setRecentReports(results[0].value.data);
      } else {
        // If reports fail, it's likely a backend connection issue
        const err = results[0].reason;
        const msg =
          err?.response?.data?.detail ||
          err?.message ||
          "Failed to connect to backend";
        setError(msg);
      }
      setLoadingReports(false);

      // Series
      if (results[1].status === "fulfilled") {
        setActiveSeries(results[1].value.data);
      }
      setLoadingSeries(false);

      // Game Plans
      if (results[2].status === "fulfilled") {
        setActiveGamePlans(results[2].value.data);
      }
      setLoadingGamePlans(false);

      // Scouting List
      if (results[3].status === "fulfilled") {
        setScoutingList(results[3].value.data);
      }
      setLoadingScouting(false);
    }
    load();
  }, []);

  return (
    <>
      <NavBar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ── Welcome Header ──────────────────────────────── */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-navy">
            Hockey Intelligence Platform
          </h1>
          <p className="text-muted text-sm mt-1">
            Welcome back{user?.first_name ? `, ${user.first_name}` : ""}.
          </p>
        </div>

        {/* ── Backend Error Banner ────────────────────────── */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-3">
            <span className="text-red-500 mt-0.5">!</span>
            <div>
              <p className="text-red-700 font-medium text-sm">Backend Connection Error</p>
              <p className="text-red-600 text-xs mt-0.5">{error}</p>
              <p className="text-red-500 text-xs mt-1">
                Make sure the backend is running at{" "}
                {process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}
              </p>
            </div>
          </div>
        )}

        {/* ── Quick Actions Grid (5 items) ────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
          <Link
            href="/game-plans/new"
            className="bg-white rounded-xl border border-border p-4 hover:shadow-md transition-all text-center group"
          >
            <div className="w-10 h-10 rounded-lg bg-teal/10 flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform">
              <Swords size={20} className="text-teal" />
            </div>
            <p className="text-xs font-oswald font-semibold text-navy uppercase tracking-wider">
              Chalk Talk
            </p>
          </Link>

          <Link
            href="/teams"
            className="bg-white rounded-xl border border-border p-4 hover:shadow-md transition-all text-center group"
          >
            <div className="w-10 h-10 rounded-lg bg-navy/10 flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform">
              <Users size={20} className="text-navy" />
            </div>
            <p className="text-xs font-oswald font-semibold text-navy uppercase tracking-wider">
              Line Builder
            </p>
          </Link>

          <Link
            href="/scouting"
            className="bg-white rounded-xl border border-border p-4 hover:shadow-md transition-all text-center group"
          >
            <div className="w-10 h-10 rounded-lg bg-orange/10 flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform">
              <Target size={20} className="text-orange" />
            </div>
            <p className="text-xs font-oswald font-semibold text-navy uppercase tracking-wider">
              Scout Player
            </p>
          </Link>

          <Link
            href="/reports/generate"
            className="bg-gradient-to-br from-navy to-navy-light rounded-xl border border-transparent p-4 hover:shadow-lg transition-all text-center group"
          >
            <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform">
              <Zap size={20} className="text-teal" />
            </div>
            <p className="text-xs font-oswald font-semibold text-white uppercase tracking-wider">
              New Report
            </p>
          </Link>

          <Link
            href="/players/import"
            className="bg-white rounded-xl border border-border p-4 hover:shadow-md transition-all text-center group"
          >
            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform">
              <Upload size={20} className="text-gray-500" />
            </div>
            <p className="text-xs font-oswald font-semibold text-navy uppercase tracking-wider">
              Import Players
            </p>
          </Link>
        </div>

        {/* ── Two-Column Layout ───────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-8">
          {/* ── Left Column (~60%) ─────────────────────────── */}
          <div className="lg:col-span-3 space-y-6">
            {/* Active Series */}
            <div className="bg-white rounded-xl border border-border p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Trophy size={16} className="text-orange" />
                  <h3 className="text-sm font-oswald font-bold text-navy uppercase tracking-wider">
                    Active Series
                  </h3>
                </div>
                <Link
                  href="/series"
                  className="text-xs text-teal hover:underline font-medium"
                >
                  View all
                </Link>
              </div>

              {loadingSeries ? (
                <div className="space-y-3">
                  <CardSkeleton lines={2} />
                </div>
              ) : activeSeries.length === 0 ? (
                <div className="text-center py-6">
                  <Trophy size={28} className="mx-auto text-muted/30 mb-2" />
                  <p className="text-muted text-sm">No active series</p>
                  <Link
                    href="/series/new"
                    className="inline-block mt-2 text-xs text-teal hover:underline"
                  >
                    Start a series
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {activeSeries.map((s) => (
                    <Link
                      key={s.id}
                      href={`/series/${s.id}`}
                      className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-navy/[0.02] transition-colors group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-navy truncate">
                            {s.team_name}{" "}
                            <span className="text-muted font-normal">vs</span>{" "}
                            {s.opponent_team_name}
                          </p>
                          {s.series_name && (
                            <p className="text-xs text-muted truncate mt-0.5">
                              {s.series_name}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-3">
                        <span className="text-sm font-oswald font-bold text-navy">
                          {s.current_score || "0-0"}
                        </span>
                        <span className="text-[10px] font-oswald uppercase tracking-wider px-1.5 py-0.5 rounded bg-navy/5 text-navy/60">
                          {FORMAT_LABELS[s.series_format] || s.series_format}
                        </span>
                        <ChevronRight
                          size={14}
                          className="text-muted/40 group-hover:text-teal transition-colors"
                        />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Upcoming Chalk Talk Sessions */}
            <div className="bg-white rounded-xl border border-border p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Swords size={16} className="text-teal" />
                  <h3 className="text-sm font-oswald font-bold text-navy uppercase tracking-wider">
                    Chalk Talk Sessions
                  </h3>
                </div>
                <Link
                  href="/game-plans"
                  className="text-xs text-teal hover:underline font-medium"
                >
                  View all
                </Link>
              </div>

              {loadingGamePlans ? (
                <div className="space-y-3">
                  <CardSkeleton lines={2} />
                  <CardSkeleton lines={2} />
                </div>
              ) : activeGamePlans.length === 0 ? (
                <div className="text-center py-6">
                  <CalendarDays size={28} className="mx-auto text-muted/30 mb-2" />
                  <p className="text-muted text-sm">No active sessions</p>
                  <Link
                    href="/game-plans/new"
                    className="inline-block mt-2 text-xs text-teal hover:underline"
                  >
                    Create a session
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {activeGamePlans.slice(0, 3).map((gp) => (
                    <Link
                      key={gp.id}
                      href={`/game-plans/${gp.id}`}
                      className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-navy/[0.02] transition-colors group"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-navy truncate">
                          {gp.team_name}{" "}
                          <span className="text-muted font-normal">vs</span>{" "}
                          {gp.opponent_team_name}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span
                            className={`text-[10px] font-oswald uppercase tracking-wider px-1.5 py-0.5 rounded ${
                              SESSION_BADGE_COLORS[gp.session_type] || "bg-navy/5 text-navy/60"
                            }`}
                          >
                            {SESSION_TYPE_MAP[gp.session_type] || gp.session_type}
                          </span>
                          {gp.game_date && (
                            <span className="text-[10px] text-muted">
                              {new Date(gp.game_date).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                              })}
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRight
                        size={14}
                        className="text-muted/40 group-hover:text-teal transition-colors shrink-0 ml-2"
                      />
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Right Column (~40%) ────────────────────────── */}
          <div className="lg:col-span-2 space-y-6">
            {/* Scouting List Preview */}
            <div className="bg-white rounded-xl border border-border p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Target size={16} className="text-orange" />
                  <h3 className="text-sm font-oswald font-bold text-navy uppercase tracking-wider">
                    Scouting List
                  </h3>
                </div>
                <Link
                  href="/scouting"
                  className="text-xs text-teal hover:underline font-medium"
                >
                  View all
                </Link>
              </div>

              {loadingScouting ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="animate-pulse flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-navy/5" />
                      <div className="flex-1">
                        <div className="h-3 bg-navy/5 rounded w-2/3 mb-1.5" />
                        <div className="h-2 bg-navy/5 rounded w-1/3" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : scoutingList.length === 0 ? (
                <div className="text-center py-6">
                  <Target size={28} className="mx-auto text-muted/30 mb-2" />
                  <p className="text-muted text-sm">No players on scouting list</p>
                  <Link
                    href="/scouting"
                    className="inline-block mt-2 text-xs text-teal hover:underline"
                  >
                    Add a player
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {scoutingList.map((item) => (
                    <Link
                      key={item.id}
                      href={`/players/${item.player_id}`}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-navy/[0.02] transition-colors group"
                    >
                      {/* Priority indicator */}
                      <div className="relative shrink-0">
                        <div className="w-8 h-8 rounded-full bg-navy/5 flex items-center justify-center text-xs font-oswald font-bold text-navy uppercase">
                          {item.position || "?"}
                        </div>
                        <span
                          className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${
                            PRIORITY_DOT[item.priority] || "bg-gray-400"
                          }`}
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-navy truncate group-hover:text-teal transition-colors">
                          {item.first_name} {item.last_name}
                        </p>
                        <p className="text-[10px] text-muted truncate">
                          {[item.current_team, item.current_league]
                            .filter(Boolean)
                            .join(" / ") || "No team"}
                        </p>
                      </div>

                      {item.position && (
                        <span className="text-[10px] font-oswald uppercase tracking-wider px-1.5 py-0.5 rounded bg-navy/5 text-navy/60 shrink-0">
                          {item.position}
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Monthly Usage */}
            <div className="bg-white rounded-xl border border-border p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-oswald font-bold text-navy uppercase tracking-wider">
                  Monthly Usage
                </h3>
                <Link
                  href="/pricing"
                  className="flex items-center gap-1 text-[10px] font-oswald font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-teal/10 text-teal hover:bg-teal/20 transition-colors"
                >
                  <Crown size={10} />
                  {user?.subscription_tier || "Rookie"}
                </Link>
              </div>
              <BenchTalkUsage />
            </div>
          </div>
        </div>

        {/* ── Recent Reports (full width) ─────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-navy">Recent Reports</h2>
            <Link href="/reports" className="text-sm text-teal hover:underline">
              View all
            </Link>
          </div>

          {loadingReports ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="bg-white rounded-lg border border-border p-4 animate-pulse"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-navy/5" />
                    <div className="flex-1">
                      <div className="h-3 bg-navy/5 rounded w-3/4 mb-2" />
                      <div className="h-2 bg-navy/5 rounded w-1/2 mb-3" />
                      <div className="h-5 bg-navy/5 rounded w-20" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : recentReports.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-border">
              <FileText size={32} className="mx-auto text-muted/40 mb-3" />
              <p className="text-muted text-sm">No reports generated yet.</p>
              <Link
                href="/reports/generate"
                className="inline-block mt-3 text-sm text-teal hover:underline"
              >
                Generate your first report
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {recentReports.map((r) => (
                <ReportCard key={r.id} report={r} />
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
