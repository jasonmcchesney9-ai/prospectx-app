"use client";

import { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { CalendarEvent } from "@/types/api";
import { EVENT_TYPE_COLORS } from "@/types/api";

interface CalendarGridProps {
  year: number;
  month: number; // 0-indexed
  events: CalendarEvent[];
  selectedDate: string | null; // YYYY-MM-DD
  onDateSelect: (date: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}

const DAY_LABELS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

export default function CalendarGrid({
  year,
  month,
  events,
  selectedDate,
  onDateSelect,
  onPrevMonth,
  onNextMonth,
}: CalendarGridProps) {
  const monthName = new Date(year, month, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  // Build calendar grid
  const grid = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();

    // Monday-based: getDay() returns 0=Sun, we want Mon=0
    let startDow = firstDay.getDay() - 1;
    if (startDow < 0) startDow = 6;

    const cells: Array<{ day: number | null; date: string }> = [];

    // Leading empty cells
    for (let i = 0; i < startDow; i++) {
      cells.push({ day: null, date: "" });
    }
    // Days of the month
    for (let d = 1; d <= daysInMonth; d++) {
      const mm = String(month + 1).padStart(2, "0");
      const dd = String(d).padStart(2, "0");
      cells.push({ day: d, date: `${year}-${mm}-${dd}` });
    }
    // Trailing empty cells to fill last row
    while (cells.length % 7 !== 0) {
      cells.push({ day: null, date: "" });
    }

    return cells;
  }, [year, month]);

  // Map events by date
  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const evt of events) {
      const d = evt.start_time.slice(0, 10); // YYYY-MM-DD
      if (!map[d]) map[d] = [];
      map[d].push(evt);
    }
    return map;
  }, [events]);

  const todayStr = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD

  return (
    <div className="bg-white rounded-xl border border-border p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={onPrevMonth}
          className="p-1.5 rounded-lg hover:bg-navy/5 transition-colors"
        >
          <ChevronLeft size={18} className="text-navy" />
        </button>
        <h3 className="text-sm font-oswald font-bold text-navy uppercase tracking-wider">
          {monthName}
        </h3>
        <button
          onClick={onNextMonth}
          className="p-1.5 rounded-lg hover:bg-navy/5 transition-colors"
        >
          <ChevronRight size={18} className="text-navy" />
        </button>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {DAY_LABELS.map((d) => (
          <div key={d} className="text-center text-[10px] font-oswald font-bold text-muted/50 uppercase tracking-wider py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Grid cells */}
      <div className="grid grid-cols-7 gap-0.5">
        {grid.map((cell, i) => {
          if (!cell.day) {
            return <div key={i} className="h-12 sm:h-14" />;
          }

          const isToday = cell.date === todayStr;
          const isSelected = cell.date === selectedDate;
          const dayEvents = eventsByDate[cell.date] || [];
          const hasEvents = dayEvents.length > 0;

          return (
            <button
              key={i}
              onClick={() => onDateSelect(cell.date)}
              className={`h-12 sm:h-14 rounded-lg flex flex-col items-center justify-start pt-1 transition-all relative ${
                isSelected
                  ? "bg-teal/10 border-2 border-teal"
                  : isToday
                  ? "bg-teal/5 border border-teal/30"
                  : hasEvents
                  ? "hover:bg-navy/[0.03] border border-transparent hover:border-border"
                  : "border border-transparent hover:bg-navy/[0.02]"
              }`}
            >
              <span
                className={`text-xs font-oswald ${
                  isSelected
                    ? "font-bold text-teal"
                    : isToday
                    ? "font-bold text-teal"
                    : "text-navy"
                }`}
              >
                {cell.day}
              </span>

              {/* Event dots */}
              {hasEvents && (
                <div className="flex gap-0.5 mt-0.5 flex-wrap justify-center max-w-full">
                  {dayEvents.slice(0, 4).map((evt, ei) => (
                    <span
                      key={ei}
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: EVENT_TYPE_COLORS[evt.type] || "#9CA3AF" }}
                    />
                  ))}
                  {dayEvents.length > 4 && (
                    <span className="text-[8px] text-muted">+{dayEvents.length - 4}</span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
