"use client";

import { useRef, useEffect, useCallback } from "react";
import { Loader2, Video } from "lucide-react";

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
  const videoRef = useRef<HTMLVideoElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll current time and send updates
  useEffect(() => {
    if (!playbackId || !videoRef.current) return;

    intervalRef.current = setInterval(() => {
      if (videoRef.current) {
        onTimeUpdate(videoRef.current.currentTime);
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
    if (startTime !== undefined && videoRef.current) {
      videoRef.current.currentTime = startTime;
      videoRef.current.play().catch(() => {});
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

  // Use native HLS video element with Mux stream URL
  const hlsUrl = `https://stream.mux.com/${playbackId}.m3u8`;
  const posterUrl = `https://image.mux.com/${playbackId}/thumbnail.jpg?time=0`;

  return (
    <div className="w-full rounded-xl overflow-hidden border border-border bg-black">
      <video
        ref={videoRef}
        src={hlsUrl}
        poster={posterUrl}
        controls
        playsInline
        className="w-full aspect-video"
        style={{ backgroundColor: "#000" }}
      >
        Your browser does not support HLS video playback.
      </video>
    </div>
  );
}
