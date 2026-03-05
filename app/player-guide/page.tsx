"use client";

import { useState, useEffect } from "react";
import {
  Apple,
  Dumbbell,
  GraduationCap,
  Brain,
  ShoppingBag,
  BookOpen,
  Heart,
  Shield,
} from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import { getUser } from "@/lib/auth";
import { useBenchTalk } from "@/components/BenchTalkProvider";
import DevelopmentJourneyTracker from "@/components/player-guide/DevelopmentJourneyTracker";
import NutritionSection from "@/components/player-guide/NutritionSection";
import WorkoutsSection from "@/components/player-guide/WorkoutsSection";
import PrepCollegeSection from "@/components/player-guide/PrepCollegeSection";
import MentalPerformanceSection from "@/components/player-guide/MentalPerformanceSection";
import GearGuideSection from "@/components/player-guide/GearGuideSection";
import GlossarySection from "@/components/player-guide/GlossarySection";
import PXIQuickAsk from "@/components/player-guide/PXIQuickAsk";
import ParentDoDontCard from "@/components/player-guide/ParentDoDontCard";
import PressureConfidenceTool from "@/components/player-guide/PressureConfidenceTool";

/* ---------- Section definitions ---------- */
interface GuideSection {
  id: string;
  icon: React.ElementType;
  title: string;
  desc: string;
  color: string;
  bg: string;
  accent: string;      // border accent on expand
  component: React.ComponentType;
}

const GUIDE_SECTIONS: GuideSection[] = [
  {
    id: "nutrition",
    icon: Apple,
    title: "Ask PXI: Nutrition",
    desc: "Game-day meal patterns by age, hydration, and recovery nutrition for young athletes.",
    color: "text-green-600",
    bg: "bg-green-50",
    accent: "border-l-green-500",
    component: NutritionSection,
  },
  {
    id: "workouts",
    icon: Dumbbell,
    title: "Ask PXI: Workouts",
    desc: "Age-appropriate off-ice training — strength, agility, conditioning, and weekly plans.",
    color: "text-orange",
    bg: "bg-orange/10",
    accent: "border-l-orange",
    component: WorkoutsSection,
  },
  {
    id: "prep-college",
    icon: GraduationCap,
    title: "Ask PXI: Prep & College",
    desc: "Hockey pathways, key dates, academic requirements, and recruiting timelines.",
    color: "text-teal",
    bg: "bg-teal/10",
    accent: "border-l-teal",
    component: PrepCollegeSection,
  },
  {
    id: "mental",
    icon: Brain,
    title: "Ask PXI: Mental Performance",
    desc: "Pre-game routine builder, bounce-back tips, and confidence strategies.",
    color: "text-purple-600",
    bg: "bg-purple-50",
    accent: "border-l-purple-500",
    component: MentalPerformanceSection,
  },
  {
    id: "pressure-confidence",
    icon: Heart,
    title: "Ask PXI: Pressure & Confidence",
    desc: "AI-powered support for tough moments — what to say, what to avoid, and when to seek help.",
    color: "text-rose-600",
    bg: "bg-rose-50",
    accent: "border-l-rose-500",
    component: PressureConfidenceTool,
  },
  {
    id: "gear",
    icon: ShoppingBag,
    title: "Ask PXI: Gear Guide",
    desc: "Equipment priority table for skaters and goalies, fitting tips, and replacement guidelines.",
    color: "text-navy",
    bg: "bg-navy/5",
    accent: "border-l-navy",
    component: GearGuideSection,
  },
  {
    id: "glossary",
    icon: BookOpen,
    title: "Ask PXI: Hockey Glossary",
    desc: "Plain-language hockey terms — positions, stats, systems, penalties, and levels — searchable and filterable.",
    color: "text-blue-600",
    bg: "bg-blue-50",
    accent: "border-l-blue-500",
    component: GlossarySection,
  },
];

/* ---------- Main Page ---------- */
export default function PlayerGuidePage() {
  const [activeTab, setActiveTab] = useState("nutrition");
  const _user = getUser();
  const { setActivePxiContext, roleOverride } = useBenchTalk();
  const _role = roleOverride || _user?.hockey_role || "";
  const _roleAllowed = _role === "parent" || _role === "player";

  useEffect(() => {
    const u = getUser();
    setActivePxiContext({
      user: {
        id: u?.id || "",
        name: `${u?.first_name || ""} ${u?.last_name || ""}`.trim() || "User",
        role: (u?.hockey_role?.toUpperCase() || "SCOUT") as "COACH" | "PARENT" | "SCOUT" | "GM" | "AGENT" | "BROADCASTER" | "ANALYST",
        orgId: u?.org_id || "",
        orgName: "ProspectX",
      },
      page: { id: "FAMILY_GUIDE", route: "/player-guide" },
    });
    return () => { setActivePxiContext(null); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!_roleAllowed) {
    return (
      <ProtectedRoute>
        <NavBar />
        <main className="max-w-2xl mx-auto px-4 py-16 text-center">
          <Shield size={48} className="text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-navy mb-2">Access Denied</h2>
          <p className="text-muted text-sm mb-1">This page is available to Family accounts only.</p>
          <p className="text-muted/60 text-xs mb-6">Your current role: <span className="font-medium text-navy">{_role || "none"}</span></p>
          <a href="/" className="inline-flex items-center gap-2 px-4 py-2 bg-navy text-white text-sm font-oswald font-semibold uppercase tracking-wider rounded-lg hover:bg-navy/90 transition-colors">
            Go to Dashboard
          </a>
        </main>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <NavBar />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-teal/10 mb-4">
            <BookOpen size={32} className="text-teal" />
          </div>
          <h1 className="text-2xl font-bold text-navy font-oswald uppercase tracking-wider">
            Player &amp; Family Guide
          </h1>
          <p className="text-sm text-muted mt-2 max-w-lg mx-auto">
            Your co-pilot for supporting your player&apos;s growth — nutrition, training, pathways, mental game, equipment, and hockey knowledge.
          </p>
        </div>

        {/* Development Journey Tracker */}
        <DevelopmentJourneyTracker />

        {/* Parent Do / Don't Tip Card */}
        <div className="mb-3">
          <ParentDoDontCard />
        </div>

        {/* Tab Bar */}
        <div className="flex flex-wrap gap-1 mb-4">
          {GUIDE_SECTIONS.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveTab(section.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-oswald uppercase tracking-wider transition-colors ${
                activeTab === section.id
                  ? "bg-navy text-white"
                  : "bg-navy/5 text-navy hover:bg-navy/10"
              }`}
            >
              <section.icon size={14} />
              {section.title}
            </button>
          ))}
        </div>

        {/* Active Tab Content */}
        {(() => {
          const active = GUIDE_SECTIONS.find((s) => s.id === activeTab);
          if (!active) return null;
          const SectionContent = active.component;
          return (
            <div className="bg-white rounded-xl border border-teal/20 p-5">
              <SectionContent />
            </div>
          );
        })()}

        {/* PXI Quick Ask bar */}
        <div className="mt-8">
          <PXIQuickAsk />
        </div>
      </main>
    </ProtectedRoute>
  );
}
