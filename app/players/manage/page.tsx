"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Users,
  GitMerge,
  Trash2,
  Shield,
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  ArrowRightLeft,
  Search,
  X,
} from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import api from "@/lib/api";

interface DuplicatePlayer {
  id: string;
  first_name: string;
  last_name: string;
  current_team: string | null;
  current_league: string | null;
  position: string;
  dob: string | null;
  shoots: string | null;
  stat_count: number;
  note_count: number;
  report_count: number;
  intel_count: number;
  created_at: string;
}

interface DuplicateGroup {
  match_type: "exact_name" | "name_variant";
  match_key: string;
  confidence: "high" | "medium";
  players: DuplicatePlayer[];
}

interface DuplicateResponse {
  total_groups: number;
  total_duplicate_players: number;
  groups: DuplicateGroup[];
}

export default function PlayerManagePage() {
  return (
    <ProtectedRoute>
      <NavBar />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PlayerManagement />
      </main>
    </ProtectedRoute>
  );
}

function PlayerManagement() {
  const [activeTab, setActiveTab] = useState<"duplicates" | "bulk">("duplicates");

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-navy flex items-center gap-2">
            <Users size={24} className="text-teal" />
            Player Management
          </h1>
          <p className="text-muted text-sm mt-1">
            Merge duplicates, assign leagues, transfer players between teams
          </p>
        </div>
        <Link
          href="/players"
          className="text-sm text-teal hover:underline flex items-center gap-1"
        >
          ← Back to Players
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setActiveTab("duplicates")}
          className={`px-4 py-2 rounded-lg text-sm font-oswald uppercase tracking-wider transition-colors ${
            activeTab === "duplicates"
              ? "bg-white text-navy shadow-sm"
              : "text-muted hover:text-navy"
          }`}
        >
          <GitMerge size={14} className="inline mr-1.5" />
          Duplicate Detection
        </button>
        <button
          onClick={() => setActiveTab("bulk")}
          className={`px-4 py-2 rounded-lg text-sm font-oswald uppercase tracking-wider transition-colors ${
            activeTab === "bulk"
              ? "bg-white text-navy shadow-sm"
              : "text-muted hover:text-navy"
          }`}
        >
          <ArrowRightLeft size={14} className="inline mr-1.5" />
          Bulk Operations
        </button>
      </div>

      {activeTab === "duplicates" && <DuplicateManager />}
      {activeTab === "bulk" && <BulkOperations />}
    </div>
  );
}

// ── Duplicate Detection & Merge ─────────────────
function DuplicateManager() {
  const [data, setData] = useState<DuplicateResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mergeSuccess, setMergeSuccess] = useState("");

  const loadDuplicates = async () => {
    setLoading(true);
    setError("");
    try {
      const { data: resp } = await api.get<DuplicateResponse>("/players/duplicates");
      setData(resp);
    } catch {
      setError("Failed to load duplicate analysis");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadDuplicates(); }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-navy border-t-teal" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
        <p className="text-red-700 text-sm">{error}</p>
      </div>
    );
  }

  if (!data || data.total_groups === 0) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
        <CheckCircle size={32} className="mx-auto text-green-500 mb-3" />
        <h3 className="font-oswald font-semibold text-green-800">No Duplicates Found</h3>
        <p className="text-green-600 text-sm mt-1">All player profiles are unique.</p>
      </div>
    );
  }

  return (
    <div>
      {mergeSuccess && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-2">
          <CheckCircle size={16} className="text-green-600" />
          <p className="text-green-700 text-sm">{mergeSuccess}</p>
          <button onClick={() => setMergeSuccess("")} className="ml-auto text-green-500 hover:text-green-700">
            <X size={14} />
          </button>
        </div>
      )}

      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertTriangle size={16} className="text-orange" />
          <p className="text-sm text-navy">
            <span className="font-semibold">{data.total_groups}</span> potential duplicate groups found
            ({data.total_duplicate_players} players total)
          </p>
        </div>
        <button
          onClick={loadDuplicates}
          className="text-xs text-teal hover:text-teal/70 flex items-center gap-1"
        >
          <RefreshCw size={12} />
          Refresh
        </button>
      </div>

      <div className="space-y-4">
        {data.groups.map((group, i) => (
          <DuplicateGroupCard
            key={group.match_key + i}
            group={group}
            onMerged={(msg) => {
              setMergeSuccess(msg);
              loadDuplicates();
            }}
          />
        ))}
      </div>
    </div>
  );
}

function DuplicateGroupCard({
  group,
  onMerged,
}: {
  group: DuplicateGroup;
  onMerged: (msg: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [keepId, setKeepId] = useState(group.players[0]?.id || "");
  const [merging, setMerging] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState("");

  // Auto-select the player with the most data as the one to keep
  useEffect(() => {
    const best = [...group.players].sort(
      (a, b) =>
        (b.stat_count + b.note_count * 5 + b.report_count * 10 + b.intel_count * 3) -
        (a.stat_count + a.note_count * 5 + a.report_count * 10 + a.intel_count * 3)
    )[0];
    if (best) setKeepId(best.id);
  }, [group.players]);

  const handleMerge = async () => {
    const mergeIds = group.players.filter((p) => p.id !== keepId).map((p) => p.id);
    if (mergeIds.length === 0) return;

    setMerging(true);
    setError("");
    try {
      const { data } = await api.post("/players/merge", {
        keep_id: keepId,
        merge_ids: mergeIds,
      });
      onMerged(
        `Merged ${mergeIds.length} profile(s): ${data.stats_moved} stats, ${data.notes_moved} notes, ${data.reports_moved} reports moved.`
      );
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Merge failed";
      setError(msg);
    } finally {
      setMerging(false);
    }
  };

  const handleDelete = async (playerId: string) => {
    setDeleting(playerId);
    setError("");
    try {
      await api.delete(`/players/${playerId}`);
      onMerged("Player deleted successfully.");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Delete failed";
      setError(msg);
    } finally {
      setDeleting(null);
    }
  };

  const firstPlayer = group.players[0];

  return (
    <div className="bg-white rounded-xl border border-border overflow-hidden">
      {/* Header — click to expand */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
              group.confidence === "high"
                ? "bg-red-100 text-red-700"
                : "bg-orange-100 text-orange-700"
            }`}
          >
            {group.confidence === "high" ? "Exact Match" : "Name Variant"}
          </span>
          <span className="font-medium text-navy text-sm">
            {firstPlayer.first_name} {firstPlayer.last_name}
          </span>
          <span className="text-xs text-muted">
            ({group.players.length} profiles)
          </span>
        </div>
        {expanded ? <ChevronDown size={16} className="text-muted" /> : <ChevronRight size={16} className="text-muted" />}
      </button>

      {/* Expanded Detail */}
      {expanded && (
        <div className="border-t border-border px-5 py-4">
          {error && (
            <div className="mb-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-red-700 text-xs">
              {error}
            </div>
          )}

          <p className="text-xs text-muted mb-3">
            Select the primary profile to keep. All stats, notes, and reports from other profiles will be merged into it.
          </p>

          <div className="space-y-2">
            {group.players.map((p) => (
              <div
                key={p.id}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                  keepId === p.id
                    ? "border-teal bg-teal/5"
                    : "border-border hover:border-gray-300"
                }`}
                onClick={() => setKeepId(p.id)}
              >
                {/* Radio */}
                <div
                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    keepId === p.id ? "border-teal" : "border-gray-300"
                  }`}
                >
                  {keepId === p.id && <div className="w-2 h-2 rounded-full bg-teal" />}
                </div>

                {/* Player info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-navy text-sm">
                      {p.first_name} {p.last_name}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-muted">
                      {p.position}
                    </span>
                    {p.current_team && (
                      <span className="text-xs text-muted">{p.current_team}</span>
                    )}
                    {p.dob && p.dob !== "-" && (
                      <span className="text-[10px] text-muted/60">DOB: {p.dob}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[10px] text-muted">
                      {p.stat_count} stats
                    </span>
                    <span className="text-[10px] text-muted">
                      {p.note_count} notes
                    </span>
                    <span className="text-[10px] text-muted">
                      {p.report_count} reports
                    </span>
                    <span className="text-[10px] text-muted">
                      {p.intel_count} intel
                    </span>
                  </div>
                </div>

                {/* Keep / Delete indicator */}
                {keepId === p.id ? (
                  <span className="text-[10px] font-oswald uppercase tracking-wider text-teal shrink-0">
                    Keep
                  </span>
                ) : (
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-oswald uppercase tracking-wider text-orange">
                      Merge
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Delete ${p.first_name} ${p.last_name}? This cannot be undone.`)) {
                          handleDelete(p.id);
                        }
                      }}
                      disabled={deleting === p.id}
                      className="text-red-400 hover:text-red-600 transition-colors"
                      title="Delete this profile entirely"
                    >
                      {deleting === p.id ? (
                        <span className="animate-spin rounded-full h-3.5 w-3.5 border border-red-400 border-t-transparent inline-block" />
                      ) : (
                        <Trash2 size={14} />
                      )}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Merge button */}
          {group.players.length > 1 && (
            <button
              onClick={handleMerge}
              disabled={merging}
              className="mt-4 w-full bg-gradient-to-r from-teal to-teal/80 text-white py-2.5 rounded-lg font-oswald font-semibold uppercase tracking-wider text-sm hover:shadow-md transition-shadow disabled:opacity-50"
            >
              {merging ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  Merging...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <GitMerge size={14} />
                  Merge {group.players.length - 1} Profile{group.players.length > 2 ? "s" : ""} into Selected
                </span>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Bulk Operations ─────────────────────────────
function BulkOperations() {
  const [assigningLeague, setAssigningLeague] = useState(false);
  const [leagueResult, setLeagueResult] = useState("");
  const [assigningTeams, setAssigningTeams] = useState(false);
  const [teamResult, setTeamResult] = useState("");

  // Bulk transfer
  const [transferSearch, setTransferSearch] = useState("");
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [targetTeam, setTargetTeam] = useState("");
  const [targetLeague, setTargetLeague] = useState("");
  const [transferring, setTransferring] = useState(false);
  const [transferResult, setTransferResult] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{ id: string; first_name: string; last_name: string; current_team: string; position: string }>>([]);

  const handleAutoAssignLeagues = async () => {
    setAssigningLeague(true);
    setLeagueResult("");
    try {
      const { data } = await api.post("/players/auto-assign-teams");
      setLeagueResult(`Updated ${data.leagues_assigned} player(s) with league assignments.`);
    } catch {
      setLeagueResult("Failed to assign leagues.");
    } finally {
      setAssigningLeague(false);
    }
  };

  const handleBulkAssignLeague = async (league: string) => {
    setAssigningLeague(true);
    setLeagueResult("");
    try {
      const { data } = await api.post("/players/bulk-assign-league", { league });
      setLeagueResult(`Assigned "${league}" to ${data.players_updated} player(s) without a league.`);
    } catch {
      setLeagueResult("Failed to assign league.");
    } finally {
      setAssigningLeague(false);
    }
  };

  const searchPlayers = async (query: string) => {
    if (query.length < 2) { setSearchResults([]); return; }
    try {
      const { data } = await api.get(`/players?search=${encodeURIComponent(query)}&limit=20`);
      setSearchResults(data.map((p: { id: string; first_name: string; last_name: string; current_team: string; position: string }) => ({
        id: p.id, first_name: p.first_name, last_name: p.last_name,
        current_team: p.current_team || "—", position: p.position,
      })));
    } catch {
      setSearchResults([]);
    }
  };

  const handleTransfer = async () => {
    if (!selectedPlayers.length || !targetTeam) return;
    setTransferring(true);
    setTransferResult("");
    try {
      let updated = 0;
      for (const pid of selectedPlayers) {
        const body: Record<string, string> = { current_team: targetTeam };
        if (targetLeague) body.current_league = targetLeague;
        await api.patch(`/players/${pid}`, body);
        updated++;
      }
      setTransferResult(`Transferred ${updated} player(s) to ${targetTeam}.`);
      setSelectedPlayers([]);
      setSearchResults([]);
      setTransferSearch("");
    } catch {
      setTransferResult("Transfer failed.");
    } finally {
      setTransferring(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Auto-assign Leagues */}
      <div className="bg-white rounded-xl border border-border p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-teal/10 flex items-center justify-center">
            <Shield size={20} className="text-teal" />
          </div>
          <div>
            <h3 className="font-oswald font-semibold text-navy text-sm uppercase tracking-wider">
              Auto-Assign Leagues
            </h3>
            <p className="text-xs text-muted mt-0.5">
              Automatically assign leagues to players based on their team using the reference teams database
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleAutoAssignLeagues}
            disabled={assigningLeague}
            className="px-4 py-2 bg-teal text-white text-sm font-oswald uppercase tracking-wider rounded-lg hover:bg-teal/90 transition-colors disabled:opacity-50"
          >
            {assigningLeague ? "Assigning..." : "Auto-Detect Leagues"}
          </button>
          <button
            onClick={() => handleBulkAssignLeague("GOJHL")}
            disabled={assigningLeague}
            className="px-4 py-2 bg-navy text-white text-sm font-oswald uppercase tracking-wider rounded-lg hover:bg-navy/90 transition-colors disabled:opacity-50"
          >
            Assign All → GOJHL
          </button>
        </div>

        {leagueResult && (
          <div className="mt-3 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-green-700 text-sm flex items-center gap-2">
            <CheckCircle size={14} />
            {leagueResult}
          </div>
        )}
      </div>

      {/* Transfer Players */}
      <div className="bg-white rounded-xl border border-border p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-orange/10 flex items-center justify-center">
            <ArrowRightLeft size={20} className="text-orange" />
          </div>
          <div>
            <h3 className="font-oswald font-semibold text-navy text-sm uppercase tracking-wider">
              Transfer Players
            </h3>
            <p className="text-xs text-muted mt-0.5">
              Move players between teams — trades, releases, signings
            </p>
          </div>
        </div>

        {/* Player Search */}
        <div className="mb-4">
          <label className="block text-xs font-semibold text-navy mb-1">
            Search Players to Transfer
          </label>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-2.5 text-muted" />
            <input
              type="text"
              value={transferSearch}
              onChange={(e) => {
                setTransferSearch(e.target.value);
                searchPlayers(e.target.value);
              }}
              placeholder="Search by name..."
              className="w-full border border-border rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
            />
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="mt-2 border border-border rounded-lg max-h-48 overflow-y-auto">
              {searchResults.map((p) => {
                const isSelected = selectedPlayers.includes(p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() =>
                      setSelectedPlayers((prev) =>
                        isSelected ? prev.filter((id) => id !== p.id) : [...prev, p.id]
                      )
                    }
                    className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-gray-50 border-b border-border last:border-b-0 transition-colors ${
                      isSelected ? "bg-teal/5" : ""
                    }`}
                  >
                    <span>
                      <span className="font-medium text-navy">{p.first_name} {p.last_name}</span>
                      <span className="text-xs text-muted ml-2">{p.position}</span>
                    </span>
                    <span className="text-xs text-muted flex items-center gap-2">
                      {p.current_team}
                      {isSelected && <CheckCircle size={14} className="text-teal" />}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected Players */}
        {selectedPlayers.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-navy mb-1">
              {selectedPlayers.length} player(s) selected
            </p>
            <div className="flex flex-wrap gap-1">
              {selectedPlayers.map((pid) => {
                const p = searchResults.find((r) => r.id === pid);
                return p ? (
                  <span
                    key={pid}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-teal/10 text-teal text-xs rounded-full"
                  >
                    {p.first_name} {p.last_name}
                    <button onClick={() => setSelectedPlayers((prev) => prev.filter((id) => id !== pid))}>
                      <X size={10} />
                    </button>
                  </span>
                ) : null;
              })}
            </div>
          </div>
        )}

        {/* Target Team & League */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-xs font-semibold text-navy mb-1">
              New Team <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={targetTeam}
              onChange={(e) => setTargetTeam(e.target.value)}
              placeholder="e.g. Chatham Maroons"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-navy mb-1">
              New League (optional)
            </label>
            <input
              type="text"
              value={targetLeague}
              onChange={(e) => setTargetLeague(e.target.value)}
              placeholder="e.g. GOJHL"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
            />
          </div>
        </div>

        <button
          onClick={handleTransfer}
          disabled={transferring || !selectedPlayers.length || !targetTeam}
          className="px-6 py-2.5 bg-gradient-to-r from-orange to-orange/80 text-white font-oswald font-semibold uppercase tracking-wider text-sm rounded-lg hover:shadow-md transition-shadow disabled:opacity-50"
        >
          {transferring ? "Transferring..." : `Transfer ${selectedPlayers.length} Player(s)`}
        </button>

        {transferResult && (
          <div className="mt-3 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-green-700 text-sm flex items-center gap-2">
            <CheckCircle size={14} />
            {transferResult}
          </div>
        )}
      </div>
    </div>
  );
}
