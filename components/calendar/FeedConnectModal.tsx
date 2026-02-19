"use client";

import { useState } from "react";
import { X, Loader2, ChevronDown, ChevronUp, CheckCircle2 } from "lucide-react";
import api from "@/lib/api";
import type { Team, CalendarFeed } from "@/types/api";

interface FeedConnectModalProps {
  platform: {
    provider: string;
    name: string;
    color: string;
    helpText: string;
  };
  teams: Team[];
  onClose: () => void;
  onFeedCreated: (feed: CalendarFeed) => void;
}

export default function FeedConnectModal({ platform, teams, onClose, onFeedCreated }: FeedConnectModalProps) {
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [teamId, setTeamId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{ count: number } | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  async function handleConnect() {
    if (!label.trim()) {
      setError("Label is required");
      return;
    }
    if (!url.trim()) {
      setError("URL is required");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const { data } = await api.post("/api/calendar/feeds", {
        label: label.trim(),
        provider: platform.provider,
        url: url.trim(),
        team_id: teamId || undefined,
      });
      setSuccess({ count: data.event_count || data.sync_result?.synced_count || 0 });
      onFeedCreated(data);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        (err as { message?: string })?.message || "Failed to connect feed";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-xl border border-border shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: platform.color + "20" }}>
              <span className="text-xs font-bold" style={{ color: platform.color }}>
                {platform.name.charAt(0)}
              </span>
            </div>
            <h3 className="text-sm font-oswald font-bold text-navy uppercase tracking-wider">
              Connect {platform.name}
            </h3>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-navy/5 rounded-lg transition-colors">
            <X size={16} className="text-muted" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {success ? (
            <div className="text-center py-6">
              <CheckCircle2 size={40} className="mx-auto text-green-500 mb-3" />
              <p className="text-sm font-semibold text-navy">Connected!</p>
              <p className="text-xs text-muted mt-1">
                {success.count} event{success.count !== 1 ? "s" : ""} synced from {platform.name}
              </p>
              <button
                onClick={onClose}
                className="mt-4 px-4 py-2 bg-teal text-white text-xs font-oswald font-bold uppercase tracking-wider rounded-lg hover:bg-teal/90 transition-colors"
              >
                Done
              </button>
            </div>
          ) : (
            <>
              <p className="text-xs text-muted">
                Paste your iCal/ICS or public calendar link from {platform.name}.
              </p>

              {/* Label */}
              <div>
                <label className="block text-[10px] font-oswald font-bold text-navy uppercase tracking-wider mb-1">
                  Label
                </label>
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder={`e.g., "${teams[0]?.name || "Team"} Schedule"`}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
                />
              </div>

              {/* URL */}
              <div>
                <label className="block text-[10px] font-oswald font-bold text-navy uppercase tracking-wider mb-1">
                  Calendar URL (ICS)
                </label>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
                />
              </div>

              {/* Team */}
              <div>
                <label className="block text-[10px] font-oswald font-bold text-navy uppercase tracking-wider mb-1">
                  Team (optional)
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

              {/* Help text */}
              <button
                onClick={() => setShowHelp(!showHelp)}
                className="flex items-center gap-1 text-xs text-teal hover:underline"
              >
                How to find your iCal URL
                {showHelp ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
              {showHelp && (
                <div className="text-xs text-muted bg-navy/[0.02] rounded-lg p-3 border border-border">
                  {platform.helpText}
                </div>
              )}

              {/* Error */}
              {error && (
                <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2 border border-border text-sm text-navy rounded-lg hover:bg-navy/[0.02] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConnect}
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
                  style={{ backgroundColor: platform.color }}
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : null}
                  Connect
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
