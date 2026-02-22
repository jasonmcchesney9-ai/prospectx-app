"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  AlertTriangle,
  Zap,
  RefreshCw,
  Save,
  SlidersHorizontal,
  Clock,
  Users,
  X,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import api from "@/lib/api";
import type { PracticePlan } from "@/types/api";

interface QuickIssue {
  label: string;
  issues: string[];
}

const QUICK_ISSUE_CATEGORIES: Record<string, QuickIssue> = {
  zone_exits: {
    label: "Zone Exits / Breakouts",
    issues: [
      "Struggling vs aggressive forecheck",
      "D turning over on wall",
      "Centers not supporting breakout",
      "Icing problems",
    ],
  },
  zone_entries: {
    label: "Zone Entries",
    issues: [
      "Dumping in too much",
      "Getting denied at blue line",
      "No controlled entries",
      "Winger not driving net on entry",
    ],
  },
  defensive_zone: {
    label: "Defensive Zone",
    issues: [
      "Giving up second chances",
      "Losing net front battles",
      "Weak side exposure on PP",
      "D gap too wide",
    ],
  },
  forechecking: {
    label: "Forechecking",
    issues: [
      "F1 not getting pressure",
      "Losing puck battles in corners",
      "Not converting turnovers to chances",
    ],
  },
  special_teams_pp: {
    label: "Special Teams - PP",
    issues: [
      "Not generating shots",
      "One-dimensional - always going to same option",
      "Losing puck on entry",
    ],
  },
  special_teams_pk: {
    label: "Special Teams - PK",
    issues: [
      "Giving up seam passes",
      "Getting caught on faceoff losses",
      "Allowing zone time",
    ],
  },
  neutral_zone: {
    label: "Neutral Zone",
    issues: [
      "Getting caught in transition",
      "Not winning races to pucks",
      "Regroup breaking down",
    ],
  },
  compete: {
    label: "Compete / Battles",
    issues: [
      "Losing board battles",
      "Getting outworked in corners",
      "No net-front presence",
    ],
  },
};

export default function FromGameIssuePage() {
  const router = useRouter();
  const [mode, setMode] = useState<"describe" | "quick">("describe");
  const [issueText, setIssueText] = useState("");
  const [selectedIssues, setSelectedIssues] = useState<string[]>([]);
  const [iceTime, setIceTime] = useState(60);
  const [rosterSize, setRosterSize] = useState(18);
  const [teams, setTeams] = useState<{ name: string }[]>([]);
  const [selectedTeam, setSelectedTeam] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generatedPlan, setGeneratedPlan] = useState<PracticePlan & { problem_diagnosis?: string; key_coaching_cues?: string[]; follow_up?: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showAdjust, setShowAdjust] = useState(false);
  const [focusOverride, setFocusOverride] = useState<string[]>([]);

  useEffect(() => {
    async function loadTeams() {
      try {
        const { data } = await api.get("/teams?limit=100");
        setTeams(Array.isArray(data) ? data : data.teams || []);
      } catch { /* non-critical */ }
    }
    loadTeams();
  }, []);

  const handleGenerate = async () => {
    const gameIssue = mode === "describe" ? issueText : selectedIssues.join(". ");
    if (!gameIssue.trim()) return;

    setGenerating(true);
    setGeneratedPlan(null);
    setSaved(false);
    try {
      const { data } = await api.post("/practice-plans/generate-from-issue", {
        game_issue: gameIssue,
        issue_category: mode === "quick" ? selectedIssues[0] : undefined,
        team_id: selectedTeam || undefined,
        ice_time_minutes: iceTime,
        roster_size: rosterSize,
        goalies: 2,
        focus_override: focusOverride,
      });
      setGeneratedPlan(data);
    } catch {
      // non-critical
    } finally {
      setGenerating(false);
    }
  };

  const handleRegenerate = () => {
    handleGenerate();
  };

  const handleSave = async () => {
    if (!generatedPlan) return;
    setSaving(true);
    try {
      await api.put(`/practice-plans/${generatedPlan.id}`, { status: "active" });
      setSaved(true);
    } catch { /* non-critical */ }
    finally { setSaving(false); }
  };

  const toggleIssue = (issue: string) => {
    setSelectedIssues((prev) =>
      prev.includes(issue) ? prev.filter((i) => i !== issue) : [...prev, issue]
    );
  };

  const canGenerate = mode === "describe" ? issueText.trim().length >= 10 : selectedIssues.length > 0;

  return (
    <ProtectedRoute>
      <NavBar />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <Link
          href="/practice-plans"
          className="flex items-center gap-1 text-sm text-muted hover:text-navy mb-6"
        >
          <ArrowLeft size={14} /> Back to Practice Plans
        </Link>

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-navy">What went wrong in your last game?</h1>
          <p className="text-sm text-muted mt-1">
            Describe the issue and PXI will build a targeted practice plan using drills from your library.
          </p>
        </div>

        {/* Mode Toggle */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setMode("describe")}
            className={`px-4 py-2 text-sm font-oswald uppercase tracking-wider rounded-lg transition-colors ${
              mode === "describe"
                ? "bg-navy text-white"
                : "bg-white text-navy border border-border hover:bg-gray-50"
            }`}
          >
            Describe It
          </button>
          <button
            onClick={() => setMode("quick")}
            className={`px-4 py-2 text-sm font-oswald uppercase tracking-wider rounded-lg transition-colors ${
              mode === "quick"
                ? "bg-navy text-white"
                : "bg-white text-navy border border-border hover:bg-gray-50"
            }`}
          >
            Quick Pick
          </button>
        </div>

        {/* Describe It Mode */}
        {mode === "describe" && (
          <div className="bg-white rounded-xl border border-border p-5 mb-6">
            <textarea
              value={issueText}
              onChange={(e) => setIssueText(e.target.value)}
              placeholder="e.g. We kept losing the puck on zone exits under pressure from their forecheck. Our D kept turning it over on the wall and our centers weren't supporting..."
              className="w-full px-3 py-3 border border-border rounded-lg text-sm resize-none focus:ring-1 focus:ring-teal focus:border-teal"
              rows={4}
            />
            <div className="flex flex-wrap items-center gap-3 mt-3">
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-muted" />
                <select
                  value={iceTime}
                  onChange={(e) => setIceTime(Number(e.target.value))}
                  className="px-2 py-1 border border-border rounded text-sm bg-white"
                >
                  <option value={45}>45 min</option>
                  <option value={60}>60 min</option>
                  <option value={75}>75 min</option>
                  <option value={90}>90 min</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <Users size={14} className="text-muted" />
                <select
                  value={rosterSize}
                  onChange={(e) => setRosterSize(Number(e.target.value))}
                  className="px-2 py-1 border border-border rounded text-sm bg-white"
                >
                  {[12, 15, 18, 20, 22].map((n) => (
                    <option key={n} value={n}>{n} skaters</option>
                  ))}
                </select>
              </div>
              {teams.length > 0 && (
                <select
                  value={selectedTeam}
                  onChange={(e) => setSelectedTeam(e.target.value)}
                  className="px-2 py-1 border border-border rounded text-sm bg-white"
                >
                  <option value="">Select Team (optional)</option>
                  {teams.map((t) => (
                    <option key={t.name} value={t.name}>{t.name}</option>
                  ))}
                </select>
              )}
            </div>
          </div>
        )}

        {/* Quick Pick Mode */}
        {mode === "quick" && (
          <div className="space-y-4 mb-6">
            {Object.entries(QUICK_ISSUE_CATEGORIES).map(([catKey, cat]) => (
              <div key={catKey} className="bg-white rounded-xl border border-border p-4">
                <h3 className="text-xs font-oswald uppercase tracking-wider text-muted mb-2">{cat.label}</h3>
                <div className="flex flex-wrap gap-2">
                  {cat.issues.map((issue) => {
                    const isSelected = selectedIssues.includes(issue);
                    return (
                      <button
                        key={issue}
                        onClick={() => toggleIssue(issue)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          isSelected
                            ? "bg-teal text-white"
                            : "bg-gray-50 text-navy/70 hover:bg-teal/10 hover:text-teal border border-border"
                        }`}
                      >
                        {issue}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {selectedIssues.length > 0 && (
              <div className="bg-teal/5 rounded-xl border border-teal/20 p-3">
                <p className="text-xs font-oswald uppercase tracking-wider text-teal mb-1">Selected Issues ({selectedIssues.length})</p>
                <div className="flex flex-wrap gap-1">
                  {selectedIssues.map((issue) => (
                    <span key={issue} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-teal/10 text-teal">
                      {issue}
                      <button onClick={() => toggleIssue(issue)} className="hover:text-red-500">
                        <X size={10} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-muted" />
                <select
                  value={iceTime}
                  onChange={(e) => setIceTime(Number(e.target.value))}
                  className="px-2 py-1 border border-border rounded text-sm bg-white"
                >
                  <option value={45}>45 min</option>
                  <option value={60}>60 min</option>
                  <option value={75}>75 min</option>
                  <option value={90}>90 min</option>
                </select>
              </div>
              {teams.length > 0 && (
                <select
                  value={selectedTeam}
                  onChange={(e) => setSelectedTeam(e.target.value)}
                  className="px-2 py-1 border border-border rounded text-sm bg-white"
                >
                  <option value="">Select Team (optional)</option>
                  {teams.map((t) => (
                    <option key={t.name} value={t.name}>{t.name}</option>
                  ))}
                </select>
              )}
            </div>
          </div>
        )}

        {/* Build Practice Button */}
        <div className="flex justify-center mb-8">
          <button
            onClick={handleGenerate}
            disabled={!canGenerate || generating}
            className="flex items-center gap-2 px-6 py-3 bg-orange text-white text-sm font-oswald font-semibold uppercase tracking-wider rounded-lg hover:bg-orange/90 disabled:opacity-50 transition-colors"
          >
            {generating ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
            {generating ? "Building Practice..." : "Build Practice"}
          </button>
        </div>

        {/* Generated Plan Display */}
        {generatedPlan && (
          <div className="space-y-4">
            {/* Problem Diagnosis */}
            {generatedPlan.problem_diagnosis && (
              <div className="bg-orange/5 border border-orange/20 rounded-xl p-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={16} className="text-orange shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-oswald uppercase tracking-wider text-orange mb-1">Problem Diagnosis</p>
                    <p className="text-sm text-navy/80">{generatedPlan.problem_diagnosis}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Plan Header */}
            <div className="bg-gradient-to-br from-navy to-navy-light rounded-xl p-5 text-white">
              <h2 className="text-lg font-bold">{generatedPlan.title}</h2>
              <div className="flex items-center gap-3 mt-2 text-xs text-white/50">
                <span className="flex items-center gap-1"><Clock size={11} />{generatedPlan.duration_minutes} min</span>
                {generatedPlan.team_name && <span className="flex items-center gap-1"><Users size={11} />{generatedPlan.team_name}</span>}
              </div>
              {generatedPlan.plan_data?.coaching_summary && (
                <p className="text-sm text-white/70 mt-2">{generatedPlan.plan_data.coaching_summary}</p>
              )}
            </div>

            {/* Phases */}
            {generatedPlan.plan_data?.phases?.map((phase, idx) => (
              <div key={idx} className="bg-white rounded-xl border border-border overflow-hidden">
                <div className="px-4 py-2 bg-teal/5 border-b border-border">
                  <span className="text-xs font-oswald font-bold uppercase tracking-wider text-teal">
                    {phase.phase_label || phase.phase}
                  </span>
                  <span className="text-xs text-muted ml-2">{phase.duration_minutes} min</span>
                </div>
                <div className="divide-y divide-border/30">
                  {phase.drills?.map((drill, di) => (
                    <div key={di} className="px-4 py-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold text-navy">{drill.drill_name}</h4>
                        <span className="text-xs text-muted">{drill.duration_minutes} min</span>
                      </div>
                      {drill.coaching_notes && (
                        <p className="text-xs text-navy/60 mt-1">{drill.coaching_notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Key Coaching Cues */}
            {generatedPlan.key_coaching_cues && generatedPlan.key_coaching_cues.length > 0 && (
              <div className="bg-white rounded-xl border border-border p-4">
                <h3 className="text-xs font-oswald uppercase tracking-wider text-teal mb-2">Key Coaching Cues</h3>
                <ul className="space-y-1">
                  {generatedPlan.key_coaching_cues.map((cue, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-navy/80">
                      <CheckCircle2 size={14} className="text-teal shrink-0 mt-0.5" />
                      {cue}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Follow-up */}
            {generatedPlan.follow_up && (
              <div className="bg-navy/[0.03] rounded-xl border border-border p-4">
                <h3 className="text-xs font-oswald uppercase tracking-wider text-muted mb-1">Next Practice Follow-Up</h3>
                <p className="text-sm text-navy/70">{generatedPlan.follow_up}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3 pt-2">
              <button
                onClick={handleSave}
                disabled={saving || saved}
                className="flex items-center gap-2 px-4 py-2 bg-teal text-white text-sm font-oswald font-semibold uppercase tracking-wider rounded-lg hover:bg-teal/90 disabled:opacity-50 transition-colors"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <CheckCircle2 size={14} /> : <Save size={14} />}
                {saved ? "Saved" : "Save to Practice Plans"}
              </button>
              {saved && (
                <Link
                  href={`/practice-plans/${generatedPlan.id}`}
                  className="flex items-center gap-2 px-4 py-2 bg-navy text-white text-sm font-oswald font-semibold uppercase tracking-wider rounded-lg hover:bg-navy/90 transition-colors"
                >
                  View Plan
                </Link>
              )}
              <button
                onClick={handleRegenerate}
                disabled={generating}
                className="flex items-center gap-2 px-4 py-2 bg-white text-navy text-sm font-oswald font-semibold uppercase tracking-wider rounded-lg border border-border hover:bg-gray-50 transition-colors"
              >
                <RefreshCw size={14} />
                Regenerate
              </button>
              <button
                onClick={() => setShowAdjust(!showAdjust)}
                className="flex items-center gap-2 px-4 py-2 bg-white text-navy text-sm font-oswald font-semibold uppercase tracking-wider rounded-lg border border-border hover:bg-gray-50 transition-colors"
              >
                <SlidersHorizontal size={14} />
                Adjust Focus
              </button>
            </div>

            {/* Adjust Focus Modal */}
            {showAdjust && (
              <div className="bg-white rounded-xl border border-border p-4 mt-2">
                <h3 className="text-xs font-oswald uppercase tracking-wider text-muted mb-2">Add Focus Areas</h3>
                <div className="flex flex-wrap gap-2 mb-3">
                  {["skating", "passing", "shooting", "puck_handling", "offensive_systems", "defensive_systems", "checking", "special_teams", "conditioning", "compete_level", "transition", "battle_drills"].map((area) => {
                    const selected = focusOverride.includes(area);
                    return (
                      <button
                        key={area}
                        onClick={() => setFocusOverride((prev) => selected ? prev.filter((a) => a !== area) : [...prev, area])}
                        className={`px-2 py-1 rounded text-xs transition-colors ${
                          selected ? "bg-teal text-white" : "bg-gray-50 text-navy/70 border border-border hover:bg-teal/10"
                        }`}
                      >
                        {area.replace(/_/g, " ")}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => { setShowAdjust(false); handleRegenerate(); }}
                  disabled={generating}
                  className="flex items-center gap-2 px-4 py-2 bg-orange text-white text-xs font-oswald font-semibold uppercase tracking-wider rounded-lg hover:bg-orange/90 disabled:opacity-50 transition-colors"
                >
                  <Zap size={12} />
                  Regenerate with Focus
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </ProtectedRoute>
  );
}
