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
  X,
  ListOrdered,
  ChevronDown,
  GripVertical,
  CheckCircle2,
  SkipForward,
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
  BroadcastScheduleGame,
  BroadcastSummaryPlayer,
  BroadcastSummaryTeam,
  RunOfShowItem,
  BroadcastEventType,
} from "@/types/api";
import { BROADCAST_EVENT_CONFIG } from "@/types/api";

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
  { id: "stat_cards", title: "Stat Cards", icon: BarChart3, pinned: false, collapsed: false, loading: false, generatedAt: null },
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

  // Data freshness
  const [statsAsOf, setStatsAsOf] = useState<string | null>(null);

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

  // Schedule picker
  const [scheduleGames, setScheduleGames] = useState<BroadcastScheduleGame[]>([]);

  // Player/Team card drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerType, setDrawerType] = useState<"player" | "team">("player");
  const [drawerPlayerData, setDrawerPlayerData] = useState<BroadcastSummaryPlayer | null>(null);
  const [drawerTeamData, setDrawerTeamData] = useState<BroadcastSummaryTeam | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);

  // Run of Show
  const [runOfShow, setRunOfShow] = useState<RunOfShowItem[]>([]);
  const [rosSessionId] = useState(() => `ros_${Date.now()}`);
  const [showRunOfShow, setShowRunOfShow] = useState(false);

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

  // ── Load schedule games on mount ────────────────────────
  useEffect(() => {
    const league = teams.length > 0 && teams[0].league ? teams[0].league : "";
    if (!league) return;
    api.get(`/broadcast/games/today?league=${encodeURIComponent(league)}`).then(({ data }) => {
      setScheduleGames(data?.games || []);
    }).catch(() => {});
  }, [teams]);

  // ── Schedule picker handler ────────────────────────────
  const handlePickGame = useCallback((game: BroadcastScheduleGame) => {
    setHomeTeam(game.home_team);
    setAwayTeam(game.away_team);
    if (game.game_date) setGameDate(game.game_date);
  }, []);

  // ── Player drawer handler ──────────────────────────────
  const handlePlayerClick = useCallback(async (playerName: string) => {
    setDrawerOpen(true);
    setDrawerType("player");
    setDrawerPlayerData(null);
    setDrawerLoading(true);
    try {
      // Find player ID from rosters
      const allPlayers = [...homeRoster, ...awayRoster];
      const match = allPlayers.find(
        (p) => `${p.first_name} ${p.last_name}` === playerName || p.last_name === playerName
      );
      if (match) {
        const { data } = await api.get(`/players/${match.id}/broadcast-summary`);
        setDrawerPlayerData(data);
      }
    } catch {
      // silently fail
    } finally {
      setDrawerLoading(false);
    }
  }, [homeRoster, awayRoster]);

  // ── Team drawer handler ────────────────────────────────
  const handleTeamClick = useCallback(async (teamName: string) => {
    setDrawerOpen(true);
    setDrawerType("team");
    setDrawerTeamData(null);
    setDrawerLoading(true);
    try {
      const { data } = await api.get(`/teams/${encodeURIComponent(teamName)}/broadcast-summary`);
      setDrawerTeamData(data);
    } catch {
      // silently fail
    } finally {
      setDrawerLoading(false);
    }
  }, []);

  // ── Next Break toggle handler ──────────────────────────
  const handleToggleNextBreak = useCallback((entryId: string) => {
    setTimelineEntries((prev) =>
      prev.map((e) =>
        e.id === entryId ? { ...e, in_next_break: !e.in_next_break } : e
      )
    );
  }, []);

  // ── Run of Show: push item ─────────────────────────────
  const handlePushToRunOfShow = useCallback(async (content: string, itemType: string, sourceId?: string) => {
    try {
      const { data } = await api.post("/broadcast/run-of-show", {
        session_id: rosSessionId,
        item_type: itemType,
        content,
        source_id: sourceId,
      });
      setRunOfShow((prev) => [...prev, data]);
    } catch {
      // fallback: add locally
      setRunOfShow((prev) => [...prev, { id: `local_${Date.now()}`, session_id: rosSessionId, item_type: itemType, content, sequence_order: prev.length + 1, status: "pending" as const, created_at: new Date().toISOString() }]);
    }
  }, [rosSessionId]);

  // ── Run of Show: update status ─────────────────────────
  const handleRosStatusUpdate = useCallback(async (id: string, status: "pending" | "done" | "skipped") => {
    setRunOfShow((prev) => prev.map((r) => r.id === id ? { ...r, status } : r));
    try {
      await api.put(`/broadcast/run-of-show/${id}`, { status });
    } catch {
      // keep local update
    }
  }, []);

  // ── Keyboard shortcuts for event bar ───────────────────
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't fire in input/textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const keyMap: Record<string, BroadcastEventType> = {
        g: "goal_for",
        a: "goal_against",
        s: "save",
        h: "hit",
        p: "penalty",
        t: "timeout",
        n: "note",
      };
      const eventType = keyMap[e.key.toLowerCase()];
      if (!eventType) return;

      const cfg = BROADCAST_EVENT_CONFIG[eventType];
      if (!cfg) return;

      const periodLabel = gameState === "pre_game" ? "Pre-Game" : gameState === "post_game" ? "Post-Game" : gameState === "intermission" ? `INT ${period}` : period === 1 ? "1st" : period === 2 ? "2nd" : period === 3 ? "3rd" : "OT";

      const entry: TimelineEntry = {
        id: genTimelineId(),
        type: cfg.timelineType,
        text: cfg.label,
        period: periodLabel,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        source: "event_bar",
        color_badge: eventType,
      };
      setTimelineEntries((prev) => [...prev, entry]);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [gameState, period]);

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

      if (data.stats_as_of) setStatsAsOf(data.stats_as_of);
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
        return <SpottingBoard data={spottingBoard} onPlayerClick={handlePlayerClick} />;
      case "talk_tracks":
        return <TalkTracks data={talkTracks} audience={audience} />;
      case "storyline_timeline":
        return (
          <StorylineTimeline
            entries={timelineEntries}
            onAddEntry={handleAddTimelineEntry}
            onToggleNextBreak={handleToggleNextBreak}
            gameState={gameState}
            period={period}
          />
        );
      case "pxi_insights":
        return <PXIInsights data={insights} audience={audience} />;
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
      case "runofshow":
        return (
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-oswald uppercase tracking-wider text-muted/60">Run of Show</span>
              <span className="text-[9px] text-muted/40">{runOfShow.length} items</span>
            </div>
            {runOfShow.length === 0 ? (
              <p className="text-xs text-muted/50 text-center py-4">No items. Push talk tracks, insights, or storylines here.</p>
            ) : (
              runOfShow.map((item, i) => (
                <div key={item.id} className={`flex items-start gap-2 p-2 rounded-lg border ${item.status === "done" ? "bg-green-50 border-green-200 opacity-60" : item.status === "skipped" ? "bg-gray-50 border-gray-200 opacity-40" : "bg-white border-teal/10"}`}>
                  <GripVertical size={12} className="text-muted/30 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-[9px] font-oswald uppercase tracking-wider text-muted/50">{item.item_type}</span>
                    <p className="text-xs text-navy leading-relaxed">{item.content}</p>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    {item.status === "pending" && (
                      <>
                        <button onClick={() => handleRosStatusUpdate(item.id, "done")} className="p-1 text-green-500 hover:bg-green-50 rounded" title="Mark Done"><CheckCircle2 size={12} /></button>
                        <button onClick={() => handleRosStatusUpdate(item.id, "skipped")} className="p-1 text-muted/40 hover:bg-gray-50 rounded" title="Skip"><SkipForward size={12} /></button>
                      </>
                    )}
                    <span className="text-[8px] text-muted/40 ml-1">#{i + 1}</span>
                  </div>
                </div>
              ))
            )}
          </div>
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

        {/* Data freshness indicator */}
        {statsAsOf && (
          <div className="mt-2 flex items-center gap-2 text-[10px] text-muted">
            {(() => {
              const ts = new Date(statsAsOf);
              const now = new Date();
              const diffMs = now.getTime() - ts.getTime();
              const diffDays = diffMs / (1000 * 60 * 60 * 24);
              const dot = diffDays <= 2 ? "bg-green-500" : diffDays <= 7 ? "bg-teal" : "bg-amber-500";
              const label = ts.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
              return (
                <>
                  <span className={`inline-block w-1.5 h-1.5 rounded-full ${dot}`} />
                  <span>Stats as of {label}</span>
                  {diffDays > 7 && <span className="text-amber-600 font-medium">&middot; Sync may be needed</span>}
                </>
              );
            })()}
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
              scheduleGames={scheduleGames}
              onPickGame={handlePickGame}
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
              {(["profiles", "interview", "matchup", "producer", "postgame", "runofshow"] as RightTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveRightTab(tab)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-oswald font-bold uppercase tracking-wider transition-colors ${
                    activeRightTab === tab ? "bg-teal text-white" : "bg-navy/[0.04] text-muted/50"
                  }`}
                >
                  {tab === "postgame" ? "Post-Game" : tab === "runofshow" ? "Run of Show" : tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
            {renderRightContent()}
          </div>
        </div>
      </div>
      {/* Next Break Panel — shows queued items */}
      {timelineEntries.some((e) => e.in_next_break && e.break_status !== "used") && (
        <div className="fixed bottom-16 right-4 z-40 w-80 bg-white rounded-xl border border-orange/30 shadow-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-oswald uppercase tracking-wider text-orange font-bold">Next Break Queue</span>
            <span className="text-[9px] text-muted/40">{timelineEntries.filter((e) => e.in_next_break && e.break_status !== "used").length} items</span>
          </div>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {timelineEntries.filter((e) => e.in_next_break && e.break_status !== "used").map((entry) => (
              <div key={entry.id} className="flex items-center gap-2 px-2 py-1.5 bg-orange/5 rounded-lg text-xs">
                <span className="flex-1 truncate text-navy">{entry.text}</span>
                <button onClick={() => setTimelineEntries((prev) => prev.map((e) => e.id === entry.id ? { ...e, break_status: "used" } : e))} className="text-[9px] text-green-600 hover:underline shrink-0">Used</button>
                <button onClick={() => handleToggleNextBreak(entry.id)} className="text-[9px] text-muted/40 hover:underline shrink-0">Remove</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Run of Show collapsible strip */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-[#1A2332] text-white border-t border-white/10">
        <button
          onClick={() => setShowRunOfShow(!showRunOfShow)}
          className="w-full flex items-center justify-between px-4 py-1.5"
        >
          <div className="flex items-center gap-2">
            <ListOrdered size={12} />
            <span className="text-[10px] font-oswald uppercase tracking-wider">Run of Show</span>
            <span className="text-[9px] text-white/40">({runOfShow.filter((r) => r.status === "pending").length} pending)</span>
          </div>
          <ChevronDown size={12} className={`transition-transform ${showRunOfShow ? "rotate-180" : ""}`} />
        </button>
        {showRunOfShow && (
          <div className="px-4 pb-3 max-h-40 overflow-y-auto">
            {runOfShow.length === 0 ? (
              <p className="text-xs text-white/30 py-2">No items yet. Push content from insights or talk tracks.</p>
            ) : (
              <div className="space-y-1">
                {runOfShow.map((item, i) => (
                  <div key={item.id} className={`flex items-center gap-2 px-2 py-1 rounded text-xs ${item.status === "done" ? "text-white/30 line-through" : item.status === "skipped" ? "text-white/20" : "text-white/80"}`}>
                    <span className="text-white/30 font-mono text-[9px]">{i + 1}</span>
                    <span className="flex-1 truncate">{item.content}</span>
                    <span className="text-[8px] text-white/20 uppercase">{item.item_type}</span>
                    {item.status === "pending" && (
                      <>
                        <button onClick={() => handleRosStatusUpdate(item.id, "done")} className="text-[9px] text-green-400 hover:underline">Done</button>
                        <button onClick={() => handleRosStatusUpdate(item.id, "skipped")} className="text-[9px] text-white/30 hover:underline">Skip</button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Player/Team Card Drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={() => setDrawerOpen(false)} />
          <div className="relative w-full max-w-md bg-white shadow-2xl overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between z-10">
              <span className="text-sm font-oswald font-bold text-navy uppercase tracking-wider">
                {drawerType === "player" ? "Player Card" : "Team Card"}
              </span>
              <button onClick={() => setDrawerOpen(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X size={16} className="text-muted" />
              </button>
            </div>
            <div className="p-4">
              {drawerLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-6 h-6 border-2 border-teal/30 border-t-teal rounded-full animate-spin" />
                </div>
              ) : drawerType === "player" && drawerPlayerData ? (
                <div className="space-y-4">
                  <div className="text-center">
                    <h3 className="text-lg font-oswald font-bold text-navy">{drawerPlayerData.name}</h3>
                    <div className="flex items-center justify-center gap-2 mt-1 text-xs text-muted">
                      {drawerPlayerData.jersey_number && <span>#{drawerPlayerData.jersey_number}</span>}
                      {drawerPlayerData.position && <span>{drawerPlayerData.position}</span>}
                      {drawerPlayerData.handedness && <span>{drawerPlayerData.handedness}</span>}
                    </div>
                    {drawerPlayerData.current_team && <p className="text-xs text-teal mt-1">{drawerPlayerData.current_team}</p>}
                  </div>
                  {drawerPlayerData.quick_stats && (
                    <div className="grid grid-cols-5 gap-2 bg-navy/[0.03] rounded-lg p-3">
                      {(["gp", "goals", "assists", "points", "plus_minus"] as const).map((key) => (
                        <div key={key} className="text-center">
                          <div className="text-lg font-oswald font-bold text-navy">{drawerPlayerData.quick_stats[key]}</div>
                          <div className="text-[9px] font-oswald uppercase tracking-wider text-muted/50">{key === "plus_minus" ? "+/-" : key.charAt(0).toUpperCase()}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  {drawerPlayerData.skill_profile_line && (
                    <p className="text-sm text-navy/80 italic">{drawerPlayerData.skill_profile_line}</p>
                  )}
                  {drawerPlayerData.role_tags && drawerPlayerData.role_tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {drawerPlayerData.role_tags.map((tag) => (
                        <span key={tag} className="text-[9px] px-2 py-0.5 rounded-full bg-teal/10 text-teal font-bold">{tag}</span>
                      ))}
                    </div>
                  )}
                  {drawerPlayerData.story_bites && drawerPlayerData.story_bites.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-[10px] font-oswald uppercase tracking-wider text-muted/50">Story Bites</span>
                      {drawerPlayerData.story_bites.map((bite, i) => (
                        <div key={i} className="bg-orange/5 rounded-lg p-2">
                          <span className="text-[8px] font-oswald uppercase tracking-wider text-orange/60">{bite.type}</span>
                          <p className="text-xs text-navy/80 leading-relaxed">{bite.text}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : drawerType === "team" && drawerTeamData ? (
                <div className="space-y-4">
                  <h3 className="text-lg font-oswald font-bold text-navy text-center">{drawerTeamData.name}</h3>
                  {drawerTeamData.record && (
                    <div className="text-center text-sm text-navy/80">{drawerTeamData.record.w}-{drawerTeamData.record.l}-{drawerTeamData.record.ot} ({drawerTeamData.record.pts} pts)</div>
                  )}
                  {drawerTeamData.last_10 && <p className="text-xs text-muted text-center">Last 10: {drawerTeamData.last_10}</p>}
                  <div className="grid grid-cols-2 gap-3">
                    {drawerTeamData.pp_pct != null && (
                      <div className="bg-navy/[0.03] rounded-lg p-2 text-center">
                        <div className="text-lg font-oswald font-bold text-navy">{drawerTeamData.pp_pct}%</div>
                        <div className="text-[9px] font-oswald uppercase text-muted/50">PP%</div>
                      </div>
                    )}
                    {drawerTeamData.pk_pct != null && (
                      <div className="bg-navy/[0.03] rounded-lg p-2 text-center">
                        <div className="text-lg font-oswald font-bold text-navy">{drawerTeamData.pk_pct}%</div>
                        <div className="text-[9px] font-oswald uppercase text-muted/50">PK%</div>
                      </div>
                    )}
                  </div>
                  {drawerTeamData.key_streaks && drawerTeamData.key_streaks.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[10px] font-oswald uppercase tracking-wider text-muted/50">Key Streaks</span>
                      {drawerTeamData.key_streaks.map((s, i) => (
                        <p key={i} className="text-xs text-navy/80">{s}</p>
                      ))}
                    </div>
                  )}
                  {drawerTeamData.top_performers && drawerTeamData.top_performers.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[10px] font-oswald uppercase tracking-wider text-muted/50">Top Performers</span>
                      {drawerTeamData.top_performers.map((p, i) => (
                        <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-gray-50">
                          <span className="text-navy font-medium">#{p.jersey} {p.name}</span>
                          <span className="text-muted font-mono">{p.pts} pts</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted/50 text-center py-8">No data available.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </ProtectedRoute>
  );
}
