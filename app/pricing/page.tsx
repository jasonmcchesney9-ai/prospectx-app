"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Check,
  Crown,
  Zap,
  Users,
  Building2,
  Star,
  ArrowLeft,
  Loader2,
  MessageSquare,
  FileText,
  UserCheck,
} from "lucide-react";
import api from "@/lib/api";
import { getUser, setUser } from "@/lib/auth";
import type { SubscriptionTier, User } from "@/types/api";
import ProtectedRoute from "@/components/ProtectedRoute";
import NavBar from "@/components/NavBar";

const TIER_KEYS = ["rookie", "novice", "pro", "team", "aaa_org"] as const;

const TIER_META: Record<string, { icon: React.ElementType; color: string; borderColor: string; bgGradient: string; popular?: boolean }> = {
  rookie: {
    icon: Star,
    color: "text-gray-500",
    borderColor: "border-gray-200",
    bgGradient: "from-gray-50 to-white",
  },
  novice: {
    icon: Zap,
    color: "text-teal",
    borderColor: "border-teal/30",
    bgGradient: "from-teal/5 to-white",
  },
  pro: {
    icon: Crown,
    color: "text-orange",
    borderColor: "border-orange",
    bgGradient: "from-orange/5 to-white",
    popular: true,
  },
  team: {
    icon: Users,
    color: "text-navy",
    borderColor: "border-navy/30",
    bgGradient: "from-navy/5 to-white",
  },
  aaa_org: {
    icon: Building2,
    color: "text-violet-600",
    borderColor: "border-violet-300",
    bgGradient: "from-violet-50 to-white",
  },
};

function formatLimit(value: number): string {
  return value === -1 ? "Unlimited" : value.toString();
}

export default function PricingPage() {
  const [tiers, setTiers] = useState<Record<string, SubscriptionTier> | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const user = getUser();

  useEffect(() => {
    api.get("/subscription/tiers")
      .then((res) => setTiers(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleUpgrade = async (tierKey: string) => {
    if (upgrading) return;
    setUpgrading(tierKey);
    try {
      const res = await api.post("/subscription/upgrade", { tier: tierKey });
      // Update local user with new tier
      if (user) {
        const updated: User = { ...user, subscription_tier: tierKey };
        setUser(updated);
      }
      // Reload to reflect changes
      window.location.reload();
    } catch (err: any) {
      alert(err?.response?.data?.detail || "Failed to upgrade. Please try again.");
    } finally {
      setUpgrading(null);
    }
  };

  return (
    <ProtectedRoute>
      <NavBar />
      <div className="min-h-screen bg-gradient-to-b from-navy/[0.02] to-white">
        {/* Header */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-navy transition-colors mb-6"
          >
            <ArrowLeft size={14} />
            Back to Dashboard
          </Link>

          <div className="text-center mb-12">
            <h1 className="font-oswald text-3xl sm:text-4xl font-bold text-navy tracking-tight">
              Choose Your Plan
            </h1>
            <p className="mt-3 text-muted text-lg max-w-2xl mx-auto">
              Unlock the full power of ProspectX Intelligence. From solo scouts to AAA organizations.
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-teal" />
            </div>
          ) : !tiers ? (
            <div className="text-center py-20 text-muted">
              Failed to load pricing data. Please try again.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-6 max-w-7xl mx-auto pb-16">
              {TIER_KEYS.map((key) => {
                const tier = tiers[key];
                if (!tier) return null;
                const meta = TIER_META[key];
                const Icon = meta.icon;
                const isCurrent = user?.subscription_tier === key;
                const isDowngrade = false; // Placeholder: could compare tier indices

                return (
                  <div
                    key={key}
                    className={`relative flex flex-col rounded-2xl border-2 ${meta.borderColor} bg-gradient-to-b ${meta.bgGradient} p-6 shadow-sm hover:shadow-lg transition-shadow ${
                      meta.popular ? "ring-2 ring-orange/20" : ""
                    }`}
                  >
                    {meta.popular && (
                      <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                        <span className="bg-orange text-white text-[10px] font-oswald font-bold uppercase tracking-widest px-4 py-1 rounded-full shadow-sm">
                          Most Popular
                        </span>
                      </div>
                    )}

                    {/* Tier Header */}
                    <div className="text-center mb-5">
                      <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl ${meta.color} bg-white shadow-sm mb-3`}>
                        <Icon size={24} />
                      </div>
                      <h2 className="font-oswald text-xl font-bold text-navy">{tier.name}</h2>
                      <p className="text-xs text-muted mt-1">{tier.description}</p>
                    </div>

                    {/* Price */}
                    <div className="text-center mb-6">
                      {tier.price === 0 ? (
                        <div className="flex items-baseline justify-center gap-1">
                          <span className="font-oswald text-4xl font-bold text-navy">Free</span>
                        </div>
                      ) : (
                        <div className="flex items-baseline justify-center gap-1">
                          <span className="text-lg text-muted">$</span>
                          <span className="font-oswald text-4xl font-bold text-navy">
                            {tier.price % 1 === 0 ? tier.price : tier.price.toFixed(2)}
                          </span>
                          <span className="text-sm text-muted">/mo</span>
                        </div>
                      )}
                    </div>

                    {/* Key Limits */}
                    <div className="space-y-3 mb-6">
                      <div className="flex items-center gap-2.5 text-sm">
                        <FileText size={14} className="text-teal shrink-0" />
                        <span className="text-navy">
                          <strong className="font-oswald">{formatLimit(tier.monthly_reports)}</strong>{" "}
                          reports/mo
                        </span>
                      </div>
                      <div className="flex items-center gap-2.5 text-sm">
                        <MessageSquare size={14} className="text-orange shrink-0" />
                        <span className="text-navy">
                          <strong className="font-oswald">{formatLimit(tier.monthly_bench_talks)}</strong>{" "}
                          Bench Talk messages/mo
                        </span>
                      </div>
                      <div className="flex items-center gap-2.5 text-sm">
                        <UserCheck size={14} className="text-navy/60 shrink-0" />
                        <span className="text-navy">
                          <strong className="font-oswald">{tier.max_seats}</strong>{" "}
                          {tier.max_seats === 1 ? "seat" : "seats"}
                        </span>
                      </div>
                    </div>

                    {/* Features */}
                    <div className="flex-1 space-y-2 mb-6">
                      {tier.features.map((feature, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm">
                          <Check size={14} className="text-teal shrink-0 mt-0.5" />
                          <span className="text-navy/80">{feature}</span>
                        </div>
                      ))}
                    </div>

                    {/* CTA */}
                    {isCurrent ? (
                      <button
                        disabled
                        className="w-full py-2.5 px-4 rounded-lg bg-navy/5 text-navy/50 font-oswald font-bold uppercase tracking-wider text-sm cursor-not-allowed"
                      >
                        Current Plan
                      </button>
                    ) : key === "rookie" ? (
                      <div className="text-center text-xs text-muted py-2.5">
                        Free forever
                      </div>
                    ) : (
                      <button
                        onClick={() => handleUpgrade(key)}
                        disabled={!!upgrading}
                        className={`w-full py-2.5 px-4 rounded-lg font-oswald font-bold uppercase tracking-wider text-sm text-white transition-all ${
                          meta.popular
                            ? "bg-orange hover:bg-orange/90 shadow-lg shadow-orange/20"
                            : "bg-navy hover:bg-navy/90"
                        } disabled:opacity-50`}
                      >
                        {upgrading === key ? (
                          <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                        ) : (
                          `Upgrade to ${tier.name}`
                        )}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* FAQ / Notes */}
          <div className="max-w-3xl mx-auto pb-16 px-4">
            <div className="bg-navy/[0.03] border border-teal/20 rounded-xl p-6">
              <h3 className="font-oswald text-lg font-bold text-navy mb-3">How It Works</h3>
              <div className="space-y-2 text-sm text-navy/70">
                <p>• Usage limits reset on the 1st of each month.</p>
                <p>• <strong>Reports</strong> include all AI-generated scouting reports (Pro Skater, Unified Prospect, etc.).</p>
                <p>• <strong>Bench Talk messages</strong> count each question you send to the AI assistant.</p>
                <p>• <strong>Unlimited</strong> means no monthly cap — use as much as you need.</p>
                <p>• Upgrade or downgrade anytime. Changes take effect immediately.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
