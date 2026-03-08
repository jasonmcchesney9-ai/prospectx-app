"use client";

import { useState, useEffect, useCallback } from "react";
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
  RefreshCw,
  Loader2,
  Shield,
} from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useBenchTalk } from "@/components/BenchTalkProvider";
import api from "@/lib/api";
import { getUser } from "@/lib/auth";
import FamilyGuideTiles from "@/components/FamilyGuideTiles";
import type { Player, FamilyDashboard } from "@/types/api";

const LS_KEY = "prospectx_my_player_id";

// ── Parent tips pool ──
const PARENT_TIPS = [
  "Model good sportsmanship by staying calm with officials and other parents, even when calls don\u2019t go your way. Your player will copy your example more than your words.",
  "Ask \u201CWhat was the most fun part of the game?\u201D instead of \u201CHow many points did you get?\u201D It shifts the focus from results to enjoyment \u2014 which is what keeps kids in the game.",
  "On game days, make sure your player has a good meal 3\u20134 hours before and a light snack 60\u201390 minutes before. Hydration starts the night before, not at the rink.",
  "Let the coach coach. If you have concerns, schedule a time to talk \u2014 never during or right after a game. Your player needs to see you and their coach on the same team.",
  "Praise effort, not just results. \u201CI could see you were competing hard on every shift\u201D means more to your player\u2019s long-term confidence than \u201CGreat goal.\u201D",
  "Your nerves in the stands are real \u2014 and that\u2019s okay. Take a breath, unclench your hands, and remember: your player feeds off your energy, calm or anxious.",
  "If your player seems withdrawn, overwhelmed, or consistently unhappy about hockey, it\u2019s okay to reach out to a mental performance coach or school counsellor. Asking for help is strength.",
  "Sleep is the most underrated performance tool in youth hockey. For players under 14, aim for 9\u201311 hours. For older players, 8\u201310 hours minimum on game nights.",
];

// ── Emotion pills + after-game scripts ──
const EMOTION_PILLS = [
  { key: "win_good", emoji: "\uD83D\uDE0A", label: "Win \u2014 Felt Good" },
  { key: "win_flat", emoji: "\uD83D\uDE14", label: "Win \u2014 Quiet / Flat" },
  { key: "tough_loss", emoji: "\uD83D\uDE1E", label: "Tough Loss" },
  { key: "responsible_mistake", emoji: "\uD83D\uDE22", label: "Feels Responsible" },
  { key: "low_ice_time", emoji: "\uD83D\uDE20", label: "Low Ice Time / Scratched" },
];

const AFTER_GAME_SCRIPTS: Record<string, { trySaying: string; spaceCue: string; emotionContext: string }> = {
  win_good: {
    trySaying: "I loved watching you compete today. What\u2019s one thing you feel good about in your game, and one thing you want to work on next time?",
    spaceCue: "Celebrate the effort, then open the door to growth.",
    emotionContext: "they played great and are feeling confident about their game",
  },
  win_flat: {
    trySaying: "You played hard today. We don\u2019t have to talk about it right now \u2014 I\u2019m just glad I was there watching you.",
    spaceCue: "Give them space. Don\u2019t push for an explanation.",
    emotionContext: "we won but they seem quiet and flat \u2014 something feels off",
  },
  tough_loss: {
    trySaying: "It\u2019s okay to be disappointed after a tough game. I\u2019m here with you.",
    spaceCue: "We don\u2019t have to fix everything in the car ride.",
    emotionContext: "they\u2019re upset after a hard loss and feeling down",
  },
  responsible_mistake: {
    trySaying: "Every player on that ice made mistakes today \u2014 that\u2019s how the game works. What matters is that you kept competing.",
    spaceCue: "Normalize it. Don\u2019t minimize it.",
    emotionContext: "they feel responsible for a mistake that affected the game",
  },
  low_ice_time: {
    trySaying: "That\u2019s a hard one. How are you feeling about it? I\u2019m just here to listen.",
    spaceCue: "Stay on their side. Don\u2019t coach from the car.",
    emotionContext: "they\u2019re upset about low ice time or being scratched",
  },
};

export default function MyPlayerPage() {
  const router = useRouter();
  const { openBenchTalk, roleOverride } = useBenchTalk();
  // Player selection
  const [searchResults, setSearchResults] = useState<Player[]>([]);
  const [playersLoading, setPlayersLoading] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [selectedPlayerData, setSelectedPlayerData] = useState<Player | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");

  // Restore saved player on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_KEY);
      if (saved) {
        setSelectedPlayerId(saved);
        // Fetch the saved player by ID so we have their data
        api.get(`/players/${saved}`)
          .then((res) => setSelectedPlayerData(res.data))
          .catch(() => {});
      }
    } catch { /* SSR guard */ }
  }, []);

  // Server-side search — debounced, min 2 chars
  useEffect(() => {
    if (pickerSearch.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setPlayersLoading(true);
    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get<Player[]>("/players", { params: { search: pickerSearch.trim(), limit: 50 } });
        const sorted = data.sort((a, b) =>
          `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`)
        );
        setSearchResults(sorted);
      } catch { setSearchResults([]); }
      finally { setPlayersLoading(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [pickerSearch]);

  // Persist selection
  useEffect(() => {
    if (selectedPlayerId) {
      try { localStorage.setItem(LS_KEY, selectedPlayerId); } catch { /* noop */ }
    }
  }, [selectedPlayerId]);

  const selectedPlayer = selectedPlayerData;

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

  // Parent Profile data
  interface ParentProfile {
    has_report: boolean;
    is_stale?: boolean;
    last_updated?: string;
    report_id?: string;
    how_they_playing?: string;
    what_they_do_well?: string;
    focus_area?: string;
    last_game_summary?: string | null;
    player: { id: string; first_name: string; last_name: string; position: string; current_team: string; league: string; dob: string };
    last_game?: { game_date: string; opponent: string; goals: number; assists: number; points: number; plus_minus: number; shots: number; toi_seconds: number } | null;
  }
  const [parentProfile, setParentProfile] = useState<ParentProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  const fetchParentProfile = useCallback(async (pid: string) => {
    setProfileLoading(true);
    try {
      const { data } = await api.get<ParentProfile>(`/players/${pid}/parent-profile`);
      setParentProfile(data);
    } catch {
      setParentProfile(null);
    } finally {
      setProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedPlayerId) {
      fetchParentProfile(selectedPlayerId);
    } else {
      setParentProfile(null);
    }
  }, [selectedPlayerId, fetchParentProfile]);

  const generateParentReport = useCallback(async () => {
    if (!selectedPlayerId) return;
    setGenerating(true);
    try {
      await api.post("/reports", { player_id: selectedPlayerId, report_type: "parent_report" });
      // Refetch profile to get new data
      await fetchParentProfile(selectedPlayerId);
    } catch { /* silent */ }
    finally { setGenerating(false); }
  }, [selectedPlayerId, fetchParentProfile]);

  // After-Game Help + Parent Tip state
  const [selectedEmotion, setSelectedEmotion] = useState<string | null>(null);
  const [tipIndex, setTipIndex] = useState(() => Math.floor(Math.random() * PARENT_TIPS.length));

  function shuffleTip() {
    setTipIndex((prev) => {
      let next = Math.floor(Math.random() * PARENT_TIPS.length);
      while (next === prev && PARENT_TIPS.length > 1) next = Math.floor(Math.random() * PARENT_TIPS.length);
      return next;
    });
  }

  function buildSeedMessage(template: string): string {
    const age = getPlayerAge(selectedPlayer?.dob);
    const level = selectedPlayer?.current_league || selectedPlayer?.current_team || "their level";
    return template.replace("[age]", age ? `${age}` : "their age").replace("[level]", level);
  }

  function getPlayerAge(dob: string | null | undefined): number | null {
    if (!dob) return null;
    try {
      const birth = new Date(dob.slice(0, 10));
      const today = new Date();
      let age = today.getFullYear() - birth.getFullYear();
      if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age--;
      return age;
    } catch { return null; }
  }

  const filteredPlayers = searchResults;

  function handleSelectPlayer(pid: string) {
    setSelectedPlayerId(pid);
    const found = searchResults.find((p) => p.id === pid);
    if (found) setSelectedPlayerData(found);
    setPickerOpen(false);
    setPickerSearch("");
  }

  function handleClearPlayer() {
    setSelectedPlayerId(null);
    setPickerSearch("");
    try { localStorage.removeItem(LS_KEY); } catch { /* noop */ }
  }

  const _user = getUser();
  const _role = roleOverride || _user?.hockey_role || "";
  const _roleAllowed = _role === "parent" || _role === "player";
  if (!_roleAllowed) {
    return (
      <ProtectedRoute>
        <NavBar />
        <main className="max-w-2xl mx-auto px-4 py-16 text-center">
          <Shield size={48} className="text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-navy mb-2">Access Denied</h2>
          <p className="text-muted text-sm mb-1">This page is available to Family accounts only.</p>
          <p className="text-muted/60 text-xs mb-6">Your current role: <span className="font-medium text-navy">{_role || "none"}</span></p>
          <a href="/" className="inline-flex items-center gap-2 px-4 py-2 bg-navy text-white text-sm font-oswald font-semibold uppercase tracking-wider rounded-lg hover:bg-navy/90 transition-colors">
            Go to Dashboard
          </a>
        </main>
      </ProtectedRoute>
    );
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
                  <div className="px-3 py-4 text-center text-xs text-gray-400">{pickerSearch.trim().length < 2 ? "Type a name to search..." : "No players match your search"}</div>
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

        {/* ── Parent Profile Block ── */}
        {selectedPlayer && (
          <div className="bg-white rounded-xl border border-[#0D9488]/20 p-5 mb-6">
            {profileLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 size={20} className="animate-spin text-[#0D9488]" />
                <span className="ml-2 text-xs text-gray-500">Loading profile...</span>
              </div>
            ) : parentProfile?.has_report ? (
              <>
                {/* Header Row */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-bold font-oswald uppercase tracking-wider" style={{ color: "#0F2942" }}>
                      {selectedPlayer.first_name} {selectedPlayer.last_name}
                    </h2>
                    {selectedPlayer.position && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: "#0D9488" }}>
                        {selectedPlayer.position}
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    {parentProfile.is_stale && parentProfile.last_updated && (
                      <button
                        onClick={generateParentReport}
                        disabled={generating}
                        className="text-[10px] hover:underline flex items-center gap-1" style={{ color: "#0D9488" }}
                      >
                        <RefreshCw size={10} className={generating ? "animate-spin" : ""} />
                        Last updated {new Date(parentProfile.last_updated).toLocaleDateString("en-US", { month: "short", day: "numeric" })}. Refresh?
                      </button>
                    )}
                    {!parentProfile.is_stale && parentProfile.last_updated && (
                      <span className="text-[10px]" style={{ color: "#999" }}>
                        Updated {new Date(parentProfile.last_updated).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xs" style={{ color: "#666666" }}>
                    {selectedPlayer.current_team || ""}
                    {(() => { const age = getPlayerAge(selectedPlayer.dob); return age ? ` · Age ${age}` : ""; })()}
                    {selectedPlayer.current_league ? ` · ${selectedPlayer.current_league}` : ""}
                  </span>
                </div>

                {/* 2x2 Card Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* How They're Playing */}
                  <div className="rounded-lg p-3" style={{ borderLeft: "4px solid #0D9488", background: "#fff" }}>
                    <p className="text-sm font-bold mb-1" style={{ color: "#0F2942" }}>How They&apos;re Playing</p>
                    <p className="text-sm leading-relaxed" style={{ color: "#666666" }}>
                      {parentProfile.how_they_playing || "No assessment yet."}
                    </p>
                  </div>

                  {/* What They Do Well */}
                  <div className="rounded-lg p-3" style={{ borderLeft: "4px solid #0D9488", background: "#fff" }}>
                    <p className="text-sm font-bold mb-1" style={{ color: "#0F2942" }}>What They Do Well</p>
                    <p className="text-sm leading-relaxed" style={{ color: "#666666" }}>
                      {parentProfile.what_they_do_well || "No assessment yet."}
                    </p>
                  </div>

                  {/* Focus Area This Month */}
                  <div className="rounded-lg p-3" style={{ borderLeft: "4px solid #0D9488", background: "#fff" }}>
                    <p className="text-sm font-bold mb-1" style={{ color: "#0F2942" }}>Focus Area This Month</p>
                    <p className="text-sm leading-relaxed" style={{ color: "#666666" }}>
                      {parentProfile.focus_area || "No assessment yet."}
                    </p>
                  </div>

                  {/* Last Game */}
                  <div className="rounded-lg p-3" style={{ borderLeft: "4px solid #0D9488", background: "#fff" }}>
                    <p className="text-sm font-bold mb-1" style={{ color: "#0F2942" }}>Last Game</p>
                    <p className="text-sm leading-relaxed" style={{ color: "#666666" }}>
                      {parentProfile.last_game_summary
                        ? parentProfile.last_game_summary
                        : "No recent game data. Upload a game file in Game Sheets to see your player\u2019s last game here."}
                    </p>
                  </div>
                </div>
              </>
            ) : (
              /* No report — Generate button */
              <div className="text-center py-4">
                <p className="text-sm mb-1" style={{ color: "#0F2942" }}>
                  No assessment yet for {selectedPlayer.first_name}. Generate their Parent Report to get started.
                </p>
                <button
                  onClick={generateParentReport}
                  disabled={generating}
                  className="mt-3 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-white text-sm font-bold font-oswald uppercase tracking-wider transition-all hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: "#0D9488" }}
                >
                  {generating ? (
                    <><Loader2 size={14} className="animate-spin" /> Generating...</>
                  ) : (
                    <>Generate {selectedPlayer.first_name}&apos;s Parent Report</>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

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
                onClick={() => openBenchTalk(`[Parent Mode] How is ${selectedPlayer.first_name} ${selectedPlayer.last_name} doing this season? Give me a plain-language summary.`, "parent", {
                  user: { id: getUser()?.id || "", name: getUser()?.first_name || "User", role: "PARENT", orgId: getUser()?.org_id || "", orgName: "ProspectX" },
                  page: { id: "MY_PLAYER" },
                  entity: { type: "PLAYER", id: selectedPlayer.id, name: `${selectedPlayer.first_name} ${selectedPlayer.last_name}`, metadata: { position: selectedPlayer.position || undefined, team: selectedPlayer.current_team || undefined, league: selectedPlayer.current_league || undefined, roleRelationship: "MY_CHILD" } },
                })}
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

        {/* ── Family Guide Tile Grid ── */}
        {selectedPlayer && (
          <FamilyGuideTiles
            selectedPlayer={selectedPlayer}
            onAskPxi={(msg) => openBenchTalk(msg, "parent", selectedPlayer ? {
              user: { id: getUser()?.id || "", name: getUser()?.first_name || "User", role: "PARENT", orgId: getUser()?.org_id || "", orgName: "ProspectX" },
              page: { id: "MY_PLAYER" },
              entity: { type: "PLAYER", id: selectedPlayer.id, name: `${selectedPlayer.first_name} ${selectedPlayer.last_name}`, metadata: { position: selectedPlayer.position || undefined, team: selectedPlayer.current_team || undefined, roleRelationship: "MY_CHILD" } },
            } : undefined)}
            buildSeedMessage={buildSeedMessage}
            onSelectPlayer={() => setPickerOpen(true)}
          />
        )}

        {/* ── Parent Tip of the Day ── */}
        <div className="rounded-xl p-5 mb-6" style={{ backgroundColor: "#E6F7F6", borderLeft: "4px solid #0D9488" }}>
          <div className="flex items-start justify-between mb-2">
            <span className="text-xs font-oswald uppercase tracking-wider font-bold" style={{ color: "#0F2942" }}>
              Parent Tip of the Day
            </span>
            <button
              onClick={shuffleTip}
              className="p-1 rounded hover:bg-white/50 transition-colors"
              title="Shuffle tip"
            >
              <RefreshCw size={14} style={{ color: "#0D9488" }} />
            </button>
          </div>
          <p className="text-sm leading-relaxed text-center px-2" style={{ color: "#0F2942" }}>
            {PARENT_TIPS[tipIndex]}
          </p>
          <p className="text-center mt-3 text-xs" style={{ color: "#999" }}>
            New tip every day to support your player on and off the ice.
          </p>
        </div>

        {/* ── After-Game Help ── */}
        <div className="mb-6">
          <h3 className="text-sm font-oswald uppercase tracking-wider font-bold mb-1" style={{ color: "#0F2942" }}>
            After-Game Help
          </h3>
          <p className="text-xs mb-3" style={{ color: "#666666" }}>
            Simple scripts for tricky car rides and post-game conversations.
          </p>

          {/* Emotion pills */}
          <div className="flex flex-wrap gap-2 mb-3">
            {EMOTION_PILLS.map((pill) => (
              <button
                key={pill.key}
                onClick={() => setSelectedEmotion(selectedEmotion === pill.key ? null : pill.key)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  selectedEmotion === pill.key
                    ? "text-white border-transparent"
                    : "bg-white border-gray-200 hover:border-[#0D9488]/40"
                }`}
                style={selectedEmotion === pill.key ? { backgroundColor: "#0F2942", color: "#fff" } : { color: "#0F2942" }}
              >
                <span>{pill.emoji}</span> {pill.label}
              </button>
            ))}
          </div>

          {/* Script card — slides in on selection */}
          {selectedEmotion && AFTER_GAME_SCRIPTS[selectedEmotion] && (
            <div className="rounded-xl bg-white p-5 transition-all" style={{ borderLeft: "4px solid #0D9488" }}>
              <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "#0D9488" }}>
                Try saying&hellip;
              </p>
              <blockquote className="text-sm leading-relaxed italic pl-3 mb-3" style={{ color: "#0F2942", borderLeft: "2px solid #E6F7F6" }}>
                &ldquo;{AFTER_GAME_SCRIPTS[selectedEmotion].trySaying}&rdquo;
              </blockquote>

              <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: "#0F2942" }}>
                Give them space to feel it.
              </p>
              <p className="text-xs leading-relaxed mb-4" style={{ color: "#666666" }}>
                {AFTER_GAME_SCRIPTS[selectedEmotion].spaceCue}
              </p>

              <button
                onClick={() => {
                  const ctx = AFTER_GAME_SCRIPTS[selectedEmotion!].emotionContext;
                  const msg = `I'm a hockey parent. My player just had a game and ${ctx}. What should I say \u2014 and what should I avoid \u2014 in the car ride home? Keep it short and practical.`;
                  openBenchTalk(msg, "parent", selectedPlayer ? {
                    user: { id: getUser()?.id || "", name: getUser()?.first_name || "User", role: "PARENT", orgId: getUser()?.org_id || "", orgName: "ProspectX" },
                    page: { id: "MY_PLAYER" },
                    entity: { type: "PLAYER", id: selectedPlayer.id, name: `${selectedPlayer.first_name} ${selectedPlayer.last_name}`, metadata: { position: selectedPlayer.position || undefined, team: selectedPlayer.current_team || undefined, roleRelationship: "MY_CHILD" } },
                  } : undefined);
                }}
                className="w-full py-2 rounded-lg text-white text-xs font-bold font-oswald uppercase tracking-wider transition-all hover:opacity-90"
                style={{ backgroundColor: "#0D9488" }}
              >
                Ask PXI about this situation
              </button>
            </div>
          )}
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
