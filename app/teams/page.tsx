"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, Building2, Users, MapPin } from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import api from "@/lib/api";
import type { Player, TeamReference } from "@/types/api";

interface TeamSummary {
  name: string;
  league: string | null;
  city: string | null;
  abbreviation: string | null;
  playerCount: number;
}

export default function TeamsPage() {
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function load() {
      try {
        // Fetch all players to extract unique teams with counts
        const [playersRes, refRes] = await Promise.all([
          api.get<Player[]>("/players?limit=500"),
          api.get<TeamReference[]>("/teams/reference"),
        ]);

        // Build team lookup from reference data
        const refMap = new Map<string, TeamReference>();
        for (const ref of refRes.data) {
          refMap.set(ref.name.toLowerCase(), ref);
        }

        // Count players per team
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

        // Merge with reference data
        const summaries: TeamSummary[] = [];
        for (const [key, data] of teamCounts) {
          const ref = refMap.get(key);
          summaries.push({
            name: ref?.name || data.name,
            league: ref?.league || data.league,
            city: ref?.city || null,
            abbreviation: ref?.abbreviation || null,
            playerCount: data.count,
          });
        }

        // Sort by name
        summaries.sort((a, b) => a.name.localeCompare(b.name));
        setTeams(summaries);
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed to load teams";
        setError(msg);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = search
    ? teams.filter(
        (t) =>
          t.name.toLowerCase().includes(search.toLowerCase()) ||
          (t.league && t.league.toLowerCase().includes(search.toLowerCase())) ||
          (t.city && t.city.toLowerCase().includes(search.toLowerCase()))
      )
    : teams;

  return (
    <ProtectedRoute>
      <NavBar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-navy">Teams</h1>
          <span className="text-sm text-muted">{teams.length} teams</span>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Search teams..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-md pl-9 pr-3 py-2 border border-border rounded-lg text-sm bg-white"
          />
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 text-sm">{error}</div>
        )}

        {loading ? (
          <div className="text-center py-12 text-muted text-sm">Loading teams...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-border">
            <Building2 size={32} className="mx-auto text-muted/40 mb-3" />
            <p className="text-muted text-sm">
              {search ? "No teams match your search." : "No teams found. Add players with team assignments to see teams here."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((team) => (
              <Link
                key={team.name}
                href={`/teams/${encodeURIComponent(team.name)}`}
                className="bg-white rounded-xl border border-border p-5 hover:shadow-md transition-shadow group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-navy/[0.06] flex items-center justify-center shrink-0">
                      {team.abbreviation ? (
                        <span className="font-oswald font-bold text-sm text-navy">{team.abbreviation}</span>
                      ) : (
                        <Building2 size={20} className="text-navy/50" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold text-navy group-hover:text-teal transition-colors">
                        {team.name}
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-muted mt-0.5">
                        {team.league && (
                          <span className="px-1.5 py-0.5 rounded bg-teal/10 text-teal font-oswald font-bold text-[10px]">
                            {team.league}
                          </span>
                        )}
                        {team.city && (
                          <span className="flex items-center gap-0.5">
                            <MapPin size={10} />
                            {team.city}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-border/50 flex items-center gap-1.5 text-xs text-muted">
                  <Users size={12} />
                  <span className="font-medium text-navy">{team.playerCount}</span> players
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </ProtectedRoute>
  );
}
