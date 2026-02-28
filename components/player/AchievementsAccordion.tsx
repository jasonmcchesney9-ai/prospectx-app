"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Trophy } from "lucide-react";
import type { PlayerAchievement } from "@/types/api";

interface AchievementsAccordionProps {
  achievements: PlayerAchievement[];
}

const ACHIEVEMENT_TYPE_COLORS: Record<string, string> = {
  award: "bg-amber-50 text-amber-700",
  milestone: "bg-blue-50 text-blue-700",
  record: "bg-purple-50 text-purple-700",
  selection: "bg-green-50 text-green-700",
  honor: "bg-teal/10 text-teal",
};

export default function AchievementsAccordion({ achievements }: AchievementsAccordionProps) {
  const [open, setOpen] = useState(false);

  if (!achievements || achievements.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-border overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-3 bg-gradient-to-r from-navy/[0.04] to-teal/[0.04] border-b border-teal/10 hover:from-navy/[0.06] hover:to-teal/[0.06] transition-colors"
      >
        <div className="flex items-center gap-2">
          <Trophy size={16} className="text-orange" />
          <h3 className="text-sm font-oswald uppercase tracking-wider text-navy">
            Achievements
          </h3>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange/10 text-orange font-medium">
            {achievements.length}
          </span>
        </div>
        {open ? <ChevronUp size={16} className="text-navy/50" /> : <ChevronDown size={16} className="text-navy/50" />}
      </button>
      {open && (
        <div className="p-4">
          <div className="space-y-2">
            {achievements.map((a) => (
              <div key={a.id} className="flex items-start gap-3 p-3 rounded-lg bg-navy/[0.02] border border-border/50">
                <div className="shrink-0 mt-0.5">
                  <div className="w-8 h-8 rounded-full bg-orange/10 flex items-center justify-center">
                    <Trophy size={14} className="text-orange" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium uppercase tracking-wide ${
                      ACHIEVEMENT_TYPE_COLORS[a.achievement_type] || "bg-gray-50 text-gray-600"
                    }`}>
                      {a.achievement_type}
                    </span>
                    {a.description && (
                      <span className="text-xs font-medium text-navy">{a.description}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-navy/50">
                    {a.season && <span>{a.season}</span>}
                    {a.team_name && (
                      <>
                        <span className="text-navy/20">|</span>
                        <span>{a.team_name}</span>
                      </>
                    )}
                    {a.league && (
                      <>
                        <span className="text-navy/20">|</span>
                        <span>{a.league}</span>
                      </>
                    )}
                    {a.awarded_date && (
                      <>
                        <span className="text-navy/20">|</span>
                        <span>{new Date(a.awarded_date).toLocaleDateString()}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
