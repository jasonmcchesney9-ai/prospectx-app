"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
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
} from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import StatTable from "@/components/StatTable";
import ExtendedStatTable from "@/components/ExtendedStatTable";
import GoalieStatTable from "@/components/GoalieStatTable";
import ReportCard from "@/components/ReportCard";
import api from "@/lib/api";
import type { Player, PlayerStats, GoalieStats, Report, ScoutNote, TeamSystem, SystemLibraryEntry, PlayerIntelligence, PlayerMetrics } from "@/types/api";
import { NOTE_TYPE_LABELS, NOTE_TAG_OPTIONS, NOTE_TAG_LABELS, PROSPECT_GRADES, STAT_SIGNATURE_LABELS, GRADE_COLORS, METRIC_COLORS, METRIC_ICONS } from "@/types/api";

type Tab = "profile" | "stats" | "notes" | "reports";

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

  // CSV upload
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");

  // Image upload
  const [uploadingImage, setUploadingImage] = useState(false);

  // Note form
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [noteType, setNoteType] = useState("general");
  const [noteTags, setNoteTags] = useState<string[]>([]);
  const [notePrivate, setNotePrivate] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);

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
      alert(msg);
    } finally {
      setUploadingImage(false);
      e.target.value = "";
    }
  };

  const handleImageDelete = async () => {
    if (!confirm("Remove player photo?")) return;
    try {
      await api.delete(`/players/${playerId}/image`);
      setPlayer((prev) => prev ? { ...prev, image_url: null } : prev);
    } catch {
      alert("Failed to delete image");
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
      alert(msg);
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
      alert(msg);
    } finally {
      setRefreshingIntel(false);
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
        <Link href="/players" className="flex items-center gap-1 text-sm text-muted hover:text-navy mb-6">
          <ArrowLeft size={14} /> Back to Players
        </Link>

        {/* Player Header */}
        <div className="bg-gradient-to-br from-navy to-navy-light rounded-xl p-6 text-white mb-1">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              {/* Player Photo */}
              <div className="shrink-0">
                {player.image_url ? (
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden border-2 border-white/20 bg-white/10">
                    <img
                      src={`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}${player.image_url}`}
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
                {player.shoots && <span>Shoots {player.shoots}</span>}
                {player.current_team && <span>{player.current_team}</span>}
                {player.current_league && <span className="text-white/50">({player.current_league})</span>}
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
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href={`/reports/custom?player=${playerId}`}
                className="flex items-center gap-2 px-3 py-2 bg-navy text-white text-sm font-oswald font-semibold uppercase tracking-wider rounded-lg hover:bg-navy/90 transition-colors"
              >
                <Wand2 size={14} />
                Custom
              </Link>
              <Link
                href={`/reports/generate?player=${playerId}`}
                className="flex items-center gap-2 px-4 py-2 bg-teal text-white text-sm font-oswald font-semibold uppercase tracking-wider rounded-lg hover:bg-teal/90 transition-colors"
              >
                <Zap size={14} />
                Generate Report
              </Link>
            </div>
          </div>
        </div>

        <div className="ice-stripe mb-6 rounded-b-full" />

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-border">
          {([
            { key: "profile" as Tab, label: "Profile", count: null },
            { key: "stats" as Tab, label: "Stats", count: stats.length },
            { key: "notes" as Tab, label: "Notes", count: notes.length },
            { key: "reports" as Tab, label: "Reports", count: reports.length },
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
              <div className="bg-white rounded-xl border border-border p-5">
                <h3 className="text-sm font-oswald uppercase tracking-wider text-muted mb-3 flex items-center gap-2">
                  <User size={14} className="text-teal" /> Player Info
                </h3>

                {/* Player Photo Upload */}
                <div className="flex items-center gap-4 mb-4 pb-4 border-b border-border/50">
                  <div className="relative group">
                    {player.image_url ? (
                      <div className="w-20 h-20 rounded-lg overflow-hidden border border-border bg-navy/5">
                        <img
                          src={`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}${player.image_url}`}
                          alt={`${player.first_name} ${player.last_name}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-20 h-20 rounded-lg border-2 border-dashed border-border bg-navy/[0.02] flex items-center justify-center">
                        <Camera size={24} className="text-muted/30" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-muted mb-1.5">Player Photo</p>
                    <div className="flex items-center gap-2">
                      <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-oswald uppercase tracking-wider rounded-lg bg-teal/10 text-teal border border-teal/20 hover:bg-teal/20 transition-colors">
                        <Camera size={12} />
                        {uploadingImage ? "Uploading..." : player.image_url ? "Change" : "Upload"}
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={handleImageUpload}
                          disabled={uploadingImage}
                          className="hidden"
                        />
                      </label>
                      {player.image_url && (
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
                        {player.current_league && <span className="text-xs text-muted ml-1">({player.current_league})</span>}
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
                  {player.passports && player.passports.length > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted">Nationality</span>
                      <span className="font-semibold text-navy">{player.passports.join(", ")}</span>
                    </div>
                  )}
                  {player.tags && player.tags.length > 0 && (
                    <div className="pt-2 border-t border-border/50">
                      <span className="text-xs text-muted">Tags</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {player.tags.map((tag) => (
                          <span key={tag} className="px-2 py-0.5 text-xs bg-navy/5 text-navy/70 rounded-full">{tag}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Archetype Card */}
              <div className="bg-white rounded-xl border border-border p-5">
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
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm mb-2"
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
                              className="px-2 py-0.5 text-[10px] rounded-full border border-border hover:border-teal/50 hover:bg-teal/5 text-navy/70 transition-colors"
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
                            alert("Failed to save archetype");
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
                  <div className="mt-4 pt-4 border-t border-border/50">
                    <h4 className="text-xs font-oswald uppercase tracking-wider text-muted mb-2">
                      ProspectX Metrics
                    </h4>
                    {playerMetrics ? (
                      <ProspectXMetricsPanel indices={playerMetrics} />
                    ) : (
                      <QuickMetrics stats={stats} position={player.position} />
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* ── ProspectX Intelligence Panel ── */}
            {intelligence && intelligence.version > 0 && (
              <div className="bg-white rounded-xl border border-border overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-navy/[0.04] to-teal/[0.04] px-5 py-3 border-b border-border/50 flex items-center justify-between">
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
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-lg bg-navy/[0.04] border border-border/50 text-navy/70"
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
                    <div className="bg-navy/[0.02] rounded-lg p-3 border border-border/30">
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
                  <div className="pt-2 border-t border-border/30">
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
                          <div key={h.id || h.version} className="flex items-center gap-3 text-xs text-muted/70 py-1 border-b border-border/20 last:border-0">
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
              <div className="bg-white rounded-xl border border-border p-5">
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
                      <div key={label} className="p-3 rounded-lg bg-navy/[0.03] border border-border/50">
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
              <div className="bg-navy/[0.02] rounded-xl border border-dashed border-border p-5 text-center">
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
              <div className="bg-white rounded-xl border border-border p-5">
                <h3 className="text-sm font-oswald uppercase tracking-wider text-muted mb-2">Player Notes</h3>
                <p className="text-sm text-navy/80 whitespace-pre-wrap">{player.notes}</p>
              </div>
            )}
          </section>
        )}

        {/* Stats Tab */}
        {activeTab === "stats" && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-navy">Season Stats</h2>
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

            {/* Goalie Stats (if goalie position) */}
            {goalieStats.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-oswald uppercase tracking-wider text-muted mb-2">Goaltending</h3>
                <div className="bg-white rounded-xl border border-border overflow-hidden">
                  <GoalieStatTable stats={goalieStats} />
                </div>
              </div>
            )}

            {/* Skater Stats */}
            <div className="bg-white rounded-xl border border-border overflow-hidden">
              <StatTable stats={stats} />
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
          </section>
        )}

        {/* Notes Tab */}
        {activeTab === "notes" && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-navy">Scout Notes</h2>
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
                {showNoteForm ? "Cancel" : "Add Note"}
              </button>
            </div>

            {/* Note Form — Mobile Optimized */}
            {showNoteForm && (
              <div className="bg-white rounded-xl border border-border p-4 mb-4">
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
                          : "bg-white text-muted border-border hover:border-teal/50"
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
                  className="w-full px-3 py-2.5 border border-border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
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
                            : "bg-white text-muted border-border hover:border-navy/30"
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
              <div className="text-center py-8 bg-white rounded-xl border border-border">
                <PenLine size={24} className="mx-auto text-muted/40 mb-2" />
                <p className="text-muted text-sm">No notes yet for this player.</p>
                <p className="text-xs text-muted/60 mt-1">Add your first scouting observation above.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {notes.map((note) => (
                  <div key={note.id} className="bg-white rounded-xl border border-border p-4">
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

                        {/* Note Text */}
                        <p className="text-sm text-navy whitespace-pre-wrap">{note.note_text}</p>

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
              <div className="text-center py-8 bg-white rounded-xl border border-border">
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
      <div className="flex items-center justify-between pt-1.5 mt-1 border-t border-border/30">
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
