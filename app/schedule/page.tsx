"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Image from "next/image";
import {
  Calendar,
  Loader2,
  RefreshCw,
  Shield,
  Star,
  Clock,
  MapPin,
} from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import api from "@/lib/api";
import type { HTGame, HTTeam } from "@/types/api";

// ── League options (all HockeyTech-supported leagues) ────────────────
// Grouped: Pro → Major Junior (CHL) → Junior A → Junior B
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

type TimeFrame = "today" | "week" | "month";

const SCHEDULE_LEAGUE_KEY = "prospectx_schedule_league";
const SCHEDULE_TEAM_KEY = "prospectx_schedule_team";

export default function SchedulePage() {
  const [league, setLeague] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(SCHEDULE_LEAGUE_KEY) || "gojhl";
    }
    return "gojhl";
  });
  const [games, setGames] = useState<HTGame[]>([]);
  const [teams, setTeams] = useState<HTTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [timeFrame, setTimeFrame] = useState<TimeFrame>("week");
  const [teamFilter, setTeamFilter] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(SCHEDULE_TEAM_KEY) || "";
    }
    return "";
  });
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const leagueInfo = LEAGUE_OPTIONS.find((l) => l.code === league) || LEAGUE_OPTIONS[0];

  // ── Fetch schedule data ──────────────────────────────────────
  const loadSchedule = useCallback(async (leagueCode: string) => {
    setLoading(true);
    setError("");
    try {
      const [gamesRes, teamsRes] = await Promise.all([
        api.get<HTGame[]>(`/hockeytech/${leagueCode}/scorebar?days_back=15&days_ahead=30`),
        api.get<HTTeam[]>(`/hockeytech/${leagueCode}/teams`),
      ]);
      setGames(gamesRes.data);
      setTeams(teamsRes.data);
      setLastRefresh(new Date());
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        (err as { message?: string })?.message ||
        "Failed to load schedule data";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSchedule(league);
  }, [league, loadSchedule]);

  // Persist league / team selection
  useEffect(() => {
    localStorage.setItem(SCHEDULE_LEAGUE_KEY, league);
  }, [league]);
  useEffect(() => {
    localStorage.setItem(SCHEDULE_TEAM_KEY, teamFilter);
  }, [teamFilter]);

  // Reset team filter when league changes (teams differ per league)
  const handleLeagueChange = (code: string) => {
    setTeamFilter("");
    setLeague(code);
  };

  const handleRefresh = () => loadSchedule(league);

  // ── Date helpers ─────────────────────────────────────────────
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toLocaleDateString("en-CA"); // YYYY-MM-DD

  // ── Filter and categorize games ──────────────────────────────
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

  const liveGames = useMemo(
    () =>
      filteredGames.filter((g) => {
        const isFinal =
          g.status === "Final" || g.status === "Final OT" || g.status === "Final SO";
        return !isFinal && g.status !== "" && g.period !== "";
      }),
    [filteredGames]
  );

  const todayNonLive = useMemo(
    () =>
      filteredGames.filter((g) => {
        const gameDate = g.game_date || g.date;
        const isFinal =
          g.status === "Final" || g.status === "Final OT" || g.status === "Final SO";
        const isLive = !isFinal && g.status !== "" && g.period !== "";
        return gameDate === todayStr && !isLive;
      }),
    [filteredGames, todayStr]
  );

  const upcomingGames = useMemo(
    () =>
      filteredGames
        .filter((g) => (g.game_date || g.date) > todayStr)
        .sort((a, b) => (a.game_date || a.date).localeCompare(b.game_date || b.date)),
    [filteredGames, todayStr]
  );

  const recentGames = useMemo(
    () =>
      filteredGames
        .filter((g) => {
          const gameDate = g.game_date || g.date;
          const isFinal =
            g.status === "Final" || g.status === "Final OT" || g.status === "Final SO";
          return gameDate < todayStr && isFinal;
        })
        .sort((a, b) => (b.game_date || b.date).localeCompare(a.game_date || a.date)),
    [filteredGames, todayStr]
  );

  // Count summary
  const gameCount = {
    live: liveGames.length,
    today: todayNonLive.length,
    upcoming: upcomingGames.length,
    recent: recentGames.length,
  };

  return (
    <ProtectedRoute>
      <NavBar />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* ── Header ──────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-lg bg-teal/10 flex items-center justify-center">
              <Calendar size={22} className="text-teal" />
            </div>
            <div>
              <h1 className="text-2xl font-bold font-oswald text-navy uppercase tracking-wider">
                Schedule
              </h1>
              <p className="text-sm text-muted">
                Live games, scores, and upcoming schedule from HockeyTech
              </p>
            </div>
          </div>

          {/* Refresh button */}
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-teal/10 text-teal border border-teal/20 rounded-lg text-sm font-semibold hover:bg-teal/20 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Refresh
            {lastRefresh && (
              <span className="text-[10px] text-muted/60 ml-1 hidden sm:inline">
                {lastRefresh.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
              </span>
            )}
          </button>
        </div>

        {/* ── League Selector ─────────────────────────────── */}
        <div className="bg-gradient-to-r from-navy to-navy-light rounded-xl p-4 mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="text-white">
              <p className="text-lg font-oswald font-bold">{leagueInfo.full}</p>
              <p className="text-white/50 text-xs mt-0.5">
                {teams.length} teams &middot; Live data from HockeyTech
              </p>
            </div>
            <select
              value={league}
              onChange={(e) => handleLeagueChange(e.target.value)}
              className="appearance-none bg-white/10 backdrop-blur border border-white/20 rounded-lg px-4 py-2.5 pr-10 text-sm font-oswald font-bold text-white uppercase tracking-wider cursor-pointer focus:outline-none focus:ring-2 focus:ring-white/30 transition-all [&>optgroup]:text-navy [&>option]:text-navy"
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
        </div>

        {/* ── Filters Row ─────────────────────────────────── */}
        <div className="flex flex-wrap items-end gap-3 mb-6">
          {/* Timeframe Toggle */}
          <div>
            <label className="block text-[10px] font-oswald uppercase tracking-wider text-muted mb-1">
              Timeframe
            </label>
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
          <div className="min-w-[200px]">
            <label className="block text-[10px] font-oswald uppercase tracking-wider text-muted mb-1">
              Team
            </label>
            <select
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              className="w-full border border-teal/20 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal/30"
            >
              <option value="">All Teams</option>
              {[...teams]
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((t) => (
                  <option key={t.id} value={t.name}>
                    {t.name}
                  </option>
                ))}
            </select>
          </div>

          <div className="flex-1" />

          {/* Quick Counts */}
          <div className="flex items-center gap-3 text-xs text-muted">
            {gameCount.live > 0 && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                {gameCount.live} live
              </span>
            )}
            <span>{gameCount.today} today</span>
            <span>{gameCount.upcoming} upcoming</span>
            <span>{gameCount.recent} recent</span>
          </div>
        </div>

        {/* ── Error ────────────────────────────────────────── */}
        {error && (
          <div className="mb-6 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center gap-2">
            <Star size={16} />
            {error}
          </div>
        )}

        {/* ── Loading State ────────────────────────────────── */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={32} className="text-teal animate-spin" />
            <span className="ml-3 text-muted">
              Loading {leagueInfo.label} schedule...
            </span>
          </div>
        ) : (
          <div className="space-y-6">
            {/* ── LIVE NOW ──────────────────────────────── */}
            {liveGames.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                  <h2 className="text-sm font-oswald font-bold uppercase tracking-wider text-red-600">
                    Live Now
                  </h2>
                  <span className="text-[10px] text-red-400 font-medium">
                    {liveGames.length} game{liveGames.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="grid gap-3">
                  {liveGames.map((g) => (
                    <GameCard key={g.game_id} game={g} highlight />
                  ))}
                </div>
              </div>
            )}

            {/* ── TODAY'S GAMES ─────────────────────────── */}
            {todayNonLive.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1 h-5 rounded-full bg-teal" />
                  <h2 className="text-sm font-oswald font-bold uppercase tracking-wider text-navy">
                    Today&apos;s Games
                  </h2>
                  <span className="text-[10px] text-muted font-medium">
                    {todayNonLive.length} game{todayNonLive.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="grid gap-3">
                  {todayNonLive.map((g) => (
                    <GameCard key={g.game_id} game={g} />
                  ))}
                </div>
              </div>
            )}

            {/* ── UPCOMING ─────────────────────────────── */}
            {upcomingGames.length > 0 && (
              <GameDateGroup
                title="Upcoming"
                accent="navy"
                games={upcomingGames}
              />
            )}

            {/* ── RECENT RESULTS ────────────────────────── */}
            {recentGames.length > 0 && (
              <GameDateGroup
                title="Recent Results"
                accent="muted"
                games={recentGames}
              />
            )}

            {/* ── Empty state ──────────────────────────── */}
            {filteredGames.length === 0 && (
              <div className="text-center py-16 text-muted">
                <Calendar size={32} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">
                  No games found for the selected filters.
                </p>
                <p className="text-xs text-muted/50 mt-1">
                  Try changing the timeframe or team filter.
                </p>
              </div>
            )}
          </div>
        )}
      </main>
    </ProtectedRoute>
  );
}

// ── Game Card ─────────────────────────────────────────────────────────

function GameCard({ game: g, highlight }: { game: HTGame; highlight?: boolean }) {
  const isFinal =
    g.status === "Final" || g.status === "Final OT" || g.status === "Final SO";
  const isLive = !isFinal && g.status !== "" && g.period !== "";
  const gameDate = g.game_date || g.date;

  // Determine winner for bold styling
  const homeWin = isFinal && Number(g.home_score) > Number(g.away_score);
  const awayWin = isFinal && Number(g.away_score) > Number(g.home_score);

  return (
    <div
      className={`bg-white rounded-xl border p-4 flex items-center gap-4 transition-all hover:shadow-sm ${
        highlight || isLive
          ? "border-red-300 shadow-sm ring-1 ring-red-100"
          : "border-teal/20 hover:border-teal/30"
      }`}
    >
      {/* Date (for non-today games) */}
      {gameDate !== new Date().toLocaleDateString("en-CA") && (
        <div className="hidden sm:flex flex-col items-center w-14 shrink-0">
          <p className="text-[10px] font-oswald uppercase tracking-wider text-muted">
            {new Date(gameDate + "T12:00:00").toLocaleDateString("en-US", {
              weekday: "short",
            })}
          </p>
          <p className="text-sm font-oswald font-bold text-navy">
            {new Date(gameDate + "T12:00:00").toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </p>
        </div>
      )}

      {/* Away Team */}
      <div className="flex-1 text-right">
        <div className="flex items-center justify-end gap-2">
          <div>
            <p
              className={`text-sm text-navy ${
                awayWin ? "font-bold" : "font-medium"
              }`}
            >
              {g.away_team || g.away_code}
            </p>
            <p className="text-[10px] text-muted">{g.away_code}</p>
          </div>
          {g.away_logo ? (
            <Image
              src={g.away_logo}
              alt={g.away_code}
              width={36}
              height={36}
              className="object-contain"
              unoptimized
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-navy/[0.06] flex items-center justify-center">
              <Shield size={14} className="text-navy/30" />
            </div>
          )}
        </div>
      </div>

      {/* Score / Time Center */}
      <div className="w-28 text-center flex-shrink-0">
        {isFinal || isLive ? (
          <>
            <p className="text-xl font-oswald font-bold text-navy">
              {g.away_score} — {g.home_score}
            </p>
            <p
              className={`text-xs font-semibold ${
                isLive ? "text-red-600" : "text-muted/60"
              }`}
            >
              {isLive ? (
                <span className="flex items-center justify-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  {g.period} {g.game_clock}
                </span>
              ) : (
                g.status
              )}
            </p>
          </>
        ) : (
          <>
            <p className="text-lg font-oswald font-bold text-navy flex items-center justify-center gap-1">
              <Clock size={13} className="text-muted/40" />
              {g.time || "TBD"}
            </p>
            <p className="text-[10px] text-muted/50">Scheduled</p>
          </>
        )}
      </div>

      {/* Home Team */}
      <div className="flex-1">
        <div className="flex items-center gap-2">
          {g.home_logo ? (
            <Image
              src={g.home_logo}
              alt={g.home_code}
              width={36}
              height={36}
              className="object-contain"
              unoptimized
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-navy/[0.06] flex items-center justify-center">
              <Shield size={14} className="text-navy/30" />
            </div>
          )}
          <div>
            <p
              className={`text-sm text-navy ${
                homeWin ? "font-bold" : "font-medium"
              }`}
            >
              {g.home_team || g.home_code}
            </p>
            <p className="text-[10px] text-muted">{g.home_code}</p>
          </div>
        </div>
      </div>

      {/* Venue */}
      {g.venue && (
        <div className="hidden lg:flex items-center gap-1 text-xs text-muted/50 w-40 text-right shrink-0">
          <MapPin size={10} className="shrink-0" />
          <span className="truncate">{g.venue}</span>
        </div>
      )}
    </div>
  );
}

// ── Game Date Group (groups games by date with header) ────────────────

function GameDateGroup({
  title,
  accent,
  games,
}: {
  title: string;
  accent: string;
  games: HTGame[];
}) {
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
        <div className={`w-1 h-5 rounded-full ${accentColor}`} />
        <h2 className="text-sm font-oswald font-bold uppercase tracking-wider text-navy">
          {title}
        </h2>
        <span className="text-[10px] text-muted font-medium">
          {games.length} game{games.length !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="space-y-4">
        {Object.entries(grouped).map(([date, dateGames]) => {
          const d = new Date(date + "T12:00:00");
          const formatted = d.toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          });
          return (
            <div key={date}>
              <p className="text-[11px] font-oswald uppercase tracking-wider text-muted/70 mb-2 pl-1 flex items-center gap-1.5">
                <Calendar size={10} />
                {formatted}
              </p>
              <div className="grid gap-3">
                {dateGames.map((g) => (
                  <GameCard key={g.game_id} game={g} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
