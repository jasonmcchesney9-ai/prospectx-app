/**
 * HockeyRink — Reusable SVG hockey rink with animated scan line
 *
 * Realistic markings: red goal lines, blue lines, dashed red center line,
 * faceoff circles with dots, creases, nets, gold boards, ice gradient.
 *
 * Teal scan line sweeps left to right with glow effect.
 *
 * Size variants:
 *   full  — 450×220 (standalone loading screens)
 *   chat  — 420×100 (BenchTalk typing indicator)
 *   card  — 340×80  (card/inline loaders)
 *   toast — 80×36   (tiny inline badge)
 */
"use client";

const SIZE_MAP = {
  full:  { w: 450, h: 220 },
  chat:  { w: 420, h: 100 },
  card:  { w: 340, h: 80 },
  toast: { w: 80,  h: 36 },
} as const;

type SizeVariant = keyof typeof SIZE_MAP;

interface Props {
  size?: SizeVariant;
  className?: string;
  /** Show the animated scan line (default true) */
  animate?: boolean;
  /** Optional label text below the rink */
  label?: string;
}

export default function HockeyRink({
  size = "full",
  className = "",
  animate = true,
  label,
}: Props) {
  const { w, h } = SIZE_MAP[size];
  const isSmall = size === "toast" || size === "card";
  const isTiny = size === "toast";

  // Unique ID prefix for gradients so multiple instances don't clash
  const uid = `rink-${size}`;

  return (
    <div className={`inline-flex flex-col items-center ${className}`}>
      <svg
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Hockey rink loading animation"
      >
        <defs>
          {/* Ice gradient — subtle cool white to light blue */}
          <linearGradient id={`${uid}-ice`} x1="0" y1="0" x2={w} y2={h} gradientUnits="userSpaceOnUse">
            <stop stopColor="#F5F9FD" />
            <stop offset="0.5" stopColor="#EAF2FA" />
            <stop offset="1" stopColor="#E0ECF6" />
          </linearGradient>

          {/* Scan line glow gradient */}
          <linearGradient id={`${uid}-scan`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#18B3A6" stopOpacity="0" />
            <stop offset="0.3" stopColor="#18B3A6" stopOpacity="0.15" />
            <stop offset="0.5" stopColor="#18B3A6" stopOpacity="0.6" />
            <stop offset="0.7" stopColor="#18B3A6" stopOpacity="0.15" />
            <stop offset="1" stopColor="#18B3A6" stopOpacity="0" />
          </linearGradient>

          {/* Scan line sharp */}
          <linearGradient id={`${uid}-scanline`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#18B3A6" stopOpacity="0" />
            <stop offset="0.45" stopColor="#18B3A6" stopOpacity="0.3" />
            <stop offset="0.5" stopColor="#18B3A6" stopOpacity="1" />
            <stop offset="0.55" stopColor="#18B3A6" stopOpacity="0.3" />
            <stop offset="1" stopColor="#18B3A6" stopOpacity="0" />
          </linearGradient>

          {/* Board shadow */}
          <filter id={`${uid}-boardshadow`} x="-2%" y="-2%" width="104%" height="104%">
            <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="#0F2A3D" floodOpacity="0.15" />
          </filter>
        </defs>

        {/* ── Boards (gold/amber outline, rounded corners) ── */}
        <rect
          x="2" y="2"
          width={w - 4} height={h - 4}
          rx={isTiny ? 6 : isSmall ? 10 : 18}
          ry={isTiny ? 6 : isSmall ? 10 : 18}
          fill={`url(#${uid}-ice)`}
          stroke="#C5A55A"
          strokeWidth={isTiny ? 1 : isSmall ? 1.5 : 2.5}
          filter={isTiny ? undefined : `url(#${uid}-boardshadow)`}
        />

        {/* ── Inner board line ── */}
        {!isTiny && (
          <rect
            x={isSmall ? 5 : 7}
            y={isSmall ? 5 : 7}
            width={w - (isSmall ? 10 : 14)}
            height={h - (isSmall ? 10 : 14)}
            rx={isSmall ? 8 : 15}
            ry={isSmall ? 8 : 15}
            fill="none"
            stroke="#C5A55A"
            strokeWidth={isSmall ? 0.5 : 0.8}
            strokeOpacity="0.3"
          />
        )}

        {/* ── Center Ice Red Line (dashed) ── */}
        <line
          x1={w / 2} y1={isTiny ? 4 : isSmall ? 7 : 10}
          x2={w / 2} y2={h - (isTiny ? 4 : isSmall ? 7 : 10)}
          stroke="#D32F2F"
          strokeWidth={isTiny ? 0.8 : isSmall ? 1.2 : 2}
          strokeDasharray={isTiny ? "2,2" : isSmall ? "4,3" : "6,4"}
          strokeOpacity="0.7"
        />

        {/* ── Blue Lines ── */}
        {(() => {
          const blueX1 = w * 0.3;
          const blueX2 = w * 0.7;
          const strokeW = isTiny ? 0.8 : isSmall ? 1.5 : 2.5;
          const padY = isTiny ? 4 : isSmall ? 7 : 10;
          return (
            <>
              <line x1={blueX1} y1={padY} x2={blueX1} y2={h - padY}
                stroke="#1565C0" strokeWidth={strokeW} strokeOpacity="0.65" />
              <line x1={blueX2} y1={padY} x2={blueX2} y2={h - padY}
                stroke="#1565C0" strokeWidth={strokeW} strokeOpacity="0.65" />
            </>
          );
        })()}

        {/* ── Goal Lines (red, near each end) ── */}
        {!isTiny && (() => {
          const goalX1 = w * 0.1;
          const goalX2 = w * 0.9;
          const strokeW = isSmall ? 1 : 1.8;
          const padY = isSmall ? 7 : 10;
          return (
            <>
              <line x1={goalX1} y1={padY} x2={goalX1} y2={h - padY}
                stroke="#D32F2F" strokeWidth={strokeW} strokeOpacity="0.5" />
              <line x1={goalX2} y1={padY} x2={goalX2} y2={h - padY}
                stroke="#D32F2F" strokeWidth={strokeW} strokeOpacity="0.5" />
            </>
          );
        })()}

        {/* ── Center Faceoff Circle ── */}
        {!isTiny && (
          <>
            <circle
              cx={w / 2} cy={h / 2}
              r={isSmall ? 12 : 28}
              fill="none"
              stroke="#1565C0"
              strokeWidth={isSmall ? 0.8 : 1.5}
              strokeOpacity="0.5"
            />
            <circle
              cx={w / 2} cy={h / 2}
              r={isSmall ? 1.5 : 3}
              fill="#1565C0"
              fillOpacity="0.5"
            />
          </>
        )}

        {/* ── Zone Faceoff Circles and Dots (full/chat only) ── */}
        {!isSmall && (() => {
          const cy = h / 2;
          const spots = [
            // Left zone — upper & lower
            { cx: w * 0.2, cy: cy - 40 },
            { cx: w * 0.2, cy: cy + 40 },
            // Right zone — upper & lower
            { cx: w * 0.8, cy: cy - 40 },
            { cx: w * 0.8, cy: cy + 40 },
          ];
          return spots.map((s, i) => (
            <g key={i}>
              <circle cx={s.cx} cy={s.cy} r={size === "chat" ? 8 : 16}
                fill="none" stroke="#D32F2F" strokeWidth={size === "chat" ? 0.5 : 1} strokeOpacity="0.35" />
              <circle cx={s.cx} cy={s.cy} r={size === "chat" ? 1 : 2.5}
                fill="#D32F2F" fillOpacity="0.5" />
            </g>
          ));
        })()}

        {/* ── Neutral Zone Faceoff Dots ── */}
        {!isSmall && (() => {
          const cy = h / 2;
          const dots = [
            { cx: w * 0.35, cy: cy - 40 },
            { cx: w * 0.35, cy: cy + 40 },
            { cx: w * 0.65, cy: cy - 40 },
            { cx: w * 0.65, cy: cy + 40 },
          ];
          return dots.map((d, i) => (
            <circle key={`nd-${i}`} cx={d.cx} cy={d.cy} r={size === "chat" ? 1 : 2}
              fill="#D32F2F" fillOpacity="0.4" />
          ));
        })()}

        {/* ── Goal Creases (semi-circles behind goal lines) ── */}
        {!isSmall && (() => {
          const cy = h / 2;
          const leftX = w * 0.1;
          const rightX = w * 0.9;
          const cr = size === "chat" ? 6 : 14;
          return (
            <>
              <path
                d={`M ${leftX} ${cy - cr} A ${cr} ${cr} 0 0 0 ${leftX} ${cy + cr}`}
                fill="#4FC3F7" fillOpacity="0.12"
                stroke="#1565C0" strokeWidth={size === "chat" ? 0.4 : 0.8} strokeOpacity="0.3"
              />
              <path
                d={`M ${rightX} ${cy - cr} A ${cr} ${cr} 0 0 1 ${rightX} ${cy + cr}`}
                fill="#4FC3F7" fillOpacity="0.12"
                stroke="#1565C0" strokeWidth={size === "chat" ? 0.4 : 0.8} strokeOpacity="0.3"
              />
            </>
          );
        })()}

        {/* ── Nets (behind goal lines) ── */}
        {!isSmall && (() => {
          const cy = h / 2;
          const netW = size === "chat" ? 3 : 6;
          const netH = size === "chat" ? 8 : 18;
          return (
            <>
              {/* Left net */}
              <rect
                x={w * 0.1 - netW - 1} y={cy - netH / 2}
                width={netW} height={netH}
                rx={1}
                fill="none"
                stroke="#666"
                strokeWidth={size === "chat" ? 0.4 : 0.8}
                strokeOpacity="0.4"
              />
              {/* Net mesh lines */}
              {size === "full" && (
                <>
                  <line x1={w * 0.1 - netW} y1={cy - 6} x2={w * 0.1 - 1} y2={cy - 6} stroke="#999" strokeWidth="0.3" strokeOpacity="0.3" />
                  <line x1={w * 0.1 - netW} y1={cy} x2={w * 0.1 - 1} y2={cy} stroke="#999" strokeWidth="0.3" strokeOpacity="0.3" />
                  <line x1={w * 0.1 - netW} y1={cy + 6} x2={w * 0.1 - 1} y2={cy + 6} stroke="#999" strokeWidth="0.3" strokeOpacity="0.3" />
                  <line x1={w * 0.1 - netW / 2} y1={cy - netH / 2} x2={w * 0.1 - netW / 2} y2={cy + netH / 2} stroke="#999" strokeWidth="0.3" strokeOpacity="0.3" />
                </>
              )}
              {/* Right net */}
              <rect
                x={w * 0.9 + 1} y={cy - netH / 2}
                width={netW} height={netH}
                rx={1}
                fill="none"
                stroke="#666"
                strokeWidth={size === "chat" ? 0.4 : 0.8}
                strokeOpacity="0.4"
              />
              {size === "full" && (
                <>
                  <line x1={w * 0.9 + 1} y1={cy - 6} x2={w * 0.9 + netW} y2={cy - 6} stroke="#999" strokeWidth="0.3" strokeOpacity="0.3" />
                  <line x1={w * 0.9 + 1} y1={cy} x2={w * 0.9 + netW} y2={cy} stroke="#999" strokeWidth="0.3" strokeOpacity="0.3" />
                  <line x1={w * 0.9 + 1} y1={cy + 6} x2={w * 0.9 + netW} y2={cy + 6} stroke="#999" strokeWidth="0.3" strokeOpacity="0.3" />
                  <line x1={w * 0.9 + 1 + netW / 2} y1={cy - netH / 2} x2={w * 0.9 + 1 + netW / 2} y2={cy + netH / 2} stroke="#999" strokeWidth="0.3" strokeOpacity="0.3" />
                </>
              )}
            </>
          );
        })()}

        {/* ── Teal Scan Line (animated sweep left → right) ── */}
        {animate && (
          <>
            {/* Glow band */}
            <rect
              x="0" y={isTiny ? 2 : isSmall ? 4 : 6}
              width={isTiny ? 16 : isSmall ? 40 : 60}
              height={h - (isTiny ? 4 : isSmall ? 8 : 12)}
              fill={`url(#${uid}-scan)`}
              rx={isTiny ? 4 : isSmall ? 6 : 10}
              opacity="0.8"
            >
              <animateTransform
                attributeName="transform"
                type="translate"
                from={`${-60} 0`}
                to={`${w + 20} 0`}
                dur={isTiny ? "1.5s" : "2.2s"}
                repeatCount="indefinite"
              />
            </rect>

            {/* Sharp scan line */}
            <rect
              x="0" y={isTiny ? 2 : isSmall ? 4 : 6}
              width={isTiny ? 6 : isSmall ? 16 : 24}
              height={h - (isTiny ? 4 : isSmall ? 8 : 12)}
              fill={`url(#${uid}-scanline)`}
              rx={isTiny ? 2 : isSmall ? 4 : 6}
              opacity="1"
            >
              <animateTransform
                attributeName="transform"
                type="translate"
                from={`${-24} 0`}
                to={`${w + 20} 0`}
                dur={isTiny ? "1.5s" : "2.2s"}
                repeatCount="indefinite"
              />
            </rect>
          </>
        )}
      </svg>

      {/* Optional label */}
      {label && (
        <span className={`mt-1.5 font-oswald uppercase tracking-wider text-muted ${
          isTiny ? "text-[7px]" : isSmall ? "text-[9px]" : "text-xs"
        }`}>
          {label}
        </span>
      )}
    </div>
  );
}
