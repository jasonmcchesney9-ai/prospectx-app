"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { User, Search, FileText, MoreVertical, ListPlus, Eye } from "lucide-react";
import type { PlayerCardData } from "@/types/api";
import { assetUrl, hasRealImage } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { formatLeague } from "@/lib/leagues";
import { useBenchTalk } from "./BenchTalkProvider";

const GOALIE_POSITIONS = new Set(["G", "GK", "Goalie"]);

const GRADE_TO_SCORE: Record<string, number> = {
  "A+": 10, "A": 9.5, "A-": 9, "B+": 8.5, "B": 8, "B-": 7.5,
  "C+": 7, "C": 6.5, "C-": 6, "D+": 5.5, "D": 5, "D-": 4.5, "F": 3, "NR": 0,
};
function gradeToScore(grade: string | null | undefined): number {
  if (!grade || grade === "NR") return 0;
  return GRADE_TO_SCORE[grade] ?? (parseFloat(grade) || 0);
}

const SPIDER_AXES = [
  { key: "sniper", label: "SNP" },
  { key: "hockey_iq", label: "IQ" },
  { key: "playmaker", label: "PLY" },
  { key: "transition", label: "TRN" },
  { key: "defensive", label: "DEF" },
  { key: "compete", label: "CMP" },
] as const;

function renderSpiderSVG(
  size: number,
  metrics: Record<string, number> | null,
  isEstimated: boolean
) {
  const cx = size / 2, cy = size / 2, r = size * 0.36;
  const n = SPIDER_AXES.length;
  const angleOf = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2;
  const pt = (i: number, pct: number) => {
    const a = angleOf(i);
    return `${cx + Math.cos(a) * r * pct},${cy + Math.sin(a) * r * pct}`;
  };

  const values = SPIDER_AXES.map(({ key }) =>
    metrics ? Math.min((metrics[key as keyof typeof metrics] ?? 0) / 99, 1) : 0
  );
  const hasData = values.some((v) => v > 0);
  const polyColor = isEstimated ? "rgba(245,158,11" : "rgba(13,148,136";

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Grid rings */}
      {[0.33, 0.66, 1].map((s) => (
        <polygon
          key={s}
          points={Array.from({ length: n }, (_, i) => pt(i, s)).join(" ")}
          fill="none"
          stroke="#E2EAF2"
          strokeWidth="0.5"
        />
      ))}
      {/* Axis lines */}
      {Array.from({ length: n }, (_, i) => (
        <line
          key={i}
          x1={String(cx)}
          y1={String(cy)}
          x2={pt(i, 1).split(",")[0]}
          y2={pt(i, 1).split(",")[1]}
          stroke="#E2EAF2"
          strokeWidth="0.5"
        />
      ))}
      {/* Data polygon */}
      {hasData && (
        <polygon
          points={values.map((v, i) => pt(i, Math.max(v, 0.05))).join(" ")}
          fill={`${polyColor},0.35)`}
          stroke={`${polyColor},1.0)`}
          strokeWidth="1"
        />
      )}
      {/* Labels */}
      {SPIDER_AXES.map(({ label }, i) => {
        const a = angleOf(i);
        const lx = cx + Math.cos(a) * (r + 8);
        const ly = cy + Math.sin(a) * (r + 8);
        return (
          <text
            key={label}
            x={lx}
            y={ly}
            textAnchor="middle"
            dominantBaseline="central"
            style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 5.5, fill: "#94A3B8" }}
          >
            {label}
          </text>
        );
      })}
    </svg>
  );
}

/** Position-specific silhouette when no photo */
function PlayerSilhouette({ position, size = 20 }: { position: string; size?: number }) {
  if (GOALIE_POSITIONS.has(position)) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ color: "rgba(255,255,255,0.4)" }}>
        <circle cx="12" cy="5" r="3" fill="currentColor" opacity="0.6" />
        <path d="M6 11h12v2H6z" fill="currentColor" opacity="0.3" />
        <path d="M8 13v7h2v-4h4v4h2v-7H8z" fill="currentColor" opacity="0.5" />
        <rect x="4" y="11" width="3" height="5" rx="1" fill="currentColor" opacity="0.4" />
        <rect x="17" y="11" width="3" height="5" rx="1" fill="currentColor" opacity="0.4" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ color: "rgba(255,255,255,0.4)" }}>
      <circle cx="12" cy="4" r="3" fill="currentColor" opacity="0.6" />
      <path d="M10 8h4l2 6h-8l2-6z" fill="currentColor" opacity="0.5" />
      <path d="M9 14l-2 6h2l2-4 2 4h2l-2-6H9z" fill="currentColor" opacity="0.4" />
      <line x1="15" y1="10" x2="19" y2="6" stroke="currentColor" strokeWidth="1.2" opacity="0.35" strokeLinecap="round" />
    </svg>
  );
}

// ── Overflow Menu ────────────────────────────────────────

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
        style={{ padding: 3, borderRadius: 4, color: "rgba(255,255,255,0.3)", cursor: "pointer", background: "none", border: "none" }}
        className="hover:bg-white/10 transition-colors"
        title="More actions"
      >
        <MoreVertical size={13} />
      </button>
      {open && (
        <div
          style={{ position: "absolute", right: 0, top: "100%", marginTop: 4, width: 176, background: "#FFFFFF", border: "1px solid #DDE6EF", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.12)", zIndex: 50, padding: "4px 0" }}
          onClick={(e) => e.preventDefault()}
        >
          <button
            onClick={(e) => { e.stopPropagation(); onScout(); setOpen(false); }}
            style={{ width: "100%", textAlign: "left", padding: "8px 12px", fontSize: 12, color: "#0F2942", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}
            className="hover:bg-[#F0F4F8] transition-colors"
          >
            <Search size={12} style={{ color: "#0D9488" }} /> Scout in Bench Talk
          </button>
          <Link
            href="/scouting"
            onClick={(e) => { e.stopPropagation(); setOpen(false); }}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", fontSize: 12, color: "#0F2942", textDecoration: "none" }}
            className="hover:bg-[#F0F4F8] transition-colors"
          >
            <ListPlus size={12} style={{ color: "#94A3B8" }} /> Add to Scouting List
          </Link>
          <Link
            href={`/players/${player.id}`}
            onClick={(e) => { e.stopPropagation(); setOpen(false); }}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", fontSize: 12, color: "#0F2942", textDecoration: "none" }}
            className="hover:bg-[#F0F4F8] transition-colors"
          >
            <Eye size={12} style={{ color: "#94A3B8" }} /> View Full Profile
          </Link>
        </div>
      )}
    </div>
  );
}

// ── Main Component ──────────────────────────────────────

export default function VisualPlayerCard({ player }: { player: PlayerCardData }) {
  const { openBenchTalk } = useBenchTalk();
  const ppg = player.gp > 0 ? (player.p / player.gp).toFixed(2) : "---";
  const pxrScore = (player as unknown as Record<string, unknown>).pxr_score as number | null | undefined;
  const pxrEstimated = (player as unknown as Record<string, unknown>).pxr_estimated as boolean | undefined;
  const pxrTier = (player as unknown as Record<string, unknown>).pxr_tier as string | null | undefined;

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
      className="block overflow-hidden group"
      style={{ borderRadius: 10, border: "1px solid #DDE6EF", transition: "all 0.15s", textDecoration: "none" }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.borderColor = "rgba(13,148,136,0.3)";
        el.style.boxShadow = "0 4px 16px rgba(13,148,136,0.08)";
        el.style.transform = "translateY(-1px)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.borderColor = "#DDE6EF";
        el.style.boxShadow = "none";
        el.style.transform = "translateY(0)";
      }}
    >
      {/* ── Header: Navy bg, Photo, Name, Position ── */}
      <div style={{ background: "#0F2942", padding: "10px 12px", display: "flex", alignItems: "center", gap: 10 }}>
        {/* Player photo */}
        {hasRealImage(player.image_url) ? (
          <div style={{ width: 38, height: 38, borderRadius: "50%", overflow: "hidden", border: "2px solid rgba(13,148,136,0.4)", flexShrink: 0 }}>
            <img
              src={assetUrl(player.image_url)}
              alt={`${player.first_name} ${player.last_name}`}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>
        ) : (
          <div style={{ width: 38, height: 38, borderRadius: "50%", background: "rgba(255,255,255,0.06)", border: "2px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <PlayerSilhouette position={player.position} size={20} />
          </div>
        )}

        {/* Name + Team */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 14, color: "#FFFFFF", textTransform: "uppercase", letterSpacing: "0.03em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.2 }}>
            {player.first_name} {player.last_name}
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
            {player.current_team && (
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "rgba(255,255,255,0.6)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {player.current_team}
              </span>
            )}
            {player.current_league && (
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "rgba(255,255,255,0.6)" }}>
                {player.current_team ? " · " : ""}{formatLeague(player.current_league)}
              </span>
            )}
          </div>
        </div>

        {/* Position badge + Overflow */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
          <div style={{ width: 26, height: 26, borderRadius: 6, background: "rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 11, color: "rgba(255,255,255,0.6)" }}>{player.position}</span>
          </div>
          <OverflowMenu player={player} onScout={() => openBenchTalk(`Scout ${player.first_name} ${player.last_name}`)} />
        </div>
      </div>

      {/* ── Body: Spider + PXR + Archetype ── */}
      <div style={{ background: "#FFFFFF", padding: "10px 12px", display: "flex", alignItems: "center", gap: 10 }}>
        {/* Spider chart */}
        <div style={{ width: 80, height: 80, flexShrink: 0, borderRadius: "50%", background: "#EAF4F3", border: "1px solid rgba(13,148,136,0.15)", padding: 6, display: "flex", alignItems: "center", justifyContent: "center", boxSizing: "border-box" }}>
          {renderSpiderSVG(66, player.metrics, !!pxrEstimated)}
        </div>

        {/* PXR Score + Archetype */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            {pxrScore != null ? (
              <>
                <span style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 20, color: pxrEstimated ? "#F59E0B" : "#0D9488", lineHeight: 1 }}>
                  {typeof pxrScore === "number" ? pxrScore.toFixed(1) : pxrScore}
                </span>
                {pxrTier && (
                  <span style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 9, textTransform: "uppercase", padding: "2px 5px", borderRadius: 4, background: pxrEstimated ? "rgba(245,158,11,0.12)" : "rgba(13,148,136,0.12)", color: pxrEstimated ? "#F59E0B" : "#0D9488" }}>
                    {pxrTier}
                  </span>
                )}
              </>
            ) : (
              <span style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 20, color: "#94A3B8", lineHeight: 1 }}>—</span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
            {pxrScore != null && (
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: "#94A3B8", textTransform: "uppercase" }}>
                {pxrEstimated ? "PXR~" : "PXR"}
              </span>
            )}
          </div>
          {player.archetype && (
            <p style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 600, fontSize: 9, color: "#0D9488", textTransform: "uppercase", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {player.archetype}
            </p>
          )}
        </div>
      </div>

      {/* ── Stats Row ── */}
      <div style={{ background: "#F5F5F5", borderRadius: 6, margin: "0 12px 10px", overflow: "hidden", display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr" }}>
        <StatCell label="GP" value={player.gp} />
        <StatCell label="G" value={player.g} divider />
        <StatCell label="A" value={player.a} divider />
        <StatCell label="P" value={player.p} divider highlight />
        <StatCell label="PPG" value={ppg} divider highlight />
      </div>

      {/* ── Footer: Scout + Report buttons ── */}
      <div style={{ background: "#FAFBFC", borderTop: "1px solid #DDE6EF", padding: "8px 12px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        <button
          onClick={handleScout}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "7px 0", borderRadius: 6, background: "rgba(13,148,136,0.1)", color: "#0D9488", border: "1px solid rgba(13,148,136,0.2)", fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.04em", cursor: "pointer" }}
          className="hover:opacity-80 transition-opacity"
        >
          <Search size={11} /> Scout
        </button>
        <button
          onClick={handleReport}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "7px 0", borderRadius: 6, background: "#F5F5F5", color: "#666666", border: "1px solid #DDE6EF", fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.04em", cursor: "pointer" }}
          className="hover:opacity-80 transition-opacity"
        >
          <FileText size={11} /> Report
        </button>
      </div>
    </Link>
  );
}

function StatCell({ label, value, highlight, divider }: { label: string; value: string | number; highlight?: boolean; divider?: boolean }) {
  return (
    <div style={{ textAlign: "center", padding: "8px 4px", borderLeft: divider ? "1px solid #E5E5E5" : "none" }}>
      <p style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 14, color: highlight ? "#0D9488" : "#0F2942", lineHeight: 1.1 }}>
        {value}
      </p>
      <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: "#94A3B8", textTransform: "uppercase", marginTop: 2 }}>{label}</p>
    </div>
  );
}
