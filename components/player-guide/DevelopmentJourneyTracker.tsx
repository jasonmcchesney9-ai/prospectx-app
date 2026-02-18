"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  User,
  FileText,
  BarChart3,
  Calendar,
  RefreshCw,
  Target,
  Brain,
  Shield,
  Zap,
  ChevronDown,
  AlertCircle,
  Search,
  X,
} from "lucide-react";
import api from "@/lib/api";
import HockeyRink from "@/components/HockeyRink";
import TranslatorToggle, { useTranslatorToggle } from "@/components/player-guide/TranslatorToggle";
import type {
  Player,
  PlayerIntelligence,
  Report,
  FocusPlan,
  FocusPlanCategory,
} from "@/types/api";

/* ---------- Constants ---------- */
const LS_KEY = "prospectx_guide_player_id";

const CATEGORY_CONFIG: Record<
  string,
  { icon: React.ElementType; color: string; bg: string; border: string }
> = {
  SKILL: {
    icon: Target,
    color: "text-teal",
    bg: "bg-teal/10",
    border: "border-teal/30",
  },
  MENTAL: {
    icon: Brain,
    color: "text-purple-600",
    bg: "bg-purple-50",
    border: "border-purple-200",
  },
  GAME: {
    icon: Shield,
    color: "text-navy",
    bg: "bg-navy/5",
    border: "border-navy/20",
  },
  PARENT: {
    icon: Zap,
    color: "text-orange",
    bg: "bg-orange/10",
    border: "border-orange/30",
  },
};

const GRADE_COLORS: Record<string, string> = {
  A: "bg-teal/15 text-teal border-teal/30",
  B: "bg-navy/10 text-navy border-navy/20",
  C: "bg-orange/15 text-orange border-orange/30",
  D: "bg-red-100 text-red-700 border-red-200",
  NR: "bg-gray-100 text-gray-500 border-gray-200",
};

function gradeStyle(grade: string | null) {
  if (!grade) return GRADE_COLORS.NR;
  const letter = grade.charAt(0).toUpperCase();
  return GRADE_COLORS[letter] || GRADE_COLORS.NR;
}

/* ---------- Component ---------- */
export default function DevelopmentJourneyTracker() {
  const router = useRouter();

  // Player selection
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [playersLoading, setPlayersLoading] = useState(true);

  // Selected player data
  const [player, setPlayer] = useState<Player | null>(null);
  const [intelligence, setIntelligence] = useState<PlayerIntelligence | null>(null);
  const [latestReport, setLatestReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);

  // Focus plan
  const [focusPlan, setFocusPlan] = useState<FocusPlan | null>(null);
  const [focusPlanLoading, setFocusPlanLoading] = useState(false);
  const [focusPlanError, setFocusPlanError] = useState("");

  /* ── Load player list + restore from localStorage ── */
  useEffect(() => {
    async function loadPlayers() {
      try {
        const { data } = await api.get<Player[]>("/players", {
          params: { limit: 2000 },
        });
        const sorted = data.sort((a, b) =>
          `${a.last_name} ${a.first_name}`.localeCompare(
            `${b.last_name} ${b.first_name}`
          )
        );
        setPlayers(sorted);
      } catch {
        // silent
      } finally {
        setPlayersLoading(false);
      }
    }
    loadPlayers();

    // Restore saved player
    try {
      const saved = localStorage.getItem(LS_KEY);
      if (saved) setSelectedPlayerId(saved);
    } catch {
      // SSR guard
    }
  }, []);

  /* ── Fetch player data when selection changes ── */
  const fetchPlayerData = useCallback(async (pid: string) => {
    setLoading(true);
    setFocusPlan(null);
    setFocusPlanError("");
    try {
      const [playerRes, intelRes, reportsRes] = await Promise.allSettled([
        api.get<Player>(`/players/${pid}`),
        api.get<PlayerIntelligence>(`/players/${pid}/intelligence`),
        api.get<Report[]>("/reports", {
          params: { player_id: pid, limit: 5 },
        }),
      ]);

      if (playerRes.status === "fulfilled") setPlayer(playerRes.value.data);
      else setPlayer(null);

      if (intelRes.status === "fulfilled") setIntelligence(intelRes.value.data);
      else setIntelligence(null);

      if (reportsRes.status === "fulfilled") {
        // Find latest family_card or development_roadmap
        const reports = reportsRes.value.data;
        const parentReport = reports.find(
          (r) =>
            (r.report_type === "family_card" ||
              r.report_type === "development_roadmap") &&
            r.status === "complete"
        );
        setLatestReport(parentReport || null);
      } else {
        setLatestReport(null);
      }
    } catch {
      setPlayer(null);
      setIntelligence(null);
      setLatestReport(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedPlayerId) {
      fetchPlayerData(selectedPlayerId);
      try {
        localStorage.setItem(LS_KEY, selectedPlayerId);
      } catch {
        /* noop */
      }
    }
  }, [selectedPlayerId, fetchPlayerData]);

  /* ── Generate focus plan ── */
  async function handleGenerateFocusPlan() {
    if (!selectedPlayerId) return;
    setFocusPlanLoading(true);
    setFocusPlanError("");
    try {
      const { data } = await api.post<FocusPlan>("/player-guide/focus-plan", {
        player_id: selectedPlayerId,
      });
      setFocusPlan(data);
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string | { message?: string } } } })
          ?.response?.data?.detail;
      if (typeof detail === "object" && detail?.message) {
        setFocusPlanError(detail.message);
      } else if (typeof detail === "string") {
        setFocusPlanError(detail);
      } else {
        setFocusPlanError("Failed to generate focus plan. Please try again.");
      }
    } finally {
      setFocusPlanLoading(false);
    }
  }

  /* ── Searchable player picker state ── */
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const pickerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close picker on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    }
    if (pickerOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [pickerOpen]);

  // Focus search input when picker opens
  useEffect(() => {
    if (pickerOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [pickerOpen]);

  // Filtered + grouped players
  const groupedPlayers = useMemo(() => {
    const q = pickerSearch.toLowerCase().trim();
    let filtered = players;
    if (q) {
      filtered = players.filter(
        (p) =>
          `${p.first_name} ${p.last_name}`.toLowerCase().includes(q) ||
          `${p.last_name}, ${p.first_name}`.toLowerCase().includes(q) ||
          (p.current_team || "").toLowerCase().includes(q) ||
          (p.position || "").toLowerCase().includes(q)
      );
    }
    // Group by team (players without a team go into "No Team")
    const groups: Record<string, Player[]> = {};
    for (const p of filtered) {
      const team = p.current_team || "No Team";
      if (!groups[team]) groups[team] = [];
      groups[team].push(p);
    }
    // Sort teams alphabetically, but put "No Team" last
    const sorted = Object.entries(groups).sort(([a], [b]) => {
      if (a === "No Team") return 1;
      if (b === "No Team") return -1;
      return a.localeCompare(b);
    });
    return sorted;
  }, [players, pickerSearch]);

  const totalFiltered = useMemo(
    () => groupedPlayers.reduce((sum, [, list]) => sum + list.length, 0),
    [groupedPlayers]
  );

  // Selected player label for display
  const selectedPlayerLabel = useMemo(() => {
    if (!selectedPlayerId) return "";
    const p = players.find((pl) => pl.id === selectedPlayerId);
    if (!p) return "";
    return `${p.last_name}, ${p.first_name}${p.current_team ? ` — ${p.current_team}` : ""}${p.position ? ` (${p.position})` : ""}`;
  }, [selectedPlayerId, players]);

  function handleSelectPlayer(pid: string) {
    setSelectedPlayerId(pid);
    setPickerOpen(false);
    setPickerSearch("");
  }

  // Translator toggle (Coach ↔ Parent view)
  const { mode: viewMode, toggle: toggleView, translate } = useTranslatorToggle("parent");

  function handleClearPlayer() {
    setSelectedPlayerId(null);
    setPlayer(null);
    setIntelligence(null);
    setLatestReport(null);
    setFocusPlan(null);
    setPickerSearch("");
    try {
      localStorage.removeItem(LS_KEY);
    } catch {
      /* noop */
    }
  }

  /* ---------- Render ---------- */
  return (
    <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden mb-6">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 bg-navy/[0.03] border-b border-border">
        <div className="w-10 h-10 rounded-lg bg-teal/10 flex items-center justify-center shrink-0">
          <BarChart3 size={18} className="text-teal" />
        </div>
        <div>
          <h3 className="text-sm font-oswald uppercase tracking-wider text-navy font-bold">
            Your Player&apos;s Development Journey
          </h3>
          <p className="text-[10px] text-gray-400 mt-0.5">
            Track progress, generate assessments, and get a personalized monthly focus plan
          </p>
        </div>
      </div>

      <div className="p-5">
        {/* Searchable player picker */}
        <div className="mb-4" ref={pickerRef}>
          <label className="block text-[10px] font-oswald uppercase tracking-wider text-gray-500 mb-1.5">
            Select Player
          </label>
          <div className="relative">
            {/* Trigger button / selected display */}
            {!pickerOpen ? (
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border border-gray-300 bg-white text-sm text-left hover:border-teal/50 focus:outline-none focus:ring-2 focus:ring-teal focus:border-teal transition cursor-pointer"
              >
                <Search size={14} className="text-gray-400 shrink-0" />
                {selectedPlayerId && selectedPlayerLabel ? (
                  <span className="flex-1 text-navy truncate">{selectedPlayerLabel}</span>
                ) : (
                  <span className="flex-1 text-gray-400">
                    {playersLoading ? "Loading players..." : "Search by name, team, or position..."}
                  </span>
                )}
                {selectedPlayerId ? (
                  <span
                    role="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleClearPlayer();
                    }}
                    className="shrink-0 p-0.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X size={14} />
                  </span>
                ) : (
                  <ChevronDown size={14} className="text-gray-400 shrink-0" />
                )}
              </button>
            ) : (
              /* Search input (when open) */
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-t-lg border border-teal bg-white ring-2 ring-teal/20">
                <Search size={14} className="text-teal shrink-0" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={pickerSearch}
                  onChange={(e) => setPickerSearch(e.target.value)}
                  placeholder="Type to search players..."
                  className="flex-1 text-sm text-navy placeholder-gray-400 outline-none bg-transparent"
                />
                {pickerSearch && (
                  <button
                    type="button"
                    onClick={() => setPickerSearch("")}
                    className="shrink-0 p-0.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X size={14} />
                  </button>
                )}
                <span className="text-[10px] text-gray-400 shrink-0 tabular-nums">
                  {totalFiltered}
                </span>
              </div>
            )}

            {/* Dropdown list */}
            {pickerOpen && (
              <div className="absolute z-50 left-0 right-0 max-h-72 overflow-y-auto bg-white border border-t-0 border-teal rounded-b-lg shadow-lg">
                {playersLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <HockeyRink size="toast" />
                    <span className="text-xs text-gray-400 ml-2">Loading players...</span>
                  </div>
                ) : totalFiltered === 0 ? (
                  <div className="text-center py-6">
                    <p className="text-xs text-gray-400">No players match &ldquo;{pickerSearch}&rdquo;</p>
                  </div>
                ) : (
                  groupedPlayers.map(([team, teamPlayers]) => (
                    <div key={team}>
                      {/* Team header */}
                      <div className="sticky top-0 px-3 py-1.5 bg-navy/[0.04] border-b border-gray-100">
                        <span className="text-[10px] font-oswald uppercase tracking-wider text-navy/70 font-bold">
                          {team}
                        </span>
                        <span className="text-[10px] text-gray-400 ml-1.5">
                          ({teamPlayers.length})
                        </span>
                      </div>
                      {/* Players in this team */}
                      {teamPlayers.map((p) => (
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
                          </span>
                          {p.position && (
                            <span className="px-1.5 py-0.5 rounded bg-navy/10 text-navy text-[9px] font-bold shrink-0">
                              {p.position}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Empty state */}
        {!selectedPlayerId && (
          <div className="text-center py-8">
            <User size={32} className="mx-auto text-gray-300 mb-3" />
            <p className="text-sm text-gray-400">
              Select a player to see their development journey
            </p>
            <p className="text-[10px] text-gray-300 mt-1">
              Or generate a <span className="font-bold">Family Card</span> report
              for a full assessment
            </p>
          </div>
        )}

        {/* Loading state */}
        {selectedPlayerId && loading && (
          <div className="flex flex-col items-center py-8 gap-3">
            <HockeyRink size="card" />
            <p className="text-xs text-gray-400">Loading player data...</p>
          </div>
        )}

        {/* Player data */}
        {selectedPlayerId && !loading && player && (
          <>
            {/* Player info card */}
            <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 mb-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <h4 className="text-base font-bold text-navy">
                    {player.first_name} {player.last_name}
                  </h4>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {player.current_team && (
                      <span className="text-xs text-gray-500">
                        {player.current_team}
                      </span>
                    )}
                    {player.position && (
                      <span className="px-1.5 py-0.5 rounded bg-navy/10 text-navy text-[10px] font-bold">
                        {player.position}
                      </span>
                    )}
                    {(intelligence?.archetype || player.archetype) && (
                      <span className="px-1.5 py-0.5 rounded bg-teal/10 text-teal text-[10px] font-bold">
                        {intelligence?.archetype || player.archetype}
                      </span>
                    )}
                    {intelligence?.projection && (
                      <span className="text-[10px] text-gray-400 italic">
                        {intelligence.projection}
                      </span>
                    )}
                  </div>
                </div>
                {/* Translator toggle */}
                {intelligence && (
                  <TranslatorToggle mode={viewMode} onToggle={toggleView} />
                )}
              </div>

              {/* Grades */}
              {intelligence && (
                <div className="mb-3">
                  <div className="text-[10px] font-oswald uppercase tracking-wider text-gray-400 mb-1.5">
                    Grades
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { label: "OVR", value: intelligence.overall_grade },
                      { label: "OFF", value: intelligence.offensive_grade },
                      { label: "DEF", value: intelligence.defensive_grade },
                      { label: "SKT", value: intelligence.skating_grade },
                      { label: "IQ", value: intelligence.hockey_iq_grade },
                      { label: "CMP", value: intelligence.compete_grade },
                    ].map((g) => (
                      <span
                        key={g.label}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded border text-[10px] font-bold ${gradeStyle(
                          g.value
                        )}`}
                      >
                        <span className="text-gray-400 font-normal">
                          {g.label}
                        </span>
                        {g.value || "NR"}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Strengths + Focus Areas */}
              {intelligence && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {intelligence.strengths && intelligence.strengths.length > 0 && (
                    <div>
                      <div className="text-[10px] font-oswald uppercase tracking-wider text-teal mb-1">
                        Strengths
                      </div>
                      <ul className="space-y-0.5">
                        {intelligence.strengths.slice(0, 4).map((s, i) => (
                          <li
                            key={i}
                            className="text-xs text-gray-600 flex items-start gap-1.5"
                          >
                            <span className="text-teal mt-0.5">•</span>
                            {translate(s)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {intelligence.development_areas &&
                    intelligence.development_areas.length > 0 && (
                      <div>
                        <div className="text-[10px] font-oswald uppercase tracking-wider text-orange mb-1">
                          Focus Areas
                        </div>
                        <ul className="space-y-0.5">
                          {intelligence.development_areas.slice(0, 4).map((d, i) => (
                            <li
                              key={i}
                              className="text-xs text-gray-600 flex items-start gap-1.5"
                            >
                              <span className="text-orange mt-0.5">•</span>
                              {translate(d)}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2 mb-4">
              {latestReport && (
                <button
                  onClick={() => router.push(`/reports/${latestReport.id}`)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-navy/5 text-navy text-xs font-bold hover:bg-navy/10 transition-colors border border-navy/10"
                >
                  <FileText size={13} />
                  View Latest Report
                </button>
              )}
              <button
                onClick={() =>
                  router.push(
                    `/reports/generate?player=${selectedPlayerId}&type=family_card`
                  )
                }
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-teal/10 text-teal text-xs font-bold hover:bg-teal/20 transition-colors border border-teal/20"
              >
                <Calendar size={13} />
                Generate Assessment
              </button>
              <button
                onClick={handleGenerateFocusPlan}
                disabled={focusPlanLoading}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-orange/10 text-orange text-xs font-bold hover:bg-orange/20 transition-colors border border-orange/20 disabled:opacity-50"
              >
                {focusPlanLoading ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Target size={13} />
                    Monthly Focus Plan
                  </>
                )}
              </button>
            </div>

            {/* Focus plan error */}
            {focusPlanError && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                <AlertCircle size={14} className="text-red-500 mt-0.5 shrink-0" />
                <p className="text-xs text-red-700">{focusPlanError}</p>
              </div>
            )}

            {/* Focus plan loading */}
            {focusPlanLoading && (
              <div className="flex flex-col items-center py-6 gap-3 bg-gray-50 rounded-lg border border-gray-200">
                <HockeyRink size="card" />
                <p className="text-xs text-gray-400">
                  Generating personalized focus plan...
                </p>
                <p className="text-[10px] text-gray-300">
                  Analyzing stats, intelligence, and recent form
                </p>
              </div>
            )}

            {/* Focus plan display */}
            {focusPlan && !focusPlanLoading && (
              <FocusPlanDisplay
                plan={focusPlan}
                onRegenerate={handleGenerateFocusPlan}
                translate={translate}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ---------- Focus Plan Display Sub-component ---------- */
function FocusPlanDisplay({
  plan,
  onRegenerate,
  translate,
}: {
  plan: FocusPlan;
  onRegenerate: () => void;
  translate: (text: string) => string;
}) {
  return (
    <div className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-navy/[0.04] border-b border-gray-200">
        <div className="flex items-center gap-2">
          <Calendar size={14} className="text-navy" />
          <span className="text-xs font-oswald uppercase tracking-wider text-navy font-bold">
            Monthly Focus: {plan.month_label}
          </span>
        </div>
        <button
          onClick={onRegenerate}
          className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-gray-500 hover:text-navy hover:bg-navy/5 transition-colors"
        >
          <RefreshCw size={10} />
          Regenerate
        </button>
      </div>

      {/* Categories 2×2 grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4">
        {plan.categories.map((cat: FocusPlanCategory) => {
          const config = CATEGORY_CONFIG[cat.label] || CATEGORY_CONFIG.SKILL;
          const Icon = config.icon;
          return (
            <div
              key={cat.label}
              className={`rounded-lg border ${config.border} ${config.bg} p-3`}
            >
              <div className="flex items-center gap-1.5 mb-2">
                <Icon size={13} className={config.color} />
                <span
                  className={`text-[10px] font-oswald uppercase tracking-wider font-bold ${config.color}`}
                >
                  {cat.label}
                </span>
              </div>
              <ul className="space-y-1.5">
                {cat.items.map((item: string, i: number) => (
                  <li
                    key={i}
                    className="text-xs text-gray-700 leading-relaxed flex items-start gap-1.5"
                  >
                    <span className={`${config.color} mt-0.5 shrink-0`}>•</span>
                    {translate(item)}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {/* Timestamp */}
      <div className="px-4 pb-3">
        <p className="text-[10px] text-gray-300 text-right">
          Generated{" "}
          {new Date(plan.generated_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </p>
      </div>
    </div>
  );
}
