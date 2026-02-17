"use client";

import { Radio, Mic, BarChart3, FileText, Camera, MessageSquare, Tv, Users, Sparkles } from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";

const BROADCAST_TOOLS = [
  { icon: FileText, name: "Spotting Board", desc: "Auto-generated spotting boards with rosters, stats, and key matchups" },
  { icon: Mic, name: "Talk Tracks", desc: "AI-generated narrative threads and storylines for live broadcasts" },
  { icon: BarChart3, name: "Live Stat Cards", desc: "Real-time stat overlays and comparison graphics" },
  { icon: MessageSquare, name: "Interview Questions", desc: "Context-aware questions for pre/post-game coach and player interviews" },
  { icon: Camera, name: "Graphics Suggestions", desc: "On-screen graphic ideas based on game flow and milestones" },
  { icon: Users, name: "Player Profiles", desc: "Quick-reference player bios, career highlights, and fun facts" },
  { icon: Tv, name: "Post-Game Script", desc: "Structured recap with key moments, stars, and takeaway narratives" },
  { icon: Sparkles, name: "PXI Insights", desc: "AI-powered storylines, trends, and analytics for broadcast depth" },
];

export default function BroadcastPage() {
  return (
    <ProtectedRoute>
      <NavBar />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-orange/10 mb-4">
            <Radio size={32} className="text-orange" />
          </div>
          <h1 className="text-2xl font-bold text-navy font-oswald uppercase tracking-wider">Broadcast Hub</h1>
          <p className="text-sm text-muted mt-2 max-w-md mx-auto">
            Your complete broadcast prep toolkit. 8 tools designed for play-by-play, color commentary, and production teams.
          </p>
          <span className="inline-block mt-3 px-3 py-1 rounded-full bg-orange/10 text-orange text-xs font-oswald font-bold uppercase tracking-wider">
            Coming Soon
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {BROADCAST_TOOLS.map((tool) => (
            <div
              key={tool.name}
              className="bg-white rounded-xl border border-border p-4 hover:border-orange/30 hover:shadow-sm transition-all"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-orange/10 flex items-center justify-center shrink-0">
                  <tool.icon size={18} className="text-orange" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-navy">{tool.name}</h3>
                  <p className="text-xs text-muted mt-0.5 leading-relaxed">{tool.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 text-center">
          <p className="text-xs text-muted/50">
            Broadcast Hub will integrate with your existing PXI data, game schedules, and player intelligence.
          </p>
        </div>
      </main>
    </ProtectedRoute>
  );
}
