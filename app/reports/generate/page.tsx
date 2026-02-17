"use client";

import { Suspense, useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Zap, Loader2, CheckCircle2, AlertCircle, Users, Building2, ClipboardList, ChevronDown, ChevronUp } from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import api from "@/lib/api";
import type {
  Player,
  ReportTemplate,
  ReportGenerateRequest,
  ReportGenerateResponse,
  ReportStatusResponse,
  TeamReference,
} from "@/types/api";
import { REPORT_TYPE_LABELS, PLAYER_REPORT_TYPES, TEAM_REPORT_TYPES, DRILL_CATEGORIES, DRILL_AGE_LEVELS, DRILL_AGE_LEVEL_LABELS } from "@/types/api";
import { getUser } from "@/lib/auth";
import UpgradeModal from "@/components/UpgradeModal";
import ReportLoadingView from "@/components/ReportLoadingView";

type GenerationState = "idle" | "submitting" | "polling" | "complete" | "failed";

export default function GenerateReportPage() {
  return (
    <Suspense
      fallback={
        <ProtectedRoute>
          <NavBar />
          <div className="flex items-center justify-center min-h-[50vh]">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-navy border-t-teal" />
          </div>
        </ProtectedRoute>
      }
    >
      <GenerateReportContent />
    </Suspense>
  );
}

function GenerateReportContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedPlayer = searchParams.get("player") || "";
  const preselectedTeam = searchParams.get("team") || "";

  const [players, setPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<TeamReference[]>([]);
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedPlayer, setSelectedPlayer] = useState(preselectedPlayer);
  const [selectedTeam, setSelectedTeam] = useState(preselectedTeam);
  const [selectedType, setSelectedType] = useState("");
  const [playerSearch, setPlayerSearch] = useState("");
  const [teamSearch, setTeamSearch] = useState("");

  const [genState, setGenState] = useState<GenerationState>("idle");
  const [reportId, setReportId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [upgradeModal, setUpgradeModal] = useState<{ open: boolean; used: number; limit: number }>({ open: false, used: 0, limit: 0 });

  // Drill options
  const [includeDrills, setIncludeDrills] = useState(false);
  const [drillExpanded, setDrillExpanded] = useState(false);
  const [drillFocus, setDrillFocus] = useState<string[]>([]);
  const [drillAgeLevel, setDrillAgeLevel] = useState("");
  const [drillIntensity, setDrillIntensity] = useState("");

  // Determine if current selection is a team report type
  const isTeamReportType = (TEAM_REPORT_TYPES as readonly string[]).includes(selectedType);

  // Load players, teams, and templates
  useEffect(() => {
    async function load() {
      try {
        const [playersRes, templatesRes, teamsRes] = await Promise.all([
          api.get<Player[]>("/players?limit=2000"),
          api.get<ReportTemplate[]>("/templates"),
          api.get<TeamReference[]>("/teams/reference"),
        ]);
        setPlayers(playersRes.data);
        setTemplates(templatesRes.data);
        setTeams(teamsRes.data);

        // Default to a sensible report type
        if (templatesRes.data.length > 0 && !selectedType) {
          if (preselectedTeam) {
            setSelectedType("team_identity");
          } else {
            // Default to pro_skater (most common), fall back to first template
            const hasProSkater = templatesRes.data.some((t: ReportTemplate) => t.report_type === "pro_skater");
            setSelectedType(hasProSkater ? "pro_skater" : templatesRes.data[0].report_type);
          }
        }
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed to load data. Is the backend running?";
        setError(msg);
      } finally {
        setLoading(false);
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // Filter and sort players by search relevance
  const filteredPlayers = players
    .filter((p) => {
      if (!playerSearch) return true;
      const q = playerSearch.toLowerCase();
      return (
        p.first_name.toLowerCase().includes(q) ||
        p.last_name.toLowerCase().includes(q) ||
        (p.current_team || "").toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      if (!playerSearch) {
        // Default: alphabetical by last name, then first name
        const ln = a.last_name.localeCompare(b.last_name);
        return ln !== 0 ? ln : a.first_name.localeCompare(b.first_name);
      }
      const q = playerSearch.toLowerCase();
      // Score: exact first name start = 0 (best), last name start = 1, contains = 2
      const score = (p: Player) => {
        if (p.first_name.toLowerCase().startsWith(q)) return 0;
        if (p.last_name.toLowerCase().startsWith(q)) return 1;
        return 2;
      };
      const sa = score(a), sb = score(b);
      if (sa !== sb) return sa - sb;
      // Tie-break: alphabetical by last name, then first name
      const ln = a.last_name.localeCompare(b.last_name);
      return ln !== 0 ? ln : a.first_name.localeCompare(b.first_name);
    });

  // Filter teams by search
  const filteredTeams = teams.filter((t) => {
    if (!teamSearch) return true;
    const q = teamSearch.toLowerCase();
    return (
      t.name.toLowerCase().includes(q) ||
      (t.league || "").toLowerCase().includes(q) ||
      (t.city || "").toLowerCase().includes(q)
    );
  });

  // Get unique report types from templates
  const reportTypes = Array.from(new Set(templates.map((t) => t.report_type)));

  const pollStatus = useCallback(
    (id: string) => {
      setGenState("polling");
      setStatusMessage("Generating report...");

      pollRef.current = setInterval(async () => {
        try {
          const { data } = await api.get<ReportStatusResponse>(`/reports/${id}/status`);
          if (data.status === "complete") {
            if (pollRef.current) clearInterval(pollRef.current);
            setGenState("complete");
            setStatusMessage("Report complete! Redirecting...");
            setTimeout(() => router.push(`/reports/${id}`), 1000);
          } else if (data.status === "failed") {
            if (pollRef.current) clearInterval(pollRef.current);
            setGenState("failed");
            setError(data.error_message || "Report generation failed.");
          }
        } catch {
          // Polling error — keep trying
        }
      }, 2000);
    },
    [router]
  );

  const handleGenerate = async () => {
    // Validate based on report type
    if (isTeamReportType && !selectedTeam) return;
    if (!isTeamReportType && !selectedPlayer) return;
    if (!selectedType) return;

    setError("");
    setGenState("submitting");
    setStatusMessage("Submitting...");

    try {
      const payload: ReportGenerateRequest = {
        report_type: selectedType,
      };
      if (isTeamReportType) {
        payload.team_name = selectedTeam;
      } else {
        payload.player_id = selectedPlayer;
      }
      // Include drill options if enabled
      if (includeDrills) {
        payload.data_scope = {
          ...payload.data_scope,
          include_drills: true,
          ...(drillFocus.length > 0 && { drill_focus: drillFocus }),
          ...(drillAgeLevel && { drill_age_level: drillAgeLevel }),
          ...(drillIntensity && { drill_intensity: drillIntensity }),
        };
      }

      const { data } = await api.post<ReportGenerateResponse>(
        "/reports/generate",
        payload
      );
      setReportId(data.report_id);

      if (data.status === "complete") {
        setGenState("complete");
        setStatusMessage("Report complete! Redirecting...");
        setTimeout(() => router.push(`/reports/${data.report_id}`), 500);
      } else {
        pollStatus(data.report_id);
      }
    } catch (err: unknown) {
      const resp = (err as { response?: { status?: number; data?: { detail?: { used?: number; limit?: number; error?: string } | string } } })?.response;
      if (resp?.status === 429) {
        const detail = resp.data?.detail;
        const used = typeof detail === "object" ? detail?.used || 0 : 0;
        const limit = typeof detail === "object" ? detail?.limit || 0 : 0;
        setUpgradeModal({ open: true, used, limit });
        setError("You've reached your monthly report limit. Upgrade your plan to generate more reports.");
        setGenState("failed");
      } else {
        const msg =
          (typeof resp?.data?.detail === "string" ? resp.data.detail : null) || "Failed to generate report.";
        setError(msg);
        setGenState("failed");
      }
    }
  };

  const selectedPlayerObj = players.find((p) => p.id === selectedPlayer);
  const isGenerating = genState === "submitting" || genState === "polling";

  // Determine if generate button should be enabled
  const canGenerate = isTeamReportType
    ? !!selectedTeam && !!selectedType
    : !!selectedPlayer && !!selectedType;

  // Build display name for loading view
  const selectedTeamName = teams.find(t => t.name === selectedTeam)?.name || selectedTeam;
  const subjectDisplayName = isTeamReportType
    ? selectedTeamName
    : selectedPlayerObj
    ? `${selectedPlayerObj.first_name} ${selectedPlayerObj.last_name}`
    : "";
  const reportTypeLabel = REPORT_TYPE_LABELS[selectedType] || selectedType;

  return (
    <ProtectedRoute>
      {/* Full-screen loading overlay */}
      {isGenerating && (
        <ReportLoadingView
          state={genState as "submitting" | "polling"}
          subjectName={subjectDisplayName}
          reportType={reportTypeLabel}
        />
      )}

      <NavBar />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <Link
          href="/reports"
          className="flex items-center gap-1 text-sm text-muted hover:text-navy mb-6"
        >
          <ArrowLeft size={14} /> Back to Reports
        </Link>

        <h1 className="text-2xl font-bold text-navy mb-6">Generate Report</h1>

        {loading ? (
          <div className="flex items-center justify-center min-h-[30vh]">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-navy border-t-teal" />
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-border p-6 space-y-6">
            {/* Subject Selection — Player OR Team based on report type */}
            {isTeamReportType ? (
              /* ── TEAM PICKER ── */
              <div>
                <label className="block text-xs font-oswald uppercase tracking-wider text-muted mb-2">
                  <Building2 size={12} className="inline mr-1" />
                  Select Team *
                </label>
                <p className="text-[11px] text-muted/60 mb-2">Team reports analyze the entire roster, systems, and strategy.</p>
                {!selectedTeam ? (
                  <div>
                    <input
                      type="text"
                      placeholder="Search teams..."
                      value={teamSearch}
                      onChange={(e) => setTeamSearch(e.target.value)}
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm mb-2"
                    />
                    <div className="max-h-48 overflow-y-auto border border-border rounded-lg divide-y divide-border/50">
                      {filteredTeams.length === 0 ? (
                        <div className="px-3 py-4 text-center text-muted text-sm">No teams found.</div>
                      ) : (
                        filteredTeams.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setSelectedTeam(t.name)}
                            className="w-full text-left px-3 py-2.5 hover:bg-navy/[0.03] transition-colors flex items-center gap-3"
                          >
                            <span className="font-semibold text-navy text-sm">{t.name}</span>
                            {t.league && (
                              <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-teal/10 text-teal font-oswald">
                                {t.league}
                              </span>
                            )}
                            {t.city && <span className="text-xs text-muted ml-auto">{t.city}</span>}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between bg-orange/5 rounded-lg px-4 py-3 border border-orange/20">
                    <div className="flex items-center gap-3">
                      <Building2 size={16} className="text-orange" />
                      <span className="font-semibold text-navy text-sm">{selectedTeam}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setSelectedTeam(""); setTeamSearch(""); }}
                      className="text-xs text-muted hover:text-red-600 transition-colors"
                      disabled={isGenerating}
                    >
                      Change
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* ── PLAYER PICKER ── */
              <div>
                <label className="block text-xs font-oswald uppercase tracking-wider text-muted mb-2">
                  <Users size={12} className="inline mr-1" />
                  Select Player *
                </label>
                {!selectedPlayer ? (
                  <div>
                    <input
                      type="text"
                      placeholder="Search players..."
                      value={playerSearch}
                      onChange={(e) => setPlayerSearch(e.target.value)}
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm mb-2"
                    />
                    <div className="max-h-48 overflow-y-auto border border-border rounded-lg divide-y divide-border/50">
                      {filteredPlayers.length === 0 ? (
                        <div className="px-3 py-4 text-center text-muted text-sm">
                          {players.length === 0 ? (
                            <>
                              No players yet.{" "}
                              <Link href="/players/new" className="text-teal hover:underline">
                                Add a player first
                              </Link>
                            </>
                          ) : (
                            "No matching players."
                          )}
                        </div>
                      ) : (
                        filteredPlayers.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setSelectedPlayer(p.id)}
                            className="w-full text-left px-3 py-2.5 hover:bg-navy/[0.03] transition-colors flex items-center gap-3"
                          >
                            <span className="font-semibold text-navy text-sm">
                              {p.first_name} {p.last_name}
                              {p.birth_year && (
                                <span className="font-normal text-muted ml-1">({p.birth_year})</span>
                              )}
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-teal/10 text-teal font-oswald">
                              {p.position}
                            </span>
                            {p.current_team && (
                              <span className="text-xs text-muted ml-auto">{p.current_team}</span>
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between bg-navy/[0.03] rounded-lg px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-navy text-sm">
                        {selectedPlayerObj
                          ? `${selectedPlayerObj.first_name} ${selectedPlayerObj.last_name}`
                          : "Selected Player"}
                      </span>
                      {selectedPlayerObj && (
                        <>
                          <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-teal/10 text-teal font-oswald">
                            {selectedPlayerObj.position}
                          </span>
                          {selectedPlayerObj.current_team && (
                            <span className="text-xs text-muted">{selectedPlayerObj.current_team}</span>
                          )}
                        </>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => { setSelectedPlayer(""); setPlayerSearch(""); }}
                      className="text-xs text-muted hover:text-red-600 transition-colors"
                      disabled={isGenerating}
                    >
                      Change
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Report Type Selection — Player Reports */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="h-5 w-1 rounded-full bg-teal" />
                <h3 className="text-sm font-oswald uppercase tracking-wider text-navy font-bold">
                  Player Reports
                </h3>
              </div>
              <p className="text-[11px] text-muted/60 mb-3">Individual player evaluation, scouting, and development reports.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {reportTypes
                  .filter((type) => (PLAYER_REPORT_TYPES as readonly string[]).includes(type))
                  .map((type) => {
                    const tmpl = templates.find((t) => t.report_type === type);
                    const isSelected = selectedType === type;
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setSelectedType(type)}
                        disabled={isGenerating}
                        className={`px-3 py-3 rounded-lg border text-left transition-all ${
                          isSelected
                            ? "border-teal bg-teal/10 ring-1 ring-teal/30"
                            : "border-border bg-white hover:border-navy/30 hover:bg-navy/[0.02]"
                        }`}
                      >
                        <span className={`text-sm font-semibold block ${
                          isSelected ? "text-teal" : "text-navy"
                        }`}>
                          {REPORT_TYPE_LABELS[type] || type}
                        </span>
                        {tmpl?.description && (
                          <span className={`text-xs mt-1 block leading-relaxed ${
                            isSelected ? "text-teal/70 line-clamp-3" : "text-muted/70 line-clamp-2"
                          }`}>
                            {tmpl.description}
                          </span>
                        )}
                      </button>
                    );
                  })}
              </div>
            </div>

            {/* Report Type Selection — Team Reports */}
            {reportTypes.some((type) => (TEAM_REPORT_TYPES as readonly string[]).includes(type)) && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-5 w-1 rounded-full bg-orange" />
                  <h3 className="text-sm font-oswald uppercase tracking-wider text-navy font-bold">
                    Team Reports
                  </h3>
                </div>
                <p className="text-[11px] text-muted/60 mb-3">Team strategy, identity, game-planning, and lineup optimization reports. Select a team below.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {reportTypes
                    .filter((type) => (TEAM_REPORT_TYPES as readonly string[]).includes(type))
                    .map((type) => {
                      const tmpl = templates.find((t) => t.report_type === type);
                      const isSelected = selectedType === type;
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setSelectedType(type)}
                          disabled={isGenerating}
                          className={`px-3 py-3 rounded-lg border text-left transition-all ${
                            isSelected
                              ? "border-orange bg-orange/10 ring-1 ring-orange/30"
                              : "border-border bg-white hover:border-navy/30 hover:bg-navy/[0.02]"
                          }`}
                        >
                          <span className={`text-sm font-semibold block ${
                            isSelected ? "text-orange" : "text-navy"
                          }`}>
                            {REPORT_TYPE_LABELS[type] || type}
                          </span>
                          {tmpl?.description && (
                            <span className={`text-xs mt-1 block leading-relaxed ${
                              isSelected ? "text-orange/70 line-clamp-3" : "text-muted/70 line-clamp-2"
                            }`}>
                              {tmpl.description}
                            </span>
                          )}
                        </button>
                      );
                    })}
                </div>
              </div>
            )}

            {reportTypes.length === 0 && (
              <div>
                <p className="text-sm text-muted mt-2">
                  No report templates found. Make sure the backend has templates seeded.
                </p>
              </div>
            )}

            {/* Drill Recommendations Option */}
            <div className="border border-border rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => {
                  if (!includeDrills) {
                    setIncludeDrills(true);
                    setDrillExpanded(true);
                  } else {
                    setDrillExpanded(!drillExpanded);
                  }
                }}
                className="w-full flex items-center justify-between px-4 py-3 bg-navy/[0.02] hover:bg-navy/[0.04] transition-colors"
              >
                <div className="flex items-center gap-2">
                  <ClipboardList size={14} className="text-teal" />
                  <span className="text-sm font-semibold text-navy">Include Drill Recommendations</span>
                  {includeDrills && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal/15 text-teal font-oswald uppercase tracking-wider font-bold">On</span>
                  )}
                </div>
                {drillExpanded ? <ChevronUp size={14} className="text-muted" /> : <ChevronDown size={14} className="text-muted" />}
              </button>

              {drillExpanded && (
                <div className="px-4 py-4 space-y-4 border-t border-border/50">
                  <p className="text-xs text-muted/70 leading-relaxed">
                    Include relevant drills from the ProspectX Drill Library with setup instructions, coaching points, and rink diagrams. The AI will recommend drills tailored to the player/team&apos;s development needs.
                  </p>

                  {/* Enable/Disable Toggle */}
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeDrills}
                      onChange={(e) => setIncludeDrills(e.target.checked)}
                      className="w-4 h-4 rounded border-border text-teal focus:ring-teal"
                    />
                    <span className="text-sm text-navy font-medium">Include drills with diagrams in report</span>
                  </label>

                  {includeDrills && (
                    <div className="space-y-3 pl-7">
                      {/* Drill Category Filter */}
                      <div>
                        <label className="block text-[10px] font-oswald uppercase tracking-wider text-muted mb-1">
                          Focus Categories (optional)
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                          {Object.entries(DRILL_CATEGORIES).map(([key, label]) => {
                            const isActive = drillFocus.includes(key);
                            return (
                              <button
                                key={key}
                                type="button"
                                onClick={() => setDrillFocus(prev =>
                                  isActive ? prev.filter(f => f !== key) : [...prev, key]
                                )}
                                className={`px-2 py-1 rounded text-[10px] font-oswald uppercase tracking-wider transition-colors ${
                                  isActive
                                    ? "bg-teal/15 text-teal font-bold border border-teal/30"
                                    : "bg-navy/[0.04] text-navy/50 border border-transparent hover:border-navy/20"
                                }`}
                              >
                                {label}
                              </button>
                            );
                          })}
                        </div>
                        <p className="text-[10px] text-muted/50 mt-1">Leave empty for all categories</p>
                      </div>

                      {/* Age Level Filter */}
                      <div>
                        <label className="block text-[10px] font-oswald uppercase tracking-wider text-muted mb-1">
                          Age Level (optional)
                        </label>
                        <select
                          value={drillAgeLevel}
                          onChange={(e) => setDrillAgeLevel(e.target.value)}
                          className="px-3 py-1.5 border border-border rounded-lg text-xs bg-white w-full max-w-xs"
                        >
                          <option value="">All Ages</option>
                          {DRILL_AGE_LEVELS.map((a) => (
                            <option key={a} value={a}>{DRILL_AGE_LEVEL_LABELS[a]}</option>
                          ))}
                        </select>
                      </div>

                      {/* Intensity Filter */}
                      <div>
                        <label className="block text-[10px] font-oswald uppercase tracking-wider text-muted mb-1">
                          Intensity (optional)
                        </label>
                        <select
                          value={drillIntensity}
                          onChange={(e) => setDrillIntensity(e.target.value)}
                          className="px-3 py-1.5 border border-border rounded-lg text-xs bg-white w-full max-w-xs"
                        >
                          <option value="">All Intensities</option>
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="ice-stripe rounded-full" />

            {/* Generation Status */}
            {genState !== "idle" && (
              <div
                className={`flex items-center gap-3 px-4 py-3 rounded-lg ${
                  genState === "failed"
                    ? "bg-red-50 text-red-700"
                    : genState === "complete"
                    ? "bg-green-50 text-green-700"
                    : "bg-teal/5 text-navy"
                }`}
              >
                {genState === "submitting" || genState === "polling" ? (
                  <Loader2 size={18} className="animate-spin text-teal" />
                ) : genState === "complete" ? (
                  <CheckCircle2 size={18} className="text-green-600" />
                ) : (
                  <AlertCircle size={18} className="text-red-600" />
                )}
                <span className="text-sm font-medium">
                  {error || statusMessage}
                </span>
              </div>
            )}

            {/* Error */}
            {error && genState !== "failed" && (
              <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>
            )}

            {/* Generate Button */}
            <button
              type="button"
              onClick={handleGenerate}
              disabled={!canGenerate || isGenerating || genState === "complete"}
              className="w-full flex items-center justify-center gap-2 py-3 bg-teal text-white font-oswald font-semibold uppercase tracking-wider rounded-lg hover:bg-teal/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
            >
              {isGenerating ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Generating...
                </>
              ) : genState === "complete" ? (
                <>
                  <CheckCircle2 size={16} />
                  Complete
                </>
              ) : (
                <>
                  <Zap size={16} />
                  Generate {isTeamReportType ? "Team" : ""} Report
                </>
              )}
            </button>

            {/* Retry on failure */}
            {genState === "failed" && (
              <button
                type="button"
                onClick={() => {
                  setGenState("idle");
                  setError("");
                  setReportId(null);
                }}
                className="w-full py-2 text-sm text-muted hover:text-navy transition-colors"
              >
                Try Again
              </button>
            )}
          </div>
        )}
      </main>

      {/* Upgrade Modal for report limits */}
      <UpgradeModal
        isOpen={upgradeModal.open}
        onClose={() => setUpgradeModal({ ...upgradeModal, open: false })}
        limitType="report"
        currentTier={getUser()?.subscription_tier || "rookie"}
        used={upgradeModal.used}
        limit={upgradeModal.limit}
      />
    </ProtectedRoute>
  );
}
