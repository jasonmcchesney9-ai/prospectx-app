"use client";

import { MessageCircle } from "lucide-react";
import { useBenchTalk } from "@/components/BenchTalkProvider";

const FOCUS_OPTIONS = [
  "3-minute visualization — picture yourself making plays, winning puck battles",
  "Pump-up playlist — last 2-3 songs to get you in the zone",
  "Review 3 personal game goals — write them on tape or in your phone",
];

const BODY_OPTIONS = [
  "Dynamic stretching — leg swings, hip circles, arm circles",
  "Stick handling warm-up — 5 minutes of controlled puck work",
  "Deep breathing (4-4-4) — inhale 4 sec, hold 4 sec, exhale 4 sec",
];

const MINDSET_OPTIONS = [
  "Positive self-talk phrase — \"I compete hard every shift\"",
  "Team energy check — fist bumps, eye contact, verbal encouragement",
  "Let go of last game — \"That was then. This is now.\"",
];

const BOUNCE_BACK_TIPS = [
  {
    situation: "After a Bad Game",
    tip: "Give yourself a 20-minute \"decompression window\" — no talking about the game. Then reflect on one thing you did well and one thing to work on.",
  },
  {
    situation: "During a Scoring Slump",
    tip: "Focus on process goals (shots, zone entries, puck battles won) instead of outcomes. Slumps end when you keep shooting.",
  },
  {
    situation: "Feeling Nervous Before Big Games",
    tip: "Nervous and excited feel the same in your body. Reframe: \"I'm not nervous, I'm ready.\" Stick to your routine.",
  },
  {
    situation: "After Making a Mistake",
    tip: "Use the \"Flush It\" technique — take one deep breath, tap your stick on the ice, and refocus on the next play. Don't replay the mistake.",
  },
];

export default function MentalPerformanceSection() {
  const { openBenchTalk } = useBenchTalk();

  return (
    <div className="space-y-6">
      {/* Pre-Game Routine Builder */}
      <div>
        <h4 className="text-sm font-oswald uppercase tracking-wider text-navy mb-3">
          Build Your Pre-Game Routine
        </h4>
        <p className="text-xs text-gray-500 mb-4">
          Pick one from each category to create a consistent pre-game routine.
        </p>

        {/* FOCUS */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 text-[10px] font-bold uppercase">
              Focus
            </span>
          </div>
          <div className="space-y-1.5">
            {FOCUS_OPTIONS.map((opt, i) => (
              <label
                key={i}
                className="flex items-start gap-2.5 px-3 py-2 rounded-lg bg-purple-50/50 border border-purple-100 cursor-pointer hover:bg-purple-50 transition-colors"
              >
                <input type="checkbox" className="mt-0.5 accent-purple-600" />
                <span className="text-xs text-gray-700 leading-relaxed">{opt}</span>
              </label>
            ))}
          </div>
        </div>

        {/* BODY */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 text-[10px] font-bold uppercase">
              Body
            </span>
          </div>
          <div className="space-y-1.5">
            {BODY_OPTIONS.map((opt, i) => (
              <label
                key={i}
                className="flex items-start gap-2.5 px-3 py-2 rounded-lg bg-purple-50/50 border border-purple-100 cursor-pointer hover:bg-purple-50 transition-colors"
              >
                <input type="checkbox" className="mt-0.5 accent-purple-600" />
                <span className="text-xs text-gray-700 leading-relaxed">{opt}</span>
              </label>
            ))}
          </div>
        </div>

        {/* MINDSET */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 text-[10px] font-bold uppercase">
              Mindset
            </span>
          </div>
          <div className="space-y-1.5">
            {MINDSET_OPTIONS.map((opt, i) => (
              <label
                key={i}
                className="flex items-start gap-2.5 px-3 py-2 rounded-lg bg-purple-50/50 border border-purple-100 cursor-pointer hover:bg-purple-50 transition-colors"
              >
                <input type="checkbox" className="mt-0.5 accent-purple-600" />
                <span className="text-xs text-gray-700 leading-relaxed">{opt}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Bounce-Back Tips */}
      <div>
        <h4 className="text-sm font-oswald uppercase tracking-wider text-navy mb-3">
          Bounce-Back Tips
        </h4>
        <div className="space-y-2">
          {BOUNCE_BACK_TIPS.map((item) => (
            <div
              key={item.situation}
              className="bg-white border border-purple-100 rounded-lg p-3"
            >
              <div className="text-xs font-bold text-purple-700 mb-1">{item.situation}</div>
              <p className="text-xs text-gray-600 leading-relaxed">{item.tip}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Talk to PXI */}
      <button
        onClick={() =>
          openBenchTalk(
            "[Parent Mode] I'd like to talk about mental performance and confidence for my hockey player."
          )
        }
        className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-purple-600 text-white text-xs font-bold hover:bg-purple-700 transition-colors"
      >
        <MessageCircle size={14} />
        Talk to PXI About Mental Game
      </button>

      {/* Professional referral */}
      <div className="bg-amber-50 border border-amber-200/60 rounded-lg p-3">
        <p className="text-xs text-amber-800 leading-relaxed">
          <strong>Professional referral:</strong> For anxiety, depression, or persistent mental
          health concerns, connect with a licensed sports psychologist.
        </p>
      </div>
    </div>
  );
}
