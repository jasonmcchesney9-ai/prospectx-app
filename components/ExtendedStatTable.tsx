"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { ExtendedStats } from "@/types/api";
import { STAT_CATEGORIES, STAT_FIELD_LABELS } from "@/types/api";

interface Props {
  stats: ExtendedStats;
  title?: string;
  season?: string | null;
  source?: string;
}

/** Display order for stat categories */
const CATEGORY_ORDER = [
  "main",
  "shots",
  "puck_battles",
  "recoveries",
  "special_teams",
  "xg",
  "passes",
  "entries",
  "advanced",
  "faceoffs_zone",
  "playtime",
  "scoring_chances",
  "team_extras",
  // Team-specific categories
  "offense",
  "discipline",
  "faceoffs",
  "physical",
  "defense",
  "transition",
];

function formatValue(val: unknown): string {
  if (val === null || val === undefined) return "-";
  if (typeof val === "number") {
    // Percentages
    if (val > 0 && val < 1 && val !== 0) return (val * 100).toFixed(1) + "%";
    if (Number.isInteger(val)) return val.toLocaleString();
    return val.toFixed(2);
  }
  return String(val);
}

function formatTime(seconds: number): string {
  if (!seconds) return "-";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function ExtendedStatTable({ stats, title, season, source }: Props) {
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(["main", "xg", "advanced"]));

  const toggle = (cat: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const categories = CATEGORY_ORDER.filter(
    (cat) => stats[cat] && typeof stats[cat] === "object" && Object.keys(stats[cat]!).length > 0
  );

  if (categories.length === 0) return null;

  return (
    <div className="mt-4">
      {title && (
        <h3 className="text-sm font-oswald font-semibold text-navy uppercase tracking-wider mb-3">
          {title}
        </h3>
      )}
      <div className="space-y-1">
        {categories.map((cat) => {
          const data = stats[cat]!;
          const isOpen = openSections.has(cat);
          const label = STAT_CATEGORIES[cat] || cat;
          const entries = Object.entries(data).filter(([, v]) => v !== null && v !== undefined);

          return (
            <div key={cat} className="border border-border rounded-lg overflow-hidden">
              <button
                onClick={() => toggle(cat)}
                className="w-full flex items-center justify-between px-4 py-2.5 bg-navy/[0.02] hover:bg-navy/[0.04] transition-colors"
              >
                <span className="flex items-center gap-2">
                  {isOpen ? (
                    <ChevronDown size={14} className="text-teal" />
                  ) : (
                    <ChevronRight size={14} className="text-muted" />
                  )}
                  <span className="text-sm font-semibold text-navy">{label}</span>
                  <span className="text-xs text-muted">({entries.length})</span>
                </span>
              </button>
              {isOpen && (
                <div className="px-4 py-2 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-1.5">
                  {entries.map(([field, val]) => {
                    const fieldLabel = STAT_FIELD_LABELS[field] || field.replace(/_/g, " ");
                    const isTime =
                      field.includes("time") || field.includes("possession") || field.includes("play");
                    const displayVal =
                      isTime && typeof val === "number" && val > 60
                        ? formatTime(val as number)
                        : formatValue(val);

                    return (
                      <div key={field} className="flex items-center justify-between py-0.5">
                        <span className="text-xs text-muted truncate mr-2 capitalize">
                          {fieldLabel}
                        </span>
                        <span className="text-xs font-semibold text-navy tabular-nums whitespace-nowrap">
                          {displayVal}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
