"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, PlusCircle, Filter } from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import api from "@/lib/api";
import type { Player } from "@/types/api";

const POSITIONS = ["", "C", "LW", "RW", "F", "LD", "RD", "D", "G"];

export default function PlayersPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [posFilter, setPosFilter] = useState("");
  const [teamFilter, setTeamFilter] = useState("");

  // Extract unique teams from loaded players for the filter dropdown
  const uniqueTeams = Array.from(
    new Set(players.map((p) => p.current_team).filter(Boolean) as string[])
  ).sort();

  useEffect(() => {
    async function load() {
      try {
        setError("");
        const params = new URLSearchParams();
        params.set("limit", "200");
        if (search) params.set("search", search);
        if (posFilter) params.set("position", posFilter);
        if (teamFilter) params.set("team", teamFilter);
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
  }, [search, posFilter, teamFilter]);

  return (
    <ProtectedRoute>
      <NavBar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-navy">Players</h1>
          <Link
            href="/players/new"
            className="flex items-center gap-2 px-4 py-2 bg-teal text-white text-sm font-oswald font-semibold uppercase tracking-wider rounded-lg hover:bg-teal/90 transition-colors"
          >
            <PlusCircle size={16} />
            Add Player
          </Link>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder="Search by name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm bg-white"
            />
          </div>
          <div className="flex items-center gap-2">
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
              {uniqueTeams.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>

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
                  <th className="px-4 py-3 text-center font-oswald text-xs uppercase tracking-wider text-muted">Shoots</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-muted">Loading...</td>
                  </tr>
                ) : players.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-muted">
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
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex px-2 py-0.5 rounded text-xs font-bold bg-teal/10 text-teal font-oswald">
                          {p.position}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted">{p.current_team || "—"}</td>
                      <td className="px-4 py-3 text-muted">{p.current_league || "—"}</td>
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
