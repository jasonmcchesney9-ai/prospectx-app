"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Loader2, Users, Search, CheckCircle, Lock, UserCheck, Radio, Shield } from "lucide-react";
import api from "@/lib/api";

interface HTTeam {
  id: number;
  name: string;
  code: string;
  logo: string;
}

interface PlayerResult {
  id: string;
  first_name: string;
  last_name: string;
  position: string;
  current_team: string | null;
  jersey_number: string | null;
  image_url: string | null;
}

interface StepPlayersProps {
  hockeyRole: string;
  preferredLeague: string | null;
  preferredTeamId: string | null;
  subscriptionTier: string;
  linkedPlayerId: string | null;
  coveredTeams: string[];
  onLinkedPlayerChange: (id: string | null) => void;
  onCoveredTeamsChange: (teams: string[]) => void;
  onRosterSynced: (count: number) => void;
}

const PRO_ROLES = new Set(["scout", "coach", "gm"]);
const FAMILY_ROLES = new Set(["parent", "player"]);
const MEDIA_ROLES = new Set(["broadcaster", "producer"]);

export default function StepPlayers({
  hockeyRole,
  preferredLeague,
  preferredTeamId,
  subscriptionTier,
  linkedPlayerId,
  coveredTeams,
  onLinkedPlayerChange,
  onCoveredTeamsChange,
  onRosterSynced,
}: StepPlayersProps) {
  if (PRO_ROLES.has(hockeyRole)) {
    return (
      <ProView
        preferredLeague={preferredLeague}
        preferredTeamId={preferredTeamId}
        subscriptionTier={subscriptionTier}
        onRosterSynced={onRosterSynced}
      />
    );
  }
  if (FAMILY_ROLES.has(hockeyRole)) {
    return (
      <FamilyView
        linkedPlayerId={linkedPlayerId}
        onLinkedPlayerChange={onLinkedPlayerChange}
        isParent={hockeyRole === "parent"}
      />
    );
  }
  if (MEDIA_ROLES.has(hockeyRole)) {
    return (
      <MediaView
        preferredLeague={preferredLeague}
        coveredTeams={coveredTeams}
        onCoveredTeamsChange={onCoveredTeamsChange}
      />
    );
  }
  // Agent — auto-skip message
  return <AgentView />;
}

// ── PRO (Scout / Coach / GM) ─────────────────────────────────

function ProView({
  preferredLeague,
  preferredTeamId,
  subscriptionTier,
  onRosterSynced,
}: {
  preferredLeague: string | null;
  preferredTeamId: string | null;
  subscriptionTier: string;
  onRosterSynced: (count: number) => void;
}) {
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ synced: number; created: number } | null>(null);
  const [error, setError] = useState("");
  const canSync = subscriptionTier !== "rookie";

  const handleSync = async () => {
    if (!preferredLeague || !preferredTeamId) return;
    setSyncing(true);
    setError("");
    try {
      const { data } = await api.post(
        `/hockeytech/${preferredLeague}/sync-roster/${preferredTeamId}?sync_stats=true`
      );
      setSyncResult({ synced: data.synced || 0, created: data.created || 0 });
      onRosterSynced(data.synced || 0);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        "Roster sync failed";
      setError(msg);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="p-6">
      <h2 className="font-oswald text-lg font-bold text-navy uppercase tracking-wider mb-1">
        Import Your Roster
      </h2>
      <p className="text-sm text-muted mb-5">
        Pull in your team&apos;s roster and stats from the live data feed.
      </p>

      <div className="flex flex-col items-center py-6">
        <Users size={40} className="text-navy/20 mb-4" />

        {syncResult ? (
          <div className="text-center">
            <CheckCircle size={32} className="text-teal mx-auto mb-2" />
            <p className="text-sm font-medium text-navy">
              {syncResult.synced} players synced
            </p>
            <p className="text-xs text-muted mt-1">
              {syncResult.created} new players added to your database
            </p>
          </div>
        ) : canSync ? (
          <>
            <button
              onClick={handleSync}
              disabled={syncing || !preferredLeague || !preferredTeamId}
              className="px-6 py-3 bg-teal text-white font-oswald font-semibold uppercase tracking-wider rounded-lg hover:bg-teal/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm flex items-center gap-2"
            >
              {syncing ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <Users size={16} />
                  Sync Your Roster
                </>
              )}
            </button>
            {!preferredLeague && (
              <p className="text-xs text-muted mt-2">Go back and select a league/team first</p>
            )}
          </>
        ) : (
          <div className="text-center">
            <Lock size={24} className="text-navy/30 mx-auto mb-2" />
            <p className="text-sm text-navy/70">
              Roster sync requires a <span className="font-semibold text-teal">Novice+</span> subscription
            </p>
            <p className="text-xs text-muted mt-1">
              You can sync rosters after upgrading. Skip for now.
            </p>
          </div>
        )}

        {error && (
          <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg mt-3">{error}</p>
        )}
      </div>
    </div>
  );
}

// ── FAMILY (Parent / Player) ─────────────────────────────────

function FamilyView({
  linkedPlayerId,
  onLinkedPlayerChange,
  isParent,
}: {
  linkedPlayerId: string | null;
  onLinkedPlayerChange: (id: string | null) => void;
  isParent: boolean;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlayerResult[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const searchPlayers = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const { data } = await api.get<PlayerResult[]>(`/players?search=${encodeURIComponent(q)}&limit=10`);
      setResults(data);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchPlayers(value), 300);
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div className="p-6">
      <h2 className="font-oswald text-lg font-bold text-navy uppercase tracking-wider mb-1">
        {isParent ? "Find Your Player" : "Link Your Profile"}
      </h2>
      <p className="text-sm text-muted mb-5">
        {isParent
          ? "Search for your child to link their stats to your dashboard. This is strongly recommended."
          : "Search for your name to link your player profile."}
      </p>

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="text"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          placeholder="Search by player name..."
          className="w-full border border-border rounded-lg pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
        />
      </div>

      {searching && (
        <div className="flex justify-center py-4">
          <Loader2 className="animate-spin text-teal" size={20} />
        </div>
      )}

      {linkedPlayerId && (
        <div className="flex items-center gap-2 text-sm text-teal bg-teal/5 px-3 py-2 rounded-lg mb-3">
          <UserCheck size={16} />
          <span>Player linked successfully</span>
          <button
            onClick={() => onLinkedPlayerChange(null)}
            className="ml-auto text-xs text-navy/50 hover:text-navy"
          >
            Change
          </button>
        </div>
      )}

      {!searching && results.length > 0 && (
        <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
          {results.map((p) => (
            <button
              key={p.id}
              onClick={() => onLinkedPlayerChange(p.id)}
              className={`w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg border transition-all ${
                linkedPlayerId === p.id
                  ? "border-teal bg-teal/5 ring-1 ring-teal/30"
                  : "border-border hover:border-teal/40"
              }`}
            >
              <div className="w-8 h-8 bg-navy/5 rounded-full flex items-center justify-center text-xs font-oswald text-navy/40">
                {p.jersey_number || p.position?.charAt(0) || "?"}
              </div>
              <div>
                <span className="text-sm font-medium text-navy">
                  {p.first_name} {p.last_name}
                </span>
                <span className="text-xs text-muted ml-2">
                  {p.position} {p.current_team ? `• ${p.current_team}` : ""}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {!searching && query.length >= 2 && results.length === 0 && (
        <p className="text-sm text-muted text-center py-4">
          No players found. They may appear after a roster sync.
        </p>
      )}
    </div>
  );
}

// ── MEDIA (Broadcaster / Producer) ───────────────────────────

function MediaView({
  preferredLeague,
  coveredTeams,
  onCoveredTeamsChange,
}: {
  preferredLeague: string | null;
  coveredTeams: string[];
  onCoveredTeamsChange: (teams: string[]) => void;
}) {
  const [teams, setTeams] = useState<HTTeam[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!preferredLeague) return;
    const fetchTeams = async () => {
      setLoading(true);
      try {
        const { data } = await api.get<HTTeam[]>(`/hockeytech/${preferredLeague}/teams`);
        setTeams(data);
      } catch {
        setTeams([]);
      } finally {
        setLoading(false);
      }
    };
    fetchTeams();
  }, [preferredLeague]);

  const toggleTeam = (teamName: string) => {
    if (coveredTeams.includes(teamName)) {
      onCoveredTeamsChange(coveredTeams.filter((t) => t !== teamName));
    } else {
      onCoveredTeamsChange([...coveredTeams, teamName]);
    }
  };

  return (
    <div className="p-6">
      <h2 className="font-oswald text-lg font-bold text-navy uppercase tracking-wider mb-1">
        Select Teams You Cover
      </h2>
      <p className="text-sm text-muted mb-5">
        Choose the teams you broadcast. These appear as quick-access in your Broadcast Hub.
      </p>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="animate-spin text-teal" size={24} />
        </div>
      ) : teams.length === 0 ? (
        <div className="text-center py-8">
          <Radio size={32} className="text-navy/20 mx-auto mb-2" />
          <p className="text-sm text-muted">
            {preferredLeague
              ? "No teams found for this league"
              : "Go back and select a league first"}
          </p>
        </div>
      ) : (
        <>
          {coveredTeams.length > 0 && (
            <p className="text-xs text-teal mb-3 font-medium">
              {coveredTeams.length} team{coveredTeams.length !== 1 ? "s" : ""} selected
            </p>
          )}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-[280px] overflow-y-auto pr-1">
            {teams.map((team) => {
              const isChecked = coveredTeams.includes(team.name);
              return (
                <button
                  key={team.id}
                  onClick={() => toggleTeam(team.name)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-left transition-all ${
                    isChecked
                      ? "border-teal bg-teal/5 ring-1 ring-teal/30"
                      : "border-border hover:border-teal/40"
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                      isChecked ? "bg-teal border-teal" : "border-navy/20"
                    }`}
                  >
                    {isChecked && <CheckCircle size={12} className="text-white" />}
                  </div>
                  <span className="text-xs font-medium text-navy truncate">{team.name}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ── AGENT ────────────────────────────────────────────────────

function AgentView() {
  return (
    <div className="p-6">
      <h2 className="font-oswald text-lg font-bold text-navy uppercase tracking-wider mb-1">
        Agent Hub
      </h2>
      <p className="text-sm text-muted mb-5">
        Your client management tools are ready on the dashboard.
      </p>

      <div className="flex flex-col items-center py-8">
        <Shield size={40} className="text-navy/20 mb-3" />
        <p className="text-sm text-navy/70 text-center max-w-xs">
          Agent Hub, client portfolios, and pathway planning are all accessible from your dashboard.
          Click <span className="font-semibold">Next</span> to continue.
        </p>
      </div>
    </div>
  );
}
