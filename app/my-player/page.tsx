"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
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
  Clock,
  Target,
  Users,
  Star,
} from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useBenchTalk } from "@/components/BenchTalkProvider";
import api from "@/lib/api";
import type { Player, FamilyDashboard } from "@/types/api";

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

  // Dashboard data for selected player
  const [dashboard, setDashboard] = useState<FamilyDashboard | null>(null);
  const [dashLoading, setDashLoading] = useState(false);

  const fetchDashboard = useCallback(async (pid: string) => {
    setDashLoading(true);
    try {
      const { data } = await api.get<FamilyDashboard>(`/family/dashboard/${pid}`);
      setDashboard(data);
    } catch {
      setDashboard(null);
    } finally {
      setDashLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedPlayerId) {
      fetchDashboard(selectedPlayerId);
    } else {
      setDashboard(null);
    }
  }, [selectedPlayerId, fetchDashboard]);

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

        {/* ── Dashboard Sections: Next Up / Focus / Staff / Stats ── */}
        {selectedPlayer && (
          <div className="space-y-4 mb-8">
            {dashLoading ? (
              <div className="bg-white rounded-xl border border-teal/20 p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-navy border-t-teal mx-auto mb-3" />
                <p className="text-xs text-muted font-oswald uppercase tracking-wider">Loading dashboard...</p>
              </div>
            ) : (
              <>
                {/* ── Next Up ── */}
                <div className="bg-white rounded-xl border border-teal/20 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Clock size={16} className="text-teal" />
                    <h3 className="text-sm font-oswald uppercase tracking-wider text-navy font-bold">Next Up</h3>
                  </div>
                  {dashboard?.next_up ? (
                    <div className="flex items-center gap-3 bg-teal/5 rounded-lg p-3">
                      <Calendar size={20} className="text-teal shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-navy">
                          vs {dashboard.next_up.opponent}
                        </p>
                        <p className="text-xs text-muted">
                          {new Date(dashboard.next_up.date).toLocaleDateString("en-US", {
                            weekday: "long", month: "short", day: "numeric",
                          })}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted italic">No upcoming games scheduled.</p>
                  )}
                </div>

                {/* ── This Month&apos;s Focus ── */}
                <div className="bg-white rounded-xl border border-teal/20 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Target size={16} className="text-orange" />
                    <h3 className="text-sm font-oswald uppercase tracking-wider text-navy font-bold">This Month&apos;s Focus</h3>
                  </div>
                  {dashboard?.focus_items && dashboard.focus_items.length > 0 ? (
                    <div className="space-y-2">
                      {dashboard.focus_items.map((item, i) => (
                        <div key={i} className="flex items-start gap-3 bg-orange/5 rounded-lg p-3">
                          <div className="w-6 h-6 rounded-full bg-orange/10 flex items-center justify-center shrink-0 mt-0.5">
                            <span className="text-[10px] font-bold text-orange">{i + 1}</span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-navy">{item.title}</p>
                            {item.description && (
                              <p className="text-xs text-muted mt-0.5 leading-relaxed">{item.description}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted italic">No development objectives set yet. Ask your coach about focus areas.</p>
                  )}
                </div>

                {/* ── From the Staff ── */}
                <div className="bg-white rounded-xl border border-teal/20 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Users size={16} className="text-navy" />
                    <h3 className="text-sm font-oswald uppercase tracking-wider text-navy font-bold">From the Staff</h3>
                  </div>
                  {dashboard?.staff_note ? (
                    <div className="bg-navy/[0.03] rounded-lg p-3">
                      <p className="text-sm text-navy/80 leading-relaxed">{dashboard.staff_note.text}</p>
                      {dashboard.staff_note.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {dashboard.staff_note.tags.map((tag, i) => (
                            <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-navy/10 text-navy/60">{tag}</span>
                          ))}
                        </div>
                      )}
                      <p className="text-[10px] text-muted/50 mt-2">
                        {new Date(dashboard.staff_note.date).toLocaleDateString("en-US", {
                          month: "short", day: "numeric",
                        })}
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-muted italic">No staff notes shared yet.</p>
                  )}
                </div>

                {/* ── Stat Snapshot ── */}
                {dashboard?.stats && (
                  <div className="bg-white rounded-xl border border-teal/20 p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <TrendingUp size={16} className="text-teal" />
                      <h3 className="text-sm font-oswald uppercase tracking-wider text-navy font-bold">This Season</h3>
                    </div>
                    <div className="grid grid-cols-4 gap-3">
                      {[
                        { label: "GP", value: (dashboard.stats as Record<string, number>).gp ?? 0 },
                        { label: "G", value: (dashboard.stats as Record<string, number>).g ?? 0 },
                        { label: "A", value: (dashboard.stats as Record<string, number>).a ?? 0 },
                        { label: "PTS", value: (dashboard.stats as Record<string, number>).p ?? 0 },
                      ].map((s) => (
                        <div key={s.label} className="text-center bg-teal/5 rounded-lg p-2.5">
                          <p className="text-lg font-bold text-navy font-oswald">{s.value}</p>
                          <p className="text-[10px] text-muted font-oswald uppercase tracking-wider">{s.label}</p>
                        </div>
                      ))}
                    </div>
                    {dashboard.recent_games.length > 0 && (
                      <div className="mt-3">
                        <p className="text-[10px] font-oswald uppercase tracking-wider text-muted mb-1.5">Recent Games</p>
                        <div className="space-y-1">
                          {dashboard.recent_games.slice(0, 3).map((g, i) => (
                            <div key={i} className="flex items-center justify-between text-xs bg-gray-50 rounded px-3 py-1.5">
                              <span className="text-muted">{g.opponent || "Opponent"}</span>
                              <span className="font-medium text-navy">{g.goals}G {g.assists}A = {g.points}P</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <Link
                      href={`/players/${selectedPlayerId}`}
                      className="inline-flex items-center gap-1 text-[10px] text-teal font-oswald uppercase tracking-wider mt-3 hover:underline"
                    >
                      <Star size={10} />
                      View Full Stats
                    </Link>
                  </div>
                )}

                {/* ── Family Card Link ── */}
                {dashboard?.latest_family_card ? (
                  <div className="bg-white rounded-xl border border-teal/20 p-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText size={16} className="text-orange" />
                        <h3 className="text-sm font-oswald uppercase tracking-wider text-navy font-bold">Monthly Family Card</h3>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-green-100 text-green-700 font-medium">
                        {dashboard.latest_family_card.month}
                      </span>
                    </div>
                    <p className="text-xs text-muted mt-2">
                      Your latest Family Card was generated on{" "}
                      {new Date(dashboard.latest_family_card.generated_at).toLocaleDateString("en-US", {
                        month: "short", day: "numeric",
                      })}
                      {dashboard.latest_family_card.coach_note && " — includes a note from the coaching staff"}.
                    </p>
                  </div>
                ) : selectedPlayer ? (
                  <div className="bg-orange/5 rounded-xl border border-orange/20 p-5 text-center">
                    <FileText size={24} className="mx-auto text-orange mb-2" />
                    <p className="text-sm font-medium text-navy">No Family Card yet</p>
                    <p className="text-xs text-muted mt-1">Generate your first Monthly Family Card to track progress.</p>
                  </div>
                ) : null}
              </>
            )}
          </div>
        )}

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
