"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Trophy,
  ArrowLeft,
  Save,
  X,
  Plus,
  Trash2,
  CheckCircle,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Shield,
  Crosshair,
  Users,
  Zap,
  Download,
} from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import api from "@/lib/api";
import type { SeriesPlan } from "@/types/api";
import { SERIES_FORMATS } from "@/types/api";

// ── Types ────────────────────────────────────────────────────
interface GameNote {
  game_number: number;
  result: string;
  notes: string;
}

interface MomentumEntry {
  game_number: number;
  score: number;
  notes: string;
}

interface KeyPlayer {
  name: string;
  number: string;
  position: string;
  threat_level: string;
  notes: string;
  counter_strategy: string;
}

interface OpponentSystems {
  offensive: string;
  defensive: string;
  special_teams: string;
  tendencies: string;
}

interface MatchupPlan {
  line_matchups: string;
  d_pair_assignments: string;
  notes: string;
}

interface Adjustment {
  trigger: string;
  action: string;
  priority: string;
  used_in_game: string;
}

type TabKey = "overview" | "dossier" | "games" | "adjustments";

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: "overview", label: "Overview", icon: Trophy },
  { key: "dossier", label: "Dossier", icon: Shield },
  { key: "games", label: "Games", icon: Zap },
  { key: "adjustments", label: "Adjustments", icon: Crosshair },
];

const STATUS_OPTIONS: { value: SeriesPlan["status"]; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
  { value: "completed", label: "Completed" },
];

const STATUS_COLORS: Record<string, string> = {
  active: "bg-teal/10 text-teal",
  won: "bg-green-100 text-green-700",
  lost: "bg-red-100 text-red-600",
  completed: "bg-gray-100 text-gray-600",
};

const EMPTY_SYSTEMS: OpponentSystems = { offensive: "", defensive: "", special_teams: "", tendencies: "" };
const EMPTY_MATCHUP: MatchupPlan = { line_matchups: "", d_pair_assignments: "", notes: "" };

// ── Helpers ──────────────────────────────────────────────────
const parseJSON = <T,>(val: string | T, fallback: T): T => {
  if (typeof val !== "string") return val;
  try { return JSON.parse(val); } catch { return fallback; }
};

// ── Page Wrapper ─────────────────────────────────────────────
export default function SeriesDetailPage() {
  return (
    <ProtectedRoute>
      <NavBar />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <SeriesDetail />
      </main>
    </ProtectedRoute>
  );
}

// ── Main Component ───────────────────────────────────────────
function SeriesDetail() {
  const params = useParams();
  const router = useRouter();
  const seriesId = params.id as string;

  const [series, setSeries] = useState<SeriesPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [printMode, setPrintMode] = useState(false);

  // Parsed JSON fields
  const [gameNotes, setGameNotes] = useState<GameNote[]>([]);
  const [workingStrategies, setWorkingStrategies] = useState<string[]>([]);
  const [needsAdjustment, setNeedsAdjustment] = useState<string[]>([]);
  const [opponentSystems, setOpponentSystems] = useState<OpponentSystems>(EMPTY_SYSTEMS);
  const [keyPlayers, setKeyPlayers] = useState<KeyPlayer[]>([]);
  const [matchupPlan, setMatchupPlan] = useState<MatchupPlan>(EMPTY_MATCHUP);
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [momentumLog, setMomentumLog] = useState<MomentumEntry[]>([]);

  // Edit state
  const [editingScore, setEditingScore] = useState(false);
  const [scoreValue, setScoreValue] = useState("");
  const [expandedGame, setExpandedGame] = useState<number | null>(null);
  const [newStrategy, setNewStrategy] = useState("");
  const [newNeedsAdj, setNewNeedsAdj] = useState("");
  const [addingGameNote, setAddingGameNote] = useState(false);
  const [newGameResult, setNewGameResult] = useState("win");
  const [newGameNotes, setNewGameNotes] = useState("");
  const [newGameMomentum, setNewGameMomentum] = useState(50);

  // ── Load data ──────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        const { data } = await api.get<SeriesPlan>(`/series/${seriesId}`);
        setSeries(data);
        setScoreValue(data.current_score || "0-0");
        setGameNotes(parseJSON<GameNote[]>(data.game_notes, []));
        setWorkingStrategies(parseJSON<string[]>(data.working_strategies, []));
        setNeedsAdjustment(parseJSON<string[]>(data.needs_adjustment, []));
        setOpponentSystems(parseJSON<OpponentSystems>(data.opponent_systems, EMPTY_SYSTEMS));
        setKeyPlayers(parseJSON<KeyPlayer[]>(data.key_players_dossier, []));
        setMatchupPlan(parseJSON<MatchupPlan>(data.matchup_plan, EMPTY_MATCHUP));
        setAdjustments(parseJSON<Adjustment[]>(data.adjustments, []));
        setMomentumLog(parseJSON<MomentumEntry[]>(data.momentum_log, []));
      } catch {
        setError("Series not found");
      } finally {
        setLoading(false);
      }
    }
    if (seriesId) load();
  }, [seriesId]);

  // ── Save helper ────────────────────────────────────────────
  const saveField = useCallback(async (updates: Record<string, unknown>) => {
    setSaving(true);
    try {
      const { data } = await api.put<SeriesPlan>(`/series/${seriesId}`, updates);
      setSeries(data);
    } catch {
      // silently fail — could add toast later
    } finally {
      setSaving(false);
    }
  }, [seriesId]);

  const handleDelete = async () => {
    if (!confirm("Delete this series? This cannot be undone.")) return;
    try {
      await api.delete(`/series/${seriesId}`);
      router.push("/series");
    } catch {
      alert("Failed to delete series");
    }
  };

  const handleDownloadPDF = () => {
    if (!series) return;
    setPrintMode(true);
    setTimeout(() => {
      const prev = document.title;
      const fileName = `${series.series_name}_${series.team_name}_vs_${series.opponent_team_name}`.replace(/\s+/g, "_");
      document.title = fileName;
      window.print();
      setTimeout(() => {
        document.title = prev;
        setPrintMode(false);
      }, 1000);
    }, 100);
  };

  const handleStatusChange = (newStatus: string) => {
    saveField({ status: newStatus });
  };

  // ── Overview handlers ──────────────────────────────────────
  const addStrategy = () => {
    if (!newStrategy.trim()) return;
    const updated = [...workingStrategies, newStrategy.trim()];
    setWorkingStrategies(updated);
    setNewStrategy("");
    saveField({ working_strategies: updated });
  };

  const removeStrategy = (idx: number) => {
    const updated = workingStrategies.filter((_, i) => i !== idx);
    setWorkingStrategies(updated);
    saveField({ working_strategies: updated });
  };

  const addNeedsAdj = () => {
    if (!newNeedsAdj.trim()) return;
    const updated = [...needsAdjustment, newNeedsAdj.trim()];
    setNeedsAdjustment(updated);
    setNewNeedsAdj("");
    saveField({ needs_adjustment: updated });
  };

  const removeNeedsAdj = (idx: number) => {
    const updated = needsAdjustment.filter((_, i) => i !== idx);
    setNeedsAdjustment(updated);
    saveField({ needs_adjustment: updated });
  };

  // ── Games handlers ─────────────────────────────────────────
  const addGameNote = () => {
    const gameNum = gameNotes.length + 1;
    const note: GameNote = {
      game_number: gameNum,
      result: newGameResult,
      notes: newGameNotes,
    };
    const updatedNotes = [...gameNotes, note];
    const momentum: MomentumEntry = {
      game_number: gameNum,
      score: newGameMomentum,
      notes: "",
    };
    const updatedMomentum = [...momentumLog, momentum];
    setGameNotes(updatedNotes);
    setMomentumLog(updatedMomentum);
    setNewGameResult("win");
    setNewGameNotes("");
    setNewGameMomentum(50);
    setAddingGameNote(false);
    saveField({ game_notes: updatedNotes, momentum_log: updatedMomentum });
  };

  const updateMomentum = (gameNum: number, score: number) => {
    const updated = momentumLog.map((m) =>
      m.game_number === gameNum ? { ...m, score } : m
    );
    setMomentumLog(updated);
    saveField({ momentum_log: updated });
  };

  // ── Dossier handlers ──────────────────────────────────────
  const updateOpponentSystems = (key: keyof OpponentSystems, value: string) => {
    const updated = { ...opponentSystems, [key]: value };
    setOpponentSystems(updated);
    saveField({ opponent_systems: updated });
  };

  const addKeyPlayer = () => {
    const newPlayer: KeyPlayer = {
      name: "",
      number: "",
      position: "F",
      threat_level: "medium",
      notes: "",
      counter_strategy: "",
    };
    const updated = [...keyPlayers, newPlayer];
    setKeyPlayers(updated);
    saveField({ key_players_dossier: updated });
  };

  const updateKeyPlayer = (idx: number, field: keyof KeyPlayer, value: string) => {
    const updated = keyPlayers.map((p, i) => (i === idx ? { ...p, [field]: value } : p));
    setKeyPlayers(updated);
  };

  const saveKeyPlayers = () => {
    saveField({ key_players_dossier: keyPlayers });
  };

  const removeKeyPlayer = (idx: number) => {
    const updated = keyPlayers.filter((_, i) => i !== idx);
    setKeyPlayers(updated);
    saveField({ key_players_dossier: updated });
  };

  const updateMatchupPlan = (key: keyof MatchupPlan, value: string) => {
    const updated = { ...matchupPlan, [key]: value };
    setMatchupPlan(updated);
    saveField({ matchup_plan: updated });
  };

  // ── Adjustments handlers ──────────────────────────────────
  const addAdjustment = () => {
    const newAdj: Adjustment = { trigger: "", action: "", priority: "medium", used_in_game: "" };
    const updated = [...adjustments, newAdj];
    setAdjustments(updated);
    saveField({ adjustments: updated });
  };

  const updateAdjustment = (idx: number, field: keyof Adjustment, value: string) => {
    const updated = adjustments.map((a, i) => (i === idx ? { ...a, [field]: value } : a));
    setAdjustments(updated);
  };

  const saveAdjustments = () => {
    saveField({ adjustments });
  };

  const removeAdjustment = (idx: number) => {
    const updated = adjustments.filter((_, i) => i !== idx);
    setAdjustments(updated);
    saveField({ adjustments: updated });
  };

  // ── Loading / Error states ─────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-navy border-t-teal" />
      </div>
    );
  }

  if (error || !series) {
    return (
      <div className="text-center py-16">
        <p className="text-muted">{error || "Series not found"}</p>
        <Link href="/series" className="text-teal hover:underline text-sm mt-2 inline-block">
          Back to Series
        </Link>
      </div>
    );
  }

  const formatLabel = SERIES_FORMATS.find((f) => f.value === series.series_format)?.label || series.series_format;

  // ── Render ─────────────────────────────────────────────────
  return (
    <div>
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex items-start gap-3 mb-4">
        <Link href="/series" className="no-print text-muted hover:text-navy transition-colors mt-1">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-navy flex items-center gap-2">
            <Trophy size={20} className="text-orange shrink-0" />
            <span className="truncate">
              {series.series_name || `${series.team_name} vs ${series.opponent_team_name}`}
            </span>
          </h1>
          <p className="text-xs text-muted mt-0.5">
            {formatLabel} &middot; {series.team_name} vs {series.opponent_team_name}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleDownloadPDF}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-teal/10 text-teal border border-teal/20 rounded-lg text-xs font-semibold hover:bg-teal/20 transition-colors no-print"
            title="Download as PDF"
          >
            <Download size={14} />
            PDF
          </button>
          <select
            value={series.status}
            onChange={(e) => handleStatusChange(e.target.value)}
            className={`no-print text-[10px] px-2 py-1 rounded-full font-oswald uppercase tracking-wider border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal/30 ${STATUS_COLORS[series.status] || "bg-gray-100 text-gray-600"}`}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <button
            onClick={handleDelete}
            className="no-print p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
            title="Delete series"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* ── Score Display ───────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-teal/20 p-5 mb-4">
        <div className="text-center">
          <p className="text-xs text-muted font-oswald uppercase tracking-wider mb-2">Series Score</p>
          {editingScore ? (
            <div className="flex items-center justify-center gap-3">
              <input
                type="text"
                value={scoreValue}
                onChange={(e) => setScoreValue(e.target.value)}
                className="w-24 text-center border border-teal/20 rounded-lg px-2 py-1 text-2xl font-oswald font-bold text-navy focus:outline-none focus:ring-2 focus:ring-teal/30"
              />
              <button
                onClick={() => { saveField({ current_score: scoreValue }); setEditingScore(false); }}
                className="text-teal hover:text-teal/70"
              >
                <Save size={16} />
              </button>
              <button
                onClick={() => { setScoreValue(series.current_score || "0-0"); setEditingScore(false); }}
                className="text-muted hover:text-navy"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setEditingScore(true)}
              className="text-4xl font-oswald font-bold text-navy hover:text-teal transition-colors"
            >
              {series.current_score || "0-0"}
            </button>
          )}
          <p className="no-print text-[10px] text-muted mt-1">Click to update</p>
        </div>
      </div>

      {/* ── Saving indicator ────────────────────────────────── */}
      {saving && (
        <div className="flex items-center justify-center gap-2 text-xs text-teal mb-3">
          <div className="animate-spin rounded-full h-3 w-3 border border-teal border-t-transparent" />
          Saving...
        </div>
      )}

      {/* ── Tab Navigation ──────────────────────────────────── */}
      <div className="no-print flex gap-1 bg-gray-100 rounded-lg p-1 w-fit mb-6">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-lg text-sm font-oswald uppercase tracking-wider transition-colors flex items-center gap-1.5 ${
              activeTab === tab.key
                ? "bg-white text-navy shadow-sm"
                : "text-muted hover:text-navy"
            }`}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Overview Tab ────────────────────────────────────── */}
      {(activeTab === "overview" || printMode) && (
        <div className="space-y-4">
          {/* Working Strategies */}
          <div className="bg-white rounded-xl border border-teal/20 p-5">
            <h3 className="text-sm font-oswald uppercase tracking-wider text-navy flex items-center gap-2 mb-3">
              <CheckCircle size={14} className="text-green-600" />
              Working Strategies
            </h3>
            <div className="space-y-1.5 mb-3">
              {workingStrategies.map((s, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <span className="text-green-600 mt-0.5">&#10003;</span>
                  <span className="flex-1 text-navy/80">{s}</span>
                  <button onClick={() => removeStrategy(i)} className="no-print text-muted hover:text-red-500 shrink-0">
                    <X size={10} />
                  </button>
                </div>
              ))}
              {workingStrategies.length === 0 && (
                <p className="text-xs text-muted">No strategies recorded yet.</p>
              )}
            </div>
            <div className="no-print flex gap-2">
              <input
                type="text"
                value={newStrategy}
                onChange={(e) => setNewStrategy(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addStrategy()}
                placeholder="Add a working strategy..."
                className="flex-1 border border-teal/20 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-teal/30"
              />
              <button
                onClick={addStrategy}
                disabled={!newStrategy.trim()}
                className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded hover:bg-green-200 disabled:opacity-50"
              >
                <Plus size={12} />
              </button>
            </div>
          </div>

          {/* Needs Adjustment */}
          <div className="bg-white rounded-xl border border-teal/20 p-5">
            <h3 className="text-sm font-oswald uppercase tracking-wider text-navy flex items-center gap-2 mb-3">
              <AlertTriangle size={14} className="text-orange" />
              Needs Adjustment
            </h3>
            <div className="space-y-1.5 mb-3">
              {needsAdjustment.map((s, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <span className="text-orange mt-0.5">!</span>
                  <span className="flex-1 text-navy/80">{s}</span>
                  <button onClick={() => removeNeedsAdj(i)} className="no-print text-muted hover:text-red-500 shrink-0">
                    <X size={10} />
                  </button>
                </div>
              ))}
              {needsAdjustment.length === 0 && (
                <p className="text-xs text-muted">Nothing flagged for adjustment.</p>
              )}
            </div>
            <div className="no-print flex gap-2">
              <input
                type="text"
                value={newNeedsAdj}
                onChange={(e) => setNewNeedsAdj(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addNeedsAdj()}
                placeholder="Flag something for adjustment..."
                className="flex-1 border border-teal/20 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-teal/30"
              />
              <button
                onClick={addNeedsAdj}
                disabled={!newNeedsAdj.trim()}
                className="px-2 py-1 bg-orange/10 text-orange text-xs rounded hover:bg-orange/20 disabled:opacity-50"
              >
                <Plus size={12} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Dossier Tab ─────────────────────────────────────── */}
      {printMode && <h2 className="print-only font-oswald text-lg text-navy uppercase tracking-wider mt-6 mb-3 print-break-before">Opponent Dossier</h2>}
      {(activeTab === "dossier" || printMode) && (
        <div className="space-y-4">
          {/* Opponent Systems */}
          <div className="bg-white rounded-xl border border-teal/20 p-5">
            <h3 className="text-sm font-oswald uppercase tracking-wider text-navy flex items-center gap-2 mb-4">
              <Shield size={14} className="text-teal" />
              Opponent Systems
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {([
                { key: "offensive" as const, label: "Offensive System" },
                { key: "defensive" as const, label: "Defensive System" },
                { key: "special_teams" as const, label: "Special Teams" },
                { key: "tendencies" as const, label: "Tendencies" },
              ]).map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-[11px] font-oswald uppercase tracking-wider text-muted mb-1">
                    {label}
                  </label>
                  <textarea
                    value={opponentSystems[key]}
                    onChange={(e) => setOpponentSystems({ ...opponentSystems, [key]: e.target.value })}
                    onBlur={() => updateOpponentSystems(key, opponentSystems[key])}
                    rows={3}
                    placeholder={`Describe ${label.toLowerCase()}...`}
                    className="w-full border border-teal/20 rounded-lg px-3 py-2 text-xs text-navy focus:outline-none focus:ring-1 focus:ring-teal/30 resize-none"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Key Players Dossier */}
          <div className="bg-white rounded-xl border border-teal/20 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-oswald uppercase tracking-wider text-navy flex items-center gap-2">
                <Users size={14} className="text-orange" />
                Key Players
              </h3>
              <button
                onClick={addKeyPlayer}
                className="no-print text-xs text-teal hover:text-teal/70 flex items-center gap-1"
              >
                <Plus size={12} /> Add Player
              </button>
            </div>
            {keyPlayers.length === 0 ? (
              <p className="text-xs text-muted">No key players identified yet.</p>
            ) : (
              <div className="space-y-3">
                {keyPlayers.map((kp, i) => (
                  <div key={i} className="border border-teal/20 rounded-lg p-3 bg-gray-50/50">
                    <div className="flex items-center gap-2 mb-2">
                      <input
                        type="text"
                        value={kp.name}
                        onChange={(e) => updateKeyPlayer(i, "name", e.target.value)}
                        onBlur={saveKeyPlayers}
                        placeholder="Player name"
                        className="flex-1 border border-teal/20 rounded px-2 py-1 text-xs font-medium text-navy focus:outline-none focus:ring-1 focus:ring-teal/30"
                      />
                      <input
                        type="text"
                        value={kp.number}
                        onChange={(e) => updateKeyPlayer(i, "number", e.target.value)}
                        onBlur={saveKeyPlayers}
                        placeholder="#"
                        className="w-12 border border-teal/20 rounded px-2 py-1 text-xs text-center focus:outline-none focus:ring-1 focus:ring-teal/30"
                      />
                      <select
                        value={kp.position}
                        onChange={(e) => { updateKeyPlayer(i, "position", e.target.value); }}
                        onBlur={saveKeyPlayers}
                        className="border border-teal/20 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-teal/30"
                      >
                        <option value="F">F</option>
                        <option value="D">D</option>
                        <option value="G">G</option>
                      </select>
                      <select
                        value={kp.threat_level}
                        onChange={(e) => { updateKeyPlayer(i, "threat_level", e.target.value); }}
                        onBlur={saveKeyPlayers}
                        className={`border border-teal/20 rounded px-2 py-1 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-teal/30 ${
                          kp.threat_level === "high" ? "text-red-600"
                            : kp.threat_level === "medium" ? "text-orange"
                            : "text-gray-500"
                        }`}
                      >
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                      </select>
                      <button
                        onClick={() => removeKeyPlayer(i)}
                        className="no-print text-muted hover:text-red-500"
                        title="Remove player"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] text-muted uppercase tracking-wider mb-0.5">Scouting Notes</label>
                        <textarea
                          value={kp.notes}
                          onChange={(e) => updateKeyPlayer(i, "notes", e.target.value)}
                          onBlur={saveKeyPlayers}
                          rows={2}
                          placeholder="Strengths, tendencies, habits..."
                          className="w-full border border-teal/20 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-teal/30 resize-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-muted uppercase tracking-wider mb-0.5">Counter Strategy</label>
                        <textarea
                          value={kp.counter_strategy}
                          onChange={(e) => updateKeyPlayer(i, "counter_strategy", e.target.value)}
                          onBlur={saveKeyPlayers}
                          rows={2}
                          placeholder="How to neutralize this player..."
                          className="w-full border border-teal/20 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-teal/30 resize-none"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Matchup Plan */}
          <div className="bg-white rounded-xl border border-teal/20 p-5">
            <h3 className="text-sm font-oswald uppercase tracking-wider text-navy flex items-center gap-2 mb-4">
              <Crosshair size={14} className="text-navy" />
              Matchup Plan
            </h3>
            <div className="space-y-3">
              {([
                { key: "line_matchups" as const, label: "Line Matchups", placeholder: "Which of our lines match up against theirs..." },
                { key: "d_pair_assignments" as const, label: "D-Pair Assignments", placeholder: "Defensive pair deployment strategy..." },
                { key: "notes" as const, label: "Additional Notes", placeholder: "Faceoff deployment, last change strategy..." },
              ]).map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="block text-[11px] font-oswald uppercase tracking-wider text-muted mb-1">
                    {label}
                  </label>
                  <textarea
                    value={matchupPlan[key]}
                    onChange={(e) => setMatchupPlan({ ...matchupPlan, [key]: e.target.value })}
                    onBlur={() => updateMatchupPlan(key, matchupPlan[key])}
                    rows={3}
                    placeholder={placeholder}
                    className="w-full border border-teal/20 rounded-lg px-3 py-2 text-xs text-navy focus:outline-none focus:ring-1 focus:ring-teal/30 resize-none"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Games Tab ───────────────────────────────────────── */}
      {printMode && <h2 className="print-only font-oswald text-lg text-navy uppercase tracking-wider mt-6 mb-3 print-break-before">Game Notes</h2>}
      {(activeTab === "games" || printMode) && (
        <div className="space-y-4">
          {/* Add Game */}
          <div className="bg-white rounded-xl border border-teal/20 p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-oswald uppercase tracking-wider text-navy flex items-center gap-2">
                <Zap size={14} className="text-teal" />
                Game-by-Game
              </h3>
              <button
                onClick={() => setAddingGameNote(!addingGameNote)}
                className="no-print text-xs text-teal hover:text-teal/70 flex items-center gap-1"
              >
                {addingGameNote ? <X size={12} /> : <Plus size={12} />}
                {addingGameNote ? "Cancel" : "Add Game"}
              </button>
            </div>

            {addingGameNote && (
              <div className="no-print mb-4 p-3 bg-gray-50 rounded-lg border border-teal/20 space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium text-navy">Game {gameNotes.length + 1}</span>
                  <select
                    value={newGameResult}
                    onChange={(e) => setNewGameResult(e.target.value)}
                    className="border border-teal/20 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-teal/30"
                  >
                    <option value="win">Win</option>
                    <option value="loss">Loss</option>
                    <option value="otl">OT Loss</option>
                  </select>
                </div>
                <textarea
                  value={newGameNotes}
                  onChange={(e) => setNewGameNotes(e.target.value)}
                  placeholder="Key takeaways, what worked, what didn't..."
                  rows={3}
                  className="w-full border border-teal/20 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-teal/30 resize-none"
                />
                <div>
                  <label className="block text-[10px] text-muted uppercase tracking-wider mb-1">
                    Momentum Score: {newGameMomentum}%
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={newGameMomentum}
                    onChange={(e) => setNewGameMomentum(Number(e.target.value))}
                    className="w-full accent-teal"
                  />
                  <div className="flex justify-between text-[9px] text-muted">
                    <span>Opponent controlled</span>
                    <span>Even</span>
                    <span>We controlled</span>
                  </div>
                </div>
                <button
                  onClick={addGameNote}
                  disabled={!newGameNotes.trim()}
                  className="px-3 py-1.5 bg-teal text-white text-xs font-medium rounded hover:bg-teal/90 disabled:opacity-50"
                >
                  Save Game Note
                </button>
              </div>
            )}

            {gameNotes.length === 0 ? (
              <p className="text-xs text-muted">No game notes yet. Add notes after each game.</p>
            ) : (
              <div className="space-y-2">
                {gameNotes.map((gn, i) => {
                  const momentum = momentumLog.find((m) => m.game_number === gn.game_number);
                  return (
                    <div key={i} className="border border-teal/20 rounded-lg overflow-hidden">
                      <button
                        onClick={() => setExpandedGame(expandedGame === i ? null : i)}
                        className="w-full px-3 py-2.5 flex items-center justify-between hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-navy">Game {gn.game_number}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                            gn.result === "win" ? "bg-green-100 text-green-700"
                              : gn.result === "loss" ? "bg-red-100 text-red-700"
                              : "bg-yellow-100 text-yellow-700"
                          }`}>
                            {gn.result.toUpperCase()}
                          </span>
                          {momentum && (
                            <div className="flex items-center gap-1.5 ml-2">
                              <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{
                                    width: `${momentum.score}%`,
                                    backgroundColor: momentum.score >= 60 ? "#18B3A6" : momentum.score >= 40 ? "#F36F21" : "#ef4444",
                                  }}
                                />
                              </div>
                              <span className="text-[9px] text-muted">{momentum.score}%</span>
                            </div>
                          )}
                        </div>
                        {expandedGame === i ? (
                          <ChevronDown size={14} className="text-muted" />
                        ) : (
                          <ChevronRight size={14} className="text-muted" />
                        )}
                      </button>
                      {expandedGame === i && (
                        <div className="px-3 py-3 border-t border-teal/20 bg-gray-50 space-y-3">
                          <p className="text-xs text-navy/80 whitespace-pre-wrap">{gn.notes}</p>
                          {momentum && (
                            <div>
                              <label className="block text-[10px] text-muted uppercase tracking-wider mb-1">
                                Momentum: {momentum.score}%
                              </label>
                              <input
                                type="range"
                                min={0}
                                max={100}
                                value={momentum.score}
                                onChange={(e) => updateMomentum(gn.game_number, Number(e.target.value))}
                                className="w-full accent-teal"
                              />
                              <div className="flex justify-between text-[9px] text-muted">
                                <span>Opponent</span>
                                <span>Even</span>
                                <span>Us</span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Momentum Overview */}
          {momentumLog.length > 0 && (
            <div className="bg-white rounded-xl border border-teal/20 p-5">
              <h3 className="text-sm font-oswald uppercase tracking-wider text-navy mb-3">
                Momentum Trend
              </h3>
              <div className="space-y-2">
                {momentumLog.map((m) => (
                  <div key={m.game_number} className="flex items-center gap-3">
                    <span className="text-[10px] font-oswald text-muted w-10 shrink-0">G{m.game_number}</span>
                    <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${m.score}%`,
                          backgroundColor: m.score >= 60 ? "#18B3A6" : m.score >= 40 ? "#F36F21" : "#ef4444",
                        }}
                      />
                    </div>
                    <span className="text-[10px] font-medium text-navy w-8 text-right">{m.score}%</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between mt-2 text-[9px] text-muted">
                <span>0% = Opponent dominated</span>
                <span>100% = We dominated</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Adjustments Tab ─────────────────────────────────── */}
      {printMode && <h2 className="print-only font-oswald text-lg text-navy uppercase tracking-wider mt-6 mb-3 print-break-before">Adjustments</h2>}
      {(activeTab === "adjustments" || printMode) && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-teal/20 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-oswald uppercase tracking-wider text-navy flex items-center gap-2">
                <Crosshair size={14} className="text-orange" />
                If / Then Adjustments
              </h3>
              <button
                onClick={addAdjustment}
                className="no-print text-xs text-teal hover:text-teal/70 flex items-center gap-1"
              >
                <Plus size={12} /> Add Adjustment
              </button>
            </div>

            {adjustments.length === 0 ? (
              <p className="text-xs text-muted">
                No adjustments defined yet. Plan your if/then scenarios.
              </p>
            ) : (
              <div className="space-y-3">
                {adjustments.map((adj, i) => (
                  <div key={i} className="border border-teal/20 rounded-lg p-3 bg-gray-50/50">
                    <div className="flex items-start gap-2 mb-2">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-oswald uppercase tracking-wider shrink-0 mt-0.5 ${
                        adj.priority === "high" ? "bg-red-100 text-red-700"
                          : adj.priority === "medium" ? "bg-orange/10 text-orange"
                          : "bg-gray-100 text-gray-500"
                      }`}>
                        {adj.priority}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
                          <div>
                            <label className="block text-[10px] text-muted uppercase tracking-wider mb-0.5">
                              If...
                            </label>
                            <input
                              type="text"
                              value={adj.trigger}
                              onChange={(e) => updateAdjustment(i, "trigger", e.target.value)}
                              onBlur={saveAdjustments}
                              placeholder="They start trapping in the neutral zone..."
                              className="w-full border border-teal/20 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-teal/30"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-muted uppercase tracking-wider mb-0.5">
                              Then...
                            </label>
                            <input
                              type="text"
                              value={adj.action}
                              onChange={(e) => updateAdjustment(i, "action", e.target.value)}
                              onBlur={saveAdjustments}
                              placeholder="Use stretch passes, chip and chase..."
                              className="w-full border border-teal/20 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-teal/30"
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5">
                            <label className="text-[10px] text-muted uppercase tracking-wider">Priority:</label>
                            <select
                              value={adj.priority}
                              onChange={(e) => { updateAdjustment(i, "priority", e.target.value); }}
                              onBlur={saveAdjustments}
                              className="border border-teal/20 rounded px-1.5 py-0.5 text-[10px] focus:outline-none focus:ring-1 focus:ring-teal/30"
                            >
                              <option value="high">High</option>
                              <option value="medium">Medium</option>
                              <option value="low">Low</option>
                            </select>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <label className="text-[10px] text-muted uppercase tracking-wider">Used in:</label>
                            <input
                              type="text"
                              value={adj.used_in_game}
                              onChange={(e) => updateAdjustment(i, "used_in_game", e.target.value)}
                              onBlur={saveAdjustments}
                              placeholder="e.g. Game 3"
                              className="w-20 border border-teal/20 rounded px-1.5 py-0.5 text-[10px] focus:outline-none focus:ring-1 focus:ring-teal/30"
                            />
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => removeAdjustment(i)}
                        className="no-print text-muted hover:text-red-500 shrink-0"
                        title="Remove adjustment"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Print Footer ────────────────────────────────────── */}
      <div className="print-footer mt-8 pt-4 border-t border-navy/10 justify-center items-center gap-2 text-xs text-muted">
        <div className="text-center">
          <p className="font-oswald text-navy text-sm">ProspectX Intelligence</p>
          <p>Exported {new Date().toLocaleDateString()}</p>
        </div>
      </div>
    </div>
  );
}
