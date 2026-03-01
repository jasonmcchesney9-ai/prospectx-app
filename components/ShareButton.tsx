"use client";

import { useState, useRef, useEffect } from "react";
import { Share2, ChevronDown, Check, Loader2, Users, User, Heart, Briefcase, Building2, Lock } from "lucide-react";
import api from "@/lib/api";

const SHARE_OPTIONS = [
  { id: "player", label: "Share with Player", icon: User, description: "Player + family + staff can view" },
  { id: "family", label: "Share with Family", icon: Heart, description: "Parent/family + player + staff" },
  { id: "agent", label: "Share with Agent", icon: Briefcase, description: "Agent + staff can view" },
  { id: "org", label: "Share with Org", icon: Building2, description: "All org members" },
  { id: "staff", label: "Staff Only", icon: Users, description: "Staff roles only" },
  { id: "private", label: "Make Private", icon: Lock, description: "Only you can view" },
];

interface ShareButtonProps {
  contentType: string;   // report | practice_plan | game_plan | film_clip | series_plan
  contentId: string;
  recipientId?: string;  // optional specific recipient
  currentVisibility?: string;
  compact?: boolean;
  onShared?: (visibility: string) => void;
}

export default function ShareButton({
  contentType,
  contentId,
  recipientId,
  currentVisibility,
  compact = false,
  onShared,
}: ShareButtonProps) {
  const [open, setOpen] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleShare = async (shareWith: string) => {
    setSharing(true);
    try {
      await api.post("/api/share", {
        content_type: contentType,
        content_id: contentId,
        share_with: shareWith,
        recipient_id: recipientId || null,
      });
      setSuccess(shareWith);
      setTimeout(() => setSuccess(null), 2000);
      setOpen(false);
      if (onShared) {
        const visibilityMap: Record<string, string> = {
          player: "shared_with_player",
          family: "shared_with_family",
          agent: "shared_with_agent",
          org: "org_wide",
          staff: "staff_only",
          private: "private",
        };
        onShared(visibilityMap[shareWith] || shareWith);
      }
    } catch (err) {
      console.error("Share failed:", err);
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 transition-colors ${
          compact
            ? "px-2 py-1 text-[10px] font-oswald uppercase tracking-wider text-teal hover:text-teal/80"
            : "px-3 py-1.5 text-xs font-oswald uppercase tracking-wider text-teal bg-teal/10 rounded-lg hover:bg-teal/20"
        }`}
      >
        {success ? (
          <>
            <Check size={compact ? 10 : 12} className="text-green-500" />
            Shared
          </>
        ) : sharing ? (
          <Loader2 size={compact ? 10 : 12} className="animate-spin" />
        ) : (
          <>
            <Share2 size={compact ? 10 : 12} />
            Share
            <ChevronDown size={compact ? 8 : 10} className={`transition-transform ${open ? "rotate-180" : ""}`} />
          </>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-56 bg-white border border-border rounded-lg shadow-xl overflow-hidden z-50">
          <div className="px-3 py-2 border-b border-border">
            <p className="text-[9px] font-oswald uppercase tracking-wider text-muted">Share this {contentType.replace("_", " ")}</p>
          </div>
          {SHARE_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const isActive = currentVisibility === opt.id ||
              (currentVisibility === "shared_with_player" && opt.id === "player") ||
              (currentVisibility === "shared_with_family" && opt.id === "family") ||
              (currentVisibility === "shared_with_agent" && opt.id === "agent") ||
              (currentVisibility === "org_wide" && opt.id === "org") ||
              (currentVisibility === "staff_only" && opt.id === "staff") ||
              (currentVisibility === "private" && opt.id === "private");
            return (
              <button
                key={opt.id}
                onClick={() => handleShare(opt.id)}
                disabled={sharing}
                className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center gap-2.5 ${
                  isActive
                    ? "bg-teal/5 text-teal"
                    : "text-navy hover:bg-navy/[0.02]"
                } disabled:opacity-50`}
              >
                <Icon size={14} className={isActive ? "text-teal" : "text-muted"} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{opt.label}</p>
                  <p className="text-[10px] text-muted truncate">{opt.description}</p>
                </div>
                {isActive && <Check size={12} className="text-teal shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
