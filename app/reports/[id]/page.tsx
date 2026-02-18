"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RotateCw,
  Printer,
  FileText,
  Download,
  Link2,
  Users,
  Check,
  Mail,
} from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import ReportSection from "@/components/ReportSection";
import api from "@/lib/api";
import type { Report, Player } from "@/types/api";
import { REPORT_TYPE_LABELS, SECTION_LABELS, PROSPECT_GRADES } from "@/types/api";
import HockeyRink from "@/components/HockeyRink";

/** Parse report output_text by ALL_CAPS section headers */
function parseReportSections(
  text: string
): Array<{ key: string; content: string }> {
  // Match lines that are entirely ALL_CAPS_WITH_UNDERSCORES (section headers)
  const lines = text.split("\n");
  const sections: Array<{ key: string; content: string }> = [];
  let currentKey = "";
  let currentLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    // Check if this line is a section header: ALL_CAPS with underscores, possibly with ## markdown prefix, colons or dashes
    const headerMatch = trimmed.match(
      /^(?:#{1,3}\s+)?([A-Z][A-Z0-9_]+(?:_[A-Z0-9]+)*)[\s:—\-]*$/
    );
    // Accept known section labels OR any valid ALL_CAPS_UNDERSCORED header (for custom reports)
    if (headerMatch && (headerMatch[1] in SECTION_LABELS || headerMatch[1].length >= 4)) {
      // Save previous section
      if (currentKey) {
        sections.push({
          key: currentKey,
          content: currentLines.join("\n").trim(),
        });
      }
      currentKey = headerMatch[1];
      currentLines = [];
    } else if (currentKey) {
      currentLines.push(line);
    } else {
      // Content before first header — treat as intro
      if (trimmed) {
        currentLines.push(line);
      }
    }
  }

  // Don't forget the last section
  if (currentKey) {
    sections.push({
      key: currentKey,
      content: currentLines.join("\n").trim(),
    });
  }

  // If no sections were parsed, return the whole text as a single block
  if (sections.length === 0 && text.trim()) {
    sections.push({ key: "REPORT", content: text.trim() });
  }

  return sections;
}

/** Extract the prospect grade from report text (e.g., "Overall Grade: B+", "GRADE: C+", etc.) */
function extractGrade(text: string): string | null {
  if (!text) return null;
  // Match patterns like "Overall Grade: B+", "**GRADE:** C+", "Grade: A-", "OVERALL_GRADE: B"
  const patterns = [
    /(?:overall[_ ]?grade|grade|prospect[_ ]?grade|rating)\s*[:=]\s*\**\s*([A-D][+-]?|NR)\b/i,
    /\*\*(?:GRADE|Overall Grade|Rating)\*\*\s*[:=]?\s*([A-D][+-]?|NR)\b/i,
    /\bGrade\b[:\s]+([A-D][+-]?|NR)\s/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1].toUpperCase();
  }
  return null;
}

/** Get color classes for a grade badge */
function gradeColors(grade: string): { bg: string; text: string; ring: string } {
  if (grade.startsWith("A")) return { bg: "bg-teal/20", text: "text-teal", ring: "ring-teal/40" };
  if (grade.startsWith("B")) return { bg: "bg-navy/15", text: "text-white", ring: "ring-white/30" };
  if (grade.startsWith("C")) return { bg: "bg-orange/20", text: "text-orange", ring: "ring-orange/40" };
  if (grade === "D") return { bg: "bg-red-500/20", text: "text-red-300", ring: "ring-red-400/40" };
  return { bg: "bg-white/10", text: "text-white/60", ring: "ring-white/20" };
}

export default function ReportViewerPage() {
  const params = useParams();
  const reportId = params.id as string;

  const [report, setReport] = useState<Report | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [polling, setPolling] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  // Share state
  const [copied, setCopied] = useState(false);
  const [sharedWithOrg, setSharedWithOrg] = useState(false);

  useEffect(() => {
    let pollInterval: ReturnType<typeof setInterval> | null = null;

    async function load() {
      try {
        const { data } = await api.get<Report>(`/reports/${reportId}`);
        setReport(data);
        setSharedWithOrg(!!data.shared_with_org);

        // Fetch player info
        if (data.player_id) {
          try {
            const playerRes = await api.get<Player>(
              `/players/${data.player_id}`
            );
            setPlayer(playerRes.data);
          } catch {
            // Player might have been deleted
          }
        }

        // If report is still processing, poll for updates
        if (data.status === "processing" || data.status === "pending") {
          setPolling(true);
          pollInterval = setInterval(async () => {
            try {
              const updated = await api.get<Report>(`/reports/${reportId}`);
              setReport(updated.data);
              if (
                updated.data.status === "complete" ||
                updated.data.status === "failed"
              ) {
                if (pollInterval) clearInterval(pollInterval);
                setPolling(false);
              }
            } catch {
              // Keep polling
            }
          }, 2000);
        }
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed to load report.";
        setError(msg);
      } finally {
        setLoading(false);
      }
    }

    if (reportId) load();

    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [reportId]);

  const handleRegenerate = async () => {
    if (!report) return;
    setRegenerating(true);
    try {
      const { data: newReport } = await api.put(`/reports/${reportId}`);
      // The PUT deletes old report and creates a new one with a new ID
      // Redirect to the new report
      if (newReport?.id && newReport.id !== reportId) {
        window.location.href = `/reports/${newReport.id}`;
        return;
      }
      // Fallback: reload current
      const { data } = await api.get<Report>(`/reports/${reportId}`);
      setReport(data);
      if (data.status === "processing" || data.status === "pending") {
        setPolling(true);
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed to regenerate report.";
      setError(msg);
    } finally {
      setRegenerating(false);
    }
  };

  const sections = useMemo(() => {
    if (!report?.output_text) return [];
    return parseReportSections(report.output_text);
  }, [report?.output_text]);

  // Extract grade from report text
  const grade = useMemo(() => {
    if (!report?.output_text) return null;
    return extractGrade(report.output_text);
  }, [report?.output_text]);

  // Build the filename for download/print — works for player or team reports
  const subjectName = player
    ? `${player.first_name}_${player.last_name}`
    : report?.team_name?.replace(/\s+/g, "_") || "Report";
  const reportFileName = useMemo(() => {
    const type = report?.report_type || "report";
    const date = report?.generated_at
      ? new Date(report.generated_at).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0];
    return `${subjectName}_${type}_${date}`;
  }, [subjectName, report?.report_type, report?.generated_at]);

  // Set document title for print/save PDF (so the browser suggests a good filename)
  useEffect(() => {
    if (report) {
      const label = REPORT_TYPE_LABELS[report.report_type] || report.report_type;
      if (player) {
        document.title = `${player.first_name} ${player.last_name} — ${label} | ProspectX`;
      } else if (report.team_name) {
        document.title = `${report.team_name} — ${label} | ProspectX`;
      }
    }
    return () => {
      document.title = "ProspectX Intelligence";
    };
  }, [report, player]);

  const handleDownloadPDF = () => {
    // Set document title to clean filename before printing — browsers use this as the default PDF name
    const prevTitle = document.title;
    document.title = reportFileName;
    window.print();
    // Restore after a short delay (print dialog is async)
    setTimeout(() => {
      document.title = prevTitle;
    }, 1000);
  };

  const handleCopyLink = async () => {
    try {
      const { data } = await api.post(`/reports/${reportId}/share`);
      await navigator.clipboard.writeText(data.share_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: copy current URL
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleTeamShare = async () => {
    try {
      const { data } = await api.put(`/reports/${reportId}/team-share`);
      setSharedWithOrg(data.shared_with_org);
    } catch {
      // silently fail
    }
  };

  const handleDownloadDocx = async () => {
    try {
      const response = await api.get(`/reports/${reportId}/export/docx`, {
        responseType: "blob",
      });
      const blob = new Blob([response.data], {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${reportFileName}.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch {
      // silently fail — DOCX export may not be available
    }
  };

  const handleEmailShare = async () => {
    try {
      const { data } = await api.post(`/reports/${reportId}/email-preview`);
      const mailtoUrl = `mailto:?subject=${encodeURIComponent(data.subject)}&body=${encodeURIComponent(data.body)}`;
      window.open(mailtoUrl, "_self");
    } catch {
      // Fallback: open mailto with just the current URL
      const subject = `ProspectX Report`;
      const body = `Check out this report: ${window.location.href}`;
      window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, "_self");
    }
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <NavBar />
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-navy border-t-teal" />
        </div>
      </ProtectedRoute>
    );
  }

  if (!report) {
    return (
      <ProtectedRoute>
        <NavBar />
        <main className="max-w-4xl mx-auto px-4 py-8">
          {error ? (
            <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
              <AlertCircle size={32} className="mx-auto text-red-500 mb-3" />
              <p className="text-red-700 font-medium mb-2">Error Loading Report</p>
              <p className="text-red-600 text-sm">{error}</p>
              <Link href="/reports" className="inline-block mt-4 text-sm text-teal hover:underline">
                ← Back to Reports
              </Link>
            </div>
          ) : (
            <p className="text-muted">Report not found.</p>
          )}
        </main>
      </ProtectedRoute>
    );
  }

  const reportTypeLabel =
    REPORT_TYPE_LABELS[report.report_type] || report.report_type;

  return (
    <ProtectedRoute>
      <NavBar />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <Link
          href="/reports"
          className="flex items-center gap-1 text-sm text-muted hover:text-navy mb-6 print:hidden"
        >
          <ArrowLeft size={14} /> Back to Reports
        </Link>

        {/* Report Header */}
        <div className="bg-gradient-to-br from-navy to-navy-light rounded-xl p-6 text-white mb-1">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-0.5 bg-teal/20 text-teal rounded font-oswald font-bold text-xs uppercase">
                  {reportTypeLabel}
                </span>
                <StatusBadge status={report.status} polling={polling} />
              </div>
              <h1 className="text-2xl font-bold">
                {report.title || "Report"}
              </h1>
              {player ? (
                <Link
                  href={`/players/${player.id}`}
                  className="inline-flex items-center gap-1 text-sm text-white/70 hover:text-teal mt-1 transition-colors"
                >
                  {player.first_name} {player.last_name}
                  {player.current_team && (
                    <span className="text-white/50">
                      {" "}
                      — {player.current_team}
                    </span>
                  )}
                </Link>
              ) : report.team_name ? (
                <Link
                  href={`/teams/${encodeURIComponent(report.team_name)}`}
                  className="inline-flex items-center gap-1 text-sm text-white/70 hover:text-teal mt-1 transition-colors"
                >
                  {report.team_name}
                </Link>
              ) : null}
              <div className="flex items-center gap-4 mt-3 text-xs text-white/50">
                {report.generated_at && (
                  <span>
                    Generated{" "}
                    {new Date(report.generated_at).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                )}
                {report.llm_model && <span>Model: {report.llm_model}</span>}
                {report.llm_tokens && (
                  <span>{report.llm_tokens.toLocaleString()} tokens</span>
                )}
              </div>
            </div>

            {/* Grade Badge + Actions */}
            <div className="flex flex-col items-end gap-3 shrink-0 ml-4">
              {/* Grade Badge + Quality Score — prominent display */}
              <div className="flex items-center gap-2">
                {grade && (
                  <div className={`flex flex-col items-center px-3 py-2 rounded-lg ring-1 ${gradeColors(grade).bg} ${gradeColors(grade).ring}`}>
                    <span className="text-[10px] font-oswald uppercase tracking-wider text-white/50 leading-none">Grade</span>
                    <span className={`text-2xl font-oswald font-bold leading-tight ${gradeColors(grade).text}`}>{grade}</span>
                    {PROSPECT_GRADES[grade] && (
                      <span className="text-[9px] text-white/40 leading-none mt-0.5 text-center max-w-[100px]">
                        {PROSPECT_GRADES[grade].nhl.split(" / ")[0]}
                      </span>
                    )}
                  </div>
                )}
                {report?.quality_score != null && (
                  <div
                    className={`flex flex-col items-center px-3 py-2 rounded-lg ring-1 ${
                      report.quality_score >= 80
                        ? "bg-teal/20 ring-teal/40"
                        : report.quality_score >= 60
                        ? "bg-orange/20 ring-orange/40"
                        : "bg-red-500/20 ring-red-400/40"
                    }`}
                    title={(() => {
                      try {
                        const details = report.quality_details ? JSON.parse(report.quality_details) : null;
                        if (!details?.breakdown) return `Quality: ${report.quality_score}/100`;
                        const b = details.breakdown;
                        return `Quality: ${report.quality_score}/100\nSections: ${b.section_completeness}/25\nEvidence: ${b.evidence_discipline}/25\nDepth: ${b.depth_adequacy}/25\nGrade: ${b.grade_presence}/10\nClean: ${b.cleanliness}/15`;
                      } catch { return `Quality: ${report.quality_score}/100`; }
                    })()}
                  >
                    <span className="text-[10px] font-oswald uppercase tracking-wider text-white/50 leading-none">Quality</span>
                    <span className={`text-2xl font-oswald font-bold leading-tight ${
                      report.quality_score >= 80 ? "text-teal" : report.quality_score >= 60 ? "text-orange" : "text-red-300"
                    }`}>
                      {Math.round(report.quality_score)}
                    </span>
                    <span className="text-[9px] text-white/40 leading-none mt-0.5">/ 100</span>
                  </div>
                )}
              </div>

              {/* Action buttons — hidden in print */}
              <div className="flex items-center gap-2 print:hidden">
                <button
                  onClick={handleCopyLink}
                  className="flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-oswald uppercase tracking-wider transition-colors"
                  title="Copy shareable link"
                >
                  {copied ? <Check size={14} className="text-green-400" /> : <Link2 size={14} />}
                  {copied ? "Copied" : "Link"}
                </button>
                <button
                  onClick={handleTeamShare}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-oswald uppercase tracking-wider transition-colors ${
                    sharedWithOrg
                      ? "bg-teal/20 text-teal"
                      : "bg-white/10 hover:bg-white/20"
                  }`}
                  title={sharedWithOrg ? "Shared with team — click to unshare" : "Share with team"}
                >
                  <Users size={14} />
                  {sharedWithOrg ? "Shared" : "Share"}
                </button>
                <button
                  onClick={handleDownloadPDF}
                  className="flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-oswald uppercase tracking-wider transition-colors"
                  title={`Download as PDF (${reportFileName}.pdf)`}
                >
                  <Download size={14} />
                  PDF
                </button>
                <button
                  onClick={handleDownloadDocx}
                  className="flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-oswald uppercase tracking-wider transition-colors"
                  title={`Download as Word (${reportFileName}.docx)`}
                >
                  <FileText size={14} />
                  DOCX
                </button>
                <button
                  onClick={handleEmailShare}
                  className="flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-oswald uppercase tracking-wider transition-colors"
                  title="Email this report"
                >
                  <Mail size={14} />
                  Email
                </button>
                <button
                  onClick={() => window.print()}
                  className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                  title="Print report"
                >
                  <Printer size={16} />
                </button>
                <button
                  onClick={handleRegenerate}
                  disabled={regenerating || polling}
                  className="flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 disabled:opacity-50 rounded-lg text-xs font-oswald uppercase tracking-wider transition-colors"
                  title="Regenerate report"
                >
                  <RotateCw
                    size={14}
                    className={regenerating ? "animate-spin" : ""}
                  />
                  Regenerate
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Ice Stripe */}
        <div className="ice-stripe mb-6 rounded-b-full" />

        {/* Report Content */}
        {report.status === "processing" || report.status === "pending" ? (
          <div className="bg-white rounded-xl border border-teal/20 p-8 sm:p-12 text-center">
            <div className="flex justify-center mb-6">
              <HockeyRink size="full" animate={true} />
            </div>
            <h2 className="text-lg font-oswald font-bold text-navy uppercase tracking-wider mb-1">
              Generating Report
            </h2>
            <p className="text-sm text-muted">
              Our AI is analyzing data and crafting your report. This usually
              takes 15-30 seconds.
            </p>
          </div>
        ) : report.status === "failed" ? (
          <div className="bg-white rounded-xl border border-red-200 p-8 text-center">
            <AlertCircle
              size={32}
              className="mx-auto text-red-500 mb-3"
            />
            <h2 className="text-lg font-bold text-navy mb-1">
              Generation Failed
            </h2>
            <p className="text-sm text-red-600 mb-4">
              {report.error_message || "An error occurred during report generation."}
            </p>
            <button
              onClick={handleRegenerate}
              disabled={regenerating}
              className="inline-flex items-center gap-2 px-4 py-2 bg-teal text-white text-sm font-oswald font-semibold uppercase tracking-wider rounded-lg hover:bg-teal/90 disabled:opacity-50 transition-colors"
            >
              <RotateCw
                size={14}
                className={regenerating ? "animate-spin" : ""}
              />
              Try Again
            </button>
          </div>
        ) : sections.length > 0 ? (
          <div className="bg-white rounded-xl border border-teal/20 p-6 sm:p-8">
            {/* Table of Contents */}
            {sections.length > 3 && (
              <div className="mb-8 p-4 bg-navy/[0.02] rounded-lg border border-teal/10">
                <h3 className="text-xs font-oswald uppercase tracking-wider text-muted mb-2">
                  Sections
                </h3>
                <div className="flex flex-wrap gap-2">
                  {sections.map((s, i) => (
                    <a
                      key={i}
                      href={`#section-${i}`}
                      className="text-xs text-teal hover:text-navy transition-colors"
                    >
                      {SECTION_LABELS[s.key] || s.key.replace(/_/g, " ")}
                      {i < sections.length - 1 && (
                        <span className="text-border ml-2">|</span>
                      )}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Report Sections */}
            {sections.map((s, i) => (
              <div key={i} id={`section-${i}`}>
                <ReportSection sectionKey={s.key} content={s.content} />
              </div>
            ))}

            {/* Grading Legend */}
            <GradingLegend reportType={report.report_type} />

            {/* Footer */}
            <div className="mt-8 pt-6 border-t border-teal/20">
              <div className="ice-stripe rounded-full mb-4" />
              <div className="flex items-center justify-between text-xs text-muted">
                <span className="font-oswald uppercase tracking-wider">
                  ProspectX Intelligence
                </span>
                <span>
                  {report.generated_at &&
                    new Date(report.generated_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-teal/20 p-8 text-center">
            <FileText size={32} className="mx-auto text-muted/40 mb-3" />
            <p className="text-muted text-sm">
              No report content available.
            </p>
          </div>
        )}
      </main>
    </ProtectedRoute>
  );
}

/** Grading legend for scouting reports */
const SCOUTING_REPORT_TYPES = [
  "pro_skater", "unified_prospect", "goalie", "season_intelligence",
  "operations", "agent_pack", "development_roadmap", "family_card",
  "trade_target", "draft_comparative", "season_progress",
];

function GradingLegend({ reportType }: { reportType: string }) {
  const [open, setOpen] = useState(false);

  // Only show for scouting report types
  if (!SCOUTING_REPORT_TYPES.includes(reportType)) return null;

  const grades = Object.values(PROSPECT_GRADES);

  return (
    <div className="mt-8 border border-teal/20 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-navy/[0.03] hover:bg-navy/[0.05] transition-colors text-left"
      >
        <span className="text-xs font-oswald uppercase tracking-wider text-muted">
          Prospect Grading Scale
        </span>
        <span className="text-xs text-muted">{open ? "Hide" : "Show"}</span>
      </button>
      {open && (
        <div className="px-4 py-4">
          <p className="text-xs text-muted/80 mb-4 leading-relaxed">
            Grades reflect projected NHL trajectory based on current skill set, development curve, skating, hockey sense, and physical tools.
            They are not based on current league performance alone — a player can dominate junior hockey but still project as a B- if their tools suggest a limited NHL ceiling.
          </p>
          <div className="space-y-2">
            {grades.map((g) => (
              <div key={g.label} className="flex items-start gap-3">
                <span className={`inline-flex items-center justify-center w-8 h-6 rounded text-xs font-oswald font-bold shrink-0 ${
                  g.label.startsWith("A") ? "bg-teal/15 text-teal" :
                  g.label.startsWith("B") ? "bg-navy/10 text-navy" :
                  g.label.startsWith("C") ? "bg-orange/15 text-orange" :
                  g.label === "D" ? "bg-red-100 text-red-600" :
                  "bg-gray-100 text-gray-500"
                }`}>
                  {g.label}
                </span>
                <div className="min-w-0">
                  <span className="text-xs font-semibold text-navy">{g.nhl}</span>
                  <p className="text-[11px] text-muted/70 leading-relaxed">{g.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Inline status badge for report header */
function StatusBadge({
  status,
  polling,
}: {
  status: Report["status"];
  polling: boolean;
}) {
  const config = {
    complete: {
      icon: CheckCircle2,
      label: "Complete",
      bg: "bg-green-500/20",
      text: "text-green-300",
    },
    processing: {
      icon: Loader2,
      label: "Generating",
      bg: "bg-teal/20",
      text: "text-teal",
    },
    pending: {
      icon: Clock,
      label: "Queued",
      bg: "bg-orange/20",
      text: "text-orange",
    },
    failed: {
      icon: AlertCircle,
      label: "Failed",
      bg: "bg-red-500/20",
      text: "text-red-300",
    },
  };

  const c = config[status] || config.pending;
  const Icon = c.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${c.bg} ${c.text}`}
    >
      <Icon
        size={12}
        className={
          status === "processing" || polling ? "animate-spin" : ""
        }
      />
      {c.label}
    </span>
  );
}
