"use client";

import { useState, useCallback } from "react";
import { Copy, Check } from "lucide-react";
import type { GraphicSuggestion } from "@/types/api";

interface Props {
  data: GraphicSuggestion[];
}

export default function GraphicsSuggestions({ data }: Props) {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const copyCaption = useCallback(async (caption: string, idx: number) => {
    try {
      await navigator.clipboard.writeText(caption);
    } catch {
      // fallback
    }
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  }, []);

  if (!data || data.length === 0) {
    return <p className="text-sm text-muted/50 text-center py-4">No graphics suggestions. Generate to populate.</p>;
  }

  const sorted = [...data].sort((a, b) => a.priority - b.priority);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-navy/[0.04] text-[10px] text-muted uppercase tracking-wider font-oswald">
            <th className="text-center px-2 py-1.5 w-8">#</th>
            <th className="text-left px-2 py-1.5">Graphic Type</th>
            <th className="text-left px-2 py-1.5">Trigger Moment</th>
            <th className="text-left px-2 py-1.5">Caption</th>
            <th className="text-left px-2 py-1.5 hidden sm:table-cell">Data Needed</th>
            <th className="w-8 px-1"></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((g, i) => (
            <tr key={i} className={`border-t border-teal/8 ${i % 2 === 0 ? "bg-white" : "bg-navy/[0.015]"}`}>
              <td className="text-center px-2 py-1.5">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-orange/10 text-orange text-[10px] font-oswald font-bold">
                  {g.priority}
                </span>
              </td>
              <td className="px-2 py-1.5 text-navy font-medium whitespace-nowrap">{g.graphic_type}</td>
              <td className="px-2 py-1.5 text-muted">{g.trigger_moment}</td>
              <td className="px-2 py-1.5 text-navy/80">{g.caption}</td>
              <td className="px-2 py-1.5 text-muted/60 hidden sm:table-cell">{g.data_needed}</td>
              <td className="px-1 py-1.5">
                <button
                  onClick={() => copyCaption(g.caption, i)}
                  className="p-1 rounded text-muted/40 hover:text-navy transition-colors"
                  title="Copy caption"
                >
                  {copiedIdx === i ? <Check size={11} className="text-green-600" /> : <Copy size={11} />}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
