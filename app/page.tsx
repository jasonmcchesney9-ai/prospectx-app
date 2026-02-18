"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Swords, Users, Target, Zap, FileText, Crown, Trophy, ChevronRight,
  AlertTriangle, Calendar, Radio, Heart, Briefcase, MessageSquare, BookOpen,
} from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import LandingPage from "@/components/LandingPage";
import ReportCard from "@/components/ReportCard";
import BenchTalkUsage from "@/components/BenchTalkUsage";
import TeamContextBar, { getHTLeague } from "@/components/TeamContextBar";
import { useBenchTalk } from "@/components/BenchTalkProvider";
import api from "@/lib/api";
import { getUser, isAuthenticated } from "@/lib/auth";
import type {
  Team, Player, Report, GamePlan, SeriesPlan, ScoutingListItem,
  ScoringLeader, HTGame, HTStandings, PracticePlan,
} from "@/types/api";
import { SESSION_TYPES } from "@/types/api";

const DASHBOARD_TEAM_KEY = "prospectx_dashboard_team";
type RoleGroup = "PRO" | "MEDIA" | "FAMILY" | "AGENT";

function getRoleGroup(hockey_role: string): RoleGroup {
  switch (hockey_role) {
    case "broadcaster": case "producer": return "MEDIA";
    case "player": case "parent": return "FAMILY";
    case "agent": return "AGENT";
    default: return "PRO";
  }
}

const SESSION_TYPE_MAP: Record<string, string> = Object.fromEntries(SESSION_TYPES.map((s) => [s.value, s.label]));
const SESSION_BADGE_COLORS: Record<string, string> = { pre_game: "bg-teal/10 text-teal", post_game: "bg-orange/10 text-orange", practice: "bg-blue-50 text-blue-600", season_notes: "bg-navy/5 text-navy/70" };
const PRIORITY_DOT: Record<string, string> = { high: "bg-red-500", medium: "bg-amber-400", low: "bg-green-500" };
const FORMAT_LABELS: Record<string, string> = { best_of_3: "Bo3", best_of_5: "Bo5", best_of_7: "Bo7", round_robin: "RR", single_elim: "SE" };
const ROSTER_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  inj: { label: "INJ", color: "text-red-700", bg: "bg-red-50 border-red-200" },
  susp: { label: "SUSP", color: "text-yellow-700", bg: "bg-yellow-50 border-yellow-200" },
  ap: { label: "AP", color: "text-blue-700", bg: "bg-blue-50 border-blue-200" },
  scrch: { label: "SCRCH", color: "text-gray-600", bg: "bg-gray-50 border-gray-200" },
};

function matchTeam(name: string, teamName: string): boolean {
  const a = name.toLowerCase().trim();
  const b = teamName.toLowerCase().trim();
  return a === b || a.includes(b) || b.includes(a);
}

export default function HomePage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  useEffect(() => { setAuthed(isAuthenticated()); }, []);
  if (authed === null) return <div className="min-h-screen bg-navy flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-2 border-navy border-t-teal" /></div>;
  if (!authed) return <LandingPage />;
  return <ProtectedRoute><Dashboard /></ProtectedRoute>;
}

function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="bg-white rounded-xl border border-border p-5 animate-pulse">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className={`h-3 bg-navy/5 rounded ${i === 0 ? "w-2/3 mb-3" : i === lines - 1 ? "w-1/2 mt-2" : "w-full mt-2"}`} />
      ))}
    </div>
  );
}

function SectionCard({ icon, title, link, linkLabel, children }: { icon: React.ReactNode; title: string; link?: string; linkLabel?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-border p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">{icon}<h3 className="font-oswald text-xs font-bold text-navy uppercase tracking-wider">{title}</h3></div>
        {link && linkLabel && <Link href={link} className="text-[10px] font-oswald text-teal uppercase tracking-wider hover:underline font-medium">{linkLabel}</Link>}
      </div>
      {children}
    </div>
  );
}

function EmptyState({ icon, text, link, linkText }: { icon: React.ReactNode; text: string; link?: string; linkText?: string }) {
  return (
    <div className="text-center py-6">
      <div className="mx-auto text-muted/30 mb-2 flex justify-center">{icon}</div>
      <p className="text-muted text-sm">{text}</p>
      {link && linkText && <Link href={link} className="inline-block mt-2 text-xs text-teal hover:underline">{linkText}</Link>}
    </div>
  );
}

function Dashboard() {
  const user = getUser();
  const roleGroup = getRoleGroup(user?.hockey_role || "scout");
  const { openBenchTalk } = useBenchTalk();

  const [teams, setTeams] = useState<Team[]>([]);
  const [activeTeam, setActiveTeam] = useState<Team | null>(null);
  const [roster, setRoster] = useState<Player[]>([]);
  const [recentReports, setRecentReports] = useState<Report[]>([]);
  const [activeSeries, setActiveSeries] = useState<SeriesPlan[]>([]);
  const [activeGamePlans, setActiveGamePlans] = useState<GamePlan[]>([]);
  const [scoutingList, setScoutingList] = useState<ScoutingListItem[]>([]);
  const [scoringLeaders, setScoringLeaders] = useState<ScoringLeader[]>([]);
  const [scorebar, setScorebar] = useState<HTGame[]>([]);
  const [standings, setStandings] = useState<HTStandings[]>([]);
  const [practicePlans, setPracticePlans] = useState<PracticePlan[]>([]);
  const [loadingWave1, setLoadingWave1] = useState(true);
  const [loadingWave2, setLoadingWave2] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadWave1() {
      const results = await Promise.allSettled([
        api.get<Team[]>("/teams"), api.get<Report[]>("/reports?limit=5"),
        api.get<ScoutingListItem[]>("/scouting-list?limit=5"), api.get<GamePlan[]>("/game-plans?status=active"),
        api.get<SeriesPlan[]>("/series?status=active"), api.get<PracticePlan[]>("/practice-plans?limit=5"),
      ]);
      if (results[0].status === "fulfilled") {
        const tl = results[0].value.data; setTeams(tl);
        const savedId = typeof window !== "undefined" ? localStorage.getItem(DASHBOARD_TEAM_KEY) : null;
        setActiveTeam((savedId ? tl.find((t: Team) => t.id === savedId) : null) || tl[0] || null);
      } else { const e = results[0].reason; setError(e?.response?.data?.detail || e?.message || "Failed to connect"); }
      if (results[1].status === "fulfilled") setRecentReports(results[1].value.data);
      if (results[2].status === "fulfilled") setScoutingList(results[2].value.data);
      if (results[3].status === "fulfilled") setActiveGamePlans(results[3].value.data);
      if (results[4].status === "fulfilled") setActiveSeries(results[4].value.data);
      if (results[5].status === "fulfilled") setPracticePlans(results[5].value.data);
      setLoadingWave1(false);
    }
    loadWave1();
  }, []);

  useEffect(() => {
    if (!activeTeam) return;
    setLoadingWave2(true);
    async function loadWave2() {
      if (!activeTeam) return;
      const htL = getHTLeague(activeTeam.league);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fetches: Promise<any>[] = [
        api.get(`/teams/${encodeURIComponent(activeTeam.name)}/roster`),
        api.get(`/analytics/scoring-leaders?team=${encodeURIComponent(activeTeam.name)}&limit=5`),
      ];
      if (htL) { fetches.push(api.get(`/hockeytech/${htL}/scorebar?days_back=3&days_ahead=7`), api.get(`/hockeytech/${htL}/standings`)); }
      const r = await Promise.allSettled(fetches);
      if (r[0].status === "fulfilled") setRoster(r[0].value.data);
      if (r[1].status === "fulfilled") setScoringLeaders(r[1].value.data);
      if (htL) {
        if (r[2]?.status === "fulfilled") setScorebar(r[2].value.data); else setScorebar([]);
        if (r[3]?.status === "fulfilled") setStandings(r[3].value.data); else setStandings([]);
      } else { setScorebar([]); setStandings([]); }
      setLoadingWave2(false);
    }
    loadWave2();
  }, [activeTeam]);

  const handleTeamChange = useCallback((team: Team) => { setActiveTeam(team); localStorage.setItem(DASHBOARD_TEAM_KEY, team.id); }, []);

  const alertPlayers = roster.filter((p) => p.roster_status && p.roster_status !== "active");
  const today = new Date().toISOString().slice(0, 10);
  const todaysPractice = practicePlans.find((pp) => pp.practice_date === today && (!pp.team_name || !activeTeam || matchTeam(pp.team_name, activeTeam.name)));

  const nextGame = activeTeam ? scorebar.filter((g) => !(g.status || "").toLowerCase().includes("final")).filter((g) => matchTeam(g.home_team, activeTeam.name) || matchTeam(g.away_team, activeTeam.name)).sort((a, b) => new Date(a.game_date || a.date).getTime() - new Date(b.game_date || b.date).getTime())[0] || null : null;
  const upcomingGames = activeTeam ? scorebar.filter((g) => !(g.status || "").toLowerCase().includes("final")).filter((g) => matchTeam(g.home_team, activeTeam.name) || matchTeam(g.away_team, activeTeam.name)).sort((a, b) => new Date(a.game_date || a.date).getTime() - new Date(b.game_date || b.date).getTime()).slice(0, 3) : [];
  const nextGamePlan = nextGame && activeTeam ? activeGamePlans.find((gp) => { const isH = matchTeam(nextGame.home_team, activeTeam.name); return matchTeam(gp.opponent_team_name, isH ? nextGame.away_team : nextGame.home_team); }) : null;

  const scoutingWithGames = scoutingList.map((item) => {
    const hasGame = scorebar.some((g) => { const gd = new Date(g.game_date || g.date).toISOString().slice(0, 10); const ok = gd === today || !(g.status || "").toLowerCase().includes("final"); return ok && item.current_team ? (matchTeam(g.home_team, item.current_team) || matchTeam(g.away_team, item.current_team)) : false; });
    return { ...item, playsTonight: hasGame };
  });
  const scoutPlayersTonight = scoutingWithGames.filter((s) => s.playsTonight);

  return (
    <>
      <NavBar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-3">
            <span className="text-red-500 mt-0.5">!</span>
            <div><p className="text-red-700 font-medium text-sm">Backend Connection Error</p><p className="text-red-600 text-xs mt-0.5">{error}</p></div>
          </div>
        )}

        <TeamContextBar teams={teams} activeTeam={activeTeam} onTeamChange={handleTeamChange} standings={standings} scorebar={scorebar} gamePlans={activeGamePlans} loading={loadingWave1} />

        {alertPlayers.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4 flex items-center gap-3 flex-wrap">
            <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center shrink-0"><AlertTriangle size={16} className="text-red-500" /></div>
            <div className="flex-1 min-w-0">
              <p className="font-oswald text-xs font-semibold text-red-800 uppercase tracking-wider">{alertPlayers.length} Player{alertPlayers.length > 1 ? "s" : ""} — Non-Active Status</p>
              <div className="flex gap-2 mt-1.5 flex-wrap">
                {alertPlayers.map((p) => { const cfg = ROSTER_STATUS_CONFIG[p.roster_status] || ROSTER_STATUS_CONFIG.inj; return (
                  <Link key={p.id} href={`/players/${p.id}`} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs bg-white hover:shadow-sm transition-shadow ${cfg.bg}`}>
                    {p.first_name} {p.last_name} <span className={`font-oswald text-[9px] font-bold uppercase tracking-wider ${cfg.color}`}>{cfg.label}</span>
                  </Link>
                ); })}
              </div>
            </div>
          </div>
        )}

        {roleGroup === "PRO" && (nextGamePlan || todaysPractice || scoutPlayersTonight.length > 0) && (
          <div className="mb-4">
            <p className="font-oswald text-[10px] text-muted uppercase tracking-widest mb-2 pl-0.5">Today&apos;s Focus</p>
            <div className="bg-gradient-to-br from-navy to-navy-light rounded-xl p-4 flex gap-3 flex-wrap">
              {nextGamePlan && nextGame && (
                <Link href={`/game-plans/${nextGamePlan.id}`} className="flex-1 min-w-[200px] bg-white/[0.08] border border-white/10 rounded-lg p-3.5 hover:bg-white/[0.12] transition-colors">
                  <p className="font-oswald text-[10px] text-teal uppercase tracking-widest mb-1">Next Game</p>
                  <p className="font-oswald text-sm font-semibold text-white">{nextGamePlan.team_name} vs {nextGamePlan.opponent_team_name}</p>
                  <p className="text-[11px] text-white/50 mt-1">{nextGamePlan.game_date ? new Date(nextGamePlan.game_date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : ""}</p>
                  <span className="inline-block mt-2 font-oswald text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-teal/20 text-teal">{SESSION_TYPE_MAP[nextGamePlan.session_type] || "Game Plan"}</span>
                </Link>
              )}
              {todaysPractice && (
                <Link href={`/practice-plans/${todaysPractice.id}`} className="flex-1 min-w-[200px] bg-white/[0.08] border border-white/10 rounded-lg p-3.5 hover:bg-white/[0.12] transition-colors">
                  <p className="font-oswald text-[10px] text-teal uppercase tracking-widest mb-1">Today&apos;s Practice</p>
                  <p className="font-oswald text-sm font-semibold text-white">{todaysPractice.title}</p>
                  <p className="text-[11px] text-white/50 mt-1">{todaysPractice.duration_minutes} min{todaysPractice.focus_areas?.length > 0 && ` \u00b7 ${todaysPractice.focus_areas.join(", ")}`}</p>
                  <span className="inline-block mt-2 font-oswald text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300">Practice Plan</span>
                </Link>
              )}
              {scoutPlayersTonight.length > 0 && (
                <Link href="/scouting" className="flex-1 min-w-[200px] bg-white/[0.08] border border-white/10 rounded-lg p-3.5 hover:bg-white/[0.12] transition-colors">
                  <p className="font-oswald text-[10px] text-teal uppercase tracking-widest mb-1">Scout Watch Tonight</p>
                  <p className="font-oswald text-sm font-semibold text-white">{scoutPlayersTonight.length} player{scoutPlayersTonight.length > 1 ? "s" : ""} in action</p>
                  <p className="text-[11px] text-white/50 mt-1">{scoutPlayersTonight.slice(0, 3).map((s) => `${s.first_name} ${s.last_name}`).join(" \u00b7 ")}</p>
                  <span className="inline-block mt-2 font-oswald text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-teal/20 text-teal">Live Games</span>
                </Link>
              )}
            </div>
          </div>
        )}

        {upcomingGames.length > 0 && activeTeam && (
          <div className="bg-white rounded-xl border border-border p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2"><Calendar size={14} className="text-navy/60" /><h3 className="font-oswald text-xs font-bold text-navy uppercase tracking-wider">Upcoming Games</h3></div>
              <Link href="/schedule" className="text-[10px] font-oswald text-teal uppercase tracking-wider hover:underline">Full Schedule</Link>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {upcomingGames.map((g, i) => { const isH = matchTeam(g.home_team, activeTeam.name); const opp = isH ? g.away_team : g.home_team; const ds = new Date(g.game_date || g.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }); const hasGP = activeGamePlans.some((gp) => matchTeam(gp.opponent_team_name, opp)); return (
                <div key={`ug-${g.game_id}-${i}`} className="flex-1 min-w-[150px] border border-border rounded-lg p-3 text-center relative">
                  <div className={`absolute top-2 right-2 w-2 h-2 rounded-full ${hasGP ? "bg-green-500" : "bg-red-400"}`} title={hasGP ? "Game plan ready" : "No game plan"} />
                  <p className="font-oswald text-[10px] text-muted uppercase tracking-wider mb-1">{ds}</p>
                  <p className="font-oswald text-sm font-semibold text-navy">{isH ? "vs" : "@"} {opp}</p>
                  {g.venue && <p className="text-[10px] text-muted mt-1 truncate">{g.venue}</p>}
                </div>
              ); })}
            </div>
          </div>
        )}

        {roleGroup === "PRO" && <ProView activeSeries={activeSeries} activeGamePlans={activeGamePlans} scoutingList={scoutingWithGames} scoringLeaders={scoringLeaders} recentReports={recentReports} lw1={loadingWave1} lw2={loadingWave2} onBT={openBenchTalk} />}
        {roleGroup === "MEDIA" && <MediaView scoringLeaders={scoringLeaders} recentReports={recentReports} lw1={loadingWave1} lw2={loadingWave2} />}
        {roleGroup === "FAMILY" && <FamilyView recentReports={recentReports} lw1={loadingWave1} user={user} onBT={openBenchTalk} />}
        {roleGroup === "AGENT" && <AgentView recentReports={recentReports} scoutingList={scoutingWithGames} lw1={loadingWave1} user={user} onBT={openBenchTalk} />}

        {scorebar.length > 0 && activeTeam && (
          <div className="mt-4">
            <p className="font-oswald text-[10px] text-muted uppercase tracking-widest mb-2 pl-0.5">{activeTeam.league || "League"} Scorebar</p>
            <div className="bg-navy rounded-xl p-3.5 flex gap-2.5 overflow-x-auto">
              {scorebar.slice(0, 8).map((g, i) => { const fin = (g.status || "").toLowerCase().includes("final"); const myG = matchTeam(g.home_team, activeTeam.name) || matchTeam(g.away_team, activeTeam.name); return (
                <div key={`sb-${g.game_id}-${i}`} className={`min-w-[150px] rounded-lg p-2.5 text-center shrink-0 border ${myG ? "bg-teal/[0.08] border-teal/30" : "bg-white/[0.06] border-white/[0.08]"}`}>
                  <p className="font-oswald text-[9px] text-white/40 uppercase tracking-wider mb-1.5">{new Date(g.game_date || g.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}{!fin && g.time ? ` \u00b7 ${g.time}` : ""}</p>
                  <div className="flex items-center justify-center gap-2">
                    <span className={`font-oswald text-xs font-semibold ${fin && parseInt(g.away_score) > parseInt(g.home_score) ? "text-white" : "text-white/70"}`}>{g.away_code || g.away_team?.slice(0, 3).toUpperCase()}</span>
                    <span className="font-oswald text-[10px] text-white/40">{fin ? `${g.away_score} \u2014 ${g.home_score}` : "vs"}</span>
                    <span className={`font-oswald text-xs font-semibold ${fin && parseInt(g.home_score) > parseInt(g.away_score) ? "text-white" : "text-white/70"}`}>{g.home_code || g.home_team?.slice(0, 3).toUpperCase()}</span>
                  </div>
                  <p className={`font-oswald text-[9px] uppercase tracking-wider mt-1 ${fin ? "text-white/30" : "text-teal"}`}>{fin ? g.status : "Upcoming"}</p>
                </div>
              ); })}
            </div>
          </div>
        )}
      </main>
    </>
  );
}


// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ProView({ activeSeries, activeGamePlans, scoutingList, scoringLeaders, recentReports, lw1, lw2, onBT }: any) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
      <div className="lg:col-span-3 space-y-4">
        <SectionCard icon={<Trophy size={14} className="text-orange" />} title="Active Series" link="/series" linkLabel="View all">
          {lw1 ? <CardSkeleton lines={2} /> : activeSeries.length === 0 ? <EmptyState icon={<Trophy size={28} />} text="No active series" link="/series/new" linkText="Start a series" /> : (
            <div className="space-y-2">{activeSeries.map((s: SeriesPlan) => (
              <Link key={s.id} href={`/series/${s.id}`} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-navy/[0.02] transition-colors group">
                <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-navy truncate">{s.team_name} <span className="text-muted font-normal">vs</span> {s.opponent_team_name}</p>{s.series_name && <p className="text-[10px] text-muted truncate mt-0.5">{s.series_name}</p>}</div>
                <div className="flex items-center gap-2 shrink-0 ml-3"><span className="text-sm font-oswald font-bold text-navy">{s.current_score || "0-0"}</span><span className="text-[10px] font-oswald uppercase tracking-wider px-1.5 py-0.5 rounded bg-navy/5 text-navy/60">{FORMAT_LABELS[s.series_format] || s.series_format}</span><ChevronRight size={14} className="text-muted/40 group-hover:text-teal transition-colors" /></div>
              </Link>
            ))}</div>
          )}
        </SectionCard>

        <SectionCard icon={<Swords size={14} className="text-teal" />} title="Chalk Talk Sessions" link="/game-plans" linkLabel="View all">
          {lw1 ? <div className="space-y-2"><CardSkeleton lines={2} /><CardSkeleton lines={2} /></div> : activeGamePlans.length === 0 ? <EmptyState icon={<Swords size={28} />} text="No active sessions" link="/game-plans/new" linkText="Create a session" /> : (
            <div className="space-y-2">{activeGamePlans.slice(0, 3).map((gp: GamePlan) => (
              <Link key={gp.id} href={`/game-plans/${gp.id}`} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-navy/[0.02] transition-colors group">
                <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-navy truncate">{gp.team_name} <span className="text-muted font-normal">vs</span> {gp.opponent_team_name}</p>
                <div className="flex items-center gap-2 mt-1"><span className={`text-[10px] font-oswald uppercase tracking-wider px-1.5 py-0.5 rounded ${SESSION_BADGE_COLORS[gp.session_type] || "bg-navy/5 text-navy/60"}`}>{SESSION_TYPE_MAP[gp.session_type] || gp.session_type}</span>{gp.game_date && <span className="text-[10px] text-muted">{new Date(gp.game_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>}</div></div>
                <ChevronRight size={14} className="text-muted/40 group-hover:text-teal transition-colors shrink-0 ml-2" />
              </Link>
            ))}</div>
          )}
        </SectionCard>

        <div className="flex gap-2">
          <Link href="/reports/generate" className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-gradient-to-br from-navy to-navy-light text-white font-oswald text-[11px] font-semibold uppercase tracking-wider hover:opacity-90 transition-opacity"><Zap size={14} /> New Report</Link>
          <Link href="/game-plans/new" className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-teal text-white font-oswald text-[11px] font-semibold uppercase tracking-wider hover:opacity-90 transition-opacity"><Swords size={14} /> Chalk Talk</Link>
          <button onClick={onBT} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-bg border border-border text-navy font-oswald text-[11px] font-semibold uppercase tracking-wider hover:bg-navy/[0.03] transition-colors"><MessageSquare size={14} /> Bench Talk</button>
        </div>
      </div>

      <div className="lg:col-span-2 space-y-4">
        <SectionCard icon={<Target size={14} className="text-orange" />} title="Scouting List" link="/scouting" linkLabel="View all">
          {lw1 ? <div className="space-y-3">{[1,2,3].map((i) => <div key={i} className="animate-pulse flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-navy/5" /><div className="flex-1"><div className="h-3 bg-navy/5 rounded w-2/3 mb-1.5" /><div className="h-2 bg-navy/5 rounded w-1/3" /></div></div>)}</div> : scoutingList.length === 0 ? <EmptyState icon={<Target size={28} />} text="No players on scouting list" link="/scouting" linkText="Add a player" /> : (
            <div className="space-y-1">{scoutingList.map((item: ScoutingListItem & { playsTonight: boolean }) => (
              <Link key={item.id} href={`/players/${item.player_id}`} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-navy/[0.02] transition-colors group">
                <div className="relative shrink-0"><div className="w-8 h-8 rounded-full bg-navy/5 flex items-center justify-center text-[10px] font-oswald font-bold text-navy uppercase">{item.position || "?"}</div><span className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${PRIORITY_DOT[item.priority] || "bg-gray-400"}`} /></div>
                <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-navy truncate group-hover:text-teal transition-colors">{item.first_name} {item.last_name}</p><p className="text-[10px] text-muted truncate">{[item.current_team, item.current_league].filter(Boolean).join(" / ") || "No team"}</p></div>
                {item.playsTonight && <span className="font-oswald text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-teal/10 text-teal shrink-0">Tonight</span>}
                {item.position && <span className="text-[10px] font-oswald uppercase tracking-wider px-1.5 py-0.5 rounded bg-navy/5 text-navy/60 shrink-0">{item.position}</span>}
              </Link>
            ))}</div>
          )}
        </SectionCard>

        <SectionCard icon={<Users size={14} className="text-teal" />} title="Team Leaders" link="/analytics" linkLabel="Analytics">
          {lw2 ? <CardSkeleton lines={5} /> : scoringLeaders.length === 0 ? <EmptyState icon={<Users size={28} />} text="No scoring data yet" /> : (
            <table className="w-full text-xs"><thead><tr className="border-b border-border">
              <th className="font-oswald text-[10px] font-semibold text-muted uppercase tracking-wider text-left py-1.5 px-1 w-5">#</th>
              <th className="font-oswald text-[10px] font-semibold text-muted uppercase tracking-wider text-left py-1.5 px-1">Player</th>
              <th className="font-oswald text-[10px] font-semibold text-muted uppercase tracking-wider text-right py-1.5 px-1">GP</th>
              <th className="font-oswald text-[10px] font-semibold text-muted uppercase tracking-wider text-right py-1.5 px-1">G</th>
              <th className="font-oswald text-[10px] font-semibold text-muted uppercase tracking-wider text-right py-1.5 px-1">A</th>
              <th className="font-oswald text-[10px] font-semibold text-muted uppercase tracking-wider text-right py-1.5 px-1">P</th>
              <th className="font-oswald text-[10px] font-semibold text-muted uppercase tracking-wider text-right py-1.5 px-1">P/G</th>
            </tr></thead><tbody>{scoringLeaders.map((pl: ScoringLeader, i: number) => (
              <tr key={pl.id} className="border-b border-border/50 last:border-0">
                <td className="py-2 px-1 font-oswald font-semibold text-muted text-[11px]">{i + 1}</td>
                <td className="py-2 px-1"><Link href={`/players/${pl.id}`} className="font-semibold text-navy hover:text-teal transition-colors">{pl.first_name?.charAt(0)}. {pl.last_name}</Link></td>
                <td className="py-2 px-1 text-right font-oswald">{pl.gp}</td><td className="py-2 px-1 text-right font-oswald">{pl.g}</td>
                <td className="py-2 px-1 text-right font-oswald">{pl.a}</td><td className="py-2 px-1 text-right font-oswald font-bold text-navy">{pl.p}</td>
                <td className="py-2 px-1 text-right font-oswald">{pl.ppg?.toFixed(2)}</td>
              </tr>
            ))}</tbody></table>
          )}
        </SectionCard>

        <SectionCard icon={<FileText size={14} className="text-navy/60" />} title="Recent Reports" link="/reports" linkLabel="View all">
          {lw1 ? <div className="space-y-2">{[1,2,3].map((i) => <div key={i} className="animate-pulse flex items-center gap-3 p-2"><div className="w-9 h-9 rounded-lg bg-navy/5" /><div className="flex-1"><div className="h-3 bg-navy/5 rounded w-3/4 mb-1.5" /><div className="h-2 bg-navy/5 rounded w-1/2" /></div></div>)}</div> : recentReports.length === 0 ? <EmptyState icon={<FileText size={28} />} text="No reports yet" link="/reports/generate" linkText="Generate your first report" /> : (
            <div className="space-y-2">{recentReports.slice(0, 3).map((r: Report) => <ReportCard key={r.id} report={r} />)}</div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function MediaView({ scoringLeaders, recentReports, lw1, lw2 }: any) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
      <div className="lg:col-span-3 space-y-4">
        <SectionCard icon={<Users size={14} className="text-teal" />} title="Scoring Leaders" link="/analytics" linkLabel="Full Analytics">
          {lw2 ? <CardSkeleton lines={5} /> : scoringLeaders.length === 0 ? <EmptyState icon={<Users size={28} />} text="No scoring data" /> : (
            <table className="w-full text-xs"><thead><tr className="border-b border-border">
              <th className="font-oswald text-[10px] font-semibold text-muted uppercase tracking-wider text-left py-1.5 px-1 w-5">#</th>
              <th className="font-oswald text-[10px] font-semibold text-muted uppercase tracking-wider text-left py-1.5 px-1">Player</th>
              <th className="font-oswald text-[10px] font-semibold text-muted uppercase tracking-wider text-right py-1.5 px-1">GP</th>
              <th className="font-oswald text-[10px] font-semibold text-muted uppercase tracking-wider text-right py-1.5 px-1">G</th>
              <th className="font-oswald text-[10px] font-semibold text-muted uppercase tracking-wider text-right py-1.5 px-1">A</th>
              <th className="font-oswald text-[10px] font-semibold text-muted uppercase tracking-wider text-right py-1.5 px-1">P</th>
            </tr></thead><tbody>{scoringLeaders.slice(0, 10).map((pl: ScoringLeader, i: number) => (
              <tr key={pl.id} className="border-b border-border/50 last:border-0">
                <td className="py-2 px-1 font-oswald font-semibold text-muted text-[11px]">{i + 1}</td>
                <td className="py-2 px-1 font-semibold text-navy">{pl.first_name?.charAt(0)}. {pl.last_name}</td>
                <td className="py-2 px-1 text-right font-oswald">{pl.gp}</td><td className="py-2 px-1 text-right font-oswald">{pl.g}</td>
                <td className="py-2 px-1 text-right font-oswald">{pl.a}</td><td className="py-2 px-1 text-right font-oswald font-bold text-navy">{pl.p}</td>
              </tr>
            ))}</tbody></table>
          )}
        </SectionCard>
        <Link href="/broadcast" className="flex items-center gap-3 p-4 bg-white rounded-xl border border-border hover:shadow-md transition-all group">
          <div className="w-10 h-10 rounded-lg bg-orange/10 flex items-center justify-center group-hover:scale-110 transition-transform"><Radio size={20} className="text-orange" /></div>
          <div><p className="font-oswald text-sm font-bold text-navy uppercase tracking-wider">Broadcast Hub</p><p className="text-xs text-muted mt-0.5">Spotting boards, talk tracks, and graphics</p></div>
          <ChevronRight size={16} className="text-muted/40 ml-auto group-hover:text-teal transition-colors" />
        </Link>
      </div>
      <div className="lg:col-span-2 space-y-4">
        <SectionCard icon={<FileText size={14} className="text-navy/60" />} title="Recent Reports" link="/reports" linkLabel="View all">
          {lw1 ? <CardSkeleton lines={3} /> : recentReports.length === 0 ? <EmptyState icon={<FileText size={28} />} text="No reports yet" /> : (
            <div className="space-y-2">{recentReports.slice(0, 5).map((r: Report) => <ReportCard key={r.id} report={r} />)}</div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function FamilyView({ recentReports, lw1, user, onBT }: any) {
  const myPId = typeof window !== "undefined" ? localStorage.getItem("prospectx_my_player_id") : null;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
      <div className="lg:col-span-3 space-y-4">
        <div className="bg-white rounded-xl border border-border p-5">
          <div className="flex items-center gap-2 mb-3"><Heart size={14} className="text-[#3B6B8A]" /><h3 className="font-oswald text-xs font-bold text-navy uppercase tracking-wider">Your Player</h3></div>
          {myPId ? (
            <Link href={`/players/${myPId}`} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-navy/[0.02] transition-colors">
              <div className="w-10 h-10 rounded-full bg-[#3B6B8A]/10 flex items-center justify-center"><Heart size={18} className="text-[#3B6B8A]" /></div>
              <div><p className="text-sm font-semibold text-navy">View Player Dashboard</p><p className="text-[10px] text-muted mt-0.5">Stats, development, and reports</p></div>
              <ChevronRight size={14} className="text-muted/40 ml-auto" />
            </Link>
          ) : <EmptyState icon={<Heart size={28} />} text="No player selected" link="/my-player" linkText="Select your player" />}
        </div>
        <SectionCard icon={<FileText size={14} />} title="Recent Reports" link="/reports" linkLabel="View all">
          {lw1 ? <CardSkeleton lines={3} /> : recentReports.length === 0 ? <EmptyState icon={<FileText size={28} />} text="No reports yet" /> : (
            <div className="space-y-2">{recentReports.slice(0, 3).map((r: Report) => <ReportCard key={r.id} report={r} />)}</div>
          )}
        </SectionCard>
        <Link href="/player-guide" className="flex items-center gap-3 p-4 bg-white rounded-xl border border-border hover:shadow-md transition-all group">
          <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center group-hover:scale-110 transition-transform"><BookOpen size={20} className="text-green-600" /></div>
          <div><p className="font-oswald text-sm font-bold text-navy uppercase tracking-wider">Player Guide</p><p className="text-xs text-muted mt-0.5">Nutrition, workouts, mental game</p></div>
          <ChevronRight size={16} className="text-muted/40 ml-auto group-hover:text-teal transition-colors" />
        </Link>
      </div>
      <div className="lg:col-span-2 space-y-4">
        <div className="bg-white rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-3"><h3 className="font-oswald text-xs font-bold text-navy uppercase tracking-wider">Monthly Usage</h3>
            <Link href="/pricing" className="flex items-center gap-1 text-[10px] font-oswald font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-teal/10 text-teal hover:bg-teal/20 transition-colors"><Crown size={10} />{user?.subscription_tier || "Rookie"}</Link>
          </div>
          <BenchTalkUsage />
        </div>
        <button onClick={onBT} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-teal text-white font-oswald text-[11px] font-semibold uppercase tracking-wider hover:opacity-90 transition-opacity"><MessageSquare size={14} /> Ask Bench Talk</button>
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function AgentView({ recentReports, scoutingList, lw1, user, onBT }: any) {
  return (
    <>
      <div className="bg-gradient-to-br from-[#475569] to-[#334155] rounded-xl p-5 mb-4 text-white">
        <div className="flex items-center gap-3 mb-3"><div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center"><Briefcase size={20} /></div><div><h3 className="font-oswald text-sm font-bold uppercase tracking-wider">Agent Hub</h3><p className="text-xs text-white/60 mt-0.5">Client management and reports</p></div></div>
        <Link href="/my-clients" className="inline-flex items-center gap-1.5 text-xs bg-white/10 hover:bg-white/20 rounded-lg px-3 py-1.5 transition-colors">Manage Clients <ChevronRight size={12} /></Link>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 space-y-4">
          <SectionCard icon={<FileText size={14} />} title="Recent Reports" link="/reports" linkLabel="View all">
            {lw1 ? <CardSkeleton lines={3} /> : recentReports.length === 0 ? <EmptyState icon={<FileText size={28} />} text="No reports yet" /> : (
              <div className="space-y-2">{recentReports.slice(0, 5).map((r: Report) => <ReportCard key={r.id} report={r} />)}</div>
            )}
          </SectionCard>
        </div>
        <div className="lg:col-span-2 space-y-4">
          <SectionCard icon={<Target size={14} className="text-orange" />} title="Scouting List" link="/scouting" linkLabel="View all">
            {lw1 ? <CardSkeleton lines={3} /> : scoutingList.length === 0 ? <EmptyState icon={<Target size={28} />} text="No players" link="/scouting" linkText="Add a player" /> : (
              <div className="space-y-1">{scoutingList.slice(0, 5).map((item: ScoutingListItem) => (
                <Link key={item.id} href={`/players/${item.player_id}`} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-navy/[0.02] transition-colors">
                  <div className="relative shrink-0"><div className="w-7 h-7 rounded-full bg-navy/5 flex items-center justify-center text-[10px] font-oswald font-bold text-navy uppercase">{item.position || "?"}</div><span className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border-2 border-white ${PRIORITY_DOT[item.priority] || "bg-gray-400"}`} /></div>
                  <div className="flex-1 min-w-0"><p className="text-xs font-semibold text-navy truncate">{item.first_name} {item.last_name}</p><p className="text-[10px] text-muted truncate">{item.current_team || "No team"}</p></div>
                </Link>
              ))}</div>
            )}
          </SectionCard>
          <div className="bg-white rounded-xl border border-border p-5">
            <div className="flex items-center justify-between mb-3"><h3 className="font-oswald text-xs font-bold text-navy uppercase tracking-wider">Monthly Usage</h3>
              <Link href="/pricing" className="flex items-center gap-1 text-[10px] font-oswald font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-teal/10 text-teal hover:bg-teal/20 transition-colors"><Crown size={10} />{user?.subscription_tier || "Rookie"}</Link>
            </div>
            <BenchTalkUsage />
          </div>
          <button onClick={onBT} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-teal text-white font-oswald text-[11px] font-semibold uppercase tracking-wider hover:opacity-90 transition-opacity"><MessageSquare size={14} /> Bench Talk</button>
        </div>
      </div>
    </>
  );
}
