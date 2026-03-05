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
  const [generatedReport, setGeneratedReport] = useState<{ id: string; title: string; output_text: string } | null>(null);
  const [reportExpanded, setReportExpanded] = useState(true);

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

  // Video player ref for getting current time + playback control
  const videoPlayerRef = useRef<VideoPlayerHandle>(null);
  const currentTimeRef = useRef<number>(0);

  const getCurrentTime = useCallback(() => currentTimeRef.current, []);

  const handleTimeUpdate = useCallback((seconds: number) => {
    currentTimeRef.current = seconds;
  }, []);

  // Load session data
  useEffect(() => {
    const loadData = async () => {
      try {
        const sessionRes = await api.get(`/film/sessions/${sessionId}`);
        const sessionData = sessionRes.data;
        setSession(sessionData);

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

  const loadComments = useCallback(async () => {
    try {
      const res = await api.get(`/film/sessions/${sessionId}/comments`);
      setComments(res.data);
    } catch {
      // Silently fail on comment refresh
    }
  }, [sessionId]);

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
            });
            setReportExpanded(true);
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
      <NavBar />
      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* ═══════════════════════════════════════════════════════
            SESSION HEADER — navy bar (war room style)
            ═══════════════════════════════════════════════════════ */}
        <div className="px-5 py-4 flex items-center justify-between mb-4" style={{ borderRadius: 12, border: "1.5px solid #DDE6EF", background: "#0F2942" }}>
          <div className="flex items-center gap-3">
            <Link
              href="/film/sessions"
              className="hover:opacity-70 transition-opacity"
              style={{ color: "rgba(255,255,255,0.6)" }}
            >
              <ArrowLeft size={20} />
            </Link>
            <span
              className="px-2.5 py-1 rounded-md text-white font-bold uppercase"
              style={{ fontSize: 10, fontFamily: "ui-monospace, monospace", letterSpacing: 2, background: "#0D9488" }}
            >
              FILM ROOM
            </span>
            <div>
              <h1 className="text-lg font-bold text-white">
                {session.title}
              </h1>
              <div className="flex items-center gap-2">
                <span
                  className="px-2 py-0.5 rounded text-white font-bold uppercase"
                  style={{ fontSize: 9, fontFamily: "ui-monospace, monospace", letterSpacing: 1, background: "rgba(13,148,136,0.4)" }}
                >
                  {SESSION_TYPE_LABELS[session.session_type] || session.session_type}
                </span>
                <span className="text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>
                  {formatDate(session.created_at)}
                </span>
                <span className="text-xs hidden sm:inline" style={{ color: "rgba(255,255,255,0.4)" }}>
                  — Watch, tag, clip, and analyse game footage.
                </span>
              </div>
            </div>
          </div>

          {/* Generate Analysis + Build Reel buttons */}
          <div className="relative shrink-0 flex items-center gap-2">
            <Link
              href={`/highlight-reels/new?session=${sessionId}${session.player_id ? `&player=${session.player_id}` : ""}`}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold uppercase transition-colors hover:opacity-90"
              style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 1, background: "rgba(234,88,12,0.1)", color: "#EA580C", border: "1.5px solid rgba(234,88,12,0.2)" }}
            >
              <Film size={12} />
              Build Reel
            </Link>
            <button
              onClick={() => { setShowTypeSelector(!showTypeSelector); setPendingReportType(null); }}
              disabled={generating}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold uppercase transition-colors hover:opacity-90 disabled:opacity-50"
              style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 1, background: "rgba(13,148,136,0.1)", color: "#0D9488", border: "1.5px solid rgba(13,148,136,0.2)" }}
            >
              {generating ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Sparkles size={12} />
              )}
              {generating ? "Generating..." : generatedReport ? "Regenerate" : "Generate Analysis"}
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

        {/* Split layout — 65/35 on desktop, stacked on mobile */}
        <div className="flex flex-col lg:flex-row gap-4" style={{ minHeight: "calc(100vh - 180px)" }}>
          {/* LEFT TOP — Video + Event Tagger (order-1 on mobile) */}
          <div className={`w-full flex flex-col gap-3 order-1 ${cinemaMode ? "lg:w-full" : "lg:w-[70%]"}`}>
            {/* Video Player — edge-to-edge, no card wrapper */}
            <div className="relative" style={{ borderRadius: 8, overflow: "hidden", minHeight: "50vh" }}>
              <VideoPlayer
                ref={videoPlayerRef}
                playbackId={upload?.playback_id || null}
                onTimeUpdate={handleTimeUpdate}
                startTime={startTime}
              />
              {upload?.playback_id && (
                <>
                  <button
                    onClick={() => setCinemaMode(!cinemaMode)}
                    className="absolute top-3 right-3 z-10 bg-black/60 hover:bg-black/80 text-white p-2 rounded-lg transition-colors"
                    title={cinemaMode ? "Exit Cinema Mode" : "Cinema Mode"}
                  >
                    {cinemaMode ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                  </button>
                  {playbackSpeed !== 1 && (
                    <span
                      className="absolute top-3 left-3 z-10 px-2 py-1 rounded-md text-white font-bold"
                      style={{ fontSize: 11, fontFamily: "ui-monospace, monospace", background: "#0D9488" }}
                    >
                      {playbackSpeed}x
                    </span>
                  )}
                </>
              )}
            </div>

            {/* Event Tag Bar */}
            {upload?.playback_id && (
              <EventTagger
                sessionId={sessionId}
                uploadId={upload.id}
                getCurrentTime={getCurrentTime}
              />
            )}

            {/* Mark In / Mark Out control bar */}
            {upload?.playback_id && (
              <div className="overflow-hidden" style={{ borderRadius: 12, border: "1.5px solid #DDE6EF" }}>
                {/* Row 1 — Mark In / timestamps / Mark Out / title / Save */}
                <div className="flex flex-wrap items-center gap-3 px-4 py-3" style={{ background: "#FFFFFF" }}>
                  {/* Mark In */}
                  <button
                    onClick={() => setClipStart(Math.floor(currentTimeRef.current))}
                    className="flex items-center gap-1.5 border border-teal text-teal px-3 py-2 rounded-lg text-xs font-oswald uppercase tracking-wider hover:bg-teal/5 transition-colors"
                  >
                    <Scissors size={13} />
                    Mark In
                  </button>
                  <span
                    className="font-bold min-w-[60px]"
                    style={{ fontSize: 13, fontFamily: "ui-monospace, monospace", color: clipStart !== null ? "#0D9488" : "#CCD6E0" }}
                  >
                    {clipStart !== null ? formatTimestamp(clipStart) : "--:--"}
                  </span>

                  {/* Mark Out */}
                  <button
                    onClick={() => setClipEnd(Math.floor(currentTimeRef.current))}
                    className="flex items-center gap-1.5 border border-teal text-teal px-3 py-2 rounded-lg text-xs font-oswald uppercase tracking-wider hover:bg-teal/5 transition-colors"
                  >
                    <Scissors size={13} />
                    Mark Out
                  </button>
                  <span
                    className="font-bold min-w-[60px]"
                    style={{ fontSize: 13, fontFamily: "ui-monospace, monospace", color: clipEnd !== null ? "#0D9488" : "#CCD6E0" }}
                  >
                    {clipEnd !== null ? formatTimestamp(clipEnd) : "--:--"}
                  </span>

                  {/* Divider */}
                  <div className="w-px h-6 hidden sm:block" style={{ background: "#DDE6EF" }} />

                  {/* Title input */}
                  <input
                    type="text"
                    value={clipTitle}
                    onChange={(e) => setClipTitle(e.target.value)}
                    placeholder="Clip title..."
                    className="flex-1 min-w-[120px] border rounded-lg px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
                    style={{ borderColor: "#DDE6EF" }}
                  />

                  {/* Save Clip */}
                  <button
                    onClick={handleSaveClip}
                    disabled={clipStart === null || clipEnd === null || savingClip}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-oswald uppercase tracking-wider transition-colors ${
                      clipStart !== null && clipEnd !== null && !savingClip
                        ? "bg-teal text-white hover:bg-teal/90"
                        : "bg-border text-muted/50 cursor-not-allowed"
                    }`}
                  >
                    {savingClip ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Save size={13} />
                    )}
                    Save Clip
                  </button>
                </div>

                {/* Row 2 — Frame step (left) | Speed selector (center) | Cinema mode (right) */}
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5" style={{ borderTop: "1px solid #DDE6EF", background: "#F8FAFC" }}>
                  {/* Frame stepping — larger buttons */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => videoPlayerRef.current?.seekBy(-5)}
                      className="px-3 py-2 rounded-lg transition-colors hover:opacity-80 text-sm"
                      style={{ border: "1.5px solid #DDE6EF", color: "#0F2942", background: "#FFFFFF" }}
                      title="Back 5s"
                    >
                      <Rewind size={14} />
                    </button>
                    <button
                      onClick={() => videoPlayerRef.current?.seekBy(-0.033)}
                      className="px-3 py-2 rounded-lg transition-colors hover:opacity-80 text-sm"
                      style={{ border: "1.5px solid #DDE6EF", color: "#0F2942", background: "#FFFFFF" }}
                      title="Back 1 frame"
                    >
                      <SkipBack size={14} />
                    </button>
                    <button
                      onClick={() => videoPlayerRef.current?.seekBy(0.033)}
                      className="px-3 py-2 rounded-lg transition-colors hover:opacity-80 text-sm"
                      style={{ border: "1.5px solid #DDE6EF", color: "#0F2942", background: "#FFFFFF" }}
                      title="Forward 1 frame"
                    >
                      <SkipForward size={14} />
                    </button>
                    <button
                      onClick={() => videoPlayerRef.current?.seekBy(5)}
                      className="px-3 py-2 rounded-lg transition-colors hover:opacity-80 text-sm"
                      style={{ border: "1.5px solid #DDE6EF", color: "#0F2942", background: "#FFFFFF" }}
                      title="Forward 5s"
                    >
                      <FastForward size={14} />
                    </button>
                  </div>

                  {/* Playback speed — larger buttons */}
                  <div className="flex items-center gap-1.5">
                    <Gauge size={14} style={{ color: "#5A7291" }} />
                    {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                      <button
                        key={rate}
                        onClick={() => handleSpeedChange(rate)}
                        className="px-3 py-1.5 rounded-lg text-sm font-bold transition-colors"
                        style={playbackSpeed === rate
                          ? { fontFamily: "ui-monospace, monospace", background: "#0D9488", color: "#FFFFFF" }
                          : { fontFamily: "ui-monospace, monospace", color: "#5A7291", border: "1.5px solid #DDE6EF", background: "#FFFFFF" }
                        }
                        title={`${rate}x speed`}
                      >
                        {rate}x
                      </button>
                    ))}
                  </div>

                  {/* Cinema mode toggle */}
                  <button
                    onClick={() => setCinemaMode(!cinemaMode)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold uppercase transition-colors hover:opacity-80"
                    style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 1, color: cinemaMode ? "#FFFFFF" : "#5A7291", background: cinemaMode ? "#0D9488" : "#FFFFFF", border: "1.5px solid #DDE6EF" }}
                    title={cinemaMode ? "Exit Cinema Mode" : "Cinema Mode"}
                  >
                    {cinemaMode ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                    {cinemaMode ? "Exit" : "Cinema"}
                  </button>
                </div>
              </div>
            )}

            {/* Event Timeline */}
            {sessionEvents.length > 0 && (() => {
              const filteredEvents = eventFilter === "all"
                ? sessionEvents
                : sessionEvents.filter((ev) => getEventCategory(ev.event_type) === eventFilter);
              return (
                <div className="overflow-hidden" style={{ borderRadius: 12, border: "1.5px solid #DDE6EF", borderLeft: "3px solid #0D9488" }}>
                  <div className="flex items-center justify-between px-5 py-3" style={{ background: "#0F2942" }}>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ background: "#0D9488" }} />
                      <span
                        className="font-bold uppercase text-white"
                        style={{ fontSize: 10, fontFamily: "ui-monospace, monospace", letterSpacing: 2 }}
                      >
                        EVENT TIMELINE
                      </span>
                      <span className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
                        ({filteredEvents.length === sessionEvents.length
                          ? `${sessionEvents.length} events`
                          : `${filteredEvents.length} of ${sessionEvents.length}`})
                      </span>
                    </div>
                  </div>
                  <div className="bg-white px-5 py-4">
                    {/* Filter buttons */}
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {EVENT_CATEGORY_LABELS.map((cat) => (
                        <button
                          key={cat.value}
                          onClick={() => setEventFilter(cat.value)}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition-colors ${
                            eventFilter === cat.value
                              ? "text-white"
                              : "hover:opacity-80"
                          }`}
                          style={eventFilter === cat.value
                            ? { fontFamily: "ui-monospace, monospace", letterSpacing: 1, background: "#0D9488" }
                            : { fontFamily: "ui-monospace, monospace", letterSpacing: 1, color: "#5A7291", border: "1.5px solid #DDE6EF" }
                          }
                        >
                          {cat.label}
                        </button>
                      ))}
                    </div>

                    {/* Scrollable event list */}
                    <div className="max-h-[300px] overflow-y-auto space-y-1">
                      {filteredEvents.length === 0 ? (
                        <p className="text-[11px] text-center py-4" style={{ color: "#8BA4BB" }}>
                          No events match this filter. Try selecting a different category above.
                        </p>
                      ) : (
                        filteredEvents.map((ev) => {
                          const cat = getEventCategory(ev.event_type);
                          const colorClass = EVENT_CATEGORY_COLORS[cat];
                          return (
                            <button
                              key={ev.id}
                              onClick={() => setStartTime(ev.time_seconds)}
                              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-navy/[0.03] transition-colors text-left group"
                            >
                              {/* Timestamp */}
                              <span className="text-[11px] shrink-0 min-w-[40px]" style={{ fontFamily: "ui-monospace, monospace", color: "#0D9488" }}>
                                {formatTimestamp(ev.time_seconds)}
                              </span>

                              {/* Event badge + label */}
                              <div className="flex-1 min-w-0 flex items-center gap-1.5">
                                <span className={`text-[9px] font-oswald uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 ${colorClass}`}>
                                  {ev.event_type.replace(/_/g, " ")}
                                </span>
                                {ev.event_label && ev.event_label !== ev.event_type && (
                                  <span className="text-[11px] truncate" style={{ color: "#0F2942" }}>{ev.event_label}</span>
                                )}
                              </div>

                              {/* Play button */}
                              <span className="shrink-0 text-muted/30 group-hover:text-teal transition-colors">
                                <Play size={11} />
                              </span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* PXI Report Display (generating spinner or completed report) */}
            {generating && (
              <div className="overflow-hidden" style={{ borderRadius: 12, border: "1.5px solid #DDE6EF" }}>
                <div className="bg-white px-5 py-6 flex items-center justify-center gap-3">
                  <Loader2 size={20} className="animate-spin" style={{ color: "#0D9488" }} />
                  <span className="font-bold uppercase" style={{ fontSize: 11, fontFamily: "ui-monospace, monospace", letterSpacing: 1, color: "#5A7291" }}>Generating analysis...</span>
                </div>
              </div>
            )}

            {generatedReport && !generating && (
              <div className="overflow-hidden" style={{ borderRadius: 12, border: "1.5px solid #DDE6EF", borderLeft: "3px solid #F97316" }}>
                <button
                  onClick={() => setReportExpanded(!reportExpanded)}
                  className="w-full flex items-center justify-between px-5 py-3 transition-colors"
                  style={{ background: "#0F2942" }}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ background: "#F97316" }} />
                    <Sparkles size={12} style={{ color: "#F97316" }} />
                    <span
                      className="font-bold uppercase text-white"
                      style={{ fontSize: 10, fontFamily: "ui-monospace, monospace", letterSpacing: 2 }}
                    >
                      {generatedReport.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowTypeSelector(true);
                        setPendingReportType(null);
                      }}
                      className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold uppercase transition-colors hover:opacity-80"
                      style={{ fontFamily: "ui-monospace, monospace", fontSize: 9, letterSpacing: 1, color: "#0D9488", background: "rgba(13,148,136,0.15)" }}
                      title="Regenerate with a different report type"
                    >
                      <RefreshCw size={10} />
                      Regenerate
                    </button>
                    {reportExpanded ? <ChevronDown size={14} style={{ color: "rgba(255,255,255,0.5)" }} /> : <ChevronRight size={14} style={{ color: "rgba(255,255,255,0.5)" }} />}
                  </div>
                </button>
                {reportExpanded && (
                  <div className="bg-white px-5 py-4" style={{ borderTop: "1px solid #DDE6EF" }}>
                    <div className="flex justify-end mb-2">
                      <ListenButton text={generatedReport.output_text || ""} label="Listen" />
                    </div>
                    <div className="pl-4 text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "#0F2942", borderLeft: "3px solid #0D9488" }}>
                      {generatedReport.output_text}
                    </div>
                    <div className="mt-3 flex justify-end">
                      <Link
                        href={`/reports/${generatedReport.id}`}
                        className="flex items-center gap-1 text-xs font-bold uppercase transition-colors hover:opacity-80"
                        style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, letterSpacing: 1, color: "#0D9488" }}
                      >
                        <FileText size={10} />
                        View Full Report
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Comments (hidden on mobile — shown via order-3 block below) */}
            <div className="hidden lg:block">
              <div className="overflow-hidden" style={{ borderRadius: 12, border: "1.5px solid #DDE6EF", borderLeft: "3px solid #0D9488" }}>
                <div className="flex items-center gap-2 px-5 py-3" style={{ background: "#0F2942" }}>
                  <span className="w-2 h-2 rounded-full" style={{ background: "#0D9488" }} />
                  <span
                    className="font-bold uppercase text-white"
                    style={{ fontSize: 10, fontFamily: "ui-monospace, monospace", letterSpacing: 2 }}
                  >
                    COMMENTS
                  </span>
                </div>
                <div className="bg-white px-5 py-4">
                  {/* Comment input */}
                  <div className="flex gap-2 mb-4">
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
                      className="flex-1 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
                      style={{ color: "#0F2942", border: "1.5px solid #DDE6EF" }}
                    />
                    <MicButton onTranscript={(t) => setCommentText((p) => (p ? p + " " + t : t))} />
                    <button
                      onClick={handleSubmitComment}
                      disabled={submittingComment || !commentText.trim()}
                      className="px-3 py-2 rounded-lg text-white transition-colors disabled:opacity-40"
                      style={{ background: "#0D9488" }}
                    >
                      {submittingComment ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Send size={14} />
                      )}
                    </button>
                  </div>

                  {/* Comment list */}
                  {comments.length === 0 ? (
                    <p className="text-[11px] text-center py-4" style={{ color: "#8BA4BB" }}>
                      No comments yet. Type a note above and click the send button.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {comments.map((c) => (
                        <div
                          key={c.id}
                          className="flex items-start justify-between gap-2 py-2"
                          style={{ borderBottom: "1px solid #DDE6EF" }}
                        >
                          <div className="min-w-0">
                            <p className="text-sm" style={{ color: "#0F2942" }}>{c.comment_text}</p>
                            <div className="flex items-center gap-2 mt-1">
                              {c.timestamp_seconds !== null && (
                                <span className="flex items-center gap-1 text-[10px]" style={{ fontFamily: "ui-monospace, monospace", color: "#0D9488" }}>
                                  <Clock size={10} />
                                  {formatTimestamp(c.timestamp_seconds)}
                                </span>
                              )}
                              <span className="text-[10px]" style={{ color: "#5A7291" }}>
                                {formatDate(c.created_at)}
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => handleDeleteComment(c.id)}
                            className="text-muted/30 hover:text-red-500 transition-colors shrink-0 mt-0.5"
                            title="Delete comment"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT PANEL — 35% (order-2 on mobile — between video and comments) */}
          <div className={`w-full lg:w-[30%] flex flex-col gap-4 order-2 ${cinemaMode ? "hidden" : ""}`}>
            {/* Session info — compact */}
            <div className="overflow-hidden" style={{ borderRadius: 12, border: "1.5px solid #DDE6EF", borderLeft: "3px solid #0D9488" }}>
              <div className="flex items-center justify-between px-4 py-2.5" style={{ background: "#0F2942" }}>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ background: "#0D9488" }} />
                  <span
                    className="font-bold uppercase text-white"
                    style={{ fontSize: 10, fontFamily: "ui-monospace, monospace", letterSpacing: 2 }}
                  >
                    SESSION
                  </span>
                </div>
                <span
                  className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded"
                  style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 1, background: "rgba(13,148,136,0.3)", color: "#FFFFFF" }}
                >
                  {SESSION_TYPE_LABELS[session.session_type] || session.session_type}
                </span>
              </div>
              <div className="bg-white px-4 py-2.5">
                <div className="flex items-center gap-2 text-[11px]" style={{ color: "#5A7291" }}>
                  <span>{formatDate(session.created_at)}</span>
                  <span style={{ color: "#DDE6EF" }}>·</span>
                  <span className="capitalize">{session.status || "active"}</span>
                </div>
                {session.description && (
                  <p className="text-xs mt-1 truncate" style={{ color: "#0F2942" }} title={session.description}>{session.description}</p>
                )}
              </div>
            </div>

            {/* Import Event Data — hidden once events exist (show re-import only if importing/confirming) */}
            {/* Hidden file input (always rendered) */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".xml,.csv"
              onChange={handleFileSelected}
              className="hidden"
            />
            {(sessionEvents.length === 0 || importingEvents || showReplaceConfirm || importResult) && (
              <div className="overflow-hidden" style={{ borderRadius: 12, border: "1.5px solid #DDE6EF", borderLeft: "3px solid #0D9488" }}>
                <div className="flex items-center gap-2 px-4 py-2.5" style={{ background: "#0F2942" }}>
                  <span className="w-2 h-2 rounded-full" style={{ background: "#0D9488" }} />
                  <span
                    className="font-bold uppercase text-white"
                    style={{ fontSize: 10, fontFamily: "ui-monospace, monospace", letterSpacing: 2 }}
                  >
                    IMPORT EVENTS
                  </span>
                </div>
                <div className="bg-white px-4 py-3">
                  {importingEvents ? (
                    <div className="flex items-center justify-center gap-2 py-2">
                      <Loader2 size={14} className="animate-spin" style={{ color: "#0D9488" }} />
                      <span className="text-[11px] font-bold uppercase" style={{ color: "#5A7291", fontFamily: "ui-monospace, monospace", letterSpacing: 1 }}>Importing events...</span>
                    </div>
                  ) : showReplaceConfirm ? (
                    <div className="py-1">
                      <p className="text-[11px] mb-2" style={{ color: "#0F2942" }}>Replace existing events?</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            if (pendingImportFile) executeEventImport(pendingImportFile, true);
                          }}
                          className="flex-1 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase text-white transition-colors hover:opacity-90"
                          style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 1, background: "#EA580C" }}
                        >
                          Replace
                        </button>
                        <button
                          onClick={() => { setShowReplaceConfirm(false); setPendingImportFile(null); }}
                          className="px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase transition-colors hover:opacity-80"
                          style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 1, color: "#5A7291" }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      {importResult && (
                        <div className="mb-2 text-[11px] rounded-lg px-3 py-2" style={{ color: "#0D9488", background: "rgba(13,148,136,0.06)" }}>
                          Imported {importResult.events_created} events, {importResult.clips_created} clips
                          {importResult.player_matches > 0 && ` · ${importResult.player_matches} matched`}
                          {importResult.unmatched_players.length > 0 && (
                            <span className="block mt-1" style={{ color: "#5A7291" }}>
                              Unmatched: {importResult.unmatched_players.slice(0, 5).join(", ")}
                              {importResult.unmatched_players.length > 5 && ` +${importResult.unmatched_players.length - 5} more`}
                            </span>
                          )}
                        </div>
                      )}
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-[11px] font-bold uppercase transition-colors hover:opacity-80"
                        style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 1, color: "#5A7291", border: "1.5px dashed #DDE6EF" }}
                      >
                        {session?.event_data_source ? (
                          <>
                            <RefreshCw size={12} />
                            Re-import Event Data
                          </>
                        ) : (
                          <>
                            <Upload size={12} />
                            Import Event Data
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Clip Panel */}
            <ClipPanel
              sessionId={sessionId}
              uploadId={upload?.id || ""}
              getCurrentTime={getCurrentTime}
              refreshKey={clipRefreshKey}
            />

            {/* Game Plan Links */}
            <div className="overflow-hidden" style={{ borderRadius: 12, border: "1.5px solid #DDE6EF", borderLeft: "3px solid #F97316" }}>
              <div className="flex items-center gap-2 px-5 py-3" style={{ background: "#0F2942" }}>
                <span className="w-2 h-2 rounded-full" style={{ background: "#F97316" }} />
                <span
                  className="font-bold uppercase text-white"
                  style={{ fontSize: 10, fontFamily: "ui-monospace, monospace", letterSpacing: 2 }}
                >
                  GAME PLAN LINKS
                </span>
              </div>
              <div className="bg-white px-5 py-4">
                <p className="text-[11px] text-center py-4" style={{ color: "#8BA4BB" }}>
                  No linked game plans yet.
                </p>
              </div>
            </div>
          </div>

          {/* MOBILE COMMENTS — order-3 (only visible below lg) */}
          <div className="lg:hidden order-3 w-full">
            <div className="overflow-hidden" style={{ borderRadius: 12, border: "1.5px solid #DDE6EF", borderLeft: "3px solid #0D9488" }}>
              <div className="flex items-center gap-2 px-5 py-3" style={{ background: "#0F2942" }}>
                <span className="w-2 h-2 rounded-full" style={{ background: "#0D9488" }} />
                <span
                  className="font-bold uppercase text-white"
                  style={{ fontSize: 10, fontFamily: "ui-monospace, monospace", letterSpacing: 2 }}
                >
                  COMMENTS
                </span>
              </div>
              <div className="bg-white px-5 py-4">
                {/* Comment input */}
                <div className="flex gap-2 mb-4">
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
                    className="flex-1 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
                    style={{ color: "#0F2942", border: "1.5px solid #DDE6EF" }}
                  />
                  <button
                    onClick={handleSubmitComment}
                    disabled={submittingComment || !commentText.trim()}
                    className="px-3 py-2 rounded-lg text-white transition-colors disabled:opacity-40"
                    style={{ background: "#0D9488" }}
                  >
                    {submittingComment ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Send size={14} />
                    )}
                  </button>
                </div>

                {/* Comment list */}
                {comments.length === 0 ? (
                  <p className="text-[11px] text-center py-4" style={{ color: "#8BA4BB" }}>
                    No comments yet.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {comments.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-start justify-between gap-2 py-2"
                        style={{ borderBottom: "1px solid #DDE6EF" }}
                      >
                        <div className="min-w-0">
                          <p className="text-sm" style={{ color: "#0F2942" }}>{c.comment_text}</p>
                          <div className="flex items-center gap-2 mt-1">
                            {c.timestamp_seconds !== null && (
                              <span className="flex items-center gap-1 text-[10px]" style={{ fontFamily: "ui-monospace, monospace", color: "#0D9488" }}>
                                <Clock size={10} />
                                {formatTimestamp(c.timestamp_seconds)}
                              </span>
                            )}
                            <span className="text-[10px]" style={{ color: "#5A7291" }}>
                              {formatDate(c.created_at)}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteComment(c.id)}
                          className="text-muted/30 hover:text-red-500 transition-colors shrink-0 mt-0.5"
                          title="Delete comment"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </ProtectedRoute>
  );
}
