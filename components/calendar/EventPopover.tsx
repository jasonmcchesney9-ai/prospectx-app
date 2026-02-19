"use client";

import { useEffect, useRef } from "react";
import { MapPin, Clock, Edit3, Trash2, X, Rss } from "lucide-react";
import type { CalendarEvent } from "@/types/api";
import { EVENT_TYPE_COLORS, EVENT_TYPE_LABELS } from "@/types/api";

interface EventPopoverProps {
  event: CalendarEvent;
  onClose: () => void;
  onEdit?: (event: CalendarEvent) => void;
  onDelete?: (eventId: string) => void;
  canEdit: boolean;
}

export default function EventPopover({ event, onClose, onEdit, onDelete, canEdit }: EventPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  const startDate = new Date(event.start_time);
  const dateStr = startDate.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const timeStr = startDate.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  const endDate = event.end_time ? new Date(event.end_time) : null;
  const endTimeStr = endDate
    ? endDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : null;

  const typeColor = EVENT_TYPE_COLORS[event.type] || "#9CA3AF";
  const isManual = event.source === "MANUAL";

  return (
    <div
      ref={ref}
      className="bg-white rounded-xl border border-border shadow-lg p-4 w-80 max-w-full z-50"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span
            className="w-3 h-3 rounded-full shrink-0"
            style={{ backgroundColor: typeColor }}
          />
          <h4 className="text-sm font-semibold text-navy truncate">{event.title}</h4>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-navy/5 rounded transition-colors shrink-0">
          <X size={14} className="text-muted" />
        </button>
      </div>

      {/* Type badge */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        <span
          className="text-[10px] font-oswald font-bold uppercase tracking-wider px-2 py-0.5 rounded-full text-white"
          style={{ backgroundColor: typeColor }}
        >
          {EVENT_TYPE_LABELS[event.type] || event.type}
        </span>
        {!isManual && (
          <span className="text-[10px] font-oswald uppercase tracking-wider px-2 py-0.5 rounded-full bg-navy/5 text-navy/60 flex items-center gap-1">
            <Rss size={8} /> {event.source}
          </span>
        )}
      </div>

      {/* Details */}
      <div className="space-y-2 text-xs text-navy">
        <div className="flex items-center gap-2">
          <Clock size={12} className="text-muted shrink-0" />
          <span>
            {dateStr} &middot; {timeStr}
            {endTimeStr && ` — ${endTimeStr}`}
          </span>
        </div>

        {event.location && (
          <div className="flex items-center gap-2">
            <MapPin size={12} className="text-muted shrink-0" />
            <span className="truncate">{event.location}</span>
          </div>
        )}

        {event.opponent_name && (
          <div className="flex items-center gap-2">
            <span className="text-muted shrink-0 text-[10px] font-bold">
              {event.is_home === 1 ? "vs" : "@"}
            </span>
            <span>{event.opponent_name}</span>
          </div>
        )}

        {event.description && (
          <p className="text-muted/70 text-[11px] border-t border-border pt-2 mt-2">
            {event.description}
          </p>
        )}
      </div>

      {/* Actions */}
      {canEdit && isManual && (
        <div className="flex gap-2 mt-3 pt-3 border-t border-border">
          {onEdit && (
            <button
              onClick={() => onEdit(event)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-teal bg-teal/10 rounded-lg hover:bg-teal/20 transition-colors"
            >
              <Edit3 size={12} /> Edit
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => { if (confirm("Delete this event?")) onDelete(event.id); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
            >
              <Trash2 size={12} /> Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}
