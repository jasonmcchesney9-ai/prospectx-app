"use client";

import { useState } from "react";
import {
  Heart,
  XCircle,
  CheckCircle2,
  Lightbulb,
  AlertTriangle,
  ArrowLeft,
  RefreshCw,
} from "lucide-react";
import api from "@/lib/api";
import HockeyRink from "@/components/HockeyRink";
import type { PressureConfidenceResponse } from "@/types/api";

/* ---------- Scenarios ---------- */
const SCENARIOS = [
  { label: "After a bad game", emoji: "😔", color: "bg-red-50 border-red-200 text-red-800" },
  { label: "During a scoring slump", emoji: "📉", color: "bg-orange-50 border-orange-200 text-orange-800" },
  { label: "After being benched", emoji: "🪑", color: "bg-amber-50 border-amber-200 text-amber-800" },
  { label: "Before a big game / showcase", emoji: "🏟️", color: "bg-blue-50 border-blue-200 text-blue-800" },
  { label: "After a playoff loss", emoji: "💔", color: "bg-purple-50 border-purple-200 text-purple-800" },
  { label: "When they want to quit", emoji: "🚪", color: "bg-gray-50 border-gray-300 text-gray-800" },
  { label: "After a mistake that cost a game", emoji: "😖", color: "bg-red-50 border-red-200 text-red-800" },
  { label: "Dealing with a tough coach", emoji: "🗣️", color: "bg-indigo-50 border-indigo-200 text-indigo-800" },
];

export default function PressureConfidenceTool() {
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null);
  const [result, setResult] = useState<PressureConfidenceResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSelectScenario(scenario: string) {
    setSelectedScenario(scenario);
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const { data } = await api.post<PressureConfidenceResponse>(
        "/player-guide/pressure-confidence",
        { scenario }
      );
      setResult(data);
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail;
      setError(
        typeof detail === "string"
          ? detail
          : "Failed to generate guidance. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setSelectedScenario(null);
    setResult(null);
    setError("");
  }

  /* ── Scenario Selector Grid ── */
  if (!selectedScenario) {
    return (
      <div className="space-y-4">
        <div>
          <h4 className="text-sm font-oswald uppercase tracking-wider text-navy mb-1">
            What&apos;s happening?
          </h4>
          <p className="text-[10px] text-gray-400 mb-3">
            Select a situation and PXI will generate specific guidance for you.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {SCENARIOS.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => handleSelectScenario(s.label)}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-all hover:shadow-sm hover:scale-[1.01] active:scale-[0.99] ${s.color}`}
            >
              <span className="text-lg">{s.emoji}</span>
              <span className="text-xs font-medium">{s.label}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  /* ── Loading State ── */
  if (loading) {
    return (
      <div className="flex flex-col items-center py-8 gap-3">
        <HockeyRink size="card" />
        <p className="text-xs text-gray-400">
          Generating support guidance...
        </p>
        <p className="text-[10px] text-gray-300">
          Scenario: {selectedScenario}
        </p>
      </div>
    );
  }

  /* ── Error State ── */
  if (error) {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3">
          <AlertTriangle size={14} className="text-red-500 mt-0.5 shrink-0" />
          <p className="text-xs text-red-700">{error}</p>
        </div>
        <button
          type="button"
          onClick={handleReset}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-navy transition-colors"
        >
          <ArrowLeft size={12} />
          Try another scenario
        </button>
      </div>
    );
  }

  /* ── Results Display ── */
  if (!result) return null;

  return (
    <div className="space-y-4">
      {/* Scenario header + back button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm">
            {SCENARIOS.find((s) => s.label === selectedScenario)?.emoji || "💬"}
          </span>
          <span className="text-xs font-bold text-navy">{selectedScenario}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleSelectScenario(selectedScenario)}
            className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-gray-500 hover:text-navy hover:bg-navy/5 transition-colors"
          >
            <RefreshCw size={10} />
            Regenerate
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-gray-500 hover:text-navy hover:bg-navy/5 transition-colors"
          >
            <ArrowLeft size={10} />
            Back
          </button>
        </div>
      </div>

      {/* 1. What They're Feeling */}
      <div className="bg-blue-50/50 rounded-lg border border-blue-200 p-4">
        <div className="flex items-center gap-1.5 mb-2">
          <Heart size={13} className="text-blue-600" />
          <span className="text-[10px] font-oswald uppercase tracking-wider text-blue-700 font-bold">
            What Your Player Might Be Feeling
          </span>
        </div>
        <p className="text-xs text-blue-800 leading-relaxed">{result.feeling}</p>
      </div>

      {/* 2. What NOT to Say */}
      <div className="bg-red-50/50 rounded-lg border border-red-200 p-4">
        <div className="flex items-center gap-1.5 mb-2">
          <XCircle size={13} className="text-red-500" />
          <span className="text-[10px] font-oswald uppercase tracking-wider text-red-600 font-bold">
            What Not to Say
          </span>
        </div>
        <ul className="space-y-1.5">
          {result.dont_say.map((item, i) => (
            <li
              key={i}
              className="text-xs text-red-700 leading-relaxed flex items-start gap-1.5"
            >
              <span className="text-red-400 mt-0.5 shrink-0">✗</span>
              {item}
            </li>
          ))}
        </ul>
      </div>

      {/* 3. What to Say Instead */}
      <div className="bg-green-50/50 rounded-lg border border-green-200 p-4">
        <div className="flex items-center gap-1.5 mb-2">
          <CheckCircle2 size={13} className="text-green-600" />
          <span className="text-[10px] font-oswald uppercase tracking-wider text-green-700 font-bold">
            What to Say Instead
          </span>
        </div>
        <ul className="space-y-1.5">
          {result.say_instead.map((item, i) => (
            <li
              key={i}
              className="text-xs text-green-800 leading-relaxed flex items-start gap-1.5"
            >
              <span className="text-green-500 mt-0.5 shrink-0">✓</span>
              {item}
            </li>
          ))}
        </ul>
      </div>

      {/* 4. Activity to Try */}
      <div className="bg-amber-50/50 rounded-lg border border-amber-200 p-4">
        <div className="flex items-center gap-1.5 mb-2">
          <Lightbulb size={13} className="text-amber-600" />
          <span className="text-[10px] font-oswald uppercase tracking-wider text-amber-700 font-bold">
            Activity to Try
          </span>
        </div>
        <p className="text-xs text-amber-800 leading-relaxed">{result.activity}</p>
      </div>

      {/* 5. When to Be Concerned */}
      <div className="bg-purple-50/50 rounded-lg border border-purple-200 p-4">
        <div className="flex items-center gap-1.5 mb-2">
          <AlertTriangle size={13} className="text-purple-600" />
          <span className="text-[10px] font-oswald uppercase tracking-wider text-purple-700 font-bold">
            When to Be Concerned
          </span>
        </div>
        <p className="text-xs text-purple-800 leading-relaxed">{result.concern_signs}</p>
      </div>

      {/* Professional referral */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
        <p className="text-[10px] text-gray-400 leading-relaxed">
          <span className="font-bold">Remember:</span> Seeking help from a sports psychologist
          is a strength move, not a weakness. The best players in the world invest in their
          mental game. If you&apos;re unsure, talk to your player&apos;s coach or pediatrician
          for a referral.
        </p>
      </div>
    </div>
  );
}
