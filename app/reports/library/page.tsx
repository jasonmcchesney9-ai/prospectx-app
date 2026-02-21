"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  Users,
  Building2,
  Zap,
} from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import api from "@/lib/api";
import type { ReportTemplate } from "@/types/api";
import {
  REPORT_TYPE_LABELS,
  REPORT_CATEGORIES,
  PLAYER_REPORT_TYPES,
  TEAM_REPORT_TYPES,
} from "@/types/api";

const PLAYER_SET = new Set<string>(PLAYER_REPORT_TYPES);
const TEAM_SET = new Set<string>(TEAM_REPORT_TYPES);

export default function ReportLibraryPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<ReportTemplate[]>("/templates")
      .then((res) => setTemplates(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Build a set of available report_types from the templates endpoint
  const availableTypes = new Set(templates.map((t) => t.report_type));

  // Build a lookup: report_type → template description
  const descriptionMap: Record<string, string> = {};
  for (const t of templates) {
    descriptionMap[t.report_type] = t.description;
  }

  return (
    <ProtectedRoute>
      <NavBar />
      <main className="min-h-screen bg-background">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <Link
                href="/reports"
                className="p-2 rounded-lg hover:bg-white border border-border transition-colors"
              >
                <ArrowLeft size={18} className="text-navy" />
              </Link>
              <div>
                <h1 className="font-oswald text-2xl font-bold text-navy uppercase tracking-wider">
                  Report Library
                </h1>
                <p className="text-sm text-muted mt-1">
                  Browse all report types by category. Click any report to start generating.
                </p>
              </div>
            </div>
            <Link
              href="/reports/generate"
              className="flex items-center gap-2 px-4 py-2 bg-teal text-white rounded-lg text-sm font-semibold hover:bg-teal/90 transition-colors"
            >
              <Zap size={16} />
              Generate Report
            </Link>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 size={32} className="animate-spin text-teal" />
            </div>
          ) : (
            <div className="space-y-10">
              {REPORT_CATEGORIES.map((category) => {
                const categoryTypes = category.types.filter(
                  (t) => availableTypes.has(t)
                );
                if (categoryTypes.length === 0) return null;

                const accentBorder =
                  category.accent === "teal"
                    ? "border-l-teal"
                    : "border-l-orange";
                const accentBg =
                  category.accent === "teal"
                    ? "bg-teal/10 text-teal"
                    : "bg-orange/10 text-orange";

                return (
                  <section key={category.key}>
                    <div className="mb-4">
                      <h2 className="font-oswald text-lg font-bold text-navy uppercase tracking-wider">
                        {category.label}
                      </h2>
                      <p className="text-sm text-muted mt-0.5">
                        {category.description}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {categoryTypes.map((reportType) => {
                        const label =
                          REPORT_TYPE_LABELS[reportType] || reportType;
                        const description =
                          descriptionMap[reportType] || "";
                        const isPlayer = PLAYER_SET.has(reportType);
                        const isTeam = TEAM_SET.has(reportType);

                        return (
                          <button
                            key={reportType}
                            onClick={() =>
                              router.push(
                                `/reports/generate?type=${reportType}`
                              )
                            }
                            className={`text-left bg-white rounded-xl border border-border border-l-4 ${accentBorder} p-5 hover:shadow-md hover:border-l-4 transition-all group cursor-pointer`}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <h3 className="font-oswald text-base font-bold text-navy uppercase tracking-wide group-hover:text-teal transition-colors">
                                {label}
                              </h3>
                              <span
                                className={`shrink-0 ml-2 flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${accentBg}`}
                              >
                                {isTeam ? (
                                  <>
                                    <Building2 size={10} /> Team
                                  </>
                                ) : (
                                  <>
                                    <Users size={10} /> Player
                                  </>
                                )}
                              </span>
                            </div>
                            {description && (
                              <p className="text-sm text-muted leading-relaxed line-clamp-3">
                                {description}
                              </p>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </ProtectedRoute>
  );
}
