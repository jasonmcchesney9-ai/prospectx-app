"use client";

import { useState, useCallback } from "react";
import { Lock, Unlock, Copy, Check, Printer } from "lucide-react";
import HockeyRink from "@/components/HockeyRink";
import type { PostGameScriptData, GameState, BroadcastMode, BroadcastAudience } from "@/types/api";
import api from "@/lib/api";

interface Props {
  data: PostGameScriptData | null;
  gameState: GameState;
  isLocked: boolean;
  onUnlock: () => void;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  mode: BroadcastMode;
  audience: BroadcastAudience;
  onGenerated: (data: PostGameScriptData) => void;
}

type ScriptFormat = "30_second" | "60_second" | "2_minute";

const FORMAT_LABELS: Record<ScriptFormat, { label: string; desc: string }> = {
  "30_second": { label: "30 Sec", desc: "~75 words" },
  "60_second": { label: "60 Sec", desc: "~150 words" },
  "2_minute": { label: "2 Min", desc: "~300 words" },
};

export default function PostGameScript({
  data,
  gameState,
  isLocked,
  onUnlock,
  homeTeam,
  awayTeam,
  homeScore,
  awayScore,
  mode,
  audience,
  onGenerated,
}: Props) {
  const [format, setFormat] = useState<ScriptFormat>("60_second");
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    setError("");
    try {
      const { data: result } = await api.post("/broadcast/post-game", {
        home_team: homeTeam,
        away_team: awayTeam,
        home_score: homeScore,
        away_score: awayScore,
        format,
        mode,
        audience,
      }, { timeout: 90000 });
      onGenerated(result);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed to generate script";
      setError(msg);
    } finally {
      setIsGenerating(false);
    }
  }, [homeTeam, awayTeam, homeScore, awayScore, format, mode, audience, onGenerated]);

  const handleCopy = useCallback(async () => {
    if (!data?.script) return;
    try {
      await navigator.clipboard.writeText(data.script);
    } catch {
      // fallback
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [data]);

  // Lock overlay
  if (isLocked && gameState !== "post_game") {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <Lock size={24} className="text-muted/30 mb-2" />
        <p className="text-xs text-muted/50 mb-3">
          Post-game script is locked until the game ends.
        </p>
        <button
          onClick={onUnlock}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange/10 text-orange text-[10px] font-oswald font-bold uppercase tracking-wider hover:bg-orange/20 transition-colors"
        >
          <Unlock size={11} /> Unlock Early
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Format selector */}
      <div className="flex bg-navy/[0.04] rounded-lg p-0.5">
        {(Object.keys(FORMAT_LABELS) as ScriptFormat[]).map((f) => (
          <button
            key={f}
            onClick={() => setFormat(f)}
            className={`flex-1 px-2 py-1.5 rounded-md text-center transition-colors ${
              format === f
                ? "bg-white text-navy shadow-sm"
                : "text-muted/50 hover:text-muted"
            }`}
          >
            <span className="text-[10px] font-oswald font-bold uppercase tracking-wider block">
              {FORMAT_LABELS[f].label}
            </span>
            <span className="text-[8px] text-muted/40">{FORMAT_LABELS[f].desc}</span>
          </button>
        ))}
      </div>

      {/* Generate button */}
      <button
        onClick={handleGenerate}
        disabled={isGenerating || !homeTeam || !awayTeam}
        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-orange text-white text-[10px] font-oswald font-bold uppercase tracking-wider hover:bg-orange/90 transition-colors disabled:opacity-40"
      >
        {isGenerating ? <HockeyRink size="toast" animate /> : "Generate Script"}
      </button>

      {error && (
        <p className="text-[11px] text-red-600 text-center">{error}</p>
      )}

      {/* Script output */}
      {data?.script && (
        <div className="space-y-2">
          <div className="bg-navy/[0.02] rounded-lg p-3 text-xs text-navy leading-relaxed whitespace-pre-wrap">
            {data.script}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted/40">
              {data.word_count} words — {FORMAT_LABELS[data.format]?.label || data.format}
            </span>
            <div className="flex gap-1">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 px-2 py-1 rounded text-[9px] font-oswald uppercase tracking-wider text-muted/50 hover:text-navy bg-navy/[0.03] hover:bg-navy/[0.06] transition-colors"
              >
                {copied ? <Check size={9} className="text-green-600" /> : <Copy size={9} />}
                Copy
              </button>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1 px-2 py-1 rounded text-[9px] font-oswald uppercase tracking-wider text-muted/50 hover:text-navy bg-navy/[0.03] hover:bg-navy/[0.06] transition-colors"
              >
                <Printer size={9} /> Print
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
