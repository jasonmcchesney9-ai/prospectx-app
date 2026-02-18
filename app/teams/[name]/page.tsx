"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Users,
  Shield,
  FileText,
  BarChart3,
  Zap,
  Swords,
  Target,
  PlusCircle,
  Building2,
  Edit3,
  Trash2,
  Save,
  X,
  Upload,
  Camera,
  Layers,
  RefreshCw,
  Activity,
  Calendar,
  ChevronDown,
  ChevronUp,
  Brain,
  Star,
  AlertTriangle,
  TrendingUp,
} from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import ReportCard from "@/components/ReportCard";
import ExtendedStatTable from "@/components/ExtendedStatTable";
import LineCombinations from "@/components/LineCombinations";
import LineBuilder from "@/components/LineBuilder";
import PlayerStatusBadges from "@/components/PlayerStatusBadges";
import api, { assetUrl, hasRealImage } from "@/lib/api";
import { formatLeague } from "@/lib/leagues";
import type { Player, RosterPlayer, Report, TeamSystem, TeamReference, SystemLibraryEntry, TeamStats, LineCombination, TeamGame, TeamIntelligence } from "@/types/api";

type Tab = "roster" | "identity" | "lines" | "systems" | "reports" | "stats" | "games";

// ── Position grouping ─────────────────────────────────────
const FORWARD_POS = ["C", "LW", "RW", "F"];
const DEFENSE_POS = ["LD", "RD", "D"];
const GOALIE_POS = ["G"];

function posGroup(pos: string): "forwards" | "defense" | "goalies" | "other" {
  const p = pos.toUpperCase();
  if (FORWARD_POS.includes(p)) return "forwards";
  if (DEFENSE_POS.includes(p)) return "defense";
  if (GOALIE_POS.includes(p)) return "goalies";
  return "other";
}

function formatHeight(cm: number | null): string {
  if (!cm) return "\u2014";
  const totalInches = cm / 2.54;
  return `${Math.floor(totalInches / 12)}-${Math.round(totalInches % 12)}`;
}
function formatWeight(kg: number | null): string {
  if (!kg) return "\u2014";
  return `${Math.round(kg * 2.205)}`;
}
function formatDob(dob: string | null, birthYear: number | null): string {
  if (dob) return new Date(dob + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  if (birthYear) return String(birthYear);
  return "\u2014";
}
function getDraftInfo(p: RosterPlayer): string {
  if (p.commitment_status && p.commitment_status !== "Uncommitted") return p.commitment_status;
  if (p.draft_eligible_year) return `${p.draft_eligible_year} Eligible`;
  return "\u2014";
}

// ── Team style options ────────────────────────────────────
const PACE_OPTIONS = ["Slow / Controlled", "Moderate", "Fast", "Up-Tempo / Push Pace"];
const PHYSICALITY_OPTIONS = ["Low", "Moderate", "High", "Very High / Intimidation"];
const OFFENSIVE_STYLE_OPTIONS = ["Cycle / Grind", "Rush / Transition", "Balanced", "Perimeter / Shot Volume", "Net-Front / Dirty Areas"];

const EMPTY_FORM = {
  team_name: "",
  season: "2025-26",
  forecheck: "",
  dz_structure: "",
  oz_setup: "",
  pp_formation: "",
  pk_formation: "",
  neutral_zone: "",
  breakout: "",
  identity_tags: [] as string[],
  pace: "",
  physicality: "",
  offensive_style: "",
  notes: "",
};

// ── SystemSelect dropdown ─────────────────────────────────
function SystemSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { code: string; name: string }[];
}) {
  return (
    <div>
      <label className="block text-xs font-oswald uppercase tracking-wider text-muted mb-1.5">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2.5 border border-teal/20 rounded-lg text-sm bg-white"
      >
        <option value="">Select...</option>
        {options.map((opt) => (
          <option key={opt.code} value={opt.code}>{opt.name}</option>
        ))}
      </select>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────
export default function TeamDetailPage() {
  const params = useParams();
  const teamName = decodeURIComponent(params.name as string);

  const [roster, setRoster] = useState<RosterPlayer[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [teamSystem, setTeamSystem] = useState<TeamSystem | null>(null);
  const [systemsLibrary, setSystemsLibrary] = useState<SystemLibraryEntry[]>([]);
  const [teamRef, setTeamRef] = useState<TeamReference | null>(null);
  const [teamStats, setTeamStats] = useState<TeamStats | null>(null);
  const [lineCombinations, setLineCombinations] = useState<LineCombination[]>([]);
  const [teamGames, setTeamGames] = useState<TeamGame[]>([]);
  const [expandedGameId, setExpandedGameId] = useState<string | null>(null);
  const [teamIntel, setTeamIntel] = useState<TeamIntelligence | null>(null);
  const [refreshingIntel, setRefreshingIntel] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("roster");
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // ── HockeyTech Sync State ──────────────────────────────
  const [htInfo, setHtInfo] = useState<{ hockeytech_team_id: number | null; hockeytech_league: string | null; linked: boolean; has_ht_players?: boolean } | null>(null);
  const [syncingStats, setSyncingStats] = useState(false);
  const [syncingGameLogs, setSyncingGameLogs] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  // ── Systems inline CRUD state ───────────────────────────
  const [sysEditing, setSysEditing] = useState(false);
  const [sysForm, setSysForm] = useState({ ...EMPTY_FORM });
  const [sysSaving, setSysSaving] = useState(false);
  const [sysError, setSysError] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [rosterSearch, setRosterSearch] = useState("");
  const [rosterPosFilter, setRosterPosFilter] = useState<"all" | "forwards" | "defense" | "goalies">("all");
  const [rosterSort, setRosterSort] = useState<"name" | "pts" | "gp" | "youngest">("name");

  const loadData = useCallback(async () => {
    try {
      setError("");
      const [rosterRes, reportsRes, sysRes, libRes, refRes, teamStatsRes, linesRes, gamesRes] = await Promise.allSettled([
        api.get<RosterPlayer[]>(`/teams/${encodeURIComponent(teamName)}/roster-stats`),
        api.get<Report[]>(`/teams/${encodeURIComponent(teamName)}/reports`),
        api.get<TeamSystem[]>("/hockey-os/team-systems"),
        api.get<SystemLibraryEntry[]>("/hockey-os/systems-library"),
        api.get<TeamReference[]>("/teams/reference"),
        api.get<TeamStats>(`/stats/team/${encodeURIComponent(teamName)}`),
        api.get<LineCombination[]>(`/stats/team/${encodeURIComponent(teamName)}/lines`),
        api.get<TeamGame[]>(`/teams/${encodeURIComponent(teamName)}/games`),
      ]);

      if (rosterRes.status === "fulfilled") setRoster(rosterRes.value.data);
      if (reportsRes.status === "fulfilled") setReports(reportsRes.value.data);
      if (libRes.status === "fulfilled") setSystemsLibrary(libRes.value.data);
      if (teamStatsRes.status === "fulfilled" && teamStatsRes.value.data) setTeamStats(teamStatsRes.value.data);
      if (linesRes.status === "fulfilled") setLineCombinations(linesRes.value.data || []);
      if (gamesRes.status === "fulfilled") setTeamGames(gamesRes.value.data || []);

      // Match team system by name
      if (sysRes.status === "fulfilled") {
        const match = sysRes.value.data.find(
          (s) => s.team_name.toLowerCase() === teamName.toLowerCase()
        );
        setTeamSystem(match || null);
      }

      // Match team reference for metadata
      if (refRes.status === "fulfilled") {
        const match = refRes.value.data.find(
          (t: TeamReference) => t.name.toLowerCase() === teamName.toLowerCase()
        );
        if (match) setTeamRef(match);
      }

      // Load HockeyTech integration info (non-blocking)
      try {
        const htRes = await api.get<{ hockeytech_team_id: number | null; hockeytech_league: string | null; linked: boolean; has_ht_players?: boolean }>(
          `/teams/${encodeURIComponent(teamName)}/hockeytech-info`
        );
        setHtInfo(htRes.data);
      } catch { /* non-critical */ }

      // Load team intelligence (non-blocking)
      try {
        const intelRes = await api.get<TeamIntelligence>(`/teams/${encodeURIComponent(teamName)}/intelligence`);
        if (intelRes.data && intelRes.data.version > 0) {
          setTeamIntel(intelRes.data);
        }
      } catch { /* non-critical */ }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed to load team";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [teamName]);

  useEffect(() => {
    if (teamName) loadData();
  }, [teamName, loadData]);

  // ── Systems helpers ─────────────────────────────────────
  const getOptions = (type: string) => systemsLibrary.filter((e) => e.system_type === type);

  const getSystemName = (code: string) =>
    systemsLibrary.find((e) => e.code === code)?.name || code || "\u2014";

  const startCreateSystem = () => {
    setSysForm({ ...EMPTY_FORM, team_name: teamName });
    setSysEditing(true);
    setSysError("");
    setTagInput("");
  };

  const startEditSystem = () => {
    if (!teamSystem) return;
    setSysForm({
      team_name: teamSystem.team_name,
      season: teamSystem.season || "2025-26",
      forecheck: teamSystem.forecheck || "",
      dz_structure: teamSystem.dz_structure || "",
      oz_setup: teamSystem.oz_setup || "",
      pp_formation: teamSystem.pp_formation || "",
      pk_formation: teamSystem.pk_formation || "",
      neutral_zone: teamSystem.neutral_zone || "",
      breakout: teamSystem.breakout || "",
      identity_tags: teamSystem.identity_tags || [],
      pace: teamSystem.pace || "",
      physicality: teamSystem.physicality || "",
      offensive_style: teamSystem.offensive_style || "",
      notes: teamSystem.notes || "",
    });
    setSysEditing(true);
    setSysError("");
    setTagInput("");
  };

  const cancelEditSystem = () => {
    setSysEditing(false);
    setSysError("");
    setTagInput("");
  };

  const handleSaveSystem = async () => {
    setSysSaving(true);
    setSysError("");
    try {
      if (teamSystem) {
        await api.put(`/hockey-os/team-systems/${teamSystem.id}`, sysForm);
      } else {
        await api.post("/hockey-os/team-systems", sysForm);
      }
      setSysEditing(false);
      setTagInput("");
      await loadData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed to save system";
      setSysError(msg);
    } finally {
      setSysSaving(false);
    }
  };

  const handleDeleteSystem = async () => {
    if (!teamSystem) return;
    if (!confirm("Delete this team system profile? This cannot be undone.")) return;
    try {
      await api.delete(`/hockey-os/team-systems/${teamSystem.id}`);
      setSysEditing(false);
      setTagInput("");
      await loadData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed to delete";
      setSysError(msg);
    }
  };

  const addTag = () => {
    const tag = tagInput.trim();
    if (tag && !sysForm.identity_tags.includes(tag)) {
      setSysForm({ ...sysForm, identity_tags: [...sysForm.identity_tags, tag] });
    }
    setTagInput("");
  };

  const removeTag = (tag: string) => {
    setSysForm({ ...sysForm, identity_tags: sysForm.identity_tags.filter((t) => t !== tag) });
  };

  // ── Logo upload ───────────────────────────────────────
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !teamRef) return;
    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const { data } = await api.post<{ logo_url: string }>(`/teams/${teamRef.id}/logo`, formData);
      setTeamRef((prev) => prev ? { ...prev, logo_url: data.logo_url } : prev);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed to upload logo";
      alert(msg);
    } finally {
      setUploadingLogo(false);
      e.target.value = "";
    }
  };

  // ── HockeyTech Sync Handlers ───────────────────────────
  const handleSyncStats = async () => {
    if (!htInfo?.hockeytech_team_id || !htInfo?.hockeytech_league) return;
    setSyncingStats(true);
    setSyncResult(null);
    try {
      const { data } = await api.post(`/hockeytech/${htInfo.hockeytech_league}/sync-stats/${htInfo.hockeytech_team_id}`);
      setSyncResult(`Stats synced: ${data.synced_skaters} skaters, ${data.synced_goalies} goalies, ${data.snapshots_created} snapshots`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } }; message?: string })?.response?.data?.detail || "Sync failed";
      setSyncResult(`Error: ${msg}`);
    } finally {
      setSyncingStats(false);
    }
  };

  const handleSyncGameLogs = async () => {
    if (!htInfo?.hockeytech_team_id || !htInfo?.hockeytech_league) return;
    setSyncingGameLogs(true);
    setSyncResult(null);
    try {
      const { data } = await api.post(`/hockeytech/${htInfo.hockeytech_league}/sync-team-gamelogs/${htInfo.hockeytech_team_id}`);
      setSyncResult(`Game logs synced: ${data.players_synced} players, ${data.total_games} games${data.errors?.length ? ` (${data.errors.length} errors)` : ""}`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } }; message?: string })?.response?.data?.detail || "Sync failed";
      setSyncResult(`Error: ${msg}`);
    } finally {
      setSyncingGameLogs(false);
    }
  };

  // ── Roster grouping (filtered + sorted) ─────────────────
  const filteredRoster = roster
    .filter(p => rosterPosFilter === "all" || posGroup(p.position) === rosterPosFilter)
    .filter(p => !rosterSearch || `${p.first_name} ${p.last_name}`.toLowerCase().includes(rosterSearch.toLowerCase()))
    .sort((a, b) => {
      if (rosterSort === "pts") return (b.stats?.p ?? -1) - (a.stats?.p ?? -1);
      if (rosterSort === "gp") return (b.stats?.gp ?? -1) - (a.stats?.gp ?? -1);
      if (rosterSort === "youngest") return (b.dob || "").localeCompare(a.dob || "");
      return a.last_name.localeCompare(b.last_name);
    });

  const forwards = filteredRoster.filter(p => posGroup(p.position) === "forwards");
  const defense = filteredRoster.filter(p => posGroup(p.position) === "defense");
  const goalies = filteredRoster.filter(p => posGroup(p.position) === "goalies");
  const other = filteredRoster.filter(p => posGroup(p.position) === "other");

  // ── Loading state ───────────────────────────────────────
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

  return (
    <ProtectedRoute>
      <NavBar />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <Link href="/teams" className="flex items-center gap-1 text-sm text-muted hover:text-navy mb-6">
          <ArrowLeft size={14} /> Back to Teams
        </Link>

        {/* Team Header */}
        <div className="bg-gradient-to-br from-navy to-navy-light rounded-xl p-6 text-white mb-1">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              {/* Team Logo */}
              <div className="relative group shrink-0">
                {teamRef?.logo_url ? (
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg overflow-hidden border-2 border-white/20 bg-white/10">
                    <img
                      src={assetUrl(teamRef.logo_url)}
                      alt={teamName}
                      className="w-full h-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg bg-white/10 flex items-center justify-center border border-white/10">
                    {teamRef?.abbreviation ? (
                      <span className="font-oswald font-bold text-lg text-white">{teamRef.abbreviation}</span>
                    ) : (
                      <Building2 size={28} className="text-white/50" />
                    )}
                  </div>
                )}
                {teamRef && (
                  <label className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-lg opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                    <Camera size={16} className="text-white" />
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/svg+xml"
                      onChange={handleLogoUpload}
                      disabled={uploadingLogo}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
              <div>
                <h1 className="text-2xl font-bold">{teamName}</h1>
                <div className="flex items-center gap-3 mt-1.5 text-sm text-white/70">
                  {(teamRef?.league || roster[0]?.current_league) && (
                    <span className="px-2 py-0.5 bg-teal/20 text-teal rounded font-oswald font-bold text-xs">
                      {formatLeague(teamRef?.league || roster[0]?.current_league)}
                    </span>
                  )}
                  {teamRef?.city && <span>{teamRef.city}</span>}
                  {teamSystem?.season && (
                    <span className="text-white/50">{teamSystem.season}</span>
                  )}
                  {teamIntel?.playing_style && (
                    <span className="px-2 py-0.5 bg-orange/20 text-orange rounded font-oswald font-bold text-xs">
                      {teamIntel.playing_style}
                    </span>
                  )}
                </div>
                <p className="text-xs text-white/50 mt-1">
                  {roster.length} players &middot; {reports.length} reports
                  {lineCombinations.length > 0 && <> &middot; {lineCombinations.length} line combos</>}
                </p>
              </div>
            </div>
            {/* Right side — Record + Actions */}
            <div className="text-right flex flex-col items-end gap-2">
              {teamGames.length > 0 && (() => {
                const w = teamGames.filter(g => g.result === "W").length;
                const l = teamGames.filter(g => g.result === "L").length;
                const t = teamGames.filter(g => g.result === "T").length;
                const pts = w * 2 + t;
                return (
                  <div className="flex items-baseline gap-3">
                    <span className="font-oswald text-2xl font-bold text-white">{w}-{l}-{t}</span>
                    <span className="font-oswald text-sm font-bold text-teal">{pts} PTS</span>
                  </div>
                );
              })()}
              <div className="flex gap-2">
                <Link href={`/reports/generate?team=${encodeURIComponent(teamName)}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-oswald uppercase tracking-wider rounded-lg bg-teal text-white hover:opacity-90 transition-opacity">
                  <FileText size={11} /> Generate Report
                </Link>
                <Link href={`/game-plans/new?team=${encodeURIComponent(teamName)}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-oswald uppercase tracking-wider rounded-lg bg-white/[0.08] text-white/70 border border-white/10 hover:bg-white/[0.12] hover:text-white transition-colors">
                  <Swords size={11} /> Game Plan
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="ice-stripe mb-6 rounded-b-full" />

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 text-sm">{error}</div>
        )}

        {/* HockeyTech Sync Bar — above tabs, visible on all tabs */}
        {htInfo && (htInfo.linked || htInfo.has_ht_players) && (
          <div className="mb-2 p-3 rounded-lg bg-gradient-to-r from-teal/[0.04] to-navy/[0.02] border border-teal/15">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Activity size={14} className="text-teal" />
                <span className="text-[10px] font-oswald uppercase tracking-wider text-teal font-bold">League Hub</span>
                {htInfo.hockeytech_league && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-navy/[0.06] text-navy/60 font-oswald uppercase">
                    {htInfo.hockeytech_league}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSyncStats}
                  disabled={syncingStats || !htInfo.linked}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-oswald uppercase tracking-wider rounded-lg bg-teal/10 text-teal hover:bg-teal/20 border border-teal/20 transition-colors disabled:opacity-40"
                  title={!htInfo.linked ? "Sync roster from League Hub first to enable stats sync" : ""}
                >
                  <RefreshCw size={11} className={syncingStats ? "animate-spin" : ""} />
                  {syncingStats ? "Syncing..." : "Sync Stats"}
                </button>
                <button
                  onClick={handleSyncGameLogs}
                  disabled={syncingGameLogs || !htInfo.linked}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-oswald uppercase tracking-wider rounded-lg bg-navy/[0.06] text-navy/70 hover:bg-navy/[0.1] border border-navy/10 transition-colors disabled:opacity-40"
                  title={!htInfo.linked ? "Sync roster from League Hub first to enable game log sync" : ""}
                >
                  <RefreshCw size={11} className={syncingGameLogs ? "animate-spin" : ""} />
                  {syncingGameLogs ? "Syncing..." : "Sync Game Logs"}
                </button>
              </div>
            </div>
            {syncResult && (
              <p className={`mt-2 text-xs ${syncResult.startsWith("Error") ? "text-red-600" : "text-green-700"}`}>
                {syncResult}
              </p>
            )}
          </div>
        )}
        {htInfo && !htInfo.linked && htInfo.has_ht_players && (
          <div className="mb-2 p-3 rounded-lg bg-teal/[0.04] border border-teal/15 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity size={14} className="text-teal" />
              <span className="text-[10px] font-oswald uppercase tracking-wider text-teal font-bold">League Hub</span>
              <span className="text-[10px] text-muted">Team not linked — sync roster from League Hub to enable stats sync</span>
            </div>
            <Link href="/leagues" className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-oswald uppercase tracking-wider rounded-lg bg-teal/10 text-teal hover:bg-teal/20 border border-teal/20 transition-colors">
              <RefreshCw size={11} /> Go to League Hub
            </Link>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-teal/20">
          {([
            { key: "roster" as Tab, label: "Roster", icon: Users, count: roster.length },
            { key: "identity" as Tab, label: "Identity", icon: Brain, count: null },
            { key: "lines" as Tab, label: "Lines", icon: Layers, count: null },
            { key: "systems" as Tab, label: "Systems", icon: Shield, count: null },
            { key: "reports" as Tab, label: "Reports", icon: FileText, count: reports.length },
            { key: "stats" as Tab, label: "Stats", icon: BarChart3, count: null },
            { key: "games" as Tab, label: "Games", icon: Calendar, count: teamGames.length || null },
          ]).map(({ key, label, icon: Icon, count }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-oswald uppercase tracking-wider border-b-2 transition-colors ${
                activeTab === key
                  ? "border-teal text-teal font-semibold"
                  : "border-transparent text-muted hover:text-navy"
              }`}
            >
              <Icon size={14} />
              {label}
              {count !== null && <span className="text-xs opacity-60">({count})</span>}
            </button>
          ))}
        </div>

        {/* Team Identity Summary — visible on all tabs */}
        {teamIntel && teamIntel.version > 0 && teamIntel.playing_style && teamIntel.playing_style !== "Analysis Pending" && (
          <div className="bg-white rounded-xl border border-border overflow-hidden my-4">
            <div className="bg-gradient-to-r from-navy/[0.03] to-teal/[0.03] px-5 py-2.5 border-b border-border/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Brain size={14} className="text-teal" />
                <span className="font-oswald text-[10px] font-bold uppercase tracking-wider text-navy">Team Identity</span>
                <span className="text-[8px] px-1.5 py-0.5 rounded bg-teal/10 text-teal font-oswald font-semibold">v{teamIntel.version}</span>
              </div>
              <button onClick={() => setActiveTab("identity")} className="text-[10px] text-teal font-oswald uppercase tracking-wider font-semibold hover:underline">
                View Full Report →
              </button>
            </div>
            <div className="p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Col 1: Style + Tags */}
              <div>
                <p className="font-oswald text-[9px] uppercase tracking-wider text-muted mb-1.5">Playing Style</p>
                <span className="inline-flex px-3 py-1 rounded-lg bg-navy/[0.05] border border-navy/[0.08] text-sm font-semibold text-navy">
                  {teamIntel.playing_style}
                </span>
                {teamIntel.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {teamIntel.tags.slice(0, 4).map((tag, i) => (
                      <span key={i} className="px-2 py-0.5 rounded-full bg-teal/[0.07] text-teal text-[9px] font-oswald font-semibold uppercase tracking-wider">{tag}</span>
                    ))}
                  </div>
                )}
              </div>
              {/* Col 2: Summary */}
              <div>
                <p className="font-oswald text-[9px] uppercase tracking-wider text-muted mb-1.5">Summary</p>
                {teamIntel.system_summary && (
                  <p className="text-[11px] text-navy/65 leading-relaxed italic border-l-2 border-teal/30 pl-2.5 line-clamp-3">
                    {teamIntel.system_summary}
                  </p>
                )}
              </div>
              {/* Col 3: Strengths / Vulnerabilities */}
              <div>
                {teamIntel.strengths.length > 0 && (
                  <>
                    <p className="font-oswald text-[9px] uppercase tracking-wider text-muted mb-1">Strengths</p>
                    {teamIntel.strengths.slice(0, 3).map((s, i) => (
                      <div key={i} className="flex items-start gap-1.5 text-[11px] text-navy/70 py-0.5">
                        <span className="w-1 h-1 rounded-full bg-teal mt-1.5 shrink-0" />{s}
                      </div>
                    ))}
                  </>
                )}
                {teamIntel.vulnerabilities.length > 0 && (
                  <>
                    <p className="font-oswald text-[9px] uppercase tracking-wider text-muted mb-1 mt-2">Vulnerabilities</p>
                    {teamIntel.vulnerabilities.slice(0, 2).map((v, i) => (
                      <div key={i} className="flex items-start gap-1.5 text-[11px] text-navy/70 py-0.5">
                        <span className="w-1 h-1 rounded-full bg-orange mt-1.5 shrink-0" />{v}
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Roster Tab ─────────────────────────────────── */}
        {activeTab === "roster" && (
          <section>
            {roster.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl border border-teal/20">
                <Users size={32} className="mx-auto text-muted/40 mb-3" />
                <p className="text-muted text-sm">No players assigned to this team.</p>
                <Link href="/players/new" className="inline-block mt-3 text-sm text-teal hover:underline">
                  + Add a player
                </Link>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Filter Bar */}
                <div className="flex items-center gap-3 mb-3 flex-wrap">
                  <input
                    type="text" placeholder="Search players..."
                    value={rosterSearch} onChange={e => setRosterSearch(e.target.value)}
                    className="flex-1 min-w-[180px] max-w-[280px] px-3 py-1.5 border border-border rounded-lg text-xs bg-white"
                  />
                  <div className="flex gap-1">
                    {(["all", "forwards", "defense", "goalies"] as const).map(f => (
                      <button key={f} onClick={() => setRosterPosFilter(f)}
                        className={`px-3 py-1.5 rounded-md font-oswald text-[10px] uppercase tracking-wider transition-colors ${
                          rosterPosFilter === f ? "bg-navy text-white" : "bg-white border border-border text-muted hover:text-navy"
                        }`}
                      >{f === "all" ? "All" : f === "forwards" ? "FWD" : f === "defense" ? "DEF" : "G"}</button>
                    ))}
                  </div>
                  <div className="ml-auto flex items-center gap-1.5 text-[10px] text-muted">
                    Sort:
                    <select value={rosterSort} onChange={e => setRosterSort(e.target.value as typeof rosterSort)}
                      className="font-oswald text-[10px] uppercase tracking-wider border border-border rounded px-2 py-1 bg-white text-navy cursor-pointer">
                      <option value="name">Name A-Z</option>
                      <option value="pts">PTS ↓</option>
                      <option value="gp">GP ↓</option>
                      <option value="youngest">Youngest</option>
                    </select>
                  </div>
                </div>

                {/* Skaters (Forwards + Defense) */}
                {[
                  { label: "Forwards", players: forwards },
                  { label: "Defense", players: defense },
                  ...(other.length > 0 ? [{ label: "Other", players: other }] : []),
                ].filter((g) => g.players.length > 0).map(({ label, players }) => (
                  <div key={label}>
                    <h3 className="text-xs font-oswald uppercase tracking-wider text-muted mb-2 flex items-center gap-2">
                      {label} <span className="text-navy font-bold">({players.length})</span>
                    </h3>
                    <div className="bg-white rounded-xl border border-teal/20 overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-navy/[0.03] border-b border-teal/20">
                            <th className="px-2 py-2 text-center font-oswald text-[10px] uppercase tracking-wider text-muted w-10">#</th>
                            <th className="px-3 py-2 text-left font-oswald text-[10px] uppercase tracking-wider text-muted">Player</th>
                            <th className="px-2 py-2 text-center font-oswald text-[10px] uppercase tracking-wider text-muted w-12">POS</th>
                            <th className="px-2 py-2 text-center font-oswald text-[10px] uppercase tracking-wider text-muted w-20">DOB</th>
                            <th className="px-2 py-2 text-center font-oswald text-[10px] uppercase tracking-wider text-muted w-12">HT</th>
                            <th className="px-2 py-2 text-center font-oswald text-[10px] uppercase tracking-wider text-muted w-12">WT</th>
                            <th className="px-2 py-2 text-center font-oswald text-[10px] uppercase tracking-wider text-muted w-10">SH</th>
                            <th className="px-2 py-2 text-center font-oswald text-[10px] uppercase tracking-wider text-muted w-10">GP</th>
                            <th className="px-2 py-2 text-center font-oswald text-[10px] uppercase tracking-wider text-muted w-10">G</th>
                            <th className="px-2 py-2 text-center font-oswald text-[10px] uppercase tracking-wider text-muted w-10">A</th>
                            <th className="px-2 py-2 text-center font-oswald text-[10px] uppercase tracking-wider text-muted w-10">PTS</th>
                            <th className="px-2 py-2 text-left font-oswald text-[10px] uppercase tracking-wider text-muted">Draft</th>
                            <th className="px-2 py-2 text-left font-oswald text-[10px] uppercase tracking-wider text-muted">Archetype</th>
                            <th className="px-2 py-2 text-center font-oswald text-[10px] uppercase tracking-wider text-muted w-16">Status</th>
                            <th className="px-2 py-2 text-right font-oswald text-[10px] uppercase tracking-wider text-muted w-14"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {players.map((p) => (
                            <tr key={p.id} className="border-b border-teal/10 hover:bg-navy/[0.02] transition-colors">
                              <td className="px-2 py-2 text-center text-xs text-muted">{p.jersey_number || "\u2014"}</td>
                              <td className="px-3 py-2">
                                <Link href={`/players/${p.id}`} className="font-semibold text-navy hover:text-teal transition-colors text-xs">
                                  {hasRealImage(p.image_url) ? (
                                    <span className="inline-flex items-center gap-1.5">
                                      <img src={assetUrl(p.image_url)} alt="" className="w-6 h-6 rounded-full object-cover" />
                                      {p.last_name}, {p.first_name}
                                    </span>
                                  ) : (
                                    <>{p.last_name}, {p.first_name}</>
                                  )}
                                </Link>
                              </td>
                              <td className="px-2 py-2 text-center">
                                <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold bg-teal/10 text-teal font-oswald">{p.position}</span>
                              </td>
                              <td className="px-2 py-2 text-center text-[10px] text-muted">{formatDob(p.dob, p.birth_year)}</td>
                              <td className="px-2 py-2 text-center text-[10px] text-muted">{formatHeight(p.height_cm)}</td>
                              <td className="px-2 py-2 text-center text-[10px] text-muted">{formatWeight(p.weight_kg)}</td>
                              <td className="px-2 py-2 text-center text-[10px] text-muted">{p.shoots || "\u2014"}</td>
                              <td className="px-2 py-2 text-center text-xs font-semibold">{p.stats?.gp ?? "\u2014"}</td>
                              <td className="px-2 py-2 text-center text-xs">{p.stats?.g ?? "\u2014"}</td>
                              <td className="px-2 py-2 text-center text-xs">{p.stats?.a ?? "\u2014"}</td>
                              <td className="px-2 py-2 text-center text-xs font-bold text-navy">{p.stats?.p ?? "\u2014"}</td>
                              <td className="px-2 py-2 text-[10px] text-muted">{getDraftInfo(p)}</td>
                              <td className="px-2 py-2 text-[10px] text-muted">{p.archetype || "\u2014"}</td>
                              <td className="px-2 py-2 text-center">
                                <select
                                  value={p.roster_status || "active"}
                                  onChange={async (e) => {
                                    const ns = e.target.value;
                                    try {
                                      await api.patch(`/players/${p.id}`, { roster_status: ns });
                                      setRoster((prev) => prev.map((pl) => pl.id === p.id ? { ...pl, roster_status: ns } : pl));
                                    } catch { /* ignore */ }
                                  }}
                                  className={`text-[9px] font-oswald font-bold bg-transparent border rounded px-1 py-0.5 cursor-pointer ${
                                    (p.roster_status || "active") === "active" ? "text-green-600 border-green-200" :
                                    (p.roster_status || "active") === "ap" ? "text-blue-600 border-blue-200 bg-blue-50" :
                                    (p.roster_status || "active") === "inj" ? "text-red-600 border-red-200 bg-red-50" :
                                    (p.roster_status || "active") === "susp" ? "text-purple-600 border-purple-200 bg-purple-50" :
                                    (p.roster_status || "active") === "scrch" ? "text-gray-500 border-gray-200 bg-gray-50" :
                                    "text-gray-600"
                                  }`}
                                >
                                  {[
                                    { v: "active", l: "Active" }, { v: "ap", l: "AP" }, { v: "inj", l: "INJ" },
                                    { v: "susp", l: "SUSP" }, { v: "scrch", l: "SCRCH" },
                                  ].map(s => <option key={s.v} value={s.v}>{s.l}</option>)}
                                </select>
                              </td>
                              <td className="px-2 py-2 text-right">
                                <Link href={`/reports/generate?player=${p.id}`} className="text-[10px] text-teal hover:underline">Report</Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}

                {/* Goalies — separate table with goalie stats */}
                {goalies.length > 0 && (
                  <div>
                    <h3 className="text-xs font-oswald uppercase tracking-wider text-muted mb-2 flex items-center gap-2">
                      Goalies <span className="text-navy font-bold">({goalies.length})</span>
                    </h3>
                    <div className="bg-white rounded-xl border border-teal/20 overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-navy/[0.03] border-b border-teal/20">
                            <th className="px-2 py-2 text-center font-oswald text-[10px] uppercase tracking-wider text-muted w-10">#</th>
                            <th className="px-3 py-2 text-left font-oswald text-[10px] uppercase tracking-wider text-muted">Player</th>
                            <th className="px-2 py-2 text-center font-oswald text-[10px] uppercase tracking-wider text-muted w-12">POS</th>
                            <th className="px-2 py-2 text-center font-oswald text-[10px] uppercase tracking-wider text-muted w-20">DOB</th>
                            <th className="px-2 py-2 text-center font-oswald text-[10px] uppercase tracking-wider text-muted w-12">HT</th>
                            <th className="px-2 py-2 text-center font-oswald text-[10px] uppercase tracking-wider text-muted w-12">WT</th>
                            <th className="px-2 py-2 text-center font-oswald text-[10px] uppercase tracking-wider text-muted w-10">C/SH</th>
                            <th className="px-2 py-2 text-center font-oswald text-[10px] uppercase tracking-wider text-muted w-10">GP</th>
                            <th className="px-2 py-2 text-center font-oswald text-[10px] uppercase tracking-wider text-muted w-10">GA</th>
                            <th className="px-2 py-2 text-center font-oswald text-[10px] uppercase tracking-wider text-muted w-10">SV</th>
                            <th className="px-2 py-2 text-center font-oswald text-[10px] uppercase tracking-wider text-muted w-14">GAA</th>
                            <th className="px-2 py-2 text-center font-oswald text-[10px] uppercase tracking-wider text-muted w-14">SV%</th>
                            <th className="px-2 py-2 text-left font-oswald text-[10px] uppercase tracking-wider text-muted">Draft</th>
                            <th className="px-2 py-2 text-left font-oswald text-[10px] uppercase tracking-wider text-muted">Archetype</th>
                            <th className="px-2 py-2 text-center font-oswald text-[10px] uppercase tracking-wider text-muted w-16">Status</th>
                            <th className="px-2 py-2 text-right font-oswald text-[10px] uppercase tracking-wider text-muted w-14"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {goalies.map((p) => (
                            <tr key={p.id} className="border-b border-teal/10 hover:bg-navy/[0.02] transition-colors">
                              <td className="px-2 py-2 text-center text-xs text-muted">{p.jersey_number || "\u2014"}</td>
                              <td className="px-3 py-2">
                                <Link href={`/players/${p.id}`} className="font-semibold text-navy hover:text-teal transition-colors text-xs">
                                  {hasRealImage(p.image_url) ? (
                                    <span className="inline-flex items-center gap-1.5">
                                      <img src={assetUrl(p.image_url)} alt="" className="w-6 h-6 rounded-full object-cover" />
                                      {p.last_name}, {p.first_name}
                                    </span>
                                  ) : (
                                    <>{p.last_name}, {p.first_name}</>
                                  )}
                                </Link>
                              </td>
                              <td className="px-2 py-2 text-center">
                                <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold bg-teal/10 text-teal font-oswald">{p.position}</span>
                              </td>
                              <td className="px-2 py-2 text-center text-[10px] text-muted">{formatDob(p.dob, p.birth_year)}</td>
                              <td className="px-2 py-2 text-center text-[10px] text-muted">{formatHeight(p.height_cm)}</td>
                              <td className="px-2 py-2 text-center text-[10px] text-muted">{formatWeight(p.weight_kg)}</td>
                              <td className="px-2 py-2 text-center text-[10px] text-muted">{p.shoots || "\u2014"}</td>
                              <td className="px-2 py-2 text-center text-xs font-semibold">{p.goalie_stats?.gp ?? "\u2014"}</td>
                              <td className="px-2 py-2 text-center text-xs">{p.goalie_stats?.ga ?? "\u2014"}</td>
                              <td className="px-2 py-2 text-center text-xs">{p.goalie_stats?.sv ?? "\u2014"}</td>
                              <td className="px-2 py-2 text-center text-xs">{p.goalie_stats?.gaa != null ? Number(p.goalie_stats.gaa).toFixed(2) : "\u2014"}</td>
                              <td className="px-2 py-2 text-center text-xs">{p.goalie_stats?.sv_pct != null ? p.goalie_stats.sv_pct : "\u2014"}</td>
                              <td className="px-2 py-2 text-[10px] text-muted">{getDraftInfo(p)}</td>
                              <td className="px-2 py-2 text-[10px] text-muted">{p.archetype || "\u2014"}</td>
                              <td className="px-2 py-2 text-center">
                                <select
                                  value={p.roster_status || "active"}
                                  onChange={async (e) => {
                                    const ns = e.target.value;
                                    try {
                                      await api.patch(`/players/${p.id}`, { roster_status: ns });
                                      setRoster((prev) => prev.map((pl) => pl.id === p.id ? { ...pl, roster_status: ns } : pl));
                                    } catch { /* ignore */ }
                                  }}
                                  className={`text-[9px] font-oswald font-bold bg-transparent border rounded px-1 py-0.5 cursor-pointer ${
                                    (p.roster_status || "active") === "active" ? "text-green-600 border-green-200" :
                                    (p.roster_status || "active") === "ap" ? "text-blue-600 border-blue-200 bg-blue-50" :
                                    (p.roster_status || "active") === "inj" ? "text-red-600 border-red-200 bg-red-50" :
                                    (p.roster_status || "active") === "susp" ? "text-purple-600 border-purple-200 bg-purple-50" :
                                    (p.roster_status || "active") === "scrch" ? "text-gray-500 border-gray-200 bg-gray-50" :
                                    "text-gray-600"
                                  }`}
                                >
                                  {[
                                    { v: "active", l: "Active" }, { v: "ap", l: "AP" }, { v: "inj", l: "INJ" },
                                    { v: "susp", l: "SUSP" }, { v: "scrch", l: "SCRCH" },
                                  ].map(s => <option key={s.v} value={s.v}>{s.l}</option>)}
                                </select>
                              </td>
                              <td className="px-2 py-2 text-right">
                                <Link href={`/reports/generate?player=${p.id}`} className="text-[10px] text-teal hover:underline">Report</Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-4">
                  <Link
                    href="/players/new"
                    className="flex items-center gap-2 text-sm text-teal hover:underline"
                  >
                    <PlusCircle size={14} />
                    Add Player to Team
                  </Link>
                  <Link
                    href={`/teams/${encodeURIComponent(teamName)}/import`}
                    className="flex items-center gap-2 text-sm text-orange hover:underline"
                  >
                    <Upload size={14} />
                    Import Roster CSV
                  </Link>
                </div>
              </div>
            )}
          </section>
        )}

        {/* ── Identity Tab ──────────────────────────────── */}
        {activeTab === "identity" && (
          <section className="space-y-4">
            {teamIntel && teamIntel.version > 0 ? (
              <>
                {/* Header */}
                <div className="bg-white rounded-xl border border-teal/20 overflow-hidden">
                  <div className="bg-gradient-to-r from-navy/[0.04] to-teal/[0.04] px-5 py-3 border-b border-teal/10 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Brain size={16} className="text-teal" />
                      <h3 className="text-sm font-oswald uppercase tracking-wider text-navy">Team Identity</h3>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal/10 text-teal font-medium">v{teamIntel.version}</span>
                      {teamIntel.trigger && (
                        <span className="text-[10px] text-muted/50">via {teamIntel.trigger}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {teamIntel.created_at && (
                        <span className="text-[10px] text-muted/50">
                          {new Date(teamIntel.created_at).toLocaleDateString()}
                        </span>
                      )}
                      <button
                        onClick={async () => {
                          setRefreshingIntel(true);
                          try {
                            const { data } = await api.post<TeamIntelligence>(`/teams/${encodeURIComponent(teamName)}/intelligence`);
                            setTeamIntel(data);
                          } catch (err: unknown) {
                            const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed to refresh";
                            alert(msg);
                          } finally {
                            setRefreshingIntel(false);
                          }
                        }}
                        disabled={refreshingIntel}
                        className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-oswald uppercase tracking-wider rounded-lg border border-teal/30 text-teal hover:bg-teal/10 transition-colors disabled:opacity-50"
                      >
                        <RefreshCw size={10} className={refreshingIntel ? "animate-spin" : ""} />
                        {refreshingIntel ? "Analyzing..." : "Refresh"}
                      </button>
                    </div>
                  </div>

                  <div className="p-5 space-y-5">
                    {/* Playing Style Badge + Tags */}
                    {teamIntel.playing_style && (
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="px-3 py-1.5 rounded-lg bg-navy/[0.06] border border-navy/10 text-sm font-semibold text-navy">
                          {teamIntel.playing_style}
                        </span>
                        {teamIntel.tags.map((tag, i) => (
                          <span key={i} className="px-2 py-0.5 rounded-full bg-teal/10 text-teal text-[10px] font-oswald uppercase tracking-wider">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* System Summary */}
                    {teamIntel.system_summary && (
                      <p className="text-sm text-navy/70 italic border-l-2 border-teal/30 pl-3">
                        {teamIntel.system_summary}
                      </p>
                    )}

                    {/* Identity Description */}
                    {teamIntel.identity && (
                      <div className="text-sm text-navy/80 leading-relaxed whitespace-pre-line">
                        {teamIntel.identity}
                      </div>
                    )}
                  </div>
                </div>

                {/* Strengths & Vulnerabilities */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {teamIntel.strengths.length > 0 && (
                    <div className="bg-white rounded-xl border border-teal/20 p-5">
                      <h4 className="text-sm font-oswald uppercase tracking-wider text-navy mb-3 flex items-center gap-2">
                        <Star size={14} className="text-teal" /> Strengths
                      </h4>
                      <ul className="space-y-2">
                        {teamIntel.strengths.map((s, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-navy/80">
                            <TrendingUp size={12} className="text-teal mt-0.5 shrink-0" />
                            {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {teamIntel.vulnerabilities.length > 0 && (
                    <div className="bg-white rounded-xl border border-teal/20 p-5">
                      <h4 className="text-sm font-oswald uppercase tracking-wider text-navy mb-3 flex items-center gap-2">
                        <AlertTriangle size={14} className="text-orange" /> Vulnerabilities
                      </h4>
                      <ul className="space-y-2">
                        {teamIntel.vulnerabilities.map((v, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-navy/80">
                            <AlertTriangle size={12} className="text-orange mt-0.5 shrink-0" />
                            {v}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Key Personnel */}
                {teamIntel.key_personnel.length > 0 && (
                  <div className="bg-white rounded-xl border border-teal/20 p-5">
                    <h4 className="text-sm font-oswald uppercase tracking-wider text-navy mb-3 flex items-center gap-2">
                      <Users size={14} className="text-navy" /> Key Personnel
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {teamIntel.key_personnel.map((kp, i) => (
                        <div key={i} className="p-3 rounded-lg bg-navy/[0.03] border border-teal/10">
                          <p className="text-sm font-semibold text-navy">{kp.name}</p>
                          <p className="text-xs text-muted mt-0.5">{kp.role}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Special Teams + Player Fit */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {teamIntel.special_teams_identity && (
                    <div className="bg-white rounded-xl border border-teal/20 p-5">
                      <h4 className="text-sm font-oswald uppercase tracking-wider text-navy mb-3 flex items-center gap-2">
                        <Zap size={14} className="text-orange" /> Special Teams
                      </h4>
                      <p className="text-sm text-navy/80 leading-relaxed">{teamIntel.special_teams_identity}</p>
                    </div>
                  )}

                  {teamIntel.player_archetype_fit && (
                    <div className="bg-white rounded-xl border border-teal/20 p-5">
                      <h4 className="text-sm font-oswald uppercase tracking-wider text-navy mb-3 flex items-center gap-2">
                        <Target size={14} className="text-teal" /> Ideal Player Fit
                      </h4>
                      <p className="text-sm text-navy/80 leading-relaxed">{teamIntel.player_archetype_fit}</p>
                    </div>
                  )}
                </div>

                {/* Comparable Teams */}
                {teamIntel.comparable_teams.length > 0 && (
                  <div className="bg-white rounded-xl border border-teal/20 p-5">
                    <h4 className="text-sm font-oswald uppercase tracking-wider text-navy mb-3">Comparable Teams</h4>
                    <div className="flex gap-2 flex-wrap">
                      {teamIntel.comparable_teams.map((ct, i) => (
                        <span key={i} className="px-3 py-1 rounded-full bg-navy/[0.05] text-sm text-navy font-medium">
                          {ct}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              /* Generate CTA */
              <div className="bg-gradient-to-r from-navy/[0.02] to-teal/[0.02] rounded-xl border border-dashed border-teal/30 p-8 text-center">
                <Brain size={36} className="mx-auto text-teal/40 mb-3" />
                <h3 className="text-lg font-semibold text-navy mb-2">Team Identity Report</h3>
                <p className="text-sm text-navy/70 mb-4 max-w-md mx-auto">
                  Generate an AI-powered team identity profile analyzing playing style, strengths, vulnerabilities, and key personnel.
                </p>
                <button
                  onClick={async () => {
                    setRefreshingIntel(true);
                    try {
                      const { data } = await api.post<TeamIntelligence>(`/teams/${encodeURIComponent(teamName)}/intelligence`);
                      setTeamIntel(data);
                    } catch (err: unknown) {
                      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed to generate team identity";
                      alert(msg);
                    } finally {
                      setRefreshingIntel(false);
                    }
                  }}
                  disabled={refreshingIntel}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-teal text-white text-sm font-oswald uppercase tracking-wider rounded-lg hover:bg-teal/90 transition-colors disabled:opacity-50"
                >
                  <Brain size={16} />
                  {refreshingIntel ? "Analyzing Team..." : "Generate Team Identity"}
                </button>
              </div>
            )}
          </section>
        )}

        {/* ── Lines Tab ──────────────────────────────────── */}
        {activeTab === "lines" && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Layers size={18} className="text-orange" />
              <h2 className="text-lg font-semibold text-navy">Line Combinations</h2>
              <span className="text-xs text-muted ml-1">Assign players to lines, pairs, and special teams</span>
            </div>
            <LineBuilder
              teamName={teamName}
              season="2025-26"
              roster={roster}
              existingLines={lineCombinations}
              onLinesChanged={loadData}
            />
          </section>
        )}

        {/* ── Systems Tab ────────────────────────────────── */}
        {activeTab === "systems" && (
          <section>
            {sysError && (
              <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                {sysError}
                <button onClick={() => setSysError("")} className="ml-2 text-red-500">&times;</button>
              </div>
            )}

            {/* ── Editing / Creating form ────────────────── */}
            {sysEditing ? (
              <div className="bg-white rounded-xl border border-teal/20 overflow-hidden">
                <div className="bg-gradient-to-r from-navy to-navy-light px-6 py-4 flex items-center justify-between">
                  <h2 className="text-lg font-oswald font-semibold text-white uppercase tracking-wider">
                    {teamSystem ? "Edit Team System" : "Create Team System"}
                  </h2>
                  <button onClick={cancelEditSystem} className="text-white/60 hover:text-white">
                    <X size={18} />
                  </button>
                </div>
                <div className="ice-stripe" />

                <div className="p-6 space-y-5">
                  {/* Team name (locked) */}
                  <div>
                    <label className="block text-xs font-oswald uppercase tracking-wider text-muted mb-1.5">Team</label>
                    <input
                      type="text"
                      value={sysForm.team_name}
                      disabled
                      className="w-full px-3 py-2.5 border border-teal/20 rounded-lg text-sm bg-navy/[0.03] text-navy/60 cursor-not-allowed"
                    />
                  </div>

                  {/* Season */}
                  <div>
                    <label className="block text-xs font-oswald uppercase tracking-wider text-muted mb-1.5">Season</label>
                    <input
                      type="text"
                      value={sysForm.season}
                      onChange={(e) => setSysForm({ ...sysForm, season: e.target.value })}
                      placeholder="2025-26"
                      className="w-full px-3 py-2.5 border border-teal/20 rounded-lg text-sm"
                    />
                  </div>

                  <hr className="border-teal/10" />

                  {/* System dropdowns */}
                  <SystemSelect
                    label="Primary Forecheck"
                    value={sysForm.forecheck}
                    onChange={(v) => setSysForm({ ...sysForm, forecheck: v })}
                    options={getOptions("forecheck")}
                  />
                  <SystemSelect
                    label="Defensive Zone"
                    value={sysForm.dz_structure}
                    onChange={(v) => setSysForm({ ...sysForm, dz_structure: v })}
                    options={getOptions("dz_coverage")}
                  />
                  <SystemSelect
                    label="Offensive Zone"
                    value={sysForm.oz_setup}
                    onChange={(v) => setSysForm({ ...sysForm, oz_setup: v })}
                    options={getOptions("oz_setup")}
                  />
                  <SystemSelect
                    label="Power Play"
                    value={sysForm.pp_formation}
                    onChange={(v) => setSysForm({ ...sysForm, pp_formation: v })}
                    options={getOptions("oz_setup")}
                  />
                  <SystemSelect
                    label="Penalty Kill"
                    value={sysForm.pk_formation}
                    onChange={(v) => setSysForm({ ...sysForm, pk_formation: v })}
                    options={getOptions("pk_formation")}
                  />
                  <SystemSelect
                    label="Breakout"
                    value={sysForm.breakout}
                    onChange={(v) => setSysForm({ ...sysForm, breakout: v })}
                    options={getOptions("breakout")}
                  />

                  <hr className="border-teal/10" />

                  {/* Team Style */}
                  <div>
                    <h3 className="text-sm font-oswald uppercase tracking-wider text-navy mb-4">Team Style</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-oswald uppercase tracking-wider text-muted mb-1.5">Pace</label>
                        <select
                          value={sysForm.pace}
                          onChange={(e) => setSysForm({ ...sysForm, pace: e.target.value })}
                          className="w-full px-3 py-2.5 border border-teal/20 rounded-lg text-sm bg-white"
                        >
                          <option value="">Select...</option>
                          {PACE_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-oswald uppercase tracking-wider text-muted mb-1.5">Physicality</label>
                        <select
                          value={sysForm.physicality}
                          onChange={(e) => setSysForm({ ...sysForm, physicality: e.target.value })}
                          className="w-full px-3 py-2.5 border border-teal/20 rounded-lg text-sm bg-white"
                        >
                          <option value="">Select...</option>
                          {PHYSICALITY_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-oswald uppercase tracking-wider text-muted mb-1.5">Offensive Style</label>
                        <select
                          value={sysForm.offensive_style}
                          onChange={(e) => setSysForm({ ...sysForm, offensive_style: e.target.value })}
                          className="w-full px-3 py-2.5 border border-teal/20 rounded-lg text-sm bg-white"
                        >
                          <option value="">Select...</option>
                          {OFFENSIVE_STYLE_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <hr className="border-teal/10" />

                  {/* Identity Tags */}
                  <div>
                    <label className="block text-xs font-oswald uppercase tracking-wider text-muted mb-1.5">Identity Tags</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addTag();
                          }
                        }}
                        placeholder="Add tag and press Enter..."
                        className="flex-1 px-3 py-2.5 border border-teal/20 rounded-lg text-sm"
                      />
                      <button
                        type="button"
                        onClick={addTag}
                        className="px-3 py-2.5 bg-navy/5 border border-teal/20 rounded-lg text-sm text-navy hover:bg-navy/10 transition-colors"
                      >
                        Add
                      </button>
                    </div>
                    {sysForm.identity_tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {sysForm.identity_tags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-teal/10 text-teal font-medium"
                          >
                            {tag}
                            <button
                              type="button"
                              onClick={() => removeTag(tag)}
                              className="text-teal/60 hover:text-teal"
                            >
                              <X size={10} />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-xs font-oswald uppercase tracking-wider text-muted mb-1.5">Notes</label>
                    <textarea
                      value={sysForm.notes}
                      onChange={(e) => setSysForm({ ...sysForm, notes: e.target.value })}
                      rows={3}
                      placeholder="Additional tactical notes..."
                      className="w-full px-3 py-2.5 border border-teal/20 rounded-lg text-sm resize-none"
                    />
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-3 pt-2">
                    <button
                      onClick={handleSaveSystem}
                      disabled={sysSaving}
                      className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-teal text-white text-sm font-oswald font-semibold uppercase tracking-wider rounded-lg hover:bg-teal/90 disabled:opacity-50 transition-colors"
                    >
                      <Save size={16} />
                      {sysSaving ? "Saving..." : teamSystem ? "Update System" : "Save System"}
                    </button>
                    {teamSystem && (
                      <button
                        onClick={handleDeleteSystem}
                        className="flex items-center justify-center gap-2 px-5 py-3 bg-red-50 text-red-600 text-sm font-oswald font-semibold uppercase tracking-wider rounded-lg hover:bg-red-100 transition-colors"
                      >
                        <Trash2 size={16} />
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : teamSystem ? (
              /* ── Read-only system view ────────────────── */
              <div className="bg-white rounded-xl border border-teal/20 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-oswald uppercase tracking-wider text-muted flex items-center gap-2">
                    <Shield size={14} className="text-navy" /> Team Tactical Profile
                    {teamSystem.season && <span className="text-xs font-normal text-muted/60 ml-1">{teamSystem.season}</span>}
                  </h3>
                  <button
                    onClick={startEditSystem}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-oswald uppercase tracking-wider text-teal border border-teal/30 rounded-lg hover:bg-teal/5 transition-colors"
                  >
                    <Edit3 size={12} />
                    Edit
                  </button>
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

                {/* PP row */}
                {teamSystem.pp_formation && (
                  <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    <div className="p-3 rounded-lg bg-navy/[0.03] border border-teal/10">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Target size={12} className="text-teal" />
                        <span className="text-[10px] font-oswald uppercase tracking-wider text-muted">Power Play</span>
                      </div>
                      <p className="text-xs font-semibold text-navy">{getSystemName(teamSystem.pp_formation)}</p>
                    </div>
                  </div>
                )}

                {/* Team Style */}
                {(teamSystem.pace || teamSystem.physicality || teamSystem.offensive_style) && (
                  <div className="flex flex-wrap gap-2 mt-4">
                    {teamSystem.pace && (
                      <span className="text-xs px-2.5 py-1 rounded bg-orange/[0.06] text-navy/70">
                        <strong>Pace:</strong> {teamSystem.pace}
                      </span>
                    )}
                    {teamSystem.physicality && (
                      <span className="text-xs px-2.5 py-1 rounded bg-orange/[0.06] text-navy/70">
                        <strong>Physical:</strong> {teamSystem.physicality}
                      </span>
                    )}
                    {teamSystem.offensive_style && (
                      <span className="text-xs px-2.5 py-1 rounded bg-orange/[0.06] text-navy/70">
                        <strong>Offense:</strong> {teamSystem.offensive_style}
                      </span>
                    )}
                  </div>
                )}

                {teamSystem.identity_tags && teamSystem.identity_tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {teamSystem.identity_tags.map((tag) => (
                      <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-teal/10 text-teal font-medium">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {teamSystem.notes && (
                  <p className="text-xs text-muted/70 mt-3 italic">{teamSystem.notes}</p>
                )}
              </div>
            ) : (
              /* ── No system yet — prompt to create ──────── */
              <div className="bg-navy/[0.02] rounded-xl border border-dashed border-teal/20 p-8 text-center">
                <Shield size={32} className="mx-auto text-muted/30 mb-3" />
                <p className="text-sm text-muted mb-1">No system profile for <strong>{teamName}</strong></p>
                <p className="text-xs text-muted/60 mb-3">
                  Configure your forecheck, defensive zone, and offensive zone structures.
                </p>
                <button
                  onClick={startCreateSystem}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-teal text-white text-sm font-oswald font-semibold uppercase tracking-wider rounded-lg hover:bg-teal/90 transition-colors"
                >
                  <Shield size={14} />
                  Create Team System Profile
                </button>
              </div>
            )}
          </section>
        )}

        {/* ── Reports Tab ────────────────────────────────── */}
        {activeTab === "reports" && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-navy">Team Reports</h2>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted">{reports.length} total</span>
                <Link
                  href={`/reports/generate?team=${encodeURIComponent(teamName)}`}
                  className="flex items-center gap-2 px-4 py-2 bg-teal text-white text-sm font-oswald font-semibold uppercase tracking-wider rounded-lg hover:bg-teal/90 transition-colors"
                >
                  <FileText size={14} />
                  Generate Team Report
                </Link>
              </div>
            </div>
            {reports.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl border border-teal/20">
                <FileText size={32} className="mx-auto text-muted/40 mb-3" />
                <p className="text-muted text-sm">No reports yet for players on this team.</p>
                <p className="text-xs text-muted/60 mt-1">
                  Generate reports from the roster tab or individual player pages.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {reports.map((r) => (
                  <ReportCard key={r.id} report={r} />
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── Stats Tab ──────────────────────────────────── */}
        {activeTab === "stats" && (
          <section className="space-y-6">
            {/* Team Stats */}
            {teamStats && teamStats.extended_stats && Object.keys(teamStats.extended_stats).length > 0 ? (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-semibold text-navy">Team Statistics</h2>
                  {teamStats.season && (
                    <span className="text-xs text-muted">{teamStats.season}</span>
                  )}
                </div>
                <ExtendedStatTable
                  stats={teamStats.extended_stats}
                  season={teamStats.season}
                  source={teamStats.data_source || undefined}
                />
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-teal/20 p-6 text-center">
                <BarChart3 size={28} className="mx-auto text-muted/30 mb-2" />
                <p className="text-sm text-muted">No team statistics imported yet.</p>
                <p className="text-xs text-muted/60 mt-1">
                  Upload a Teams XLSX export from the{" "}
                  <Link href="/instat" className="text-teal hover:underline">Import Stats</Link> page.
                </p>
              </div>
            )}

          </section>
        )}

        {/* ── Games Tab ──────────────────────────────────── */}
        {activeTab === "games" && (
          <section className="space-y-4">
            {teamGames.length > 0 ? (
              <>
                {/* Record summary */}
                {(() => {
                  const wins = teamGames.filter(g => g.result === "W").length;
                  const losses = teamGames.filter(g => g.result === "L").length;
                  const ties = teamGames.filter(g => g.result === "T").length;
                  return (
                    <div className="flex items-center gap-4 mb-2">
                      <h2 className="text-lg font-semibold text-navy">Season Record</h2>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-oswald font-bold text-green-600">{wins}W</span>
                        <span className="text-muted">-</span>
                        <span className="font-oswald font-bold text-red-500">{losses}L</span>
                        {ties > 0 && (
                          <>
                            <span className="text-muted">-</span>
                            <span className="font-oswald font-bold text-orange">{ties}T</span>
                          </>
                        )}
                        <span className="text-xs text-muted ml-2">({teamGames.length} games)</span>
                      </div>
                    </div>
                  );
                })()}

                {/* Games table */}
                <div className="bg-white rounded-xl border border-teal/20 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-navy/[0.03] text-xs text-muted uppercase tracking-wider">
                          <th className="text-left px-3 py-2.5">Date</th>
                          <th className="text-center px-2 py-2.5 w-10">H/A</th>
                          <th className="text-left px-3 py-2.5">Opponent</th>
                          <th className="text-center px-3 py-2.5">Score</th>
                          <th className="text-center px-2 py-2.5 w-10">Result</th>
                          <th className="text-center px-2 py-2.5">Goals</th>
                          <th className="text-center px-2 py-2.5">Shots</th>
                          <th className="text-center px-2 py-2.5 hidden sm:table-cell">FO%</th>
                          <th className="text-center px-2 py-2.5 hidden md:table-cell">xG</th>
                          <th className="text-center px-2 py-2.5 hidden md:table-cell">CORSI%</th>
                          <th className="w-8 px-1"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {teamGames.map((game) => {
                          const ext = (game.extended_stats || {}) as Record<string, Record<string, unknown>>;
                          const shots = ext.shots?.on_goal ?? ext.shots?.total ?? "";
                          const foPct = ext.faceoffs?.won_pct ?? "";
                          const xg = ext.xg?.xg ?? "";
                          const corsi = ext.advanced?.corsi_pct ?? "";
                          const isExpanded = expandedGameId === game.id;

                          return (
                            <tr
                              key={game.id}
                              className={`border-t border-teal/10 hover:bg-navy/[0.01] cursor-pointer transition-colors ${
                                isExpanded ? "bg-navy/[0.02]" : ""
                              }`}
                              onClick={() => setExpandedGameId(isExpanded ? null : game.id)}
                            >
                              <td className="px-3 py-2 text-navy whitespace-nowrap">
                                {game.game_date ? new Date(game.game_date + "T12:00:00").toLocaleDateString("en-US", {
                                  month: "short", day: "numeric",
                                }) : "—"}
                              </td>
                              <td className="text-center px-2 py-2">
                                <span className={`text-[10px] font-oswald font-bold px-1.5 py-0.5 rounded ${
                                  game.home_away === "H" ? "bg-teal/10 text-teal" : "bg-navy/10 text-navy"
                                }`}>
                                  {game.home_away || "—"}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-navy font-medium">{game.opponent || "—"}</td>
                              <td className="text-center px-3 py-2 font-oswald font-bold text-navy">
                                {game.team_score ?? 0}–{game.opponent_score ?? 0}
                              </td>
                              <td className="text-center px-2 py-2">
                                <span className={`text-xs font-oswald font-bold px-2 py-0.5 rounded-full ${
                                  game.result === "W" ? "bg-green-100 text-green-700" :
                                  game.result === "L" ? "bg-red-100 text-red-600" :
                                  game.result === "T" ? "bg-orange/10 text-orange" :
                                  "text-muted"
                                }`}>
                                  {game.result || "—"}
                                </span>
                              </td>
                              <td className="text-center px-2 py-2 font-mono text-xs">{game.team_score ?? "—"}</td>
                              <td className="text-center px-2 py-2 font-mono text-xs">{shots ? String(shots) : "—"}</td>
                              <td className="text-center px-2 py-2 font-mono text-xs hidden sm:table-cell">{foPct ? String(foPct) : "—"}</td>
                              <td className="text-center px-2 py-2 font-mono text-xs hidden md:table-cell">{xg ? String(typeof xg === "number" ? (xg as number).toFixed(1) : xg) : "—"}</td>
                              <td className="text-center px-2 py-2 font-mono text-xs hidden md:table-cell">{corsi ? String(corsi) : "—"}</td>
                              <td className="px-1 py-2 text-center">
                                {isExpanded ? <ChevronUp size={12} className="text-muted" /> : <ChevronDown size={12} className="text-muted" />}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Expanded game detail */}
                  {expandedGameId && (() => {
                    const game = teamGames.find(g => g.id === expandedGameId);
                    if (!game?.extended_stats) return null;
                    const ext = game.extended_stats as Record<string, Record<string, unknown>>;
                    const categories = Object.entries(ext).filter(([, v]) => v && typeof v === "object" && Object.keys(v).length > 0);

                    return (
                      <div className="border-t border-teal/20 bg-navy/[0.02] p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-oswald font-semibold text-navy uppercase tracking-wider">
                            Game Details — {game.opponent} ({game.game_date})
                          </h3>
                          <Link
                            href={`/game-plans/new?opponent=${encodeURIComponent(game.opponent || "")}&date=${game.game_date || ""}`}
                            className="text-xs text-teal hover:underline flex items-center gap-1"
                          >
                            <Zap size={10} /> Create Game Plan
                          </Link>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                          {categories.map(([cat, vals]) => (
                            <div key={cat} className="bg-white rounded-lg border border-teal/10 p-3">
                              <h4 className="text-[10px] font-oswald uppercase tracking-wider text-muted mb-1.5">
                                {cat.replace(/_/g, " ")}
                              </h4>
                              <div className="space-y-0.5">
                                {Object.entries(vals as Record<string, unknown>).slice(0, 8).map(([k, v]) => (
                                  <div key={k} className="flex justify-between text-[11px]">
                                    <span className="text-muted/70 truncate mr-2">{k.replace(/_/g, " ")}</span>
                                    <span className="font-mono text-navy font-medium whitespace-nowrap">{v != null ? String(v) : "—"}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </>
            ) : (
              <div className="bg-white rounded-xl border border-teal/20 p-6 text-center">
                <Calendar size={28} className="mx-auto text-muted/30 mb-2" />
                <p className="text-sm text-muted">No game data imported yet.</p>
                <p className="text-xs text-muted/60 mt-1">
                  Upload a Games XLSX export from the{" "}
                  <Link href="/instat" className="text-teal hover:underline">Import Stats</Link> page.
                </p>
              </div>
            )}
          </section>
        )}
      </main>
    </ProtectedRoute>
  );
}
