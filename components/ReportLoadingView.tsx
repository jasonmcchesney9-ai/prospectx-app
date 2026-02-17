/**
 * ReportLoadingView — Full-screen loading overlay for report generation
 *
 * Features:
 *   - HockeyRink SVG with scan animation
 *   - Progress bar with animated fill
 *   - Step indicators showing generation pipeline stages
 *   - Player/report type context display
 *   - Smooth transitions between steps
 */
"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Database, Brain, FileText, Sparkles } from "lucide-react";
import HockeyRink from "./HockeyRink";

interface Props {
  /** Current generation state */
  state: "submitting" | "polling";
  /** Player or team name being reported on */
  subjectName?: string;
  /** Report type label */
  reportType?: string;
}

const STEPS = [
  { id: "submit", label: "Submitting request", icon: Database },
  { id: "gather", label: "Gathering player data", icon: Database },
  { id: "analyze", label: "AI analyzing intel", icon: Brain },
  { id: "generate", label: "Generating report", icon: FileText },
  { id: "finalize", label: "Finalizing document", icon: Sparkles },
] as const;

export default function ReportLoadingView({ state, subjectName, reportType }: Props) {
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);

  // Simulate step progression based on time
  useEffect(() => {
    if (state === "submitting") {
      setCurrentStep(0);
      setProgress(5);
      return;
    }

    // Once polling, advance through steps on a timer
    // Steps: gather (2s) → analyze (5s) → generate (8s) → finalize (stays until redirect)
    const timers: ReturnType<typeof setTimeout>[] = [];

    // Step 1 → gather data
    setCurrentStep(1);
    setProgress(15);

    timers.push(setTimeout(() => {
      setCurrentStep(2);
      setProgress(35);
    }, 2000));

    timers.push(setTimeout(() => {
      setProgress(50);
    }, 4000));

    timers.push(setTimeout(() => {
      setCurrentStep(3);
      setProgress(65);
    }, 6000));

    timers.push(setTimeout(() => {
      setProgress(80);
    }, 9000));

    timers.push(setTimeout(() => {
      setCurrentStep(4);
      setProgress(90);
    }, 12000));

    // Slowly creep toward 95
    timers.push(setTimeout(() => {
      setProgress(95);
    }, 16000));

    return () => timers.forEach(clearTimeout);
  }, [state]);

  return (
    <div className="fixed inset-0 z-50 bg-navy/95 backdrop-blur-sm flex items-center justify-center">
      <div className="w-full max-w-lg mx-4 flex flex-col items-center text-center">
        {/* Rink Animation */}
        <div className="mb-8">
          <HockeyRink size="full" animate={true} />
        </div>

        {/* Subject Info */}
        <div className="mb-6">
          <h2 className="text-xl font-oswald font-bold text-white uppercase tracking-wider mb-1">
            Generating Report
          </h2>
          {(subjectName || reportType) && (
            <p className="text-sm text-teal/80">
              {reportType && <span className="font-oswald uppercase tracking-wider">{reportType}</span>}
              {reportType && subjectName && <span className="text-white/30 mx-2">•</span>}
              {subjectName && <span className="text-white/70">{subjectName}</span>}
            </p>
          )}
        </div>

        {/* Progress Bar */}
        <div className="w-full max-w-md mb-8">
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-teal to-teal/70 rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between mt-1.5">
            <span className="text-[10px] text-white/40 font-oswald uppercase tracking-wider">
              {STEPS[currentStep]?.label || "Processing..."}
            </span>
            <span className="text-[10px] text-white/40 font-mono">
              {progress}%
            </span>
          </div>
        </div>

        {/* Step Indicators */}
        <div className="w-full max-w-sm space-y-2">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            const isActive = i === currentStep;
            const isDone = i < currentStep;

            return (
              <div
                key={step.id}
                className={`flex items-center gap-3 px-3 py-1.5 rounded-lg transition-all duration-500 ${
                  isActive
                    ? "bg-teal/15 text-teal"
                    : isDone
                    ? "text-white/40"
                    : "text-white/15"
                }`}
              >
                <div className={`flex items-center justify-center w-6 h-6 rounded-full transition-all duration-500 ${
                  isDone
                    ? "bg-teal/20"
                    : isActive
                    ? "bg-teal/30 ring-2 ring-teal/40"
                    : "bg-white/5"
                }`}>
                  {isDone ? (
                    <CheckCircle2 size={13} className="text-teal" />
                  ) : (
                    <Icon size={12} className={isActive ? "animate-pulse" : ""} />
                  )}
                </div>
                <span className={`text-xs font-oswald uppercase tracking-wider ${
                  isActive ? "font-semibold" : ""
                }`}>
                  {step.label}
                </span>
                {isActive && (
                  <div className="ml-auto flex gap-0.5">
                    <span className="w-1 h-1 rounded-full bg-teal animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1 h-1 rounded-full bg-teal animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1 h-1 rounded-full bg-teal animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Bottom message */}
        <p className="mt-8 text-[10px] text-white/25 font-oswald uppercase tracking-widest">
          ProspectX Intelligence Engine
        </p>
      </div>
    </div>
  );
}
