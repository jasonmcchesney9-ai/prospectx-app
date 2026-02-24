/**
 * tile-icons.tsx — Custom SVG icons for Family Guide tiles
 *
 * Migrated exactly from family-guide-tiles (1).html reference.
 * Each icon uses viewBox="0 0 40 40", accepts className for sizing.
 */

interface IconProps {
  className?: string;
}

/** Development Journey — upward arrow path with 3 nodes */
export function JourneyIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <circle cx="8" cy="32" r="3.5" fill="#0D9488" opacity=".9" />
      <circle cx="20" cy="20" r="3.5" fill="#14B8A8" opacity=".9" />
      <circle cx="32" cy="10" r="3.5" fill="white" opacity=".9" />
      <path d="M8 32 Q14 26 20 20 Q26 14 32 10" stroke="rgba(255,255,255,.5)" strokeWidth="1.5" strokeDasharray="3 2" fill="none" />
      <path d="M28 8 L32 10 L30 14" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity=".7" />
    </svg>
  );
}

/** Select Player — person/avatar */
export function SelectPlayerIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <circle cx="20" cy="14" r="6" stroke="rgba(255,255,255,.7)" strokeWidth="1.5" />
      <path d="M8 34c0-6.627 5.373-12 12-12s12 5.373 12 12" stroke="rgba(255,255,255,.5)" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="20" cy="14" r="3" fill="#0D9488" opacity=".8" />
    </svg>
  );
}

/** Ask PXI — chat bubble with 3 dots */
export function AskPxiIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <rect x="6" y="8" width="28" height="18" rx="4" stroke="rgba(255,255,255,.6)" strokeWidth="1.5" />
      <path d="M14 30 L20 36 L26 30" stroke="rgba(255,255,255,.4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="13" cy="17" r="1.8" fill="white" opacity=".8" />
      <circle cx="20" cy="17" r="1.8" fill="white" opacity=".8" />
      <circle cx="27" cy="17" r="1.8" fill="white" opacity=".8" />
    </svg>
  );
}

/** Parent Tip of the Day — lightbulb/clock */
export function ParentTipIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <circle cx="20" cy="18" r="9" stroke="rgba(255,255,255,.6)" strokeWidth="1.5" />
      <path d="M15 28 L20 36 L25 28" stroke="rgba(255,255,255,.4)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <path d="M20 12 L20 19 L24 22" stroke="#FCD34D" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="20" cy="7" r="1.5" fill="#FCD34D" opacity=".7" />
      <circle cx="29" cy="11" r="1.5" fill="#FCD34D" opacity=".5" />
      <circle cx="11" cy="11" r="1.5" fill="#FCD34D" opacity=".5" />
    </svg>
  );
}

/** After Game Help — car silhouette + speech bubble */
export function AfterGameIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <rect x="7" y="20" width="26" height="10" rx="3" stroke="rgba(255,255,255,.6)" strokeWidth="1.5" />
      <path d="M11 20 L14 13 H26 L29 20" stroke="rgba(255,255,255,.6)" strokeWidth="1.5" strokeLinejoin="round" fill="none" />
      <circle cx="13" cy="31" r="2.5" stroke="rgba(255,255,255,.5)" strokeWidth="1.2" />
      <circle cx="27" cy="31" r="2.5" stroke="rgba(255,255,255,.5)" strokeWidth="1.2" />
      <rect x="21" y="6" width="13" height="9" rx="2.5" fill="rgba(255,255,255,.15)" stroke="rgba(255,255,255,.4)" strokeWidth="1" />
      <circle cx="24" cy="10.5" r="1" fill="white" opacity=".7" />
      <circle cx="27.5" cy="10.5" r="1" fill="white" opacity=".7" />
      <circle cx="31" cy="10.5" r="1" fill="white" opacity=".7" />
      <path d="M23 15 L21 18" stroke="rgba(255,255,255,.4)" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}

/** Nutrition — plate/bowl with fork + lightning bolt */
export function NutritionIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <ellipse cx="20" cy="24" rx="13" ry="5" stroke="rgba(255,255,255,.5)" strokeWidth="1.5" />
      <path d="M7 24 C7 17 33 17 33 24" stroke="rgba(255,255,255,.6)" strokeWidth="1.5" fill="rgba(255,255,255,.06)" />
      <line x1="12" y1="10" x2="12" y2="19" stroke="#34D399" strokeWidth="1.3" strokeLinecap="round" />
      <line x1="10" y1="10" x2="10" y2="14" stroke="#34D399" strokeWidth="1.1" strokeLinecap="round" />
      <line x1="14" y1="10" x2="14" y2="14" stroke="#34D399" strokeWidth="1.1" strokeLinecap="round" />
      <path d="M26 9 L22 20 H26 L22 31" stroke="#FCD34D" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

/** Workouts — dumbbell + upward arrow */
export function WorkoutsIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <rect x="4" y="18" width="6" height="4" rx="1.5" fill="rgba(255,255,255,.5)" />
      <rect x="30" y="18" width="6" height="4" rx="1.5" fill="rgba(255,255,255,.5)" />
      <rect x="3" y="16" width="4" height="8" rx="1.5" fill="rgba(255,255,255,.7)" />
      <rect x="33" y="16" width="4" height="8" rx="1.5" fill="rgba(255,255,255,.7)" />
      <line x1="10" y1="20" x2="30" y2="20" stroke="rgba(255,255,255,.6)" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M20 6 L20 13 M17 9 L20 6 L23 9" stroke="#FB923C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

/** Prep & College Guide — road with graduation cap */
export function PathwayIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path d="M14 34 L18 8 L22 8 L26 34 Z" stroke="rgba(255,255,255,.25)" strokeWidth="1" fill="rgba(255,255,255,.06)" />
      <line x1="20" y1="34" x2="20" y2="8" stroke="rgba(255,255,255,.3)" strokeWidth="1" strokeDasharray="3 3" />
      <polygon points="20,9 28,13 20,17 12,13" fill="rgba(255,255,255,.15)" stroke="#38BDF8" strokeWidth="1.2" />
      <line x1="28" y1="13" x2="28" y2="19" stroke="#38BDF8" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M17 16 L17 21 C17 23.2 18.3 24 20 24 C21.7 24 23 23.2 23 21 L23 16" stroke="rgba(255,255,255,.4)" strokeWidth="1.2" strokeLinecap="round" fill="none" />
      <circle cx="20" cy="30" r="2" fill="#38BDF8" opacity=".8" />
      <circle cx="20" cy="13" r="2.5" fill="#38BDF8" opacity=".9" />
    </svg>
  );
}

/** Mental Performance — brain with sparkle */
export function MentalIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path d="M20 10 C14 10 9 14 9 20 C9 23 10.5 25.5 13 27 L13 32 H27 L27 27 C29.5 25.5 31 23 31 20 C31 14 26 10 20 10 Z" stroke="rgba(255,255,255,.5)" strokeWidth="1.3" fill="rgba(255,255,255,.06)" />
      <path d="M20 10 L20 32" stroke="rgba(255,255,255,.2)" strokeWidth="1" strokeDasharray="2 2" />
      <path d="M23 15 L24 12 L25 15 L28 16 L25 17 L24 20 L23 17 L20 16 Z" fill="#A78BFA" opacity=".8" />
      <circle cx="15" cy="20" r="1.3" fill="rgba(255,255,255,.5)" />
      <circle cx="18" cy="23" r="1.3" fill="rgba(255,255,255,.4)" />
    </svg>
  );
}

/** Pressure & Confidence — shield with checkmark */
export function PressureIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path d="M20 7 L32 12 L32 22 C32 28.5 26.5 33.5 20 36 C13.5 33.5 8 28.5 8 22 L8 12 Z" stroke="rgba(255,255,255,.5)" strokeWidth="1.3" fill="rgba(255,255,255,.07)" />
      <path d="M14 21 L18 25 L26 17" stroke="#0D9488" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

/** Gear Guide — hockey skate outline */
export function GearIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path d="M10 28 L10 16 C10 14 11.5 12 14 12 L22 12 C25 12 27 14 27 17 L27 22 L32 25 L32 28 L10 28 Z" stroke="rgba(255,255,255,.55)" strokeWidth="1.3" fill="rgba(255,255,255,.07)" />
      <line x1="10" y1="28" x2="32" y2="28" stroke="#FCD34D" strokeWidth="2" strokeLinecap="round" />
      <line x1="14" y1="15" x2="22" y2="15" stroke="rgba(255,255,255,.3)" strokeWidth="1" />
      <line x1="14" y1="18" x2="22" y2="18" stroke="rgba(255,255,255,.3)" strokeWidth="1" />
    </svg>
  );
}

/** Hockey Glossary — open book + magnifying glass */
export function GlossaryIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path d="M20 10 L8 13 L8 32 L20 29 L32 32 L32 13 Z" stroke="rgba(255,255,255,.5)" strokeWidth="1.3" fill="rgba(255,255,255,.07)" />
      <line x1="20" y1="10" x2="20" y2="29" stroke="rgba(255,255,255,.3)" strokeWidth="1" />
      <line x1="11" y1="18" x2="18" y2="17" stroke="rgba(255,255,255,.35)" strokeWidth="1" strokeLinecap="round" />
      <line x1="11" y1="21" x2="18" y2="20" stroke="rgba(255,255,255,.25)" strokeWidth="1" strokeLinecap="round" />
      <line x1="11" y1="24" x2="17" y2="23" stroke="rgba(255,255,255,.2)" strokeWidth="1" strokeLinecap="round" />
      <line x1="22" y1="18" x2="29" y2="19" stroke="rgba(255,255,255,.35)" strokeWidth="1" strokeLinecap="round" />
      <line x1="22" y1="21" x2="29" y2="22" stroke="rgba(255,255,255,.25)" strokeWidth="1" strokeLinecap="round" />
      <line x1="22" y1="24" x2="28" y2="25" stroke="rgba(255,255,255,.2)" strokeWidth="1" strokeLinecap="round" />
      <circle cx="30" cy="12" r="4.5" stroke="#38BDF8" strokeWidth="1.3" fill="rgba(56,189,248,.1)" />
      <line x1="33.5" y1="15.5" x2="36" y2="18" stroke="#38BDF8" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}
