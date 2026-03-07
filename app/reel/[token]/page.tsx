"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import MuxPlayer from "@mux/mux-player-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ClipData {
  id: string;
  title: string;
  description?: string;
  start_time_seconds: number;
  end_time_seconds: number;
  clip_type?: string;
  mux_playback_id: string;
}

interface PlayerInfo {
  first_name?: string;
  last_name?: string;
  position?: string;
  team_name?: string;
  season?: string;
  gp?: number;
  g?: number;
  a?: number;
  p?: number;
  headshot_url?: string;
}

interface ReelShareData {
  id: string;
  title: string;
  type: string; // "game_highlights" | "player_highlights" | "teaching_reel" | "custom"
  clips: ClipData[];
  player_info: PlayerInfo;
  coach_name?: string;
  org_name?: string;
  org_email?: string;
  created_at: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PRODUCTION_API = "https://prospectx-app-production-b918.up.railway.app";
const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== "undefined" && window.location.hostname !== "localhost"
    ? PRODUCTION_API
    : "http://localhost:8000");

const TYPE_LABELS: Record<string, string> = {
  game_highlights: "Game Highlights",
  player_highlights: "Player Highlights",
  teaching_reel: "Teaching Reel",
  custom: "Custom",
};

const TYPE_COLORS: Record<string, { bg: string; color: string; border?: string }> = {
  game_highlights:   { bg: "#0D9488",          color: "#0F172A" },
  player_highlights: { bg: "#F97316",          color: "#0F172A" },
  teaching_reel:     { bg: "#0F2942",          color: "#FFFFFF", border: "1px solid #14B8A8" },
  custom:            { bg: "#475569",          color: "#FFFFFF" },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function totalReelDuration(clips: ClipData[]): number {
  return clips.reduce((sum, c) => sum + (c.end_time_seconds - c.start_time_seconds), 0);
}

function getInitials(first?: string, last?: string): string {
  return `${(first || "")[0] || ""}${(last || "")[0] || ""}`.toUpperCase() || "?";
}

// ── Not Available Page ────────────────────────────────────────────────────────

function NotAvailable() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0F2942",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Oswald', sans-serif",
        gap: 16,
      }}
    >
      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 6,
            background: "linear-gradient(135deg, #14B8A8, #0D9488)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span style={{ color: "white", fontWeight: 700, fontSize: 14 }}>PX</span>
        </div>
        <span style={{ color: "#14B8A8", fontWeight: 700, fontSize: 16, letterSpacing: "0.1em" }}>
          ProspectX Intelligence
        </span>
      </div>
      <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 16, letterSpacing: "0.06em" }}>
        This reel is not available.
      </p>
      <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>
        The link may have expired or sharing has been disabled.
      </p>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function PublicReelPage() {
  const params = useParams();
  const token = params.token as string;

  const [reel, setReel] = useState<ReelShareData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [currentClipIndex, setCurrentClipIndex] = useState(0);
  const [reelComplete, setReelComplete] = useState(false);
  const [currentPlaybackId, setCurrentPlaybackId] = useState<string | null>(null);

  const muxPlayerRef = useRef<HTMLVideoElement & { currentTime: number; pause: () => void }>(null);
  const timeUpdateRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Fetch reel data ──────────────────────────────────────────────────────────
  useEffect(() => {
    async function fetchReel() {
      try {
        const res = await fetch(`${API_BASE}/reel/${token}`);
        if (!res.ok) {
          setNotFound(true);
          setLoading(false);
          return;
        }
        const data: ReelShareData = await res.json();
        setReel(data);
        if (data.clips.length > 0) {
          setCurrentPlaybackId(data.clips[0].mux_playback_id);
        }
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }
    fetchReel();
  }, [token]);

  // ── Auto-advance clips (same logic as app/reels/[id]/page.tsx) ───────────────
  useEffect(() => {
    if (!reel || reel.clips.length === 0 || reelComplete) return;

    const interval = setInterval(() => {
      const player = muxPlayerRef.current;
      if (!player) return;
      const currentClip = reel.clips[currentClipIndex];
      if (!currentClip) return;

      if (player.currentTime >= currentClip.end_time_seconds) {
        const nextIndex = currentClipIndex + 1;
        if (nextIndex >= reel.clips.length) {
          player.pause();
          setReelComplete(true);
        } else {
          setCurrentClipIndex(nextIndex);
        }
      }
    }, 250);

    timeUpdateRef.current = interval;
    return () => clearInterval(interval);
  }, [reel, currentClipIndex, reelComplete]);

  // ── Seek / swap playback ID on clip change ───────────────────────────────────
  useEffect(() => {
    if (!reel) return;
    const clip = reel.clips[currentClipIndex];
    if (!clip) return;

    const player = muxPlayerRef.current;
    if (!player) return;

    if (clip.mux_playback_id === currentPlaybackId) {
      // Same Mux asset — just seek
      if (player.readyState >= 2) {
        player.currentTime = clip.start_time_seconds;
      } else {
        const onReady = () => {
          player.currentTime = clip.start_time_seconds;
          player.removeEventListener("loadedmetadata", onReady);
        };
        player.addEventListener("loadedmetadata", onReady);
      }
    } else {
      // Different Mux asset — swap playback ID
      setCurrentPlaybackId(clip.mux_playback_id);
    }
  }, [currentClipIndex, reel]);

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#0F2942",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            border: "2px solid rgba(20,184,166,0.3)",
            borderTop: "2px solid #14B8A8",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (notFound || !reel) return <NotAvailable />;

  const clips = reel.clips;
  const player = reel.player_info;
  const currentClip = clips[currentClipIndex];
  const typeLabel = TYPE_LABELS[reel.type] || "Highlight Reel";
  const typeBadgeStyle = TYPE_COLORS[reel.type] || TYPE_COLORS.custom;
  const duration = totalReelDuration(clips);

  return (
    <>
      {/* Google Fonts */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@400;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0F2942; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
        .clip-row:hover { background: rgba(255,255,255,0.05) !important; cursor: pointer; }
        .clip-row.active-clip { background: rgba(20,184,166,0.08) !important; border-left: 2px solid #14B8A8 !important; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <div style={{ minHeight: "100vh", background: "#0F2942", display: "flex", flexDirection: "column", fontFamily: "'Oswald', sans-serif" }}>

        {/* ── HEADER ─────────────────────────────────────────────────────────── */}
        <div
          style={{
            height: 44,
            background: "#071E33",
            borderBottom: "1px solid rgba(255,255,255,0.07)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 20px",
            flexShrink: 0,
          }}
        >
          {/* Logo */}
          <a
            href="https://prospectxintelligence.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}
          >
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: 4,
                background: "linear-gradient(135deg, #14B8A8, #0D9488)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span style={{ color: "white", fontWeight: 700, fontSize: 11 }}>PX</span>
            </div>
            <span style={{ color: "#14B8A8", fontWeight: 700, fontSize: 13, letterSpacing: "0.1em" }}>
              ProspectX Intelligence
            </span>
          </a>

          {/* Powered by */}
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10,
              color: "rgba(255,255,255,0.3)",
              letterSpacing: "0.04em",
            }}
          >
            Powered by ProspectX Intelligence
          </span>
        </div>

        {/* ── PLAYER IDENTITY BLOCK ──────────────────────────────────────────── */}
        <div
          style={{
            padding: "16px 24px 12px",
            background: "#071E33",
            borderBottom: "1px solid rgba(255,255,255,0.07)",
            display: "flex",
            alignItems: "center",
            gap: 16,
            flexShrink: 0,
          }}
        >
          {/* Headshot / Initials */}
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: player.headshot_url ? "transparent" : "linear-gradient(135deg, #0F2942, #14B8A8)",
              overflow: "hidden",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "2px solid rgba(20,184,166,0.3)",
            }}
          >
            {player.headshot_url ? (
              <img src={player.headshot_url} alt="Player" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <span style={{ color: "white", fontWeight: 700, fontSize: 18 }}>
                {getInitials(player.first_name, player.last_name)}
              </span>
            )}
          </div>

          {/* Player info */}
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 22, color: "white", letterSpacing: "0.02em", lineHeight: 1.1 }}>
              {player.first_name || ""} {player.last_name || ""}
            </div>
            <div style={{ fontSize: 13, color: "#14B8A8", fontWeight: 400, marginTop: 3, letterSpacing: "0.04em" }}>
              {[player.position, player.team_name, player.season].filter(Boolean).join(" · ")}
            </div>
            {/* Stats row */}
            {(player.gp || player.g || player.a || player.p) && (
              <div
                style={{
                  display: "flex",
                  gap: 16,
                  marginTop: 6,
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                {[
                  { label: "GP", val: player.gp },
                  { label: "G",  val: player.g  },
                  { label: "A",  val: player.a  },
                  { label: "P",  val: player.p  },
                ].map(({ label, val }) => (
                  <div key={label} style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                    <span style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", letterSpacing: "0.08em" }}>{label}</span>
                    <span style={{ fontSize: 13, color: "white", fontWeight: 500 }}>{val ?? "—"}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Reel metadata */}
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div
              style={{
                display: "inline-block",
                padding: "3px 10px",
                borderRadius: 999,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.08em",
                background: typeBadgeStyle.bg,
                color: typeBadgeStyle.color,
                border: typeBadgeStyle.border || "none",
                marginBottom: 6,
              }}
            >
              {typeLabel.toUpperCase()}
            </div>
            <div style={{ fontSize: 13, color: "white", fontWeight: 600, letterSpacing: "0.04em" }}>
              {reel.title}
            </div>
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 10,
                color: "rgba(255,255,255,0.4)",
                marginTop: 2,
              }}
            >
              {clips.length} clips · {formatDuration(duration)}
            </div>
          </div>
        </div>

        {/* ── MAIN CONTENT ───────────────────────────────────────────────────── */}
        <div
          style={{
            flex: 1,
            display: "grid",
            gridTemplateColumns: "1fr 300px",
            gap: 0,
            minHeight: 0,
            maxWidth: 1200,
            width: "100%",
            margin: "0 auto",
            padding: "20px 20px 0",
            alignItems: "start",
          }}
        >
          {/* Left — Video + reel complete */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ position: "relative", background: "#000", borderRadius: 8, overflow: "hidden" }}>
              <MuxPlayer
                ref={muxPlayerRef as any}
                playbackId={currentPlaybackId || ""}
                streamType="on-demand"
                accentColor="#14B8A6"
                style={{
                  width: "100%",
                  aspectRatio: "16/9",
                  display: reelComplete ? "none" : "block",
                }}
              />

              {/* Reel Complete overlay */}
              {reelComplete && (
                <div
                  style={{
                    aspectRatio: "16/9",
                    background: "#060E1A",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 16,
                  }}
                >
                  <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", letterSpacing: "0.12em", fontWeight: 600 }}>
                    REEL COMPLETE
                  </div>
                  <button
                    onClick={() => {
                      setReelComplete(false);
                      setCurrentClipIndex(0);
                    }}
                    style={{
                      background: "transparent",
                      border: "1px solid rgba(20,184,166,0.5)",
                      color: "#14B8A8",
                      fontFamily: "'Oswald', sans-serif",
                      fontWeight: 600,
                      fontSize: 11,
                      letterSpacing: "0.1em",
                      padding: "8px 20px",
                      borderRadius: 6,
                      cursor: "pointer",
                    }}
                  >
                    PLAY AGAIN
                  </button>
                </div>
              )}
            </div>

            {/* Now playing bar */}
            {currentClip && !reelComplete && (
              <div
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 6,
                  padding: "8px 12px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em", fontWeight: 600 }}>
                    NOW PLAYING
                  </span>
                  <div style={{ fontSize: 13, color: "white", fontWeight: 600, marginTop: 2 }}>
                    {currentClip.title}
                  </div>
                </div>
                <div
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 10,
                    color: "rgba(255,255,255,0.35)",
                  }}
                >
                  {currentClipIndex + 1} / {clips.length}
                </div>
              </div>
            )}
          </div>

          {/* Right — Clip list */}
          <div
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 8,
              overflow: "hidden",
              marginLeft: 16,
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: "10px 12px",
                borderBottom: "1px solid rgba(255,255,255,0.07)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", fontWeight: 700, letterSpacing: "0.14em" }}>
                CLIPS
              </span>
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 9,
                  background: "#0D9488",
                  color: "white",
                  padding: "1px 6px",
                  borderRadius: 999,
                }}
              >
                {clips.length}
              </span>
            </div>

            {/* Clip rows */}
            <div style={{ overflowY: "auto", maxHeight: 420 }}>
              {clips.map((clip, idx) => (
                <div
                  key={clip.id}
                  className={`clip-row${idx === currentClipIndex && !reelComplete ? " active-clip" : ""}`}
                  onClick={() => {
                    setReelComplete(false);
                    setCurrentClipIndex(idx);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "9px 12px",
                    borderBottom: "1px solid rgba(255,255,255,0.04)",
                    borderLeft: "2px solid transparent",
                    transition: "all 0.15s",
                  }}
                >
                  {/* Number */}
                  <span
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 10,
                      color: idx === currentClipIndex ? "#14B8A8" : "rgba(255,255,255,0.25)",
                      width: 16,
                      flexShrink: 0,
                      fontWeight: 600,
                    }}
                  >
                    {idx + 1}
                  </span>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 11,
                        color: idx === currentClipIndex ? "white" : "rgba(255,255,255,0.7)",
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        letterSpacing: "0.02em",
                      }}
                    >
                      {clip.title}
                    </div>
                    <div
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 9,
                        color: "rgba(255,255,255,0.3)",
                        marginTop: 2,
                      }}
                    >
                      {formatDuration(clip.end_time_seconds - clip.start_time_seconds)}
                    </div>
                  </div>

                  {/* Play indicator */}
                  {idx === currentClipIndex && !reelComplete && (
                    <div
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: "#14B8A8",
                        flexShrink: 0,
                      }}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── CONTACT BLOCK ──────────────────────────────────────────────────── */}
        {(reel.coach_name || reel.org_name || reel.org_email) && (
          <div
            style={{
              maxWidth: 1200,
              width: "100%",
              margin: "16px auto 0",
              padding: "0 20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div>
              {reel.coach_name && (
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", fontWeight: 600, letterSpacing: "0.04em" }}>
                  Scouted by {reel.coach_name}
                </div>
              )}
              {reel.org_name && (
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", letterSpacing: "0.04em", marginTop: 2 }}>
                  {reel.org_name}
                </div>
              )}
            </div>
            {reel.org_email && (
              <a
                href={`mailto:${reel.org_email}`}
                style={{
                  display: "inline-block",
                  padding: "7px 16px",
                  border: "1px solid rgba(20,184,166,0.4)",
                  borderRadius: 6,
                  color: "#14B8A8",
                  fontFamily: "'Oswald', sans-serif",
                  fontWeight: 600,
                  fontSize: 11,
                  letterSpacing: "0.08em",
                  textDecoration: "none",
                }}
              >
                REQUEST MORE INFORMATION
              </a>
            )}
          </div>
        )}

        {/* ── FOOTER ─────────────────────────────────────────────────────────── */}
        <div
          style={{
            textAlign: "center",
            padding: "20px",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 9,
            color: "rgba(255,255,255,0.2)",
            letterSpacing: "0.04em",
            marginTop: 8,
          }}
        >
          Built in ProspectX Intelligence · prospectxintelligence.com
        </div>

      </div>
    </>
  );
}
