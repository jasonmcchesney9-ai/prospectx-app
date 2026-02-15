"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Search, PlusCircle, Filter, ChevronDown, ChevronUp, X, Settings,
  LayoutGrid, List, Save, Bookmark, Download, ArrowUpDown,
  Activity, Brain, Ruler,
} from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import VisualPlayerCard from "@/components/VisualPlayerCard";
import api from "@/lib/api";
import type { Player, PlayerFilterOptions, PlayerCardData, SavedSearch } from "@/types/api";
import { AGE_GROUP_LABELS, LEAGUE_TIER_LABELS, COMMITMENT_STATUS_COLORS } from "@/types/api";

const POSITIONS = ["", "C", "LW", "RW", "F", "LD", "RD", "D", "G"];

const GRADE_OPTIONS = ["A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D"];

const SORT_OPTIONS = [
  { value: "name", label: "Name" },
  { value: "gp", label: "Games Played" },
  { value: "goals", label: "Goals" },
  { value: "assists", label: "Assists" },
  { value: "points", label: "Points" },
  { value: "ppg", label: "PPG" },
  { value: "grade", label: "Grade" },
  { value: "team", label: "Team" },
  { value: "position", label: "Position" },
];

// ── Filter group collapse component ──────────────────────
function FilterGroup({
  label,
  icon: Icon,
  defaultOpen = true,
  children,
}: {
  label: string;
  icon: React.ElementType;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-border/30 last:border-b-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full py-2 text-left"
      >
        <div className="flex items-center gap-1.5">
          <Icon size={12} className="text-teal" />
          <span className="text-[10px] font-oswald uppercase tracking-wider text-navy/70 font-bold">{label}</span>
        </div>
        {open ? <ChevronUp size={10} className="text-muted" /> : <ChevronDown size={10} className="text-muted" />}
      </button>
      {open && <div className="pb-3">{children}</div>}
    </div>
  );
}

// ── Mini number input ────────────────────────────────────
function NumberInput({
  label,
  value,
  onChange,
  placeholder,
  step,
  min,
  max,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  step?: string;
  min?: number;
  max?: number;
}) {
  return (
    <div>
      <label className="block text-[10px] font-oswald uppercase tracking-wider text-muted mb-1">{label}</label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        step={step}
        min={min}
        max={max}
        className="w-full px-2.5 py-1.5 border border-border rounded-lg text-sm bg-white tabular-nums"
      />
    </div>
  );
}

export default function PlayersPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [cardData, setCardData] = useState<PlayerCardData[]>([]);
  const [filterOptions, setFilterOptions] = useState<PlayerFilterOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [posFilter, setPosFilter] = useState("");
  const [teamFilter, setTeamFilter] = useState("");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // ── Demographics filters ──
  const [leagueFilter, setLeagueFilter] = useState("");
  const [birthYearFilter, setBirthYearFilter] = useState("");
  const [ageGroupFilter, setAgeGroupFilter] = useState("");
  const [leagueTierFilter, setLeagueTierFilter] = useState("");
  const [commitmentFilter, setCommitmentFilter] = useState("");

  // ── Physical filters ──
  const [shootsFilter, setShootsFilter] = useState("");
  const [minHeightFilter, setMinHeightFilter] = useState("");
  const [maxHeightFilter, setMaxHeightFilter] = useState("");
  const [minWeightFilter, setMinWeightFilter] = useState("");
  const [maxWeightFilter, setMaxWeightFilter] = useState("");

  // ── Stats filters ──
  const [minGpFilter, setMinGpFilter] = useState("");
  const [minGoalsFilter, setMinGoalsFilter] = useState("");
  const [minPointsFilter, setMinPointsFilter] = useState("");
  const [minPpgFilter, setMinPpgFilter] = useState("");
  const [hasStatsFilter, setHasStatsFilter] = useState(false);

  // ── Intelligence filters ──
  const [gradeFilter, setGradeFilter] = useState("");
  const [archetypeFilter, setArchetypeFilter] = useState("");

  // ── Sort ──
  const [sortBy, setSortBy] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // ── Saved searches ──
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveSearchName, setSaveSearchName] = useState("");

  // Count active advanced filters
  const advancedFilterCount = [
    leagueFilter, birthYearFilter, ageGroupFilter, leagueTierFilter, commitmentFilter,
    shootsFilter, minHeightFilter, maxHeightFilter, minWeightFilter, maxWeightFilter,
    minGpFilter, minGoalsFilter, minPointsFilter, minPpgFilter,
    gradeFilter, archetypeFilter, sortBy,
  ].filter(Boolean).length + (hasStatsFilter ? 1 : 0);

  // ── Load filter options + saved searches on mount ──
  useEffect(() => {
    async function loadFilters() {
      try {
        const { data } = await api.get<PlayerFilterOptions>("/players/filter-options");
        setFilterOptions(data);
      } catch {
        // Non-critical
      }
    }
    async function loadSaved() {
      try {
        const { data } = await api.get<SavedSearch[]>("/players/search/saved");
        setSavedSearches(data);
      } catch {
        // Non-critical
      }
    }
    loadFilters();
    loadSaved();
  }, []);

  // ── Build params and fetch players ──
  useEffect(() => {
    async function load() {
      try {
        setError("");
        const params = new URLSearchParams();
        if (search) params.set("search", search);
        if (posFilter) params.set("position", posFilter);
        if (teamFilter) params.set("team", teamFilter);

        // Demographics
        if (leagueFilter) params.set("league", leagueFilter);
        if (birthYearFilter) params.set("birth_year", birthYearFilter);
        if (ageGroupFilter) params.set("age_group", ageGroupFilter);
        if (leagueTierFilter) params.set("league_tier", leagueTierFilter);
        if (commitmentFilter) params.set("commitment_status", commitmentFilter);

        // Physical
        if (shootsFilter) params.set("shoots", shootsFilter);
        if (minHeightFilter) params.set("min_height", minHeightFilter);
        if (maxHeightFilter) params.set("max_height", maxHeightFilter);
        if (minWeightFilter) params.set("min_weight", minWeightFilter);
        if (maxWeightFilter) params.set("max_weight", maxWeightFilter);

        // Stats
        if (minGpFilter) params.set("min_gp", minGpFilter);
        if (minGoalsFilter) params.set("min_goals", minGoalsFilter);
        if (minPointsFilter) params.set("min_points", minPointsFilter);
        if (minPpgFilter) params.set("min_ppg", minPpgFilter);
        if (hasStatsFilter) params.set("has_stats", "true");

        // Intelligence
        if (gradeFilter) params.set("overall_grade", gradeFilter);
        if (archetypeFilter) params.set("archetype", archetypeFilter);

        // Sort
        if (sortBy) params.set("sort_by", sortBy);
        if (sortBy) params.set("sort_dir", sortDir);

        if (viewMode === "cards") {
          params.set("limit", "100");
          const { data } = await api.get<PlayerCardData[]>(`/players/cards?${params}`);
          setCardData(data);
        } else {
          params.set("limit", "1000");
          const { data } = await api.get<Player[]>(`/players?${params}`);
          setPlayers(data);
        }
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed to load players";
        setError(msg);
      } finally {
        setLoading(false);
      }
    }
    const timer = setTimeout(load, 300);
    return () => clearTimeout(timer);
  }, [
    search, posFilter, teamFilter, viewMode,
    leagueFilter, birthYearFilter, ageGroupFilter, leagueTierFilter, commitmentFilter,
    shootsFilter, minHeightFilter, maxHeightFilter, minWeightFilter, maxWeightFilter,
    minGpFilter, minGoalsFilter, minPointsFilter, minPpgFilter, hasStatsFilter,
    gradeFilter, archetypeFilter, sortBy, sortDir,
  ]);

  // ── Clear all advanced filters ──
  const clearAdvancedFilters = () => {
    setLeagueFilter(""); setBirthYearFilter(""); setAgeGroupFilter("");
    setLeagueTierFilter(""); setCommitmentFilter("");
    setShootsFilter(""); setMinHeightFilter(""); setMaxHeightFilter("");
    setMinWeightFilter(""); setMaxWeightFilter("");
    setMinGpFilter(""); setMinGoalsFilter(""); setMinPointsFilter("");
    setMinPpgFilter(""); setHasStatsFilter(false);
    setGradeFilter(""); setArchetypeFilter("");
    setSortBy(""); setSortDir("asc");
  };

  // ── Collect current filters as an object ──
  const getCurrentFilters = useCallback(() => {
    const f: Record<string, string | number | boolean | null> = {};
    if (search) f.search = search;
    if (posFilter) f.position = posFilter;
    if (teamFilter) f.team = teamFilter;
    if (leagueFilter) f.league = leagueFilter;
    if (birthYearFilter) f.birth_year = birthYearFilter;
    if (ageGroupFilter) f.age_group = ageGroupFilter;
    if (leagueTierFilter) f.league_tier = leagueTierFilter;
    if (commitmentFilter) f.commitment_status = commitmentFilter;
    if (shootsFilter) f.shoots = shootsFilter;
    if (minHeightFilter) f.min_height = minHeightFilter;
    if (maxHeightFilter) f.max_height = maxHeightFilter;
    if (minWeightFilter) f.min_weight = minWeightFilter;
    if (maxWeightFilter) f.max_weight = maxWeightFilter;
    if (minGpFilter) f.min_gp = minGpFilter;
    if (minGoalsFilter) f.min_goals = minGoalsFilter;
    if (minPointsFilter) f.min_points = minPointsFilter;
    if (minPpgFilter) f.min_ppg = minPpgFilter;
    if (hasStatsFilter) f.has_stats = true;
    if (gradeFilter) f.overall_grade = gradeFilter;
    if (archetypeFilter) f.archetype = archetypeFilter;
    if (sortBy) f.sort_by = sortBy;
    if (sortBy) f.sort_dir = sortDir;
    return f;
  }, [
    search, posFilter, teamFilter,
    leagueFilter, birthYearFilter, ageGroupFilter, leagueTierFilter, commitmentFilter,
    shootsFilter, minHeightFilter, maxHeightFilter, minWeightFilter, maxWeightFilter,
    minGpFilter, minGoalsFilter, minPointsFilter, minPpgFilter, hasStatsFilter,
    gradeFilter, archetypeFilter, sortBy, sortDir,
  ]);

  // ── Load a saved search ──
  const loadSavedSearch = (ss: SavedSearch) => {
    const f = ss.filters;
    setSearch((f.search as string) || "");
    setPosFilter((f.position as string) || "");
    setTeamFilter((f.team as string) || "");
    setLeagueFilter((f.league as string) || "");
    setBirthYearFilter((f.birth_year as string) || "");
    setAgeGroupFilter((f.age_group as string) || "");
    setLeagueTierFilter((f.league_tier as string) || "");
    setCommitmentFilter((f.commitment_status as string) || "");
    setShootsFilter((f.shoots as string) || "");
    setMinHeightFilter((f.min_height as string) || "");
    setMaxHeightFilter((f.max_height as string) || "");
    setMinWeightFilter((f.min_weight as string) || "");
    setMaxWeightFilter((f.max_weight as string) || "");
    setMinGpFilter((f.min_gp as string) || "");
    setMinGoalsFilter((f.min_goals as string) || "");
    setMinPointsFilter((f.min_points as string) || "");
    setMinPpgFilter((f.min_ppg as string) || "");
    setHasStatsFilter(!!f.has_stats);
    setGradeFilter((f.overall_grade as string) || "");
    setArchetypeFilter((f.archetype as string) || "");
    setSortBy((f.sort_by as string) || "");
    setSortDir(((f.sort_dir as string) || "asc") as "asc" | "desc");
    setShowAdvancedFilters(true);
  };

  // ── Save current search ──
  const saveCurrentSearch = async () => {
    if (!saveSearchName.trim()) return;
    try {
      await api.post("/players/search/save", {
        name: saveSearchName.trim(),
        filters: getCurrentFilters(),
      });
      setSaveSearchName("");
      setShowSaveModal(false);
      // Reload saved searches
      const { data } = await api.get<SavedSearch[]>("/players/search/saved");
      setSavedSearches(data);
    } catch {
      // Silently fail
    }
  };

  // ── Delete a saved search ──
  const deleteSavedSearch = async (id: string) => {
    try {
      await api.delete(`/players/search/saved/${id}`);
      setSavedSearches((prev) => prev.filter((s) => s.id !== id));
    } catch {
      // Silently fail
    }
  };

  // ── Export CSV ──
  const exportCSV = () => {
    const data = viewMode === "cards" ? cardData : players;
    if (data.length === 0) return;

    const headers = viewMode === "cards"
      ? ["Name", "Position", "Team", "League", "Birth Year", "GP", "G", "A", "P", "PPG", "Grade", "Archetype"]
      : ["Name", "Position", "Team", "League", "Birth Year", "Age Group", "League Tier", "Shoots", "Status"];

    const rows = data.map((p) => {
      if (viewMode === "cards") {
        const c = p as PlayerCardData;
        const ppg = c.gp > 0 ? (c.p / c.gp).toFixed(2) : "";
        return [
          `${c.last_name}, ${c.first_name}`,
          c.position,
          c.current_team || "",
          c.current_league || "",
          c.birth_year || "",
          c.gp || "",
          c.g || "",
          c.a || "",
          c.p || "",
          ppg,
          c.overall_grade || "",
          c.archetype || "",
        ];
      } else {
        const pl = p as Player;
        return [
          `${pl.last_name}, ${pl.first_name}`,
          pl.position,
          pl.current_team || "",
          pl.current_league || "",
          pl.birth_year || "",
          pl.age_group || "",
          pl.league_tier || "",
          pl.shoots || "",
          pl.commitment_status || "",
        ];
      }
    });

    const csvContent = [
      headers.join(","),
      ...rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `prospectx-players-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const displayCount = viewMode === "cards" ? cardData.length : players.length;

  return (
    <ProtectedRoute>
      <NavBar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-navy">Players</h1>
            {!loading && (
              <p className="text-xs text-muted mt-0.5">{displayCount} player{displayCount !== 1 ? "s" : ""}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Export */}
            {!loading && displayCount > 0 && (
              <button
                onClick={exportCSV}
                className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-lg text-xs font-oswald uppercase tracking-wider text-muted hover:text-navy hover:border-navy/30 transition-colors"
                title="Export filtered results as CSV"
              >
                <Download size={14} />
                CSV
              </button>
            )}
            {/* View toggle */}
            <div className="flex items-center bg-navy/[0.04] rounded-lg border border-border/50 p-0.5">
              <button
                onClick={() => setViewMode("cards")}
                className={`p-1.5 rounded-md transition-colors ${
                  viewMode === "cards" ? "bg-white shadow-sm text-teal" : "text-muted hover:text-navy"
                }`}
                title="Card view"
              >
                <LayoutGrid size={16} />
              </button>
              <button
                onClick={() => setViewMode("table")}
                className={`p-1.5 rounded-md transition-colors ${
                  viewMode === "table" ? "bg-white shadow-sm text-teal" : "text-muted hover:text-navy"
                }`}
                title="Table view"
              >
                <List size={16} />
              </button>
            </div>
            <Link
              href="/players/manage"
              className="flex items-center gap-2 px-4 py-2 bg-navy text-white text-sm font-oswald font-semibold uppercase tracking-wider rounded-lg hover:bg-navy/90 transition-colors"
            >
              <Settings size={16} />
              Manage
            </Link>
            <Link
              href="/players/new"
              className="flex items-center gap-2 px-4 py-2 bg-teal text-white text-sm font-oswald font-semibold uppercase tracking-wider rounded-lg hover:bg-teal/90 transition-colors"
            >
              <PlusCircle size={16} />
              Add Player
            </Link>
          </div>
        </div>

        {/* ── Saved Searches Chips ─────────────────────── */}
        {savedSearches.length > 0 && (
          <div className="flex items-center gap-2 mb-3 overflow-x-auto pb-1">
            <Bookmark size={12} className="text-muted shrink-0" />
            {savedSearches.map((ss) => (
              <div
                key={ss.id}
                className="flex items-center gap-1 shrink-0"
              >
                <button
                  onClick={() => loadSavedSearch(ss)}
                  className="px-2.5 py-1 rounded-full bg-navy/[0.05] border border-border/50 text-[11px] font-oswald uppercase tracking-wider text-navy/70 hover:bg-teal/10 hover:text-teal hover:border-teal/30 transition-colors"
                >
                  {ss.name}
                </button>
                <button
                  onClick={() => deleteSavedSearch(ss.id)}
                  className="p-0.5 text-muted/40 hover:text-red-500 transition-colors"
                  title="Delete saved search"
                >
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ── Primary Filters ──────────────────────────── */}
        <div className="flex flex-col sm:flex-row gap-3 mb-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder="Search by name or team..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm bg-white"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Filter size={14} className="text-muted" />
            <select
              value={posFilter}
              onChange={(e) => setPosFilter(e.target.value)}
              className="px-3 py-2 border border-border rounded-lg text-sm bg-white"
            >
              <option value="">All Positions</option>
              {POSITIONS.filter(Boolean).map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <select
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              className="px-3 py-2 border border-border rounded-lg text-sm bg-white max-w-[200px]"
            >
              <option value="">All Teams</option>
              {(filterOptions?.teams || []).map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-oswald uppercase tracking-wider border transition-colors ${
                advancedFilterCount > 0
                  ? "border-teal bg-teal/10 text-teal"
                  : "border-border text-muted hover:border-navy/30 hover:text-navy"
              }`}
            >
              {showAdvancedFilters ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              Filters
              {advancedFilterCount > 0 && (
                <span className="ml-1 w-4 h-4 rounded-full bg-teal text-white text-[9px] flex items-center justify-center">
                  {advancedFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* ── Advanced Filters Panel ───────────────────── */}
        {showAdvancedFilters && (
          <div className="bg-navy/[0.02] rounded-lg border border-border/50 p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-oswald uppercase tracking-wider text-muted">Advanced Filters</span>
              <div className="flex items-center gap-3">
                {/* Save search */}
                {advancedFilterCount > 0 && (
                  <button
                    onClick={() => setShowSaveModal(true)}
                    className="flex items-center gap-1 text-[10px] font-oswald uppercase tracking-wider text-teal hover:text-teal/80 transition-colors"
                  >
                    <Save size={10} /> Save Search
                  </button>
                )}
                {advancedFilterCount > 0 && (
                  <button onClick={clearAdvancedFilters} className="flex items-center gap-1 text-[10px] text-muted hover:text-red-600 transition-colors">
                    <X size={10} /> Clear all
                  </button>
                )}
              </div>
            </div>

            {/* ── Save Search Modal ── */}
            {showSaveModal && (
              <div className="mb-3 p-3 bg-white rounded-lg border border-teal/30 flex items-center gap-2">
                <input
                  type="text"
                  value={saveSearchName}
                  onChange={(e) => setSaveSearchName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && saveCurrentSearch()}
                  placeholder="Search name..."
                  className="flex-1 px-2.5 py-1.5 border border-border rounded-lg text-sm bg-white"
                  autoFocus
                />
                <button
                  onClick={saveCurrentSearch}
                  disabled={!saveSearchName.trim()}
                  className="px-3 py-1.5 bg-teal text-white text-xs font-oswald uppercase tracking-wider rounded-lg hover:bg-teal/90 disabled:opacity-40 transition-colors"
                >
                  Save
                </button>
                <button
                  onClick={() => { setShowSaveModal(false); setSaveSearchName(""); }}
                  className="p-1.5 text-muted hover:text-navy transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {/* ── Demographics ── */}
            <FilterGroup label="Demographics" icon={Filter} defaultOpen={true}>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div>
                  <label className="block text-[10px] font-oswald uppercase tracking-wider text-muted mb-1">League</label>
                  <select
                    value={leagueFilter}
                    onChange={(e) => setLeagueFilter(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-border rounded-lg text-sm bg-white"
                  >
                    <option value="">All Leagues</option>
                    {(filterOptions?.leagues || []).map((l) => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-oswald uppercase tracking-wider text-muted mb-1">Birth Year</label>
                  <select
                    value={birthYearFilter}
                    onChange={(e) => setBirthYearFilter(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-border rounded-lg text-sm bg-white"
                  >
                    <option value="">All Years</option>
                    {(filterOptions?.birth_years || []).map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-oswald uppercase tracking-wider text-muted mb-1">Age Group</label>
                  <select
                    value={ageGroupFilter}
                    onChange={(e) => setAgeGroupFilter(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-border rounded-lg text-sm bg-white"
                  >
                    <option value="">All Ages</option>
                    {(filterOptions?.age_groups || []).map((a) => (
                      <option key={a} value={a}>{AGE_GROUP_LABELS[a] || a}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-oswald uppercase tracking-wider text-muted mb-1">League Tier</label>
                  <select
                    value={leagueTierFilter}
                    onChange={(e) => setLeagueTierFilter(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-border rounded-lg text-sm bg-white"
                  >
                    <option value="">All Tiers</option>
                    {(filterOptions?.league_tiers || []).map((t) => (
                      <option key={t} value={t}>{LEAGUE_TIER_LABELS[t] || t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-oswald uppercase tracking-wider text-muted mb-1">Status</label>
                  <select
                    value={commitmentFilter}
                    onChange={(e) => setCommitmentFilter(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-border rounded-lg text-sm bg-white"
                  >
                    <option value="">All Statuses</option>
                    {(filterOptions?.commitment_statuses || []).map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>
            </FilterGroup>

            {/* ── Physical ── */}
            <FilterGroup label="Physical" icon={Ruler} defaultOpen={false}>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div>
                  <label className="block text-[10px] font-oswald uppercase tracking-wider text-muted mb-1">Shoots</label>
                  <select
                    value={shootsFilter}
                    onChange={(e) => setShootsFilter(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-border rounded-lg text-sm bg-white"
                  >
                    <option value="">Any</option>
                    {(filterOptions?.shoots || ["L", "R"]).map((s) => (
                      <option key={s} value={s}>{s === "L" ? "Left" : s === "R" ? "Right" : s}</option>
                    ))}
                  </select>
                </div>
                <NumberInput
                  label="Min Height (cm)"
                  value={minHeightFilter}
                  onChange={setMinHeightFilter}
                  placeholder={filterOptions?.height_range ? String(filterOptions.height_range.min) : "150"}
                  min={100}
                  max={220}
                />
                <NumberInput
                  label="Max Height (cm)"
                  value={maxHeightFilter}
                  onChange={setMaxHeightFilter}
                  placeholder={filterOptions?.height_range ? String(filterOptions.height_range.max) : "210"}
                  min={100}
                  max={220}
                />
                <NumberInput
                  label="Min Weight (kg)"
                  value={minWeightFilter}
                  onChange={setMinWeightFilter}
                  placeholder={filterOptions?.weight_range ? String(filterOptions.weight_range.min) : "50"}
                  min={30}
                  max={150}
                />
                <NumberInput
                  label="Max Weight (kg)"
                  value={maxWeightFilter}
                  onChange={setMaxWeightFilter}
                  placeholder={filterOptions?.weight_range ? String(filterOptions.weight_range.max) : "120"}
                  min={30}
                  max={150}
                />
              </div>
            </FilterGroup>

            {/* ── Stats ── */}
            <FilterGroup label="Stats" icon={Activity} defaultOpen={false}>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <NumberInput
                  label="Min GP"
                  value={minGpFilter}
                  onChange={setMinGpFilter}
                  placeholder="0"
                  min={0}
                />
                <NumberInput
                  label="Min Goals"
                  value={minGoalsFilter}
                  onChange={setMinGoalsFilter}
                  placeholder="0"
                  min={0}
                />
                <NumberInput
                  label="Min Points"
                  value={minPointsFilter}
                  onChange={setMinPointsFilter}
                  placeholder="0"
                  min={0}
                />
                <NumberInput
                  label="Min PPG"
                  value={minPpgFilter}
                  onChange={setMinPpgFilter}
                  placeholder="0.00"
                  step="0.01"
                  min={0}
                />
                <div className="flex items-end pb-0.5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasStatsFilter}
                      onChange={(e) => setHasStatsFilter(e.target.checked)}
                      className="rounded border-border text-teal focus:ring-teal"
                    />
                    <span className="text-xs font-oswald uppercase tracking-wider text-navy/70">Has Stats Only</span>
                  </label>
                </div>
              </div>
            </FilterGroup>

            {/* ── Intelligence ── */}
            <FilterGroup label="Intelligence" icon={Brain} defaultOpen={false}>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div>
                  <label className="block text-[10px] font-oswald uppercase tracking-wider text-muted mb-1">Overall Grade</label>
                  <select
                    value={gradeFilter}
                    onChange={(e) => setGradeFilter(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-border rounded-lg text-sm bg-white"
                  >
                    <option value="">Any Grade</option>
                    {(filterOptions?.overall_grades || GRADE_OPTIONS).map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-oswald uppercase tracking-wider text-muted mb-1">Archetype</label>
                  <select
                    value={archetypeFilter}
                    onChange={(e) => setArchetypeFilter(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-border rounded-lg text-sm bg-white"
                  >
                    <option value="">Any Archetype</option>
                    {(filterOptions?.archetypes || []).map((a) => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                </div>
              </div>
            </FilterGroup>

            {/* ── Sort ── */}
            <FilterGroup label="Sort" icon={ArrowUpDown} defaultOpen={false}>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="col-span-2 sm:col-span-2">
                  <label className="block text-[10px] font-oswald uppercase tracking-wider text-muted mb-1">Sort By</label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-border rounded-lg text-sm bg-white"
                  >
                    <option value="">Default (Name)</option>
                    {SORT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-oswald uppercase tracking-wider text-muted mb-1">Direction</label>
                  <div className="flex items-center bg-navy/[0.04] rounded-lg border border-border/50 p-0.5">
                    <button
                      onClick={() => setSortDir("asc")}
                      className={`flex-1 px-2.5 py-1 rounded-md text-xs font-oswald uppercase tracking-wider transition-colors ${
                        sortDir === "asc" ? "bg-white shadow-sm text-teal" : "text-muted hover:text-navy"
                      }`}
                    >
                      Asc
                    </button>
                    <button
                      onClick={() => setSortDir("desc")}
                      className={`flex-1 px-2.5 py-1 rounded-md text-xs font-oswald uppercase tracking-wider transition-colors ${
                        sortDir === "desc" ? "bg-white shadow-sm text-teal" : "text-muted hover:text-navy"
                      }`}
                    >
                      Desc
                    </button>
                  </div>
                </div>
              </div>
            </FilterGroup>
          </div>
        )}

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 text-sm">{error}</div>
        )}

        {/* ── Card View ─────────────────────────────────────── */}
        {viewMode === "cards" && (
          <>
            {loading ? (
              <div className="text-center py-16 text-muted text-sm">Loading player cards...</div>
            ) : cardData.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-xl border border-border">
                <p className="text-muted text-sm">No players found.</p>
                <Link href="/players/new" className="text-teal hover:underline text-sm mt-2 inline-block">
                  Add your first player
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {cardData.map((p) => (
                  <VisualPlayerCard key={p.id} player={p} />
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Table View ────────────────────────────────────── */}
        {viewMode === "table" && (
          <div className="bg-white rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-navy/[0.03] border-b border-border">
                    <th className="px-4 py-3 text-left font-oswald text-xs uppercase tracking-wider text-muted">Player</th>
                    <th className="px-4 py-3 text-center font-oswald text-xs uppercase tracking-wider text-muted">POS</th>
                    <th className="px-4 py-3 text-left font-oswald text-xs uppercase tracking-wider text-muted">Team</th>
                    <th className="px-4 py-3 text-left font-oswald text-xs uppercase tracking-wider text-muted">League</th>
                    <th className="px-4 py-3 text-center font-oswald text-xs uppercase tracking-wider text-muted">Birth Year</th>
                    <th className="px-4 py-3 text-center font-oswald text-xs uppercase tracking-wider text-muted">Age Group</th>
                    <th className="px-4 py-3 text-center font-oswald text-xs uppercase tracking-wider text-muted">Status</th>
                    <th className="px-4 py-3 text-center font-oswald text-xs uppercase tracking-wider text-muted">Shoots</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-muted">Loading...</td>
                    </tr>
                  ) : players.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-muted">
                        No players found.{" "}
                        <Link href="/players/new" className="text-teal hover:underline">Add your first player</Link>
                      </td>
                    </tr>
                  ) : (
                    players.map((p) => {
                      const statusColors = COMMITMENT_STATUS_COLORS[p.commitment_status || ""] || null;
                      return (
                        <tr key={p.id} className="border-b border-border/50 hover:bg-navy/[0.02] transition-colors">
                          <td className="px-4 py-3">
                            <Link href={`/players/${p.id}`} className="font-semibold text-navy hover:text-teal transition-colors">
                              {p.last_name}, {p.first_name}
                            </Link>
                            {p.archetype && (
                              <span className="ml-2 text-[10px] text-muted/60">{p.archetype}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="inline-flex px-2 py-0.5 rounded text-xs font-bold bg-teal/10 text-teal font-oswald">
                              {p.position}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-muted">{p.current_team || "\u2014"}</td>
                          <td className="px-4 py-3 text-muted">
                            {p.current_league || "\u2014"}
                            {p.league_tier && p.league_tier !== "Unknown" && (
                              <span className="ml-1.5 text-[9px] text-muted/50">({p.league_tier})</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center text-muted tabular-nums">{p.birth_year || "\u2014"}</td>
                          <td className="px-4 py-3 text-center">
                            {p.age_group ? (
                              <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                p.age_group === "U16" ? "bg-green-50 text-green-700" :
                                p.age_group === "U18" ? "bg-blue-50 text-blue-700" :
                                p.age_group === "U20" ? "bg-orange/10 text-orange" :
                                "bg-gray-50 text-gray-600"
                              }`}>
                                {AGE_GROUP_LABELS[p.age_group] || p.age_group}
                              </span>
                            ) : "\u2014"}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {p.commitment_status && p.commitment_status !== "Uncommitted" && statusColors ? (
                              <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-oswald font-bold ${statusColors.bg} ${statusColors.text}`}>
                                {p.commitment_status}
                              </span>
                            ) : (
                              <span className="text-muted/40 text-[10px]">{"\u2014"}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center text-muted">{p.shoots || "\u2014"}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </ProtectedRoute>
  );
}
