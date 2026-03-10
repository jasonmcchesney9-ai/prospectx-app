"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Film, Loader2, ArrowLeft, Copy, Download, Play, RotateCcw, Share2, RefreshCw, Link2 } from "lucide-react";
import MuxPlayer from "@mux/mux-player-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import api from "@/lib/api";
import toast from "react-hot-toast";

// ── Types ──

interface ReelClip {
  id: string;
  title: string;
  start_time_seconds: number;
  end_time_seconds: number;
  clip_type: string;
  tags: string[] | string | null;
  mux_playback_id: string;
  upload_id: string;
  period_number?: number;
}

interface ReelData {
  id: string;
  title: string;
  description: string | null;
  status: string;
  player_id: string | null;
  player_first_name: string | null;
  player_last_name: string | null;
  clip_ids: string[];
  clips: Array<{
    id: string;
    title: string;
    start_time_seconds: number;
    end_time_seconds: number;
    clip_type: string;
    tags: string[] | string | null;
    upload_id: string;
    session_id: string | null;
  }>;
  created_at: string;
}

// ── Helpers ──

const CLIP_CATEGORY_KEYWORDS: Record<string, string[]> = {
  teal: ["goal", "shot", "chance", "entry", "cycle", "zone_time", "screen", "net_battle", "offensive", "scoring"],
  navy: ["hit", "block", "turnover", "exit", "breakout", "dz_coverage", "coverage_miss", "stick_detail", "defensive"],
  orange: ["faceoff", "pp", "pk", "icing", "penalty", "power_play", "penalty_kill", "special"],
};

function getClipDotColor(clip: { tags: string[] | string | null; title: string; clip_type: string }): string {
  const tagStr = Array.isArray(clip.tags)
    ? clip.tags.join(" ").toLowerCase()
    : typeof clip.tags === "string"
    ? clip.tags.toLowerCase()
    : "";
  const combined = `${tagStr} ${(clip.title || "").toLowerCase()} ${clip.clip_type || ""}`.toLowerCase();
  for (const [color, keywords] of Object.entries(CLIP_CATEGORY_KEYWORDS)) {
    for (const kw of keywords) {
      if (combined.includes(kw)) {
        const map: Record<string, string> = { teal: "#0D9488", navy: "#1A3F54", orange: "#EA580C" };
        return map[color] || "#9CA3AF";
      }
    }
  }
  return "#9CA3AF";
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return iso;
  }
}

function cleanClipTitle(title: string): string {
  let cleaned = title;
  const colonIdx = title.indexOf(": ");
  if (colonIdx !== -1) cleaned = title.substring(colonIdx + 2);
  if (cleaned.length > 40) cleaned = cleaned.substring(0, 40) + "\u2026";
  return cleaned;
}

// ── Page Component ──

export default function ReelViewerPage() {
  const params = useParams();
  const reelId = params.id as string;

  const [clips, setClips] = useState<ReelClip[]>([]);
  const [currentClipIndex, setCurrentClipIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [reelTitle, setReelTitle] = useState("");
  const [reelDate, setReelDate] = useState("");
  const [playerName, setPlayerName] = useState<string | null>(null);
  const [reelComplete, setReelComplete] = useState(false);
  const [shareEnabled, setShareEnabled] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [showSharePanel, setShowSharePanel] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const muxPlayerRef = useRef<any>(null);
  const clipListRef = useRef<HTMLDivElement>(null);
  const timeUpdateRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Load reel data + resolve playback IDs ──
  useEffect(() => {
    let cancelled = false;

    async function loadReel() {
      try {
        const { data: reel } = await api.get<ReelData>(`/highlight-reels/${reelId}`);
        if (cancelled) return;

        setReelTitle(reel.title);
        setReelDate(reel.created_at);

        // Share state from backend
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const reelAny = reel as any;
        if (reelAny.share_token) setShareToken(reelAny.share_token);
        if (reelAny.share_enabled) setShareEnabled(!!reelAny.share_enabled);

        if (reel.player_first_name || reel.player_last_name) {
          setPlayerName(`${reel.player_first_name || ""} ${reel.player_last_name || ""}`.trim());
        }

        if (!reel.clips || reel.clips.length === 0) {
          setError("This reel has no clips.");
          setIsLoading(false);
          return;
        }

        // Collect unique upload_ids and fetch playback_ids
        const uniqueUploadIds = [...new Set(reel.clips.map((c) => c.upload_id).filter(Boolean))];
        const playbackMap: Record<string, string> = {};
        const periodMap: Record<string, number> = {};

        await Promise.all(
          uniqueUploadIds.map(async (uid) => {
            try {
              const { data: upload } = await api.get(`/film/uploads/${uid}`);
              if (upload.mux_playback_id) {
                playbackMap[uid] = upload.mux_playback_id;
              }
              if (upload.period_number) {
                periodMap[uid] = upload.period_number;
              }
            } catch {
              // Skip uploads that can't be fetched
            }
          })
        );

        if (cancelled) return;

        // Build enriched clips array in reel order
        const enrichedClips: ReelClip[] = reel.clips
          .filter((c) => playbackMap[c.upload_id])
          .map((c) => ({
            id: c.id,
            title: c.title,
            start_time_seconds: c.start_time_seconds,
            end_time_seconds: c.end_time_seconds,
            clip_type: c.clip_type,
            tags: c.tags,
            upload_id: c.upload_id,
            mux_playback_id: playbackMap[c.upload_id],
            period_number: periodMap[c.upload_id],
          }));

        if (enrichedClips.length === 0) {
          setError("No playable clips found in this reel.");
          setIsLoading(false);
          return;
        }

        setClips(enrichedClips);
        setIsLoading(false);
      } catch (e: unknown) {
        if (cancelled) return;
        const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Reel not found";
        setError(msg);
        setIsLoading(false);
      }
    }

    loadReel();
    return () => { cancelled = true; };
  }, [reelId]);

  // ── Time tracking: detect end of clip ──
  useEffect(() => {
    if (clips.length === 0 || reelComplete) return;

    const interval = setInterval(() => {
      const player = muxPlayerRef.current;
      if (!player) return;
      const currentClip = clips[currentClipIndex];
      if (!currentClip) return;

      if (player.currentTime >= currentClip.end_time_seconds) {
        // Advance to next clip
        const nextIndex = currentClipIndex + 1;
        if (nextIndex >= clips.length) {
          // Reel complete
          player.pause();
          setReelComplete(true);
        } else {
          setCurrentClipIndex(nextIndex);
        }
      }
    }, 250);

    timeUpdateRef.current = interval;
    return () => clearInterval(interval);
  }, [clips, currentClipIndex, reelComplete]);

  // ── On clip change: seek or swap playback ID ──
  useEffect(() => {
    if (clips.length === 0 || reelComplete) return;
    const clip = clips[currentClipIndex];
    if (!clip) return;

    const player = muxPlayerRef.current as HTMLMediaElement | null;
    if (!player) return;

    // If same playback_id, just seek
    // If different, the MuxPlayer component will re-render with new playbackId
    // Either way, seek to start time after a brief delay for the player to be ready
    const seekToStart = () => {
      if (player.readyState >= 1) {
        player.currentTime = clip.start_time_seconds;
        player.play().catch(() => { /* autoplay may be blocked */ });
      } else {
        player.addEventListener("loadedmetadata", function onMeta() {
          player.removeEventListener("loadedmetadata", onMeta);
          player.currentTime = clip.start_time_seconds;
          player.play().catch(() => { /* autoplay may be blocked */ });
        });
      }
    };

    // Small delay to let MuxPlayer update if playbackId changed
    setTimeout(seekToStart, 100);

    // Scroll clip list to active row
    if (clipListRef.current) {
      const activeRow = clipListRef.current.querySelector(`[data-clip-index="${currentClipIndex}"]`);
      if (activeRow) {
        activeRow.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }
  }, [currentClipIndex, clips, reelComplete]);

  const handleClipClick = useCallback((idx: number) => {
    setReelComplete(false);
    setCurrentClipIndex(idx);
  }, []);

  const handlePlayAgain = useCallback(() => {
    setReelComplete(false);
    setCurrentClipIndex(0);
  }, []);

  const handleCopyLink = useCallback(() => {
    if (!shareEnabled || !shareToken) {
      toast.error("Enable sharing first to get a share link");
      return;
    }
    const shareUrl = `https://www.prospectxintelligence.com/reel/${shareToken}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      toast.success("Share link copied", { duration: 3000 });
    }).catch(() => {
      toast.error("Failed to copy link");
    });
  }, [shareEnabled, shareToken]);

  const handleToggleShare = useCallback(async () => {
    try {
      const { data } = await api.patch(`/highlight-reels/${reelId}/share`, {
        share_enabled: !shareEnabled,
      });
      setShareEnabled(data.share_enabled);
      setShareToken(data.share_token);
      toast.success(data.share_enabled ? "Sharing enabled" : "Sharing disabled", { duration: 3000 });
    } catch {
      toast.error("Failed to update sharing");
    }
  }, [reelId, shareEnabled]);

  const handleRegenerateToken = useCallback(async () => {
    try {
      const { data } = await api.patch(`/highlight-reels/${reelId}/share`, {
        share_enabled: true,
        regenerate_token: true,
      });
      setShareEnabled(data.share_enabled);
      setShareToken(data.share_token);
      toast.success("New share link generated", { duration: 3000 });
    } catch {
      toast.error("Failed to regenerate link");
    }
  }, [reelId]);

  const shareUrl = shareToken ? `https://www.prospectxintelligence.com/reel/${shareToken}` : null;

  const currentClip = clips[currentClipIndex] || null;
  const currentPlaybackId = currentClip?.mux_playback_id || "";

  return (
    <ProtectedRoute>
      <NavBar />
      <div style={{ minHeight: "100vh", background: "#071E33" }}>
        {/* ── Header Bar ── */}
        <div style={{ background: "#0F2942", padding: "16px 24px" }}>
          <div style={{ maxWidth: 1400, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            {/* Left */}
            <div>
              <h1
                style={{
                  fontFamily: "'Oswald', sans-serif",
                  fontWeight: 700,
                  fontSize: 18,
                  color: "#FFFFFF",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  margin: 0,
                  lineHeight: 1.2,
                }}
              >
                {reelTitle || "Reel"}
              </h1>
              {playerName && (
                <p style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 400, fontSize: 11, color: "#14B8A8", marginTop: 2 }}>
                  {playerName}
                </p>
              )}
              {reelDate && (
                <p style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
                  {formatDate(reelDate)}
                </p>
              )}
            </div>
            {/* Right — buttons */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Link
                href="/film"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  fontFamily: "'Oswald', sans-serif",
                  fontWeight: 700,
                  fontSize: 10,
                  color: "rgba(255,255,255,0.6)",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  textDecoration: "none",
                  padding: "6px 12px",
                  borderRadius: 6,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "transparent",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                <ArrowLeft size={12} />
                Back to Film Hub
              </Link>
              <button
                onClick={() => setShowSharePanel(!showSharePanel)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  fontFamily: "'Oswald', sans-serif",
                  fontWeight: 700,
                  fontSize: 10,
                  color: shareEnabled ? "#14B8A8" : "rgba(255,255,255,0.6)",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  padding: "6px 12px",
                  borderRadius: 6,
                  border: shareEnabled ? "1px solid rgba(13,148,136,0.3)" : "1px solid rgba(255,255,255,0.12)",
                  background: showSharePanel ? "rgba(13,148,136,0.1)" : "transparent",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                <Share2 size={12} />
                Share
              </button>
              <button
                onClick={handleCopyLink}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  fontFamily: "'Oswald', sans-serif",
                  fontWeight: 700,
                  fontSize: 10,
                  color: "#14B8A8",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  padding: "6px 12px",
                  borderRadius: 6,
                  border: "1px solid rgba(13,148,136,0.3)",
                  background: "transparent",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                <Copy size={12} />
                Copy Link
              </button>
              <button
                disabled
                title="Download coming soon"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  fontFamily: "'Oswald', sans-serif",
                  fontWeight: 700,
                  fontSize: 10,
                  color: "rgba(255,255,255,0.25)",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  padding: "6px 12px",
                  borderRadius: 6,
                  border: "1px solid rgba(255,255,255,0.06)",
                  background: "transparent",
                  cursor: "not-allowed",
                }}
              >
                <Download size={12} />
                Download
              </button>
            </div>
          </div>
        </div>

        {/* ── Share Panel (collapsible) ── */}
        {showSharePanel && (
          <div style={{ background: "#0A2540", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "14px 24px" }}>
            <div style={{ maxWidth: 1400, margin: "0 auto", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              {/* Toggle */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 600, fontSize: 10, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Public Link
                </span>
                <button
                  onClick={handleToggleShare}
                  style={{
                    position: "relative",
                    width: 36,
                    height: 20,
                    borderRadius: 10,
                    border: "none",
                    background: shareEnabled ? "#0D9488" : "rgba(255,255,255,0.15)",
                    cursor: "pointer",
                    transition: "background 0.2s ease",
                    padding: 0,
                  }}
                >
                  <span
                    style={{
                      position: "absolute",
                      top: 2,
                      left: shareEnabled ? 18 : 2,
                      width: 16,
                      height: 16,
                      borderRadius: "50%",
                      background: "#FFFFFF",
                      transition: "left 0.2s ease",
                    }}
                  />
                </button>
                <span style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 10, color: shareEnabled ? "#14B8A8" : "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  {shareEnabled ? "On" : "Off"}
                </span>
              </div>
              {/* Share URL display */}
              {shareEnabled && shareUrl && (
                <>
                  <div style={{ flex: 1, minWidth: 200, display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.05)", borderRadius: 6, padding: "6px 10px" }}>
                    <Link2 size={12} style={{ color: "rgba(255,255,255,0.3)", flexShrink: 0 }} />
                    <span style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 11, color: "rgba(255,255,255,0.6)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {shareUrl}
                    </span>
                  </div>
                  <button
                    onClick={handleCopyLink}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      fontFamily: "'Oswald', sans-serif",
                      fontWeight: 700,
                      fontSize: 10,
                      color: "#14B8A8",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      padding: "6px 10px",
                      borderRadius: 5,
                      border: "1px solid rgba(13,148,136,0.3)",
                      background: "transparent",
                      cursor: "pointer",
                    }}
                  >
                    <Copy size={11} />
                    Copy
                  </button>
                  <button
                    onClick={handleRegenerateToken}
                    title="Generate a new share link (old link will stop working)"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      fontFamily: "'Oswald', sans-serif",
                      fontWeight: 700,
                      fontSize: 10,
                      color: "rgba(255,255,255,0.5)",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      padding: "6px 10px",
                      borderRadius: 5,
                      border: "1px solid rgba(255,255,255,0.1)",
                      background: "transparent",
                      cursor: "pointer",
                    }}
                  >
                    <RefreshCw size={11} />
                    Regenerate
                  </button>
                </>
              )}
              {/* Hint when off */}
              {!shareEnabled && (
                <span style={{ fontFamily: "'Source Serif 4', serif", fontSize: 12, color: "rgba(255,255,255,0.35)", fontStyle: "italic" }}>
                  Enable to create a public link anyone can view without signing in
                </span>
              )}
            </div>
          </div>
        )}

        {/* ── Main Content ── */}
        <div style={{ maxWidth: 1400, margin: "0 auto", padding: "16px 24px" }}>
          {isLoading ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 0" }}>
              <Loader2 size={28} style={{ color: "#0D9488", animation: "spin 1s linear infinite" }} />
              <p style={{ fontFamily: "'Oswald', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.5)", marginTop: 12, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                Loading reel…
              </p>
            </div>
          ) : error ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 0" }}>
              <Film size={36} style={{ color: "rgba(234,88,12,0.3)", marginBottom: 12 }} />
              <p style={{ fontFamily: "'Oswald', sans-serif", fontSize: 14, color: "rgba(255,255,255,0.6)", marginBottom: 16 }}>
                {error}
              </p>
              <Link
                href="/film"
                style={{
                  fontFamily: "'Oswald', sans-serif",
                  fontWeight: 700,
                  fontSize: 11,
                  color: "#0D9488",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  textDecoration: "none",
                }}
              >
                ← Back to Film Hub
              </Link>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
              {/* Left col — Video Player (66%) */}
              <div style={{ flex: "0 0 66%", minWidth: 0 }}>
                <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", background: "#000000" }}>
                  <MuxPlayer
                    ref={muxPlayerRef}
                    playbackId={currentPlaybackId}
                    streamType="on-demand"
                    accentColor="#14B8A6"
                    className="w-full aspect-video"
                    style={{ display: reelComplete ? "none" : "block" }}
                  />
                  {/* Reel complete overlay */}
                  {reelComplete && (
                    <div
                      className="aspect-video"
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "linear-gradient(135deg, #0F2942 0%, #071E33 100%)",
                      }}
                    >
                      <Film size={40} style={{ color: "#0D9488", marginBottom: 12 }} />
                      <p style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 16, color: "#FFFFFF", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>
                        Reel Complete
                      </p>
                      <button
                        onClick={handlePlayAgain}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          fontFamily: "'Oswald', sans-serif",
                          fontWeight: 700,
                          fontSize: 11,
                          color: "#FFFFFF",
                          textTransform: "uppercase",
                          letterSpacing: "0.08em",
                          padding: "8px 20px",
                          borderRadius: 8,
                          border: "none",
                          background: "#0D9488",
                          cursor: "pointer",
                          transition: "background 0.15s ease",
                        }}
                      >
                        <RotateCcw size={13} />
                        Play Again
                      </button>
                    </div>
                  )}
                </div>
                {/* Now playing indicator */}
                {currentClip && !reelComplete && (
                  <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 9, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                      Now playing
                    </span>
                    <span style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 600, fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
                      {currentClipIndex + 1}/{clips.length}
                    </span>
                    <span style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 400, fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
                      {cleanClipTitle(currentClip.title)}
                    </span>
                  </div>
                )}
              </div>

              {/* Right col — Clip List (34%) */}
              <div style={{ flex: "0 0 34%", minWidth: 0 }}>
                <div style={{ borderRadius: 12, overflow: "hidden", border: "1.5px solid rgba(255,255,255,0.08)" }}>
                  {/* Clips header */}
                  <div style={{ background: "#0F2942", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 600, fontSize: 11, color: "#14B8A8", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                      Clips
                    </span>
                    <span style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 9, color: "rgba(255,255,255,0.3)" }}>
                      {clips.length} clip{clips.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  {/* Clip rows */}
                  <div
                    ref={clipListRef}
                    style={{ background: "#0A2540", maxHeight: "calc(100vh - 260px)", overflowY: "auto" }}
                  >
                    {clips.map((clip, idx) => {
                      const isActive = idx === currentClipIndex && !reelComplete;
                      const dotColor = getClipDotColor(clip);
                      return (
                        <button
                          key={clip.id}
                          data-clip-index={idx}
                          onClick={() => handleClipClick(idx)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            width: "100%",
                            padding: "10px 16px",
                            background: isActive ? "rgba(13,148,136,0.15)" : "transparent",
                            borderLeft: isActive ? "3px solid #0D9488" : "3px solid transparent",
                            borderTop: "none",
                            borderRight: "none",
                            borderBottom: "1px solid rgba(255,255,255,0.04)",
                            cursor: "pointer",
                            textAlign: "left" as const,
                            transition: "all 0.15s ease",
                          }}
                        >
                          {/* Number */}
                          <span style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 12, color: "#0D9488", width: 18, textAlign: "center", flexShrink: 0 }}>
                            {idx + 1}
                          </span>
                          {/* Category dot */}
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
                          {/* Period badge */}
                          {clip.period_number && (
                            <span style={{ fontSize: 8, fontFamily: "ui-monospace, monospace", fontWeight: 700, background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.45)", borderRadius: 3, padding: "0 4px", lineHeight: "16px", flexShrink: 0 }}>
                              {clip.period_number <= 3 ? `P${clip.period_number}` : clip.period_number === 4 ? "OT" : "SO"}
                            </span>
                          )}
                          {/* Title + timecode */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 600, fontSize: 12, color: "#FFFFFF", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {cleanClipTitle(clip.title)}
                            </p>
                            <p style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 9, color: "rgba(255,255,255,0.4)", margin: 0, marginTop: 1 }}>
                              {formatTime(clip.start_time_seconds)} – {formatTime(clip.end_time_seconds)}
                            </p>
                          </div>
                          {/* Playing indicator */}
                          {isActive && (
                            <Play size={10} style={{ color: "#0D9488", flexShrink: 0 }} fill="#0D9488" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div style={{ background: "#071E33", padding: "10px 24px", marginTop: 24 }}>
          <p style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 9, color: "rgba(255,255,255,0.3)", textAlign: "center", margin: 0 }}>
            Built in ProspectX Intelligence{reelDate ? ` · ${formatDate(reelDate)}` : ""}
          </p>
        </div>
      </div>
    </ProtectedRoute>
  );
}
