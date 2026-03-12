"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import toast from "react-hot-toast";
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
  Sparkles,
  AlertCircle,
  Loader2,
  Printer,
  ClipboardList,
} from "lucide-react";
import BenchCardView from "@/components/BenchCardView";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import ReportSection from "@/components/ReportSection";
import api from "@/lib/api";
import { getUser } from "@/lib/auth";
import { useBenchTalk } from "@/components/BenchTalkProvider";
import type { SeriesPlan } from "@/types/api";
import { SERIES_FORMATS, SECTION_LABELS } from "@/types/api";

// ── Report section parser (mirrors app/reports/[id]/page.tsx) ──
function parseReportSections(text: string): Array<{ key: string; content: string }> {
  const lines = text.split("\n");
  const sections: Array<{ key: string; content: string }> = [];
  let currentKey = "";
  let currentLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    const headerMatch = trimmed.match(
      /^(?:#{1,3}\s+)?([A-Z][A-Z0-9_]+(?:_[A-Z0-9]+)*)[\s:—\-]*$/
    );
    if (headerMatch && (headerMatch[1] in SECTION_LABELS || headerMatch[1].length >= 4)) {
      if (currentKey) {
        sections.push({ key: currentKey, content: currentLines.join("\n").trim() });
      }
      currentKey = headerMatch[1];
      currentLines = [];
    } else if (currentKey) {
      currentLines.push(line);
    } else if (trimmed) {
      currentLines.push(line);
    }
  }
  if (currentKey) {
    sections.push({ key: currentKey, content: currentLines.join("\n").trim() });
  }
  if (sections.length === 0 && text.trim()) {
    sections.push({ key: "REPORT", content: text.trim() });
  }
  return sections;
}

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

interface SeriesAdjustment {
  id: string;
  adjustment_text: string;
  triggered: number;
  triggered_after_game: number | null;
  notes: string | null;
  created_at: string;
}

interface GameSession {
  id: string;
  game_number: number;
  session_type: string;
  status: string;
  created_at: string;
  game_result?: string | null;
  game_score?: string | null;
}

interface StateSummary {
  id: string;
  after_game: number;
  summary_text: string;
  created_at: string;
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
  const currentUser = getUser();
  const { setActivePxiContext } = useBenchTalk();

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
  const [gameSessions, setGameSessions] = useState<GameSession[]>([]);
  const [creatingSession, setCreatingSession] = useState<number | null>(null);
  const [stateSummaries, setStateSummaries] = useState<StateSummary[]>([]);
  const [generatingState, setGeneratingState] = useState<number | null>(null);
  const [analysing, setAnalysing] = useState(false);
  const [analyseError, setAnalyseError] = useState("");
  const [dossierReport, setDossierReport] = useState<{ output_text?: string; title?: string; generated_at?: string } | null>(null);
  const [dossierLoading, setDossierLoading] = useState(false);
  const [dossierFetchKey, setDossierFetchKey] = useState(0);
  const [linkedGames, setLinkedGames] = useState<GameSession[]>([]);
  const [linkedGamesLoading, setLinkedGamesLoading] = useState(false);
  const [addingGamePlan, setAddingGamePlan] = useState(false);
  const [showTiModal, setShowTiModal] = useState(false);
  const [tiChecks, setTiChecks] = useState<{ team: boolean; opponent: boolean }>({ team: false, opponent: false });
  const [tiGenerating, setTiGenerating] = useState<string | null>(null);
  const [seriesScore, setSeriesScore] = useState<{ your_wins: number; opponent_wins: number; otl: number; games_played: number; summary: string } | null>(null);
  const [seededAdjustments, setSeededAdjustments] = useState<SeriesAdjustment[]>([]);
  const [seededAdjLoading, setSeededAdjLoading] = useState(false);
  const [seedingAdj, setSeedingAdj] = useState(false);
  const [benchCardContent, setBenchCardContent] = useState<string | null>(null);
  const [benchCardLoading, setBenchCardLoading] = useState(false);
  const [gamePracticePlans, setGamePracticePlans] = useState<Record<string, { id: string; title: string }>>({});

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

  useEffect(() => {
    if (series) {
      const u = getUser();
      setActivePxiContext({
        user: {
          id: u?.id || "",
          name: `${u?.first_name || ""} ${u?.last_name || ""}`.trim() || "User",
          role: (u?.hockey_role?.toUpperCase() || "SCOUT") as "COACH" | "PARENT" | "SCOUT" | "GM" | "AGENT" | "BROADCASTER" | "ANALYST",
          orgId: u?.org_id || "",
          orgName: "ProspectX",
        },
        page: { id: "SERIES_PLAN", route: `/series/${seriesId}` },
        entity: {
          type: "GAME",
          id: seriesId,
          name: `${series.team_name} vs ${series.opponent_team_name}`,
          metadata: {
            opponent: series.opponent_team_name,
            team: series.team_name,
          },
        },
      });
    }
    return () => { setActivePxiContext(null); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series, seriesId]);

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
        // Fetch linked game sessions
        try {
          const sessRes = await api.get<GameSession[]>(`/series/${seriesId}/game-sessions`);
          setGameSessions(sessRes.data);
        } catch {
          // Non-fatal — game sessions may not exist yet
        }
        // Fetch series state summaries
        try {
          const sumRes = await api.get<StateSummary[]>(`/series/${seriesId}/state-summaries`);
          setStateSummaries(sumRes.data);
        } catch {
          // Non-fatal — table may not exist yet
        }
      } catch {
        setError("Series not found");
      } finally {
        setLoading(false);
      }
    }
    if (seriesId) load();
  }, [seriesId]);

  // ── Fetch linked dossier report when Dossier tab activates ──
  useEffect(() => {
    if (activeTab !== "dossier" || !seriesId) return;
    let cancelled = false;
    async function fetchDossier() {
      setDossierLoading(true);
      try {
        const { data } = await api.get(`/chalk-talk/series/${seriesId}/report`);
        if (!cancelled) setDossierReport(data);
      } catch {
        // 404 = no report linked yet — not an error
        if (!cancelled) setDossierReport(null);
      } finally {
        if (!cancelled) setDossierLoading(false);
      }
    }
    fetchDossier();
    return () => { cancelled = true; };
  }, [activeTab, seriesId, dossierFetchKey]);

  // ── Fetch seeded adjustments when Adjustments tab activates ──
  useEffect(() => {
    if (activeTab !== "adjustments" || !seriesId) return;
    let cancelled = false;
    async function fetchAdjustments() {
      setSeededAdjLoading(true);
      try {
        const { data } = await api.get<SeriesAdjustment[]>(`/chalk-talk/series/${seriesId}/adjustments`);
        if (!cancelled) setSeededAdjustments(data);
      } catch {
        if (!cancelled) setSeededAdjustments([]);
      } finally {
        if (!cancelled) setSeededAdjLoading(false);
      }
    }
    fetchAdjustments();
    return () => { cancelled = true; };
  }, [activeTab, seriesId]);

  // ── Fetch linked game plans + series score when Games tab activates ──
  const fetchSeriesScore = useCallback(async () => {
    if (!seriesId) return;
    try {
      const { data } = await api.get<{ your_wins: number; opponent_wins: number; otl: number; games_played: number; summary: string }>(`/chalk-talk/series/${seriesId}/score`);
      setSeriesScore(data);
    } catch {
      /* non-fatal */
    }
  }, [seriesId]);

  useEffect(() => {
    if (activeTab !== "games" || !seriesId) return;
    let cancelled = false;
    async function fetchLinkedGames() {
      setLinkedGamesLoading(true);
      try {
        const { data } = await api.get<GameSession[]>(`/chalk-talk/series/${seriesId}/games`);
        if (!cancelled) setLinkedGames(data);
      } catch {
        if (!cancelled) setLinkedGames([]);
      } finally {
        if (!cancelled) setLinkedGamesLoading(false);
      }
    }
    fetchLinkedGames();
    fetchSeriesScore();
    return () => { cancelled = true; };
  }, [activeTab, seriesId, fetchSeriesScore]);

  // ── Fetch practice plans linked to game sessions ──
  useEffect(() => {
    if (linkedGames.length === 0) return;
    (async () => {
      const ppMap: Record<string, { id: string; title: string }> = {};
      for (const g of linkedGames) {
        try {
          const { data } = await api.get<{ plans: { id: string; title: string }[] }>(`/chalk-talk/sessions/${g.id}/practice-plans`);
          if (data.plans && data.plans.length > 0) {
            ppMap[g.id] = data.plans[0];
          }
        } catch { /* non-fatal */ }
      }
      if (Object.keys(ppMap).length > 0) setGamePracticePlans(ppMap);
    })();
  }, [linkedGames]);

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
      toast.error("Failed to delete series");
    }
  };

  const createGameSession = async (gameNumber: number) => {
    if (!series) return;
    setCreatingSession(gameNumber);
    try {
      const { data } = await api.post("/chalk-talk-sessions", {
        session_type: "pre_game",
        team_id: series.team_name,
        opponent_team_id: series.opponent_team_name,
        series_plan_id: seriesId,
        game_number: gameNumber,
      });
      router.push(`/chalk-talk/sessions/${data.id}`);
    } catch {
      toast.error("Failed to create game session");
    } finally {
      setCreatingSession(null);
    }
  };

  const handleAddGamePlan = async () => {
    if (!series || addingGamePlan) return;
    setAddingGamePlan(true);
    try {
      const gameNumber = linkedGames.length + 1;
      const { data } = await api.post("/chalk-talk-sessions", {
        session_type: "Pre-Game",
        team_id: series.team_name,
        opponent_team_id: series.opponent_team_name,
        series_plan_id: seriesId,
        game_number: gameNumber,
      });
      router.push(`/chalk-talk/sessions/${data.id}`);
    } catch {
      toast.error("Failed to create game plan");
    } finally {
      setAddingGamePlan(false);
    }
  };

  const handleUpdateResult = async (sessionId: string, game_result: string | null, game_score: string | null) => {
    try {
      const { data } = await api.patch<GameSession>(`/chalk-talk/sessions/${sessionId}/result`, { game_result, game_score });
      setLinkedGames(prev => prev.map(g => g.id === sessionId ? { ...g, game_result: data.game_result, game_score: data.game_score } : g));
      fetchSeriesScore();
    } catch {
      toast.error("Failed to update game result");
    }
  };

  const generateStateSummary = async (afterGame: number) => {
    setGeneratingState(afterGame);
    try {
      await api.post(`/series/${seriesId}/state-summary`, { after_game: afterGame });
      const { data } = await api.get<StateSummary[]>(`/series/${seriesId}/state-summaries`);
      setStateSummaries(data);
      toast.success(`Series state generated for Game ${afterGame}`);
    } catch {
      toast.error("Failed to generate series state");
    } finally {
      setGeneratingState(null);
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

  const handlePrintBenchCard = async () => {
    if (!series) return;
    setBenchCardLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("team_name", series.opponent_team_name);
      params.set("series_id", seriesId);
      const { data } = await api.get<{ found: boolean; content: string }>(`/reports/bench-card-extract?${params.toString()}`);
      if (data.found && data.content) {
        setBenchCardContent(data.content);
      } else {
        setBenchCardContent(null);
        toast.error("No bench card content found. Generate a Series Plan or Bench Card report first.");
      }
    } catch {
      toast.error("Failed to fetch bench card content.");
    } finally {
      setBenchCardLoading(false);
    }
  };

  const handleStatusChange = (newStatus: string) => {
    saveField({ status: newStatus });
  };

  const runPxiAnalyse = async () => {
    if (!series || analysing) return;
    setAnalysing(true);
    setAnalyseError("");
    try {
      // 1. Generate playoff_series report
      const genRes = await api.post<{ report_id: string; status: string; title?: string }>("/reports/generate", {
        report_type: "playoff_series",
        team_name: series.opponent_team_name,
        series_id: seriesId,
      });
      const reportId = genRes.data.report_id;

      // 2. Link report to this series
      await api.post(`/chalk-talk/series/${seriesId}/link-report`, { report_id: reportId });

      // 3. Auto-seed adjustments from the report
      try {
        await api.post(`/chalk-talk/series/${seriesId}/adjustments/seed`);
      } catch { /* non-fatal */ }

      // 4. Switch to Dossier tab and trigger refetch
      setActiveTab("dossier");
      setDossierFetchKey(k => k + 1);
      toast.success("Series intelligence generated");
    } catch (err: unknown) {
      const msg = (err && typeof err === "object" && "response" in err)
        ? ((err as { response?: { data?: { detail?: string } } }).response?.data?.detail || "PXI analysis failed. Please try again.")
        : "PXI analysis failed. Please try again.";
      setAnalyseError(typeof msg === "string" ? msg : "PXI analysis failed. Please try again.");
    } finally {
      setAnalysing(false);
    }
  };

  const handlePxiAnalyse = async () => {
    if (!series) return;
    // Check if Team Identity reports exist for both teams
    try {
      const [teamRes, oppRes] = await Promise.all([
        api.get<{ exists: boolean }>(`/reports/check-exists?team_name=${encodeURIComponent(series.team_name)}&report_type=team_identity`),
        api.get<{ exists: boolean }>(`/reports/check-exists?team_name=${encodeURIComponent(series.opponent_team_name)}&report_type=team_identity`),
      ]);
      const teamExists = teamRes.data.exists;
      const oppExists = oppRes.data.exists;
      if (teamExists && oppExists) {
        runPxiAnalyse();
      } else {
        setTiChecks({ team: teamExists, opponent: oppExists });
        setShowTiModal(true);
      }
    } catch {
      // If check fails, proceed anyway (soft gate)
      runPxiAnalyse();
    }
  };

  const handleGenerateMissingTi = async () => {
    if (!series) return;
    try {
      if (!tiChecks.team) {
        setTiGenerating(series.team_name);
        await api.post("/reports/generate", { report_type: "team_identity", team_name: series.team_name });
        setTiChecks(prev => ({ ...prev, team: true }));
      }
      if (!tiChecks.opponent) {
        setTiGenerating(series.opponent_team_name);
        await api.post("/reports/generate", { report_type: "team_identity", team_name: series.opponent_team_name });
        setTiChecks(prev => ({ ...prev, opponent: true }));
      }
      setTiGenerating(null);
      setShowTiModal(false);
      toast.success("Team Identity reports generated");
      runPxiAnalyse();
    } catch {
      setTiGenerating(null);
      toast.error("Failed to generate Team Identity report");
    }
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

  const handleSeedAdjustments = async () => {
    if (!seriesId) return;
    setSeedingAdj(true);
    try {
      const { data } = await api.post<{ seeded: boolean; adjustments: SeriesAdjustment[] }>(`/chalk-talk/series/${seriesId}/adjustments/seed`);
      setSeededAdjustments(data.adjustments);
      if (data.seeded) toast.success(`${data.adjustments.length} adjustments seeded from report`);
    } catch {
      toast.error("Failed to seed adjustments");
    } finally {
      setSeedingAdj(false);
    }
  };

  const handleToggleAdjustment = async (adj: SeriesAdjustment, triggered: boolean, gameNum?: number | null) => {
    try {
      const { data } = await api.patch<SeriesAdjustment>(`/chalk-talk/series/${seriesId}/adjustments/${adj.id}`, {
        triggered,
        triggered_after_game: triggered ? (gameNum ?? adj.triggered_after_game ?? 1) : null,
      });
      setSeededAdjustments(prev => prev.map(a => a.id === adj.id ? data : a));
    } catch {
      toast.error("Failed to update adjustment");
    }
  };

  const handleAdjustmentNotes = async (adj: SeriesAdjustment, notes: string) => {
    try {
      const { data } = await api.patch<SeriesAdjustment>(`/chalk-talk/series/${seriesId}/adjustments/${adj.id}`, { notes });
      setSeededAdjustments(prev => prev.map(a => a.id === adj.id ? data : a));
    } catch {
      toast.error("Failed to save notes");
    }
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
            onClick={handlePxiAnalyse}
            disabled={analysing}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold uppercase transition-colors hover:opacity-90 no-print disabled:opacity-50"
            style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 1, background: analysing ? "rgba(13,148,136,0.08)" : "rgba(13,148,136,0.1)", color: "#0D9488", border: "1.5px solid rgba(13,148,136,0.2)" }}
            title="Generate PXI series intelligence report"
          >
            {analysing ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            {analysing ? "Analysing…" : "PXI Analyse Series"}
          </button>
          <button
            onClick={handleDownloadPDF}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-teal/10 text-teal border border-teal/20 rounded-lg text-xs font-semibold hover:bg-teal/20 transition-colors no-print"
            title="Download as PDF"
          >
            <Download size={14} />
            PDF
          </button>
          <button
            onClick={handlePrintBenchCard}
            disabled={benchCardLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors no-print"
            style={{ backgroundColor: "rgba(13,148,136,0.08)", color: "#0D9488", border: "1.5px solid rgba(13,148,136,0.2)" }}
            title="Print Bench Card"
          >
            {benchCardLoading ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />}
            Bench Card
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

      {/* ── PXI Analyse status banners ────────────────────── */}
      {analysing && (
        <div className="flex items-center gap-2 rounded-xl px-4 py-3 mb-4 text-xs font-oswald uppercase tracking-wider" style={{ background: "rgba(13,148,136,0.06)", border: "1.5px solid rgba(13,148,136,0.2)", color: "#0D9488" }}>
          <Loader2 size={14} className="animate-spin" />
          Generating Series Intelligence…
        </div>
      )}
      {analyseError && (
        <div className="flex items-center gap-2 rounded-xl px-4 py-3 mb-4 text-xs font-bold" style={{ background: "rgba(249,158,11,0.06)", border: "1.5px solid #F59E0B", color: "#F59E0B" }}>
          <AlertCircle size={14} />
          <span>{analyseError}</span>
          <button onClick={() => setAnalyseError("")} className="ml-auto opacity-60 hover:opacity-100">
            <X size={12} />
          </button>
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
          {/* PXI Series Intelligence Report */}
          {dossierLoading ? (
            <div className="bg-white rounded-xl border border-teal/20 p-8 flex flex-col items-center justify-center gap-3">
              <Loader2 size={24} className="animate-spin text-teal" />
              <p className="text-xs font-oswald uppercase tracking-wider text-navy/50">Loading series intelligence…</p>
            </div>
          ) : dossierReport?.output_text ? (
            <div className="bg-white rounded-xl border border-teal/20 p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #0D9488, #0F2942)" }}>
                  <Sparkles size={14} className="text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-oswald font-bold uppercase tracking-wider" style={{ color: "#0F2942" }}>
                    Series Intelligence
                  </h3>
                  {dossierReport.generated_at && (
                    <span className="text-[10px] font-oswald uppercase tracking-widest" style={{ color: "rgba(13,148,136,0.6)" }}>
                      Generated {new Date(dossierReport.generated_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
              <div className="ice-stripe mb-4 rounded-full" />
              {parseReportSections(dossierReport.output_text).map((s) => (
                <ReportSection key={s.key} sectionKey={s.key} content={s.content} />
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-teal/20 p-8 flex flex-col items-center justify-center gap-2 text-center">
              <Sparkles size={20} style={{ color: "#0D9488" }} />
              <p className="text-sm font-oswald uppercase tracking-wider" style={{ color: "#0F2942" }}>
                No series intelligence generated yet
              </p>
              <p className="text-xs" style={{ color: "rgba(15,41,66,0.5)" }}>
                Click <strong>PXI Analyse Series</strong> above to generate an AI-powered series dossier.
              </p>
            </div>
          )}

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

          {/* Series State Summaries */}
          {stateSummaries.length > 0 && (
            <div className="bg-white rounded-xl border border-teal/20 p-5">
              <h3 className="text-sm font-oswald uppercase tracking-wider text-navy flex items-center gap-2 mb-4">
                <Zap size={14} className="text-teal" />
                Series State Summaries
              </h3>
              <div className="space-y-3">
                {stateSummaries.map((ss) => (
                  <div key={ss.id} className="border border-teal/20 rounded-lg p-3 bg-gray-50/50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-oswald uppercase tracking-wider text-navy">
                        After Game {ss.after_game}
                      </span>
                      <span className="text-[9px] text-muted">
                        {new Date(ss.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-xs text-navy/80 whitespace-pre-wrap">{ss.summary_text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Games Tab ───────────────────────────────────────── */}
      {printMode && <h2 className="print-only font-oswald text-lg text-navy uppercase tracking-wider mt-6 mb-3 print-break-before">Game Notes</h2>}
      {(activeTab === "games" || printMode) && (
        <div className="space-y-4">
          {/* Series Score Header */}
          {seriesScore && seriesScore.games_played > 0 && (
            <div className="bg-white rounded-xl border p-4 text-center" style={{ borderColor: "rgba(13,148,136,0.2)" }}>
              <p className="text-lg font-oswald font-bold uppercase tracking-wider" style={{ color: "#0F2942" }}>
                {seriesScore.summary}
              </p>
              <p className="text-xs mt-1" style={{ color: "rgba(15,41,66,0.5)" }}>
                {seriesScore.games_played} game{seriesScore.games_played !== 1 ? "s" : ""} played
              </p>
            </div>
          )}

          {/* Linked Game Plans (War Room Sessions) */}
          <div className="bg-white rounded-xl border p-5" style={{ borderColor: "rgba(13,148,136,0.2)" }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-oswald uppercase tracking-wider flex items-center gap-2" style={{ color: "#0F2942" }}>
                <Crosshair size={14} style={{ color: "#0D9488" }} />
                Game Plans
              </h3>
              <button
                onClick={handleAddGamePlan}
                disabled={addingGamePlan}
                className="no-print flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                style={{ backgroundColor: "#0D9488", color: "#FFFFFF", opacity: addingGamePlan ? 0.6 : 1 }}
              >
                {addingGamePlan ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                {addingGamePlan ? "Creating…" : "Add Game Plan"}
              </button>
            </div>

            {linkedGamesLoading ? (
              <div className="flex items-center justify-center py-6 gap-2">
                <Loader2 size={16} className="animate-spin" style={{ color: "#0D9488" }} />
                <span className="text-xs font-oswald uppercase tracking-wider" style={{ color: "rgba(15,41,66,0.4)" }}>Loading game plans…</span>
              </div>
            ) : linkedGames.length === 0 ? (
              <div className="text-center py-6">
                <Crosshair size={20} style={{ color: "rgba(13,148,136,0.3)", margin: "0 auto 8px" }} />
                <p className="text-sm font-oswald uppercase tracking-wider" style={{ color: "#0F2942" }}>
                  No game plans created yet
                </p>
                <p className="text-xs mt-1" style={{ color: "rgba(15,41,66,0.5)" }}>
                  Click <strong>Add Game Plan</strong> to prepare for Game 1.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {linkedGames.map((g) => (
                  <div
                    key={g.id}
                    className="rounded-lg border overflow-hidden"
                    style={{ borderColor: g.game_result === "win" ? "rgba(22,163,74,0.3)" : g.game_result === "loss" ? "rgba(220,38,38,0.3)" : g.game_result === "otl" ? "rgba(245,158,11,0.3)" : "rgba(13,148,136,0.15)" }}
                  >
                    <Link
                      href={`/chalk-talk/sessions/${g.id}`}
                      className="flex items-center justify-between px-4 py-3 transition-colors hover:shadow-sm"
                      style={{ backgroundColor: "rgba(13,148,136,0.03)" }}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-oswald font-bold uppercase tracking-wider" style={{ color: "#0F2942" }}>
                          Game {g.game_number}
                        </span>
                        {series?.opponent_team_name && (
                          <span className="text-xs" style={{ color: "rgba(15,41,66,0.6)" }}>
                            vs {series.opponent_team_name}
                          </span>
                        )}
                        {g.game_result && (
                          <span
                            className="text-[10px] px-2 py-0.5 rounded font-oswald uppercase tracking-wider font-bold"
                            style={{
                              backgroundColor: g.game_result === "win" ? "rgba(22,163,74,0.1)" : g.game_result === "loss" ? "rgba(220,38,38,0.1)" : "rgba(245,158,11,0.1)",
                              color: g.game_result === "win" ? "#16A34A" : g.game_result === "loss" ? "#DC2626" : "#F59E0B",
                            }}
                          >
                            {g.game_result.toUpperCase()}{g.game_score ? ` ${g.game_score}` : ""}
                          </span>
                        )}
                        {g.created_at && (
                          <span className="text-[10px]" style={{ color: "rgba(15,41,66,0.35)" }}>
                            — {new Date(g.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {gamePracticePlans[g.id] && (
                          <Link
                            href={`/practice-plans/${gamePracticePlans[g.id].id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded font-oswald uppercase tracking-wider font-bold no-print"
                            style={{ backgroundColor: "rgba(13,148,136,0.1)", color: "#0D9488" }}
                          >
                            <ClipboardList size={10} />
                            Practice
                          </Link>
                        )}
                        <span
                          className="text-[10px] px-2 py-0.5 rounded font-oswald uppercase tracking-wider"
                          style={{
                            backgroundColor: g.status === "completed" ? "rgba(34,197,94,0.1)" : g.status === "generated" ? "rgba(13,148,136,0.1)" : "rgba(15,41,66,0.06)",
                            color: g.status === "completed" ? "#16a34a" : g.status === "generated" ? "#0D9488" : "rgba(15,41,66,0.5)",
                          }}
                        >
                          {g.status || "Draft"}
                        </span>
                        <ChevronRight size={14} style={{ color: "rgba(15,41,66,0.3)" }} />
                      </div>
                    </Link>
                    {/* Result selector row */}
                    <div className="flex items-center gap-2 px-4 py-2 no-print" style={{ backgroundColor: "rgba(15,41,66,0.02)", borderTop: "1px solid rgba(15,41,66,0.06)" }}>
                      <span className="text-[10px] font-oswald uppercase tracking-wider mr-1" style={{ color: "rgba(15,41,66,0.4)" }}>Result:</span>
                      {(["win", "loss", "otl"] as const).map((r) => (
                        <button
                          key={r}
                          onClick={() => handleUpdateResult(g.id, g.game_result === r ? null : r, g.game_score || null)}
                          className="text-[10px] px-2.5 py-1 rounded font-oswald uppercase tracking-wider font-bold transition-colors"
                          style={{
                            backgroundColor: g.game_result === r
                              ? (r === "win" ? "#16A34A" : r === "loss" ? "#DC2626" : "#F59E0B")
                              : "rgba(15,41,66,0.06)",
                            color: g.game_result === r ? "#FFFFFF" : "rgba(15,41,66,0.5)",
                          }}
                        >
                          {r.toUpperCase()}
                        </button>
                      ))}
                      <input
                        type="text"
                        placeholder="4-2"
                        value={g.game_score || ""}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          const val = e.target.value;
                          setLinkedGames(prev => prev.map(gm => gm.id === g.id ? { ...gm, game_score: val } : gm));
                        }}
                        onBlur={(e) => handleUpdateResult(g.id, g.game_result || null, e.target.value || null)}
                        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                        className="text-xs px-2 py-1 rounded border w-16 text-center"
                        style={{ borderColor: "rgba(15,41,66,0.15)", color: "#0F2942" }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

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
                  const linkedSession = gameSessions.find((s) => s.game_number === gn.game_number);
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
                        <div className="flex items-center gap-2">
                          {linkedSession ? (
                            <Link
                              href={`/chalk-talk/sessions/${linkedSession.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="no-print text-[10px] px-2 py-1 rounded font-medium"
                              style={{ backgroundColor: "rgba(13,148,136,0.1)", color: "#0D9488" }}
                            >
                              Open War Room
                            </Link>
                          ) : (
                            <button
                              onClick={(e) => { e.stopPropagation(); createGameSession(gn.game_number); }}
                              disabled={creatingSession === gn.game_number}
                              className="no-print text-[10px] px-2 py-1 rounded font-medium"
                              style={{ backgroundColor: "rgba(230,126,34,0.1)", color: "#E67E22" }}
                            >
                              {creatingSession === gn.game_number ? "Creating..." : "Create Game Plan"}
                            </button>
                          )}
                          {expandedGame === i ? (
                            <ChevronDown size={14} className="text-muted" />
                          ) : (
                            <ChevronRight size={14} className="text-muted" />
                          )}
                        </div>
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
                          {/* Generate Series State */}
                          <button
                            onClick={() => generateStateSummary(gn.game_number)}
                            disabled={generatingState === gn.game_number}
                            className="no-print text-[10px] px-3 py-1.5 rounded font-medium"
                            style={{ backgroundColor: "rgba(13,148,136,0.1)", color: "#0D9488" }}
                          >
                            {generatingState === gn.game_number ? "Generating State..." : "Generate Series State"}
                          </button>
                          {stateSummaries.find(s => s.after_game === gn.game_number) && (
                            <div className="p-2 rounded border" style={{ backgroundColor: "rgba(13,148,136,0.05)", borderColor: "rgba(13,148,136,0.15)" }}>
                              <p className="text-[10px] font-oswald uppercase tracking-wider mb-1" style={{ color: "#0D9488" }}>Series State Summary</p>
                              <p className="text-xs text-navy/80 whitespace-pre-wrap">
                                {stateSummaries.find(s => s.after_game === gn.game_number)?.summary_text}
                              </p>
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
          {/* Seeded Adjustments from PXI Report */}
          <div className="bg-white rounded-xl border p-5" style={{ borderColor: "rgba(13,148,136,0.2)" }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-oswald uppercase tracking-wider flex items-center gap-2" style={{ color: "#0F2942" }}>
                <Zap size={14} style={{ color: "#0D9488" }} />
                PXI Adjustment Framework
              </h3>
              {seededAdjustments.length === 0 && !seededAdjLoading && (
                <button
                  onClick={handleSeedAdjustments}
                  disabled={seedingAdj}
                  className="no-print flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                  style={{ backgroundColor: "#0D9488", color: "#FFFFFF", opacity: seedingAdj ? 0.6 : 1 }}
                >
                  {seedingAdj ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                  {seedingAdj ? "Seeding…" : "Seed Adjustments"}
                </button>
              )}
            </div>

            {seededAdjLoading ? (
              <div className="flex items-center justify-center py-6 gap-2">
                <Loader2 size={16} className="animate-spin" style={{ color: "#0D9488" }} />
                <span className="text-xs font-oswald uppercase tracking-wider" style={{ color: "rgba(15,41,66,0.4)" }}>Loading adjustments…</span>
              </div>
            ) : seededAdjustments.length === 0 ? (
              <div className="text-center py-6">
                <Zap size={20} style={{ color: "rgba(13,148,136,0.3)", margin: "0 auto 8px" }} />
                <p className="text-sm font-oswald uppercase tracking-wider" style={{ color: "#0F2942" }}>
                  No adjustments seeded yet
                </p>
                <p className="text-xs mt-1" style={{ color: "rgba(15,41,66,0.5)" }}>
                  Generate a Series Plan first to populate the adjustment framework, or click <strong>Seed Adjustments</strong> if a report already exists.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {seededAdjustments.map((adj) => (
                  <div
                    key={adj.id}
                    className="rounded-lg border p-3 transition-colors"
                    style={{
                      backgroundColor: adj.triggered ? "rgba(13,148,136,0.05)" : "#FFFFFF",
                      borderColor: adj.triggered ? "rgba(13,148,136,0.3)" : "rgba(15,41,66,0.1)",
                      borderLeftWidth: adj.triggered ? "3px" : "1px",
                      borderLeftColor: adj.triggered ? "#0D9488" : undefined,
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => handleToggleAdjustment(adj, !adj.triggered)}
                        className="mt-0.5 shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-colors"
                        style={{
                          backgroundColor: adj.triggered ? "#0D9488" : "#FFFFFF",
                          borderColor: adj.triggered ? "#0D9488" : "rgba(15,41,66,0.2)",
                        }}
                      >
                        {adj.triggered ? <CheckCircle size={14} style={{ color: "#FFFFFF" }} /> : null}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs" style={{ color: "#0F2942", textDecoration: adj.triggered ? "none" : "none" }}>
                          {adj.adjustment_text}
                        </p>
                        {adj.triggered && (
                          <div className="flex items-center gap-3 mt-2">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-oswald uppercase tracking-wider" style={{ color: "rgba(15,41,66,0.4)" }}>After Game:</span>
                              <select
                                value={adj.triggered_after_game ?? ""}
                                onChange={(e) => handleToggleAdjustment(adj, true, e.target.value ? Number(e.target.value) : null)}
                                className="border rounded px-1.5 py-0.5 text-[10px]"
                                style={{ borderColor: "rgba(13,148,136,0.2)", color: "#0F2942" }}
                              >
                                <option value="">Select</option>
                                {linkedGames.map((g) => (
                                  <option key={g.id} value={g.game_number}>Game {g.game_number}</option>
                                ))}
                                {linkedGames.length === 0 && [1, 2, 3, 4, 5, 6, 7].map(n => (
                                  <option key={n} value={n}>Game {n}</option>
                                ))}
                              </select>
                            </div>
                            {adj.triggered_after_game && (
                              <span
                                className="text-[10px] px-2 py-0.5 rounded font-oswald uppercase tracking-wider"
                                style={{ backgroundColor: "rgba(13,148,136,0.1)", color: "#0D9488" }}
                              >
                                Triggered G{adj.triggered_after_game}
                              </span>
                            )}
                          </div>
                        )}
                        {adj.triggered && (
                          <input
                            type="text"
                            placeholder="Notes on this adjustment…"
                            value={adj.notes || ""}
                            onChange={(e) => setSeededAdjustments(prev => prev.map(a => a.id === adj.id ? { ...a, notes: e.target.value } : a))}
                            onBlur={(e) => handleAdjustmentNotes(adj, e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                            className="mt-2 w-full border rounded px-2 py-1 text-[11px]"
                            style={{ borderColor: "rgba(13,148,136,0.15)", color: "#0F2942" }}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Manual If/Then Adjustments (existing) */}
          <div className="bg-white rounded-xl border p-5" style={{ borderColor: "rgba(13,148,136,0.2)" }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-oswald uppercase tracking-wider flex items-center gap-2" style={{ color: "#0F2942" }}>
                <Crosshair size={14} style={{ color: "#E67E22" }} />
                Manual If / Then Adjustments
              </h3>
              <button
                onClick={addAdjustment}
                className="no-print flex items-center gap-1 text-xs font-medium transition-colors"
                style={{ color: "#0D9488" }}
              >
                <Plus size={12} /> Add Adjustment
              </button>
            </div>

            {adjustments.length === 0 ? (
              <p className="text-xs" style={{ color: "rgba(15,41,66,0.5)" }}>
                No manual adjustments defined yet. Plan your if/then scenarios.
              </p>
            ) : (
              <div className="space-y-3">
                {adjustments.map((adj, i) => (
                  <div key={i} className="border rounded-lg p-3" style={{ borderColor: "rgba(13,148,136,0.15)", backgroundColor: "rgba(15,41,66,0.015)" }}>
                    <div className="flex items-start gap-2 mb-2">
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded font-oswald uppercase tracking-wider shrink-0 mt-0.5"
                        style={{
                          backgroundColor: adj.priority === "high" ? "rgba(220,38,38,0.1)" : adj.priority === "medium" ? "rgba(230,126,34,0.1)" : "rgba(15,41,66,0.06)",
                          color: adj.priority === "high" ? "#DC2626" : adj.priority === "medium" ? "#E67E22" : "rgba(15,41,66,0.5)",
                        }}
                      >
                        {adj.priority}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
                          <div>
                            <label className="block text-[10px] uppercase tracking-wider mb-0.5" style={{ color: "rgba(15,41,66,0.4)" }}>If...</label>
                            <input
                              type="text"
                              value={adj.trigger}
                              onChange={(e) => updateAdjustment(i, "trigger", e.target.value)}
                              onBlur={saveAdjustments}
                              placeholder="They start trapping in the neutral zone..."
                              className="w-full border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1"
                              style={{ borderColor: "rgba(13,148,136,0.2)", color: "#0F2942" }}
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] uppercase tracking-wider mb-0.5" style={{ color: "rgba(15,41,66,0.4)" }}>Then...</label>
                            <input
                              type="text"
                              value={adj.action}
                              onChange={(e) => updateAdjustment(i, "action", e.target.value)}
                              onBlur={saveAdjustments}
                              placeholder="Use stretch passes, chip and chase..."
                              className="w-full border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1"
                              style={{ borderColor: "rgba(13,148,136,0.2)", color: "#0F2942" }}
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5">
                            <label className="text-[10px] uppercase tracking-wider" style={{ color: "rgba(15,41,66,0.4)" }}>Priority:</label>
                            <select
                              value={adj.priority}
                              onChange={(e) => { updateAdjustment(i, "priority", e.target.value); }}
                              onBlur={saveAdjustments}
                              className="border rounded px-1.5 py-0.5 text-[10px] focus:outline-none"
                              style={{ borderColor: "rgba(13,148,136,0.2)", color: "#0F2942" }}
                            >
                              <option value="high">High</option>
                              <option value="medium">Medium</option>
                              <option value="low">Low</option>
                            </select>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <label className="text-[10px] uppercase tracking-wider" style={{ color: "rgba(15,41,66,0.4)" }}>Used in:</label>
                            <input
                              type="text"
                              value={adj.used_in_game}
                              onChange={(e) => updateAdjustment(i, "used_in_game", e.target.value)}
                              onBlur={saveAdjustments}
                              placeholder="e.g. Game 3"
                              className="w-20 border rounded px-1.5 py-0.5 text-[10px] focus:outline-none"
                              style={{ borderColor: "rgba(13,148,136,0.2)", color: "#0F2942" }}
                            />
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => removeAdjustment(i)}
                        className="no-print shrink-0 transition-colors"
                        title="Remove adjustment"
                        style={{ color: "rgba(15,41,66,0.3)" }}
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

      {/* ── Bench Card Modal ────────────────────────────────── */}
      {benchCardContent && series && (
        <BenchCardView
          content={benchCardContent}
          teamName={series.team_name}
          opponentName={series.opponent_team_name}
          onClose={() => setBenchCardContent(null)}
        />
      )}

      {/* ── TI Validation Modal ──────────────────────────────── */}
      {showTiModal && series && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(15,41,66,0.5)" }}>
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4" style={{ border: "1px solid rgba(13,148,136,0.2)" }}>
            <h3 className="text-base font-oswald font-bold uppercase tracking-wider mb-4" style={{ color: "#0F2942" }}>
              Team Identity Reports Recommended
            </h3>
            <div className="space-y-3 mb-4">
              <div className="flex items-center gap-2.5">
                {tiChecks.team ? (
                  <CheckCircle size={16} style={{ color: "#0D9488" }} />
                ) : (
                  <X size={16} style={{ color: "#ef4444" }} />
                )}
                <span className="text-sm" style={{ color: "#0F2942" }}>
                  <strong>{series.team_name}</strong> — Internal Team Identity
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                {tiChecks.opponent ? (
                  <CheckCircle size={16} style={{ color: "#0D9488" }} />
                ) : (
                  <X size={16} style={{ color: "#ef4444" }} />
                )}
                <span className="text-sm" style={{ color: "#0F2942" }}>
                  <strong>{series.opponent_team_name}</strong> — External Team Identity
                </span>
              </div>
            </div>
            <p className="text-xs mb-5" style={{ color: "rgba(15,41,66,0.6)" }}>
              For best results, generate Team Identity reports before creating a Series Plan.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleGenerateMissingTi}
                disabled={!!tiGenerating}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold uppercase tracking-wider transition-colors"
                style={{ backgroundColor: "#0D9488", color: "#FFFFFF", opacity: tiGenerating ? 0.7 : 1 }}
              >
                {tiGenerating ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span className="text-xs normal-case" style={{ letterSpacing: 0 }}>Generating {tiGenerating}…</span>
                  </>
                ) : (
                  "Generate Missing"
                )}
              </button>
              <button
                onClick={() => { setShowTiModal(false); runPxiAnalyse(); }}
                disabled={!!tiGenerating}
                className="px-4 py-2 rounded-lg text-sm font-bold uppercase tracking-wider transition-colors"
                style={{ color: "rgba(15,41,66,0.6)", border: "1.5px solid rgba(15,41,66,0.15)" }}
              >
                Skip
              </button>
            </div>
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
