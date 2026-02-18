"use client";

import type { PXIInsight } from "@/types/api";
import { INSIGHT_CATEGORY_COLORS } from "@/types/api";

interface Props {
  data: PXIInsight[];
}

export default function PXIInsights({ data }: Props) {
  if (!data || data.length === 0) {
    return <p className="text-sm text-muted/50 text-center py-4">No insights. Generate to populate.</p>;
  }

  return (
    <div className="space-y-2">
      {data.map((insight, i) => {
        const colors = INSIGHT_CATEGORY_COLORS[insight.category] || INSIGHT_CATEGORY_COLORS.PATTERN;
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
              <div className="min-w-0">
                <p className="text-sm text-navy font-medium leading-snug">
                  {insight.insight}
                </p>
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
      })}
    </div>
  );
}
