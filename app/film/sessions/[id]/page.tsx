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
} from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import VideoPlayer from "@/components/film/VideoPlayer";
import ClipPanel from "@/components/film/ClipPanel";
import EventTagger from "@/components/film/EventTagger";
import api from "@/lib/api";
import toast from "react-hot-toast";

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

const FILM_REPORT_TYPES = [
  { value: "film_post_game_review", label: "Post-Game Review", desc: "Breakdown of game footage — personnel, tactics, adjustments", needsPlayer: false, needsOpponent: false },
  { value: "film_player_analysis", label: "Player Film Analysis", desc: "Clip-by-clip assessment of a specific player", needsPlayer: true, needsOpponent: false },
  { value: "film_opponent_prep", label: "Opponent Prep", desc: "Tactical breakdown for game preparation", needsPlayer: false, needsOpponent: true },
  { value: "film_practice_review", label: "Practice Review", desc: "Drill execution, standouts, system concepts", needsPlayer: false, needsOpponent: false },
];

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

  // Video player ref for getting current time
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

      // Player Film Analysis — needs a player selector
      if (config.needsPlayer) {
        setPendingReportType(type);
        setSelectedPlayerId("");
        setShowTypeSelector(false);
        // Load roster if we have a team_id
        if (session?.team_id) {
          setLoadingRoster(true);
          try {
            const res = await api.get(`/players`, { params: { team_id: session.team_id, limit: 200 } });
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
        {/* Top bar */}
        <div className="flex items-center gap-3 mb-4">
          <Link
            href="/film/sessions"
            className="text-muted hover:text-navy transition-colors"
          >
            <ArrowLeft size={20} />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold text-navy font-oswald uppercase tracking-wider truncate">
              {session.title}
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] font-oswald uppercase tracking-wider bg-teal/10 text-teal px-2 py-0.5 rounded-full">
                {SESSION_TYPE_LABELS[session.session_type] || session.session_type}
              </span>
              <span className="text-[11px] text-muted">
                {formatDate(session.created_at)}
              </span>
            </div>
          </div>

          {/* Generate Analysis button + dropdown */}
          <div className="relative shrink-0">
            <button
              onClick={() => { setShowTypeSelector(!showTypeSelector); setPendingReportType(null); }}
              disabled={generating}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-oswald uppercase tracking-wider text-sm transition-colors ${
                generating
                  ? "bg-orange/50 text-white cursor-not-allowed"
                  : "bg-orange text-white hover:bg-orange/90"
              }`}
            >
              {generating ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Sparkles size={14} />
              )}
              {generating ? "Generating..." : generatedReport ? "Regenerate" : "Generate Analysis"}
            </button>

            {/* Report type dropdown */}
            {showTypeSelector && !generating && (
              <div className="absolute right-0 top-full mt-1 w-72 bg-white rounded-xl border border-border shadow-lg z-20 py-1">
                {FILM_REPORT_TYPES.map((rt) => (
                  <button
                    key={rt.value}
                    onClick={() => handleSelectReportType(rt.value)}
                    className="w-full text-left px-4 py-2.5 hover:bg-navy/[0.03] transition-colors group"
                  >
                    <span className="text-sm text-navy font-oswald tracking-wider">{rt.label}</span>
                    <span className="block text-[10px] text-muted/60 mt-0.5 leading-tight">{rt.desc}</span>
                  </button>
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

            {/* Player selector (for Player Film Analysis) */}
            {pendingReportType === "film_player_analysis" && !generating && (
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
                    <p className="text-[11px] text-muted/60 mb-3">No roster loaded. Enter player ID or generate without a specific player.</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => executeGeneration("film_player_analysis")}
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
                        onClick={() => executeGeneration("film_player_analysis", selectedPlayerId || undefined)}
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
          <div className="w-full lg:w-[65%] flex flex-col gap-4 order-1">
            {/* Video Player */}
            <VideoPlayer
              playbackId={upload?.playback_id || null}
              onTimeUpdate={handleTimeUpdate}
              startTime={startTime}
            />

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
              <div className="bg-white rounded-xl border border-border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  {/* Mark In */}
                  <button
                    onClick={() => setClipStart(Math.floor(currentTimeRef.current))}
                    className="flex items-center gap-1.5 border border-teal text-teal px-3 py-1.5 rounded-lg text-[11px] font-oswald uppercase tracking-wider hover:bg-teal/5 transition-colors"
                  >
                    <Scissors size={12} />
                    Mark In
                  </button>
                  <span className="text-[11px] font-mono text-navy min-w-[56px]">
                    In: {clipStart !== null ? formatTimestamp(clipStart) : "--:--"}
                  </span>

                  {/* Mark Out */}
                  <button
                    onClick={() => setClipEnd(Math.floor(currentTimeRef.current))}
                    className="flex items-center gap-1.5 border border-teal text-teal px-3 py-1.5 rounded-lg text-[11px] font-oswald uppercase tracking-wider hover:bg-teal/5 transition-colors"
                  >
                    <Scissors size={12} />
                    Mark Out
                  </button>
                  <span className="text-[11px] font-mono text-navy min-w-[56px]">
                    Out: {clipEnd !== null ? formatTimestamp(clipEnd) : "--:--"}
                  </span>

                  {/* Divider */}
                  <div className="w-px h-5 bg-border mx-1 hidden sm:block" />

                  {/* Title input */}
                  <input
                    type="text"
                    value={clipTitle}
                    onChange={(e) => setClipTitle(e.target.value)}
                    placeholder="Clip title..."
                    className="flex-1 min-w-[120px] border border-border rounded-lg px-2.5 py-1.5 text-xs text-navy focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
                  />

                  {/* Save Clip */}
                  <button
                    onClick={handleSaveClip}
                    disabled={clipStart === null || clipEnd === null || savingClip}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-oswald uppercase tracking-wider transition-colors ${
                      clipStart !== null && clipEnd !== null && !savingClip
                        ? "bg-teal text-white hover:bg-teal/90"
                        : "bg-border text-muted/50 cursor-not-allowed"
                    }`}
                  >
                    {savingClip ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Save size={12} />
                    )}
                    Save Clip
                  </button>
                </div>
              </div>
            )}

            {/* PXI Report Display (generating spinner or completed report) */}
            {generating && (
              <div className="bg-white rounded-xl border border-border p-6 flex items-center justify-center gap-3">
                <Loader2 size={20} className="animate-spin text-teal" />
                <span className="text-sm text-muted font-oswald uppercase tracking-wider">Generating analysis...</span>
              </div>
            )}

            {generatedReport && !generating && (
              <div className="bg-white rounded-xl border border-border overflow-hidden">
                <button
                  onClick={() => setReportExpanded(!reportExpanded)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-navy/[0.02] transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Sparkles size={14} className="text-orange" />
                    <span className="text-xs font-oswald uppercase tracking-wider text-navy">
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
                      className="flex items-center gap-1 text-[10px] text-muted hover:text-teal transition-colors font-oswald uppercase tracking-wider"
                      title="Regenerate with a different report type"
                    >
                      <RefreshCw size={10} />
                      Regenerate
                    </button>
                    {reportExpanded ? <ChevronDown size={14} className="text-muted" /> : <ChevronRight size={14} className="text-muted" />}
                  </div>
                </button>
                {reportExpanded && (
                  <div className="border-t border-border px-4 py-4">
                    <div className="border-l-3 border-teal pl-4 text-sm text-navy leading-relaxed whitespace-pre-wrap">
                      {generatedReport.output_text}
                    </div>
                    <div className="mt-3 flex justify-end">
                      <Link
                        href={`/reports/${generatedReport.id}`}
                        className="text-[10px] font-oswald uppercase tracking-wider text-teal hover:text-teal/80 transition-colors flex items-center gap-1"
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
              <div className="bg-white rounded-xl border border-border p-4">
                <h3 className="text-xs font-oswald uppercase tracking-wider text-navy mb-3">
                  Comments
                </h3>

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
                    className="flex-1 border border-border rounded-lg px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
                  />
                  <button
                    onClick={handleSubmitComment}
                    disabled={submittingComment || !commentText.trim()}
                    className={`px-3 py-2 rounded-lg transition-colors ${
                      submittingComment || !commentText.trim()
                        ? "bg-border text-muted/50 cursor-not-allowed"
                        : "bg-teal text-white hover:bg-teal/90"
                    }`}
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
                  <p className="text-[11px] text-muted/50 text-center py-4">
                    No comments yet.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {comments.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-start justify-between gap-2 py-2 border-b border-border last:border-0"
                      >
                        <div className="min-w-0">
                          <p className="text-sm text-navy">{c.comment_text}</p>
                          <div className="flex items-center gap-2 mt-1">
                            {c.timestamp_seconds !== null && (
                              <span className="flex items-center gap-1 text-[10px] text-teal font-mono">
                                <Clock size={10} />
                                {formatTimestamp(c.timestamp_seconds)}
                              </span>
                            )}
                            <span className="text-[10px] text-muted">
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

          {/* RIGHT PANEL — 35% (order-2 on mobile — between video and comments) */}
          <div className="w-full lg:w-[35%] flex flex-col gap-4 order-2">
            {/* Session info */}
            <div className="bg-white rounded-xl border border-border p-4">
              <h3 className="text-xs font-oswald uppercase tracking-wider text-navy mb-2">
                Session Info
              </h3>
              {session.description && (
                <p className="text-sm text-muted mb-2">{session.description}</p>
              )}
              <div className="text-[11px] text-muted/60">
                Status: {session.status || "active"}
              </div>
            </div>

            {/* Clip Panel */}
            <ClipPanel
              sessionId={sessionId}
              uploadId={upload?.id || ""}
              getCurrentTime={getCurrentTime}
              refreshKey={clipRefreshKey}
            />

            {/* Game Plan Links */}
            <div className="bg-white rounded-xl border border-border p-4">
              <h3 className="text-xs font-oswald uppercase tracking-wider text-navy mb-2 flex items-center gap-1.5">
                <FileText size={13} />
                Game Plan Links
              </h3>
              <p className="text-[11px] text-muted/50 text-center py-4">
                No linked game plans yet.
              </p>
            </div>
          </div>

          {/* MOBILE COMMENTS — order-3 (only visible below lg) */}
          <div className="lg:hidden order-3 w-full">
            <div className="bg-white rounded-xl border border-border p-4">
              <h3 className="text-xs font-oswald uppercase tracking-wider text-navy mb-3">
                Comments
              </h3>

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
                  className="flex-1 border border-border rounded-lg px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
                />
                <button
                  onClick={handleSubmitComment}
                  disabled={submittingComment || !commentText.trim()}
                  className={`px-3 py-2 rounded-lg transition-colors ${
                    submittingComment || !commentText.trim()
                      ? "bg-border text-muted/50 cursor-not-allowed"
                      : "bg-teal text-white hover:bg-teal/90"
                  }`}
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
                <p className="text-[11px] text-muted/50 text-center py-4">
                  No comments yet.
                </p>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {comments.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-start justify-between gap-2 py-2 border-b border-border last:border-0"
                    >
                      <div className="min-w-0">
                        <p className="text-sm text-navy">{c.comment_text}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {c.timestamp_seconds !== null && (
                            <span className="flex items-center gap-1 text-[10px] text-teal font-mono">
                              <Clock size={10} />
                              {formatTimestamp(c.timestamp_seconds)}
                            </span>
                          )}
                          <span className="text-[10px] text-muted">
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
      </main>
    </ProtectedRoute>
  );
}
