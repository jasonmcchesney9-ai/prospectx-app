"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { QualityCheck } from "@/types/api";

/**
 * ReportQualityPanel — collapsible advisory quality-check display.
 *
 * Collapsed (default): small row with grade badge + score + chevron.
 * Expanded: bulleted flag list or "No issues detected".
 *
 * Inline hex only — no Tailwind color classes for colored elements.
 */

const GRADE_COLORS: Record<string, { bg: string; text: string }> = {
  Good: { bg: "#0D9488", text: "#FFFFFF" },
  "Needs Attention": { bg: "#F59E0B", text: "#FFFFFF" },
  "High Risk": { bg: "#E67E22", text: "#FFFFFF" },
};

const SEVERITY_DOT: Record<string, string> = {
  HIGH: "#E67E22",
  MEDIUM: "#F59E0B",
  LOW: "#6B7280",
};

interface ReportQualityPanelProps {
  qualityCheck: QualityCheck | null | undefined;
  defaultExpanded?: boolean;
}

export default function ReportQualityPanel({
  qualityCheck,
  defaultExpanded = false,
}: ReportQualityPanelProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  if (!qualityCheck) return null;

  const gradeStyle = GRADE_COLORS[qualityCheck.grade] || GRADE_COLORS.Good;

  return (
    <div
      style={{
        border: "1px solid #E2E8F0",
        borderRadius: 6,
        padding: "8px 12px",
        background: "#F8FAFC",
        marginBottom: 16,
      }}
    >
      {/* ── Collapsed header row ── */}
      <div
        onClick={() => setExpanded((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        {/* Label */}
        <span
          style={{
            fontFamily: "'Oswald', sans-serif",
            fontSize: 12,
            fontWeight: 600,
            color: "#6B7280",
            textTransform: "uppercase",
            letterSpacing: ".04em",
          }}
        >
          Quality Check
        </span>

        {/* Grade badge */}
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "1px 7px",
            borderRadius: 4,
            fontSize: 11,
            fontWeight: 700,
            fontFamily: "'Oswald', sans-serif",
            textTransform: "uppercase",
            letterSpacing: ".04em",
            background: gradeStyle.bg,
            color: gradeStyle.text,
            whiteSpace: "nowrap",
          }}
        >
          {qualityCheck.grade}
        </span>

        {/* Score */}
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 12,
            color: "#6B7280",
          }}
        >
          {qualityCheck.overall_score}/100
        </span>

        {/* Spacer */}
        <span style={{ flex: 1 }} />

        {/* Chevron */}
        {expanded ? (
          <ChevronUp size={14} color="#6B7280" />
        ) : (
          <ChevronDown size={14} color="#6B7280" />
        )}
      </div>

      {/* ── Expanded detail ── */}
      {expanded && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #E2E8F0" }}>
          {qualityCheck.flag_count === 0 ? (
            <span
              style={{
                fontSize: 13,
                color: "#0D9488",
                fontFamily: "'Source Serif 4', serif",
              }}
            >
              ✓ No issues detected
            </span>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {qualityCheck.flags.map((flag, i) => (
                <li
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 8,
                    marginBottom: i < qualityCheck.flags.length - 1 ? 6 : 0,
                  }}
                >
                  {/* Severity dot */}
                  <span
                    style={{
                      display: "inline-block",
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: SEVERITY_DOT[flag.severity] || "#6B7280",
                      flexShrink: 0,
                      marginTop: 5,
                    }}
                  />
                  {/* Message */}
                  <span
                    style={{
                      fontSize: 13,
                      color: "#374151",
                      fontFamily: "'Source Serif 4', serif",
                      lineHeight: 1.4,
                    }}
                  >
                    {flag.message}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
