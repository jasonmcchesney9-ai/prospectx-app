"use client";

import { useState, useCallback } from "react";
import { Copy, Check } from "lucide-react";
import type { InterviewQuestion, InterviewTab } from "@/types/api";
import { INTERVIEW_LABEL_COLORS } from "@/types/api";

interface Props {
  data: InterviewQuestion[];
}

const TABS: { key: InterviewTab; label: string }[] = [
  { key: "coach_pre", label: "Coach Pre" },
  { key: "coach_post", label: "Coach Post" },
  { key: "player_pre", label: "Player Pre" },
  { key: "player_post", label: "Player Post" },
  { key: "feature", label: "Feature" },
];

export default function InterviewQuestions({ data }: Props) {
  const [activeTab, setActiveTab] = useState<InterviewTab>("coach_pre");
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const filtered = data?.filter((q) => q.context_tab === activeTab) || [];

  const copyQuestion = useCallback(async (text: string, idx: number) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // fallback
    }
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  }, []);

  if (!data || data.length === 0) {
    return <p className="text-xs text-muted/50 text-center py-4">No interview questions. Generate to populate.</p>;
  }

  return (
    <div className="space-y-2">
      {/* Tabs */}
      <div className="flex flex-wrap gap-0.5">
        {TABS.map((tab) => {
          const count = data.filter((q) => q.context_tab === tab.key).length;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-2 py-1 rounded text-[9px] font-oswald font-bold uppercase tracking-wider transition-colors ${
                activeTab === tab.key
                  ? "bg-teal text-white"
                  : "bg-navy/[0.04] text-muted/50 hover:text-muted"
              }`}
            >
              {tab.label} {count > 0 && `(${count})`}
            </button>
          );
        })}
      </div>

      {/* Questions */}
      {filtered.length === 0 ? (
        <p className="text-[11px] text-muted/40 text-center py-3">No questions in this category.</p>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((q, i) => {
            const labelColors = INTERVIEW_LABEL_COLORS[q.label] || INTERVIEW_LABEL_COLORS.SAFE;
            return (
              <div key={i} className="flex items-start gap-2 p-2 rounded-lg border border-teal/8 hover:border-teal/20 transition-colors">
                <span
                  className={`shrink-0 text-[8px] font-oswald font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${labelColors.bg} ${labelColors.text}`}
                >
                  {q.label}
                </span>
                <p className="text-[11px] text-navy leading-snug flex-1">{q.question}</p>
                <button
                  onClick={() => copyQuestion(q.question, i)}
                  className="shrink-0 p-0.5 rounded text-muted/30 hover:text-navy transition-colors"
                >
                  {copiedIdx === i ? <Check size={10} className="text-green-600" /> : <Copy size={10} />}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
