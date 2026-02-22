"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Zap, FileText, RefreshCw, BarChart3, Radio, Calendar } from "lucide-react";
import HockeyRink from "@/components/HockeyRink";
import type { Player, BroadcastMode, BroadcastDepth, BroadcastAudience, BroadcastScheduleGame } from "@/types/api";

interface Props {
  homeTeam: string;
  awayTeam: string;
  homeRoster: Player[];
  awayRoster: Player[];
  mode: BroadcastMode;
  setMode: (m: BroadcastMode) => void;
  depth: BroadcastDepth;
  setDepth: (d: BroadcastDepth) => void;
  audience: BroadcastAudience;
  setAudience: (a: BroadcastAudience) => void;
  gameDate: string;
  onGenerateAll: () => void;
  onGenerateTool: (tool: string) => void;
  isGenerating: boolean;
  onPlayerClick?: (player: Player) => void;
  scheduleGames?: BroadcastScheduleGame[];
  onPickGame?: (game: BroadcastScheduleGame) => void;
}

function SegmentedGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div>
      <span className="text-[9px] font-oswald uppercase tracking-wider text-muted/60 block mb-1">
        {label}
      </span>
      <div className="flex bg-navy/[0.04] rounded-lg p-0.5">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`flex-1 px-2 py-1 rounded-md text-[10px] font-oswald font-bold uppercase tracking-wider transition-colors ${
              value === opt.value
                ? "bg-white text-navy shadow-sm"
                : "text-muted/50 hover:text-muted"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function GameContextRail({
  homeTeam,
  awayTeam,
  homeRoster,
  awayRoster,
  mode,
  setMode,
  depth,
  setDepth,
  audience,
  setAudience,
  gameDate,
  onGenerateAll,
  onGenerateTool,
  isGenerating,
  onPlayerClick,
  scheduleGames,
  onPickGame,
}: Props) {
  const [homeExpanded, setHomeExpanded] = useState(true);
  const [awayExpanded, setAwayExpanded] = useState(true);

  return (
    <div className="sticky top-[7.5rem] h-[calc(100vh-7.5rem)] overflow-y-auto pb-4 space-y-3">
      {/* Schedule Picker */}
      {scheduleGames && scheduleGames.length > 0 && (
        <div className="bg-white rounded-xl border border-teal/20 p-3">
          <div className="flex items-center gap-2 mb-2">
            <Calendar size={12} className="text-teal" />
            <span className="text-[9px] font-oswald uppercase tracking-wider text-muted/60">Today&apos;s Games</span>
          </div>
          <div className="space-y-1">
            {scheduleGames.map((g) => (
              <button
                key={g.id}
                onClick={() => onPickGame?.(g)}
                className="w-full text-left px-2 py-1.5 rounded-lg text-[11px] hover:bg-teal/5 transition-colors border border-transparent hover:border-teal/10"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-navy">{g.away_team} <span className="text-muted/40">@</span> {g.home_team}</span>
                  {g.game_date && <span className="text-muted/40 text-[10px]">{g.game_date}</span>}
                </div>
                {g.venue && <span className="text-[9px] text-muted/40">{g.venue}</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Game Header Card */}
      <div className="bg-white rounded-xl border border-teal/20 p-3">
        <div className="flex items-center gap-2 mb-1.5">
          <Radio size={14} className="text-orange" />
          <span className="text-[10px] font-oswald uppercase tracking-wider text-muted">Broadcast Console</span>
        </div>
        {homeTeam && awayTeam ? (
          <>
            <div className="text-center">
              <div className="text-xs text-muted/60 font-oswald uppercase tracking-wider">
                {awayTeam}
              </div>
              <div className="text-[10px] text-muted/40 my-0.5">@</div>
              <div className="text-xs text-navy font-oswald font-bold uppercase tracking-wider">
                {homeTeam}
              </div>
            </div>
            {gameDate && (
              <div className="text-[10px] text-center text-muted/50 mt-1.5">
                {gameDate}
              </div>
            )}
          </>
        ) : (
          <p className="text-xs text-muted/50 text-center py-2">
            Select teams above to begin
          </p>
        )}
      </div>

      {/* Quick Toggles */}
      <div className="bg-white rounded-xl border border-teal/20 p-3 space-y-2.5">
        <SegmentedGroup<BroadcastMode>
          label="Mode"
          options={[
            { value: "broadcast", label: "Broadcast" },
            { value: "producer", label: "Producer" },
          ]}
          value={mode}
          onChange={setMode}
        />
        <SegmentedGroup<BroadcastDepth>
          label="Depth"
          options={[
            { value: "quick", label: "Quick" },
            { value: "standard", label: "Standard" },
            { value: "deep", label: "Deep" },
          ]}
          value={depth}
          onChange={setDepth}
        />
        <SegmentedGroup<BroadcastAudience>
          label="Audience"
          options={[
            { value: "casual", label: "Casual" },
            { value: "informed", label: "Informed" },
            { value: "hardcore", label: "Hardcore" },
          ]}
          value={audience}
          onChange={setAudience}
        />
      </div>

      {/* Roster Jump List */}
      {(homeRoster.length > 0 || awayRoster.length > 0) && (
        <div className="bg-white rounded-xl border border-teal/20 overflow-hidden">
          {/* Home roster */}
          {homeRoster.length > 0 && (
            <div>
              <button
                onClick={() => setHomeExpanded(!homeExpanded)}
                className="flex items-center justify-between w-full px-3 py-2 text-left hover:bg-navy/[0.02] transition-colors border-b border-teal/10"
              >
                <span className="text-[10px] font-oswald font-bold uppercase tracking-wider text-navy">
                  {homeTeam} ({homeRoster.length})
                </span>
                {homeExpanded ? <ChevronUp size={12} className="text-muted" /> : <ChevronDown size={12} className="text-muted" />}
              </button>
              {homeExpanded && (
                <div className="px-2 py-1 max-h-40 overflow-y-auto">
                  {homeRoster.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => onPlayerClick?.(p)}
                      className="w-full text-left px-1.5 py-0.5 text-[11px] text-navy hover:bg-teal/5 rounded transition-colors truncate"
                    >
                      <span className="text-muted/50 font-mono text-[10px] mr-1">
                        {p.tags?.[0] || ""}
                      </span>
                      {p.last_name}
                      <span className="text-muted/40 ml-1">({p.position})</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {/* Away roster */}
          {awayRoster.length > 0 && (
            <div>
              <button
                onClick={() => setAwayExpanded(!awayExpanded)}
                className="flex items-center justify-between w-full px-3 py-2 text-left hover:bg-navy/[0.02] transition-colors border-b border-teal/10"
              >
                <span className="text-[10px] font-oswald font-bold uppercase tracking-wider text-navy">
                  {awayTeam} ({awayRoster.length})
                </span>
                {awayExpanded ? <ChevronUp size={12} className="text-muted" /> : <ChevronDown size={12} className="text-muted" />}
              </button>
              {awayExpanded && (
                <div className="px-2 py-1 max-h-40 overflow-y-auto">
                  {awayRoster.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => onPlayerClick?.(p)}
                      className="w-full text-left px-1.5 py-0.5 text-[11px] text-navy hover:bg-teal/5 rounded transition-colors truncate"
                    >
                      <span className="text-muted/50 font-mono text-[10px] mr-1">
                        {p.tags?.[0] || ""}
                      </span>
                      {p.last_name}
                      <span className="text-muted/40 ml-1">({p.position})</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Hot Buttons */}
      <div className="space-y-1.5">
        <button
          onClick={onGenerateAll}
          disabled={isGenerating || !homeTeam || !awayTeam}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-orange text-white text-xs font-oswald font-bold uppercase tracking-wider hover:bg-orange/90 transition-colors disabled:opacity-40"
        >
          {isGenerating ? (
            <HockeyRink size="toast" animate />
          ) : (
            <>
              <Zap size={14} />
              Generate All
            </>
          )}
        </button>
        <button
          onClick={() => onGenerateTool("spotting_board")}
          disabled={isGenerating || !homeTeam || !awayTeam}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-teal text-white text-[10px] font-oswald font-bold uppercase tracking-wider hover:bg-teal/90 transition-colors disabled:opacity-40"
        >
          <FileText size={11} /> Spotting Board
        </button>
        <button
          onClick={() => onGenerateTool("talk_tracks")}
          disabled={isGenerating || !homeTeam || !awayTeam}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-teal text-white text-[10px] font-oswald font-bold uppercase tracking-wider hover:bg-teal/90 transition-colors disabled:opacity-40"
        >
          <RefreshCw size={11} /> Refresh Storylines
        </button>
        <button
          onClick={() => onGenerateTool("stat_cards")}
          disabled={isGenerating || !homeTeam || !awayTeam}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-teal text-white text-[10px] font-oswald font-bold uppercase tracking-wider hover:bg-teal/90 transition-colors disabled:opacity-40"
        >
          <BarChart3 size={11} /> Update Stat Cards
        </button>
      </div>
    </div>
  );
}
