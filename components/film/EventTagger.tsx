"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Plus,
  Trash2,
  Loader2,
  Clock,
  X,
  ChevronDown,
} from "lucide-react";
import api from "@/lib/api";
import toast from "react-hot-toast";

interface VideoEvent {
  id: string;
  event_type: string;
  event_label: string | null;
  time_seconds: number;
  created_at: string;
}

interface EventTaggerProps {
  sessionId: string;
  uploadId: string;
  getCurrentTime: () => number;
}

// ── All event buttons with categories, tooltips, and dot colors ──

interface EventButtonDef {
  type: string;
  label: string;
  tooltip: string;
  category: "offensive" | "defensive" | "special_teams" | "other";
}

const ALL_EVENT_BUTTONS: EventButtonDef[] = [
  // Offensive
  { type: "goal", label: "Goal", tooltip: "Tag a goal scored", category: "offensive" },
  { type: "shot", label: "Shot", tooltip: "Tag a shot on net", category: "offensive" },
  { type: "chance", label: "Chance", tooltip: "Tag a scoring chance", category: "offensive" },
  { type: "entry", label: "Entry", tooltip: "Tag a controlled zone entry", category: "offensive" },
  { type: "cycle", label: "Cycle", tooltip: "Tag an offensive zone cycle", category: "offensive" },
  { type: "zone_time", label: "Zone Time", tooltip: "Tag sustained offensive zone time", category: "offensive" },
  { type: "screen", label: "Screen", tooltip: "Tag a net-front screen", category: "offensive" },
  { type: "net_battle", label: "Net Battle", tooltip: "Tag a net-front battle", category: "offensive" },
  // Defensive
  { type: "hit", label: "Hit", tooltip: "Tag a body check", category: "defensive" },
  { type: "block", label: "Block", tooltip: "Tag a shot block", category: "defensive" },
  { type: "turnover", label: "Turnover", tooltip: "Tag a puck turnover", category: "defensive" },
  { type: "exit", label: "Exit", tooltip: "Tag a defensive zone exit", category: "defensive" },
  { type: "breakout", label: "Breakout", tooltip: "Tag a breakout play", category: "defensive" },
  { type: "dz_coverage", label: "DZ Coverage", tooltip: "Tag defensive zone coverage", category: "defensive" },
  { type: "coverage_miss", label: "Coverage Miss", tooltip: "Tag a defensive coverage breakdown", category: "defensive" },
  { type: "stick_detail", label: "Stick Detail", tooltip: "Tag a stick check or detail play", category: "defensive" },
  // Special Teams
  { type: "faceoff", label: "Faceoff", tooltip: "Tag a faceoff", category: "special_teams" },
  { type: "pp_rep", label: "PP Rep", tooltip: "Tag a power play sequence", category: "special_teams" },
  { type: "pk_rep", label: "PK Rep", tooltip: "Tag a penalty kill sequence", category: "special_teams" },
  { type: "icing", label: "Icing", tooltip: "Tag an icing call", category: "special_teams" },
  { type: "penalty", label: "Penalty", tooltip: "Tag a penalty taken or drawn", category: "special_teams" },
  // Other
  { type: "custom", label: "Custom", tooltip: "Tag a custom event", category: "other" },
];

const FAVOURITE_TYPES = ["goal", "shot", "hit", "turnover", "entry", "exit", "faceoff", "pp_rep", "custom"];

const CATEGORY_DOT_COLOR: Record<string, string> = {
  offensive: "bg-teal",
  defensive: "bg-navy",
  special_teams: "bg-orange",
  other: "bg-gray-400",
};

const CATEGORY_LABELS: Record<string, string> = {
  offensive: "Offensive",
  defensive: "Defensive",
  special_teams: "Special Teams",
  other: "Other",
};

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export default function EventTagger({
  sessionId,
  uploadId,
  getCurrentTime,
}: EventTaggerProps) {
  const [events, setEvents] = useState<VideoEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCustom, setShowCustom] = useState(false);
  const [customLabel, setCustomLabel] = useState("");
  const [taggingType, setTaggingType] = useState<string | null>(null);
  const [flashType, setFlashType] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false);
  const [miniToast, setMiniToast] = useState<string | null>(null);
  const miniToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const moreRef = useRef<HTMLDivElement>(null);

  const favouriteButtons = ALL_EVENT_BUTTONS.filter((b) => FAVOURITE_TYPES.includes(b.type));
  const moreButtons = ALL_EVENT_BUTTONS.filter((b) => !FAVOURITE_TYPES.includes(b.type));

  // Group "more" buttons by category for the popover
  const moreByCategory = moreButtons.reduce<Record<string, EventButtonDef[]>>((acc, btn) => {
    if (!acc[btn.category]) acc[btn.category] = [];
    acc[btn.category].push(btn);
    return acc;
  }, {});

  const loadEvents = useCallback(async () => {
    try {
      const res = await api.get(`/film/events?upload_id=${uploadId}`);
      setEvents(res.data);
    } catch {
      // Silently handle
    } finally {
      setLoading(false);
    }
  }, [uploadId]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const tagEvent = useCallback(
    async (eventType: string, label?: string) => {
      if (eventType === "custom" && !label) {
        setShowCustom(true);
        return;
      }
      setTaggingType(eventType);
      // Flash animation
      setFlashType(eventType);
      setTimeout(() => setFlashType(null), 300);

      try {
        const time = Math.floor(getCurrentTime());
        await api.post("/film/events", {
          upload_id: uploadId,
          session_id: sessionId,
          event_type: eventType,
          event_label: label || null,
          time_seconds: time,
        });

        // Mini toast
        const displayLabel = label || eventType.replace(/_/g, " ");
        const msg = `${displayLabel} tagged at ${formatTime(time)}`;
        setMiniToast(msg);
        if (miniToastTimer.current) clearTimeout(miniToastTimer.current);
        miniToastTimer.current = setTimeout(() => setMiniToast(null), 2000);

        loadEvents();
      } catch {
        toast.error("Failed to tag event");
      } finally {
        setTaggingType(null);
      }
    },
    [uploadId, sessionId, getCurrentTime, loadEvents]
  );

  const handleCustomSubmit = useCallback(() => {
    if (!customLabel.trim()) return;
    tagEvent("custom", customLabel.trim());
    setCustomLabel("");
    setShowCustom(false);
  }, [customLabel, tagEvent]);

  const handleDeleteEvent = useCallback(
    async (eventId: string) => {
      try {
        await api.delete(`/film/events/${eventId}`);
        setEvents((prev) => prev.filter((e) => e.id !== eventId));
        toast.success("Event deleted");
      } catch {
        toast.error("Failed to delete event");
      }
    },
    []
  );

  // Keyboard shortcuts (1-9 for favourite buttons)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't fire when typing in an input
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const num = parseInt(e.key);
      if (num >= 1 && num <= favouriteButtons.length) {
        e.preventDefault();
        const btn = favouriteButtons[num - 1];
        tagEvent(btn.type);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [favouriteButtons, tagEvent]);

  // Close "More" popover on click outside
  useEffect(() => {
    if (!showMore) return;
    const handler = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setShowMore(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showMore]);

  // Show most recent 5 events
  const recentEvents = events.slice(0, 5);

  const renderButton = (btn: EventButtonDef, index?: number) => {
    const isFlashing = flashType === btn.type;
    const isTagging = taggingType === btn.type;
    const dotColor = CATEGORY_DOT_COLOR[btn.category];

    return (
      <button
        key={btn.type}
        onClick={() => tagEvent(btn.type)}
        disabled={isTagging}
        className={`relative flex items-center gap-1.5 rounded-lg px-3 py-2 font-medium text-sm transition-all duration-150 ${
          isFlashing
            ? "bg-[#14B8A6] text-white"
            : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
        } ${isTagging ? "opacity-50" : ""}`}
        title={btn.tooltip}
      >
        <span className={`w-2 h-2 rounded-full shrink-0 ${isFlashing ? "bg-white" : dotColor}`} />
        {isTagging ? (
          <Loader2 size={13} className="animate-spin" />
        ) : (
          btn.label
        )}
        {index !== undefined && (
          <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded bg-navy/10 text-navy text-[9px] flex items-center justify-center font-mono font-bold">
            {index + 1}
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="bg-white rounded-xl border border-border p-4">
      {/* Favourite buttons row with keyboard shortcut badges */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {favouriteButtons.map((btn, i) => renderButton(btn, i))}

        {/* More button */}
        <div className="relative" ref={moreRef}>
          <button
            onClick={() => setShowMore(!showMore)}
            className="flex items-center gap-1 rounded-lg px-3 py-2 font-medium text-sm bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
            title="Show more event types"
          >
            More
            <ChevronDown size={14} className={`transition-transform ${showMore ? "rotate-180" : ""}`} />
          </button>

          {/* More popover */}
          {showMore && (
            <div className="absolute left-0 top-full mt-1 w-72 bg-white rounded-xl border border-border shadow-lg z-30 p-3 space-y-3">
              {Object.entries(moreByCategory).map(([category, buttons]) => (
                <div key={category}>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1.5">
                    {CATEGORY_LABELS[category] || category}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {buttons.map((btn) => renderButton(btn))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Custom inline input */}
        {showCustom && (
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={customLabel}
              onChange={(e) => setCustomLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCustomSubmit();
                if (e.key === "Escape") {
                  setShowCustom(false);
                  setCustomLabel("");
                }
              }}
              placeholder="Event name..."
              className="border border-border rounded-lg px-2.5 py-1.5 text-sm text-navy w-28 focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
              autoFocus
            />
            <button
              onClick={handleCustomSubmit}
              className="text-teal hover:text-teal/80 transition-colors"
            >
              <Plus size={16} />
            </button>
            <button
              onClick={() => {
                setShowCustom(false);
                setCustomLabel("");
              }}
              className="text-muted hover:text-navy transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Mini toast pill */}
      {miniToast && (
        <div className="mt-2 inline-flex items-center gap-1.5 bg-teal text-white text-xs font-medium px-3 py-1 rounded-full animate-pulse">
          {miniToast}
        </div>
      )}

      {/* Keyboard shortcuts legend */}
      <p className="mt-2 text-[10px] text-muted/40 leading-tight">
        Keyboard shortcuts:{" "}
        {favouriteButtons.map((btn, i) => (
          <span key={btn.type}>
            {i > 0 && ", "}
            <span className="font-mono font-bold text-muted/60">{i + 1}</span>={btn.label}
          </span>
        ))}
      </p>

      {/* Recent events */}
      {!loading && recentEvents.length > 0 && (
        <div className="mt-3 space-y-1">
          <p className="text-[10px] font-oswald uppercase tracking-wider text-muted/60 mb-1">
            Recent Events
          </p>
          {recentEvents.map((evt) => (
            <div
              key={evt.id}
              className="flex items-center justify-between py-1 group"
            >
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-teal font-mono flex items-center gap-0.5">
                  <Clock size={9} />
                  {formatTime(evt.time_seconds)}
                </span>
                <span className="text-[11px] text-navy capitalize">
                  {evt.event_label || evt.event_type.replace(/_/g, " ")}
                </span>
              </div>
              <button
                onClick={() => handleDeleteEvent(evt.id)}
                className="text-muted/0 group-hover:text-muted/50 hover:!text-red-500 transition-all p-0.5"
                title="Delete event"
              >
                <Trash2 size={11} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
