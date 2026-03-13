"use client";

import { useState, useEffect, useRef, useCallback, useSyncExternalStore } from "react";
import { Volume2, VolumeX, Loader2 } from "lucide-react";
import api from "@/lib/api";

interface ListenButtonProps {
  text: string;
  reportId?: string;
  voice?: "neutral" | "professional";
  label?: string;
  className?: string;
}

/** Strip markdown/HTML formatting so speech sounds natural */
function cleanTextForSpeech(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1")
    .replace(/_{1,3}([^_]+)_{1,3}/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^[\s]*[-*+]\s+/gm, "")
    .replace(/^[\s]*\d+\.\s+/gm, "")
    .replace(/^---+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export default function ListenButton({ text, reportId, voice = "neutral", label, className }: ListenButtonProps) {
  const noopSubscribe = useCallback(() => () => {}, []);
  const supported = useSyncExternalStore(noopSubscribe, () => "speechSynthesis" in window, () => false);
  const [audioState, setAudioState] = useState<"idle" | "checking" | "generating" | "ready" | "playing" | "error">("idle");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [selectedVoice, setSelectedVoice] = useState<"neutral" | "professional">(voice);
  const [fallbackSpeaking, setFallbackSpeaking] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Check TTS cache on mount and when voice changes (only if reportId provided)
  useEffect(() => {
    if (!reportId) return;
    let cancelled = false;

    api.get(`/tts/audio/${reportId}/${selectedVoice}`)
      .then((res) => {
        if (!cancelled) {
          setAudioUrl(res.data.audio_url);
          setAudioState("ready");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAudioState("idle");
        }
      });

    return () => { cancelled = true; };
  }, [reportId, selectedVoice]);

  // Fallback to Web Speech API
  const fallbackToSpeech = useCallback(() => {
    if (!text.trim()) return;

    const cleaned = cleanTextForSpeech(text);
    const utterance = new SpeechSynthesisUtterance(cleaned);
    utterance.lang = "en-US";
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onend = () => {
      setFallbackSpeaking(false);
      utteranceRef.current = null;
    };
    utterance.onerror = () => {
      setFallbackSpeaking(false);
      utteranceRef.current = null;
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    setFallbackSpeaking(true);

    setShowTooltip(true);
    setTimeout(() => setShowTooltip(false), 3000);
  }, [text]);

  // Generate TTS audio via API
  const generateAudio = useCallback(async () => {
    if (!reportId) return;

    setAudioState("generating");

    try {
      const res = await api.post("/tts/generate", {
        text,
        report_id: reportId,
        voice: selectedVoice,
      });

      const url = res.data.audio_url;
      setAudioUrl(url);
      setAudioState("ready");

      // Auto-play after generation
      if (audioRef.current) {
        audioRef.current.src = url;
        try {
          await audioRef.current.play();
          setAudioState("playing");
        } catch {
          setAudioState("ready");
        }
      }
    } catch {
      setAudioState("error");
      fallbackToSpeech();
    }
  }, [reportId, text, selectedVoice, fallbackToSpeech]);

  // Toggle play/pause for loaded audio
  const togglePlayback = useCallback(async () => {
    if (!audioRef.current || !audioUrl) return;

    if (audioState === "playing") {
      audioRef.current.pause();
      setAudioState("ready");
    } else {
      audioRef.current.src = audioUrl;
      try {
        await audioRef.current.play();
        setAudioState("playing");
      } catch {
        setAudioState("error");
        fallbackToSpeech();
      }
    }
  }, [audioState, audioUrl, fallbackToSpeech]);

  // Main click handler
  const handleClick = useCallback(() => {
    // No reportId — use Web Speech API directly (original behavior)
    if (!reportId) {
      if (fallbackSpeaking) {
        window.speechSynthesis.cancel();
        setFallbackSpeaking(false);
        return;
      }
      if (!text.trim()) return;

      const cleaned = cleanTextForSpeech(text);
      const utterance = new SpeechSynthesisUtterance(cleaned);
      utterance.lang = "en-US";
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.onend = () => { setFallbackSpeaking(false); utteranceRef.current = null; };
      utterance.onerror = () => { setFallbackSpeaking(false); utteranceRef.current = null; };
      utteranceRef.current = utterance;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
      setFallbackSpeaking(true);
      return;
    }

    // With reportId — use TTS API
    switch (audioState) {
      case "idle":
      case "error":
        generateAudio();
        break;
      case "ready":
      case "playing":
        togglePlayback();
        break;
    }
  }, [reportId, audioState, fallbackSpeaking, text, generateAudio, togglePlayback]);

  // Audio element event handlers
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onEnded = () => setAudioState("ready");
    const onError = () => {
      setAudioState("error");
      fallbackToSpeech();
    };

    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);

    return () => {
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };
  }, [fallbackToSpeech]);

  // Cleanup on unmount
  useEffect(() => {
    const audio = audioRef.current;
    return () => {
      audio?.pause();
      window.speechSynthesis?.cancel();
    };
  }, []);

  if (!supported && !reportId) return null;

  const isSpeaking = fallbackSpeaking || audioState === "playing";
  const isLoading = audioState === "generating" || audioState === "checking";

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", position: "relative" }}>
      <button
        type="button"
        onClick={handleClick}
        disabled={isLoading}
        title={
          isLoading ? "Loading audio..." :
          isSpeaking ? "Stop reading" :
          (label || "Listen to this")
        }
        className={className || ""}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "4px",
          padding: "6px",
          borderRadius: "8px",
          border: isSpeaking ? "1px solid rgba(15, 42, 61, 0.2)" : "1px solid transparent",
          backgroundColor: isSpeaking ? "rgba(15, 42, 61, 0.1)" : "transparent",
          color: isSpeaking ? "#0F2A3D" : "rgba(15, 42, 61, 0.4)",
          cursor: isLoading ? "wait" : "pointer",
          transition: "all 150ms",
          opacity: isLoading ? 0.6 : 1,
        }}
      >
        {isLoading ? (
          <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
        ) : isSpeaking ? (
          <VolumeX size={16} />
        ) : (
          <Volume2 size={16} />
        )}
        {label && (
          <span style={{
            fontSize: "10px",
            fontFamily: "Oswald, sans-serif",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}>
            {isLoading ? "Loading" : isSpeaking ? "Stop" : label}
          </span>
        )}
      </button>

      {reportId && (
        <select
          value={selectedVoice}
          onChange={(e) => {
            audioRef.current?.pause();
            if (audioState === "playing") setAudioState("ready");
            setSelectedVoice(e.target.value as "neutral" | "professional");
          }}
          style={{
            fontSize: "11px",
            border: "1px solid #E2E8F0",
            borderRadius: "4px",
            padding: "2px 4px",
            backgroundColor: "#FFFFFF",
            color: "#0F2A3D",
            cursor: "pointer",
            outline: "none",
          }}
        >
          <option value="neutral">Neutral</option>
          <option value="professional">Professional</option>
        </select>
      )}

      {showTooltip && (
        <span style={{
          position: "absolute",
          bottom: "100%",
          left: "50%",
          transform: "translateX(-50%)",
          backgroundColor: "#0F2A3D",
          color: "#FFFFFF",
          fontSize: "11px",
          padding: "4px 8px",
          borderRadius: "4px",
          whiteSpace: "nowrap",
          marginBottom: "4px",
          zIndex: 10,
        }}>
          TTS unavailable — using browser voice
        </span>
      )}

      <audio ref={audioRef} style={{ display: "none" }} />
    </span>
  );
}
