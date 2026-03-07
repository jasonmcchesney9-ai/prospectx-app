"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { X, Film, GripVertical, Plus, Trash2, Loader2 } from "lucide-react";
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

interface ReelBuilderProps {
  sessionId: string;
  playerId?: string | null;
  onClose: () => void;
  onCreated: (reelId: string) => void;
}

type Preset = "game" | "player" | "teaching" | "custom";

const PRESETS: { value: Preset; label: string; description: string }[] = [
  { value: "game", label: "Game Highlights", description: "Best moments from this session" },
  { value: "player", label: "Player Highlights", description: "Showcase a single player" },
  { value: "teaching", label: "Teaching Reel", description: "Instructional clips for review" },
  { value: "custom", label: "Custom", description: "Build from scratch" },
];

const PRESET_TITLES: Record<Preset, string> = {
  game: "Game Highlights",
  player: "Player Highlights",
  teaching: "Teaching Reel",
  custom: "",
};

const CLIP_CATEGORY_KEYWORDS: Record<string, string[]> = {
  teal: ["goal", "shot", "chance", "entry", "cycle", "zone_time", "screen", "net_battle", "offensive", "scoring"],
  navy: ["hit", "block", "turnover", "exit", "breakout", "dz_coverage", "coverage_miss", "stick_detail", "defensive"],
  orange: ["faceoff", "pp", "pk", "icing", "penalty", "power_play", "penalty_kill", "special"],
};

function getClipCategoryKey(clip: Clip): string {
  const tagStr = Array.isArray(clip.tags)
    ? (clip.tags as unknown as string[]).join(" ").toLowerCase()
    : typeof clip.tags === "string"
    ? clip.tags.toLowerCase()
    : "";
  const combined = `${tagStr} ${(clip.title || "").toLowerCase()} ${clip.clip_type || ""}`.toLowerCase();
  for (const [color, keywords] of Object.entries(CLIP_CATEGORY_KEYWORDS)) {
    for (const kw of keywords) {
      if (combined.includes(kw)) return color;
    }
  }
  return "gray";
}

function getClipDotStyle(clip: Clip): string {
  const key = getClipCategoryKey(clip);
  const map: Record<string, string> = { teal: "#0D9488", navy: "#0F2942", orange: "#EA580C", gray: "#9CA3AF" };
  return map[key] || "#9CA3AF";
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function cleanClipTitle(title: string): string {
  let cleaned = title;
  const colonIdx = title.indexOf(": ");
  if (colonIdx !== -1) cleaned = title.substring(colonIdx + 2);
  if (cleaned.length > 35) cleaned = cleaned.substring(0, 35) + "\u2026";
  return cleaned;
}

export default function ReelBuilder({ sessionId, playerId, onClose, onCreated }: ReelBuilderProps) {
  const [clips, setClips] = useState<Clip[]>([]);
  const [loadingClips, setLoadingClips] = useState(true);
  const [preset, setPreset] = useState<Preset | null>(null);
  const [title, setTitle] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Drag state
  const dragIdx = useRef<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  // Load clips for this session
  useEffect(() => {
    api
      .get(`/film/clips?session_id=${sessionId}`)
      .then((r) => {
        setClips(r.data);
        // Pre-select clips matching the active sessionStorage filter
        try {
          const stored = sessionStorage.getItem(`clip_filter_${sessionId}`);
          if (stored && stored !== "all") {
            const filtered = (r.data as Clip[]).filter((c) => getClipCategoryKey(c) === stored);
            if (filtered.length > 0) {
              setSelectedIds(filtered.map((c) => c.id));
            }
          }
        } catch { /* */ }
      })
      .catch(() => { /* */ })
      .finally(() => setLoadingClips(false));
  }, [sessionId]);

  const handlePresetSelect = useCallback((p: Preset) => {
    setPreset(p);
    if (PRESET_TITLES[p]) setTitle(PRESET_TITLES[p]);
  }, []);

  const toggleClip = useCallback((clipId: string) => {
    setSelectedIds((prev) =>
      prev.includes(clipId) ? prev.filter((id) => id !== clipId) : [...prev, clipId]
    );
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(clips.map((c) => c.id));
  }, [clips]);

  const clearAll = useCallback(() => {
    setSelectedIds([]);
  }, []);

  // Drag and drop reorder for selected clips
  const handleDragStart = useCallback((idx: number) => {
    dragIdx.current = idx;
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDragOverIdx(idx);
  }, []);

  const handleDrop = useCallback((idx: number) => {
    if (dragIdx.current === null || dragIdx.current === idx) {
      setDragOverIdx(null);
      return;
    }
    setSelectedIds((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragIdx.current!, 1);
      next.splice(idx, 0, moved);
      return next;
    });
    dragIdx.current = null;
    setDragOverIdx(null);
  }, []);

  const removeFromSelected = useCallback((clipId: string) => {
    setSelectedIds((prev) => prev.filter((id) => id !== clipId));
  }, []);

  const handleCreate = useCallback(async () => {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (selectedIds.length === 0) {
      toast.error("Select at least one clip");
      return;
    }
    setSaving(true);
    try {
      const res = await api.post("/highlight-reels", {
        title: title.trim(),
        description: "",
        level: "junior",
        player_id: playerId || null,
        clip_ids: selectedIds,
        clip_order: selectedIds,
        status: "draft",
      });
      toast.success(
        (t) => (
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            Reel created
            <button
              onClick={() => {
                window.open(`/reels/${res.data.id}`, "_blank");
                toast.dismiss(t.id);
              }}
              style={{ fontWeight: 700, color: "#0D9488", textDecoration: "underline", background: "none", border: "none", cursor: "pointer", fontSize: 13 }}
            >
              View reel
            </button>
          </span>
        ),
        { duration: 8000 }
      );
      onCreated(res.data.id);
      onClose();
    } catch {
      toast.error("Failed to create reel");
    } finally {
      setSaving(false);
    }
  }, [title, selectedIds, playerId, onCreated, onClose]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const selectedClips = selectedIds.map((id) => clips.find((c) => c.id === id)).filter(Boolean) as Clip[];
  const availableClips = clips.filter((c) => !selectedIds.includes(c.id));

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={onClose}
    >
      {/* Backdrop */}
      <div style={{ position: "absolute", inset: 0, background: "rgba(15,41,66,0.6)" }} />

      {/* Modal panel */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 620,
          maxHeight: "85vh",
          borderRadius: 16,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          background: "#FFFFFF",
          border: "1.5px solid #DDE6EF",
          boxShadow: "0 25px 50px rgba(15,41,66,0.25)",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", background: "#0F2942" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Film size={14} style={{ color: "#EA580C" }} />
            <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, fontWeight: 700, letterSpacing: 2, color: "#FFFFFF", textTransform: "uppercase" as const }}>
              BUILD REEL
            </span>
          </div>
          <button onClick={onClose} style={{ color: "rgba(255,255,255,0.5)", background: "none", border: "none", cursor: "pointer", padding: 4 }}>
            <X size={16} />
          </button>
        </div>

        {/* Body — scrollable */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
          {/* Presets */}
          {!preset && (
            <div>
              <p style={{ fontFamily: "ui-monospace, monospace", fontSize: 9, fontWeight: 700, letterSpacing: 1, color: "#8BA4BB", textTransform: "uppercase" as const, marginBottom: 8 }}>
                Choose a preset
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {PRESETS.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => handlePresetSelect(p.value)}
                    style={{
                      padding: "12px 14px",
                      borderRadius: 10,
                      border: "1.5px solid #DDE6EF",
                      background: "#FFFFFF",
                      cursor: "pointer",
                      textAlign: "left" as const,
                      transition: "border-color 0.15s ease",
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#0D9488"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#DDE6EF"; }}
                  >
                    <span style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 13, color: "#0F2942", textTransform: "uppercase" as const, letterSpacing: "0.03em" }}>
                      {p.label}
                    </span>
                    <p style={{ fontSize: 11, color: "#5A7291", marginTop: 2 }}>{p.description}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* After preset selection — title + clips */}
          {preset && (
            <div>
              {/* Title */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontFamily: "ui-monospace, monospace", fontSize: 9, fontWeight: 700, letterSpacing: 1, color: "#8BA4BB", textTransform: "uppercase" as const, display: "block", marginBottom: 4 }}>
                  Reel Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter reel title..."
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1.5px solid #DDE6EF",
                    fontSize: 13,
                    color: "#0F2942",
                    outline: "none",
                    boxSizing: "border-box" as const,
                  }}
                  autoFocus
                />
              </div>

              {/* Selected clips (reorderable) */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 9, fontWeight: 700, letterSpacing: 1, color: "#8BA4BB", textTransform: "uppercase" as const }}>
                    Selected Clips ({selectedClips.length})
                  </span>
                  {selectedIds.length > 0 && (
                    <button onClick={clearAll} style={{ fontSize: 10, color: "#5A7291", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
                      Clear all
                    </button>
                  )}
                </div>
                {selectedClips.length === 0 ? (
                  <p style={{ fontSize: 11, color: "#8BA4BB", textAlign: "center" as const, padding: "12px 0" }}>
                    No clips selected. Add clips from the list below.
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    {selectedClips.map((clip, idx) => (
                      <div
                        key={clip.id}
                        draggable
                        onDragStart={() => handleDragStart(idx)}
                        onDragOver={(e) => handleDragOver(e, idx)}
                        onDrop={() => handleDrop(idx)}
                        onDragEnd={() => setDragOverIdx(null)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "6px 8px",
                          borderRadius: 8,
                          background: dragOverIdx === idx ? "#EBF7F6" : "#F8FAFC",
                          border: dragOverIdx === idx ? "1px dashed #0D9488" : "1px solid transparent",
                          cursor: "grab",
                          transition: "background 0.15s ease",
                        }}
                      >
                        <GripVertical size={12} style={{ color: "#CCD6E0", flexShrink: 0 }} />
                        <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, fontWeight: 700, color: "#8BA4BB", width: 18, textAlign: "center" as const, flexShrink: 0 }}>
                          {idx + 1}
                        </span>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: getClipDotStyle(clip), flexShrink: 0 }} />
                        <span style={{ fontSize: 12, color: "#0F2942", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
                          {cleanClipTitle(clip.title)}
                        </span>
                        <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, color: "#0D9488", flexShrink: 0 }}>
                          {formatTime(clip.start_time_seconds)}-{formatTime(clip.end_time_seconds)}
                        </span>
                        <button
                          onClick={() => removeFromSelected(clip.id)}
                          style={{ color: "#CCD6E0", background: "none", border: "none", cursor: "pointer", padding: 2, flexShrink: 0 }}
                          title="Remove"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Available clips */}
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 9, fontWeight: 700, letterSpacing: 1, color: "#8BA4BB", textTransform: "uppercase" as const }}>
                    Available Clips ({availableClips.length})
                  </span>
                  {availableClips.length > 0 && (
                    <button onClick={selectAll} style={{ fontSize: 10, color: "#0D9488", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
                      Select all
                    </button>
                  )}
                </div>
                {loadingClips ? (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "16px 0" }}>
                    <Loader2 size={16} style={{ color: "#0D9488", animation: "spin 1s linear infinite" }} />
                  </div>
                ) : availableClips.length === 0 && selectedIds.length === 0 ? (
                  <p style={{ fontSize: 11, color: "#8BA4BB", textAlign: "center" as const, padding: "12px 0" }}>
                    No clips in this session.
                  </p>
                ) : availableClips.length === 0 ? (
                  <p style={{ fontSize: 11, color: "#8BA4BB", textAlign: "center" as const, padding: "8px 0" }}>
                    All clips selected.
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 2, maxHeight: 200, overflowY: "auto" }}>
                    {availableClips.map((clip) => (
                      <button
                        key={clip.id}
                        onClick={() => toggleClip(clip.id)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "6px 8px",
                          borderRadius: 8,
                          background: "#FFFFFF",
                          border: "1px solid #DDE6EF",
                          cursor: "pointer",
                          textAlign: "left" as const,
                          transition: "background 0.15s ease",
                          width: "100%",
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#F8FAFC"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#FFFFFF"; }}
                      >
                        <Plus size={11} style={{ color: "#0D9488", flexShrink: 0 }} />
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: getClipDotStyle(clip), flexShrink: 0 }} />
                        <span style={{ fontSize: 12, color: "#0F2942", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
                          {cleanClipTitle(clip.title)}
                        </span>
                        <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, color: "#0D9488", flexShrink: 0 }}>
                          {formatTime(clip.start_time_seconds)}-{formatTime(clip.end_time_seconds)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {preset && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", borderTop: "1px solid #DDE6EF", background: "#F8FAFC" }}>
            <button
              onClick={() => { setPreset(null); setTitle(""); setSelectedIds([]); }}
              style={{ fontSize: 11, color: "#5A7291", background: "none", border: "none", cursor: "pointer" }}
            >
              Back to presets
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                onClick={onClose}
                style={{
                  padding: "7px 16px",
                  borderRadius: 8,
                  border: "1.5px solid #DDE6EF",
                  background: "#FFFFFF",
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#5A7291",
                  cursor: "pointer",
                  textTransform: "uppercase" as const,
                  fontFamily: "ui-monospace, monospace",
                  letterSpacing: 1,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={saving || !title.trim() || selectedIds.length === 0}
                style={{
                  padding: "7px 16px",
                  borderRadius: 8,
                  border: "none",
                  background: saving || !title.trim() || selectedIds.length === 0 ? "#CCD6E0" : "#0D9488",
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#FFFFFF",
                  cursor: saving || !title.trim() || selectedIds.length === 0 ? "not-allowed" : "pointer",
                  textTransform: "uppercase" as const,
                  fontFamily: "ui-monospace, monospace",
                  letterSpacing: 1,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {saving ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> : <Film size={12} />}
                {saving ? "Creating..." : "Create Reel"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
