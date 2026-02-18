"use client";

import { useState } from "react";

type GearTab = "skater" | "goalie";

const SKATER_GEAR = [
  { priority: 1, item: "Helmet (cage for youth)", why: "Safety — non-negotiable", budget: "$60–200" },
  { priority: 2, item: "Skates", why: "Fit matters most — get fitted at a pro shop", budget: "$150–600" },
  { priority: 3, item: "Gloves", why: "Feel and protection — don't go too big", budget: "$40–150" },
  { priority: 4, item: "Shin Guards", why: "Fit to player — should cover knee to skate", budget: "$30–100" },
  { priority: 5, item: "Pants", why: "Protection and mobility — tailored or regular fit", budget: "$60–200" },
  { priority: 6, item: "Shoulder Pads", why: "Position-dependent — D need more coverage", budget: "$50–180" },
  { priority: 7, item: "Stick", why: "Flex = roughly half body weight", budget: "$30–300" },
  { priority: 8, item: "Elbow Pads", why: "Snug fit — shouldn't slide when skating", budget: "$25–100" },
  { priority: 9, item: "Jock/Jill", why: "Safety essential — replace if cracked", budget: "$15–40" },
  { priority: 10, item: "Neck Guard", why: "Required in most youth leagues", budget: "$15–35" },
];

const GOALIE_GEAR = [
  { priority: 1, item: "Helmet + Cage/Mask", why: "CSA/HECC certified — no exceptions", budget: "$100–500" },
  { priority: 2, item: "Leg Pads", why: "Sized to player (measure floor to mid-thigh)", budget: "$200–800" },
  { priority: 3, item: "Glove (Trapper)", why: "Breaking-in time — buy early in off-season", budget: "$80–350" },
  { priority: 4, item: "Blocker", why: "Comfort and board control — match to hand size", budget: "$70–300" },
  { priority: 5, item: "Chest & Arms", why: "Must cover collarbone and full arms", budget: "$100–500" },
  { priority: 6, item: "Pants", why: "Extra thigh protection vs. skater pants", budget: "$80–250" },
  { priority: 7, item: "Goalie Skates", why: "Flatter blade, cowling protection — not player skates", budget: "$150–600" },
  { priority: 8, item: "Goalie Stick", why: "Paddle length varies by age/height", budget: "$30–200" },
  { priority: 9, item: "Knee Pads", why: "Crucial for butterfly style — wear under pads", budget: "$30–80" },
  { priority: 10, item: "Neck Dangler + Jock", why: "Required in most leagues — safety essentials", budget: "$25–60" },
];

const REPLACEMENT_GUIDELINES = [
  { item: "Helmet", when: "Every 2-3 years or after any significant impact" },
  { item: "Skates", when: "When toes touch the end or boots break down (no ankle support)" },
  { item: "Stick", when: "When flex is wrong for current weight, or blade is worn/cracked" },
  { item: "Gloves", when: "When palms are worn through or fingers poke out" },
  { item: "Protective gear", when: "When it no longer fits properly or padding is compressed" },
];

export default function GearGuideSection() {
  const [gearTab, setGearTab] = useState<GearTab>("skater");
  const gear = gearTab === "skater" ? SKATER_GEAR : GOALIE_GEAR;

  return (
    <div className="space-y-6">
      {/* Equipment by Priority */}
      <div>
        <h4 className="text-sm font-oswald uppercase tracking-wider text-navy mb-3">
          Equipment by Priority
        </h4>

        {/* Skater / Goalie toggle */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-4 w-fit">
          <button
            onClick={() => setGearTab("skater")}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
              gearTab === "skater"
                ? "bg-navy text-white shadow-sm"
                : "text-gray-600 hover:text-navy"
            }`}
          >
            Skater
          </button>
          <button
            onClick={() => setGearTab("goalie")}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
              gearTab === "goalie"
                ? "bg-navy text-white shadow-sm"
                : "text-gray-600 hover:text-navy"
            }`}
          >
            Goalie
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-navy/5 border-b border-navy/10">
                <th className="text-center px-2 py-2 font-oswald uppercase tracking-wider text-navy text-[10px] w-8">#</th>
                <th className="text-left px-3 py-2 font-oswald uppercase tracking-wider text-navy text-[10px]">Item</th>
                <th className="text-left px-3 py-2 font-oswald uppercase tracking-wider text-navy text-[10px]">Why</th>
                <th className="text-right px-3 py-2 font-oswald uppercase tracking-wider text-navy text-[10px] whitespace-nowrap">Budget Range</th>
              </tr>
            </thead>
            <tbody>
              {gear.map((row, i) => (
                <tr
                  key={row.item}
                  className={i % 2 === 0 ? "bg-white" : "bg-navy/[0.02]"}
                >
                  <td className="text-center px-2 py-2.5">
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-navy/10 text-navy font-bold text-[10px]">
                      {row.priority}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 font-bold text-navy whitespace-nowrap">{row.item}</td>
                  <td className="px-3 py-2.5 text-gray-600">{row.why}</td>
                  <td className="px-3 py-2.5 text-right text-gray-700 font-medium whitespace-nowrap">{row.budget}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* When to Replace */}
      <div>
        <h4 className="text-sm font-oswald uppercase tracking-wider text-navy mb-3">
          When to Replace
        </h4>
        <div className="space-y-2">
          {REPLACEMENT_GUIDELINES.map((g) => (
            <div key={g.item} className="flex gap-3 items-start">
              <span className="text-xs font-bold text-navy w-28 shrink-0">{g.item}</span>
              <span className="text-xs text-gray-600 leading-relaxed">{g.when}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Disclaimer */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
        <p className="text-[10px] text-gray-400">
          No brand endorsements. No affiliate links. Prices are approximate CAD/USD ranges.
          Always prioritize proper fitting at a reputable pro shop.
        </p>
      </div>
    </div>
  );
}
