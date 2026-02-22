"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, User, Users, ChevronRight, Loader2 } from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import api, { assetUrl, hasRealImage } from "@/lib/api";
import type { Player } from "@/types/api";

const POSITION_OPTIONS = [
  { value: "", label: "All Positions" },
  { value: "C", label: "Center" },
  { value: "LW", label: "Left Wing" },
  { value: "RW", label: "Right Wing" },
  { value: "D", label: "Defense" },
  { value: "G", label: "Goalie" },
];

const SORT_OPTIONS = [
  { value: "last_name", label: "Name" },
  { value: "position", label: "Position" },
  { value: "current_team", label: "Team" },
];

export default function PlayerCardsPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [position, setPosition] = useState("");
  const [sortBy, setSortBy] = useState("last_name");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (search) params.set("search", search);
        if (position) params.set("position", position);
        params.set("limit", "200");
        const { data } = await api.get<Player[]>(`/players?${params}`);
        setPlayers(data);
      } catch {
        // Non-critical
      } finally {
        setLoading(false);
      }
    }
    const timer = setTimeout(load, 300);
    return () => clearTimeout(timer);
  }, [search, position]);

  // Client-side sort
  const sorted = [...players].sort((a, b) => {
    if (sortBy === "position") return (a.position || "").localeCompare(b.position || "");
    if (sortBy === "current_team") return (a.current_team || "").localeCompare(b.current_team || "");
    return (a.last_name || "").localeCompare(b.last_name || "");
  });

  return (
    <ProtectedRoute>
      <NavBar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-navy font-oswald uppercase tracking-wider">Player Cards</h1>
            {!loading && (
              <p className="text-xs text-muted mt-0.5">
                {sorted.length} player{sorted.length !== 1 ? "s" : ""}
              </p>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder="Search players..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-teal/20 rounded-lg text-sm bg-white"
            />
          </div>
          <select
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            className="px-3 py-2 border border-teal/20 rounded-lg text-sm bg-white"
          >
            {POSITION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2 border border-teal/20 rounded-lg text-sm bg-white"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="flex items-center justify-center min-h-[30vh]">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-navy border-t-teal" />
          </div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-teal/20">
            <Users size={32} className="mx-auto text-muted/40 mb-3" />
            <p className="text-muted text-sm">
              {search || position ? "No players match your filters." : "No players found."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {sorted.map((player) => (
              <Link
                key={player.id}
                href={`/players/${player.id}/card`}
                className="group bg-white rounded-xl border border-teal/20 hover:border-teal/40 hover:shadow-sm transition-all p-4"
              >
                <div className="flex items-center gap-3">
                  {hasRealImage(player.image_url) ? (
                    <img
                      src={assetUrl(player.image_url)}
                      alt={`${player.first_name} ${player.last_name}`}
                      className="w-12 h-12 rounded-full object-cover border border-teal/20"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-navy/[0.06] flex items-center justify-center shrink-0">
                      <User size={20} className="text-muted/40" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-navy truncate group-hover:text-teal transition-colors">
                      {player.first_name} {player.last_name}
                    </h3>
                    <p className="text-[10px] text-muted">
                      {player.position || "—"} {player.shoots ? `• ${player.shoots}` : ""}
                    </p>
                    {player.current_team && (
                      <p className="text-[10px] text-navy/60 truncate">{player.current_team}</p>
                    )}
                  </div>
                  <ChevronRight size={14} className="text-muted/40 group-hover:text-teal transition-colors shrink-0" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </ProtectedRoute>
  );
}
