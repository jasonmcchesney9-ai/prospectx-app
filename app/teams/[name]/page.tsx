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
} from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import ReportCard from "@/components/ReportCard";
import ExtendedStatTable from "@/components/ExtendedStatTable";
import LineCombinations from "@/components/LineCombinations";
import LineBuilder from "@/components/LineBuilder";
import PlayerStatusBadges from "@/components/PlayerStatusBadges";
import api, { assetUrl, hasRealImage } from "@/lib/api";
import type { Player, Report, TeamSystem, TeamReference, SystemLibraryEntry, TeamStats, LineCombination } from "@/types/api";

type Tab = "roster" | "lines" | "systems" | "reports" | "stats";

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
        className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white"
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

  const [roster, setRoster] = useState<Player[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [teamSystem, setTeamSystem] = useState<TeamSystem | null>(null);
  const [systemsLibrary, setSystemsLibrary] = useState<SystemLibraryEntry[]>([]);
  const [teamRef, setTeamRef] = useState<TeamReference | null>(null);
  const [teamStats, setTeamStats] = useState<TeamStats | null>(null);
  const [lineCombinations, setLineCombinations] = useState<LineCombination[]>([]);
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

  const loadData = useCallback(async () => {
    try {
      setError("");
      const [rosterRes, reportsRes, sysRes, libRes, refRes, teamStatsRes, linesRes] = await Promise.allSettled([
        api.get<Player[]>(`/teams/${encodeURIComponent(teamName)}/roster`),
        api.get<Report[]>(`/teams/${encodeURIComponent(teamName)}/reports`),
        api.get<TeamSystem[]>("/hockey-os/team-systems"),
        api.get<SystemLibraryEntry[]>("/hockey-os/systems-library"),
        api.get<TeamReference[]>("/teams/reference"),
        api.get<TeamStats>(`/stats/team/${encodeURIComponent(teamName)}`),
        api.get<LineCombination[]>(`/stats/team/${encodeURIComponent(teamName)}/lines`),
      ]);

      if (rosterRes.status === "fulfilled") setRoster(rosterRes.value.data);
      if (reportsRes.status === "fulfilled") setReports(reportsRes.value.data);
      if (libRes.status === "fulfilled") setSystemsLibrary(libRes.value.data);
      if (teamStatsRes.status === "fulfilled" && teamStatsRes.value.data) setTeamStats(teamStatsRes.value.data);
      if (linesRes.status === "fulfilled") setLineCombinations(linesRes.value.data || []);

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

  // ── Roster grouping ─────────────────────────────────────
  const forwards = roster.filter((p) => posGroup(p.position) === "forwards");
  const defense = roster.filter((p) => posGroup(p.position) === "defense");
  const goalies = roster.filter((p) => posGroup(p.position) === "goalies");
  const other = roster.filter((p) => posGroup(p.position) === "other");

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
                      {teamRef?.league || roster[0]?.current_league}
                    </span>
                  )}
                  {teamRef?.city && <span>{teamRef.city}</span>}
                  {teamSystem?.season && (
                    <span className="text-white/50">{teamSystem.season}</span>
                  )}
                </div>
                <p className="text-xs text-white/50 mt-1">
                  {roster.length} players &middot; {reports.length} reports
                  {lineCombinations.length > 0 && <> &middot; {lineCombinations.length} line combos</>}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="ice-stripe mb-6 rounded-b-full" />

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 text-sm">{error}</div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-border">
          {([
            { key: "roster" as Tab, label: "Roster", icon: Users, count: roster.length },
            { key: "lines" as Tab, label: "Lines", icon: Layers, count: null },
            { key: "systems" as Tab, label: "Systems", icon: Shield, count: null },
            { key: "reports" as Tab, label: "Reports", icon: FileText, count: reports.length },
            { key: "stats" as Tab, label: "Stats", icon: BarChart3, count: null },
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

        {/* ── Roster Tab ─────────────────────────────────── */}
        {activeTab === "roster" && (
          <section>
            {/* HockeyTech Sync Bar */}
            {htInfo && (htInfo.linked || htInfo.has_ht_players) && (
              <div className="mb-4 p-3 rounded-lg bg-gradient-to-r from-teal/[0.04] to-navy/[0.02] border border-teal/15">
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
                {!htInfo.linked && htInfo.has_ht_players && (
                  <p className="mt-1 text-[10px] text-muted/60">
                    Sync roster from <Link href="/leagues" className="text-teal hover:underline">League Hub</Link> to enable stats and game log sync.
                  </p>
                )}
              </div>
            )}

            {roster.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl border border-border">
                <Users size={32} className="mx-auto text-muted/40 mb-3" />
                <p className="text-muted text-sm">No players assigned to this team.</p>
                <Link href="/players/new" className="inline-block mt-3 text-sm text-teal hover:underline">
                  + Add a player
                </Link>
              </div>
            ) : (
              <div className="space-y-6">
                {[
                  { label: "Forwards", players: forwards },
                  { label: "Defense", players: defense },
                  { label: "Goalies", players: goalies },
                  ...(other.length > 0 ? [{ label: "Other", players: other }] : []),
                ].filter((g) => g.players.length > 0).map(({ label, players }) => (
                  <div key={label}>
                    <h3 className="text-xs font-oswald uppercase tracking-wider text-muted mb-2 flex items-center gap-2">
                      {label} <span className="text-navy font-bold">({players.length})</span>
                    </h3>
                    <div className="bg-white rounded-xl border border-border overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-navy/[0.03] border-b border-border">
                            <th className="px-4 py-2.5 text-left font-oswald text-xs uppercase tracking-wider text-muted">Player</th>
                            <th className="px-4 py-2.5 text-center font-oswald text-xs uppercase tracking-wider text-muted w-16">POS</th>
                            <th className="px-4 py-2.5 text-left font-oswald text-xs uppercase tracking-wider text-muted">Archetype</th>
                            <th className="px-4 py-2.5 text-center font-oswald text-xs uppercase tracking-wider text-muted w-16">Shoots</th>
                            <th className="px-4 py-2.5 text-right font-oswald text-xs uppercase tracking-wider text-muted w-20"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {players.map((p) => (
                            <tr key={p.id} className="border-b border-border/50 hover:bg-navy/[0.02] transition-colors">
                              <td className="px-4 py-2.5">
                                <div className="flex items-center gap-1.5">
                                  <Link href={`/players/${p.id}`} className="font-semibold text-navy hover:text-teal transition-colors">
                                    {hasRealImage(p.image_url) ? (
                                      <span className="inline-flex items-center gap-2">
                                        <img
                                          src={assetUrl(p.image_url)}
                                          alt=""
                                          className="w-7 h-7 rounded-full object-cover"
                                        />
                                        {p.last_name}, {p.first_name}
                                      </span>
                                    ) : (
                                      <>{p.last_name}, {p.first_name}</>
                                    )}
                                  </Link>
                                  <PlayerStatusBadges tags={p.tags || []} size="sm" />
                                </div>
                              </td>
                              <td className="px-4 py-2.5 text-center">
                                <span className="inline-flex px-2 py-0.5 rounded text-xs font-bold bg-teal/10 text-teal font-oswald">
                                  {p.position}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-muted text-xs">
                                {p.archetype || "\u2014"}
                              </td>
                              <td className="px-4 py-2.5 text-center text-muted">
                                {p.shoots || "\u2014"}
                              </td>
                              <td className="px-4 py-2.5 text-right">
                                <Link
                                  href={`/reports/generate?player=${p.id}`}
                                  className="text-xs text-teal hover:underline"
                                >
                                  Report
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}

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
              <div className="bg-white rounded-xl border border-border overflow-hidden">
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
                      className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-navy/[0.03] text-navy/60 cursor-not-allowed"
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
                      className="w-full px-3 py-2.5 border border-border rounded-lg text-sm"
                    />
                  </div>

                  <hr className="border-border/50" />

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

                  <hr className="border-border/50" />

                  {/* Team Style */}
                  <div>
                    <h3 className="text-sm font-oswald uppercase tracking-wider text-navy mb-4">Team Style</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-oswald uppercase tracking-wider text-muted mb-1.5">Pace</label>
                        <select
                          value={sysForm.pace}
                          onChange={(e) => setSysForm({ ...sysForm, pace: e.target.value })}
                          className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white"
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
                          className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white"
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
                          className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white"
                        >
                          <option value="">Select...</option>
                          {OFFENSIVE_STYLE_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <hr className="border-border/50" />

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
                        className="flex-1 px-3 py-2.5 border border-border rounded-lg text-sm"
                      />
                      <button
                        type="button"
                        onClick={addTag}
                        className="px-3 py-2.5 bg-navy/5 border border-border rounded-lg text-sm text-navy hover:bg-navy/10 transition-colors"
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
                      className="w-full px-3 py-2.5 border border-border rounded-lg text-sm resize-none"
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
              <div className="bg-white rounded-xl border border-border p-5">
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

                {/* PP row */}
                {teamSystem.pp_formation && (
                  <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    <div className="p-3 rounded-lg bg-navy/[0.03] border border-border/50">
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
              <div className="bg-navy/[0.02] rounded-xl border border-dashed border-border p-8 text-center">
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
              <div className="text-center py-12 bg-white rounded-xl border border-border">
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
              <div className="bg-white rounded-xl border border-border p-6 text-center">
                <BarChart3 size={28} className="mx-auto text-muted/30 mb-2" />
                <p className="text-sm text-muted">No team statistics imported yet.</p>
                <p className="text-xs text-muted/60 mt-1">
                  Upload a Teams XLSX export from the{" "}
                  <Link href="/instat" className="text-teal hover:underline">Import Stats</Link> page.
                </p>
              </div>
            )}

            {/* Line Combinations */}
            {lineCombinations.length > 0 ? (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Layers size={16} className="text-orange" />
                  <h2 className="text-lg font-semibold text-navy">Line Combinations</h2>
                </div>
                <div className="bg-white rounded-xl border border-border p-4">
                  <LineCombinations lines={lineCombinations} />
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-border p-6 text-center">
                <Layers size={28} className="mx-auto text-muted/30 mb-2" />
                <p className="text-sm text-muted">No line combinations imported yet.</p>
                <p className="text-xs text-muted/60 mt-1">
                  Upload Lines XLSX files from the{" "}
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
