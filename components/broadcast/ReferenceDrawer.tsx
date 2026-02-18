"use client";

import { User, MessageSquare, Crosshair, FileText, Award, Lock } from "lucide-react";
import type { GameState } from "@/types/api";

export type RightTab = "profiles" | "interview" | "matchup" | "producer" | "postgame";

interface Props {
  activeTab: RightTab;
  setActiveTab: (tab: RightTab) => void;
  gameState: GameState;
  isPostGameLocked: boolean;
  children: React.ReactNode;
}

const TABS: { key: RightTab; icon: React.ElementType; label: string }[] = [
  { key: "profiles", icon: User, label: "Profiles" },
  { key: "interview", icon: MessageSquare, label: "Interview" },
  { key: "matchup", icon: Crosshair, label: "Matchups" },
  { key: "producer", icon: FileText, label: "Producer" },
  { key: "postgame", icon: Award, label: "Post-Game" },
];

export default function ReferenceDrawer({
  activeTab,
  setActiveTab,
  gameState,
  isPostGameLocked,
  children,
}: Props) {
  return (
    <div className="sticky top-[7.5rem] h-[calc(100vh-7.5rem)] flex">
      {/* Vertical tab buttons */}
      <div className="flex flex-col gap-1 py-2 px-1">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          const isLocked = tab.key === "postgame" && isPostGameLocked && gameState !== "post_game";
          const Icon = tab.icon;

          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`relative flex flex-col items-center justify-center w-10 h-10 rounded-lg transition-colors ${
                isActive
                  ? "bg-teal text-white"
                  : "text-muted/40 hover:text-muted hover:bg-navy/[0.04]"
              }`}
              title={tab.label}
            >
              <Icon size={14} />
              <span className="text-[7px] font-oswald uppercase tracking-wider mt-0.5">
                {tab.label}
              </span>
              {isLocked && (
                <Lock size={8} className="absolute top-1 right-1 text-orange" />
              )}
            </button>
          );
        })}
      </div>

      {/* Content area */}
      <div className="flex-1 bg-white border border-border rounded-xl overflow-y-auto">
        <div className="p-3">
          {children}
        </div>
      </div>
    </div>
  );
}
