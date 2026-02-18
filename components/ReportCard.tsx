import Link from "next/link";
import { FileText, Clock, CheckCircle2, AlertCircle, Loader2, Users, User } from "lucide-react";
import { REPORT_TYPE_LABELS, TEAM_REPORT_TYPES } from "@/types/api";
import type { Report } from "@/types/api";

const STATUS_CONFIG = {
  complete: { icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50", label: "Complete" },
  processing: { icon: Loader2, color: "text-teal", bg: "bg-teal/10", label: "Generating..." },
  pending: { icon: Clock, color: "text-orange", bg: "bg-orange/10", label: "Pending" },
  failed: { icon: AlertCircle, color: "text-red-600", bg: "bg-red-50", label: "Failed" },
} as const;

export default function ReportCard({ report, compact = false }: { report: Report; compact?: boolean }) {
  const statusInfo = STATUS_CONFIG[report.status] || STATUS_CONFIG.pending;
  const StatusIcon = statusInfo.icon;
  const isTeamReport = (TEAM_REPORT_TYPES as readonly string[]).includes(report.report_type);
  const CategoryIcon = isTeamReport ? Users : User;

  if (compact) {
    return (
      <Link
        href={`/reports/${report.id}`}
        className="flex items-center gap-2.5 py-2 px-1 hover:bg-navy/[0.02] rounded-lg transition-colors group"
      >
        <div className={`w-7 h-7 rounded flex items-center justify-center shrink-0 ${isTeamReport ? "bg-orange/10" : "bg-navy/5"}`}>
          <CategoryIcon size={14} className={isTeamReport ? "text-orange" : "text-navy/60"} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-navy font-medium truncate group-hover:text-teal transition-colors">
            {report.title || "Untitled Report"}
          </p>
          <p className="text-[11px] text-muted truncate">
            {REPORT_TYPE_LABELS[report.report_type] || report.report_type}
            {report.generated_at && ` · ${new Date(report.generated_at).toLocaleDateString()}`}
          </p>
        </div>
        <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 ${statusInfo.bg} ${statusInfo.color}`}>
          <StatusIcon size={10} className={report.status === "processing" ? "animate-spin" : ""} />
          {statusInfo.label}
        </span>
      </Link>
    );
  }

  return (
    <Link
      href={`/reports/${report.id}`}
      className="block bg-white rounded-lg border border-border p-4 hover:shadow-md transition-shadow"
    >
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${isTeamReport ? "bg-orange/10" : "bg-navy/5"}`}>
          <CategoryIcon size={18} className={isTeamReport ? "text-orange" : "text-navy"} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-navy text-sm truncate">
            {report.title || "Untitled Report"}
          </h3>
          <p className="text-xs text-muted mt-0.5">
            {REPORT_TYPE_LABELS[report.report_type] || report.report_type}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${statusInfo.bg} ${statusInfo.color}`}
            >
              <StatusIcon size={12} className={report.status === "processing" ? "animate-spin" : ""} />
              {statusInfo.label}
            </span>
            {report.generated_at && (
              <span className="text-xs text-muted">
                {new Date(report.generated_at).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
