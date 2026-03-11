"use client";

import { useRef, useEffect, useImperativeHandle, forwardRef } from "react";
import { Video } from "lucide-react";
import MuxPlayer from "@mux/mux-player-react";

interface VideoPlayerProps {
  playbackId: string | null;
  onTimeUpdate: (seconds: number) => void;
  startTime?: number;
}

export interface VideoPlayerHandle {
  getCurrentTime: () => number;
  setPlaybackRate: (rate: number) => void;
  pause: () => void;
  seekBy: (delta: number) => void;
}

const VideoPlayer = forwardRef<VideoPlayerHandle, VideoPlayerProps>(
  function VideoPlayer({ playbackId, onTimeUpdate, startTime }, ref) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const playerRef = useRef<any>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Expose imperative handle for parent to control playback
    useImperativeHandle(ref, () => ({
      getCurrentTime: () => {
        const el = playerRef.current;
        return el && typeof el.currentTime === "number" ? el.currentTime : 0;
      },
      setPlaybackRate: (rate: number) => {
        const el = playerRef.current;
        if (el) el.playbackRate = rate;
      },
      pause: () => {
        const el = playerRef.current;
        if (el) el.pause?.();
      },
      seekBy: (delta: number) => {
        const el = playerRef.current;
        if (el && typeof el.currentTime === "number") {
          el.pause?.();
          el.currentTime = Math.max(0, el.currentTime + delta);
        }
      },
    }));

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
      <div className="w-full bg-black" style={{ borderRadius: 12, overflow: "visible" }}>
        <MuxPlayer
          ref={playerRef}
          playbackId={playbackId}
          streamType="on-demand"
          volume={1}
          muted={false}
          defaultShowRemainingTime
          accentColor="#14B8A6"
          className="w-full aspect-video"
        />
      </div>
    );
  }
);

export default VideoPlayer;
