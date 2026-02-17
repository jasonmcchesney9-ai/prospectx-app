"use client";

import { Heart, TrendingUp, Calendar, BookOpen, MessageSquare } from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useBenchTalk } from "@/components/BenchTalkProvider";

export default function MyPlayerPage() {
  const { openBenchTalk } = useBenchTalk();

  return (
    <ProtectedRoute>
      <NavBar />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#3B6B8A]/10 mb-4">
            <Heart size={32} className="text-[#3B6B8A]" />
          </div>
          <h1 className="text-2xl font-bold text-navy font-oswald uppercase tracking-wider">Your Player Dashboard</h1>
          <p className="text-sm text-muted mt-2 max-w-md mx-auto">
            Track your player&apos;s progress, stats, development goals, and upcoming games — all in one place.
          </p>
          <span className="inline-block mt-3 px-3 py-1 rounded-full bg-[#3B6B8A]/10 text-[#3B6B8A] text-xs font-oswald font-bold uppercase tracking-wider">
            Coming Soon
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          {[
            { icon: TrendingUp, title: "Stat Progression", desc: "Season-over-season tracking with visual trend charts" },
            { icon: Calendar, title: "Game Schedule", desc: "Upcoming games, results, and game-by-game stats" },
            { icon: BookOpen, title: "Development Plan", desc: "Personalized skill development roadmap from PXI" },
            { icon: MessageSquare, title: "Coach Feedback", desc: "Notes and observations from coaches and scouts" },
          ].map((item) => (
            <div
              key={item.title}
              className="bg-white rounded-xl border border-border p-4 hover:border-[#3B6B8A]/30 hover:shadow-sm transition-all"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#3B6B8A]/10 flex items-center justify-center shrink-0">
                  <item.icon size={18} className="text-[#3B6B8A]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-navy">{item.title}</h3>
                  <p className="text-xs text-muted mt-0.5 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Bench Talk CTA */}
        <div className="bg-navy/[0.03] rounded-xl border border-border p-6 text-center">
          <h3 className="font-oswald text-sm font-bold text-navy uppercase tracking-wider mb-2">
            Have a question about your player?
          </h3>
          <p className="text-xs text-muted mb-4">
            PXI can explain stats, suggest development areas, and answer questions in plain language — no jargon.
          </p>
          <button
            onClick={() => openBenchTalk("How is my player doing this season? Give me a plain-language summary of their progress.")}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#3B6B8A] text-white text-sm font-oswald uppercase tracking-wider rounded-lg hover:bg-[#3B6B8A]/90 transition-colors"
          >
            <MessageSquare size={14} />
            Ask PXI About My Player
          </button>
        </div>
      </main>
    </ProtectedRoute>
  );
}
