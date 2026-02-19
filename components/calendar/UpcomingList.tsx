"use client";

import { Clock, MapPin, ChevronRight } from "lucide-react";
import type { CalendarEvent } from "@/types/api";
import { EVENT_TYPE_COLORS, EVENT_TYPE_LABELS } from "@/types/api";

interface UpcomingListProps {
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  limit?: number;
}

export default function UpcomingList({ events, onEventClick, limit = 10 }: UpcomingListProps) {
  const now = new Date().toISOString();
  const upcoming = events
    .filter((e) => e.start_time >= now)
    .sort((a, b) => a.start_time.localeCompare(b.start_time))
    .slice(0, limit);

  if (upcoming.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-border p-5">
        <h3 className="text-sm font-oswald font-bold text-navy uppercase tracking-wider mb-3">
          Upcoming
        </h3>
        <div className="text-center py-6">
          <Clock size={24} className="mx-auto text-muted/30 mb-2" />
          <p className="text-sm text-muted">No upcoming events</p>
        </div>
      </div>
    );
  }

  // Group by date
  const grouped: Record<string, CalendarEvent[]> = {};
  for (const evt of upcoming) {
    const d = evt.start_time.slice(0, 10);
    if (!grouped[d]) grouped[d] = [];
    grouped[d].push(evt);
  }

  return (
    <div className="bg-white rounded-xl border border-border p-5">
      <h3 className="text-sm font-oswald font-bold text-navy uppercase tracking-wider mb-3">
        Upcoming
      </h3>
      <div className="space-y-3">
        {Object.entries(grouped).map(([date, dayEvents]) => {
          const d = new Date(date + "T12:00:00");
          const dateLabel = d.toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
          });

          return (
            <div key={date}>
              <p className="text-[10px] font-oswald uppercase tracking-wider text-muted/60 mb-1.5">
                {dateLabel}
              </p>
              <div className="space-y-1">
                {dayEvents.map((evt) => {
                  const time = new Date(evt.start_time).toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                  });
                  const typeColor = EVENT_TYPE_COLORS[evt.type] || "#9CA3AF";

                  return (
                    <button
                      key={evt.id}
                      onClick={() => onEventClick(evt)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-navy/[0.02] transition-colors text-left group"
                    >
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: typeColor }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-navy truncate group-hover:text-teal transition-colors">
                          {evt.title}
                        </p>
                        <div className="flex items-center gap-2 text-[10px] text-muted/60">
                          <span>{time}</span>
                          {evt.location && (
                            <span className="flex items-center gap-0.5 truncate">
                              <MapPin size={8} />
                              {evt.location}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-[9px] font-oswald uppercase tracking-wider px-1.5 py-0.5 rounded text-white shrink-0"
                        style={{ backgroundColor: typeColor }}>
                        {EVENT_TYPE_LABELS[evt.type]?.charAt(0) || "?"}
                      </span>
                      <ChevronRight size={12} className="text-muted/30 group-hover:text-teal transition-colors shrink-0" />
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
