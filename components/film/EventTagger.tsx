"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Target,
  Crosshair,
  Zap,
  ArrowRightLeft,
  ArrowRight,
  ArrowLeft,
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

const EVENT_BUTTONS = [
  { type: "goal", label: "Goal", icon: Target, color: "bg-orange/10 text-orange hover:bg-orange/20" },
  { type: "shot", label: "Shot", icon: Crosshair, color: "bg-teal/10 text-teal hover:bg-teal/20" },
  { type: "hit", label: "Hit", icon: Zap, color: "bg-navy/10 text-navy hover:bg-navy/15" },
  { type: "turnover", label: "Turnover", icon: ArrowRightLeft, color: "bg-red-100 text-red-600 hover:bg-red-200" },
  { type: "entry", label: "Entry", icon: ArrowRight, color: "bg-teal/10 text-teal hover:bg-teal/20" },
  { type: "exit", label: "Exit", icon: ArrowLeft, color: "bg-navy/10 text-navy hover:bg-navy/15" },
];

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
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
      setTaggingType(eventType);
      try {
        const time = Math.floor(getCurrentTime());
        await api.post("/film/events", {
          upload_id: uploadId,
          session_id: sessionId,
          event_type: eventType,
          event_label: label || null,
          time_seconds: time,
        });
        toast.success(`${eventType} tagged at ${formatTime(time)}`);
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

  // Show most recent 5 events
  const recentEvents = events.slice(0, 5);

  return (
    <div className="bg-white rounded-xl border border-border p-4">
      {/* Event buttons row */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {EVENT_BUTTONS.map((btn) => {
          const Icon = btn.icon;
          return (
            <button
              key={btn.type}
              onClick={() => tagEvent(btn.type)}
              disabled={taggingType === btn.type}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-oswald uppercase tracking-wider transition-colors ${btn.color} ${
                taggingType === btn.type ? "opacity-50" : ""
              }`}
              title={`Tag ${btn.label} at current time`}
            >
              {taggingType === btn.type ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Icon size={12} />
              )}
              {btn.label}
            </button>
          );
        })}

        {/* Custom button */}
        {showCustom ? (
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
              className="border border-border rounded px-2 py-1 text-xs text-navy w-24 focus:outline-none focus:ring-1 focus:ring-teal/30"
              autoFocus
            />
            <button
              onClick={handleCustomSubmit}
              className="text-teal hover:text-teal/80 transition-colors"
            >
              <Plus size={14} />
            </button>
            <button
              onClick={() => {
                setShowCustom(false);
                setCustomLabel("");
              }}
              className="text-muted hover:text-navy transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowCustom(true)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-oswald uppercase tracking-wider bg-border/50 text-muted hover:bg-border transition-colors"
          >
            <Plus size={12} />
            Custom
          </button>
        )}
      </div>

      {/* Recent events */}
      {recentEvents.length > 0 && (
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
                  {evt.event_label || evt.event_type}
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
