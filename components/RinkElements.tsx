// ============================================================
// ProspectX — Rink SVG Element Renderers
// Markers (X/O/G/C), Arrows (solid/dashed), Pucks
// Visual style ported from backend/rink_diagrams.py
// ============================================================

import { RINK_COLORS, MARKER_COLORS, type RinkMarker, type RinkArrow, type RinkPuck } from "@/types/rink";

// ── Marker Element ───────────────────────────────────────────

interface MarkerElementProps {
  marker: RinkMarker;
  selected: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
}

export function MarkerElement({ marker, selected, onMouseDown }: MarkerElementProps) {
  const r = 14;
  const fill = MARKER_COLORS[marker.markerType];

  return (
    <g onMouseDown={onMouseDown} style={{ cursor: "pointer" }}>
      {/* Selection ring */}
      {selected && (
        <circle
          cx={marker.x}
          cy={marker.y}
          r={r + 5}
          fill="none"
          stroke={RINK_COLORS.ORANGE}
          strokeWidth={2}
          strokeDasharray="4,3"
        />
      )}
      {/* Main circle */}
      <circle
        cx={marker.x}
        cy={marker.y}
        r={r}
        fill={fill}
        stroke="white"
        strokeWidth={1.5}
      />
      {/* Letter */}
      <text
        x={marker.x}
        y={marker.y + 1}
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="sans-serif"
        fontSize={11}
        fontWeight="bold"
        fill="white"
        style={{ pointerEvents: "none", userSelect: "none" }}
      >
        {marker.markerType}
      </text>
      {/* Optional label below */}
      {marker.label && (
        <text
          x={marker.x}
          y={marker.y + r + 12}
          textAnchor="middle"
          fontFamily="sans-serif"
          fontSize={9}
          fill={RINK_COLORS.NAVY}
          opacity={0.6}
          style={{ pointerEvents: "none", userSelect: "none" }}
        >
          {marker.label}
        </text>
      )}
    </g>
  );
}

// ── Arrow Element ────────────────────────────────────────────

interface ArrowElementProps {
  arrow: RinkArrow;
  selected: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
}

export function ArrowElement({ arrow, selected, onMouseDown }: ArrowElementProps) {
  const markerId = `arrowhead-${arrow.id}`;
  const dash = arrow.style === "dashed" ? "6,4" : undefined;
  const color = selected ? RINK_COLORS.ORANGE : arrow.color;

  return (
    <g onMouseDown={onMouseDown} style={{ cursor: "pointer" }}>
      <defs>
        <marker
          id={markerId}
          markerWidth={8}
          markerHeight={6}
          refX={8}
          refY={3}
          orient="auto"
        >
          <polygon points="0 0, 8 3, 0 6" fill={color} />
        </marker>
      </defs>
      {/* Wider invisible hit area for easier clicking */}
      <line
        x1={arrow.x1}
        y1={arrow.y1}
        x2={arrow.x2}
        y2={arrow.y2}
        stroke="transparent"
        strokeWidth={12}
      />
      {/* Visible arrow line */}
      <line
        x1={arrow.x1}
        y1={arrow.y1}
        x2={arrow.x2}
        y2={arrow.y2}
        stroke={color}
        strokeWidth={selected ? 3 : 2}
        strokeDasharray={dash}
        markerEnd={`url(#${markerId})`}
        opacity={0.7}
      />
    </g>
  );
}

// ── Puck Element ─────────────────────────────────────────────

interface PuckElementProps {
  puck: RinkPuck;
  selected: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
}

export function PuckElement({ puck, selected, onMouseDown }: PuckElementProps) {
  return (
    <g onMouseDown={onMouseDown} style={{ cursor: "pointer" }}>
      {/* Selection ring */}
      {selected && (
        <circle
          cx={puck.x}
          cy={puck.y}
          r={10}
          fill="none"
          stroke={RINK_COLORS.ORANGE}
          strokeWidth={2}
          strokeDasharray="4,3"
        />
      )}
      <circle
        cx={puck.x}
        cy={puck.y}
        r={5}
        fill="#111"
        stroke="white"
        strokeWidth={1}
      />
    </g>
  );
}
