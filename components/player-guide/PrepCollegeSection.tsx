"use client";

import { useState } from "react";
import { MessageCircle, ArrowRight } from "lucide-react";
import { useBenchTalk } from "@/components/BenchTalkProvider";

type PathwayTab = "canadian" | "us";

const CANADIAN_PATHWAYS = [
  {
    label: "Jr. A → NCAA/USports",
    steps: ["Minor Hockey", "Jr. A (OJHL / BCHL / AJHL)", "NCAA or USports"],
  },
  {
    label: "Major Junior → Pro",
    steps: ["Minor Hockey", "Major Junior (OHL / WHL / QMJHL)", "Pro (AHL/NHL) or USports"],
  },
  {
    label: "Prep School → NCAA",
    steps: ["Minor Hockey", "Prep School", "NCAA"],
  },
];

const US_PATHWAYS = [
  {
    label: "High School → USHL → NCAA",
    steps: ["Youth Hockey", "High School", "USHL / NAHL", "NCAA"],
  },
  {
    label: "Prep School → NCAA",
    steps: ["Youth Hockey", "Prep School", "USHL / NAHL", "NCAA"],
  },
  {
    label: "NTDP → NCAA → Pro",
    steps: ["Youth Hockey", "NTDP", "NCAA", "Pro"],
  },
];

const KEY_DATES = [
  { event: "OHL Priority Selection", timing: "April", note: "Register through minor hockey association" },
  { event: "USHL Draft", timing: "May", note: "Phase I and Phase II selections" },
  { event: "NCAA D1 Contact Periods", timing: "Varies by division", note: "Check NCAA recruiting calendar" },
  { event: "SAT/ACT Target Dates", timing: "Junior year (Grade 11)", note: "Take early, retake if needed" },
  { event: "FAFSA Deadline", timing: "October 1 (US)", note: "Opens for following academic year" },
  { event: "CHL Scholarship Applications", timing: "Post-playing career", note: "Tuition covered for each OHL/WHL/QMJHL season" },
];

const ACADEMIC_REQS = [
  {
    level: "NCAA D1/D2",
    requirements: "Minimum 2.3 GPA (D1) / 2.2 GPA (D2), 16 core courses, SAT/ACT scores, NCAA Eligibility Center registration",
  },
  {
    level: "NCAA D3",
    requirements: "Admission-based — no minimum athletic eligibility GPA, but must meet school admission standards",
  },
  {
    level: "USports (Canada)",
    requirements: "Varies by university — must meet institution admission requirements, CIS eligibility rules",
  },
  {
    level: "CHL Scholarship",
    requirements: "1 year of tuition + books for each season played in OHL/WHL/QMJHL — available post-playing career",
  },
];

export default function PrepCollegeSection() {
  const [pathwayTab, setPathwayTab] = useState<PathwayTab>("canadian");
  const { openBenchTalk } = useBenchTalk();

  const pathways = pathwayTab === "canadian" ? CANADIAN_PATHWAYS : US_PATHWAYS;

  return (
    <div className="space-y-6">
      {/* Pathway Map */}
      <div>
        <h4 className="text-sm font-oswald uppercase tracking-wider text-navy mb-3">
          Hockey Pathways
        </h4>

        {/* Country tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-4 w-fit">
          <button
            onClick={() => setPathwayTab("canadian")}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
              pathwayTab === "canadian"
                ? "bg-teal text-white shadow-sm"
                : "text-gray-600 hover:text-navy"
            }`}
          >
            🇨🇦 Canadian
          </button>
          <button
            onClick={() => setPathwayTab("us")}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
              pathwayTab === "us"
                ? "bg-teal text-white shadow-sm"
                : "text-gray-600 hover:text-navy"
            }`}
          >
            🇺🇸 American
          </button>
        </div>

        {/* Pathway cards */}
        <div className="space-y-3">
          {pathways.map((p) => (
            <div
              key={p.label}
              className="bg-teal/5 border border-teal/20 rounded-lg p-3"
            >
              <div className="text-[10px] font-oswald uppercase tracking-wider text-teal font-bold mb-2">
                {p.label}
              </div>
              <div className="flex items-center flex-wrap gap-1">
                {p.steps.map((step, i) => (
                  <span key={i} className="flex items-center gap-1">
                    <span className="px-2 py-1 rounded bg-white border border-teal/20 text-xs text-navy font-medium">
                      {step}
                    </span>
                    {i < p.steps.length - 1 && (
                      <ArrowRight size={12} className="text-teal shrink-0" />
                    )}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Key Dates & Deadlines */}
      <div>
        <h4 className="text-sm font-oswald uppercase tracking-wider text-navy mb-3">
          Key Dates & Deadlines
        </h4>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-teal/5 border-b border-teal/20">
                <th className="text-left px-3 py-2 font-oswald uppercase tracking-wider text-teal text-[10px]">Event</th>
                <th className="text-left px-3 py-2 font-oswald uppercase tracking-wider text-teal text-[10px]">Timing</th>
                <th className="text-left px-3 py-2 font-oswald uppercase tracking-wider text-teal text-[10px]">Note</th>
              </tr>
            </thead>
            <tbody>
              {KEY_DATES.map((d, i) => (
                <tr key={d.event} className={i % 2 === 0 ? "bg-white" : "bg-teal/[0.02]"}>
                  <td className="px-3 py-2.5 font-bold text-navy">{d.event}</td>
                  <td className="px-3 py-2.5 text-gray-700 whitespace-nowrap">{d.timing}</td>
                  <td className="px-3 py-2.5 text-gray-500">{d.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Academic Requirements */}
      <div>
        <h4 className="text-sm font-oswald uppercase tracking-wider text-navy mb-3">
          Academic Requirements
        </h4>
        <div className="space-y-2">
          {ACADEMIC_REQS.map((req) => (
            <div
              key={req.level}
              className="bg-white border border-gray-200 rounded-lg p-3"
            >
              <div className="text-xs font-bold text-navy mb-1">{req.level}</div>
              <p className="text-xs text-gray-600 leading-relaxed">{req.requirements}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Get Pathway Plan */}
      <button
        onClick={() =>
          openBenchTalk(
            "[Agent Mode] Help me understand the best hockey pathway for my player — what leagues, timelines, and academic steps should we be thinking about?"
          )
        }
        className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-teal text-white text-xs font-bold hover:bg-teal/90 transition-colors"
      >
        <MessageCircle size={14} />
        Get My Pathway Plan from PXI
      </button>
    </div>
  );
}
