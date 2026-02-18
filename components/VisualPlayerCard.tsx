"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { User, Search, FileText, MoreVertical, ListPlus, GitCompareArrows, MessageSquare, Eye } from "lucide-react";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  ResponsiveContainer,
} from "recharts";
import type { PlayerCardData } from "@/types/api";
import { GRADE_COLORS, METRIC_COLORS, COMMITMENT_STATUS_COLORS } from "@/types/api";
import PlayerStatusBadges from "./PlayerStatusBadges";
import { assetUrl, hasRealImage } from "@/lib/api";
import { formatLeague } from "@/lib/leagues";
import { useBenchTalk } from "./BenchTalkProvider";

const RADAR_AXES = [
  { key: "sniper", label: "SNP" },
  { key: "playmaker", label: "PLY" },
  { key: "transition", label: "TRN" },
  { key: "defensive", label: "DEF" },
  { key: "compete", label: "CMP" },
  { key: "hockey_iq", label: "IQ" },
] as const;

const GOALIE_POSITIONS = new Set(["G", "GK", "Goalie"]);

// ── Sub-Components ──────────────────────────────────────────

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

/** Position-specific silhouette when no photo */
function PlayerSilhouette({ position, size = 20 }: { position: string; size?: number }) {
  if (GOALIE_POSITIONS.has(position)) {
    // Goalie silhouette — wider stance, blocker/glove hint
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="text-navy/40">
        <circle cx="12" cy="5" r="3" fill="currentColor" opacity="0.6" />
        <path d="M6 11h12v2H6z" fill="currentColor" opacity="0.3" />
        <path d="M8 13v7h2v-4h4v4h2v-7H8z" fill="currentColor" opacity="0.5" />
        <rect x="4" y="11" width="3" height="5" rx="1" fill="currentColor" opacity="0.4" />
        <rect x="17" y="11" width="3" height="5" rx="1" fill="currentColor" opacity="0.4" />
      </svg>
    );
  }
  // Skater silhouette — stick + skating stance
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="text-navy/40">
      <circle cx="12" cy="4" r="3" fill="currentColor" opacity="0.6" />
      <path d="M10 8h4l2 6h-8l2-6z" fill="currentColor" opacity="0.5" />
      <path d="M9 14l-2 6h2l2-4 2 4h2l-2-6H9z" fill="currentColor" opacity="0.4" />
      <line x1="15" y1="10" x2="19" y2="6" stroke="currentColor" strokeWidth="1.2" opacity="0.35" strokeLinecap="round" />
    </svg>
  );
}

/** Metric circle with value inside + label below */
function MetricCircle({ label, value }: { label: string; value: number | null }) {
  const hasValue = value !== null && value !== undefined;
  const fillOpacity = hasValue ? Math.max(0.1, (value / 99) * 0.5) : 0;
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div
        className={`w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-oswald font-bold ${
          hasValue
            ? "border border-teal/30 text-navy"
            : "border border-dashed border-navy/20 text-navy/30"
        }`}
        style={hasValue ? { backgroundColor: `rgba(24, 179, 166, ${fillOpacity})` } : undefined}
      >
        {hasValue ? Math.round(value) : "?"}
      </div>
      <span className="text-[7px] font-oswald uppercase tracking-wider text-muted">{label}</span>
    </div>
  );
}

/** "Needs Scouting" badge for unscouted players */
function NeedsScoutingBadge() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center h-[130px] gap-2">
      <span className="px-2.5 py-1 rounded-lg border-2 border-dashed border-orange/40 bg-orange/5 text-orange text-[10px] font-oswald font-bold uppercase tracking-wider">
        Needs Scouting
      </span>
      <span className="text-[9px] text-muted/50">No intelligence data yet</span>
    </div>
  );
}

// ── Overflow Menu ────────────────────────────────────────────

function OverflowMenu({ player, onScout }: { player: PlayerCardData; onScout: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) {
      document.addEventListener("mousedown", handler);
      return () => document.removeEventListener("mousedown", handler);
    }
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(!open); }}
        className="p-1 rounded-md text-navy/30 hover:text-navy hover:bg-navy/5 transition-colors"
        title="More actions"
      >
        <MoreVertical size={14} />
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-1 w-44 bg-white border border-teal/20 rounded-lg shadow-xl z-50 py-1"
          onClick={(e) => e.preventDefault()}
        >
          <button
            onClick={(e) => { e.stopPropagation(); onScout(); setOpen(false); }}
            className="w-full text-left px-3 py-2 text-xs text-navy hover:bg-navy/[0.03] flex items-center gap-2 transition-colors"
          >
            <Search size={12} className="text-teal" /> Scout in Bench Talk
          </button>
          <Link
            href={`/scouting`}
            onClick={(e) => { e.stopPropagation(); setOpen(false); }}
            className="block px-3 py-2 text-xs text-navy hover:bg-navy/[0.03] flex items-center gap-2 transition-colors"
          >
            <ListPlus size={12} className="text-muted" /> Add to Scouting List
          </Link>
          <Link
            href={`/players/${player.id}`}
            onClick={(e) => { e.stopPropagation(); setOpen(false); }}
            className="block px-3 py-2 text-xs text-navy hover:bg-navy/[0.03] flex items-center gap-2 transition-colors"
          >
            <Eye size={12} className="text-muted" /> View Full Profile
          </Link>
        </div>
      )}
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────

export default function VisualPlayerCard({ player }: { player: PlayerCardData }) {
  const { openBenchTalk } = useBenchTalk();
  const ppg = player.gp > 0 ? (player.p / player.gp).toFixed(2) : "---";

  const radarData = player.metrics
    ? RADAR_AXES.map(({ key, label }) => ({
        axis: label,
        value: player.metrics![key as keyof typeof player.metrics] ?? 0,
        fullMark: 99,
      }))
    : null;

  const hasIntel = !!(player.overall_grade && player.overall_grade !== "NR") || !!player.metrics;

  function handleScout(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    openBenchTalk(`Scout ${player.first_name} ${player.last_name}. Give me a scouting overview, strengths, weaknesses, and role projection.`);
  }

  function handleReport(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    window.location.href = `/reports/generate?player_id=${player.id}`;
  }

  return (
    <Link
      href={`/players/${player.id}`}
      className="block bg-white rounded-xl border border-teal/20 hover:shadow-lg hover:border-teal/30 transition-all group overflow-hidden"
    >
      {/* ── Header: Photo + Name + Position + Overflow ── */}
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
            <PlayerSilhouette position={player.position} size={22} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-1">
            <div className="min-w-0 flex-1">
              <h3 className="font-oswald font-bold text-navy text-sm leading-tight truncate group-hover:text-teal transition-colors">
                {player.first_name} {player.last_name}
              </h3>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <PositionBadge position={player.position} />
              <OverflowMenu player={player} onScout={() => openBenchTalk(`Scout ${player.first_name} ${player.last_name}`)} />
            </div>
          </div>
          <p className="text-[11px] text-muted truncate mt-0.5">
            {player.current_team}
            {player.current_league ? ` • ${formatLeague(player.current_league)}` : ""}
          </p>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {player.archetype && (
              <span className="text-[10px] text-navy/60 font-medium italic truncate">
                {player.archetype}
              </span>
            )}
            <CommitmentBadge status={player.commitment_status} />
            <PlayerStatusBadges tags={player.tags || []} size="sm" />
          </div>
        </div>
      </div>

      {/* ── Body: Radar / Metrics + Grade ─────────────── */}
      <div className="flex items-center px-3 pb-1">
        {/* Grade badge */}
        <div className="flex flex-col items-center gap-1 mr-2">
          <GradeBadge grade={player.overall_grade} />
          {player.overall_grade && player.overall_grade !== "NR" && (
            <span className="text-[9px] text-muted font-oswald uppercase tracking-wider">Grade</span>
          )}
        </div>

        {/* Radar chart / Needs Scouting / Metric circles */}
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
          <NeedsScoutingBadge />
        )}
      </div>

      {/* ── Metric Circles Row (when metrics exist) ────── */}
      {player.metrics && (
        <div className="flex items-center justify-around px-3 pb-2">
          {RADAR_AXES.map(({ key, label }) => (
            <MetricCircle
              key={key}
              label={label}
              value={player.metrics ? player.metrics[key as keyof typeof player.metrics] : null}
            />
          ))}
        </div>
      )}

      {/* ── Quick Actions ─────────────────────────────── */}
      <div className="flex gap-1.5 px-3 pb-2">
        <button
          onClick={handleScout}
          className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg bg-teal/10 text-teal text-[10px] font-oswald font-bold uppercase tracking-wider hover:bg-teal/20 transition-colors"
        >
          <Search size={11} />
          Scout
        </button>
        <button
          onClick={handleReport}
          className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg bg-navy/5 text-navy/70 text-[10px] font-oswald font-bold uppercase tracking-wider hover:bg-navy/10 transition-colors"
        >
          <FileText size={11} />
          Report
        </button>
      </div>

      {/* ── Footer: Stats Row ─────────────────────────── */}
      <div className="bg-navy/[0.03] border-t border-teal/10 px-3 py-2">
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
