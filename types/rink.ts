// ============================================================
// ProspectX — Rink Diagram Types
// Interactive hockey rink canvas data model
// ============================================================

export type RinkType = "full" | "half" | "quarter";

export type MarkerType = "X" | "O" | "G" | "C";

export type ArrowStyle = "solid" | "dashed";

export type ArrowVariant =
  | "skate"
  | "skate_puck"
  | "backward"
  | "backward_puck"
  | "pass"
  | "shot"
  | "lateral";

export type ToolMode =
  | "select"
  | "marker_X"
  | "marker_O"
  | "marker_G"
  | "marker_C"
  | "arrow_solid"
  | "arrow_dashed"
  | "arrow_skate_puck"
  | "arrow_backward"
  | "arrow_backward_puck"
  | "arrow_pass"
  | "arrow_shot"
  | "arrow_lateral"
  | "puck"
  | "pylon"
  | "net"
  | "freehand"
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
  variant?: ArrowVariant;
  strokeWidth?: number;
}

export interface RinkPuck {
  id: string;
  type: "puck";
  x: number;
  y: number;
}

export interface RinkPylon {
  id: string;
  type: "pylon";
  x: number;
  y: number;
}

export interface RinkNet {
  id: string;
  type: "net";
  x: number;
  y: number;
}

export interface RinkFreehandLine {
  id: string;
  type: "freehand";
  points: { x: number; y: number }[];
  color: string;
  arrowEnd: boolean;
}

export type RinkElement = RinkMarker | RinkArrow | RinkPuck | RinkPylon | RinkNet | RinkFreehandLine;

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
  PASS_BLUE: "#2563EB",
  SHOT_RED: "#DC2626",
  BACKWARD: "#7C3AED",
  PYLON_ORANGE: "#F97316",
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
