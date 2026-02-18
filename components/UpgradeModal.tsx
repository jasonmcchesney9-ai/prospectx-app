"use client";

import { X, ArrowUpCircle, MessageSquare, FileText } from "lucide-react";
import Link from "next/link";

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  limitType: "report" | "bench_talk";
  currentTier: string;
  used: number;
  limit: number;
}

const TIER_LABELS: Record<string, string> = {
  rookie: "Rookie",
  novice: "Novice",
  pro: "Pro",
  team: "Team",
  aaa_org: "AAA Org",
};

const LIMIT_COPY: Record<string, { title: string; icon: React.ElementType; unit: string }> = {
  report: {
    title: "Report Limit Reached",
    icon: FileText,
    unit: "reports",
  },
  bench_talk: {
    title: "Bench Talk Limit Reached",
    icon: MessageSquare,
    unit: "messages",
  },
};

export default function UpgradeModal({ isOpen, onClose, limitType, currentTier, used, limit }: UpgradeModalProps) {
  if (!isOpen) return null;

  const copy = LIMIT_COPY[limitType] || LIMIT_COPY.bench_talk;
  const Icon = copy.icon;
  const pct = limit > 0 ? Math.min((used / limit) * 100, 100) : 100;
  const tierLabel = TIER_LABELS[currentTier] || currentTier;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header accent bar */}
        <div className="h-1.5 bg-gradient-to-r from-orange via-teal to-navy" />

        <div className="p-6">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-muted hover:text-navy transition-colors"
          >
            <X size={18} />
          </button>

          {/* Icon + Title */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-orange/10 flex items-center justify-center">
              <Icon size={20} className="text-orange" />
            </div>
            <div>
              <h3 className="font-oswald text-lg font-bold text-navy">{copy.title}</h3>
              <p className="text-xs text-muted">
                {tierLabel} plan • {used}/{limit} {copy.unit} used
              </p>
            </div>
          </div>

          {/* Usage bar */}
          <div className="mb-5">
            <div className="h-3 bg-navy/5 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-orange to-red-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="flex justify-between mt-1.5 text-[11px] text-muted">
              <span>{used} used</span>
              <span>{limit} limit</span>
            </div>
          </div>

          {/* Message */}
          <p className="text-sm text-navy/70 mb-6">
            You&apos;ve used all your monthly {copy.unit} on the <strong>{tierLabel}</strong> plan.
            Upgrade to unlock more {copy.unit} and additional features.
          </p>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 px-4 rounded-lg border border-teal/20 text-navy/70 font-oswald font-bold uppercase tracking-wider text-sm hover:bg-navy/5 transition-colors"
            >
              Maybe Later
            </button>
            <Link
              href="/pricing"
              onClick={onClose}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-orange text-white font-oswald font-bold uppercase tracking-wider text-sm hover:bg-orange/90 transition-colors shadow-lg shadow-orange/20"
            >
              <ArrowUpCircle size={16} />
              View Plans
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
