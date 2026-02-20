"use client";

import {
  Search,
  Briefcase,
  Megaphone,
  User,
  Heart,
  Radio,
  Film,
  Shield,
} from "lucide-react";

const ROLES = [
  {
    value: "scout",
    label: "Scout",
    icon: Search,
    description: "Evaluate talent across leagues and levels",
  },
  {
    value: "gm",
    label: "General Manager",
    icon: Briefcase,
    description: "Build rosters and make personnel decisions",
  },
  {
    value: "coach",
    label: "Coach",
    icon: Megaphone,
    description: "Game planning, practice design, and player development",
  },
  {
    value: "player",
    label: "Player",
    icon: User,
    description: "Track your own stats and development",
  },
  {
    value: "parent",
    label: "Parent",
    icon: Heart,
    description: "Follow your child's hockey journey",
  },
  {
    value: "broadcaster",
    label: "Broadcaster",
    icon: Radio,
    description: "On-air talent needing game prep and talk tracks",
  },
  {
    value: "producer",
    label: "Producer",
    icon: Film,
    description: "Broadcast production with stat cards and graphics",
  },
  {
    value: "agent",
    label: "Agent",
    icon: Shield,
    description: "Manage client portfolios and pathway planning",
  },
];

interface StepRoleProps {
  selectedRole: string;
  onSelect: (role: string) => void;
}

export default function StepRole({ selectedRole, onSelect }: StepRoleProps) {
  return (
    <div className="p-6">
      <h2 className="font-oswald text-lg font-bold text-navy uppercase tracking-wider mb-1">
        Confirm Your Role
      </h2>
      <p className="text-sm text-muted mb-5">
        This determines your dashboard layout and the tools you see first.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {ROLES.map((role) => {
          const Icon = role.icon;
          const isSelected = selectedRole === role.value;
          return (
            <button
              key={role.value}
              onClick={() => onSelect(role.value)}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border text-center transition-all ${
                isSelected
                  ? "border-teal bg-teal/5 ring-1 ring-teal/30"
                  : "border-border hover:border-teal/40 hover:bg-navy/[0.02]"
              }`}
            >
              <Icon
                size={24}
                className={isSelected ? "text-teal" : "text-navy/40"}
              />
              <span
                className={`font-oswald text-xs font-semibold uppercase tracking-wider ${
                  isSelected ? "text-teal" : "text-navy"
                }`}
              >
                {role.label}
              </span>
              <span className="text-[11px] text-muted leading-tight">
                {role.description}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
