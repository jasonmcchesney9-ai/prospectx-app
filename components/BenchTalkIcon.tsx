/**
 * Bench Talk Hockey Helmet Chat Bubble Icon
 * Brand spec: Chat bubble shaped like a hockey helmet with "BT" inside.
 * Helmet dome curve on top, chin strap at bottom, visor line.
 * Orange gradient — the original Bench Talk branding.
 */
export default function BenchTalkIcon({
  size = 32,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Helmet body / chat bubble */}
      <path
        d="M6 18C6 10.268 12.268 4 20 4H28C35.732 4 42 10.268 42 18V24C42 31.732 35.732 38 28 38H22L14 44V38H12C8.686 38 6 35.314 6 32V18Z"
        fill="url(#bt-grad)"
      />

      {/* Helmet dome highlight (top curve) */}
      <path
        d="M10 16C10 10.477 14.477 6 20 6H28C33.523 6 38 10.477 38 16V17H10V16Z"
        fill="white"
        fillOpacity="0.15"
      />

      {/* Visor band */}
      <rect x="8" y="17" width="32" height="3.5" rx="1.5" fill="white" fillOpacity="0.12" />

      {/* Cage / face guard lines */}
      <line x1="14" y1="22" x2="14" y2="30" stroke="white" strokeOpacity="0.1" strokeWidth="0.8" />
      <line x1="20" y1="22" x2="20" y2="32" stroke="white" strokeOpacity="0.1" strokeWidth="0.8" />
      <line x1="28" y1="22" x2="28" y2="32" stroke="white" strokeOpacity="0.1" strokeWidth="0.8" />
      <line x1="34" y1="22" x2="34" y2="30" stroke="white" strokeOpacity="0.1" strokeWidth="0.8" />

      {/* Chin strap */}
      <path
        d="M16 36C16 36 18 39 24 39C30 39 32 36 32 36"
        stroke="white"
        strokeOpacity="0.2"
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
      />

      {/* BT text */}
      <text
        x="24"
        y="30"
        textAnchor="middle"
        fontFamily="Oswald, sans-serif"
        fontWeight="700"
        fontSize="11"
        fill="white"
        letterSpacing="1"
      >
        BT
      </text>

      {/* Gradient definition — orange to navy */}
      <defs>
        <linearGradient id="bt-grad" x1="6" y1="4" x2="42" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F36F21" />
          <stop offset="1" stopColor="#0F2A3D" />
        </linearGradient>
      </defs>
    </svg>
  );
}
