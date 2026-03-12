"use client";

import { X } from "lucide-react";

interface BenchCardViewProps {
  content: string;
  teamName?: string;
  opponentName?: string;
  date?: string;
  onClose: () => void;
}

function parseBenchCardParts(text: string) {
  // Split-based parsing for bench card sections
  const parts: { title: string; content: string }[] = [];
  const lines = text.split("\n");

  // Strategy 1: Look for "## N. TITLE" markdown headers
  const mdSections: { title: string; startIdx: number }[] = [];
  lines.forEach((line, i) => {
    const m = line.match(/^##\s*\d+\.\s*(.+)/);
    if (m) mdSections.push({ title: m[1].trim(), startIdx: i });
  });
  if (mdSections.length >= 3) {
    for (let i = 0; i < mdSections.length; i++) {
      const endIdx = i + 1 < mdSections.length ? mdSections[i + 1].startIdx : lines.length;
      const content = lines.slice(mdSections[i].startIdx + 1, endIdx).join("\n").trim();
      parts.push({ title: mdSections[i].title, content });
    }
    return parts;
  }

  // Strategy 2: Look for "Part A:", "Part B:", etc.
  const partSections: { title: string; startIdx: number }[] = [];
  lines.forEach((line, i) => {
    const m = line.match(/^\s*Part\s+([A-F])[\s:—\-]/i);
    if (m) partSections.push({ title: `Part ${m[1].toUpperCase()}`, startIdx: i });
  });
  if (partSections.length >= 3) {
    for (let i = 0; i < partSections.length; i++) {
      const endIdx = i + 1 < partSections.length ? partSections[i + 1].startIdx : lines.length;
      const content = lines.slice(partSections[i].startIdx + 1, endIdx).join("\n").trim();
      parts.push({ title: partSections[i].title, content });
    }
    return parts;
  }

  // Strategy 3: Look for ALL_CAPS section headers (e.g., "FORWARD LINES — USAGE & MATCHUPS:")
  const capsSections: { title: string; startIdx: number }[] = [];
  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (trimmed.length > 5 && trimmed.length < 80 && trimmed === trimmed.toUpperCase() && /[A-Z]{3,}/.test(trimmed) && !/^[-•✓✗⚠\d]/.test(trimmed)) {
      capsSections.push({ title: trimmed.replace(/[:\s—\-]+$/, ""), startIdx: i });
    }
  });
  if (capsSections.length >= 3) {
    for (let i = 0; i < capsSections.length; i++) {
      const endIdx = i + 1 < capsSections.length ? capsSections[i + 1].startIdx : lines.length;
      const content = lines.slice(capsSections[i].startIdx + 1, endIdx).join("\n").trim();
      parts.push({ title: capsSections[i].title, content });
    }
    return parts;
  }

  // Fallback: return as single block
  return [{ title: "BENCH CARD", content: text }];
}

export default function BenchCardView({ content, teamName, opponentName, date, onClose }: BenchCardViewProps) {
  const parts = parseBenchCardParts(content);
  const isSingleBlock = parts.length === 1 && parts[0].title === "BENCH CARD";

  const headerText = [
    "BENCH CARD",
    teamName && opponentName ? `${teamName} vs ${opponentName}` : teamName || "",
    date || "",
  ].filter(Boolean).join(" — ");

  return (
    <>
      {/* Print-only styles */}
      <style>{`
        @media print {
          body > *:not(.bench-card-overlay) { display: none !important; }
          .bench-card-overlay { position: static !important; background: none !important; overflow: visible !important; }
          .bench-card-modal-chrome { display: none !important; }
          .bench-card-content { box-shadow: none !important; border: none !important; max-height: none !important; overflow: visible !important; }
          @page { size: landscape; margin: 0.4in; }
        }
      `}</style>

      {/* Modal overlay */}
      <div
        className="bench-card-overlay fixed inset-0 z-50 flex items-center justify-center overflow-auto"
        style={{ backgroundColor: "rgba(15,41,66,0.6)" }}
      >
        <div className="bench-card-content bg-white rounded-xl shadow-2xl w-full max-w-5xl mx-4 my-8 max-h-[90vh] overflow-auto" style={{ border: "2px solid rgba(13,148,136,0.3)" }}>
          {/* Modal header (hidden in print) */}
          <div className="bench-card-modal-chrome flex items-center justify-between px-6 py-3" style={{ borderBottom: "2px solid rgba(13,148,136,0.2)" }}>
            <span className="text-xs font-oswald uppercase tracking-wider" style={{ color: "rgba(15,41,66,0.5)" }}>Bench Card Preview</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors"
                style={{ backgroundColor: "#0D9488", color: "#FFFFFF" }}
              >
                Print
              </button>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg transition-colors"
                style={{ color: "rgba(15,41,66,0.4)" }}
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Bench Card content */}
          <div className="p-6">
            {/* Header */}
            <div className="text-center mb-5 pb-3" style={{ borderBottom: "2px solid #0D9488" }}>
              <h1 className="text-lg font-oswald font-bold uppercase tracking-wider" style={{ color: "#0F2942" }}>
                {headerText}
              </h1>
            </div>

            {isSingleBlock ? (
              /* Fallback: monospace raw text */
              <pre className="whitespace-pre-wrap text-xs leading-relaxed" style={{ color: "#0F2942", fontFamily: "ui-monospace, monospace" }}>
                {content}
              </pre>
            ) : (
              /* Parsed sections in grid */
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {parts.map((part, i) => (
                  <div
                    key={i}
                    className={`rounded-lg p-3 ${parts.length <= 4 ? "" : ""}`}
                    style={{
                      border: "1px solid rgba(13,148,136,0.2)",
                      backgroundColor: i === 0 ? "rgba(13,148,136,0.04)" : "#FFFFFF",
                    }}
                  >
                    <h3
                      className="text-[10px] font-oswald font-bold uppercase tracking-wider mb-2 pb-1"
                      style={{ color: "#0D9488", borderBottom: "1px solid rgba(13,148,136,0.15)" }}
                    >
                      {part.title}
                    </h3>
                    <div className="text-[11px] leading-snug" style={{ color: "#0F2942" }}>
                      {part.content.split("\n").map((line, j) => {
                        const trimmed = line.trim();
                        if (!trimmed) return null;
                        // Checkable items
                        if (trimmed.startsWith("[ ]") || trimmed.startsWith("[x]") || trimmed.startsWith("[X]")) {
                          const checked = trimmed.startsWith("[x]") || trimmed.startsWith("[X]");
                          return (
                            <div key={j} className="flex items-start gap-1.5 mb-0.5">
                              <span className="shrink-0 mt-px" style={{ color: checked ? "#0D9488" : "rgba(15,41,66,0.3)" }}>
                                {checked ? "☑" : "☐"}
                              </span>
                              <span>{trimmed.slice(3).trim()}</span>
                            </div>
                          );
                        }
                        // Bullets
                        if (trimmed.startsWith("-") || trimmed.startsWith("•") || trimmed.startsWith("✓") || trimmed.startsWith("✗") || trimmed.startsWith("⚠")) {
                          const symbol = trimmed[0];
                          return (
                            <div key={j} className="flex items-start gap-1.5 mb-0.5 pl-1">
                              <span className="shrink-0" style={{ color: symbol === "✓" ? "#0D9488" : symbol === "✗" ? "#DC2626" : symbol === "⚠" ? "#F59E0B" : "rgba(15,41,66,0.4)" }}>
                                {symbol}
                              </span>
                              <span>{trimmed.slice(1).trim()}</span>
                            </div>
                          );
                        }
                        // If/Then lines
                        if (/^IF\s/i.test(trimmed)) {
                          return (
                            <div key={j} className="mb-1 pl-1 py-0.5 rounded" style={{ backgroundColor: "rgba(13,148,136,0.06)", fontSize: "10px" }}>
                              <span style={{ color: "#0D9488", fontWeight: 700 }}>IF </span>
                              <span>{trimmed.replace(/^IF\s+/i, "")}</span>
                            </div>
                          );
                        }
                        // Numbered items
                        if (/^\d+[\.\)]\s/.test(trimmed)) {
                          return (
                            <div key={j} className="flex items-start gap-1.5 mb-0.5 pl-1">
                              <span className="shrink-0 font-bold" style={{ color: "#0D9488" }}>
                                {trimmed.match(/^\d+[\.\)]/)?.[0]}
                              </span>
                              <span>{trimmed.replace(/^\d+[\.\)]\s*/, "")}</span>
                            </div>
                          );
                        }
                        // Bold/header-like lines (all caps or starts with special chars)
                        if (trimmed === trimmed.toUpperCase() && trimmed.length > 3 && trimmed.length < 60) {
                          return (
                            <div key={j} className="font-bold mt-1.5 mb-0.5 text-[10px] font-oswald uppercase tracking-wider" style={{ color: "#0F2942" }}>
                              {trimmed}
                            </div>
                          );
                        }
                        return <p key={j} className="mb-0.5">{trimmed}</p>;
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
