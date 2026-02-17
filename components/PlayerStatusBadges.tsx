/**
 * PlayerStatusBadges — Renders compact status badges from player tags
 *
 * Tags matching known status codes render as styled badges:
 * R (Rookie), IR (Injured), S (Suspended), AP (Affiliate), I (Import), C (Committed)
 *
 * Two sizes: "sm" (for tables/cards) and "md" (for profile headers)
 */
import { PLAYER_STATUS_TAGS } from "@/types/api";

interface Props {
  tags: string[];
  size?: "sm" | "md";
  className?: string;
}

export default function PlayerStatusBadges({ tags, size = "sm", className = "" }: Props) {
  if (!tags || tags.length === 0) return null;

  // Find which tags match known status codes
  const statusBadges = tags
    .map((tag) => {
      const lower = tag.toLowerCase().trim();
      return PLAYER_STATUS_TAGS[lower] || null;
    })
    .filter(Boolean);

  if (statusBadges.length === 0) return null;

  if (size === "sm") {
    return (
      <span className={`inline-flex items-center gap-0.5 ${className}`}>
        {statusBadges.map((badge) => (
          <span
            key={badge!.abbr}
            className={`inline-flex items-center justify-center px-1 py-0 rounded text-[8px] font-oswald font-bold leading-none border ${badge!.bg} ${badge!.text} ${badge!.border}`}
            title={badge!.title}
            style={{ minWidth: "16px", height: "14px" }}
          >
            {badge!.abbr}
          </span>
        ))}
      </span>
    );
  }

  // "md" size — profile header style
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      {statusBadges.map((badge) => (
        <span
          key={badge!.abbr}
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-oswald font-bold uppercase tracking-wider border ${badge!.bg} ${badge!.text} ${badge!.border}`}
          title={badge!.title}
        >
          <span className="text-[9px]">{badge!.abbr}</span>
          <span className="hidden sm:inline">{badge!.label}</span>
        </span>
      ))}
    </span>
  );
}
