"use client";

import { RefreshCw, BarChart3, MessageSquare } from "lucide-react";
import type { GameState } from "@/types/api";
import { GAME_STATE_LABELS } from "@/types/api";

interface Props {
  homeTeam: string;
  awayTeam: string;
  gameState: GameState;
  setGameState: (s: GameState) => void;
  period: number;
  setPeriod: (n: number) => void;
  homeScore: number;
  setHomeScore: (n: number) => void;
  awayScore: number;
  setAwayScore: (n: number) => void;
  onRefreshInsights: () => void;
  onUpdateCards: () => void;
  onNewStorylines: () => void;
  isGenerating: boolean;
}

const STATES: GameState[] = ["pre_game", "live", "intermission", "post_game"];

export default function GameControlBar({
  homeTeam,
  awayTeam,
  gameState,
  setGameState,
  period,
  setPeriod,
  homeScore,
  setHomeScore,
  awayScore,
  setAwayScore,
  onRefreshInsights,
  onUpdateCards,
  onNewStorylines,
  isGenerating,
}: Props) {
  return (
    <div className="sticky top-16 z-40 bg-[#1A2332] text-white border-b border-white/10">
      <div className="max-w-[1600px] mx-auto px-4 py-2 flex flex-wrap items-center gap-x-4 gap-y-2">
        {/* Game label */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-oswald uppercase tracking-wider text-white/40">Game</span>
          <span className="text-sm font-oswald font-bold">
            {awayTeam || "Away"} <span className="text-white/40">@</span> {homeTeam || "Home"}
          </span>
        </div>

        <div className="w-px h-5 bg-white/15 hidden sm:block" />

        {/* Period */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-oswald uppercase tracking-wider text-white/40">Period</span>
          <input
            type="number"
            min={1}
            max={5}
            value={period}
            onChange={(e) => setPeriod(Math.max(1, Math.min(5, Number(e.target.value) || 1)))}
            className="w-10 bg-white/10 border border-white/15 rounded px-1.5 py-0.5 text-sm text-center font-oswald font-bold"
          />
        </div>

        <div className="w-px h-5 bg-white/15 hidden sm:block" />

        {/* Score */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-oswald uppercase tracking-wider text-white/40">Score</span>
          <input
            type="number"
            min={0}
            value={homeScore}
            onChange={(e) => setHomeScore(Math.max(0, Number(e.target.value) || 0))}
            className="w-10 bg-white/10 border border-white/15 rounded px-1.5 py-0.5 text-sm text-center font-oswald font-bold"
          />
          <span className="text-white/30">-</span>
          <input
            type="number"
            min={0}
            value={awayScore}
            onChange={(e) => setAwayScore(Math.max(0, Number(e.target.value) || 0))}
            className="w-10 bg-white/10 border border-white/15 rounded px-1.5 py-0.5 text-sm text-center font-oswald font-bold"
          />
        </div>

        <div className="w-px h-5 bg-white/15 hidden sm:block" />

        {/* Game state chips */}
        <div className="flex items-center gap-0.5 bg-white/5 rounded-lg p-0.5">
          {STATES.map((s) => (
            <button
              key={s}
              onClick={() => setGameState(s)}
              className={`px-2.5 py-1 rounded-md text-[10px] font-oswald font-bold uppercase tracking-wider transition-colors ${
                gameState === s
                  ? s === "live"
                    ? "bg-red-500 text-white"
                    : "bg-teal text-white"
                  : "text-white/40 hover:text-white/70"
              }`}
            >
              {GAME_STATE_LABELS[s]}
            </button>
          ))}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Action buttons */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={onRefreshInsights}
            disabled={isGenerating}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-teal/20 text-teal text-[10px] font-oswald font-bold uppercase tracking-wider hover:bg-teal/30 transition-colors disabled:opacity-40"
          >
            <RefreshCw size={10} /> Insights
          </button>
          <button
            onClick={onUpdateCards}
            disabled={isGenerating}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-teal/20 text-teal text-[10px] font-oswald font-bold uppercase tracking-wider hover:bg-teal/30 transition-colors disabled:opacity-40"
          >
            <BarChart3 size={10} /> Cards
          </button>
          <button
            onClick={onNewStorylines}
            disabled={isGenerating}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-teal/20 text-teal text-[10px] font-oswald font-bold uppercase tracking-wider hover:bg-teal/30 transition-colors disabled:opacity-40"
          >
            <MessageSquare size={10} /> Storylines
          </button>
        </div>
      </div>
    </div>
  );
}
