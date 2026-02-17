"use client";

import { Calendar, ExternalLink } from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";

const PLATFORMS = [
  {
    name: "GameSheet",
    desc: "Official scoring and game data for many hockey leagues across North America",
    url: "https://www.gamesheet.app",
    color: "bg-blue-50 text-blue-700 border-blue-200",
  },
  {
    name: "TeamSnap",
    desc: "Team management, scheduling, and communication for youth and amateur sports",
    url: "https://www.teamsnap.com",
    color: "bg-green-50 text-green-700 border-green-200",
  },
  {
    name: "SportsEngine",
    desc: "League management, registration, and scheduling platform (NBC Sports partnership)",
    url: "https://www.sportsengine.com",
    color: "bg-orange-50 text-orange-700 border-orange-200",
  },
  {
    name: "Spordle",
    desc: "Hockey-specific registration, scheduling, and statistics platform used by Hockey Canada affiliates",
    url: "https://www.spordle.com",
    color: "bg-purple-50 text-purple-700 border-purple-200",
  },
];

export default function SchedulePage() {
  return (
    <ProtectedRoute>
      <NavBar />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-teal/10 mb-4">
            <Calendar size={32} className="text-teal" />
          </div>
          <h1 className="text-2xl font-bold text-navy font-oswald uppercase tracking-wider">Calendar & Schedule</h1>
          <p className="text-sm text-muted mt-2 max-w-md mx-auto">
            Unified calendar pulling games, practices, and events from your team&apos;s scheduling platform.
          </p>
          <span className="inline-block mt-3 px-3 py-1 rounded-full bg-teal/10 text-teal text-xs font-oswald font-bold uppercase tracking-wider">
            Coming Soon
          </span>
        </div>

        <div className="bg-white rounded-xl border border-border p-5 mb-6">
          <h3 className="text-xs font-oswald uppercase tracking-wider text-navy mb-3 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-teal" />
            Platform Integrations
          </h3>
          <p className="text-xs text-muted mb-4">
            ProspectX Calendar will sync with these scheduling platforms to pull your team&apos;s game and practice schedules automatically.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {PLATFORMS.map((platform) => (
              <div
                key={platform.name}
                className={`rounded-lg border p-4 ${platform.color} transition-all hover:shadow-sm`}
              >
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-sm font-bold font-oswald uppercase tracking-wider">{platform.name}</h4>
                  <ExternalLink size={12} className="opacity-40" />
                </div>
                <p className="text-[11px] opacity-70 leading-relaxed">{platform.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-navy/[0.03] rounded-xl border border-border p-5 text-center">
          <p className="text-xs text-muted">
            Calendar will include game prep reminders, travel info, and auto-link to PXI scouting data for upcoming opponents.
          </p>
        </div>
      </main>
    </ProtectedRoute>
  );
}
