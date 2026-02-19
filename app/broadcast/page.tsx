"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  FileText,
  Mic,
  Sparkles,
  BarChart3,
  Camera,
  Radio,
  Clock,
} from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import BroadcastToolCard from "@/components/BroadcastToolCard";
import GameControlBar from "@/components/broadcast/GameControlBar";
import GameContextRail from "@/components/broadcast/GameContextRail";
import ReferenceDrawer, { type RightTab } from "@/components/broadcast/ReferenceDrawer";
import SpottingBoard from "@/components/broadcast/SpottingBoard";
import TalkTracks from "@/components/broadcast/TalkTracks";
import PXIInsights from "@/components/broadcast/PXIInsights";
import LiveStatCards from "@/components/broadcast/LiveStatCards";
import GraphicsSuggestions from "@/components/broadcast/GraphicsSuggestions";
import PlayerProfiles from "@/components/broadcast/PlayerProfiles";
import InterviewQuestions from "@/components/broadcast/InterviewQuestions";
import PostGameScript from "@/components/broadcast/PostGameScript";
import StorylineTimeline from "@/components/broadcast/StorylineTimeline";
import api from "@/lib/api";
import type {
  Player,
  GameState,
  BroadcastMode,
  BroadcastDepth,
  BroadcastAudience,
  BroadcastToolName,
  SpottingBoardData,
  TalkTrack,
  TalkTrackCategory,
  PXIInsight,
  StatCard,
  GraphicSuggestion,
  BroadcastPlayerProfile,
  InterviewQuestion,
  PostGameScriptData,
  TimelineEntry,
} from "@/types/api";

// ── Tool card state ──────────────────────────────────────
interface ToolCardState {
  id: BroadcastToolName;
  title: string;
  icon: React.ElementType;
  pinned: boolean;
  collapsed: boolean;
  loading: boolean;
  generatedAt: string | null;
}

const DEFAULT_CENTER_TOOLS: ToolCardState[] = [
  { id: "spotting_board", title: "Spotting Board", icon: FileText, pinned: false, collapsed: false, loading: false, generatedAt: null },
  { id: "talk_tracks", title: "Talk Tracks", icon: Mic, pinned: false, collapsed: false, loading: false, generatedAt: null },
  { id: "storyline_timeline", title: "Storyline Timeline", icon: Clock, pinned: false, collapsed: false, loading: false, generatedAt: null },
  { id: "pxi_insights", title: "PXI Insights", icon: Sparkles, pinned: false, collapsed: false, loading: false, generatedAt: null },
  { id: "stat_cards", title: "Live Stat Cards", icon: BarChart3, pinned: false, collapsed: false, loading: false, generatedAt: null },
  { id: "graphics_suggestions", title: "Graphics Suggestions", icon: Camera, pinned: false, collapsed: false, loading: false, generatedAt: null },
];

// ── Game-state → tool visibility config ──────────────────
const GAME_STATE_TOOL_CONFIG: Record<GameState, { expanded: BroadcastToolName[]; collapsed: BroadcastToolName[] }> = {
  pre_game: {
    expanded: ["spotting_board", "talk_tracks", "storyline_timeline"],
    collapsed: ["graphics_suggestions", "pxi_insights", "stat_cards"],
  },
  live: {
    expanded: ["pxi_insights", "stat_cards", "graphics_suggestions", "storyline_timeline"],
    collapsed: ["talk_tracks", "spotting_board"],
  },
  intermission: {
    expanded: ["talk_tracks", "graphics_suggestions", "stat_cards", "storyline_timeline"],
    collapsed: ["pxi_insights", "spotting_board"],
  },
  post_game: {
    expanded: ["pxi_insights", "storyline_timeline"],
    collapsed: ["talk_tracks", "spotting_board", "stat_cards"],
  },
};

// ── Team reference (minimal) ─────────────────────────────
interface TeamRef {
  name: string;
  league?: string;
}

// ── Timeline ID generator ────────────────────────────────
let _tlSeq = 0;
function genTimelineId(): string {
  _tlSeq += 1;
  return `tl_${Date.now()}_${_tlSeq}`;
}

export default function BroadcastPage() {
  // Game context
  const [teams, setTeams] = useState<TeamRef[]>([]);
  const [homeTeam, setHomeTeam] = useState("");
  const [awayTeam, setAwayTeam] = useState("");
  const [gameState, setGameState] = useState<GameState>("pre_game");
  const [period, setPeriod] = useState(1);
  const [homeScore, setHomeScore] = useState(0);
  const [awayScore, setAwayScore] = useState(0);
  const [gameDate, setGameDate] = useState(new Date().toISOString().slice(0, 10));

  // Toggles
  const [mode, setMode] = useState<BroadcastMode>("broadcast");
  const [depth, setDepth] = useState<BroadcastDepth>("standard");
  const [audience, setAudience] = useState<BroadcastAudience>("informed");

  // Roster data
  const [homeRoster, setHomeRoster] = useState<Player[]>([]);
  const [awayRoster, setAwayRoster] = useState<Player[]>([]);

  // Tool card state
  const [centerTools, setCenterTools] = useState<ToolCardState[]>(DEFAULT_CENTER_TOOLS);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");

  // Tool content
  const [spottingBoard, setSpottingBoard] = useState<SpottingBoardData | null>(null);
  const [talkTracks, setTalkTracks] = useState<Record<TalkTrackCategory, TalkTrack[]> | null>(null);
  const [insights, setInsights] = useState<PXIInsight[]>([]);
  const [statCards, setStatCards] = useState<StatCard[]>([]);
  const [graphicsSuggestions, setGraphicsSuggestions] = useState<GraphicSuggestion[]>([]);
  const [playerProfiles, setPlayerProfiles] = useState<BroadcastPlayerProfile[]>([]);
  const [interviewQuestions, setInterviewQuestions] = useState<InterviewQuestion[]>([]);
  const [postGameScript, setPostGameScript] = useState<PostGameScriptData | null>(null);

  // Storyline Timeline
  const [timelineEntries, setTimelineEntries] = useState<TimelineEntry[]>([]);

  // Right column
  const [activeRightTab, setActiveRightTab] = useState<RightTab>("profiles");
  const [isPostGameLocked, setIsPostGameLocked] = useState(true);

  // Game-state auto-switching
  const [pulsingTools, setPulsingTools] = useState<Set<BroadcastToolName>>(new Set());
  const prevGameStateRef = useRef<GameState>(gameState);

  // Sorted tools: pinned first
  const sortedTools = useMemo(() => {
    const pinned = centerTools.filter((t) => t.pinned);
    const unpinned = centerTools.filter((t) => !t.pinned);
    return [...pinned, ...unpinned];
  }, [centerTools]);

  // ── Load teams ──────────────────────────────────────────
  useEffect(() => {
    api.get("/teams").then(({ data }) => {
      const list: TeamRef[] = (data || []).map((t: { name: string; league?: string }) => ({
        name: t.name,
        league: t.league,
      }));
      setTeams(list);
    }).catch((err) => {
      console.error("Broadcast: Failed to load teams:", err);
      // Retry once after 1 second (auth may not be ready)
      setTimeout(() => {
        api.get("/teams").then(({ data }) => {
          const list: TeamRef[] = (data || []).map((t: { name: string; league?: string }) => ({
            name: t.name,
            league: t.league,
          }));
          setTeams(list);
        }).catch((err2) => console.error("Broadcast: Retry failed:", err2));
      }, 1000);
    });
  }, []);

  // ── Load rosters when teams change ─────────────────────
  useEffect(() => {
    if (homeTeam) {
      api.get<Player[]>(`/teams/${encodeURIComponent(homeTeam)}/roster`).then(({ data }) => setHomeRoster(data || [])).catch(() => setHomeRoster([]));
    } else {
      setHomeRoster([]);
    }
  }, [homeTeam]);

  useEffect(() => {
    if (awayTeam) {
      api.get<Player[]>(`/teams/${encodeURIComponent(awayTeam)}/roster`).then(({ data }) => setAwayRoster(data || [])).catch(() => setAwayRoster([]));
    } else {
      setAwayRoster([]);
    }
  }, [awayTeam]);

  // ── Auto-unlock post-game when state changes ──────────
  useEffect(() => {
    if (gameState === "post_game") {
      setIsPostGameLocked(false);
    }
  }, [gameState]);

  // ── Game-state auto-switching: expand/collapse tools ──
  useEffect(() => {
    // Skip initial mount
    if (prevGameStateRef.current === gameState) return;
    prevGameStateRef.current = gameState;

    const config = GAME_STATE_TOOL_CONFIG[gameState];
    if (!config) return;

    // Apply collapse/expand
    setCenterTools((prev) =>
      prev.map((t) => {
        if (config.expanded.includes(t.id)) return { ...t, collapsed: false };
        if (config.collapsed.includes(t.id)) return { ...t, collapsed: true };
        return t;
      })
    );

    // Pulse newly-expanded tools so user notices
    setPulsingTools(new Set(config.expanded));
    const timeout = setTimeout(() => setPulsingTools(new Set()), 2000);
    return () => clearTimeout(timeout);
  }, [gameState]);

  // ── Update tool loading state helper ───────────────────
  const setToolLoading = useCallback((toolId: BroadcastToolName, loading: boolean) => {
    setCenterTools((prev) =>
      prev.map((t) => (t.id === toolId ? { ...t, loading } : t))
    );
  }, []);

  const setToolGenerated = useCallback((toolId: BroadcastToolName) => {
    setCenterTools((prev) =>
      prev.map((t) => (t.id === toolId ? { ...t, loading: false, generatedAt: new Date().toISOString() } : t))
    );
  }, []);

  // ── Extract talk track headlines as timeline entries ────
  const extractTimelineFromTalkTracks = useCallback((tracks: Record<TalkTrackCategory, TalkTrack[]>) => {
    const entries: TimelineEntry[] = [];
    const periodLabel = gameState === "pre_game" ? "Pre-Game" : gameState === "post_game" ? "Post-Game" : period === 1 ? "1st" : period === 2 ? "2nd" : period === 3 ? "3rd" : "OT";
    const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    for (const [category, trackList] of Object.entries(tracks)) {
      for (const track of trackList) {
        if (!track.headline) continue;
        const type: TimelineEntry["type"] =
          category === "streak_milestone" ? "milestone" :
          category === "matchup_storyline" ? "shift" :
          "storyline";
        entries.push({
          id: genTimelineId(),
          type,
          text: track.headline,
          period: periodLabel,
          timestamp: now,
          source: "auto",
        });
      }
    }
    return entries;
  }, [gameState, period]);

  // ── Add a manual timeline entry ────────────────────────
  const handleAddTimelineEntry = useCallback((entry: TimelineEntry) => {
    setTimelineEntries((prev) => [...prev, entry]);
  }, []);

  // ── Generate All ───────────────────────────────────────
  const handleGenerateAll = useCallback(async () => {
    if (!homeTeam || !awayTeam) return;
    setIsGenerating(true);
    setError("");
    // Don't set storyline_timeline to loading — it's local-only
    setCenterTools((prev) => prev.map((t) => (t.id === "storyline_timeline" ? t : { ...t, loading: true })));

    try {
      const { data } = await api.post(
        "/broadcast/generate-all",
        {
          home_team: homeTeam,
          away_team: awayTeam,
          game_date: gameDate,
          mode,
          depth,
          audience,
          game_state: gameState,
        },
        { timeout: 180000 }
      );

      if (data.spotting_board) setSpottingBoard(data.spotting_board);
      if (data.talk_tracks) {
        setTalkTracks(data.talk_tracks);
        // Auto-extract headlines into timeline
        const newEntries = extractTimelineFromTalkTracks(data.talk_tracks);
        if (newEntries.length > 0) {
          setTimelineEntries((prev) => [...prev, ...newEntries]);
        }
      }
      if (data.insights) setInsights(data.insights);
      if (data.stat_cards) setStatCards(data.stat_cards);
      if (data.graphics_suggestions) setGraphicsSuggestions(data.graphics_suggestions);
      if (data.player_profiles) setPlayerProfiles(data.player_profiles);
      if (data.interview_questions) setInterviewQuestions(data.interview_questions);

      setCenterTools((prev) =>
        prev.map((t) => (t.id === "storyline_timeline" ? t : { ...t, loading: false, generatedAt: new Date().toISOString() }))
      );
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed to generate broadcast content";
      setError(msg);
      setCenterTools((prev) => prev.map((t) => ({ ...t, loading: false })));
    } finally {
      setIsGenerating(false);
    }
  }, [homeTeam, awayTeam, gameDate, mode, depth, audience, gameState, extractTimelineFromTalkTracks]);

  // ── Generate single tool ───────────────────────────────
  const handleGenerateTool = useCallback(
    async (toolName: string) => {
      if (!homeTeam || !awayTeam) return;
      // storyline_timeline is local-only, not a backend tool
      if (toolName === "storyline_timeline") return;
      const toolId = toolName as BroadcastToolName;
      setToolLoading(toolId, true);
      setError("");

      try {
        const { data } = await api.post(
          "/broadcast/generate-tool",
          {
            home_team: homeTeam,
            away_team: awayTeam,
            game_date: gameDate,
            tool_name: toolName,
            mode,
            depth,
            audience,
            game_state: gameState,
          },
          { timeout: 180000 }
        );

        const content = data.content;
        switch (toolName) {
          case "spotting_board":
            if (content) setSpottingBoard(content);
            break;
          case "talk_tracks":
            if (content) {
              setTalkTracks(content);
              const newEntries = extractTimelineFromTalkTracks(content);
              if (newEntries.length > 0) {
                setTimelineEntries((prev) => [...prev, ...newEntries]);
              }
            }
            break;
          case "pxi_insights":
            if (content) setInsights(Array.isArray(content) ? content : []);
            break;
          case "stat_cards":
            if (content) setStatCards(Array.isArray(content) ? content : []);
            break;
          case "graphics_suggestions":
            if (content) setGraphicsSuggestions(Array.isArray(content) ? content : []);
            break;
          case "player_profiles":
            if (content) setPlayerProfiles(Array.isArray(content) ? content : []);
            break;
          case "interview_questions":
            if (content) setInterviewQuestions(Array.isArray(content) ? content : []);
            break;
        }

        setToolGenerated(toolId);
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed to regenerate tool";
        setError(msg);
        setToolLoading(toolId, false);
      }
    },
    [homeTeam, awayTeam, gameDate, mode, depth, audience, gameState, setToolLoading, setToolGenerated, extractTimelineFromTalkTracks]
  );

  // ── Pin/Collapse handlers ──────────────────────────────
  const handlePin = useCallback((toolId: BroadcastToolName) => {
    setCenterTools((prev) =>
      prev.map((t) => (t.id === toolId ? { ...t, pinned: !t.pinned } : t))
    );
  }, []);

  const handleCollapse = useCallback((toolId: BroadcastToolName) => {
    setCenterTools((prev) =>
      prev.map((t) => (t.id === toolId ? { ...t, collapsed: !t.collapsed } : t))
    );
  }, []);

  // ── Tool content renderer ──────────────────────────────
  const renderToolContent = (toolId: BroadcastToolName) => {
    switch (toolId) {
      case "spotting_board":
        return <SpottingBoard data={spottingBoard} />;
      case "talk_tracks":
        return <TalkTracks data={talkTracks} />;
      case "storyline_timeline":
        return (
          <StorylineTimeline
            entries={timelineEntries}
            onAddEntry={handleAddTimelineEntry}
            gameState={gameState}
            period={period}
          />
        );
      case "pxi_insights":
        return <PXIInsights data={insights} />;
      case "stat_cards":
        return <LiveStatCards data={statCards} />;
      case "graphics_suggestions":
        return <GraphicsSuggestions data={graphicsSuggestions} />;
      default:
        return null;
    }
  };

  // ── Right column content ───────────────────────────────
  const renderRightContent = () => {
    switch (activeRightTab) {
      case "profiles":
        return <PlayerProfiles data={playerProfiles} />;
      case "interview":
        return <InterviewQuestions data={interviewQuestions} />;
      case "matchup":
        return <PXIInsights data={insights.filter((i) => i.category === "MATCHUP")} />;
      case "producer":
        return <GraphicsSuggestions data={graphicsSuggestions} />;
      case "postgame":
        return (
          <PostGameScript
            data={postGameScript}
            gameState={gameState}
            isLocked={isPostGameLocked}
            onUnlock={() => setIsPostGameLocked(false)}
            homeTeam={homeTeam}
            awayTeam={awayTeam}
            homeScore={homeScore}
            awayScore={awayScore}
            mode={mode}
            audience={audience}
            onGenerated={(d) => setPostGameScript(d)}
          />
        );
      default:
        return null;
    }
  };

  return (
    <ProtectedRoute>
      <NavBar />

      {/* Game Control Bar */}
      <GameControlBar
        homeTeam={homeTeam}
        awayTeam={awayTeam}
        gameState={gameState}
        setGameState={setGameState}
        period={period}
        setPeriod={setPeriod}
        homeScore={homeScore}
        setHomeScore={setHomeScore}
        awayScore={awayScore}
        setAwayScore={setAwayScore}
        onRefreshInsights={() => handleGenerateTool("pxi_insights")}
        onUpdateCards={() => handleGenerateTool("stat_cards")}
        onNewStorylines={() => handleGenerateTool("talk_tracks")}
        isGenerating={isGenerating}
      />

      {/* Team selectors (above grid, below control bar) */}
      <div className="max-w-[1600px] mx-auto px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Radio size={16} className="text-orange" />
            <span className="text-sm font-oswald font-bold text-navy uppercase tracking-wider">Broadcast Hub</span>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-oswald uppercase tracking-wider text-muted">Home</label>
            <select
              value={homeTeam}
              onChange={(e) => setHomeTeam(e.target.value)}
              className="px-2 py-1.5 border border-teal/20 rounded-lg text-xs bg-white min-w-[160px]"
            >
              <option value="">Select home team...</option>
              {teams.map((t) => (
                <option key={`h-${t.name}`} value={t.name}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <span className="text-muted/30 text-sm">vs</span>
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-oswald uppercase tracking-wider text-muted">Away</label>
            <select
              value={awayTeam}
              onChange={(e) => setAwayTeam(e.target.value)}
              className="px-2 py-1.5 border border-teal/20 rounded-lg text-xs bg-white min-w-[160px]"
            >
              <option value="">Select away team...</option>
              {teams.map((t) => (
                <option key={`a-${t.name}`} value={t.name}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <input
            type="date"
            value={gameDate}
            onChange={(e) => setGameDate(e.target.value)}
            className="px-2 py-1.5 border border-teal/20 rounded-lg text-xs bg-white"
          />
        </div>

        {error && (
          <div className="mt-2 bg-red-50 border border-red-200 rounded-xl px-4 py-2 text-red-700 text-xs">
            {error}
          </div>
        )}
      </div>

      {/* 3-Column Layout */}
      <div className="max-w-[1600px] mx-auto px-4 pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] xl:grid-cols-[280px_1fr_370px] gap-4">
          {/* LEFT COLUMN — Game Context Rail */}
          <div className="hidden lg:block">
            <GameContextRail
              homeTeam={homeTeam}
              awayTeam={awayTeam}
              homeRoster={homeRoster}
              awayRoster={awayRoster}
              mode={mode}
              setMode={setMode}
              depth={depth}
              setDepth={setDepth}
              audience={audience}
              setAudience={setAudience}
              gameDate={gameDate}
              onGenerateAll={handleGenerateAll}
              onGenerateTool={handleGenerateTool}
              isGenerating={isGenerating}
            />
          </div>

          {/* CENTER COLUMN — Tool Cards */}
          <div className="space-y-3 min-w-0">
            {/* Mobile-only generate button */}
            <div className="lg:hidden">
              <button
                onClick={handleGenerateAll}
                disabled={isGenerating || !homeTeam || !awayTeam}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-orange text-white text-sm font-oswald font-bold uppercase tracking-wider hover:bg-orange/90 transition-colors disabled:opacity-40"
              >
                Generate All Tools
              </button>
            </div>

            {sortedTools.map((tool) => (
              <div
                key={tool.id}
                className={`transition-all duration-500 ${pulsingTools.has(tool.id) ? "ring-2 ring-teal/40 ring-offset-1 rounded-xl" : ""}`}
              >
                <BroadcastToolCard
                  title={tool.title}
                  mode={mode}
                  timestamp={tool.generatedAt}
                  isPinned={tool.pinned}
                  isCollapsed={tool.collapsed}
                  isLoading={tool.loading}
                  onPin={() => handlePin(tool.id)}
                  onCollapse={() => handleCollapse(tool.id)}
                  onRegenerate={() => handleGenerateTool(tool.id)}
                >
                  {renderToolContent(tool.id)}
                </BroadcastToolCard>
              </div>
            ))}
          </div>

          {/* RIGHT COLUMN — Reference Drawer */}
          <div className="hidden xl:block">
            <ReferenceDrawer
              activeTab={activeRightTab}
              setActiveTab={setActiveRightTab}
              gameState={gameState}
              isPostGameLocked={isPostGameLocked}
            >
              {renderRightContent()}
            </ReferenceDrawer>
          </div>
        </div>

        {/* Mobile/Tablet right column (below main content) */}
        <div className="xl:hidden mt-4">
          <div className="bg-white rounded-xl border border-teal/20 p-4">
            <div className="flex flex-wrap gap-1 mb-3">
              {(["profiles", "interview", "matchup", "producer", "postgame"] as RightTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveRightTab(tab)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-oswald font-bold uppercase tracking-wider transition-colors ${
                    activeRightTab === tab ? "bg-teal text-white" : "bg-navy/[0.04] text-muted/50"
                  }`}
                >
                  {tab === "postgame" ? "Post-Game" : tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
            {renderRightContent()}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
