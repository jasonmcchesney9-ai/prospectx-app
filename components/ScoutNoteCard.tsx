"use client";

import Link from "next/link";
import { Calendar, User } from "lucide-react";
import type { ScoutNote } from "@/types/api";
import { PROSPECT_STATUS_LABELS } from "@/types/api";

const GRADE_COLORS: Record<number, string> = {
  1: "bg-red-100 text-red-700",
  2: "bg-orange/10 text-orange",
  3: "bg-amber-50 text-amber-700",
  4: "bg-teal/10 text-teal",
  5: "bg-green-100 text-green-700",
};

export default function ScoutNoteCard({ note }: { note: ScoutNote }) {
  const statusInfo = note.prospect_status ? PROSPECT_STATUS_LABELS[note.prospect_status] : null;
  const gradeColor = note.overall_grade ? GRADE_COLORS[note.overall_grade] || "bg-navy/5 text-navy" : null;

  return (
    <Link
      href={`/scout-notes/${note.id}`}
      className="block bg-white rounded-xl border border-border p-4 hover:shadow-md hover:border-teal/30 transition-all group"
    >
      {/* Header: Player + Grade */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-navy truncate group-hover:text-teal transition-colors">
            {note.player_name || "Unknown Player"}
          </p>
          <p className="text-[10px] text-muted truncate">
            {[note.player_team, note.player_position].filter(Boolean).join(" · ")}
          </p>
        </div>
        {note.overall_grade && (
          <span className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-sm font-oswald font-bold ${gradeColor}`}>
            {note.overall_grade}
          </span>
        )}
      </div>

      {/* One-line summary */}
      {note.one_line_summary && (
        <p className="text-xs text-navy/80 mb-2 line-clamp-2">{note.one_line_summary}</p>
      )}

      {/* Ratings row */}
      {(note.skating_rating || note.compete_rating || note.hockey_iq_rating) && (
        <div className="flex gap-1.5 mb-2 flex-wrap">
          {[
            { label: "SKT", value: note.skating_rating },
            { label: "PKS", value: note.puck_skills_rating },
            { label: "IQ", value: note.hockey_iq_rating },
            { label: "CMP", value: note.compete_rating },
            { label: "DEF", value: note.defense_rating },
          ].filter(r => r.value).map((r) => (
            <span key={r.label} className="text-[9px] font-oswald uppercase tracking-wider px-1.5 py-0.5 rounded bg-navy/5 text-navy/60">
              {r.label} {r.value}
            </span>
          ))}
        </div>
      )}

      {/* Footer: Date + Status + Author */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/50">
        <div className="flex items-center gap-3 text-[10px] text-muted">
          {note.game_date && (
            <span className="flex items-center gap-1">
              <Calendar size={10} />
              {new Date(note.game_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </span>
          )}
          {note.opponent && <span>vs {note.opponent}</span>}
        </div>
        <div className="flex items-center gap-2">
          {statusInfo && (
            <span className={`text-[9px] font-oswald uppercase tracking-wider px-1.5 py-0.5 rounded ${statusInfo.color}`}>
              {statusInfo.label}
            </span>
          )}
          {note.author_name && (
            <span className="text-[10px] text-muted flex items-center gap-0.5">
              <User size={9} /> {note.author_name}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
