// ============================================================
// ProspectX — Rink SVG Backgrounds
// Ported from backend/rink_diagrams.py (lines 60-131)
// Same geometry, same colors, React JSX output
// ============================================================

import { RINK_COLORS, type RinkType } from "@/types/rink";

const { ICE, BOARD_STROKE, RED_LINE, BLUE_LINE, CREASE_FILL, NAVY } = RINK_COLORS;
const CIRCLE_COLOR = RED_LINE;

// ── Full Ice Rink (600 × 280) ────────────────────────────────

function FullRink({ w = 600, h = 280 }: { w?: number; h?: number }) {
  const cx = Math.floor(w / 2);
  const cy = Math.floor(h / 2);
  const cr = 20;

  return (
    <g>
      {/* Ice surface */}
      <rect x={2} y={2} width={w - 4} height={h - 4} rx={cr} ry={cr} fill={ICE} stroke={BOARD_STROKE} strokeWidth={2.5} />
      {/* Center red line */}
      <line x1={cx} y1={2} x2={cx} y2={h - 2} stroke={RED_LINE} strokeWidth={2.5} />
      {/* Blue lines */}
      <line x1={Math.floor(w * 0.33)} y1={2} x2={Math.floor(w * 0.33)} y2={h - 2} stroke={BLUE_LINE} strokeWidth={2} />
      <line x1={Math.floor(w * 0.67)} y1={2} x2={Math.floor(w * 0.67)} y2={h - 2} stroke={BLUE_LINE} strokeWidth={2} />
      {/* Center circle */}
      <circle cx={cx} cy={cy} r={30} fill="none" stroke={CIRCLE_COLOR} strokeWidth={1.5} />
      {/* PXI helmet logo — inline SVG for export compatibility */}
      <g transform={`translate(${cx - 26}, ${cy - 26}) scale(${52 / 48})`} opacity={0.35} style={{ pointerEvents: "none" }}>
        <defs>
          <linearGradient id="pxi-center-grad" x1="8" y1="4" x2="40" y2="42" gradientUnits="userSpaceOnUse">
            <stop stopColor="#18B3A6" />
            <stop offset="1" stopColor="#0F2A3D" />
          </linearGradient>
        </defs>
        {/* Helmet shell */}
        <path d="M8 20C8 11.163 15.163 4 24 4C32.837 4 40 11.163 40 20V26C40 30 38.5 33 36 35L34 36H28L24 42L22 36H14C11.5 36 9.5 34 8.5 32C8.2 31 8 29.5 8 28V20Z" fill="url(#pxi-center-grad)" />
        {/* Dome highlight */}
        <path d="M12 18C12 11.373 17.373 6 24 6C30.627 6 36 11.373 36 18V19H12V18Z" fill="white" fillOpacity="0.18" />
        {/* Visor slit */}
        <rect x="10" y="19" width="28" height="3" rx="1.5" fill="#0F2A3D" fillOpacity="0.35" />
        {/* Visor shine */}
        <rect x="12" y="19.5" width="20" height="1" rx="0.5" fill="white" fillOpacity="0.15" />
        {/* Cage bars — vertical */}
        <line x1="15" y1="23" x2="15" y2="31" stroke="white" strokeOpacity="0.12" strokeWidth="0.7" />
        <line x1="20" y1="23" x2="20" y2="33" stroke="white" strokeOpacity="0.12" strokeWidth="0.7" />
        <line x1="25" y1="23" x2="25" y2="33" stroke="white" strokeOpacity="0.12" strokeWidth="0.7" />
        <line x1="30" y1="23" x2="30" y2="31" stroke="white" strokeOpacity="0.12" strokeWidth="0.7" />
        {/* Cage bars — horizontal */}
        <line x1="13" y1="26" x2="33" y2="26" stroke="white" strokeOpacity="0.08" strokeWidth="0.6" />
        <line x1="14" y1="30" x2="32" y2="30" stroke="white" strokeOpacity="0.08" strokeWidth="0.6" />
        {/* Ear guard */}
        <path d="M36 20C37.5 22 38 24 38 26C38 28 37 30 36 31" stroke="white" strokeOpacity="0.15" strokeWidth="1" strokeLinecap="round" fill="none" />
        {/* Chin strap */}
        <path d="M16 34C16 34 19 37 24 37C29 37 32 34 32 34" stroke="white" strokeOpacity="0.2" strokeWidth="1" strokeLinecap="round" fill="none" />
        {/* PXI text */}
        <text x="23" y="17" textAnchor="middle" fontFamily="Oswald, sans-serif" fontWeight="700" fontSize="8.5" fill="white" letterSpacing="0.8">PXI</text>
      </g>
      {/* Face-off dots */}
      <circle cx={Math.floor(w * 0.22)} cy={Math.floor(h * 0.32)} r={3} fill={CIRCLE_COLOR} />
      <circle cx={Math.floor(w * 0.22)} cy={Math.floor(h * 0.68)} r={3} fill={CIRCLE_COLOR} />
      <circle cx={Math.floor(w * 0.78)} cy={Math.floor(h * 0.32)} r={3} fill={CIRCLE_COLOR} />
      <circle cx={Math.floor(w * 0.78)} cy={Math.floor(h * 0.68)} r={3} fill={CIRCLE_COLOR} />
      {/* Face-off circles (end zones) */}
      <circle cx={Math.floor(w * 0.17)} cy={Math.floor(h * 0.35)} r={25} fill="none" stroke={CIRCLE_COLOR} strokeWidth={1} opacity={0.5} />
      <circle cx={Math.floor(w * 0.17)} cy={Math.floor(h * 0.65)} r={25} fill="none" stroke={CIRCLE_COLOR} strokeWidth={1} opacity={0.5} />
      <circle cx={Math.floor(w * 0.83)} cy={Math.floor(h * 0.35)} r={25} fill="none" stroke={CIRCLE_COLOR} strokeWidth={1} opacity={0.5} />
      <circle cx={Math.floor(w * 0.83)} cy={Math.floor(h * 0.65)} r={25} fill="none" stroke={CIRCLE_COLOR} strokeWidth={1} opacity={0.5} />
      {/* Goal creases */}
      <path
        d={`M 30 ${cy - 15} Q 50 ${cy - 22} 50 ${cy} Q 50 ${cy + 22} 30 ${cy + 15}`}
        fill={CREASE_FILL} fillOpacity={0.5} stroke={BLUE_LINE} strokeWidth={1}
      />
      <path
        d={`M ${w - 30} ${cy - 15} Q ${w - 50} ${cy - 22} ${w - 50} ${cy} Q ${w - 50} ${cy + 22} ${w - 30} ${cy + 15}`}
        fill={CREASE_FILL} fillOpacity={0.5} stroke={BLUE_LINE} strokeWidth={1}
      />
      {/* Nets */}
      <rect x={4} y={cy - 10} width={12} height={20} rx={2} fill="none" stroke={NAVY} strokeWidth={1.5} opacity={0.6} />
      <rect x={w - 16} y={cy - 10} width={12} height={20} rx={2} fill="none" stroke={NAVY} strokeWidth={1.5} opacity={0.6} />
    </g>
  );
}

// ── Half Ice Rink (380 × 300) ────────────────────────────────

function HalfRink({ w = 380, h = 300 }: { w?: number; h?: number }) {
  const cx = w - 40; // net on the right side
  const cy = Math.floor(h / 2);
  const cr = 20;

  return (
    <g>
      {/* Ice surface */}
      <rect x={2} y={2} width={w - 4} height={h - 4} rx={cr} ry={cr} fill={ICE} stroke={BOARD_STROKE} strokeWidth={2.5} />
      {/* Blue line */}
      <line x1={Math.floor(w * 0.35)} y1={2} x2={Math.floor(w * 0.35)} y2={h - 2} stroke={BLUE_LINE} strokeWidth={2} />
      {/* Face-off circles */}
      <circle cx={Math.floor(w * 0.62)} cy={Math.floor(h * 0.32)} r={25} fill="none" stroke={CIRCLE_COLOR} strokeWidth={1} opacity={0.5} />
      <circle cx={Math.floor(w * 0.62)} cy={Math.floor(h * 0.68)} r={25} fill="none" stroke={CIRCLE_COLOR} strokeWidth={1} opacity={0.5} />
      {/* Face-off dots */}
      <circle cx={Math.floor(w * 0.62)} cy={Math.floor(h * 0.32)} r={3} fill={CIRCLE_COLOR} />
      <circle cx={Math.floor(w * 0.62)} cy={Math.floor(h * 0.68)} r={3} fill={CIRCLE_COLOR} />
      {/* Goal crease */}
      <path
        d={`M ${cx} ${cy - 18} Q ${cx - 25} ${cy - 25} ${cx - 25} ${cy} Q ${cx - 25} ${cy + 25} ${cx} ${cy + 18}`}
        fill={CREASE_FILL} fillOpacity={0.5} stroke={BLUE_LINE} strokeWidth={1}
      />
      {/* Net */}
      <rect x={cx} y={cy - 12} width={14} height={24} rx={2} fill="none" stroke={NAVY} strokeWidth={1.5} opacity={0.6} />
    </g>
  );
}

// ── Quarter Ice Rink (320 × 300) ─────────────────────────────

function QuarterRink({ w = 320, h = 300 }: { w?: number; h?: number }) {
  const cy = Math.floor(h / 2);
  const cr = 20;

  return (
    <g>
      {/* Ice surface */}
      <rect x={2} y={2} width={w - 4} height={h - 4} rx={cr} ry={cr} fill={ICE} stroke={BOARD_STROKE} strokeWidth={2.5} />
      {/* Face-off circle */}
      <circle cx={Math.floor(w * 0.45)} cy={Math.floor(h * 0.45)} r={28} fill="none" stroke={CIRCLE_COLOR} strokeWidth={1} opacity={0.5} />
      <circle cx={Math.floor(w * 0.45)} cy={Math.floor(h * 0.45)} r={3} fill={CIRCLE_COLOR} />
      {/* Goal crease */}
      <path
        d={`M ${w - 30} ${cy - 18} Q ${w - 55} ${cy - 25} ${w - 55} ${cy} Q ${w - 55} ${cy + 25} ${w - 30} ${cy + 18}`}
        fill={CREASE_FILL} fillOpacity={0.5} stroke={BLUE_LINE} strokeWidth={1}
      />
      {/* Net */}
      <rect x={w - 16} y={cy - 12} width={14} height={24} rx={2} fill="none" stroke={NAVY} strokeWidth={1.5} opacity={0.6} />
    </g>
  );
}

// ── Main Export ───────────────────────────────────────────────

export default function RinkSvgBackground({ rinkType, width, height }: { rinkType: RinkType; width: number; height: number }) {
  switch (rinkType) {
    case "full":
      return <FullRink w={width} h={height} />;
    case "half":
      return <HalfRink w={width} h={height} />;
    case "quarter":
      return <QuarterRink w={width} h={height} />;
    default:
      return <FullRink w={width} h={height} />;
  }
}
