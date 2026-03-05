"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Volume2, VolumeX } from "lucide-react";

interface ListenButtonProps {
  text: string;
  label?: string;
  className?: string;
}

/** Strip markdown/HTML formatting so speech sounds natural */
function cleanTextForSpeech(raw: string): string {
  return raw
    // Remove HTML tags
    .replace(/<[^>]+>/g, "")
    // Remove markdown headings
    .replace(/^#{1,6}\s+/gm, "")
    // Remove markdown bold/italic markers
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1")
    .replace(/_{1,3}([^_]+)_{1,3}/g, "$1")
    // Remove markdown links [text](url) → text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    // Remove markdown images
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    // Remove markdown code blocks
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`([^`]+)`/g, "$1")
    // Remove markdown list markers
    .replace(/^[\s]*[-*+]\s+/gm, "")
    .replace(/^[\s]*\d+\.\s+/gm, "")
    // Remove markdown horizontal rules
    .replace(/^---+$/gm, "")
    // Clean up extra whitespace
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Text-to-speech button using browser-native speechSynthesis API.
 * Gracefully hides itself if the browser doesn't support the API.
 * Clicking while speaking cancels the speech.
 */
export default function ListenButton({ text, label, className }: ListenButtonProps) {
  const [supported, setSupported] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      setSupported(true);
    }
  }, []);

  const toggle = useCallback(() => {
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }

    if (!text.trim()) return;

    const cleaned = cleanTextForSpeech(text);
    const utterance = new SpeechSynthesisUtterance(cleaned);
    utterance.lang = "en-US";
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onend = () => {
      setSpeaking(false);
      utteranceRef.current = null;
    };

    utterance.onerror = () => {
      setSpeaking(false);
      utteranceRef.current = null;
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.cancel(); // Clear any queued speech
    window.speechSynthesis.speak(utterance);
    setSpeaking(true);
  }, [speaking, text]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
    };
  }, []);

  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      title={speaking ? "Stop reading" : (label || "Listen to this")}
      className={`inline-flex items-center gap-1 p-1.5 rounded-lg transition-colors ${
        speaking
          ? "bg-navy/10 text-navy border border-navy/20"
          : "text-navy/40 hover:text-navy hover:bg-navy/5 border border-transparent"
      } ${className || ""}`}
    >
      {speaking ? <VolumeX size={16} /> : <Volume2 size={16} />}
      {label && <span className="text-[10px] font-oswald uppercase tracking-wider">{speaking ? "Stop" : label}</span>}
    </button>
  );
}
