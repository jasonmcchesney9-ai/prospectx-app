"use client";

import { Suspense, useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Zap, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import api from "@/lib/api";
import type {
  Player,
  ReportTemplate,
  ReportGenerateRequest,
  ReportGenerateResponse,
  ReportStatusResponse,
} from "@/types/api";
import { REPORT_TYPE_LABELS, PLAYER_REPORT_TYPES, TEAM_REPORT_TYPES } from "@/types/api";

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

  const [players, setPlayers] = useState<Player[]>([]);
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedPlayer, setSelectedPlayer] = useState(preselectedPlayer);
  const [selectedType, setSelectedType] = useState("");
  const [playerSearch, setPlayerSearch] = useState("");

  const [genState, setGenState] = useState<GenerationState>("idle");
  const [reportId, setReportId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load players and templates
  useEffect(() => {
    async function load() {
      try {
        const [playersRes, templatesRes] = await Promise.all([
          api.get<Player[]>("/players?limit=500"),
          api.get<ReportTemplate[]>("/templates"),
        ]);
        setPlayers(playersRes.data);
        setTemplates(templatesRes.data);

        // Default to first template type if available
        if (templatesRes.data.length > 0 && !selectedType) {
          setSelectedType(templatesRes.data[0].report_type);
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

  // Filter players by search
  const filteredPlayers = players.filter((p) => {
    if (!playerSearch) return true;
    const q = playerSearch.toLowerCase();
    return (
      p.first_name.toLowerCase().includes(q) ||
      p.last_name.toLowerCase().includes(q) ||
      (p.current_team || "").toLowerCase().includes(q)
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
          // else still processing — keep polling
        } catch {
          // Polling error — keep trying
        }
      }, 2000);
    },
    [router]
  );

  const handleGenerate = async () => {
    if (!selectedPlayer || !selectedType) return;

    setError("");
    setGenState("submitting");
    setStatusMessage("Submitting...");

    try {
      const payload: ReportGenerateRequest = {
        player_id: selectedPlayer,
        report_type: selectedType,
      };
      const { data } = await api.post<ReportGenerateResponse>(
        "/reports/generate",
        payload
      );
      setReportId(data.report_id);

      // If already complete (synchronous generation), redirect immediately
      if (data.status === "complete") {
        setGenState("complete");
        setStatusMessage("Report complete! Redirecting...");
        setTimeout(() => router.push(`/reports/${data.report_id}`), 500);
      } else {
        // Start polling
        pollStatus(data.report_id);
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "Failed to generate report.";
      setError(msg);
      setGenState("failed");
    }
  };

  const selectedPlayerObj = players.find((p) => p.id === selectedPlayer);
  const isGenerating = genState === "submitting" || genState === "polling";

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

        <h1 className="text-2xl font-bold text-navy mb-6">Generate Report</h1>

        {loading ? (
          <div className="flex items-center justify-center min-h-[30vh]">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-navy border-t-teal" />
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-border p-6 space-y-6">
            {/* Player Selection */}
            <div>
              <label className="block text-xs font-oswald uppercase tracking-wider text-muted mb-2">
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
                            <Link
                              href="/players/new"
                              className="text-teal hover:underline"
                            >
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
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-teal/10 text-teal font-oswald">
                            {p.position}
                          </span>
                          {p.current_team && (
                            <span className="text-xs text-muted ml-auto">
                              {p.current_team}
                            </span>
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
                          <span className="text-xs text-muted">
                            {selectedPlayerObj.current_team}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPlayer("");
                      setPlayerSearch("");
                    }}
                    className="text-xs text-muted hover:text-red-600 transition-colors"
                    disabled={isGenerating}
                  >
                    Change
                  </button>
                </div>
              )}
            </div>

            {/* Report Type Selection — Player Reports */}
            <div>
              <label className="block text-xs font-oswald uppercase tracking-wider text-muted mb-2">
                Player Reports
              </label>
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
                <label className="block text-xs font-oswald uppercase tracking-wider text-muted mb-2">
                  Team Reports
                </label>
                <p className="text-[11px] text-muted/60 mb-3">Team strategy, lineup, and game-planning reports. Select a player as the primary focus or reference.</p>
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
              <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">
                {error}
              </p>
            )}

            {/* Generate Button */}
            <button
              type="button"
              onClick={handleGenerate}
              disabled={
                !selectedPlayer || !selectedType || isGenerating || genState === "complete"
              }
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
                  Generate Report
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
    </ProtectedRoute>
  );
}
