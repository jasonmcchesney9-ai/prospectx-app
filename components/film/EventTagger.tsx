"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Plus,
  Trash2,
  Loader2,
  Clock,
  X,
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

const CATEGORY_GROUPS: { key: string; label: string }[] = [
  { key: "offensive", label: "Offensive" },
  { key: "defensive", label: "Defensive" },
  { key: "special_teams", label: "Special Teams" },
  { key: "other", label: "Other" },
];

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
  const [miniToast, setMiniToast] = useState<string | null>(null);
  const miniToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Group buttons by category
  const buttonsByCategory = CATEGORY_GROUPS.map((g) => ({
    ...g,
    buttons: ALL_EVENT_BUTTONS.filter((b) => b.category === g.key),
  }));

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
  const favouriteButtons = ALL_EVENT_BUTTONS.filter((b) => FAVOURITE_TYPES.includes(b.type));
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

  // Show most recent 5 events
  const recentEvents = events.slice(0, 5);

  // Get keyboard shortcut index for a button (1-9 for favourites, undefined otherwise)
  const getShortcutIndex = (type: string): number | undefined => {
    const idx = FAVOURITE_TYPES.indexOf(type);
    return idx >= 0 ? idx : undefined;
  };

  return (
    <div className="overflow-hidden" style={{ borderRadius: 12, border: "1.5px solid #DDE6EF", borderLeft: "3px solid #0D9488" }}>
      {/* Navy header */}
      <div className="flex items-center gap-2 px-5 py-3" style={{ background: "#0F2942" }}>
        <span className="w-2 h-2 rounded-full" style={{ background: "#0D9488" }} />
        <span
          className="font-bold uppercase text-white"
          style={{ fontSize: 10, fontFamily: "ui-monospace, monospace", letterSpacing: 2 }}
        >
          EVENT TAGGER
        </span>
      </div>

      <div className="bg-white px-4 py-3">
        {/* All 22 buttons grouped by category */}
        <div className="space-y-2">
          {buttonsByCategory.map((group) => (
            <div key={group.key}>
              <p
                className="font-bold uppercase mb-1"
                style={{ fontSize: 9, fontFamily: "ui-monospace, monospace", letterSpacing: 1, color: "#8BA4BB" }}
              >
                {group.label}
              </p>
              <div className="flex items-center gap-1 flex-wrap">
                {group.buttons.map((btn) => {
                  const isFlashing = flashType === btn.type;
                  const isTagging = taggingType === btn.type;
                  const dotColor = CATEGORY_DOT_COLOR[btn.category];
                  const shortcutIdx = getShortcutIndex(btn.type);

                  return (
                    <button
                      key={btn.type}
                      onClick={() => tagEvent(btn.type)}
                      disabled={isTagging}
                      className={`relative flex items-center gap-1 rounded-lg px-2.5 py-1.5 font-medium text-xs transition-all duration-150 ${
                        isFlashing
                          ? "text-white"
                          : "bg-white text-slate-700 hover:bg-slate-50"
                      } ${isTagging ? "opacity-50" : ""}`}
                      style={isFlashing
                        ? { background: "#14B8A6" }
                        : { border: "1px solid #DDE6EF" }
                      }
                      title={btn.tooltip}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isFlashing ? "bg-white" : dotColor}`} />
                      {isTagging ? (
                        <Loader2 size={11} className="animate-spin" />
                      ) : (
                        btn.label
                      )}
                      {shortcutIdx !== undefined && (
                        <span
                          className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded flex items-center justify-center font-bold"
                          style={{ fontSize: 8, fontFamily: "ui-monospace, monospace", background: "rgba(15,41,66,0.08)", color: "#0F2942" }}
                        >
                          {shortcutIdx + 1}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Custom inline input */}
        {showCustom && (
          <div className="flex items-center gap-1 mt-2">
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
              className="rounded-lg px-2.5 py-1.5 text-xs w-28 focus:outline-none focus:ring-2 focus:ring-teal/30"
              style={{ color: "#0F2942", border: "1.5px solid #DDE6EF" }}
              autoFocus
            />
            <button
              onClick={handleCustomSubmit}
              className="transition-colors" style={{ color: "#0D9488" }}
            >
              <Plus size={14} />
            </button>
            <button
              onClick={() => {
                setShowCustom(false);
                setCustomLabel("");
              }}
              className="transition-colors" style={{ color: "#5A7291" }}
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Mini toast pill */}
        {miniToast && (
          <div
            className="mt-2 inline-flex items-center gap-1.5 text-white text-xs font-medium px-3 py-1 rounded-full animate-pulse"
            style={{ background: "#0D9488" }}
          >
            {miniToast}
          </div>
        )}

        {/* Keyboard shortcuts legend */}
        <p className="mt-2 text-[9px] leading-tight" style={{ color: "#8BA4BB" }}>
          Keys:{" "}
          {favouriteButtons.map((btn, i) => (
            <span key={btn.type}>
              {i > 0 && "  "}
              <span className="font-bold" style={{ fontFamily: "ui-monospace, monospace", color: "#5A7291" }}>{i + 1}</span>={btn.label}
            </span>
          ))}
        </p>

        {/* Recent events */}
        {!loading && recentEvents.length > 0 && (
          <div className="mt-3 space-y-1" style={{ borderTop: "1px solid #DDE6EF", paddingTop: 8 }}>
            <p
              className="font-bold uppercase mb-1"
              style={{ fontSize: 9, fontFamily: "ui-monospace, monospace", letterSpacing: 1, color: "#8BA4BB" }}
            >
              Recent Events
            </p>
            {recentEvents.map((evt) => (
              <div
                key={evt.id}
                className="flex items-center justify-between py-1 group"
              >
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-0.5 text-[10px]" style={{ fontFamily: "ui-monospace, monospace", color: "#0D9488" }}>
                    <Clock size={9} />
                    {formatTime(evt.time_seconds)}
                  </span>
                  <span className="text-[11px] capitalize" style={{ color: "#0F2942" }}>
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
    </div>
  );
}
