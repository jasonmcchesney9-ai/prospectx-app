"use client";

import { useState, useEffect } from "react";
import { ThumbsUp, ThumbsDown, RefreshCw } from "lucide-react";

/* ---------- Do / Don't Pairs ---------- */
const PAIRS: { do_text: string; dont_text: string }[] = [
  {
    do_text: "Ask what they learned from mistakes",
    dont_text: "Coach from the stands",
  },
  {
    do_text: "Celebrate effort and improvement",
    dont_text: "Focus only on points and goals",
  },
  {
    do_text: "Let them own their hockey journey",
    dont_text: "Compare them to teammates",
  },
  {
    do_text: "Support the coaching staff publicly",
    dont_text: "Undermine coaches in front of your player",
  },
  {
    do_text: "Keep car rides positive or silent",
    dont_text: "Replay every mistake on the drive home",
  },
  {
    do_text: "Let them have fun",
    dont_text: "Turn every game into a performance review",
  },
  {
    do_text: "Encourage them to try new positions",
    dont_text: "Lock them into one role too early",
  },
  {
    do_text: "Model good sportsmanship",
    dont_text: "Yell at referees",
  },
];

/**
 * Picks a pair based on the day of year (rotates daily) or randomly on shuffle.
 */
function getDailyIndex(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor(
    (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
  );
  return dayOfYear % PAIRS.length;
}

export default function ParentDoDontCard() {
  const [index, setIndex] = useState(() => getDailyIndex());
  const [animating, setAnimating] = useState(false);

  const pair = PAIRS[index];

  function handleShuffle() {
    setAnimating(true);
    setTimeout(() => {
      let next = index;
      // Ensure we get a different one
      while (next === index && PAIRS.length > 1) {
        next = Math.floor(Math.random() * PAIRS.length);
      }
      setIndex(next);
      setAnimating(false);
    }, 200);
  }

  return (
    <div className="bg-white rounded-xl border border-teal/20 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-navy/[0.03] border-b border-teal/20">
        <span className="text-[10px] font-oswald uppercase tracking-wider text-navy font-bold">
          Parent Tip of the Day
        </span>
        <button
          onClick={handleShuffle}
          className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-gray-500 hover:text-navy hover:bg-navy/5 transition-colors"
        >
          <RefreshCw size={10} />
          Shuffle
        </button>
      </div>

      {/* Split card */}
      <div
        className={`grid grid-cols-2 divide-x divide-gray-200 transition-opacity duration-200 ${
          animating ? "opacity-0" : "opacity-100"
        }`}
      >
        {/* DO side */}
        <div className="p-4 bg-green-50/50">
          <div className="flex items-center gap-1.5 mb-2">
            <ThumbsUp size={13} className="text-green-600" />
            <span className="text-[10px] font-oswald uppercase tracking-wider text-green-700 font-bold">
              Do
            </span>
          </div>
          <p className="text-xs text-green-800 leading-relaxed font-medium">
            {pair.do_text}
          </p>
        </div>

        {/* DON'T side */}
        <div className="p-4 bg-red-50/50">
          <div className="flex items-center gap-1.5 mb-2">
            <ThumbsDown size={13} className="text-red-500" />
            <span className="text-[10px] font-oswald uppercase tracking-wider text-red-600 font-bold">
              Don&apos;t
            </span>
          </div>
          <p className="text-xs text-red-700 leading-relaxed font-medium">
            {pair.dont_text}
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-teal/20 bg-navy/[0.02]">
        <p className="text-[9px] text-gray-400 text-center">
          Tip {index + 1} of {PAIRS.length} — rotates daily
        </p>
      </div>
    </div>
  );
}
