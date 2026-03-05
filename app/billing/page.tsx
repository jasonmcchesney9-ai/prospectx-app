"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  CreditCard,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowUpCircle,
  ExternalLink,
  Users,
  Zap,
  Shield,
  Star,
  Building2,
} from "lucide-react";
import api from "@/lib/api";
import { extractApiError } from "@/lib/api";
import { getUser } from "@/lib/auth";
import ProtectedRoute from "@/components/ProtectedRoute";
import BenchTalkUsage from "@/components/BenchTalkUsage";

interface BillingStatus {
  tier: string;
  tier_name: string;
  subscription_status: string;
  has_stripe_customer: boolean;
  next_billing_date: string | null;
  subscription_started_at: string | null;
}

const PLAN_CARDS = [
  {
    tier: "parent",
    name: "Parent",
    price: "$9.99",
    period: "/mo",
    icon: Users,
    description: "Dev plans, recruiting reels, family guide",
    features: ["3 reports/month", "20 Bench Talk/day", "Profile analytics", "Development tracking"],
  },
  {
    tier: "scout",
    name: "Coach",
    price: "$24.99",
    period: "/mo",
    icon: Zap,
    description: "Unlimited reports, game plans, film room, practice plans",
    features: ["10 reports/month", "50 Bench Talk/day", "Scout Notes", "Game plans", "Practice plans"],
    popular: true,
  },
  {
    tier: "pro",
    name: "Pro",
    price: "$49.99",
    period: "/mo",
    icon: Star,
    description: "Everything + draft board, advanced analytics, leaderboards",
    features: ["Unlimited reports", "Unlimited Bench Talk", "Full PXI (10 modes)", "InStat data", "Export & share"],
  },
  {
    tier: "team_org",
    name: "Team",
    price: "$199",
    period: "/mo",
    seats: "5 seats",
    icon: Building2,
    description: "Full org hub, roster board, playbook, shared tools",
    features: ["All Pro features", "10 user seats", "Shared scout notes", "Team branding", "Org admin panel"],
  },
  {
    tier: "program_org",
    name: "Organization",
    price: "$399",
    period: "/mo",
    seats: "15 seats",
    icon: Shield,
    description: "Everything unlimited + priority support",
    features: ["Everything in Team", "30 user seats", "Cross-team boards", "Org-wide analytics", "Priority support"],
  },
];

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  active: { bg: "bg-green-100", text: "text-green-700", label: "Active" },
  trialing: { bg: "bg-blue-100", text: "text-blue-700", label: "Trial" },
  past_due: { bg: "bg-orange-100", text: "text-orange-700", label: "Past Due" },
  canceled: { bg: "bg-red-100", text: "text-red-700", label: "Canceled" },
  inactive: { bg: "bg-gray-100", text: "text-gray-500", label: "Inactive" },
};

function BillingContent() {
  const searchParams = useSearchParams();
  const isSuccess = searchParams.get("success") === "true";
  const isCanceled = searchParams.get("canceled") === "true";

  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState("");

  const user = getUser();

  const fetchBilling = useCallback(async () => {
    try {
      const { data } = await api.get("/billing/status");
      setBilling(data);
    } catch (err: unknown) {
      setError(extractApiError(err, "Failed to load billing info"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBilling();
  }, [fetchBilling]);

  const handleCheckout = async (tier: string) => {
    setCheckoutLoading(tier);
    setError("");
    try {
      const { data } = await api.post("/stripe/create-checkout", { tier });
      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      }
    } catch (err: unknown) {
      setError(extractApiError(err, "Failed to start checkout"));
    } finally {
      setCheckoutLoading(null);
    }
  };

  const handlePortal = async () => {
    setPortalLoading(true);
    setError("");
    try {
      const { data } = await api.post("/stripe/create-portal");
      if (data.portal_url) {
        window.location.href = data.portal_url;
      }
    } catch (err: unknown) {
      setError(extractApiError(err, "Failed to open billing portal"));
    } finally {
      setPortalLoading(false);
    }
  };

  const isPaid = billing && billing.tier !== "rookie" && billing.subscription_status === "active";
  const statusStyle = STATUS_STYLES[billing?.subscription_status || "inactive"] || STATUS_STYLES.inactive;

  return (
    <div className="min-h-screen bg-background">
      {/* Navy header */}
      <div className="bg-navy px-6 py-5">
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <CreditCard size={22} className="text-teal" />
          <div>
            <h1 className="font-oswald text-xl font-bold text-white tracking-wider uppercase">
              Billing & Subscription
            </h1>
            <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>Manage your subscription and view usage.</p>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Success / Canceled banners */}
        {isSuccess && (
          <div className="mb-6 flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-5 py-4">
            <CheckCircle2 size={20} className="text-green-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-green-800">Subscription activated!</p>
              <p className="text-xs text-green-600">Your plan is now active. Enjoy the full ProspectX experience.</p>
            </div>
          </div>
        )}
        {isCanceled && (
          <div className="mb-6 flex items-center gap-3 bg-orange-50 border border-orange-200 rounded-xl px-5 py-4">
            <XCircle size={20} className="text-orange-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-orange-800">Checkout canceled</p>
              <p className="text-xs text-orange-600">No charges were made. You can try again anytime.</p>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-6 flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-5 py-4">
            <AlertTriangle size={20} className="text-red-600 shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="text-center py-16 text-muted text-sm">Loading billing info...</div>
        ) : (
          <>
            {/* Current Plan Card */}
            <div className="bg-white rounded-xl border border-border p-6 mb-8">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <p className="text-xs font-oswald uppercase tracking-wider text-muted mb-1">Current Plan</p>
                  <h2 className="font-oswald text-2xl font-bold text-navy">
                    {billing?.tier_name || "Rookie"}
                  </h2>
                  <div className="flex items-center gap-3 mt-2">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${statusStyle.bg} ${statusStyle.text}`}>
                      {statusStyle.label}
                    </span>
                    {billing?.next_billing_date && (
                      <span className="text-xs text-muted">
                        Next billing: {new Date(billing.next_billing_date).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  {billing?.subscription_status === "past_due" && (
                    <p className="text-xs text-orange-600 mt-2 flex items-center gap-1">
                      <AlertTriangle size={12} />
                      Payment failed. Please update your payment method to avoid service interruption.
                    </p>
                  )}
                </div>
                <div className="flex gap-3">
                  {isPaid && (
                    <button
                      onClick={handlePortal}
                      disabled={portalLoading}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-teal/20 text-navy font-oswald font-semibold uppercase tracking-wider text-sm hover:bg-navy/5 transition-colors disabled:opacity-50"
                    >
                      <ExternalLink size={14} />
                      {portalLoading ? "Opening..." : "Manage Billing"}
                    </button>
                  )}
                  {user && (
                    <Link
                      href="/pricing"
                      className="text-xs text-teal hover:underline flex items-center gap-1 self-center"
                    >
                      View all plan details
                    </Link>
                  )}
                </div>
              </div>
            </div>

            {/* Monthly Usage */}
            <div className="bg-white rounded-xl border border-border p-6 mb-8">
              <h3 className="font-oswald text-sm font-bold text-navy uppercase tracking-wider mb-4">
                Monthly Usage
              </h3>
              <BenchTalkUsage />
            </div>

            {/* Plan Cards — show for free/inactive users */}
            {(!isPaid) && (
              <>
                <div className="mb-4">
                  <h3 className="font-oswald text-lg font-bold text-navy uppercase tracking-wider">
                    Upgrade Your Plan
                  </h3>
                  <p className="text-sm text-muted mt-1">
                    Choose a plan to unlock the full power of ProspectX Intelligence.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
                  {PLAN_CARDS.map((plan) => {
                    const Icon = plan.icon;
                    const isCurrentTier = billing?.tier === plan.tier;
                    return (
                      <div
                        key={plan.tier}
                        className={`bg-white rounded-xl border p-5 flex flex-col relative ${
                          plan.popular
                            ? "border-teal ring-2 ring-teal/20"
                            : "border-border"
                        }`}
                      >
                        {plan.popular && (
                          <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-teal text-white text-[10px] font-oswald font-bold uppercase tracking-wider px-3 py-0.5 rounded-full">
                            Most Popular
                          </div>
                        )}
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-8 h-8 rounded-lg bg-teal/10 flex items-center justify-center">
                            <Icon size={16} className="text-teal" />
                          </div>
                          <div>
                            <h4 className="font-oswald font-bold text-navy text-sm">{plan.name}</h4>
                            {plan.seats && (
                              <span className="text-[10px] text-muted">{plan.seats}</span>
                            )}
                          </div>
                        </div>
                        <div className="mb-3">
                          <span className="text-2xl font-oswald font-bold text-navy">{plan.price}</span>
                          <span className="text-xs text-muted">{plan.period}</span>
                        </div>
                        <p className="text-xs text-muted mb-4 leading-relaxed">{plan.description}</p>
                        <ul className="space-y-1.5 mb-5 flex-1">
                          {plan.features.map((f) => (
                            <li key={f} className="flex items-start gap-1.5 text-xs text-navy/70">
                              <CheckCircle2 size={12} className="text-teal shrink-0 mt-0.5" />
                              {f}
                            </li>
                          ))}
                        </ul>
                        <button
                          onClick={() => handleCheckout(plan.tier)}
                          disabled={!!checkoutLoading || isCurrentTier}
                          className={`w-full py-2 rounded-lg font-oswald font-semibold uppercase tracking-wider text-xs transition-colors disabled:opacity-50 ${
                            isCurrentTier
                              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                              : plan.popular
                                ? "bg-teal text-white hover:bg-teal/90"
                                : "bg-navy text-white hover:bg-navy/90"
                          }`}
                        >
                          {checkoutLoading === plan.tier
                            ? "Redirecting..."
                            : isCurrentTier
                              ? "Current Plan"
                              : "Select Plan"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* Already paid — manage billing CTA */}
            {isPaid && (
              <div className="bg-white rounded-xl border border-border p-6 text-center">
                <ArrowUpCircle size={28} className="text-teal mx-auto mb-3" />
                <h3 className="font-oswald text-lg font-bold text-navy mb-2">Need to change your plan?</h3>
                <p className="text-sm text-muted mb-4">
                  Manage your subscription, update payment methods, or cancel anytime through the Stripe billing portal.
                </p>
                <button
                  onClick={handlePortal}
                  disabled={portalLoading}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-teal text-white font-oswald font-semibold uppercase tracking-wider rounded-lg hover:bg-teal/90 disabled:opacity-50 transition-colors text-sm"
                >
                  <ExternalLink size={14} />
                  {portalLoading ? "Opening..." : "Open Billing Portal"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function BillingPage() {
  return (
    <ProtectedRoute>
      <Suspense
        fallback={
          <div className="min-h-screen bg-background flex items-center justify-center">
            <div className="text-muted text-sm">Loading...</div>
          </div>
        }
      >
        <BillingContent />
      </Suspense>
    </ProtectedRoute>
  );
}
