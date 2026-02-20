"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Loader2, ArrowRight, LogIn } from "lucide-react";
import ProtectedRoute from "@/components/ProtectedRoute";
import api from "@/lib/api";
import { getUser, setUser } from "@/lib/auth";
import type { OnboardingState } from "@/types/api";
import StepLeagueTeam from "@/components/onboarding/StepLeagueTeam";
import StepRole from "@/components/onboarding/StepRole";
import StepPlayers from "@/components/onboarding/StepPlayers";
import StepSchedule from "@/components/onboarding/StepSchedule";
import StepComplete from "@/components/onboarding/StepComplete";

const STEPS = [
  { label: "League & Team", number: 1 },
  { label: "Role", number: 2 },
  { label: "Players", number: 3 },
  { label: "Schedule", number: 4 },
  { label: "Ready!", number: 5 },
];

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
        const resumeStep = Math.max(1, Math.min((data.onboarding_step || 0) + 1, 5));
        setCurrentStep(resumeStep);
        setWizardData((prev) => ({
          ...prev,
          preferredLeague: data.preferred_league,
          preferredTeamId: data.preferred_team_id,
          hockeyRole: data.hockey_role || "scout",
          linkedPlayerId: data.linked_player_id,
          coveredTeams: data.covered_teams || [],
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
        if (stepNumber === 1) {
          body.preferred_league = wizardData.preferredLeague;
          body.preferred_team_id = wizardData.preferredTeamId;
          body.team_name = wizardData.teamName;
          body.team_league_name = wizardData.teamLeagueName;
        } else if (stepNumber === 2) {
          body.hockey_role = wizardData.hockeyRole;
        } else if (stepNumber === 3) {
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
            ...(stepNumber === 1
              ? {
                  preferred_league: wizardData.preferredLeague,
                  preferred_team_id: wizardData.preferredTeamId,
                }
              : {}),
            ...(stepNumber === 2 ? { hockey_role: wizardData.hockeyRole } : {}),
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
    if (currentStep <= 4) {
      await saveStep(currentStep);
      setCurrentStep((s) => s + 1);
    }
  }, [currentStep, saveStep]);

  const handleBack = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep((s) => s - 1);
    }
  }, [currentStep]);

  const handleSkipStep = useCallback(async () => {
    if (currentStep === 3 || currentStep === 4) {
      await saveStep(currentStep);
      setCurrentStep((s) => s + 1);
    }
  }, [currentStep, saveStep]);

  const handleSkipAll = useCallback(async () => {
    try {
      await api.post("/onboarding/skip");
      const user = getUser();
      if (user) {
        setUser({ ...user, onboarding_completed: true, onboarding_step: 5 });
      }
      router.push("/");
    } catch {
      router.push("/");
    }
  }, [router]);

  const handleComplete = useCallback(async () => {
    try {
      await api.post("/onboarding/complete");
      const user = getUser();
      if (user) {
        setUser({ ...user, onboarding_completed: true, onboarding_step: 5 });
      }
      router.push("/");
    } catch {
      router.push("/");
    }
  }, [router]);

  // Can proceed to next step?
  const canProceed =
    currentStep === 1
      ? !!(wizardData.preferredLeague && (wizardData.preferredTeamId || wizardData.teamName))
      : currentStep === 2
        ? !!wizardData.hockeyRole
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
            {currentStep === 1 && (
              <StepLeagueTeam
                selectedLeague={wizardData.preferredLeague}
                selectedTeamId={wizardData.preferredTeamId}
                onSelect={(league, teamId, teamName, teamLeagueName, teamLogo) => {
                  updateWizardData({
                    preferredLeague: league,
                    preferredTeamId: teamId,
                    teamName: teamName,
                    teamLeagueName: teamLeagueName,
                    teamLogo: teamLogo,
                  });
                }}
              />
            )}
            {currentStep === 2 && (
              <StepRole
                selectedRole={wizardData.hockeyRole}
                onSelect={(role) => updateWizardData({ hockeyRole: role })}
              />
            )}
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
            {currentStep === 4 && (
              <StepSchedule
                onFeedConnected={() => updateWizardData({ scheduleConnected: true })}
              />
            )}
            {currentStep === 5 && (
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
          {currentStep < 5 && (
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
                {(currentStep === 3 || currentStep === 4) && (
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
