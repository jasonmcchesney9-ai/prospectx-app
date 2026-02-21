"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Swords,
  Users,
  Target,
  Zap,
  FileText,
  Crown,
  Trophy,
  ChevronRight,
  Briefcase,
  MessageSquare,
  UserPlus,
  AlertCircle,
  Heart,
  Radio,
  BookOpen,
  BarChart3,
  TrendingUp,
  CheckCircle,
  Sparkles,
} from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import LandingPage from "@/components/LandingPage";
import ReportCard from "@/components/ReportCard";
import TeamContextBar from "@/components/TeamContextBar";
import BenchTalkUsage from "@/components/BenchTalkUsage";
import { useBenchTalk } from "@/components/BenchTalkProvider";
import api from "@/lib/api";
import { formatLeague } from "@/lib/leagues";
import { getUser, isAuthenticated } from "@/lib/auth";
import type { Team, Player, Report, GamePlan, SeriesPlan, ScoutingListItem, AgentClient, HTGame, HTStandings, ScoringLeader } from "@/types/api";
import { SESSION_TYPES, AGENT_CLIENT_STATUS_COLORS } from "@/types/api";

// ── Auth gate ────────────────────────────────────────────────
export default function HomePage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const router = useRouter();

  useEffect(() => {
    const isAuth = isAuthenticated();
    setAuthed(isAuth);
    if (isAuth) {
      const user = getUser();
      if (user && !user.onboarding_completed && !user.org_id) {
        router.push("/onboarding");
      }
    }
  }, [router]);

  if (authed === null) {
    return (
      <div className="min-h-screen bg-navy flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-navy border-t-teal" />
      </div>
    );
  }

  if (!authed) return <LandingPage />;

  return (
    <ProtectedRoute>
      <Dashboard />
    </ProtectedRoute>
  );
}

// ── Helpers ──────────────────────────────────────────────────

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

const SESSION_TYPE_MAP: Record<string, string> = Object.fromEntries(
  SESSION_TYPES.map((s) => [s.value, s.label])
);
const SESSION_BADGE_COLORS: Record<string, string> = {
  pre_game: "bg-teal/10 text-teal",
  post_game: "bg-orange/10 text-orange",
  practice: "bg-blue-50 text-blue-600",
  season_notes: "bg-navy/5 text-navy/70",
};
const PRIORITY_DOT: Record<string, string> = {
  high: "bg-red-500",
  medium: "bg-amber-400",
  low: "bg-green-500",
};
const FORMAT_LABELS: Record<string, string> = {
  best_of_3: "Bo3",
  best_of_5: "Bo5",
  best_of_7: "Bo7",
  round_robin: "RR",
  single_elim: "SE",
};

// ── Role group mapping (mirrors NavBar) ──────────────────────
type RoleGroup = "PRO" | "MEDIA" | "FAMILY" | "AGENT";
const ROLE_GROUP_MAP: Record<string, RoleGroup> = {
  scout: "PRO", coach: "PRO", gm: "PRO",
  player: "FAMILY", parent: "FAMILY",
  broadcaster: "MEDIA", producer: "MEDIA",
  agent: "AGENT",
};
function getRoleGroup(role?: string): RoleGroup {
  return ROLE_GROUP_MAP[role || "scout"] || "PRO";
}

interface TopProspect {
  id: string;
  first_name: string;
  last_name: string;
  position: string | null;
  current_team: string | null;
  current_league: string | null;
  top_grade: number;
  note_count: number;
  last_noted: string;
}

// ── HockeyTech league code mapping ──────────────────────────
const HT_LEAGUE_CODES: Record<string, string> = {
  GOJHL: "gojhl", GOHL: "gojhl",
  OHL: "ohl", OJHL: "ojhl",
  WHL: "whl", QMJHL: "qmjhl", LHJMQ: "qmjhl", PWHL: "pwhl",
  BCHL: "bchl", AJHL: "ajhl", SJHL: "sjhl", MJHL: "mjhl",
  CCHL: "cchl", NOJHL: "nojhl", MHL: "mhl",
  USHL: "ushl", NAHL: "nahl",
  SPHL: "sphl", ECHL: "echl", AHL: "ahl",
};

const TEAM_LS_KEY = "prospectx_dashboard_team";

// ── Roster alert helpers ─────────────────────────────────────
const ALERT_STATUS_STYLES: Record<string, { label: string; bg: string; text: string }> = {
  ir: { label: "IR", bg: "bg-red-50", text: "text-red-700" },
  injured: { label: "Injured", bg: "bg-red-50", text: "text-red-700" },
  "day-to-day": { label: "DTD", bg: "bg-amber-50", text: "text-amber-700" },
  scratched: { label: "Scratched", bg: "bg-gray-50", text: "text-gray-600" },
  suspended: { label: "Suspended", bg: "bg-yellow-50", text: "text-yellow-700" },
};

// ── Dashboard ────────────────────────────────────────────────
function Dashboard() {
  const user = getUser();
  useBenchTalk(); // Keep provider active for header/sidebar access
  const roleGroup = getRoleGroup(user?.hockey_role);

  // ── Team context ─────────────────────────────────────────
  const [teams, setTeams] = useState<Team[]>([]);
  const [activeTeam, setActiveTeam] = useState<Team | null>(null);
  const [roster, setRoster] = useState<Player[]>([]);
  const [scoringLeaders, setScoringLeaders] = useState<ScoringLeader[]>([]);
  const [scorebar, setScorebar] = useState<HTGame[]>([]);
  const [standings, setStandings] = useState<HTStandings[]>([]);

  // ── Operational data ─────────────────────────────────────
  const [recentReports, setRecentReports] = useState<Report[]>([]);
  const [activeSeries, setActiveSeries] = useState<SeriesPlan[]>([]);
  const [activeGamePlans, setActiveGamePlans] = useState<GamePlan[]>([]);
  const [scoutingList, setScoutingList] = useState<ScoutingListItem[]>([]);
  const [topProspects, setTopProspects] = useState<TopProspect[]>([]);
  const [agentClients, setAgentClients] = useState<AgentClient[]>([]);
  const [playersWithoutPlans, setPlayersWithoutPlans] = useState<Player[]>([]);

  // ── League switcher (scorebar override) ─────────────────
  const [scorebarLeague, setScorebarLeague] = useState<string>("");

  // ── Loading states ───────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [teamDataLoading, setTeamDataLoading] = useState(true);
  const [error, setError] = useState("");

  // ── Load team-specific data (Wave 2) ─────────────────────
  const loadTeamData = useCallback(async (team: Team) => {
    try {
      setTeamDataLoading(true);
      const enc = encodeURIComponent(team.name);
      const htCode = scorebarLeague || (team.league ? HT_LEAGUE_CODES[team.league.toUpperCase()] : null);

      const teamFetches: Promise<unknown>[] = [
        api.get<Player[]>(`/teams/${enc}/roster`),
        api.get<ScoringLeader[]>(`/analytics/scoring-leaders?team=${enc}&limit=${roleGroup === "MEDIA" ? 10 : 5}`),
      ];
      if (htCode) {
        teamFetches.push(api.get<HTGame[]>(`/hockeytech/${htCode}/scorebar?days_back=3&days_ahead=7`));
        teamFetches.push(api.get<HTStandings[]>(`/hockeytech/${htCode}/standings`));
      }

      const results = await Promise.allSettled(teamFetches);
      if (results[0].status === "fulfilled") setRoster((results[0] as PromiseFulfilledResult<{ data: Player[] }>).value.data);
      if (results[1].status === "fulfilled") setScoringLeaders((results[1] as PromiseFulfilledResult<{ data: ScoringLeader[] }>).value.data);
      if (htCode && results[2]?.status === "fulfilled") setScorebar((results[2] as PromiseFulfilledResult<{ data: HTGame[] }>).value.data);
      if (htCode && results[3]?.status === "fulfilled") setStandings((results[3] as PromiseFulfilledResult<{ data: HTStandings[] }>).value.data);
    } catch (err) {
      console.error("Team data load error:", err);
    } finally {
      setTeamDataLoading(false);
    }
  }, [roleGroup, scorebarLeague]);

  // ── Wave 1: core data on mount ───────────────────────────
  useEffect(() => {
    async function load() {
      const isAgent = roleGroup === "AGENT";
      const fetches: Promise<unknown>[] = [
        api.get<Team[]>("/teams"),
        api.get<Report[]>("/reports?limit=5"),
        api.get<ScoutingListItem[]>("/scouting-list?limit=5"),
        api.get<GamePlan[]>("/game-plans?status=active"),
        api.get<SeriesPlan[]>("/series?status=active"),
        api.get<TopProspect[]>("/analytics/top-prospects?limit=5"),
      ];
      if (isAgent) fetches.push(api.get<AgentClient[]>("/agent/clients"));
      const isCoachRole = user?.hockey_role === "coach" || user?.hockey_role === "admin" || user?.hockey_role === "gm";
      if (isCoachRole) fetches.push(api.get<Player[]>("/players/without-development-plans"));

      const results = await Promise.allSettled(fetches);

      // Teams
      if (results[0].status === "fulfilled") {
        const teamData = (results[0] as PromiseFulfilledResult<{ data: Team[] }>).value.data;
        setTeams(teamData);

        // Resolve active team from localStorage or first team
        const savedName = typeof window !== "undefined" ? localStorage.getItem(TEAM_LS_KEY) : null;
        const match = savedName ? teamData.find((t) => t.name === savedName) : null;
        const resolved = match || teamData[0] || null;
        setActiveTeam(resolved);
        if (resolved) loadTeamData(resolved);
      }

      // Reports
      if (results[1].status === "fulfilled") {
        setRecentReports((results[1] as PromiseFulfilledResult<{ data: Report[] }>).value.data);
      } else {
        const err = (results[1] as PromiseRejectedResult).reason;
        setError(err?.response?.data?.detail || err?.message || "Failed to connect to backend");
      }

      // Scouting
      if (results[2].status === "fulfilled") setScoutingList((results[2] as PromiseFulfilledResult<{ data: ScoutingListItem[] }>).value.data);

      // Game Plans
      if (results[3].status === "fulfilled") setActiveGamePlans((results[3] as PromiseFulfilledResult<{ data: GamePlan[] }>).value.data);

      // Series
      if (results[4].status === "fulfilled") setActiveSeries((results[4] as PromiseFulfilledResult<{ data: SeriesPlan[] }>).value.data);

      // Top Prospects
      if (results[5].status === "fulfilled") setTopProspects((results[5] as PromiseFulfilledResult<{ data: TopProspect[] }>).value.data);

      // Agent clients
      if (isAgent && results[6]?.status === "fulfilled") setAgentClients((results[6] as PromiseFulfilledResult<{ data: AgentClient[] }>).value.data);

      // Players without development plans (coach/admin/gm — index 6 when no agent, or 7 if agent also pushed)
      const devPlanIdx = isAgent ? 7 : 6;
      if (isCoachRole && results[devPlanIdx]?.status === "fulfilled") {
        setPlayersWithoutPlans((results[devPlanIdx] as PromiseFulfilledResult<{ data: Player[] }>).value.data);
      }

      setLoading(false);
    }
    load().catch((err) => {
      console.error("Dashboard load error:", err);
      setLoading(false);
      setError("Failed to load dashboard data. Please try refreshing.");
    });
  }, [roleGroup, loadTeamData]);

  // ── Re-fetch scorebar when league switcher changes ───────
  useEffect(() => {
    if (activeTeam && scorebarLeague) {
      loadTeamData(activeTeam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scorebarLeague]);

  // ── Team change handler ──────────────────────────────────
  function handleTeamChange(team: Team) {
    setActiveTeam(team);
    localStorage.setItem(TEAM_LS_KEY, team.name);
    setRoster([]);
    setScoringLeaders([]);
    setScorebar([]);
    setStandings([]);
    loadTeamData(team);
  }

  // ── Computed values ──────────────────────────────────────
  const rosterAlerts = roster.filter((p) => p.roster_status && p.roster_status !== "active" && p.roster_status !== "recalled" && p.roster_status !== "released");

  // ── Render ───────────────────────────────────────────────
  return (
    <>
      <NavBar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Error Banner */}
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-3">
            <AlertCircle size={16} className="text-red-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-red-700 font-medium text-sm">Connection Error</p>
              <p className="text-red-600 text-xs mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* ── Team Context Bar ─────────────────────────────── */}
        <TeamContextBar
          teams={teams}
          activeTeam={activeTeam}
          onTeamChange={handleTeamChange}
          roster={roster}
          scorebar={scorebar}
          standings={standings}
          gamePlans={activeGamePlans}
          loading={loading}
        />

        {/* ── PRO View (Scout / GM / Coach) ─────────────────── */}
        {roleGroup === "PRO" && (
          <>
            {/* Live Scorebar — moved to top, under TeamContextBar */}
            {scorebar.length > 0 && (
              <div className="mb-4">
                <LiveScorebar scorebar={scorebar} teamName={activeTeam?.name || ""} scorebarLeague={scorebarLeague} onLeagueChange={setScorebarLeague} />
              </div>
            )}

            {/* Roster Alerts */}
            {rosterAlerts.length > 0 && (
              <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle size={14} className="text-amber-600" />
                  <span className="text-xs font-oswald font-bold text-amber-800 uppercase tracking-wider">
                    Roster Alert — {rosterAlerts.length} player{rosterAlerts.length !== 1 ? "s" : ""} out
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {rosterAlerts.map((p) => {
                    const style = ALERT_STATUS_STYLES[p.roster_status || ""] || { label: p.roster_status, bg: "bg-gray-50", text: "text-gray-600" };
                    return (
                      <Link
                        key={p.id}
                        href={`/players/${p.id}`}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-amber-200 hover:border-amber-300 transition-colors"
                      >
                        <span className="text-xs font-medium text-navy">{p.first_name} {p.last_name}</span>
                        <span className={`text-[9px] font-oswald font-bold uppercase px-1.5 py-0.5 rounded-full ${style.bg} ${style.text}`}>
                          {style.label}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Two-Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
              {/* LEFT: Operations */}
              <div className="lg:col-span-3 space-y-5">
                {/* Active Series */}
                <DashboardCard
                  icon={<Trophy size={15} className="text-orange" />}
                  title="Active Series"
                  viewAllHref="/series"
                  loading={loading}
                  empty={activeSeries.length === 0}
                  emptyIcon={<Trophy size={24} className="text-muted/30" />}
                  emptyText="No active series"
                  emptyLink="/series/new"
                  emptyLinkText="Start a series"
                >
                  <div className="space-y-2">
                    {activeSeries.map((s) => (
                      <Link key={s.id} href={`/series/${s.id}`} className="flex items-center justify-between p-3 rounded-lg border border-teal/20 hover:bg-navy/[0.02] transition-colors group">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-navy truncate">
                            {s.team_name} <span className="text-muted font-normal">vs</span> {s.opponent_team_name}
                          </p>
                          {s.series_name && <p className="text-[10px] text-muted truncate mt-0.5">{s.series_name}</p>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-3">
                          <span className="text-sm font-oswald font-bold text-navy">{s.current_score || "0-0"}</span>
                          <span className="text-[10px] font-oswald uppercase tracking-wider px-1.5 py-0.5 rounded bg-navy/5 text-navy/60">
                            {FORMAT_LABELS[s.series_format] || s.series_format}
                          </span>
                          <ChevronRight size={14} className="text-muted/40 group-hover:text-teal transition-colors" />
                        </div>
                      </Link>
                    ))}
                  </div>
                </DashboardCard>

                {/* Chalk Talk Sessions */}
                <DashboardCard
                  icon={<Swords size={15} className="text-teal" />}
                  title="Chalk Talk"
                  viewAllHref="/game-plans"
                  loading={loading}
                  empty={activeGamePlans.length === 0}
                  emptyIcon={<Swords size={24} className="text-muted/30" />}
                  emptyText="No active sessions"
                  emptyLink="/game-plans/new"
                  emptyLinkText="Create a session"
                >
                  <div className="space-y-2">
                    {activeGamePlans.slice(0, 3).map((gp) => (
                      <Link key={gp.id} href={`/game-plans/${gp.id}`} className="flex items-center justify-between p-3 rounded-lg border border-teal/20 hover:bg-navy/[0.02] transition-colors group">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-navy truncate">
                            {gp.team_name} <span className="text-muted font-normal">vs</span> {gp.opponent_team_name}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-[10px] font-oswald uppercase tracking-wider px-1.5 py-0.5 rounded ${SESSION_BADGE_COLORS[gp.session_type] || "bg-navy/5 text-navy/60"}`}>
                              {SESSION_TYPE_MAP[gp.session_type] || gp.session_type}
                            </span>
                            {gp.game_date && (
                              <span className="text-[10px] text-muted">
                                {new Date(gp.game_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                              </span>
                            )}
                          </div>
                        </div>
                        <ChevronRight size={14} className="text-muted/40 group-hover:text-teal transition-colors shrink-0 ml-2" />
                      </Link>
                    ))}
                  </div>
                </DashboardCard>

                {/* Players Without Development Plans */}
                {(user?.hockey_role === "coach" || user?.hockey_role === "admin" || user?.hockey_role === "gm") && (
                  <DashboardCard
                    icon={<TrendingUp size={15} className="text-orange" />}
                    title="Players Without Development Plans"
                    viewAllHref="/players"
                    loading={loading}
                    empty={playersWithoutPlans.length === 0}
                    emptyIcon={<CheckCircle size={24} className="text-green-400" />}
                    emptyText={`All players have development plans for ${new Date().getFullYear()}-${String(new Date().getFullYear() + 1).slice(2)}`}
                  >
                    <div className="space-y-1.5">
                      {playersWithoutPlans.slice(0, 5).map((p) => (
                        <div key={p.id} className="flex items-center justify-between p-2 rounded-lg border border-border hover:border-teal/30 transition-colors">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-sm text-navy font-medium truncate">{p.first_name} {p.last_name}</span>
                            <span className="text-[10px] text-muted font-oswald uppercase">{p.position}</span>
                          </div>
                          <Link
                            href={`/players/${p.id}?tab=player&autoGenerate=true`}
                            className="shrink-0 flex items-center gap-1 px-2.5 py-1 text-xs font-oswald uppercase tracking-wider text-orange hover:bg-orange/5 rounded-lg transition-colors"
                          >
                            <Sparkles size={12} /> Generate
                          </Link>
                        </div>
                      ))}
                      {playersWithoutPlans.length > 5 && (
                        <p className="text-xs text-muted text-center pt-1">
                          +{playersWithoutPlans.length - 5} more players
                        </p>
                      )}
                    </div>
                  </DashboardCard>
                )}

                {/* Quick Actions */}
                <div className="flex flex-wrap gap-2">
                  <Link href="/reports/generate" className="flex items-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-navy to-navy-light text-white text-xs font-oswald font-bold uppercase tracking-wider rounded-lg hover:shadow-md transition-all">
                    <Zap size={14} /> New Report
                  </Link>
                  <Link href="/game-plans/new" className="flex items-center gap-1.5 px-4 py-2.5 bg-white text-navy border border-teal/20 text-xs font-oswald font-bold uppercase tracking-wider rounded-lg hover:bg-navy/[0.02] transition-colors">
                    <Swords size={14} /> Chalk Talk
                  </Link>
                </div>
              </div>

              {/* RIGHT: Intelligence */}
              <div className="lg:col-span-2 space-y-5">
                {/* Scouting List */}
                <ScoutingListSection scoutingList={scoutingList} loading={loading} />

                {/* Top Prospects */}
                <TopProspectsSection prospects={topProspects} loading={loading} />

                {/* Team Leaders */}
                {!teamDataLoading && scoringLeaders.length > 0 && (
                  <DashboardCard
                    icon={<BarChart3 size={15} className="text-teal" />}
                    title={`${activeTeam?.name || "Team"} Leaders`}
                    viewAllHref={activeTeam ? `/teams/${encodeURIComponent(activeTeam.name)}` : "/teams"}
                    loading={teamDataLoading}
                    empty={false}
                  >
                    <div className="space-y-1">
                      {scoringLeaders.map((l, i) => (
                        <Link key={`${l.id}-${i}`} href={`/players/${l.id}`} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-navy/[0.02] transition-colors text-xs group">
                          <span className="w-4 text-right font-oswald font-bold text-muted/50">{i + 1}</span>
                          <span className="flex-1 font-medium text-navy truncate group-hover:text-teal transition-colors">
                            {l.first_name} {l.last_name}
                          </span>
                          <span className="font-oswald text-muted/60 w-6 text-center">{l.gp}</span>
                          <span className="font-oswald text-navy/80 w-14 text-right">
                            {l.g}G-{l.a}A—<strong>{l.p}</strong>
                          </span>
                          <span className="font-oswald text-teal font-bold w-8 text-right">{l.ppg.toFixed(2)}</span>
                        </Link>
                      ))}
                      <div className="flex items-center justify-between text-[9px] text-muted/40 px-2 pt-1 border-t border-teal/10">
                        <span>Player</span>
                        <span className="flex gap-3"><span>GP</span><span>G-A—P</span><span>P/G</span></span>
                      </div>
                    </div>
                  </DashboardCard>
                )}

              </div>
            </div>

            {/* Reports Footer — dark panel */}
            <div className="bg-navy rounded-xl p-4 mt-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <FileText size={14} className="text-orange" />
                  <h3 className="font-oswald text-xs font-bold text-white uppercase tracking-wider">Recent Reports</h3>
                </div>
                <Link href="/reports" className="text-[10px] font-oswald text-teal uppercase tracking-wider hover:underline font-medium">View all</Link>
              </div>
              {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {[1,2,3].map((i) => (
                    <div key={i} className="animate-pulse rounded-lg border border-orange/20 bg-white/[0.04] p-3">
                      <div className="h-3 bg-white/10 rounded w-3/4 mb-2" />
                      <div className="h-2 bg-white/10 rounded w-1/2" />
                    </div>
                  ))}
                </div>
              ) : recentReports.length === 0 ? (
                <div className="text-center py-5 rounded-lg border border-dashed border-orange/20 bg-white/[0.03]">
                  <FileText size={24} className="mx-auto text-white/20 mb-1.5" />
                  <p className="text-white/50 text-sm">No reports yet</p>
                  <Link href="/reports/generate" className="inline-block mt-1.5 text-xs text-teal hover:underline">Generate your first report</Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {recentReports.slice(0, 6).map((r: Report) => (
                    <ReportCard key={r.id} report={r} compact dark />
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* ── MEDIA View (Broadcaster / Producer) ───────────── */}
        {roleGroup === "MEDIA" && (
          <>
            {/* Live Scorebar — Top */}
            {scorebar.length > 0 && (
              <div className="mb-5">
                <LiveScorebar scorebar={scorebar} teamName={activeTeam?.name || ""} scorebarLeague={scorebarLeague} onLeagueChange={setScorebarLeague} />
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
              <div className="lg:col-span-3 space-y-5">
                {/* Scoring Leaders (expanded) */}
                {!teamDataLoading && scoringLeaders.length > 0 && (
                  <DashboardCard
                    icon={<BarChart3 size={15} className="text-teal" />}
                    title="Scoring Leaders"
                    viewAllHref={activeTeam ? `/teams/${encodeURIComponent(activeTeam.name)}` : "/teams"}
                    loading={teamDataLoading}
                    empty={false}
                  >
                    <div className="space-y-1">
                      {scoringLeaders.map((l, i) => (
                        <Link key={`${l.id}-${i}`} href={`/players/${l.id}`} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-navy/[0.02] transition-colors text-xs group">
                          <span className="w-4 text-right font-oswald font-bold text-muted/50">{i + 1}</span>
                          <span className="flex-1 font-medium text-navy truncate group-hover:text-teal transition-colors">
                            {l.first_name} {l.last_name}
                          </span>
                          <span className="text-[10px] text-muted/50 w-6">{l.position}</span>
                          <span className="font-oswald text-muted/60 w-6 text-center">{l.gp}</span>
                          <span className="font-oswald text-navy/80 w-14 text-right">
                            {l.g}G-{l.a}A—<strong>{l.p}</strong>
                          </span>
                          <span className="font-oswald text-teal font-bold w-8 text-right">{l.ppg.toFixed(2)}</span>
                        </Link>
                      ))}
                    </div>
                  </DashboardCard>
                )}

                {/* Broadcast Hub link */}
                <Link href="/broadcast" className="flex items-center gap-3 p-4 bg-gradient-to-r from-navy to-navy-light rounded-xl text-white hover:shadow-md transition-all group">
                  <div className="w-10 h-10 rounded-lg bg-orange/20 flex items-center justify-center shrink-0">
                    <Radio size={20} className="text-orange" />
                  </div>
                  <div>
                    <p className="text-sm font-oswald font-bold uppercase tracking-wider">Broadcast Hub</p>
                    <p className="text-[10px] text-white/50">Game prep, spotting boards, talking points</p>
                  </div>
                  <ChevronRight size={16} className="text-white/30 group-hover:text-white/60 ml-auto transition-colors" />
                </Link>
              </div>

              <div className="lg:col-span-2 space-y-5">
                <DashboardCard
                  icon={<FileText size={15} className="text-navy" />}
                  title="Recent Reports"
                  viewAllHref="/reports"
                  loading={loading}
                  empty={recentReports.length === 0}
                  emptyIcon={<FileText size={24} className="text-muted/30" />}
                  emptyText="No reports yet"
                  emptyLink="/reports/generate"
                  emptyLinkText="Generate a report"
                >
                  <div className="space-y-2">
                    {recentReports.slice(0, 5).map((r) => (
                      <ReportCard key={r.id} report={r} compact />
                    ))}
                  </div>
                </DashboardCard>

                <div className="flex flex-wrap gap-2">
                  <Link href="/reports/generate" className="flex items-center gap-1.5 px-4 py-2.5 bg-teal text-white text-xs font-oswald font-bold uppercase tracking-wider rounded-lg hover:bg-teal/90 transition-colors">
                    <Zap size={14} /> Generate Report
                  </Link>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── FAMILY View (Player / Parent) ─────────────────── */}
        {roleGroup === "FAMILY" && (
          <>
            {/* Live Scorebar */}
            {scorebar.length > 0 && (
              <div className="mb-4">
                <LiveScorebar scorebar={scorebar} teamName={activeTeam?.name || ""} scorebarLeague={scorebarLeague} onLeagueChange={setScorebarLeague} />
              </div>
            )}

            {/* Team Leaders */}
            {!teamDataLoading && scoringLeaders.length > 0 && (
              <DashboardCard
                icon={<BarChart3 size={15} className="text-teal" />}
                title={`${activeTeam?.name || "Team"} Leaders`}
                viewAllHref={activeTeam ? `/teams/${encodeURIComponent(activeTeam.name)}` : "/teams"}
                loading={teamDataLoading}
                empty={false}
              >
                <div className="space-y-1">
                  {scoringLeaders.map((l, i) => (
                    <Link key={`${l.id}-${i}`} href={`/players/${l.id}`} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-navy/[0.02] transition-colors text-xs group">
                      <span className="w-4 text-right font-oswald font-bold text-muted/50">{i + 1}</span>
                      <span className="flex-1 font-medium text-navy truncate group-hover:text-teal transition-colors">
                        {l.first_name} {l.last_name}
                      </span>
                      <span className="font-oswald text-muted/60 w-6 text-center">{l.gp}</span>
                      <span className="font-oswald text-navy/80 w-14 text-right">
                        {l.g}G-{l.a}A—<strong>{l.p}</strong>
                      </span>
                      <span className="font-oswald text-teal font-bold w-8 text-right">{l.ppg.toFixed(2)}</span>
                    </Link>
                  ))}
                  <div className="flex items-center justify-between text-[9px] text-muted/40 px-2 pt-1 border-t border-teal/10">
                    <span>Player</span>
                    <span className="flex gap-3"><span>GP</span><span>G-A—P</span><span>P/G</span></span>
                  </div>
                </div>
              </DashboardCard>
            )}

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            {/* Left (3/5) */}
            <div className="lg:col-span-3 space-y-4">
              {/* Your Player */}
              <div className="bg-white rounded-xl border border-border p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Heart size={14} className="text-[#3B6B8A]" />
                  <h3 className="font-oswald text-xs font-bold text-navy uppercase tracking-wider">Your Player</h3>
                </div>
                {(() => {
                  const myPId = typeof window !== "undefined" ? localStorage.getItem("prospectx_my_player_id") : null;
                  return myPId ? (
                    <Link href={`/players/${myPId}`} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-navy/[0.02] transition-colors">
                      <div className="w-10 h-10 rounded-full bg-[#3B6B8A]/10 flex items-center justify-center">
                        <Heart size={18} className="text-[#3B6B8A]" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-navy">View Player Dashboard</p>
                        <p className="text-[10px] text-muted mt-0.5">Stats, development, and reports</p>
                      </div>
                      <ChevronRight size={14} className="text-muted/40 ml-auto" />
                    </Link>
                  ) : (
                    <div className="text-center py-5">
                      <Heart size={28} className="mx-auto text-muted/30 mb-2" />
                      <p className="text-muted text-sm">No player selected</p>
                      <Link href="/my-player" className="inline-block mt-2 text-xs text-teal hover:underline">Select your player</Link>
                    </div>
                  );
                })()}
              </div>

              {/* Recent Reports */}
              <DashboardCard
                icon={<FileText size={15} className="text-navy" />}
                title="Recent Reports"
                viewAllHref="/reports"
                loading={loading}
                empty={recentReports.length === 0}
                emptyIcon={<FileText size={24} className="text-muted/30" />}
                emptyText="No reports yet"
                emptyLink="/reports/generate"
                emptyLinkText="Generate your first report"
              >
                <div className="space-y-2">
                  {recentReports.slice(0, 3).map((r) => (
                    <ReportCard key={r.id} report={r} compact />
                  ))}
                </div>
              </DashboardCard>

              {/* Player Guide */}
              <Link href="/player-guide" className="flex items-center gap-3 p-4 bg-white rounded-xl border border-border hover:shadow-md transition-all group">
                <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                  <BookOpen size={20} className="text-green-600" />
                </div>
                <div>
                  <p className="font-oswald text-sm font-bold text-navy uppercase tracking-wider">Player Guide</p>
                  <p className="text-xs text-muted mt-0.5">Nutrition, workouts, mental game, and pathways</p>
                </div>
                <ChevronRight size={16} className="text-muted/40 ml-auto group-hover:text-teal transition-colors" />
              </Link>
            </div>

            {/* Right (2/5) */}
            <div className="lg:col-span-2 space-y-4">
              {/* Messages Link Card */}
              <Link href="/messages" className="flex items-center gap-3 p-4 bg-white rounded-xl border border-border hover:shadow-md transition-all group">
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                  <MessageSquare size={20} className="text-blue-600" />
                </div>
                <div>
                  <p className="font-oswald text-sm font-bold text-navy uppercase tracking-wider">Messages</p>
                  <p className="text-xs text-muted mt-0.5">Team communications and updates</p>
                </div>
                <ChevronRight size={16} className="text-muted/40 ml-auto group-hover:text-teal transition-colors" />
              </Link>

              {/* Monthly Usage */}
              <div className="bg-white rounded-xl border border-border p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-oswald text-xs font-bold text-navy uppercase tracking-wider">Monthly Usage</h3>
                  <Link href="/pricing" className="flex items-center gap-1 text-[10px] font-oswald font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-teal/10 text-teal hover:bg-teal/20 transition-colors">
                    <Crown size={10} />
                    {user?.subscription_tier || "Rookie"}
                  </Link>
                </div>
                <BenchTalkUsage />
              </div>
            </div>
          </div>
          </>
        )}

        {/* ── AGENT View ────────────────────────────────────── */}
        {roleGroup === "AGENT" && (
          <>
            {/* Live Scorebar */}
            {scorebar.length > 0 && (
              <div className="mb-4">
                <LiveScorebar scorebar={scorebar} teamName={activeTeam?.name || ""} scorebarLeague={scorebarLeague} onLeagueChange={setScorebarLeague} />
              </div>
            )}

            {/* Team Leaders */}
            {!teamDataLoading && scoringLeaders.length > 0 && (
              <DashboardCard
                icon={<BarChart3 size={15} className="text-teal" />}
                title={`${activeTeam?.name || "Team"} Leaders`}
                viewAllHref={activeTeam ? `/teams/${encodeURIComponent(activeTeam.name)}` : "/teams"}
                loading={teamDataLoading}
                empty={false}
              >
                <div className="space-y-1">
                  {scoringLeaders.map((l, i) => (
                    <Link key={`${l.id}-${i}`} href={`/players/${l.id}`} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-navy/[0.02] transition-colors text-xs group">
                      <span className="w-4 text-right font-oswald font-bold text-muted/50">{i + 1}</span>
                      <span className="flex-1 font-medium text-navy truncate group-hover:text-teal transition-colors">
                        {l.first_name} {l.last_name}
                      </span>
                      <span className="font-oswald text-muted/60 w-6 text-center">{l.gp}</span>
                      <span className="font-oswald text-navy/80 w-14 text-right">
                        {l.g}G-{l.a}A—<strong>{l.p}</strong>
                      </span>
                      <span className="font-oswald text-teal font-bold w-8 text-right">{l.ppg.toFixed(2)}</span>
                    </Link>
                  ))}
                  <div className="flex items-center justify-between text-[9px] text-muted/40 px-2 pt-1 border-t border-teal/10">
                    <span>Player</span>
                    <span className="flex gap-3"><span>GP</span><span>G-A—P</span><span>P/G</span></span>
                  </div>
                </div>
              </DashboardCard>
            )}

            {/* Agent Hub Banner */}
            <div className="bg-gradient-to-br from-[#475569] to-[#334155] rounded-xl p-5 mb-4 text-white">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
                  <Briefcase size={20} />
                </div>
                <div>
                  <h3 className="font-oswald text-sm font-bold uppercase tracking-wider">Agent Hub</h3>
                  <p className="text-xs text-white/60 mt-0.5">Client management and reports</p>
                </div>
              </div>
              <Link href="/my-clients" className="inline-flex items-center gap-1.5 text-xs bg-white/10 hover:bg-white/20 rounded-lg px-3 py-1.5 transition-colors">
                Manage Clients <ChevronRight size={12} />
              </Link>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
              {/* Left (3/5) */}
              <div className="lg:col-span-3 space-y-4">
                {/* Watch List */}
                <ScoutingListSection scoutingList={scoutingList} loading={loading} />

                {/* Recent Reports */}
                <DashboardCard
                  icon={<FileText size={15} className="text-navy" />}
                  title="Recent Reports"
                  viewAllHref="/reports"
                  loading={loading}
                  empty={recentReports.length === 0}
                  emptyIcon={<FileText size={24} className="text-muted/30" />}
                  emptyText="No reports yet"
                  emptyLink="/reports/generate"
                  emptyLinkText="Generate a report"
                >
                  <div className="space-y-2">
                    {recentReports.slice(0, 5).map((r) => (
                      <ReportCard key={r.id} report={r} compact />
                    ))}
                  </div>
                </DashboardCard>
              </div>

              {/* Right (2/5) */}
              <div className="lg:col-span-2 space-y-4">
                {/* Players Link Card */}
                <Link href="/players" className="flex items-center gap-3 p-4 bg-white rounded-xl border border-border hover:shadow-md transition-all group">
                  <div className="w-10 h-10 rounded-lg bg-teal/10 flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                    <Users size={20} className="text-teal" />
                  </div>
                  <div>
                    <p className="font-oswald text-sm font-bold text-navy uppercase tracking-wider">Player Database</p>
                    <p className="text-xs text-muted mt-0.5">Search, filter, and browse all players</p>
                  </div>
                  <ChevronRight size={16} className="text-muted/40 ml-auto group-hover:text-teal transition-colors" />
                </Link>

                {/* Monthly Usage */}
                <div className="bg-white rounded-xl border border-border p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-oswald text-xs font-bold text-navy uppercase tracking-wider">Monthly Usage</h3>
                    <Link href="/pricing" className="flex items-center gap-1 text-[10px] font-oswald font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-teal/10 text-teal hover:bg-teal/20 transition-colors">
                      <Crown size={10} />
                      {user?.subscription_tier || "Rookie"}
                    </Link>
                  </div>
                  <BenchTalkUsage />
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </>
  );
}

// ── Reusable Card Wrapper ────────────────────────────────────

function DashboardCard({
  icon, title, viewAllHref, loading, empty,
  emptyIcon, emptyText, emptyLink, emptyLinkText,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  viewAllHref: string;
  loading: boolean;
  empty: boolean;
  emptyIcon?: React.ReactNode;
  emptyText?: string;
  emptyLink?: string;
  emptyLinkText?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-teal/20 p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="text-sm font-oswald font-bold text-navy uppercase tracking-wider">{title}</h3>
        </div>
        <Link href={viewAllHref} className="text-xs text-teal hover:underline font-medium">View all</Link>
      </div>
      {loading ? (
        <CardSkeleton lines={3} />
      ) : empty ? (
        <div className="text-center py-5">
          {emptyIcon && <div className="mb-2">{emptyIcon}</div>}
          {emptyText && <p className="text-muted text-sm">{emptyText}</p>}
          {emptyLink && <Link href={emptyLink} className="inline-block mt-2 text-xs text-teal hover:underline">{emptyLinkText}</Link>}
        </div>
      ) : (
        children
      )}
    </div>
  );
}

// ── Scouting List Section ────────────────────────────────────

function ScoutingListSection({ scoutingList, loading }: { scoutingList: ScoutingListItem[]; loading: boolean }) {
  return (
    <DashboardCard
      icon={<Target size={15} className="text-orange" />}
      title="Scouting List"
      viewAllHref="/scouting"
      loading={loading}
      empty={scoutingList.length === 0}
      emptyIcon={<Target size={24} className="text-muted/30" />}
      emptyText="No players on scouting list"
      emptyLink="/scouting"
      emptyLinkText="Add a player"
    >
      <div className="space-y-1">
        {scoutingList.map((item) => (
          <Link key={item.id} href={`/players/${item.player_id}`} className="flex items-center gap-3 p-2 rounded-lg hover:bg-navy/[0.02] transition-colors group">
            <div className="relative shrink-0">
              <div className="w-7 h-7 rounded-full bg-navy/5 flex items-center justify-center text-[10px] font-oswald font-bold text-navy uppercase">
                {item.position || "?"}
              </div>
              <span className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border border-white ${PRIORITY_DOT[item.priority] || "bg-gray-400"}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-navy truncate group-hover:text-teal transition-colors">
                {item.first_name} {item.last_name}
              </p>
              <p className="text-[10px] text-muted truncate">
                {[item.current_team, formatLeague(item.current_league)].filter(Boolean).join(" / ") || "No team"}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </DashboardCard>
  );
}

// ── Top Prospects Section ────────────────────────────────────

function TopProspectsSection({ prospects, loading }: { prospects: TopProspect[]; loading: boolean }) {
  return (
    <DashboardCard
      icon={<Crown size={15} className="text-orange" />}
      title="Top Prospects"
      viewAllHref="/scout-notes"
      loading={loading}
      empty={prospects.length === 0}
      emptyIcon={<Crown size={24} className="text-muted/30" />}
      emptyText="Rate players with Scout Notes to see your Top Prospects here."
      emptyLink="/scout-notes/new"
      emptyLinkText="Create a Scout Note"
    >
      <div className="space-y-1">
        {prospects.map((p, i) => (
          <Link key={p.id} href={`/players/${p.id}`} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-navy/[0.02] transition-colors text-xs group">
            <span className="w-4 text-right font-oswald font-bold text-muted/50">{i + 1}</span>
            <div className="w-6 h-6 rounded-full bg-navy/5 flex items-center justify-center text-[9px] font-oswald font-bold text-navy uppercase shrink-0">
              {p.position || "?"}
            </div>
            <div className="flex-1 min-w-0">
              <span className="font-medium text-navy truncate group-hover:text-teal transition-colors">
                {p.first_name} {p.last_name}
              </span>
            </div>
            <span className="text-[10px] text-muted/60 truncate max-w-[80px]">{p.current_team || ""}</span>
            <span className="inline-flex items-center justify-center w-7 h-5 rounded bg-orange/10 text-orange text-[10px] font-oswald font-bold shrink-0">
              {p.top_grade}
            </span>
          </Link>
        ))}
      </div>
    </DashboardCard>
  );
}

// ── Live Scorebar ────────────────────────────────────────────

function LiveScorebar({ scorebar, teamName, scorebarLeague, onLeagueChange }: { scorebar: HTGame[]; teamName: string; scorebarLeague?: string; onLeagueChange?: (v: string) => void }) {
  const lower = teamName.toLowerCase();
  // Show games sorted by date, most recent / live first
  const sorted = [...scorebar].sort((a, b) => new Date(a.game_date || a.date).getTime() - new Date(b.game_date || b.date).getTime());

  return (
    <div className="bg-white rounded-xl border border-orange/25 p-4">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-[10px] font-oswald font-bold text-muted uppercase tracking-wider">League Scores</h3>
        {onLeagueChange && (
          <select
            value={scorebarLeague || ""}
            onChange={(e) => onLeagueChange(e.target.value)}
            className="ml-auto text-[10px] font-oswald uppercase tracking-wider bg-white border border-border rounded px-2 py-0.5 text-navy cursor-pointer"
          >
            <option value="">My Team&apos;s League</option>
            <option value="gojhl">GOJHL</option>
            <option value="ohl">OHL</option>
            <option value="ojhl">OJHL</option>
            <option value="whl">WHL</option>
            <option value="qmjhl">QMJHL</option>
            <option value="pwhl">PWHL</option>
          </select>
        )}
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-thin">
        {sorted.slice(0, 10).map((g) => {
          const isOurGame = g.home_team.toLowerCase().includes(lower) || g.away_team.toLowerCase().includes(lower) ||
                            lower.includes(g.home_team.toLowerCase()) || lower.includes(g.away_team.toLowerCase());
          return (
            <div
              key={g.game_id}
              className={`shrink-0 w-40 rounded-lg border p-2.5 text-center text-xs ${
                isOurGame ? "border-orange/35 bg-teal/[0.03]" : "border-border"
              }`}
            >
              <p className="text-[9px] text-muted/60 mb-1">
                {new Date(g.game_date || g.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                {g.time && ` · ${g.time}`}
              </p>
              <div className="flex items-center justify-between gap-1">
                <span className="font-oswald text-[11px] text-navy truncate flex-1 text-left">{g.away_team}</span>
                <span className="font-oswald font-bold text-sm text-navy">{g.away_score || "-"}</span>
              </div>
              <div className="flex items-center justify-between gap-1">
                <span className="font-oswald text-[11px] text-navy truncate flex-1 text-left">{g.home_team}</span>
                <span className="font-oswald font-bold text-sm text-navy">{g.home_score || "-"}</span>
              </div>
              <p className={`text-[9px] font-oswald uppercase tracking-wider mt-1 ${
                g.status === "Final" || g.status === "final" ? "text-muted/50" : "text-green-600 font-bold"
              }`}>
                {g.status || "Scheduled"}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Family Player Spotlight ──────────────────────────────────

function FamilyPlayerSpotlight({ scoringLeaders, loading }: { scoringLeaders: ScoringLeader[]; loading: boolean }) {
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("prospectx_my_player_id");
    if (saved) setMyPlayerId(saved);
  }, []);

  const myPlayer = myPlayerId ? scoringLeaders.find((l) => l.id === myPlayerId) : null;

  if (loading) {
    return <div className="bg-white rounded-xl border border-border p-5 animate-pulse"><div className="h-16 bg-navy/5 rounded-lg" /></div>;
  }

  if (!myPlayer) {
    return (
      <div className="bg-gradient-to-r from-navy/[0.02] to-teal/[0.02] rounded-xl border border-dashed border-teal/30 p-6 text-center">
        <Heart size={28} className="mx-auto text-teal/40 mb-2" />
        <p className="text-sm font-semibold text-navy mb-1">Select Your Player</p>
        <p className="text-xs text-muted mb-3">Set up your player profile to see their stats and development here.</p>
        <Link href="/my-player" className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal text-white text-xs font-oswald uppercase tracking-wider rounded-lg hover:bg-teal/90 transition-colors">
          <Users size={14} /> Choose Player
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-border p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-teal/10 flex items-center justify-center">
            <span className="font-oswald font-bold text-teal text-lg">{myPlayer.position}</span>
          </div>
          <div>
            <h3 className="text-lg font-oswald font-bold text-navy">{myPlayer.first_name} {myPlayer.last_name}</h3>
            <p className="text-xs text-muted">{myPlayer.current_team} · {myPlayer.position}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-center">
          <div>
            <p className="text-lg font-oswald font-bold text-navy">{myPlayer.gp}</p>
            <p className="text-[9px] text-muted uppercase">GP</p>
          </div>
          <div>
            <p className="text-lg font-oswald font-bold text-navy">{myPlayer.g}</p>
            <p className="text-[9px] text-muted uppercase">G</p>
          </div>
          <div>
            <p className="text-lg font-oswald font-bold text-navy">{myPlayer.a}</p>
            <p className="text-[9px] text-muted uppercase">A</p>
          </div>
          <div>
            <p className="text-lg font-oswald font-bold text-teal">{myPlayer.p}</p>
            <p className="text-[9px] text-muted uppercase">PTS</p>
          </div>
          <div>
            <p className="text-lg font-oswald font-bold text-orange">{myPlayer.ppg.toFixed(2)}</p>
            <p className="text-[9px] text-muted uppercase">P/G</p>
          </div>
        </div>
      </div>
    </div>
  );
}
