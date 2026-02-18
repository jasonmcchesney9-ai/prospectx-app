"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { useBenchTalk } from "@/components/BenchTalkProvider";

const TRAINING_FOCUS = [
  {
    age: "U11-U12",
    primary: "Movement quality, agility, fun",
    secondary: "Core strength, balance",
    avoid: "Heavy weights, specialization",
  },
  {
    age: "U13-U14",
    primary: "Speed, agility, bodyweight strength",
    secondary: "Flexibility, coordination",
    avoid: "Max lifts, adult programs",
  },
  {
    age: "U15-U16",
    primary: "Strength foundation, power development",
    secondary: "Hockey-specific conditioning",
    avoid: "Overtraining, year-round same sport",
  },
  {
    age: "U17-U18",
    primary: "Full strength & conditioning",
    secondary: "Sport-specific power, recovery",
    avoid: "Ignoring mobility/flexibility",
  },
];

const WEEKLY_PLANS: Record<string, { day: string; activity: string }[]> = {
  "U13-U14": [
    { day: "Mon", activity: "Movement skills + agility games (30 min)" },
    { day: "Tue", activity: "Practice" },
    { day: "Wed", activity: "Bodyweight exercises + balance work (30 min)" },
    { day: "Thu", activity: "Practice" },
    { day: "Fri", activity: "Game day — dynamic warm-up only" },
    { day: "Sat", activity: "Game or active play" },
    { day: "Sun", activity: "Rest / light activity (bike, swim, play)" },
  ],
  "U15-U16": [
    { day: "Mon", activity: "Off-ice agility + core (30 min)" },
    { day: "Tue", activity: "Practice" },
    { day: "Wed", activity: "Upper body bodyweight + flexibility (30 min)" },
    { day: "Thu", activity: "Practice" },
    { day: "Fri", activity: "Game day — light activation only" },
    { day: "Sat", activity: "Game or off" },
    { day: "Sun", activity: "Active recovery (light jog, stretch, foam roll)" },
  ],
  "U17-U18": [
    { day: "Mon", activity: "Lower body strength + plyometrics (45 min)" },
    { day: "Tue", activity: "Practice" },
    { day: "Wed", activity: "Upper body + core (40 min)" },
    { day: "Thu", activity: "Practice + conditioning" },
    { day: "Fri", activity: "Game day — mobility + activation (20 min)" },
    { day: "Sat", activity: "Game or sport-specific power (30 min)" },
    { day: "Sun", activity: "Active recovery / yoga / foam rolling" },
  ],
};

const PLAN_KEYS = Object.keys(WEEKLY_PLANS);

export default function WorkoutsSection() {
  const [activePlan, setActivePlan] = useState("U15-U16");
  const { openBenchTalk } = useBenchTalk();

  return (
    <div className="space-y-6">
      {/* Age-Appropriate Training Focus */}
      <div>
        <h4 className="text-sm font-oswald uppercase tracking-wider text-navy mb-3">
          Age-Appropriate Training Focus
        </h4>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-orange-50 border-b border-orange-200/60">
                <th className="text-left px-3 py-2 font-oswald uppercase tracking-wider text-orange-800 text-[10px]">Age Group</th>
                <th className="text-left px-3 py-2 font-oswald uppercase tracking-wider text-orange-800 text-[10px]">Primary Focus</th>
                <th className="text-left px-3 py-2 font-oswald uppercase tracking-wider text-orange-800 text-[10px]">Secondary Focus</th>
                <th className="text-left px-3 py-2 font-oswald uppercase tracking-wider text-orange-800 text-[10px]">Avoid</th>
              </tr>
            </thead>
            <tbody>
              {TRAINING_FOCUS.map((row, i) => (
                <tr
                  key={row.age}
                  className={i % 2 === 0 ? "bg-white" : "bg-orange-50/30"}
                >
                  <td className="px-3 py-2.5 font-bold text-navy whitespace-nowrap">{row.age}</td>
                  <td className="px-3 py-2.5 text-gray-700">{row.primary}</td>
                  <td className="px-3 py-2.5 text-gray-700">{row.secondary}</td>
                  <td className="px-3 py-2.5 text-red-600">{row.avoid}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sample Weekly Template */}
      <div>
        <h4 className="text-sm font-oswald uppercase tracking-wider text-navy mb-3">
          Sample In-Season Weekly Plan
        </h4>

        {/* Age toggle */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-4 w-fit">
          {PLAN_KEYS.map((age) => (
            <button
              key={age}
              onClick={() => setActivePlan(age)}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                activePlan === age
                  ? "bg-orange text-white shadow-sm"
                  : "text-gray-600 hover:text-navy"
              }`}
            >
              {age}
            </button>
          ))}
        </div>

        {/* Weekly plan */}
        <div className="bg-orange-50/50 rounded-lg border border-orange-200/60 overflow-hidden">
          <div className="px-4 py-2 bg-orange-100/60 border-b border-orange-200/60">
            <span className="text-xs font-oswald uppercase tracking-wider text-orange-800 font-bold">
              In-Season Weekly Plan ({activePlan})
            </span>
          </div>
          <div className="divide-y divide-orange-100">
            {WEEKLY_PLANS[activePlan].map((item) => (
              <div key={item.day} className="flex gap-4 px-4 py-2.5">
                <span className="text-xs font-bold text-orange-700 w-10 shrink-0">{item.day}</span>
                <span className="text-xs text-gray-700 leading-relaxed">{item.activity}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Generate Custom Plan button */}
      <button
        onClick={() =>
          openBenchTalk(
            "[Skill Coach Mode] Help me create a custom off-ice training plan for my hockey player."
          )
        }
        className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-orange text-white text-xs font-bold hover:bg-orange/90 transition-colors"
      >
        <MessageCircle size={14} />
        Generate Custom Plan with PXI
      </button>

      {/* Professional referral */}
      <div className="bg-amber-50 border border-amber-200/60 rounded-lg p-3">
        <p className="text-xs text-amber-800 leading-relaxed">
          <strong>Professional referral:</strong> For injury rehabilitation or chronic pain,
          consult a physiotherapist or certified athletic trainer.
        </p>
      </div>
    </div>
  );
}
