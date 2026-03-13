"use client";

import { Tooltip } from "@/components/ui/Tooltip";

/**
 * PXRConfidenceBadge — PXR confidence tier + score_type badge.
 *
 * Full mode (default): small colored pill with label text + tooltip.
 * Compact mode (compact={true}): small colored dot + short label only.
 *
 * Badge map (inline hex, no Tailwind color classes):
 *   HIGH            → "High"       bg #0D9488  text #FFFFFF
 *   MODERATE        → "Moderate"   bg #F59E0B  text #FFFFFF
 *   LIMITED_METRICS → "Est."       bg #6B7280  text #FFFFFF
 *   SMALL_SAMPLE    → "Sm. Sample" bg #E67E22  text #FFFFFF
 *   default         → "?"          bg #6B7280  text #FFFFFF
 *
 * If score_type === "estimated": append "~" to label,
 *   add second tooltip line about estimated scoring.
 */

interface PXRConfidenceBadgeProps {
  confidence_tier: string;
  score_type?: string | null;
  compact?: boolean;
}

interface BadgeConfig {
  label: string;
  bg: string;
  text: string;
  tooltip: string;
}

const BADGE_MAP: Record<string, BadgeConfig> = {
  high: {
    label: "High",
    bg: "#0D9488",
    text: "#FFFFFF",
    tooltip: "20+ games, all pillars scored \u2014 high reliability",
  },
  moderate: {
    label: "Moderate",
    bg: "#F59E0B",
    text: "#FFFFFF",
    tooltip: "Decent sample, minor data gaps \u2014 reliable",
  },
  limited_metrics: {
    label: "Est.",
    bg: "#6B7280",
    text: "#FFFFFF",
    tooltip: "Estimated from counting stats only",
  },
  small_sample: {
    label: "Sm. Sample",
    bg: "#E67E22",
    text: "#FFFFFF",
    tooltip: "Under 10 games \u2014 early, volatile signal",
  },
};

const DEFAULT_BADGE: BadgeConfig = {
  label: "?",
  bg: "#6B7280",
  text: "#FFFFFF",
  tooltip: "Confidence tier unknown",
};

export default function PXRConfidenceBadge({
  confidence_tier,
  score_type,
  compact = false,
}: PXRConfidenceBadgeProps) {
  if (!confidence_tier) return null;

  const key = confidence_tier.toLowerCase();
  const cfg = BADGE_MAP[key] || DEFAULT_BADGE;

  const isEstimated = score_type === "estimated";
  const label = isEstimated ? `${cfg.label}~` : cfg.label;

  const tooltipText = isEstimated
    ? `${cfg.tooltip}\nEstimated score \u2014 based on counting stats only`
    : cfg.tooltip;

  // ── Compact mode: small dot + short label (for table rows) ──
  if (compact) {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          fontFamily: "'Oswald', sans-serif",
          fontSize: 11,
          fontWeight: 700,
          color: cfg.bg,
          textTransform: "uppercase",
          letterSpacing: ".04em",
          cursor: "default",
        }}
        title={tooltipText}
      >
        <span
          style={{
            display: "inline-block",
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: cfg.bg,
            flexShrink: 0,
          }}
        />
        {label}
      </span>
    );
  }

  // ── Full mode: colored pill with tooltip ──
  return (
    <Tooltip text={tooltipText} position="top">
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          padding: "2px 6px",
          borderRadius: 4,
          fontSize: 11,
          fontWeight: 700,
          fontFamily: "'Oswald', sans-serif",
          textTransform: "uppercase",
          letterSpacing: ".04em",
          background: cfg.bg,
          color: cfg.text,
          cursor: "help",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
    </Tooltip>
  );
}
