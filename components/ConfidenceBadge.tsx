"use client";

/**
 * PXR Confidence Badge — shared component.
 * Renders HIGH (green), MODERATE (amber), or SMALL SAMPLE (gray) badge
 * based on PXR confidence_tier. Used on Leaderboard, Draft Board, and Player Profile.
 */
export default function ConfidenceBadge({ tier, gp }: { tier?: string | null; gp?: number | null }) {
  if (!tier) return null;

  const base: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 2,
    padding: "2px 6px",
    borderRadius: 4,
    fontSize: 9,
    fontWeight: 700,
    fontFamily: "'Oswald', sans-serif",
    textTransform: "uppercase",
    letterSpacing: ".06em",
  };

  if (tier === "high") {
    return (
      <span style={{ ...base, background: "rgba(34,197,94,0.12)", color: "#16A34A" }}>
        High
      </span>
    );
  }
  if (tier === "moderate") {
    return (
      <span style={{ ...base, background: "rgba(245,158,11,0.12)", color: "#D97706" }}>
        Moderate
      </span>
    );
  }
  return (
    <span style={{ ...base, background: "rgba(107,114,128,0.12)", color: "#6B7280" }}>
      Small Sample{gp != null && gp < 15 ? ` (${gp} GP)` : ""}
    </span>
  );
}
