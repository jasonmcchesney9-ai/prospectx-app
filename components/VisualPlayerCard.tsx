"use client";

import Link from "next/link";
import { User } from "lucide-react";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  ResponsiveContainer,
} from "recharts";
import type { PlayerCardData } from "@/types/api";
import { GRADE_COLORS, METRIC_COLORS, COMMITMENT_STATUS_COLORS } from "@/types/api";
import { assetUrl, hasRealImage } from "@/lib/api";

const RADAR_AXES = [
  { key: "sniper", label: "SNP" },
  { key: "playmaker", label: "PLY" },
  { key: "transition", label: "TRN" },
  { key: "defensive", label: "DEF" },
  { key: "compete", label: "CMP" },
  { key: "hockey_iq", label: "IQ" },
] as const;

function GradeBadge({ grade }: { grade: string | null }) {
  if (!grade || grade === "NR") return null;
  const color = GRADE_COLORS[grade] || "#9ca3af";
  return (
    <span
      className="inline-flex items-center justify-center w-9 h-9 rounded-lg font-oswald font-bold text-sm text-white shadow-sm"
      style={{ backgroundColor: color }}
    >
      {grade}
    </span>
  );
}

function CommitmentBadge({ status }: { status: string | null }) {
  if (!status || status === "Uncommitted") return null;
  const colors = COMMITMENT_STATUS_COLORS[status] || { bg: "bg-gray-100", text: "text-gray-600" };
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-oswald font-bold uppercase tracking-wider ${colors.bg} ${colors.text}`}>
      {status}
    </span>
  );
}

function PositionBadge({ position }: { position: string }) {
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-teal/10 text-teal border border-teal/20 font-oswald tracking-wider">
      {position}
    </span>
  );
}

export default function VisualPlayerCard({ player }: { player: PlayerCardData }) {
  const ppg = player.gp > 0 ? (player.p / player.gp).toFixed(2) : "—";

  const radarData = player.metrics
    ? RADAR_AXES.map(({ key, label }) => ({
        axis: label,
        value: player.metrics![key as keyof typeof player.metrics] ?? 0,
        fullMark: 99,
      }))
    : null;

  return (
    <Link
      href={`/players/${player.id}`}
      className="block bg-white rounded-xl border border-border hover:shadow-lg hover:border-teal/30 transition-all group overflow-hidden"
    >
      {/* ── Header: Photo + Name + Position ─────────────── */}
      <div className="flex items-start gap-3 p-3 pb-2">
        {hasRealImage(player.image_url) ? (
          <div className="w-12 h-12 rounded-lg overflow-hidden bg-navy/10 shrink-0">
            <img
              src={assetUrl(player.image_url)}
              alt={`${player.first_name} ${player.last_name}`}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className="w-12 h-12 rounded-lg bg-navy/5 flex items-center justify-center shrink-0">
            <User size={20} className="text-navy/40" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-oswald font-bold text-navy text-sm leading-tight truncate group-hover:text-teal transition-colors">
              {player.first_name} {player.last_name}
            </h3>
            <PositionBadge position={player.position} />
          </div>
          <p className="text-[11px] text-muted truncate mt-0.5">
            {player.current_team}
            {player.current_league ? ` • ${player.current_league}` : ""}
          </p>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {player.archetype && (
              <span className="text-[10px] text-navy/60 font-medium italic truncate">
                {player.archetype}
              </span>
            )}
            <CommitmentBadge status={player.commitment_status} />
          </div>
        </div>
      </div>

      {/* ── Body: Radar + Grade ─────────────────────────── */}
      <div className="flex items-center px-3 pb-1">
        {/* Grade badge */}
        <div className="flex flex-col items-center gap-1 mr-2">
          <GradeBadge grade={player.overall_grade} />
          {player.overall_grade && player.overall_grade !== "NR" && (
            <span className="text-[9px] text-muted font-oswald uppercase tracking-wider">Grade</span>
          )}
        </div>

        {/* Radar chart */}
        {radarData ? (
          <div className="flex-1 h-[130px] -my-1">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                <PolarGrid stroke="#e5e7eb" strokeWidth={0.5} />
                <PolarAngleAxis
                  dataKey="axis"
                  tick={{ fontSize: 9, fill: "#6b7280", fontFamily: "Oswald, sans-serif" }}
                  tickLine={false}
                />
                <Radar
                  dataKey="value"
                  stroke={METRIC_COLORS.transition}
                  fill={METRIC_COLORS.transition}
                  fillOpacity={0.2}
                  strokeWidth={1.5}
                  dot={{ r: 2, fill: METRIC_COLORS.transition }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex-1 h-[130px] flex items-center justify-center">
            <p className="text-[11px] text-muted/50 italic">No metrics yet</p>
          </div>
        )}
      </div>

      {/* ── Footer: Stats Row ───────────────────────────── */}
      <div className="bg-navy/[0.03] border-t border-border/50 px-3 py-2">
        <div className="flex items-center justify-between text-[11px]">
          <StatCell label="GP" value={player.gp} />
          <StatCell label="G" value={player.g} />
          <StatCell label="A" value={player.a} />
          <StatCell label="P" value={player.p} />
          <StatCell label="PPG" value={ppg} highlight />
        </div>
      </div>
    </Link>
  );
}

function StatCell({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className="text-center">
      <p className={`font-oswald font-bold ${highlight ? "text-teal text-sm" : "text-navy text-xs"}`}>
        {value}
      </p>
      <p className="text-[9px] text-muted font-oswald uppercase tracking-wider">{label}</p>
    </div>
  );
}
