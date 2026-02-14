"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, PlusCircle, Filter, ChevronDown, ChevronUp, X } from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import api from "@/lib/api";
import type { Player, PlayerFilterOptions } from "@/types/api";
import { AGE_GROUP_LABELS, LEAGUE_TIER_LABELS } from "@/types/api";

const POSITIONS = ["", "C", "LW", "RW", "F", "LD", "RD", "D", "G"];

export default function PlayersPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [filterOptions, setFilterOptions] = useState<PlayerFilterOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [posFilter, setPosFilter] = useState("");
  const [teamFilter, setTeamFilter] = useState("");
  const [leagueFilter, setLeagueFilter] = useState("");
  const [birthYearFilter, setBirthYearFilter] = useState("");
  const [ageGroupFilter, setAgeGroupFilter] = useState("");
  const [leagueTierFilter, setLeagueTierFilter] = useState("");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Count active advanced filters
  const advancedFilterCount = [leagueFilter, birthYearFilter, ageGroupFilter, leagueTierFilter].filter(Boolean).length;

  // Load filter options once
  useEffect(() => {
    async function loadFilters() {
      try {
        const { data } = await api.get<PlayerFilterOptions>("/players/filter-options");
        setFilterOptions(data);
      } catch {
        // Non-critical
      }
    }
    loadFilters();
  }, []);

  useEffect(() => {
    async function load() {
      try {
        setError("");
        const params = new URLSearchParams();
        params.set("limit", "500");
        if (search) params.set("search", search);
        if (posFilter) params.set("position", posFilter);
        if (teamFilter) params.set("team", teamFilter);
        if (leagueFilter) params.set("league", leagueFilter);
        if (birthYearFilter) params.set("birth_year", birthYearFilter);
        if (ageGroupFilter) params.set("age_group", ageGroupFilter);
        if (leagueTierFilter) params.set("league_tier", leagueTierFilter);
        const { data } = await api.get<Player[]>(`/players?${params}`);
        setPlayers(data);
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed to load players";
        setError(msg);
      } finally {
        setLoading(false);
      }
    }
    const timer = setTimeout(load, 300);
    return () => clearTimeout(timer);
  }, [search, posFilter, teamFilter, leagueFilter, birthYearFilter, ageGroupFilter, leagueTierFilter]);

  const clearAdvancedFilters = () => {
    setLeagueFilter("");
    setBirthYearFilter("");
    setAgeGroupFilter("");
    setLeagueTierFilter("");
  };

  return (
    <ProtectedRoute>
      <NavBar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-navy">Players</h1>
            {!loading && (
              <p className="text-xs text-muted mt-0.5">{players.length} player{players.length !== 1 ? "s" : ""}</p>
            )}
          </div>
          <Link
            href="/players/new"
            className="flex items-center gap-2 px-4 py-2 bg-teal text-white text-sm font-oswald font-semibold uppercase tracking-wider rounded-lg hover:bg-teal/90 transition-colors"
          >
            <PlusCircle size={16} />
            Add Player
          </Link>
        </div>

        {/* Primary Filters */}
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

        {/* Advanced Filters */}
        {showAdvancedFilters && (
          <div className="bg-navy/[0.02] rounded-lg border border-border/50 p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-oswald uppercase tracking-wider text-muted">Advanced Filters</span>
              {advancedFilterCount > 0 && (
                <button onClick={clearAdvancedFilters} className="flex items-center gap-1 text-[10px] text-muted hover:text-red-600 transition-colors">
                  <X size={10} /> Clear all
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
            </div>
          </div>
        )}

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 text-sm">{error}</div>
        )}

        {/* Table */}
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
                  <th className="px-4 py-3 text-center font-oswald text-xs uppercase tracking-wider text-muted">Shoots</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-muted">Loading...</td>
                  </tr>
                ) : players.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-muted">
                      No players found.{" "}
                      <Link href="/players/new" className="text-teal hover:underline">Add your first player</Link>
                    </td>
                  </tr>
                ) : (
                  players.map((p) => (
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
                      <td className="px-4 py-3 text-muted">{p.current_team || "—"}</td>
                      <td className="px-4 py-3 text-muted">
                        {p.current_league || "—"}
                        {p.league_tier && p.league_tier !== "Unknown" && (
                          <span className="ml-1.5 text-[9px] text-muted/50">({p.league_tier})</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center text-muted tabular-nums">{p.birth_year || "—"}</td>
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
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3 text-center text-muted">{p.shoots || "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </ProtectedRoute>
  );
}
