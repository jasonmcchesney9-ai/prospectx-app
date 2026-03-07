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
  user_id: string;
  comment_text: string;
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
    // youtube.com/watch?v=X → youtube.com/embed/X
    const match = sourceUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
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
  const [savingClip, setSavingClip] = useState(false);
  const [clipRefreshKey, setClipRefreshKey] = useState(0);

  // Event data import
  const [importingEvents, setImportingEvents] = useState(false);
  const [importResult, setImportResult] = useState<{ events_created: number; clips_created: number; player_matches: number; unmatched_players: string[] } | null>(null);
  const [showReplaceConfirm, setShowReplaceConfirm] = useState(false);
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Event timeline display
  const [sessionEvents, setSessionEvents] = useState<SessionEvent[]>([]);
  const [eventFilter, setEventFilter] = useState<EventCategory>("all");

  // Cinema mode
  const [cinemaMode, setCinemaMode] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  // Reel builder modal + session reels
  const [showReelBuilder, setShowReelBuilder] = useState(false);
  const [sessionReels, setSessionReels] = useState<{ id: string; title: string; status: string; clip_count: number; created_at: string }[]>([]);

  // Video player ref for getting current time + playback control
  const videoPlayerRef = useRef<VideoPlayerHandle>(null);
  const currentTimeRef = useRef<number>(0);

  const getCurrentTime = useCallback(() => currentTimeRef.current, []);

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

        // Use the upload linked to this session (returned inline from the backend)
        if (sessionData.upload) {
          const u = sessionData.upload;
          setUpload({
            id: u.id,
            playback_id: u.mux_playback_id || u.playback_id || null,
            status: u.status,
            title: u.title,
            upload_source: u.upload_source,
            source_url: u.source_url,
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
            all.map((r: { id: string; title: string; status: string; clip_ids?: string | string[]; created_at: string }) => ({
              id: r.id,
              title: r.title,
              status: r.status || "draft",
              clip_count: Array.isArray(r.clip_ids) ? r.clip_ids.length : 0,
              created_at: r.created_at,
            }))
          );
        } catch {
          // Reels may not exist yet
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
        all.map((r: { id: string; title: string; status: string; clip_ids?: string | string[]; created_at: string }) => ({
          id: r.id,
          title: r.title,
          status: r.status || "draft",
          clip_count: Array.isArray(r.clip_ids) ? r.clip_ids.length : 0,
          created_at: r.created_at,
        }))
      );
    } catch { /* */ }
  }, []);

  const loadSessionEvents = useCallback(async () => {
    try {
      const res = await api.get(`/film/events`, { params: { session_id: sessionId, limit: 500 } });
      const events = Array.isArray(res.data) ? res.data : [];
      setSessionEvents(events);
    } catch {
      // Silently fail on events load
    }
  }, [sessionId]);

  const handleSubmitComment = useCallback(async () => {
    if (!commentText.trim()) return;
    setSubmittingComment(true);
    try {
      await api.post(`/film/sessions/${sessionId}/comments`, {
        comment_text: commentText.trim(),
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
        toast.success("Report generated!");

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
            try { localStorage.setItem(`film_analysis_expanded_${sessionId}`, "true"); } catch { /* */ }
          }
        } catch {
          // Fallback: still show success
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
      await api.post("/film/clips", {
        title: clipTitle.trim() || `Clip ${formatTimestamp(clipStart)}–${formatTimestamp(clipEnd)}`,
        session_id: sessionId,
        upload_id: upload?.id || null,
        start_time_seconds: clipStart,
        end_time_seconds: clipEnd,
        clip_type: "manual",
      });
      toast.success("Clip saved");
      setClipStart(null);
      setClipEnd(null);
      setClipTitle("");
      setClipRefreshKey((k) => k + 1);
    } catch {
      toast.error("Failed to save clip");
    } finally {
      setSavingClip(false);
    }
  }, [clipStart, clipEnd, clipTitle, sessionId, upload]);

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
            {upload && (upload.upload_source === "youtube" || upload.upload_source === "vimeo" || upload.upload_source === "external_link") && (
              <span
                style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 600, fontSize: 8, background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)", borderRadius: 3, padding: "1px 5px", textTransform: "uppercase", letterSpacing: "0.05em" }}
              >
                EXTERNAL
              </span>
            )}
            <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono', ui-monospace, monospace", color: "rgba(255,255,255,0.35)" }}>
              {formatDate(session.created_at)}
            </span>
          </div>

          {/* Generate Analysis + Build Reel buttons */}
          <div className="relative" style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            <button
              onClick={() => setShowReelBuilder(true)}
              style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 5, fontSize: 9, fontFamily: "'Oswald', sans-serif", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", background: "rgba(234,88,12,0.15)", color: "#E67E22", border: "1px solid rgba(234,88,12,0.25)", cursor: "pointer" }}
            >
              <Film size={10} />
              Build Reel
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
              onClick={() => setCinemaMode(!cinemaMode)}
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
          <div style={{ gridColumn: 1, gridRow: 1, background: "#0A1929", borderRight: "1px solid rgba(255,255,255,0.07)", display: "flex", flexDirection: "column", overflow: "hidden", transition: "opacity 0.3s ease", opacity: cinemaMode ? 0 : 1 }}>
            {/* Code Window header — 34px, #0A1929 */}
            <div style={{ height: 34, padding: "0 10px", background: "#0A1929", borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#14B8A8" }} />
                <span style={{ fontSize: 10, fontFamily: "'Oswald', sans-serif", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#14B8A8" }}>
                  CODE WINDOW
                </span>
              </div>
              <span style={{ fontSize: 9, fontFamily: "'Oswald', sans-serif", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#14B8A8", background: "rgba(13,148,136,0.15)", border: "1px solid rgba(13,148,136,0.25)", borderRadius: 999, padding: "2px 8px" }}>
                REVIEW
              </span>
            </div>
            {/* EventTagger — props unchanged */}
            <div style={{ flex: 1, overflow: "auto", padding: 6 }}>
              {upload?.playback_id && (
                <EventTagger
                  sessionId={sessionId}
                  uploadId={upload.id}
                  getCurrentTime={getCurrentTime}
                  cinemaMode={cinemaMode}
                />
              )}
            </div>
            {/* Code Window footer — recording state + keyboard hints */}
            <div style={{ padding: "6px 8px", borderTop: "1px solid rgba(255,255,255,0.07)", background: "#0A1929", flexShrink: 0 }}>
              {/* TODO: Replace static "Recording: none" with active tag name when recording state is added */}
              <p style={{ fontSize: 9, fontFamily: "'JetBrains Mono', monospace", color: "rgba(255,255,255,0.45)", margin: "0 0 3px 0" }}>
                Recording: <span style={{ color: "rgba(255,255,255,0.28)" }}>none</span>
              </p>
              <p style={{ fontSize: 9, fontFamily: "'JetBrains Mono', monospace", color: "rgba(255,255,255,0.28)", whiteSpace: "nowrap", margin: 0 }}>
                1–9: Tag · Space: Play · N/P: Clips
              </p>
            </div>
          </div>

          {/* ── COL 2 — Video + Transport ──────────────────────── */}
          <div style={{ gridColumn: 2, gridRow: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#060E1A" }}>
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
                ) : null;
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
              {/* No video at all */}
              {!upload?.playback_id && !upload?.source_url && (
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
              {/* Recording dot — top-right of video area */}
              {/* TODO: Show only when a tag event is actively being recorded; currently static placeholder */}
              {upload?.playback_id && (
                <span
                  className="absolute top-3 right-3 z-10"
                  style={{ width: 8, height: 8, borderRadius: "50%", background: "#EF4444", display: "block" }}
                />
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
                    style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 8px", borderRadius: 5, fontSize: 9, fontFamily: "'Oswald', sans-serif", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "#14B8A8", background: "transparent", border: "1px solid rgba(20,184,166,0.3)", cursor: "pointer" }}
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
                    style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 8px", borderRadius: 5, fontSize: 9, fontFamily: "'Oswald', sans-serif", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "#14B8A8", background: "transparent", border: "1px solid rgba(20,184,166,0.3)", cursor: "pointer" }}
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
                    {[0.25, 0.5, 1, 1.5, 2].map((rate) => (
                      <button
                        key={rate}
                        onClick={() => handleSpeedChange(rate)}
                        style={{
                          padding: "2px 6px",
                          borderRadius: 4,
                          fontSize: 9,
                          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                          fontWeight: 700,
                          color: playbackSpeed === rate ? "#FFFFFF" : "rgba(255,255,255,0.4)",
                          background: playbackSpeed === rate ? "#0D9488" : "transparent",
                          border: playbackSpeed === rate ? "none" : "1px solid rgba(255,255,255,0.08)",
                          cursor: "pointer",
                        }}
                        title={`${rate}x speed`}
                      >
                        {rate}x
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* PXI Report Display — below transport, inside col 2 */}
            {generating && (
              <div style={{ flexShrink: 0, padding: "12px 16px", borderTop: "1px solid rgba(255,255,255,0.07)", background: "#0A1929" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <Loader2 size={16} className="animate-spin" style={{ color: "#14B8A8" }} />
                  <span style={{ fontSize: 10, fontFamily: "'Oswald', sans-serif", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.5)" }}>Generating analysis...</span>
                </div>
              </div>
            )}

            {generatedReport && !generating && (
              <div style={{ flexShrink: 0, borderTop: "1px solid rgba(255,255,255,0.07)", background: "#0A1929" }}>
                <button
                  onClick={toggleReportExpanded}
                  style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 12px", background: "#0D2037", border: "none", cursor: "pointer" }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#F97316" }} />
                    <Sparkles size={10} style={{ color: "#F97316" }} />
                    <span style={{ fontSize: 9, fontFamily: "'Oswald', sans-serif", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#FFFFFF" }}>
                      {generatedReport.title}
                    </span>
                    {generatedReport.created_at && (
                      <span style={{ fontSize: 8, fontFamily: "'JetBrains Mono', ui-monospace, monospace", color: "rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.06)", borderRadius: 3, padding: "1px 5px" }}>
                        {formatDate(generatedReport.created_at)}
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowTypeSelector(true);
                        setPendingReportType(null);
                      }}
                      style={{ display: "flex", alignItems: "center", gap: 3, padding: "2px 6px", borderRadius: 3, fontSize: 8, fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#14B8A8", background: "rgba(13,148,136,0.15)", border: "none", cursor: "pointer" }}
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
                  <div style={{ padding: "8px 12px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
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

            {/* No analysis yet — collapsed CTA */}
            {!generatedReport && !generating && (
              <div style={{ flexShrink: 0, borderTop: "1px solid rgba(255,255,255,0.07)" }}>
                <button
                  onClick={() => { setShowTypeSelector(true); setPendingReportType(null); }}
                  style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 12px", background: "#0D2037", border: "none", cursor: "pointer" }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#F97316" }} />
                    <Sparkles size={10} style={{ color: "#F97316" }} />
                    <span style={{ fontSize: 9, fontFamily: "'Oswald', sans-serif", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.6)" }}>
                      PXI FILM ANALYSIS
                    </span>
                  </div>
                  <span style={{ fontSize: 9, fontFamily: "'Oswald', sans-serif", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "#14B8A8" }}>
                    Generate
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* ── COL 3 — Clips Panel + Reels + Comments ─────────── */}
          <div style={{ gridColumn: 3, gridRow: 1, background: "#0A1929", borderLeft: "1px solid rgba(255,255,255,0.07)", display: "flex", flexDirection: "column", overflow: "hidden", transition: "opacity 0.3s ease", opacity: cinemaMode ? 0 : 1 }}>
            <div style={{ flex: 1, overflowY: "auto", padding: 6, display: "flex", flexDirection: "column", gap: 6 }}>
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
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, fontFamily: "'JetBrains Mono', ui-monospace, monospace", color: "rgba(255,255,255,0.4)" }}>
                    <span>{formatDate(session.created_at)}</span>
                    <span style={{ color: "rgba(255,255,255,0.15)" }}>·</span>
                    <span style={{ textTransform: "capitalize" }}>{session.status || "active"}</span>
                  </div>
                  {session.description && (
                    <p style={{ fontSize: 10, marginTop: 3, color: "rgba(255,255,255,0.6)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={session.description}>{session.description}</p>
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
              {(sessionEvents.length === 0 || importingEvents || showReplaceConfirm || importResult) && (
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
                        <p style={{ fontSize: 10, color: "rgba(255,255,255,0.7)", marginBottom: 6 }}>Replace existing events?</p>
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
                          <div style={{ marginBottom: 6, fontSize: 10, borderRadius: 4, padding: "4px 8px", color: "#14B8A8", background: "rgba(13,148,136,0.1)" }}>
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
              )}

              {/* Clip Panel — props unchanged */}
              <ClipPanel
                sessionId={sessionId}
                uploadId={upload?.id || ""}
                getCurrentTime={getCurrentTime}
                refreshKey={clipRefreshKey}
              />

              {/* Reels Section */}
              {sessionReels.length > 0 && (
                <div style={{ background: "#0D2037", borderRadius: 6, overflow: "hidden" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 10px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#EA580C" }} />
                    <Film size={10} style={{ color: "#EA580C" }} />
                    <span style={{ fontSize: 8, fontFamily: "'Oswald', sans-serif", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.6)" }}>REELS</span>
                    <span style={{ fontSize: 8, fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontWeight: 700, background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)", borderRadius: 3, padding: "0 4px" }}>{sessionReels.length}</span>
                  </div>
                  <div style={{ padding: "4px 6px" }}>
                    {sessionReels.map((reel) => (
                      <Link
                        key={reel.id}
                        href={`/reels/${reel.id}`}
                        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 6px", borderRadius: 4, textDecoration: "none", transition: "background 0.15s" }}
                        className="hover:bg-white/[0.03]"
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 0 }}>
                          <Film size={9} style={{ color: "#EA580C", flexShrink: 0 }} />
                          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{reel.title}</span>
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
                    ))}
                  </div>
                </div>
              )}

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
                      style={{ flex: 1, padding: "4px 8px", borderRadius: 4, fontSize: 11, color: "#FFFFFF", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", outline: "none" }}
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
                    <p style={{ fontSize: 10, textAlign: "center", padding: "10px 0", color: "rgba(255,255,255,0.3)" }}>
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
                            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", margin: 0 }}>{c.comment_text}</p>
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
                    <span key={i} style={{ position: "absolute", left: `calc(62px + ${(i / 10) * (100 - 0)}% * (1 - 62 / 100 / 1))`, fontSize: 8, fontFamily: "'JetBrains Mono', ui-monospace, monospace", color: "rgba(255,255,255,0.3)", transform: "translateX(-50%)", whiteSpace: "nowrap", top: 0 }}>
                      {label}
                    </span>
                  );
                })}
              </div>

              {/* Event tracks — GOALS, SHOTS, FACEOFFS */}
              {(() => {
                const filteredEvents = eventFilter === "all"
                  ? sessionEvents
                  : sessionEvents.filter((ev) => getEventCategory(ev.event_type) === eventFilter);
                const tracks: { key: string; label: string; match: (t: string) => boolean; color: string }[] = [
                  { key: "goals", label: "GOALS", match: (t) => t.toLowerCase().includes("goal"), color: "#0D9488" },
                  { key: "shots", label: "SHOTS", match: (t) => t.toLowerCase().includes("shot"), color: "#14B8A8" },
                  { key: "faceoffs", label: "FACEOFFS", match: (t) => t.toLowerCase().includes("faceoff"), color: "#F59E0B" },
                ];
                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    {tracks.map((track) => {
                      const trackEvents = filteredEvents.filter((ev) => track.match(ev.event_type));
                      return (
                        <div key={track.key} style={{ height: 14, position: "relative", background: "rgba(255,255,255,0.02)", borderRadius: 3 }}>
                          {/* Track label */}
                          <div style={{ position: "absolute", left: 0, top: 0, width: 60, height: "100%", background: "rgba(6,14,26,0.8)", borderRight: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", paddingLeft: 6, zIndex: 1, borderRadius: "3px 0 0 3px" }}>
                            <span style={{ fontSize: 8, fontFamily: "'Oswald', sans-serif", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)" }}>{track.label}</span>
                          </div>
                          {/* Events area */}
                          <div style={{ position: "absolute", left: 62, right: 0, top: 0, bottom: 0 }}>
                            {trackEvents.map((ev) => {
                              const pct = totalDuration > 0 ? (ev.time_seconds / totalDuration) * 100 : 0;
                              return (
                                <button
                                  key={ev.id}
                                  onClick={() => setStartTime(ev.time_seconds)}
                                  title={`${ev.event_type.replace(/_/g, " ")} at ${formatTimestamp(ev.time_seconds)}`}
                                  style={{ position: "absolute", left: `${pct}%`, width: "max(0.8%, 4px)", top: 1, bottom: 1, borderRadius: 2, background: track.color, opacity: 0.85, cursor: "pointer", border: "none", padding: 0, transition: "opacity 0.15s" }}
                                  onMouseEnter={(e) => { (e.target as HTMLElement).style.opacity = "1"; }}
                                  onMouseLeave={(e) => { (e.target as HTMLElement).style.opacity = "0.85"; }}
                                />
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {/* Playhead — vertical teal line tracking current playback position */}
              <div style={{ position: "absolute", top: 0, bottom: 0, left: `calc(62px + ${playheadPct}% * (1 - 62 / 100 / 1))`, width: 1, background: "#14B8A8", zIndex: 20, pointerEvents: "none", transition: "left 0.25s linear" }}>
                {/* Triangle cap */}
                <div style={{ position: "absolute", top: 0, left: -3, width: 0, height: 0, borderLeft: "4px solid transparent", borderRight: "4px solid transparent", borderTop: "5px solid #14B8A8" }} />
              </div>

              {/* Empty state */}
              {sessionEvents.length === 0 && (
                <p style={{ fontSize: 10, textAlign: "center", padding: "6px 0", color: "rgba(255,255,255,0.25)", position: "absolute", left: 62, right: 0, top: "50%", transform: "translateY(-50%)", margin: 0 }}>
                  No events yet — tag events from the Code Window.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Reel Builder Modal */}
      {showReelBuilder && (
        <ReelBuilder
          sessionId={sessionId}
          playerId={session?.player_id || null}
          onClose={() => setShowReelBuilder(false)}
          onCreated={() => loadSessionReels()}
        />
      )}
    </ProtectedRoute>
  );
}
