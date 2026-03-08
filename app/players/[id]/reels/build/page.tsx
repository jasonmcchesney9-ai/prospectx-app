"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Film,
  Loader2,
  CheckSquare,
  Square,
  GripVertical,
  X,
  Clock,
  Play,
  Scissors,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import api from "@/lib/api";
import toast from "react-hot-toast";

/* ── Types ──────────────────────────────────────────────── */

interface PlayerData {
  id: string;
  first_name: string;
  last_name: string;
  jersey_number?: string | number | null;
  position?: string;
  current_team?: string;
  current_league?: string;
}

interface PlayerStat {
  gp?: number;
  g?: number;
  a?: number;
  p?: number;
  season?: string;
}

interface ClipRow {
  clip_id: string;
  title: string;
  description?: string | null;
  start_time_seconds: number;
  end_time_seconds: number;
  clip_type?: string;
  tags?: string[];
  category?: string;
  session_id?: string;
  upload_id?: string;
  clip_created_at?: string;
  session_title?: string;
  session_type?: string;
  session_date?: string;
  game_id?: string;
  game_date?: string;
  home_team?: string;
  away_team?: string;
  opponent?: string | null;
}

type EventFilter = "all" | "goals" | "shots" | "defensive" | "special_teams";

/* ── Helpers ────────────────────────────────────────────── */

function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function clipDuration(clip: ClipRow): number {
  return Math.max(0, clip.end_time_seconds - clip.start_time_seconds);
}

function fmtDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

function formatDate(iso: string | undefined | null): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return iso;
  }
}

function matchesFilter(clip: ClipRow, filter: EventFilter): boolean {
  if (filter === "all") return true;
  const type = (clip.clip_type || "").toLowerCase();
  const tagStr = Array.isArray(clip.tags) ? clip.tags.join(" ").toLowerCase() : "";
  const cat = (clip.category || "").toLowerCase();
  const combined = `${type} ${tagStr} ${cat}`;
  switch (filter) {
    case "goals":
      return combined.includes("goal") && !combined.includes("against");
    case "shots":
      return combined.includes("shot") || combined.includes("scoring chance");
    case "defensive":
      return combined.includes("defen") || combined.includes("block") || combined.includes("dz") || combined.includes("clear");
    case "special_teams":
      return combined.includes("power play") || combined.includes("pp") || combined.includes("pk") || combined.includes("penalty kill") || combined.includes("special");
    default:
      return true;
  }
}

/** Group clips by session */
function groupBySession(clips: ClipRow[]): { sessionKey: string; sessionTitle: string; sessionDate: string; clips: ClipRow[] }[] {
  const map = new Map<string, { sessionTitle: string; sessionDate: string; clips: ClipRow[] }>();
  for (const c of clips) {
    const key = c.session_id || "unknown";
    if (!map.has(key)) {
      map.set(key, {
        sessionTitle: c.session_title || "Unknown Session",
        sessionDate: c.game_date || c.session_date || c.clip_created_at || "",
        clips: [],
      });
    }
    map.get(key)!.clips.push(c);
  }
  return Array.from(map.entries()).map(([sessionKey, v]) => ({
    sessionKey,
    sessionTitle: v.sessionTitle,
    sessionDate: v.sessionDate,
    clips: v.clips,
  }));
}

/* ── Badge color for clip type ──────────────────────────── */

function badgeColor(clip: ClipRow): { bg: string; text: string } {
  const type = (clip.clip_type || "").toLowerCase();
  const tagStr = Array.isArray(clip.tags) ? clip.tags.join(" ").toLowerCase() : "";
  const combined = `${type} ${tagStr}`;
  if (combined.includes("goal")) return { bg: "rgba(13,148,136,0.15)", text: "#0D9488" };
  if (combined.includes("shot") || combined.includes("scoring")) return { bg: "rgba(234,88,12,0.12)", text: "#E67E22" };
  if (combined.includes("defen") || combined.includes("block")) return { bg: "rgba(15,41,66,0.1)", text: "#0F2942" };
  if (combined.includes("pp") || combined.includes("pk") || combined.includes("power") || combined.includes("penalty")) return { bg: "rgba(139,92,246,0.12)", text: "#7C3AED" };
  return { bg: "rgba(107,114,128,0.1)", text: "#6B7280" };
}

/* ── Component ──────────────────────────────────────────── */

export default function PlayerReelBuilderPage() {
  const params = useParams();
  const router = useRouter();
  const playerId = params.id as string;

  // ── State ──
  const [player, setPlayer] = useState<PlayerData | null>(null);
  const [stats, setStats] = useState<PlayerStat | null>(null);
  const [clips, setClips] = useState<ClipRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [clipsLoading, setClipsLoading] = useState(true);
  const [filter, setFilter] = useState<EventFilter>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [collapsedSessions, setCollapsedSessions] = useState<Set<string>>(new Set());

  // Reel settings
  const [reelTitle, setReelTitle] = useState("");
  const [reelNote, setReelNote] = useState("");
  const [creating, setCreating] = useState(false);

  // Drag state
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  // Ordered selected clips for the right panel
  const [orderedClipIds, setOrderedClipIds] = useState<string[]>([]);

  // ── Fetch player ──
  useEffect(() => {
    if (!playerId) return;
    (async () => {
      try {
        const { data } = await api.get(`/players/${playerId}`);
        setPlayer(data);
        setReelTitle(`${data.first_name} ${data.last_name} — Highlights 2025-26`);
        // Fetch current season stats
        try {
          const { data: statsArr } = await api.get(`/stats/player/${playerId}`);
          if (Array.isArray(statsArr) && statsArr.length > 0) {
            setStats(statsArr[0]);
          }
        } catch { /* stats optional */ }
      } catch {
        toast.error("Failed to load player");
      } finally {
        setLoading(false);
      }
    })();
  }, [playerId]);

  // ── Fetch clips ──
  useEffect(() => {
    if (!playerId) return;
    setClipsLoading(true);
    (async () => {
      try {
        const { data } = await api.get(`/film/players/${playerId}/clips`, { params: { limit: 500 } });
        setClips(Array.isArray(data) ? data : []);
      } catch {
        toast.error("Failed to load clips");
      } finally {
        setClipsLoading(false);
      }
    })();
  }, [playerId]);

  // ── Sync orderedClipIds when selection changes ──
  useEffect(() => {
    setOrderedClipIds((prev) => {
      // Keep existing order for clips still selected, append new ones at the end
      const kept = prev.filter((id) => selectedIds.has(id));
      const newIds = Array.from(selectedIds).filter((id) => !prev.includes(id));
      return [...kept, ...newIds];
    });
  }, [selectedIds]);

  // ── Filtered clips ──
  const filteredClips = clips.filter((c) => matchesFilter(c, filter));
  const sessionGroups = groupBySession(filteredClips);

  // ── Selection helpers ──
  const toggleClip = useCallback((clipId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(clipId)) next.delete(clipId);
      else next.add(clipId);
      return next;
    });
  }, []);

  const toggleSessionAll = useCallback((sessionClips: ClipRow[]) => {
    const ids = sessionClips.map((c) => c.clip_id);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const allSelected = ids.every((id) => next.has(id));
      if (allSelected) {
        ids.forEach((id) => next.delete(id));
      } else {
        ids.forEach((id) => next.add(id));
      }
      return next;
    });
  }, []);

  const toggleSessionCollapse = useCallback((sessionKey: string) => {
    setCollapsedSessions((prev) => {
      const next = new Set(prev);
      if (next.has(sessionKey)) next.delete(sessionKey);
      else next.add(sessionKey);
      return next;
    });
  }, []);

  // ── Ordered selected clips data ──
  const orderedClips = orderedClipIds
    .map((id) => clips.find((c) => c.clip_id === id))
    .filter((c): c is ClipRow => c !== undefined);

  const totalDuration = orderedClips.reduce((sum, c) => sum + clipDuration(c), 0);

  // ── Drag and drop reorder ──
  const handleDragStart = useCallback((idx: number) => {
    setDragIdx(idx);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDragOverIdx(idx);
  }, []);

  const handleDrop = useCallback((dropIdx: number) => {
    if (dragIdx === null || dragIdx === dropIdx) {
      setDragIdx(null);
      setDragOverIdx(null);
      return;
    }
    setOrderedClipIds((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragIdx, 1);
      next.splice(dropIdx, 0, moved);
      return next;
    });
    setDragIdx(null);
    setDragOverIdx(null);
  }, [dragIdx]);

  const handleDragEnd = useCallback(() => {
    setDragIdx(null);
    setDragOverIdx(null);
  }, []);

  const removeFromReel = useCallback((clipId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(clipId);
      return next;
    });
  }, []);

  // ── Create reel ──
  const handleCreate = useCallback(async () => {
    if (orderedClipIds.length === 0 || !reelTitle.trim()) return;
    setCreating(true);
    try {
      const { data } = await api.post("/highlight-reels", {
        player_id: playerId,
        title: reelTitle.trim(),
        description: reelNote.trim() || undefined,
        clip_ids: orderedClipIds,
        clip_order: orderedClipIds,
        status: "draft",
        visibility: "org",
        level: "junior",
        player_info: player ? { first_name: player.first_name, last_name: player.last_name, position: player.position, team: player.current_team } : {},
      });
      toast.success(`Reel created — ${reelTitle.trim()}`, { duration: 5000 });
      router.push(`/reels/${data.id}`);
    } catch {
      toast.error("Failed to create reel");
    } finally {
      setCreating(false);
    }
  }, [orderedClipIds, reelTitle, reelNote, playerId, player, router]);

  // ── Filter bar items ──
  const FILTERS: { key: EventFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "goals", label: "Goals" },
    { key: "shots", label: "Shots" },
    { key: "defensive", label: "Defensive" },
    { key: "special_teams", label: "Special Teams" },
  ];

  // ── Render ──
  return (
    <ProtectedRoute>
      <NavBar />
      <main style={{ background: "#F0F4F8", minHeight: "100vh", paddingTop: 16, paddingBottom: 40 }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", padding: "0 20px" }}>

          {/* ── Back link + page title ──────────────────── */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <Link
              href={`/players/${playerId}`}
              style={{ display: "flex", alignItems: "center", gap: 4, fontFamily: "'Oswald', sans-serif", fontWeight: 600, fontSize: 12, color: "#0D9488", textDecoration: "none", textTransform: "uppercase", letterSpacing: "0.08em" }}
            >
              <ArrowLeft size={14} /> Player Profile
            </Link>
          </div>

          {/* ── Player header card ─────────────────────── */}
          {loading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
              <Loader2 size={20} className="animate-spin" style={{ color: "#0D9488" }} />
            </div>
          ) : player ? (
            <div style={{ background: "white", borderRadius: 14, border: "1.5px solid rgba(13,148,136,0.45)", boxShadow: "0 1px 3px rgba(9,28,48,.05), 0 4px 16px rgba(9,28,48,.07)", padding: "14px 20px", marginBottom: 16, display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: "#0F2942", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 18 }}>
                {player.jersey_number || "–"}
              </div>
              <div style={{ flex: 1 }}>
                <h1 style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 22, color: "#0F2942", textTransform: "uppercase", letterSpacing: "0.04em", margin: 0, lineHeight: 1.2 }}>
                  {player.first_name} {player.last_name}
                </h1>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
                  {player.position && (
                    <span style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 600, fontSize: 11, color: "#0D9488", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      {player.position}
                    </span>
                  )}
                  {player.current_team && (
                    <span style={{ fontFamily: "'Source Serif 4', serif", fontSize: 12, color: "#6B7280" }}>
                      {player.current_team}
                    </span>
                  )}
                  {player.current_league && (
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "rgba(107,114,128,0.7)", background: "rgba(107,114,128,0.08)", borderRadius: 3, padding: "1px 5px" }}>
                      {player.current_league}
                    </span>
                  )}
                </div>
              </div>
              {stats && (
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  {[
                    { label: "GP", val: stats.gp },
                    { label: "G", val: stats.g },
                    { label: "A", val: stats.a },
                    { label: "P", val: stats.p },
                  ].map((s) => (
                    <div key={s.label} style={{ textAlign: "center" }}>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 16, color: "#0F2942" }}>{s.val ?? "–"}</div>
                      <div style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 600, fontSize: 9, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.1em" }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Film size={16} style={{ color: "#0D9488" }} />
                <span style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 13, color: "#0F2942", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Build Recruitment Reel
                </span>
              </div>
            </div>
          ) : null}

          {/* ── Two-panel layout ────────────────────────── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 16, alignItems: "start" }}>

            {/* ═══ LEFT PANEL — Clip Library ═══════════════ */}
            <div style={{ background: "white", borderRadius: 14, border: "1.5px solid rgba(13,148,136,0.45)", boxShadow: "0 1px 3px rgba(9,28,48,.05), 0 4px 16px rgba(9,28,48,.07)", overflow: "hidden" }}>

              {/* Filter bar */}
              <div style={{ padding: "12px 16px", borderBottom: "1px solid #E2EAF3", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <Scissors size={14} style={{ color: "#0D9488", marginRight: 4 }} />
                <span style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 600, fontSize: 12, color: "#0F2942", textTransform: "uppercase", letterSpacing: "0.08em", marginRight: 8 }}>
                  Clip Library
                </span>
                {FILTERS.map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setFilter(f.key)}
                    style={{
                      fontFamily: "'Oswald', sans-serif",
                      fontWeight: 600,
                      fontSize: 11,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      padding: "4px 10px",
                      borderRadius: 6,
                      border: filter === f.key ? "1.5px solid #0D9488" : "1px solid #E2EAF3",
                      background: filter === f.key ? "rgba(13,148,136,0.1)" : "transparent",
                      color: filter === f.key ? "#0D9488" : "#6B7280",
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                  >
                    {f.label}
                  </button>
                ))}
                <span style={{ marginLeft: "auto", fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#6B7280" }}>
                  {filteredClips.length} clips
                </span>
              </div>

              {/* Clip list */}
              <div style={{ maxHeight: "calc(100vh - 280px)", overflowY: "auto" }}>
                {clipsLoading ? (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
                    <Loader2 size={18} className="animate-spin" style={{ color: "#0D9488" }} />
                    <span style={{ marginLeft: 8, fontFamily: "'Source Serif 4', serif", fontSize: 13, color: "#6B7280" }}>Loading clips across all sessions...</span>
                  </div>
                ) : filteredClips.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "40px 20px" }}>
                    <Film size={32} style={{ color: "rgba(107,114,128,0.25)", margin: "0 auto 8px" }} />
                    <p style={{ fontFamily: "'Source Serif 4', serif", fontSize: 13, color: "#6B7280" }}>
                      {clips.length === 0 ? "No clips found for this player." : "No clips match this filter."}
                    </p>
                    {clips.length === 0 && (
                      <p style={{ fontFamily: "'Source Serif 4', serif", fontSize: 11, color: "rgba(107,114,128,0.6)", marginTop: 4 }}>
                        Import game data in Film Hub to see clips here.
                      </p>
                    )}
                  </div>
                ) : (
                  sessionGroups.map((group) => {
                    const isCollapsed = collapsedSessions.has(group.sessionKey);
                    const groupSelectedCount = group.clips.filter((c) => selectedIds.has(c.clip_id)).length;
                    const allGroupSelected = groupSelectedCount === group.clips.length;

                    return (
                      <div key={group.sessionKey}>
                        {/* Session header */}
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "8px 16px",
                            background: "#F8FAFC",
                            borderBottom: "1px solid #E2EAF3",
                            cursor: "pointer",
                            userSelect: "none",
                          }}
                          onClick={() => toggleSessionCollapse(group.sessionKey)}
                        >
                          {isCollapsed ? <ChevronRight size={14} style={{ color: "#6B7280" }} /> : <ChevronDown size={14} style={{ color: "#6B7280" }} />}
                          <span style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 600, fontSize: 12, color: "#0F2942", textTransform: "uppercase", letterSpacing: "0.05em", flex: 1 }}>
                            {group.sessionTitle}
                          </span>
                          {group.sessionDate && (
                            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#6B7280" }}>
                              {formatDate(group.sessionDate)}
                            </span>
                          )}
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: groupSelectedCount > 0 ? "#0D9488" : "#6B7280" }}>
                            {groupSelectedCount}/{group.clips.length}
                          </span>
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleSessionAll(group.clips); }}
                            style={{
                              fontFamily: "'Oswald', sans-serif",
                              fontWeight: 600,
                              fontSize: 9,
                              textTransform: "uppercase",
                              letterSpacing: "0.06em",
                              padding: "2px 8px",
                              borderRadius: 4,
                              border: "1px solid #E2EAF3",
                              background: allGroupSelected ? "rgba(13,148,136,0.1)" : "transparent",
                              color: allGroupSelected ? "#0D9488" : "#6B7280",
                              cursor: "pointer",
                            }}
                          >
                            {allGroupSelected ? "Deselect All" : "Select All"}
                          </button>
                        </div>

                        {/* Clip rows */}
                        {!isCollapsed && group.clips.map((clip) => {
                          const isSelected = selectedIds.has(clip.clip_id);
                          const badge = badgeColor(clip);
                          const dur = clipDuration(clip);
                          return (
                            <div
                              key={clip.clip_id}
                              onClick={() => toggleClip(clip.clip_id)}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 10,
                                padding: "8px 16px",
                                borderBottom: "1px solid rgba(226,234,243,0.5)",
                                cursor: "pointer",
                                background: isSelected ? "rgba(13,148,136,0.04)" : "transparent",
                                transition: "background 0.1s",
                              }}
                            >
                              {/* Checkbox */}
                              {isSelected ? (
                                <CheckSquare size={16} style={{ color: "#0D9488", flexShrink: 0 }} />
                              ) : (
                                <Square size={16} style={{ color: "#CBD5E1", flexShrink: 0 }} />
                              )}

                              {/* Clip info */}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontFamily: "'Source Serif 4', serif", fontSize: 13, color: "#0F2942", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                  {clip.title}
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#6B7280", display: "flex", alignItems: "center", gap: 3 }}>
                                    <Clock size={9} /> {fmtTime(clip.start_time_seconds)} – {fmtTime(clip.end_time_seconds)}
                                  </span>
                                  {clip.opponent && (
                                    <span style={{ fontFamily: "'Source Serif 4', serif", fontSize: 10, color: "rgba(107,114,128,0.7)" }}>
                                      {clip.opponent}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Event type badge */}
                              <span
                                style={{
                                  fontFamily: "'Oswald', sans-serif",
                                  fontWeight: 600,
                                  fontSize: 9,
                                  textTransform: "uppercase",
                                  letterSpacing: "0.06em",
                                  padding: "2px 8px",
                                  borderRadius: 4,
                                  background: badge.bg,
                                  color: badge.text,
                                  flexShrink: 0,
                                }}
                              >
                                {clip.clip_type || "clip"}
                              </span>

                              {/* Duration */}
                              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#6B7280", flexShrink: 0 }}>
                                {fmtDuration(dur)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* ═══ RIGHT PANEL — Reel Builder ═════════════ */}
            <div style={{ position: "sticky", top: 80 }}>
              <div style={{ background: "white", borderRadius: 14, border: "1.5px solid rgba(13,148,136,0.45)", boxShadow: "0 1px 3px rgba(9,28,48,.05), 0 4px 16px rgba(9,28,48,.07)", overflow: "hidden" }}>

                {/* Header */}
                <div style={{ padding: "12px 16px", borderBottom: "1px solid #E2EAF3" }}>
                  <h2 style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 14, color: "#0F2942", textTransform: "uppercase", letterSpacing: "0.06em", margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
                    <Film size={14} style={{ color: "#0D9488" }} /> Reel Builder
                  </h2>
                </div>

                {/* Reel title input */}
                <div style={{ padding: "12px 16px" }}>
                  <label style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 600, fontSize: 10, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 4 }}>
                    Reel Title
                  </label>
                  <input
                    type="text"
                    value={reelTitle}
                    onChange={(e) => setReelTitle(e.target.value)}
                    style={{
                      width: "100%",
                      fontFamily: "'Source Serif 4', serif",
                      fontSize: 13,
                      padding: "8px 10px",
                      borderRadius: 8,
                      border: "1.5px solid #E2EAF3",
                      color: "#0F2942",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                    placeholder="Reel title..."
                  />
                </div>

                {/* Recipient note */}
                <div style={{ padding: "0 16px 12px" }}>
                  <label style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 600, fontSize: 10, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 4 }}>
                    Note (Optional)
                  </label>
                  <textarea
                    value={reelNote}
                    onChange={(e) => setReelNote(e.target.value)}
                    rows={2}
                    style={{
                      width: "100%",
                      fontFamily: "'Source Serif 4', serif",
                      fontSize: 12,
                      padding: "8px 10px",
                      borderRadius: 8,
                      border: "1.5px solid #E2EAF3",
                      color: "#0F2942",
                      outline: "none",
                      resize: "vertical",
                      boxSizing: "border-box",
                    }}
                    placeholder="Add a note for the recipient..."
                  />
                </div>

                {/* Selected clips count + duration */}
                <div style={{ padding: "0 16px 8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 600, fontSize: 11, color: "#0F2942", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    {orderedClips.length} clip{orderedClips.length !== 1 ? "s" : ""} selected
                  </span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#6B7280" }}>
                    ≈ {fmtDuration(totalDuration)}
                  </span>
                </div>

                {/* Ordered clip list (draggable) */}
                <div style={{ maxHeight: 320, overflowY: "auto", borderTop: "1px solid #E2EAF3" }}>
                  {orderedClips.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "24px 16px" }}>
                      <Play size={24} style={{ color: "rgba(107,114,128,0.2)", margin: "0 auto 6px" }} />
                      <p style={{ fontFamily: "'Source Serif 4', serif", fontSize: 12, color: "#6B7280" }}>
                        Select clips from the library to build your reel.
                      </p>
                    </div>
                  ) : (
                    orderedClips.map((clip, idx) => {
                      const badge = badgeColor(clip);
                      return (
                        <div
                          key={clip.clip_id}
                          draggable
                          onDragStart={() => handleDragStart(idx)}
                          onDragOver={(e) => handleDragOver(e, idx)}
                          onDrop={() => handleDrop(idx)}
                          onDragEnd={handleDragEnd}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "6px 12px 6px 8px",
                            borderBottom: "1px solid rgba(226,234,243,0.5)",
                            background: dragOverIdx === idx ? "rgba(13,148,136,0.08)" : "transparent",
                            opacity: dragIdx === idx ? 0.4 : 1,
                            cursor: "grab",
                            transition: "background 0.1s",
                          }}
                        >
                          <GripVertical size={14} style={{ color: "#CBD5E1", flexShrink: 0 }} />
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#0D9488", fontWeight: 700, width: 18, textAlign: "center", flexShrink: 0 }}>
                            {idx + 1}
                          </span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontFamily: "'Source Serif 4', serif", fontSize: 12, color: "#0F2942", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {clip.title}
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 1 }}>
                              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "#6B7280" }}>
                                {fmtTime(clip.start_time_seconds)} – {fmtTime(clip.end_time_seconds)}
                              </span>
                              <span style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 600, fontSize: 8, textTransform: "uppercase", letterSpacing: "0.04em", padding: "1px 5px", borderRadius: 3, background: badge.bg, color: badge.text }}>
                                {clip.clip_type || "clip"}
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); removeFromReel(clip.clip_id); }}
                            style={{ background: "none", border: "none", cursor: "pointer", padding: 2, flexShrink: 0 }}
                            title="Remove from reel"
                          >
                            <X size={14} style={{ color: "#CBD5E1" }} />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Create button */}
                <div style={{ padding: "12px 16px", borderTop: "1px solid #E2EAF3" }}>
                  <button
                    onClick={handleCreate}
                    disabled={creating || orderedClips.length === 0 || !reelTitle.trim()}
                    style={{
                      width: "100%",
                      fontFamily: "'Oswald', sans-serif",
                      fontWeight: 700,
                      fontSize: 14,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      padding: "10px 0",
                      borderRadius: 10,
                      border: "none",
                      background: (creating || orderedClips.length === 0 || !reelTitle.trim()) ? "#CBD5E1" : "#0D9488",
                      color: "white",
                      cursor: (creating || orderedClips.length === 0 || !reelTitle.trim()) ? "not-allowed" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      transition: "background 0.15s",
                    }}
                  >
                    {creating ? (
                      <>
                        <Loader2 size={16} className="animate-spin" /> Creating...
                      </>
                    ) : (
                      <>
                        <Film size={16} /> Create Reel →
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>
      </main>
    </ProtectedRoute>
  );
}
