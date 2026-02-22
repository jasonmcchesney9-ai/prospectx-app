"use client";

import { useState, useRef, useEffect } from "react";
import { Clock, Plus, Copy, Check, Bookmark } from "lucide-react";
import type { TimelineEntry, TimelineEntryType, GameState, BroadcastEventType } from "@/types/api";
import { TIMELINE_TYPE_COLORS, BROADCAST_EVENT_CONFIG } from "@/types/api";

/* ── Period label helper ─────────────────────────────── */
function gameStateToPeriodLabel(gameState: GameState, period: number): string {
  if (gameState === "pre_game") return "Pre-Game";
  if (gameState === "post_game") return "Post-Game";
  if (gameState === "intermission") return `INT ${period}`;
  // live
  if (period === 1) return "1st";
  if (period === 2) return "2nd";
  if (period === 3) return "3rd";
  if (period >= 4) return "OT";
  return `P${period}`;
}

/* ── Generate unique id ──────────────────────────────── */
let _timelineSeq = 0;
function genTimelineId(): string {
  _timelineSeq += 1;
  return `tl_${Date.now()}_${_timelineSeq}`;
}

/* ── Component ───────────────────────────────────────── */
interface Props {
  entries: TimelineEntry[];
  onAddEntry: (entry: TimelineEntry) => void;
  onToggleNextBreak?: (entryId: string) => void;
  gameState: GameState;
  period: number;
}

export default function StorylineTimeline({ entries, onAddEntry, onToggleNextBreak, gameState, period }: Props) {
  const [noteText, setNoteText] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toastEvent, setToastEvent] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Event bar handler
  function handleEventButton(eventType: BroadcastEventType) {
    const cfg = BROADCAST_EVENT_CONFIG[eventType];
    const entry: TimelineEntry = {
      id: genTimelineId(),
      type: cfg.timelineType,
      text: cfg.label,
      period: gameStateToPeriodLabel(gameState, period),
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      source: "event_bar",
      color_badge: eventType,
    };
    onAddEntry(entry);
    setToastEvent(`${cfg.label} logged`);
    setTimeout(() => setToastEvent(null), 3000);
  }

  // Auto-scroll to bottom when entries change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries.length]);

  function handleAddNote() {
    const text = noteText.trim();
    if (!text) return;
    const entry: TimelineEntry = {
      id: genTimelineId(),
      type: "note",
      text,
      period: gameStateToPeriodLabel(gameState, period),
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      source: "manual",
    };
    onAddEntry(entry);
    setNoteText("");
  }

  function handleCopy(entry: TimelineEntry) {
    navigator.clipboard.writeText(entry.text).catch(() => {});
    setCopiedId(entry.id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  // Group entries by period
  const grouped = entries.reduce<Record<string, TimelineEntry[]>>((acc, e) => {
    if (!acc[e.period]) acc[e.period] = [];
    acc[e.period].push(e);
    return acc;
  }, {});

  const periodOrder = ["Pre-Game", "1st", "INT 1", "2nd", "INT 2", "3rd", "INT 3", "OT", "Post-Game"];
  const sortedPeriods = Object.keys(grouped).sort(
    (a, b) => (periodOrder.indexOf(a) === -1 ? 99 : periodOrder.indexOf(a)) - (periodOrder.indexOf(b) === -1 ? 99 : periodOrder.indexOf(b))
  );

  /* ── Event Bar ── */
  const eventBar = (
    <div className="flex flex-wrap gap-1.5 mb-3">
      {(Object.keys(BROADCAST_EVENT_CONFIG) as BroadcastEventType[]).map((evType) => {
        const cfg = BROADCAST_EVENT_CONFIG[evType];
        return (
          <button
            key={evType}
            onClick={() => handleEventButton(evType)}
            className={`flex items-center gap-1 px-3 py-2.5 rounded-lg text-[10px] font-oswald font-bold uppercase tracking-wider transition-colors min-h-[44px] ${cfg.bgColor} ${cfg.color} hover:opacity-80 active:scale-95`}
            title={`${cfg.label} (${cfg.shortcut})`}
          >
            {cfg.label}
            <span className="text-[8px] opacity-50 ml-0.5">{cfg.shortcut}</span>
          </button>
        );
      })}
    </div>
  );

  /* ── Toast ── */
  const toast = toastEvent && (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-navy text-white text-xs font-oswald uppercase tracking-wider px-4 py-2 rounded-lg shadow-lg animate-pulse">
      {toastEvent}
    </div>
  );

  /* ── Empty state ── */
  if (entries.length === 0) {
    return (
      <div className="space-y-3">
        {eventBar}
        <div className="text-center py-6">
          <Clock size={24} className="mx-auto text-gray-300 mb-2" />
          <p className="text-xs text-gray-400">
            Storylines will appear here as you generate content and progress through the game.
          </p>
          <p className="text-[10px] text-gray-300 mt-1">
            Use the event buttons above or add notes manually below.
          </p>
        </div>
        {/* Add note input */}
        <div className="flex gap-2">
          <input
            type="text"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddNote()}
            placeholder="Add a note..."
            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-xs text-navy placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
          />
          <button
            type="button"
            onClick={handleAddNote}
            disabled={!noteText.trim()}
            className="flex items-center gap-1 px-3 py-2 rounded-lg bg-teal text-white text-xs font-bold hover:bg-teal/90 transition-colors disabled:opacity-40 shrink-0"
          >
            <Plus size={12} />
            Add
          </button>
        </div>
        {toast}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Event bar */}
      {eventBar}

      {/* Scrollable timeline */}
      <div ref={scrollRef} className="max-h-[400px] overflow-y-auto pr-1 space-y-0">
        {sortedPeriods.map((periodLabel) => (
          <div key={periodLabel}>
            {/* Period header */}
            <div className="sticky top-0 z-10 flex items-center gap-2 py-1.5 bg-white">
              <div className="h-px flex-1 bg-gray-200" />
              <span className="text-[9px] font-oswald uppercase tracking-widest text-navy/50 font-bold px-2 bg-white">
                {periodLabel}
              </span>
              <div className="h-px flex-1 bg-gray-200" />
            </div>

            {/* Entries in this period */}
            <div className="relative ml-3 border-l-2 border-gray-200 pl-4 space-y-2 pb-2">
              {grouped[periodLabel].map((entry) => {
                const colors = TIMELINE_TYPE_COLORS[entry.type];
                return (
                  <div key={entry.id} className="group relative">
                    {/* Dot on timeline */}
                    <div className={`absolute -left-[1.3rem] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-white ${colors.bg.replace("/10", "").replace("-100", "-400")} ring-2 ring-gray-200`} />

                    <div className={`flex items-start gap-2 rounded-lg border px-3 py-2 ${colors.border} ${colors.bg}`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className={`text-[9px] font-oswald uppercase tracking-wider font-bold ${colors.text}`}>
                            {colors.label}
                          </span>
                          <span className="text-[9px] text-gray-400">{entry.timestamp}</span>
                          {entry.source === "manual" && (
                            <span className="text-[8px] px-1 py-0.5 rounded bg-gray-200 text-gray-500">manual</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-700 leading-relaxed">{entry.text}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        {onToggleNextBreak && (
                          <button
                            type="button"
                            onClick={() => onToggleNextBreak(entry.id)}
                            className={`p-1 rounded transition-colors ${entry.in_next_break ? "text-orange" : "text-gray-400 hover:text-orange"}`}
                            title={entry.in_next_break ? "Remove from Next Break" : "Add to Next Break"}
                          >
                            <Bookmark size={12} className={entry.in_next_break ? "fill-current" : ""} />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleCopy(entry)}
                          className="p-1 rounded hover:bg-white/50 text-gray-400 hover:text-gray-600"
                          title="Copy"
                        >
                          {copiedId === entry.id ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Add note input */}
      <div className="flex gap-2 pt-1 border-t border-gray-100">
        <input
          type="text"
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAddNote()}
          placeholder="Add a note..."
          className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-xs text-navy placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
        />
        <button
          type="button"
          onClick={handleAddNote}
          disabled={!noteText.trim()}
          className="flex items-center gap-1 px-3 py-2 rounded-lg bg-teal text-white text-xs font-bold hover:bg-teal/90 transition-colors disabled:opacity-40 shrink-0"
        >
          <Plus size={12} />
          Add
        </button>
      </div>
    </div>
  );
}
