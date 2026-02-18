"use client";

import { useState } from "react";
import { ArrowLeftRight } from "lucide-react";

/* ---------- Translation Dictionary ---------- */
// Maps coach/technical phrases → parent-friendly equivalents.
// Patterns are checked via case-insensitive substring match.
const TRANSLATIONS: [RegExp, string | ((...args: string[]) => string)][] = [
  // Defensive
  [/weakside defensive support late/gi, "needs to arrive sooner to help teammates defend"],
  [/defensive zone coverage/gi, "positioning when the other team has the puck in your end"],
  [/d-zone coverage/gi, "positioning when defending in your own end"],
  [/gap control/gi, "how well they close distance on attackers"],
  [/back-check effort/gi, "hustle getting back to help on defense"],
  [/backcheck/gi, "skating back to help defend"],
  [/backchecking/gi, "skating back to help on defense"],
  [/neutral zone play/gi, "play through the middle of the ice"],
  [/board battle/gi, "competing for the puck along the boards"],
  [/puck battle/gi, "competing for loose pucks"],

  // Offensive
  [/transition game trending up/gi, "getting better at moving from defense to offense quickly"],
  [/slot presence on PP needs work/gi, "needs to get more comfortable standing in front of the net on power plays"],
  [/slot presence/gi, "getting to the dangerous scoring area in front of the net"],
  [/net-front presence/gi, "positioning in front of the opponent's net"],
  [/cycle game/gi, "moving the puck around in the offensive zone to create chances"],
  [/puck distribution/gi, "passing the puck to teammates"],
  [/puck protection/gi, "keeping control of the puck under pressure"],
  [/offensive zone time/gi, "time spent attacking in the opponent's end"],
  [/zone entries/gi, "getting the puck into the offensive zone"],
  [/zone entry/gi, "carrying the puck into the offensive zone"],
  [/controlled entry/gi, "carrying the puck into the offensive zone with control"],
  [/dump and chase/gi, "shooting the puck in and chasing after it"],

  // Skating
  [/edge work/gi, "control on skates, turning, and balance"],
  [/lateral mobility/gi, "ability to move side-to-side quickly"],
  [/first three strides/gi, "explosive starting speed"],
  [/acceleration/gi, "how quickly they get up to speed"],
  [/top-end speed/gi, "maximum skating speed"],
  [/crossovers/gi, "skating technique for turning and gaining speed"],

  // Hockey IQ
  [/hockey sense/gi, "ability to read the game and make smart decisions"],
  [/hockey IQ/gi, "game smarts — reading plays and making good decisions"],
  [/anticipation/gi, "ability to predict what's going to happen next"],
  [/vision/gi, "ability to see the whole ice and find teammates"],
  [/compete level/gi, "effort and intensity during the game"],

  // Stats
  [/PPG\b/gi, "points per game"],
  [/\bPP\b/g, "power play"],
  [/\bPK\b/g, "penalty kill"],
  [/\bSV%/gi, "save percentage"],
  [/\bGAA\b/gi, "goals against average"],
  [/\bCF%/gi, "shot attempt share (possession metric)"],
  [/\bxG\b/gi, "expected goals (shot quality metric)"],
  [/\+\/-/g, "plus/minus"],
  [/\bPIM\b/g, "penalty minutes"],
  [/\bTOI\b/gi, "time on ice"],
  [/\bFO%/gi, "faceoff win percentage"],

  // Percentiles
  [/(\d+)(st|nd|rd|th) percentile/gi, (_match, num) => {
    const n = parseInt(num);
    if (n >= 80) return `top ${100 - n}% — excellent for this level`;
    if (n >= 60) return `above average for this level`;
    if (n >= 40) return `around average for this level`;
    if (n >= 20) return `below average — room to grow`;
    return `needs significant development`;
  }],

  // Systems
  [/\bforecheck\b/gi, "pressuring the other team to win the puck back"],
  [/\bbreakout\b/gi, "moving the puck out of your own zone"],
  [/power play unit/gi, "the group of players on the ice during a power play"],
  [/\b1-3-1\b/g, "a formation used on the power play or in defensive setups"],
  [/\btrap\b/gi, "a defensive system that clogs the middle of the ice"],
];

/**
 * Translates a coach-speak string into parent-friendly language.
 */
export function translateToParent(text: string): string {
  let result = text;
  for (const [pattern, replacement] of TRANSLATIONS) {
    if (typeof replacement === "string") {
      result = result.replace(pattern, replacement);
    } else {
      result = result.replace(pattern, replacement as (...args: string[]) => string);
    }
  }
  return result;
}

/* ---------- Toggle Component ---------- */
interface TranslatorToggleProps {
  /** Current mode: "coach" = original text, "parent" = simplified */
  mode: "coach" | "parent";
  onToggle: () => void;
  className?: string;
}

export default function TranslatorToggle({ mode, onToggle, className = "" }: TranslatorToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all border ${
        mode === "parent"
          ? "bg-teal/10 text-teal border-teal/20 hover:bg-teal/20"
          : "bg-navy/5 text-navy/70 border-navy/10 hover:bg-navy/10"
      } ${className}`}
    >
      <ArrowLeftRight size={10} />
      {mode === "coach" ? "Parent View" : "Coach View"}
    </button>
  );
}

/* ---------- Hook for easy use ---------- */
export function useTranslatorToggle(defaultMode: "coach" | "parent" = "parent") {
  const [mode, setMode] = useState<"coach" | "parent">(defaultMode);
  const toggle = () => setMode((m) => (m === "coach" ? "parent" : "coach"));
  const translate = (text: string) => (mode === "parent" ? translateToParent(text) : text);
  return { mode, toggle, translate };
}
