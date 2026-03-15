"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  Send,
  Plus,
  Trash2,
  Play,
  Clock,
  Sparkles,
  X,
  FileText,
  Scissors,
  Save,
  ChevronDown,
  ChevronRight,
  Users,
  RefreshCw,
  Upload,
  Filter,
  Maximize2,
  Minimize2,
  Rewind,
  FastForward,
  SkipBack,
  SkipForward,
  Gauge,
  Film,
  Search,
  PenLine,
  Type,
  Circle,
  Minus,
  ArrowUpRight,
  Eraser,
} from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import VideoPlayer, { VideoPlayerHandle } from "@/components/film/VideoPlayer";
import ClipPanel from "@/components/film/ClipPanel";
import EventTagger from "@/components/film/EventTagger";
import ReelBuilder from "@/components/film/ReelBuilder";
import api from "@/lib/api";
import { getUser } from "@/lib/auth";
import toast from "react-hot-toast";
import MicButton from "@/components/MicButton";
import ListenButton from "@/components/ListenButton";
import TelestrationCanvas, { TelestrationCanvasHandle } from "@/components/TelestrationCanvas";

interface SessionData {
  id: string;
  title: string;
  session_type: string;
  description: string | null;
  status: string;
  created_at: string;
  team_id?: string | null;
  player_id?: string | null;
  opponent_team_id?: string | null;
  pxi_output?: string | null;
  pxi_status?: string | null;
  event_data_source?: string | null;
  source_type?: string | null;
  source_url?: string | null;
  match_title?: string | null;
  match_date?: string | null;
}

interface RosterPlayer {
  id: string;
  first_name: string;
  last_name: string;
  position?: string;
}

interface TeamOption {
  id: string;
  name: string;
}

interface UploadData {
  id: string;
  playback_id: string | null;
  mux_playback_id?: string | null;
  status: string;
  title: string;
  upload_source?: string;
  source_url?: string;
}

interface Comment {
  id: string;
  author_id: string;
  author_email?: string;
  body: string;
  timestamp_seconds: number | null;
  created_at: string;
}

interface SessionEvent {
  id: string;
  event_type: string;
  event_label?: string;
  time_seconds: number;
  player_id?: string | null;
  notes?: string;
  source?: string;
  confidence?: number | null;
}

type EventCategory = "all" | "offensive" | "defensive" | "special_teams" | "other";

const EVENT_CATEGORY_MAP: Record<string, EventCategory> = {
  shot: "offensive", goal: "offensive", zone_entry: "offensive", cycle: "offensive",
  chance: "offensive", scoring_chance: "offensive", offensive: "offensive",
  block: "defensive", clear: "defensive", breakout: "defensive", turnover: "defensive",
  dz_coverage: "defensive", defensive: "defensive", gap_control: "defensive",
  pp_setup: "special_teams", pk_clear: "special_teams", faceoff: "special_teams",
  power_play: "special_teams", penalty_kill: "special_teams", pp: "special_teams", pk: "special_teams",
};

const EVENT_CATEGORY_LABELS: { value: EventCategory; label: string }[] = [
  { value: "all", label: "All" },
  { value: "offensive", label: "Offensive" },
  { value: "defensive", label: "Defensive" },
  { value: "special_teams", label: "Special Teams" },
  { value: "other", label: "Other" },
];

const EVENT_CATEGORY_COLORS: Record<EventCategory, string> = {
  all: "bg-navy/10 text-navy",
  offensive: "bg-teal/10 text-teal",
  defensive: "bg-navy/10 text-navy",
  special_teams: "bg-orange/10 text-orange",
  other: "bg-gray-100 text-gray-500",
};

function getEventCategory(eventType: string): EventCategory {
  // Check all parts of the event type (e.g., "zone_entry" matches "zone_entry")
  const normalized = eventType.toLowerCase().replace(/\s+/g, "_");
  if (EVENT_CATEGORY_MAP[normalized]) return EVENT_CATEGORY_MAP[normalized];
  // Try matching partial — check if any key is contained in the event type
  for (const [key, cat] of Object.entries(EVENT_CATEGORY_MAP)) {
    if (normalized.includes(key)) return cat;
  }
  return "other";
}

// ── Code Window Pro Editor button definitions ──────────────
interface CodeButtonDef {
  type: string;
  label: string;
  tooltip: string;
  category: "offensive" | "defensive" | "special_teams" | "other";
}

const CODE_BUTTONS: CodeButtonDef[] = [
  { type: "goal", label: "Goal", tooltip: "Tag a goal scored", category: "offensive" },
  { type: "shot", label: "Shot", tooltip: "Tag a shot on net", category: "offensive" },
  { type: "chance", label: "Chance", tooltip: "Tag a scoring chance", category: "offensive" },
  { type: "entry", label: "Entry", tooltip: "Tag a zone entry", category: "offensive" },
  { type: "cycle", label: "Cycle", tooltip: "Tag an offensive cycle", category: "offensive" },
  { type: "zone_time", label: "Zone Time", tooltip: "Tag offensive zone time", category: "offensive" },
  { type: "screen", label: "Screen", tooltip: "Tag a net-front screen", category: "offensive" },
  { type: "net_battle", label: "Net Battle", tooltip: "Tag a net-front battle", category: "offensive" },
  { type: "hit", label: "Hit", tooltip: "Tag a body check", category: "defensive" },
  { type: "block", label: "Block", tooltip: "Tag a shot block", category: "defensive" },
  { type: "turnover", label: "Turnover", tooltip: "Tag a puck turnover", category: "defensive" },
  { type: "exit", label: "Exit", tooltip: "Tag a defensive zone exit", category: "defensive" },
  { type: "breakout", label: "Breakout", tooltip: "Tag a breakout play", category: "defensive" },
  { type: "dz_coverage", label: "DZ Cover", tooltip: "Tag DZ coverage", category: "defensive" },
  { type: "coverage_miss", label: "Cov. Miss", tooltip: "Tag a coverage breakdown", category: "defensive" },
  { type: "stick_detail", label: "Stick", tooltip: "Tag a stick check", category: "defensive" },
  { type: "faceoff", label: "Faceoff", tooltip: "Tag a faceoff", category: "special_teams" },
  { type: "pp_rep", label: "PP Rep", tooltip: "Tag a power play rep", category: "special_teams" },
  { type: "pk_rep", label: "PK Rep", tooltip: "Tag a penalty kill rep", category: "special_teams" },
  { type: "icing", label: "Icing", tooltip: "Tag an icing call", category: "special_teams" },
  { type: "penalty", label: "Penalty", tooltip: "Tag a penalty", category: "special_teams" },
  { type: "custom", label: "Custom", tooltip: "Tag a custom event", category: "other" },
];

const CODE_CAT_COLOR: Record<string, string> = {
  offensive: "#00B5B8",
  defensive: "#E67E22",
  special_teams: "#6366F1",
  other: "#6B7280",
};

const SESSION_TYPE_LABELS: Record<string, string> = {
  general: "General",
  game_review: "Game Review",
  opponent_prep: "Opponent Prep",
  practice: "Practice",
  recruitment: "Recruitment",
};

function formatTimestamp(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return "";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function getEmbedUrl(sourceUrl: string, uploadSource: string): string | null {
  if (uploadSource === "youtube") {
    // Handles: youtube.com/watch?v=X, youtu.be/X, youtube.com/embed/X,
    //          youtube.com/v/X, youtube.com/shorts/X, youtube.com/live/X
    const match = sourceUrl.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/|live\/)|youtu\.be\/)([\w-]+)/);
    if (match) return `https://www.youtube.com/embed/${match[1]}?autoplay=1&rel=0`;
  }
  if (uploadSource === "vimeo") {
    // vimeo.com/X → player.vimeo.com/video/X
    const match = sourceUrl.match(/vimeo\.com\/(\d+)/);
    if (match) return `https://player.vimeo.com/video/${match[1]}?autoplay=1`;
  }
  return null;
}

interface FilmReportType {
  value: string;
  label: string;
  desc: string;
  needsPlayer: boolean;
  needsOpponent: boolean;
}

interface FilmReportGroup {
  group: string;
  types: FilmReportType[];
}

const FILM_REPORT_GROUPS: FilmReportGroup[] = [
  {
    group: "Game Analysis",
    types: [
      { value: "film_post_game_review", label: "Post-Game Review", desc: "Breakdown of game footage — personnel, tactics, adjustments", needsPlayer: false, needsOpponent: false },
      { value: "film_period_comparison", label: "Period Comparison", desc: "Period-by-period momentum, adjustments, and coaching takeaways", needsPlayer: false, needsOpponent: false },
      { value: "film_system_execution", label: "System Execution", desc: "Audit how well the team ran its tactical systems", needsPlayer: false, needsOpponent: false },
    ],
  },
  {
    group: "Player Analysis",
    types: [
      { value: "film_player_analysis", label: "Player Film Analysis", desc: "Clip-by-clip assessment of a specific player", needsPlayer: true, needsOpponent: false },
      { value: "film_shift_review", label: "Shift-by-Shift Review", desc: "Development-focused shift breakdown for one player", needsPlayer: true, needsOpponent: false },
      { value: "film_goalie_review", label: "Goaltender Review", desc: "Goalie coach film review — positioning, movement, saves", needsPlayer: true, needsOpponent: false },
    ],
  },
  {
    group: "Recruiting",
    types: [
      { value: "film_recruitment_brief", label: "Recruitment Film Brief", desc: "Professional brief to accompany a highlight reel for scouts", needsPlayer: true, needsOpponent: false },
    ],
  },
  {
    group: "Opponent",
    types: [
      { value: "film_opponent_prep", label: "Opponent Prep", desc: "Tactical breakdown for game preparation", needsPlayer: false, needsOpponent: true },
    ],
  },
  {
    group: "Practice",
    types: [
      { value: "film_practice_review", label: "Practice Review", desc: "Drill execution, standouts, system concepts", needsPlayer: false, needsOpponent: false },
    ],
  },
];

// Flat list for lookups (used by handleSelectReportType)
const FILM_REPORT_TYPES = FILM_REPORT_GROUPS.flatMap((g) => g.types);

interface FilmSummary {
  id: string;
  player_id: string;
  player_name: string;
  summary: string;
  session_id: string;
  created_at: string;
}

export default function FilmSessionViewerPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = params.id as string;
  const seekTime = searchParams.get("t");

  const [session, setSession] = useState<SessionData | null>(null);
  const [upload, setUpload] = useState<UploadData | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // PXI report generation
  const [generating, setGenerating] = useState(false);
  const [autoTagging, setAutoTagging] = useState(false);
  const [reportType, setReportType] = useState("");
  const [showTypeSelector, setShowTypeSelector] = useState(false);
  const [pendingReportType, setPendingReportType] = useState<string | null>(null);

  // Player selector (for Player Film Analysis)
  const [rosterPlayers, setRosterPlayers] = useState<RosterPlayer[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [playerSearchQuery, setPlayerSearchQuery] = useState("");
  const [playerSearchResults, setPlayerSearchResults] = useState<RosterPlayer[]>([]);
  const [searchingPlayers, setSearchingPlayers] = useState(false);

  // Opponent selector (for Opponent Prep)
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [selectedOpponentId, setSelectedOpponentId] = useState("");
  const [loadingTeams, setLoadingTeams] = useState(false);

  // Generated report display
  const [generatedReport, setGeneratedReport] = useState<{ id: string; title: string; output_text: string; created_at?: string } | null>(null);
  const [reportExpanded, setReportExpanded] = useState(false);

  // Comment form
  const [commentText, setCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);

  // Seek-to time from ?t= query param
  const [startTime, setStartTime] = useState<number | undefined>(undefined);

  // Mark In / Mark Out clip creation
  const [clipStart, setClipStart] = useState<number | null>(null);
  const [clipEnd, setClipEnd] = useState<number | null>(null);
  const [clipTitle, setClipTitle] = useState("");
  const [clipCoachingNote, setClipCoachingNote] = useState("");
  const [savingClip, setSavingClip] = useState(false);
  const [clipRefreshKey, setClipRefreshKey] = useState(0);
  const [activeClipId, setActiveClipId] = useState<string | null>(null);
  const [clipAnnotations, setClipAnnotations] = useState<{ id: number; timestamp_seconds: number; r2_url: string; created_by: string; created_at: string }[]>([]);
  const [annotationPreview, setAnnotationPreview] = useState<string | null>(null);

  // Event data import
  const [importingEvents, setImportingEvents] = useState(false);
  const [importResult, setImportResult] = useState<{ events_created: number; clips_created: number; player_matches: number; unmatched_players: string[] } | null>(null);
  const [showReplaceConfirm, setShowReplaceConfirm] = useState(false);
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Event timeline display
  const [sessionEvents, setSessionEvents] = useState<SessionEvent[]>([]);
  const [eventFilter, setEventFilter] = useState<EventCategory>("all");

  // Cinema mode — persisted to localStorage
  const [cinemaMode, setCinemaMode] = useState(() => {
    try { return localStorage.getItem("pxi_cinema_mode") === "1"; } catch { return false; }
  });
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  // Score badge state
  const [homeScore, setHomeScore] = useState<number>(0);
  const [awayScore, setAwayScore] = useState<number>(0);
  const [currentPeriod, setCurrentPeriod] = useState("1st");

  // Telestration draw mode
  const [drawMode, setDrawMode] = useState(false);
  const [drawTool, setDrawTool] = useState<"arrow" | "circle" | "freehand" | "line" | "text" | "eraser">("freehand");
  const [drawColor, setDrawColor] = useState("#00B5B8");
  const [drawLineWidth, setDrawLineWidth] = useState(3);
  const [drawFade, setDrawFade] = useState(false);
  const telestrationRef = useRef<TelestrationCanvasHandle>(null);

  // Reel builder modal + session reels
  const [showReelBuilder, setShowReelBuilder] = useState(false);
  const [sessionReels, setSessionReels] = useState<{ id: string; title: string; status: string; clip_count: number; created_at: string; share_token?: string; share_enabled?: boolean }[]>([]);
  const [copiedReelId, setCopiedReelId] = useState<string | null>(null);

  // P2-C2: Film summaries for tagged players
  const [filmSummaries, setFilmSummaries] = useState<FilmSummary[]>([]);

  // Multi-video session: period tabs
  const [uploads, setUploads] = useState<{ id: string; mux_playback_id?: string; period_number?: number; period_label?: string; source_url?: string; upload_source?: string; status?: string; duration_seconds?: number; title?: string }[]>([]);
  const [activeUploadIdx, setActiveUploadIdx] = useState(0);
  const [showAddVideoModal, setShowAddVideoModal] = useState(false);
  const [addVideoPeriod, setAddVideoPeriod] = useState<number | null>(null);
  const [addVideoFile, setAddVideoFile] = useState<File | null>(null);
  const [addingVideo, setAddingVideo] = useState(false);
  const addVideoFileRef = useRef<HTMLInputElement>(null);

  // Code Window Pro Editor state
  const [codeCat, setCodeCat] = useState<"all" | "offensive" | "defensive" | "special_teams">("all");
  const [codeTagging, setCodeTagging] = useState<string | null>(null);
  const [codePulse, setCodePulse] = useState<string | null>(null);
  const [codeLastTag, setCodeLastTag] = useState<{ name: string; time: string } | null>(null);
  const [codeShowCustom, setCodeShowCustom] = useState(false);
  const [codeCustomLabel, setCodeCustomLabel] = useState("");

  // Right panel tab state
  const [rightTab, setRightTab] = useState<"clips" | "reels" | "pxi" | "info">("clips");
  const [clipCount, setClipCount] = useState(0);

  // Video player ref for getting current time + playback control
  const videoPlayerRef = useRef<VideoPlayerHandle>(null);
  const currentTimeRef = useRef<number>(0);

  const getCurrentTime = useCallback(() => currentTimeRef.current, []);

  // Switch active upload by index (for period tabs + clip auto-switch)
  const switchUpload = useCallback((idx: number) => {
    if (idx < 0 || idx >= uploads.length) return;
    setActiveUploadIdx(idx);
    const u = uploads[idx];
    setUpload({
      id: u.id,
      playback_id: u.mux_playback_id || null,
      status: u.status || "ready",
      title: u.title || "",
      upload_source: u.upload_source || "mux",
      source_url: u.source_url || undefined,
    });
  }, [uploads]);

  // Callback for ClipPanel: switch to the upload that owns a clip, then seek
  const handleClipPeriodSwitch = useCallback((uploadId: string) => {
    const idx = uploads.findIndex((u) => u.id === uploadId);
    if (idx >= 0 && idx !== activeUploadIdx) {
      switchUpload(idx);
    }
  }, [uploads, activeUploadIdx, switchUpload]);

  const loadSessionEvents = useCallback(async () => {
    try {
      const res = await api.get(`/film/events`, { params: { session_id: sessionId, limit: 500 } });
      const events = Array.isArray(res.data) ? res.data : [];
      setSessionEvents(events);
    } catch {
      // Silently fail on events load
    }
  }, [sessionId]);

  // Code Window: tag event handler (inline, fires same API as EventTagger)
  const codeTagEvent = useCallback(async (eventType: string, label?: string) => {
    if (eventType === "custom" && !label) { setCodeShowCustom(true); return; }
    if (!upload?.id) return;
    setCodeTagging(eventType);
    try {
      const time = Math.floor(currentTimeRef.current);
      await api.post("/film/events", {
        upload_id: upload.id,
        session_id: sessionId,
        event_type: eventType,
        event_label: label || null,
        time_seconds: time,
      });
      const displayLabel = label || eventType.replace(/_/g, " ");
      const m = Math.floor(time / 60);
      const s = Math.floor(time % 60);
      setCodeLastTag({ name: displayLabel, time: `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}` });
      setCodePulse(eventType);
      setTimeout(() => setCodePulse(null), 600);
      loadSessionEvents();
    } catch {
      toast.error("Failed to tag event");
    } finally {
      setCodeTagging(null);
    }
  }, [upload?.id, sessionId, loadSessionEvents]);

  // Code Window: keyboard shortcuts 1-9 for active category
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const num = parseInt(e.key);
      if (num >= 1 && num <= 9) {
        const visibleBtns = codeCat === "all" ? CODE_BUTTONS : CODE_BUTTONS.filter((b) => b.category === codeCat);
        if (num <= visibleBtns.length) {
          e.preventDefault();
          codeTagEvent(visibleBtns[num - 1].type);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [codeCat, codeTagEvent]);

  // TODO: totalDuration should come from upload.duration when available; using 3600s fallback
  const totalDuration = 3600;
  const [playheadPct, setPlayheadPct] = useState(0);

  const handleTimeUpdate = useCallback((seconds: number) => {
    currentTimeRef.current = seconds;
    setPlayheadPct(totalDuration > 0 ? (seconds / totalDuration) * 100 : 0);
  }, [totalDuration]);

  // Load session data
  useEffect(() => {
    const loadData = async () => {
      try {
        const sessionRes = await api.get(`/film/sessions/${sessionId}`);
        const sessionData = sessionRes.data;
        setSession(sessionData);

        // Track last opened for Film Hub hints
        try { localStorage.setItem(`film_session_opened_${sessionId}`, new Date().toISOString()); } catch { /* */ }

        // Multi-video: use uploads[] array from backend (C2)
        const uploadsArr = sessionData.uploads || [];
        setUploads(uploadsArr);
        // Set active upload to first in list (or legacy single upload)
        const firstUpload = uploadsArr[0] || sessionData.upload;
        if (firstUpload) {
          setUpload({
            id: firstUpload.id,
            playback_id: firstUpload.mux_playback_id || firstUpload.playback_id || null,
            status: firstUpload.status,
            title: firstUpload.title,
            upload_source: firstUpload.upload_source,
            source_url: firstUpload.source_url,
          });
        }

        // Load existing PXI report if session has one
        if (sessionData.pxi_output && sessionData.pxi_status === "completed") {
          try {
            const reportRes = await api.get(`/reports/${sessionData.pxi_output}`);
            if (reportRes.data?.output_text) {
              setGeneratedReport({
                id: reportRes.data.id,
                title: reportRes.data.title || "Film Analysis",
                output_text: reportRes.data.output_text,
                created_at: reportRes.data.created_at,
              });
            }
          } catch {
            // Report may have been deleted
          }
        }

        // Load comments
        try {
          const commentsRes = await api.get(
            `/film/sessions/${sessionId}/comments`
          );
          setComments(commentsRes.data);
        } catch {
          // Comments may not exist yet
        }

        // Load session events
        try {
          const eventsRes = await api.get(`/film/events`, { params: { session_id: sessionId, limit: 500 } });
          setSessionEvents(Array.isArray(eventsRes.data) ? eventsRes.data : []);
        } catch {
          // Events may not exist yet
        }

        // Load reels
        try {
          const reelsRes = await api.get("/highlight-reels");
          const all = Array.isArray(reelsRes.data) ? reelsRes.data : [];
          setSessionReels(
            all.map((r: { id: string; title: string; status: string; clip_ids?: string | string[]; created_at: string; share_token?: string; share_enabled?: boolean | number }) => ({
              id: r.id,
              title: r.title,
              status: r.status || "draft",
              clip_count: Array.isArray(r.clip_ids) ? r.clip_ids.length : 0,
              created_at: r.created_at,
              share_token: r.share_token,
              share_enabled: !!r.share_enabled,
            }))
          );
        } catch {
          // Reels may not exist yet
        }

        // P2-C2: Load film summaries for players tagged in this session
        try {
          const clipsRes = await api.get("/film/clips", { params: { session_id: sessionId, limit: 200 } });
          const clipArr = Array.isArray(clipsRes.data) ? clipsRes.data : [];
          // Extract unique player IDs from clips
          const playerIdSet = new Set<string>();
          for (const clip of clipArr) {
            const pids = Array.isArray(clip.player_ids) ? clip.player_ids : [];
            for (const pid of pids) {
              if (pid) playerIdSet.add(String(pid));
            }
          }
          // Fetch intelligence history for each player, filter for film_summary
          const summaries: FilmSummary[] = [];
          for (const pid of playerIdSet) {
            try {
              const intelRes = await api.get(`/players/${pid}/intelligence/history`);
              const allIntel = Array.isArray(intelRes.data) ? intelRes.data : [];
              // Find film_summary for THIS session
              const match = allIntel.find(
                (i: { trigger?: string; session_id?: string; summary?: string }) =>
                  i.trigger === "film_summary" && i.session_id === sessionId && i.summary
              );
              if (match) {
                // Get player name
                let playerName = "Player";
                try {
                  const playerRes = await api.get(`/players/${pid}`);
                  playerName = `${playerRes.data.first_name || ""} ${playerRes.data.last_name || ""}`.trim() || "Player";
                } catch { /* fallback */ }
                summaries.push({
                  id: match.id,
                  player_id: pid,
                  player_name: playerName,
                  summary: match.summary,
                  session_id: match.session_id,
                  created_at: match.created_at,
                });
              }
            } catch { /* Non-critical */ }
          }
          // Sort by created_at desc, limit to 3
          summaries.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          setFilmSummaries(summaries.slice(0, 3));
        } catch {
          // Film summaries non-critical
        }
      } catch (e: unknown) {
        const msg =
          (e as { response?: { data?: { detail?: string } } }).response?.data
            ?.detail || "Failed to load session";
        setError(msg);
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [sessionId]);

  // Seek to ?t= timestamp after upload is loaded
  useEffect(() => {
    if (seekTime && upload?.playback_id) {
      const t = parseFloat(seekTime);
      if (!isNaN(t) && t > 0) {
        setStartTime(t);
      }
    }
  }, [seekTime, upload]);

  // Restore analysis panel expand state from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`film_analysis_expanded_${sessionId}`);
      if (stored === "true") setReportExpanded(true);
    } catch { /* localStorage unavailable */ }
  }, [sessionId]);

  // Escape key exits Cinema Mode + D toggles draw mode + tool shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "Escape") { setCinemaMode(false); try { localStorage.setItem("pxi_cinema_mode", "0"); } catch { /* */ } }
      if (e.key === "d" || e.key === "D") { setDrawMode(prev => !prev); }
      if (drawMode) {
        if (e.key === "a" || e.key === "A") setDrawTool("arrow");
        if (e.key === "c" || e.key === "C") setDrawTool("circle");
        if (e.key === "f" || e.key === "F") setDrawTool("freehand");
        if (e.key === "l" || e.key === "L") setDrawTool("line");
        if (e.key === "t" || e.key === "T") setDrawTool("text");
        if (e.key === "e" || e.key === "E") setDrawTool("eraser");
        if (e.key === "x" || e.key === "X") telestrationRef.current?.clear();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [drawMode]);

  const toggleReportExpanded = useCallback(() => {
    setReportExpanded((prev) => {
      const next = !prev;
      try { localStorage.setItem(`film_analysis_expanded_${sessionId}`, String(next)); } catch { /* */ }
      return next;
    });
  }, [sessionId]);

  const loadComments = useCallback(async () => {
    try {
      const res = await api.get(`/film/sessions/${sessionId}/comments`);
      setComments(res.data);
    } catch {
      // Silently fail on comment refresh
    }
  }, [sessionId]);

  const loadSessionReels = useCallback(async () => {
    try {
      const res = await api.get("/highlight-reels");
      const all = Array.isArray(res.data) ? res.data : [];
      // Filter reels that contain clips from this session (clip_ids populated from this session's clips)
      // Since the API doesn't filter by session, we show all org reels for now.
      // A lightweight approach: show reels created from this session (we pass session context at creation).
      setSessionReels(
        all.map((r: { id: string; title: string; status: string; clip_ids?: string | string[]; created_at: string; share_token?: string; share_enabled?: boolean | number }) => ({
          id: r.id,
          title: r.title,
          status: r.status || "draft",
          clip_count: Array.isArray(r.clip_ids) ? r.clip_ids.length : 0,
          created_at: r.created_at,
          share_token: r.share_token,
          share_enabled: !!r.share_enabled,
        }))
      );
    } catch { /* */ }
  }, []);

  const handleSubmitComment = useCallback(async () => {
    if (!commentText.trim()) return;
    setSubmittingComment(true);
    try {
      await api.post(`/film/sessions/${sessionId}/comments`, {
        body: commentText.trim(),
        timestamp_seconds: Math.floor(currentTimeRef.current) || null,
      });
      setCommentText("");
      toast.success("Comment added");
      loadComments();
    } catch {
      toast.error("Failed to add comment");
    } finally {
      setSubmittingComment(false);
    }
  }, [sessionId, commentText, loadComments]);

  const handleDeleteComment = useCallback(
    async (commentId: string) => {
      try {
        await api.delete(
          `/film/sessions/${sessionId}/comments/${commentId}`
        );
        setComments((prev) => prev.filter((c) => c.id !== commentId));
        toast.success("Comment deleted");
      } catch {
        toast.error("Failed to delete comment");
      }
    },
    [sessionId]
  );

  const handleSelectReportType = useCallback(
    async (type: string) => {
      const config = FILM_REPORT_TYPES.find((rt) => rt.value === type);
      if (!config) return;

      // Player-focused reports — need a player selector
      if (config.needsPlayer) {
        setPendingReportType(type);
        setSelectedPlayerId("");
        setPlayerSearchQuery("");
        setPlayerSearchResults([]);
        setShowTypeSelector(false);
        // Load roster: try session team_id first, then user's preferred_team_id
        const teamId = session?.team_id || getUser()?.preferred_team_id;
        if (teamId) {
          setLoadingRoster(true);
          try {
            const res = await api.get(`/players`, { params: { team_id: teamId, limit: 200 } });
            const players = Array.isArray(res.data) ? res.data : res.data?.players || [];
            setRosterPlayers(players);
          } catch {
            setRosterPlayers([]);
          } finally {
            setLoadingRoster(false);
          }
        }
        return;
      }

      // Opponent Prep — needs opponent selection if not already set
      if (config.needsOpponent && !session?.opponent_team_id) {
        setPendingReportType(type);
        setSelectedOpponentId("");
        setShowTypeSelector(false);
        setLoadingTeams(true);
        try {
          const res = await api.get(`/teams`);
          const teamList = Array.isArray(res.data) ? res.data : res.data?.teams || [];
          setTeams(teamList.map((t: { id?: string; name?: string; team_name?: string }) => ({
            id: t.id || t.name || t.team_name || "",
            name: t.name || t.team_name || "Unknown",
          })));
        } catch {
          setTeams([]);
        } finally {
          setLoadingTeams(false);
        }
        return;
      }

      // Direct generation (Post-Game Review, Practice Review, or Opponent Prep with existing opponent)
      await executeGeneration(type);
    },
    [session]
  );

  const executeGeneration = useCallback(
    async (type: string, playerId?: string, opponentTeamId?: string) => {
      setGenerating(true);
      setPendingReportType(null);
      setShowTypeSelector(false);
      try {
        const payload: Record<string, string> = { report_type: type };
        if (playerId) payload.player_id = playerId;
        if (opponentTeamId) payload.opponent_team_id = opponentTeamId;
        else if (session?.opponent_team_id) payload.opponent_team_id = session.opponent_team_id;

        const res = await api.post(
          `/film/sessions/${sessionId}/generate-report`,
          payload
        );

        // Load the generated report content inline
        try {
          const reportRes = await api.get(`/reports/${res.data.report_id}`);
          if (reportRes.data?.output_text) {
            setGeneratedReport({
              id: reportRes.data.id,
              title: reportRes.data.title || "Film Analysis",
              output_text: reportRes.data.output_text,
              created_at: reportRes.data.created_at,
            });
            setReportExpanded(true);
            setRightTab("pxi");
            try { localStorage.setItem(`film_analysis_expanded_${sessionId}`, "true"); } catch { /* */ }
            toast.success("Report generated!");
          } else {
            console.error("Film report content empty — report_id:", res.data.report_id);
            toast.error("Report generated but content is empty. Try again.");
          }
        } catch (fetchErr: unknown) {
          const fetchMsg = (fetchErr as { response?: { data?: { detail?: string } } }).response?.data?.detail || "Failed to load report content after generation";
          console.error("Film report content fetch failed:", fetchMsg, fetchErr);
          toast.error(fetchMsg);
        }
      } catch (e: unknown) {
        const msg =
          (e as { response?: { data?: { detail?: string } } }).response?.data
            ?.detail || "Failed to generate report";
        toast.error(msg);
      } finally {
        setGenerating(false);
      }
    },
    [sessionId, session]
  );

  const handleSpeedChange = useCallback((rate: number) => {
    setPlaybackSpeed(rate);
    videoPlayerRef.current?.setPlaybackRate(rate);
  }, []);

  const handleSaveClip = useCallback(async () => {
    if (clipStart === null || clipEnd === null) return;
    if (clipEnd <= clipStart) {
      toast.error("Mark Out must be after Mark In");
      return;
    }
    setSavingClip(true);
    try {
      const clipRes = await api.post("/film/clips", {
        title: clipTitle.trim() || `Clip ${formatTimestamp(clipStart)}–${formatTimestamp(clipEnd)}`,
        session_id: sessionId,
        upload_id: upload?.id || null,
        start_time_seconds: clipStart,
        end_time_seconds: clipEnd,
        clip_type: "manual",
        coaching_note: clipCoachingNote.trim() || null,
      });
      if (clipRes.data?.id) setActiveClipId(clipRes.data.id);
      toast.success("Clip saved");
      setClipStart(null);
      setClipEnd(null);
      setClipTitle("");
      setClipCoachingNote("");
      setClipRefreshKey((k) => k + 1);
    } catch {
      toast.error("Failed to save clip");
    } finally {
      setSavingClip(false);
    }
  }, [clipStart, clipEnd, clipTitle, clipCoachingNote, sessionId, upload]);

  const fetchClipAnnotations = useCallback(async (clipId: string) => {
    try {
      const res = await api.get(`/film/clips/${clipId}/annotations`);
      setClipAnnotations(Array.isArray(res.data) ? res.data : []);
    } catch {
      /* non-critical */
    }
  }, []);

  const handleAnnotationSave = useCallback(async (dataUrl: string) => {
    if (!activeClipId) {
      toast.error("Save a clip first before annotating");
      return;
    }
    try {
      await api.post(`/film/clips/${activeClipId}/annotation`, {
        timestamp_seconds: currentTimeRef.current,
        image_data_url: dataUrl,
      });
      toast.success("Annotation saved to clip");
      fetchClipAnnotations(activeClipId);
    } catch {
      toast.error("Failed to save annotation");
    }
  }, [activeClipId, fetchClipAnnotations]);

  // Fetch annotations when active clip changes
  useEffect(() => {
    if (activeClipId) {
      fetchClipAnnotations(activeClipId);
    } else {
      setClipAnnotations([]);
    }
  }, [activeClipId, fetchClipAnnotations]);

  const executeEventImport = useCallback(async (file: File, replace: boolean) => {
    setImportingEvents(true);
    setImportResult(null);
    setShowReplaceConfirm(false);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const url = `/film/sessions/${sessionId}/import-events${replace ? "?replace=true" : ""}`;
      const res = await api.post(url, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const data = res.data;
      setImportResult(data);
      toast.success(`Imported ${data.events_created} events and ${data.clips_created} clips`);
      // Refresh clips panel and event timeline
      setClipRefreshKey((k) => k + 1);
      loadSessionEvents();
      // Update session to reflect imported state
      setSession((prev) => prev ? { ...prev, event_data_source: "xml_import" } : prev);
    } catch (e: unknown) {
      const resp = (e as { response?: { status?: number; data?: { detail?: string } } }).response;
      if (resp?.status === 409) {
        // Session already has events — ask to replace
        setPendingImportFile(file);
        setShowReplaceConfirm(true);
      } else {
        const msg = resp?.data?.detail || "Failed to import event data";
        toast.error(msg);
      }
    } finally {
      setImportingEvents(false);
    }
  }, [sessionId, loadSessionEvents]);

  const handleFileSelected = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset file input so the same file can be re-selected
    e.target.value = "";
    const hasExisting = !!session?.event_data_source;
    executeEventImport(file, hasExisting);
  }, [session, executeEventImport]);

  // ── Add Video to Session handler ──
  const handleAddVideo = useCallback(async () => {
    if (addVideoPeriod === null || !addVideoFile) return;
    setAddingVideo(true);
    try {
      const periodLabel = addVideoPeriod <= 3 ? `Period ${addVideoPeriod}` : addVideoPeriod === 4 ? "OT" : "SO";
      const res = await api.post(`/film/sessions/${sessionId}/add-upload`, {
        period_number: addVideoPeriod,
        period_label: periodLabel,
        title: `${periodLabel} — ${session?.title || "Session"}`,
        cors_origin: window.location.origin,
      });
      const uploadUrl = res.data.upload_url;
      const newUploadId = res.data.upload_id;
      if (!uploadUrl) throw new Error("No upload URL returned");

      // Upload file directly to Mux
      await fetch(uploadUrl, { method: "PUT", body: addVideoFile, headers: { "Content-Type": "video/*" } });
      toast.success(`${periodLabel} video uploading — it will appear when processing completes`);

      // Add to local uploads list immediately (processing state)
      setUploads((prev) => [...prev, {
        id: newUploadId, mux_playback_id: undefined, period_number: addVideoPeriod,
        period_label: periodLabel, status: "processing", title: `${periodLabel}`,
      }].sort((a, b) => (a.period_number || 99) - (b.period_number || 99)));

      setShowAddVideoModal(false);
      setAddVideoPeriod(null);
      setAddVideoFile(null);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } }).response?.data?.detail || "Failed to add video";
      toast.error(msg);
    } finally {
      setAddingVideo(false);
    }
  }, [addVideoPeriod, addVideoFile, sessionId, session?.title]);

  if (loading) {
    return (
      <ProtectedRoute>
        <NavBar />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center py-24">
            <Loader2 size={28} className="animate-spin text-teal" />
            <span className="ml-2 text-sm text-muted">Loading session...</span>
          </div>
        </main>
      </ProtectedRoute>
    );
  }

  if (error || !session) {
    return (
      <ProtectedRoute>
        <NavBar />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center py-24 text-red-500 text-sm">
            <AlertCircle size={16} className="mr-2" />
            {error || "Session not found"}
          </div>
        </main>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      {/* Full-viewport dark shell */}
      <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#060E1A", overflow: "hidden" }}>

        {/* ═══════════════════════════════════════════════════════
            TOPBAR — 38px, darkest background
            ═══════════════════════════════════════════════════════ */}
        <div style={{ height: 38, minHeight: 38, background: "#040C17", borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 12px", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Link
              href="/film"
              className="hover:opacity-70 transition-opacity"
              style={{ color: "rgba(255,255,255,0.5)", display: "flex", alignItems: "center" }}
            >
              <ArrowLeft size={14} />
            </Link>
            <span
              style={{ fontSize: 9, fontFamily: "'Oswald', sans-serif", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#14B8A8" }}
            >
              FILM ROOM
            </span>
            <span style={{ width: 1, height: 16, background: "rgba(255,255,255,0.1)" }} />
            <span
              style={{ fontSize: 12, fontFamily: "'Oswald', sans-serif", fontWeight: 600, color: "#FFFFFF", letterSpacing: "0.04em", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
            >
              {session.title}
            </span>
            <span
              style={{ fontSize: 8, fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.5)", background: "rgba(13,148,136,0.25)", borderRadius: 3, padding: "1px 5px" }}
            >
              {SESSION_TYPE_LABELS[session.session_type] || session.session_type}
            </span>
            {(upload && (upload.upload_source === "youtube" || upload.upload_source === "vimeo" || upload.upload_source === "external_link")) || session.source_type === "instat_url" ? (
              <span
                style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 600, fontSize: 8, background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)", borderRadius: 3, padding: "1px 5px", textTransform: "uppercase", letterSpacing: "0.05em" }}
              >
                EXTERNAL
              </span>
            ) : null}
            <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono', ui-monospace, monospace", color: "rgba(255,255,255,0.35)" }}>
              {formatDate(session.created_at)}
            </span>
          </div>

          {/* Generate Analysis + Build Reel + Add Video buttons */}
          <div className="relative" style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            {uploads.length <= 1 && (
              <button
                onClick={() => { setShowAddVideoModal(true); setAddVideoPeriod(null); setAddVideoFile(null); }}
                style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 5, fontSize: 9, fontFamily: "'Oswald', sans-serif", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.45)", border: "1px dashed rgba(255,255,255,0.15)", cursor: "pointer" }}
                title="Add period video to this session"
              >
                <Plus size={10} />
                Add Video
              </button>
            )}
            <button
              onClick={() => setShowReelBuilder(true)}
              style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 5, fontSize: 9, fontFamily: "'Oswald', sans-serif", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", background: "rgba(234,88,12,0.15)", color: "#E67E22", border: "1px solid rgba(234,88,12,0.25)", cursor: "pointer" }}
            >
              <Film size={10} />
              Build Reel
            </button>
            <button
              onClick={async () => {
                if (autoTagging || !upload?.id) return;
                setAutoTagging(true);
                const toastId = toast.loading("Analyzing video...");
                try {
                  const orgId = getUser()?.org_id || "";
                  await api.post("/video/analyze", { session_id: sessionId, org_id: orgId });
                  // Poll auto_tag_status on the upload until complete or failed
                  let status = "processing";
                  for (let i = 0; i < 60; i++) {
                    await new Promise((r) => setTimeout(r, 3000));
                    try {
                      const pollRes = await api.get(`/film/uploads/${upload.id}`);
                      status = pollRes.data?.auto_tag_status || "processing";
                      if (status === "complete" || status === "failed") break;
                    } catch { /* continue polling */ }
                  }
                  toast.dismiss(toastId);
                  if (status === "complete") {
                    // Refresh events
                    try {
                      const evRes = await api.get("/film/events", { params: { session_id: sessionId, limit: 500 } });
                      const evts = Array.isArray(evRes.data) ? evRes.data : [];
                      setSessionEvents(evts);
                      toast.success(`${evts.length} events detected — review in timeline`, { duration: 8000 });
                    } catch {
                      toast.success("Auto-tagging complete — refresh to see events", { duration: 8000 });
                    }
                  } else {
                    toast.error("Auto-tagging failed — try again", { style: { background: "#E67E22", color: "#FFFFFF" } });
                  }
                } catch {
                  toast.dismiss(toastId);
                  toast.error("Auto-tagging failed — try again", { style: { background: "#E67E22", color: "#FFFFFF" } });
                } finally {
                  setAutoTagging(false);
                }
              }}
              disabled={autoTagging}
              style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 5, fontSize: 9, fontFamily: "'Oswald', sans-serif", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", background: "#0D9488", color: "#FFFFFF", border: "none", cursor: autoTagging ? "not-allowed" : "pointer", opacity: autoTagging ? 0.6 : 1 }}
            >
              {autoTagging ? (
                <Loader2 size={10} className="animate-spin" />
              ) : (
                <Sparkles size={10} />
              )}
              {autoTagging ? "Analyzing..." : "Auto-Tag"}
            </button>
            <button
              onClick={() => { setShowTypeSelector(!showTypeSelector); setPendingReportType(null); }}
              disabled={generating}
              style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 5, fontSize: 9, fontFamily: "'Oswald', sans-serif", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", background: "rgba(13,148,136,0.15)", color: "#14B8A8", border: "1px solid rgba(13,148,136,0.25)", cursor: "pointer", opacity: generating ? 0.5 : 1 }}
            >
              {generating ? (
                <Loader2 size={10} className="animate-spin" />
              ) : (
                <Sparkles size={10} />
              )}
              {generating ? "Generating..." : generatedReport ? "Regenerate" : "Analyze"}
            </button>
            <button
              onClick={() => { const next = !cinemaMode; setCinemaMode(next); try { localStorage.setItem("pxi_cinema_mode", next ? "1" : "0"); } catch { /* */ } }}
              style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 5, fontSize: 9, fontFamily: "'Oswald', sans-serif", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", background: "transparent", color: cinemaMode ? "#14B8A8" : "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer" }}
              title={cinemaMode ? "Exit Cinema Mode" : "Cinema Mode"}
            >
              {cinemaMode ? <Minimize2 size={10} /> : <Maximize2 size={10} />}
              Cinema
            </button>

            {/* Report type dropdown — grouped */}
            {showTypeSelector && !generating && (
              <div className="absolute right-0 top-full mt-1 w-80 bg-white rounded-xl border border-border shadow-lg z-20 py-1 max-h-[420px] overflow-y-auto">
                {FILM_REPORT_GROUPS.map((group, gi) => (
                  <div key={group.group}>
                    {gi > 0 && <div className="border-t border-border mx-3 my-1" />}
                    <div className="px-4 pt-2.5 pb-1">
                      <span className="text-[9px] font-oswald uppercase tracking-[0.15em] text-muted/50">{group.group}</span>
                    </div>
                    {group.types.map((rt) => (
                      <button
                        key={rt.value}
                        onClick={() => handleSelectReportType(rt.value)}
                        className="w-full text-left px-4 py-2 hover:bg-navy/[0.03] transition-colors group"
                      >
                        <span className="text-sm text-navy font-oswald tracking-wider">{rt.label}</span>
                        <span className="block text-[10px] text-muted/60 mt-0.5 leading-tight">{rt.desc}</span>
                      </button>
                    ))}
                  </div>
                ))}
                <div className="border-t border-border mt-1 pt-1">
                  <button
                    onClick={() => { setShowTypeSelector(false); setPendingReportType(null); }}
                    className="w-full text-left px-4 py-2 text-xs text-muted hover:text-navy transition-colors flex items-center gap-1.5"
                  >
                    <X size={12} />
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Player selector (for any report type that needs a player) */}
            {pendingReportType && FILM_REPORT_TYPES.find((rt) => rt.value === pendingReportType)?.needsPlayer && !generating && (
              <div className="absolute right-0 top-full mt-1 w-72 bg-white rounded-xl border border-border shadow-lg z-20 p-4">
                <h4 className="text-xs font-oswald uppercase tracking-wider text-navy mb-2 flex items-center gap-1.5">
                  <Users size={12} />
                  Select Player
                </h4>
                {loadingRoster ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 size={16} className="animate-spin text-teal" />
                  </div>
                ) : rosterPlayers.length === 0 ? (
                  <div>
                    <p className="text-[11px] text-muted/60 mb-2">No team roster available. Search for a player by name:</p>
                    <div className="relative mb-2">
                      <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted/40" />
                      <input
                        type="text"
                        value={playerSearchQuery}
                        onChange={async (e) => {
                          const q = e.target.value;
                          setPlayerSearchQuery(q);
                          if (q.trim().length < 2) { setPlayerSearchResults([]); return; }
                          setSearchingPlayers(true);
                          try {
                            const res = await api.get(`/players`, { params: { search: q.trim(), limit: 20 } });
                            const results = Array.isArray(res.data) ? res.data : res.data?.players || [];
                            setPlayerSearchResults(results);
                          } catch { setPlayerSearchResults([]); }
                          finally { setSearchingPlayers(false); }
                        }}
                        placeholder="Search players..."
                        className="w-full border border-border rounded-lg pl-7 pr-3 py-1.5 text-xs text-navy focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
                      />
                    </div>
                    {searchingPlayers && (
                      <div className="flex items-center justify-center py-2">
                        <Loader2 size={12} className="animate-spin text-teal" />
                      </div>
                    )}
                    {playerSearchResults.length > 0 && (
                      <select
                        value={selectedPlayerId}
                        onChange={(e) => setSelectedPlayerId(e.target.value)}
                        className="w-full border border-border rounded-lg px-3 py-1.5 text-xs text-navy mb-2 focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
                      >
                        <option value="">Choose a player...</option>
                        {playerSearchResults.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.first_name} {p.last_name}{p.position ? ` (${p.position})` : ""}
                          </option>
                        ))}
                      </select>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => executeGeneration(pendingReportType!, selectedPlayerId || undefined)}
                        disabled={!selectedPlayerId}
                        className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-oswald uppercase tracking-wider transition-colors ${
                          selectedPlayerId
                            ? "bg-teal text-white hover:bg-teal/90"
                            : "bg-border text-muted/50 cursor-not-allowed"
                        }`}
                      >
                        Generate
                      </button>
                      <button
                        onClick={() => setPendingReportType(null)}
                        className="px-3 py-1.5 rounded-lg text-xs text-muted hover:text-navy transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <select
                      value={selectedPlayerId}
                      onChange={(e) => setSelectedPlayerId(e.target.value)}
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm text-navy mb-3 focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
                    >
                      <option value="">Choose a player...</option>
                      {rosterPlayers.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.first_name} {p.last_name}{p.position ? ` (${p.position})` : ""}
                        </option>
                      ))}
                    </select>
                    <div className="flex gap-2">
                      <button
                        onClick={() => executeGeneration(pendingReportType!, selectedPlayerId || undefined)}
                        disabled={!selectedPlayerId}
                        className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-oswald uppercase tracking-wider transition-colors ${
                          selectedPlayerId
                            ? "bg-teal text-white hover:bg-teal/90"
                            : "bg-border text-muted/50 cursor-not-allowed"
                        }`}
                      >
                        Generate
                      </button>
                      <button
                        onClick={() => setPendingReportType(null)}
                        className="px-3 py-1.5 rounded-lg text-xs text-muted hover:text-navy transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Opponent selector (for Opponent Prep without existing opponent) */}
            {pendingReportType === "film_opponent_prep" && !generating && (
              <div className="absolute right-0 top-full mt-1 w-72 bg-white rounded-xl border border-border shadow-lg z-20 p-4">
                <h4 className="text-xs font-oswald uppercase tracking-wider text-navy mb-2 flex items-center gap-1.5">
                  <Users size={12} />
                  Select Opponent
                </h4>
                {loadingTeams ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 size={16} className="animate-spin text-teal" />
                  </div>
                ) : teams.length === 0 ? (
                  <div>
                    <p className="text-[11px] text-muted/60 mb-3">No teams found. Generate without a specific opponent.</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => executeGeneration("film_opponent_prep")}
                        className="flex-1 px-3 py-1.5 rounded-lg text-xs font-oswald uppercase tracking-wider bg-teal text-white hover:bg-teal/90 transition-colors"
                      >
                        Generate Anyway
                      </button>
                      <button
                        onClick={() => setPendingReportType(null)}
                        className="px-3 py-1.5 rounded-lg text-xs text-muted hover:text-navy transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <select
                      value={selectedOpponentId}
                      onChange={(e) => setSelectedOpponentId(e.target.value)}
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm text-navy mb-3 focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
                    >
                      <option value="">Choose opponent...</option>
                      {teams.map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                    <div className="flex gap-2">
                      <button
                        onClick={() => executeGeneration("film_opponent_prep", undefined, selectedOpponentId || undefined)}
                        disabled={!selectedOpponentId}
                        className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-oswald uppercase tracking-wider transition-colors ${
                          selectedOpponentId
                            ? "bg-teal text-white hover:bg-teal/90"
                            : "bg-border text-muted/50 cursor-not-allowed"
                        }`}
                      >
                        Generate
                      </button>
                      <button
                        onClick={() => setPendingReportType(null)}
                        className="px-3 py-1.5 rounded-lg text-xs text-muted hover:text-navy transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════
            GRID WORKSPACE — 3-column + timeline row
            ═══════════════════════════════════════════════════════ */}
        <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: cinemaMode ? "0px 1fr 0px" : "220px 1fr 260px", gridTemplateRows: "1fr 108px", overflow: "hidden", transition: "grid-template-columns 0.3s ease" }}>

          {/* ── COL 1 — Code Window (EventTagger) ──────────────── */}
          <div style={{ gridColumn: 1, gridRow: 1, background: "#0A1929", borderRight: "1px solid rgba(255,255,255,0.07)", display: "flex", flexDirection: "column", overflow: "hidden", transition: "opacity 0.3s ease", opacity: cinemaMode ? 0 : 1, pointerEvents: cinemaMode ? "none" : "auto" }}>
            {/* Code Window header — 34px, #0A1929 */}
            <div style={{ height: 34, padding: "0 10px", background: "#0A1929", borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#14B8A8" }} />
                <span style={{ fontSize: 10, fontFamily: "'Oswald', sans-serif", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#14B8A8" }}>
                  CODE WINDOW
                </span>
                {codeTagging && (
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#EF4444", animation: "codePulse 1s infinite" }} />
                )}
              </div>
              <span style={{ fontSize: 9, fontFamily: "'Oswald', sans-serif", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#14B8A8", background: "rgba(13,148,136,0.15)", border: "1px solid rgba(13,148,136,0.25)", borderRadius: 999, padding: "2px 8px" }}>
                REVIEW
              </span>
            </div>
            {/* ── Pro Editor: category tabs + 2-column button grid ── */}
            <style>{`@keyframes codePulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
            {/* Category filter tabs */}
            <div style={{ display: "flex", gap: 2, padding: "4px 6px", background: "#0A1628", borderBottom: "1px solid rgba(255,255,255,0.05)", flexShrink: 0 }}>
              {(["all", "offensive", "defensive", "special_teams"] as const).map((cat) => {
                const label = cat === "all" ? "ALL" : cat === "offensive" ? "OFF" : cat === "defensive" ? "DEF" : "ST";
                const active = codeCat === cat;
                return (
                  <button key={cat} onClick={() => setCodeCat(cat)} style={{ flex: 1, padding: "3px 0", borderRadius: 3, fontSize: 9, fontFamily: "'Oswald', sans-serif", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: active ? "#FFFFFF" : "rgba(255,255,255,0.4)", background: active ? "#00B5B8" : "transparent", border: "none", cursor: "pointer", transition: "all 0.15s" }}>
                    {label}
                  </button>
                );
              })}
            </div>
            {/* 2-column button grid */}
            <div style={{ flex: 1, overflow: "auto", padding: 6 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                {(codeCat === "all" ? CODE_BUTTONS : CODE_BUTTONS.filter((b) => b.category === codeCat)).map((btn, idx) => {
                  const catColor = CODE_CAT_COLOR[btn.category];
                  const isPulse = codePulse === btn.type;
                  const isTagging = codeTagging === btn.type;
                  const evCount = sessionEvents.filter((ev) => ev.event_type === btn.type).length;
                  return (
                    <button key={btn.type} onClick={() => codeTagEvent(btn.type)} disabled={isTagging} title={btn.tooltip} style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", gap: 4, padding: "6px 4px", borderRadius: 5, fontSize: 10, fontFamily: "'Oswald', sans-serif", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: isPulse ? "#FFFFFF" : "rgba(255,255,255,0.8)", background: isPulse ? catColor : "rgba(255,255,255,0.04)", border: `1px solid ${isPulse ? catColor : "rgba(255,255,255,0.1)"}`, borderLeft: `3px solid ${catColor}`, cursor: isTagging ? "not-allowed" : "pointer", opacity: isTagging ? 0.5 : 1, animation: isPulse ? "codePulse 1s infinite" : "none", transition: "all 0.15s" }}>
                      {isTagging ? <Loader2 size={10} className="animate-spin" /> : btn.label}
                      {evCount > 0 && (
                        <span style={{ fontSize: 8, fontFamily: "'JetBrains Mono', monospace", background: `${catColor}33`, borderRadius: 8, padding: "0 4px", color: catColor }}>{evCount}</span>
                      )}
                      {idx < 9 && (
                        <span style={{ position: "absolute", top: 1, right: 2, fontSize: 7, fontFamily: "'JetBrains Mono', monospace", color: "rgba(255,255,255,0.3)" }}>{idx + 1}</span>
                      )}
                    </button>
                  );
                })}
              </div>
              {/* Custom event inline input */}
              {codeShowCustom && (
                <div style={{ display: "flex", gap: 3, marginTop: 6 }}>
                  <input type="text" value={codeCustomLabel} onChange={(e) => setCodeCustomLabel(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && codeCustomLabel.trim()) { codeTagEvent("custom", codeCustomLabel.trim()); setCodeCustomLabel(""); setCodeShowCustom(false); } if (e.key === "Escape") { setCodeShowCustom(false); setCodeCustomLabel(""); } }} placeholder="Event name..." autoFocus style={{ flex: 1, padding: "4px 6px", borderRadius: 4, fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: "#FFFFFF", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", outline: "none" }} />
                  <button onClick={() => { if (codeCustomLabel.trim()) { codeTagEvent("custom", codeCustomLabel.trim()); setCodeCustomLabel(""); setCodeShowCustom(false); } }} style={{ padding: "3px 8px", borderRadius: 4, fontSize: 9, fontFamily: "'Oswald', sans-serif", fontWeight: 600, color: "#FFFFFF", background: "#6B7280", border: "none", cursor: "pointer" }}>Tag</button>
                  <button onClick={() => { setCodeShowCustom(false); setCodeCustomLabel(""); }} style={{ padding: "3px 6px", borderRadius: 4, fontSize: 9, color: "rgba(255,255,255,0.4)", background: "transparent", border: "none", cursor: "pointer" }}>✕</button>
                </div>
              )}
            </div>
            {/* Code Window footer — recording state + keyboard hints */}
            <div style={{ padding: "6px 8px", borderTop: "1px solid rgba(255,255,255,0.07)", background: "#0A1929", flexShrink: 0 }}>
              <p style={{ fontSize: 9, fontFamily: "'JetBrains Mono', monospace", color: "rgba(255,255,255,0.45)", margin: "0 0 3px 0" }}>
                {codeLastTag ? (<>Last: <span style={{ color: "#00B5B8" }}>{codeLastTag.name}</span> @ {codeLastTag.time}</>) : (<>Recording: <span style={{ color: "rgba(255,255,255,0.28)" }}>none</span></>)}
              </p>
              <p style={{ fontSize: 9, fontFamily: "'JetBrains Mono', monospace", color: "rgba(255,255,255,0.28)", whiteSpace: "nowrap", margin: 0 }}>
                Space: Play · Tag: 1-9 · N/P: Clips
              </p>
            </div>
          </div>

          {/* ── COL 2 — Video + Transport ──────────────────────── */}
          <div style={{ gridColumn: 2, gridRow: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#060E1A" }}>
            {/* Period tabs — only when multiple uploads */}
            {uploads.length > 1 && (
              <div style={{ display: "flex", alignItems: "center", gap: 2, padding: "4px 8px", background: "#0A1929", borderBottom: "1px solid rgba(255,255,255,0.07)", flexShrink: 0 }}>
                {uploads.map((u, idx) => (
                  <button
                    key={u.id}
                    onClick={() => switchUpload(idx)}
                    style={{
                      padding: "3px 10px", borderRadius: 4, border: "none", cursor: "pointer",
                      fontSize: 10, fontFamily: "'Oswald', sans-serif", fontWeight: 600,
                      letterSpacing: "0.08em", textTransform: "uppercase", transition: "all 0.15s",
                      background: idx === activeUploadIdx ? "#0D9488" : "rgba(255,255,255,0.06)",
                      color: idx === activeUploadIdx ? "#FFFFFF" : "rgba(255,255,255,0.5)",
                    }}
                  >
                    {u.period_label || (u.period_number ? `Period ${u.period_number}` : u.title || `Video ${idx + 1}`)}
                    {u.status === "processing" && " ⏳"}
                  </button>
                ))}
                <button
                  onClick={() => { setShowAddVideoModal(true); setAddVideoPeriod(null); setAddVideoFile(null); }}
                  style={{ padding: "3px 8px", borderRadius: 4, border: "1px dashed rgba(255,255,255,0.2)", background: "transparent", cursor: "pointer", fontSize: 10, fontFamily: "'Oswald', sans-serif", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", transition: "all 0.15s" }}
                  title="Add another period video"
                >
                  + Add Video
                </button>
              </div>
            )}
            {/* Video Player area */}
            <div className="relative" style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
              {/* Mux player — when playback_id exists */}
              {upload?.playback_id && (
                <VideoPlayer
                  ref={videoPlayerRef}
                  playbackId={upload.playback_id}
                  onTimeUpdate={handleTimeUpdate}
                  startTime={startTime}
                />
              )}
              {/* YouTube/Vimeo iframe — when external source, no playback_id */}
              {!upload?.playback_id && upload?.source_url && (upload.upload_source === "youtube" || upload.upload_source === "vimeo") && (() => {
                const embedUrl = getEmbedUrl(upload.source_url, upload.upload_source);
                return embedUrl ? (
                  <iframe
                    src={embedUrl}
                    allow="autoplay; fullscreen; picture-in-picture"
                    allowFullScreen
                    style={{ width: "100%", height: "100%", border: "none" }}
                  />
                ) : (
                  <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#0A1929" }}>
                    <a
                      href={upload.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 600, fontSize: 13, color: "#0D9488", textDecoration: "none", textTransform: "uppercase", letterSpacing: "0.08em" }}
                    >
                      Could not embed video — click to open ↗
                    </a>
                  </div>
                );
              })()}
              {/* Generic external link — no embed possible */}
              {!upload?.playback_id && upload?.source_url && upload.upload_source === "external_link" && (
                <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#0A1929" }}>
                  <a
                    href={upload.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 600, fontSize: 13, color: "#0D9488", textDecoration: "none", textTransform: "uppercase", letterSpacing: "0.08em" }}
                  >
                    External video — click to open ↗
                  </a>
                </div>
              )}
              {/* Video platform import — external placeholder */}
              {!upload?.playback_id && !upload?.source_url && session.source_type === "instat_url" && session.source_url && (
                <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#0A1929" }}>
                  <div style={{ textAlign: "center", maxWidth: 340, padding: "24px 16px" }}>
                    <Film size={32} style={{ color: "#14B8A8", margin: "0 auto 12px" }} />
                    {session.match_title && (
                      <p style={{ fontSize: 15, fontFamily: "'Oswald', sans-serif", fontWeight: 600, color: "#FFFFFF", letterSpacing: "0.04em", margin: "0 0 4px" }}>
                        {session.match_title}
                      </p>
                    )}
                    {session.match_date && (
                      <p style={{ fontSize: 11, fontFamily: "'JetBrains Mono', ui-monospace, monospace", color: "rgba(255,255,255,0.4)", margin: "0 0 16px" }}>
                        {session.match_date}
                      </p>
                    )}
                    <a
                      href={session.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 18px", borderRadius: 6,
                        fontSize: 11, fontFamily: "'Oswald', sans-serif", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase",
                        color: "#FFFFFF", background: "#0D9488", textDecoration: "none", cursor: "pointer",
                      }}
                    >
                      Open Video Platform ↗
                    </a>
                    <p style={{ fontSize: 10, fontFamily: "'JetBrains Mono', ui-monospace, monospace", color: "rgba(255,255,255,0.25)", marginTop: 12 }}>
                      Clips imported from external platform — click above to view video
                    </p>
                  </div>
                </div>
              )}
              {/* No video at all */}
              {!upload?.playback_id && !upload?.source_url && session.source_type !== "instat_url" && (
                <VideoPlayer
                  ref={videoPlayerRef}
                  playbackId={null}
                  onTimeUpdate={handleTimeUpdate}
                  startTime={startTime}
                />
              )}
              {/* Speed overlay badge */}
              {upload?.playback_id && playbackSpeed !== 1 && (
                <span
                  className="absolute top-3 left-3 z-10 px-2 py-1 rounded-md text-white font-bold"
                  style={{ fontSize: 11, fontFamily: "ui-monospace, monospace", background: "#0D9488" }}
                >
                  {playbackSpeed}x
                </span>
              )}
              {/* Recording dot — top-right of video area, visible only when code tagging active */}
              {codeTagging && (
                <>
                  <style>{`@keyframes recDotBlink { 0%,100%{opacity:1} 50%{opacity:0.2} }`}</style>
                  <span
                    style={{ position: "absolute", top: 10, right: 12, zIndex: 10, width: 8, height: 8, borderRadius: "50%", background: "#EF4444", display: "block", animation: "recDotBlink 1.2s infinite" }}
                  />
                </>
              )}
              {/* Score badge — bottom-left of video area */}
              {!cinemaMode && (
                <div style={{ position: "absolute", bottom: 12, left: 14, zIndex: 10, background: "rgba(6,14,26,0.85)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "5px 10px", display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <button
                      onClick={() => setHomeScore((s) => s + 1)}
                      onContextMenu={(e) => { e.preventDefault(); setHomeScore((s) => Math.max(0, s - 1)); }}
                      style={{ fontSize: 18, fontFamily: "'Oswald', sans-serif", fontWeight: 700, color: "#FFFFFF", background: "none", border: "none", cursor: "pointer", padding: "0 4px", lineHeight: 1, minWidth: 20, textAlign: "center" }}
                      title="Click +1 / Right-click -1"
                    >
                      {homeScore}
                    </button>
                    <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontWeight: 700 }}>–</span>
                    <button
                      onClick={() => setAwayScore((s) => s + 1)}
                      onContextMenu={(e) => { e.preventDefault(); setAwayScore((s) => Math.max(0, s - 1)); }}
                      style={{ fontSize: 18, fontFamily: "'Oswald', sans-serif", fontWeight: 700, color: "#FFFFFF", background: "none", border: "none", cursor: "pointer", padding: "0 4px", lineHeight: 1, minWidth: 20, textAlign: "center" }}
                      title="Click +1 / Right-click -1"
                    >
                      {awayScore}
                    </button>
                  </div>
                  <span style={{ fontSize: 9, fontFamily: "'Oswald', sans-serif", fontWeight: 600, color: "rgba(255,255,255,0.35)", letterSpacing: "0.08em", textTransform: "uppercase" }}>{currentPeriod}</span>
                </div>
              )}
              {/* Telestration canvas overlay */}
              <TelestrationCanvas
                ref={telestrationRef}
                active={drawMode}
                tool={drawTool}
                color={drawColor}
                lineWidth={drawLineWidth}
                opacity={0.9}
                fadeAfterMs={drawFade ? 4000 : 0}
                onAnnotationSave={handleAnnotationSave}
                style={{
                  position: "absolute",
                  top: 0, left: 0,
                  width: "100%", height: "100%",
                  pointerEvents: drawMode ? "all" : "none",
                  zIndex: 10,
                }}
              />
              {/* Floating draw toolbar */}
              {drawMode && (
                <div style={{ position: "absolute", top: 12, right: 12, zIndex: 20, background: "rgba(7,14,26,0.92)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", padding: 8, display: "flex", flexDirection: "column", gap: 8 }}>
                  {/* Tool selector */}
                  <div style={{ display: "flex", gap: 3 }}>
                    {([
                      { key: "arrow" as const, icon: <ArrowUpRight size={14} /> },
                      { key: "circle" as const, icon: <Circle size={14} /> },
                      { key: "freehand" as const, icon: <PenLine size={14} /> },
                      { key: "line" as const, icon: <Minus size={14} /> },
                      { key: "text" as const, icon: <Type size={14} /> },
                      { key: "eraser" as const, icon: <Eraser size={14} /> },
                    ]).map((t) => (
                      <button
                        key={t.key}
                        onClick={() => setDrawTool(t.key)}
                        style={{
                          width: 28, height: 28,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          borderRadius: 4, border: "none", cursor: "pointer",
                          background: drawTool === t.key ? "#00B5B8" : "rgba(255,255,255,0.06)",
                          color: drawTool === t.key ? "white" : "rgba(255,255,255,0.4)",
                        }}
                        title={t.key}
                      >
                        {t.icon}
                      </button>
                    ))}
                  </div>
                  {/* Color swatches */}
                  <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                    {["#00B5B8", "#E67E22", "#FFFFFF", "#EF4444", "#F59E0B", "#6366F1"].map((c) => (
                      <button
                        key={c}
                        onClick={() => setDrawColor(c)}
                        style={{
                          width: 18, height: 18,
                          borderRadius: "50%", border: "none", cursor: "pointer",
                          background: c,
                          outline: drawColor === c ? "2px solid white" : "none",
                          outlineOffset: drawColor === c ? 2 : 0,
                        }}
                        title={c}
                      />
                    ))}
                  </div>
                  {/* Line width */}
                  <div style={{ display: "flex", gap: 2 }}>
                    {([
                      { label: "THIN", w: 2 },
                      { label: "MED", w: 4 },
                      { label: "THICK", w: 7 },
                    ]).map((lw) => (
                      <button
                        key={lw.label}
                        onClick={() => setDrawLineWidth(lw.w)}
                        style={{
                          flex: 1, padding: "3px 6px", borderRadius: 4, border: "none", cursor: "pointer",
                          fontSize: 9, fontFamily: "'Oswald', sans-serif", fontWeight: 700, letterSpacing: "0.06em",
                          color: drawLineWidth === lw.w ? "#FFFFFF" : "rgba(255,255,255,0.35)",
                          background: drawLineWidth === lw.w ? "#0D9488" : "rgba(255,255,255,0.04)",
                        }}
                      >
                        {lw.label}
                      </button>
                    ))}
                  </div>
                  {/* Fade toggle + Clear + Save */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={drawFade}
                        onChange={(e) => setDrawFade(e.target.checked)}
                        style={{ accentColor: "#00B5B8" }}
                      />
                      <span style={{ fontSize: 9, fontFamily: "'JetBrains Mono', ui-monospace, monospace", color: "rgba(255,255,255,0.5)" }}>Auto-fade 4s</span>
                    </label>
                    <div style={{ display: "flex", gap: 3 }}>
                      <button
                        onClick={() => telestrationRef.current?.clear()}
                        style={{
                          flex: 1, padding: "3px 7px", borderRadius: 4, border: "none", cursor: "pointer",
                          fontSize: 9, fontFamily: "'Oswald', sans-serif", fontWeight: 700, letterSpacing: "0.06em",
                          color: "rgba(255,255,255,0.5)", background: "rgba(255,255,255,0.06)",
                        }}
                      >
                        CLEAR ✕
                      </button>
                      <button
                        onClick={() => {
                          const dataUrl = telestrationRef.current?.getDataUrl();
                          if (dataUrl) handleAnnotationSave(dataUrl);
                        }}
                        style={{
                          flex: 1, padding: "3px 7px", borderRadius: 4, border: "none", cursor: "pointer",
                          fontSize: 9, fontFamily: "'Oswald', sans-serif", fontWeight: 700, letterSpacing: "0.06em",
                          color: "white", background: "#E67E22",
                        }}
                      >
                        SAVE ↓
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Transport bar — Mark In/Out + Frame step + Speed + Cinema */}
            {upload?.playback_id && (
              <div style={{ flexShrink: 0, borderTop: "1px solid rgba(255,255,255,0.07)", background: "#0D2037" }}>
                {/* Row 1 — Mark In / timestamps / Mark Out / title / Save */}
                <div className="flex flex-wrap items-center gap-2 px-3 py-2">
                  {/* Mark In */}
                  <button
                    onClick={() => setClipStart(Math.floor(currentTimeRef.current))}
                    style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", borderRadius: 5, fontSize: 10, fontFamily: "'Oswald', sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#14B8A8", background: "rgba(13,148,136,0.18)", border: "1px solid rgba(13,148,136,0.35)", cursor: "pointer" }}
                  >
                    <Scissors size={11} />
                    In
                  </button>
                  <span
                    style={{ fontSize: 11, fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontWeight: 700, color: clipStart !== null ? "#14B8A8" : "rgba(255,255,255,0.2)", minWidth: 40 }}
                  >
                    {clipStart !== null ? formatTimestamp(clipStart) : "--:--"}
                  </span>

                  {/* Mark Out */}
                  <button
                    onClick={() => setClipEnd(Math.floor(currentTimeRef.current))}
                    style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", borderRadius: 5, fontSize: 10, fontFamily: "'Oswald', sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#E67E22", background: "rgba(230,126,34,0.13)", border: "1px solid rgba(230,126,34,0.3)", cursor: "pointer" }}
                  >
                    <Scissors size={11} />
                    Out
                  </button>
                  <span
                    style={{ fontSize: 11, fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontWeight: 700, color: clipEnd !== null ? "#14B8A8" : "rgba(255,255,255,0.2)", minWidth: 40 }}
                  >
                    {clipEnd !== null ? formatTimestamp(clipEnd) : "--:--"}
                  </span>

                  {/* Divider */}
                  <span style={{ width: 1, height: 14, background: "rgba(255,255,255,0.1)" }} />

                  {/* Title input */}
                  <input
                    type="text"
                    value={clipTitle}
                    onChange={(e) => setClipTitle(e.target.value)}
                    placeholder="Clip title..."
                    style={{ flex: 1, minWidth: 80, padding: "4px 8px", borderRadius: 5, fontSize: 11, fontFamily: "'JetBrains Mono', ui-monospace, monospace", color: "#FFFFFF", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", outline: "none" }}
                  />

                  {/* Coaching Note */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 80 }}>
                    <label style={{ fontSize: 8, fontFamily: "'Oswald', sans-serif", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)" }}>Coaching Note</label>
                    <textarea
                      value={clipCoachingNote}
                      onChange={(e) => setClipCoachingNote(e.target.value.slice(0, 500))}
                      placeholder="Add a coaching note for this player..."
                      maxLength={500}
                      rows={2}
                      style={{ width: "100%", padding: "4px 8px", borderRadius: 5, fontSize: 11, fontFamily: "'JetBrains Mono', ui-monospace, monospace", color: "#FFFFFF", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", outline: "none", resize: "none" }}
                    />
                  </div>

                  {/* Save Clip */}
                  <button
                    onClick={handleSaveClip}
                    disabled={clipStart === null || clipEnd === null || savingClip}
                    style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 5, fontSize: 9, fontFamily: "'Oswald', sans-serif", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: clipStart !== null && clipEnd !== null && !savingClip ? "#FFFFFF" : "rgba(255,255,255,0.3)", background: clipStart !== null && clipEnd !== null && !savingClip ? "#0D9488" : "rgba(255,255,255,0.05)", border: "none", cursor: clipStart !== null && clipEnd !== null && !savingClip ? "pointer" : "not-allowed" }}
                  >
                    {savingClip ? (
                      <Loader2 size={11} className="animate-spin" />
                    ) : (
                      <Save size={11} />
                    )}
                    Save
                  </button>
                </div>

                {/* Row 2 — Frame step + Speed buttons */}
                <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                  {/* Frame stepping */}
                  <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                    <button
                      onClick={() => videoPlayerRef.current?.seekBy(-5)}
                      style={{ padding: "3px 6px", borderRadius: 4, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "rgba(255,255,255,0.5)", cursor: "pointer" }}
                      title="Back 5s"
                    >
                      <Rewind size={11} />
                    </button>
                    <button
                      onClick={() => videoPlayerRef.current?.seekBy(-0.033)}
                      style={{ padding: "3px 6px", borderRadius: 4, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "rgba(255,255,255,0.5)", cursor: "pointer" }}
                      title="Back 1 frame"
                    >
                      <SkipBack size={11} />
                    </button>
                    <button
                      onClick={() => videoPlayerRef.current?.seekBy(0.033)}
                      style={{ padding: "3px 6px", borderRadius: 4, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "rgba(255,255,255,0.5)", cursor: "pointer" }}
                      title="Forward 1 frame"
                    >
                      <SkipForward size={11} />
                    </button>
                    <button
                      onClick={() => videoPlayerRef.current?.seekBy(5)}
                      style={{ padding: "3px 6px", borderRadius: 4, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "rgba(255,255,255,0.5)", cursor: "pointer" }}
                      title="Forward 5s"
                    >
                      <FastForward size={11} />
                    </button>
                  </div>

                  {/* Playback speed */}
                  <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <Gauge size={11} style={{ color: "rgba(255,255,255,0.3)" }} />
                    {[0.25, 0.5, 1, 2, 4].map((rate) => (
                      <button
                        key={rate}
                        onClick={() => handleSpeedChange(rate)}
                        style={{
                          padding: "3px 7px",
                          borderRadius: 4,
                          fontSize: 9,
                          fontFamily: "'Oswald', sans-serif",
                          fontWeight: 700,
                          letterSpacing: "0.06em",
                          color: playbackSpeed === rate ? "#FFFFFF" : "rgba(255,255,255,0.35)",
                          background: playbackSpeed === rate ? "#0D9488" : "rgba(255,255,255,0.04)",
                          border: "none",
                          cursor: "pointer",
                        }}
                        title={`${rate}x speed`}
                      >
                        {rate}x
                      </button>
                    ))}
                  </div>

                  {/* Draw mode toggle */}
                  <button
                    onClick={() => {
                      setDrawMode(prev => {
                        if (!prev) videoPlayerRef.current?.pause();
                        return !prev;
                      });
                    }}
                    style={{
                      display: "flex", alignItems: "center", gap: 4,
                      padding: "10px 20px", borderRadius: 4,
                      background: drawMode ? "#0B7C75" : "#0D9488",
                      border: `1px solid ${drawMode ? "#0B7C75" : "#0D9488"}`,
                      color: "#FFFFFF",
                      cursor: "pointer", fontSize: 10,
                      fontFamily: "'Oswald', sans-serif",
                      fontWeight: 600, letterSpacing: "0.08em",
                      textTransform: "uppercase" as const,
                    }}
                  >
                    <PenLine size={12} />
                    DRAW
                  </button>
                </div>
              </div>
            )}

          </div>

          {/* ── COL 3 — Clips Panel + Reels + Comments ─────────── */}
          <div style={{ gridColumn: 3, gridRow: 1, background: "#0A1929", borderLeft: "1px solid rgba(255,255,255,0.07)", display: "flex", flexDirection: "column", overflow: "hidden", transition: "opacity 0.3s ease", opacity: cinemaMode ? 0 : 1, pointerEvents: cinemaMode ? "none" : "auto" }}>
            {/* ── Right Panel Tab Bar ── */}
            <div style={{ width: "100%", background: "#0F2942", display: "flex", borderBottom: "1px solid #1E3A5F", flexShrink: 0 }}>
              {(["clips", "reels", "pxi", "info"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setRightTab(tab)}
                  style={{
                    flex: 1, padding: "10px 0", textAlign: "center",
                    fontFamily: "'Oswald', sans-serif", fontSize: 12, fontWeight: 600,
                    letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer",
                    background: "transparent", border: "none",
                    borderBottom: rightTab === tab ? "2px solid #0D9488" : "2px solid transparent",
                    color: rightTab === tab ? "#0D9488" : "#94A3B8",
                  }}
                >
                  {tab.toUpperCase()}
                  {tab === "clips" && clipCount > 0 && <span style={{ marginLeft: 4, fontSize: 10, opacity: 0.7 }}>({clipCount})</span>}
                  {tab === "reels" && sessionReels.length > 0 && <span style={{ marginLeft: 4, fontSize: 10, opacity: 0.7 }}>({sessionReels.length})</span>}
                  {tab === "pxi" && generatedReport && <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "#0D9488", marginLeft: 5, verticalAlign: "middle" }} />}
                </button>
              ))}
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: 6, display: "flex", flexDirection: "column", gap: 6 }}>
              {/* ── INFO TAB ── */}
              {rightTab === "info" && (
              <>
              {/* Session info — compact */}
              <div style={{ background: "#0D2037", borderRadius: 6, overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 10px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#14B8A8" }} />
                    <span style={{ fontSize: 8, fontFamily: "'Oswald', sans-serif", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.6)" }}>SESSION</span>
                  </div>
                  <span style={{ fontSize: 8, fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(255,255,255,0.5)", background: "rgba(13,148,136,0.2)", borderRadius: 3, padding: "1px 4px" }}>
                    {SESSION_TYPE_LABELS[session.session_type] || session.session_type}
                  </span>
                </div>
                <div style={{ padding: "6px 10px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontFamily: "'JetBrains Mono', ui-monospace, monospace", color: "rgba(255,255,255,0.4)" }}>
                    <span>{formatDate(session.created_at)}</span>
                    <span style={{ color: "rgba(255,255,255,0.15)" }}>·</span>
                    <span style={{ textTransform: "capitalize" }}>{session.status || "active"}</span>
                  </div>
                  {session.description && (
                    <p style={{ fontSize: 12, marginTop: 3, color: "rgba(255,255,255,0.6)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={session.description}>{session.description}</p>
                  )}
                </div>
              </div>

              {/* Import Event Data */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".xml,.csv"
                onChange={handleFileSelected}
                className="hidden"
              />
              {/* Import Event Data — always visible so coaches can add XML events to any session */}
                <div style={{ background: "#0D2037", borderRadius: 6, overflow: "hidden" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 10px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#14B8A8" }} />
                    <span style={{ fontSize: 8, fontFamily: "'Oswald', sans-serif", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.6)" }}>IMPORT EVENTS</span>
                  </div>
                  <div style={{ padding: "8px 10px" }}>
                    {importingEvents ? (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "6px 0" }}>
                        <Loader2 size={12} className="animate-spin" style={{ color: "#14B8A8" }} />
                        <span style={{ fontSize: 9, fontFamily: "'Oswald', sans-serif", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.5)" }}>Importing...</span>
                      </div>
                    ) : showReplaceConfirm ? (
                      <div>
                        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", marginBottom: 6 }}>Replace existing events?</p>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button
                            onClick={() => {
                              if (pendingImportFile) executeEventImport(pendingImportFile, true);
                            }}
                            style={{ flex: 1, padding: "4px 8px", borderRadius: 4, fontSize: 9, fontFamily: "'Oswald', sans-serif", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "#FFFFFF", background: "#EA580C", border: "none", cursor: "pointer" }}
                          >
                            Replace
                          </button>
                          <button
                            onClick={() => { setShowReplaceConfirm(false); setPendingImportFile(null); }}
                            style={{ padding: "4px 8px", borderRadius: 4, fontSize: 9, fontFamily: "'Oswald', sans-serif", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.5)", background: "transparent", border: "none", cursor: "pointer" }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        {importResult && (
                          <div style={{ marginBottom: 6, fontSize: 12, borderRadius: 4, padding: "4px 8px", color: "#14B8A8", background: "rgba(13,148,136,0.1)" }}>
                            Imported {importResult.events_created} events, {importResult.clips_created} clips
                            {importResult.player_matches > 0 && ` · ${importResult.player_matches} matched`}
                            {importResult.unmatched_players.length > 0 && (
                              <span style={{ display: "block", marginTop: 2, color: "rgba(255,255,255,0.4)" }}>
                                Unmatched: {importResult.unmatched_players.slice(0, 5).join(", ")}
                                {importResult.unmatched_players.length > 5 && ` +${importResult.unmatched_players.length - 5} more`}
                              </span>
                            )}
                          </div>
                        )}
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 4, padding: "6px 8px", borderRadius: 4, fontSize: 9, fontFamily: "'Oswald', sans-serif", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", background: "transparent", border: "1px dashed rgba(255,255,255,0.15)", cursor: "pointer" }}
                        >
                          {session?.event_data_source ? (
                            <>
                              <RefreshCw size={10} />
                              Re-import
                            </>
                          ) : (
                            <>
                              <Upload size={10} />
                              Import Event Data
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

              </>
              )}

              {/* ── CLIPS TAB ── */}
              {rightTab === "clips" && (
              <>
              {/* Clip Panel — props unchanged */}
              <ClipPanel
                sessionId={sessionId}
                uploadId={upload?.id || ""}
                getCurrentTime={getCurrentTime}
                refreshKey={clipRefreshKey}
                uploads={uploads}
                onPeriodSwitch={handleClipPeriodSwitch}
                onClipCountChange={setClipCount}
              />

              {/* Annotation Thumbnails — shown when active clip has annotations */}
              {activeClipId && clipAnnotations.length > 0 && (
                <div style={{ background: "#0D2037", borderRadius: 6, overflow: "hidden" }}>
                  <div style={{ padding: "6px 10px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <span style={{ fontSize: 9, fontFamily: "'Oswald', sans-serif", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)" }}>ANNOTATIONS</span>
                  </div>
                  <div style={{ padding: "6px 8px", display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {clipAnnotations.map((ann) => (
                      <div
                        key={ann.id}
                        style={{ position: "relative", cursor: "pointer" }}
                        onClick={() => setAnnotationPreview(ann.r2_url)}
                        title={`${Math.floor(ann.timestamp_seconds / 60)}:${String(Math.floor(ann.timestamp_seconds % 60)).padStart(2, "0")}`}
                      >
                        <img
                          src={ann.r2_url}
                          alt={`Annotation at ${Math.floor(ann.timestamp_seconds / 60)}:${String(Math.floor(ann.timestamp_seconds % 60)).padStart(2, "0")}`}
                          style={{ width: 80, height: 45, objectFit: "cover", borderRadius: 4, border: "1px solid rgba(255,255,255,0.1)" }}
                        />
                        <span style={{ position: "absolute", bottom: 2, right: 3, fontSize: 8, fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontWeight: 700, color: "white", background: "rgba(0,0,0,0.7)", borderRadius: 2, padding: "0 3px" }}>
                          {Math.floor(ann.timestamp_seconds / 60)}:{String(Math.floor(ann.timestamp_seconds % 60)).padStart(2, "0")}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Annotation full-size preview modal */}
              {annotationPreview && (
                <div
                  onClick={() => setAnnotationPreview(null)}
                  style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                >
                  <img
                    src={annotationPreview}
                    alt="Annotation preview"
                    style={{ maxWidth: "90vw", maxHeight: "90vh", borderRadius: 8, border: "2px solid rgba(255,255,255,0.15)" }}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              )}

              </>
              )}

              {/* ── REELS TAB ── */}
              {rightTab === "reels" && (
              <>
              {/* Reels Section */}
              {sessionReels.length > 0 ? (
                <div style={{ background: "#0D2037", borderRadius: 6, overflow: "hidden" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 10px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#EA580C" }} />
                    <Film size={10} style={{ color: "#EA580C" }} />
                    <span style={{ fontSize: 8, fontFamily: "'Oswald', sans-serif", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.6)" }}>REELS</span>
                    <span style={{ fontSize: 8, fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontWeight: 700, background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)", borderRadius: 3, padding: "0 4px" }}>{sessionReels.length}</span>
                  </div>
                  <div style={{ padding: "4px 6px" }}>
                    {sessionReels.map((reel) => (
                      <div key={reel.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                        <Link
                          href={`/reels/${reel.id}`}
                          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 6px", borderRadius: 4, textDecoration: "none", transition: "background 0.15s" }}
                          className="hover:bg-white/[0.03]"
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 0 }}>
                            <Film size={9} style={{ color: "#EA580C", flexShrink: 0 }} />
                            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{reel.title}</span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                            <span style={{ fontSize: 8, fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontWeight: 700, textTransform: "uppercase", background: reel.status === "ready" ? "rgba(13,148,136,0.15)" : reel.status === "shared" ? "rgba(234,88,12,0.15)" : "rgba(255,255,255,0.06)", color: reel.status === "ready" ? "#14B8A8" : reel.status === "shared" ? "#EA580C" : "rgba(255,255,255,0.4)", borderRadius: 3, padding: "0 4px" }}>
                              {reel.status}
                            </span>
                            <span style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 9, color: "rgba(255,255,255,0.3)" }}>
                              {reel.clip_count} clip{reel.clip_count !== 1 ? "s" : ""}
                            </span>
                          </div>
                        </Link>
                        {/* Share row */}
                        <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "3px 6px 4px", marginLeft: 14 }}>
                          {/* Share toggle */}
                          <button
                            onClick={async () => {
                              try {
                                const res = await api.patch(`/highlight-reels/${reel.id}/share`, { share_enabled: !reel.share_enabled });
                                setSessionReels((prev) => prev.map((r) => r.id === reel.id ? { ...r, share_enabled: res.data.share_enabled, share_token: res.data.share_token } : r));
                              } catch { toast.error("Failed to update share"); }
                            }}
                            style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", minHeight: 28, borderRadius: 4, fontSize: 11, fontFamily: "'Oswald', sans-serif", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#FFFFFF", background: reel.share_enabled ? "#0F2942" : "#14B8A8", border: reel.share_enabled ? "1px solid #14B8A8" : "1px solid transparent", cursor: "pointer" }}
                          >
                            {reel.share_enabled ? "Share On" : "Share Off"}
                          </button>
                          {/* Copy link + Regenerate — only when share_enabled */}
                          {reel.share_enabled && reel.share_token && (
                            <>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(`https://www.prospectxintelligence.com/reel/${reel.share_token}`).then(() => {
                                    setCopiedReelId(reel.id);
                                    setTimeout(() => setCopiedReelId(null), 2000);
                                  }).catch(() => toast.error("Failed to copy"));
                                }}
                                style={{ padding: "4px 10px", minHeight: 28, borderRadius: 4, fontSize: 11, fontFamily: "'Oswald', sans-serif", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#FFFFFF", background: copiedReelId === reel.id ? "#0F2942" : "#14B8A8", border: copiedReelId === reel.id ? "1px solid #14B8A8" : "1px solid transparent", cursor: "pointer" }}
                              >
                                {copiedReelId === reel.id ? "Copied!" : "Copy Link"}
                              </button>
                              <button
                                onClick={async () => {
                                  try {
                                    const res = await api.patch(`/highlight-reels/${reel.id}/share`, { regenerate_token: true });
                                    setSessionReels((prev) => prev.map((r) => r.id === reel.id ? { ...r, share_token: res.data.share_token } : r));
                                    toast.success("New link generated");
                                  } catch { toast.error("Failed to regenerate"); }
                                }}
                                style={{ padding: 0, border: "none", background: "transparent", fontSize: 8, fontFamily: "'JetBrains Mono', ui-monospace, monospace", color: "rgba(255,255,255,0.25)", cursor: "pointer", textDecoration: "underline" }}
                              >
                                Regenerate
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ background: "#0D2037", borderRadius: 6, padding: "16px 10px", textAlign: "center" }}>
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", margin: "0 0 8px" }}>No reels yet</p>
                  <button
                    onClick={() => setShowReelBuilder(true)}
                    style={{ padding: "8px 16px", borderRadius: 5, border: "none", cursor: "pointer", fontSize: 11, fontFamily: "'Oswald', sans-serif", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", background: "#0D9488", color: "#FFFFFF" }}
                  >
                    Build Reel
                  </button>
                </div>
              )}
              </>
              )}

              {/* ── PXI TAB ── */}
              {rightTab === "pxi" && (
              <>
              {/* PXI Report Display — moved from Col 2 for accessibility */}
              {generating && (
                <div style={{ background: "#0D2037", borderRadius: 6, padding: "12px 10px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    <Loader2 size={16} className="animate-spin" style={{ color: "#14B8A8" }} />
                    <span style={{ fontSize: 12, fontFamily: "'Oswald', sans-serif", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.5)" }}>Generating analysis...</span>
                  </div>
                </div>
              )}

              {generatedReport && !generating && (
                <div style={{ background: "#0D2037", borderRadius: 6, overflow: "hidden" }}>
                  <button
                    onClick={toggleReportExpanded}
                    style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 10px", background: "#0D2037", border: "none", borderBottom: "1px solid rgba(255,255,255,0.05)", cursor: "pointer" }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#F97316" }} />
                      <Sparkles size={10} style={{ color: "#F97316" }} />
                      <span style={{ fontSize: 8, fontFamily: "'Oswald', sans-serif", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#FFFFFF" }}>
                        {generatedReport.title}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowTypeSelector(true);
                          setPendingReportType(null);
                        }}
                        style={{ display: "flex", alignItems: "center", gap: 3, padding: "1px 5px", borderRadius: 3, fontSize: 8, fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#14B8A8", background: "rgba(13,148,136,0.15)", border: "none", cursor: "pointer" }}
                        title="Regenerate with a different report type"
                      >
                        <RefreshCw size={8} />
                        Redo
                      </button>
                      <ChevronDown
                        size={12}
                        style={{ color: "rgba(255,255,255,0.4)", transition: "transform 0.3s ease", transform: reportExpanded ? "rotate(0deg)" : "rotate(-90deg)" }}
                      />
                    </div>
                  </button>
                  <div
                    style={{
                      maxHeight: reportExpanded ? 400 : 0,
                      overflow: "auto",
                      transition: "max-height 0.3s ease",
                    }}
                  >
                    <div style={{ padding: "8px 10px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                      <div className="flex justify-end mb-2">
                        <ListenButton text={generatedReport.output_text || ""} label="Listen" />
                      </div>
                      <div style={{ paddingLeft: 10, fontSize: 12, lineHeight: 1.6, whiteSpace: "pre-wrap", color: "rgba(255,255,255,0.8)", borderLeft: "2px solid #0D9488" }}>
                        {generatedReport.output_text}
                      </div>
                      <div style={{ marginTop: 8, display: "flex", justifyContent: "flex-end" }}>
                        <Link
                          href={`/reports/${generatedReport.id}`}
                          style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 9, fontFamily: "'Oswald', sans-serif", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "#14B8A8", textDecoration: "none" }}
                        >
                          <FileText size={9} />
                          View Full Report
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── P2-C2: Film Summaries for tagged players ── */}
              {filmSummaries.length > 0 && (
                <div style={{ background: "#0D2037", borderRadius: 6, overflow: "hidden" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 10px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#F97316" }} />
                    <Sparkles size={10} style={{ color: "#F97316" }} />
                    <span style={{ fontSize: 8, fontFamily: "'Oswald', sans-serif", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.6)" }}>
                      POST-GAME SUMMARIES
                    </span>
                  </div>
                  <div style={{ padding: "6px 10px" }}>
                    {filmSummaries.map((fs, idx) => (
                      <div
                        key={fs.id}
                        style={{
                          paddingBottom: idx < filmSummaries.length - 1 ? 8 : 0,
                          marginBottom: idx < filmSummaries.length - 1 ? 8 : 0,
                          borderBottom: idx < filmSummaries.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 3 }}>
                          <Users size={9} style={{ color: "#14B8A8" }} />
                          <span style={{ fontSize: 10, fontFamily: "'Oswald', sans-serif", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(255,255,255,0.8)" }}>
                            {fs.player_name}
                          </span>
                          <span style={{ fontSize: 8, fontFamily: "'JetBrains Mono', ui-monospace, monospace", color: "rgba(255,255,255,0.3)" }}>
                            {new Date(fs.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </span>
                        </div>
                        <p style={{ fontSize: 11, lineHeight: 1.5, color: "rgba(255,255,255,0.65)", margin: 0 }}>
                          {fs.summary}
                        </p>
                        <Link
                          href={`/players/${fs.player_id}?tab=player`}
                          style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 8, fontFamily: "'Oswald', sans-serif", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "#14B8A8", textDecoration: "none", marginTop: 3 }}
                        >
                          View Full Analysis
                          <ChevronRight size={8} />
                        </Link>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!generatedReport && !generating && (
                <div style={{ background: "#0D2037", borderRadius: 6, overflow: "hidden" }}>
                  <button
                    onClick={() => { setShowTypeSelector(true); setPendingReportType(null); }}
                    style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 10px", background: "#0D2037", border: "none", cursor: "pointer", borderRadius: 6 }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#F97316" }} />
                      <Sparkles size={10} style={{ color: "#F97316" }} />
                      <span style={{ fontSize: 8, fontFamily: "'Oswald', sans-serif", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.6)" }}>
                        PXI FILM ANALYSIS
                      </span>
                    </div>
                    <span style={{ fontSize: 8, fontFamily: "'Oswald', sans-serif", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "#14B8A8" }}>
                      Generate
                    </span>
                  </button>
                </div>
              )}

              </>
              )}

              {/* ── INFO TAB (continued): Comments ── */}
              {rightTab === "info" && (
              <>
              {/* Comments */}
              <div style={{ background: "#0D2037", borderRadius: 6, overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 10px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#14B8A8" }} />
                  <span style={{ fontSize: 8, fontFamily: "'Oswald', sans-serif", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.6)" }}>COMMENTS</span>
                </div>
                <div style={{ padding: "8px 10px" }}>
                  {/* Comment input */}
                  <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
                    <input
                      type="text"
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSubmitComment();
                        }
                      }}
                      placeholder="Add a comment..."
                      style={{ flex: 1, padding: "4px 8px", borderRadius: 4, fontSize: 13, color: "#FFFFFF", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", outline: "none" }}
                    />
                    <MicButton onTranscript={(t) => setCommentText((p) => (p ? p + " " + t : t))} />
                    <button
                      onClick={handleSubmitComment}
                      disabled={submittingComment || !commentText.trim()}
                      style={{ padding: "4px 8px", borderRadius: 4, background: "#0D9488", color: "#FFFFFF", border: "none", cursor: "pointer", opacity: submittingComment || !commentText.trim() ? 0.4 : 1 }}
                    >
                      {submittingComment ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Send size={12} />
                      )}
                    </button>
                  </div>

                  {/* Comment list */}
                  {comments.length === 0 ? (
                    <p style={{ fontSize: 12, textAlign: "center", padding: "10px 0", color: "rgba(255,255,255,0.3)" }}>
                      No comments yet.
                    </p>
                  ) : (
                    <div style={{ maxHeight: 200, overflowY: "auto" }}>
                      {comments.map((c) => (
                        <div
                          key={c.id}
                          style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 6, padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}
                        >
                          <div style={{ minWidth: 0 }}>
                            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", margin: 0 }}>{c.body}</p>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                              {c.timestamp_seconds !== null && (
                                <span style={{ display: "flex", alignItems: "center", gap: 2, fontSize: 9, fontFamily: "'JetBrains Mono', ui-monospace, monospace", color: "#14B8A8" }}>
                                  <Clock size={8} />
                                  {formatTimestamp(c.timestamp_seconds)}
                                </span>
                              )}
                              <span style={{ fontSize: 9, fontFamily: "'JetBrains Mono', ui-monospace, monospace", color: "rgba(255,255,255,0.3)" }}>
                                {formatDate(c.created_at)}
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => handleDeleteComment(c.id)}
                            style={{ color: "rgba(255,255,255,0.2)", background: "none", border: "none", cursor: "pointer", flexShrink: 0, marginTop: 2 }}
                            className="hover:text-red-400 transition-colors"
                            title="Delete comment"
                          >
                            <Trash2 size={10} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              </>
              )}
            </div>
          </div>

          {/* ── TIMELINE ROW — spans all 3 columns ──────────────── */}
          <div style={{ gridColumn: "1 / 4", gridRow: 2, height: 108, background: "#070F1C", borderTop: "1px solid rgba(255,255,255,0.07)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {/* Timeline header — 28px */}
            <div style={{ height: 28, display: "flex", alignItems: "center", gap: 8, padding: "5px 12px 4px", borderBottom: "1px solid rgba(255,255,255,0.04)", flexShrink: 0 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#14B8A8", flexShrink: 0 }} />
              <span style={{ fontSize: 9, fontFamily: "'Oswald', sans-serif", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.5)" }}>
                EVENT TIMELINE
              </span>
              <span style={{ fontSize: 8, fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontWeight: 700, background: "#0D9488", color: "#FFFFFF", borderRadius: 999, padding: "1px 5px" }}>
                {sessionEvents.length}
              </span>
              {/* Filter pills — reuse eventFilter state */}
              <div style={{ display: "flex", gap: 3, marginLeft: "auto" }}>
                {(["all", "offensive", "defensive", "special_teams"] as EventCategory[]).map((fv) => {
                  const label = fv === "all" ? "All" : fv === "offensive" ? "Offensive" : fv === "defensive" ? "Defensive" : "ST";
                  const active = eventFilter === fv;
                  return (
                    <button
                      key={fv}
                      onClick={() => setEventFilter(fv)}
                      style={{ padding: "2px 7px", borderRadius: 999, fontSize: 8, fontFamily: "'Oswald', sans-serif", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: active ? "#FFFFFF" : "rgba(255,255,255,0.4)", background: active ? "#0F2942" : "transparent", boxShadow: active ? "0 0 0 1px #14B8A8" : "none", border: "none", cursor: "pointer" }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Scrub area — time ruler + event tracks + playhead */}
            <div style={{ flex: 1, padding: "4px 12px 5px", position: "relative", overflow: "hidden" }}>
              {/* Time ruler — 12px height */}
              <div style={{ height: 12, position: "relative", marginBottom: 3 }}>
                {Array.from({ length: 10 }, (_, i) => {
                  const secs = (i / 10) * totalDuration;
                  const m = Math.floor(secs / 60);
                  const s = Math.floor(secs % 60);
                  const label = totalDuration > 0 ? `${m}:${s.toString().padStart(2, "0")}` : (i === 0 ? "0:00" : "—:—");
                  return (
                    <span key={i} style={{ position: "absolute", left: `calc(50px + ${(i / 10) * (100 - 0)}% * (1 - 50 / 100 / 1))`, fontSize: 8, fontFamily: "'JetBrains Mono', ui-monospace, monospace", color: "rgba(255,255,255,0.3)", transform: "translateX(-50%)", whiteSpace: "nowrap", top: 0 }}>
                      {label}
                    </span>
                  );
                })}
              </div>

              {/* Event tracks — GOALS, SHOTS, PENALTIES, TURNOVERS */}
              {(() => {
                const tracks: { key: string; label: string; match: (t: string) => boolean; color: string; filterGroup: EventCategory }[] = [
                  { key: "goals", label: "GOALS", match: (t) => t.toLowerCase().includes("goal"), color: "#0D9488", filterGroup: "offensive" },
                  { key: "shots", label: "SHOTS", match: (t) => t.toLowerCase().includes("shot") || t.toLowerCase().includes("chance"), color: "#14B8A8", filterGroup: "offensive" },
                  { key: "penalties", label: "PENALTIES", match: (t) => t.toLowerCase().includes("penalt"), color: "#E67E22", filterGroup: "special_teams" },
                  { key: "turnovers", label: "TURNOVERS", match: (t) => t.toLowerCase().includes("turnover"), color: "#6366F1", filterGroup: "defensive" },
                ];
                const visibleTracks = eventFilter === "all" ? tracks : tracks.filter((t) => t.filterGroup === eventFilter);
                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    {visibleTracks.map((track) => {
                      const trackEvents = sessionEvents.filter((ev) => track.match(ev.event_type));
                      return (
                        <div key={track.key} style={{ height: 24, position: "relative", background: "rgba(255,255,255,0.02)", borderRadius: 3 }}>
                          {/* Track label — 48px, right-aligned */}
                          <div style={{ position: "absolute", left: 0, top: 0, width: 48, height: "100%", background: "rgba(6,14,26,0.8)", borderRight: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 6, zIndex: 1, borderRadius: "3px 0 0 3px" }}>
                            <span style={{ fontSize: 11, fontFamily: "'Oswald', sans-serif", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "#6B7280" }}>{track.label}</span>
                          </div>
                          {/* Events area */}
                          <div style={{ position: "absolute", left: 50, right: 0, top: 0, bottom: 0 }}>
                            {trackEvents.map((ev) => {
                              const pct = totalDuration > 0 ? (ev.time_seconds / totalDuration) * 100 : 0;
                              const isAI = ev.source === "auto_detected";
                              const lowConf = isAI && typeof ev.confidence === "number" && ev.confidence < 0.6;
                              const baseOpacity = lowConf ? 0.7 : 0.85;
                              return (
                                <div key={ev.id} style={{ position: "absolute", left: `${pct}%`, width: "max(8px, 0.8%)", top: 0, bottom: 0 }}>
                                  <button
                                    onClick={() => setStartTime(ev.time_seconds)}
                                    title={`${isAI ? "[AI] " : ""}${ev.event_type.replace(/_/g, " ")} at ${formatTimestamp(ev.time_seconds)}`}
                                    style={{ position: "absolute", left: 0, right: 0, top: 2, bottom: 2, borderRadius: 2, background: track.color, opacity: baseOpacity, cursor: "pointer", border: "none", padding: 0, transition: "opacity 0.15s" }}
                                    onMouseEnter={(e) => { (e.target as HTMLElement).style.opacity = "1"; }}
                                    onMouseLeave={(e) => { (e.target as HTMLElement).style.opacity = String(baseOpacity); }}
                                  />
                                  {isAI && (
                                    <span style={{ position: "absolute", top: -8, left: "50%", transform: "translateX(-50%)", fontSize: 9, fontFamily: "'Oswald', sans-serif", fontWeight: 700, color: "#FFFFFF", background: "#0D9488", borderRadius: 10, padding: "2px 6px", lineHeight: 1, pointerEvents: "none", whiteSpace: "nowrap", zIndex: 2 }}>AI</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {/* Playhead — vertical line tracking current playback position */}
              <div style={{ position: "absolute", top: 0, bottom: 0, left: `calc(50px + ${playheadPct}% * (1 - 50 / 100 / 1))`, width: 1, background: "rgba(255,255,255,0.6)", zIndex: 20, pointerEvents: "none", transition: "left 0.25s linear" }}>
                {/* Triangle cap */}
                <div style={{ position: "absolute", top: 0, left: -3, width: 0, height: 0, borderLeft: "4px solid transparent", borderRight: "4px solid transparent", borderTop: "5px solid rgba(255,255,255,0.6)" }} />
              </div>

              {/* Empty state */}
              {sessionEvents.length === 0 && (
                <p style={{ fontSize: 10, textAlign: "center", padding: "6px 0", color: "rgba(255,255,255,0.25)", position: "absolute", left: 50, right: 0, top: "50%", transform: "translateY(-50%)", margin: 0 }}>
                  Tag clips to populate the timeline
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Add Video Period Modal */}
      {showAddVideoModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setShowAddVideoModal(false)}>
          <div style={{ background: "#0D2037", borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)", padding: 24, width: 340, maxWidth: "90vw" }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: 14, fontFamily: "'Oswald', sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#FFFFFF", margin: "0 0 16px" }}>
              Add Period Video
            </h3>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", margin: "0 0 12px" }}>Which period is this video for?</p>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
              {[
                { num: 1, label: "Period 1" },
                { num: 2, label: "Period 2" },
                { num: 3, label: "Period 3" },
                { num: 4, label: "OT" },
                { num: 5, label: "SO" },
              ].map((p) => {
                const taken = uploads.some((u) => u.period_number === p.num);
                return (
                  <button
                    key={p.num}
                    onClick={() => !taken && setAddVideoPeriod(p.num)}
                    disabled={taken}
                    style={{
                      padding: "6px 14px", borderRadius: 5, border: "none", cursor: taken ? "not-allowed" : "pointer",
                      fontSize: 11, fontFamily: "'Oswald', sans-serif", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase",
                      background: addVideoPeriod === p.num ? "#0D9488" : taken ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.08)",
                      color: addVideoPeriod === p.num ? "#FFF" : taken ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.6)",
                      transition: "all 0.15s",
                    }}
                  >
                    {p.label}{taken ? " ✓" : ""}
                  </button>
                );
              })}
            </div>
            {addVideoPeriod !== null && (
              <>
                <input
                  ref={addVideoFileRef}
                  type="file"
                  accept="video/*"
                  style={{ display: "none" }}
                  onChange={(e) => setAddVideoFile(e.target.files?.[0] || null)}
                />
                <button
                  onClick={() => addVideoFileRef.current?.click()}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px dashed rgba(255,255,255,0.2)", background: "transparent", cursor: "pointer", fontSize: 11, fontFamily: "'Oswald', sans-serif", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(255,255,255,0.5)", marginBottom: 12, transition: "all 0.15s" }}
                >
                  <Upload size={12} style={{ display: "inline", marginRight: 6, verticalAlign: "middle" }} />
                  {addVideoFile ? addVideoFile.name : "Select Video File"}
                </button>
              </>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button onClick={() => setShowAddVideoModal(false)} style={{ padding: "6px 14px", borderRadius: 5, border: "none", cursor: "pointer", fontSize: 10, fontFamily: "'Oswald', sans-serif", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)" }}>Cancel</button>
              <button
                onClick={handleAddVideo}
                disabled={addVideoPeriod === null || !addVideoFile || addingVideo}
                style={{ padding: "6px 14px", borderRadius: 5, border: "none", cursor: addVideoPeriod !== null && addVideoFile && !addingVideo ? "pointer" : "not-allowed", fontSize: 10, fontFamily: "'Oswald', sans-serif", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", background: addVideoPeriod !== null && addVideoFile ? "#0D9488" : "rgba(255,255,255,0.06)", color: addVideoPeriod !== null && addVideoFile ? "#FFF" : "rgba(255,255,255,0.3)", transition: "all 0.15s" }}
              >
                {addingVideo ? "Uploading..." : "Upload"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reel Builder Modal */}
      {showReelBuilder && (
        <ReelBuilder
          sessionId={sessionId}
          playerId={session?.player_id || null}
          onClose={() => setShowReelBuilder(false)}
          onCreated={() => { loadSessionReels(); setRightTab("reels"); }}
        />
      )}
    </ProtectedRoute>
  );
}
