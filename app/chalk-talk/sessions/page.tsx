"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  Swords,
  Plus,
  Calendar,
  Zap,
  Trophy,
  Film,
  PenTool,
  ArrowRight,
  Save,
  Eye,
  EyeOff,
  Loader2,
  Clock,
  Scissors,
} from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import api from "@/lib/api";
import type { ChalkTalkSession } from "@/types/api";
import type { RinkDiagramData } from "@/types/rink";
import type { BackgroundMode, RinkCanvasHandle } from "@/components/RinkCanvas";

/* ── Lazy-load RinkCanvas (SSR-safe) ─────────────────────── */
const RinkCanvas = dynamic(() => import("@/components/RinkCanvas"), { ssr: false });

/* ── Badge styles ─────────────────────────────────────────── */
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

/* ── Interfaces ───────────────────────────────────────────── */
interface SimpleTeam { id: string; name: string; }

interface NextGameIntel {
  next_game: {
    opponent: string;
    date: string;
    home_away: string;
    game_id: string;
    our_team: string;
  } | null;
  pxi_brief: string | null;
  existing_plan_id: string | null;
  opponent_pp_pct: number | null;
  our_last_5: string;
  their_last_5: string;
}

interface SeriesPlan {
  id: string;
  series_name: string;
  team_name: string;
  opponent_team_name: string;
  current_score: string;
  series_format: string;
  status: string;
  game_notes: string;
  created_at: string;
  updated_at: string;
}

interface FilmClip {
  id: string;
  title: string;
  description?: string | null;
  start_time_seconds: number;
  end_time_seconds: number;
  session_id?: string;
  created_at: string;
  tags?: string[];
  clip_type?: string;
}

/* ================================================================
   COACHING HUB — Game Plans Dashboard
   ================================================================ */
export default function ChalkTalkSessionsPage() {
  return (
    <ProtectedRoute>
      <NavBar />
      <main className="min-h-screen" style={{ background: "#F0F4F8" }}>
        <CoachingHub />
      </main>
    </ProtectedRoute>
  );
}

function CoachingHub() {
  const router = useRouter();
  const seriesRef = useRef<HTMLDivElement>(null);
  const [freeBoardCreating, setFreeBoardCreating] = useState(false);
  const [gamePlanCreating, setGamePlanCreating] = useState(false);

  /* ── Data state ──────────────────────────────────────────── */
  const [teams, setTeams] = useState<SimpleTeam[]>([]);
  const [sessions, setSessions] = useState<ChalkTalkSession[]>([]);
  const [intel, setIntel] = useState<NextGameIntel | null>(null);
  const [seriesPlans, setSeriesPlans] = useState<SeriesPlan[]>([]);
  const [filmClips, setFilmClips] = useState<FilmClip[]>([]);

  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [intelLoading, setIntelLoading] = useState(true);
  const [seriesLoading, setSeriesLoading] = useState(true);
  const [clipsLoading, setClipsLoading] = useState(true);

  /* ── Canvas state ────────────────────────────────────────── */
  const [canvasExpanded, setCanvasExpanded] = useState(true);
  const [bgMode, setBgMode] = useState<BackgroundMode>("full_rink");
  const [canvasKey] = useState(0);
  const [boardSaving, setBoardSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const canvasRef = useRef<RinkCanvasHandle | null>(null);

  /* ── Team name lookup ────────────────────────────────────── */
  const teamName = useCallback((id: string | null) => {
    if (!id) return "";
    const t = teams.find((t) => t.id === id);
    return t ? t.name : "";
  }, [teams]);

  /* ── Fetch all data on mount ─────────────────────────────── */
  useEffect(() => {
    api.get<SimpleTeam[]>("/teams").then(({ data }) => setTeams(data)).catch(() => {});

    /* Game Plans */
    api.get<ChalkTalkSession[]>("/chalk-talk-sessions?limit=6")
      .then(({ data }) => setSessions(data))
      .catch(() => {})
      .finally(() => setSessionsLoading(false));

    /* Next Game Intel */
    api.get<NextGameIntel>("/coaching/next-game-intel")
      .then(({ data }) => setIntel(data))
      .catch(() => {})
      .finally(() => setIntelLoading(false));

    /* Series Plans */
    api.get<SeriesPlan[]>("/series?status=active")
      .then(({ data }) => setSeriesPlans(data))
      .catch(() => {})
      .finally(() => setSeriesLoading(false));

    /* Film Clips */
    api.get<FilmClip[]>("/film/clips?limit=6")
      .then(({ data }) => setFilmClips(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setClipsLoading(false));
  }, []);

  /* ── Scroll to series if ?scroll=series ──────────────────── */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("scroll") === "series" && seriesRef.current) {
      setTimeout(() => {
        seriesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 400);
    }
  }, [seriesLoading]);

  /* ── Save board (standalone on hub) ──────────────────────── */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleSaveBoard = useCallback(async (data: RinkDiagramData, _svgString?: string) => {
    setBoardSaving(true);
    try {
      const layoutPayload = JSON.stringify({ ...data, background: bgMode });
      await api.post("/chalk-talks", {
        name: "Hub Board",
        board_layout: layoutPayload,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch { /* silent */ }
    finally { setBoardSaving(false); }
  }, [bgMode]);

  /* ── Format time helper ──────────────────────────────────── */
  const fmtTime = (s: number): string => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  /* ── Format relative date ────────────────────────────────── */
  const relativeDate = (dateStr: string): string => {
    const d = new Date(dateStr + "T12:00:00");
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
    if (diff === 0) return "Today";
    if (diff === 1) return "Tomorrow";
    if (diff === -1) return "Yesterday";
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  };

  /* ── Parse series game_notes for game count ──────────────── */
  const parseGameCount = (s: SeriesPlan): number => {
    try {
      const notes = typeof s.game_notes === "string" ? JSON.parse(s.game_notes) : s.game_notes;
      return Array.isArray(notes) ? notes.length : 0;
    } catch { return 0; }
  };

  /* ── New Game Plan: create + open directly in war room ──── */
  const handleNewGamePlan = async () => {
    if (gamePlanCreating) return;
    setGamePlanCreating(true);
    try {
      const { data } = await api.post<ChalkTalkSession>("/chalk-talk-sessions", {
        session_type: "pre_game",
        title: "New Game Plan",
      });
      router.push(`/chalk-talk/sessions/${data.id}`);
    } catch {
      router.push("/chalk-talk/new");
    } finally {
      setGamePlanCreating(false);
    }
  };

  /* ── Free Board: skip wizard, create + open directly ────── */
  const handleFreeBoard = async () => {
    if (freeBoardCreating) return;
    setFreeBoardCreating(true);
    try {
      const { data } = await api.post<ChalkTalkSession>("/chalk-talk-sessions", {
        session_type: "free_board",
      });
      router.push(`/chalk-talk/sessions/${data.id}`);
    } catch {
      // Fallback: open the wizard with free_board pre-selected
      router.push("/chalk-talk/new?type=free_board");
    } finally {
      setFreeBoardCreating(false);
    }
  };

  return (
    <div>
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">

        {/* ═══════════════════════════════════════════════════════
            3. PXI NEXT GAME INTEL STRIP
            ═══════════════════════════════════════════════════════ */}
        {intelLoading ? (
          <div className="rounded-lg p-5 animate-pulse" style={{ background: "#0F2942", borderLeft: "4px solid #0D9488" }}>
            <div className="h-4 w-48 rounded" style={{ background: "rgba(255,255,255,0.1)" }} />
            <div className="h-3 w-64 rounded mt-3" style={{ background: "rgba(255,255,255,0.07)" }} />
            <div className="h-3 w-80 rounded mt-2" style={{ background: "rgba(255,255,255,0.05)" }} />
          </div>
        ) : intel?.next_game ? (
          <div className="rounded-lg overflow-hidden" style={{ background: "#0F2942", borderLeft: "4px solid #0D9488", borderRadius: 8 }}>
            <div className="px-5 py-4">
              {/* Top row */}
              <div className="flex items-center gap-2 mb-2">
                <Zap size={12} style={{ color: "#0D9488" }} />
                <span
                  className="font-bold uppercase"
                  style={{ fontSize: 10, fontFamily: "ui-monospace, monospace", letterSpacing: 2, color: "#0D9488" }}
                >
                  PXI NEXT GAME INTEL
                </span>
                {/* Pulsing teal dot */}
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: "#0D9488" }} />
                  <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: "#0D9488" }} />
                </span>
              </div>

              {/* Matchup */}
              <p className="text-white font-bold text-base" style={{ fontFamily: "Oswald, sans-serif" }}>
                {intel.next_game.our_team || "Our Team"} vs {intel.next_game.opponent}
              </p>
              <p className="text-xs mt-0.5" style={{ color: "#A8C0D6" }}>
                {relativeDate(intel.next_game.date)} · {intel.next_game.home_away === "home" ? "Home" : "Away"}
                {intel.their_last_5 && ` · Their last 5: ${intel.their_last_5}`}
              </p>

              {/* PXI Brief */}
              {intel.pxi_brief && (
                <p className="text-white italic text-sm mt-3 leading-relaxed" style={{ opacity: 0.9 }}>
                  {intel.pxi_brief}
                </p>
              )}

              {/* Action button */}
              <div className="mt-4">
                {intel.existing_plan_id ? (
                  <Link
                    href={`/chalk-talk/sessions/${intel.existing_plan_id}`}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded text-xs font-bold uppercase transition-colors hover:opacity-90"
                    style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 1, background: "#0D9488", color: "#FFFFFF" }}
                  >
                    Open Game Plan <ArrowRight size={12} />
                  </Link>
                ) : (
                  <Link
                    href="/chalk-talk/new"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded text-xs font-bold uppercase transition-colors hover:opacity-90"
                    style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 1, background: "#0D9488", color: "#FFFFFF" }}
                  >
                    <Plus size={12} /> Create Game Plan <ArrowRight size={12} />
                  </Link>
                )}
              </div>
            </div>
          </div>
        ) : null}

        {/* ═══════════════════════════════════════════════════════
            4. CANVAS SECTION
            ═══════════════════════════════════════════════════════ */}
        <div className="overflow-hidden" style={{ borderRadius: 12, border: "1.5px solid #DDE6EF", borderBottom: "2px solid #0D9488" }}>
          {/* GAME PLANS header bar */}
          <div className="flex items-center justify-between px-5 py-3" style={{ background: "#0F2942" }}>
            <div className="flex items-center gap-2">
              <Swords size={14} style={{ color: "#0D9488" }} />
              <span
                className="text-xl font-bold tracking-widest uppercase text-white"
                style={{ fontFamily: "ui-monospace, monospace" }}
              >
                GAME PLANS
              </span>
            </div>
            <div className="flex items-center gap-2">
              {saveSuccess && (
                <span className="text-[10px] font-medium" style={{ color: "#0D9488" }}>Saved ✓</span>
              )}
              <button
                onClick={() => setCanvasExpanded(!canvasExpanded)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-colors hover:opacity-80"
                style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 1, color: "rgba(255,255,255,0.8)", border: "1px solid rgba(255,255,255,0.2)" }}
              >
                {canvasExpanded ? <><EyeOff size={12} /> Collapse</> : <><Eye size={12} /> Expand Canvas</>}
              </button>
            </div>
          </div>

          {/* Action buttons row */}
          {canvasExpanded && (
            <div className="bg-white px-5 py-3 flex items-center gap-3 flex-wrap" style={{ borderBottom: "1px solid #DDE6EF" }}>
              <button
                onClick={handleNewGamePlan}
                disabled={gamePlanCreating}
                className="flex items-center gap-2 px-4 py-2 rounded text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-60"
                style={{ background: "#0D9488" }}
              >
                {gamePlanCreating ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                {gamePlanCreating ? "Creating..." : "New Game Plan"}
              </button>
              <Link
                href="/series/new"
                className="flex items-center gap-2 px-4 py-2 rounded text-sm font-medium text-white transition-colors hover:opacity-90"
                style={{ background: "#0D9488" }}
              >
                <Trophy size={14} />
                New Series Plan
              </Link>
              <button
                onClick={handleFreeBoard}
                disabled={freeBoardCreating}
                className="flex items-center gap-2 px-4 py-2 rounded text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-60"
                style={{ background: "#0D9488" }}
              >
                {freeBoardCreating ? <Loader2 size={14} className="animate-spin" /> : <PenTool size={14} />}
                Free Board
              </button>
              <Link
                href="/film"
                className="flex items-center gap-2 px-4 py-2 rounded text-sm font-medium text-white transition-colors hover:opacity-90"
                style={{ background: "#0D9488" }}
              >
                <Film size={14} />
                Link Film Clip
              </Link>
            </div>
          )}

          {/* Canvas area */}
          {canvasExpanded && (
            <div style={{ height: 480 }}>
              <RinkCanvas
                key={canvasKey}
                ref={canvasRef}
                editable
                showToolbar
                backgroundMode={bgMode}
                onBackgroundModeChange={setBgMode}
                onSave={handleSaveBoard}
                className="w-full h-full"
              />
            </div>
          )}

          {/* Below canvas: My Boards + Save Board */}
          {canvasExpanded && (
            <div className="flex items-center justify-between px-5 py-3" style={{ borderTop: "1px solid #DDE6EF" }}>
              <Link
                href="/rink-builder"
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold uppercase transition-colors hover:opacity-80"
                style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 1, color: "#0F2942", border: "1.5px solid #DDE6EF" }}
              >
                My Boards
              </Link>
              <button
                onClick={() => {
                  if (canvasRef.current) {
                    const data = canvasRef.current.getDiagramData();
                    const svg = canvasRef.current.getSvgString();
                    handleSaveBoard(data, svg);
                  }
                }}
                disabled={boardSaving}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-white text-xs font-bold uppercase transition-colors hover:opacity-90 disabled:opacity-50"
                style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 1, background: "#0D9488" }}
              >
                {boardSaving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                Save Board
              </button>
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════
            5. ACTIVE GAME PLANS SECTION
            ═══════════════════════════════════════════════════════ */}
        <div className="overflow-hidden" style={{ borderRadius: 12, border: "1.5px solid #DDE6EF", borderLeft: "3px solid #EA580C" }}>
          {/* Section header */}
          <div className="flex items-center justify-between px-5 py-3" style={{ background: "#0F2942" }}>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ background: "#F97316" }} />
              <span
                className="text-lg font-bold tracking-widest uppercase text-white"
                style={{ fontFamily: "ui-monospace, monospace" }}
              >
                ACTIVE GAME PLANS
              </span>
            </div>
            {sessions.length > 6 && (
              <Link
                href="/chalk-talk/sessions"
                className="text-[10px] font-bold uppercase transition-colors hover:opacity-80"
                style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 1, color: "#0D9488" }}
              >
                View all {sessions.length} game plans →
              </Link>
            )}
          </div>

          {/* Content */}
          <div className="bg-white p-5">
            {sessionsLoading ? (
              <div className="flex gap-4 overflow-x-auto pb-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="min-w-[220px] rounded-lg p-4 animate-pulse" style={{ border: "1.5px solid #DDE6EF" }}>
                    <div className="h-3 w-16 rounded bg-gray-100 mb-3" />
                    <div className="h-4 w-32 rounded bg-gray-100 mb-2" />
                    <div className="h-3 w-24 rounded bg-gray-50" />
                  </div>
                ))}
              </div>
            ) : sessions.length === 0 ? (
              <div className="text-center py-6">
                <Swords size={24} className="mx-auto mb-2" style={{ color: "#DDE6EF" }} />
                <p className="text-xs" style={{ color: "#8BA4BB" }}>No game plans yet. Create your first above.</p>
              </div>
            ) : (
              <div className="flex gap-4 overflow-x-auto pb-2">
                {sessions.slice(0, 6).map((s) => {
                  const tName = teamName(s.team_id);
                  const oName = teamName(s.opponent_team_id);

                  return (
                    <Link
                      key={s.id}
                      href={`/chalk-talk/sessions/${s.id}`}
                      className="min-w-[220px] max-w-[260px] rounded-lg p-4 transition-all block cursor-pointer flex-shrink-0"
                      style={{ border: "1.5px solid #DDE6EF", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#0D9488"; e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#DDE6EF"; e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.04)"; }}
                    >
                      {/* Badges */}
                      <div className="flex items-center gap-1.5 mb-2">
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium uppercase ${SESSION_TYPE_BADGE[s.session_type] || "bg-gray-100 text-gray-600"}`}>
                          {s.session_type}
                        </span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium uppercase ${STATUS_BADGE[s.status] || "bg-gray-100 text-gray-600"}`}>
                          {s.status}
                        </span>
                      </div>

                      {/* Team names */}
                      <p className="font-bold text-sm" style={{ color: "#0F2942", fontFamily: "Oswald, sans-serif" }}>
                        {tName || "—"}
                      </p>
                      {oName && (
                        <p className="text-xs" style={{ color: "#5A7291" }}>vs {oName}</p>
                      )}

                      {/* Date + systems */}
                      <div className="mt-2 space-y-0.5">
                        {s.game_date && (
                          <p className="text-[10px] flex items-center gap-1" style={{ color: "#8BA4BB" }}>
                            <Calendar size={10} />
                            {new Date(s.game_date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                          </p>
                        )}
                        {(s.forecheck || s.breakout) && (
                          <p className="text-[10px]" style={{ color: "#8BA4BB" }}>
                            {[s.forecheck, s.breakout].filter(Boolean).join(" · ")}
                          </p>
                        )}
                      </div>

                      {/* Updated */}
                      <p className="text-[10px] mt-2 pt-2" style={{ color: "#B8C9DA", borderTop: "1px solid #F0F4F8" }}>
                        Updated {new Date(s.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </p>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════
            6. SERIES PLANS SECTION
            ═══════════════════════════════════════════════════════ */}
        <div ref={seriesRef} className="overflow-hidden" style={{ borderRadius: 12, border: "1.5px solid #DDE6EF", borderLeft: "3px solid #0D9488" }}>
          {/* Section header */}
          <div className="flex items-center justify-between px-5 py-3" style={{ background: "#0F2942" }}>
            <div className="flex items-center gap-2">
              <Trophy size={14} style={{ color: "#0D9488" }} />
              <span
                className="text-lg font-bold tracking-widest uppercase text-white"
                style={{ fontFamily: "ui-monospace, monospace" }}
              >
                SERIES PLANS
              </span>
            </div>
          </div>

          {/* Content */}
          <div className="bg-white p-5">
            {seriesLoading ? (
              <div className="flex gap-4 overflow-x-auto pb-2">
                {[1, 2].map((i) => (
                  <div key={i} className="min-w-[220px] rounded-lg p-4 animate-pulse" style={{ border: "1.5px solid #DDE6EF" }}>
                    <div className="h-3 w-16 rounded bg-gray-100 mb-3" />
                    <div className="h-4 w-32 rounded bg-gray-100 mb-2" />
                    <div className="h-3 w-24 rounded bg-gray-50" />
                  </div>
                ))}
              </div>
            ) : seriesPlans.length === 0 ? (
              <div className="text-center py-6">
                <Trophy size={24} className="mx-auto mb-2" style={{ color: "#DDE6EF" }} />
                <p className="text-xs" style={{ color: "#8BA4BB" }}>No active series. Start one above.</p>
              </div>
            ) : (
              <div className="flex gap-4 overflow-x-auto pb-2">
                {seriesPlans.slice(0, 4).map((s) => {
                  const gameCount = parseGameCount(s);
                  const scores = s.current_score.split("-");
                  const usScore = parseInt(scores[0] || "0");
                  const themScore = parseInt(scores[1] || "0");
                  const statusText = usScore === themScore
                    ? `TIED ${s.current_score}`
                    : usScore > themScore
                      ? `LEAD ${s.current_score}`
                      : `TRAIL ${s.current_score}`;

                  return (
                    <Link
                      key={s.id}
                      href={`/series/${s.id}`}
                      className="min-w-[220px] max-w-[260px] rounded-lg p-4 transition-all block cursor-pointer flex-shrink-0"
                      style={{ border: "1.5px solid #DDE6EF", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#0D9488"; e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#DDE6EF"; e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.04)"; }}
                    >
                      {/* Series name */}
                      <div className="flex items-center gap-1.5 mb-2">
                        <Trophy size={12} style={{ color: "#0D9488" }} />
                        <span className="text-[10px] font-bold uppercase" style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 1, color: "#0D9488" }}>
                          {s.series_name}
                        </span>
                      </div>

                      {/* Teams */}
                      <p className="text-xs" style={{ color: "#5A7291" }}>vs {s.opponent_team_name}</p>

                      {/* Series score */}
                      <p className="font-bold text-sm mt-2" style={{ color: "#0F2942", fontFamily: "Oswald, sans-serif" }}>
                        {statusText} · Game {gameCount + 1}
                      </p>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════
            7. FILM CLIPS SECTION
            ═══════════════════════════════════════════════════════ */}
        <div className="overflow-hidden" style={{ borderRadius: 12, border: "1.5px solid #DDE6EF", borderLeft: "3px solid #EA580C" }}>
          {/* Section header */}
          <div className="flex items-center justify-between px-5 py-3" style={{ background: "#0F2942" }}>
            <div className="flex items-center gap-2">
              <Film size={14} style={{ color: "#F97316" }} />
              <span
                className="text-lg font-bold tracking-widest uppercase text-white"
                style={{ fontFamily: "ui-monospace, monospace" }}
              >
                FILM CLIPS
              </span>
              {filmClips.length > 0 && (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: "rgba(13,148,136,0.15)", color: "#0D9488" }}>
                  {filmClips.length}
                </span>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="bg-white p-5">
            {clipsLoading ? (
              <div className="flex gap-4 overflow-x-auto pb-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="min-w-[200px] rounded-lg p-4 animate-pulse" style={{ border: "1.5px solid #DDE6EF" }}>
                    <div className="h-8 w-full rounded bg-gray-100 mb-3" />
                    <div className="h-3 w-28 rounded bg-gray-100 mb-2" />
                    <div className="h-3 w-20 rounded bg-gray-50" />
                  </div>
                ))}
              </div>
            ) : filmClips.length === 0 ? (
              <div className="text-center py-6">
                <Scissors size={24} className="mx-auto mb-2" style={{ color: "#DDE6EF" }} />
                <p className="text-xs" style={{ color: "#8BA4BB" }}>No clips yet. Add clips in Film Room.</p>
              </div>
            ) : (
              <div className="flex gap-4 overflow-x-auto pb-2">
                {filmClips.map((clip) => (
                  <Link
                    key={clip.id}
                    href={clip.session_id ? `/film-room/sessions/${clip.session_id}?seek=${clip.start_time_seconds}` : "/film"}
                    className="min-w-[200px] max-w-[240px] rounded-lg p-4 transition-all block cursor-pointer flex-shrink-0"
                    style={{ border: "1.5px solid #DDE6EF", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#0D9488"; e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#DDE6EF"; e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.04)"; }}
                  >
                    {/* Icon area */}
                    <div className="flex items-center justify-center h-10 w-full rounded mb-3" style={{ background: "#F0F4F8" }}>
                      <Film size={18} style={{ color: "#EA580C" }} />
                    </div>

                    {/* Title */}
                    <p className="text-sm font-semibold truncate" style={{ color: "#0F2942" }}>
                      {clip.title}
                    </p>

                    {/* Meta */}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="flex items-center gap-1 text-[10px] font-mono" style={{ color: "#0D9488" }}>
                        <Clock size={10} />
                        {fmtTime(clip.start_time_seconds)}
                      </span>
                      <span className="text-[10px]" style={{ color: "#B8C9DA" }}>
                        {new Date(clip.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
