"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  BarChart3,
  Users,
  Building2,
  Target,
  Trophy,
  TrendingUp,
  FileText,
  Zap,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  X,
} from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import api from "@/lib/api";
import type {
  AnalyticsOverview,
  AnalyticsFilterOptions,
  ScoringLeader,
  TeamRanking,
  PositionStats,
  ScoringDistribution,
  ArchetypeBreakdown,
  TagCloudData,
  LeaguePlayerMetrics,
} from "@/types/api";
import {
  REPORT_TYPE_LABELS,
  ANALYTICS_CATEGORIES,
  NOTE_TAG_LABELS,
  METRIC_COLORS,
  METRIC_ICONS,
} from "@/types/api";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  ScatterChart,
  Scatter,
  Legend,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";

const CHART_COLORS = ["#18B3A6", "#F36F21", "#0F2A3D", "#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981"];
const POSITION_COLORS: Record<string, string> = {
  C: "#18B3A6",
  LW: "#F36F21",
  RW: "#f59e0b",
  D: "#0F2A3D",
  F: "#3b82f6",
  G: "#8b5cf6",
};

export default function AnalyticsPage() {
  return (
    <ProtectedRoute>
      <NavBar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AnalyticsDashboard />
      </main>
    </ProtectedRoute>
  );
}

function AnalyticsDashboard() {
  // Filter state
  const [filterOptions, setFilterOptions] = useState<AnalyticsFilterOptions | null>(null);
  const [selectedLeague, setSelectedLeague] = useState("");
  const [selectedTeam, setSelectedTeam] = useState("");
  const [selectedPosition, setSelectedPosition] = useState("");

  // Data state
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [leaders, setLeaders] = useState<ScoringLeader[]>([]);
  const [teamRankings, setTeamRankings] = useState<TeamRanking[]>([]);
  const [positionStats, setPositionStats] = useState<PositionStats[]>([]);
  const [scoringDist, setScoringDist] = useState<ScoringDistribution[]>([]);
  const [archetypes, setArchetypes] = useState<ArchetypeBreakdown[]>([]);
  const [tagCloud, setTagCloud] = useState<TagCloudData | null>(null);
  const [leagueMetrics, setLeagueMetrics] = useState<LeaguePlayerMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Teams filtered by selected league for the dropdown
  const filteredTeamOptions = useMemo(() => {
    if (!filterOptions) return [];
    if (!selectedLeague) return filterOptions.teams;
    return filterOptions.teams.filter((t) => t.league === selectedLeague);
  }, [filterOptions, selectedLeague]);

  // Build query string from filters
  const filterParams = useMemo(() => {
    const p = new URLSearchParams();
    if (selectedLeague) p.set("league", selectedLeague);
    if (selectedTeam) p.set("team", selectedTeam);
    if (selectedPosition) p.set("position", selectedPosition);
    return p.toString();
  }, [selectedLeague, selectedTeam, selectedPosition]);

  const hasFilters = selectedLeague || selectedTeam || selectedPosition;

  // Load filter options once
  useEffect(() => {
    api.get<AnalyticsFilterOptions>("/analytics/filters").then((r) => setFilterOptions(r.data)).catch(() => {});
  }, []);

  // Clear team if league changes and team no longer in that league
  useEffect(() => {
    if (selectedLeague && selectedTeam && filterOptions) {
      const teamInLeague = filterOptions.teams.find(
        (t) => t.name === selectedTeam && t.league === selectedLeague
      );
      if (!teamInLeague) setSelectedTeam("");
    }
  }, [selectedLeague, selectedTeam, filterOptions]);

  // Load analytics data (re-fetches when filters change)
  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const sep = filterParams ? "&" : "";
        const [overviewRes, leadersRes, teamsRes, posRes, distRes, archRes, tagRes, metricsRes] =
          await Promise.all([
            api.get<AnalyticsOverview>(`/analytics/overview?${filterParams}`),
            api.get<ScoringLeader[]>(`/analytics/scoring-leaders?limit=15${sep}${filterParams}`),
            api.get<TeamRanking[]>(`/analytics/team-rankings?${filterParams}`),
            api.get<PositionStats[]>(`/analytics/position-stats?${filterParams}`),
            api.get<ScoringDistribution[]>(`/analytics/scoring-distribution?min_gp=5${sep}${filterParams}`),
            api.get<ArchetypeBreakdown[]>(`/analytics/archetype-breakdown?${filterParams}`),
            api.get<TagCloudData>(`/analytics/tag-cloud?${filterParams}`),
            api.get<LeaguePlayerMetrics[]>(`/analytics/league-indices?min_gp=10&limit=20${sep}${filterParams}`),
          ]);
        setOverview(overviewRes.data);
        setLeaders(leadersRes.data);
        setTeamRankings(teamsRes.data);
        setPositionStats(posRes.data);
        setScoringDist(distRes.data);
        setArchetypes(archRes.data);
        setTagCloud(tagRes.data);
        setLeagueMetrics(metricsRes.data);
      } catch (err: unknown) {
        const msg =
          (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
          (err as { message?: string })?.message ||
          "Failed to load analytics";
        setError(msg);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [filterParams]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-navy border-t-teal" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
        <p className="text-red-700 font-medium text-sm">Analytics Error</p>
        <p className="text-red-600 text-xs mt-0.5">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy flex items-center gap-2">
            <BarChart3 size={24} className="text-teal" />
            Analytics Dashboard
          </h1>
          <p className="text-muted text-sm mt-1">
            Hockey intelligence across {overview?.total_players || 0} players and{" "}
            {overview?.total_teams || 0} teams
            {hasFilters && (
              <span className="ml-1 text-teal font-medium">(filtered)</span>
            )}
          </p>
        </div>
        <Link
          href="/reports/generate"
          className="hidden sm:flex items-center gap-2 px-4 py-2 bg-teal text-white text-sm font-oswald font-semibold uppercase tracking-wider rounded-lg hover:bg-teal/90 transition-colors"
        >
          <Zap size={16} />
          Generate Report
        </Link>
      </div>

      {/* Filter Bar */}
      {filterOptions && (filterOptions.leagues.length > 1 || filterOptions.teams.length > 1) && (
        <div className="bg-white rounded-xl border border-teal/20 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter size={14} className="text-muted" />
            <span className="text-xs font-oswald uppercase tracking-wider text-muted">
              Filter Analytics
            </span>
            {hasFilters && (
              <button
                onClick={() => { setSelectedLeague(""); setSelectedTeam(""); setSelectedPosition(""); }}
                className="ml-auto flex items-center gap-1 text-xs text-red-500 hover:text-red-700 transition-colors"
              >
                <X size={12} />
                Clear Filters
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            {/* League Filter */}
            {filterOptions.leagues.length > 1 && (
              <div className="flex-1 min-w-[160px]">
                <label className="block text-[10px] font-oswald uppercase tracking-wider text-muted mb-1">
                  League
                </label>
                <select
                  value={selectedLeague}
                  onChange={(e) => setSelectedLeague(e.target.value)}
                  className="w-full border border-teal/20 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal/30"
                >
                  <option value="">All Leagues</option>
                  {filterOptions.leagues.map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Team Filter */}
            <div className="flex-1 min-w-[180px]">
              <label className="block text-[10px] font-oswald uppercase tracking-wider text-muted mb-1">
                Team
              </label>
              <select
                value={selectedTeam}
                onChange={(e) => setSelectedTeam(e.target.value)}
                className="w-full border border-teal/20 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal/30"
              >
                <option value="">All Teams</option>
                {filteredTeamOptions.map((t) => (
                  <option key={t.name} value={t.name}>
                    {t.name}{t.league && !selectedLeague ? ` (${t.league})` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Position Filter */}
            <div className="min-w-[120px]">
              <label className="block text-[10px] font-oswald uppercase tracking-wider text-muted mb-1">
                Position
              </label>
              <select
                value={selectedPosition}
                onChange={(e) => setSelectedPosition(e.target.value)}
                className="w-full border border-teal/20 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal/30"
              >
                <option value="">All Positions</option>
                {filterOptions.positions.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Active filter chips */}
          {hasFilters && (
            <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-teal/20">
              {selectedLeague && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-teal/10 text-teal text-xs rounded-full">
                  {selectedLeague}
                  <button onClick={() => setSelectedLeague("")} className="hover:text-teal/70">
                    <X size={12} />
                  </button>
                </span>
              )}
              {selectedTeam && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-orange/10 text-orange text-xs rounded-full">
                  {selectedTeam}
                  <button onClick={() => setSelectedTeam("")} className="hover:text-orange/70">
                    <X size={12} />
                  </button>
                </span>
              )}
              {selectedPosition && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-navy/10 text-navy text-xs rounded-full">
                  {selectedPosition}
                  <button onClick={() => setSelectedPosition("")} className="hover:text-navy/70">
                    <X size={12} />
                  </button>
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Overview Stat Cards */}
      {overview && <OverviewCards overview={overview} />}

      {/* Analytics Category Cards */}
      <CategoryCards />

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Scoring Leaders */}
        {leaders.length > 0 && <ScoringLeadersChart leaders={leaders} />}

        {/* Position Breakdown Pie */}
        {overview && overview.position_breakdown.length > 0 && (
          <PositionBreakdownChart data={overview.position_breakdown} />
        )}

        {/* Team Rankings */}
        {teamRankings.length > 0 && <TeamRankingsChart rankings={teamRankings} />}

        {/* Points Per Game Distribution */}
        {scoringDist.length > 0 && <PPGDistributionChart data={scoringDist} />}

        {/* Position Averages Radar */}
        {positionStats.length > 0 && <PositionRadarChart data={positionStats} />}

        {/* Archetype Breakdown */}
        {archetypes.length > 0 && <ArchetypeChart data={archetypes} />}
      </div>

      {/* ProspectX Metrics Leaderboard */}
      {leagueMetrics.length > 0 && (
        <LeagueMetricsTable data={leagueMetrics} />
      )}

      {/* Scouting Tag Frequency */}
      {tagCloud && (tagCloud.scout_note_tags.length > 0 || tagCloud.intelligence_tags.length > 0) && (
        <TagFrequencyChart data={tagCloud} />
      )}

      {/* Scoring Leaderboard Table */}
      {leaders.length > 0 && <LeaderboardTable leaders={leaders} />}
    </div>
  );
}

// ── Overview Stat Cards ─────────────────────────
function OverviewCards({ overview }: { overview: AnalyticsOverview }) {
  const cards = [
    {
      label: "Players Tracked",
      value: overview.total_players,
      sub: `${overview.players_with_stats} with stats`,
      icon: Users,
      color: "teal",
      href: "/players",
    },
    {
      label: "Reports Generated",
      value: overview.total_reports,
      sub: `${overview.reports_by_status.find((s) => s.status === "complete")?.count || 0} complete`,
      icon: FileText,
      color: "orange",
      href: "/reports",
    },
    {
      label: "Teams Scouted",
      value: overview.total_teams,
      sub: "across leagues",
      icon: Building2,
      color: "navy",
      href: "/teams",
    },
    {
      label: "Scout Notes",
      value: overview.total_notes,
      sub: `${overview.players_with_intelligence} AI profiles`,
      icon: TrendingUp,
      color: "teal",
      href: "/players",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c) => (
        <Link
          key={c.label}
          href={c.href}
          className="bg-white rounded-xl border border-teal/20 p-5 hover:shadow-md transition-shadow group"
        >
          <div className="flex items-center justify-between mb-2">
            <c.icon
              size={20}
              className={
                c.color === "teal"
                  ? "text-teal"
                  : c.color === "orange"
                    ? "text-orange"
                    : "text-navy"
              }
            />
            <ChevronRight
              size={14}
              className="text-muted/30 group-hover:text-teal transition-colors"
            />
          </div>
          <p className="text-2xl font-oswald font-bold text-navy">{c.value}</p>
          <p className="text-xs text-muted font-oswald uppercase tracking-wider">
            {c.label}
          </p>
          <p className="text-xs text-muted/60 mt-0.5">{c.sub}</p>
        </Link>
      ))}
    </div>
  );
}

// ── Analytics Category Cards ────────────────────
function CategoryCards() {
  const categories = [
    {
      key: "player",
      ...ANALYTICS_CATEGORIES.player,
      icon: Users,
      color: "bg-teal/10 text-teal",
      borderColor: "border-teal/20",
      count: Object.values(ANALYTICS_CATEGORIES.player.subcategories).reduce(
        (sum, sc) => sum + sc.types.length,
        0
      ),
    },
    {
      key: "team",
      ...ANALYTICS_CATEGORIES.team,
      icon: Building2,
      color: "bg-orange/10 text-orange",
      borderColor: "border-orange/20",
      count: Object.values(ANALYTICS_CATEGORIES.team.subcategories).reduce(
        (sum, sc) => sum + sc.types.length,
        0
      ),
    },
    {
      key: "competitive",
      ...ANALYTICS_CATEGORIES.competitive,
      icon: Target,
      color: "bg-navy/10 text-navy",
      borderColor: "border-navy/20",
      count: Object.values(ANALYTICS_CATEGORIES.competitive.subcategories).reduce(
        (sum, sc) => sum + sc.types.length,
        0
      ),
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {categories.map((cat) => (
        <div
          key={cat.key}
          className={`bg-white rounded-xl border ${cat.borderColor} p-6 hover:shadow-md transition-shadow`}
        >
          <div className="flex items-center gap-3 mb-3">
            <div
              className={`w-10 h-10 rounded-lg ${cat.color} flex items-center justify-center`}
            >
              <cat.icon size={20} />
            </div>
            <div>
              <h3 className="font-oswald font-semibold text-navy text-sm">
                {cat.label}
              </h3>
              <p className="text-xs text-muted">{cat.description}</p>
            </div>
          </div>

          <div className="space-y-2 mt-4">
            {Object.entries(cat.subcategories).map(([key, sub]) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-xs text-navy/70">{sub.label}</span>
                <span className="text-xs text-muted bg-gray-50 px-2 py-0.5 rounded-full">
                  {sub.types.length} reports
                </span>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-3 border-t border-teal/20">
            <Link
              href="/reports/generate"
              className="text-xs font-oswald uppercase tracking-wider text-teal hover:underline flex items-center gap-1"
            >
              Generate <ChevronRight size={12} />
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Scoring Leaders Bar Chart ───────────────────
function ScoringLeadersChart({ leaders }: { leaders: ScoringLeader[] }) {
  const data = leaders.slice(0, 10).map((l) => ({
    name: `${l.first_name[0]}. ${l.last_name}`,
    goals: l.g,
    assists: l.a,
    points: l.p,
    team: l.current_team || "—",
  }));

  return (
    <ChartCard title="Scoring Leaders" subtitle="Top 10 by total points">
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} layout="vertical" margin={{ left: 80, right: 20, top: 5, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis type="number" tick={{ fontSize: 11 }} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={75} />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />
          <Bar dataKey="goals" stackId="pts" fill="#18B3A6" name="Goals" radius={[0, 0, 0, 0]} />
          <Bar dataKey="assists" stackId="pts" fill="#F36F21" name="Assists" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ── Position Breakdown Pie ──────────────────────
function PositionBreakdownChart({
  data,
}: {
  data: Array<{ position: string; count: number }>;
}) {
  const chartData = data.map((d) => ({
    name: d.position,
    value: d.count,
    color: POSITION_COLORS[d.position] || "#9ca3af",
  }));

  return (
    <ChartCard title="Position Breakdown" subtitle="Players by position">
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={3}
            dataKey="value"
            label={({ name, value }) => `${name} (${value})`}
          >
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
        </PieChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ── Team Rankings ───────────────────────────────
function TeamRankingsChart({ rankings }: { rankings: TeamRanking[] }) {
  const data = rankings.slice(0, 8).map((t) => ({
    name: t.team.replace(/ /g, "\n").split("\n").pop() || t.team,
    fullName: t.team,
    avgPPG: t.avg_ppg,
    totalPoints: t.total_points,
    players: t.qualified_players,
  }));

  return (
    <ChartCard title="Team Rankings" subtitle="By average points-per-game">
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ left: 10, right: 20, top: 5, bottom: 30 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
            labelFormatter={(name) => {
              const found = data.find((d) => d.name === name);
              return found?.fullName || String(name);
            }}
          />
          <Bar dataKey="avgPPG" fill="#18B3A6" name="Avg PPG" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ── PPG Distribution Scatter ────────────────────
function PPGDistributionChart({ data }: { data: ScoringDistribution[] }) {
  // Group by position for colored dots
  const positions = Array.from(new Set(data.map((d) => d.position)));

  return (
    <ChartCard title="Scoring Distribution" subtitle="Goals vs Assists (min 5 GP)">
      <ResponsiveContainer width="100%" height={300}>
        <ScatterChart margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            type="number"
            dataKey="g"
            name="Goals"
            tick={{ fontSize: 11 }}
            label={{ value: "Goals", position: "bottom", fontSize: 11, offset: -5 }}
          />
          <YAxis
            type="number"
            dataKey="a"
            name="Assists"
            tick={{ fontSize: 11 }}
            label={{ value: "Assists", angle: -90, position: "insideLeft", fontSize: 11 }}
          />
          <Tooltip
            content={({ payload }) => {
              if (!payload || payload.length === 0) return null;
              const p = payload[0]?.payload;
              if (!p) return null;
              return (
                <div className="bg-white shadow-lg rounded-lg p-2 border border-teal/20 text-xs">
                  <p className="font-semibold text-navy">
                    {p.first_name} {p.last_name}
                  </p>
                  <p className="text-muted">
                    {p.position} &middot; {p.current_team || "—"}
                  </p>
                  <p className="mt-1">
                    {p.g}G - {p.a}A - {p.p}P ({p.ppg.toFixed(2)} PPG)
                  </p>
                </div>
              );
            }}
          />
          <Legend verticalAlign="top" height={30} />
          {positions.map((pos) => (
            <Scatter
              key={pos}
              name={pos}
              data={data.filter((d) => d.position === pos)}
              fill={POSITION_COLORS[pos] || "#9ca3af"}
              opacity={0.8}
            />
          ))}
        </ScatterChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ── Position Averages Radar ─────────────────────
function PositionRadarChart({ data }: { data: PositionStats[] }) {
  // Normalize each stat to 0-100 scale relative to the max across positions
  const maxPPG = Math.max(...data.map((d) => d.avg_ppg || 0), 0.01);
  const maxGPG = Math.max(...data.map((d) => d.avg_gpg || 0), 0.01);
  const maxPM = Math.max(...data.map((d) => Math.abs(d.avg_plus_minus || 0)), 0.01);
  const maxPIM = Math.max(...data.map((d) => d.avg_pim || 0), 0.01);
  const maxGP = Math.max(...data.map((d) => d.avg_gp || 0), 0.01);

  const radarData: Array<Record<string, string | number>> = [
    { stat: "PPG" },
    { stat: "GPG" },
    { stat: "+/-" },
    { stat: "PIM" },
    { stat: "GP" },
  ];

  // Skip positions with very few players
  const positions = data.filter((d) => d.player_count >= 2);
  positions.forEach((pos) => {
    radarData[0][pos.position as string] = Math.round(((pos.avg_ppg || 0) / maxPPG) * 100);
    radarData[1][pos.position as string] = Math.round(((pos.avg_gpg || 0) / maxGPG) * 100);
    radarData[2][pos.position as string] = Math.round(
      (Math.abs(pos.avg_plus_minus || 0) / maxPM) * 100
    );
    radarData[3][pos.position as string] = Math.round(((pos.avg_pim || 0) / maxPIM) * 100);
    radarData[4][pos.position as string] = Math.round(((pos.avg_gp || 0) / maxGP) * 100);
  });

  return (
    <ChartCard title="Position Averages" subtitle="Normalized comparison by position">
      <ResponsiveContainer width="100%" height={300}>
        <RadarChart data={radarData} cx="50%" cy="50%" outerRadius={100}>
          <PolarGrid stroke="#e5e7eb" />
          <PolarAngleAxis dataKey="stat" tick={{ fontSize: 11 }} />
          <PolarRadiusAxis tick={false} axisLine={false} />
          {positions.map((pos, i) => (
            <Radar
              key={pos.position}
              name={pos.position}
              dataKey={pos.position}
              stroke={POSITION_COLORS[pos.position] || CHART_COLORS[i]}
              fill={POSITION_COLORS[pos.position] || CHART_COLORS[i]}
              fillOpacity={0.15}
              strokeWidth={2}
            />
          ))}
          <Legend verticalAlign="top" height={30} />
          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
        </RadarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ── Archetype Breakdown ─────────────────────────
function ArchetypeChart({ data }: { data: ArchetypeBreakdown[] }) {
  const chartData = data.map((d, i) => ({
    name: d.archetype,
    count: d.count,
    confidence: Math.round((d.avg_confidence || 0) * 100),
    fill: CHART_COLORS[i % CHART_COLORS.length],
  }));

  return (
    <ChartCard title="Player Archetypes" subtitle="AI-assigned player archetypes">
      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ left: 120, right: 20, top: 5, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis type="number" tick={{ fontSize: 11 }} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={115} />
          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
          <Bar dataKey="count" fill="#18B3A6" radius={[0, 4, 4, 0]} name="Players" />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ── Tag Frequency Chart ─────────────────────────
function TagFrequencyChart({ data }: { data: TagCloudData }) {
  const allTags = [
    ...data.scout_note_tags.map((t) => ({ ...t, source: "scout" })),
    ...data.intelligence_tags.map((t) => ({ ...t, source: "ai" })),
  ];

  // Merge by tag
  const merged: Record<string, { scout: number; ai: number }> = {};
  allTags.forEach((t) => {
    if (!merged[t.tag]) merged[t.tag] = { scout: 0, ai: 0 };
    if (t.source === "scout") merged[t.tag].scout += t.count;
    else merged[t.tag].ai += t.count;
  });

  const chartData = Object.entries(merged)
    .map(([tag, counts]) => ({
      tag: NOTE_TAG_LABELS[tag] || tag,
      scout: counts.scout,
      ai: counts.ai,
      total: counts.scout + counts.ai,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 12);

  if (chartData.length === 0) return null;

  return (
    <ChartCard title="Scouting Focus Areas" subtitle="Tag frequency from scout notes and AI intelligence" fullWidth>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={chartData} margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="tag" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
          <Legend verticalAlign="top" height={30} />
          <Bar dataKey="scout" stackId="tags" fill="#18B3A6" name="Scout Notes" radius={[0, 0, 0, 0]} />
          <Bar dataKey="ai" stackId="tags" fill="#F36F21" name="AI Intelligence" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ── Leaderboard Table ───────────────────────────
function LeaderboardTable({ leaders }: { leaders: ScoringLeader[] }) {
  return (
    <div className="bg-white rounded-xl border border-teal/20 overflow-hidden">
      <div className="px-5 py-4 border-b border-teal/20 flex items-center justify-between">
        <div>
          <h3 className="font-oswald font-semibold text-navy text-sm uppercase tracking-wider">
            Scoring Leaderboard
          </h3>
          <p className="text-xs text-muted mt-0.5">
            Top players by total points (min 5 GP)
          </p>
        </div>
        <Link href="/players" className="text-xs text-teal hover:underline">
          View All Players
        </Link>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left">
              <th className="px-4 py-2 font-oswald text-xs uppercase tracking-wider text-muted w-8">
                #
              </th>
              <th className="px-4 py-2 font-oswald text-xs uppercase tracking-wider text-muted">
                Player
              </th>
              <th className="px-4 py-2 font-oswald text-xs uppercase tracking-wider text-muted">
                Pos
              </th>
              <th className="px-4 py-2 font-oswald text-xs uppercase tracking-wider text-muted">
                Team
              </th>
              <th className="px-4 py-2 font-oswald text-xs uppercase tracking-wider text-muted text-right">
                GP
              </th>
              <th className="px-4 py-2 font-oswald text-xs uppercase tracking-wider text-muted text-right">
                G
              </th>
              <th className="px-4 py-2 font-oswald text-xs uppercase tracking-wider text-muted text-right">
                A
              </th>
              <th className="px-4 py-2 font-oswald text-xs uppercase tracking-wider text-muted text-right">
                P
              </th>
              <th className="px-4 py-2 font-oswald text-xs uppercase tracking-wider text-muted text-right">
                PPG
              </th>
              <th className="px-4 py-2 font-oswald text-xs uppercase tracking-wider text-muted text-right">
                +/-
              </th>
            </tr>
          </thead>
          <tbody>
            {leaders.map((l, i) => (
              <tr
                key={l.id + i}
                className={`border-t border-teal/20 hover:bg-gray-50 transition-colors ${
                  i < 3 ? "bg-teal/5" : ""
                }`}
              >
                <td className="px-4 py-2.5">
                  <span
                    className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                      i === 0
                        ? "bg-yellow-100 text-yellow-700"
                        : i === 1
                          ? "bg-gray-100 text-gray-600"
                          : i === 2
                            ? "bg-orange-100 text-orange-700"
                            : "text-muted"
                    }`}
                  >
                    {i + 1}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <Link
                    href={`/players/${l.id}`}
                    className="font-medium text-navy hover:text-teal transition-colors"
                  >
                    {l.first_name} {l.last_name}
                  </Link>
                </td>
                <td className="px-4 py-2.5">
                  <span
                    className="inline-block px-2 py-0.5 rounded text-xs font-medium"
                    style={{
                      backgroundColor: (POSITION_COLORS[l.position] || "#9ca3af") + "20",
                      color: POSITION_COLORS[l.position] || "#9ca3af",
                    }}
                  >
                    {l.position}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-muted text-xs">
                  {l.current_team || "—"}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">{l.gp}</td>
                <td className="px-4 py-2.5 text-right tabular-nums font-medium">{l.g}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{l.a}</td>
                <td className="px-4 py-2.5 text-right tabular-nums font-bold text-navy">
                  {l.p}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-teal font-medium">
                  {l.ppg.toFixed(2)}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  <span
                    className={`inline-flex items-center gap-0.5 ${
                      l.plus_minus > 0
                        ? "text-green-600"
                        : l.plus_minus < 0
                          ? "text-red-500"
                          : "text-muted"
                    }`}
                  >
                    {l.plus_minus > 0 && <ArrowUpRight size={12} />}
                    {l.plus_minus < 0 && <ArrowDownRight size={12} />}
                    {l.plus_minus > 0 ? "+" : ""}
                    {l.plus_minus}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── League ProspectX Metrics Table ───────────────
function LeagueMetricsTable({ data }: { data: LeaguePlayerMetrics[] }) {
  const metricKeys = ["sniper", "playmaker", "transition", "defensive", "compete", "hockey_iq"] as const;

  return (
    <div className="bg-white rounded-xl border border-teal/20 overflow-hidden">
      <div className="px-5 py-4 border-b border-teal/20 flex items-center justify-between">
        <div>
          <h3 className="font-oswald font-semibold text-navy text-sm uppercase tracking-wider">
            ProspectX Metrics — League View
          </h3>
          <p className="text-xs text-muted mt-0.5">
            Proprietary performance metrics across {data.length} qualified players (min 10 GP)
          </p>
        </div>
        <span className="text-[8px] font-oswald uppercase tracking-widest text-muted/40 bg-navy/[0.03] px-2 py-1 rounded">
          ProspectX Exclusive
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left">
              <th className="px-4 py-2 font-oswald text-xs uppercase tracking-wider text-muted w-8">#</th>
              <th className="px-4 py-2 font-oswald text-xs uppercase tracking-wider text-muted">Player</th>
              <th className="px-4 py-2 font-oswald text-xs uppercase tracking-wider text-muted">Pos</th>
              {metricKeys.map((key) => (
                <th
                  key={key}
                  className="px-2 py-2 font-oswald text-[10px] uppercase tracking-wider text-center"
                  style={{ color: METRIC_COLORS[key] }}
                  title={data[0]?.indices[key]?.description || ""}
                >
                  {METRIC_ICONS[key]} {key === "hockey_iq" ? "IQ" : key.charAt(0).toUpperCase() + key.slice(1, 5)}
                </th>
              ))}
              <th className="px-3 py-2 font-oswald text-xs uppercase tracking-wider text-muted text-center">Avg</th>
            </tr>
          </thead>
          <tbody>
            {data.map((player, i) => {
              const avg = Math.round(
                metricKeys.reduce((sum, k) => sum + (player.indices[k]?.value || 0), 0) / metricKeys.length
              );
              return (
                <tr key={player.player_id} className="border-t border-teal/20 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-2 text-xs text-muted">{i + 1}</td>
                  <td className="px-4 py-2">
                    <Link
                      href={`/players/${player.player_id}`}
                      className="font-medium text-navy hover:text-teal transition-colors text-sm"
                    >
                      {player.player_name}
                    </Link>
                    <span className="text-[10px] text-muted ml-1.5">{player.current_team || ""}</span>
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium"
                      style={{
                        backgroundColor: (POSITION_COLORS[player.position] || "#9ca3af") + "20",
                        color: POSITION_COLORS[player.position] || "#9ca3af",
                      }}
                    >
                      {player.position}
                    </span>
                  </td>
                  {metricKeys.map((key) => {
                    const idx = player.indices[key];
                    const val = idx?.value || 0;
                    const color = METRIC_COLORS[key] || "#9ca3af";
                    return (
                      <td key={key} className="px-2 py-2 text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="text-xs font-bold tabular-nums" style={{ color }}>{val}</span>
                          <div className="w-10 h-1 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${val}%`, backgroundColor: color, opacity: 0.7 }}
                            />
                          </div>
                        </div>
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-center">
                    <span
                      className={`text-xs font-bold tabular-nums ${
                        avg >= 70 ? "text-teal" : avg >= 45 ? "text-orange" : "text-muted"
                      }`}
                    >
                      {avg}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Chart Card Wrapper ──────────────────────────
function ChartCard({
  title,
  subtitle,
  children,
  fullWidth,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  fullWidth?: boolean;
}) {
  return (
    <div
      className={`bg-white rounded-xl border border-teal/20 p-5 ${
        fullWidth ? "col-span-full" : ""
      }`}
    >
      <div className="mb-4">
        <h3 className="font-oswald font-semibold text-navy text-sm uppercase tracking-wider">
          {title}
        </h3>
        {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
