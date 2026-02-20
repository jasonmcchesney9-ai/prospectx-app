"use client";

import { CheckCircle, ArrowRight, FileText, BarChart3, MessageSquare, Radio, UserPlus } from "lucide-react";
import { assetUrl } from "@/lib/api";

const ROLE_LABELS: Record<string, string> = {
  scout: "Scout",
  gm: "General Manager",
  coach: "Coach",
  player: "Player",
  parent: "Parent",
  broadcaster: "Broadcaster",
  producer: "Producer",
  agent: "Agent",
};

interface StepCompleteProps {
  teamName: string | null;
  teamLogo: string | null;
  hockeyRole: string;
  rosterCount: number;
  scheduleConnected: boolean;
  onFinish: () => void;
}

export default function StepComplete({
  teamName,
  teamLogo,
  hockeyRole,
  rosterCount,
  scheduleConnected,
  onFinish,
}: StepCompleteProps) {
  const roleGroup = ["scout", "coach", "gm"].includes(hockeyRole)
    ? "pro"
    : ["parent", "player"].includes(hockeyRole)
      ? "family"
      : ["broadcaster", "producer"].includes(hockeyRole)
        ? "media"
        : "agent";

  const nextSteps = getNextSteps(roleGroup);

  return (
    <div className="p-6">
      <div className="text-center mb-6">
        <CheckCircle size={48} className="text-teal mx-auto mb-3" />
        <h2 className="font-oswald text-xl font-bold text-navy uppercase tracking-wider">
          You&apos;re All Set!
        </h2>
        <p className="text-sm text-muted mt-1">
          Your ProspectX workspace is ready to go.
        </p>
      </div>

      {/* Summary Card */}
      <div className="bg-navy/[0.03] rounded-xl p-5 mb-6">
        <div className="flex items-center gap-4 mb-4">
          {teamLogo ? (
            <img
              src={assetUrl(teamLogo)}
              alt={teamName || "Team"}
              className="w-12 h-12 object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <div className="w-12 h-12 bg-navy/10 rounded-full flex items-center justify-center text-navy/40 font-oswald text-sm">
              {teamName?.charAt(0) || "T"}
            </div>
          )}
          <div>
            <p className="font-oswald font-bold text-navy uppercase tracking-wider text-sm">
              {teamName || "Your Team"}
            </p>
            <span className="inline-block mt-0.5 text-[10px] font-oswald uppercase tracking-wider bg-teal/10 text-teal px-2 py-0.5 rounded">
              {ROLE_LABELS[hockeyRole] || hockeyRole}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-lg px-3 py-2 border border-border">
            <p className="text-[10px] font-oswald uppercase tracking-wider text-muted">Players</p>
            <p className="text-sm font-semibold text-navy">
              {rosterCount > 0 ? `${rosterCount} tracked` : "Import later"}
            </p>
          </div>
          <div className="bg-white rounded-lg px-3 py-2 border border-border">
            <p className="text-[10px] font-oswald uppercase tracking-wider text-muted">Schedule</p>
            <p className="text-sm font-semibold text-navy">
              {scheduleConnected ? "Connected" : "Not connected"}
            </p>
          </div>
        </div>
      </div>

      {/* Next Steps */}
      <div className="mb-6">
        <h3 className="font-oswald text-xs font-bold text-navy uppercase tracking-wider mb-3">
          Suggested Next Steps
        </h3>
        <div className="space-y-2">
          {nextSteps.map((step, i) => (
            <div key={i} className="flex items-center gap-3 text-sm text-navy/80">
              <step.icon size={16} className="text-teal flex-shrink-0" />
              <span>{step.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Go to Dashboard */}
      <button
        onClick={onFinish}
        className="w-full py-3 bg-teal text-white font-oswald font-semibold uppercase tracking-wider rounded-lg hover:bg-teal/90 transition-all text-sm flex items-center justify-center gap-2"
      >
        Go to Dashboard
        <ArrowRight size={16} />
      </button>
    </div>
  );
}

function getNextSteps(roleGroup: string) {
  switch (roleGroup) {
    case "pro":
      return [
        { icon: FileText, text: "Generate your first scouting report" },
        { icon: BarChart3, text: "Explore the analytics dashboard" },
        { icon: MessageSquare, text: "Try asking PXI a question in Bench Talk" },
      ];
    case "family":
      return [
        { icon: BarChart3, text: "View your player's profile and stats" },
        { icon: MessageSquare, text: "Ask PXI about your player's development" },
        { icon: FileText, text: "Check the schedule for upcoming games" },
      ];
    case "media":
      return [
        { icon: Radio, text: "Open the Broadcast Hub for game prep" },
        { icon: FileText, text: "Generate talk tracks for your next broadcast" },
        { icon: BarChart3, text: "Explore league leaders and stats" },
      ];
    case "agent":
      return [
        { icon: UserPlus, text: "Add your first client" },
        { icon: FileText, text: "Generate an Agent Pack report" },
        { icon: MessageSquare, text: "Ask PXI about player development paths" },
      ];
    default:
      return [
        { icon: FileText, text: "Generate your first report" },
        { icon: MessageSquare, text: "Try Bench Talk" },
      ];
  }
}
