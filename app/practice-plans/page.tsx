"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, Zap, Clock, Users, Calendar, ClipboardList, ChevronDown, ChevronUp } from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import api from "@/lib/api";
import type { PracticePlan } from "@/types/api";
import { PRACTICE_PHASES, PRACTICE_FOCUS_LABELS, DRILL_AGE_LEVEL_LABELS } from "@/types/api";

const STATUS_COLORS: Record<string, { label: string; bg: string; text: string }> = {
  draft: { label: "Draft", bg: "bg-navy/[0.06]", text: "text-navy/60" },
  active: { label: "Active", bg: "bg-teal/10", text: "text-teal" },
  completed: { label: "Completed", bg: "bg-green-50", text: "text-green-700" },
};

export default function PracticePlansPage() {
  const [plans, setPlans] = useState<PracticePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const params = new URLSearchParams();
        if (search) params.set("search", search);
        if (statusFilter) params.set("status", statusFilter);
        params.set("limit", "200");
        const { data } = await api.get<PracticePlan[]>(`/practice-plans?${params}`);
        setPlans(data);
      } catch {
        // Non-critical
      } finally {
        setLoading(false);
      }
    }
    const timer = setTimeout(load, 300);
    return () => clearTimeout(timer);
  }, [search, statusFilter]);

  return (
    <ProtectedRoute>
      <NavBar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-navy">Practice Plans</h1>
            {!loading && (
              <p className="text-xs text-muted mt-0.5">
                {plans.length} plan{plans.length !== 1 ? "s" : ""}
              </p>
            )}
          </div>
          <Link
            href="/practice-plans/generate"
            className="flex items-center gap-2 px-4 py-2 bg-teal text-white text-sm font-oswald font-semibold uppercase tracking-wider rounded-lg hover:bg-teal/90 transition-colors"
          >
            <Zap size={16} />
            Generate Plan
          </Link>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder="Search plans..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm bg-white"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-border rounded-lg text-sm bg-white"
          >
            <option value="">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
          </select>
        </div>

        {/* Plans List */}
        {loading ? (
          <div className="flex items-center justify-center min-h-[30vh]">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-navy border-t-teal" />
          </div>
        ) : plans.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-border">
            <ClipboardList size={32} className="mx-auto text-muted/40 mb-3" />
            <p className="text-muted text-sm mb-4">
              {search || statusFilter ? "No plans match your filters." : "No practice plans yet."}
            </p>
            {!search && !statusFilter && (
              <Link
                href="/practice-plans/generate"
                className="inline-flex items-center gap-2 px-4 py-2 bg-teal text-white text-sm font-oswald font-semibold uppercase tracking-wider rounded-lg hover:bg-teal/90 transition-colors"
              >
                <Zap size={14} />
                Generate Your First Plan
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {plans.map((plan) => {
              const isExpanded = expandedId === plan.id;
              const sc = STATUS_COLORS[plan.status] || STATUS_COLORS.draft;
              const phaseCount = plan.plan_data?.phases?.length || 0;
              const drillCount = plan.plan_data?.phases?.reduce((sum, p) => sum + (p.drills?.length || 0), 0) || 0;

              return (
                <div
                  key={plan.id}
                  className="bg-white rounded-xl border border-border hover:border-teal/30 transition-colors overflow-hidden"
                >
                  {/* Plan Header */}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : plan.id)}
                    className="w-full text-left p-4 sm:p-5"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-sm font-bold text-navy truncate">{plan.title}</h3>
                          <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-oswald uppercase tracking-wider font-bold ${sc.bg} ${sc.text}`}>
                            {sc.label}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted">
                          {plan.team_name && (
                            <span className="flex items-center gap-1">
                              <Users size={11} />
                              {plan.team_name}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Clock size={11} />
                            {plan.duration_minutes} min
                          </span>
                          {plan.age_level && (
                            <span>{DRILL_AGE_LEVEL_LABELS[plan.age_level] || plan.age_level}</span>
                          )}
                          <span className="flex items-center gap-1">
                            <Calendar size={11} />
                            {new Date(plan.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-3">
                        {isExpanded ? <ChevronUp size={14} className="text-muted" /> : <ChevronDown size={14} className="text-muted" />}
                      </div>
                    </div>

                    {/* Focus area tags */}
                    {plan.focus_areas && plan.focus_areas.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {plan.focus_areas.map((fa) => (
                          <span
                            key={fa}
                            className="inline-flex px-2 py-0.5 rounded text-[10px] font-oswald uppercase tracking-wider bg-teal/10 text-teal font-bold"
                          >
                            {PRACTICE_FOCUS_LABELS[fa] || fa}
                          </span>
                        ))}
                      </div>
                    )}
                  </button>

                  {/* Expanded Preview */}
                  {isExpanded && (
                    <div className="border-t border-border/50 p-4 sm:p-5 bg-navy/[0.02]">
                      {/* Phase summary */}
                      {plan.plan_data?.phases && plan.plan_data.phases.length > 0 ? (
                        <div className="space-y-2 mb-4">
                          {plan.plan_data.phases.map((phase, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-xs">
                              <span className="font-oswald uppercase tracking-wider text-muted w-24 shrink-0">
                                {PRACTICE_PHASES[phase.phase] || phase.phase_label || phase.phase}
                              </span>
                              <span className="text-navy/60">{phase.duration_minutes} min</span>
                              <span className="text-muted/50">—</span>
                              <span className="text-navy/70 truncate">
                                {phase.drills?.map((d) => d.drill_name).join(", ")}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted mb-4">{phaseCount} phases, {drillCount} drills</p>
                      )}

                      {plan.plan_data?.coaching_summary && (
                        <p className="text-xs text-navy/60 leading-relaxed mb-4">{plan.plan_data.coaching_summary}</p>
                      )}

                      <Link
                        href={`/practice-plans/${plan.id}`}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-teal text-white text-xs font-oswald font-semibold uppercase tracking-wider rounded-lg hover:bg-teal/90 transition-colors"
                      >
                        View Full Plan
                      </Link>
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
