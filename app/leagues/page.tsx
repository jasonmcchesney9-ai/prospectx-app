"use client";

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Trophy,
  Users,
  BarChart3,
  Calendar,
  ChevronRight,
  Loader2,
  Shield,
  Star,
  TrendingUp,
  AlertCircle,
  Download,
  CheckCircle2,
  RefreshCw,
  ArrowRightLeft,
  Search,
  X,
} from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import api, { assetUrl } from "@/lib/api";
import type {
  HTLeague,
  HTTeam,
  HTSkaterStats,
  HTGoalieStats,
  HTStandings,
  HTGame,
} from "@/types/api";

type Tab = "standings" | "player-stats" | "schedule" | "teams";

const LEAGUE_OPTIONS = [
  // Professional
  { code: "ahl", label: "AHL", full: "American Hockey League" },
  { code: "echl", label: "ECHL", full: "ECHL" },
  { code: "sphl", label: "SPHL", full: "Southern Professional Hockey League" },
  { code: "pwhl", label: "PWHL", full: "Professional Women's Hockey League" },
  // Major Junior (CHL)
  { code: "ohl", label: "OHL", full: "Ontario Hockey League" },
  { code: "whl", label: "WHL", full: "Western Hockey League" },
  { code: "lhjmq", label: "QMJHL", full: "Quebec Major Junior Hockey League" },
  // Junior A
  { code: "bchl", label: "BCHL", full: "British Columbia Hockey League" },
  { code: "ajhl", label: "AJHL", full: "Alberta Junior Hockey League" },
  { code: "sjhl", label: "SJHL", full: "Saskatchewan Junior Hockey League" },
  { code: "mjhl", label: "MJHL", full: "Manitoba Junior Hockey League" },
  { code: "ushl", label: "USHL", full: "United States Hockey League" },
  { code: "ojhl", label: "OJHL", full: "Ontario Junior Hockey League" },
  { code: "cchl", label: "CCHL", full: "Central Canada Hockey League" },
  { code: "nojhl", label: "NOJHL", full: "Northern Ontario Junior Hockey League" },
  { code: "mhl", label: "MHL", full: "Maritime Hockey League" },
  { code: "gojhl", label: "GOHL", full: "Greater Ontario Hockey League" },
  // Junior B
  { code: "kijhl", label: "KIJHL", full: "Kootenay International Junior Hockey League" },
  { code: "pjhl", label: "PJHL", full: "Provincial Junior Hockey League" },
  { code: "vijhl", label: "VIJHL", full: "Vancouver Island Junior Hockey League" },
];

export default function LeagueHubPage() {
  const [league, setLeague] = useState("gojhl");
  const [tab, setTab] = useState<Tab>("standings");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Data
  const [standings, setStandings] = useState<HTStandings[]>([]);
  const [leaders, setLeaders] = useState<HTSkaterStats[]>([]);
  const [games, setGames] = useState<HTGame[]>([]);
  const [teams, setTeams] = useState<HTTeam[]>([]);

  // Goalies (lazy loaded on demand)
  const [goalieStats, setGoalieStats] = useState<HTGoalieStats[]>([]);
  const [goalieLoading, setGoalieLoading] = useState(false);
  const [goaliesLoaded, setGoaliesLoaded] = useState(false);

  const leagueInfo = LEAGUE_OPTIONS.find((l) => l.code === league) || LEAGUE_OPTIONS[0];

  useEffect(() => {
    loadData();
  }, [league]);

  const loadData = async () => {
    setLoading(true);
    setError("");
    // Reset goalie cache on league change
    setGoaliesLoaded(false);
    setGoalieStats([]);
    try {
      const [standingsRes, leadersRes, gamesRes, teamsRes] = await Promise.all([
        api.get<HTStandings[]>(`/hockeytech/${league}/standings`),
        api.get<HTSkaterStats[]>(`/hockeytech/${league}/stats/leaders?limit=100`),
        api.get<HTGame[]>(`/hockeytech/${league}/scorebar?days_back=15&days_ahead=15`),
        api.get<HTTeam[]>(`/hockeytech/${league}/teams`),
      ]);
      setStandings(standingsRes.data);
      setLeaders(leadersRes.data);
      setGames(gamesRes.data);
      setTeams(teamsRes.data);
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message || "Failed to load league data";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const loadGoalies = async () => {
    if (goaliesLoaded) return;
    setGoalieLoading(true);
    try {
      const res = await api.get<HTGoalieStats[]>(`/hockeytech/${league}/stats/goalies?limit=50`);
      setGoalieStats(res.data);
      setGoaliesLoaded(true);
    } catch {
      // Silently fail — user can retry by toggling filter
    } finally {
      setGoalieLoading(false);
    }
  };

  const tabs: { key: Tab; label: string; icon: typeof Trophy }[] = [
    { key: "standings", label: "Standings", icon: Trophy },
    { key: "player-stats", label: "Player Stats", icon: TrendingUp },
    { key: "schedule", label: "Schedule", icon: Calendar },
    { key: "teams", label: "Teams", icon: Shield },
  ];

  return (
    <ProtectedRoute>
      <NavBar />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-lg bg-orange/10 flex items-center justify-center">
              <BarChart3 size={22} className="text-orange" />
            </div>
            <div>
              <h1 className="text-2xl font-bold font-oswald text-navy">League Hub</h1>
              <p className="text-sm text-muted">Standings, stats, and scores from league data sync</p>
            </div>
          </div>

          {/* League Selector */}
          <select
            value={league}
            onChange={(e) => setLeague(e.target.value)}
            className="appearance-none bg-white border border-teal/20 rounded-lg px-4 py-2.5 pr-10 text-sm font-oswald font-semibold text-navy uppercase tracking-wider cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal transition-all"
          >
            <optgroup label="Professional">
              {LEAGUE_OPTIONS.filter((_, i) => i < 4).map((opt) => (
                <option key={opt.code} value={opt.code}>{opt.label} — {opt.full}</option>
              ))}
            </optgroup>
            <optgroup label="Major Junior (CHL)">
              {LEAGUE_OPTIONS.filter((_, i) => i >= 4 && i < 7).map((opt) => (
                <option key={opt.code} value={opt.code}>{opt.label} — {opt.full}</option>
              ))}
            </optgroup>
            <optgroup label="Junior A">
              {LEAGUE_OPTIONS.filter((_, i) => i >= 7 && i < 17).map((opt) => (
                <option key={opt.code} value={opt.code}>{opt.label} — {opt.full}</option>
              ))}
            </optgroup>
            <optgroup label="Junior B">
              {LEAGUE_OPTIONS.filter((_, i) => i >= 17).map((opt) => (
                <option key={opt.code} value={opt.code}>{opt.label} — {opt.full}</option>
              ))}
            </optgroup>
          </select>
        </div>

        {/* League Name Banner */}
        <div className="bg-gradient-to-r from-navy to-navy-light rounded-xl p-4 mb-6 text-white flex items-center justify-between">
          <div>
            <p className="text-xl font-oswald font-bold">{leagueInfo.full}</p>
            <p className="text-white/60 text-sm mt-0.5">
              {standings.length} teams &middot; Data from league sync
            </p>
          </div>
          <div className="text-right text-sm text-white/40">
            {leagueInfo.label.toUpperCase()}
          </div>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center gap-2">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {/* Tab Bar */}
        <div className="flex gap-1 border-b border-teal/20 mb-6 overflow-x-auto">
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${
                  tab === t.key
                    ? "border-teal text-teal"
                    : "border-transparent text-muted hover:text-navy"
                }`}
              >
                <Icon size={16} />
                {t.label}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={32} className="text-teal animate-spin" />
            <span className="ml-3 text-muted">Loading {leagueInfo.label} data...</span>
          </div>
        ) : (
          <>
            {tab === "standings" && <StandingsTab standings={standings} />}
            {tab === "player-stats" && (
              <PlayerStatsTab
                skaters={leaders}
                goalies={goalieStats}
                goalieLoading={goalieLoading}
                onLoadGoalies={loadGoalies}
                league={league}
              />
            )}
            {tab === "schedule" && <ScheduleTab games={games} teams={teams} />}
            {tab === "teams" && <TeamsTab teams={teams} league={league} />}
          </>
        )}
      </main>
    </ProtectedRoute>
  );
}

// ── Standings Tab ────────────────────────────────────────────────────

function StandingsTab({ standings }: { standings: HTStandings[] }) {
  if (!standings.length) {
    return <EmptyState text="No standings data available" />;
  }

  return (
    <div className="bg-white rounded-xl border border-teal/20 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-navy/[0.03] border-b border-teal/20">
              <th className="px-3 py-2.5 text-left font-oswald uppercase tracking-wider text-muted text-xs">#</th>
              <th className="px-3 py-2.5 text-left font-oswald uppercase tracking-wider text-muted text-xs">Team</th>
              <th className="px-3 py-2.5 text-center font-oswald uppercase tracking-wider text-muted text-xs">GP</th>
              <th className="px-3 py-2.5 text-center font-oswald uppercase tracking-wider text-muted text-xs">W</th>
              <th className="px-3 py-2.5 text-center font-oswald uppercase tracking-wider text-muted text-xs">L</th>
              <th className="px-3 py-2.5 text-center font-oswald uppercase tracking-wider text-muted text-xs">OTL</th>
              <th className="px-3 py-2.5 text-center font-oswald uppercase tracking-wider text-muted text-xs font-bold">PTS</th>
              <th className="px-3 py-2.5 text-center font-oswald uppercase tracking-wider text-muted text-xs">GF</th>
              <th className="px-3 py-2.5 text-center font-oswald uppercase tracking-wider text-muted text-xs">GA</th>
              <th className="px-3 py-2.5 text-center font-oswald uppercase tracking-wider text-muted text-xs">DIFF</th>
              <th className="px-3 py-2.5 text-center font-oswald uppercase tracking-wider text-muted text-xs">PP%</th>
              <th className="px-3 py-2.5 text-center font-oswald uppercase tracking-wider text-muted text-xs">PK%</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((team, i) => {
              const diff = (team.gf ?? 0) - (team.ga ?? 0);
              // Strip clinch markers like "x - " from name
              const cleanName = team.name.replace(/^[a-z]\s*-\s*/i, "");
              const clinch = team.name.match(/^([a-z])\s*-\s*/i)?.[1] || "";
              return (
                <tr key={team.team_id ?? i} className="border-b border-teal/10 hover:bg-navy/[0.02]">
                  <td className="px-3 py-2 text-muted text-xs">{i + 1}</td>
                  <td className="px-3 py-2 font-medium text-navy whitespace-nowrap">
                    {clinch && (
                      <span className="text-xs text-teal font-bold mr-1" title={clinch === "x" ? "Clinched playoff spot" : clinch === "y" ? "Clinched division" : clinch === "z" ? "Clinched conference" : ""}>
                        {clinch}
                      </span>
                    )}
                    <Link href={`/teams/${encodeURIComponent(cleanName)}`} className="hover:text-teal transition-colors hover:underline">
                      {cleanName}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-center">{team.gp ?? "—"}</td>
                  <td className="px-3 py-2 text-center font-medium text-green-700">{team.wins ?? "—"}</td>
                  <td className="px-3 py-2 text-center font-medium text-red-600">{team.losses ?? "—"}</td>
                  <td className="px-3 py-2 text-center">{team.otl ?? "—"}</td>
                  <td className="px-3 py-2 text-center font-bold text-navy">{team.points ?? "—"}</td>
                  <td className="px-3 py-2 text-center">{team.gf ?? "—"}</td>
                  <td className="px-3 py-2 text-center">{team.ga ?? "—"}</td>
                  <td className={`px-3 py-2 text-center font-medium ${diff > 0 ? "text-green-700" : diff < 0 ? "text-red-600" : "text-muted"}`}>
                    {diff > 0 ? `+${diff}` : diff}
                  </td>
                  <td className="px-3 py-2 text-center text-xs">{team.pp_pct || "—"}</td>
                  <td className="px-3 py-2 text-center text-xs">{team.pk_pct || "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Player Stats Tab ─────────────────────────────────────────────────

type QuickFilter = "all" | "hot" | "rookies" | "snipers" | "playmakers" | "defensemen" | "goalies";
type SortKey = "points" | "goals" | "assists" | "ppg" | "plus_minus";
type PosFilter = "all" | "forwards" | "defensemen" | "goalies";

const QUICK_FILTERS: { key: QuickFilter; label: string; emoji: string }[] = [
  { key: "all", label: "All Players", emoji: "" },
  { key: "hot", label: "Hot Streak", emoji: "\uD83D\uDD25" },
  { key: "rookies", label: "Rookies", emoji: "\u2B50" },
  { key: "snipers", label: "Top Snipers", emoji: "\uD83C\uDFAF" },
  { key: "playmakers", label: "Top Playmakers", emoji: "\uD83C\uDF81" },
  { key: "defensemen", label: "Defensemen", emoji: "" },
  { key: "goalies", label: "Goalies", emoji: "" },
];

function PlayerStatsTab({
  skaters,
  goalies,
  goalieLoading,
  onLoadGoalies,
  league,
}: {
  skaters: HTSkaterStats[];
  goalies: HTGoalieStats[];
  goalieLoading: boolean;
  onLoadGoalies: () => void;
  league: string;
}) {
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
  const [posFilter, setPosFilter] = useState<PosFilter>("all");
  const [sortBy, setSortBy] = useState<SortKey>("points");
  const [searchQuery, setSearchQuery] = useState("");

  const isGoalieView = quickFilter === "goalies" || posFilter === "goalies";

  // Trigger goalie load when needed
  useEffect(() => {
    if (isGoalieView) onLoadGoalies();
  }, [isGoalieView]);

  const handleQuickFilter = (key: QuickFilter) => {
    setQuickFilter(key);
    switch (key) {
      case "all":
        setPosFilter("all"); setSortBy("points"); break;
      case "hot":
        setPosFilter("all"); setSortBy("ppg"); break;
      case "rookies":
        setPosFilter("all"); setSortBy("points"); break;
      case "snipers":
        setPosFilter("all"); setSortBy("goals"); break;
      case "playmakers":
        setPosFilter("all"); setSortBy("assists"); break;
      case "defensemen":
        setPosFilter("defensemen"); setSortBy("points"); break;
      case "goalies":
        setPosFilter("goalies"); setSortBy("points"); break;
    }
  };

  const filteredSkaters = useMemo(() => {
    let data = [...skaters];

    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      data = data.filter((p) => p.name.toLowerCase().includes(q));
    }

    // Position filter
    if (posFilter === "forwards") {
      data = data.filter((p) => !p.position.includes("D") && p.position !== "G");
    } else if (posFilter === "defensemen" || quickFilter === "defensemen") {
      data = data.filter((p) => p.position.includes("D"));
    }

    // Quick filter specific
    if (quickFilter === "rookies") {
      data = data.filter((p) => p.rookie);
    }
    if (quickFilter === "hot") {
      data = data.filter((p) => (p.gp ?? 0) > 0 && ((p.points ?? 0) / (p.gp ?? 1)) >= 1.0);
    }

    // Sort
    data.sort((a, b) => {
      switch (sortBy) {
        case "goals": return (b.goals ?? 0) - (a.goals ?? 0);
        case "assists": return (b.assists ?? 0) - (a.assists ?? 0);
        case "ppg": {
          const aPpg = (a.gp ?? 0) > 0 ? (a.points ?? 0) / (a.gp ?? 1) : 0;
          const bPpg = (b.gp ?? 0) > 0 ? (b.points ?? 0) / (b.gp ?? 1) : 0;
          return bPpg - aPpg;
        }
        case "plus_minus": return (b.plus_minus ?? 0) - (a.plus_minus ?? 0);
        default: return (b.points ?? 0) - (a.points ?? 0);
      }
    });

    return data;
  }, [skaters, searchQuery, posFilter, quickFilter, sortBy]);

  const filteredGoalies = useMemo(() => {
    if (!searchQuery) return goalies;
    const q = searchQuery.toLowerCase();
    return goalies.filter((g) => g.name.toLowerCase().includes(q));
  }, [goalies, searchQuery]);

  if (!skaters.length && !isGoalieView) {
    return <EmptyState text="No player stats data available" />;
  }

  return (
    <div className="space-y-4">
      {/* Quick Filter Chips */}
      <div className="flex flex-wrap gap-2">
        {QUICK_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => handleQuickFilter(f.key)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors ${
              quickFilter === f.key
                ? "bg-teal text-white border-teal"
                : "bg-white text-navy/70 border-teal/20 hover:border-teal/40 hover:text-navy"
            }`}
          >
            {f.emoji && <span className="mr-1">{f.emoji}</span>}
            {f.label}
          </button>
        ))}
      </div>

      {/* Filter Row: Search + Position + Sort */}
      <div className="flex flex-wrap items-end gap-3">
        {/* Player Search */}
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder="Search players..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 border border-teal/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal/30 bg-white"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X size={14} className="text-muted hover:text-navy" />
              </button>
            )}
          </div>
        </div>

        {/* Position Filter */}
        <div className="min-w-[140px]">
          <label className="block text-[10px] font-oswald uppercase tracking-wider text-muted mb-1">Position</label>
          <select
            value={posFilter}
            onChange={(e) => { setPosFilter(e.target.value as PosFilter); setQuickFilter("all"); }}
            className="w-full border border-teal/20 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal/30"
          >
            <option value="all">All Players</option>
            <option value="forwards">Forwards</option>
            <option value="defensemen">Defensemen</option>
            <option value="goalies">Goalies</option>
          </select>
        </div>

        {/* Sort By (hidden for goalies) */}
        {!isGoalieView && (
          <div className="min-w-[160px]">
            <label className="block text-[10px] font-oswald uppercase tracking-wider text-muted mb-1">Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
              className="w-full border border-teal/20 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal/30"
            >
              <option value="points">Points</option>
              <option value="goals">Goals</option>
              <option value="assists">Assists</option>
              <option value="ppg">Points Per Game</option>
              <option value="plus_minus">+/-</option>
            </select>
          </div>
        )}
      </div>

      {/* Results count */}
      <p className="text-xs text-muted">
        {isGoalieView ? filteredGoalies.length : filteredSkaters.length} player{(isGoalieView ? filteredGoalies.length : filteredSkaters.length) !== 1 ? "s" : ""}
      </p>

      {/* Table: skaters or goalies */}
      {isGoalieView ? (
        goalieLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="text-teal animate-spin" />
            <span className="ml-2 text-muted text-sm">Loading goalie stats...</span>
          </div>
        ) : filteredGoalies.length === 0 ? (
          <EmptyState text="No goalie stats available" />
        ) : (
          <div className="bg-white rounded-xl border border-teal/20 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-navy/[0.03] border-b border-teal/20">
                    <th className="px-3 py-2.5 text-left font-oswald uppercase tracking-wider text-muted text-xs">#</th>
                    <th className="px-3 py-2.5 text-left font-oswald uppercase tracking-wider text-muted text-xs">Goalie</th>
                    <th className="px-3 py-2.5 text-left font-oswald uppercase tracking-wider text-muted text-xs">Team</th>
                    <th className="px-3 py-2.5 text-center font-oswald uppercase tracking-wider text-muted text-xs">GP</th>
                    <th className="px-3 py-2.5 text-center font-oswald uppercase tracking-wider text-muted text-xs">W</th>
                    <th className="px-3 py-2.5 text-center font-oswald uppercase tracking-wider text-muted text-xs">L</th>
                    <th className="px-3 py-2.5 text-center font-oswald uppercase tracking-wider text-muted text-xs">OTL</th>
                    <th className="px-3 py-2.5 text-center font-oswald uppercase tracking-wider text-muted text-xs font-bold">GAA</th>
                    <th className="px-3 py-2.5 text-center font-oswald uppercase tracking-wider text-muted text-xs font-bold">SV%</th>
                    <th className="px-3 py-2.5 text-center font-oswald uppercase tracking-wider text-muted text-xs">SO</th>
                    <th className="px-3 py-2.5 text-center font-oswald uppercase tracking-wider text-muted text-xs">MIN</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredGoalies.map((g, i) => (
                    <tr key={g.player_id ?? i} className="border-b border-teal/10 hover:bg-navy/[0.02]">
                      <td className="px-3 py-2 text-muted text-xs">{i + 1}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {g.photo ? (
                            <Image src={g.photo} alt={g.name} width={28} height={28} className="rounded-full object-cover" unoptimized />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-navy/10 flex items-center justify-center">
                              <Users size={12} className="text-navy/40" />
                            </div>
                          )}
                          <p className="font-medium text-navy text-sm">{g.name}</p>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-xs whitespace-nowrap">
                        <Link href={`/teams/${encodeURIComponent(g.team_name)}`} className="hover:text-teal transition-colors">
                          {g.team_code || g.team_name}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-center">{g.gp ?? "—"}</td>
                      <td className="px-3 py-2 text-center font-medium text-green-700">{g.wins ?? "—"}</td>
                      <td className="px-3 py-2 text-center font-medium text-red-600">{g.losses ?? "—"}</td>
                      <td className="px-3 py-2 text-center">{g.otl ?? "—"}</td>
                      <td className="px-3 py-2 text-center font-bold text-navy">{g.gaa || "—"}</td>
                      <td className="px-3 py-2 text-center font-bold text-teal">{g.save_pct || "—"}</td>
                      <td className="px-3 py-2 text-center">{g.shutouts ?? "—"}</td>
                      <td className="px-3 py-2 text-center text-xs">{g.minutes || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : (
        <div className="bg-white rounded-xl border border-teal/20 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-navy/[0.03] border-b border-teal/20">
                  <th className="px-3 py-2.5 text-left font-oswald uppercase tracking-wider text-muted text-xs">#</th>
                  <th className="px-3 py-2.5 text-left font-oswald uppercase tracking-wider text-muted text-xs">Player</th>
                  <th className="px-3 py-2.5 text-left font-oswald uppercase tracking-wider text-muted text-xs">Team</th>
                  <th className="px-3 py-2.5 text-center font-oswald uppercase tracking-wider text-muted text-xs">Pos</th>
                  <th className="px-3 py-2.5 text-center font-oswald uppercase tracking-wider text-muted text-xs">GP</th>
                  <th className="px-3 py-2.5 text-center font-oswald uppercase tracking-wider text-muted text-xs">G</th>
                  <th className="px-3 py-2.5 text-center font-oswald uppercase tracking-wider text-muted text-xs">A</th>
                  <th className="px-3 py-2.5 text-center font-oswald uppercase tracking-wider text-muted text-xs font-bold">P</th>
                  <th className="px-3 py-2.5 text-center font-oswald uppercase tracking-wider text-muted text-xs">P/GP</th>
                  <th className="px-3 py-2.5 text-center font-oswald uppercase tracking-wider text-muted text-xs">+/-</th>
                  <th className="px-3 py-2.5 text-center font-oswald uppercase tracking-wider text-muted text-xs">PIM</th>
                  <th className="px-3 py-2.5 text-center font-oswald uppercase tracking-wider text-muted text-xs">PP</th>
                </tr>
              </thead>
              <tbody>
                {filteredSkaters.map((p, i) => {
                  const ppgRate = (p.gp ?? 0) > 0 ? ((p.points ?? 0) / (p.gp ?? 1)).toFixed(2) : "0.00";
                  return (
                    <tr key={p.player_id ?? i} className="border-b border-teal/10 hover:bg-navy/[0.02]">
                      <td className="px-3 py-2 text-muted text-xs">{i + 1}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {p.photo ? (
                            <Image src={p.photo} alt={p.name} width={28} height={28} className="rounded-full object-cover" unoptimized />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-navy/10 flex items-center justify-center">
                              <Users size={12} className="text-navy/40" />
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-navy text-sm">{p.name}</p>
                            {p.rookie && <span className="text-[10px] text-orange font-semibold">R</span>}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-xs whitespace-nowrap">
                        <Link href={`/teams/${encodeURIComponent(p.team_name)}`} className="flex items-center gap-1.5 hover:text-teal transition-colors">
                          {p.logo && (
                            <Image src={p.logo} alt={p.team_code} width={18} height={18} className="object-contain" unoptimized />
                          )}
                          {p.team_code || p.team_name}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-center text-xs">{p.position}</td>
                      <td className="px-3 py-2 text-center">{p.gp ?? "—"}</td>
                      <td className="px-3 py-2 text-center font-medium">{p.goals ?? "—"}</td>
                      <td className="px-3 py-2 text-center">{p.assists ?? "—"}</td>
                      <td className="px-3 py-2 text-center font-bold text-navy">{p.points ?? "—"}</td>
                      <td className="px-3 py-2 text-center text-teal font-semibold text-xs">{ppgRate}</td>
                      <td className={`px-3 py-2 text-center text-xs ${(p.plus_minus ?? 0) > 0 ? "text-green-700" : (p.plus_minus ?? 0) < 0 ? "text-red-600" : ""}`}>
                        {p.plus_minus != null ? (p.plus_minus > 0 ? `+${p.plus_minus}` : p.plus_minus) : "—"}
                      </td>
                      <td className="px-3 py-2 text-center text-xs">{p.pim ?? "—"}</td>
                      <td className="px-3 py-2 text-center text-xs">{p.ppg ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Schedule Tab ─────────────────────────────────────────────────────

type TimeFrame = "today" | "week" | "month";

function ScheduleTab({ games, teams }: { games: HTGame[]; teams: HTTeam[] }) {
  const [timeFrame, setTimeFrame] = useState<TimeFrame>("week");
  const [teamFilter, setTeamFilter] = useState("");

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toLocaleDateString("en-CA"); // YYYY-MM-DD

  // Filter games
  const filteredGames = useMemo(() => {
    let data = [...games];

    // Team filter
    if (teamFilter) {
      data = data.filter(
        (g) => g.home_team === teamFilter || g.away_team === teamFilter
      );
    }

    // Timeframe filter
    if (timeFrame === "today") {
      data = data.filter((g) => (g.game_date || g.date) === todayStr);
    }
    // "week" and "month" show all available data from the API range

    return data;
  }, [games, teamFilter, timeFrame, todayStr]);

  // Categorize games into sections
  const liveGames = filteredGames.filter((g) => {
    const isFinal = g.status === "Final" || g.status === "Final OT" || g.status === "Final SO";
    return !isFinal && g.status !== "" && g.period !== "";
  });

  const todayNonLive = filteredGames.filter((g) => {
    const gameDate = g.game_date || g.date;
    const isFinal = g.status === "Final" || g.status === "Final OT" || g.status === "Final SO";
    const isLive = !isFinal && g.status !== "" && g.period !== "";
    return gameDate === todayStr && !isLive;
  });

  const upcomingGames = filteredGames
    .filter((g) => (g.game_date || g.date) > todayStr)
    .sort((a, b) => (a.game_date || a.date).localeCompare(b.game_date || b.date));

  const recentGames = filteredGames
    .filter((g) => {
      const gameDate = g.game_date || g.date;
      const isFinal = g.status === "Final" || g.status === "Final OT" || g.status === "Final SO";
      return gameDate < todayStr && isFinal;
    })
    .sort((a, b) => (b.game_date || b.date).localeCompare(a.game_date || a.date));

  return (
    <div className="space-y-4">
      {/* Filter Row */}
      <div className="flex flex-wrap items-end gap-3">
        {/* Timeframe Toggle */}
        <div>
          <label className="block text-[10px] font-oswald uppercase tracking-wider text-muted mb-1">Timeframe</label>
          <div className="flex gap-1 bg-navy/5 rounded-lg p-1">
            {(["today", "week", "month"] as TimeFrame[]).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeFrame(tf)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  timeFrame === tf
                    ? "bg-navy text-white shadow-sm"
                    : "text-navy/60 hover:text-navy hover:bg-white/50"
                }`}
              >
                {tf === "today" ? "Today" : tf === "week" ? "This Week" : "This Month"}
              </button>
            ))}
          </div>
        </div>

        {/* Team Filter */}
        <div className="min-w-[180px]">
          <label className="block text-[10px] font-oswald uppercase tracking-wider text-muted mb-1">Team</label>
          <select
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
            className="w-full border border-teal/20 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal/30"
          >
            <option value="">All Teams</option>
            {[...teams]
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((t) => (
                <option key={t.id} value={t.name}>{t.name}</option>
              ))}
          </select>
        </div>
      </div>

      {/* LIVE NOW Section */}
      {liveGames.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <h3 className="text-xs font-oswald font-bold uppercase tracking-wider text-red-600">Live Now</h3>
          </div>
          <div className="grid gap-2">
            {liveGames.map((g) => <GameCard key={g.game_id} game={g} />)}
          </div>
        </div>
      )}

      {/* Today's Games Section */}
      {todayNonLive.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1 h-4 rounded-full bg-teal" />
            <h3 className="text-xs font-oswald font-bold uppercase tracking-wider text-navy">Today&apos;s Games</h3>
          </div>
          <div className="grid gap-2">
            {todayNonLive.map((g) => <GameCard key={g.game_id} game={g} />)}
          </div>
        </div>
      )}

      {/* Upcoming Games Section */}
      {upcomingGames.length > 0 && (
        <GameDateSection title="Upcoming" accent="navy" games={upcomingGames} />
      )}

      {/* Recent Results Section */}
      {recentGames.length > 0 && (
        <GameDateSection title="Recent Results" accent="muted" games={recentGames} />
      )}

      {/* Empty state */}
      {filteredGames.length === 0 && (
        <EmptyState text="No games found for the selected filters" />
      )}
    </div>
  );
}

// ── Game Card (shared by all schedule sections) ─────────────────────

function GameCard({ game: g }: { game: HTGame }) {
  const isFinal = g.status === "Final" || g.status === "Final OT" || g.status === "Final SO";
  const isLive = !isFinal && g.status !== "" && g.period !== "";

  return (
    <div className={`bg-white rounded-xl border ${isLive ? "border-red-400 shadow-sm" : "border-teal/20"} p-3 flex items-center gap-4`}>
      {/* Away Team */}
      <div className="flex-1 text-right">
        <div className="flex items-center justify-end gap-2">
          <div>
            <p className="text-sm font-medium text-navy">{g.away_team || g.away_code}</p>
            <p className="text-xs text-muted">{g.away_code}</p>
          </div>
          {g.away_logo && (
            <Image src={g.away_logo} alt={g.away_code} width={32} height={32} className="object-contain" unoptimized />
          )}
        </div>
      </div>

      {/* Score / Time */}
      <div className="w-24 text-center flex-shrink-0">
        {isFinal || isLive ? (
          <>
            <p className="text-lg font-oswald font-bold text-navy">
              {g.away_score} - {g.home_score}
            </p>
            <p className={`text-xs font-semibold ${isLive ? "text-red-600" : "text-muted"}`}>
              {isLive ? `${g.period} ${g.game_clock}` : g.status}
            </p>
          </>
        ) : (
          <>
            <p className="text-sm font-oswald font-bold text-navy">{g.time || "TBD"}</p>
            <p className="text-xs text-muted">Scheduled</p>
          </>
        )}
      </div>

      {/* Home Team */}
      <div className="flex-1">
        <div className="flex items-center gap-2">
          {g.home_logo && (
            <Image src={g.home_logo} alt={g.home_code} width={32} height={32} className="object-contain" unoptimized />
          )}
          <div>
            <p className="text-sm font-medium text-navy">{g.home_team || g.home_code}</p>
            <p className="text-xs text-muted">{g.home_code}</p>
          </div>
        </div>
      </div>

      {/* Venue */}
      {g.venue && (
        <p className="text-xs text-muted/60 hidden lg:block w-36 text-right">{g.venue}</p>
      )}
    </div>
  );
}

// ── Game Date Section (groups games by date) ────────────────────────

function GameDateSection({ title, accent, games }: { title: string; accent: string; games: HTGame[] }) {
  // Group by date
  const grouped: Record<string, HTGame[]> = {};
  for (const g of games) {
    const date = g.game_date || g.date;
    if (!grouped[date]) grouped[date] = [];
    grouped[date].push(g);
  }

  const accentColor = accent === "navy" ? "bg-navy" : "bg-muted/30";

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-1 h-4 rounded-full ${accentColor}`} />
        <h3 className="text-xs font-oswald font-bold uppercase tracking-wider text-navy">{title}</h3>
      </div>
      <div className="space-y-3">
        {Object.entries(grouped).map(([date, dateGames]) => (
          <div key={date}>
            <p className="text-[10px] font-oswald uppercase tracking-wider text-muted mb-1.5 pl-3">{date}</p>
            <div className="grid gap-2">
              {dateGames.map((g) => <GameCard key={g.game_id} game={g} />)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Teams Tab ────────────────────────────────────────────────────────

interface SyncResult {
  synced: number;
  created: number;
  updated: number;
  skipped: number;
  team_name: string;
  league: string;
  results: { name: string; action: string; player_id: string }[];
}

interface TransferResult {
  transfers: { player_id: string; name: string; old_team: string; new_team: string; league: string }[];
  checked: number;
  auto_updated: number;
  message: string;
}

interface BulkSyncResult {
  league: string;
  season_id: number;
  teams_synced: number;
  teams_failed: number;
  total_created: number;
  total_updated: number;
  total_skipped: number;
  team_results: { team_id: number; team_name: string; created?: number; updated?: number; skipped?: number; status: string; error?: string }[];
}

function TeamsTab({ teams, league }: { teams: HTTeam[]; league: string }) {
  const [syncing, setSyncing] = useState<number | null>(null);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [detectingTransfers, setDetectingTransfers] = useState(false);
  const [transferResult, setTransferResult] = useState<TransferResult | null>(null);
  const [syncError, setSyncError] = useState("");
  const [bulkSyncing, setBulkSyncing] = useState(false);
  const [bulkResult, setBulkResult] = useState<BulkSyncResult | null>(null);
  const [bulkProgress, setBulkProgress] = useState("");

  if (!teams.length) {
    return <EmptyState text="No teams data available" />;
  }

  const handleSync = async (teamId: number) => {
    setSyncing(teamId);
    setSyncResult(null);
    setSyncError("");
    try {
      const res = await api.post<SyncResult>(`/hockeytech/${league}/sync-roster/${teamId}?sync_stats=true`);
      setSyncResult(res.data);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } }; message?: string })?.response?.data?.detail ||
                  (err as { message?: string })?.message || "Sync failed";
      setSyncError(msg);
    } finally {
      setSyncing(null);
    }
  };

  const handleDetectTransfers = async () => {
    setDetectingTransfers(true);
    setTransferResult(null);
    setSyncError("");
    try {
      const res = await api.post<TransferResult>("/hockeytech/detect-transfers");
      setTransferResult(res.data);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } }; message?: string })?.response?.data?.detail ||
                  (err as { message?: string })?.message || "Transfer detection failed";
      setSyncError(msg);
    } finally {
      setDetectingTransfers(false);
    }
  };

  const handleBulkSync = async () => {
    setBulkSyncing(true);
    setBulkResult(null);
    setBulkProgress("Syncing all teams...");
    setSyncError("");
    setSyncResult(null);
    try {
      const res = await api.post<BulkSyncResult>(`/hockeytech/${league}/sync-league?sync_stats=true`);
      setBulkResult(res.data);
      setBulkProgress("");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } }; message?: string })?.response?.data?.detail ||
                  (err as { message?: string })?.message || "Bulk sync failed";
      setSyncError(msg);
      setBulkProgress("");
    } finally {
      setBulkSyncing(false);
    }
  };

  // Group by division
  const divisions: Record<string, HTTeam[]> = {};
  for (const t of teams) {
    const div = t.division || "Unknown";
    if (!divisions[div]) divisions[div] = [];
    divisions[div].push(t);
  }

  return (
    <div className="space-y-6">
      {/* Sync Actions Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={handleBulkSync}
          disabled={bulkSyncing || syncing !== null}
          className="flex items-center gap-2 px-4 py-2 bg-teal/10 text-teal border border-teal/20 rounded-lg text-sm font-semibold hover:bg-teal/20 transition-colors disabled:opacity-50"
        >
          {bulkSyncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          {bulkSyncing ? "Syncing League..." : "Sync All Teams"}
        </button>
        <button
          onClick={handleDetectTransfers}
          disabled={detectingTransfers || bulkSyncing}
          className="flex items-center gap-2 px-4 py-2 bg-orange/10 text-orange border border-orange/20 rounded-lg text-sm font-semibold hover:bg-orange/20 transition-colors disabled:opacity-50"
        >
          {detectingTransfers ? <Loader2 size={14} className="animate-spin" /> : <ArrowRightLeft size={14} />}
          Detect Transfers
        </button>
        <p className="text-xs text-muted">
          Sync imports all rosters into ProspectX — or click individual team sync buttons below
        </p>
      </div>

      {/* Sync Result Banner */}
      {syncResult && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 size={16} className="text-green-600" />
            <p className="font-semibold text-green-800 text-sm">
              Roster synced: {syncResult.team_name}
            </p>
          </div>
          <p className="text-xs text-green-700 mb-2">
            {syncResult.created} created &middot; {syncResult.updated} updated &middot; {syncResult.skipped} skipped
          </p>
          {syncResult.results.length > 0 && (
            <div className="max-h-40 overflow-y-auto space-y-0.5">
              {syncResult.results.map((r, i) => (
                <p key={i} className="text-xs text-green-700">
                  <span className={`inline-block w-20 font-medium ${r.action === "created" ? "text-teal" : "text-blue-600"}`}>
                    {r.action}
                  </span>
                  {r.name}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Bulk Sync Result Banner */}
      {bulkResult && (
        <div className="bg-teal/5 border border-teal/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 size={16} className="text-teal" />
            <p className="font-semibold text-navy text-sm">
              League Sync Complete
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
            <div className="text-center p-2 bg-white rounded-lg border border-teal/10">
              <p className="text-lg font-bold text-teal">{bulkResult.teams_synced}</p>
              <p className="text-[10px] text-muted uppercase tracking-wider">Teams Synced</p>
            </div>
            <div className="text-center p-2 bg-white rounded-lg border border-teal/10">
              <p className="text-lg font-bold text-green-600">{bulkResult.total_created}</p>
              <p className="text-[10px] text-muted uppercase tracking-wider">Players Created</p>
            </div>
            <div className="text-center p-2 bg-white rounded-lg border border-teal/10">
              <p className="text-lg font-bold text-blue-600">{bulkResult.total_updated}</p>
              <p className="text-[10px] text-muted uppercase tracking-wider">Updated</p>
            </div>
            <div className="text-center p-2 bg-white rounded-lg border border-teal/10">
              <p className="text-lg font-bold text-muted">{bulkResult.total_skipped}</p>
              <p className="text-[10px] text-muted uppercase tracking-wider">Skipped</p>
            </div>
          </div>
          {bulkResult.teams_failed > 0 && (
            <p className="text-xs text-red-600 mb-2">
              {bulkResult.teams_failed} team(s) failed to sync
            </p>
          )}
          <details className="text-xs">
            <summary className="cursor-pointer text-teal font-semibold hover:text-navy transition-colors">
              View team-by-team results ({bulkResult.team_results.length} teams)
            </summary>
            <div className="mt-2 max-h-48 overflow-y-auto space-y-0.5">
              {bulkResult.team_results.map((r, i) => (
                <p key={i} className={`${r.status === "failed" ? "text-red-600" : "text-green-700"}`}>
                  <span className="inline-block w-6 font-medium">{r.status === "success" ? "✓" : "✗"}</span>
                  <span className="font-medium">{r.team_name}</span>
                  {r.status === "success" && (
                    <span className="text-muted ml-2">
                      {r.created} new · {r.updated} updated · {r.skipped} skipped
                    </span>
                  )}
                  {r.error && <span className="text-red-500 ml-2">— {r.error}</span>}
                </p>
              ))}
            </div>
          </details>
        </div>
      )}

      {/* Transfer Result Banner */}
      {transferResult && (
        <div className={`border rounded-xl p-4 ${transferResult.transfers.length > 0 ? "bg-orange/5 border-orange/20" : "bg-blue-50 border-blue-200"}`}>
          <div className="flex items-center gap-2 mb-2">
            <ArrowRightLeft size={16} className={transferResult.transfers.length > 0 ? "text-orange" : "text-blue-600"} />
            <p className={`font-semibold text-sm ${transferResult.transfers.length > 0 ? "text-orange" : "text-blue-800"}`}>
              {transferResult.message}
            </p>
          </div>
          {transferResult.transfers.length > 0 && (
            <div className="space-y-1 mt-2">
              {transferResult.transfers.map((t, i) => (
                <p key={i} className="text-xs text-navy">
                  <span className="font-medium">{t.name}</span>: {t.old_team} → {t.new_team}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sync Error */}
      {syncError && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <AlertCircle size={16} />
          {syncError}
        </div>
      )}

      {Object.entries(divisions).map(([div, divTeams]) => (
        <div key={div} className="bg-white rounded-xl border border-teal/20 overflow-hidden">
          {/* Division Header */}
          <div className="flex items-center gap-3 px-5 py-3 bg-navy/[0.03] border-b border-teal/10">
            <div className="w-1 h-5 rounded-full bg-teal" />
            <h3 className="text-xs font-oswald font-bold uppercase tracking-wider text-navy">{div}</h3>
            <span className="text-[10px] text-muted font-medium">
              {divTeams.length} {divTeams.length === 1 ? "team" : "teams"}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border/30">
            {divTeams.map((team) => (
              <div
                key={team.id}
                className="bg-white p-3.5 hover:bg-teal/[0.02] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Link href={`/teams/${encodeURIComponent(team.name)}`} className="flex items-center gap-3 flex-1 min-w-0 group">
                    {team.logo ? (
                      <Image src={team.logo} alt={team.code} width={36} height={36} className="object-contain" unoptimized />
                    ) : (
                      <div className="w-9 h-9 rounded-lg bg-navy/[0.06] flex items-center justify-center shrink-0">
                        <Shield size={16} className="text-navy/30" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-navy text-sm truncate group-hover:text-teal transition-colors">{team.name}</p>
                      <p className="text-[11px] text-muted">{team.city} &middot; {team.code}</p>
                    </div>
                  </Link>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleSync(team.id); }}
                    disabled={syncing !== null || bulkSyncing}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-teal/10 text-teal border border-teal/20 rounded-lg text-xs font-semibold hover:bg-teal/20 transition-colors disabled:opacity-50 shrink-0"
                    title="Import this team's roster into ProspectX"
                  >
                    {syncing === team.id ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Download size={12} />
                    )}
                    Sync
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Empty State ──────────────────────────────────────────────────────

function EmptyState({ text }: { text: string }) {
  return (
    <div className="text-center py-16 text-muted">
      <Star size={32} className="mx-auto mb-3 opacity-30" />
      <p className="text-sm">{text}</p>
    </div>
  );
}
