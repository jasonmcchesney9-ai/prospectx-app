"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Zap,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Building2,
  Clock,
  Users,
} from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import api from "@/lib/api";
import type { TeamReference, PracticePlan, PracticePlanGenerateRequest } from "@/types/api";
import {
  DRILL_AGE_LEVELS,
  DRILL_AGE_LEVEL_LABELS,
  PRACTICE_FOCUS_OPTIONS,
  PRACTICE_FOCUS_LABELS,
} from "@/types/api";

type GenState = "idle" | "submitting" | "complete" | "failed";

const DURATION_OPTIONS = [60, 75, 90, 120];

export default function GeneratePracticePlanPage() {
  const router = useRouter();

  const [teams, setTeams] = useState<TeamReference[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedTeam, setSelectedTeam] = useState("");
  const [teamSearch, setTeamSearch] = useState("");
  const [duration, setDuration] = useState(75);
  const [ageLevel, setAgeLevel] = useState("");
  const [focusAreas, setFocusAreas] = useState<string[]>([]);
  const [notes, setNotes] = useState("");

  const [genState, setGenState] = useState<GenState>("idle");
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const { data } = await api.get<TeamReference[]>("/teams/reference");
        setTeams(data);
      } catch {
        // Non-critical
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filteredTeams = teams.filter((t) => {
    if (!teamSearch) return true;
    const q = teamSearch.toLowerCase();
    return (
      t.name.toLowerCase().includes(q) ||
      (t.league || "").toLowerCase().includes(q) ||
      (t.city || "").toLowerCase().includes(q)
    );
  });

  const toggleFocus = (focus: string) => {
    setFocusAreas((prev) =>
      prev.includes(focus) ? prev.filter((f) => f !== focus) : [...prev, focus]
    );
  };

  const handleGenerate = async () => {
    if (!selectedTeam) return;

    setError("");
    setGenState("submitting");
    setStatusMessage("Generating practice plan...");

    try {
      const payload: PracticePlanGenerateRequest = {
        team_name: selectedTeam,
        duration_minutes: duration,
      };
      if (ageLevel) payload.age_level = ageLevel;
      if (focusAreas.length > 0) payload.focus_areas = focusAreas;
      if (notes.trim()) payload.notes = notes.trim();

      const { data } = await api.post<PracticePlan>("/practice-plans/generate", payload);

      setGenState("complete");
      setStatusMessage("Practice plan generated! Redirecting...");
      setTimeout(() => router.push(`/practice-plans/${data.id}`), 800);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "Failed to generate practice plan.";
      setError(msg);
      setGenState("failed");
    }
  };

  const isGenerating = genState === "submitting";
  const canGenerate = !!selectedTeam;

  return (
    <ProtectedRoute>
      <NavBar />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <Link
          href="/practice-plans"
          className="flex items-center gap-1 text-sm text-muted hover:text-navy mb-6"
        >
          <ArrowLeft size={14} /> Back to Practice Plans
        </Link>

        <h1 className="text-2xl font-bold text-navy mb-6">Generate Practice Plan</h1>

        {loading ? (
          <div className="flex items-center justify-center min-h-[30vh]">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-navy border-t-teal" />
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-teal/20 p-6 space-y-6">
            {/* Team Picker */}
            <div>
              <label className="block text-xs font-oswald uppercase tracking-wider text-muted mb-2">
                <Building2 size={12} className="inline mr-1" />
                Select Team *
              </label>
              <p className="text-[11px] text-muted/60 mb-2">
                The practice plan will be tailored to this team&apos;s roster, systems, and identity.
              </p>
              {!selectedTeam ? (
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
                    type="button"
                    onClick={() => {
                      setSelectedTeam("");
                      setTeamSearch("");
                    }}
                    className="text-xs text-muted hover:text-red-600 transition-colors"
                    disabled={isGenerating}
                  >
                    Change
                  </button>
                </div>
              )}
            </div>

            {/* Duration */}
            <div>
              <label className="block text-xs font-oswald uppercase tracking-wider text-muted mb-2">
                <Clock size={12} className="inline mr-1" />
                Practice Duration
              </label>
              <div className="flex gap-2">
                {DURATION_OPTIONS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDuration(d)}
                    disabled={isGenerating}
                    className={`flex-1 py-2.5 rounded-lg border text-sm font-oswald font-semibold transition-all ${
                      duration === d
                        ? "border-teal bg-teal/10 text-teal ring-1 ring-teal/30"
                        : "border-teal/20 bg-white text-navy/60 hover:border-navy/30"
                    }`}
                  >
                    {d} min
                  </button>
                ))}
              </div>
            </div>

            {/* Age Level */}
            <div>
              <label className="block text-xs font-oswald uppercase tracking-wider text-muted mb-2">
                <Users size={12} className="inline mr-1" />
                Age Level
              </label>
              <select
                value={ageLevel}
                onChange={(e) => setAgeLevel(e.target.value)}
                disabled={isGenerating}
                className="w-full px-3 py-2 border border-teal/20 rounded-lg text-sm bg-white"
              >
                <option value="">Auto-detect from roster</option>
                {DRILL_AGE_LEVELS.map((a) => (
                  <option key={a} value={a}>
                    {DRILL_AGE_LEVEL_LABELS[a]}
                  </option>
                ))}
              </select>
            </div>

            {/* Focus Areas */}
            <div>
              <label className="block text-xs font-oswald uppercase tracking-wider text-muted mb-2">
                Focus Areas
              </label>
              <p className="text-[11px] text-muted/60 mb-2">
                Select the areas you want to emphasize. Leave empty for a balanced practice.
              </p>
              <div className="flex flex-wrap gap-2">
                {PRACTICE_FOCUS_OPTIONS.map((focus) => {
                  const isSelected = focusAreas.includes(focus);
                  return (
                    <button
                      key={focus}
                      type="button"
                      onClick={() => toggleFocus(focus)}
                      disabled={isGenerating}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-oswald font-semibold uppercase tracking-wider transition-all ${
                        isSelected
                          ? "border-teal bg-teal/10 text-teal ring-1 ring-teal/30"
                          : "border-teal/20 bg-white text-navy/50 hover:border-navy/30 hover:text-navy/70"
                      }`}
                    >
                      {PRACTICE_FOCUS_LABELS[focus] || focus}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-oswald uppercase tracking-wider text-muted mb-2">
                Additional Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={isGenerating}
                placeholder="E.g., 'Focus on breakout plays', 'Coming off a loss — high tempo', 'Goalie working separately for first 20 min'..."
                rows={3}
                className="w-full px-3 py-2 border border-teal/20 rounded-lg text-sm bg-white resize-none"
              />
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
                {genState === "submitting" ? (
                  <Loader2 size={18} className="animate-spin text-teal" />
                ) : genState === "complete" ? (
                  <CheckCircle2 size={18} className="text-green-600" />
                ) : (
                  <AlertCircle size={18} className="text-red-600" />
                )}
                <span className="text-sm font-medium">{error || statusMessage}</span>
              </div>
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
                  Generating Practice Plan...
                </>
              ) : genState === "complete" ? (
                <>
                  <CheckCircle2 size={16} />
                  Complete — Redirecting
                </>
              ) : (
                <>
                  <Zap size={16} />
                  Generate Practice Plan
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
