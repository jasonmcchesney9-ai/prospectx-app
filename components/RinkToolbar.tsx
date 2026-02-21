// ============================================================
// ProspectX — Rink Diagram Toolbar
// Tool selection, rink type, actions (undo, clear, export)
// ============================================================

import { Undo2, Redo2, Trash2, Download, Image, MousePointer2, Eraser, X as XIcon, HelpCircle, Film, Loader2 } from "lucide-react";
import { RINK_COLORS, MARKER_COLORS, RINK_LABELS, type RinkType, type ToolMode, type RinkElement } from "@/types/rink";

interface RinkToolbarProps {
  rinkType: RinkType;
  onRinkTypeChange: (type: RinkType) => void;
  toolMode: ToolMode;
  onToolModeChange: (mode: ToolMode) => void;
  onClear: () => void;
  onUndo: () => void;
  onRedo?: () => void;
  onExportSvg: () => void;
  onExportPng: () => void;
  canUndo: boolean;
  canRedo?: boolean;
  selectedElement: RinkElement | null;
  onDeleteSelected: () => void;
  onToggleHelp?: () => void;
  onExportGif?: () => void;
  exportingGif?: boolean;
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

function ArrowPreview({ dashed, color }: { dashed: boolean; color?: string }) {
  const c = color || RINK_COLORS.NAVY;
  const id = `tb-arr-${dashed ? "d" : "s"}-${c.replace("#", "")}`;
  return (
    <svg width={20} height={14} viewBox="0 0 20 14">
      <defs>
        <marker id={id} markerWidth={6} markerHeight={4} refX={6} refY={2} orient="auto">
          <polygon points="0 0, 6 2, 0 4" fill={c} />
        </marker>
      </defs>
      <line
        x1={2} y1={7} x2={14} y2={7}
        stroke={c}
        strokeWidth={1.5}
        strokeDasharray={dashed ? "3,2" : undefined}
        markerEnd={`url(#${id})`}
      />
    </svg>
  );
}

// ── Skate+puck preview ──────────────────────────────────────

function SkatePuckPreview() {
  return (
    <svg width={20} height={14} viewBox="0 0 20 14">
      <defs>
        <marker id="tb-arr-sp" markerWidth={6} markerHeight={4} refX={6} refY={2} orient="auto">
          <polygon points="0 0, 6 2, 0 4" fill={RINK_COLORS.TEAL} />
        </marker>
      </defs>
      <line x1={2} y1={7} x2={12} y2={7} stroke={RINK_COLORS.TEAL} strokeWidth={1.5} markerEnd="url(#tb-arr-sp)" />
      <circle cx={16} cy={7} r={2.5} fill="#111" stroke="white" strokeWidth={0.5} />
    </svg>
  );
}

// ── Backward preview ────────────────────────────────────────

function BackwardPreview({ withPuck }: { withPuck?: boolean }) {
  return (
    <svg width={20} height={14} viewBox="0 0 20 14">
      <defs>
        <marker id={`tb-arr-bk${withPuck ? "p" : ""}`} markerWidth={6} markerHeight={4} refX={6} refY={2} orient="auto">
          <polygon points="0 0, 6 2, 0 4" fill={RINK_COLORS.BACKWARD} />
        </marker>
      </defs>
      <line x1={2} y1={7} x2={withPuck ? 12 : 14} y2={7} stroke={RINK_COLORS.BACKWARD} strokeWidth={1.5} strokeDasharray="4,2" markerEnd={`url(#tb-arr-bk${withPuck ? "p" : ""})`} />
      {withPuck && <circle cx={16} cy={7} r={2.5} fill="#111" stroke="white" strokeWidth={0.5} />}
    </svg>
  );
}

// ── Shot preview ────────────────────────────────────────────

function ShotPreview() {
  return (
    <svg width={20} height={14} viewBox="0 0 20 14">
      <defs>
        <marker id="tb-arr-shot" markerWidth={6} markerHeight={4} refX={6} refY={2} orient="auto">
          <polygon points="0 0, 6 2, 0 4" fill={RINK_COLORS.SHOT_RED} />
        </marker>
      </defs>
      <line x1={2} y1={7} x2={14} y2={7} stroke={RINK_COLORS.SHOT_RED} strokeWidth={2.5} markerEnd="url(#tb-arr-shot)" />
    </svg>
  );
}

// ── Lateral preview ─────────────────────────────────────────

function LateralPreview() {
  return (
    <svg width={20} height={14} viewBox="0 0 20 14">
      <polyline points="2,7 6,3 10,11 14,3 18,7" fill="none" stroke={RINK_COLORS.TEAL} strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
}

// ── Freehand preview ────────────────────────────────────────

function FreehandPreview() {
  return (
    <svg width={18} height={14} viewBox="0 0 18 14">
      <path d="M 2 10 Q 6 2 10 8 Q 14 14 16 4" fill="none" stroke={RINK_COLORS.TEAL} strokeWidth={1.5} strokeLinecap="round" />
    </svg>
  );
}

// ── Pylon preview ───────────────────────────────────────────

function PylonPreview() {
  return (
    <svg width={14} height={16} viewBox="0 0 14 16">
      <polygon points="7,2 2,14 12,14" fill={RINK_COLORS.PYLON_ORANGE} stroke="white" strokeWidth={0.8} />
    </svg>
  );
}

// ── Net preview ─────────────────────────────────────────────

function NetPreview() {
  return (
    <svg width={16} height={14} viewBox="0 0 16 14">
      <rect x={2} y={3} width={12} height={8} rx={1.5} fill="white" stroke={RINK_COLORS.NAVY} strokeWidth={1.2} />
      <line x1={6} y1={3} x2={6} y2={11} stroke={RINK_COLORS.NAVY} strokeWidth={0.4} opacity={0.4} />
      <line x1={10} y1={3} x2={10} y2={11} stroke={RINK_COLORS.NAVY} strokeWidth={0.4} opacity={0.4} />
      <line x1={2} y1={7} x2={14} y2={7} stroke={RINK_COLORS.NAVY} strokeWidth={0.4} opacity={0.4} />
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
  onRedo,
  onExportSvg,
  onExportPng,
  canUndo,
  canRedo,
  selectedElement,
  onDeleteSelected,
  onToggleHelp,
  onExportGif,
  exportingGif,
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

      {/* ── Players ── */}
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

      <div className="w-px h-7 bg-border mx-1" />

      {/* ── Lines & Movement ── */}
      <ToolBtn active={toolMode === "arrow_solid"} onClick={() => onToolModeChange("arrow_solid")} label="Skate" title="Skating Path (solid arrow)">
        <ArrowPreview dashed={false} color={RINK_COLORS.TEAL} />
      </ToolBtn>
      <ToolBtn active={toolMode === "arrow_skate_puck"} onClick={() => onToolModeChange("arrow_skate_puck")} label="Sk+Pk" title="Skate with Puck">
        <SkatePuckPreview />
      </ToolBtn>
      <ToolBtn active={toolMode === "arrow_backward"} onClick={() => onToolModeChange("arrow_backward")} label="Back" title="Skate Backwards">
        <BackwardPreview />
      </ToolBtn>
      <ToolBtn active={toolMode === "arrow_backward_puck"} onClick={() => onToolModeChange("arrow_backward_puck")} label="Bk+Pk" title="Skate Backwards with Puck">
        <BackwardPreview withPuck />
      </ToolBtn>
      <ToolBtn active={toolMode === "freehand"} onClick={() => onToolModeChange("freehand")} label="Free" title="Freehand Skate Line (click + drag)">
        <FreehandPreview />
      </ToolBtn>
      <ToolBtn active={toolMode === "arrow_lateral"} onClick={() => onToolModeChange("arrow_lateral")} label="Lateral" title="Lateral Skating (zigzag)">
        <LateralPreview />
      </ToolBtn>

      <div className="w-px h-7 bg-border mx-1" />

      {/* ── Passing & Shooting ── */}
      <ToolBtn active={toolMode === "arrow_pass"} onClick={() => onToolModeChange("arrow_pass")} label="Pass" title="Pass (blue arrow)">
        <ArrowPreview dashed={true} color={RINK_COLORS.PASS_BLUE} />
      </ToolBtn>
      <ToolBtn active={toolMode === "arrow_shot"} onClick={() => onToolModeChange("arrow_shot")} label="Shot" title="Shot (red bold arrow)">
        <ShotPreview />
      </ToolBtn>

      <div className="w-px h-7 bg-border mx-1" />

      {/* ── Objects ── */}
      <ToolBtn active={toolMode === "puck"} onClick={() => onToolModeChange("puck")} label="Puck" title="Place Puck">
        <PuckPreview />
      </ToolBtn>
      <ToolBtn active={toolMode === "pylon"} onClick={() => onToolModeChange("pylon")} label="Pylon" title="Place Pylon (orange cone)">
        <PylonPreview />
      </ToolBtn>
      <ToolBtn active={toolMode === "net"} onClick={() => onToolModeChange("net")} label="Net" title="Place Net">
        <NetPreview />
      </ToolBtn>

      <div className="w-px h-7 bg-border mx-1" />

      {/* ── Editing ── */}
      <ToolBtn active={toolMode === "select"} onClick={() => onToolModeChange("select")} label="Select" title="Select & Move">
        <MousePointer2 size={14} />
      </ToolBtn>
      <ToolBtn active={toolMode === "eraser"} onClick={() => onToolModeChange("eraser")} label="Erase" title="Eraser — click element to remove">
        <Eraser size={14} />
      </ToolBtn>

      <ActionBtn onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)">
        <Undo2 size={16} />
      </ActionBtn>
      {onRedo && (
        <ActionBtn onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl+Y)">
          <Redo2 size={16} />
        </ActionBtn>
      )}
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
      {onExportGif && (
        <ActionBtn onClick={onExportGif} disabled={exportingGif} title="Export Animated GIF">
          {exportingGif ? <Loader2 size={16} className="animate-spin" /> : <Film size={16} />}
        </ActionBtn>
      )}
      {onToggleHelp && (
        <>
          <div className="w-px h-7 bg-border mx-1" />
          <ActionBtn onClick={onToggleHelp} title="Help & Shortcuts (?)">
            <HelpCircle size={16} />
          </ActionBtn>
        </>
      )}
    </div>
  );
}
