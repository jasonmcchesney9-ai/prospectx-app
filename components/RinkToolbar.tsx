// ============================================================
// ProspectX — Rink Diagram Toolbar
// Tool selection, rink type, actions (undo, clear, export)
// ============================================================

import { Undo2, Trash2, Download, Image, MousePointer2, Eraser, X as XIcon } from "lucide-react";
import { RINK_COLORS, MARKER_COLORS, RINK_LABELS, type RinkType, type ToolMode, type RinkElement } from "@/types/rink";

interface RinkToolbarProps {
  rinkType: RinkType;
  onRinkTypeChange: (type: RinkType) => void;
  toolMode: ToolMode;
  onToolModeChange: (mode: ToolMode) => void;
  onClear: () => void;
  onUndo: () => void;
  onExportSvg: () => void;
  onExportPng: () => void;
  canUndo: boolean;
  selectedElement: RinkElement | null;
  onDeleteSelected: () => void;
}

// ── Mini marker preview (inline SVG) ─────────────────────────

function MarkerPreview({ letter, color }: { letter: string; color: string }) {
  return (
    <svg width={18} height={18} viewBox="0 0 18 18">
      <circle cx={9} cy={9} r={7} fill={color} stroke="white" strokeWidth={1} />
      <text x={9} y={10} textAnchor="middle" dominantBaseline="central" fontSize={8} fontWeight="bold" fill="white">
        {letter}
      </text>
    </svg>
  );
}

// ── Arrow preview (inline SVG) ───────────────────────────────

function ArrowPreview({ dashed }: { dashed: boolean }) {
  return (
    <svg width={20} height={14} viewBox="0 0 20 14">
      <defs>
        <marker id={`tb-arr-${dashed ? "d" : "s"}`} markerWidth={6} markerHeight={4} refX={6} refY={2} orient="auto">
          <polygon points="0 0, 6 2, 0 4" fill={RINK_COLORS.NAVY} />
        </marker>
      </defs>
      <line
        x1={2} y1={7} x2={14} y2={7}
        stroke={RINK_COLORS.NAVY}
        strokeWidth={1.5}
        strokeDasharray={dashed ? "3,2" : undefined}
        markerEnd={`url(#tb-arr-${dashed ? "d" : "s"})`}
      />
    </svg>
  );
}

// ── Puck preview ─────────────────────────────────────────────

function PuckPreview() {
  return (
    <svg width={14} height={14} viewBox="0 0 14 14">
      <circle cx={7} cy={7} r={4} fill="#111" stroke="white" strokeWidth={0.8} />
    </svg>
  );
}

// ── Tool Button ──────────────────────────────────────────────

function ToolBtn({
  active,
  onClick,
  label,
  children,
  title,
}: {
  active?: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title || label}
      className={`flex flex-col items-center justify-center w-10 h-10 rounded-lg border transition-all ${
        active
          ? "bg-teal/10 border-teal ring-1 ring-teal text-teal"
          : "border-transparent hover:bg-navy/[0.04] text-navy/60 hover:text-navy"
      }`}
    >
      <div className="flex items-center justify-center h-5">{children}</div>
      <span className="font-oswald uppercase text-[7px] tracking-wider leading-none mt-0.5">{label}</span>
    </button>
  );
}

// ── Action Button ────────────────────────────────────────────

function ActionBtn({
  onClick,
  disabled,
  children,
  title,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  title: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="p-1.5 rounded-lg text-navy/40 hover:text-navy hover:bg-navy/[0.04] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  );
}

// ── Main Toolbar ─────────────────────────────────────────────

export default function RinkToolbar({
  rinkType,
  onRinkTypeChange,
  toolMode,
  onToolModeChange,
  onClear,
  onUndo,
  onExportSvg,
  onExportPng,
  canUndo,
  selectedElement,
  onDeleteSelected,
}: RinkToolbarProps) {
  const rinkTypes: RinkType[] = ["full", "half", "quarter"];

  return (
    <div className="flex flex-wrap items-center gap-1 px-3 py-2 bg-white border border-teal/20 rounded-xl">
      {/* ── Rink Type Selector ── */}
      <div className="flex rounded-lg overflow-hidden border border-teal/20 mr-2">
        {rinkTypes.map((rt) => (
          <button
            key={rt}
            onClick={() => onRinkTypeChange(rt)}
            className={`px-2.5 py-1 text-[10px] font-oswald uppercase tracking-wider transition-colors ${
              rinkType === rt
                ? "bg-navy text-white"
                : "bg-navy/[0.03] text-navy/50 hover:bg-navy/[0.08] hover:text-navy/70"
            }`}
          >
            {RINK_LABELS[rt]}
          </button>
        ))}
      </div>

      {/* ── Divider ── */}
      <div className="w-px h-7 bg-border mx-1" />

      {/* ── Tool Buttons ── */}
      <ToolBtn active={toolMode === "select"} onClick={() => onToolModeChange("select")} label="Select" title="Select & Move (V)">
        <MousePointer2 size={14} />
      </ToolBtn>

      <ToolBtn active={toolMode === "marker_X"} onClick={() => onToolModeChange("marker_X")} label="Fwd" title="Forward Marker (X)">
        <MarkerPreview letter="X" color={MARKER_COLORS.X} />
      </ToolBtn>

      <ToolBtn active={toolMode === "marker_O"} onClick={() => onToolModeChange("marker_O")} label="Def" title="Defense Marker (O)">
        <MarkerPreview letter="O" color={MARKER_COLORS.O} />
      </ToolBtn>

      <ToolBtn active={toolMode === "marker_G"} onClick={() => onToolModeChange("marker_G")} label="Goalie" title="Goalie Marker (G)">
        <MarkerPreview letter="G" color={MARKER_COLORS.G} />
      </ToolBtn>

      <ToolBtn active={toolMode === "marker_C"} onClick={() => onToolModeChange("marker_C")} label="Cone" title="Cone Marker (C)">
        <MarkerPreview letter="C" color={MARKER_COLORS.C} />
      </ToolBtn>

      {/* ── Divider ── */}
      <div className="w-px h-7 bg-border mx-1" />

      <ToolBtn active={toolMode === "arrow_solid"} onClick={() => onToolModeChange("arrow_solid")} label="Move" title="Skating Path (solid arrow)">
        <ArrowPreview dashed={false} />
      </ToolBtn>

      <ToolBtn active={toolMode === "arrow_dashed"} onClick={() => onToolModeChange("arrow_dashed")} label="Pass" title="Pass / Puck Movement (dashed arrow)">
        <ArrowPreview dashed={true} />
      </ToolBtn>

      <ToolBtn active={toolMode === "puck"} onClick={() => onToolModeChange("puck")} label="Puck" title="Place Puck">
        <PuckPreview />
      </ToolBtn>

      <ToolBtn active={toolMode === "eraser"} onClick={() => onToolModeChange("eraser")} label="Erase" title="Eraser — click element to remove">
        <Eraser size={14} />
      </ToolBtn>

      {/* ── Divider ── */}
      <div className="w-px h-7 bg-border mx-1" />

      {/* ── Actions ── */}
      <ActionBtn onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)">
        <Undo2 size={16} />
      </ActionBtn>

      <ActionBtn onClick={onClear} title="Clear All">
        <Trash2 size={16} />
      </ActionBtn>

      {selectedElement && (
        <ActionBtn onClick={onDeleteSelected} title="Delete Selected">
          <XIcon size={16} />
        </ActionBtn>
      )}

      {/* ── Spacer ── */}
      <div className="flex-1" />

      {/* ── Export ── */}
      <ActionBtn onClick={onExportSvg} title="Download SVG">
        <Download size={16} />
      </ActionBtn>

      <ActionBtn onClick={onExportPng} title="Download PNG">
        <Image size={16} />
      </ActionBtn>
    </div>
  );
}
