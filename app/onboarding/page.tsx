"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Loader2, ArrowRight, LogIn } from "lucide-react";
import ProtectedRoute from "@/components/ProtectedRoute";
import api from "@/lib/api";
import { getUser, setUser } from "@/lib/auth";
import type { OnboardingState } from "@/types/api";
import StepRole from "@/components/onboarding/StepRole";
import StepPlayers from "@/components/onboarding/StepPlayers";
import StepComplete from "@/components/onboarding/StepComplete";

const STEPS = [
  { label: "Welcome", number: 1 },
  { label: "Dashboard", number: 2 },
  { label: "Import", number: 3 },
  { label: "Done", number: 4 },
];

// ── All available widgets by ID ────────────────────────────────
const ALL_WIDGETS: { id: string; label: string; staffOnly?: boolean }[] = [
  { id: "roster_overview", label: "Roster Overview", staffOnly: true },
  { id: "standings", label: "Standings" },
  { id: "recent_reports", label: "Recent Reports" },
  { id: "active_series", label: "Active Series", staffOnly: true },
  { id: "chalk_talk", label: "Chalk Talk", staffOnly: true },
  { id: "scouting_list", label: "Watchlist", staffOnly: true },
  { id: "top_prospects", label: "Top Prospects", staffOnly: true },
  { id: "scoring_leaders", label: "Scoring Leaders" },
  { id: "wall_board", label: "Wall Board", staffOnly: true },
  { id: "quick_actions", label: "Quick Actions" },
  { id: "scorebar", label: "Live Scorebar" },
  { id: "schedule", label: "Upcoming Schedule" },
  { id: "dev_plans_needed", label: "Dev Plans Needed", staffOnly: true },
  { id: "practice_plans", label: "Practice Plans", staffOnly: true },
  { id: "draft_board", label: "Draft Board", staffOnly: true },
  { id: "broadcast_hub", label: "Broadcast Hub" },
  { id: "my_profile", label: "My Profile" },
  { id: "my_player", label: "My Player" },
  { id: "my_clients", label: "My Clients" },
  { id: "messages", label: "Messages" },
  { id: "dev_plan", label: "Dev Plan" },
];

// Role-default widget presets (mirrors backend ROLE_DEFAULT_WIDGETS)
const ROLE_DEFAULTS: Record<string, string[]> = {
  gm: ["roster_overview", "standings", "recent_reports", "active_series", "chalk_talk", "scouting_list", "top_prospects", "scoring_leaders", "wall_board", "quick_actions", "scorebar", "schedule"],
  coach: ["roster_overview", "scoring_leaders", "active_series", "chalk_talk", "practice_plans", "dev_plans_needed", "schedule", "scorebar", "quick_actions"],
  scout: ["scouting_list", "recent_reports", "top_prospects", "wall_board", "draft_board", "scoring_leaders", "schedule", "scorebar", "quick_actions"],
  analyst: ["scoring_leaders", "standings", "recent_reports", "top_prospects", "schedule", "scorebar"],
  admin: ["roster_overview", "standings", "recent_reports", "scouting_list", "scoring_leaders", "schedule", "scorebar", "quick_actions"],
  broadcaster: ["scoring_leaders", "schedule", "recent_reports", "scorebar", "broadcast_hub"],
  player: ["my_profile", "schedule", "messages", "dev_plan"],
  parent: ["my_player", "schedule", "messages", "recent_reports"],
  agent: ["my_clients", "recent_reports", "schedule", "messages", "scouting_list"],
};

// Staff roles (PRO group) that see the Import step
const STAFF_ROLES = new Set(["scout", "coach", "gm", "analyst", "admin"]);

interface WizardData {
  preferredLeague: string | null;
  preferredTeamId: string | null;
  teamName: string | null;
  teamLeagueName: string | null;
  teamLogo: string | null;
  hockeyRole: string;
  linkedPlayerId: string | null;
  coveredTeams: string[];
  scheduleConnected: boolean;
  rosterCount: number;
  selectedWidgets: string[];
}

const DEFAULT_WIZARD_DATA: WizardData = {
  preferredLeague: null,
  preferredTeamId: null,
  teamName: null,
  teamLeagueName: null,
  teamLogo: null,
  hockeyRole: "scout",
  linkedPlayerId: null,
  coveredTeams: [],
  scheduleConnected: false,
  rosterCount: 0,
  selectedWidgets: [],
};

export default function OnboardingPage() {
  return (
    <ProtectedRoute>
      <OnboardingWizard />
    </ProtectedRoute>
  );
}

function OnboardingWizard() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [wizardData, setWizardData] = useState<WizardData>(DEFAULT_WIZARD_DATA);

  // Load saved onboarding state on mount
  useEffect(() => {
    const loadState = async () => {
      try {
        const { data } = await api.get<OnboardingState>("/onboarding/state");
        if (data.onboarding_completed) {
          router.replace("/");
          return;
        }
        const resumeStep = Math.max(1, Math.min((data.onboarding_step || 0) + 1, 4));
        setCurrentStep(resumeStep);
        const role = data.hockey_role || "scout";
        setWizardData((prev) => ({
          ...prev,
          preferredLeague: data.preferred_league,
          preferredTeamId: data.preferred_team_id,
          hockeyRole: role,
          linkedPlayerId: data.linked_player_id,
          coveredTeams: data.covered_teams || [],
          selectedWidgets: ROLE_DEFAULTS[role] || ROLE_DEFAULTS.scout,
        }));
      } catch {
        // If state fails, start from step 1
      } finally {
        setLoading(false);
      }
    };
    loadState();
  }, [router]);

  const updateWizardData = useCallback((updates: Partial<WizardData>) => {
    setWizardData((prev) => ({ ...prev, ...updates }));
  }, []);

  const saveStep = useCallback(
    async (stepNumber: number) => {
      setSaving(true);
      try {
        const body: Record<string, unknown> = {};
        // Step 1 (Welcome): save role selection
        if (stepNumber === 1) {
          body.hockey_role = wizardData.hockeyRole;
        }
        // Step 2 (Dashboard): no backend save needed — widgets saved on complete
        // Step 3 (Import): save linked player / covered teams if set
        else if (stepNumber === 3) {
          if (wizardData.linkedPlayerId) {
            body.linked_player_id = wizardData.linkedPlayerId;
          }
          if (wizardData.coveredTeams.length > 0) {
            body.covered_teams = wizardData.coveredTeams;
          }
        }
        await api.put(`/onboarding/step/${stepNumber}`, body);

        // Update localStorage user
        const user = getUser();
        if (user) {
          setUser({
            ...user,
            onboarding_step: stepNumber,
            ...(stepNumber === 1 ? { hockey_role: wizardData.hockeyRole } : {}),
          });
        }
      } catch {
        // Allow proceeding even if save fails
      } finally {
        setSaving(false);
      }
    },
    [wizardData]
  );

  const handleNext = useCallback(async () => {
    if (currentStep <= 3) {
      await saveStep(currentStep);
      let nextStep = currentStep + 1;
      // Auto-skip Import step (3) for non-staff roles
      if (nextStep === 3 && !STAFF_ROLES.has(wizardData.hockeyRole)) {
        nextStep = 4;
      }
      setCurrentStep(nextStep);
    }
  }, [currentStep, saveStep, wizardData.hockeyRole]);

  const handleBack = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep((s) => s - 1);
    }
  }, [currentStep]);

  const handleSkipStep = useCallback(async () => {
    // Allow skipping Import step (3) and Dashboard step (2)
    if (currentStep === 2 || currentStep === 3) {
      await saveStep(currentStep);
      setCurrentStep((s) => s + 1);
    }
  }, [currentStep, saveStep]);

  const handleSkipAll = useCallback(async () => {
    // Always update localStorage first to prevent redirect loops
    const user = getUser();
    if (user) {
      setUser({ ...user, onboarding_completed: true, onboarding_step: 4 });
    }
    try {
      await api.post("/onboarding/skip");
    } catch {
      // API fail is non-blocking — localStorage already updated
    }
    router.push("/");
  }, [router]);

  const handleComplete = useCallback(async () => {
    // Always update localStorage first to prevent redirect loops
    const user = getUser();
    if (user) {
      setUser({ ...user, onboarding_completed: true, onboarding_step: 4 });
    }
    try {
      // Save dashboard_layout along with onboarding completion
      await api.post("/onboarding/complete", {
        dashboard_layout: { widgets: wizardData.selectedWidgets },
      });
    } catch {
      // API fail is non-blocking — localStorage already updated
    }
    router.push("/");
  }, [router, wizardData.selectedWidgets]);

  // Can proceed to next step?
  const canProceed =
    currentStep === 1
      ? !!wizardData.hockeyRole // Step 1 (Welcome): must select a role
      : currentStep === 2
        ? wizardData.selectedWidgets.length > 0 // Step 2 (Dashboard): must have at least 1 widget
        : true;

  if (loading) {
    return (
      <div className="min-h-screen bg-navy flex items-center justify-center">
        <Loader2 className="animate-spin text-teal" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-navy flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4">
        <h1 className="font-oswald text-xl font-bold tracking-widest uppercase">
          <span className="text-teal">Prospect</span>
          <span className="text-orange">X</span>
        </h1>
        <div className="flex items-center gap-4">
          <Link
            href="/login"
            className="text-white/50 hover:text-white text-xs flex items-center gap-1.5 transition-colors"
          >
            <LogIn size={13} />
            Already have an account? <span className="text-teal font-semibold">Sign In</span>
          </Link>
          <button
            onClick={handleSkipAll}
            className="px-4 py-1.5 border border-white/20 rounded-lg text-white/60 hover:text-white hover:border-white/40 text-xs font-oswald uppercase tracking-wider flex items-center gap-1.5 transition-colors"
          >
            <ArrowRight size={13} />
            Skip to Dashboard
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center">
          {STEPS.map((step, i) => (
            <div key={step.number} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-oswald font-bold transition-all ${
                    currentStep > step.number
                      ? "bg-teal text-white"
                      : currentStep === step.number
                        ? "bg-teal text-white ring-2 ring-teal/40 ring-offset-2 ring-offset-navy"
                        : "bg-white/10 text-white/40"
                  }`}
                >
                  {currentStep > step.number ? <Check size={16} /> : step.number}
                </div>
                <span
                  className={`text-[10px] font-oswald uppercase tracking-wider mt-1.5 whitespace-nowrap ${
                    currentStep >= step.number ? "text-white/80" : "text-white/30"
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-2 mt-[-14px] ${
                    currentStep > step.number ? "bg-teal" : "bg-white/10"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <div className="flex-1 flex items-start justify-center px-4 pb-8 pt-2">
        <div className="w-full max-w-3xl">
          <div className="bg-white rounded-xl shadow-xl overflow-hidden">
            {/* Step 1 — Welcome: confirm role */}
            {currentStep === 1 && (
              <StepRole
                selectedRole={wizardData.hockeyRole}
                onSelect={(role) => updateWizardData({
                  hockeyRole: role,
                  selectedWidgets: ROLE_DEFAULTS[role] || ROLE_DEFAULTS.scout,
                })}
              />
            )}
            {/* Step 2 — Dashboard: choose widgets */}
            {currentStep === 2 && (
              <StepDashboardWidgets
                hockeyRole={wizardData.hockeyRole}
                selectedWidgets={wizardData.selectedWidgets}
                onToggle={(widgetId) => {
                  updateWizardData({
                    selectedWidgets: wizardData.selectedWidgets.includes(widgetId)
                      ? wizardData.selectedWidgets.filter((w) => w !== widgetId)
                      : [...wizardData.selectedWidgets, widgetId],
                  });
                }}
                onResetDefaults={() => {
                  updateWizardData({
                    selectedWidgets: ROLE_DEFAULTS[wizardData.hockeyRole] || ROLE_DEFAULTS.scout,
                  });
                }}
              />
            )}
            {/* Step 3 — Import (Staff only) */}
            {currentStep === 3 && (
              <StepPlayers
                hockeyRole={wizardData.hockeyRole}
                preferredLeague={wizardData.preferredLeague}
                preferredTeamId={wizardData.preferredTeamId}
                subscriptionTier={getUser()?.subscription_tier || "rookie"}
                linkedPlayerId={wizardData.linkedPlayerId}
                coveredTeams={wizardData.coveredTeams}
                onLinkedPlayerChange={(id) => updateWizardData({ linkedPlayerId: id })}
                onCoveredTeamsChange={(teams) => updateWizardData({ coveredTeams: teams })}
                onRosterSynced={(count) => updateWizardData({ rosterCount: count })}
              />
            )}
            {/* Step 4 — Done */}
            {currentStep === 4 && (
              <StepComplete
                teamName={wizardData.teamName}
                teamLogo={wizardData.teamLogo}
                hockeyRole={wizardData.hockeyRole}
                rosterCount={wizardData.rosterCount}
                scheduleConnected={wizardData.scheduleConnected}
                onFinish={handleComplete}
              />
            )}
          </div>

          {/* Navigation Buttons */}
          {currentStep < 4 && (
            <div className="flex items-center justify-between mt-6">
              <div>
                {currentStep > 1 && (
                  <button
                    onClick={handleBack}
                    className="px-5 py-2 text-white/60 hover:text-white font-oswald text-sm uppercase tracking-wider transition-colors"
                  >
                    Back
                  </button>
                )}
              </div>
              <div className="flex items-center gap-3">
                {(currentStep === 2 || currentStep === 3) && (
                  <button
                    onClick={handleSkipStep}
                    disabled={saving}
                    className="px-5 py-2 text-white/40 hover:text-white/70 font-oswald text-sm uppercase tracking-wider transition-colors disabled:opacity-50"
                  >
                    Skip
                  </button>
                )}
                <button
                  onClick={handleNext}
                  disabled={!canProceed || saving}
                  className="px-8 py-2.5 bg-teal text-white font-oswald font-semibold uppercase tracking-wider rounded-lg hover:bg-teal/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm flex items-center gap-2"
                >
                  {saving ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    "Next"
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Step 2: Dashboard Widget Picker ──────────────────────────
function StepDashboardWidgets({
  hockeyRole,
  selectedWidgets,
  onToggle,
  onResetDefaults,
}: {
  hockeyRole: string;
  selectedWidgets: string[];
  onToggle: (widgetId: string) => void;
  onResetDefaults: () => void;
}) {
  const isStaff = STAFF_ROLES.has(hockeyRole);

  // Filter widgets appropriate for this role
  const availableWidgets = ALL_WIDGETS.filter((w) => {
    if (w.staffOnly && !isStaff) return false;
    return true;
  });

  return (
    <div className="p-6">
      <h2 className="font-oswald text-lg font-bold text-navy uppercase tracking-wider mb-1">
        Your Dashboard
      </h2>
      <p className="text-sm text-muted mb-1">
        Choose which widgets appear on your dashboard. You can change this later.
      </p>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-muted">
          {selectedWidgets.length} widget{selectedWidgets.length !== 1 ? "s" : ""} selected
        </p>
        <button
          onClick={onResetDefaults}
          className="text-xs text-teal hover:text-teal/80 font-oswald uppercase tracking-wider transition-colors"
        >
          Reset to defaults
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {availableWidgets.map((widget) => {
          const isSelected = selectedWidgets.includes(widget.id);
          return (
            <button
              key={widget.id}
              onClick={() => onToggle(widget.id)}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-left text-sm transition-all ${
                isSelected
                  ? "border-teal bg-teal/5 text-navy font-medium"
                  : "border-border text-muted hover:border-teal/40 hover:bg-navy/[0.02]"
              }`}
            >
              <div
                className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                  isSelected
                    ? "bg-teal border-teal text-white"
                    : "border-border"
                }`}
              >
                {isSelected && <Check size={10} />}
              </div>
              <span className="truncate">{widget.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
