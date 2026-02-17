"use client";

import { Apple, Dumbbell, GraduationCap, Brain, ShoppingBag, BookOpen } from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";

const GUIDE_SECTIONS = [
  {
    icon: Apple,
    title: "Nutrition",
    desc: "Pre-game meals, hydration, recovery nutrition, and seasonal eating guides tailored to young athletes.",
    color: "text-green-600",
    bg: "bg-green-50",
  },
  {
    icon: Dumbbell,
    title: "Workouts",
    desc: "Age-appropriate off-ice training programs — strength, conditioning, flexibility, and injury prevention.",
    color: "text-orange",
    bg: "bg-orange/10",
  },
  {
    icon: GraduationCap,
    title: "Prep & College",
    desc: "Pathway guidance for prep school, junior hockey, NCAA, and USports. Timelines, eligibility, and recruiting tips.",
    color: "text-teal",
    bg: "bg-teal/10",
  },
  {
    icon: Brain,
    title: "Mental Performance",
    desc: "Confidence building, focus techniques, handling pressure, dealing with setbacks, and positive self-talk strategies.",
    color: "text-purple-600",
    bg: "bg-purple-50",
  },
  {
    icon: ShoppingBag,
    title: "Gear Guide",
    desc: "Equipment recommendations by position and age — skates, sticks, protective gear, and fitting tips.",
    color: "text-navy",
    bg: "bg-navy/5",
  },
  {
    icon: BookOpen,
    title: "Hockey Glossary",
    desc: "Plain-language explanations of hockey terms, stats, and scouting jargon for families new to the game.",
    color: "text-[#3B6B8A]",
    bg: "bg-[#3B6B8A]/10",
  },
];

export default function PlayerGuidePage() {
  return (
    <ProtectedRoute>
      <NavBar />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#3B6B8A]/10 mb-4">
            <BookOpen size={32} className="text-[#3B6B8A]" />
          </div>
          <h1 className="text-2xl font-bold text-navy font-oswald uppercase tracking-wider">Player Guide</h1>
          <p className="text-sm text-muted mt-2 max-w-md mx-auto">
            Resources and guides for hockey families — nutrition, training, pathways, mental game, and more.
          </p>
          <span className="inline-block mt-3 px-3 py-1 rounded-full bg-[#3B6B8A]/10 text-[#3B6B8A] text-xs font-oswald font-bold uppercase tracking-wider">
            Coming Soon
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {GUIDE_SECTIONS.map((section) => (
            <div
              key={section.title}
              className="bg-white rounded-xl border border-border p-5 hover:shadow-md hover:border-teal/30 transition-all"
            >
              <div className={`w-12 h-12 rounded-xl ${section.bg} flex items-center justify-center mb-3`}>
                <section.icon size={22} className={section.color} />
              </div>
              <h3 className="text-sm font-bold text-navy font-oswald uppercase tracking-wider">{section.title}</h3>
              <p className="text-xs text-muted mt-1.5 leading-relaxed">{section.desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 bg-navy/[0.03] rounded-xl border border-border p-6 text-center">
          <p className="text-xs text-muted">
            Each section will include curated articles, tips from hockey professionals, and PXI-powered personalized recommendations.
          </p>
        </div>
      </main>
    </ProtectedRoute>
  );
}
