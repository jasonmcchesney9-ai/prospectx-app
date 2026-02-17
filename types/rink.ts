// ============================================================
// ProspectX — Rink Diagram Types
// Interactive hockey rink canvas data model
// ============================================================

export type RinkType = "full" | "half" | "quarter";

export type MarkerType = "X" | "O" | "G" | "C";

export type ArrowStyle = "solid" | "dashed";

export type ToolMode =
  | "select"
  | "marker_X"
  | "marker_O"
  | "marker_G"
  | "marker_C"
  | "arrow_solid"
  | "arrow_dashed"
  | "puck"
  | "eraser";

// ── Element Types ────────────────────────────────────────────

export interface RinkMarker {
  id: string;
  type: "marker";
  x: number;
  y: number;
  markerType: MarkerType;
  label: string;
}

export interface RinkArrow {
  id: string;
  type: "arrow";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  style: ArrowStyle;
  color: string;
}

export interface RinkPuck {
  id: string;
  type: "puck";
  x: number;
  y: number;
}

export type RinkElement = RinkMarker | RinkArrow | RinkPuck;

// ── Diagram Data (serializable to JSON) ──────────────────────

export interface RinkDiagramData {
  rinkType: RinkType;
  width: number;
  height: number;
  elements: RinkElement[];
  version: 1;
}

// ── Constants (match backend/rink_diagrams.py exactly) ───────

export const RINK_COLORS = {
  NAVY: "#0F2A3D",
  TEAL: "#18B3A6",
  ORANGE: "#F36F21",
  ICE: "#F0F8FF",
  RED_LINE: "#CC0000",
  BLUE_LINE: "#0055AA",
  CREASE_FILL: "#B8D4E8",
  BOARD_STROKE: "#0F2A3D",
  CONE: "#888888",
} as const;

export const MARKER_COLORS: Record<MarkerType, string> = {
  X: RINK_COLORS.TEAL,
  O: RINK_COLORS.NAVY,
  G: RINK_COLORS.ORANGE,
  C: RINK_COLORS.CONE,
};

export const RINK_DIMENSIONS: Record<RinkType, { w: number; h: number }> = {
  full: { w: 600, h: 280 },
  half: { w: 380, h: 300 },
  quarter: { w: 320, h: 300 },
};

export const RINK_LABELS: Record<RinkType, string> = {
  full: "Full Ice",
  half: "Half Ice",
  quarter: "Quarter Ice",
};
