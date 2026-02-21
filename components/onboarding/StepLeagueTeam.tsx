"use client";

import { useEffect, useState, useRef } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import api from "@/lib/api";

interface HTLeague {
  code: string;
  name: string;
  client_code: string;
}

interface HTTeam {
  id: number;
  name: string;
  code: string;
  city: string;
  nickname: string;
  division: string;
  logo: string;
}

interface StepLeagueTeamProps {
  selectedLeague: string | null;
  selectedTeamId: string | null;
  onSelect: (
    league: string,
    teamId: string,
    teamName: string,
    teamLeagueName: string,
    teamLogo: string
  ) => void;
}

export default function StepLeagueTeam({
  selectedLeague,
  selectedTeamId,
  onSelect,
}: StepLeagueTeamProps) {
  const [leagues, setLeagues] = useState<HTLeague[]>([]);
  const [teams, setTeams] = useState<HTTeam[]>([]);
  const [loadingLeagues, setLoadingLeagues] = useState(true);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [leagueError, setLeagueError] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [manualLeague, setManualLeague] = useState("");
  const [manualTeam, setManualTeam] = useState("");
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch leagues on mount with 5s timeout fallback
  useEffect(() => {
    const fetchLeagues = async () => {
      timeoutRef.current = setTimeout(() => {
        setLeagueError(true);
        setShowManual(true);
        setLoadingLeagues(false);
      }, 5000);

      try {
        const { data } = await api.get<HTLeague[]>("/hockeytech/leagues");
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setLeagues(data);
        setLeagueError(false);
      } catch {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setLeagueError(true);
        setShowManual(true);
      } finally {
        setLoadingLeagues(false);
      }
    };
    fetchLeagues();
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  // Fetch teams when league changes
  const handleLeagueSelect = async (league: HTLeague) => {
    setShowManual(false);
    setTeams([]);
    setLoadingTeams(true);

    // Tell parent about league selection (clear team)
    onSelect(league.code, "", "", league.name, "");

    try {
      const { data } = await api.get<HTTeam[]>(`/hockeytech/${league.code}/teams`);
      setTeams(data);
    } catch {
      setTeams([]);
    } finally {
      setLoadingTeams(false);
    }
  };

  const handleTeamSelect = (team: HTTeam) => {
    onSelect(
      selectedLeague || "",
      String(team.id),
      team.name,
      leagues.find((l) => l.code === selectedLeague)?.name || selectedLeague || "",
      team.logo || ""
    );
  };

  const handleManualSubmit = () => {
    if (manualLeague.trim() && manualTeam.trim()) {
      onSelect(
        manualLeague.trim(),
        "",
        manualTeam.trim(),
        manualLeague.trim(),
        ""
      );
    }
  };

  return (
    <div className="p-6">
      <h2 className="font-oswald text-lg font-bold text-navy uppercase tracking-wider mb-1">
        Select Your League & Team
      </h2>
      <p className="text-sm text-muted mb-5">
        Choose your primary league and team. This sets up your dashboard with synced data.
      </p>

      {showManual ? (
        /* Manual entry form */
        <div className="space-y-4">
          {leagueError && (
            <div className="flex items-center gap-2 text-sm text-orange bg-orange/5 px-3 py-2 rounded-lg">
              <AlertCircle size={16} />
              <span>League data unavailable. Enter your team manually.</span>
            </div>
          )}
          <div>
            <label className="block text-xs font-oswald text-navy uppercase tracking-wider mb-1.5">
              League Name
            </label>
            <input
              type="text"
              value={manualLeague}
              onChange={(e) => setManualLeague(e.target.value)}
              placeholder="e.g., Greater Ontario Hockey League"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
            />
          </div>
          <div>
            <label className="block text-xs font-oswald text-navy uppercase tracking-wider mb-1.5">
              Team Name
            </label>
            <input
              type="text"
              value={manualTeam}
              onChange={(e) => setManualTeam(e.target.value)}
              placeholder="e.g., Chatham Maroons"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
            />
          </div>
          <button
            onClick={handleManualSubmit}
            disabled={!manualLeague.trim() || !manualTeam.trim()}
            className="px-5 py-2 bg-teal text-white font-oswald text-sm uppercase tracking-wider rounded-lg hover:bg-teal/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            Confirm Team
          </button>
          {!leagueError && (
            <button
              onClick={() => setShowManual(false)}
              className="ml-3 text-sm text-teal hover:underline"
            >
              Back to league list
            </button>
          )}
        </div>
      ) : (
        /* League + Team selection */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* League list */}
          <div>
            <label className="block text-xs font-oswald text-navy uppercase tracking-wider mb-2">
              League
            </label>
            {loadingLeagues ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="animate-spin text-teal" size={24} />
              </div>
            ) : (
              <div className="space-y-1.5 max-h-[340px] overflow-y-auto pr-1">
                {leagues.map((league) => (
                  <button
                    key={league.code}
                    onClick={() => handleLeagueSelect(league)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg border text-sm transition-all ${
                      selectedLeague === league.code
                        ? "border-teal bg-teal/5 text-navy ring-1 ring-teal/30"
                        : "border-border hover:border-teal/40 text-navy/80 hover:text-navy"
                    }`}
                  >
                    <span className="font-medium">{league.name}</span>
                    <span className="ml-2 text-[10px] font-oswald uppercase tracking-wider text-muted">
                      {league.code.toUpperCase()}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {!loadingLeagues && (
              <button
                onClick={() => setShowManual(true)}
                className="mt-3 text-xs text-teal hover:underline"
              >
                My league isn&apos;t listed
              </button>
            )}
          </div>

          {/* Team grid */}
          <div>
            <label className="block text-xs font-oswald text-navy uppercase tracking-wider mb-2">
              Team
            </label>
            {!selectedLeague ? (
              <div className="text-sm text-muted py-12 text-center">
                Select a league to see teams
              </div>
            ) : loadingTeams ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="animate-spin text-teal" size={24} />
              </div>
            ) : teams.length === 0 ? (
              <div className="text-sm text-muted py-12 text-center">
                No teams found for this league
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 max-h-[340px] overflow-y-auto pr-1">
                {teams.map((team) => (
                  <button
                    key={team.id}
                    onClick={() => handleTeamSelect(team)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border text-center transition-all ${
                      selectedTeamId === String(team.id)
                        ? "border-teal bg-teal/5 ring-1 ring-teal/30"
                        : "border-border hover:border-teal/40"
                    }`}
                  >
                    {team.logo ? (
                      <img
                        src={team.logo}
                        alt={team.name}
                        className="w-10 h-10 object-contain"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <div className="w-10 h-10 bg-navy/5 rounded-full flex items-center justify-center text-xs font-oswald text-navy/40">
                        {team.code || team.name.charAt(0)}
                      </div>
                    )}
                    <span className="text-xs font-medium text-navy leading-tight">
                      {team.name}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
