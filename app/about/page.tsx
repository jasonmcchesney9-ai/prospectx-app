"use client";

import Link from "next/link";
import {
  Shield,
  Brain,
  Target,
  Users,
  Heart,
  Crown,
  BarChart3,
  ArrowRight,
  Zap,
  Building2,
} from "lucide-react";
import MarketingLayout from "@/components/MarketingLayout";

const ROLES = [
  {
    icon: Target,
    label: "Scout",
    color: "bg-teal/10 text-teal",
    desc: "Standardized reports, player comparisons, prospect list management, evidence-based evaluations.",
  },
  {
    icon: Shield,
    label: "Coach",
    color: "bg-orange/10 text-orange",
    desc: "Game plans, deployment analysis, practice plans, systems library, line combinations.",
  },
  {
    icon: Crown,
    label: "GM",
    color: "bg-teal/10 text-teal",
    desc: "Roster construction, draft strategy, trade analysis, organizational scouting boards.",
  },
  {
    icon: Heart,
    label: "Parent",
    color: "bg-orange/10 text-orange",
    desc: "Development tracking, pathway guidance, exposure strategy, prep/college player guides.",
  },
  {
    icon: Users,
    label: "Agent",
    color: "bg-teal/10 text-teal",
    desc: "Client management, agent packs, player marketing materials, recruiting documents.",
  },
  {
    icon: BarChart3,
    label: "Broadcaster",
    color: "bg-orange/10 text-orange",
    desc: "Spotting boards, talk tracks, stat cards, interview questions, game prep.",
  },
];

const COMMITMENTS = [
  {
    icon: Shield,
    title: "Your Data is Yours",
    desc: "Your scouting data never trains AI models. Org-isolated. Encrypted. Export anytime — CSV, PDF, DOCX.",
  },
  {
    icon: Target,
    title: "Hockey-First",
    desc: "Every feature built by hockey people, for hockey people. No generic AI. No corporate buzzwords.",
  },
  {
    icon: Building2,
    title: "Built in the Open",
    desc: "Month-to-month pricing. No long-term contracts. We ship fast, listen to users, and publish our roadmap.",
  },
];

export default function AboutPage() {
  return (
    <MarketingLayout>
      {/* ── Section 1: Hero ───────────────────────────── */}
      <section className="text-center py-20 sm:py-28 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl sm:text-5xl font-oswald font-bold text-white leading-tight">
            Built for the People Who{" "}
            <span className="text-teal">Make Hockey Happen</span>
          </h1>
          <p className="text-lg text-white/50 mt-6 max-w-2xl mx-auto font-serif leading-relaxed">
            Spreadsheets and generic AI don&rsquo;t understand the difference
            between a 2-1-2 forecheck and a 1-3-1. We built ProspectX because
            hockey operations deserve purpose-built intelligence.
          </p>
        </div>
      </section>

      {/* ── Section 2: The Problem ────────────────────── */}
      <section className="bg-navy-light/30 border-y border-white/5">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-2xl font-oswald font-bold text-white mb-4">
                The Problem
              </h2>
              <p className="text-sm text-white/50 leading-relaxed">
                Hockey operations teams spend hours building reports in
                spreadsheets that tell you what happened — not what it means.
                Scouts email PDFs that live in inboxes. Parents guess at
                development timelines. Coaches build game plans in the Notes app.
                Generic AI chatbots produce fluffy paragraphs with no tactical
                context. Neither understands your system, your roster, or the
                difference between deployment and talent.
              </p>
            </div>
            <div className="space-y-6">
              {[
                { stat: "60s", label: "Professional-grade report. Not hours. Seconds." },
                { stat: "24+", label: "Report types from Pro Skater to Playoff Series." },
                { stat: "19+", label: "Tactical structures in the Hockey Operating System." },
              ].map((item) => (
                <div key={item.stat} className="flex items-baseline gap-4">
                  <span className="font-oswald text-4xl font-bold text-teal shrink-0">
                    {item.stat}
                  </span>
                  <p className="text-sm text-white/50">{item.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 3: What is PXI ────────────────────── */}
      <section className="py-20 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal/10 border border-teal/20 mb-4">
              <Brain size={12} className="text-teal" />
              <span className="text-xs font-oswald uppercase tracking-widest text-teal">
                Meet PXI
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-oswald font-bold text-white mt-2">
              Your AI Hockey Intelligence Partner
            </h2>
            <p className="text-white/50 text-sm mt-3 max-w-2xl mx-auto">
              PXI adapts to your role with 10 specialized reasoning modes —
              Scout, Coach, GM, Analyst, Parent, Agent, Skill Coach, Mental
              Coach, Broadcaster, and Producer. It speaks your language.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {[
              {
                icon: Brain,
                title: "Mode-Aware Intelligence",
                desc: "10 reasoning modes. PXI doesn't just answer — it thinks like a scout when you're scouting and a coach when you're coaching.",
              },
              {
                icon: Shield,
                title: "Hockey Operating System",
                desc: "19+ tactical structures. SYSTEM_FIT analysis in every report. Your forecheck, your power play, your identity — baked in.",
              },
              {
                icon: Zap,
                title: "Evidence Discipline",
                desc: "CONFIDENCE tags, INFERENCE labels, DATA NOT AVAILABLE markers. No hallucinations. No fluff. Decision-grade output.",
              },
            ].map((card) => (
              <div
                key={card.title}
                className="rounded-xl border border-white/10 bg-white/[0.02] p-6"
              >
                <div className="w-10 h-10 rounded-lg bg-teal/10 flex items-center justify-center mb-4">
                  <card.icon size={20} className="text-teal" />
                </div>
                <h3 className="font-oswald text-sm font-semibold text-white uppercase tracking-wider mb-2">
                  {card.title}
                </h3>
                <p className="text-xs text-white/50 leading-relaxed">
                  {card.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Section 4: Who It's For ───────────────────── */}
      <section className="bg-navy-light/30 border-y border-white/5">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16">
          <h2 className="text-2xl font-oswald font-bold text-white text-center mb-10">
            Who We Built This For
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {ROLES.map((role) => (
              <div
                key={role.label}
                className="rounded-xl border border-white/10 bg-white/[0.02] p-6 hover:bg-white/[0.04] transition-colors"
              >
                <div className={`w-10 h-10 rounded-lg ${role.color.split(" ")[0]} flex items-center justify-center mb-4`}>
                  <role.icon size={20} className={role.color.split(" ")[1]} />
                </div>
                <h3 className="font-oswald text-sm font-semibold text-white uppercase tracking-wider mb-2">
                  {role.label}
                </h3>
                <p className="text-xs text-white/50 leading-relaxed">
                  {role.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Section 5: Our Commitment ─────────────────── */}
      <section className="py-20 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-oswald font-bold text-white text-center mb-10">
            Our Commitment
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {COMMITMENTS.map((pillar) => (
              <div key={pillar.title} className="text-center">
                <div className="w-12 h-12 rounded-lg bg-teal/10 flex items-center justify-center mx-auto mb-4">
                  <pillar.icon size={24} className="text-teal" />
                </div>
                <h3 className="font-oswald text-sm font-semibold text-white uppercase tracking-wider mb-2">
                  {pillar.title}
                </h3>
                <p className="text-xs text-white/50 leading-relaxed">
                  {pillar.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Section 6: CTA ────────────────────────────── */}
      <section className="px-4 sm:px-6 pb-20">
        <div className="max-w-4xl mx-auto">
          <div className="bg-teal rounded-2xl p-8 sm:p-12 text-center">
            <h2 className="font-oswald text-2xl sm:text-3xl font-bold text-white">
              Ready to See Your Team Through a New Lens?
            </h2>
            <p className="text-white/80 text-sm mt-3 max-w-lg mx-auto">
              Join the scouts, coaches, and parents already on ProspectX.
              Start with a free Rookie account. No credit card required.
            </p>
            <Link
              href="/login?mode=register"
              className="inline-flex items-center gap-2 mt-6 px-8 py-3 bg-white text-teal font-oswald font-semibold uppercase tracking-wider rounded-lg hover:bg-white/90 transition-colors text-sm"
            >
              Get Started Free <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
