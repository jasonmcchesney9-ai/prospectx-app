"use client";

import { useState, useCallback } from "react";

// ── Types ────────────────────────────────────────────────────
interface ShotEvent {
  id: string;
  action: string;
  map_type: string;
  pos_x: number;
  pos_y: number;
  x_pct: number;
  y_pct: number;
  period: number;
  game_id: string;
  game_date: string;
  opponent: string;
  is_goal: boolean;
}

interface ShotMapProps {
  events: ShotEvent[];
  width?: number;
  height?: number;
  showLegend?: boolean;
  title?: string;
}

// ── Color + radius config per map_type ───────────────────────
const DOT_CONFIG: Record<string, { color: string; opacity: number; label: string }> = {
  shot:         { color: "#0D9488", opacity: 0.75, label: "Shot" },
  shot_on_goal: { color: "#0D9488", opacity: 0.90, label: "Shot on Goal" },
  goal:         { color: "#E67E22", opacity: 1.0,  label: "Goal" },
  missed_shot:  { color: "#6B7280", opacity: 0.60, label: "Missed Shot" },
  blocked_shot: { color: "#6366F1", opacity: 0.70, label: "Blocked Shot" },
  pp_shot:      { color: "#F59E0B", opacity: 0.75, label: "PP Shot" },
  sh_shot:      { color: "#EF4444", opacity: 0.80, label: "SH Shot" },
  other:        { color: "#6B7280", opacity: 0.50, label: "Other" },
};

// ── Component ────────────────────────────────────────────────
export default function ShotMap({
  events,
  width = 600,
  height = 260,
  showLegend = true,
  title,
}: ShotMapProps) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; ev: ShotEvent } | null>(null);

  const handleDotEnter = useCallback((e: React.MouseEvent<SVGCircleElement>, ev: ShotEvent) => {
    const rect = (e.target as SVGCircleElement).ownerSVGElement?.getBoundingClientRect();
    if (!rect) return;
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    setTooltip({ x: cx, y: cy, ev });
  }, []);

  const handleDotLeave = useCallback(() => setTooltip(null), []);

  const hasEvents = events && events.length > 0;

  // Count events per map_type for legend
  const typeCounts: Record<string, number> = {};
  if (hasEvents) {
    for (const ev of events) {
      const mt = ev.map_type || "other";
      typeCounts[mt] = (typeCounts[mt] || 0) + 1;
    }
  }

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      {/* Optional title */}
      {title && (
        <div style={{ fontSize: 11, fontFamily: "'Oswald', sans-serif", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.5)", marginBottom: 6 }}>
          {title}
        </div>
      )}

      {/* Rink SVG */}
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: "block", borderRadius: 8 }}
      >
        {/* ── Rink outline ── */}
        <rect
          x={1} y={1}
          width={width - 2} height={height - 2}
          rx={20} ry={20}
          fill="none"
          stroke="rgba(255,255,255,0.15)"
          strokeWidth={1.5}
        />

        {/* ── Center line ── */}
        <line
          x1={width * 0.5} y1={0}
          x2={width * 0.5} y2={height}
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={1}
        />

        {/* ── Center ice circle ── */}
        <circle
          cx={width * 0.5} cy={height * 0.5}
          r={height * 0.10}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={1}
        />

        {/* ── Goal crease left ── */}
        <path
          d={`M ${width * 0.08} ${height * 0.5 - height * 0.06} A ${height * 0.06} ${height * 0.06} 0 0 0 ${width * 0.08} ${height * 0.5 + height * 0.06}`}
          fill="rgba(13,148,136,0.08)"
          stroke="rgba(13,148,136,0.3)"
          strokeWidth={1}
        />

        {/* ── Goal crease right ── */}
        <path
          d={`M ${width * 0.92} ${height * 0.5 - height * 0.06} A ${height * 0.06} ${height * 0.06} 0 0 1 ${width * 0.92} ${height * 0.5 + height * 0.06}`}
          fill="rgba(13,148,136,0.08)"
          stroke="rgba(13,148,136,0.3)"
          strokeWidth={1}
        />

        {/* ── Face-off circles (4) ── */}
        {[
          { cx: 0.25, cy: 0.30 },
          { cx: 0.25, cy: 0.70 },
          { cx: 0.75, cy: 0.30 },
          { cx: 0.75, cy: 0.70 },
        ].map((fo, i) => (
          <circle
            key={i}
            cx={width * fo.cx} cy={height * fo.cy}
            r={height * 0.08}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={1}
          />
        ))}

        {/* ── Event dots ── */}
        {hasEvents && events.map((ev) => {
          const cx = (ev.x_pct / 100) * width;
          const cy = (ev.y_pct / 100) * height;
          const cfg = DOT_CONFIG[ev.map_type] || DOT_CONFIG.other;
          const r = ev.is_goal ? 6 : 4;

          return (
            <g key={ev.id}>
              {/* Goal ring */}
              {ev.is_goal && (
                <circle
                  cx={cx} cy={cy} r={9}
                  fill="none"
                  stroke="#E67E22"
                  strokeWidth={1.5}
                  opacity={0.5}
                />
              )}
              {/* Event dot */}
              <circle
                cx={cx} cy={cy} r={r}
                fill={cfg.color}
                opacity={cfg.opacity}
                style={{ cursor: "pointer", transition: "r 0.1s" }}
                onMouseEnter={(e) => handleDotEnter(e, ev)}
                onMouseLeave={handleDotLeave}
              />
            </g>
          );
        })}

        {/* ── Empty state ── */}
        {!hasEvents && (
          <text
            x={width / 2} y={height / 2}
            textAnchor="middle"
            dominantBaseline="central"
            fill="rgba(255,255,255,0.3)"
            fontSize={12}
            fontFamily="'Oswald', sans-serif"
          >
            No event data available
          </text>
        )}
      </svg>

      {/* ── Tooltip ── */}
      {tooltip && (
        <div
          style={{
            position: "absolute",
            left: tooltip.x + 12,
            top: tooltip.y - 8,
            background: "rgba(6,14,26,0.92)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 5,
            padding: "5px 8px",
            fontSize: 10,
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            color: "rgba(255,255,255,0.8)",
            whiteSpace: "nowrap",
            zIndex: 50,
            pointerEvents: "none",
          }}
        >
          <div style={{ fontWeight: 700, color: "#FFFFFF", marginBottom: 2 }}>
            {tooltip.ev.action}
          </div>
          <div>P{tooltip.ev.period} — {tooltip.ev.game_date || "—"}</div>
          {tooltip.ev.opponent && (
            <div style={{ color: "rgba(255,255,255,0.5)" }}>vs {tooltip.ev.opponent}</div>
          )}
        </div>
      )}

      {/* ── Legend ── */}
      {showLegend && hasEvents && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 8, paddingLeft: 4 }}>
          {Object.entries(typeCounts).map(([mt, count]) => {
            const cfg = DOT_CONFIG[mt] || DOT_CONFIG.other;
            return (
              <div key={mt} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span
                  style={{
                    display: "inline-block",
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: cfg.color,
                    opacity: cfg.opacity,
                  }}
                />
                <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono', ui-monospace, monospace", color: "rgba(255,255,255,0.5)" }}>
                  {cfg.label} ({count})
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
