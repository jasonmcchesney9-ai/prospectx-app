"use client";

import Link from "next/link";
import { ChevronDown, MapPin, Calendar, CheckCircle2, XCircle } from "lucide-react";
import { assetUrl } from "@/lib/api";
import type { Team, HTStandings, HTGame, GamePlan } from "@/types/api";

// ── HT league mapping ──────────────────────────────────────
const HT_LEAGUE_MAP: Record<string, string> = {
  // Pro
  AHL: "ahl", ECHL: "echl", SPHL: "sphl", PWHL: "pwhl",
  // Major Junior
  OHL: "ohl", WHL: "whl", QMJHL: "lhjmq", LHJMQ: "lhjmq",
  // Junior A
  BCHL: "bchl", AJHL: "ajhl", SJHL: "sjhl", MJHL: "mjhl",
  USHL: "ushl", OJHL: "ojhl", CCHL: "cchl", NOJHL: "nojhl",
  MHL: "mhl", GOJHL: "gojhl", GOHL: "gojhl",
  // Junior B
  KIJHL: "kijhl", PJHL: "pjhl", VIJHL: "vijhl",
};

export function getHTLeague(league: string | null): string | null {
  if (!league) return null;
  return HT_LEAGUE_MAP[league.toUpperCase()] || null;
}

// ── Props ───────────────────────────────────────────────────
interface TeamContextBarProps {
  teams: Team[];
  activeTeam: Team | null;
  onTeamChange: (team: Team) => void;
  standings: HTStandings[];
  scorebar: HTGame[];
  gamePlans: GamePlan[];
  loading?: boolean;
}

// ── Helpers ─────────────────────────────────────────────────
function matchTeam(name: string, teamName: string): boolean {
  const a = name.toLowerCase().trim();
  const b = teamName.toLowerCase().trim();
  return a === b || a.includes(b) || b.includes(a);
}

function getRecord(standings: HTStandings[], teamName: string) {
  const s = standings.find((st) => matchTeam(st.name, teamName));
  if (!s) return null;
  return { wins: s.wins ?? 0, losses: s.losses ?? 0, otl: s.otl ?? 0, points: s.points ?? 0, pct: s.pct };
}

function getLast5(scorebar: HTGame[], teamName: string): ("W" | "L" | "OTL")[] {
  const completed = scorebar
    .filter((g) => g.status?.toLowerCase() === "final" || g.status?.toLowerCase() === "final ot" || g.status?.toLowerCase() === "final so")
    .filter((g) => matchTeam(g.home_team, teamName) || matchTeam(g.away_team, teamName))
    .sort((a, b) => new Date(b.game_date || b.date).getTime() - new Date(a.game_date || a.date).getTime())
    .slice(0, 5);

  return completed.map((g) => {
    const isHome = matchTeam(g.home_team, teamName);
    const teamScore = parseInt(isHome ? g.home_score : g.away_score) || 0;
    const oppScore = parseInt(isHome ? g.away_score : g.home_score) || 0;
    if (teamScore > oppScore) return "W";
    if (g.status?.toLowerCase().includes("ot") || g.status?.toLowerCase().includes("so")) return "OTL";
    return "L";
  });
}

function getNextGame(scorebar: HTGame[], teamName: string): HTGame | null {
  const now = new Date();
  const upcoming = scorebar
    .filter((g) => {
      const status = (g.status || "").toLowerCase();
      return status !== "final" && status !== "final ot" && status !== "final so";
    })
    .filter((g) => matchTeam(g.home_team, teamName) || matchTeam(g.away_team, teamName))
    .sort((a, b) => new Date(a.game_date || a.date).getTime() - new Date(b.game_date || b.date).getTime());
  return upcoming[0] || null;
}

function hasGamePlanForOpponent(gamePlans: GamePlan[], opponent: string): boolean {
  return gamePlans.some(
    (gp) => matchTeam(gp.opponent_team_name, opponent) && gp.status !== "completed"
  );
}

export default function TeamContextBar({
  teams,
  activeTeam,
  onTeamChange,
  standings,
  scorebar,
  gamePlans,
  loading,
}: TeamContextBarProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-teal/15 border-l-4 border-l-teal/30 p-4 mb-4 animate-pulse">
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-lg bg-navy/5" />
          <div className="flex-1">
            <div className="h-4 bg-navy/5 rounded w-48 mb-2" />
            <div className="h-3 bg-navy/5 rounded w-64" />
          </div>
        </div>
      </div>
    );
  }

  if (!activeTeam) return null;

  const record = getRecord(standings, activeTeam.name);
  const last5 = getLast5(scorebar, activeTeam.name);
  const nextGame = getNextGame(scorebar, activeTeam.name);
  const htLeague = getHTLeague(activeTeam.league);

  // Determine next game opponent
  let nextOpponent = "";
  let nextIsHome = true;
  let nextDateStr = "";
  if (nextGame) {
    nextIsHome = matchTeam(nextGame.home_team, activeTeam.name);
    nextOpponent = nextIsHome ? nextGame.away_team : nextGame.home_team;
    const d = new Date(nextGame.game_date || nextGame.date);
    nextDateStr = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  }

  const gpReady = nextOpponent ? hasGamePlanForOpponent(gamePlans, nextOpponent) : false;
  const logoUrl = assetUrl(activeTeam.logo_url);

  return (
    <div className="bg-white rounded-xl border border-teal/20 border-l-4 border-l-teal px-4 py-3 mb-4">
      <div className="flex items-center gap-3 flex-wrap">
        {/* Team Logo / Abbreviation */}
        {logoUrl ? (
          <img src={logoUrl} alt={activeTeam.name} className="w-11 h-11 rounded-lg object-contain bg-navy/5 p-1" />
        ) : (
          <div className="w-11 h-11 rounded-lg bg-navy flex items-center justify-center text-orange font-oswald font-bold text-sm shrink-0">
            {activeTeam.abbreviation || activeTeam.name.slice(0, 3).toUpperCase()}
          </div>
        )}

        {/* Team Name + Meta */}
        <div className="flex-1 min-w-0">
          <Link href={`/teams/${encodeURIComponent(activeTeam.name)}`} className="text-base font-oswald font-bold text-navy uppercase tracking-wider truncate hover:text-teal transition-colors block">
            {activeTeam.name}
          </Link>
          <div className="flex items-center gap-2.5 mt-0.5 flex-wrap">
            {/* League Badge */}
            {activeTeam.league && (
              <span className="inline-block bg-navy text-teal font-oswald text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded">
                {activeTeam.league}
              </span>
            )}

            {/* Record */}
            {record && (
              <span className="font-oswald font-semibold text-navy text-sm">
                {record.wins}-{record.losses}-{record.otl}
              </span>
            )}

            {/* Last 5 streak dots */}
            {last5.length > 0 && (
              <div className="flex gap-1 items-center">
                {last5.map((result, i) => (
                  <div
                    key={i}
                    className={`w-2 h-2 rounded-full ${
                      result === "W" ? "bg-green-500" : result === "L" ? "bg-red-500" : "bg-gray-400"
                    }`}
                    title={result}
                  />
                ))}
              </div>
            )}

            {/* Standing position — could be derived from standings rank */}
            {record && record.points !== undefined && (
              <span className="text-muted text-[11px]">
                {record.points} pts
              </span>
            )}
          </div>
        </div>

        {/* Next Game */}
        {nextGame ? (
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span className="font-oswald text-[10px] text-muted uppercase tracking-wider">Next Game</span>
            <span className="font-oswald font-semibold text-navy text-sm">
              {nextIsHome ? "vs" : "@"} {nextOpponent}
              <span className="text-muted font-normal text-xs ml-1.5">{nextDateStr}</span>
            </span>
            {nextOpponent && (
              <span
                className={`inline-flex items-center gap-1 font-oswald text-[10px] uppercase tracking-wider px-2 py-0.5 rounded ${
                  gpReady ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
                }`}
              >
                {gpReady ? (
                  <>
                    <CheckCircle2 size={10} /> Game Plan Ready
                  </>
                ) : (
                  <>
                    <XCircle size={10} /> No Game Plan
                  </>
                )}
              </span>
            )}
          </div>
        ) : !htLeague ? (
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span className="font-oswald text-[10px] text-muted uppercase tracking-wider">Schedule</span>
            <span className="text-muted text-xs">No live data available</span>
          </div>
        ) : null}

        {/* Team Selector */}
        {teams.length > 1 && (
          <div className="relative shrink-0">
            <select
              value={activeTeam.id}
              onChange={(e) => {
                const t = teams.find((t) => t.id === e.target.value);
                if (t) onTeamChange(t);
              }}
              className="appearance-none bg-bg border border-teal/20 rounded-lg pl-3 pr-8 py-1.5 font-oswald text-[11px] text-navy uppercase tracking-wider cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal transition-all"
            >
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          </div>
        )}
      </div>
    </div>
  );
}
