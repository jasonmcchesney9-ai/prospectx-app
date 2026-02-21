"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Calendar,
  Plus,
  Clipboard,
  Users,
  Globe,
  Database,
  Loader2,
  ChevronDown,
  Check,
  Download,
  Link2,
  Monitor,
  Smartphone,
} from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import CalendarGrid from "@/components/calendar/CalendarGrid";
import EventPopover from "@/components/calendar/EventPopover";
import UpcomingList from "@/components/calendar/UpcomingList";
import FeedConnectModal from "@/components/calendar/FeedConnectModal";
import AddEventModal from "@/components/calendar/AddEventModal";
import api from "@/lib/api";
import { getUser, getToken } from "@/lib/auth";
import type { CalendarEvent, CalendarFeed, Team } from "@/types/api";
import { EVENT_TYPE_COLORS, EVENT_TYPE_LABELS } from "@/types/api";

// ── Platform integration configs ────────────────────────────
const PLATFORMS = [
  {
    provider: "GAMESHEET",
    name: "GameSheet",
    color: "#C8102E",
    icon: Clipboard,
    helpText:
      "Go to League Settings → Calendar Export → Copy ICS URL. This is usually found under your league admin panel.",
  },
  {
    provider: "TEAMSNAP",
    name: "TeamSnap",
    color: "#00B140",
    icon: Users,
    helpText:
      "Go to Schedule → Export → Subscribe to Calendar → Copy the webcal:// or https:// link.",
  },
  {
    provider: "SPORTSENGINE",
    name: "SportsEngine",
    color: "#0066CC",
    icon: Globe,
    helpText:
      "Go to Schedule → Calendar Feed → Copy the ICS URL. Some orgs may need to enable this in admin settings.",
  },
  {
    provider: "SPORDLE",
    name: "Spordle",
    color: "#FF6B00",
    icon: Database,
    helpText:
      "Contact your association admin for the calendar feed URL. Spordle feeds are typically set up by the league admin.",
  },
  {
    provider: "GOOGLE_CALENDAR",
    name: "Google Calendar",
    color: "#4285F4",
    icon: Globe,
    helpText:
      "Go to Google Calendar → Other calendars (+) → From URL → Paste your iCal URL.",
  },
  {
    provider: "APPLE_ICAL",
    name: "Apple Calendar",
    color: "#333333",
    icon: Smartphone,
    helpText:
      "Go to Calendar app → File → New Calendar Subscription → Paste your iCal URL.",
  },
  {
    provider: "OUTLOOK",
    name: "Outlook / Office 365",
    color: "#0078D4",
    icon: Monitor,
    helpText:
      "Go to Outlook Calendar → Add calendar → Subscribe from web → Paste your iCal URL.",
  },
];

// ── Role group (mirrors NavBar) ─────────────────────────────
type RoleGroup = "PRO" | "MEDIA" | "FAMILY" | "AGENT";
const ROLE_GROUP_MAP: Record<string, RoleGroup> = {
  scout: "PRO", coach: "PRO", gm: "PRO",
  player: "FAMILY", parent: "FAMILY",
  broadcaster: "MEDIA", producer: "MEDIA",
  agent: "AGENT",
};

// ── Event type filter options ───────────────────────────────
const EVENT_TYPE_OPTIONS = ["GAME", "PRACTICE", "TOURNAMENT", "SHOWCASE", "MEETING", "DEADLINE"];

export default function SchedulePage() {
  const user = getUser();
  const roleGroup = ROLE_GROUP_MAP[user?.hockey_role || "scout"] || "PRO";

  // ── Calendar state ─────────────────────────────────────────
  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // ── Data ───────────────────────────────────────────────────
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [feeds, setFeeds] = useState<CalendarFeed[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Filters ────────────────────────────────────────────────
  const [typeFilters, setTypeFilters] = useState<Set<string>>(() => {
    if (roleGroup === "MEDIA") return new Set(["GAME"]);
    return new Set<string>();
  });
  const [teamFilter, setTeamFilter] = useState("");

  // ── Modals ─────────────────────────────────────────────────
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [connectPlatform, setConnectPlatform] = useState<typeof PLATFORMS[0] | null>(null);
  const [popoverEvent, setPopoverEvent] = useState<CalendarEvent | null>(null);
  const [showConnectDropdown, setShowConnectDropdown] = useState(false);

  // ── Computed month range ───────────────────────────────────
  const monthStart = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-01`;
  const monthEnd = (() => {
    const last = new Date(calYear, calMonth + 1, 0);
    return `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}`;
  })();

  // ── Load feeds + teams on mount ────────────────────────────
  useEffect(() => {
    Promise.all([
      api.get<CalendarFeed[]>("/api/calendar/feeds").catch(() => ({ data: [] })),
      api.get<Team[]>("/teams").catch(() => ({ data: [] })),
    ]).then(([feedsRes, teamsRes]) => {
      setFeeds(feedsRes.data || []);
      setTeams(teamsRes.data || []);
    });
  }, []);

  // ── Load events for current month ──────────────────────────
  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ from: monthStart, to: monthEnd });
      if (teamFilter) params.set("team_id", teamFilter);
      const { data } = await api.get<CalendarEvent[]>(`/api/calendar/events?${params}`);
      setEvents(data || []);
    } catch (err) {
      console.error("Failed to load events:", err);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [monthStart, monthEnd, teamFilter]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  // ── Filtered events ────────────────────────────────────────
  const filteredEvents = useMemo(() => {
    if (typeFilters.size === 0) return events;
    return events.filter((e) => typeFilters.has(e.type));
  }, [events, typeFilters]);

  // ── Selected date events ───────────────────────────────────
  const selectedDateEvents = useMemo(() => {
    if (!selectedDate) return [];
    return filteredEvents.filter((e) => e.start_time.slice(0, 10) === selectedDate);
  }, [filteredEvents, selectedDate]);

  // ── Month navigation ──────────────────────────────────────
  function prevMonth() {
    if (calMonth === 0) {
      setCalYear(calYear - 1);
      setCalMonth(11);
    } else {
      setCalMonth(calMonth - 1);
    }
    setSelectedDate(null);
  }

  function nextMonth() {
    if (calMonth === 11) {
      setCalYear(calYear + 1);
      setCalMonth(0);
    } else {
      setCalMonth(calMonth + 1);
    }
    setSelectedDate(null);
  }

  // ── Type filter toggle ─────────────────────────────────────
  function toggleTypeFilter(t: string) {
    setTypeFilters((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  }

  // ── Connected feed providers ───────────────────────────────
  const connectedProviders = useMemo(
    () => new Set(feeds.map((f) => f.provider as string)),
    [feeds]
  );

  // ── Handlers ───────────────────────────────────────────────
  function handleDeleteEvent(eventId: string) {
    api.delete(`/api/calendar/events/${eventId}`).then(() => {
      setEvents((prev) => prev.filter((e) => e.id !== eventId));
      setPopoverEvent(null);
    }).catch((err) => console.error("Delete failed:", err));
  }

  function handleEventSaved() {
    loadEvents();
  }

  function handleFeedCreated(feed: CalendarFeed) {
    setFeeds((prev) => [feed, ...prev]);
    loadEvents();
  }

  function handleFeedRemoved(feedId: string) {
    setFeeds((prev) => prev.filter((f) => f.id !== feedId));
    loadEvents();
  }

  // ── Can edit events (PRO, AGENT, not FAMILY) ──────────────
  const canEdit = roleGroup !== "FAMILY";

  return (
    <ProtectedRoute>
      <NavBar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* ── Header ────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-lg bg-teal/10 flex items-center justify-center">
              <Calendar size={22} className="text-teal" />
            </div>
            <div>
              <h1 className="text-2xl font-bold font-oswald text-navy uppercase tracking-wider">
                Calendar & Schedule
              </h1>
              <p className="text-sm text-muted">
                Games, practices, showcases — all in one view
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Connect Calendar dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowConnectDropdown(!showConnectDropdown)}
                className="flex items-center gap-2 px-4 py-2.5 border border-border text-xs font-oswald font-bold uppercase tracking-wider rounded-lg hover:bg-gray-50 transition-all text-navy"
              >
                <Link2 size={14} />
                Connect Calendar
                <ChevronDown size={12} className={`transition-transform ${showConnectDropdown ? "rotate-180" : ""}`} />
              </button>

              {showConnectDropdown && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setShowConnectDropdown(false)} />
                  <div className="absolute right-0 top-full mt-1 w-72 bg-white rounded-xl border border-border shadow-lg z-40 py-1 max-h-[400px] overflow-y-auto">
                    <div className="px-3 py-2 border-b border-border/50">
                      <p className="text-[10px] font-oswald font-bold text-muted uppercase tracking-wider">Import from Platform</p>
                    </div>
                    {PLATFORMS.map((p) => {
                      const Icon = p.icon;
                      const isConnected = connectedProviders.has(p.provider);
                      return (
                        <button
                          key={p.provider}
                          onClick={() => { setConnectPlatform(p); setShowConnectDropdown(false); }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 transition-colors text-left"
                        >
                          <div
                            className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                            style={{ backgroundColor: p.color + "15" }}
                          >
                            <Icon size={14} style={{ color: p.color }} />
                          </div>
                          <span className="text-sm font-medium text-navy flex-1">{p.name}</span>
                          {isConnected ? (
                            <Check size={14} className="text-green-600 shrink-0" />
                          ) : (
                            <span className="text-[10px] text-teal font-oswald uppercase tracking-wider">Connect</span>
                          )}
                        </button>
                      );
                    })}

                    <div className="border-t border-border/50 mt-1 pt-1">
                      <div className="px-3 py-2">
                        <p className="text-[10px] font-oswald font-bold text-muted uppercase tracking-wider">Export</p>
                      </div>
                      <button
                        onClick={async () => {
                          setShowConnectDropdown(false);
                          try {
                            const token = getToken();
                            const baseUrl = api.defaults.baseURL || "";
                            const teamParam = teamFilter ? `?team_id=${teamFilter}` : "";
                            const url = `${baseUrl}/api/calendar/export.ics${teamParam}`;
                            const resp = await fetch(url, {
                              headers: { Authorization: `Bearer ${token}` },
                            });
                            if (!resp.ok) throw new Error("Export failed");
                            const blob = await resp.blob();
                            const a = document.createElement("a");
                            a.href = URL.createObjectURL(blob);
                            a.download = "prospectx-schedule.ics";
                            a.click();
                            URL.revokeObjectURL(a.href);
                          } catch {
                            console.error("iCal export failed");
                          }
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 transition-colors text-left"
                      >
                        <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 bg-teal/10">
                          <Download size={14} className="text-teal" />
                        </div>
                        <div className="flex-1">
                          <span className="text-sm font-medium text-navy block">Export as iCal</span>
                          <span className="text-[10px] text-muted">Subscribe from any calendar app</span>
                        </div>
                      </button>
                    </div>

                    {feeds.length > 0 && (
                      <div className="border-t border-border/50 mt-1 pt-1 px-3 py-2">
                        <p className="text-[10px] font-oswald font-bold text-muted uppercase tracking-wider mb-1">
                          Active Feeds ({feeds.length})
                        </p>
                        {feeds.map((f) => (
                          <div key={f.id} className="flex items-center gap-2 py-1 text-xs text-navy/70">
                            <Check size={10} className="text-green-500" />
                            <span className="truncate">{f.label || f.provider}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {canEdit && (
              <button
                onClick={() => { setEditingEvent(null); setShowAddEvent(true); }}
                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-navy to-navy-light text-white text-xs font-oswald font-bold uppercase tracking-wider rounded-lg hover:shadow-md transition-all"
              >
                <Plus size={14} /> Add Event
              </button>
            )}
          </div>
        </div>

        {/* ── Filters ─────────────────────────────────────── */}
        <div className="flex flex-wrap items-end gap-3 mb-4">
          {/* Type filters */}
          <div>
            <label className="block text-[10px] font-oswald font-bold text-muted uppercase tracking-wider mb-1">
              Event Types
            </label>
            <div className="flex flex-wrap gap-1">
              {EVENT_TYPE_OPTIONS.map((t) => {
                const active = typeFilters.size === 0 || typeFilters.has(t);
                return (
                  <button
                    key={t}
                    onClick={() => toggleTypeFilter(t)}
                    className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium border transition-colors ${
                      active
                        ? "border-transparent text-white"
                        : "border-border text-muted/50 bg-white"
                    }`}
                    style={active ? { backgroundColor: EVENT_TYPE_COLORS[t] } : undefined}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: active ? "#fff" : EVENT_TYPE_COLORS[t] }}
                    />
                    {EVENT_TYPE_LABELS[t]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Team filter */}
          <div className="min-w-[180px]">
            <label className="block text-[10px] font-oswald font-bold text-muted uppercase tracking-wider mb-1">
              Team
            </label>
            <select
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-teal/30"
            >
              <option value="">All Teams</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* ── Calendar + Upcoming ─────────────────────────── */}
        {loading && events.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={28} className="text-teal animate-spin" />
            <span className="ml-3 text-muted text-sm">Loading calendar...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            {/* Calendar Grid */}
            <div className="lg:col-span-3 space-y-4">
              <CalendarGrid
                year={calYear}
                month={calMonth}
                events={filteredEvents}
                selectedDate={selectedDate}
                onDateSelect={setSelectedDate}
                onPrevMonth={prevMonth}
                onNextMonth={nextMonth}
              />

              {/* Selected Date Events */}
              {selectedDate && (
                <div className="bg-white rounded-xl border border-border p-4">
                  <h3 className="text-xs font-oswald font-bold text-navy uppercase tracking-wider mb-3">
                    {new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                    })}
                    <span className="text-muted font-normal ml-2">
                      {selectedDateEvents.length} event{selectedDateEvents.length !== 1 ? "s" : ""}
                    </span>
                  </h3>

                  {selectedDateEvents.length === 0 ? (
                    <div className="text-center py-4">
                      <Calendar size={20} className="mx-auto text-muted/30 mb-1" />
                      <p className="text-xs text-muted">No events on this date</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {selectedDateEvents.map((evt) => (
                        <button
                          key={evt.id}
                          onClick={() => setPopoverEvent(evt)}
                          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-border hover:border-teal/30 hover:bg-navy/[0.02] transition-all text-left"
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: EVENT_TYPE_COLORS[evt.type] || "#9CA3AF" }}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-navy truncate">{evt.title}</p>
                            <p className="text-[10px] text-muted">
                              {new Date(evt.start_time).toLocaleTimeString("en-US", {
                                hour: "numeric",
                                minute: "2-digit",
                              })}
                              {evt.location && ` · ${evt.location}`}
                            </p>
                          </div>
                          <span
                            className="text-[9px] font-oswald uppercase px-1.5 py-0.5 rounded text-white shrink-0"
                            style={{ backgroundColor: EVENT_TYPE_COLORS[evt.type] || "#9CA3AF" }}
                          >
                            {EVENT_TYPE_LABELS[evt.type] || evt.type}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Legend */}
              <div className="flex flex-wrap gap-3 px-1">
                {Object.entries(EVENT_TYPE_LABELS).map(([key, label]) => (
                  <div key={key} className="flex items-center gap-1">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: EVENT_TYPE_COLORS[key] }}
                    />
                    <span className="text-[10px] text-muted">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Upcoming List */}
            <div className="lg:col-span-2">
              <UpcomingList
                events={filteredEvents}
                onEventClick={(evt) => {
                  setSelectedDate(evt.start_time.slice(0, 10));
                  setPopoverEvent(evt);
                }}
              />
            </div>
          </div>
        )}

        {/* ── Event Popover ──────────────────────────────── */}
        {popoverEvent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20">
            <EventPopover
              event={popoverEvent}
              onClose={() => setPopoverEvent(null)}
              onEdit={(evt) => {
                setPopoverEvent(null);
                setEditingEvent(evt);
                setShowAddEvent(true);
              }}
              onDelete={handleDeleteEvent}
              canEdit={canEdit}
            />
          </div>
        )}

        {/* ── Add / Edit Event Modal ─────────────────────── */}
        {showAddEvent && (
          <AddEventModal
            teams={teams}
            editEvent={editingEvent}
            onClose={() => {
              setShowAddEvent(false);
              setEditingEvent(null);
            }}
            onSaved={handleEventSaved}
          />
        )}

        {/* ── Feed Connect Modal ─────────────────────────── */}
        {connectPlatform && (
          <FeedConnectModal
            platform={connectPlatform}
            teams={teams}
            onClose={() => setConnectPlatform(null)}
            onFeedCreated={handleFeedCreated}
          />
        )}
      </main>
    </ProtectedRoute>
  );
}
