"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MessageSquare, FileText, Loader2, Infinity, ClipboardList, Upload, Film } from "lucide-react";
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
                href="/billing"
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

  const u = usage.usage;

  return (
    <div className={`space-y-4 ${className}`}>
      <UsageBar
        label="Reports"
        icon={FileText}
        used={u?.reports?.used ?? usage.reports_used ?? 0}
        limit={u?.reports?.limit ?? usage.reports_limit ?? 0}
        color="teal"
      />
      <UsageBar
        label="Bench Talk"
        icon={MessageSquare}
        used={u?.bench_talks?.used ?? usage.bench_talks_used ?? 0}
        limit={u?.bench_talks?.limit ?? usage.bench_talks_limit ?? 0}
        color="orange"
      />
      {!compact && u?.practice_plans && (u.practice_plans.limit !== 0) && (
        <UsageBar
          label="Practice Plans"
          icon={ClipboardList}
          used={u.practice_plans.used}
          limit={u.practice_plans.limit}
          color="teal"
        />
      )}
      {!compact && u?.uploads && (u.uploads.limit !== 0) && (
        <UsageBar
          label="Uploads"
          icon={Upload}
          used={u.uploads.used}
          limit={u.uploads.limit}
          color="teal"
        />
      )}
      {!compact && u?.highlight_reels && (u.highlight_reels.limit !== 0) && (
        <UsageBar
          label="Highlight Reels"
          icon={Film}
          used={u.highlight_reels.used}
          limit={u.highlight_reels.limit}
          color="orange"
        />
      )}
      {!compact && usage.usage_reset_at && (
        <p className="text-[10px] text-muted text-center">
          Resets {new Date(usage.usage_reset_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </p>
      )}
    </div>
  );
}
