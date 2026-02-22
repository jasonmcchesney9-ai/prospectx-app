"use client";

import { useState, useCallback } from "react";
import { ChevronDown, Copy, Check } from "lucide-react";
import type { PXIInsight, BroadcastAudience } from "@/types/api";
import { INSIGHT_CATEGORY_COLORS } from "@/types/api";

interface Props {
  data: PXIInsight[];
  audience?: BroadcastAudience;
}

export default function PXIInsights({ data, audience = "informed" }: Props) {
  const [showAll, setShowAll] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const copySpeakable = useCallback(async (text: string, idx: number) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // fallback
    }
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 1500);
  }, []);

  if (!data || data.length === 0) {
    return <p className="text-sm text-muted/50 text-center py-4">No insights. Generate to populate.</p>;
  }

  // Get audience-appropriate text
  function getInsightText(insight: PXIInsight): string {
    if (audience === "casual" && insight.text_casual) return insight.text_casual;
    if (audience === "hardcore" && insight.text_hardcore) return insight.text_hardcore;
    if (audience === "informed" && insight.text_informed) return insight.text_informed;
    return insight.insight;
  }

  // Separate key insights from rest
  const keyInsights = data.filter((d) => d.is_key);
  const otherInsights = data.filter((d) => !d.is_key);
  // If no key flags set, treat first 5-7 as key
  const displayKey = keyInsights.length > 0 ? keyInsights : data.slice(0, 7);
  const displayOther = keyInsights.length > 0 ? otherInsights : data.slice(7);

  function renderInsight(insight: PXIInsight, i: number) {
    const colors = INSIGHT_CATEGORY_COLORS[insight.category] || INSIGHT_CATEGORY_COLORS.PATTERN;
    const insightText = getInsightText(insight);
    return (
      <div
        key={i}
        className={`rounded-lg border p-3 ${colors.border} bg-white`}
      >
        <div className="flex items-start gap-2">
          <span
            className={`shrink-0 text-[9px] font-oswald font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${colors.bg} ${colors.text}`}
          >
            {insight.category}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-navy font-medium leading-snug">
              {insightText}
            </p>
            {insight.why_it_matters && (
              <p className="text-[11px] text-orange font-medium mt-1.5 leading-relaxed">
                Why it matters: {insight.why_it_matters}
              </p>
            )}
            {insight.speakable && (
              <div className="mt-2 bg-navy/[0.03] rounded-lg p-2 flex items-start gap-2">
                <p className="text-sm text-navy/90 font-medium leading-snug flex-1">
                  &ldquo;{insight.speakable}&rdquo;
                </p>
                <button
                  onClick={() => copySpeakable(insight.speakable!, i)}
                  className="shrink-0 p-1 rounded text-muted/40 hover:text-navy transition-colors"
                  title="Copy speakable text"
                >
                  {copiedIdx === i ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
                </button>
              </div>
            )}
            {insight.stat_support && (
              <p className="text-[11px] text-muted mt-1 font-mono">
                {insight.stat_support}
              </p>
            )}
            {insight.suggested_use && (
              <p className="text-[10px] text-muted/60 mt-1 italic">
                {insight.suggested_use}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Key insights */}
      {displayKey.map((insight, i) => renderInsight(insight, i))}

      {/* Show all expander */}
      {displayOther.length > 0 && (
        <>
          <button
            onClick={() => setShowAll(!showAll)}
            className="w-full flex items-center justify-center gap-1 py-2 text-[10px] font-oswald uppercase tracking-wider text-muted/50 hover:text-navy transition-colors"
          >
            {showAll ? "Hide" : `Show All (${displayOther.length} more)`}
            <ChevronDown size={12} className={`transition-transform ${showAll ? "rotate-180" : ""}`} />
          </button>
          {showAll && displayOther.map((insight, i) => renderInsight(insight, displayKey.length + i))}
        </>
      )}
    </div>
  );
}
