"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Search, Building2, Users, MapPin, PlusCircle, X, Save, Filter, ChevronDown, ChevronRight } from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import api from "@/lib/api";
import type { Player, TeamReference, League } from "@/types/api";

interface TeamSummary {
  name: string;
  league: string | null;
  city: string | null;
  abbreviation: string | null;
  logo_url: string | null;
  playerCount: number;
}

// ── Tier hierarchy definitions ────────────────────────────
const TIER_ORDER: { key: string; label: string; levels: string[]; color: string }[] = [
  { key: "major_junior", label: "Major Junior (CHL)", levels: ["major_junior"], color: "bg-orange/10 text-orange border-orange/20" },
  { key: "junior_a", label: "Junior A", levels: ["junior_a"], color: "bg-teal/10 text-teal border-teal/20" },
  { key: "junior_b", label: "Junior B", levels: ["junior_b"], color: "bg-navy/10 text-navy border-navy/20" },
  { key: "college", label: "College / University", levels: ["college"], color: "bg-purple-100 text-purple-700 border-purple-200" },
  { key: "high_school", label: "High School", levels: ["high_school"], color: "bg-blue-100 text-blue-700 border-blue-200" },
  { key: "minor", label: "Minor Hockey", levels: ["minor"], color: "bg-green-100 text-green-700 border-green-200" },
  { key: "other", label: "Other", levels: [], color: "bg-gray-100 text-gray-600 border-gray-200" },
];

function getTierForLevel(level: string | undefined): string {
  if (!level) return "other";
  for (const tier of TIER_ORDER) {
    if (tier.levels.includes(level)) return tier.key;
  }
  return "other";
}

export default function TeamsPage() {
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [leagueFilter, setLeagueFilter] = useState("");
  const [viewMode, setViewMode] = useState<"hierarchy" | "flat">("hierarchy");
  const [collapsedTiers, setCollapsedTiers] = useState<Set<string>>(new Set());

  // Add Team form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTeam, setNewTeam] = useState({ name: "", league: "GOJHL", city: "", abbreviation: "" });
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setError("");
      const [playersRes, refRes, leaguesRes] = await Promise.all([
        api.get<Player[]>("/players?limit=500"),
        api.get<TeamReference[]>("/teams/reference"),
        api.get<League[]>("/leagues"),
      ]);
      setLeagues(leaguesRes.data);

      // Count players per team (lowercase key)
      const teamCounts = new Map<string, { name: string; count: number; league: string | null }>();
      for (const p of playersRes.data) {
        if (p.current_team) {
          const key = p.current_team.toLowerCase();
          const existing = teamCounts.get(key);
          if (existing) {
            existing.count++;
          } else {
            teamCounts.set(key, {
              name: p.current_team,
              count: 1,
              league: p.current_league,
            });
          }
        }
      }

      // Start with ALL reference teams, overlay player counts
      const summaries: TeamSummary[] = [];
      const handledKeys = new Set<string>();

      for (const ref of refRes.data) {
        const key = ref.name.toLowerCase();
        handledKeys.add(key);
        const countData = teamCounts.get(key);
        summaries.push({
          name: ref.name,
          league: ref.league,
          city: ref.city,
          abbreviation: ref.abbreviation,
          logo_url: ref.logo_url || null,
          playerCount: countData?.count || 0,
        });
      }

      // Add any custom teams from player data not in reference set
      for (const [key, data] of teamCounts) {
        if (!handledKeys.has(key)) {
          summaries.push({
            name: data.name,
            league: data.league,
            city: null,
            abbreviation: null,
            logo_url: null,
            playerCount: data.count,
          });
        }
      }

      summaries.sort((a, b) => a.name.localeCompare(b.name));
      setTeams(summaries);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed to load teams";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleAddTeam = async () => {
    if (!newTeam.name.trim()) return;
    setSaving(true);
    try {
      await api.post("/teams", newTeam);
      setShowAddForm(false);
      setNewTeam({ name: "", league: "GOJHL", city: "", abbreviation: "" });
      await loadData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed to create team";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  // Filter by search + league
  const filtered = teams.filter((t) => {
    if (leagueFilter && t.league !== leagueFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        t.name.toLowerCase().includes(q) ||
        (t.league && t.league.toLowerCase().includes(q)) ||
        (t.city && t.city.toLowerCase().includes(q))
      );
    }
    return true;
  });

  // Get unique leagues from teams data for filter
  const uniqueLeagues = Array.from(new Set(teams.map((t) => t.league).filter(Boolean) as string[])).sort();

  // Build league-level map from DB leagues
  const leagueLevelMap = new Map<string, string>();
  for (const l of leagues) {
    leagueLevelMap.set(l.abbreviation, l.level);
  }

  // Group teams by tier → league
  const tierGroups = TIER_ORDER.map((tier) => {
    const tierTeams = filtered.filter((t) => {
      const level = t.league ? leagueLevelMap.get(t.league) : undefined;
      return getTierForLevel(level) === tier.key;
    });

    // Sub-group by league within this tier
    const leagueMap = new Map<string, TeamSummary[]>();
    for (const team of tierTeams) {
      const lg = team.league || "Unassigned";
      if (!leagueMap.has(lg)) leagueMap.set(lg, []);
      leagueMap.get(lg)!.push(team);
    }

    return {
      ...tier,
      teams: tierTeams,
      byLeague: Array.from(leagueMap.entries()).sort(([a], [b]) => a.localeCompare(b)),
    };
  }).filter((tier) => tier.teams.length > 0);

  const toggleTier = (key: string) => {
    setCollapsedTiers((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <ProtectedRoute>
      <NavBar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-navy">Teams</h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted">{teams.length} teams</span>
            <button
              onClick={() => { setShowAddForm(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-teal text-white text-sm font-oswald font-semibold uppercase tracking-wider rounded-lg hover:bg-teal/90 transition-colors"
            >
              <PlusCircle size={16} />
              Add Team
            </button>
          </div>
        </div>

        {/* Add Team Inline Form */}
        {showAddForm && (
          <div className="mb-6 bg-white rounded-xl border border-border overflow-hidden">
            <div className="bg-gradient-to-r from-navy to-navy-light px-5 py-3 flex items-center justify-between">
              <h2 className="text-sm font-oswald font-semibold text-white uppercase tracking-wider">Add New Team</h2>
              <button onClick={() => setShowAddForm(false)} className="text-white/60 hover:text-white"><X size={16} /></button>
            </div>
            <div className="ice-stripe" />
            <div className="p-5 grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-oswald uppercase tracking-wider text-muted mb-1">Team Name *</label>
                <input
                  type="text"
                  value={newTeam.name}
                  onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value })}
                  placeholder="e.g., Chatham Maroons"
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-oswald uppercase tracking-wider text-muted mb-1">League</label>
                <select
                  value={newTeam.league}
                  onChange={(e) => setNewTeam({ ...newTeam, league: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white"
                >
                  <option value="">Select...</option>
                  {leagues.map((l) => (
                    <option key={l.id} value={l.abbreviation}>{l.abbreviation} — {l.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-oswald uppercase tracking-wider text-muted mb-1">City</label>
                <input
                  type="text"
                  value={newTeam.city}
                  onChange={(e) => setNewTeam({ ...newTeam, city: e.target.value })}
                  placeholder="e.g., Chatham"
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm"
                />
              </div>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="block text-xs font-oswald uppercase tracking-wider text-muted mb-1">Abbreviation</label>
                  <input
                    type="text"
                    value={newTeam.abbreviation}
                    onChange={(e) => setNewTeam({ ...newTeam, abbreviation: e.target.value.toUpperCase() })}
                    placeholder="e.g., CM"
                    maxLength={4}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm"
                  />
                </div>
                <button
                  onClick={handleAddTeam}
                  disabled={saving || !newTeam.name.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 bg-teal text-white text-sm font-oswald font-semibold uppercase tracking-wider rounded-lg hover:bg-teal/90 disabled:opacity-50 transition-colors whitespace-nowrap"
                >
                  <Save size={14} />
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Search + League Filter + View Toggle */}
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder="Search teams..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm bg-white"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-muted" />
            <select
              value={leagueFilter}
              onChange={(e) => setLeagueFilter(e.target.value)}
              className="px-3 py-2 border border-border rounded-lg text-sm bg-white"
            >
              <option value="">All Leagues</option>
              {uniqueLeagues.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>
          <div className="flex rounded-lg border border-border overflow-hidden">
            <button
              onClick={() => setViewMode("hierarchy")}
              className={`px-3 py-1.5 text-xs font-oswald uppercase tracking-wider ${
                viewMode === "hierarchy" ? "bg-navy text-white" : "bg-white text-muted hover:bg-navy/5"
              }`}
            >
              Tiers
            </button>
            <button
              onClick={() => setViewMode("flat")}
              className={`px-3 py-1.5 text-xs font-oswald uppercase tracking-wider ${
                viewMode === "flat" ? "bg-navy text-white" : "bg-white text-muted hover:bg-navy/5"
              }`}
            >
              All
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 text-sm">
            {error}
            <button onClick={() => setError("")} className="ml-2 text-red-500">&times;</button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center min-h-[30vh]">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-navy border-t-teal" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-border">
            <Building2 size={32} className="mx-auto text-muted/40 mb-3" />
            <p className="text-muted text-sm">
              {search || leagueFilter ? "No teams match your filters." : "No teams found."}
            </p>
          </div>
        ) : viewMode === "hierarchy" ? (
          /* ── Hierarchy View (Tiers → Leagues → Teams) ──── */
          <div className="space-y-4">
            {tierGroups.map((tier) => (
              <div key={tier.key} className="bg-white rounded-xl border border-border overflow-hidden">
                {/* Tier Header */}
                <button
                  onClick={() => toggleTier(tier.key)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-navy/[0.02] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {collapsedTiers.has(tier.key) ? (
                      <ChevronRight size={18} className="text-muted" />
                    ) : (
                      <ChevronDown size={18} className="text-muted" />
                    )}
                    <h2 className="text-sm font-oswald font-semibold uppercase tracking-wider text-navy">
                      {tier.label}
                    </h2>
                    <span className={`px-2 py-0.5 text-[10px] font-oswald font-bold rounded-full border ${tier.color}`}>
                      {tier.teams.length} {tier.teams.length === 1 ? "team" : "teams"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted">
                    {tier.byLeague.map(([lg]) => (
                      <span key={lg} className="px-1.5 py-0.5 rounded bg-navy/5 text-navy/70 text-[10px] font-oswald font-bold">
                        {lg}
                      </span>
                    ))}
                  </div>
                </button>

                {/* Tier Body */}
                {!collapsedTiers.has(tier.key) && (
                  <div className="border-t border-border/50">
                    {tier.byLeague.map(([leagueName, leagueTeams]) => (
                      <div key={leagueName} className="px-5 py-3">
                        {tier.byLeague.length > 1 && (
                          <h3 className="text-xs font-oswald uppercase tracking-wider text-muted mb-3 flex items-center gap-2">
                            <span className="px-1.5 py-0.5 rounded bg-teal/10 text-teal font-bold text-[10px]">{leagueName}</span>
                            <span className="text-muted/50">{leagueTeams.length} teams</span>
                          </h3>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                          {leagueTeams.map((team) => (
                            <TeamCard key={team.name} team={team} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          /* ── Flat View (Original Grid) ──── */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((team) => (
              <TeamCard key={team.name} team={team} />
            ))}
          </div>
        )}
      </main>
    </ProtectedRoute>
  );
}

// ── Team Card Component ───────────────────────────────────
function TeamCard({ team }: { team: TeamSummary }) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  return (
    <Link
      href={`/teams/${encodeURIComponent(team.name)}`}
      className="bg-white rounded-xl border border-border p-4 hover:shadow-md transition-shadow group"
    >
      <div className="flex items-center gap-3">
        {/* Team Logo / Abbreviation */}
        <div className="w-11 h-11 rounded-lg bg-navy/[0.06] flex items-center justify-center shrink-0 overflow-hidden">
          {team.logo_url ? (
            <img
              src={`${apiUrl}${team.logo_url}`}
              alt={team.name}
              className="w-full h-full object-contain"
            />
          ) : team.abbreviation ? (
            <span className="font-oswald font-bold text-sm text-navy">{team.abbreviation}</span>
          ) : (
            <Building2 size={18} className="text-navy/50" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-navy group-hover:text-teal transition-colors text-sm truncate">
            {team.name}
          </h3>
          <div className="flex items-center gap-2 text-xs text-muted mt-0.5">
            {team.league && (
              <span className="px-1.5 py-0.5 rounded bg-teal/10 text-teal font-oswald font-bold text-[10px]">
                {team.league}
              </span>
            )}
            {team.city && (
              <span className="flex items-center gap-0.5 truncate">
                <MapPin size={10} />
                {team.city}
              </span>
            )}
          </div>
        </div>
      </div>
      {team.playerCount > 0 && (
        <div className="mt-2.5 pt-2.5 border-t border-border/50 flex items-center gap-1.5 text-xs text-muted">
          <Users size={11} />
          <span className="font-medium text-navy">{team.playerCount}</span> players
        </div>
      )}
    </Link>
  );
}
