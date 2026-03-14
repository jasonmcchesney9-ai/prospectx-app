"use client";

import { useEffect, useState, useCallback, useRef } from "react";
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
  ChevronLeft,
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
  ClipboardList,
  Search,
  Calendar,
  RefreshCw,
  Loader2,
} from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import LandingPage from "@/components/LandingPage";
import ReportCard from "@/components/ReportCard";
import BenchTalkUsage from "@/components/BenchTalkUsage";
import { useBenchTalk } from "@/components/BenchTalkProvider";
import api, { assetUrl } from "@/lib/api";
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
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0F2942" }}>
        <div className="animate-spin rounded-full h-8 w-8 border-2" style={{ borderColor: "#0F2942", borderTopColor: "#0D9488" }} />
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
    <div className="animate-pulse space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          style={{ background: "#DDE6EF", borderRadius: 4, height: i === 0 ? 16 : 14, width: i === 0 ? "66%" : i === lines - 1 ? "50%" : "100%" }}
        />
      ))}
    </div>
  );
}

const SESSION_TYPE_MAP: Record<string, string> = Object.fromEntries(
  SESSION_TYPES.map((s) => [s.value, s.label])
);
const SESSION_BADGE_COLORS: Record<string, { background: string; color: string }> = {
  pre_game: { background: "rgba(13,148,136,0.1)", color: "#0D9488" },
  post_game: { background: "rgba(230,126,34,0.1)", color: "#E67E22" },
  practice: { background: "#EFF6FF", color: "#2563EB" },
  season_notes: { background: "rgba(15,41,66,0.05)", color: "rgba(15,41,66,0.7)" },
};
const PRIORITY_DOT: Record<string, string> = {
  high: "#C0392B",
  medium: "#F59E0B",
  low: "#22C55E",
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
  player_id: string;
  first_name: string;
  last_name: string;
  name: string;
  position: string | null;
  current_team: string | null;
  current_league: string | null;
  pxr_score: number;
  pxr_tier: string | null;
}

// ── League code mapping ──────────────────────────
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
  ir: { label: "IR", bg: "#FEF2F2", text: "#C0392B" },
  injured: { label: "Injured", bg: "#FEF2F2", text: "#C0392B" },
  "day-to-day": { label: "DTD", bg: "#FFFBEB", text: "#92400E" },
  scratched: { label: "Scratched", bg: "#F9FAFB", text: "#6B7280" },
  suspended: { label: "Suspended", bg: "#FEFCE8", text: "#854D0E" },
};

// ── Dashboard ────────────────────────────────────────────────
function Dashboard() {
  const user = getUser();
  const { setActivePxiContext, roleOverride } = useBenchTalk();
  const effectiveHockeyRole = roleOverride || user?.hockey_role;
  const roleGroup = getRoleGroup(effectiveHockeyRole);

  useEffect(() => {
    const u = getUser();
    setActivePxiContext({
      user: {
        id: u?.id || "",
        name: `${u?.first_name || ""} ${u?.last_name || ""}`.trim() || "User",
        role: (u?.hockey_role?.toUpperCase() || "SCOUT") as "COACH" | "PARENT" | "SCOUT" | "GM" | "AGENT" | "BROADCASTER" | "ANALYST",
        orgId: u?.org_id || "",
        orgName: "ProspectX",
      },
      page: { id: "DASHBOARD", route: "/" },
    });
    return () => { setActivePxiContext(null); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  const [heroSyncing, setHeroSyncing] = useState(false);

  // ── Dashboard layout (widget visibility) ──────────────────
  const [dashboardWidgets, setDashboardWidgets] = useState<string[] | null>(null);
  useEffect(() => {
    api.get("/api/dashboard/layout")
      .then((res) => {
        if (res.data?.layout?.widgets) {
          setDashboardWidgets(res.data.layout.widgets);
        }
      })
      .catch(() => {
        // Non-critical — show all widgets if layout fails to load
      });
  }, []);

  // Helper: check if a widget is enabled (null = show all — backwards compatible)
  const showWidget = (widgetId: string) => dashboardWidgets === null || dashboardWidgets.includes(widgetId);

  // ── Quick Actions (replaced Wall Board) ───────────────────

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
      if (results[1].status === "fulfilled") {
        const raw = (results[1] as PromiseFulfilledResult<{ data: ScoringLeader[] }>).value.data;
        const seen = new Set<string>();
        setScoringLeaders(raw.filter((l) => { if (seen.has(l.id)) return false; seen.add(l.id); return true; }));
      }
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
        api.get<{ players: TopProspect[] }>("/pxr/draft-board?season=2025-26"),
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

      // Top Prospects (PXR leaderboard — returns { players: [...] })
      if (results[5].status === "fulfilled") {
        const pxrData = (results[5] as PromiseFulfilledResult<{ data: { players: TopProspect[] } }>).value.data;
        setTopProspects((pxrData.players || []).slice(0, 5));
      }

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
          <div className="mb-4 rounded-xl px-4 py-3 flex items-start gap-3" style={{ background: "#FEF2F2", border: "1px solid #FECACA" }}>
            <AlertCircle size={16} className="mt-0.5 shrink-0" style={{ color: "#C0392B" }} />
            <div>
              <p className="font-medium text-sm" style={{ color: "#C0392B" }}>Connection Error</p>
              <p className="text-xs mt-0.5" style={{ color: "#C0392B" }}>{error}</p>
            </div>
          </div>
        )}

        {/* ═══ Team Hero Banner ═══ */}
        {(() => {
          const teamName = activeTeam?.name || "";
          const lowerName = teamName.toLowerCase();
          const ts = standings.find((s) => s.name.toLowerCase().includes(lowerName) || lowerName.includes(s.name.toLowerCase())) || null;
          const record = ts ? `${ts.wins ?? 0}-${ts.losses ?? 0}-${ts.otl ?? 0}` : null;
          const standingPts = ts?.points;
          const gf = ts?.gf;
          const ga = ts?.ga;
          const diff = ts?.diff;
          return (
            <div style={{ position: "relative", overflow: "hidden", background: "linear-gradient(135deg, #071E33 0%, #162E4A 60%, rgba(13,148,136,0.08) 100%)", borderRadius: 12, marginBottom: 18, minHeight: 110, padding: "0 28px", display: "flex", alignItems: "center" }}>
              {/* Rink SVG Watermark */}
              <svg viewBox="0 0 200 120" style={{ position: "absolute", right: 0, top: 0, height: "100%", opacity: 0.04 }} preserveAspectRatio="xMaxYMid meet">
                <rect x="10" y="10" width="180" height="100" rx="40" ry="40" fill="none" stroke="#FFFFFF" strokeWidth="2" />
                <line x1="100" y1="10" x2="100" y2="110" stroke="#FFFFFF" strokeWidth="1.5" />
                <circle cx="100" cy="60" r="18" fill="none" stroke="#FFFFFF" strokeWidth="1.5" />
                <circle cx="50" cy="40" r="8" fill="none" stroke="#FFFFFF" strokeWidth="1" />
                <circle cx="150" cy="40" r="8" fill="none" stroke="#FFFFFF" strokeWidth="1" />
                <circle cx="50" cy="80" r="8" fill="none" stroke="#FFFFFF" strokeWidth="1" />
                <circle cx="150" cy="80" r="8" fill="none" stroke="#FFFFFF" strokeWidth="1" />
              </svg>

              {/* Left: Team Logo + Info */}
              <div style={{ display: "flex", alignItems: "center", gap: 16, flex: 1, position: "relative", zIndex: 1, padding: "20px 0" }}>
                {/* Team Logo */}
                {activeTeam?.logo_url ? (
                  <div style={{ width: 56, height: 56, borderRadius: 10, overflow: "hidden", border: "2px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.08)", flexShrink: 0 }}>
                    <img src={assetUrl(activeTeam.logo_url)} alt={teamName} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                  </div>
                ) : activeTeam ? (
                  <div style={{ width: 56, height: 56, borderRadius: 10, background: "rgba(255,255,255,0.08)", border: "2px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 18, color: "rgba(255,255,255,0.5)" }}>
                      {activeTeam.abbreviation || teamName.slice(0, 3).toUpperCase()}
                    </span>
                  </div>
                ) : null}

                <div>
                  {/* Team Name */}
                  {activeTeam ? (
                    <Link href={`/teams/${encodeURIComponent(teamName)}`} style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 26, color: "#FFFFFF", textTransform: "uppercase", letterSpacing: "0.04em", textDecoration: "none", lineHeight: 1.1 }} className="hover:underline transition-colors" onMouseEnter={(e) => (e.currentTarget.style.color = "#0D9488")} onMouseLeave={(e) => (e.currentTarget.style.color = "#FFFFFF")}>
                      {teamName}
                    </Link>
                  ) : (
                    <span style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 26, color: "#FFFFFF", textTransform: "uppercase", letterSpacing: "0.04em" }}>DASHBOARD</span>
                  )}
                  {/* League line */}
                  {activeTeam?.league && (
                    <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>
                      {activeTeam.league}{record ? ` — ${record}` : ""}
                    </p>
                  )}
                  {/* Stats strip */}
                  {ts && (
                    <div style={{ display: "flex", gap: 20, marginTop: 8 }}>
                      {record && (
                        <div>
                          <p style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 18, color: "#FFFFFF", lineHeight: 1 }}>{record}</p>
                          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: "rgba(255,255,255,0.35)", textTransform: "uppercase" }}>Record</p>
                        </div>
                      )}
                      {standingPts != null && (
                        <div>
                          <p style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 18, color: "#FFFFFF", lineHeight: 1 }}>{standingPts}</p>
                          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: "rgba(255,255,255,0.35)", textTransform: "uppercase" }}>Points</p>
                        </div>
                      )}
                      {gf != null && (
                        <div>
                          <p style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 18, color: "#FFFFFF", lineHeight: 1 }}>{gf}</p>
                          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: "rgba(255,255,255,0.35)", textTransform: "uppercase" }}>GF</p>
                        </div>
                      )}
                      {ga != null && (
                        <div>
                          <p style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 18, color: "#FFFFFF", lineHeight: 1 }}>{ga}</p>
                          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: "rgba(255,255,255,0.35)", textTransform: "uppercase" }}>GA</p>
                        </div>
                      )}
                      {diff != null && (
                        <div>
                          <p style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 18, color: diff > 0 ? "#14B8A8" : diff < 0 ? "#C0392B" : "#FFFFFF", lineHeight: 1 }}>{diff > 0 ? `+${diff}` : diff}</p>
                          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: "rgba(255,255,255,0.35)", textTransform: "uppercase" }}>Diff</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Sync + Team Selector */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, position: "relative", zIndex: 1 }}>
                {activeTeam && (
                  <button
                    onClick={async () => {
                      if (heroSyncing) return;
                      setHeroSyncing(true);
                      try { await loadTeamData(activeTeam); } finally { setHeroSyncing(false); }
                    }}
                    disabled={heroSyncing}
                    style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 7, background: "rgba(13,148,136,0.15)", border: "1.5px solid rgba(13,148,136,0.3)", color: "#14B8A8", fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", cursor: "pointer" }}
                    className="hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {heroSyncing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                    {heroSyncing ? "Syncing..." : "\u21BB Sync"}
                  </button>
                )}
                {teams.length > 1 && (
                  <select
                    value={activeTeam?.name || ""}
                    onChange={(e) => {
                      const t = teams.find((tm) => tm.name === e.target.value);
                      if (t) handleTeamChange(t);
                    }}
                    style={{ appearance: "none", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", color: "#FFFFFF", fontSize: 11, fontFamily: "'Oswald', sans-serif", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", borderRadius: 7, padding: "8px 28px 8px 12px", cursor: "pointer" }}
                    className="focus:outline-none"
                  >
                    {teams.map((t) => (
                      <option key={t.id} value={t.name} style={{ background: "#0F2942", color: "#FFFFFF" }}>{t.name}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          );
        })()}


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
              <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 10, padding: "12px 16px", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <AlertCircle size={14} style={{ color: "#92400E" }} />
                  <span style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 10, textTransform: "uppercase", color: "#92400E", letterSpacing: "0.06em" }}>
                    Roster Alert — {rosterAlerts.length} player{rosterAlerts.length !== 1 ? "s" : ""} out
                  </span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {rosterAlerts.slice(0, 8).map((p) => {
                    const statusKey = p.roster_status || "";
                    const badgeColors: Record<string, { bg: string; color: string }> = {
                      "day-to-day": { bg: "#FEF3C7", color: "#92400E" },
                      ir: { bg: "#FEE2E2", color: "#991B1B" },
                      injured: { bg: "#FEE2E2", color: "#991B1B" },
                      ap: { bg: "#DBEAFE", color: "#1E40AF" },
                      scratched: { bg: "#F3F4F6", color: "#6B7280" },
                      suspended: { bg: "#FEF9C3", color: "#854D0E" },
                    };
                    const badge = badgeColors[statusKey] || { bg: "#F3F4F6", color: "#6B7280" };
                    const badgeLabel = ALERT_STATUS_STYLES[statusKey]?.label || statusKey.toUpperCase();
                    return (
                      <Link
                        key={p.id}
                        href={`/players/${p.id}`}
                        style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.7)", border: "1px solid #FDE68A", borderRadius: 20, padding: "3px 8px 3px 10px", textDecoration: "none" }}
                        className="hover:opacity-80 transition-opacity"
                      >
                        <span style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 600, fontSize: 11, color: "#1A2B3C" }}>{p.first_name} {p.last_name}</span>
                        <span style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 8, textTransform: "uppercase", background: badge.bg, color: badge.color, padding: "2px 5px", borderRadius: 4 }}>
                          {badgeLabel}
                        </span>
                      </Link>
                    );
                  })}
                  {rosterAlerts.length > 8 && (
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#94A3B8", alignSelf: "center" }}>+{rosterAlerts.length - 8} more</span>
                  )}
                </div>
              </div>
            )}

            {/* ── Next Game Card ── */}
            {(() => {
              const teamLower = (activeTeam?.name || "").toLowerCase();
              const now = new Date();
              const nextGame = scorebar
                .filter((g) => {
                  const gd = new Date(g.game_date || g.date);
                  return gd >= now && g.status !== "Final" && g.status !== "Final OT" && g.status !== "Final SO" && g.status !== "final";
                })
                .filter((g) => g.home_team.toLowerCase().includes(teamLower) || g.away_team.toLowerCase().includes(teamLower) || teamLower.includes(g.home_team.toLowerCase()) || teamLower.includes(g.away_team.toLowerCase()))
                .sort((a, b) => new Date(a.game_date || a.date).getTime() - new Date(b.game_date || b.date).getTime())[0];
              if (!nextGame) return null;
              const isHome = nextGame.home_team.toLowerCase().includes(teamLower) || teamLower.includes(nextGame.home_team.toLowerCase());
              const opponent = isHome ? nextGame.away_team : nextGame.home_team;
              const recentResults = scorebar
                .filter((g) => (g.status === "Final" || g.status === "Final OT" || g.status === "Final SO" || g.status === "final"))
                .filter((g) => g.home_team.toLowerCase().includes(teamLower) || g.away_team.toLowerCase().includes(teamLower) || teamLower.includes(g.home_team.toLowerCase()) || teamLower.includes(g.away_team.toLowerCase()))
                .sort((a, b) => new Date(b.game_date || b.date).getTime() - new Date(a.game_date || a.date).getTime())
                .slice(0, 5);
              const seriesDots = recentResults.slice(0, 5).reverse().map((g) => {
                const isH = g.home_team.toLowerCase().includes(teamLower) || teamLower.includes(g.home_team.toLowerCase());
                const our = parseInt(isH ? g.home_score : g.away_score) || 0;
                const their = parseInt(isH ? g.away_score : g.home_score) || 0;
                return our > their ? "W" : "L";
              });
              return (
                <div style={{ background: "#0F2942", borderRadius: 10, overflow: "hidden", marginBottom: 16 }}>
                  {/* Header */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    <span style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.7)" }}>Next Game</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#14B8A8" }}>
                      {new Date(nextGame.game_date || nextGame.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                      {nextGame.time ? ` · ${nextGame.time}` : ""}
                    </span>
                  </div>
                  {/* Matchup */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 24, padding: "18px 16px" }}>
                    {/* Home team */}
                    <div style={{ textAlign: "center" }}>
                      <span style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 600, fontSize: 11, color: "rgba(255,255,255,0.4)", textTransform: "uppercase" }}>HOME</span>
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", margin: "6px auto" }}>
                        <span style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{nextGame.home_team.slice(0, 3).toUpperCase()}</span>
                      </div>
                      <p style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 15, color: "#FFFFFF", textTransform: "uppercase" }}>{nextGame.home_team}</p>
                    </div>
                    {/* VS */}
                    <span style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 12, color: "rgba(255,255,255,0.2)" }}>VS</span>
                    {/* Away team */}
                    <div style={{ textAlign: "center" }}>
                      <span style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 600, fontSize: 11, color: "rgba(255,255,255,0.4)", textTransform: "uppercase" }}>AWAY</span>
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", margin: "6px auto" }}>
                        <span style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{nextGame.away_team.slice(0, 3).toUpperCase()}</span>
                      </div>
                      <p style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 15, color: "#FFFFFF", textTransform: "uppercase" }}>{nextGame.away_team}</p>
                    </div>
                  </div>
                  {/* Series dots */}
                  {seriesDots.length > 0 && (
                    <div style={{ display: "flex", justifyContent: "center", gap: 6, paddingBottom: 12 }}>
                      {Array.from({ length: 5 }).map((_, i) => {
                        const dot = seriesDots[i];
                        return (
                          <div key={i} style={{ width: 10, height: 10, borderRadius: "50%", background: dot === "W" ? "#22C55E" : dot === "L" ? "#C0392B" : "rgba(255,255,255,0.1)", border: !dot ? "1px solid rgba(255,255,255,0.15)" : "none" }} />
                        );
                      })}
                    </div>
                  )}
                  {/* Action buttons 2x2 */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, padding: "0 16px 14px" }}>
                    <Link href="/game-plans" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, padding: "8px 0", borderRadius: 7, background: "rgba(13,148,136,0.2)", color: "#14B8A8", fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 10, textTransform: "uppercase", textDecoration: "none", letterSpacing: "0.04em" }}>
                      <Swords size={11} /> Game Plan
                    </Link>
                    <Link href="/game-plans" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, padding: "8px 0", borderRadius: 7, background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)", fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 10, textTransform: "uppercase", textDecoration: "none", letterSpacing: "0.04em" }}>
                      <Swords size={11} /> Game Plan
                    </Link>
                    <Link href={`/players?team=${encodeURIComponent(opponent)}`} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, padding: "8px 0", borderRadius: 7, background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)", fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 10, textTransform: "uppercase", textDecoration: "none", letterSpacing: "0.04em" }}>
                      <Target size={11} /> Scout Opp.
                    </Link>
                    <Link href="/video-sessions" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, padding: "8px 0", borderRadius: 7, background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)", fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 10, textTransform: "uppercase", textDecoration: "none", letterSpacing: "0.04em" }}>
                      <FileText size={11} /> Film Room
                    </Link>
                  </div>
                </div>
              );
            })()}

            {/* ── Recent Results Card ── */}
            {(() => {
              const teamLower = (activeTeam?.name || "").toLowerCase();
              const recentGames = scorebar
                .filter((g) => g.status === "Final" || g.status === "Final OT" || g.status === "Final SO" || g.status === "final")
                .filter((g) => g.home_team.toLowerCase().includes(teamLower) || g.away_team.toLowerCase().includes(teamLower) || teamLower.includes(g.home_team.toLowerCase()) || teamLower.includes(g.away_team.toLowerCase()))
                .sort((a, b) => new Date(b.game_date || b.date).getTime() - new Date(a.game_date || a.date).getTime())
                .slice(0, 5);
              if (recentGames.length === 0) return null;
              return (
                <div style={{ borderRadius: 10, border: "1px solid #DDE6EF", overflow: "hidden", marginBottom: 16 }}>
                  <div style={{ background: "#0F2942", padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.7)" }}>Recent Results</span>
                    <Link href="/leagues?tab=schedule" style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 600, fontSize: 10, textTransform: "uppercase", color: "#14B8A8", textDecoration: "none" }}>View All</Link>
                  </div>
                  <div style={{ background: "#FFFFFF" }}>
                    {recentGames.map((g) => {
                      const isH = g.home_team.toLowerCase().includes(teamLower) || teamLower.includes(g.home_team.toLowerCase());
                      const ourScore = parseInt(isH ? g.home_score : g.away_score) || 0;
                      const theirScore = parseInt(isH ? g.away_score : g.home_score) || 0;
                      const opponent = isH ? g.away_team : g.home_team;
                      const isOT = g.status === "Final OT" || g.status === "Final SO";
                      const result = ourScore > theirScore ? (isOT ? "OW" : "W") : "L";
                      const pillColors: Record<string, { bg: string; color: string }> = {
                        W: { bg: "rgba(30,107,60,0.12)", color: "#1E6B3C" },
                        L: { bg: "rgba(192,57,43,0.12)", color: "#C0392B" },
                        OW: { bg: "rgba(13,148,136,0.12)", color: "#0D9488" },
                      };
                      const pill = pillColors[result] || pillColors.L;
                      return (
                        <div key={g.game_id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 16px", borderBottom: "1px solid #F0F4F8" }}>
                          <div style={{ width: 28, height: 28, borderRadius: 6, background: pill.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <span style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 10, color: pill.color }}>{result}</span>
                          </div>
                          <span style={{ fontFamily: "'Source Serif 4', serif", fontWeight: 600, fontSize: 12.5, color: "#0F2942", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {isH ? "vs" : "@"} {opponent}
                          </span>
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "#0F2942", flexShrink: 0 }}>
                            {ourScore}-{theirScore}
                          </span>
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#94A3B8", flexShrink: 0, width: 60, textAlign: "right" }}>
                            {new Date(g.game_date || g.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Live Schedule Strip — today's games, live first */}
            {(() => {
              const todayStr = new Date().toISOString().slice(0, 10);
              const todayGames = scorebar
                .filter((g) => (g.game_date || g.date) === todayStr)
                .sort((a, b) => {
                  const aFinal = a.status === "Final" || a.status === "Final OT" || a.status === "Final SO";
                  const bFinal = b.status === "Final" || b.status === "Final OT" || b.status === "Final SO";
                  const aLive = !aFinal && a.status !== "" && a.period !== "";
                  const bLive = !bFinal && b.status !== "" && b.period !== "";
                  if (aLive && !bLive) return -1;
                  if (!aLive && bLive) return 1;
                  return (a.time || "").localeCompare(b.time || "");
                })
                .slice(0, 4);
              if (todayGames.length === 0) return null;
              const hasLive = todayGames.some((g) => {
                const isFinal = g.status === "Final" || g.status === "Final OT" || g.status === "Final SO";
                return !isFinal && g.status !== "" && g.period !== "";
              });
              return (
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {hasLive && <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#C0392B" }} />}
                      <h3 className="text-xs font-oswald font-bold uppercase tracking-wider" style={{ color: "#0F2942" }}>
                        {hasLive ? "Live Now" : "Today\u2019s Games"}
                      </h3>
                    </div>
                    <Link href="/leagues?tab=schedule" className="text-[10px] font-oswald uppercase tracking-wider transition-colors" style={{ color: "#0D9488" }} onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(13,148,136,0.8)")} onMouseLeave={(e) => (e.currentTarget.style.color = "#0D9488")}>
                      View all
                    </Link>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                    {todayGames.map((g) => {
                      const isFinal = g.status === "Final" || g.status === "Final OT" || g.status === "Final SO";
                      const isLive = !isFinal && g.status !== "" && g.period !== "";
                      return (
                        <div
                          key={g.game_id}
                          className="rounded-xl p-3"
                          style={{ background: "#FFFFFF", border: isLive ? "1px solid #F87171" : "1px solid rgba(13,148,136,0.2)", boxShadow: isLive ? "0 1px 2px rgba(0,0,0,0.05)" : undefined }}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] font-oswald truncate flex-1" style={{ color: "#0F2942" }}>{g.away_team}</span>
                            <span className="font-oswald font-bold text-sm ml-2" style={{ color: "#0F2942" }}>
                              {isFinal || isLive ? g.away_score : ""}
                            </span>
                          </div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] font-oswald truncate flex-1" style={{ color: "#0F2942" }}>{g.home_team}</span>
                            <span className="font-oswald font-bold text-sm ml-2" style={{ color: "#0F2942" }}>
                              {isFinal || isLive ? g.home_score : ""}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <p className="text-[9px] font-oswald uppercase tracking-wider" style={{ color: isLive ? "#C0392B" : "rgba(148,163,184,0.5)", fontWeight: isLive ? 700 : undefined }}>
                              {isLive ? `${g.period} ${g.game_clock}` : isFinal ? g.status : g.time || "TBD"}
                            </p>
                            {g.venue && (
                              <p className="text-[9px] truncate max-w-[80px]" style={{ color: "rgba(148,163,184,0.4)" }}>{g.venue}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Upcoming Schedule */}
            {(() => {
              const today = new Date().toISOString().slice(0, 10);
              const upcoming = scorebar
                .filter((g) => g.game_date >= today && g.status !== "Final")
                .sort((a, b) => a.game_date.localeCompare(b.game_date) || a.time.localeCompare(b.time))
                .slice(0, 5);
              const teamName = activeTeam?.name || "";
              return (
                <div className="mb-4 rounded-xl overflow-hidden" style={{ background: "#FFFFFF", borderLeft: "4px solid #0D9488", border: "1px solid #E2EAF3", borderLeftWidth: 4, borderLeftColor: "#0D9488" }}>
                  <div className="px-4 py-2.5 flex items-center justify-between" style={{ borderBottom: "1px solid #E2EAF3" }}>
                    <div className="flex items-center gap-2">
                      <Calendar size={14} style={{ color: "#0D9488" }} />
                      <span className="text-xs font-oswald font-bold uppercase tracking-wider" style={{ color: "#0F2942" }}>Upcoming Schedule</span>
                    </div>
                    <Link href="/schedule" className="text-[10px] font-oswald uppercase tracking-wider transition-colors" style={{ color: "#0D9488" }} onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(13,148,136,0.8)")} onMouseLeave={(e) => (e.currentTarget.style.color = "#0D9488")}>
                      Full Schedule
                    </Link>
                  </div>
                  {upcoming.length === 0 ? (
                    <div className="px-4 py-6 text-center">
                      <p className="text-sm" style={{ color: "#94A3B8" }}>No upcoming games — <Link href="/schedule" className="hover:underline" style={{ color: "#0D9488" }}>view Schedule</Link></p>
                    </div>
                  ) : (
                    <div style={{ borderTop: "1px solid #E2EAF3" }}>
                      {upcoming.map((g) => {
                        const isHome = g.home_team === teamName;
                        const opponent = isHome ? g.away_team : g.home_team;
                        const homeAway = isHome ? "HOME" : "AWAY";
                        const dateStr = new Date(g.game_date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
                        return (
                          <div key={g.game_id} className="flex items-center gap-3 px-4 py-2.5 transition-colors" style={{ borderBottom: "1px solid #E2EAF3" }} onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(15,41,66,0.02)")} onMouseLeave={(e) => (e.currentTarget.style.background = "")}>
                            <div className="w-20 shrink-0">
                              <p className="text-xs font-medium" style={{ color: "#0F2942" }}>{dateStr}</p>
                              {g.time && <p className="text-[10px]" style={{ color: "#94A3B8" }}>{g.time}</p>}
                            </div>
                            <span className="text-[9px] font-oswald font-bold uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ background: isHome ? "rgba(13,148,136,0.1)" : "rgba(15,41,66,0.05)", color: isHome ? "#0D9488" : "rgba(15,41,66,0.6)" }}>
                              {homeAway}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate" style={{ color: "#0F2942" }}>{isHome ? "vs" : "@"} {opponent}</p>
                              {g.venue && <p className="text-[10px] truncate" style={{ color: "#94A3B8" }}>{g.venue}</p>}
                            </div>
                            <Link
                              href="/game-plans"
                              className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-oswald font-bold uppercase tracking-wider rounded-lg transition-colors"
                              style={{ color: "#0D9488", background: "rgba(13,148,136,0.1)" }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(13,148,136,0.2)")}
                              onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(13,148,136,0.1)")}
                            >
                              <Swords size={10} />
                              Prep Game
                            </Link>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Two-Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
              {/* LEFT: Operations */}
              <div className="lg:col-span-3 space-y-5">
                {/* Active Series */}
                {showWidget("active_series") && (
                <DashboardCard
                  icon={<Trophy size={15} style={{ color: "#E67E22" }} />}
                  title="Active Series"
                  viewAllHref="/series"
                  loading={loading}
                  empty={activeSeries.length === 0}
                  emptyIcon={<Trophy size={24} style={{ color: "rgba(148,163,184,0.3)" }} />}
                  emptyText="No active series"
                  emptyLink="/series/new"
                  emptyLinkText="Start a series"
                >
                  <div className="space-y-2">
                    {activeSeries.map((s) => (
                      <Link key={s.id} href={`/series/${s.id}`} className="flex items-center justify-between p-3 rounded-lg transition-colors group" style={{ border: "1px solid rgba(13,148,136,0.2)" }} onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(15,41,66,0.02)")} onMouseLeave={(e) => (e.currentTarget.style.background = "")}>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate" style={{ color: "#0F2942" }}>
                            {s.team_name} <span className="font-normal" style={{ color: "#94A3B8" }}>vs</span> {s.opponent_team_name}
                          </p>
                          {s.series_name && <p className="text-[10px] truncate mt-0.5" style={{ color: "#94A3B8" }}>{s.series_name}</p>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-3">
                          <span className="text-sm font-oswald font-bold" style={{ color: "#0F2942" }}>{s.current_score || "0-0"}</span>
                          <span className="text-[10px] font-oswald uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ background: "rgba(15,41,66,0.05)", color: "rgba(15,41,66,0.6)" }}>
                            {FORMAT_LABELS[s.series_format] || s.series_format}
                          </span>
                          <ChevronRight size={14} className="group-hover:text-teal transition-colors" style={{ color: "rgba(148,163,184,0.4)" }} />
                        </div>
                      </Link>
                    ))}
                  </div>
                </DashboardCard>
                )}

                {/* Game Plan Sessions */}
                {showWidget("chalk_talk") && (
                <DashboardCard
                  icon={<Swords size={15} style={{ color: "#0D9488" }} />}
                  title="Game Plan"
                  viewAllHref="/game-plans"
                  loading={loading}
                  empty={activeGamePlans.length === 0}
                  emptyIcon={<Swords size={24} style={{ color: "rgba(148,163,184,0.3)" }} />}
                  emptyText="No active sessions"
                  emptyLink="/chalk-talk/sessions"
                  emptyLinkText="Create a session"
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {activeGamePlans.slice(0, 3).map((gp) => {
                      const isActive = gp.status === "active";
                      const isComplete = gp.status === "completed";
                      return (
                        <Link key={gp.id} href={`/game-plans/${gp.id}`} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: 8, background: isActive ? "#E6F7F6" : isComplete ? "#FAFBFC" : "#FFFFFF", border: isActive ? "1px solid rgba(13,148,136,0.15)" : "1px solid #DDE6EF", textDecoration: "none" }} className="hover:opacity-90 transition-opacity group">
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 600, fontSize: 12, color: "#0F2942", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {gp.team_name} <span style={{ color: "#94A3B8", fontWeight: 400 }}>vs</span> {gp.opponent_team_name}
                            </p>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3 }}>
                              <span style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 9, textTransform: "uppercase", padding: "2px 6px", borderRadius: 4, background: isActive ? "rgba(13,148,136,0.15)" : isComplete ? "rgba(30,107,60,0.1)" : "rgba(15,41,66,0.05)", color: isActive ? "#0D9488" : isComplete ? "#1E6B3C" : "#94A3B8" }}>
                                {isActive ? "Active" : isComplete ? "Complete" : gp.status || "Draft"}
                              </span>
                              {gp.game_date && (
                                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "#94A3B8" }}>
                                  {new Date(gp.game_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                </span>
                              )}
                              {gp.session_type && (
                                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "#94A3B8" }}>
                                  {SESSION_TYPE_MAP[gp.session_type] || gp.session_type}
                                </span>
                              )}
                            </div>
                          </div>
                          <ChevronRight size={14} style={{ color: "#94A3B8", flexShrink: 0, marginLeft: 8 }} />
                        </Link>
                      );
                    })}
                  </div>
                </DashboardCard>
                )}

                {/* Top Prospects */}
                {showWidget("top_prospects") && (
                  <TopProspectsSection prospects={topProspects} loading={loading} />
                )}

                {/* Players Without Development Plans */}
                {(user?.hockey_role === "coach" || user?.hockey_role === "admin" || user?.hockey_role === "gm") && (
                  <DashboardCard
                    icon={<TrendingUp size={15} style={{ color: "#E67E22" }} />}
                    title="Players Without Development Plans"
                    viewAllHref="/players"
                    loading={loading}
                    empty={playersWithoutPlans.length === 0}
                    emptyIcon={<CheckCircle size={24} style={{ color: "#1E6B3C" }} />}
                    emptyText={`All players have development plans for ${new Date().getFullYear()}-${String(new Date().getFullYear() + 1).slice(2)}`}
                  >
                    <div className="space-y-1.5">
                      {playersWithoutPlans.slice(0, 5).map((p) => (
                        <div key={p.id} className="flex items-center justify-between p-2 rounded-lg transition-colors" style={{ border: "1px solid #E2EAF3" }} onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(13,148,136,0.3)")} onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#E2EAF3")}>
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-sm font-medium truncate" style={{ color: "#0F2942" }}>{p.first_name} {p.last_name}</span>
                            <span className="text-[10px] font-oswald uppercase" style={{ color: "#94A3B8" }}>{p.position}</span>
                          </div>
                          <Link
                            href={`/players/${p.id}?tab=devplan&generate=1`}
                            className="shrink-0 flex items-center gap-1 px-2.5 py-1 text-xs font-oswald uppercase tracking-wider rounded-lg transition-colors"
                            style={{ color: "#E67E22" }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(230,126,34,0.05)")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                          >
                            <Sparkles size={12} /> Generate
                          </Link>
                        </div>
                      ))}
                      {playersWithoutPlans.length > 5 && (
                        <p className="text-xs text-center pt-1" style={{ color: "#94A3B8" }}>
                          +{playersWithoutPlans.length - 5} more players
                        </p>
                      )}
                    </div>
                  </DashboardCard>
                )}

              </div>

              {/* RIGHT: Intelligence */}
              <div className="lg:col-span-2 space-y-5">
                {/* Quick Actions */}
                <div style={{ background: "#FFFFFF", borderRadius: 12, border: "1px solid #E2EAF3", padding: "16px 16px 12px" }}>
                  <h3 style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 13, textTransform: "uppercase", letterSpacing: "0.06em", color: "#0F2942", marginBottom: 12 }}>
                    Quick Actions
                  </h3>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {[
                      { label: "New Report", icon: <FileText size={16} style={{ color: "#0D9488" }} />, href: "/reports" },
                      { label: "Practice Plan", icon: <ClipboardList size={16} style={{ color: "#0D9488" }} />, href: "/practice-plans" },
                      { label: "Scout a Player", icon: <Search size={16} style={{ color: "#0D9488" }} />, href: "/players" },
                      { label: "Game Plan", icon: <MessageSquare size={16} style={{ color: "#0D9488" }} />, href: "/game-plans" },
                    ].map((action) => (
                      <Link
                        key={action.label}
                        href={action.href}
                        style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 14px", borderRadius: 8, background: "#0F2942", textDecoration: "none", transition: "background 0.15s" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#0D9488")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "#0F2942")}
                      >
                        {action.icon}
                        <span style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 600, fontSize: 11, color: "#FFFFFF", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                          {action.label}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>

                {/* Scouting List */}
                {showWidget("scouting_list") && (
                  <ScoutingListSection scoutingList={scoutingList} loading={loading} />
                )}

                {/* Team Leaders */}
                {showWidget("scoring_leaders") && !teamDataLoading && scoringLeaders.length > 0 && (
                  <DashboardCard
                    icon={<BarChart3 size={15} style={{ color: "#0D9488" }} />}
                    title={`${activeTeam?.name || "Team"} Leaders`}
                    viewAllHref={activeTeam ? `/teams/${encodeURIComponent(activeTeam.name)}` : "/teams"}
                    loading={teamDataLoading}
                    empty={false}
                  >
                    <div className="space-y-1">
                      {scoringLeaders.map((l, i) => (
                        <Link key={`${l.id}-${i}`} href={`/players/${l.id}`} className="flex items-center gap-2 px-2 py-1.5 rounded transition-colors text-xs group" onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(15,41,66,0.02)")} onMouseLeave={(e) => (e.currentTarget.style.background = "")}>
                          <span className="w-4 text-right font-oswald font-bold" style={{ color: "rgba(148,163,184,0.5)" }}>{i + 1}</span>
                          <span className="flex-1 font-medium truncate group-hover:text-teal transition-colors" style={{ color: "#0F2942" }}>
                            {l.first_name} {l.last_name}
                          </span>
                          <span className="font-oswald w-6 text-center" style={{ color: "rgba(148,163,184,0.6)" }}>{l.gp}</span>
                          <span className="font-oswald w-14 text-right" style={{ color: "rgba(15,41,66,0.8)" }}>
                            {l.g}G-{l.a}A—<strong>{l.p}</strong>
                          </span>
                          <span className="font-oswald font-bold w-8 text-right" style={{ color: "#0D9488" }}>{(l.ppg ?? 0).toFixed(2)}</span>
                        </Link>
                      ))}
                      <div className="flex items-center justify-between text-[9px] px-2 pt-1" style={{ color: "rgba(148,163,184,0.4)", borderTop: "1px solid rgba(13,148,136,0.1)" }}>
                        <span>Player</span>
                        <span className="flex gap-3"><span>GP</span><span>G-A—P</span><span>P/G</span></span>
                      </div>
                    </div>
                  </DashboardCard>
                )}

              </div>
            </div>

            {/* Reports Footer — dark panel */}
            <div className="rounded-xl p-4 mt-4" style={{ background: "#0F2942" }}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <FileText size={14} style={{ color: "#E67E22" }} />
                  <h3 className="font-oswald text-xs font-bold uppercase tracking-wider" style={{ color: "#FFFFFF" }}>Recent Reports</h3>
                </div>
                <Link href="/reports" className="text-[10px] font-oswald uppercase tracking-wider hover:underline font-medium" style={{ color: "#0D9488" }}>View all</Link>
              </div>
              {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {[1,2,3].map((i) => (
                    <div key={i} className="animate-pulse rounded-lg p-3" style={{ border: "1px solid rgba(230,126,34,0.2)", background: "rgba(255,255,255,0.04)" }}>
                      <div className="h-3 rounded w-3/4 mb-2" style={{ background: "rgba(255,255,255,0.1)" }} />
                      <div className="h-2 rounded w-1/2" style={{ background: "rgba(255,255,255,0.1)" }} />
                    </div>
                  ))}
                </div>
              ) : recentReports.length === 0 ? (
                <div className="text-center py-5 rounded-lg border-dashed" style={{ border: "1px dashed rgba(230,126,34,0.2)", background: "rgba(255,255,255,0.03)" }}>
                  <FileText size={24} className="mx-auto mb-1.5" style={{ color: "rgba(255,255,255,0.2)" }} />
                  <p className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>No reports generated yet. Choose a report type, pick a player or team, and let PXI do the work.</p>
                  <Link href="/reports/generate" className="inline-block mt-1.5 text-xs hover:underline" style={{ color: "#0D9488" }}>Generate your first report</Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {recentReports.slice(0, 6).map((r: Report) => (
                    <ReportCard key={r.id} report={r} compact dark />
                  ))}
                </div>
              )}
            </div>

            {/* Monthly Usage */}
            <div className="rounded-xl p-5 mt-4" style={{ background: "#FFFFFF", border: "1px solid #E2EAF3" }}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-oswald text-xs font-bold uppercase tracking-wider" style={{ color: "#0F2942" }}>Monthly Usage</h3>
                <Link href="/billing" className="flex items-center gap-1 text-[10px] font-oswald font-bold uppercase tracking-wider px-2 py-0.5 rounded-full transition-colors" style={{ background: "rgba(13,148,136,0.1)", color: "#0D9488" }} onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(13,148,136,0.2)")} onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(13,148,136,0.1)")}>
                  <Crown size={10} />
                  {user?.subscription_tier || "Rookie"}
                </Link>
              </div>
              <BenchTalkUsage />
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
                    icon={<BarChart3 size={15} style={{ color: "#0D9488" }} />}
                    title="Scoring Leaders"
                    viewAllHref={activeTeam ? `/teams/${encodeURIComponent(activeTeam.name)}` : "/teams"}
                    loading={teamDataLoading}
                    empty={false}
                  >
                    <div className="space-y-1">
                      {scoringLeaders.map((l, i) => (
                        <Link key={`${l.id}-${i}`} href={`/players/${l.id}`} className="flex items-center gap-2 px-2 py-1.5 rounded transition-colors text-xs group" onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(15,41,66,0.02)")} onMouseLeave={(e) => (e.currentTarget.style.background = "")}>
                          <span className="w-4 text-right font-oswald font-bold" style={{ color: "rgba(148,163,184,0.5)" }}>{i + 1}</span>
                          <span className="flex-1 font-medium truncate group-hover:text-teal transition-colors" style={{ color: "#0F2942" }}>
                            {l.first_name} {l.last_name}
                          </span>
                          <span className="text-[10px] w-6" style={{ color: "rgba(148,163,184,0.5)" }}>{l.position}</span>
                          <span className="font-oswald w-6 text-center" style={{ color: "rgba(148,163,184,0.6)" }}>{l.gp}</span>
                          <span className="font-oswald w-14 text-right" style={{ color: "rgba(15,41,66,0.8)" }}>
                            {l.g}G-{l.a}A—<strong>{l.p}</strong>
                          </span>
                          <span className="font-oswald font-bold w-8 text-right" style={{ color: "#0D9488" }}>{(l.ppg ?? 0).toFixed(2)}</span>
                        </Link>
                      ))}
                    </div>
                  </DashboardCard>
                )}

                {/* Broadcast Hub link */}
                <Link href="/broadcast" className="flex items-center gap-3 p-4 rounded-xl hover:shadow-md transition-all group" style={{ background: "linear-gradient(to right, #0F2942, #1A3F54)", color: "#FFFFFF" }}>
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(230,126,34,0.2)" }}>
                    <Radio size={20} style={{ color: "#E67E22" }} />
                  </div>
                  <div>
                    <p className="text-sm font-oswald font-bold uppercase tracking-wider">Broadcast Hub</p>
                    <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.5)" }}>Game prep, spotting boards, talking points</p>
                  </div>
                  <ChevronRight size={16} className="group-hover:text-teal transition-colors ml-auto" style={{ color: "rgba(255,255,255,0.3)" }} />
                </Link>
              </div>

              <div className="lg:col-span-2 space-y-5">
                <DashboardCard
                  icon={<FileText size={15} style={{ color: "#0F2942" }} />}
                  title="Recent Reports"
                  viewAllHref="/reports"
                  loading={loading}
                  empty={recentReports.length === 0}
                  emptyIcon={<FileText size={24} style={{ color: "rgba(148,163,184,0.3)" }} />}
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
                  <Link href="/reports/generate" className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-oswald font-bold uppercase tracking-wider rounded-lg transition-colors" style={{ background: "#0D9488", color: "#FFFFFF" }} onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(13,148,136,0.9)")} onMouseLeave={(e) => (e.currentTarget.style.background = "#0D9488")}>
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
            {/* 1. Player Summary Card */}
            <FamilyPlayerSpotlight scoringLeaders={scoringLeaders} loading={teamDataLoading} />

            {/* 2. Upcoming Games */}
            <div className="rounded-xl mt-4" style={{ background: "#FFFFFF", border: "1px solid #E2EAF3" }}>
              <div className="px-5 py-3 rounded-t-xl" style={{ borderBottom: "1px solid #E2EAF3", background: "linear-gradient(to right, #0F2942, rgba(15,41,66,0.9))" }}>
                <div className="flex items-center gap-2">
                  <Calendar size={14} style={{ color: "#0D9488" }} />
                  <h3 className="font-oswald text-xs font-bold uppercase tracking-wider" style={{ color: "#FFFFFF" }}>Upcoming Games</h3>
                </div>
              </div>
              <div className="p-4">
                {(() => {
                  const upcoming = scorebar.filter(g => g.status === "Not Started" || g.status === "");
                  if (upcoming.length === 0) {
                    return (
                      <div className="text-center py-6">
                        <Calendar size={28} className="mx-auto mb-2" style={{ color: "rgba(148,163,184,0.3)" }} />
                        <p className="text-sm" style={{ color: "#94A3B8" }}>No upcoming games scheduled</p>
                      </div>
                    );
                  }
                  return (
                    <div className="space-y-2">
                      {upcoming.slice(0, 5).map((g) => (
                        <div key={g.game_id} className="flex items-center justify-between p-3 rounded-lg transition-colors" style={{ border: "1px solid #E2EAF3" }} onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(15,41,66,0.02)")} onMouseLeave={(e) => (e.currentTarget.style.background = "")}>
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="text-center shrink-0">
                              <p className="text-[10px] font-oswald uppercase" style={{ color: "#94A3B8" }}>{g.game_date}</p>
                              <p className="text-[10px]" style={{ color: "#94A3B8" }}>{g.time}</p>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold truncate" style={{ color: "#0F2942" }}>{g.away_team} @ {g.home_team}</p>
                              <p className="text-[10px] truncate" style={{ color: "#94A3B8" }}>{g.venue}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* 3. Family Guide Tiles */}
            <div className="mt-4">
              <div className="flex items-center gap-2 mb-3">
                <BookOpen size={14} style={{ color: "#0D9488" }} />
                <h3 className="font-oswald text-xs font-bold uppercase tracking-wider" style={{ color: "#0F2942" }}>Family Guide</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { title: "Nutrition & Recovery", desc: "Meal planning, hydration, sleep, and recovery protocols", icon: Heart, iconBg: "#FEF2F2", iconColor: "#C0392B", href: "/player-guide#nutrition" },
                  { title: "Mental Performance", desc: "Focus, confidence, pre-game routines, and resilience", icon: Sparkles, iconBg: "#F5F3FF", iconColor: "#7C3AED", href: "/player-guide#mental" },
                  { title: "Education & Development", desc: "Balancing school, skill development, and long-term growth", icon: BookOpen, iconBg: "#EFF6FF", iconColor: "#2563EB", href: "/player-guide#education" },
                  { title: "Pathway Planning", desc: "Junior, college, and professional hockey pathways", icon: TrendingUp, iconBg: "#F0FDF4", iconColor: "#16A34A", href: "/player-guide#pathway" },
                ].map((tile) => (
                  <Link key={tile.title} href={tile.href} className="flex items-start gap-3 p-4 rounded-xl hover:shadow-md transition-all group" style={{ background: "#FFFFFF", border: "1px solid #E2EAF3" }}>
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform shrink-0" style={{ background: tile.iconBg }}>
                      <tile.icon size={20} style={{ color: tile.iconColor }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-oswald text-sm font-bold uppercase tracking-wider" style={{ color: "#0F2942" }}>{tile.title}</p>
                      <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>{tile.desc}</p>
                    </div>
                    <ChevronRight size={16} className="group-hover:text-teal transition-colors shrink-0 mt-1" style={{ color: "rgba(148,163,184,0.4)" }} />
                  </Link>
                ))}
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
                icon={<BarChart3 size={15} style={{ color: "#0D9488" }} />}
                title={`${activeTeam?.name || "Team"} Leaders`}
                viewAllHref={activeTeam ? `/teams/${encodeURIComponent(activeTeam.name)}` : "/teams"}
                loading={teamDataLoading}
                empty={false}
              >
                <div className="space-y-1">
                  {scoringLeaders.map((l, i) => (
                    <Link key={`${l.id}-${i}`} href={`/players/${l.id}`} className="flex items-center gap-2 px-2 py-1.5 rounded transition-colors text-xs group" onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(15,41,66,0.02)")} onMouseLeave={(e) => (e.currentTarget.style.background = "")}>
                      <span className="w-4 text-right font-oswald font-bold" style={{ color: "rgba(148,163,184,0.5)" }}>{i + 1}</span>
                      <span className="flex-1 font-medium truncate group-hover:text-teal transition-colors" style={{ color: "#0F2942" }}>
                        {l.first_name} {l.last_name}
                      </span>
                      <span className="font-oswald w-6 text-center" style={{ color: "rgba(148,163,184,0.6)" }}>{l.gp}</span>
                      <span className="font-oswald w-14 text-right" style={{ color: "rgba(15,41,66,0.8)" }}>
                        {l.g}G-{l.a}A—<strong>{l.p}</strong>
                      </span>
                      <span className="font-oswald font-bold w-8 text-right" style={{ color: "#0D9488" }}>{(l.ppg ?? 0).toFixed(2)}</span>
                    </Link>
                  ))}
                  <div className="flex items-center justify-between text-[9px] px-2 pt-1" style={{ color: "rgba(148,163,184,0.4)", borderTop: "1px solid rgba(13,148,136,0.1)" }}>
                    <span>Player</span>
                    <span className="flex gap-3"><span>GP</span><span>G-A—P</span><span>P/G</span></span>
                  </div>
                </div>
              </DashboardCard>
            )}

            {/* Agent Hub Banner */}
            <div className="rounded-xl p-5 mb-4" style={{ background: "linear-gradient(to bottom right, #475569, #334155)", color: "#FFFFFF" }}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "rgba(255,255,255,0.1)" }}>
                  <Briefcase size={20} />
                </div>
                <div>
                  <h3 className="font-oswald text-sm font-bold uppercase tracking-wider">Agent Hub</h3>
                  <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.6)" }}>Client management and reports</p>
                </div>
              </div>
              <Link href="/my-clients" className="inline-flex items-center gap-1.5 text-xs rounded-lg px-3 py-1.5 transition-colors" style={{ background: "rgba(255,255,255,0.1)" }} onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.2)")} onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.1)")}>
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
                  icon={<FileText size={15} style={{ color: "#0F2942" }} />}
                  title="Recent Reports"
                  viewAllHref="/reports"
                  loading={loading}
                  empty={recentReports.length === 0}
                  emptyIcon={<FileText size={24} style={{ color: "rgba(148,163,184,0.3)" }} />}
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
                <Link href="/players" className="flex items-center gap-3 p-4 rounded-xl hover:shadow-md transition-all group" style={{ background: "#FFFFFF", border: "1px solid #E2EAF3" }}>
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform shrink-0" style={{ background: "rgba(13,148,136,0.1)" }}>
                    <Users size={20} style={{ color: "#0D9488" }} />
                  </div>
                  <div>
                    <p className="font-oswald text-sm font-bold uppercase tracking-wider" style={{ color: "#0F2942" }}>Player Database</p>
                    <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>Search, filter, and browse all players</p>
                  </div>
                  <ChevronRight size={16} className="ml-auto group-hover:text-teal transition-colors" style={{ color: "rgba(148,163,184,0.4)" }} />
                </Link>

                {/* Monthly Usage */}
                <div className="rounded-xl p-5" style={{ background: "#FFFFFF", border: "1px solid #E2EAF3" }}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-oswald text-xs font-bold uppercase tracking-wider" style={{ color: "#0F2942" }}>Monthly Usage</h3>
                    <Link href="/billing" className="flex items-center gap-1 text-[10px] font-oswald font-bold uppercase tracking-wider px-2 py-0.5 rounded-full transition-colors" style={{ background: "rgba(13,148,136,0.1)", color: "#0D9488" }} onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(13,148,136,0.2)")} onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(13,148,136,0.1)")}>
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
    <div className="overflow-hidden" style={{ borderRadius: 10, border: "1px solid #DDE6EF" }}>
      {/* Navy header */}
      <div className="flex items-center justify-between" style={{ background: "#0F2942", padding: "10px 16px" }}>
        <div className="flex items-center gap-2">
          {icon}
          <span style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 600, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.7)" }}>
            {title}
          </span>
        </div>
        <Link
          href={viewAllHref}
          className="transition-colors hover:opacity-80"
          style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 600, fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase", color: "#14B8A8" }}
        >
          View All
        </Link>
      </div>
      {/* White body */}
      <div style={{ background: "#FFFFFF", padding: "16px 16px" }}>
        {loading ? (
          <CardSkeleton lines={3} />
        ) : empty ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0" }}>
            {emptyIcon && <span style={{ opacity: 0.3 }}>{emptyIcon}</span>}
            <div>
              {emptyText && <p style={{ fontFamily: "'Source Serif 4', serif", fontSize: 13, color: "#666666" }}>{emptyText}</p>}
              {emptyLink && <Link href={emptyLink} style={{ fontFamily: "'Oswald', sans-serif", fontSize: 11, color: "#0D9488", textDecoration: "none" }} className="hover:underline">{emptyLinkText}</Link>}
            </div>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

// ── Scouting List Section ────────────────────────────────────

function ScoutingListSection({ scoutingList, loading }: { scoutingList: ScoutingListItem[]; loading: boolean }) {
  return (
    <DashboardCard
      icon={<Target size={15} style={{ color: "#E67E22" }} />}
      title="Watchlist"
      viewAllHref="/watchlist"
      loading={loading}
      empty={scoutingList.length === 0}
      emptyIcon={<Target size={24} style={{ color: "rgba(148,163,184,0.3)" }} />}
      emptyText="No players on watchlist"
      emptyLink="/watchlist"
      emptyLinkText="Add a player"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {scoutingList.map((item) => {
          const pxrScore = (item as unknown as Record<string, unknown>).pxr_score as number | null | undefined;
          const isEstimated = (item as unknown as Record<string, unknown>).pxr_estimated as boolean | undefined;
          return (
            <Link key={item.id} href={`/players/${item.player_id}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 8px", borderRadius: 8, textDecoration: "none", transition: "background 0.15s" }} className="hover:bg-[#F8FBFF] group">
              <div style={{ position: "relative", flexShrink: 0 }}>
                {item.image_url ? (
                  <div style={{ width: 34, height: 34, borderRadius: "50%", overflow: "hidden", border: "2px solid #DDE6EF" }}>
                    <img src={assetUrl(item.image_url)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                ) : (
                  <div style={{ width: 34, height: 34, borderRadius: "50%", background: "rgba(15,41,66,0.05)", display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #DDE6EF" }}>
                    <span style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 10, color: "#0F2942", textTransform: "uppercase" }}>{item.position || "?"}</span>
                  </div>
                )}
                <span style={{ position: "absolute", top: -2, right: -2, width: 8, height: 8, borderRadius: "50%", border: "2px solid #FFFFFF", background: item.priority === "high" ? "#C0392B" : item.priority === "medium" ? "#F59E0B" : "#22C55E" }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 600, fontSize: 12, color: "#0F2942", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {item.first_name} {item.last_name}
                </p>
                <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#94A3B8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {[item.current_team, formatLeague(item.current_league)].filter(Boolean).join(" / ") || "No team"}
                </p>
              </div>
              {pxrScore != null && (
                <span style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 16, color: isEstimated ? "#F59E0B" : "#0D9488", flexShrink: 0 }}>
                  {typeof pxrScore === "number" ? pxrScore.toFixed(1) : pxrScore}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </DashboardCard>
  );
}

// ── Top Prospects Section ────────────────────────────────────

function TopProspectsSection({ prospects, loading }: { prospects: TopProspect[]; loading: boolean }) {
  return (
    <DashboardCard
      icon={<Crown size={15} style={{ color: "#E67E22" }} />}
      title="Top Prospects"
      viewAllHref="/top-prospects"
      loading={loading}
      empty={prospects.length === 0}
      emptyIcon={<Crown size={24} style={{ color: "rgba(148,163,184,0.3)" }} />}
      emptyText="PXR scores will populate your Top Prospects automatically."
      emptyLink="/top-prospects"
      emptyLinkText="View PXR Leaderboard"
    >
      <div className="space-y-1">
        {prospects.map((p, i) => (
          <Link key={p.player_id} href={`/players/${p.player_id}`} className="flex items-center gap-2 px-2 py-1.5 rounded transition-colors text-xs group" onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(15,41,66,0.02)")} onMouseLeave={(e) => (e.currentTarget.style.background = "")}>
            <span className="w-4 text-right font-oswald font-bold" style={{ color: "#94A3B8" }}>{i + 1}</span>
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-oswald font-bold uppercase shrink-0" style={{ backgroundColor: "rgba(15,42,61,0.05)", color: "#0F2A3D" }}>
              {p.position || "?"}
            </div>
            <div className="flex-1 min-w-0">
              <span className="font-medium truncate group-hover:text-teal transition-colors" style={{ color: "#0F2A3D" }}>
                {p.first_name} {p.last_name}
              </span>
            </div>
            <span className="text-[10px] truncate max-w-[80px]" style={{ color: "#94A3B8" }}>{p.current_team || ""}</span>
            <span className="inline-flex items-center justify-center w-8 h-5 rounded text-[10px] font-oswald font-bold shrink-0" style={{ backgroundColor: "rgba(243,111,33,0.1)", color: "#F36F21" }}>
              {p.pxr_score != null ? p.pxr_score.toFixed(1) : "—"}
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
  const scrollRef = useRef<HTMLDivElement>(null);
  // Show games sorted by date, most recent / live first
  const sorted = [...scorebar].sort((a, b) => new Date(a.game_date || a.date).getTime() - new Date(b.game_date || b.date).getTime());

  function scrollBy(dir: number) {
    scrollRef.current?.scrollBy({ left: dir * 320, behavior: "smooth" });
  }

  return (
    <div className="rounded-xl p-4" style={{ background: "#FFFFFF", border: "1px solid rgba(230,126,34,0.25)" }}>
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-[10px] font-oswald font-bold uppercase tracking-wider" style={{ color: "#94A3B8" }}>League Scores</h3>
        {onLeagueChange && (
          <select
            value={scorebarLeague || ""}
            onChange={(e) => onLeagueChange(e.target.value)}
            className="ml-auto text-[10px] font-oswald uppercase tracking-wider rounded px-2 py-0.5 cursor-pointer"
            style={{ background: "#FFFFFF", border: "1px solid #E2EAF3", color: "#0F2942" }}
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
      <div className="relative">
        <button
          onClick={() => scrollBy(-1)}
          className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 z-10 w-7 h-7 rounded-full shadow-md flex items-center justify-center transition-colors"
          style={{ background: "#FFFFFF", border: "1px solid #E2EAF3", color: "rgba(15,41,66,0.6)" }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "#0F2942"; e.currentTarget.style.borderColor = "rgba(13,148,136,0.3)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(15,41,66,0.6)"; e.currentTarget.style.borderColor = "#E2EAF3"; }}
          aria-label="Scroll left"
        >
          <ChevronLeft size={16} />
        </button>
        <div ref={scrollRef} className="flex gap-3 overflow-x-auto pb-1 scrollbar-thin scroll-smooth">
          {sorted.map((g) => {
            const isOurGame = g.home_team.toLowerCase().includes(lower) || g.away_team.toLowerCase().includes(lower) ||
                              lower.includes(g.home_team.toLowerCase()) || lower.includes(g.away_team.toLowerCase());
            return (
              <div
                key={g.game_id}
                className="shrink-0 w-40 rounded-lg p-2.5 text-center text-xs"
                style={{ border: isOurGame ? "1px solid #0D9488" : "1px solid #E2EAF3", background: isOurGame ? "rgba(13,148,136,0.03)" : undefined }}
              >
                <p className="text-[9px] mb-1" style={{ color: "rgba(148,163,184,0.6)" }}>
                  {new Date(g.game_date || g.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  {g.time && ` · ${g.time}`}
                </p>
                <div className="flex items-center justify-between gap-1">
                  <span className="font-oswald text-[11px] truncate flex-1 text-left" style={{ color: "#0F2942" }}>{g.home_team}</span>
                  <span className="font-oswald font-bold text-sm" style={{ color: "#0F2942" }}>{g.home_score ?? "-"}</span>
                </div>
                <div className="flex items-center justify-between gap-1">
                  <span className="font-oswald text-[11px] truncate flex-1 text-left" style={{ color: "#0F2942" }}>{g.away_team}</span>
                  <span className="font-oswald font-bold text-sm" style={{ color: "#0F2942" }}>{g.away_score ?? "-"}</span>
                </div>
                <p className="text-[9px] font-oswald uppercase tracking-wider mt-1" style={{ color: g.status === "Final" || g.status === "final" ? "rgba(148,163,184,0.5)" : "#1E6B3C", fontWeight: g.status !== "Final" && g.status !== "final" ? 700 : undefined }}>
                  {g.status || "Scheduled"}
                </p>
              </div>
            );
          })}
        </div>
        <button
          onClick={() => scrollBy(1)}
          className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 z-10 w-7 h-7 rounded-full shadow-md flex items-center justify-center transition-colors"
          style={{ background: "#FFFFFF", border: "1px solid #E2EAF3", color: "rgba(15,41,66,0.6)" }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "#0F2942"; e.currentTarget.style.borderColor = "rgba(13,148,136,0.3)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(15,41,66,0.6)"; e.currentTarget.style.borderColor = "#E2EAF3"; }}
          aria-label="Scroll right"
        >
          <ChevronRight size={16} />
        </button>
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
    return <div className="rounded-xl p-5 animate-pulse" style={{ background: "#FFFFFF", border: "1px solid #E2EAF3" }}><div className="h-16 rounded-lg" style={{ background: "rgba(15,41,66,0.05)" }} /></div>;
  }

  if (!myPlayer) {
    return (
      <div className="rounded-xl p-6 text-center" style={{ background: "linear-gradient(to right, rgba(15,41,66,0.02), rgba(13,148,136,0.02))", border: "1px dashed rgba(13,148,136,0.3)" }}>
        <Heart size={28} className="mx-auto mb-2" style={{ color: "rgba(13,148,136,0.4)" }} />
        <p className="text-sm font-semibold mb-1" style={{ color: "#0F2942" }}>Select Your Player</p>
        <p className="text-xs mb-3" style={{ color: "#94A3B8" }}>Set up your player profile to see their stats and development here.</p>
        <Link href="/my-player" className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-oswald uppercase tracking-wider rounded-lg transition-colors" style={{ background: "#0D9488", color: "#FFFFFF" }} onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(13,148,136,0.9)")} onMouseLeave={(e) => (e.currentTarget.style.background = "#0D9488")}>
          <Users size={14} /> Choose Player
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-xl p-5" style={{ background: "#FFFFFF", border: "1px solid #E2EAF3" }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ background: "rgba(13,148,136,0.1)" }}>
            <span className="font-oswald font-bold text-lg" style={{ color: "#0D9488" }}>{myPlayer.position}</span>
          </div>
          <div>
            <h3 className="text-lg font-oswald font-bold" style={{ color: "#0F2942" }}>{myPlayer.first_name} {myPlayer.last_name}</h3>
            <p className="text-xs" style={{ color: "#94A3B8" }}>{myPlayer.current_team} · {myPlayer.position}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-center">
          <div>
            <p className="text-lg font-oswald font-bold" style={{ color: "#0F2942" }}>{myPlayer.gp}</p>
            <p className="text-[9px] uppercase" style={{ color: "#94A3B8" }}>GP</p>
          </div>
          <div>
            <p className="text-lg font-oswald font-bold" style={{ color: "#0F2942" }}>{myPlayer.g}</p>
            <p className="text-[9px] uppercase" style={{ color: "#94A3B8" }}>G</p>
          </div>
          <div>
            <p className="text-lg font-oswald font-bold" style={{ color: "#0F2942" }}>{myPlayer.a}</p>
            <p className="text-[9px] uppercase" style={{ color: "#94A3B8" }}>A</p>
          </div>
          <div>
            <p className="text-lg font-oswald font-bold" style={{ color: "#0D9488" }}>{myPlayer.p}</p>
            <p className="text-[9px] uppercase" style={{ color: "#94A3B8" }}>PTS</p>
          </div>
          <div>
            <p className="text-lg font-oswald font-bold" style={{ color: "#E67E22" }}>{(myPlayer.ppg ?? 0).toFixed(2)}</p>
            <p className="text-[9px] uppercase" style={{ color: "#94A3B8" }}>P/G</p>
          </div>
        </div>
      </div>
    </div>
  );
}
