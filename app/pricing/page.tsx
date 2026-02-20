"use client";

import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import Link from "next/link";
import {
  Check,
  X as XIcon,
  Crown,
  Zap,
  Users,
  Building2,
  Star,
  Heart,
  Search,
  Globe,
  Loader2,
  MessageSquare,
  FileText,
  UserCheck,
  Mail,
} from "lucide-react";
import api from "@/lib/api";
import { getUser, setUser } from "@/lib/auth";
import type { SubscriptionTier, User } from "@/types/api";
import MarketingLayout from "@/components/MarketingLayout";

const INDIVIDUAL_KEYS = ["rookie", "parent", "scout", "pro", "elite"] as const;
const ORG_KEYS = ["team_org", "program_org", "enterprise"] as const;

const TIER_META: Record<string, { icon: React.ElementType; color: string; borderColor: string; bgGradient: string; popular?: boolean }> = {
  rookie: { icon: Star, color: "text-gray-500", borderColor: "border-gray-200", bgGradient: "from-gray-50 to-white" },
  parent: { icon: Heart, color: "text-pink-500", borderColor: "border-pink-200", bgGradient: "from-pink-50 to-white" },
  scout: { icon: Search, color: "text-teal", borderColor: "border-teal/30", bgGradient: "from-teal/5 to-white" },
  pro: { icon: Crown, color: "text-orange", borderColor: "border-orange", bgGradient: "from-orange/5 to-white", popular: true },
  elite: { icon: Zap, color: "text-violet-600", borderColor: "border-violet-300", bgGradient: "from-violet-50 to-white" },
  team_org: { icon: Users, color: "text-navy", borderColor: "border-navy/30", bgGradient: "from-navy/5 to-white" },
  program_org: { icon: Building2, color: "text-teal", borderColor: "border-teal/30", bgGradient: "from-teal/5 to-white" },
  enterprise: { icon: Globe, color: "text-navy", borderColor: "border-navy/30", bgGradient: "from-navy/5 to-white" },
};

// ── Feature Comparison Matrix (Section 2 of spec) ──────────────────
type FeatureValue = boolean | string;
interface FeatureRow {
  label: string;
  values: Record<string, FeatureValue>;
}
interface FeatureCategory {
  name: string;
  features: FeatureRow[];
}

const FEATURE_MATRIX: FeatureCategory[] = [
  {
    name: "PLAYER & DATA ACCESS",
    features: [
      { label: "Browse player profiles", values: { rookie: true, parent: true, scout: true, pro: true, elite: true } },
      { label: "HockeyTech live stats", values: { rookie: true, parent: true, scout: true, pro: true, elite: true } },
      { label: "Elite Prospects link", values: { rookie: true, parent: true, scout: true, pro: true, elite: true } },
      { label: "Basic search (name, team)", values: { rookie: true, parent: true, scout: true, pro: true, elite: true } },
      { label: "Search with ratings/stats", values: { rookie: false, parent: false, scout: true, pro: true, elite: true } },
      { label: "Player search in nav bar", values: { rookie: false, parent: true, scout: true, pro: true, elite: true } },
      { label: "InStat game data", values: { rookie: false, parent: false, scout: false, pro: true, elite: true } },
    ],
  },
  {
    name: "SCOUTING",
    features: [
      { label: "View shared scout notes", values: { rookie: false, parent: "Filtered", scout: true, pro: true, elite: true } },
      { label: "Create scout notes", values: { rookie: false, parent: false, scout: true, pro: true, elite: true } },
      { label: "Quick Note (60-sec path)", values: { rookie: false, parent: false, scout: true, pro: true, elite: true } },
      { label: "Detailed Note (full ratings)", values: { rookie: false, parent: false, scout: false, pro: true, elite: true } },
      { label: "Prospect status tagging", values: { rookie: false, parent: false, scout: true, pro: true, elite: true } },
      { label: "Scouting list management", values: { rookie: false, parent: false, scout: true, pro: true, elite: true } },
      { label: "Aggregate scouting board", values: { rookie: false, parent: false, scout: false, pro: false, elite: true } },
    ],
  },
  {
    name: "REPORTS & AI",
    features: [
      { label: "AI reports (per month)", values: { rookie: false, parent: "3", scout: "10", pro: "Unlimited", elite: "Unlimited" } },
      { label: "Report templates", values: { rookie: false, parent: "Player Guide", scout: "Basic set", pro: "All 21", elite: "All 21" } },
      { label: "PXI AI assistant", values: { rookie: false, parent: false, scout: "Basic", pro: "Full (10 modes)", elite: "Full + Auto-Scout" } },
      { label: "Bulk report generation", values: { rookie: false, parent: false, scout: false, pro: false, elite: true } },
      { label: "Export / share reports", values: { rookie: false, parent: false, scout: false, pro: true, elite: true } },
    ],
  },
  {
    name: "COMMUNICATION",
    features: [
      { label: "Bench Talk messages/day", values: { rookie: "5", parent: "20", scout: "50", pro: "Unlimited", elite: "Unlimited" } },
      { label: "Messaging (direct)", values: { rookie: false, parent: true, scout: true, pro: true, elite: true } },
      { label: "Parental safety controls", values: { rookie: false, parent: true, scout: "N/A", pro: "N/A", elite: "N/A" } },
    ],
  },
  {
    name: "PARENT FEATURES",
    features: [
      { label: "Profile analytics (views)", values: { rookie: false, parent: true, scout: "N/A", pro: "N/A", elite: "N/A" } },
      { label: "Development tracking", values: { rookie: false, parent: true, scout: "N/A", pro: "N/A", elite: "N/A" } },
      { label: "Advisor directory", values: { rookie: false, parent: true, scout: false, pro: true, elite: true } },
      { label: "Add / claim your player", values: { rookie: false, parent: true, scout: "N/A", pro: "N/A", elite: "N/A" } },
    ],
  },
  {
    name: "COACHING TOOLS",
    features: [
      { label: "Game plans", values: { rookie: false, parent: false, scout: "3/mo", pro: "Unlimited", elite: "Unlimited" } },
      { label: "Practice plans & drills", values: { rookie: false, parent: false, scout: "3/mo", pro: "Unlimited", elite: "Unlimited" } },
      { label: "Systems library", values: { rookie: false, parent: false, scout: "View only", pro: "Full", elite: "Full" } },
      { label: "Line combos / builder", values: { rookie: false, parent: false, scout: false, pro: true, elite: true } },
      { label: "Series planning", values: { rookie: false, parent: false, scout: false, pro: true, elite: true } },
      { label: "Calendar / schedule", values: { rookie: false, parent: false, scout: true, pro: true, elite: true } },
      { label: "Multi-team views", values: { rookie: false, parent: false, scout: false, pro: true, elite: true } },
    ],
  },
  {
    name: "PLATFORM",
    features: [
      { label: "Role-based dashboard", values: { rookie: true, parent: true, scout: true, pro: true, elite: true } },
      { label: "API access", values: { rookie: false, parent: false, scout: false, pro: false, elite: true } },
      { label: "Priority support", values: { rookie: false, parent: false, scout: false, pro: false, elite: true } },
    ],
  },
];

function renderFeatureValue(val: FeatureValue) {
  if (val === true) return <Check size={16} className="text-teal mx-auto" />;
  if (val === false) return <XIcon size={14} className="text-navy/20 mx-auto" />;
  return <span className="text-xs text-navy/70 font-medium">{val}</span>;
}

function formatLimit(value: number): string {
  return value === -1 ? "Unlimited" : value.toString();
}

function formatBenchTalkDaily(monthly: number): string {
  if (monthly === -1) return "Unlimited";
  const daily = Math.round(monthly / 30);
  return `${daily}/day`;
}

function annualSavings(monthlyPrice: number, annualPrice: number): number {
  if (monthlyPrice <= 0 || annualPrice <= 0) return 0;
  return (monthlyPrice * 12) - annualPrice;
}

export default function PricingPage() {
  const [tiers, setTiers] = useState<Record<string, SubscriptionTier> | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const user = getUser();

  useEffect(() => {
    api.get("/subscription/tiers")
      .then((res) => setTiers(res.data.tiers || res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleUpgrade = async (tierKey: string) => {
    if (upgrading) return;
    setUpgrading(tierKey);
    try {
      await api.post("/subscription/upgrade", { tier: tierKey });
      if (user) {
        const updated: User = { ...user, subscription_tier: tierKey };
        setUser(updated);
      }
      window.location.reload();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      toast.error(error?.response?.data?.detail || "Failed to upgrade. Please try again.");
    } finally {
      setUpgrading(null);
    }
  };

  return (
    <MarketingLayout>
      <div className="min-h-screen bg-gradient-to-b from-navy/[0.02] to-white">
        {/* Header */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-4">

          <div className="text-center mb-12">
            {/* Season 1 Pricing badge */}
            <div className="flex justify-center mb-4">
              <span className="inline-flex items-center gap-1.5 bg-teal/10 text-teal text-xs font-oswald font-bold uppercase tracking-widest px-4 py-1.5 rounded-full border border-teal/20">
                Season 1 Pricing
              </span>
            </div>

            <h1 className="font-oswald text-3xl sm:text-4xl font-bold text-navy tracking-tight">
              Choose Your Plan
            </h1>
            <p className="mt-3 text-muted text-lg max-w-2xl mx-auto">
              Unlock the full power of ProspectX Intelligence. From hockey parents to elite organizations.
            </p>
            <p className="mt-2 text-sm text-teal font-medium">
              Annual plans save 2 months free
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
            <>
              {/* ── Individual Plans ─────────────────────────── */}
              <div className="mb-16">
                <h2 className="font-oswald text-xl font-bold text-navy text-center mb-8 uppercase tracking-wider">
                  Individual Plans
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-6 max-w-7xl mx-auto">
                  {INDIVIDUAL_KEYS.map((key) => {
                    const tier = tiers[key];
                    if (!tier) return null;
                    const meta = TIER_META[key];
                    const Icon = meta.icon;
                    const isCurrent = user?.subscription_tier === key;
                    const savings = annualSavings(tier.price, tier.annual_price);

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
                        <div className="text-center mb-4">
                          <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl ${meta.color} bg-white shadow-sm mb-3`}>
                            <Icon size={24} />
                          </div>
                          <h3 className="font-oswald text-xl font-bold text-navy">{tier.name}</h3>
                          {tier.target_user && (
                            <p className="text-[11px] text-muted mt-0.5">For {tier.target_user.toLowerCase()}</p>
                          )}
                        </div>

                        {/* Price */}
                        <div className="text-center mb-5">
                          {tier.price === 0 ? (
                            <div className="flex items-baseline justify-center gap-1">
                              <span className="font-oswald text-4xl font-bold text-navy">Free</span>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-baseline justify-center gap-1">
                                <span className="text-lg text-muted">$</span>
                                <span className="font-oswald text-4xl font-bold text-navy">
                                  {tier.price % 1 === 0 ? tier.price : tier.price.toFixed(2)}
                                </span>
                                <span className="text-sm text-muted">/mo</span>
                              </div>
                              {tier.annual_price > 0 && (
                                <p className="text-[11px] text-muted mt-1">
                                  or ${tier.annual_price}/yr{savings > 0 && ` — save $${savings}`}
                                </p>
                              )}
                            </>
                          )}
                        </div>

                        {/* Key Limits */}
                        <div className="space-y-2.5 mb-5">
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
                              <strong className="font-oswald">{formatBenchTalkDaily(tier.monthly_bench_talks)}</strong>{" "}
                              Bench Talk
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
                        ) : !user ? (
                          <Link
                            href={`/login?mode=register&tier=${key}`}
                            className={`w-full block text-center py-2.5 px-4 rounded-lg font-oswald font-bold uppercase tracking-wider text-sm text-white transition-all ${
                              meta.popular
                                ? "bg-orange hover:bg-orange/90 shadow-lg shadow-orange/20"
                                : "bg-navy hover:bg-navy/90"
                            }`}
                          >
                            {key === "rookie" ? "Sign Up Free" : "Get Started"}
                          </Link>
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
              </div>

              {/* ── Organization Plans ───────────────────────── */}
              <div className="mb-16">
                <h2 className="font-oswald text-xl font-bold text-navy text-center mb-3 uppercase tracking-wider">
                  Organization Plans
                </h2>
                <p className="text-center text-sm text-muted mb-8 max-w-xl mx-auto">
                  For teams, programs, and enterprises. Every seat gets Pro-level access with shared scouting data.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
                  {ORG_KEYS.map((key) => {
                    const tier = tiers[key];
                    if (!tier) return null;
                    const meta = TIER_META[key];
                    const Icon = meta.icon;
                    const isCurrent = user?.subscription_tier === key;
                    const foundersPrice = tier.founders_price;
                    const isEnterprise = key === "enterprise";

                    return (
                      <div
                        key={key}
                        className={`relative flex flex-col rounded-2xl border-2 ${meta.borderColor} bg-gradient-to-b ${meta.bgGradient} p-6 shadow-sm hover:shadow-lg transition-shadow`}
                      >
                        {/* Founders badge for Team/Program */}
                        {foundersPrice && foundersPrice > 0 && (
                          <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                            <span className="bg-teal text-white text-[10px] font-oswald font-bold uppercase tracking-widest px-3 py-1 rounded-full shadow-sm">
                              Season 1 Founders
                            </span>
                          </div>
                        )}

                        {/* Tier Header */}
                        <div className="text-center mb-4">
                          <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl ${meta.color} bg-white shadow-sm mb-3`}>
                            <Icon size={24} />
                          </div>
                          <h3 className="font-oswald text-xl font-bold text-navy">{tier.name}</h3>
                          {tier.target_user && (
                            <p className="text-[11px] text-muted mt-0.5">For {tier.target_user.toLowerCase()}</p>
                          )}
                        </div>

                        {/* Price */}
                        <div className="text-center mb-5">
                          {isEnterprise ? (
                            <div>
                              <span className="font-oswald text-3xl font-bold text-navy">Custom</span>
                              <p className="text-[11px] text-muted mt-1">Contact us for pricing</p>
                            </div>
                          ) : foundersPrice && foundersPrice > 0 ? (
                            <>
                              <div className="flex items-baseline justify-center gap-1">
                                <span className="text-lg text-muted">$</span>
                                <span className="font-oswald text-4xl font-bold text-navy">
                                  {foundersPrice % 1 === 0 ? foundersPrice : foundersPrice.toFixed(2)}
                                </span>
                                <span className="text-sm text-muted">/mo</span>
                              </div>
                              <p className="text-[11px] text-muted mt-1">
                                <span className="line-through">${tier.price}/mo</span>
                                {" "}Season 1 price
                              </p>
                            </>
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

                        {/* Seats */}
                        <div className="flex items-center justify-center gap-2 mb-5 text-sm">
                          <Users size={16} className="text-navy/60" />
                          <span className="text-navy font-semibold">
                            {tier.max_seats === -1 ? "Unlimited" : `Up to ${tier.max_seats}`} seats
                          </span>
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
                        ) : isEnterprise ? (
                          <Link
                            href="/contact"
                            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-navy text-white font-oswald font-bold uppercase tracking-wider text-sm hover:bg-navy/90 transition-all"
                          >
                            <Mail size={14} />
                            Contact Us
                          </Link>
                        ) : !user ? (
                          <Link
                            href={`/login?mode=register&tier=${key}`}
                            className="w-full block text-center py-2.5 px-4 rounded-lg bg-navy hover:bg-navy/90 font-oswald font-bold uppercase tracking-wider text-sm text-white transition-all"
                          >
                            Get Started
                          </Link>
                        ) : (
                          <button
                            onClick={() => handleUpgrade(key)}
                            disabled={!!upgrading}
                            className="w-full py-2.5 px-4 rounded-lg bg-navy hover:bg-navy/90 font-oswald font-bold uppercase tracking-wider text-sm text-white transition-all disabled:opacity-50"
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
              </div>

              {/* ── Feature Comparison Matrix ────────────────── */}
              <div className="max-w-7xl mx-auto mb-16">
                <h2 className="font-oswald text-2xl font-bold text-navy text-center mb-8 uppercase tracking-wider">
                  Feature Comparison
                </h2>
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full text-sm min-w-[700px]">
                    <thead>
                      <tr className="bg-navy/5">
                        <th className="text-left p-3 font-oswald font-bold text-navy text-xs uppercase tracking-wider w-[200px]">Feature</th>
                        {INDIVIDUAL_KEYS.map((key) => {
                          const tier = tiers[key];
                          const meta = TIER_META[key];
                          return (
                            <th key={key} className={`text-center p-3 font-oswald font-bold text-xs uppercase tracking-wider ${meta.popular ? "text-orange" : "text-navy"}`}>
                              {tier?.name || key}
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {FEATURE_MATRIX.map((category, ci) => (
                        <>
                          <tr key={`cat-${ci}`}>
                            <td colSpan={6} className="font-oswald font-bold text-navy text-xs uppercase tracking-wider bg-navy/[0.03] p-3 border-t border-border">
                              {category.name}
                            </td>
                          </tr>
                          {category.features.map((feature, fi) => (
                            <tr key={`${ci}-${fi}`} className="border-t border-navy/5 hover:bg-navy/[0.01]">
                              <td className="p-3 text-navy/80">{feature.label}</td>
                              {INDIVIDUAL_KEYS.map((key) => (
                                <td key={key} className="text-center p-3">
                                  {renderFeatureValue(feature.values[key])}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-center text-xs text-muted mt-3">
                  Organization plans (Team, Program, Enterprise) include all Pro features per seat.
                </p>
              </div>
            </>
          )}

          {/* FAQ / Notes */}
          <div className="max-w-3xl mx-auto pb-16 px-4">
            <div className="bg-navy/[0.03] border border-teal/20 rounded-xl p-6">
              <h3 className="font-oswald text-lg font-bold text-navy mb-3">How It Works</h3>
              <div className="space-y-2 text-sm text-navy/70">
                <p>&bull; <strong>Bench Talk</strong> limits are per day (resets at midnight UTC). Report limits reset on the 1st of each month.</p>
                <p>&bull; <strong>Reports</strong> include all AI-generated scouting reports (Pro Skater, Unified Prospect, Player Guide, etc.).</p>
                <p>&bull; <strong>Annual plans</strong> save 2 months free &mdash; pay for 10 months, get 12.</p>
                <p>&bull; <strong>Season 1 Pricing</strong> is our introductory rate for early adopters. Existing subscribers are honored indefinitely.</p>
                <p>&bull; <strong>Organization plans</strong> sell seats, not features. Every seat gets Pro-level access.</p>
                <p>&bull; Upgrade or downgrade anytime. Changes take effect immediately.</p>
              </div>
            </div>
          </div>

          {/* CTA Banner */}
          <div className="max-w-3xl mx-auto pb-16 px-4">
            <div className="bg-teal/10 border border-teal/20 rounded-2xl p-8 sm:p-12 text-center">
              <h2 className="font-oswald text-2xl sm:text-3xl font-bold text-navy">
                Start Free Today
              </h2>
              <p className="text-navy/60 text-sm mt-3 max-w-lg mx-auto">
                Create a free Rookie account. No credit card required. Upgrade anytime.
              </p>
              <Link
                href="/login?mode=register"
                className="inline-flex items-center gap-2 mt-6 px-8 py-3 bg-teal text-white font-oswald font-semibold uppercase tracking-wider rounded-lg hover:bg-teal/90 transition-colors text-sm"
              >
                Get Started Free
              </Link>
            </div>
          </div>
        </div>
      </div>
    </MarketingLayout>
  );
}
