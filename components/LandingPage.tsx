"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Shield,
  Zap,
  BarChart3,
  Users,
  FileText,
  ChevronDown,
  ChevronUp,
  Target,
  Brain,
  ArrowRight,
  CheckCircle2,
  Star,
} from "lucide-react";

// ── FAQ Data ────────────────────────────────────
const FAQ_SECTIONS = [
  {
    title: "General",
    items: [
      {
        q: "What is ProspectX?",
        a: "ProspectX is the first hockey intelligence platform with a built-in Hockey Operating System. We analyze players within YOUR team's specific tactical structure \u2014 not just stats, but system-specific fit and deployment. We turn your stats into tactical decisions in under 60 seconds.",
      },
      {
        q: "How is ProspectX different from traditional analytics platforms?",
        a: "Traditional platforms track stats and video but produce generic reports with no tactical context. ProspectX understands 19+ professional hockey systems, analyzes players within YOUR forecheck, DZ, and OZ structures, evaluates system fit and role deployment, and generates 24+ different report types \u2014 including a fully customizable report builder.",
      },
      {
        q: "How is ProspectX different from ChatGPT or PowerPlay AI?",
        a: "ChatGPT is a general AI that doesn't understand hockey tactics. It can't evaluate F1 vs F2 roles or tell you what a 2-1-2 forecheck means for a player's deployment. ProspectX has a built-in Hockey Operating System with 19 professional tactical structures, team-specific system profiles, and SYSTEM_FIT analysis in every report.",
      },
      {
        q: "Who is ProspectX for?",
        a: "GMs & Hockey Ops for roster construction and draft strategy. Scouts for amateur/pro scouting and list building. Coaches for game plans, deployment, and practice planning. Player Development staff for improvement plans and progress tracking. Agents for player marketing and recruiting. We serve junior hockey (GOHL, OJHL, OHL, BCHL, USHL), AAA organizations, NCAA programs, and professional scouts.",
      },
    ],
  },
  {
    title: "Features",
    items: [
      {
        q: "What is the Hockey Operating System?",
        a: "The Hockey Operating System is ProspectX's core differentiator \u2014 a built-in tactical intelligence layer. It includes a Systems Library with 19+ tactical structures (forechecks, DZ, OZ, breakouts, PP, PK), team system profiles where you configure YOUR exact systems and style, a hockey glossary with 150+ standardized terms, and system-aware AI that references YOUR systems in every report with SYSTEM_FIT analysis.",
      },
      {
        q: "What is the SYSTEM_FIT section?",
        a: "SYSTEM_FIT is the signature feature in every ProspectX report. It analyzes how a player fits YOUR forecheck structure, their defensive zone role, offensive zone contributions, special teams deployment, team style alignment (pace, physicality, offensive style), compatibility rating, and tactical coaching recommendations. This level of depth doesn't exist anywhere else.",
      },
      {
        q: "What are the 19 report types?",
        a: "Scouting & GM: Pro/Amateur Skater, Unified Prospect, Goalie Report. Coaching: Game Decision, Season Intelligence, Elite Operations, Team Identity, Opponent Game Plan, Practice Plan Generator. Agency: Agent Pack, Player/Family Card. Analytics: Line Chemistry, Special Teams, Trade Target, Draft Comparative, Season Progress, Playoff Series Prep, Goalie Tandem, Development Roadmap.",
      },
      {
        q: "What data formats do you accept?",
        a: "We accept CSV files, Excel (.xlsx, .xls), XLSX analytics exports (InStat, internal systems, and more), and manual data entry. Required data: player name, position, and basic stats (GP, G, A, P, +/-, PIM). Optional data like advanced stats, microstats, and scout notes enhance report quality.",
      },
      {
        q: "Can I add scout notes?",
        a: "Yes! Add notes to any player, tag observations (Compete, Skating, Skill, Hockey IQ), link to specific games, and set notes as private or shared with your team. Scout notes automatically feed into AI report generation for richer, more contextual evaluations.",
      },
      {
        q: "How do Team Folders work?",
        a: "Every team gets its own folder page with four tabs: Roster (players grouped by Forwards, Defense, Goalies), Systems (your tactical profile for that team), Reports (all reports for team players in one view), and Stats. Coaches organize by team, not individual players \u2014 so ProspectX does too.",
      },
      {
        q: "Can I batch import players?",
        a: "Yes! Upload a CSV or Excel file with your full roster. ProspectX detects duplicates using fuzzy name matching, lets you review conflicts (skip, merge, or create new), and imports all players with stats in one step. Most teams are fully loaded in under 5 minutes.",
      },
    ],
  },
  {
    title: "Pricing",
    items: [
      {
        q: "How much does ProspectX cost?",
        a: "Founding Member pricing (first 10 customers, locked forever): GOHL $299/mo, OJHL $499/mo, OHL $999/mo. Standard pricing after that: GOHL $399/mo, OJHL $699/mo, OHL $1,499/mo. Annual discounts of 16-20% available. AAA organizations start at $599/mo, agents at $149/mo per player.",
      },
      {
        q: "Can I try ProspectX for free?",
        a: "Yes! We offer a 2-week free trial with full access to ALL features. Send us your roster Excel, we import all data within 24 hours, and you get unlimited report generation. No credit card required.",
      },
      {
        q: "What if I cancel?",
        a: "You own your data \u2014 always. Month-to-month contracts with no long-term commitment. We export everything as Excel/PDF. No penalties. Founding members keep their locked-in pricing forever, even if they cancel and come back.",
      },
    ],
  },
  {
    title: "Technical",
    items: [
      {
        q: "Is my data secure?",
        a: "Yes. All data encrypted at rest and in transit with HTTPS/TLS. Multi-tenant architecture isolates your data from other organizations. JWT authentication, user roles and permissions, daily automated backups, and GDPR compliance. You own your data \u2014 we never sell or share it.",
      },
      {
        q: "Can multiple users access ProspectX?",
        a: "Yes! GOHL tier includes 3 users, OJHL includes 5, OHL includes unlimited. User roles: Admin (full access), Coach (reports + notes), Scout (notes + view), and Read-Only (view reports only). All users share the player database, team systems, scout notes, and reports.",
      },
      {
        q: "Does ProspectX work on mobile?",
        a: "Currently available as a mobile-responsive web app that works great in any phone browser. Progressive Web App (PWA) with offline mode, camera access for lineup cards, and voice-to-text scout notes coming in Phase 2. Native iOS and Android apps planned for Phase 3.",
      },
      {
        q: "Can ProspectX integrate with our existing tools?",
        a: "Currently supports CSV/Excel import and XLSX analytics exports from InStat, internal systems, and other platforms. RinkNet API connector coming in 2-3 months. Sportlogiq, HockeyTech, and custom API integrations planned for 6-12 months. Enterprise tier includes dedicated integration support.",
      },
    ],
  },
  {
    title: "Getting Started",
    items: [
      {
        q: "How do I get started?",
        a: "Step 1: Book a 15-minute demo. Step 2: Start your free 2-week trial (send us your roster Excel and we import within 24 hours). Step 3: Hands-on 30-minute walkthrough. Step 4: Sign up if you love it \u2014 month-to-month, cancel anytime, founding member pricing locked forever.",
      },
      {
        q: "How long does setup take?",
        a: "For you: 5 minutes (send your Excel file). For us: import players (30 min), configure systems (15 min), generate sample reports (30 min). Total turnaround: ~24 hours. Then you're ready to use ProspectX immediately.",
      },
      {
        q: "Do you offer training?",
        a: "Yes, included with every plan! 30-minute onboarding walkthrough, email support, video tutorials, and knowledge base. OJHL+ tiers get phone support. OHL+ tiers get quarterly strategy reviews, advanced training, and a dedicated account manager.",
      },
    ],
  },
];

// ── Feature Cards ───────────────────────────────
const FEATURES = [
  {
    icon: Shield,
    title: "Hockey Operating System",
    desc: "19+ tactical structures. Your forecheck, DZ, OZ, PP, PK \u2014 all configured to YOUR system.",
    color: "text-teal",
    bg: "bg-teal/10",
  },
  {
    icon: Brain,
    title: "System-Aware AI",
    desc: "Every report references YOUR systems. SYSTEM_FIT analysis evaluates player-to-system compatibility.",
    color: "text-orange",
    bg: "bg-orange/10",
  },
  {
    icon: FileText,
    title: "19 Report Types",
    desc: "From Pro Skater to Playoff Series Prep. Draft comparatives, trade targets, practice plans, and more.",
    color: "text-teal",
    bg: "bg-teal/10",
  },
  {
    icon: Zap,
    title: "60-Second Intelligence",
    desc: "Generate professional-grade scouting reports in under a minute. Not hours. Not days. Seconds.",
    color: "text-orange",
    bg: "bg-orange/10",
  },
  {
    icon: Target,
    title: "SYSTEM_FIT Analysis",
    desc: "The money shot. Forecheck role, DZ responsibilities, OZ contributions, style alignment, and coaching recs.",
    color: "text-teal",
    bg: "bg-teal/10",
  },
  {
    icon: BarChart3,
    title: "ProspectX Metrics",
    desc: "Sniper, Playmaker, Transition, Defensive, Compete, Hockey IQ \u2014 6 proprietary performance metrics.",
    color: "text-orange",
    bg: "bg-orange/10",
  },
];

const USERS = [
  { icon: Users, label: "GMs & Hockey Ops", desc: "Roster construction, draft strategy, trade decisions" },
  { icon: Target, label: "Scouts", desc: "Standardized reports, player comparisons, list building" },
  { icon: Shield, label: "Coaches", desc: "Game plans, deployment, system fit, practice plans" },
  { icon: BarChart3, label: "Player Development", desc: "12-week roadmaps, progress tracking, skill priorities" },
  { icon: Star, label: "Agents & Advisors", desc: "Player marketing, recruiting docs, family cards" },
];

// ── FAQ Accordion ───────────────────────────────
function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-white/10 last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-4 text-left group"
      >
        <span className="text-sm font-medium text-white/90 group-hover:text-teal transition-colors pr-4">
          {q}
        </span>
        {open ? (
          <ChevronUp size={16} className="text-teal shrink-0" />
        ) : (
          <ChevronDown size={16} className="text-white/40 shrink-0" />
        )}
      </button>
      {open && (
        <div className="pb-4 text-sm text-white/60 leading-relaxed">
          {a}
        </div>
      )}
    </div>
  );
}

// ── Main Landing Page ───────────────────────────
export default function LandingPage() {
  const [activeFaqSection, setActiveFaqSection] = useState(0);

  return (
    <div className="min-h-screen bg-navy">
      {/* ── Top Nav ─────────────────────────────── */}
      <nav className="border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Logo — use image if available, fallback to text */}
            <div className="flex items-center gap-2">
              <span className="font-oswald text-2xl font-bold tracking-widest text-teal uppercase">
                Prospect<span className="text-orange">X</span>
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="#faq"
              className="hidden sm:inline text-sm text-white/50 hover:text-white transition-colors"
            >
              FAQ
            </a>
            <a
              href="#pricing"
              className="hidden sm:inline text-sm text-white/50 hover:text-white transition-colors"
            >
              Pricing
            </a>
            <Link
              href="/login"
              className="text-sm text-white/70 hover:text-white transition-colors px-3 py-1.5"
            >
              Sign In
            </Link>
            <Link
              href="/login"
              className="text-sm font-oswald font-semibold uppercase tracking-wider px-4 py-2 bg-teal text-white rounded-lg hover:bg-teal/90 transition-colors"
            >
              Start Free Trial
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-navy via-navy to-navy-light" />
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
          backgroundSize: "40px 40px",
        }} />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-28 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal/10 border border-teal/20 mb-6">
            <Shield size={12} className="text-teal" />
            <span className="text-xs font-oswald uppercase tracking-widest text-teal">
              Hockey Operating System
            </span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-oswald font-bold text-white leading-tight max-w-4xl mx-auto">
            Decision-Grade
            <br />
            <span className="text-teal">Hockey Intelligence</span>
          </h1>

          <p className="text-lg sm:text-xl text-white/60 mt-6 max-w-2xl mx-auto leading-relaxed font-serif">
            The first scouting platform that understands your team&apos;s tactical system.
            Analyze players within YOUR forecheck, YOUR structure, YOUR identity.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10">
            <Link
              href="/login"
              className="flex items-center gap-2 px-8 py-3 bg-teal text-white font-oswald font-semibold uppercase tracking-wider rounded-lg hover:bg-teal/90 transition-colors text-sm"
            >
              Start Free Trial <ArrowRight size={16} />
            </Link>
            <a
              href="mailto:jason@prospectx.ai?subject=ProspectX Demo Request"
              className="flex items-center gap-2 px-8 py-3 bg-white/5 border border-white/10 text-white/80 font-oswald font-semibold uppercase tracking-wider rounded-lg hover:bg-white/10 transition-colors text-sm"
            >
              Book a Demo
            </a>
          </div>

          <p className="text-xs text-white/30 mt-4">
            2-week free trial. No credit card required.
          </p>

          {/* Ice Stripe */}
          <div className="ice-stripe mt-16 rounded-full max-w-lg mx-auto" />
        </div>
      </section>

      {/* ── "Not Another Stats Platform" ────────── */}
      <section className="bg-navy-light/50 border-y border-white/5">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16 text-center">
          <h2 className="text-2xl sm:text-3xl font-oswald font-bold text-white mb-3">
            Not Another Stats Platform
          </h2>
          <p className="text-white/50 max-w-2xl mx-auto text-sm leading-relaxed">
            Other platforms give you numbers. AI chatbots give you generic paragraphs. ProspectX gives you
            <span className="text-teal font-semibold"> tactical intelligence </span>
            that speaks your language.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6 text-left">
              <div className="text-xs font-oswald uppercase tracking-widest text-white/30 mb-3">Traditional Stats</div>
              <p className="text-sm text-white/40 leading-relaxed">
                &ldquo;18G, 25A, 43P in 42 GP. Plus-12. 18.4% shooting.&rdquo;
              </p>
              <p className="text-xs text-white/20 mt-3">Numbers without context.</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6 text-left">
              <div className="text-xs font-oswald uppercase tracking-widest text-white/30 mb-3">Generic AI</div>
              <p className="text-sm text-white/40 leading-relaxed">
                &ldquo;The player demonstrates strong offensive capabilities and shows promise...&rdquo;
              </p>
              <p className="text-xs text-white/20 mt-3">Vague language anyone could write.</p>
            </div>
            <div className="rounded-xl border border-teal/30 bg-teal/[0.05] p-6 text-left ring-1 ring-teal/20">
              <div className="text-xs font-oswald uppercase tracking-widest text-teal mb-3">ProspectX</div>
              <p className="text-sm text-white/80 leading-relaxed">
                &ldquo;As F1 on the 2-1-2 forecheck, his 18.4% shooting and +12 make him a transition catalyst in your up-tempo system...&rdquo;
              </p>
              <p className="text-xs text-teal/70 mt-3">Tactical intelligence that speaks coach.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features Grid ───────────────────────── */}
      <section className="bg-navy">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-oswald font-bold text-white">
              Built for Hockey People
            </h2>
            <p className="text-white/40 text-sm mt-2">
              Every feature designed by scouts, for scouts.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-xl border border-white/10 bg-white/[0.02] p-6 hover:bg-white/[0.04] transition-colors"
              >
                <div className={`w-10 h-10 rounded-lg ${f.bg} flex items-center justify-center mb-4`}>
                  <f.icon size={20} className={f.color} />
                </div>
                <h3 className="font-oswald text-sm font-semibold text-white uppercase tracking-wider mb-2">
                  {f.title}
                </h3>
                <p className="text-sm text-white/50 leading-relaxed">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Who It's For ────────────────────────── */}
      <section className="bg-navy-light/30 border-y border-white/5">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16">
          <h2 className="text-2xl sm:text-3xl font-oswald font-bold text-white text-center mb-10">
            Who Uses ProspectX
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {USERS.map((u) => (
              <div key={u.label} className="text-center p-4">
                <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mx-auto mb-3">
                  <u.icon size={22} className="text-teal" />
                </div>
                <h3 className="font-oswald text-xs font-semibold text-white uppercase tracking-wider mb-1">
                  {u.label}
                </h3>
                <p className="text-xs text-white/40 leading-relaxed">
                  {u.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing Preview ─────────────────────── */}
      <section id="pricing" className="bg-navy">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-20">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange/10 border border-orange/20 mb-4">
              <Star size={12} className="text-orange" />
              <span className="text-xs font-oswald uppercase tracking-widest text-orange">
                Founding Member Pricing
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-oswald font-bold text-white">
              First 10 Customers Lock In Forever
            </h2>
            <p className="text-white/40 text-sm mt-2">
              Month-to-month. Cancel anytime. Your data is always yours.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* GOHL */}
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
              <div className="text-xs font-oswald uppercase tracking-widest text-white/40 mb-1">GOHL Tier</div>
              <div className="flex items-baseline gap-1 mb-4">
                <span className="text-3xl font-oswald font-bold text-white">$299</span>
                <span className="text-sm text-white/30">/month</span>
              </div>
              <div className="text-xs text-white/20 mb-4 line-through">Standard: $399/month</div>
              <ul className="space-y-2">
                {["Up to 50 players", "8 core report types", "Batch CSV/Excel import", "Scout notes", "3 admin users"].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-xs text-white/50">
                    <CheckCircle2 size={12} className="text-teal shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* OJHL — Featured */}
            <div className="rounded-xl border border-teal/30 bg-teal/[0.05] p-6 ring-1 ring-teal/20 relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-teal rounded-full text-[10px] font-oswald uppercase tracking-widest text-white font-bold">
                Most Popular
              </div>
              <div className="text-xs font-oswald uppercase tracking-widest text-teal mb-1">OJHL Tier</div>
              <div className="flex items-baseline gap-1 mb-4">
                <span className="text-3xl font-oswald font-bold text-white">$499</span>
                <span className="text-sm text-white/30">/month</span>
              </div>
              <div className="text-xs text-white/20 mb-4 line-through">Standard: $699/month</div>
              <ul className="space-y-2">
                {["Up to 100 players", "All 19 report types", "Hockey Operating System", "5 admin users", "Priority support", "API access"].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-xs text-white/60">
                    <CheckCircle2 size={12} className="text-teal shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* OHL */}
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
              <div className="text-xs font-oswald uppercase tracking-widest text-white/40 mb-1">OHL Tier</div>
              <div className="flex items-baseline gap-1 mb-4">
                <span className="text-3xl font-oswald font-bold text-white">$999</span>
                <span className="text-sm text-white/30">/month</span>
              </div>
              <div className="text-xs text-white/20 mb-4 line-through">Standard: $1,499/month</div>
              <ul className="space-y-2">
                {["Unlimited players & users", "White-label reports", "Dedicated account manager", "Custom integrations", "Phone + Slack support", "Quarterly strategy reviews"].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-xs text-white/50">
                    <CheckCircle2 size={12} className="text-teal shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <p className="text-center text-xs text-white/30 mt-6">
            All plans include 2-week free trial. No credit card required.
            Founding member pricing locked forever.
          </p>
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────── */}
      <section id="faq" className="bg-navy-light/30 border-y border-white/5">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-20">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-oswald font-bold text-white">
              Frequently Asked Questions
            </h2>
          </div>

          {/* FAQ Section Tabs */}
          <div className="flex flex-wrap justify-center gap-2 mb-8">
            {FAQ_SECTIONS.map((sec, i) => (
              <button
                key={sec.title}
                onClick={() => setActiveFaqSection(i)}
                className={`px-4 py-1.5 text-xs font-oswald uppercase tracking-wider rounded-full border transition-colors ${
                  activeFaqSection === i
                    ? "bg-teal/10 border-teal/30 text-teal"
                    : "border-white/10 text-white/40 hover:text-white/60 hover:border-white/20"
                }`}
              >
                {sec.title}
              </button>
            ))}
          </div>

          {/* FAQ Items */}
          <div className="bg-white/[0.02] rounded-xl border border-white/10 px-6">
            {FAQ_SECTIONS[activeFaqSection].items.map((item) => (
              <FAQItem key={item.q} q={item.q} a={item.a} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ───────────────────────────── */}
      <section className="bg-navy">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-20 text-center">
          <div className="ice-stripe mb-10 rounded-full max-w-xs mx-auto" />

          <h2 className="text-3xl sm:text-4xl font-oswald font-bold text-white mb-4">
            Ready to See Your Team<br />
            Through a <span className="text-teal">New Lens</span>?
          </h2>
          <p className="text-white/50 text-sm max-w-lg mx-auto mb-8">
            Send us your roster. We&apos;ll show you what ProspectX sees in 24 hours.
            No commitment. No credit card.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/login"
              className="flex items-center gap-2 px-8 py-3 bg-teal text-white font-oswald font-semibold uppercase tracking-wider rounded-lg hover:bg-teal/90 transition-colors text-sm"
            >
              Start Free Trial <ArrowRight size={16} />
            </Link>
            <a
              href="mailto:jason@prospectx.ai?subject=ProspectX Demo Request"
              className="text-sm text-white/50 hover:text-white transition-colors"
            >
              or email jason@prospectx.ai
            </a>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────── */}
      <footer className="border-t border-white/5 bg-navy">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-oswald text-sm font-bold tracking-widest text-teal uppercase">
              Prospect<span className="text-orange">X</span>
            </span>
            <span className="text-xs text-white/20">
              Decision-Grade Hockey Intelligence
            </span>
          </div>
          <div className="flex items-center gap-6 text-xs text-white/30">
            <a href="mailto:jason@prospectx.ai" className="hover:text-white/60 transition-colors">
              jason@prospectx.ai
            </a>
            <span>Built in Ontario, Canada</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
