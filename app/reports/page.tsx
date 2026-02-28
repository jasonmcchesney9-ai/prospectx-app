"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, Zap, Filter, FileText, Wand2, FolderOpen, ChevronDown, ChevronRight, LayoutGrid, List, Clock } from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import ReportCard from "@/components/ReportCard";
import PXIBadge from "@/components/PXIBadge";
import api from "@/lib/api";
import { getUser } from "@/lib/auth";
import { useBenchTalk } from "@/components/BenchTalkProvider";
import type { Report } from "@/types/api";
import { REPORT_TYPE_LABELS, REPORT_CATEGORIES, REPORT_AUDIENCE_MAP, WIRED_REPORT_TYPES, PLAYER_REPORT_TYPES, TEAM_REPORT_TYPES } from "@/types/api";

export default function ReportsPage() {
  const currentUser = getUser();
  const { setActivePxiContext } = useBenchTalk();

  useEffect(() => {
    const u = getUser();
    setActivePxiContext({
      user: {
        id: u?.id || "",
        name: `${u?.first_name || ""} ${u?.last_name || ""}`.trim() || "User",
        role: (u?.hockey_role?.toUpperCase() || "SCOUT") as "COACH" | "PARENT" | "SCOUT" | "GM" | "AGENT" | "BROADCASTER" | "ANALYST",
        orgId: u?.org_id || "",
        orgName: "ProspectX",
      },
      page: { id: "REPORTS", route: "/reports" },
    });
    return () => { setActivePxiContext(null); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [view, setView] = useState<"my_reports" | "catalog">("my_reports");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [catalogSearch, setCatalogSearch] = useState("");

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
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <PXIBadge size={32} variant="dark" showDot={false} />
            <div>
              <h1 className="text-2xl font-bold text-navy">Reports</h1>
              <p className="text-muted text-sm mt-1">
                39 AI-generated report types. Scouting reports, game plans, player comparisons, draft profiles — on demand.
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

        {/* View Toggle Tabs */}
        <div className="flex items-center gap-1 mb-6 border-b border-border">
          <button
            onClick={() => setView("my_reports")}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-oswald font-semibold uppercase tracking-wider border-b-2 transition-colors ${
              view === "my_reports"
                ? "border-teal text-navy"
                : "border-transparent text-muted hover:text-navy"
            }`}
          >
            <List size={16} />
            My Reports
            {reports.length > 0 && (
              <span className="text-xs bg-navy/[0.06] px-1.5 py-0.5 rounded-full">{reports.length}</span>
            )}
          </button>
          <button
            onClick={() => setView("catalog")}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-oswald font-semibold uppercase tracking-wider border-b-2 transition-colors ${
              view === "catalog"
                ? "border-teal text-navy"
                : "border-transparent text-muted hover:text-navy"
            }`}
          >
            <LayoutGrid size={16} />
            Reports Catalog
          </button>
        </div>

        {/* ── My Reports View ─────────────────────────────── */}
        {view === "my_reports" && (
          <>
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
                    ? "No reports generated yet. Choose a report type, pick a player or team, and let PXI do the work."
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
          </>
        )}

        {/* ── Reports Catalog View ─────────────────────────── */}
        {view === "catalog" && (
          <>
            {/* Catalog Filters */}
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="text"
                  placeholder="Search report types..."
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-teal/20 rounded-lg text-sm bg-white"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter size={14} className="text-muted" />
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="px-3 py-2 border border-teal/20 rounded-lg text-sm bg-white"
                >
                  <option value="all">All Roles</option>
                  <option value="scout">Scout</option>
                  <option value="coach">Coach</option>
                  <option value="gm">GM / Hockey Ops</option>
                  <option value="agent">Agent</option>
                  <option value="parent">Player / Family</option>
                </select>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="px-3 py-2 border border-teal/20 rounded-lg text-sm bg-white"
                >
                  <option value="all">All Categories</option>
                  {REPORT_CATEGORIES.map((cat) => (
                    <option key={cat.key} value={cat.key}>{cat.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Catalog Grid by Category */}
            <div className="space-y-6">
              {REPORT_CATEGORIES.filter((cat) => categoryFilter === "all" || cat.key === categoryFilter).map((cat) => {
                // Filter types within this category
                const catTypes = cat.types.filter((t) => {
                  // Role filter
                  if (roleFilter !== "all") {
                    const audiences = REPORT_AUDIENCE_MAP[t] || [];
                    if (!audiences.includes(roleFilter)) return false;
                  }
                  // Search filter
                  if (catalogSearch) {
                    const q = catalogSearch.toLowerCase();
                    const label = (REPORT_TYPE_LABELS[t] || t).toLowerCase();
                    if (!label.includes(q) && !t.includes(q)) return false;
                  }
                  return true;
                });

                if (catTypes.length === 0) return null;

                return (
                  <div key={cat.key}>
                    {/* Category Header */}
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-1 h-6 rounded-full ${cat.accent === "teal" ? "bg-teal" : "bg-orange"}`} />
                      <h2 className="text-lg font-oswald font-bold uppercase tracking-wider text-navy">{cat.label}</h2>
                      <span className="text-xs text-muted">{cat.description}</span>
                    </div>

                    {/* Report Type Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {catTypes.map((type) => {
                        const label = REPORT_TYPE_LABELS[type] || type;
                        const isWired = WIRED_REPORT_TYPES.has(type);
                        const isPlayer = (PLAYER_REPORT_TYPES as readonly string[]).includes(type);
                        const audiences = REPORT_AUDIENCE_MAP[type] || [];

                        return (
                          <div
                            key={type}
                            className={`bg-white rounded-xl border border-teal/20 p-4 flex flex-col gap-2 ${
                              !isWired ? "opacity-70" : ""
                            }`}
                          >
                            {/* Type header with badges */}
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <FileText size={16} className={`shrink-0 ${cat.accent === "teal" ? "text-teal" : "text-orange"}`} />
                                <h3 className="text-sm font-oswald font-bold uppercase tracking-wider text-navy truncate">
                                  {label}
                                </h3>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {!isWired && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                                    <Clock size={10} />
                                    Coming Soon
                                  </span>
                                )}
                                <span className={`text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                  isPlayer ? "bg-teal/10 text-teal" : "bg-orange/10 text-orange"
                                }`}>
                                  {isPlayer ? "Player" : "Team"}
                                </span>
                              </div>
                            </div>

                            {/* Audience tags */}
                            <div className="flex items-center gap-1 flex-wrap">
                              {audiences.map((a) => (
                                <span key={a} className="text-[10px] text-muted bg-navy/[0.04] px-1.5 py-0.5 rounded capitalize">
                                  {a}
                                </span>
                              ))}
                            </div>

                            {/* Generate button */}
                            <div className="mt-auto pt-2">
                              {isWired ? (
                                <Link
                                  href={`/reports/generate?type=${type}`}
                                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-oswald font-semibold uppercase tracking-wider rounded-lg transition-colors ${
                                    cat.accent === "teal"
                                      ? "bg-teal text-white hover:bg-teal/90"
                                      : "bg-orange text-white hover:bg-orange/90"
                                  }`}
                                >
                                  <Zap size={12} />
                                  Generate
                                </Link>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-oswald font-semibold uppercase tracking-wider rounded-lg bg-gray-100 text-gray-400 cursor-not-allowed">
                                  <Clock size={12} />
                                  Coming Soon
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </main>
    </ProtectedRoute>
  );
}
