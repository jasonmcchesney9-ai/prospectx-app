"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
  upload_id?: string;
  upload_playback_id?: string;
  upload_period_number?: number;
}

type ClipCategory = "all" | "teal" | "navy" | "orange" | "gray";

interface UploadInfo {
  id: string;
  mux_playback_id?: string;
  period_number?: number;
  period_label?: string;
}

interface ClipPanelProps {
  sessionId: string;
  uploadId: string;
  getCurrentTime: () => number;
  refreshKey?: number;
  uploads?: UploadInfo[];
  onPeriodSwitch?: (uploadId: string) => void;
  onClipCountChange?: (count: number) => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const CLIP_CATEGORY_KEYWORDS: Record<string, string[]> = {
  teal: ["goal", "shot", "chance", "entry", "cycle", "zone_time", "screen", "net_battle", "offensive", "scoring"],
  navy: ["hit", "block", "turnover", "exit", "breakout", "dz_coverage", "coverage_miss", "stick_detail", "defensive"],
  orange: ["faceoff", "pp", "pk", "icing", "penalty", "power_play", "penalty_kill", "special"],
};

function cleanClipTitle(title: string): string {
  // Strip event_type prefix before colon (e.g., "chatham_maroons_faceoffs_in_nz: Chatham Maroons Faceoffs in NZ" → "Chatham Maroons Faceoffs in NZ")
  let cleaned = title;
  const colonIdx = title.indexOf(": ");
  if (colonIdx !== -1) {
    cleaned = title.substring(colonIdx + 2);
  }
  // Truncate to 40 characters
  if (cleaned.length > 40) {
    cleaned = cleaned.substring(0, 40) + "…";
  }
  return cleaned;
}

function getClipDotColor(clip: Clip): string {
  // Check tags first
  const tagStr = Array.isArray(clip.tags)
    ? clip.tags.join(" ").toLowerCase()
    : typeof clip.tags === "string"
    ? clip.tags.toLowerCase()
    : "";
  const titleStr = (clip.title || "").toLowerCase();
  const combined = `${tagStr} ${titleStr} ${clip.clip_type || ""}`.toLowerCase();
  for (const [color, keywords] of Object.entries(CLIP_CATEGORY_KEYWORDS)) {
    for (const kw of keywords) {
      if (combined.includes(kw)) return `bg-${color}`;
    }
  }
  return "bg-gray-400";
}

export default function ClipPanel({
  sessionId,
  uploadId,
  getCurrentTime,
  refreshKey,
  uploads = [],
  onPeriodSwitch,
  onClipCountChange,
}: ClipPanelProps) {
  const [clips, setClips] = useState<Clip[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreator, setShowCreator] = useState(false);
  const [editingClip, setEditingClip] = useState<Clip | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [clipFilter, setClipFilter] = useState<ClipCategory>(() => {
    try {
      const stored = sessionStorage.getItem(`clip_filter_${sessionId}`);
      if (stored === "teal" || stored === "navy" || stored === "orange" || stored === "gray") return stored;
    } catch { /* */ }
    return "all";
  });

  // Creator form state
  const [clipTitle, setClipTitle] = useState("");
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);
  const [clipType, setClipType] = useState("manual");
  const [tags, setTags] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [saving, setSaving] = useState(false);

  // Active clip highlight + auto-scroll
  const [activeClipId, setActiveClipId] = useState<string | null>(null);
  const userScrolledRef = useRef(false);
  const userScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clipListRef = useRef<HTMLDivElement>(null);
  const clipRowRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Poll currentTime every 500ms to determine active clip (respects filter)
  useEffect(() => {
    const interval = setInterval(() => {
      const t = getCurrentTime();
      const visible = clipFilter === "all"
        ? clips
        : clips.filter((c) => getClipCategoryKey(c) === clipFilter);
      const active = visible.find((c) => t >= c.start_time_seconds && t <= c.end_time_seconds);
      setActiveClipId((prev) => {
        const newId = active?.id || null;
        if (newId !== prev && newId && !userScrolledRef.current) {
          // Auto-scroll to active clip
          const el = clipRowRefs.current[newId];
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        }
        return newId;
      });
    }, 500);
    return () => clearInterval(interval);
  }, [clips, clipFilter, getCurrentTime]);

  // Detect manual scroll — pause auto-scroll for 5 seconds
  useEffect(() => {
    const container = clipListRef.current;
    if (!container) return;
    const handleScroll = () => {
      userScrolledRef.current = true;
      if (userScrollTimerRef.current) clearTimeout(userScrollTimerRef.current);
      userScrollTimerRef.current = setTimeout(() => {
        userScrolledRef.current = false;
      }, 5000);
    };
    container.addEventListener("scroll", handleScroll);
    return () => {
      container.removeEventListener("scroll", handleScroll);
      if (userScrollTimerRef.current) clearTimeout(userScrollTimerRef.current);
    };
  }, []);

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

  // Notify parent of clip count changes for tab badge
  useEffect(() => {
    if (onClipCountChange) onClipCountChange(clips.length);
  }, [clips.length, onClipCountChange]);

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

  // Filter clips by category color
  const getClipCategoryKey = (clip: Clip): ClipCategory => {
    const color = getClipDotColor(clip);
    if (color.includes("teal")) return "teal";
    if (color.includes("navy")) return "navy";
    if (color.includes("orange")) return "orange";
    return "gray";
  };

  const filteredClips = clipFilter === "all"
    ? clips
    : clips.filter((c) => getClipCategoryKey(c) === clipFilter);

  return (
    <div className="overflow-hidden flex flex-col flex-1 min-h-0" style={{ borderRadius: 12, border: "1.5px solid #DDE6EF", borderLeft: "3px solid #0D9488" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5" style={{ background: "#0F2942" }}>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: "#0D9488" }} />
          <span
            className="font-bold uppercase text-white"
            style={{ fontSize: 10, fontFamily: "ui-monospace, monospace", letterSpacing: 2 }}
          >
            CLIPS
          </span>
          {!loading && (
            <span
              className="text-[9px] font-bold px-1.5 py-0.5 rounded"
              style={{ fontFamily: "ui-monospace, monospace", background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.7)" }}
            >
              {clips.length}
            </span>
          )}
        </div>
        <button
          onClick={() => openCreator()}
          className="flex items-center gap-1 text-white px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition-colors hover:opacity-90"
          style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 1, background: "#0D9488" }}
        >
          <Plus size={11} />
          Add
        </button>
      </div>
      {/* Filter bar */}
      <div className="flex items-center gap-1 px-3 py-2" style={{ background: "#F8FAFC", borderBottom: "1px solid #DDE6EF" }}>
        {([
          { value: "all" as ClipCategory, label: "All" },
          { value: "teal" as ClipCategory, label: "Offensive" },
          { value: "navy" as ClipCategory, label: "Defensive" },
          { value: "orange" as ClipCategory, label: "Special" },
        ]).map((f) => (
          <button
            key={f.value}
            onClick={() => {
              setClipFilter(f.value);
              try { sessionStorage.setItem(`clip_filter_${sessionId}`, f.value); } catch { /* */ }
            }}
            className="px-2 py-0.5 rounded text-[9px] font-bold uppercase transition-colors"
            style={clipFilter === f.value
              ? { fontFamily: "ui-monospace, monospace", letterSpacing: 0.5, background: "#0D9488", color: "#FFFFFF" }
              : { fontFamily: "ui-monospace, monospace", letterSpacing: 0.5, color: "#5A7291" }
            }
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className="px-4 pt-3 pb-4 flex flex-col flex-1 min-h-0">

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
      <div className="flex-1 overflow-y-auto min-h-0" ref={clipListRef}>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={16} className="animate-spin text-teal" />
          </div>
        ) : clips.length === 0 ? (
          <p className="text-[11px] text-muted/50 text-center py-8">
            No clips yet. Click &quot;Add&quot; to create one.
          </p>
        ) : filteredClips.length === 0 ? (
          <p className="text-[11px] text-center py-6" style={{ color: "#8BA4BB" }}>
            No clips match this filter.
          </p>
        ) : (
          <div>
            {filteredClips.map((clip, idx) => {
              const isActive = activeClipId === clip.id;
              // Resolve period number: from clip's upload_period_number, or lookup from uploads array
              const clipPeriod = clip.upload_period_number ?? uploads.find((u) => u.id === clip.upload_id)?.period_number;
              const periodBadge = clipPeriod ? (clipPeriod <= 3 ? `P${clipPeriod}` : clipPeriod === 4 ? "OT" : "SO") : null;
              return (
              <div
                key={clip.id}
                ref={(el) => { clipRowRefs.current[clip.id] = el; }}
                onClick={() => {
                  // Auto-switch to correct period upload then seek
                  if (clip.upload_id && onPeriodSwitch) onPeriodSwitch(clip.upload_id);
                }}
                className="px-2 py-2 transition-colors group cursor-pointer hover:bg-navy/[0.04]"
                style={{
                  background: isActive ? "#EBF7F6" : idx % 2 === 0 ? "#FFFFFF" : "#F8FAFC",
                  borderBottom: "1px solid #F0F4F8",
                  borderLeft: isActive ? "3px solid #0D9488" : "3px solid transparent",
                  transition: "background 0.2s ease, border-left 0.2s ease",
                }}
                title={clip.title}
              >
                <div className="flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${getClipDotColor(clip)}`} />
                    {periodBadge && (
                      <span style={{ fontSize: 8, fontFamily: "ui-monospace, monospace", fontWeight: 700, background: "rgba(15,41,66,0.08)", color: "#5A7291", borderRadius: 3, padding: "0 4px", lineHeight: "16px", flexShrink: 0 }}>
                        {periodBadge}
                      </span>
                    )}
                    <span className="text-sm text-navy truncate" style={{ maxWidth: "100%" }}>
                      {cleanClipTitle(clip.title)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); openCreator(clip); }}
                      className="text-muted/50 hover:text-teal transition-colors p-0.5"
                      title="Edit clip"
                    >
                      <Edit3 size={11} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteClip(clip.id); }}
                      disabled={deletingId === clip.id}
                      className="text-muted/50 hover:text-red-500 transition-colors p-0.5"
                      title="Delete clip"
                    >
                      {deletingId === clip.id ? (
                        <Loader2 size={11} className="animate-spin" />
                      ) : (
                        <Trash2 size={11} />
                      )}
                    </button>
                  </div>
                </div>
                {/* Timestamp — larger, teal, prominent */}
                <div className="flex items-center gap-2 mt-0.5 pl-3.5">
                  <span
                    className="flex items-center gap-1 font-bold"
                    style={{ fontSize: 12, fontFamily: "ui-monospace, monospace", color: "#0D9488" }}
                  >
                    {formatTime(clip.start_time_seconds)} → {formatTime(clip.end_time_seconds)}
                  </span>
                  {clip.tags && (() => {
                    const tagArr: string[] = Array.isArray(clip.tags)
                      ? clip.tags as unknown as string[]
                      : typeof clip.tags === "string"
                      ? clip.tags.split(",")
                      : [];
                    return tagArr.length > 0 ? (
                      <div className="flex gap-1 flex-wrap">
                        {tagArr.slice(0, 2).map((tag, i) => (
                          <span
                            key={i}
                            className="text-[8px] px-1 py-0.5 rounded"
                            style={{ background: "rgba(15,41,66,0.05)", color: "#5A7291" }}
                          >
                            {tag.trim()}
                          </span>
                        ))}
                      </div>
                    ) : null;
                  })()}
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
