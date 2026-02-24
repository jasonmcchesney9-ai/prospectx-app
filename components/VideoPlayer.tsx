"use client";

import { useRef, useEffect, useCallback } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Camera,
  Video,
} from "lucide-react";

/* ── Types ─────────────────────────────────────────────────── */
interface VideoEvent {
  id: string;
  game_date: string;
  team_name: string;
  opponent_name: string;
  player_id: string | null;
  player_name: string | null;
  period: number;
  clock_time: string;
  start_s: number;
  end_s: number | null;
  action: string;
  result: string | null;
  zone: string | null;
  short_description: string;
  pos_x: number | null;
  pos_y: number | null;
  order_index?: number;
}

interface VideoPlayerProps {
  events: VideoEvent[];
  currentIndex: number;
  onNext: () => void;
  onPrev: () => void;
  onSelectIndex: (idx: number) => void;
  videoUrl?: string | null;
}

/* ── Component ─────────────────────────────────────────────── */
export default function VideoPlayer({
  events,
  currentIndex,
  onNext,
  onPrev,
  onSelectIndex,
  videoUrl,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const currentEvent = events[currentIndex] || null;

  /* ── Seek to start_s on index change ────────────────────── */
  useEffect(() => {
    if (videoRef.current && currentEvent && videoUrl) {
      videoRef.current.currentTime = currentEvent.start_s;
      videoRef.current.play().catch(() => {});
    }
  }, [currentIndex, currentEvent, videoUrl]);

  /* ── Auto-advance when past end_s ───────────────────────── */
  const handleTimeUpdate = useCallback(() => {
    if (!videoRef.current || !currentEvent || !currentEvent.end_s) return;
    if (videoRef.current.currentTime > currentEvent.end_s) {
      onNext();
    }
  }, [currentEvent, onNext]);

  /* ── Keyboard navigation ────────────────────────────────── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        onPrev();
      } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        onNext();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onNext, onPrev]);

  if (!currentEvent) {
    return (
      <div className="bg-navy/[0.03] rounded-xl p-12 text-center">
        <Video size={32} className="mx-auto text-muted/40 mb-2" />
        <p className="text-sm text-muted">No clips in this session.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Current clip label */}
      <div className="mb-3 bg-navy/[0.04] rounded-lg px-4 py-2">
        <p className="text-sm font-semibold text-navy">{currentEvent.short_description}</p>
      </div>

      {/* Video / Placeholder */}
      {videoUrl ? (
        <video
          ref={videoRef}
          src={videoUrl}
          controls
          onTimeUpdate={handleTimeUpdate}
          className="w-full rounded-lg bg-black aspect-video"
        />
      ) : (
        <div className="bg-navy/[0.03] rounded-lg aspect-video flex flex-col items-center justify-center">
          <Camera size={48} className="text-muted/30 mb-3" />
          <p className="text-sm text-muted font-medium">No video linked to this game yet.</p>
          <p className="text-xs text-muted/60 mt-1">
            To enable playback, add a video URL in game settings.
          </p>
        </div>
      )}

      {/* Custom controls */}
      <div className="flex items-center justify-between mt-3 bg-white rounded-lg border border-teal/20 px-4 py-2">
        <button
          onClick={onPrev}
          disabled={currentIndex <= 0}
          className="flex items-center gap-1 text-sm text-navy hover:text-teal transition-colors disabled:opacity-30 disabled:cursor-not-allowed font-oswald uppercase tracking-wider"
        >
          <ChevronLeft size={16} />
          Previous Clip
        </button>
        <span className="text-xs text-muted font-oswald uppercase tracking-wider">
          Clip {currentIndex + 1} of {events.length}
        </span>
        <button
          onClick={onNext}
          disabled={currentIndex >= events.length - 1}
          className="flex items-center gap-1 text-sm text-navy hover:text-teal transition-colors disabled:opacity-30 disabled:cursor-not-allowed font-oswald uppercase tracking-wider"
        >
          Next Clip
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
