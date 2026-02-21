"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import toast from "react-hot-toast";
import Link from "next/link";
import {
  ArrowLeft,
  FileText,
  Upload,
  Zap,
  CheckCircle,
  PenLine,
  Send,
  Lock,
  Unlock,
  Trash2,
  Edit3,
  X,
  Shield,
  Swords,
  Target,
  TrendingUp,
  Activity,
  User,
  Camera,
  Save,
  Brain,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Star,
  AlertTriangle,
  Wand2,
  Flame,
  Download,
  ClipboardCheck,
  ExternalLink,
  Loader2,
  Plus,
  History,
  Sparkles,
} from "lucide-react";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  ResponsiveContainer,
} from "recharts";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import StatTable from "@/components/StatTable";
import ExtendedStatTable from "@/components/ExtendedStatTable";
import GoalieStatTable from "@/components/GoalieStatTable";
import ReportCard from "@/components/ReportCard";
import api, { assetUrl, hasRealImage } from "@/lib/api";
import { formatLeague } from "@/lib/leagues";
import ProgressionChart from "@/components/ProgressionChart";
import GameLogTable from "@/components/GameLogTable";
import PlayerStatusBadges from "@/components/PlayerStatusBadges";
import type { Player, PlayerStats, GoalieStats, Report, ScoutNote, TeamSystem, SystemLibraryEntry, PlayerIntelligence, PlayerMetrics, League, TeamReference, Progression, GameStatsResponse, RecentForm, PlayerCorrection, DevelopmentPlan, DevelopmentPlanSection } from "@/types/api";
import { NOTE_TYPE_LABELS, NOTE_TAG_OPTIONS, NOTE_TAG_LABELS, PROSPECT_GRADES, STAT_SIGNATURE_LABELS, GRADE_COLORS, METRIC_COLORS, METRIC_ICONS, COMMITMENT_STATUS_OPTIONS, COMMITMENT_STATUS_COLORS, CORRECTABLE_FIELDS, CORRECTABLE_FIELD_LABELS, PROSPECT_STATUS_LABELS } from "@/types/api";

type Tab = "profile" | "stats" | "notes" | "reports" | "development";
type StatsSubView = "current" | "progression" | "gamelog";

const POSITION_LABELS: Record<string, string> = {
  C: "Center",
  LW: "Left Wing",
  RW: "Right Wing",
  D: "Defense",
  G: "Goalie",
  F: "Forward",
  LD: "Left Defense",
  RD: "Right Defense",
};

function fullPosition(pos: string | null | undefined): string {
  if (!pos) return "Unknown";
  return POSITION_LABELS[pos.toUpperCase()] || pos;
}

export default function PlayerDetailPage() {
  const params = useParams();
  const playerId = params.id as string;

  const [player, setPlayer] = useState<Player | null>(null);
  const [stats, setStats] = useState<PlayerStats[]>([]);
  const [goalieStats, setGoalieStats] = useState<GoalieStats[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [notes, setNotes] = useState<ScoutNote[]>([]);
  const [teamSystem, setTeamSystem] = useState<TeamSystem | null>(null);
  const [systemsLibrary, setSystemsLibrary] = useState<SystemLibraryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("profile");

  // Stats sub-views
  const [statsSubView, setStatsSubView] = useState<StatsSubView>("current");
  const [progression, setProgression] = useState<Progression | null>(null);
  const [gameLog, setGameLog] = useState<GameStatsResponse | null>(null);
  const [gameLogOffset, setGameLogOffset] = useState(0);
  const [recentForm, setRecentForm] = useState<RecentForm | null>(null);
  const [loadingProgression, setLoadingProgression] = useState(false);
  const [loadingGameLog, setLoadingGameLog] = useState(false);

  // Player Intelligence
  const [intelligence, setIntelligence] = useState<PlayerIntelligence | null>(null);
  const [intelHistory, setIntelHistory] = useState<PlayerIntelligence[]>([]);
  const [showIntelHistory, setShowIntelHistory] = useState(false);
  const [refreshingIntel, setRefreshingIntel] = useState(false);

  // ProspectX Metrics
  const [playerMetrics, setPlayerMetrics] = useState<PlayerMetrics | null>(null);

  // Archetype editing
  const [editingArchetype, setEditingArchetype] = useState(false);
  const [archetypeValue, setArchetypeValue] = useState("");

  // Inline bio editing
  const [editingBio, setEditingBio] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState("");
  const [editFields, setEditFields] = useState({
    current_team: "",
    current_league: "",
    position: "",
    shoots: "",
    dob: "",
    height_cm: "" as string | number,
    weight_kg: "" as string | number,
  });
  // Reference data for league/team dropdowns
  const [editLeagues, setEditLeagues] = useState<League[]>([]);
  const [editRefTeams, setEditRefTeams] = useState<TeamReference[]>([]);
  const [customLeague, setCustomLeague] = useState(false);
  const [customTeam, setCustomTeam] = useState(false);

  // CSV upload
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");

  // Image upload
  const [uploadingImage, setUploadingImage] = useState(false);

  // Correction form
  const [showCorrectionForm, setShowCorrectionForm] = useState(false);
  const [correctionField, setCorrectionField] = useState("");
  const [correctionValue, setCorrectionValue] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");
  const [correctionConfidence, setCorrectionConfidence] = useState<"low" | "medium" | "high">("medium");
  const [submittingCorrection, setSubmittingCorrection] = useState(false);
  const [correctionMsg, setCorrectionMsg] = useState("");
  const [pendingCorrections, setPendingCorrections] = useState(0);

  // Note form
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [noteType, setNoteType] = useState("general");
  const [noteTags, setNoteTags] = useState<string[]>([]);
  const [notePrivate, setNotePrivate] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);

  // Development Plans
  const [devPlan, setDevPlan] = useState<DevelopmentPlan | null>(null);
  const [devPlanVersions, setDevPlanVersions] = useState<DevelopmentPlan[]>([]);
  const [loadingDevPlan, setLoadingDevPlan] = useState(false);
  const [generatingDevPlan, setGeneratingDevPlan] = useState(false);
  const [editingDevSection, setEditingDevSection] = useState<number | null>(null);
  const [editDevContent, setEditDevContent] = useState("");
  const [editDevTitle, setEditDevTitle] = useState("");
  const [savingDevPlan, setSavingDevPlan] = useState(false);
  const [showDevVersions, setShowDevVersions] = useState(false);

  const loadNotes = useCallback(async () => {
    try {
      const { data } = await api.get<ScoutNote[]>(`/players/${playerId}/notes`);
      setNotes(data);
    } catch {
      // non-critical
    }
  }, [playerId]);

  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadMsg("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const { data } = await api.post(`/stats/ingest?player_id=${playerId}`, formData);
      setUploadMsg(`✓ Imported ${data.inserted} stat rows`);
      const statsRes = await api.get<PlayerStats[]>(`/stats/player/${playerId}`);
      setStats(statsRes.data);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number; data?: { detail?: string } }; message?: string };
      const msg = axiosErr?.response?.data?.detail || axiosErr?.message || "Failed to upload CSV";
      setUploadMsg(`Error: ${msg}`);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const { data } = await api.post<{ image_url: string }>(`/players/${playerId}/image`, formData);
      setPlayer((prev) => prev ? { ...prev, image_url: data.image_url } : prev);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed to upload image";
      toast.error(msg);
    } finally {
      setUploadingImage(false);
      e.target.value = "";
    }
  };

  const handleDownloadPDF = () => {
    const prev = document.title;
    const fileName = `${player?.first_name}_${player?.last_name}_profile`.replace(/\s+/g, "_");
    document.title = fileName;
    window.print();
    setTimeout(() => { document.title = prev; }, 1000);
  };

  const handleImageDelete = async () => {
    if (!confirm("Remove player photo?")) return;
    try {
      await api.delete(`/players/${playerId}/image`);
      setPlayer((prev) => prev ? { ...prev, image_url: null } : prev);
    } catch {
      toast.error("Failed to delete image");
    }
  };

  const handleSaveNote = async () => {
    if (!noteText.trim()) return;
    setSavingNote(true);
    try {
      if (editingNoteId) {
        await api.put(`/notes/${editingNoteId}`, {
          note_text: noteText,
          note_type: noteType,
          tags: noteTags,
          is_private: notePrivate,
        });
      } else {
        await api.post(`/players/${playerId}/notes`, {
          note_text: noteText,
          note_type: noteType,
          tags: noteTags,
          is_private: notePrivate,
        });
      }
      setNoteText("");
      setNoteType("general");
      setNoteTags([]);
      setNotePrivate(false);
      setShowNoteForm(false);
      setEditingNoteId(null);
      await loadNotes();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed to save note";
      toast.error(msg);
    } finally {
      setSavingNote(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm("Delete this note?")) return;
    try {
      await api.delete(`/notes/${noteId}`);
      await loadNotes();
    } catch {
      // ignore
    }
  };

  const handleEditNote = (note: ScoutNote) => {
    setEditingNoteId(note.id);
    setNoteText(note.note_text);
    setNoteType(note.note_type);
    setNoteTags(note.tags);
    setNotePrivate(note.is_private);
    setShowNoteForm(true);
  };

  const toggleTag = (tag: string) => {
    setNoteTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);
  };

  const handleRefreshIntelligence = async () => {
    setRefreshingIntel(true);
    try {
      const { data } = await api.post<PlayerIntelligence>(`/players/${playerId}/intelligence`);
      setIntelligence(data);
      // Update player with new archetype/tags
      if (data.archetype) {
        setPlayer((prev) => prev ? { ...prev, archetype: data.archetype || prev.archetype, tags: data.tags || prev.tags } : prev);
        setArchetypeValue(data.archetype);
      }
      // Refresh history
      try {
        const histRes = await api.get<PlayerIntelligence[]>(`/players/${playerId}/intelligence/history`);
        setIntelHistory(histRes.data);
      } catch { /* ok */ }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed to refresh intelligence";
      toast.error(msg);
    } finally {
      setRefreshingIntel(false);
    }
  };

  // Load reference data for league/team dropdowns when edit opens
  useEffect(() => {
    if (!editingBio || editLeagues.length > 0) return;
    Promise.all([
      api.get<League[]>("/leagues"),
      api.get<TeamReference[]>("/teams/reference"),
    ]).then(([l, t]) => {
      setEditLeagues(l.data);
      setEditRefTeams(t.data);
      // Auto-detect custom mode if current values aren't in the dropdown lists
      if (player) {
        const leagueInList = l.data.some((lg) => lg.name === player.current_league);
        if (player.current_league && !leagueInList) setCustomLeague(true);
        const teamInList = t.data.some((tm) => tm.name === player.current_team);
        if (player.current_team && !teamInList) setCustomTeam(true);
      }
    }).catch(() => { /* Non-critical — fallback to text inputs */ });
  }, [editingBio]); // eslint-disable-line react-hooks/exhaustive-deps

  // Filter teams by selected league
  const filteredEditTeams = editFields.current_league
    ? editRefTeams.filter((t) => t.league === editFields.current_league)
    : editRefTeams;

  const handleSaveEdit = async () => {
    if (!player) return;
    setSavingEdit(true);
    setEditError("");
    try {
      // Only send changed fields
      const updates: Record<string, string | number | null> = {};
      if (editFields.current_team !== (player.current_team || "")) updates.current_team = editFields.current_team;
      if (editFields.current_league !== (player.current_league || "")) updates.current_league = editFields.current_league;
      if (editFields.position !== (player.position || "")) updates.position = editFields.position;
      if (editFields.shoots !== (player.shoots || "")) updates.shoots = editFields.shoots;
      if (editFields.dob !== (player.dob || "")) updates.dob = editFields.dob;
      const newHeight = editFields.height_cm === "" ? null : Number(editFields.height_cm);
      const newWeight = editFields.weight_kg === "" ? null : Number(editFields.weight_kg);
      if (newHeight !== (player.height_cm ?? null)) updates.height_cm = newHeight;
      if (newWeight !== (player.weight_kg ?? null)) updates.weight_kg = newWeight;

      if (Object.keys(updates).length === 0) {
        setEditingBio(false);
        return;
      }

      await api.patch(`/players/${playerId}`, updates);
      // Reload player data
      const { data } = await api.get<Player>(`/players/${playerId}`);
      setPlayer(data);
      setEditingBio(false);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Save failed";
      setEditError(msg);
    } finally {
      setSavingEdit(false);
    }
  };

  const loadIntelHistory = async () => {
    if (intelHistory.length > 0) {
      setShowIntelHistory(!showIntelHistory);
      return;
    }
    try {
      const { data } = await api.get<PlayerIntelligence[]>(`/players/${playerId}/intelligence/history`);
      setIntelHistory(data);
      setShowIntelHistory(true);
    } catch { /* ok */ }
  };

  useEffect(() => {
    async function load() {
      try {
        const playerRes = await api.get<Player>(`/players/${playerId}`);
        setPlayer(playerRes.data);
        setArchetypeValue(playerRes.data.archetype || "");
        setEditFields({
          current_team: playerRes.data.current_team || "",
          current_league: playerRes.data.current_league || "",
          position: playerRes.data.position || "",
          shoots: playerRes.data.shoots || "",
          dob: playerRes.data.dob || "",
          height_cm: playerRes.data.height_cm ?? "",
          weight_kg: playerRes.data.weight_kg ?? "",
        });

        const [statsRes, reportsRes, notesRes, libRes, sysRes, goalieRes, intelRes] = await Promise.allSettled([
          api.get<PlayerStats[]>(`/stats/player/${playerId}`),
          api.get<Report[]>(`/reports?player_id=${playerId}`),
          api.get<ScoutNote[]>(`/players/${playerId}/notes`),
          api.get<SystemLibraryEntry[]>("/hockey-os/systems-library"),
          api.get<TeamSystem[]>("/hockey-os/team-systems"),
          api.get<GoalieStats[]>(`/stats/goalie/${playerId}`),
          api.get<PlayerIntelligence>(`/players/${playerId}/intelligence`),
        ]);
        if (statsRes.status === "fulfilled") setStats(statsRes.value.data);
        if (goalieRes.status === "fulfilled") setGoalieStats(goalieRes.value.data);
        if (reportsRes.status === "fulfilled") setReports(reportsRes.value.data);
        if (notesRes.status === "fulfilled") setNotes(notesRes.value.data);
        if (libRes.status === "fulfilled") setSystemsLibrary(libRes.value.data);
        if (intelRes.status === "fulfilled") setIntelligence(intelRes.value.data);

        // Load ProspectX Metrics (non-blocking — may fail if < 5 GP)
        try {
          const indicesRes = await api.get<PlayerMetrics>(`/analytics/player-indices/${playerId}`);
          setPlayerMetrics(indicesRes.data);
        } catch { /* Player may not have enough stats */ }

        // Load recent form (non-blocking — for profile badge)
        try {
          const formRes = await api.get<RecentForm>(`/stats/player/${playerId}/recent-form?last_n=5`);
          setRecentForm(formRes.data);
        } catch { /* May not have game data */ }

        // Load pending corrections count (non-blocking)
        try {
          const corrRes = await api.get<PlayerCorrection[]>(`/players/${playerId}/corrections`);
          setPendingCorrections(corrRes.data.filter((c: PlayerCorrection) => c.status === "pending").length);
        } catch { /* Non-critical */ }

        // Load development plans (non-blocking)
        try {
          const plansRes = await api.get<DevelopmentPlan[]>(`/players/${playerId}/development-plans`);
          setDevPlanVersions(plansRes.data);
          if (plansRes.data.length > 0) setDevPlan(plansRes.data[0]); // latest version first
        } catch { /* Non-critical */ }

        // Match team system to player's current team
        if (sysRes.status === "fulfilled" && playerRes.data.current_team) {
          const match = sysRes.value.data.find(
            (s) => s.team_name.toLowerCase() === playerRes.data.current_team!.toLowerCase()
          );
          if (match) setTeamSystem(match);
        }
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed to load player";
        setError(msg);
      } finally {
        setLoading(false);
      }
    }
    if (playerId) load();
  }, [playerId]);

  // Lazy-load progression/game log when sub-view switches
  useEffect(() => {
    if (statsSubView === "progression" && !progression && !loadingProgression) {
      setLoadingProgression(true);
      api.get<Progression>(`/stats/player/${playerId}/progression`)
        .then((res) => setProgression(res.data))
        .catch(() => setProgression({ seasons: [], trend: "insufficient_data", yoy_delta: {} }))
        .finally(() => setLoadingProgression(false));
    }
    if (statsSubView === "gamelog" && !gameLog && !loadingGameLog) {
      setLoadingGameLog(true);
      api.get<GameStatsResponse>(`/stats/player/${playerId}/games?limit=50&offset=0`)
        .then((res) => setGameLog(res.data))
        .catch(() => setGameLog({ games: [], total: 0, source: "none" }))
        .finally(() => setLoadingGameLog(false));
    }
  }, [statsSubView, playerId, progression, gameLog, loadingProgression, loadingGameLog]);

  // Handle game log pagination
  const handleGameLogPageChange = (newOffset: number) => {
    setGameLogOffset(newOffset);
    setLoadingGameLog(true);
    api.get<GameStatsResponse>(`/stats/player/${playerId}/games?limit=50&offset=${newOffset}`)
      .then((res) => setGameLog(res.data))
      .catch(() => {})
      .finally(() => setLoadingGameLog(false));
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <NavBar />
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-navy border-t-teal" />
        </div>
      </ProtectedRoute>
    );
  }

  if (!player) {
    return (
      <ProtectedRoute>
        <NavBar />
        <main className="max-w-4xl mx-auto px-4 py-8">
          {error ? (
            <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
              <p className="text-red-700 font-medium mb-2">Error Loading Player</p>
              <p className="text-red-600 text-sm">{error}</p>
              <Link href="/players" className="inline-block mt-4 text-sm text-teal hover:underline">
                ← Back to Players
              </Link>
            </div>
          ) : (
            <p className="text-muted">Player not found.</p>
          )}
        </main>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <NavBar />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <Link href="/players" className="flex items-center gap-1 text-sm text-muted hover:text-navy mb-6 no-print">
          <ArrowLeft size={14} /> Back to Players
        </Link>

        {/* Player Header */}
        <div className="bg-gradient-to-br from-navy to-navy-light rounded-xl p-6 text-white mb-1">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              {/* Player Photo */}
              <div className="shrink-0">
                {hasRealImage(player.image_url) ? (
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden border-2 border-white/20 bg-white/10">
                    <img
                      src={assetUrl(player.image_url)}
                      alt={`${player.first_name} ${player.last_name}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg border-2 border-white/10 bg-white/5 flex items-center justify-center">
                    <User size={28} className="text-white/30" />
                  </div>
                )}
              </div>
              <div>
              <h1 className="text-2xl font-bold">
                {player.first_name} {player.last_name}
              </h1>
              <div className="flex items-center gap-3 mt-2 text-sm text-white/70">
                <span className="px-2 py-0.5 bg-teal/20 text-teal rounded font-oswald font-bold text-xs uppercase tracking-wide">
                  {fullPosition(player.position)}
                </span>
                {player.archetype && (
                  <span className="px-2 py-0.5 bg-orange/20 text-orange rounded font-oswald font-bold text-xs">
                    {player.archetype}
                  </span>
                )}
                {player.commitment_status && player.commitment_status !== "Uncommitted" && (
                  <span className={`px-2 py-0.5 rounded font-oswald font-bold text-xs ${
                    COMMITMENT_STATUS_COLORS[player.commitment_status]?.bg || "bg-white/10"
                  } ${COMMITMENT_STATUS_COLORS[player.commitment_status]?.text || "text-white/70"}`}>
                    {player.commitment_status}
                  </span>
                )}
                {player.roster_status && player.roster_status !== "active" && (
                  <span className={`px-2 py-0.5 rounded font-oswald font-bold text-xs uppercase tracking-wide ${
                    player.roster_status === "inj" ? "bg-red-500/20 text-red-300" :
                    player.roster_status === "susp" ? "bg-yellow-500/20 text-yellow-300" :
                    player.roster_status === "ap" ? "bg-blue-500/20 text-blue-300" :
                    player.roster_status === "scrch" ? "bg-gray-400/20 text-gray-300" :
                    "bg-white/10 text-white/70"
                  }`}>
                    {player.roster_status === "inj" ? "INJ" :
                     player.roster_status === "susp" ? "SUSP" :
                     player.roster_status === "ap" ? "AP" :
                     player.roster_status === "scrch" ? "SCRCH" :
                     player.roster_status.toUpperCase()}
                  </span>
                )}
                <PlayerStatusBadges tags={player.tags || []} size="md" />
                {player.shoots && <span>Shoots {player.shoots}</span>}
                {player.current_team && <span>{player.current_team}</span>}
                {player.current_league && <span className="text-white/50">({formatLeague(player.current_league)})</span>}
              </div>
              {(player.height_cm || player.weight_kg || player.dob) && (
                <p className="text-xs text-white/50 mt-1">
                  {player.dob && (() => {
                    const birth = new Date(player.dob);
                    const today = new Date();
                    let age = today.getFullYear() - birth.getFullYear();
                    const m = today.getMonth() - birth.getMonth();
                    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
                    return `Age ${age}`;
                  })()}
                  {player.dob && (player.height_cm || player.weight_kg) && " · "}
                  {player.height_cm && `${player.height_cm}cm`}
                  {player.height_cm && player.weight_kg && " / "}
                  {player.weight_kg && `${player.weight_kg}kg`}
                </p>
              )}
              {/* Inline Grade Badges (from intelligence) */}
              {intelligence && intelligence.version > 0 && intelligence.overall_grade && intelligence.overall_grade !== "NR" && (
                <div className="flex items-center gap-1.5 mt-2">
                  {([
                    { label: "OVR", grade: intelligence.overall_grade },
                    { label: "OFF", grade: intelligence.offensive_grade },
                    { label: "DEF", grade: intelligence.defensive_grade },
                    { label: "SKT", grade: intelligence.skating_grade },
                    { label: "IQ", grade: intelligence.hockey_iq_grade },
                    { label: "CMP", grade: intelligence.compete_grade },
                  ] as const).filter(g => g.grade && g.grade !== "NR").map(({ label, grade }) => (
                    <div key={label} className="flex items-center gap-0.5">
                      <span
                        className="w-7 h-7 rounded flex items-center justify-center text-white font-oswald font-bold text-[11px]"
                        style={{ backgroundColor: GRADE_COLORS[grade!] || "#9ca3af" }}
                        title={`${label}: ${grade}`}
                      >
                        {grade}
                      </span>
                      <span className="text-[8px] text-white/40 font-oswald uppercase">{label}</span>
                    </div>
                  ))}
                </div>
              )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleDownloadPDF}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-teal/10 text-teal border border-teal/20 rounded-lg text-xs font-semibold hover:bg-teal/20 transition-colors no-print"
                title="Download as PDF"
              >
                <Download size={14} />
                PDF
              </button>
              <Link
                href={`/reports/custom?player=${playerId}`}
                className="flex items-center gap-2 px-3 py-2 bg-navy text-white text-sm font-oswald font-semibold uppercase tracking-wider rounded-lg hover:bg-navy/90 transition-colors no-print"
              >
                <Wand2 size={14} />
                Custom
              </Link>
              <Link
                href={`/reports/generate?player=${playerId}`}
                className="flex items-center gap-2 px-4 py-2 bg-teal text-white text-sm font-oswald font-semibold uppercase tracking-wider rounded-lg hover:bg-teal/90 transition-colors no-print"
              >
                <Zap size={14} />
                Generate Report
              </Link>
            </div>
          </div>
        </div>

        <div className="ice-stripe mb-6 rounded-b-full" />

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-teal/20 no-print">
          {([
            { key: "profile" as Tab, label: "Profile", count: null },
            { key: "stats" as Tab, label: "Stats", count: stats.length },
            { key: "notes" as Tab, label: "Notes", count: notes.length },
            { key: "reports" as Tab, label: "Reports", count: reports.length },
            { key: "development" as Tab, label: "Development", count: devPlanVersions.length || null },
          ]).map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`px-4 py-2.5 text-sm font-oswald uppercase tracking-wider border-b-2 transition-colors ${
                activeTab === key
                  ? "border-teal text-teal font-semibold"
                  : "border-transparent text-muted hover:text-navy"
              }`}
            >
              {label}
              {count !== null && <span className="ml-1.5 text-xs opacity-60">({count})</span>}
            </button>
          ))}
        </div>

        {/* Profile Tab */}
        {activeTab === "profile" && (
          <section className="space-y-6">
            {/* Player Info + Archetype */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Bio Card */}
              <div className="bg-white rounded-xl border border-teal/20 p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-oswald uppercase tracking-wider text-muted flex items-center gap-2">
                    <User size={14} className="text-teal" /> Player Info
                  </h3>
                  <button
                    onClick={() => setEditingBio(!editingBio)}
                    className="text-xs text-teal hover:text-teal/70 flex items-center gap-1 transition-colors"
                  >
                    {editingBio ? <X size={12} /> : <Edit3 size={12} />}
                    {editingBio ? "Cancel" : "Edit"}
                  </button>
                </div>

                {/* Inline edit form */}
                {editingBio && (
                  <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-teal/20 space-y-2">
                    {/* League */}
                    <div>
                      <label className="text-[10px] font-oswald uppercase tracking-wider text-muted">League</label>
                      {customLeague ? (
                        <div className="flex gap-1">
                          <input
                            type="text"
                            value={editFields.current_league}
                            onChange={(e) => setEditFields((f) => ({ ...f, current_league: e.target.value }))}
                            placeholder="Enter league name"
                            className="flex-1 border border-teal/20 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-teal/30"
                          />
                          <button
                            type="button"
                            onClick={() => { setCustomLeague(false); setEditFields((f) => ({ ...f, current_league: "" })); }}
                            className="text-[10px] text-teal hover:underline px-1 shrink-0"
                          >
                            List
                          </button>
                        </div>
                      ) : (
                        <select
                          value={editFields.current_league}
                          onChange={(e) => {
                            if (e.target.value === "__custom__") {
                              setCustomLeague(true);
                              setEditFields((f) => ({ ...f, current_league: "", current_team: "" }));
                              setCustomTeam(true);
                            } else {
                              setEditFields((f) => ({ ...f, current_league: e.target.value, current_team: "" }));
                              setCustomTeam(false);
                            }
                          }}
                          className="w-full border border-teal/20 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-teal/30"
                        >
                          <option value="">Select league...</option>
                          {editLeagues.map((lg) => (
                            <option key={lg.id} value={lg.name}>{lg.name}</option>
                          ))}
                          <option value="__custom__">Custom...</option>
                        </select>
                      )}
                    </div>
                    {/* Team */}
                    <div>
                      <label className="text-[10px] font-oswald uppercase tracking-wider text-muted">Team</label>
                      {customTeam ? (
                        <div className="flex gap-1">
                          <input
                            type="text"
                            value={editFields.current_team}
                            onChange={(e) => setEditFields((f) => ({ ...f, current_team: e.target.value }))}
                            placeholder="Enter team name"
                            className="flex-1 border border-teal/20 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-teal/30"
                          />
                          {!customLeague && (
                            <button
                              type="button"
                              onClick={() => { setCustomTeam(false); setEditFields((f) => ({ ...f, current_team: "" })); }}
                              className="text-[10px] text-teal hover:underline px-1 shrink-0"
                            >
                              List
                            </button>
                          )}
                        </div>
                      ) : (
                        <select
                          value={editFields.current_team}
                          onChange={(e) => {
                            if (e.target.value === "__custom__") {
                              setCustomTeam(true);
                              setEditFields((f) => ({ ...f, current_team: "" }));
                            } else {
                              setEditFields((f) => ({ ...f, current_team: e.target.value }));
                            }
                          }}
                          className="w-full border border-teal/20 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-teal/30"
                        >
                          <option value="">Select team...</option>
                          {filteredEditTeams.map((t) => (
                            <option key={t.id} value={t.name}>{t.name}{t.city ? ` (${t.city})` : ""}</option>
                          ))}
                          <option value="__custom__">Custom...</option>
                        </select>
                      )}
                    </div>
                    {/* Position, Shoots, DOB */}
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] font-oswald uppercase tracking-wider text-muted">Position</label>
                        <select
                          value={editFields.position}
                          onChange={(e) => setEditFields((f) => ({ ...f, position: e.target.value }))}
                          className="w-full border border-teal/20 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-teal/30"
                        >
                          <option value="C">Center</option>
                          <option value="LW">Left Wing</option>
                          <option value="RW">Right Wing</option>
                          <option value="D">Defense</option>
                          <option value="G">Goalie</option>
                          <option value="F">Forward</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-oswald uppercase tracking-wider text-muted">Shoots</label>
                        <select
                          value={editFields.shoots}
                          onChange={(e) => setEditFields((f) => ({ ...f, shoots: e.target.value }))}
                          className="w-full border border-teal/20 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-teal/30"
                        >
                          <option value="">—</option>
                          <option value="L">Left</option>
                          <option value="R">Right</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-oswald uppercase tracking-wider text-muted">DOB</label>
                        <input
                          type="date"
                          value={editFields.dob}
                          onChange={(e) => setEditFields((f) => ({ ...f, dob: e.target.value }))}
                          className="w-full border border-teal/20 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-teal/30"
                        />
                      </div>
                    </div>
                    {/* Height & Weight */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-oswald uppercase tracking-wider text-muted">Height (cm)</label>
                        <input
                          type="number"
                          value={editFields.height_cm}
                          onChange={(e) => setEditFields((f) => ({ ...f, height_cm: e.target.value }))}
                          placeholder="e.g. 183"
                          className="w-full border border-teal/20 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-teal/30"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-oswald uppercase tracking-wider text-muted">Weight (kg)</label>
                        <input
                          type="number"
                          value={editFields.weight_kg}
                          onChange={(e) => setEditFields((f) => ({ ...f, weight_kg: e.target.value }))}
                          placeholder="e.g. 82"
                          className="w-full border border-teal/20 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-teal/30"
                        />
                      </div>
                    </div>
                    <button
                      onClick={handleSaveEdit}
                      disabled={savingEdit}
                      className="w-full mt-2 bg-teal text-white py-1.5 rounded text-xs font-oswald uppercase tracking-wider hover:bg-teal/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                    >
                      {savingEdit ? "Saving..." : <><Save size={12} /> Save Changes</>}
                    </button>
                    {editError && <p className="text-xs text-red-500 mt-1">{editError}</p>}
                  </div>
                )}

                {/* Player Photo Upload */}
                <div className="flex items-center gap-4 mb-4 pb-4 border-b border-teal/10">
                  <div className="relative group">
                    {hasRealImage(player.image_url) ? (
                      <div className="w-20 h-20 rounded-lg overflow-hidden border border-teal/20 bg-navy/5">
                        <img
                          src={assetUrl(player.image_url)}
                          alt={`${player.first_name} ${player.last_name}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-20 h-20 rounded-lg border-2 border-dashed border-teal/20 bg-navy/[0.02] flex items-center justify-center">
                        <Camera size={24} className="text-muted/30" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-muted mb-1.5">Player Photo</p>
                    <div className="flex items-center gap-2">
                      <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-oswald uppercase tracking-wider rounded-lg bg-teal/10 text-teal border border-teal/20 hover:bg-teal/20 transition-colors">
                        <Camera size={12} />
                        {uploadingImage ? "Uploading..." : hasRealImage(player.image_url) ? "Change" : "Upload"}
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={handleImageUpload}
                          disabled={uploadingImage}
                          className="hidden"
                        />
                      </label>
                      {hasRealImage(player.image_url) && (
                        <button
                          onClick={handleImageDelete}
                          className="text-xs text-muted hover:text-red-600 transition-colors"
                          title="Remove photo"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                    <p className="text-[10px] text-muted/50 mt-1">JPG, PNG, or WebP. Max 5 MB.</p>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted">Position</span>
                    <span className="font-semibold text-navy">{fullPosition(player.position)}</span>
                  </div>
                  {player.shoots && (
                    <div className="flex justify-between">
                      <span className="text-muted">Shoots</span>
                      <span className="font-semibold text-navy">{player.shoots}</span>
                    </div>
                  )}
                  {player.dob && (
                    <div className="flex justify-between">
                      <span className="text-muted">Date of Birth</span>
                      <span className="font-semibold text-navy">
                        {player.dob}
                        <span className="text-xs text-muted ml-1.5">
                          (Age {(() => {
                            const birth = new Date(player.dob!);
                            const today = new Date();
                            let age = today.getFullYear() - birth.getFullYear();
                            const m = today.getMonth() - birth.getMonth();
                            if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
                            return age;
                          })()})
                        </span>
                      </span>
                    </div>
                  )}
                  {player.height_cm && (
                    <div className="flex justify-between">
                      <span className="text-muted">Height</span>
                      <span className="font-semibold text-navy">
                        {Math.floor(player.height_cm / 2.54 / 12)}&apos;{Math.round(player.height_cm / 2.54 % 12)}&quot;
                        <span className="text-xs text-muted ml-1">({player.height_cm}cm)</span>
                      </span>
                    </div>
                  )}
                  {player.weight_kg && (
                    <div className="flex justify-between">
                      <span className="text-muted">Weight</span>
                      <span className="font-semibold text-navy">
                        {Math.round(player.weight_kg * 2.205)} lbs
                        <span className="text-xs text-muted ml-1">({player.weight_kg}kg)</span>
                      </span>
                    </div>
                  )}
                  {player.current_team && (
                    <div className="flex justify-between">
                      <span className="text-muted">Team</span>
                      <span className="font-semibold text-navy">
                        {player.current_team}
                        {player.current_league && <span className="text-xs text-muted ml-1">({formatLeague(player.current_league)})</span>}
                      </span>
                    </div>
                  )}
                  {player.league_tier && player.league_tier !== "Unknown" && (
                    <div className="flex justify-between">
                      <span className="text-muted">League Tier</span>
                      <span className="font-semibold text-navy text-xs">{player.league_tier}</span>
                    </div>
                  )}
                  {player.age_group && (
                    <div className="flex justify-between">
                      <span className="text-muted">Age Group</span>
                      <span className={`font-semibold text-xs px-1.5 py-0.5 rounded ${
                        player.age_group === "U16" ? "bg-green-50 text-green-700" :
                        player.age_group === "U18" ? "bg-blue-50 text-blue-700" :
                        player.age_group === "U20" ? "bg-orange/10 text-orange" :
                        "bg-gray-50 text-gray-600"
                      }`}>{player.age_group}</span>
                    </div>
                  )}
                  {player.draft_eligible_year && (
                    <div className="flex justify-between">
                      <span className="text-muted">Draft Eligible</span>
                      <span className="font-semibold text-navy">{player.draft_eligible_year}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-muted">Status</span>
                    <select
                      value={player.commitment_status || "Uncommitted"}
                      onChange={async (e) => {
                        const newStatus = e.target.value;
                        try {
                          await api.patch(`/players/${playerId}`, { commitment_status: newStatus });
                          setPlayer((prev) => prev ? { ...prev, commitment_status: newStatus } : prev);
                        } catch {
                          // ignore
                        }
                      }}
                      className={`text-xs font-oswald font-bold bg-transparent border-b border-dashed border-teal/20 cursor-pointer pr-5 py-0.5 rounded ${
                        COMMITMENT_STATUS_COLORS[player.commitment_status || "Uncommitted"]?.text || "text-gray-600"
                      }`}
                    >
                      {COMMITMENT_STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted">Roster Status</span>
                    <select
                      value={player.roster_status || "active"}
                      onChange={async (e) => {
                        const newStatus = e.target.value;
                        try {
                          await api.patch(`/players/${playerId}`, { roster_status: newStatus });
                          setPlayer((prev) => prev ? { ...prev, roster_status: newStatus } : prev);
                        } catch {
                          // ignore
                        }
                      }}
                      className={`text-xs font-oswald font-bold bg-transparent border-b border-dashed border-teal/20 cursor-pointer pr-5 py-0.5 rounded ${
                        (player.roster_status || "active") === "active" ? "text-green-600" :
                        (player.roster_status || "active") === "inj" ? "text-red-600" :
                        (player.roster_status || "active") === "susp" ? "text-yellow-600" :
                        (player.roster_status || "active") === "ap" ? "text-blue-600" :
                        (player.roster_status || "active") === "scrch" ? "text-gray-500" :
                        "text-gray-600"
                      }`}
                    >
                      {[
                        { value: "active", label: "Active" },
                        { value: "ap", label: "AP (Affiliated Player)" },
                        { value: "inj", label: "INJ (Injured)" },
                        { value: "susp", label: "SUSP (Suspended)" },
                        { value: "scrch", label: "SCRCH (Healthy Scratch)" },
                      ].map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                  {player.passports && player.passports.length > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted">Nationality</span>
                      <span className="font-semibold text-navy">{player.passports.join(", ")}</span>
                    </div>
                  )}
                  {player.tags && player.tags.length > 0 && (
                    <div className="pt-2 border-t border-teal/10">
                      <span className="text-xs text-muted">Tags</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {player.tags.map((tag) => (
                          <span key={tag} className="px-2 py-0.5 text-xs bg-navy/5 text-navy/70 rounded-full">{tag}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {player.elite_prospects_url && (
                    <div className="pt-2 border-t border-teal/10">
                      <a
                        href={player.elite_prospects_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm text-teal hover:text-teal/80 transition-colors"
                      >
                        <ExternalLink size={14} />
                        Elite Prospects Profile
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Archetype Card */}
              <div className="bg-white rounded-xl border border-teal/20 p-5">
                <h3 className="text-sm font-oswald uppercase tracking-wider text-muted mb-3 flex items-center gap-2">
                  <Activity size={14} className="text-orange" /> Player Archetype
                </h3>
                {!editingArchetype ? (
                  <div>
                    {player.archetype ? (
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-semibold text-navy">{player.archetype}</span>
                        <button
                          onClick={() => setEditingArchetype(true)}
                          className="text-xs text-muted hover:text-teal transition-colors"
                        >
                          <Edit3 size={12} />
                        </button>
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm text-muted mb-2">No archetype assigned yet.</p>
                        <button
                          onClick={() => setEditingArchetype(true)}
                          className="text-xs text-teal hover:underline"
                        >
                          + Assign archetype
                        </button>
                      </div>
                    )}
                    {player.archetype && (
                      <p className="text-xs text-muted/70 mt-2 leading-relaxed">
                        Compound archetypes help the AI understand the full player profile for system fit analysis.
                      </p>
                    )}
                  </div>
                ) : (
                  <div>
                    <input
                      type="text"
                      value={archetypeValue}
                      onChange={(e) => setArchetypeValue(e.target.value)}
                      placeholder="e.g., Two-Way Playmaking Forward"
                      className="w-full px-3 py-2 border border-teal/20 rounded-lg text-sm mb-2"
                      autoFocus
                    />
                    <p className="text-[10px] text-muted/60 mb-2">Click traits below to build a compound archetype, or type your own:</p>
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {([
                        { group: "Style", chips: ["Two-Way", "Offensive", "Defensive", "Physical", "Speed", "Playmaking", "Sniper", "Power", "Shutdown"] },
                        { group: "Role", chips: ["Forward", "Center", "Winger", "Defenseman", "Goalie"] },
                        { group: "Traits", chips: ["Elite IQ", "Net-Front", "Transition", "Puck-Moving", "Grinder", "Energy", "Checking", "Hybrid"] },
                      ] as const).map(({ group, chips }) => (
                        <div key={group} className="flex flex-wrap items-center gap-1">
                          <span className="text-[9px] font-oswald uppercase tracking-wider text-muted/50 mr-0.5">{group}:</span>
                          {chips.map((chip) => (
                            <button
                              key={chip}
                              type="button"
                              onClick={() => {
                                const current = archetypeValue.trim();
                                if (current && !current.endsWith(" ")) {
                                  setArchetypeValue(current + " " + chip);
                                } else {
                                  setArchetypeValue((current + " " + chip).trim());
                                }
                              }}
                              className="px-2 py-0.5 text-[10px] rounded-full border border-teal/20 hover:border-teal/50 hover:bg-teal/5 text-navy/70 transition-colors"
                            >
                              {chip}
                            </button>
                          ))}
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={async () => {
                          try {
                            await api.put(`/players/${playerId}`, {
                              ...player,
                              archetype: archetypeValue.trim() || null,
                            });
                            setPlayer({ ...player, archetype: archetypeValue.trim() || null });
                            setEditingArchetype(false);
                          } catch {
                            toast.error("Failed to save archetype");
                          }
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 bg-teal text-white text-xs font-oswald uppercase tracking-wider rounded-lg hover:bg-teal/90 transition-colors"
                      >
                        <Save size={12} /> Save
                      </button>
                      <button
                        onClick={() => {
                          setArchetypeValue(player.archetype || "");
                          setEditingArchetype(false);
                        }}
                        className="px-3 py-1.5 text-xs text-muted hover:text-navy transition-colors"
                      >
                        Cancel
                      </button>
                      {archetypeValue && (
                        <button
                          onClick={() => setArchetypeValue("")}
                          className="px-2 py-1 text-xs text-muted/60 hover:text-red-500 transition-colors"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* ProspectX Metrics */}
                {(playerMetrics || stats.length > 0) && (
                  <div className="mt-4 pt-4 border-t border-teal/10">
                    <h4 className="text-xs font-oswald uppercase tracking-wider text-muted mb-0.5">
                      ProspectX Metrics
                    </h4>
                    <p className="text-[10px] text-muted/50 mb-2">
                      PXI grades across 6 dimensions — derived from stats, scouting notes, and AI analysis
                    </p>
                    {playerMetrics ? (
                      <>
                        <MetricsRadarChart indices={playerMetrics} />
                        <ProspectXMetricsPanel indices={playerMetrics} />
                      </>
                    ) : (
                      <QuickMetrics stats={stats} position={player.position} />
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* ── ProspectX Intelligence Panel ── */}
            {intelligence && intelligence.version > 0 && (
              <div className="bg-white rounded-xl border border-teal/20 overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-navy/[0.04] to-teal/[0.04] px-5 py-3 border-b border-teal/10 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Brain size={16} className="text-teal" />
                    <h3 className="text-sm font-oswald uppercase tracking-wider text-navy">ProspectX Intelligence</h3>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal/10 text-teal font-medium">v{intelligence.version}</span>
                    {intelligence.trigger && (
                      <span className="text-[10px] text-muted/50">via {intelligence.trigger}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {intelligence.created_at && (
                      <span className="text-[10px] text-muted/50">
                        {new Date(intelligence.created_at).toLocaleDateString()}
                      </span>
                    )}
                    <button
                      onClick={handleRefreshIntelligence}
                      disabled={refreshingIntel}
                      className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-oswald uppercase tracking-wider rounded-lg border border-teal/30 text-teal hover:bg-teal/10 transition-colors disabled:opacity-50"
                    >
                      <RefreshCw size={10} className={refreshingIntel ? "animate-spin" : ""} />
                      {refreshingIntel ? "Analyzing..." : "Refresh"}
                    </button>
                  </div>
                </div>

                <div className="p-5 space-y-5">
                  {/* Grades Row */}
                  {intelligence.overall_grade && intelligence.overall_grade !== "NR" && (
                    <div>
                      <div className="flex flex-wrap gap-3">
                        {([
                          { label: "Overall", grade: intelligence.overall_grade },
                          { label: "Offensive", grade: intelligence.offensive_grade },
                          { label: "Defensive", grade: intelligence.defensive_grade },
                          { label: "Skating", grade: intelligence.skating_grade },
                          { label: "Hockey IQ", grade: intelligence.hockey_iq_grade },
                          { label: "Compete", grade: intelligence.compete_grade },
                        ] as const).filter(g => g.grade && g.grade !== "NR").map(({ label, grade }) => {
                          const gradeInfo = PROSPECT_GRADES[grade!];
                          return (
                            <div key={label} className="text-center min-w-[60px]" title={gradeInfo?.nhl || ""}>
                              <div
                                className="w-10 h-10 mx-auto rounded-lg flex items-center justify-center text-white font-oswald font-bold text-sm"
                                style={{ backgroundColor: GRADE_COLORS[grade!] || "#9ca3af" }}
                              >
                                {grade}
                              </div>
                              <p className="text-[10px] text-muted mt-1">{label}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Archetype + Confidence */}
                  {intelligence.archetype && (
                    <div className="flex items-center gap-3">
                      <div className="px-3 py-1.5 rounded-lg bg-navy/[0.06] border border-navy/10">
                        <span className="text-sm font-semibold text-navy">{intelligence.archetype}</span>
                      </div>
                      {intelligence.archetype_confidence != null && (
                        <div className="flex items-center gap-1.5">
                          <div className="w-20 h-1.5 bg-border rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${Math.round(intelligence.archetype_confidence * 100)}%`,
                                backgroundColor: intelligence.archetype_confidence > 0.7 ? "#18B3A6" : intelligence.archetype_confidence > 0.4 ? "#F36F21" : "#9ca3af"
                              }}
                            />
                          </div>
                          <span className="text-[10px] text-muted">{Math.round(intelligence.archetype_confidence * 100)}% confidence</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* AI Summary */}
                  {intelligence.summary && (
                    <div className="pl-3 border-l-2 border-teal/30">
                      <p className="text-sm text-navy/80 leading-relaxed">{intelligence.summary}</p>
                    </div>
                  )}

                  {/* Strengths + Development Areas */}
                  {(intelligence.strengths.length > 0 || intelligence.development_areas.length > 0) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {intelligence.strengths.length > 0 && (
                        <div>
                          <h4 className="text-xs font-oswald uppercase tracking-wider text-muted mb-2 flex items-center gap-1.5">
                            <Star size={11} className="text-green-500" /> Strengths
                          </h4>
                          <ul className="space-y-1">
                            {intelligence.strengths.map((s, i) => (
                              <li key={i} className="text-sm text-navy/80 flex items-start gap-2">
                                <span className="w-1 h-1 rounded-full bg-green-500 mt-2 shrink-0" />
                                {s}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {intelligence.development_areas.length > 0 && (
                        <div>
                          <h4 className="text-xs font-oswald uppercase tracking-wider text-muted mb-2 flex items-center gap-1.5">
                            <AlertTriangle size={11} className="text-orange" /> Development Areas
                          </h4>
                          <ul className="space-y-1">
                            {intelligence.development_areas.map((d, i) => (
                              <li key={i} className="text-sm text-navy/80 flex items-start gap-2">
                                <span className="w-1 h-1 rounded-full bg-orange mt-2 shrink-0" />
                                {d}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Stat Signature Chips */}
                  {intelligence.stat_signature && Object.keys(intelligence.stat_signature).length > 0 && (
                    <div>
                      <h4 className="text-xs font-oswald uppercase tracking-wider text-muted mb-2">Stat Signature</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(intelligence.stat_signature).map(([key, value]) => {
                          const meta = STAT_SIGNATURE_LABELS[key];
                          return (
                            <span
                              key={key}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-lg bg-navy/[0.04] border border-teal/10 text-navy/70"
                              title={key.replace(/_/g, ' ')}
                            >
                              {meta?.emoji && <span>{meta.emoji}</span>}
                              <span className="font-medium">{meta?.label || key.replace(/_/g, ' ')}:</span> {value}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Projection */}
                  {intelligence.projection && (
                    <div className="bg-navy/[0.02] rounded-lg p-3 border border-teal/8">
                      <h4 className="text-xs font-oswald uppercase tracking-wider text-muted mb-1 flex items-center gap-1.5">
                        <TrendingUp size={11} className="text-teal" /> Projection
                      </h4>
                      <p className="text-sm text-navy/80">{intelligence.projection}</p>
                    </div>
                  )}

                  {/* Comparable Players */}
                  {intelligence.comparable_players.length > 0 && (
                    <div>
                      <h4 className="text-xs font-oswald uppercase tracking-wider text-muted mb-1">Comparable Players</h4>
                      <div className="space-y-1">
                        {intelligence.comparable_players.map((comp, i) => (
                          <p key={i} className="text-sm text-navy/70 italic">{comp}</p>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Intelligence History Toggle */}
                  <div className="pt-2 border-t border-teal/8">
                    <button
                      onClick={loadIntelHistory}
                      className="flex items-center gap-1 text-[10px] font-oswald uppercase tracking-wider text-muted hover:text-navy transition-colors"
                    >
                      {showIntelHistory ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                      Intelligence History ({intelligence.version} version{intelligence.version !== 1 ? "s" : ""})
                    </button>
                    {showIntelHistory && intelHistory.length > 0 && (
                      <div className="mt-2 space-y-1.5 max-h-40 overflow-y-auto">
                        {intelHistory.map((h) => (
                          <div key={h.id || h.version} className="flex items-center gap-3 text-xs text-muted/70 py-1 border-b border-teal/5 last:border-0">
                            <span className="font-medium text-navy/50">v{h.version}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-navy/[0.04]">{h.trigger || "—"}</span>
                            <span>{h.archetype || "—"}</span>
                            <span className="font-medium" style={{ color: GRADE_COLORS[h.overall_grade || "NR"] || "#9ca3af" }}>
                              {h.overall_grade || "NR"}
                            </span>
                            <span className="ml-auto text-[10px]">
                              {h.created_at ? new Date(h.created_at).toLocaleDateString() : "—"}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Generate Intelligence CTA (when no intelligence exists) */}
            {(!intelligence || intelligence.version === 0) && (stats.length > 0 || goalieStats.length > 0 || notes.length > 0) && (
              <div className="bg-gradient-to-r from-navy/[0.02] to-teal/[0.02] rounded-xl border border-dashed border-teal/30 p-5 text-center">
                <Brain size={28} className="mx-auto text-teal/40 mb-2" />
                <p className="text-sm text-navy/70 mb-2">This player has data but no intelligence profile yet.</p>
                <button
                  onClick={handleRefreshIntelligence}
                  disabled={refreshingIntel}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal text-white text-xs font-oswald uppercase tracking-wider rounded-lg hover:bg-teal/90 transition-colors disabled:opacity-50"
                >
                  <Brain size={14} />
                  {refreshingIntel ? "Analyzing Player..." : "Generate Intelligence Profile"}
                </button>
              </div>
            )}

            {/* Team System Context */}
            {teamSystem ? (
              <div className="bg-white rounded-xl border border-teal/20 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-oswald uppercase tracking-wider text-muted flex items-center gap-2">
                    <Shield size={14} className="text-navy" /> Team System — {teamSystem.team_name}
                    {teamSystem.season && <span className="text-xs font-normal text-muted/60 ml-1">{teamSystem.season}</span>}
                  </h3>
                  <Link
                    href="/team-systems"
                    className="text-xs text-teal hover:underline"
                  >
                    Edit Systems →
                  </Link>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  {([
                    { label: "Forecheck", value: teamSystem.forecheck, icon: Swords, color: "text-orange" },
                    { label: "DZ Coverage", value: teamSystem.dz_structure, icon: Shield, color: "text-navy" },
                    { label: "OZ Setup", value: teamSystem.oz_setup, icon: Target, color: "text-teal" },
                    { label: "Breakout", value: teamSystem.breakout, icon: Zap, color: "text-orange" },
                    { label: "PK", value: teamSystem.pk_formation, icon: Shield, color: "text-navy" },
                  ] as const).filter((f) => f.value).map(({ label, value, icon: Icon, color }) => {
                    const entry = systemsLibrary.find((e) => e.code === value);
                    return (
                      <div key={label} className="p-3 rounded-lg bg-navy/[0.03] border border-teal/10">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Icon size={12} className={color} />
                          <span className="text-[10px] font-oswald uppercase tracking-wider text-muted">{label}</span>
                        </div>
                        <p className="text-xs font-semibold text-navy">{entry?.name || value}</p>
                      </div>
                    );
                  })}
                </div>
                {/* Team Style */}
                {(teamSystem.pace || teamSystem.physicality || teamSystem.offensive_style) && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {teamSystem.pace && (
                      <span className="text-xs px-2 py-0.5 rounded bg-orange/[0.06] text-navy/70">
                        <strong>Pace:</strong> {teamSystem.pace}
                      </span>
                    )}
                    {teamSystem.physicality && (
                      <span className="text-xs px-2 py-0.5 rounded bg-orange/[0.06] text-navy/70">
                        <strong>Physical:</strong> {teamSystem.physicality}
                      </span>
                    )}
                    {teamSystem.offensive_style && (
                      <span className="text-xs px-2 py-0.5 rounded bg-orange/[0.06] text-navy/70">
                        <strong>Offense:</strong> {teamSystem.offensive_style}
                      </span>
                    )}
                  </div>
                )}
                {teamSystem.identity_tags && teamSystem.identity_tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {teamSystem.identity_tags.map((tag) => (
                      <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-teal/10 text-teal font-medium">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                {teamSystem.notes && (
                  <p className="text-xs text-muted/70 mt-2 italic">{teamSystem.notes}</p>
                )}
              </div>
            ) : player.current_team ? (
              <div className="bg-navy/[0.02] rounded-xl border border-dashed border-teal/20 p-5 text-center">
                <Shield size={24} className="mx-auto text-muted/30 mb-2" />
                <p className="text-sm text-muted mb-1">No system profile for <strong>{player.current_team}</strong></p>
                <Link
                  href="/team-systems"
                  className="text-xs text-teal hover:underline"
                >
                  Create team system profile →
                </Link>
              </div>
            ) : null}

            {/* Player Notes Preview */}
            {player.notes && (
              <div className="bg-white rounded-xl border border-teal/20 p-5">
                <h3 className="text-sm font-oswald uppercase tracking-wider text-muted mb-2">Player Notes</h3>
                <p className="text-sm text-navy/80 whitespace-pre-wrap">{player.notes}</p>
              </div>
            )}

            {/* Suggest Correction */}
            <div className="bg-white rounded-xl border border-teal/20 p-5 no-print">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-oswald uppercase tracking-wider text-muted flex items-center gap-2">
                  <AlertTriangle size={14} className="text-orange" />
                  Data Corrections
                  {pendingCorrections > 0 && (
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-orange text-white text-[10px] font-bold">
                      {pendingCorrections}
                    </span>
                  )}
                </h3>
                <button
                  onClick={() => setShowCorrectionForm(!showCorrectionForm)}
                  className="text-xs text-teal hover:text-teal/70 flex items-center gap-1 transition-colors"
                >
                  {showCorrectionForm ? <X size={12} /> : <Edit3 size={12} />}
                  {showCorrectionForm ? "Cancel" : "Suggest Correction"}
                </button>
              </div>

              {correctionMsg && (
                <div className="mb-3 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-green-700 text-xs flex items-center gap-2">
                  <CheckCircle size={12} />
                  {correctionMsg}
                  <button onClick={() => setCorrectionMsg("")} className="ml-auto"><X size={10} /></button>
                </div>
              )}

              {showCorrectionForm && (
                <div className="space-y-3 p-3 bg-gray-50 rounded-lg border border-teal/20">
                  <div>
                    <label className="text-[10px] font-oswald uppercase tracking-wider text-muted">Field to Correct</label>
                    <select
                      value={correctionField}
                      onChange={(e) => setCorrectionField(e.target.value)}
                      className="w-full border border-teal/20 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-teal/30"
                    >
                      <option value="">Select field...</option>
                      {CORRECTABLE_FIELDS.map((f) => (
                        <option key={f} value={f}>{CORRECTABLE_FIELD_LABELS[f] || f}</option>
                      ))}
                    </select>
                  </div>

                  {correctionField && (
                    <div className="text-[10px] text-muted">
                      Current value: <span className="font-medium text-navy">
                        {String((player as unknown as Record<string, unknown>)[correctionField] ?? "—")}
                      </span>
                    </div>
                  )}

                  <div>
                    <label className="text-[10px] font-oswald uppercase tracking-wider text-muted">Correct Value</label>
                    <input
                      type="text"
                      value={correctionValue}
                      onChange={(e) => setCorrectionValue(e.target.value)}
                      placeholder="Enter the correct value..."
                      className="w-full border border-teal/20 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-teal/30"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-oswald uppercase tracking-wider text-muted">Reason (optional)</label>
                    <textarea
                      value={correctionReason}
                      onChange={(e) => setCorrectionReason(e.target.value)}
                      placeholder="Why is this incorrect?"
                      rows={2}
                      className="w-full border border-teal/20 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-teal/30 resize-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-oswald uppercase tracking-wider text-muted">Confidence</label>
                    <div className="flex gap-2 mt-1">
                      {(["low", "medium", "high"] as const).map((c) => (
                        <button
                          key={c}
                          onClick={() => setCorrectionConfidence(c)}
                          className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                            correctionConfidence === c
                              ? c === "high" ? "bg-green-100 text-green-700 border border-green-300"
                                : c === "medium" ? "bg-yellow-100 text-yellow-700 border border-yellow-300"
                                : "bg-red-100 text-red-700 border border-red-300"
                              : "bg-gray-100 text-muted border border-teal/20 hover:bg-gray-200"
                          }`}
                        >
                          {c.charAt(0).toUpperCase() + c.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={async () => {
                      if (!correctionField || !correctionValue) return;
                      setSubmittingCorrection(true);
                      try {
                        await api.post(`/players/${playerId}/corrections`, {
                          field_name: correctionField,
                          new_value: correctionValue,
                          reason: correctionReason,
                          confidence: correctionConfidence,
                        });
                        setCorrectionMsg("Correction submitted for review!");
                        setCorrectionField("");
                        setCorrectionValue("");
                        setCorrectionReason("");
                        setShowCorrectionForm(false);
                        setPendingCorrections((p) => p + 1);
                      } catch (err: unknown) {
                        const msg = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
                        toast.error(typeof msg === "string" ? msg : "Failed to submit correction");
                      } finally {
                        setSubmittingCorrection(false);
                      }
                    }}
                    disabled={submittingCorrection || !correctionField || !correctionValue}
                    className="w-full bg-gradient-to-r from-orange to-orange/80 text-white py-2 rounded-lg font-oswald font-semibold uppercase tracking-wider text-sm hover:shadow-md transition-shadow disabled:opacity-50"
                  >
                    {submittingCorrection ? "Submitting..." : "Submit Correction"}
                  </button>
                </div>
              )}

              {!showCorrectionForm && pendingCorrections === 0 && (
                <p className="text-xs text-muted">
                  See incorrect data? Click &quot;Suggest Correction&quot; to submit a fix for review.
                </p>
              )}
            </div>
          </section>
        )}

        {/* Stats Tab */}
        {activeTab === "stats" && (
          <section>
            {/* Sub-view switcher */}
            <div className="flex items-center gap-1 mb-4 p-0.5 bg-navy/[0.04] rounded-lg w-fit">
              {([
                { key: "current" as StatsSubView, label: "Current" },
                { key: "progression" as StatsSubView, label: "Progression" },
                { key: "gamelog" as StatsSubView, label: "Game Log" },
              ]).map((sv) => (
                <button
                  key={sv.key}
                  onClick={() => setStatsSubView(sv.key)}
                  className={`px-3 py-1.5 text-xs font-oswald uppercase tracking-wider rounded-md transition-all ${
                    statsSubView === sv.key
                      ? "bg-white text-navy shadow-sm font-bold"
                      : "text-muted hover:text-navy"
                  }`}
                >
                  {sv.label}
                </button>
              ))}
            </div>

            {/* Current Stats Sub-View */}
            {statsSubView === "current" && (
              <>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h2 className="text-lg font-semibold text-navy">Season Stats</h2>
                    {stats.length > 0 && stats[0]?.created_at && (
                      <p className="text-[10px] text-muted/50 flex items-center gap-1.5 mt-0.5">
                        {(() => {
                          const ts = new Date(stats[0].created_at);
                          const diffDays = (Date.now() - ts.getTime()) / (1000 * 60 * 60 * 24);
                          const dot = diffDays <= 2 ? "bg-green-500" : diffDays <= 7 ? "bg-teal" : "bg-amber-500";
                          return (
                            <>
                              <span className={`inline-block w-1.5 h-1.5 rounded-full ${dot}`} />
                              Last updated {ts.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                              {diffDays > 7 && <span className="text-amber-600 font-medium ml-1">&middot; Sync may be needed</span>}
                            </>
                          );
                        })()}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <input
                      type="file"
                      accept=".csv,.xlsx,.xls,.xlsm"
                      onChange={handleCsvUpload}
                      disabled={uploading}
                      className="block text-sm text-muted file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-orange/30 file:text-xs file:font-oswald file:uppercase file:tracking-wider file:font-semibold file:bg-orange/10 file:text-orange hover:file:bg-orange/20 file:transition-colors file:cursor-pointer"
                    />
                    <p className="text-[10px] text-muted/60 mt-1">Supports XLSX analytics exports, CSV, Excel</p>
                  </div>
                </div>

                {uploadMsg && (
                  <div className={`mb-3 px-3 py-2 rounded-lg text-sm flex items-center gap-2 ${
                    uploadMsg.startsWith("✓") ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"
                  }`}>
                    {uploadMsg.startsWith("✓") ? <CheckCircle size={14} /> : null}
                    {uploadMsg}
                  </div>
                )}

                {/* Recent Form Badge */}
                {recentForm && recentForm.games_found > 0 && (
                  <div className="mb-4 p-3 rounded-lg bg-gradient-to-r from-teal/[0.04] to-transparent border border-teal/15">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-[10px] font-oswald uppercase tracking-wider text-teal font-bold">Last {recentForm.games_found} Games</span>
                      <span className="text-xs text-navy font-medium">{recentForm.totals.g}G {recentForm.totals.a}A {recentForm.totals.p}P</span>
                      <span className="text-xs text-muted">({recentForm.averages.ppg} PPG)</span>
                      {recentForm.streak && recentForm.streak !== "No active streak" && recentForm.streak !== "No game data available" && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-teal/10 text-teal text-[10px] font-bold">
                          <Flame size={9} />
                          {recentForm.streak}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Goalie Stats (if goalie position) */}
                {goalieStats.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-sm font-oswald uppercase tracking-wider text-muted mb-2">Goaltending</h3>
                    <div className="bg-white rounded-xl border border-teal/20 overflow-hidden">
                      <GoalieStatTable stats={goalieStats} />
                    </div>
                  </div>
                )}

                {/* Skater Stats */}
                <div className="bg-white rounded-xl border border-teal/20 overflow-hidden">
                  <StatTable stats={stats} editable={true} onStatsChange={async () => {
                    const res = await api.get<PlayerStats[]>(`/stats/player/${playerId}`);
                    setStats(res.data);
                  }} />
                </div>

                {stats.length === 0 && goalieStats.length === 0 && (
                  <p className="text-xs text-muted mt-2">
                    No stats yet. Upload a CSV or Excel file with columns: season, gp, g, a, p, plus_minus, pim, shots, sog, shooting_pct
                  </p>
                )}

                {/* Extended Stats (Advanced Analytics) */}
                {stats.some((s) => s.extended_stats && Object.keys(s.extended_stats).length > 0) && (
                  <div className="mt-6">
                    <h3 className="text-sm font-oswald uppercase tracking-wider text-muted mb-3">
                      Advanced Analytics
                    </h3>
                    {stats
                      .filter((s) => s.extended_stats && Object.keys(s.extended_stats).length > 0)
                      .slice(0, 1)
                      .map((s) => (
                        <ExtendedStatTable
                          key={s.id}
                          stats={s.extended_stats!}
                          season={s.season}
                          source={s.data_source || undefined}
                        />
                      ))}
                  </div>
                )}

                {/* Goalie Extended Stats */}
                {goalieStats.some((s) => s.extended_stats && Object.keys(s.extended_stats).length > 0) && (
                  <div className="mt-6">
                    <h3 className="text-sm font-oswald uppercase tracking-wider text-muted mb-3">
                      Goaltending Advanced Analytics
                    </h3>
                    {goalieStats
                      .filter((s) => s.extended_stats && Object.keys(s.extended_stats).length > 0)
                      .slice(0, 1)
                      .map((s) => (
                        <ExtendedStatTable
                          key={s.id}
                          stats={s.extended_stats!}
                          season={s.season}
                          source={s.data_source || undefined}
                        />
                      ))}
                  </div>
                )}
              </>
            )}

            {/* Progression Sub-View */}
            {statsSubView === "progression" && (
              <>
                <h2 className="text-lg font-semibold text-navy mb-3">Season Progression</h2>
                {loadingProgression ? (
                  <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-navy border-t-teal mx-auto" />
                    <p className="text-xs text-muted mt-2">Loading progression data...</p>
                  </div>
                ) : progression ? (
                  <ProgressionChart data={progression} />
                ) : null}
              </>
            )}

            {/* Game Log Sub-View */}
            {statsSubView === "gamelog" && (
              <>
                <h2 className="text-lg font-semibold text-navy mb-3">Game Log</h2>
                {loadingGameLog ? (
                  <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-navy border-t-teal mx-auto" />
                    <p className="text-xs text-muted mt-2">Loading game log...</p>
                  </div>
                ) : gameLog ? (
                  <GameLogTable
                    data={gameLog}
                    onPageChange={handleGameLogPageChange}
                    currentOffset={gameLogOffset}
                    pageSize={50}
                  />
                ) : null}
              </>
            )}
          </section>
        )}

        {/* Notes Tab */}
        {activeTab === "notes" && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-navy">Scout Notes</h2>
              <div className="flex items-center gap-2">
                <Link
                  href={`/scout-notes/new?player_id=${playerId}`}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs font-oswald uppercase tracking-wider rounded-lg bg-teal text-white hover:bg-teal/90 transition-colors"
                >
                  <ClipboardCheck size={14} />
                  Scout Evaluation
                </Link>
                <button
                  onClick={() => {
                    setShowNoteForm(!showNoteForm);
                    setEditingNoteId(null);
                    if (!showNoteForm) {
                      setNoteText("");
                      setNoteType("general");
                      setNoteTags([]);
                      setNotePrivate(false);
                    }
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs font-oswald uppercase tracking-wider rounded-lg bg-teal/10 text-teal hover:bg-teal/20 border border-teal/30 transition-colors"
                >
                  {showNoteForm ? <X size={14} /> : <PenLine size={14} />}
                  {showNoteForm ? "Cancel" : "Quick Note"}
                </button>
              </div>
            </div>

            {/* Note Form — Mobile Optimized */}
            {showNoteForm && (
              <div className="bg-white rounded-xl border border-teal/20 p-4 mb-4">
                <h3 className="text-sm font-semibold text-navy mb-3">
                  {editingNoteId ? "Edit Note" : "New Note"}
                </h3>

                {/* Note Type */}
                <div className="flex gap-2 mb-3 flex-wrap">
                  {Object.entries(NOTE_TYPE_LABELS).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setNoteType(key)}
                      className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                        noteType === key
                          ? "bg-teal text-white border-teal"
                          : "bg-white text-muted border-teal/20 hover:border-teal/50"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {/* Text Area — large touch target for mobile */}
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Enter your scouting observation..."
                  rows={4}
                  className="w-full px-3 py-2.5 border border-teal/20 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
                  autoFocus
                />

                {/* Tags */}
                <div className="mt-3">
                  <p className="text-xs text-muted mb-1.5">Tags</p>
                  <div className="flex flex-wrap gap-1.5">
                    {NOTE_TAG_OPTIONS.map((tag) => (
                      <button
                        key={tag}
                        onClick={() => toggleTag(tag)}
                        className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                          noteTags.includes(tag)
                            ? "bg-navy text-white border-navy"
                            : "bg-white text-muted border-teal/20 hover:border-navy/30"
                        }`}
                      >
                        {NOTE_TAG_LABELS[tag] || tag}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Private toggle + Save */}
                <div className="flex items-center justify-between mt-4">
                  <button
                    onClick={() => setNotePrivate(!notePrivate)}
                    className={`flex items-center gap-1.5 text-xs transition-colors ${
                      notePrivate ? "text-orange" : "text-muted"
                    }`}
                  >
                    {notePrivate ? <Lock size={14} /> : <Unlock size={14} />}
                    {notePrivate ? "Private (only you)" : "Shared with team"}
                  </button>
                  <button
                    onClick={handleSaveNote}
                    disabled={!noteText.trim() || savingNote}
                    className="flex items-center gap-2 px-4 py-2 bg-teal text-white text-xs font-oswald uppercase tracking-wider rounded-lg hover:bg-teal/90 disabled:opacity-50 transition-colors"
                  >
                    <Send size={14} />
                    {savingNote ? "Saving..." : editingNoteId ? "Update" : "Save Note"}
                  </button>
                </div>
              </div>
            )}

            {/* Notes List */}
            {notes.length === 0 ? (
              <div className="text-center py-8 bg-white rounded-xl border border-teal/20">
                <PenLine size={24} className="mx-auto text-muted/40 mb-2" />
                <p className="text-muted text-sm">No notes yet for this player.</p>
                <p className="text-xs text-muted/60 mt-1">Add your first scouting observation above.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {notes.map((note) => (
                  <div key={note.id} className="bg-white rounded-xl border border-teal/20 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        {/* Header */}
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                            note.note_type === "game" ? "bg-blue-50 text-blue-700" :
                            note.note_type === "practice" ? "bg-green-50 text-green-700" :
                            note.note_type === "interview" ? "bg-purple-50 text-purple-700" :
                            "bg-gray-50 text-gray-600"
                          }`}>
                            {NOTE_TYPE_LABELS[note.note_type] || note.note_type}
                          </span>
                          {note.is_private && (
                            <span className="flex items-center gap-0.5 text-xs text-orange">
                              <Lock size={10} /> Private
                            </span>
                          )}
                          <span className="text-xs text-muted">
                            {new Date(note.created_at).toLocaleDateString("en-US", {
                              month: "short", day: "numeric", year: "numeric",
                              hour: "numeric", minute: "2-digit",
                            })}
                          </span>
                        </div>

                        {/* v2: Overall Grade + Prospect Status */}
                        {(note.overall_grade || note.prospect_status) && (
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            {note.overall_grade && (
                              <span className={`w-7 h-7 rounded flex items-center justify-center text-xs font-oswald font-bold ${
                                note.overall_grade >= 4 ? "bg-green-100 text-green-700" :
                                note.overall_grade === 3 ? "bg-amber-50 text-amber-700" :
                                "bg-red-100 text-red-700"
                              }`}>
                                {note.overall_grade}
                              </span>
                            )}
                            {note.prospect_status && PROSPECT_STATUS_LABELS[note.prospect_status] && (
                              <span className={`text-[9px] font-oswald uppercase tracking-wider px-1.5 py-0.5 rounded ${PROSPECT_STATUS_LABELS[note.prospect_status].color}`}>
                                {PROSPECT_STATUS_LABELS[note.prospect_status].label}
                              </span>
                            )}
                          </div>
                        )}

                        {/* v2: Ratings row */}
                        {(note.skating_rating || note.puck_skills_rating || note.hockey_iq_rating || note.compete_rating || note.defense_rating) && (
                          <div className="flex gap-1.5 mb-2 flex-wrap">
                            {[
                              { label: "SKT", value: note.skating_rating },
                              { label: "PKS", value: note.puck_skills_rating },
                              { label: "IQ", value: note.hockey_iq_rating },
                              { label: "CMP", value: note.compete_rating },
                              { label: "DEF", value: note.defense_rating },
                            ].filter(r => r.value).map((r) => (
                              <span key={r.label} className="text-[9px] font-oswald uppercase tracking-wider px-1.5 py-0.5 rounded bg-navy/5 text-navy/60">
                                {r.label} {r.value}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* v2: One-line summary */}
                        {note.one_line_summary && (
                          <p className="text-xs text-navy/80 mb-2 italic">{note.one_line_summary}</p>
                        )}

                        {/* v2: Strengths / Improvements */}
                        {note.strengths_notes && (
                          <p className="text-sm text-navy whitespace-pre-wrap mb-1"><span className="text-[10px] font-oswald uppercase tracking-wider text-navy/50">Strengths: </span>{note.strengths_notes}</p>
                        )}
                        {note.improvements_notes && (
                          <p className="text-sm text-navy whitespace-pre-wrap mb-1"><span className="text-[10px] font-oswald uppercase tracking-wider text-navy/50">Improve: </span>{note.improvements_notes}</p>
                        )}

                        {/* Note Text */}
                        {note.note_text && (
                          <p className="text-sm text-navy whitespace-pre-wrap">{note.note_text}</p>
                        )}

                        {/* Tags + Scout */}
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          {note.tags.map((tag) => (
                            <span key={tag} className="px-2 py-0.5 text-xs bg-navy/5 text-navy/70 rounded-full">
                              {NOTE_TAG_LABELS[tag] || tag}
                            </span>
                          ))}
                          {note.scout_name && (
                            <span className="text-xs text-muted ml-auto">
                              — {note.scout_name}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleEditNote(note)}
                          className="p-1.5 text-muted hover:text-navy rounded transition-colors"
                          title="Edit"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteNote(note.id)}
                          className="p-1.5 text-muted hover:text-red-600 rounded transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Reports Tab */}
        {activeTab === "reports" && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-navy">Reports</h2>
              <span className="text-xs text-muted">{reports.length} total</span>
            </div>
            {reports.length === 0 ? (
              <div className="text-center py-8 bg-white rounded-xl border border-teal/20">
                <FileText size={24} className="mx-auto text-muted/40 mb-2" />
                <p className="text-muted text-sm">No reports yet for this player.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {reports.map((r) => (
                  <ReportCard key={r.id} report={r} />
                ))}
              </div>
            )}
          </section>
        )}

        {/* Development Tab */}
        {activeTab === "development" && (
          <section className="space-y-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-navy">Development Plan</h2>
              <div className="flex gap-2">
                {devPlanVersions.length > 1 && (
                  <button
                    onClick={() => setShowDevVersions(!showDevVersions)}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-border rounded-lg hover:bg-gray-50 text-muted"
                  >
                    <History size={14} />
                    v{devPlan?.version || 1} of {devPlanVersions.length}
                  </button>
                )}
                <button
                  onClick={async () => {
                    setGeneratingDevPlan(true);
                    try {
                      const { data } = await api.post<DevelopmentPlan>(`/players/${playerId}/development-plans/generate`);
                      setDevPlan(data);
                      setDevPlanVersions((prev) => [data, ...prev]);
                      toast.success("Development plan generated!");
                    } catch {
                      toast.error("Failed to generate plan");
                    } finally {
                      setGeneratingDevPlan(false);
                    }
                  }}
                  disabled={generatingDevPlan}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-teal text-white rounded-lg hover:bg-teal/90 disabled:opacity-50"
                >
                  {generatingDevPlan ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  {devPlan ? "New Version" : "Generate Plan"}
                </button>
              </div>
            </div>

            {/* Version History Dropdown */}
            {showDevVersions && devPlanVersions.length > 1 && (
              <div className="bg-white rounded-xl border border-border p-3 space-y-1">
                <p className="text-xs font-oswald uppercase tracking-wider text-muted mb-2">Version History</p>
                {devPlanVersions.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => { setDevPlan(v); setShowDevVersions(false); }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between ${
                      v.id === devPlan?.id ? "bg-teal/10 text-teal" : "hover:bg-gray-50 text-navy"
                    }`}
                  >
                    <span>v{v.version} — {v.created_by_name}</span>
                    <span className="text-xs text-muted">{new Date(v.created_at).toLocaleDateString()}</span>
                  </button>
                ))}
              </div>
            )}

            {!devPlan && !loadingDevPlan && !generatingDevPlan && (
              <div className="text-center py-12 bg-white rounded-xl border border-border">
                <TrendingUp size={32} className="mx-auto text-muted/40 mb-3" />
                <p className="text-muted text-sm mb-3">No development plan yet for this player.</p>
                <p className="text-muted/60 text-xs mb-4">Click &quot;Generate Plan&quot; to create an AI-powered development roadmap.</p>
              </div>
            )}

            {loadingDevPlan && (
              <div className="text-center py-12 bg-white rounded-xl border border-border">
                <Loader2 size={24} className="mx-auto text-teal animate-spin mb-2" />
                <p className="text-sm text-muted">Loading development plan...</p>
              </div>
            )}

            {devPlan && (
              <div className="space-y-4">
                {/* Plan Header */}
                <div className="bg-white rounded-xl border border-border p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-base font-oswald uppercase tracking-wider text-navy">{devPlan.title}</h3>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                        devPlan.status === "active" ? "bg-green-100 text-green-700" :
                        devPlan.status === "superseded" ? "bg-yellow-100 text-yellow-700" :
                        "bg-gray-100 text-gray-700"
                      }`}>
                        {devPlan.status}
                      </span>
                      <span className="text-xs text-muted">v{devPlan.version}</span>
                    </div>
                  </div>
                  {devPlan.summary && (
                    <p className="text-sm text-muted leading-relaxed">{devPlan.summary}</p>
                  )}
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted/60">
                    <span>Season: {devPlan.season}</span>
                    <span>Type: {devPlan.plan_type.replace("_", " ")}</span>
                    <span>By: {devPlan.created_by_name}</span>
                    <span>{new Date(devPlan.created_at).toLocaleDateString()}</span>
                  </div>
                </div>

                {/* Plan Sections */}
                {devPlan.sections.map((section: DevelopmentPlanSection, idx: number) => (
                  <div key={idx} className="bg-white rounded-xl border border-border overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${
                          section.priority === "critical" ? "bg-red-500" :
                          section.priority === "high" ? "bg-orange-500" :
                          section.priority === "medium" ? "bg-yellow-500" :
                          section.priority === "low" ? "bg-blue-500" :
                          "bg-gray-400"
                        }`} />
                        {editingDevSection === idx ? (
                          <input
                            value={editDevTitle}
                            onChange={(e) => setEditDevTitle(e.target.value)}
                            className="text-sm font-semibold text-navy bg-transparent border-b border-teal/30 outline-none px-1 py-0.5 w-full"
                          />
                        ) : (
                          <h4 className="text-sm font-semibold text-navy">{section.title}</h4>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {editingDevSection === idx ? (
                          <>
                            <button
                              onClick={async () => {
                                setSavingDevPlan(true);
                                try {
                                  const updated = [...devPlan.sections];
                                  updated[idx] = { ...updated[idx], title: editDevTitle, content: editDevContent };
                                  const { data } = await api.put<DevelopmentPlan>(`/development-plans/${devPlan.id}`, {
                                    sections: updated,
                                  });
                                  setDevPlan(data);
                                  setDevPlanVersions((prev) => [data, ...prev.filter((v) => v.id !== devPlan.id)]);
                                  setEditingDevSection(null);
                                  toast.success(`Saved as v${data.version}`);
                                } catch {
                                  toast.error("Failed to save");
                                } finally {
                                  setSavingDevPlan(false);
                                }
                              }}
                              disabled={savingDevPlan}
                              className="p-1 text-teal hover:bg-teal/10 rounded"
                            >
                              {savingDevPlan ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                            </button>
                            <button
                              onClick={() => setEditingDevSection(null)}
                              className="p-1 text-muted hover:bg-gray-100 rounded"
                            >
                              <X size={14} />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => {
                              setEditingDevSection(idx);
                              setEditDevContent(section.content);
                              setEditDevTitle(section.title);
                            }}
                            className="p-1 text-muted hover:bg-gray-100 rounded"
                          >
                            <Edit3 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="px-4 py-3">
                      {editingDevSection === idx ? (
                        <textarea
                          value={editDevContent}
                          onChange={(e) => setEditDevContent(e.target.value)}
                          rows={8}
                          className="w-full text-sm text-navy/80 bg-gray-50 border border-border rounded-lg p-3 outline-none focus:border-teal/40 font-mono leading-relaxed resize-y"
                        />
                      ) : (
                        <div className="text-sm text-navy/80 leading-relaxed whitespace-pre-wrap">
                          {section.content}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {/* Add Section Button */}
                <button
                  onClick={async () => {
                    const newSection: DevelopmentPlanSection = {
                      title: "New Section",
                      content: "Add your development notes here...",
                      priority: "medium",
                    };
                    setSavingDevPlan(true);
                    try {
                      const updated = [...devPlan.sections, newSection];
                      const { data } = await api.put<DevelopmentPlan>(`/development-plans/${devPlan.id}`, {
                        sections: updated,
                      });
                      setDevPlan(data);
                      setDevPlanVersions((prev) => [data, ...prev.filter((v) => v.id !== devPlan.id)]);
                      setEditingDevSection(data.sections.length - 1);
                      setEditDevTitle(newSection.title);
                      setEditDevContent(newSection.content);
                      toast.success("Section added");
                    } catch {
                      toast.error("Failed to add section");
                    } finally {
                      setSavingDevPlan(false);
                    }
                  }}
                  disabled={savingDevPlan}
                  className="w-full py-3 border border-dashed border-border rounded-xl text-sm text-muted hover:border-teal/40 hover:text-teal flex items-center justify-center gap-1"
                >
                  <Plus size={14} />
                  Add Section
                </button>
              </div>
            )}
          </section>
        )}

        {/* Print Footer */}
        <div className="print-footer mt-8 pt-4 border-t border-navy/10 justify-center items-center gap-2 text-xs text-muted">
          <div className="text-center">
            <p className="font-oswald text-navy text-sm">ProspectX Intelligence</p>
            <p>Exported {new Date().toLocaleDateString()}</p>
          </div>
        </div>
      </main>
    </ProtectedRoute>
  );
}

// ── ProspectX Quick Indices ────────────────────────────────
// Simple performance indices calculated from available season stats.
// These give scouts a fast snapshot before diving into full reports.
function QuickMetrics({ stats, position }: { stats: PlayerStats[]; position: string }) {
  // Use the most recent season stats (highest GP)
  const season = stats
    .filter((s) => s.stat_type === "season" || s.gp >= 5)
    .sort((a, b) => b.gp - a.gp)[0] || stats[0];

  if (!season) return null;

  const gp = season.gp || 1;

  // Points per game
  const ppg = season.p / gp;

  // Goals per game
  const gpg = season.g / gp;

  // Assists per game
  const apg = season.a / gp;

  // Shooting efficiency (if available)
  const shootPct = season.shooting_pct ?? (season.sog > 0 ? (season.g / season.sog) * 100 : null);

  // Discipline index (lower PIM/GP is better)
  const pimPerGame = season.pim / gp;

  // Plus/minus per game
  const pmPerGame = season.plus_minus / gp;

  // Offensive index (0-100 scale, normalized for junior hockey)
  const offenseIndex = Math.min(100, Math.round(
    (ppg / 1.5) * 40 + // 1.5 PPG = 40 pts
    ((shootPct ?? 10) / 20) * 30 + // 20% shooting = 30 pts
    (gpg / 0.6) * 30 // 0.6 GPG = 30 pts
  ));

  // Two-way index
  const twoWayIndex = Math.min(100, Math.round(
    Math.max(0, 50 + pmPerGame * 10) + // +/- contribution
    Math.max(0, 30 - pimPerGame * 5) + // Discipline (fewer PIMs = better)
    (ppg / 1.0) * 20 // Offensive production
  ));

  const indices = [
    { label: "PPG", value: ppg.toFixed(2), bar: Math.min(100, (ppg / 1.5) * 100) },
    { label: "GPG", value: gpg.toFixed(2), bar: Math.min(100, (gpg / 0.6) * 100) },
    { label: "S%", value: shootPct !== null ? `${shootPct.toFixed(1)}%` : "—", bar: shootPct ? Math.min(100, (shootPct / 20) * 100) : 0 },
    { label: "Offense", value: `${offenseIndex}`, bar: offenseIndex },
    { label: "Two-Way", value: `${twoWayIndex}`, bar: twoWayIndex },
  ];

  return (
    <div className="space-y-2">
      {indices.map(({ label, value, bar }) => (
        <div key={label} className="flex items-center gap-3">
          <span className="text-[10px] font-oswald uppercase tracking-wider text-muted w-14">{label}</span>
          <div className="flex-1 h-2 bg-navy/[0.06] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${bar}%`,
                background: bar > 70 ? "var(--teal)" : bar > 40 ? "var(--orange)" : "#94a3b8",
              }}
            />
          </div>
          <span className="text-xs font-semibold text-navy w-10 text-right">{value}</span>
        </div>
      ))}
      <p className="text-[9px] text-muted/50 mt-1">
        Based on {season.gp} GP {season.season ? `(${season.season})` : ""}
      </p>
    </div>
  );
}

// ── Metrics Radar Chart ──────────────────────────────────────
const RADAR_LABEL_MAP: Record<string, string> = {
  sniper: "Sniper",
  playmaker: "Playmaker",
  transition: "Transition",
  defensive: "Defensive",
  compete: "Compete",
  hockey_iq: "Hockey IQ",
};

function MetricsRadarChart({ indices }: { indices: PlayerMetrics }) {
  const metricOrder = ["sniper", "playmaker", "transition", "defensive", "compete", "hockey_iq"] as const;
  const data = metricOrder.map((key) => ({
    axis: RADAR_LABEL_MAP[key],
    value: indices.indices[key]?.value ?? 0,
    fullMark: 99,
  }));

  return (
    <div className="h-[200px] mb-3">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="75%" data={data}>
          <PolarGrid stroke="#e5e7eb" strokeWidth={0.5} />
          <PolarAngleAxis
            dataKey="axis"
            tick={{ fontSize: 10, fill: "#6b7280", fontFamily: "Oswald, sans-serif" }}
            tickLine={false}
          />
          <Radar
            dataKey="value"
            stroke={METRIC_COLORS.transition}
            fill={METRIC_COLORS.transition}
            fillOpacity={0.2}
            strokeWidth={2}
            dot={{ r: 3, fill: METRIC_COLORS.transition }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── ProspectX Metrics Panel (6 proprietary indices with percentiles) ──
function ProspectXMetricsPanel({ indices }: { indices: PlayerMetrics }) {
  const metricOrder = ["sniper", "playmaker", "transition", "defensive", "compete", "hockey_iq"] as const;

  return (
    <div className="space-y-2.5">
      {metricOrder.map((key) => {
        const idx = indices.indices[key];
        if (!idx) return null;
        const color = METRIC_COLORS[key] || "#9ca3af";
        const icon = METRIC_ICONS[key] || "";
        const pctLabel = idx.percentile >= 90 ? "Elite" :
          idx.percentile >= 75 ? "Above Avg" :
          idx.percentile >= 50 ? "Average" :
          idx.percentile >= 25 ? "Below Avg" : "Developing";

        return (
          <div key={key} className="group">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-sm" title={idx.description}>{icon}</span>
              <span className="text-[10px] font-oswald uppercase tracking-wider text-muted flex-1">
                {idx.label}
              </span>
              <span
                className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                style={{
                  backgroundColor: color + "15",
                  color: color,
                }}
              >
                {pctLabel} &middot; {idx.percentile}th
              </span>
              <span className="text-xs font-bold tabular-nums w-8 text-right" style={{ color }}>
                {idx.value}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <div className="flex-1 h-2 bg-navy/[0.06] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{
                    width: `${idx.value}%`,
                    backgroundColor: color,
                    opacity: 0.85,
                  }}
                />
              </div>
            </div>
          </div>
        );
      })}
      <div className="flex items-center justify-between pt-1.5 mt-1 border-t border-teal/8">
        <p className="text-[9px] text-muted/50">
          Based on {indices.gp} GP {indices.season ? `(${indices.season})` : ""}
          {indices.has_extended_stats && (
            <span className="ml-1 text-teal/60">+ Extended Analytics</span>
          )}
        </p>
        <span className="text-[8px] text-muted/30 font-oswald uppercase tracking-widest">
          ProspectX
        </span>
      </div>
    </div>
  );
}
