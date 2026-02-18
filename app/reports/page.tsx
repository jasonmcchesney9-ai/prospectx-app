"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, Zap, Filter, FileText, Wand2, FolderOpen, ChevronDown, ChevronRight } from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import ReportCard from "@/components/ReportCard";
import PXIBadge from "@/components/PXIBadge";
import api from "@/lib/api";
import type { Report } from "@/types/api";
import { REPORT_TYPE_LABELS } from "@/types/api";

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function load() {
      try {
        setError("");
        const { data } = await api.get<Report[]>("/reports?limit=200");
        setReports(data);
        // Auto-expand all folders that have reports
        const types = new Set(data.map((r) => r.report_type));
        setExpandedFolders(types);
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed to load reports";
        setError(msg);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Client-side filtering for search and status
  const filtered = reports.filter((r) => {
    if (search) {
      const q = search.toLowerCase();
      const title = (r.title || "").toLowerCase();
      const typeLabel = (REPORT_TYPE_LABELS[r.report_type] || "").toLowerCase();
      if (!title.includes(q) && !r.report_type.includes(q) && !typeLabel.includes(q)) return false;
    }
    if (statusFilter && r.status !== statusFilter) return false;
    return true;
  });

  // Group by report type
  const grouped: Record<string, Report[]> = {};
  for (const r of filtered) {
    const type = r.report_type || "other";
    if (!grouped[type]) grouped[type] = [];
    grouped[type].push(r);
  }

  // Sort folders: most reports first, then alphabetically
  const sortedTypes = Object.keys(grouped).sort((a, b) => {
    const diff = grouped[b].length - grouped[a].length;
    if (diff !== 0) return diff;
    return (REPORT_TYPE_LABELS[a] || a).localeCompare(REPORT_TYPE_LABELS[b] || b);
  });

  const toggleFolder = (type: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const expandAll = () => setExpandedFolders(new Set(sortedTypes));
  const collapseAll = () => setExpandedFolders(new Set());

  return (
    <ProtectedRoute>
      <NavBar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <PXIBadge size={32} variant="dark" showDot={false} />
            <div>
              <h1 className="text-2xl font-bold text-navy">My Reports</h1>
              <p className="text-xs text-muted mt-0.5">
                {reports.length} {reports.length === 1 ? "report" : "reports"} across {Object.keys(grouped).length} {Object.keys(grouped).length === 1 ? "category" : "categories"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/reports/custom"
              className="flex items-center gap-2 px-4 py-2 bg-navy text-white text-sm font-oswald font-semibold uppercase tracking-wider rounded-lg hover:bg-navy/90 transition-colors"
            >
              <Wand2 size={16} />
              Custom Report
            </Link>
            <Link
              href="/reports/generate"
              className="flex items-center gap-2 px-4 py-2 bg-teal text-white text-sm font-oswald font-semibold uppercase tracking-wider rounded-lg hover:bg-teal/90 transition-colors"
            >
              <Zap size={16} />
              Generate Report
            </Link>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder="Search reports..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-teal/20 rounded-lg text-sm bg-white"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-muted" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-teal/20 rounded-lg text-sm bg-white"
            >
              <option value="">All Statuses</option>
              <option value="complete">Complete</option>
              <option value="processing">Processing</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
            </select>
            {sortedTypes.length > 1 && (
              <div className="flex items-center gap-1 ml-2">
                <button
                  onClick={expandAll}
                  className="text-xs text-teal hover:text-teal/70 transition-colors"
                >
                  Expand All
                </button>
                <span className="text-muted text-xs">|</span>
                <button
                  onClick={collapseAll}
                  className="text-xs text-teal hover:text-teal/70 transition-colors"
                >
                  Collapse
                </button>
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 text-sm">{error}</div>
        )}

        {/* Reports Folders */}
        {loading ? (
          <div className="flex items-center justify-center min-h-[30vh]">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-navy border-t-teal" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-teal/20">
            <FileText size={32} className="mx-auto text-muted/40 mb-3" />
            <p className="text-muted text-sm mb-4">
              {reports.length === 0
                ? "No reports generated yet."
                : "No reports match your filters."}
            </p>
            {reports.length === 0 && (
              <Link
                href="/reports/generate"
                className="inline-flex items-center gap-2 px-4 py-2 bg-teal text-white text-sm font-oswald font-semibold uppercase tracking-wider rounded-lg hover:bg-teal/90 transition-colors"
              >
                <Zap size={14} />
                Generate Your First Report
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {sortedTypes.map((type) => {
              const typeReports = grouped[type];
              const isExpanded = expandedFolders.has(type);
              const label = REPORT_TYPE_LABELS[type] || type;

              return (
                <div key={type} className="bg-white rounded-xl border border-teal/20 overflow-hidden">
                  {/* Folder Header */}
                  <button
                    onClick={() => toggleFolder(type)}
                    className="w-full flex items-center gap-3 px-5 py-3 hover:bg-navy/[0.02] transition-colors"
                  >
                    {isExpanded ? (
                      <ChevronDown size={16} className="text-navy/50 shrink-0" />
                    ) : (
                      <ChevronRight size={16} className="text-navy/50 shrink-0" />
                    )}
                    <FolderOpen size={18} className={`shrink-0 ${isExpanded ? "text-teal" : "text-navy/30"}`} />
                    <span className="text-sm font-oswald font-bold uppercase tracking-wider text-navy">
                      {label}
                    </span>
                    <span className="ml-auto text-xs text-muted bg-navy/[0.04] px-2 py-0.5 rounded-full font-medium">
                      {typeReports.length}
                    </span>
                  </button>

                  {/* Folder Contents */}
                  {isExpanded && (
                    <div className="border-t border-teal/10 px-4 py-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {typeReports.map((r) => (
                          <ReportCard key={r.id} report={r} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </ProtectedRoute>
  );
}
