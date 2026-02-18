"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Heart,
  TrendingUp,
  Calendar,
  BookOpen,
  MessageSquare,
  FileText,
  Zap,
  Search,
  ChevronDown,
  X,
  ArrowRight,
} from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useBenchTalk } from "@/components/BenchTalkProvider";
import api from "@/lib/api";
import type { Player } from "@/types/api";

const LS_KEY = "prospectx_my_player_id";

export default function MyPlayerPage() {
  const router = useRouter();
  const { openBenchTalk } = useBenchTalk();

  // Player selection
  const [players, setPlayers] = useState<Player[]>([]);
  const [playersLoading, setPlayersLoading] = useState(true);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");

  // Load players + restore
  useEffect(() => {
    async function load() {
      try {
        const { data } = await api.get<Player[]>("/players", { params: { limit: 2000 } });
        const sorted = data.sort((a, b) =>
          `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`)
        );
        setPlayers(sorted);
      } catch { /* silent */ }
      finally { setPlayersLoading(false); }
    }
    load();
    try {
      const saved = localStorage.getItem(LS_KEY);
      if (saved) setSelectedPlayerId(saved);
    } catch { /* SSR guard */ }
  }, []);

  // Persist selection
  useEffect(() => {
    if (selectedPlayerId) {
      try { localStorage.setItem(LS_KEY, selectedPlayerId); } catch { /* noop */ }
    }
  }, [selectedPlayerId]);

  const selectedPlayer = useMemo(
    () => players.find((p) => p.id === selectedPlayerId) || null,
    [selectedPlayerId, players]
  );

  const filteredPlayers = useMemo(() => {
    if (!pickerSearch.trim()) return players.slice(0, 50);
    const q = pickerSearch.toLowerCase().trim();
    return players.filter(
      (p) =>
        `${p.first_name} ${p.last_name}`.toLowerCase().includes(q) ||
        `${p.last_name}, ${p.first_name}`.toLowerCase().includes(q) ||
        (p.current_team || "").toLowerCase().includes(q)
    ).slice(0, 50);
  }, [players, pickerSearch]);

  function handleSelectPlayer(pid: string) {
    setSelectedPlayerId(pid);
    setPickerOpen(false);
    setPickerSearch("");
  }

  function handleClearPlayer() {
    setSelectedPlayerId(null);
    setPickerSearch("");
    try { localStorage.removeItem(LS_KEY); } catch { /* noop */ }
  }

  return (
    <ProtectedRoute>
      <NavBar />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-teal/10 mb-4">
            <Heart size={32} className="text-teal" />
          </div>
          <h1 className="text-2xl font-bold text-navy font-oswald uppercase tracking-wider">My Player</h1>
          <p className="text-sm text-muted mt-2 max-w-md mx-auto">
            Select your player, generate their profile card, and access development tools.
          </p>
        </div>

        {/* Player Selector */}
        <div className="bg-white rounded-xl border border-teal/20 p-5 mb-6">
          <label className="block text-[10px] font-oswald uppercase tracking-wider text-gray-500 mb-1.5">
            Select Your Player
          </label>
          <div className="relative">
            {!pickerOpen ? (
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border border-gray-300 bg-white text-sm text-left hover:border-teal/50 focus:outline-none focus:ring-2 focus:ring-teal focus:border-teal transition cursor-pointer"
              >
                <Search size={14} className="text-gray-400 shrink-0" />
                {selectedPlayer ? (
                  <span className="flex-1 text-navy truncate">
                    {selectedPlayer.last_name}, {selectedPlayer.first_name}
                    {selectedPlayer.current_team ? ` — ${selectedPlayer.current_team}` : ""}
                    {selectedPlayer.position ? ` (${selectedPlayer.position})` : ""}
                  </span>
                ) : (
                  <span className="flex-1 text-gray-400">
                    {playersLoading ? "Loading players..." : "Search by name, team, or position..."}
                  </span>
                )}
                {selectedPlayerId ? (
                  <span
                    role="button"
                    onClick={(e) => { e.stopPropagation(); handleClearPlayer(); }}
                    className="shrink-0 p-0.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X size={14} />
                  </span>
                ) : (
                  <ChevronDown size={14} className="text-gray-400 shrink-0" />
                )}
              </button>
            ) : (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-t-lg border border-teal bg-white ring-2 ring-teal/20">
                <Search size={14} className="text-teal shrink-0" />
                <input
                  autoFocus
                  type="text"
                  value={pickerSearch}
                  onChange={(e) => setPickerSearch(e.target.value)}
                  placeholder="Type to search players..."
                  className="flex-1 text-sm text-navy placeholder-gray-400 outline-none bg-transparent"
                />
                {pickerSearch && (
                  <button type="button" onClick={() => setPickerSearch("")} className="shrink-0 p-0.5 rounded hover:bg-gray-100 text-gray-400">
                    <X size={14} />
                  </button>
                )}
              </div>
            )}

            {pickerOpen && (
              <div className="absolute z-50 left-0 right-0 max-h-64 overflow-y-auto bg-white border border-t-0 border-teal rounded-b-lg shadow-lg">
                {playersLoading ? (
                  <div className="px-3 py-4 text-center text-xs text-gray-400">Loading...</div>
                ) : filteredPlayers.length === 0 ? (
                  <div className="px-3 py-4 text-center text-xs text-gray-400">No players match your search</div>
                ) : (
                  filteredPlayers.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleSelectPlayer(p.id)}
                      className={`w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-teal/5 transition-colors border-b border-gray-50 last:border-0 ${
                        selectedPlayerId === p.id ? "bg-teal/10" : ""
                      }`}
                    >
                      <span className="text-xs text-navy font-medium flex-1 truncate">
                        {p.last_name}, {p.first_name}
                        {p.current_team ? ` — ${p.current_team}` : ""}
                      </span>
                      {p.position && (
                        <span className="px-1.5 py-0.5 rounded bg-navy/10 text-navy text-[9px] font-bold shrink-0">
                          {p.position}
                        </span>
                      )}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions — shown when player is selected */}
        {selectedPlayer && (
          <div className="bg-white rounded-xl border border-teal/20 p-5 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-navy/5 flex items-center justify-center shrink-0">
                <Zap size={18} className="text-navy" />
              </div>
              <div>
                <h3 className="text-sm font-oswald uppercase tracking-wider text-navy font-bold">
                  Quick Actions for {selectedPlayer.first_name}
                </h3>
                <p className="text-[10px] text-gray-400">
                  {selectedPlayer.current_team || "Unknown Team"} · {selectedPlayer.position || "N/A"}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {/* Generate Player/Family Card */}
              <button
                onClick={() => router.push(`/reports/generate?player=${selectedPlayerId}&type=family_card`)}
                className="flex items-center gap-3 px-4 py-3 rounded-lg border border-teal/20 bg-teal/5 text-left hover:bg-teal/10 hover:border-teal/40 transition-all"
              >
                <FileText size={16} className="text-teal shrink-0" />
                <div>
                  <span className="text-xs font-bold text-navy block">Generate Player Card</span>
                  <span className="text-[10px] text-gray-400">Full profile assessment for your family</span>
                </div>
              </button>

              {/* Development Roadmap */}
              <button
                onClick={() => router.push(`/reports/generate?player=${selectedPlayerId}&type=development_roadmap`)}
                className="flex items-center gap-3 px-4 py-3 rounded-lg border border-orange/20 bg-orange/5 text-left hover:bg-orange/10 hover:border-orange/40 transition-all"
              >
                <TrendingUp size={16} className="text-orange shrink-0" />
                <div>
                  <span className="text-xs font-bold text-navy block">Development Roadmap</span>
                  <span className="text-[10px] text-gray-400">Skills, growth areas, and next steps</span>
                </div>
              </button>

              {/* View Player Profile */}
              <button
                onClick={() => router.push(`/players/${selectedPlayerId}`)}
                className="flex items-center gap-3 px-4 py-3 rounded-lg border border-navy/10 bg-navy/[0.03] text-left hover:bg-navy/[0.06] hover:border-navy/20 transition-all"
              >
                <BookOpen size={16} className="text-navy shrink-0" />
                <div>
                  <span className="text-xs font-bold text-navy block">View Full Profile</span>
                  <span className="text-[10px] text-gray-400">Stats, game log, and intelligence</span>
                </div>
              </button>

              {/* Ask PXI */}
              <button
                onClick={() => openBenchTalk(`[Parent Mode] How is ${selectedPlayer.first_name} ${selectedPlayer.last_name} doing this season? Give me a plain-language summary.`)}
                className="flex items-center gap-3 px-4 py-3 rounded-lg border border-purple-200 bg-purple-50/50 text-left hover:bg-purple-50 hover:border-purple-300 transition-all"
              >
                <MessageSquare size={16} className="text-purple-600 shrink-0" />
                <div>
                  <span className="text-xs font-bold text-navy block">Ask PXI About Them</span>
                  <span className="text-[10px] text-gray-400">AI-powered progress summary</span>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Feature preview cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          {[
            { icon: TrendingUp, title: "Stat Progression", desc: "Season-over-season tracking with visual trend charts" },
            { icon: Calendar, title: "Game Schedule", desc: "Upcoming games, results, and game-by-game stats" },
            { icon: BookOpen, title: "Development Plan", desc: "Personalized skill development roadmap from PXI" },
            { icon: MessageSquare, title: "Coach Feedback", desc: "Notes and observations from coaches and scouts" },
          ].map((item) => (
            <div
              key={item.title}
              className="bg-white rounded-xl border border-teal/20 p-4 hover:border-teal/30 hover:shadow-sm transition-all opacity-60"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-teal/10 flex items-center justify-center shrink-0">
                  <item.icon size={18} className="text-teal" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-navy">{item.title}</h3>
                  <p className="text-xs text-muted mt-0.5 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Link to Player Guide */}
        <Link
          href="/player-guide"
          className="flex items-center justify-between bg-teal/5 rounded-xl border border-teal/20 p-5 hover:bg-teal/10 hover:border-teal/40 transition-all group"
        >
          <div>
            <h3 className="font-oswald text-sm font-bold text-navy uppercase tracking-wider mb-1">
              Player &amp; Family Guide
            </h3>
            <p className="text-xs text-muted">
              Nutrition, workouts, mental game, equipment, and development tools — all in one place.
            </p>
          </div>
          <ArrowRight size={18} className="text-teal shrink-0 group-hover:translate-x-1 transition-transform" />
        </Link>
      </main>
    </ProtectedRoute>
  );
}
