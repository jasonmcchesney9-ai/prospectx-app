"use client";

import { useState } from "react";
import { Car, Check, X, ChevronRight, MessageCircle } from "lucide-react";
import api from "@/lib/api";

interface CarRideScriptData {
  title: string;
  opening: string;
  say_this: string[];
  avoid_this: string[];
  parent_tip: string;
  player_name?: string;
  age_band?: string;
  age_note?: string;
}

const OUTCOMES = [
  { id: "win_good", label: "Win \u2014 Felt Good", emoji: "\u{1F60A}", desc: "Player is happy after a win" },
  { id: "win_okay", label: "Win \u2014 Seemed Flat", emoji: "\u{1F614}", desc: "Team won but player is quiet" },
  { id: "loss_tough", label: "Tough Loss", emoji: "\u{1F61E}", desc: "Hard game, player is disappointed" },
  { id: "loss_mistake", label: "Loss \u2014 Made a Mistake", emoji: "\u{1F62D}", desc: "Player feels responsible" },
  { id: "scratched", label: "Scratched / Low Ice Time", emoji: "\u{1F620}", desc: "Sat out or barely played" },
];

export default function CarRideScript() {
  const [selectedOutcome, setSelectedOutcome] = useState<string | null>(null);
  const [script, setScript] = useState<CarRideScriptData | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSelect(outcomeId: string) {
    setSelectedOutcome(outcomeId);
    setLoading(true);
    try {
      const { data } = await api.post<CarRideScriptData>("/family/car-ride-script", {
        outcome: outcomeId,
      });
      setScript(data);
    } catch {
      setScript(null);
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setSelectedOutcome(null);
    setScript(null);
  }

  return (
    <div className="bg-white rounded-xl border border-teal/20 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-rose-50/50 border-b border-teal/20">
        <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center">
          <Car size={16} className="text-rose-600" />
        </div>
        <div>
          <h3 className="text-sm font-oswald uppercase tracking-wider text-navy font-bold">
            After Game Help
          </h3>
          <p className="text-[10px] text-gray-400">
            Car ride scripts \u2014 what to say, what to avoid, and age-appropriate tips
          </p>
        </div>
      </div>

      {!selectedOutcome ? (
        /* ── Outcome Selector ── */
        <div className="p-4">
          <p className="text-xs text-muted mb-3">How did the game go? Select the situation:</p>
          <div className="space-y-2">
            {OUTCOMES.map((o) => (
              <button
                key={o.id}
                onClick={() => handleSelect(o.id)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-teal/20 bg-white text-left hover:bg-teal/5 hover:border-teal/30 transition-all group"
              >
                <span className="text-xl shrink-0">{o.emoji}</span>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-navy block">{o.label}</span>
                  <span className="text-[10px] text-muted">{o.desc}</span>
                </div>
                <ChevronRight size={14} className="text-gray-300 group-hover:text-teal transition-colors shrink-0" />
              </button>
            ))}
          </div>
        </div>
      ) : loading ? (
        /* ── Loading ── */
        <div className="flex flex-col items-center justify-center py-10">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-navy border-t-teal mb-3" />
          <p className="text-xs text-muted font-oswald uppercase tracking-wider">Loading script...</p>
        </div>
      ) : script ? (
        /* ── Script Display ── */
        <div className="p-4 space-y-4">
          {/* Back button */}
          <button
            onClick={handleReset}
            className="text-xs text-muted hover:text-navy transition-colors flex items-center gap-1"
          >
            &larr; Choose a different situation
          </button>

          {/* Title + Opening */}
          <div>
            <h4 className="text-sm font-oswald font-bold text-navy uppercase tracking-wider">{script.title}</h4>
            <p className="text-xs text-navy/70 mt-1 leading-relaxed">{script.opening}</p>
          </div>

          {/* Say This */}
          <div className="bg-green-50 rounded-lg p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Check size={14} className="text-green-600" />
              <span className="text-xs font-oswald font-bold text-green-700 uppercase tracking-wider">Say This</span>
            </div>
            <ul className="space-y-1.5">
              {script.say_this.map((s, i) => (
                <li key={i} className="text-xs text-green-800 flex items-start gap-2">
                  <MessageCircle size={10} className="text-green-500 mt-0.5 shrink-0" />
                  <span className="italic">&ldquo;{s}&rdquo;</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Avoid This */}
          <div className="bg-red-50 rounded-lg p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <X size={14} className="text-red-500" />
              <span className="text-xs font-oswald font-bold text-red-600 uppercase tracking-wider">Avoid This</span>
            </div>
            <ul className="space-y-1.5">
              {script.avoid_this.map((s, i) => (
                <li key={i} className="text-xs text-red-700 flex items-start gap-2">
                  <span className="text-red-400 mt-0.5 shrink-0">&times;</span>
                  {s}
                </li>
              ))}
            </ul>
          </div>

          {/* Parent Tip */}
          <div className="bg-navy/[0.03] rounded-lg p-3">
            <p className="text-xs font-oswald font-bold text-navy uppercase tracking-wider mb-1">Parent Tip</p>
            <p className="text-xs text-navy/70 leading-relaxed">{script.parent_tip}</p>
          </div>

          {/* Age Note */}
          {script.age_note && (
            <p className="text-[10px] text-muted/60 italic text-center">{script.age_note}</p>
          )}

          {/* Source */}
          <p className="text-[9px] text-muted/40 text-center">
            Aligned with Respect in Sport and Hockey Canada LTPD guidelines.
          </p>
        </div>
      ) : (
        <div className="p-4 text-center text-xs text-muted">
          Unable to load script. Please try again.
        </div>
      )}
    </div>
  );
}
