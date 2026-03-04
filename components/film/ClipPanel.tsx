"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Play,
  Trash2,
  Edit3,
  Loader2,
  Scissors,
  Clock,
} from "lucide-react";
import api from "@/lib/api";
import toast from "react-hot-toast";

interface Clip {
  id: string;
  title: string;
  start_time_seconds: number;
  end_time_seconds: number;
  clip_type: string;
  tags: string | null;
  tagged_player_name: string | null;
  created_at: string;
}

interface ClipPanelProps {
  sessionId: string;
  uploadId: string;
  getCurrentTime: () => number;
  refreshKey?: number;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function ClipPanel({
  sessionId,
  uploadId,
  getCurrentTime,
  refreshKey,
}: ClipPanelProps) {
  const [clips, setClips] = useState<Clip[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreator, setShowCreator] = useState(false);
  const [editingClip, setEditingClip] = useState<Clip | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Creator form state
  const [clipTitle, setClipTitle] = useState("");
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);
  const [clipType, setClipType] = useState("manual");
  const [tags, setTags] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [saving, setSaving] = useState(false);

  const loadClips = useCallback(async () => {
    try {
      const res = await api.get(`/film/clips?session_id=${sessionId}`);
      setClips(res.data);
    } catch {
      // Silently handle
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    loadClips();
  }, [loadClips, refreshKey]);

  const openCreator = useCallback(
    (clip?: Clip) => {
      if (clip) {
        setEditingClip(clip);
        setClipTitle(clip.title);
        setStartTime(clip.start_time_seconds);
        setEndTime(clip.end_time_seconds);
        setClipType(clip.clip_type || "manual");
        setTags(clip.tags || "");
        setPlayerName(clip.tagged_player_name || "");
      } else {
        setEditingClip(null);
        setClipTitle("");
        setStartTime(Math.floor(getCurrentTime()));
        setEndTime(Math.floor(getCurrentTime()) + 10);
        setClipType("manual");
        setTags("");
        setPlayerName("");
      }
      setShowCreator(true);
    },
    [getCurrentTime]
  );

  const closeCreator = useCallback(() => {
    setShowCreator(false);
    setEditingClip(null);
    setClipTitle("");
    setStartTime(0);
    setEndTime(0);
    setClipType("manual");
    setTags("");
    setPlayerName("");
  }, []);

  const handleSaveClip = useCallback(async () => {
    if (!clipTitle.trim()) {
      toast.error("Clip title is required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: clipTitle.trim(),
        session_id: sessionId,
        upload_id: uploadId || null,
        start_time_seconds: startTime,
        end_time_seconds: endTime,
        clip_type: clipType,
        tags: tags.trim() || null,
        tagged_player_name: playerName.trim() || null,
      };

      if (editingClip) {
        await api.patch(`/film/clips/${editingClip.id}`, payload);
        toast.success("Clip updated");
      } else {
        await api.post("/film/clips", payload);
        toast.success("Clip created");
      }
      closeCreator();
      loadClips();
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { detail?: string } } }).response?.data?.detail ||
        "Failed to save clip";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }, [
    clipTitle,
    sessionId,
    uploadId,
    startTime,
    endTime,
    clipType,
    tags,
    playerName,
    editingClip,
    closeCreator,
    loadClips,
  ]);

  const handleDeleteClip = useCallback(
    async (clipId: string) => {
      if (!confirm("Delete this clip?")) return;
      setDeletingId(clipId);
      try {
        await api.delete(`/film/clips/${clipId}`);
        setClips((prev) => prev.filter((c) => c.id !== clipId));
        toast.success("Clip deleted");
      } catch {
        toast.error("Failed to delete clip");
      } finally {
        setDeletingId(null);
      }
    },
    []
  );

  return (
    <div className="bg-white rounded-xl border border-border p-4 flex flex-col flex-1 min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-oswald uppercase tracking-wider text-navy flex items-center gap-1.5">
          <Scissors size={13} />
          Clips
        </h3>
        <button
          onClick={() => openCreator()}
          className="flex items-center gap-1 bg-teal text-white px-3 py-1.5 rounded-lg text-[11px] font-oswald uppercase tracking-wider hover:bg-teal/90 transition-colors"
        >
          <Plus size={12} />
          Add Clip
        </button>
      </div>

      {/* Inline Clip Creator */}
      {showCreator && (
        <div className="mb-3 p-3 bg-navy/[0.02] rounded-lg border border-border space-y-2.5">
          <input
            type="text"
            value={clipTitle}
            onChange={(e) => setClipTitle(e.target.value)}
            placeholder="Clip title..."
            className="w-full border border-border rounded-lg px-2.5 py-1.5 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
          />

          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-[10px] font-oswald uppercase tracking-wider text-muted mb-0.5">
                Start
              </label>
              <div className="flex gap-1">
                <input
                  type="number"
                  value={startTime}
                  onChange={(e) => setStartTime(Number(e.target.value))}
                  min={0}
                  className="flex-1 border border-border rounded px-2 py-1 text-xs text-navy focus:outline-none focus:ring-1 focus:ring-teal/30"
                />
                <button
                  onClick={() => setStartTime(Math.floor(getCurrentTime()))}
                  className="text-[9px] font-oswald uppercase tracking-wider bg-teal/10 text-teal px-2 py-1 rounded hover:bg-teal/20 transition-colors whitespace-nowrap"
                  title="Set from current video position"
                >
                  Mark In
                </button>
              </div>
            </div>
            <div className="flex-1">
              <label className="block text-[10px] font-oswald uppercase tracking-wider text-muted mb-0.5">
                End
              </label>
              <div className="flex gap-1">
                <input
                  type="number"
                  value={endTime}
                  onChange={(e) => setEndTime(Number(e.target.value))}
                  min={0}
                  className="flex-1 border border-border rounded px-2 py-1 text-xs text-navy focus:outline-none focus:ring-1 focus:ring-teal/30"
                />
                <button
                  onClick={() => setEndTime(Math.floor(getCurrentTime()))}
                  className="text-[9px] font-oswald uppercase tracking-wider bg-teal/10 text-teal px-2 py-1 rounded hover:bg-teal/20 transition-colors whitespace-nowrap"
                  title="Set from current video position"
                >
                  Mark Out
                </button>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-[10px] font-oswald uppercase tracking-wider text-muted mb-0.5">
                Type
              </label>
              <select
                value={clipType}
                onChange={(e) => setClipType(e.target.value)}
                className="w-full border border-border rounded px-2 py-1 text-xs text-navy bg-white focus:outline-none focus:ring-1 focus:ring-teal/30"
              >
                <option value="manual">Manual</option>
                <option value="highlight">Highlight</option>
                <option value="pxi">PXI</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-[10px] font-oswald uppercase tracking-wider text-muted mb-0.5">
                Player
              </label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Player name"
                className="w-full border border-border rounded px-2 py-1 text-xs text-navy focus:outline-none focus:ring-1 focus:ring-teal/30"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-oswald uppercase tracking-wider text-muted mb-0.5">
              Tags
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="Comma-separated tags..."
              className="w-full border border-border rounded px-2 py-1 text-xs text-navy focus:outline-none focus:ring-1 focus:ring-teal/30"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={closeCreator}
              className="text-[10px] font-oswald uppercase tracking-wider text-muted hover:text-navy transition-colors px-2 py-1"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveClip}
              disabled={saving}
              className={`text-[10px] font-oswald uppercase tracking-wider px-3 py-1 rounded transition-colors ${
                saving
                  ? "bg-border text-muted/50 cursor-not-allowed"
                  : "bg-teal text-white hover:bg-teal/90"
              }`}
            >
              {saving ? (
                <Loader2 size={10} className="animate-spin" />
              ) : editingClip ? (
                "Update"
              ) : (
                "Save"
              )}
            </button>
          </div>
        </div>
      )}

      {/* Clip list */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={16} className="animate-spin text-teal" />
          </div>
        ) : clips.length === 0 ? (
          <p className="text-[11px] text-muted/50 text-center py-8">
            No clips yet. Click &quot;Add Clip&quot; to create one.
          </p>
        ) : (
          <div className="space-y-1.5">
            {clips.map((clip) => (
              <div
                key={clip.id}
                className="p-2.5 rounded-lg border border-border hover:border-teal/30 transition-colors group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-navy truncate">
                      {clip.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="flex items-center gap-0.5 text-[10px] text-teal font-mono">
                        <Clock size={9} />
                        {formatTime(clip.start_time_seconds)} →{" "}
                        {formatTime(clip.end_time_seconds)}
                      </span>
                      {clip.tags && (
                        <div className="flex gap-1 flex-wrap">
                          {clip.tags.split(",").map((tag, i) => (
                            <span
                              key={i}
                              className="text-[9px] bg-navy/5 text-navy/60 px-1.5 py-0.5 rounded"
                            >
                              {tag.trim()}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button
                      onClick={() => openCreator(clip)}
                      className="text-muted/50 hover:text-teal transition-colors p-0.5"
                      title="Edit clip"
                    >
                      <Edit3 size={12} />
                    </button>
                    <button
                      onClick={() => handleDeleteClip(clip.id)}
                      disabled={deletingId === clip.id}
                      className="text-muted/50 hover:text-red-500 transition-colors p-0.5"
                      title="Delete clip"
                    >
                      {deletingId === clip.id ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Trash2 size={12} />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
