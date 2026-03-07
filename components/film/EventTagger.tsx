"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Plus,
  Trash2,
  Loader2,
  Clock,
  X,
  HelpCircle,
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
  cinemaMode?: boolean;
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
  cinemaMode = false,
}: EventTaggerProps) {
  const [events, setEvents] = useState<VideoEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCustom, setShowCustom] = useState(false);
  const [customLabel, setCustomLabel] = useState("");
  const [taggingType, setTaggingType] = useState<string | null>(null);
  const [flashType, setFlashType] = useState<string | null>(null);
  const [miniToast, setMiniToast] = useState<string | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const miniToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [lastTag, setLastTag] = useState<{ name: string; time: string } | null>(null);
  const [showCinemaOverlay, setShowCinemaOverlay] = useState(false);
  const [pulseType, setPulseType] = useState<string | null>(null);
  const [activeTagTab, setActiveTagTab] = useState<"all" | "offensive" | "defensive" | "special_teams">(() => {
    try {
      const stored = sessionStorage.getItem(`tag_tab_${sessionId}`);
      if (stored === "offensive" || stored === "defensive" || stored === "special_teams") return stored;
    } catch { /* */ }
    return "all";
  });

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

        // Last tag feedback
        const displayLabel = label || eventType.replace(/_/g, " ");
        setLastTag({ name: displayLabel, time: formatTime(time) });

        // Pulse animation (600ms)
        setPulseType(eventType);
        setTimeout(() => setPulseType(null), 600);

        // Mini toast (keep for backwards compat)
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

  // Cinema strip — 6 most-used tag types
  const CINEMA_STRIP_TYPES = ["goal", "shot", "chance", "entry", "hit", "turnover"];
  const cinemaStripButtons = ALL_EVENT_BUTTONS.filter((b) => CINEMA_STRIP_TYPES.includes(b.type));

  // ── Cinema Mode: compact floating strip ──
  if (cinemaMode) {
    return (
      <>
        <div
          style={{
            background: "rgba(15,41,66,0.92)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            borderRadius: 8,
            padding: "8px 12px",
            display: "flex",
            flexWrap: "nowrap",
            gap: 8,
            overflowX: "auto",
            alignItems: "center",
          }}
        >
          {cinemaStripButtons.map((btn) => {
            const isPulsing = pulseType === btn.type;
            const isTagging = taggingType === btn.type;
            return (
              <button
                key={btn.type}
                onClick={() => tagEvent(btn.type)}
                disabled={isTagging}
                style={{
                  background: isPulsing ? "#0D9488" : "rgba(255,255,255,0.06)",
                  border: isPulsing ? "1px solid #0D9488" : "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 6,
                  fontFamily: "'Oswald', sans-serif",
                  fontWeight: 600,
                  fontSize: 10,
                  color: isPulsing ? "#FFFFFF" : "rgba(255,255,255,0.8)",
                  padding: "4px 10px",
                  cursor: "pointer",
                  textTransform: "uppercase" as const,
                  letterSpacing: "0.03em",
                  whiteSpace: "nowrap" as const,
                  flexShrink: 0,
                  opacity: isTagging ? 0.5 : 1,
                  transition: "all 0.15s ease",
                }}
                title={btn.tooltip}
                onMouseEnter={(e) => { if (!isPulsing) { (e.currentTarget as HTMLButtonElement).style.background = "rgba(13,148,136,0.2)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "#0D9488"; (e.currentTarget as HTMLButtonElement).style.color = "#FFFFFF"; } }}
                onMouseLeave={(e) => { if (!isPulsing) { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.06)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.12)"; (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.8)"; } }}
              >
                {isTagging ? <Loader2 size={10} className="animate-spin" /> : btn.label}
              </button>
            );
          })}
          {/* MORE + button */}
          <button
            onClick={() => setShowCinemaOverlay(true)}
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 6,
              fontFamily: "'Oswald', sans-serif",
              fontWeight: 600,
              fontSize: 10,
              color: "rgba(255,255,255,0.5)",
              padding: "4px 10px",
              cursor: "pointer",
              textTransform: "uppercase" as const,
              letterSpacing: "0.03em",
              whiteSpace: "nowrap" as const,
              flexShrink: 0,
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#FFFFFF"; (e.currentTarget as HTMLButtonElement).style.borderColor = "#0D9488"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.5)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.12)"; }}
          >
            MORE +
          </button>
          {/* Last tag in cinema strip */}
          <span style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 10, color: "#14B8A8", whiteSpace: "nowrap" as const, flexShrink: 0, marginLeft: "auto" }}>
            {lastTag ? `${lastTag.name} @ ${lastTag.time}` : ""}
          </span>
        </div>

        {/* Cinema overlay — full tagger as fixed overlay */}
        {showCinemaOverlay && (
          <div
            style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}
            onClick={() => setShowCinemaOverlay(false)}
          >
            <div style={{ position: "absolute", inset: 0, background: "rgba(15,41,66,0.6)" }} />
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: "relative",
                width: "100%",
                maxWidth: 480,
                maxHeight: "70vh",
                borderRadius: 12,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                border: "1.5px solid rgba(255,255,255,0.1)",
                boxShadow: "0 25px 50px rgba(15,41,66,0.4)",
              }}
            >
              {/* Overlay header */}
              <div className="flex items-center justify-between" style={{ background: "#0F2942", padding: "10px 16px" }}>
                <span style={{ fontSize: 11, fontFamily: "'Oswald', sans-serif", fontWeight: 600, letterSpacing: "0.1em", color: "rgba(255,255,255,0.7)", textTransform: "uppercase" as const }}>
                  ALL TAGS
                </span>
                <button onClick={() => setShowCinemaOverlay(false)} style={{ color: "rgba(255,255,255,0.5)", background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                  <X size={14} />
                </button>
              </div>
              {/* Overlay body — all tag buttons */}
              <div style={{ background: "#0F2942", padding: "12px 16px", overflowY: "auto", flex: 1 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {buttonsByCategory.map((group) => (
                    <div key={group.key}>
                      <p style={{ fontSize: 9, fontFamily: "'Oswald', sans-serif", fontWeight: 700, letterSpacing: "0.1em", color: "#14B8A8", textTransform: "uppercase" as const, marginBottom: 6 }}>
                        {group.label}
                      </p>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {group.buttons.map((btn) => {
                          const isPulsing = pulseType === btn.type;
                          const isTagging = taggingType === btn.type;
                          return (
                            <button
                              key={btn.type}
                              onClick={() => tagEvent(btn.type)}
                              disabled={isTagging}
                              style={{
                                background: isPulsing ? "#0D9488" : "rgba(255,255,255,0.06)",
                                border: isPulsing ? "1px solid #0D9488" : "1px solid rgba(255,255,255,0.12)",
                                borderRadius: 6,
                                fontFamily: "'Oswald', sans-serif",
                                fontWeight: 600,
                                fontSize: 11,
                                color: isPulsing ? "#FFFFFF" : "rgba(255,255,255,0.8)",
                                padding: "6px 12px",
                                cursor: "pointer",
                                textTransform: "uppercase" as const,
                                letterSpacing: "0.03em",
                                opacity: isTagging ? 0.5 : 1,
                                transition: "all 0.15s ease",
                              }}
                              title={btn.tooltip}
                              onMouseEnter={(e) => { if (!isPulsing) { (e.currentTarget as HTMLButtonElement).style.background = "rgba(13,148,136,0.2)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "#0D9488"; (e.currentTarget as HTMLButtonElement).style.color = "#FFFFFF"; } }}
                              onMouseLeave={(e) => { if (!isPulsing) { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.06)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.12)"; (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.8)"; } }}
                            >
                              {isTagging ? <Loader2 size={10} className="animate-spin" /> : btn.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                {/* Last tag in overlay */}
                <div className="mt-3" style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 10 }}>
                  {lastTag ? (
                    <span style={{ color: "#14B8A8" }}>Last tag: {lastTag.name} at {lastTag.time}</span>
                  ) : (
                    <span style={{ color: "rgba(255,255,255,0.3)" }}>No tags yet</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // ── Normal Mode: full tagger panel ──
  return (
    <div className="overflow-hidden" style={{ borderRadius: 12, border: "1.5px solid rgba(255,255,255,0.1)", borderLeft: "3px solid #0D9488" }}>
      {/* Navy header */}
      <div className="flex items-center gap-2" style={{ background: "#0F2942", padding: "10px 16px" }}>
        <span className="w-2 h-2 rounded-full" style={{ background: "#0D9488" }} />
        <span
          className="uppercase"
          style={{ fontSize: 11, fontFamily: "'Oswald', sans-serif", fontWeight: 600, letterSpacing: "0.1em", color: "rgba(255,255,255,0.7)" }}
        >
          EVENT TAGGER
        </span>
      </div>

      <div className="px-4 py-3" style={{ background: "#0F2942" }}>
        {/* Category tab bar */}
        <div className="flex items-center gap-1 mb-3">
          {([
            { value: "all" as const, label: "All" },
            { value: "offensive" as const, label: "Offensive" },
            { value: "defensive" as const, label: "Defensive" },
            { value: "special_teams" as const, label: "Special Teams" },
          ]).map((tab) => (
            <button
              key={tab.value}
              onClick={() => {
                setActiveTagTab(tab.value);
                try { sessionStorage.setItem(`tag_tab_${sessionId}`, tab.value); } catch { /* */ }
              }}
              className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition-colors"
              style={activeTagTab === tab.value
                ? { fontFamily: "'Oswald', sans-serif", letterSpacing: "0.1em", background: "#0D9488", color: "#FFFFFF" }
                : { fontFamily: "'Oswald', sans-serif", letterSpacing: "0.1em", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.12)", background: "transparent" }
              }
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Buttons grouped by category, filtered by active tab */}
        <div className="space-y-2">
          {buttonsByCategory
            .filter((group) => activeTagTab === "all" ? true : group.key === activeTagTab)
            .map((group) => (
            <div key={group.key}>
              {activeTagTab === "all" && (
                <p
                  className="uppercase"
                  style={{ fontSize: 9, fontFamily: "'Oswald', sans-serif", fontWeight: 700, letterSpacing: "0.1em", color: "#14B8A8", marginBottom: 6 }}
                >
                  {group.label}
                </p>
              )}
              <div className="flex items-center gap-1 flex-wrap">
                {group.buttons.map((btn) => {
                  const isPulsing = pulseType === btn.type;
                  const isTagging = taggingType === btn.type;
                  const shortcutIdx = getShortcutIndex(btn.type);
                  const count = events.filter((e) => e.event_type === btn.type).length;

                  return (
                    <button
                      key={btn.type}
                      onClick={() => tagEvent(btn.type)}
                      disabled={isTagging}
                      className={`relative flex items-center gap-1.5 transition-all duration-150 ${isTagging ? "opacity-50" : ""}`}
                      style={{
                        background: isPulsing ? "#0D9488" : "rgba(255,255,255,0.06)",
                        border: isPulsing ? "1px solid #0D9488" : "1px solid rgba(255,255,255,0.12)",
                        borderRadius: 6,
                        fontFamily: "'Oswald', sans-serif",
                        fontWeight: 600,
                        fontSize: 11,
                        color: isPulsing ? "#FFFFFF" : "rgba(255,255,255,0.8)",
                        padding: "6px 12px",
                        cursor: "pointer",
                        textTransform: "uppercase" as const,
                        letterSpacing: "0.03em",
                      }}
                      title={btn.tooltip}
                      onMouseEnter={(e) => { if (!isPulsing) { (e.currentTarget as HTMLButtonElement).style.background = "rgba(13,148,136,0.2)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "#0D9488"; (e.currentTarget as HTMLButtonElement).style.color = "#FFFFFF"; } }}
                      onMouseLeave={(e) => { if (!isPulsing) { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.06)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.12)"; (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.8)"; } }}
                    >
                      {isTagging ? (
                        <Loader2 size={11} className="animate-spin" />
                      ) : (
                        btn.label
                      )}
                      {count > 0 && (
                        <span
                          style={{
                            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                            fontSize: 9,
                            background: "rgba(13,148,136,0.3)",
                            borderRadius: 10,
                            padding: "1px 5px",
                            color: "#FFFFFF",
                          }}
                        >
                          {count}
                        </span>
                      )}
                      {shortcutIdx !== undefined && (
                        <span
                          className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded flex items-center justify-center font-bold"
                          style={{ fontSize: 8, fontFamily: "'JetBrains Mono', ui-monospace, monospace", background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.6)" }}
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
              className="rounded-lg px-2.5 py-1.5 text-xs w-28 focus:outline-none"
              style={{ color: "#FFFFFF", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.2)" }}
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
              className="transition-colors" style={{ color: "rgba(255,255,255,0.4)" }}
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Last tag feedback line */}
        <div className="mt-2" style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 10 }}>
          {lastTag ? (
            <span style={{ color: "#14B8A8" }}>Last tag: {lastTag.name} at {lastTag.time}</span>
          ) : (
            <span style={{ color: "rgba(255,255,255,0.3)" }}>No tags yet</span>
          )}
        </div>

        {/* Keyboard shortcuts legend — collapsible */}
        <div className="mt-2 flex items-start gap-1">
          <button
            onClick={() => setShowShortcuts(!showShortcuts)}
            className="shrink-0 p-0.5 rounded transition-colors hover:opacity-70"
            style={{ color: "rgba(255,255,255,0.4)" }}
            title="Keyboard shortcuts"
          >
            <HelpCircle size={12} />
          </button>
          {showShortcuts && (
            <p className="text-[9px] leading-tight" style={{ color: "rgba(255,255,255,0.4)" }}>
              Keys:{" "}
              {favouriteButtons.map((btn, i) => (
                <span key={btn.type}>
                  {i > 0 && "  "}
                  <span className="font-bold" style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", color: "rgba(255,255,255,0.6)" }}>{i + 1}</span>={btn.label}
                </span>
              ))}
            </p>
          )}
        </div>

        {/* Recent events */}
        {!loading && recentEvents.length > 0 && (
          <div className="mt-3 space-y-1" style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 8 }}>
            <p
              className="uppercase"
              style={{ fontSize: 9, fontFamily: "'Oswald', sans-serif", fontWeight: 700, letterSpacing: "0.1em", color: "#14B8A8", marginBottom: 4 }}
            >
              Recent Events
            </p>
            {recentEvents.map((evt) => (
              <div
                key={evt.id}
                className="flex items-center justify-between py-1 group"
              >
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-0.5 text-[10px]" style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", color: "#0D9488" }}>
                    <Clock size={9} />
                    {formatTime(evt.time_seconds)}
                  </span>
                  <span className="text-[11px] capitalize" style={{ color: "rgba(255,255,255,0.8)" }}>
                    {evt.event_label || evt.event_type.replace(/_/g, " ")}
                  </span>
                </div>
                <button
                  onClick={() => handleDeleteEvent(evt.id)}
                  className="transition-all p-0.5"
                  style={{ color: "rgba(255,255,255,0)" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#EF4444"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0)"; }}
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
