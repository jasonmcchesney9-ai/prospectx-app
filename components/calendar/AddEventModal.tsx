"use client";

import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import api from "@/lib/api";
import type { Team, CalendarEvent } from "@/types/api";

interface AddEventModalProps {
  teams: Team[];
  editEvent?: CalendarEvent | null;
  onClose: () => void;
  onSaved: (event: CalendarEvent) => void;
}

const EVENT_TYPES = [
  { value: "GAME", label: "Game" },
  { value: "PRACTICE", label: "Practice" },
  { value: "TOURNAMENT", label: "Tournament" },
  { value: "SHOWCASE", label: "Showcase" },
  { value: "MEETING", label: "Meeting" },
  { value: "DEADLINE", label: "Deadline" },
  { value: "OTHER", label: "Other" },
];

export default function AddEventModal({ teams, editEvent, onClose, onSaved }: AddEventModalProps) {
  const isEditing = !!editEvent;

  const [title, setTitle] = useState(editEvent?.title || "");
  const [type, setType] = useState<string>(editEvent?.type || "GAME");
  const [startDate, setStartDate] = useState(
    editEvent ? editEvent.start_time.slice(0, 10) : ""
  );
  const [startTime, setStartTime] = useState(
    editEvent ? editEvent.start_time.slice(11, 16) || "19:00" : "19:00"
  );
  const [endDate, setEndDate] = useState(
    editEvent?.end_time ? editEvent.end_time.slice(0, 10) : ""
  );
  const [endTime, setEndTime] = useState(
    editEvent?.end_time ? editEvent.end_time.slice(11, 16) || "" : ""
  );
  const [location, setLocation] = useState(editEvent?.location || "");
  const [opponent, setOpponent] = useState(editEvent?.opponent_name || "");
  const [isHome, setIsHome] = useState<boolean | null>(
    editEvent?.is_home === 1 ? true : editEvent?.is_home === 0 ? false : null
  );
  const [teamId, setTeamId] = useState(editEvent?.team_id || "");
  const [description, setDescription] = useState(editEvent?.description || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isGame = type === "GAME";

  async function handleSave() {
    if (!title.trim()) { setError("Title is required"); return; }
    if (!startDate) { setError("Start date is required"); return; }

    const startIso = `${startDate}T${startTime || "00:00"}:00`;
    const endIso = endDate ? `${endDate}T${endTime || "23:59"}:00` : undefined;

    const body = {
      title: title.trim(),
      type,
      start_time: startIso,
      end_time: endIso,
      timezone: "America/Toronto",
      location: location || undefined,
      opponent_name: isGame ? opponent || undefined : undefined,
      is_home: isGame ? isHome : undefined,
      team_id: teamId || undefined,
      description: description || undefined,
      visibility: "ORG",
    };

    setSaving(true);
    setError("");
    try {
      let data;
      if (isEditing && editEvent) {
        const res = await api.put(`/api/calendar/events/${editEvent.id}`, body);
        data = res.data;
      } else {
        const res = await api.post("/api/calendar/events", body);
        data = res.data;
      }
      onSaved(data);
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        (err as { message?: string })?.message || "Failed to save event";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-xl border border-border shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-white rounded-t-xl z-10">
          <h3 className="text-sm font-oswald font-bold text-navy uppercase tracking-wider">
            {isEditing ? "Edit Event" : "Add Event"}
          </h3>
          <button onClick={onClose} className="p-1.5 hover:bg-navy/5 rounded-lg transition-colors">
            <X size={16} className="text-muted" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-[10px] font-oswald font-bold text-navy uppercase tracking-wider mb-1">
              Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., vs Chatham Maroons"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
            />
          </div>

          {/* Type */}
          <div>
            <label className="block text-[10px] font-oswald font-bold text-navy uppercase tracking-wider mb-1">
              Type
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
            >
              {EVENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Start date + time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-oswald font-bold text-navy uppercase tracking-wider mb-1">
                Start Date *
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
              />
            </div>
            <div>
              <label className="block text-[10px] font-oswald font-bold text-navy uppercase tracking-wider mb-1">
                Start Time
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
              />
            </div>
          </div>

          {/* End date + time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-oswald font-bold text-navy uppercase tracking-wider mb-1">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
              />
            </div>
            <div>
              <label className="block text-[10px] font-oswald font-bold text-navy uppercase tracking-wider mb-1">
                End Time
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
              />
            </div>
          </div>

          {/* Location */}
          <div>
            <label className="block text-[10px] font-oswald font-bold text-navy uppercase tracking-wider mb-1">
              Location
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g., Chatham Memorial Arena"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
            />
          </div>

          {/* Game-specific: Opponent + Home/Away */}
          {isGame && (
            <>
              <div>
                <label className="block text-[10px] font-oswald font-bold text-navy uppercase tracking-wider mb-1">
                  Opponent
                </label>
                <input
                  type="text"
                  value={opponent}
                  onChange={(e) => setOpponent(e.target.value)}
                  placeholder="e.g., Chatham Maroons"
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
                />
              </div>
              <div>
                <label className="block text-[10px] font-oswald font-bold text-navy uppercase tracking-wider mb-1">
                  Home / Away
                </label>
                <div className="flex gap-2">
                  {[
                    { val: true, label: "Home" },
                    { val: false, label: "Away" },
                    { val: null, label: "TBD" },
                  ].map((opt) => (
                    <button
                      key={String(opt.val)}
                      onClick={() => setIsHome(opt.val)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                        isHome === opt.val
                          ? "bg-teal text-white border-teal"
                          : "bg-white text-navy border-border hover:border-teal/30"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Team */}
          <div>
            <label className="block text-[10px] font-oswald font-bold text-navy uppercase tracking-wider mb-1">
              Team
            </label>
            <select
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
            >
              <option value="">None</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-[10px] font-oswald font-bold text-navy uppercase tracking-wider mb-1">
              Notes / Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal/30 resize-none"
            />
          </div>

          {/* Error */}
          {error && (
            <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-border text-sm text-navy rounded-lg hover:bg-navy/[0.02] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-teal text-white text-sm font-semibold rounded-lg hover:bg-teal/90 transition-colors disabled:opacity-50"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              {isEditing ? "Save Changes" : "Add Event"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
