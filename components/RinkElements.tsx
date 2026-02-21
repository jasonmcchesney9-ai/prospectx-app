// ============================================================
// ProspectX — Rink SVG Element Renderers
// Markers (X/O/G/C), Arrows (solid/dashed), Pucks
// Visual style ported from backend/rink_diagrams.py
// ============================================================

import { RINK_COLORS, MARKER_COLORS, type RinkMarker, type RinkArrow, type RinkPuck, type RinkPylon, type RinkNet, type RinkFreehandLine } from "@/types/rink";

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
  const variant = arrow.variant || "skate";
  const hasPuck = variant === "skate_puck" || variant === "backward_puck";

  // Determine visual properties from variant
  let dash: string | undefined;
  let strokeW = arrow.strokeWidth || 2;
  let effectiveColor = arrow.color;

  switch (variant) {
    case "backward":
    case "backward_puck":
      dash = "10,5";
      break;
    case "pass":
      dash = "6,4";
      break;
    case "shot":
      strokeW = 3.5;
      break;
    case "skate":
    case "skate_puck":
    default:
      dash = arrow.style === "dashed" ? "6,4" : undefined;
      break;
  }

  if (selected) effectiveColor = RINK_COLORS.ORANGE;

  // Lateral variant: render zigzag polyline
  if (variant === "lateral") {
    const dx = arrow.x2 - arrow.x1;
    const dy = arrow.y2 - arrow.y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > 0) {
      const segments = Math.max(4, Math.round(len / 15));
      const perpX = (-dy / len) * 6;
      const perpY = (dx / len) * 6;
      const zigPoints: string[] = [`${arrow.x1},${arrow.y1}`];
      for (let i = 1; i < segments; i++) {
        const t = i / segments;
        const baseX = arrow.x1 + dx * t;
        const baseY = arrow.y1 + dy * t;
        const side = i % 2 === 0 ? 1 : -1;
        zigPoints.push(`${baseX + perpX * side},${baseY + perpY * side}`);
      }
      zigPoints.push(`${arrow.x2},${arrow.y2}`);
      return (
        <g onMouseDown={onMouseDown} style={{ cursor: "pointer" }}>
          <defs>
            <marker id={markerId} markerWidth={8} markerHeight={6} refX={8} refY={3} orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill={effectiveColor} />
            </marker>
          </defs>
          <polyline points={zigPoints.join(" ")} fill="none" stroke="transparent" strokeWidth={12} />
          <polyline
            points={zigPoints.join(" ")}
            fill="none"
            stroke={effectiveColor}
            strokeWidth={selected ? 3 : 2}
            strokeLinejoin="round"
            markerEnd={`url(#${markerId})`}
            opacity={0.7}
          />
        </g>
      );
    }
  }

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
          <polygon points="0 0, 8 3, 0 6" fill={effectiveColor} />
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
        stroke={effectiveColor}
        strokeWidth={selected ? strokeW + 1 : strokeW}
        strokeDasharray={dash}
        markerEnd={`url(#${markerId})`}
        opacity={0.7}
      />
      {/* Puck at endpoint for _puck variants */}
      {hasPuck && (
        <circle cx={arrow.x2} cy={arrow.y2} r={4} fill="#111" stroke="white" strokeWidth={0.8} />
      )}
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

// ── Pylon Element ───────────────────────────────────────────

interface PylonElementProps {
  pylon: RinkPylon;
  selected: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
}

export function PylonElement({ pylon, selected, onMouseDown }: PylonElementProps) {
  const size = 12;
  const points = `${pylon.x},${pylon.y - size} ${pylon.x - size * 0.7},${pylon.y + size * 0.5} ${pylon.x + size * 0.7},${pylon.y + size * 0.5}`;
  return (
    <g onMouseDown={onMouseDown} style={{ cursor: "pointer" }}>
      {selected && (
        <circle
          cx={pylon.x}
          cy={pylon.y}
          r={size + 5}
          fill="none"
          stroke={RINK_COLORS.ORANGE}
          strokeWidth={2}
          strokeDasharray="4,3"
        />
      )}
      <polygon points={points} fill={RINK_COLORS.PYLON_ORANGE} stroke="white" strokeWidth={1} />
    </g>
  );
}

// ── Net Element ─────────────────────────────────────────────

interface NetElementProps {
  net: RinkNet;
  selected: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
}

export function NetElement({ net, selected, onMouseDown }: NetElementProps) {
  const w = 20, h = 14;
  return (
    <g onMouseDown={onMouseDown} style={{ cursor: "pointer" }}>
      {selected && (
        <rect
          x={net.x - w / 2 - 4}
          y={net.y - h / 2 - 4}
          width={w + 8}
          height={h + 8}
          rx={3}
          fill="none"
          stroke={RINK_COLORS.ORANGE}
          strokeWidth={2}
          strokeDasharray="4,3"
        />
      )}
      <rect x={net.x - w / 2} y={net.y - h / 2} width={w} height={h} rx={2} fill="white" stroke={RINK_COLORS.NAVY} strokeWidth={1.5} />
      {/* Net mesh lines */}
      <line x1={net.x - w / 2 + 4} y1={net.y - h / 2} x2={net.x - w / 2 + 4} y2={net.y + h / 2} stroke={RINK_COLORS.NAVY} strokeWidth={0.5} opacity={0.3} />
      <line x1={net.x + w / 2 - 4} y1={net.y - h / 2} x2={net.x + w / 2 - 4} y2={net.y + h / 2} stroke={RINK_COLORS.NAVY} strokeWidth={0.5} opacity={0.3} />
      <line x1={net.x - w / 2} y1={net.y} x2={net.x + w / 2} y2={net.y} stroke={RINK_COLORS.NAVY} strokeWidth={0.5} opacity={0.3} />
    </g>
  );
}

// ── Freehand Line Element ───────────────────────────────────

interface FreehandLineElementProps {
  line: RinkFreehandLine;
  selected: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
}

export function FreehandLineElement({ line, selected, onMouseDown }: FreehandLineElementProps) {
  if (line.points.length < 2) return null;

  const markerId = `freehand-arrow-${line.id}`;
  const color = selected ? RINK_COLORS.ORANGE : line.color;
  const d = line.points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  return (
    <g onMouseDown={onMouseDown} style={{ cursor: "pointer" }}>
      {selected && (
        <path d={d} fill="none" stroke={RINK_COLORS.ORANGE} strokeWidth={6} opacity={0.2} strokeLinecap="round" strokeLinejoin="round" />
      )}
      <defs>
        {line.arrowEnd && (
          <marker id={markerId} markerWidth={8} markerHeight={6} refX={8} refY={3} orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill={color} />
          </marker>
        )}
      </defs>
      {/* Wider hit area */}
      <path d={d} fill="none" stroke="transparent" strokeWidth={12} strokeLinecap="round" strokeLinejoin="round" />
      {/* Visible path */}
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={selected ? 3 : 2}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.7}
        markerEnd={line.arrowEnd ? `url(#${markerId})` : undefined}
      />
    </g>
  );
}
