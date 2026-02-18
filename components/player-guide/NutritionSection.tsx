"use client";

import { useState } from "react";
import { MessageCircle, ExternalLink } from "lucide-react";
import { useBenchTalk } from "@/components/BenchTalkProvider";

const AGE_GROUPS = ["U11-U13", "U14-U15", "U16-U18"] as const;

const MEAL_PATTERNS: Record<string, { time: string; meal: string }[]> = {
  "U11-U13": [
    { time: "Morning", meal: "Balanced breakfast (oatmeal, eggs, fruit, toast)" },
    { time: "3 hrs before", meal: "Light balanced meal (pasta, chicken, vegetables)" },
    { time: "60-90 min", meal: "Small carb snack (banana, granola bar, crackers)" },
    { time: "During", meal: "Water only (no energy drinks, no sugary sports drinks)" },
    { time: "After", meal: "Recovery snack within 30 min (chocolate milk, yogurt + fruit, PB sandwich)" },
    { time: "Evening", meal: "Normal balanced dinner" },
  ],
  "U14-U15": [
    { time: "Morning", meal: "Protein-rich breakfast (eggs, whole grain toast, fruit, yogurt)" },
    { time: "3 hrs before", meal: "Balanced meal — lean protein + complex carbs (rice, chicken, veggies)" },
    { time: "60-90 min", meal: "Carb-focused snack (toast with jam, fruit, sports bar)" },
    { time: "During", meal: "Water; electrolyte drink if 90+ minutes" },
    { time: "After", meal: "Protein + carbs within 30 min (smoothie, chicken wrap, chocolate milk)" },
    { time: "Evening", meal: "Full dinner with protein, carbs, vegetables" },
  ],
  "U16-U18": [
    { time: "Morning", meal: "High-protein breakfast (eggs, oatmeal, Greek yogurt, fruit, whole grain)" },
    { time: "3-4 hrs before", meal: "Performance meal — protein + complex carbs + healthy fats (salmon, rice, avocado)" },
    { time: "60-90 min", meal: "Easily digestible carbs (banana, rice cakes, energy bar)" },
    { time: "During", meal: "Water + electrolyte drink for intense sessions" },
    { time: "After", meal: "Recovery shake or meal within 30 min — 3:1 carb-to-protein ratio" },
    { time: "Evening", meal: "Nutrient-dense dinner; consider casein protein before bed for recovery" },
  ],
};

const PRINCIPLES = [
  "Hydration first — water before, during, and after. Avoid energy drinks.",
  "Eat every 3-4 hours. Never skate on empty.",
  "Mix carbs + protein at every meal.",
  "Real food over supplements for youth players.",
  "Recovery nutrition matters — eat within 30 minutes after games and practice.",
];

const SOURCES = ["USA Hockey", "Hockey Canada", "KidsHealth"];

export default function NutritionSection() {
  const [activeAge, setActiveAge] = useState<string>("U11-U13");
  const { openBenchTalk } = useBenchTalk();

  return (
    <div className="space-y-6">
      {/* Game-Day Meal Pattern */}
      <div>
        <h4 className="text-sm font-oswald uppercase tracking-wider text-navy mb-3">
          Game-Day Meal Pattern
        </h4>

        {/* Age group tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-4 w-fit">
          {AGE_GROUPS.map((age) => (
            <button
              key={age}
              onClick={() => setActiveAge(age)}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                activeAge === age
                  ? "bg-green-600 text-white shadow-sm"
                  : "text-gray-600 hover:text-navy"
              }`}
            >
              {age}
            </button>
          ))}
        </div>

        {/* Meal pattern table */}
        <div className="bg-green-50/50 rounded-lg border border-green-200/60 overflow-hidden">
          <div className="px-4 py-2 bg-green-100/60 border-b border-green-200/60">
            <span className="text-xs font-oswald uppercase tracking-wider text-green-800 font-bold">
              {activeAge} Game Day Pattern
            </span>
          </div>
          <div className="divide-y divide-green-100">
            {MEAL_PATTERNS[activeAge].map((item) => (
              <div key={item.time} className="flex gap-4 px-4 py-2.5">
                <span className="text-xs font-bold text-green-700 w-24 shrink-0 pt-0.5">
                  {item.time}
                </span>
                <span className="text-xs text-gray-700 leading-relaxed">{item.meal}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* General Principles */}
      <div>
        <h4 className="text-sm font-oswald uppercase tracking-wider text-navy mb-3">
          General Principles
        </h4>
        <ol className="space-y-2">
          {PRINCIPLES.map((p, i) => (
            <li key={i} className="flex gap-3 text-xs text-gray-700 leading-relaxed">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-green-100 text-green-700 font-bold text-[10px] shrink-0 mt-0.5">
                {i + 1}
              </span>
              {p}
            </li>
          ))}
        </ol>
      </div>

      {/* Ask PXI */}
      <button
        onClick={() =>
          openBenchTalk(
            "[Parent Mode] I have a question about nutrition for my hockey player."
          )
        }
        className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-green-600 text-white text-xs font-bold hover:bg-green-700 transition-colors"
      >
        <MessageCircle size={14} />
        Ask PXI About Nutrition
      </button>

      {/* Professional referral */}
      <div className="bg-amber-50 border border-amber-200/60 rounded-lg p-3">
        <p className="text-xs text-amber-800 leading-relaxed">
          <strong>Professional referral:</strong> For specific dietary needs, allergies, weight
          management, or supplement questions, please consult a registered sports dietitian.
        </p>
      </div>

      {/* Sources */}
      <div className="flex items-center gap-2 text-[10px] text-gray-400">
        <ExternalLink size={10} />
        <span>Sources: {SOURCES.join(", ")}</span>
      </div>
    </div>
  );
}
