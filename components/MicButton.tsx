"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Mic, MicOff } from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface MicButtonProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
  className?: string;
}

/** Get the SpeechRecognition constructor (vendor-prefixed or standard) */
function getSpeechRecognition(): (new () => any) | null {
  if (typeof window === "undefined") return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

/**
 * Voice input button using browser-native SpeechRecognition API.
 * Gracefully hides itself if the browser doesn't support the API.
 * When recording, shows a pulsing red dot. Calls onTranscript with the result.
 * Text is APPENDED to the current input value (handled by the parent).
 */
export default function MicButton({ onTranscript, disabled, className }: MicButtonProps) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (getSpeechRecognition()) {
      setSupported(true);
    }
  }, []);

  const toggle = useCallback(() => {
    if (listening) {
      // Stop
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const SR = getSpeechRecognition();
    if (!SR) return;

    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript;
      if (transcript) {
        onTranscript(transcript);
      }
    };

    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };

    recognition.onerror = () => {
      setListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }, [listening, onTranscript]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={disabled}
      title={listening ? "Stop listening" : "Voice input"}
      className={`relative p-1.5 rounded-lg transition-colors disabled:opacity-40 ${
        listening
          ? "bg-red-50 text-red-500 border border-red-200"
          : "text-teal/60 hover:text-teal hover:bg-teal/5 border border-transparent"
      } ${className || ""}`}
    >
      {listening ? <MicOff size={16} /> : <Mic size={16} />}
      {listening && (
        <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
      )}
    </button>
  );
}
