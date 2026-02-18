"use client";

import { Building2, ChevronDown, CheckCircle, Calendar, AlertCircle } from "lucide-react";
import { assetUrl } from "@/lib/api";
import type { Team, HTGame, HTStandings, GamePlan, Player } from "@/types/api";

interface TeamContextBarProps {
  teams: Team[];
  activeTeam: Team | null;
  onTeamChange: (team: Team) => void;
  roster: Player[];
  scorebar: HTGame[];
  standings: HTStandings[];
  gamePlans: GamePlan[];
  loading: boolean;
}

// ── Helpers ──────────────────────────────────────────────────

function findTeamStandings(standings: HTStandings[], teamName: string): HTStandings | null {
  const lower = teamName.toLowerCase();
  return standings.find((s) => s.name.toLowerCase().includes(lower) || lower.includes(s.name.toLowerCase())) || null;
}

function findTeamGames(scorebar: HTGame[], teamName: string): { recent: HTGame[]; next: HTGame | null } {
  const lower = teamName.toLowerCase();
  const now = new Date();
  const teamGames = scorebar.filter(
    (g) => g.home_team.toLowerCase().includes(lower) || g.away_team.toLowerCase().includes(lower) ||
           lower.includes(g.home_team.toLowerCase()) || lower.includes(g.away_team.toLowerCase())
  );

  const completed = teamGames
    .filter((g) => g.status === "Final" || g.status === "final")
    .sort((a, b) => new Date(b.game_date || b.date).getTime() - new Date(a.game_date || a.date).getTime())
    .slice(0, 5);

  const upcoming = teamGames
    .filter((g) => {
      const gd = new Date(g.game_date || g.date);
      return gd >= now && g.status !== "Final" && g.status !== "final";
    })
    .sort((a, b) => new Date(a.game_date || a.date).getTime() - new Date(b.game_date || b.date).getTime());

  return { recent: completed, next: upcoming[0] || null };
}

function getGameResult(game: HTGame, teamName: string): "W" | "L" | "OTL" {
  const lower = teamName.toLowerCase();
  const isHome = game.home_team.toLowerCase().includes(lower) || lower.includes(game.home_team.toLowerCase());
  const our = parseInt(isHome ? game.home_score : game.away_score) || 0;
  const their = parseInt(isHome ? game.away_score : game.home_score) || 0;
  if (our > their) return "W";
  return "L";
}

function getOpponent(game: HTGame, teamName: string): string {
  const lower = teamName.toLowerCase();
  const isHome = game.home_team.toLowerCase().includes(lower) || lower.includes(game.home_team.toLowerCase());
  return isHome ? game.away_team : game.home_team;
}

const RESULT_COLORS: Record<string, string> = {
  W: "bg-green-500",
  L: "bg-red-500",
  OTL: "bg-gray-400",
};

// ── Component ────────────────────────────────────────────────

export default function TeamContextBar({
  teams,
  activeTeam,
  onTeamChange,
  roster,
  scorebar,
  standings,
  gamePlans,
  loading,
}: TeamContextBarProps) {
  if (loading || !activeTeam) {
    return (
      <div className="bg-gradient-to-r from-navy to-navy-light rounded-xl p-4 mb-4 animate-pulse">
        <div className="h-12 bg-white/10 rounded-lg" />
      </div>
    );
  }

  const teamStandings = findTeamStandings(standings, activeTeam.name);
  const { recent, next } = findTeamGames(scorebar, activeTeam.name);

  // Check if next game has a game plan ready
  const nextOpponent = next ? getOpponent(next, activeTeam.name) : null;
  const gamePlanReady = nextOpponent
    ? gamePlans.some((gp) =>
        gp.opponent_team_name.toLowerCase().includes(nextOpponent.toLowerCase()) ||
        nextOpponent.toLowerCase().includes(gp.opponent_team_name.toLowerCase())
      )
    : false;

  // Roster alert count
  const rosterAlerts = roster.filter((p) => p.roster_status && p.roster_status !== "active");

  return (
    <div className="bg-gradient-to-r from-navy to-navy-light rounded-xl p-4 sm:p-5 mb-4 text-white">
      {/* Top Row: Team info + selector */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          {/* Team Logo */}
          {activeTeam.logo_url ? (
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg overflow-hidden border border-white/20 bg-white/10 shrink-0">
              <img src={assetUrl(activeTeam.logo_url)} alt={activeTeam.name} className="w-full h-full object-contain" />
            </div>
          ) : (
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-white/10 flex items-center justify-center border border-white/10 shrink-0">
              {activeTeam.abbreviation ? (
                <span className="font-oswald font-bold text-sm text-white">{activeTeam.abbreviation}</span>
              ) : (
                <Building2 size={20} className="text-white/50" />
              )}
            </div>
          )}

          {/* Team Name + League */}
          <div>
            <h1 className="text-lg sm:text-xl font-oswald font-bold tracking-wide">{activeTeam.name}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              {activeTeam.league && (
                <span className="px-2 py-0.5 bg-teal/20 text-teal rounded font-oswald font-bold text-[10px] uppercase tracking-wider">
                  {activeTeam.league}
                </span>
              )}
              {teamStandings && (
                <span className="text-xs text-white/60 font-oswald">
                  {teamStandings.wins}-{teamStandings.losses}-{teamStandings.otl || 0}
                  <span className="text-white/30 ml-1">({teamStandings.points} pts)</span>
                </span>
              )}
              {/* Last 5 results dots */}
              {recent.length > 0 && (
                <div className="flex items-center gap-0.5 ml-1">
                  {recent.slice(0, 5).reverse().map((g, i) => {
                    const result = getGameResult(g, activeTeam.name);
                    return (
                      <div
                        key={i}
                        className={`w-2 h-2 rounded-full ${RESULT_COLORS[result]}`}
                        title={`${result} vs ${getOpponent(g, activeTeam.name)}`}
                      />
                    );
                  })}
                </div>
              )}
              {rosterAlerts.length > 0 && (
                <span className="flex items-center gap-0.5 text-[10px] text-amber-400 ml-1">
                  <AlertCircle size={10} />
                  {rosterAlerts.length} out
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Team Selector */}
        {teams.length > 1 && (
          <div className="relative">
            <select
              value={activeTeam.name}
              onChange={(e) => {
                const team = teams.find((t) => t.name === e.target.value);
                if (team) onTeamChange(team);
              }}
              className="appearance-none bg-white/10 border border-white/20 text-white text-xs font-oswald uppercase tracking-wider rounded-lg pl-3 pr-8 py-2 cursor-pointer hover:bg-white/15 transition-colors focus:outline-none focus:ring-1 focus:ring-teal"
            >
              {teams.map((t) => (
                <option key={t.id} value={t.name} className="bg-navy text-white">
                  {t.name}
                </option>
              ))}
            </select>
            <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-white/50" />
          </div>
        )}
      </div>

      {/* Bottom Row: Next game + game plan status */}
      {next && (
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/10 text-xs text-white/60 flex-wrap">
          <div className="flex items-center gap-1.5">
            <Calendar size={12} className="text-teal" />
            <span className="font-oswald uppercase tracking-wider text-white/40">Next:</span>
            <span className="text-white/80">
              vs {getOpponent(next, activeTeam.name)}
            </span>
            <span className="text-white/40">
              {new Date(next.game_date || next.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              {next.time && ` · ${next.time}`}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {gamePlanReady ? (
              <>
                <CheckCircle size={12} className="text-green-400" />
                <span className="text-green-400 font-oswald uppercase tracking-wider">Game Plan Ready</span>
              </>
            ) : (
              <>
                <AlertCircle size={12} className="text-orange" />
                <span className="text-orange font-oswald uppercase tracking-wider">No Game Plan</span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
