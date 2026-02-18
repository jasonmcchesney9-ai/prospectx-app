"use client";

import { Suspense, useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Wand2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Users,
  Building2,
  X,
  Sparkles,
  ChevronDown,
  ChevronUp,
  ClipboardList,
} from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import api from "@/lib/api";
import type {
  Player,
  TeamReference,
  ReportGenerateRequest,
  ReportGenerateResponse,
  ReportStatusResponse,
  CustomReportOptions,
} from "@/types/api";
import { FOCUS_AREA_ICONS, FOCUS_AREA_DESCRIPTIONS, DRILL_CATEGORIES, DRILL_AGE_LEVELS, DRILL_AGE_LEVEL_LABELS } from "@/types/api";
import { getUser } from "@/lib/auth";
import UpgradeModal from "@/components/UpgradeModal";

type GenerationState = "idle" | "submitting" | "polling" | "complete" | "failed";
type SubjectMode = "player" | "team";

export default function CustomReportPage() {
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
      <CustomReportContent />
    </Suspense>
  );
}

function CustomReportContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedPlayer = searchParams.get("player") || "";
  const preselectedTeam = searchParams.get("team") || "";

  // Data
  const [players, setPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<TeamReference[]>([]);
  const [options, setOptions] = useState<CustomReportOptions | null>(null);
  const [loading, setLoading] = useState(true);

  // Subject selection
  const [subjectMode, setSubjectMode] = useState<SubjectMode>(preselectedTeam ? "team" : "player");
  const [selectedPlayer, setSelectedPlayer] = useState(preselectedPlayer);
  const [selectedTeam, setSelectedTeam] = useState(preselectedTeam);
  const [playerSearch, setPlayerSearch] = useState("");
  const [teamSearch, setTeamSearch] = useState("");

  // Report configuration
  const [focusAreas, setFocusAreas] = useState<string[]>([]);
  const [audience, setAudience] = useState("scouts");
  const [depth, setDepth] = useState("standard");
  const [comparisonMode, setComparisonMode] = useState("");
  const [customInstructions, setCustomInstructions] = useState("");
  const [reportTitle, setReportTitle] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Drill options
  const [includeDrills, setIncludeDrills] = useState(false);
  const [drillFocus, setDrillFocus] = useState<string[]>([]);
  const [drillAgeLevel, setDrillAgeLevel] = useState("");
  const [drillIntensity, setDrillIntensity] = useState("");

  // Generation state
  const [genState, setGenState] = useState<GenerationState>("idle");
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [upgradeModal, setUpgradeModal] = useState<{ open: boolean; used: number; limit: number }>({ open: false, used: 0, limit: 0 });
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load data
  useEffect(() => {
    async function load() {
      try {
        const [playersRes, teamsRes, optionsRes] = await Promise.all([
          api.get<Player[]>("/players?limit=2000"),
          api.get<TeamReference[]>("/teams/reference"),
          api.get<CustomReportOptions>("/reports/custom-options"),
        ]);
        setPlayers(playersRes.data);
        setTeams(teamsRes.data);
        setOptions(optionsRes.data);
      } catch (err: unknown) {
        const msg =
          (err as { response?: { data?: { detail?: string } } })?.response?.data
            ?.detail || "Failed to load data. Is the backend running?";
        setError(msg);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Cleanup polling
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // Filtered lists
  const filteredPlayers = players.filter((p) => {
    if (!playerSearch) return true;
    const q = playerSearch.toLowerCase();
    return (
      p.first_name.toLowerCase().includes(q) ||
      p.last_name.toLowerCase().includes(q) ||
      (p.current_team || "").toLowerCase().includes(q)
    );
  });

  const filteredTeams = teams.filter((t) => {
    if (!teamSearch) return true;
    const q = teamSearch.toLowerCase();
    return (
      t.name.toLowerCase().includes(q) ||
      (t.league || "").toLowerCase().includes(q)
    );
  });

  // Toggle focus area
  const toggleFocus = (key: string) => {
    setFocusAreas((prev) =>
      prev.includes(key) ? prev.filter((f) => f !== key) : [...prev, key]
    );
  };

  // Poll status
  const pollStatus = useCallback(
    (id: string) => {
      setGenState("polling");
      setStatusMessage("Generating your custom report...");
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
          // Keep polling
        }
      }, 2000);
    },
    [router]
  );

  // Generate
  const handleGenerate = async () => {
    if (subjectMode === "player" && !selectedPlayer) return;
    if (subjectMode === "team" && !selectedTeam) return;

    setError("");
    setGenState("submitting");
    setStatusMessage("Submitting...");

    try {
      const payload: ReportGenerateRequest = {
        report_type: "custom",
        data_scope: {
          focus_areas: focusAreas,
          audience,
          depth,
          comparison_mode: comparisonMode,
          custom_instructions: customInstructions,
          report_title: reportTitle,
          ...(includeDrills && {
            include_drills: true,
            ...(drillFocus.length > 0 && { drill_focus: drillFocus }),
            ...(drillAgeLevel && { drill_age_level: drillAgeLevel }),
            ...(drillIntensity && { drill_intensity: drillIntensity }),
          }),
        },
      };
      if (subjectMode === "team") {
        payload.team_name = selectedTeam;
      } else {
        payload.player_id = selectedPlayer;
      }

      const { data } = await api.post<ReportGenerateResponse>(
        "/reports/generate",
        payload
      );

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
  const canGenerate =
    (subjectMode === "player" ? !!selectedPlayer : !!selectedTeam) &&
    focusAreas.length > 0;

  return (
    <ProtectedRoute>
      <NavBar />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <Link
          href="/reports"
          className="flex items-center gap-1 text-sm text-muted hover:text-navy mb-6"
        >
          <ArrowLeft size={14} /> Back to Reports
        </Link>

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal to-teal/60 flex items-center justify-center">
            <Wand2 size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-navy">Custom Report Builder</h1>
            <p className="text-xs text-muted">
              Build a tailored scouting report by selecting focus areas, audience, and depth
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center min-h-[30vh]">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-navy border-t-teal" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* ── Step 1: Subject Mode Toggle ── */}
            <div className="bg-white rounded-xl border border-teal/20 p-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-6 h-6 rounded-full bg-teal text-white text-xs font-bold flex items-center justify-center font-oswald">1</span>
                <h2 className="text-sm font-oswald uppercase tracking-wider text-navy">Select Subject</h2>
              </div>

              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => { setSubjectMode("player"); setSelectedTeam(""); }}
                  disabled={isGenerating}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    subjectMode === "player"
                      ? "bg-navy text-white"
                      : "bg-navy/5 text-navy hover:bg-navy/10"
                  }`}
                >
                  <Users size={14} /> Player Report
                </button>
                <button
                  onClick={() => { setSubjectMode("team"); setSelectedPlayer(""); }}
                  disabled={isGenerating}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    subjectMode === "team"
                      ? "bg-orange text-white"
                      : "bg-orange/5 text-orange hover:bg-orange/10"
                  }`}
                >
                  <Building2 size={14} /> Team Report
                </button>
              </div>

              {subjectMode === "player" ? (
                /* Player Picker */
                !selectedPlayer ? (
                  <div>
                    <input
                      type="text"
                      placeholder="Search players..."
                      value={playerSearch}
                      onChange={(e) => setPlayerSearch(e.target.value)}
                      className="w-full px-3 py-2 border border-teal/20 rounded-lg text-sm mb-2"
                    />
                    <div className="max-h-48 overflow-y-auto border border-teal/20 rounded-lg divide-y divide-border/50">
                      {filteredPlayers.length === 0 ? (
                        <div className="px-3 py-4 text-center text-muted text-sm">
                          {players.length === 0 ? "No players yet." : "No matching players."}
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
                      onClick={() => { setSelectedPlayer(""); setPlayerSearch(""); }}
                      disabled={isGenerating}
                      className="text-xs text-muted hover:text-red-600 transition-colors"
                    >
                      Change
                    </button>
                  </div>
                )
              ) : (
                /* Team Picker */
                !selectedTeam ? (
                  <div>
                    <input
                      type="text"
                      placeholder="Search teams..."
                      value={teamSearch}
                      onChange={(e) => setTeamSearch(e.target.value)}
                      className="w-full px-3 py-2 border border-teal/20 rounded-lg text-sm mb-2"
                    />
                    <div className="max-h-48 overflow-y-auto border border-teal/20 rounded-lg divide-y divide-border/50">
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
                      onClick={() => { setSelectedTeam(""); setTeamSearch(""); }}
                      disabled={isGenerating}
                      className="text-xs text-muted hover:text-red-600 transition-colors"
                    >
                      Change
                    </button>
                  </div>
                )
              )}
            </div>

            {/* ── Step 2: Focus Areas ── */}
            <div className="bg-white rounded-xl border border-teal/20 p-6">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-6 h-6 rounded-full bg-teal text-white text-xs font-bold flex items-center justify-center font-oswald">2</span>
                <h2 className="text-sm font-oswald uppercase tracking-wider text-navy">Focus Areas</h2>
                {focusAreas.length > 0 && (
                  <span className="ml-2 px-2 py-0.5 rounded-full bg-teal/10 text-teal text-xs font-bold font-oswald">
                    {focusAreas.length} selected
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted mb-4">
                Select what the report should focus on. Each area generates a dedicated analysis section.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {(options?.focus_areas || []).map((fa) => {
                  const isSelected = focusAreas.includes(fa.key);
                  const icon = FOCUS_AREA_ICONS[fa.key] || "";
                  const desc = FOCUS_AREA_DESCRIPTIONS[fa.key] || "";
                  return (
                    <button
                      key={fa.key}
                      type="button"
                      onClick={() => toggleFocus(fa.key)}
                      disabled={isGenerating}
                      className={`px-3 py-2.5 rounded-lg border text-left transition-all ${
                        isSelected
                          ? "border-teal bg-teal/10 ring-1 ring-teal/30"
                          : "border-teal/20 bg-white hover:border-navy/30 hover:bg-navy/[0.02]"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base">{icon}</span>
                        <span
                          className={`text-xs font-semibold ${
                            isSelected ? "text-teal" : "text-navy"
                          }`}
                        >
                          {fa.label}
                        </span>
                        {isSelected && <CheckCircle2 size={12} className="text-teal ml-auto" />}
                      </div>
                      {desc && (
                        <p className={`text-[10px] mt-1 leading-tight ${
                          isSelected ? "text-teal/60" : "text-muted/60"
                        }`}>
                          {desc}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>

              {focusAreas.length > 0 && (
                <button
                  onClick={() => setFocusAreas([])}
                  className="mt-3 flex items-center gap-1 text-[10px] text-muted hover:text-red-600 transition-colors"
                >
                  <X size={10} /> Clear all
                </button>
              )}
            </div>

            {/* ── Step 3: Audience & Depth ── */}
            <div className="bg-white rounded-xl border border-teal/20 p-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-6 h-6 rounded-full bg-teal text-white text-xs font-bold flex items-center justify-center font-oswald">3</span>
                <h2 className="text-sm font-oswald uppercase tracking-wider text-navy">Audience & Depth</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Audience */}
                <div>
                  <label className="block text-[10px] font-oswald uppercase tracking-wider text-muted mb-1.5">
                    Who is this report for?
                  </label>
                  <div className="space-y-1.5">
                    {(options?.audiences || []).map((a) => (
                      <button
                        key={a.key}
                        onClick={() => setAudience(a.key)}
                        disabled={isGenerating}
                        className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition-all ${
                          audience === a.key
                            ? "border-teal bg-teal/10 text-teal font-medium"
                            : "border-teal/20 text-navy hover:border-navy/30"
                        }`}
                      >
                        {a.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Depth */}
                <div>
                  <label className="block text-[10px] font-oswald uppercase tracking-wider text-muted mb-1.5">
                    Report depth
                  </label>
                  <div className="space-y-1.5">
                    {(options?.depths || []).map((d) => (
                      <button
                        key={d.key}
                        onClick={() => setDepth(d.key)}
                        disabled={isGenerating}
                        className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition-all ${
                          depth === d.key
                            ? "border-orange bg-orange/10 text-orange font-medium"
                            : "border-teal/20 text-navy hover:border-navy/30"
                        }`}
                      >
                        {d.label}
                        <span className="block text-[10px] text-muted/60 mt-0.5">
                          {d.key === "brief"
                            ? "500-800 words, key takeaways only"
                            : d.key === "standard"
                            ? "1000-1500 words, thorough analysis"
                            : "2000-3000 words, exhaustive deep dive"}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* ── Step 4: Advanced Options (Collapsible) ── */}
            <div className="bg-white rounded-xl border border-teal/20 overflow-hidden">
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full flex items-center justify-between px-6 py-4"
              >
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-navy/10 text-navy text-xs font-bold flex items-center justify-center font-oswald">4</span>
                  <h2 className="text-sm font-oswald uppercase tracking-wider text-navy">Advanced Options</h2>
                  <span className="text-[10px] text-muted">(Optional)</span>
                </div>
                {showAdvanced ? <ChevronUp size={16} className="text-muted" /> : <ChevronDown size={16} className="text-muted" />}
              </button>

              {showAdvanced && (
                <div className="px-6 pb-6 space-y-4 border-t border-teal/10 pt-4">
                  {/* Comparison Mode */}
                  <div>
                    <label className="block text-[10px] font-oswald uppercase tracking-wider text-muted mb-1.5">
                      Comparison Mode
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setComparisonMode("")}
                        disabled={isGenerating}
                        className={`px-3 py-1.5 rounded-lg border text-xs transition-all ${
                          !comparisonMode
                            ? "border-teal bg-teal/10 text-teal font-medium"
                            : "border-teal/20 text-muted hover:border-navy/30"
                        }`}
                      >
                        None
                      </button>
                      {(options?.comparison_modes || []).map((cm) => (
                        <button
                          key={cm.key}
                          onClick={() => setComparisonMode(cm.key)}
                          disabled={isGenerating}
                          className={`px-3 py-1.5 rounded-lg border text-xs transition-all ${
                            comparisonMode === cm.key
                              ? "border-teal bg-teal/10 text-teal font-medium"
                              : "border-teal/20 text-muted hover:border-navy/30"
                          }`}
                        >
                          {cm.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Custom Title */}
                  <div>
                    <label className="block text-[10px] font-oswald uppercase tracking-wider text-muted mb-1.5">
                      Report Title (optional)
                    </label>
                    <input
                      type="text"
                      placeholder="Leave blank for auto-generated title..."
                      value={reportTitle}
                      onChange={(e) => setReportTitle(e.target.value)}
                      className="w-full px-3 py-2 border border-teal/20 rounded-lg text-sm"
                      disabled={isGenerating}
                      maxLength={100}
                    />
                  </div>

                  {/* Custom Instructions */}
                  <div>
                    <label className="block text-[10px] font-oswald uppercase tracking-wider text-muted mb-1.5">
                      Custom Instructions (optional)
                    </label>
                    <textarea
                      placeholder="Add any specific instructions, questions, or context for the report..."
                      value={customInstructions}
                      onChange={(e) => setCustomInstructions(e.target.value)}
                      className="w-full px-3 py-2 border border-teal/20 rounded-lg text-sm resize-none"
                      rows={3}
                      disabled={isGenerating}
                      maxLength={500}
                    />
                    <div className="flex justify-end mt-1">
                      <span className={`text-[10px] ${customInstructions.length > 450 ? "text-orange" : "text-muted/50"}`}>
                        {customInstructions.length}/500
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ── Step 5: Drill Recommendations (Optional) ── */}
            <div className="bg-white rounded-xl border border-teal/20 overflow-hidden">
              <button
                onClick={() => setIncludeDrills(!includeDrills)}
                className="w-full flex items-center justify-between px-6 py-4"
              >
                <div className="flex items-center gap-2">
                  <ClipboardList size={14} className="text-teal" />
                  <h2 className="text-sm font-oswald uppercase tracking-wider text-navy">Include Drill Recommendations</h2>
                  {includeDrills && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal/15 text-teal font-oswald uppercase tracking-wider font-bold">On</span>
                  )}
                </div>
                {includeDrills ? <ChevronUp size={16} className="text-muted" /> : <ChevronDown size={16} className="text-muted" />}
              </button>

              {includeDrills && (
                <div className="px-6 pb-6 space-y-4 border-t border-teal/10 pt-4">
                  <p className="text-xs text-muted/70 leading-relaxed">
                    Add relevant drills from the ProspectX Drill Library with rink diagrams, setup instructions, and coaching points tailored to the report subject.
                  </p>

                  {/* Drill Category Filter */}
                  <div>
                    <label className="block text-[10px] font-oswald uppercase tracking-wider text-muted mb-1.5">
                      Drill Categories (optional)
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(DRILL_CATEGORIES).map(([key, lbl]) => {
                        const isActive = drillFocus.includes(key);
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setDrillFocus(prev =>
                              isActive ? prev.filter(f => f !== key) : [...prev, key]
                            )}
                            disabled={isGenerating}
                            className={`px-2 py-1 rounded text-[10px] font-oswald uppercase tracking-wider transition-colors ${
                              isActive
                                ? "bg-teal/15 text-teal font-bold border border-teal/30"
                                : "bg-navy/[0.04] text-navy/50 border border-transparent hover:border-navy/20"
                            }`}
                          >
                            {lbl}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-muted/50 mt-1">Leave empty for all categories</p>
                  </div>

                  <div className="flex gap-4">
                    {/* Age Level */}
                    <div className="flex-1">
                      <label className="block text-[10px] font-oswald uppercase tracking-wider text-muted mb-1">Age Level</label>
                      <select
                        value={drillAgeLevel}
                        onChange={(e) => setDrillAgeLevel(e.target.value)}
                        className="w-full px-3 py-1.5 border border-teal/20 rounded-lg text-xs bg-white"
                        disabled={isGenerating}
                      >
                        <option value="">All Ages</option>
                        {DRILL_AGE_LEVELS.map((a) => (
                          <option key={a} value={a}>{DRILL_AGE_LEVEL_LABELS[a]}</option>
                        ))}
                      </select>
                    </div>
                    {/* Intensity */}
                    <div className="flex-1">
                      <label className="block text-[10px] font-oswald uppercase tracking-wider text-muted mb-1">Intensity</label>
                      <select
                        value={drillIntensity}
                        onChange={(e) => setDrillIntensity(e.target.value)}
                        className="w-full px-3 py-1.5 border border-teal/20 rounded-lg text-xs bg-white"
                        disabled={isGenerating}
                      >
                        <option value="">All</option>
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ── Preview Summary ── */}
            {(selectedPlayer || selectedTeam) && focusAreas.length > 0 && (
              <div className="bg-gradient-to-r from-navy/[0.03] to-teal/[0.03] rounded-xl border border-teal/10 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles size={14} className="text-teal" />
                  <span className="text-xs font-oswald uppercase tracking-wider text-navy">Report Preview</span>
                </div>
                <div className="text-xs text-muted space-y-1">
                  <p>
                    <span className="font-medium text-navy">Subject:</span>{" "}
                    {subjectMode === "player" && selectedPlayerObj
                      ? `${selectedPlayerObj.first_name} ${selectedPlayerObj.last_name} (${selectedPlayerObj.position})`
                      : selectedTeam}
                  </p>
                  <p>
                    <span className="font-medium text-navy">Focus:</span>{" "}
                    {focusAreas
                      .map((fa) => {
                        const opt = options?.focus_areas.find((o) => o.key === fa);
                        return opt?.label || fa;
                      })
                      .join(", ")}
                  </p>
                  <p>
                    <span className="font-medium text-navy">Audience:</span>{" "}
                    {options?.audiences.find((a) => a.key === audience)?.label || audience}
                    {" · "}
                    <span className="font-medium text-navy">Depth:</span>{" "}
                    {options?.depths.find((d) => d.key === depth)?.label || depth}
                  </p>
                  {comparisonMode && (
                    <p>
                      <span className="font-medium text-navy">Comparison:</span>{" "}
                      {options?.comparison_modes.find((c) => c.key === comparisonMode)?.label || comparisonMode}
                    </p>
                  )}
                  <p className="text-[10px] text-muted/50 mt-2">
                    Estimated sections: EXECUTIVE_SUMMARY + {focusAreas.length} focus area{focusAreas.length !== 1 ? "s" : ""} + BOTTOM_LINE
                    {comparisonMode ? " + comparison" : ""}
                  </p>
                </div>
              </div>
            )}

            {/* ── Generation Status ── */}
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
                <span className="text-sm font-medium">{error || statusMessage}</span>
              </div>
            )}

            {error && genState !== "failed" && (
              <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>
            )}

            {/* ── Generate Button ── */}
            <button
              type="button"
              onClick={handleGenerate}
              disabled={!canGenerate || isGenerating || genState === "complete"}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-teal to-teal/80 text-white font-oswald font-semibold uppercase tracking-wider rounded-xl hover:from-teal/90 hover:to-teal/70 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm shadow-sm"
            >
              {isGenerating ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Building Your Report...
                </>
              ) : genState === "complete" ? (
                <>
                  <CheckCircle2 size={16} />
                  Complete
                </>
              ) : (
                <>
                  <Wand2 size={16} />
                  Generate Custom Report
                  {focusAreas.length > 0 && (
                    <span className="ml-1 text-white/70">
                      ({focusAreas.length} focus area{focusAreas.length !== 1 ? "s" : ""})
                    </span>
                  )}
                </>
              )}
            </button>

            {genState === "failed" && (
              <button
                type="button"
                onClick={() => {
                  setGenState("idle");
                  setError("");
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
