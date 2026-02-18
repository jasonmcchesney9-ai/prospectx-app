"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Search } from "lucide-react";
import { useBenchTalk } from "@/components/BenchTalkProvider";
import type { BroadcastPlayerProfile } from "@/types/api";

interface Props {
  data: BroadcastPlayerProfile[];
}

export default function PlayerProfiles({ data }: Props) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const { openBenchTalk } = useBenchTalk();

  if (!data || data.length === 0) {
    return <p className="text-xs text-muted/50 text-center py-4">No player profiles. Generate to populate.</p>;
  }

  return (
    <div className="space-y-1">
      {data.map((profile, i) => {
        const isExpanded = expandedIdx === i;
        return (
          <div key={i} className="border border-teal/10 rounded-lg overflow-hidden">
            <button
              onClick={() => setExpandedIdx(isExpanded ? null : i)}
              className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-navy/[0.02] transition-colors"
            >
              <div>
                <span className="text-xs font-medium text-navy">{profile.name}</span>
                <span className="text-[10px] text-muted/50 ml-1.5">{profile.archetype}</span>
              </div>
              {isExpanded ? <ChevronUp size={12} className="text-muted" /> : <ChevronDown size={12} className="text-muted" />}
            </button>
            {isExpanded && (
              <div className="px-3 pb-2.5 space-y-1">
                <div className="text-[11px]">
                  <span className="text-muted/60 font-oswald uppercase text-[9px] tracking-wider">Physical:</span>{" "}
                  <span className="text-navy">{profile.physical}</span>
                </div>
                <div className="text-[11px]">
                  <span className="text-muted/60 font-oswald uppercase text-[9px] tracking-wider">Role:</span>{" "}
                  <span className="text-navy">{profile.role}</span>
                </div>
                <div className="text-[11px]">
                  <span className="text-muted/60 font-oswald uppercase text-[9px] tracking-wider">Strengths:</span>{" "}
                  <span className="text-navy">{profile.strengths}</span>
                </div>
                <div className="text-[11px]">
                  <span className="text-muted/60 font-oswald uppercase text-[9px] tracking-wider">Fun Fact:</span>{" "}
                  <span className="text-navy">{profile.fun_fact}</span>
                </div>
                <div className="text-[11px]">
                  <span className="text-muted/60 font-oswald uppercase text-[9px] tracking-wider">Tonight:</span>{" "}
                  <span className="text-teal font-medium">{profile.tonight}</span>
                </div>
                <button
                  onClick={() => openBenchTalk(`Scout player ${profile.name} — give me a deep dive on this player`)}
                  className="mt-1 flex items-center gap-1 text-[10px] font-oswald uppercase tracking-wider text-teal hover:text-teal/80 transition-colors"
                >
                  <Search size={10} /> Deep Dive
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
