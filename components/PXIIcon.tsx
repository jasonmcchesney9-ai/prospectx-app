/**
 * PXI (ProspectX Intelligence) Hockey Helmet Icon
 * Teal helmet silhouette with visor, cage bars, and "PXI" text.
 * Based on classic side-profile hockey helmet design.
 */
export default function PXIIcon({
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
      {/* Helmet shell — rounded dome shape */}
      <path
        d="M8 20C8 11.163 15.163 4 24 4C32.837 4 40 11.163 40 20V26C40 30 38.5 33 36 35L34 36H28L24 42L22 36H14C11.5 36 9.5 34 8.5 32C8.2 31 8 29.5 8 28V20Z"
        fill="url(#pxi-grad)"
      />

      {/* Dome highlight — top gloss */}
      <path
        d="M12 18C12 11.373 17.373 6 24 6C30.627 6 36 11.373 36 18V19H12V18Z"
        fill="white"
        fillOpacity="0.18"
      />

      {/* Visor slit — dark band across the eyes */}
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

      {/* Ear guard / side panel */}
      <path
        d="M36 20C37.5 22 38 24 38 26C38 28 37 30 36 31"
        stroke="white"
        strokeOpacity="0.15"
        strokeWidth="1"
        strokeLinecap="round"
        fill="none"
      />

      {/* Chin strap */}
      <path
        d="M16 34C16 34 19 37 24 37C29 37 32 34 32 34"
        stroke="white"
        strokeOpacity="0.2"
        strokeWidth="1"
        strokeLinecap="round"
        fill="none"
      />

      {/* PXI text */}
      <text
        x="23"
        y="17"
        textAnchor="middle"
        fontFamily="Oswald, sans-serif"
        fontWeight="700"
        fontSize="8.5"
        fill="white"
        letterSpacing="0.8"
      >
        PXI
      </text>

      {/* Gradient: teal to navy */}
      <defs>
        <linearGradient id="pxi-grad" x1="8" y1="4" x2="40" y2="42" gradientUnits="userSpaceOnUse">
          <stop stopColor="#18B3A6" />
          <stop offset="1" stopColor="#0F2A3D" />
        </linearGradient>
      </defs>
    </svg>
  );
}
