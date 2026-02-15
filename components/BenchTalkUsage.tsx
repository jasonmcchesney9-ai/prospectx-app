"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MessageSquare, FileText, Loader2, Infinity } from "lucide-react";
import api from "@/lib/api";
import type { SubscriptionUsage } from "@/types/api";

interface BenchTalkUsageProps {
  className?: string;
  compact?: boolean;
}

function UsageBar({
  label,
  icon: Icon,
  used,
  limit,
  color,
}: {
  label: string;
  icon: React.ElementType;
  used: number;
  limit: number;
  color: string;
}) {
  const unlimited = limit === -1;
  const pct = unlimited ? 0 : limit > 0 ? Math.min((used / limit) * 100, 100) : 100;
  const barColor =
    unlimited
      ? "bg-teal"
      : pct >= 80
        ? "bg-red-500"
        : pct >= 50
          ? "bg-amber-500"
          : `bg-${color}`;
  const remaining = unlimited ? null : Math.max(limit - used, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <Icon size={13} className={`text-${color}`} />
          <span className="text-xs font-oswald uppercase tracking-wider text-navy/70">{label}</span>
        </div>
        {unlimited ? (
          <div className="flex items-center gap-1 text-teal">
            <Infinity size={14} />
            <span className="text-xs font-oswald font-bold">Unlimited</span>
          </div>
        ) : (
          <span className="text-xs font-oswald font-bold text-navy">
            {used}/{limit}
          </span>
        )}
      </div>

      {!unlimited && (
        <>
          <div className="h-2 bg-navy/5 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${barColor}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-muted">
              {remaining !== null && remaining > 0
                ? `${remaining} remaining`
                : remaining === 0
                  ? "Limit reached"
                  : ""}
            </span>
            {remaining === 0 && (
              <Link
                href="/pricing"
                className="text-[10px] font-bold text-orange hover:underline"
              >
                Upgrade →
              </Link>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function BenchTalkUsage({ className = "", compact = false }: BenchTalkUsageProps) {
  const [usage, setUsage] = useState<SubscriptionUsage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/subscription/usage")
      .then((res) => setUsage(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className={`flex items-center justify-center py-4 ${className}`}>
        <Loader2 size={16} className="animate-spin text-teal" />
      </div>
    );
  }

  if (!usage) return null;

  return (
    <div className={`space-y-4 ${className}`}>
      <UsageBar
        label="Reports"
        icon={FileText}
        used={usage.monthly_reports_used}
        limit={usage.monthly_reports_limit}
        color="teal"
      />
      <UsageBar
        label="Bench Talk"
        icon={MessageSquare}
        used={usage.monthly_bench_talks_used}
        limit={usage.monthly_bench_talks_limit}
        color="orange"
      />
      {!compact && usage.usage_reset_at && (
        <p className="text-[10px] text-muted text-center">
          Resets {new Date(usage.usage_reset_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </p>
      )}
    </div>
  );
}
