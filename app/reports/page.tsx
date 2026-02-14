"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, Zap, Filter, FileText, Wand2 } from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import ReportCard from "@/components/ReportCard";
import api from "@/lib/api";
import type { Report } from "@/types/api";
import { REPORT_TYPE_LABELS } from "@/types/api";

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setError("");
        const params = new URLSearchParams();
        params.set("limit", "100");
        if (typeFilter) params.set("report_type", typeFilter);
        const { data } = await api.get<Report[]>(`/reports?${params}`);
        setReports(data);
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed to load reports";
        setError(msg);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [typeFilter]);

  // Client-side filtering for search and status
  const filtered = reports.filter((r) => {
    if (search) {
      const q = search.toLowerCase();
      const title = (r.title || "").toLowerCase();
      if (!title.includes(q) && !r.report_type.includes(q)) return false;
    }
    if (statusFilter && r.status !== statusFilter) return false;
    return true;
  });

  return (
    <ProtectedRoute>
      <NavBar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-navy">Reports</h1>
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
              className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm bg-white"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-muted" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 border border-border rounded-lg text-sm bg-white"
            >
              <option value="">All Types</option>
              {Object.entries(REPORT_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-border rounded-lg text-sm bg-white"
            >
              <option value="">All Statuses</option>
              <option value="complete">Complete</option>
              <option value="processing">Processing</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 text-sm">{error}</div>
        )}

        {/* Reports Grid */}
        {loading ? (
          <div className="flex items-center justify-center min-h-[30vh]">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-navy border-t-teal" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-border">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((r) => (
              <ReportCard key={r.id} report={r} />
            ))}
          </div>
        )}
      </main>
    </ProtectedRoute>
  );
}
