"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Printer,
  Download,
  Clock,
  Users,
  Calendar,
  AlertCircle,
  ClipboardList,
  CheckCircle2,
  X,
  Loader2,
} from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import api, { assetUrl } from "@/lib/api";
import type { PracticePlan, PracticePlanDrill } from "@/types/api";
import {
  PRACTICE_PHASES,
  PRACTICE_FOCUS_LABELS,
  DRILL_AGE_LEVEL_LABELS,
  DRILL_CATEGORIES,
  INTENSITY_COLORS,
  ICE_SURFACES,
} from "@/types/api";

/** Phase icon/color mapping */
const PHASE_STYLES: Record<string, { accent: string; bg: string }> = {
  warm_up: { accent: "text-orange", bg: "bg-orange/5" },
  skill_work: { accent: "text-teal", bg: "bg-teal/5" },
  systems: { accent: "text-navy", bg: "bg-navy/[0.04]" },
  scrimmage: { accent: "text-red-600", bg: "bg-red-50" },
  conditioning: { accent: "text-orange", bg: "bg-orange/5" },
  cool_down: { accent: "text-blue-500", bg: "bg-blue-50" },
};

export default function PracticePlanDetailPage() {
  const params = useParams();
  const planId = params.id as string;

  const [plan, setPlan] = useState<PracticePlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Completion modal state
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [sessionNote, setSessionNote] = useState("");
  const [rosterPlayers, setRosterPlayers] = useState<{ id: string; name: string; checked: boolean }[]>([]);
  const [completionResult, setCompletionResult] = useState<{ session_id: string; players_logged: number; total_drill_logs: number } | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const { data } = await api.get<PracticePlan>(`/practice-plans/${planId}`);
        setPlan(data);
      } catch (err: unknown) {
        const msg =
          (err as { response?: { data?: { detail?: string } } })?.response?.data
            ?.detail || "Failed to load practice plan.";
        setError(msg);
      } finally {
        setLoading(false);
      }
    }
    if (planId) load();
  }, [planId]);

  // Build phases from plan_data or drills junction
  const phases = useMemo(() => {
    if (!plan) return [];

    // Prefer plan_data phases (from AI generation)
    if (plan.plan_data?.phases && plan.plan_data.phases.length > 0) {
      return plan.plan_data.phases;
    }

    // Fallback: build from junction drills
    if (plan.drills && plan.drills.length > 0) {
      const phaseMap: Record<string, PracticePlanDrill[]> = {};
      for (const d of plan.drills) {
        if (!phaseMap[d.phase]) phaseMap[d.phase] = [];
        phaseMap[d.phase].push(d);
      }
      // Sort by sequence_order
      const phaseOrder = ["warm_up", "skill_work", "systems", "scrimmage", "conditioning", "cool_down"];
      return phaseOrder
        .filter((p) => phaseMap[p])
        .map((p) => ({
          phase: p,
          phase_label: PRACTICE_PHASES[p] || p,
          duration_minutes: phaseMap[p].reduce((sum, d) => sum + d.duration_minutes, 0),
          drills: phaseMap[p]
            .sort((a, b) => a.sequence_order - b.sequence_order)
            .map((d) => ({
              drill_id: d.drill_id,
              drill_name: d.drill_name || "Drill",
              duration_minutes: d.duration_minutes,
              coaching_notes: d.coaching_notes || "",
              // Extra joined fields
              drill_category: d.drill_category,
              drill_description: d.drill_description,
              drill_coaching_points: d.drill_coaching_points,
              drill_setup: d.drill_setup,
              drill_intensity: d.drill_intensity,
              drill_ice_surface: d.drill_ice_surface,
              drill_equipment: d.drill_equipment,
            })),
        }));
    }

    return [];
  }, [plan]);

  // Running time counter
  const runningTimes = useMemo(() => {
    let elapsed = 0;
    return phases.map((phase) => {
      const start = elapsed;
      elapsed += phase.duration_minutes;
      return { start, end: elapsed };
    });
  }, [phases]);

  const totalDuration = runningTimes.length > 0 ? runningTimes[runningTimes.length - 1].end : plan?.duration_minutes || 0;

  // Set document title for print
  useEffect(() => {
    if (plan) {
      document.title = `${plan.title} | ProspectX Practice Plan`;
    }
    return () => {
      document.title = "ProspectX Intelligence";
    };
  }, [plan]);

  const handleDownloadPDF = () => {
    const prevTitle = document.title;
    const safeName = plan?.title?.replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, "_") || "Practice_Plan";
    document.title = safeName;
    window.print();
    setTimeout(() => {
      document.title = prevTitle;
    }, 1000);
  };

  const handleOpenCompleteModal = async () => {
    if (!plan?.team_name) {
      setRosterPlayers([]);
      setShowCompleteModal(true);
      return;
    }
    try {
      const { data } = await api.get(`/players?team=${encodeURIComponent(plan.team_name)}&limit=50`);
      const players = (Array.isArray(data) ? data : data.players || []).map((p: { id: string; first_name: string; last_name: string }) => ({
        id: p.id,
        name: `${p.first_name} ${p.last_name}`,
        checked: true,
      }));
      setRosterPlayers(players);
    } catch {
      setRosterPlayers([]);
    }
    setSessionNote("");
    setShowCompleteModal(true);
  };

  const handleCompleteSession = async () => {
    setCompleting(true);
    try {
      const absentIds = rosterPlayers.filter((p) => !p.checked).map((p) => p.id);
      const { data } = await api.post(`/practice-plans/${planId}/complete`, {
        absent_player_ids: absentIds,
        session_note: sessionNote || null,
      });
      setCompletionResult(data);
      setPlan((prev) => prev ? { ...prev, status: "completed" } : prev);
      setShowCompleteModal(false);
    } catch {
      // non-critical
    } finally {
      setCompleting(false);
    }
  };

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

  if (!plan) {
    return (
      <ProtectedRoute>
        <NavBar />
        <main className="max-w-4xl mx-auto px-4 py-8">
          {error ? (
            <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
              <AlertCircle size={32} className="mx-auto text-red-500 mb-3" />
              <p className="text-red-700 font-medium mb-2">Error Loading Plan</p>
              <p className="text-red-600 text-sm">{error}</p>
              <Link href="/practice-plans" className="inline-block mt-4 text-sm text-teal hover:underline">
                &larr; Back to Practice Plans
              </Link>
            </div>
          ) : (
            <p className="text-muted">Practice plan not found.</p>
          )}
        </main>
      </ProtectedRoute>
    );
  }

  const STATUS_LABELS: Record<string, { label: string; bg: string; text: string }> = {
    draft: { label: "Draft", bg: "bg-white/10", text: "text-white/60" },
    active: { label: "Active", bg: "bg-teal/20", text: "text-teal" },
    completed: { label: "Completed", bg: "bg-green-500/20", text: "text-green-300" },
  };
  const sl = STATUS_LABELS[plan.status] || STATUS_LABELS.draft;

  return (
    <ProtectedRoute>
      <NavBar />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <Link
          href="/practice-plans"
          className="flex items-center gap-1 text-sm text-muted hover:text-navy mb-6 print:hidden"
        >
          <ArrowLeft size={14} /> Back to Practice Plans
        </Link>

        {/* Plan Header */}
        <div className="bg-gradient-to-br from-navy to-navy-light rounded-xl p-6 text-white mb-1">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span className={`px-2 py-0.5 rounded text-xs font-oswald font-bold uppercase ${sl.bg} ${sl.text}`}>
                  {sl.label}
                </span>
              </div>
              <h1 className="text-2xl font-bold">{plan.title}</h1>
              <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-white/50">
                {plan.team_name && (
                  <Link
                    href={`/teams/${encodeURIComponent(plan.team_name)}`}
                    className="flex items-center gap-1 text-white/70 hover:text-teal transition-colors"
                  >
                    <Users size={12} />
                    {plan.team_name}
                  </Link>
                )}
                <span className="flex items-center gap-1">
                  <Clock size={12} />
                  {totalDuration} minutes
                </span>
                {plan.age_level && (
                  <span>{DRILL_AGE_LEVEL_LABELS[plan.age_level] || plan.age_level}</span>
                )}
                <span className="flex items-center gap-1">
                  <Calendar size={12} />
                  {new Date(plan.created_at).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
              </div>

              {/* Focus areas */}
              {plan.focus_areas && plan.focus_areas.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {plan.focus_areas.map((fa) => (
                    <span
                      key={fa}
                      className="inline-flex px-2 py-0.5 rounded text-[10px] font-oswald uppercase tracking-wider bg-teal/20 text-teal font-bold"
                    >
                      {PRACTICE_FOCUS_LABELS[fa] || fa}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 shrink-0 ml-4 print:hidden">
              {plan.status !== "completed" && (
                <button
                  onClick={handleOpenCompleteModal}
                  className="flex items-center gap-1.5 px-3 py-2 bg-orange hover:bg-orange/90 rounded-lg text-xs font-oswald font-semibold uppercase tracking-wider transition-colors text-white"
                  title="Mark as Completed"
                >
                  <CheckCircle2 size={14} />
                  Mark Complete
                </button>
              )}
              <button
                onClick={handleDownloadPDF}
                className="flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-oswald uppercase tracking-wider transition-colors"
                title="Download as PDF"
              >
                <Download size={14} />
                PDF
              </button>
              <button
                onClick={() => window.print()}
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                title="Print plan"
              >
                <Printer size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Ice Stripe */}
        <div className="ice-stripe mb-6 rounded-b-full" />

        {/* Coaching Summary */}
        {plan.plan_data?.coaching_summary && (
          <div className="bg-white rounded-xl border border-teal/20 p-5 mb-4">
            <h3 className="text-xs font-oswald uppercase tracking-wider text-teal mb-2">Practice Overview</h3>
            <p className="text-sm text-navy/80 leading-relaxed">{plan.plan_data.coaching_summary}</p>
          </div>
        )}

        {/* Phase Sections */}
        {phases.length > 0 ? (
          <div className="space-y-4">
            {phases.map((phase, phaseIdx) => {
              const ps = PHASE_STYLES[phase.phase] || PHASE_STYLES.skill_work;
              const time = runningTimes[phaseIdx];

              return (
                <div key={phaseIdx} className="bg-white rounded-xl border border-teal/20 overflow-hidden">
                  {/* Phase Header */}
                  <div className={`flex items-center justify-between px-5 py-3 ${ps.bg} border-b border-teal/10`}>
                    <div className="flex items-center gap-3">
                      <span className={`text-sm font-oswald font-bold uppercase tracking-wider ${ps.accent}`}>
                        {PRACTICE_PHASES[phase.phase] || phase.phase_label || phase.phase}
                      </span>
                      <span className="text-xs text-muted">
                        {phase.duration_minutes} min
                      </span>
                    </div>
                    <span className="text-[10px] font-oswald text-muted/60 uppercase tracking-wider">
                      {time.start}–{time.end} min
                    </span>
                  </div>

                  {/* Drills in Phase */}
                  <div className="divide-y divide-border/30">
                    {phase.drills?.map((drill, drillIdx) => {
                      // Type assertion for extra joined fields from junction fallback
                      const d = drill as typeof drill & {
                        drill_category?: string;
                        drill_description?: string;
                        drill_coaching_points?: string;
                        drill_setup?: string;
                        drill_intensity?: string;
                        drill_ice_surface?: string;
                        drill_equipment?: string;
                        drill_diagram_url?: string | null;
                      };
                      const ic = d.drill_intensity ? INTENSITY_COLORS[d.drill_intensity] : null;

                      return (
                        <div key={drillIdx} className="px-5 py-4">
                          <div className="flex items-start justify-between mb-1">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <span className="text-xs font-oswald font-bold text-navy/30 w-5 shrink-0">
                                {drillIdx + 1}
                              </span>
                              <h4 className="text-sm font-bold text-navy truncate">
                                {d.drill_name}
                              </h4>
                              {d.drill_category && (
                                <span className="hidden sm:inline-flex px-1.5 py-0.5 rounded text-[9px] font-oswald uppercase tracking-wider bg-teal/10 text-teal font-bold shrink-0">
                                  {DRILL_CATEGORIES[d.drill_category] || d.drill_category}
                                </span>
                              )}
                              {ic && (
                                <span className={`hidden sm:inline-flex px-1.5 py-0.5 rounded text-[9px] font-oswald uppercase tracking-wider font-bold shrink-0 ${ic.bg} ${ic.text}`}>
                                  {ic.label}
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-muted shrink-0 ml-2 flex items-center gap-1">
                              <Clock size={10} />
                              {d.duration_minutes} min
                            </span>
                          </div>

                          {/* Drill Diagram */}
                          {d.drill_diagram_url && (
                            <div className="ml-7 mt-2 mb-1">
                              <img
                                src={assetUrl(d.drill_diagram_url)}
                                alt={`${d.drill_name} diagram`}
                                className="max-w-[300px] max-h-36 object-contain rounded border border-teal/8 bg-white p-1"
                              />
                            </div>
                          )}

                          {/* Drill details */}
                          {d.drill_setup && (
                            <div className="ml-7 mt-2">
                              <span className="text-[10px] font-oswald uppercase tracking-wider text-muted">Setup: </span>
                              <span className="text-xs text-navy/60">{d.drill_setup}</span>
                            </div>
                          )}

                          {d.drill_description && (
                            <p className="ml-7 mt-1 text-xs text-navy/70 leading-relaxed">{d.drill_description}</p>
                          )}

                          {d.drill_coaching_points && (
                            <div className="ml-7 mt-2">
                              <span className="text-[10px] font-oswald uppercase tracking-wider text-teal">Coaching Points: </span>
                              <span className="text-xs text-navy/60">{d.drill_coaching_points}</span>
                            </div>
                          )}

                          {/* AI coaching notes for this specific drill in the plan */}
                          {d.coaching_notes && (
                            <div className="ml-7 mt-2 pl-3 border-l-2 border-orange/30">
                              <span className="text-[10px] font-oswald uppercase tracking-wider text-orange">Plan Notes: </span>
                              <span className="text-xs text-navy/60 italic">{d.coaching_notes}</span>
                            </div>
                          )}

                          {/* Extra metadata row */}
                          {(d.drill_ice_surface || d.drill_equipment) && (
                            <div className="ml-7 mt-2 flex items-center gap-3 text-[10px] text-muted/60">
                              {d.drill_ice_surface && (
                                <span>{ICE_SURFACES[d.drill_ice_surface] || d.drill_ice_surface}</span>
                              )}
                              {d.drill_equipment && d.drill_equipment !== "None" && (
                                <span>Equipment: {d.drill_equipment}</span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-teal/20 p-8 text-center">
            <ClipboardList size={32} className="mx-auto text-muted/40 mb-3" />
            <p className="text-muted text-sm">No practice plan content available.</p>
          </div>
        )}

        {/* Notes */}
        {plan.notes && (
          <div className="mt-4 bg-white rounded-xl border border-teal/20 p-5">
            <h3 className="text-xs font-oswald uppercase tracking-wider text-muted mb-2">Notes</h3>
            <p className="text-sm text-navy/70 leading-relaxed">{plan.notes}</p>
          </div>
        )}

        {/* Completion result banner */}
        {completionResult && (
          <div className="mt-4 bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3 print:hidden">
            <CheckCircle2 size={20} className="text-green-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-green-800">Practice Completed</p>
              <p className="text-xs text-green-700 mt-1">
                {completionResult.players_logged} player{completionResult.players_logged !== 1 ? "s" : ""} logged, {completionResult.total_drill_logs} drill log{completionResult.total_drill_logs !== 1 ? "s" : ""} recorded.
              </p>
              <Link
                href={`/practice-sessions/${completionResult.session_id}`}
                className="text-xs text-teal hover:underline mt-1 inline-block"
              >
                View Session Report
              </Link>
            </div>
          </div>
        )}

        {plan.status === "completed" && !completionResult && (
          <div className="mt-4 bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-2 print:hidden">
            <CheckCircle2 size={16} className="text-green-600" />
            <span className="text-xs font-bold text-green-800">Completed</span>
          </div>
        )}

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-teal/20">
          <div className="ice-stripe rounded-full mb-4" />
          <div className="flex items-center justify-between text-xs text-muted">
            <span className="font-oswald uppercase tracking-wider">ProspectX Intelligence</span>
            <span>{new Date(plan.created_at).toLocaleDateString()}</span>
          </div>
        </div>

        {/* Completion Modal */}
        {showCompleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 print:hidden">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between p-4 border-b border-border">
                <h2 className="text-sm font-oswald font-bold uppercase tracking-wider text-navy">Mark Practice Complete</h2>
                <button onClick={() => setShowCompleteModal(false)} className="p-1 hover:bg-gray-100 rounded">
                  <X size={16} className="text-muted" />
                </button>
              </div>

              <div className="p-4 space-y-4">
                {/* Attendance checklist */}
                {rosterPlayers.length > 0 && (
                  <div>
                    <p className="text-xs font-oswald uppercase tracking-wider text-muted mb-2">
                      Attendance ({rosterPlayers.filter((p) => p.checked).length}/{rosterPlayers.length})
                    </p>
                    <div className="space-y-1 max-h-48 overflow-y-auto border border-border rounded-lg p-2">
                      {rosterPlayers.map((p) => (
                        <label key={p.id} className="flex items-center gap-2 py-1 px-2 rounded hover:bg-gray-50 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={p.checked}
                            onChange={() =>
                              setRosterPlayers((prev) =>
                                prev.map((rp) => (rp.id === p.id ? { ...rp, checked: !rp.checked } : rp))
                              )
                            }
                            className="rounded border-border text-teal focus:ring-teal"
                          />
                          <span className="text-sm text-navy">{p.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Session note */}
                <div>
                  <label className="text-xs font-oswald uppercase tracking-wider text-muted mb-1 block">
                    Session Note (optional)
                  </label>
                  <textarea
                    value={sessionNote}
                    onChange={(e) => setSessionNote(e.target.value)}
                    placeholder="Any notes about today's practice..."
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm resize-none"
                    rows={3}
                  />
                </div>
              </div>

              <div className="p-4 border-t border-border flex justify-end gap-2">
                <button
                  onClick={() => setShowCompleteModal(false)}
                  className="px-4 py-2 text-sm text-muted hover:text-navy transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCompleteSession}
                  disabled={completing}
                  className="flex items-center gap-2 px-4 py-2 bg-orange text-white text-sm font-oswald font-semibold uppercase tracking-wider rounded-lg hover:bg-orange/90 disabled:opacity-50 transition-colors"
                >
                  {completing ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                  Complete Session
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </ProtectedRoute>
  );
}
