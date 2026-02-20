"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, Search } from "lucide-react";
import MarketingLayout from "@/components/MarketingLayout";

/* ── FAQ Data ──────────────────────────────────────── */

interface FAQItem {
  q: string;
  a: string;
}

interface FAQCategory {
  title: string;
  items: FAQItem[];
}

const FAQ_DATA: FAQCategory[] = [
  {
    title: "Getting Started",
    items: [
      {
        q: "What is ProspectX?",
        a: "ProspectX is a decision-grade hockey intelligence platform. It serves 10 roles — scouts, coaches, GMs, parents, agents, analysts, skill coaches, mental coaches, broadcasters, and producers — with AI-powered scouting reports, game plans, practice plans, and a role-aware AI assistant called PXI.",
      },
      {
        q: "Is there a free tier?",
        a: "Yes. The Rookie tier is free forever — browse player profiles, view live stats, use basic search, and get 5 Bench Talk (PXI) messages per day. No credit card required.",
      },
      {
        q: "Do I need a separate account for live stats?",
        a: "No. ProspectX integrates with supported leagues (OHL, GOJHL, OJHL, WHL, QMJHL, PWHL) directly. You can also import player data via CSV or Excel for any league.",
      },
      {
        q: "What leagues does ProspectX support?",
        a: "Any supported league gets live roster sync, stat sync, game logs, standings, and scorebar data. For other leagues, you can import rosters and stats via CSV/Excel upload.",
      },
    ],
  },
  {
    title: "Pricing & Billing",
    items: [
      {
        q: "What plans are available?",
        a: "ProspectX offers 5 individual tiers (Rookie free, Parent $10/mo, Scout $25/mo, Pro $49/mo, Elite $99/mo) and 3 organization tiers (Team $249/mo, Program $599/mo, Enterprise custom). See the full comparison on our pricing page.",
      },
      {
        q: "Can I upgrade or downgrade anytime?",
        a: "Yes. Upgrades take effect immediately — you get instant access to all new features. Downgrades take effect at the end of your current billing cycle. No penalties either way.",
      },
      {
        q: "Is my data safe if I cancel?",
        a: "Absolutely. Your data is always yours. Export everything as CSV or PDF at any time. After cancellation, your data is retained for 30 days before being removed. You can reactivate your account within that window.",
      },
      {
        q: "Do you offer annual billing?",
        a: "Yes. Annual billing saves approximately 17% — you pay for 10 months and get 12. You can switch between monthly and annual at any time from your account settings.",
      },
      {
        q: "Is there a free trial for paid tiers?",
        a: "The Rookie tier is free forever and covers the core browsing experience. This lets you explore the platform before upgrading. For organizations considering Team or Program plans, we offer guided demos — contact us to set one up.",
      },
    ],
  },
  {
    title: "PXI — AI Assistant",
    items: [
      {
        q: "What is PXI?",
        a: "PXI (ProspectX Intelligence) is an AI-powered hockey assistant with 10 specialized reasoning modes — Scout, GM, Coach, Analyst, Parent, Agent, Skill Coach, Mental Coach, Broadcaster, and Producer. It adapts its language, depth, and focus based on your role.",
      },
      {
        q: "How many Bench Talk conversations can I have?",
        a: "It depends on your tier: Rookie gets 5 messages/day, Parent gets 20/day, Scout gets 50/day, and Pro tier and above get unlimited Bench Talk access.",
      },
      {
        q: "How is PXI different from ChatGPT?",
        a: "ChatGPT is general-purpose AI. PXI is built specifically for hockey — it understands tactical systems (1-3-1 trap, 2-1-2 forecheck), player deployment, scouting terminology, and development pathways. Every answer includes confidence tags and evidence markers.",
      },
      {
        q: "Does PXI use my data to train AI models?",
        a: "Never. Your scouting data, notes, and reports are org-isolated and never used to train AI models. PXI uses the Anthropic Claude API with strict data handling policies.",
      },
      {
        q: "What report types are available?",
        a: "ProspectX offers 24+ report types including Pro Skater Evaluation, Unified Prospect Report, Goalie Analysis, Game Decision Brief, Trade Target Analysis, Draft Comparative, Agent Pack, Development Roadmap, Player Guide (Prep/College), Pre-Game Intel Brief, and more.",
      },
      {
        q: "What is Bench Talk?",
        a: "Bench Talk is your private AI coaching conversation with PXI. Open it from the nav bar at any time. Ask about players, get game plans, understand stats, or get development guidance — PXI responds in the language of your role. Scouts get scouting answers. Parents get plain-language answers. Coaches get tactical answers.",
      },
      {
        q: "Can PXI generate custom reports for me?",
        a: "Yes. On Scout tier and above, you can ask PXI to generate a custom scouting report, development assessment, game preparation pack, or parent summary. These are AI-generated analyses tailored to your specific question — not pre-built templates. Available 10 times/month on Scout, unlimited on Pro and above.",
      },
    ],
  },
  {
    title: "Data & Privacy",
    items: [
      {
        q: "Who can see my scouting notes?",
        a: "Only you, by default. Notes are private to your account. Organization-shared notes are visible to members of your organization only. You control visibility on every note.",
      },
      {
        q: "Does ProspectX sell my data?",
        a: "Never. We do not sell, share, or monetize your data in any way. Your scouting intelligence is yours alone.",
      },
      {
        q: "Can I export my data?",
        a: "Yes. CSV and PDF exports are available on all paid tiers. Reports can be exported as DOCX (Word) documents and shared via email with auto-generated share tokens.",
      },
      {
        q: "Where is my data stored?",
        a: "ProspectX runs on Railway cloud infrastructure with regular automated backups every 6 hours. Database backups are retained with 20-backup rotation for disaster recovery.",
      },
    ],
  },
  {
    title: "For Parents",
    items: [
      {
        q: "Do I need to be a hockey expert to use ProspectX?",
        a: "Not at all. PXI has a dedicated Parent mode that explains everything in plain language — no jargon, no assumptions. Development reports are written for families, not scouts.",
      },
      {
        q: "Can I track my child's development over time?",
        a: "Yes. The Parent tier includes development tracking with progression charts, season-over-season comparisons, and game-by-game logs. The Player Guide report provides pathway guidance for prep school and college hockey.",
      },
      {
        q: "How does ProspectX get my child's data?",
        a: "Player data comes from Live Stats & Data league sync (automatic for supported leagues) or manual entry via CSV/Excel upload. You can also create a player profile and add stats manually.",
      },
      {
        q: "Is messaging with scouts safe?",
        a: "Yes. ProspectX includes parental approval systems, 30-day cooldown periods, and age-gated controls. No contact happens without explicit parental consent.",
      },
    ],
  },
  {
    title: "For Organizations",
    items: [
      {
        q: "What's included in Team and Program tiers?",
        a: "Organization plans sell seats, not features. Every seat gets Pro-level access. Team ($249/mo) includes 10 seats with shared scouting data, team dashboard, and org admin panel. Program ($599/mo) includes 30 seats with cross-team scouting boards, org-wide analytics, and multi-team management.",
      },
      {
        q: "Can we do a demo before buying?",
        a: "Absolutely. Contact us and we'll set up a guided walkthrough of ProspectX tailored to your organization's needs. We can import your roster data and show you real reports on your players.",
      },
      {
        q: "Is Enterprise pricing available?",
        a: "Yes. Enterprise plans include unlimited seats, custom branding, dedicated onboarding, white-glove setup, SLA support, and API access. Contact us for a custom quote.",
      },
    ],
  },
];

/* ── Accordion Item ────────────────────────────────── */

function AccordionItem({
  item,
  isOpen,
  onToggle,
}: {
  item: FAQItem;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={`rounded-xl border transition-colors ${
        isOpen
          ? "border-teal/30 bg-white/[0.03]"
          : "border-white/10 bg-white/[0.02]"
      }`}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-5 text-left min-h-[44px]"
      >
        <span className="text-sm font-medium text-white/90 pr-4">{item.q}</span>
        {isOpen ? (
          <ChevronUp size={16} className="text-teal shrink-0" />
        ) : (
          <ChevronDown size={16} className="text-white/40 shrink-0" />
        )}
      </button>
      {isOpen && (
        <div className="px-5 pb-5 text-sm text-white/60 leading-relaxed">
          {item.a}
        </div>
      )}
    </div>
  );
}

/* ── Page ──────────────────────────────────────────── */

export default function FAQPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState(0);
  const [openIndex, setOpenIndex] = useState(-1);

  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return FAQ_DATA;
    const lower = searchQuery.toLowerCase();
    return FAQ_DATA.map((cat) => ({
      ...cat,
      items: cat.items.filter(
        (item) =>
          item.q.toLowerCase().includes(lower) ||
          item.a.toLowerCase().includes(lower)
      ),
    })).filter((cat) => cat.items.length > 0);
  }, [searchQuery]);

  // Reset active category when search changes and current category has no results
  const safeActiveCategory = activeCategory < filteredCategories.length ? activeCategory : 0;
  const activeItems = filteredCategories[safeActiveCategory]?.items || [];

  return (
    <MarketingLayout>
      {/* ── Hero ──────────────────────────────────────── */}
      <section className="text-center py-16 sm:py-20 px-4 sm:px-6">
        <h1 className="text-3xl sm:text-4xl font-oswald font-bold text-white">
          Frequently Asked Questions
        </h1>
        <p className="text-white/50 text-sm mt-3 max-w-lg mx-auto">
          Everything you need to know about ProspectX Intelligence.
        </p>

        {/* Search bar */}
        <div className="max-w-md mx-auto mt-8 relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30"
          />
          <input
            type="text"
            placeholder="Search questions..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setOpenIndex(-1);
            }}
            className="w-full pl-10 pr-4 py-3 bg-white/[0.05] border border-white/10 rounded-xl text-sm text-white placeholder-white/30 focus:border-teal/50 focus:ring-0 focus:outline-none transition-colors"
          />
        </div>
      </section>

      {/* ── FAQ Content ───────────────────────────────── */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 pb-20">
        {/* Category pills */}
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {filteredCategories.map((cat, i) => (
            <button
              key={cat.title}
              onClick={() => {
                setActiveCategory(i);
                setOpenIndex(-1);
              }}
              className={`text-xs font-oswald uppercase tracking-wider rounded-full px-4 py-1.5 border transition-colors min-h-[44px] sm:min-h-0 ${
                i === safeActiveCategory
                  ? "bg-teal/10 border-teal/30 text-teal"
                  : "border-white/10 text-white/40 hover:text-white/60"
              }`}
            >
              {cat.title}
            </button>
          ))}
        </div>

        {/* Accordion items */}
        {activeItems.length > 0 ? (
          <div className="space-y-3">
            {activeItems.map((item, i) => (
              <AccordionItem
                key={item.q}
                item={item}
                isOpen={openIndex === i}
                onToggle={() => setOpenIndex(openIndex === i ? -1 : i)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-white/40 text-sm">
              No questions match &ldquo;{searchQuery}&rdquo;.{" "}
              <button
                onClick={() => {
                  setSearchQuery("");
                  setActiveCategory(0);
                }}
                className="text-teal hover:text-teal/80 underline underline-offset-2"
              >
                Clear search
              </button>
            </p>
          </div>
        )}

        {/* Bottom link */}
        <div className="text-center mt-12">
          <p className="text-white/40 text-sm">
            Still have questions?{" "}
            <Link
              href="/contact"
              className="text-teal hover:text-teal/80 underline underline-offset-2"
            >
              Get in touch
            </Link>
          </p>
        </div>
      </section>
    </MarketingLayout>
  );
}
