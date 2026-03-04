"use client";

import { useRef, useEffect } from "react";
import { Video } from "lucide-react";
import MuxPlayer from "@mux/mux-player-react";

interface VideoPlayerProps {
  playbackId: string | null;
  onTimeUpdate: (seconds: number) => void;
  startTime?: number;
}

export default function VideoPlayer({
  playbackId,
  onTimeUpdate,
  startTime,
}: VideoPlayerProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playerRef = useRef<any>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll current time and send updates
  useEffect(() => {
    if (!playbackId) return;

    intervalRef.current = setInterval(() => {
      const el = playerRef.current;
      if (el && typeof el.currentTime === "number") {
        onTimeUpdate(el.currentTime);
      }
    }, 250);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [playbackId, onTimeUpdate]);

  // Seek to startTime when it changes
  useEffect(() => {
    if (startTime === undefined) return;
    const el = playerRef.current;
    if (el) {
      el.currentTime = startTime;
      el.play?.().catch(() => {});
    }
  }, [startTime]);

  if (!playbackId) {
    return (
      <div className="w-full aspect-video bg-navy/5 rounded-xl border border-border flex flex-col items-center justify-center">
        <Video size={40} className="text-muted/20 mb-2" />
        <p className="text-sm text-muted/50">No video attached to this session.</p>
        <p className="text-[11px] text-muted/30 mt-1">
          Upload a video and attach it to start reviewing.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full rounded-xl overflow-hidden border border-border bg-black">
      <MuxPlayer
        ref={playerRef}
        playbackId={playbackId}
        streamType="on-demand"
        accentColor="#14B8A6"
        className="w-full aspect-video"
      />
    </div>
  );
}
