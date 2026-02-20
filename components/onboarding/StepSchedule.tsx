"use client";

import { useState, useEffect } from "react";
import { Calendar, CheckCircle, Loader2 } from "lucide-react";
import api from "@/lib/api";
import type { Team, CalendarFeed } from "@/types/api";
import FeedConnectModal from "@/components/calendar/FeedConnectModal";

const PLATFORMS = [
  {
    provider: "GAMESHEET",
    name: "GameSheet",
    color: "#2563EB",
    helpText: "Go to your GameSheet team page → Settings → Export → Copy the iCal URL.",
  },
  {
    provider: "TEAMSNAP",
    name: "TeamSnap",
    color: "#00B140",
    helpText: "In TeamSnap, go to Schedule → Export → Subscribe → copy the webcal URL.",
  },
  {
    provider: "SPORTSENGINE",
    name: "SportsEngine",
    color: "#FF6B00",
    helpText: "In SportsEngine, go to Schedule → Subscribe → copy the iCal/webcal URL.",
  },
  {
    provider: "SPORDLE",
    name: "Spordle",
    color: "#1A3F54",
    helpText: "In Spordle, go to your team calendar → Export → copy the .ics URL.",
  },
  {
    provider: "ICAL_GENERIC",
    name: "iCal URL",
    color: "#607080",
    helpText: "Paste any .ics or webcal:// URL from your calendar provider.",
  },
];

interface StepScheduleProps {
  onFeedConnected: () => void;
}

export default function StepSchedule({ onFeedConnected }: StepScheduleProps) {
  const [selectedPlatform, setSelectedPlatform] = useState<(typeof PLATFORMS)[0] | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTeams = async () => {
      try {
        const { data } = await api.get<Team[]>("/teams");
        setTeams(data);
      } catch {
        // Non-critical
      } finally {
        setLoading(false);
      }
    };
    fetchTeams();
  }, []);

  const handleFeedCreated = (feed: CalendarFeed) => {
    if (feed) {
      setConnected(true);
      onFeedConnected();
    }
    setSelectedPlatform(null);
  };

  return (
    <div className="p-6">
      <h2 className="font-oswald text-lg font-bold text-navy uppercase tracking-wider mb-1">
        Connect Your Schedule
      </h2>
      <p className="text-sm text-muted mb-5">
        Import your team&apos;s game schedule from your league platform. You can always do this later.
      </p>

      {connected ? (
        <div className="flex flex-col items-center py-8">
          <CheckCircle size={36} className="text-teal mb-3" />
          <p className="text-sm font-medium text-navy">Schedule connected</p>
          <p className="text-xs text-muted mt-1">
            Your games will appear on the dashboard calendar.
          </p>
        </div>
      ) : loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="animate-spin text-teal" size={24} />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {PLATFORMS.map((platform) => (
            <button
              key={platform.provider}
              onClick={() => setSelectedPlatform(platform)}
              className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border hover:border-teal/40 hover:bg-navy/[0.02] transition-all text-left"
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: platform.color + "15" }}
              >
                <Calendar size={16} style={{ color: platform.color }} />
              </div>
              <div>
                <span className="text-sm font-medium text-navy block">{platform.name}</span>
                <span className="text-[10px] text-muted">Connect feed</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {selectedPlatform && (
        <FeedConnectModal
          platform={selectedPlatform}
          teams={teams}
          onClose={() => setSelectedPlatform(null)}
          onFeedCreated={handleFeedCreated}
        />
      )}
    </div>
  );
}
