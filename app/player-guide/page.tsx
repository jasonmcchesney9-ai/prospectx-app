"use client";

import { useState } from "react";
import {
  Apple,
  Dumbbell,
  GraduationCap,
  Brain,
  ShoppingBag,
  BookOpen,
  Heart,
  ChevronDown,
} from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
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
import CarRideScript from "@/components/player-guide/CarRideScript";

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
    title: "Nutrition",
    desc: "Game-day meal patterns by age, hydration, and recovery nutrition for young athletes.",
    color: "text-green-600",
    bg: "bg-green-50",
    accent: "border-l-green-500",
    component: NutritionSection,
  },
  {
    id: "workouts",
    icon: Dumbbell,
    title: "Workouts",
    desc: "Age-appropriate off-ice training — strength, agility, conditioning, and weekly plans.",
    color: "text-orange",
    bg: "bg-orange/10",
    accent: "border-l-orange",
    component: WorkoutsSection,
  },
  {
    id: "prep-college",
    icon: GraduationCap,
    title: "Prep & College Guide",
    desc: "Hockey pathways, key dates, academic requirements, and recruiting timelines.",
    color: "text-teal",
    bg: "bg-teal/10",
    accent: "border-l-teal",
    component: PrepCollegeSection,
  },
  {
    id: "mental",
    icon: Brain,
    title: "Mental Performance",
    desc: "Pre-game routine builder, bounce-back tips, and confidence strategies.",
    color: "text-purple-600",
    bg: "bg-purple-50",
    accent: "border-l-purple-500",
    component: MentalPerformanceSection,
  },
  {
    id: "pressure-confidence",
    icon: Heart,
    title: "Pressure & Confidence",
    desc: "AI-powered support for tough moments — what to say, what to avoid, and when to seek help.",
    color: "text-rose-600",
    bg: "bg-rose-50",
    accent: "border-l-rose-500",
    component: PressureConfidenceTool,
  },
  {
    id: "gear",
    icon: ShoppingBag,
    title: "Gear Guide",
    desc: "Equipment priority table for skaters and goalies, fitting tips, and replacement guidelines.",
    color: "text-navy",
    bg: "bg-navy/5",
    accent: "border-l-navy",
    component: GearGuideSection,
  },
  {
    id: "glossary",
    icon: BookOpen,
    title: "Hockey Glossary",
    desc: "Plain-language hockey terms — positions, stats, systems, penalties, and levels — searchable and filterable.",
    color: "text-blue-600",
    bg: "bg-blue-50",
    accent: "border-l-blue-500",
    component: GlossarySection,
  },
];

/* ---------- Main Page ---------- */
export default function PlayerGuidePage() {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  function toggleSection(id: string) {
    setExpandedSection((prev) => (prev === id ? null : id));
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

        {/* Car Ride Script — After Game Help */}
        <div className="mb-3">
          <CarRideScript />
        </div>

        {/* 6 Content Sections */}
        <div className="space-y-3">
          {GUIDE_SECTIONS.map((section) => {
            const isExpanded = expandedSection === section.id;
            const SectionContent = section.component;
            return (
              <div
                key={section.id}
                className={`bg-white rounded-xl border transition-all duration-300 overflow-hidden ${
                  isExpanded
                    ? `border-l-4 ${section.accent} border-gray-200 shadow-md`
                    : "border-teal/20 hover:shadow-sm hover:border-teal/30"
                }`}
              >
                {/* Clickable header */}
                <button
                  onClick={() => toggleSection(section.id)}
                  className="w-full flex items-center gap-4 p-4 text-left"
                >
                  <div
                    className={`w-11 h-11 rounded-xl ${section.bg} flex items-center justify-center shrink-0`}
                  >
                    <section.icon size={20} className={section.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-navy font-oswald uppercase tracking-wider">
                      {section.title}
                    </h3>
                    <p className="text-xs text-muted mt-0.5 leading-relaxed line-clamp-1">
                      {section.desc}
                    </p>
                  </div>
                  <ChevronDown
                    size={18}
                    className={`text-gray-400 shrink-0 transition-transform duration-300 ${
                      isExpanded ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {/* Expandable content */}
                <div
                  className={`transition-all duration-300 ease-in-out overflow-hidden ${
                    isExpanded ? "max-h-[5000px] opacity-100" : "max-h-0 opacity-0"
                  }`}
                >
                  <div className="px-4 pb-5 pt-1 border-t border-gray-100">
                    <SectionContent />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* PXI Quick Ask bar */}
        <div className="mt-8">
          <PXIQuickAsk />
        </div>
      </main>
    </ProtectedRoute>
  );
}
