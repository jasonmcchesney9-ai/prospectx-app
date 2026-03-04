"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  Swords,
  ArrowLeft,
  Save,
  ChevronDown,
  ChevronUp,
  PenTool,
  Trash2,
  Loader2,
  Eye,
  EyeOff,
  Sparkles,
  Mic,
  Target,
  ShieldCheck,
  Trophy,
  AlertTriangle,
  MessageSquare,
  Scissors,
  Play,
  Clock,
  Plus,
  X,
  Film,
  Link2,
  Unlink,
  Zap,
} from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import api from "@/lib/api";
import type { ChalkTalkSession } from "@/types/api";
import type { RinkDiagramData } from "@/types/rink";
import type { BackgroundMode, RinkCanvasHandle } from "@/components/RinkCanvas";

/* ── Lazy-load RinkCanvas (SSR-safe) ─────────────────────── */
const RinkCanvas = dynamic(() => import("@/components/RinkCanvas"), { ssr: false });

/* ── Constants ────────────────────────────────────────────── */
const STATUS_LABELS: Record<string, string> = { draft: "Draft", active: "Active", completed: "Completed" };
const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600 border-gray-200",
  active: "bg-green-100 text-green-700 border-green-200",
  completed: "bg-blue-100 text-blue-700 border-blue-200",
};
const STATUS_ORDER = ["draft", "active", "completed"] as const;

interface SimpleTeam { id: string; name: string; }

/* ================================================================
   WAR ROOM — Session Detail Page
   ================================================================ */
export default function SessionDetailPage() {
  return (
    <ProtectedRoute>
      <NavBar />
      <main className="min-h-screen" style={{ background: "#F0F4F8" }}>
        <WarRoom />
      </main>
    </ProtectedRoute>
  );
}

function WarRoom() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const sessionId = params.id as string;
  const pxiPreLoaded = searchParams.get("pxi") === "1";

  /* ── Loading / error state ─────────────────────────────── */
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  /* ── Teams ─────────────────────────────────────────────── */
  const [teams, setTeams] = useState<SimpleTeam[]>([]);
  useEffect(() => {
    api.get<SimpleTeam[]>("/teams").then(({ data }) => setTeams(data)).catch(() => {});
  }, []);

  /* ── Session data ──────────────────────────────────────── */
  const [sessionType, setSessionType] = useState("Pre-Game");
  const [status, setStatus] = useState("draft");
  const [teamId, setTeamId] = useState("");
  const [opponentTeamId, setOpponentTeamId] = useState("");
  const [gameDate, setGameDate] = useState("");
  const [chalkTalkId, setChalkTalkId] = useState("");
  const [boardName, setBoardName] = useState("");

  const [forecheck, setForecheck] = useState("");
  const [breakout, setBreakout] = useState("");
  const [defensiveSystem, setDefensiveSystem] = useState("");

  const [opponentAnalysis, setOpponentAnalysis] = useState("");
  const [ourStrategy, setOurStrategy] = useState("");
  const [specialTeamsPlan, setSpecialTeamsPlan] = useState("");
  const [keysToGame, setKeysToGame] = useState("");

  const [pregameSpeech, setPregameSpeech] = useState("");
  const [postgameWin, setPostgameWin] = useState("");
  const [postgameLoss, setPostgameLoss] = useState("");

  /* ── Canvas state ──────────────────────────────────────── */
  const [canvasExpanded, setCanvasExpanded] = useState(true);
  const [boardData, setBoardData] = useState<RinkDiagramData | null>(null);
  const [bgMode, setBgMode] = useState<BackgroundMode>("full_rink");
  const [canvasKey, setCanvasKey] = useState(0);
  const [boardSaving, setBoardSaving] = useState(false);
  const canvasRef = useRef<RinkCanvasHandle | null>(null);

  /* ── Linked Film Clips state ─────────────────────────── */
  const [linkedClips, setLinkedClips] = useState<{ id: string; title: string; description?: string | null; start_time_seconds: number; end_time_seconds: number; session_id?: string; link_id?: string }[]>([]);
  const [showClipModal, setShowClipModal] = useState(false);
  const [availableClips, setAvailableClips] = useState<{ id: string; title: string; start_time_seconds: number; end_time_seconds: number; session_id?: string }[]>([]);
  const [clipSearchLoading, setClipSearchLoading] = useState(false);

  /* ── Derived ───────────────────────────────────────────── */
  const teamName = teams.find((t) => t.id === teamId)?.name || "";
  const opponentName = teams.find((t) => t.id === opponentTeamId)?.name || "";
  const displayDate = gameDate ? new Date(gameDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }) : "";

  /* ── Fetch session on mount ────────────────────────────── */
  useEffect(() => {
    async function load() {
      try {
        const { data } = await api.get<ChalkTalkSession>(`/chalk-talk-sessions/${sessionId}`);
        setSessionType(data.session_type || "Pre-Game");
        setStatus(data.status || "draft");
        setTeamId(data.team_id || "");
        setOpponentTeamId(data.opponent_team_id || "");
        setGameDate(data.game_date || "");
        setChalkTalkId(data.chalk_talk_id || "");
        setBoardName(data.board_name || "");
        setForecheck(data.forecheck || "");
        setBreakout(data.breakout || "");
        setDefensiveSystem(data.defensive_system || "");
        setOpponentAnalysis(data.opponent_analysis || "");
        setOurStrategy(data.our_strategy || "");
        setSpecialTeamsPlan(data.special_teams_plan || "");
        setKeysToGame(data.keys_to_game || "");
        setPregameSpeech(data.pregame_speech || "");
        setPostgameWin(data.postgame_win_message || "");
        setPostgameLoss(data.postgame_loss_message || "");

        /* Load board if linked */
        if (data.chalk_talk_id) {
          try {
            const boardRes = await api.get(`/chalk-talks/${data.chalk_talk_id}`);
            const layout = boardRes.data?.board_layout;
            if (layout) {
              const parsed = typeof layout === "string" ? JSON.parse(layout) : layout;
              if (parsed.background && ["full_rink", "half_rink", "blank"].includes(parsed.background)) {
                setBgMode(parsed.background as BackgroundMode);
              }
              setBoardData(parsed);
              setCanvasKey((k) => k + 1);
            }
          } catch { /* board load failed — show blank canvas */ }
        }
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [sessionId]);

  /* ── Status toggle ─────────────────────────────────────── */
  const cycleStatus = async () => {
    const idx = STATUS_ORDER.indexOf(status as typeof STATUS_ORDER[number]);
    const next = STATUS_ORDER[(idx + 1) % STATUS_ORDER.length];
    setStatus(next);
    try {
      await api.patch(`/chalk-talk-sessions/${sessionId}`, { status: next });
    } catch {
      setStatus(status);
    }
  };

  /* ── Delete ────────────────────────────────────────────── */
  const handleDelete = async () => {
    if (!confirm("Delete this session? The linked whiteboard will be preserved.")) return;
    setDeleting(true);
    try {
      await api.delete(`/chalk-talk-sessions/${sessionId}`);
      router.push("/chalk-talk/sessions");
    } catch {
      setError("Failed to delete session");
      setDeleting(false);
    }
  };

  /* ── Save board ────────────────────────────────────────── */
  const handleSaveBoard = useCallback(async (data: RinkDiagramData, svgString: string) => {
    setBoardSaving(true);
    try {
      const layoutPayload = JSON.stringify({ ...data, background: bgMode });
      if (chalkTalkId) {
        await api.patch(`/chalk-talks/${chalkTalkId}`, { board_layout: layoutPayload });
      } else {
        const res = await api.post("/chalk-talks", {
          name: `${teamName || "Session"} Board`,
          board_layout: layoutPayload,
          team_id: teamId || undefined,
        });
        const newId = res.data?.id;
        if (newId) {
          setChalkTalkId(newId);
          await api.patch(`/chalk-talk-sessions/${sessionId}`, { chalk_talk_id: newId });
        }
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch {
      setError("Failed to save board");
    } finally {
      setBoardSaving(false);
    }
  }, [chalkTalkId, bgMode, teamName, teamId, sessionId]);

  /* ── Linked Film Clips functions ─────────────────────── */
  const loadLinkedClips = useCallback(async () => {
    try {
      const { data } = await api.get(`/chalk-talk-sessions/${sessionId}/clips`);
      setLinkedClips(Array.isArray(data) ? data : []);
    } catch { /* ignore */ }
  }, [sessionId]);

  useEffect(() => { loadLinkedClips(); }, [loadLinkedClips]);

  const openClipModal = async () => {
    setShowClipModal(true);
    setClipSearchLoading(true);
    try {
      const { data } = await api.get("/film/clips", { params: { limit: 100 } });
      const all = Array.isArray(data) ? data : [];
      const linkedIds = new Set(linkedClips.map((c) => c.id));
      setAvailableClips(all.filter((c: { id: string }) => !linkedIds.has(c.id)));
    } catch { /* ignore */ }
    finally { setClipSearchLoading(false); }
  };

  const handleLinkClip = async (clipId: string) => {
    try {
      await api.post(`/chalk-talk-sessions/${sessionId}/clips`, { clip_id: clipId });
      setAvailableClips((prev) => prev.filter((c) => c.id !== clipId));
      loadLinkedClips();
    } catch { /* ignore */ }
  };

  const handleUnlinkClip = async (clipId: string) => {
    try {
      await api.delete(`/chalk-talk-sessions/${sessionId}/clips/${clipId}`);
      setLinkedClips((prev) => prev.filter((c) => c.id !== clipId));
    } catch { /* ignore */ }
  };

  const fmtTime = (s: number): string => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  /* ── Parse keys to game into structured list ───────────── */
  const keysList = keysToGame
    ? keysToGame.split("\n").filter((l) => l.trim()).map((line) => {
        const cleaned = line.replace(/^\d+[\.\)]\s*/, "").trim();
        const dashIdx = cleaned.indexOf(" - ");
        if (dashIdx > 0) {
          return { title: cleaned.substring(0, dashIdx).trim(), note: cleaned.substring(dashIdx + 3).trim() };
        }
        return { title: cleaned, note: "" };
      })
    : [];

  /* ── Parse opponent analysis into threats ───────────────── */
  const threatLines = opponentAnalysis
    ? opponentAnalysis.split("\n").filter((l) => l.trim())
    : [];

  /* ── Loading / not found ───────────────────────────────── */
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={28} className="animate-spin" style={{ color: "#0D9488" }} />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="text-center py-20">
        <h2 className="text-xl font-bold mb-2" style={{ color: "#0F2942", fontFamily: "Oswald, sans-serif" }}>Session Not Found</h2>
        <Link href="/chalk-talk/sessions" className="text-sm hover:underline" style={{ color: "#0D9488" }}>
          ← Back to Sessions
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

      {/* ═══════════════════════════════════════════════════════
          1. SESSION HEADER — white bar
          ═══════════════════════════════════════════════════════ */}
      <div className="px-5 py-4 flex items-center justify-between mb-4" style={{ borderRadius: 12, border: "1.5px solid #DDE6EF", background: "#0F2942" }}>
        <div className="flex items-center gap-3">
          <Link href="/chalk-talk/sessions" className="hover:opacity-70 transition-opacity" style={{ color: "rgba(255,255,255,0.6)" }}>
            <ArrowLeft size={20} />
          </Link>
          <span
            className="px-2.5 py-1 rounded-md text-white font-bold uppercase"
            style={{ fontSize: 10, fontFamily: "ui-monospace, monospace", letterSpacing: 2, background: "#0D9488" }}
          >
            {sessionType}
          </span>
          <div>
            <h1 className="text-lg font-bold text-white">
              {teamName || "Untitled"}{opponentName ? ` vs ${opponentName}` : ""}
            </h1>
            {displayDate && <p className="text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>{displayDate}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={cycleStatus}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase border transition-colors ${STATUS_COLORS[status] || STATUS_COLORS.draft}`}
            style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 1 }}
            title="Click to cycle status"
          >
            {STATUS_LABELS[status] || status}
          </button>
          <Link
            href={`/chalk-talk/sessions/${sessionId}/edit`}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold uppercase transition-colors"
            style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 1, color: "#FFFFFF", border: "1.5px solid rgba(255,255,255,0.2)" }}
          >
            <PenTool size={12} />
            Edit Session
          </Link>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="p-2 rounded-lg transition-colors disabled:opacity-30"
            style={{ color: "rgba(255,255,255,0.5)" }}
            title="Delete session"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          ACTION BAR — 4 quick-action buttons
          ═══════════════════════════════════════════════════════ */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <button
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold uppercase transition-colors hover:opacity-90"
          style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 1, background: "rgba(13,148,136,0.1)", color: "#0D9488", border: "1.5px solid rgba(13,148,136,0.2)" }}
          title="Analyse this game plan with PXI"
          onClick={() => {
            const ctx = `Analyse my game plan: ${teamName} vs ${opponentName} on ${displayDate}. Forecheck: ${forecheck || "—"}, Breakout: ${breakout || "—"}, Defensive: ${defensiveSystem || "—"}. Opponent analysis: ${opponentAnalysis || "none"}. Our strategy: ${ourStrategy || "none"}. Keys to game: ${keysToGame || "none"}.`;
            window.open(`/bench-talk?prefill=${encodeURIComponent(ctx)}`, "_blank");
          }}
        >
          <Sparkles size={12} />
          PXI Analyse
        </button>
        <Link
          href={`/chalk-talk/sessions/${sessionId}/edit`}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold uppercase transition-colors hover:opacity-90"
          style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 1, background: "rgba(15,41,66,0.06)", color: "#0F2942", border: "1.5px solid #DDE6EF" }}
        >
          <PenTool size={12} />
          Edit Plan
        </Link>
        <button
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold uppercase transition-colors hover:opacity-90"
          style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 1, background: "rgba(15,41,66,0.06)", color: "#0F2942", border: "1.5px solid #DDE6EF" }}
          title="Export game plan"
          onClick={() => window.print()}
        >
          <Save size={12} />
          Export
        </button>
        <button
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold uppercase transition-colors hover:opacity-90"
          style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 1, background: "rgba(234,88,12,0.08)", color: "#EA580C", border: "1.5px solid rgba(234,88,12,0.2)" }}
          title="Link a film clip to this game plan"
          onClick={openClipModal}
        >
          <Film size={12} />
          Link Film Clip
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl text-sm" style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#B91C1C" }}>
          {error}
        </div>
      )}
      {saveSuccess && (
        <div className="mb-4 px-4 py-3 rounded-xl text-sm" style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", color: "#15803D" }}>
          Saved successfully.
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          2. CANVAS SECTION — collapsible
          ═══════════════════════════════════════════════════════ */}
      <div className="mb-4 overflow-hidden" style={{ borderRadius: 12, border: "1.5px solid #DDE6EF", borderBottom: "2px solid #0D9488" }}>
        {/* Canvas toolbar bar */}
        <div className="flex items-center justify-between px-5 py-3" style={{ background: "#0F2942", borderBottom: canvasExpanded ? "1px solid #DDE6EF" : "none" }}>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ background: "#0D9488" }} />
            <span
              className="font-bold uppercase text-white"
              style={{ fontSize: 10, fontFamily: "ui-monospace, monospace", letterSpacing: 2 }}
            >
              BOARD
            </span>
            {boardName && <span className="text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>— {boardName}</span>}
          </div>
          <button
            onClick={() => setCanvasExpanded(!canvasExpanded)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-colors hover:opacity-80"
            style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 1, color: "rgba(255,255,255,0.8)", border: "1px solid rgba(255,255,255,0.2)" }}
          >
            {canvasExpanded ? <><EyeOff size={12} /> Collapse</> : <><Eye size={12} /> Expand Canvas</>}
          </button>
        </div>

        {/* Canvas area */}
        {canvasExpanded && (
          <div style={{ height: 400 }}>
            <RinkCanvas
              key={canvasKey}
              ref={canvasRef}
              initialData={boardData || undefined}
              editable
              showToolbar
              backgroundMode={bgMode}
              onBackgroundModeChange={setBgMode}
              onSave={handleSaveBoard}
              className="w-full h-full"
            />
          </div>
        )}

        {/* Below canvas: My Boards + Save Board */}
        {canvasExpanded && (
          <div className="flex items-center justify-between px-5 py-3" style={{ borderTop: "1px solid #DDE6EF" }}>
            <Link
              href="/rink-builder"
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold uppercase transition-colors hover:opacity-80"
              style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 1, color: "#0F2942", border: "1.5px solid #DDE6EF" }}
            >
              My Boards
            </Link>
            <button
              onClick={() => {
                if (canvasRef.current) {
                  const data = canvasRef.current.getDiagramData();
                  const svg = canvasRef.current.getSvgString();
                  handleSaveBoard(data, svg);
                }
              }}
              disabled={boardSaving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-white text-xs font-bold uppercase transition-colors hover:opacity-90 disabled:opacity-50"
              style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 1, background: "#0D9488" }}
            >
              {boardSaving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              Save Board
            </button>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════
          4. INTELLIGENCE GRID — 2×2
          ═══════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* ── TOP LEFT: Opponent Intelligence ─────────────── */}
        <div className="overflow-hidden" style={{ borderRadius: 12, border: "1.5px solid #DDE6EF", borderLeft: "3px solid #EA580C", borderBottom: "2px solid #EA580C" }}>
          {/* Dark navy header */}
          <div className="flex items-center justify-between px-5 py-3" style={{ background: "#0F2942" }}>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ background: "#F97316" }} />
              <span
                className="font-bold uppercase text-white"
                style={{ fontSize: 10, fontFamily: "ui-monospace, monospace", letterSpacing: 2 }}
              >
                OPPONENT INTELLIGENCE
              </span>
            </div>
            <button
              className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold uppercase transition-colors hover:opacity-80"
              style={{ fontFamily: "ui-monospace, monospace", fontSize: 9, letterSpacing: 1, color: "#0D9488", background: "rgba(13,148,136,0.15)" }}
              title="PXI Analyse — coming soon"
            >
              <Sparkles size={10} /> PXI ANALYSE
            </button>
          </div>
          {/* Body */}
          <div className="bg-white px-5 py-4">
            {pxiPreLoaded && opponentAnalysis && (
              <div className="flex items-center gap-1.5 mb-3 px-2.5 py-1.5 rounded-md" style={{ background: "rgba(13,148,136,0.06)" }}>
                <Zap size={10} className="text-teal" />
                <span className="text-[10px] font-medium text-teal">PXI Pre-loaded · Edit to customize</span>
              </div>
            )}
            {opponentAnalysis ? (
              <div className="space-y-3">
                <p className="text-sm leading-relaxed" style={{ color: "#0F2942" }}>{opponentAnalysis}</p>
                {threatLines.length > 1 && (
                  <div>
                    <p className="font-bold uppercase mb-2" style={{ fontSize: 10, fontFamily: "ui-monospace, monospace", letterSpacing: 2, color: "#5A7291" }}>
                      KEY THREATS
                    </p>
                    <div className="space-y-1.5">
                      {threatLines.slice(0, 5).map((line, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" style={{ color: "#EA580C" }} />
                          <span className="text-xs" style={{ color: "#0F2942" }}>{line.replace(/^[-•]\s*/, "")}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm italic" style={{ color: "#8BA4BB" }}>No opponent analysis entered yet. Edit session to add.</p>
            )}
          </div>
        </div>

        {/* ── TOP RIGHT: Our System ───────────────────────── */}
        <div className="overflow-hidden" style={{ borderRadius: 12, border: "1.5px solid #DDE6EF", borderLeft: "3px solid #0D9488", borderBottom: "2px solid #0D9488" }}>
          {/* Navy header */}
          <div className="flex items-center justify-between px-5 py-3" style={{ background: "#0F2942" }}>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ background: "#0D9488" }} />
              <span
                className="font-bold uppercase text-white"
                style={{ fontSize: 10, fontFamily: "ui-monospace, monospace", letterSpacing: 2 }}
              >
                OUR SYSTEM
              </span>
            </div>
            <button
              className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold uppercase transition-colors hover:opacity-80"
              style={{ fontFamily: "ui-monospace, monospace", fontSize: 9, letterSpacing: 1, color: "#0D9488", background: "rgba(13,148,136,0.15)" }}
              title="PXI Recommend — coming soon"
            >
              <Sparkles size={10} /> PXI RECOMMEND
            </button>
          </div>
          {/* Body: 3 system cards */}
          <div className="bg-white px-5 py-4">
            <div className="grid grid-cols-3 gap-3 mb-4">
              <SystemCard icon={<Target size={14} style={{ color: "#0D9488" }} />} label="Forecheck" value={forecheck} accentColor="#0D9488" />
              <SystemCard icon={<ArrowLeft size={14} className="rotate-180" style={{ color: "#EA580C" }} />} label="Breakout" value={breakout} accentColor="#EA580C" />
              <SystemCard icon={<ShieldCheck size={14} style={{ color: "#0D9488" }} />} label="Defensive" value={defensiveSystem} accentColor="#0D9488" />
            </div>
            {ourStrategy ? (
              <div>
                <p className="font-bold uppercase mb-1.5" style={{ fontSize: 10, fontFamily: "ui-monospace, monospace", letterSpacing: 2, color: "#5A7291" }}>
                  MATCHUP PRIORITY
                </p>
                <p className="text-xs leading-relaxed" style={{ color: "#0F2942" }}>{ourStrategy}</p>
              </div>
            ) : (
              <p className="text-xs italic" style={{ color: "#8BA4BB" }}>No strategy notes entered yet.</p>
            )}
          </div>
        </div>

        {/* ── BOTTOM LEFT: Keys to the Game ───────────────── */}
        <div className="overflow-hidden" style={{ borderRadius: 12, border: "1.5px solid #DDE6EF", borderLeft: "3px solid #EA580C", borderBottom: "2px solid #EA580C" }}>
          {/* Navy header */}
          <div className="flex items-center justify-between px-5 py-3" style={{ background: "#0F2942" }}>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ background: "#F97316" }} />
              <span
                className="font-bold uppercase text-white"
                style={{ fontSize: 10, fontFamily: "ui-monospace, monospace", letterSpacing: 2 }}
              >
                KEYS TO THE GAME
              </span>
            </div>
            <button
              className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold uppercase transition-colors hover:opacity-80"
              style={{ fontFamily: "ui-monospace, monospace", fontSize: 9, letterSpacing: 1, color: "#0D9488", background: "rgba(13,148,136,0.15)" }}
              title="PXI Generate — coming soon"
            >
              <Sparkles size={10} /> PXI GENERATE
            </button>
          </div>
          {/* Body */}
          <div className="bg-white px-5 py-4">
            {pxiPreLoaded && keysList.length > 0 && (
              <div className="flex items-center gap-1.5 mb-3 px-2.5 py-1.5 rounded-md" style={{ background: "rgba(13,148,136,0.06)" }}>
                <Zap size={10} className="text-teal" />
                <span className="text-[10px] font-medium text-teal">PXI Pre-loaded · Edit to customize</span>
              </div>
            )}
            {keysList.length > 0 ? (
              <div className="space-y-3">
                {keysList.map((k, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span
                      className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-white font-bold"
                      style={{ fontSize: 11, fontFamily: "ui-monospace, monospace", background: "#0D9488" }}
                    >
                      {i + 1}
                    </span>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: "#0F2942" }}>{k.title}</p>
                      {k.note && <p className="text-xs mt-0.5" style={{ color: "#5A7291" }}>{k.note}</p>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm italic" style={{ color: "#8BA4BB" }}>No keys entered yet. Edit session to add.</p>
            )}
          </div>
        </div>

        {/* ── BOTTOM RIGHT: Talking Points ────────────────── */}
        <div className="overflow-hidden" style={{ borderRadius: 12, border: "1.5px solid #DDE6EF", borderLeft: "3px solid #0D9488", borderBottom: "2px solid #0D9488" }}>
          {/* Dark navy header */}
          <div className="flex items-center justify-between px-5 py-3" style={{ background: "#0F2942" }}>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ background: "#0D9488" }} />
              <span
                className="font-bold uppercase text-white"
                style={{ fontSize: 10, fontFamily: "ui-monospace, monospace", letterSpacing: 2 }}
              >
                TALKING POINTS
              </span>
            </div>
            <button
              className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold uppercase transition-colors hover:opacity-80"
              style={{ fontFamily: "ui-monospace, monospace", fontSize: 9, letterSpacing: 1, color: "#0D9488", background: "rgba(13,148,136,0.15)" }}
              title="PXI Speech — coming soon"
            >
              <Mic size={10} /> PXI SPEECH
            </button>
          </div>
          {/* Body */}
          <div className="bg-white px-5 py-4 space-y-4">
            {pxiPreLoaded && pregameSpeech && (
              <div className="flex items-center gap-1.5 mb-1 px-2.5 py-1.5 rounded-md" style={{ background: "rgba(13,148,136,0.06)" }}>
                <Zap size={10} className="text-teal" />
                <span className="text-[10px] font-medium text-teal">PXI Pre-loaded · Edit to customize</span>
              </div>
            )}
            {/* Pre-Game Speech */}
            <div>
              {pregameSpeech ? (
                <div className="rounded-lg px-4 py-3" style={{ borderLeft: "3px solid #EA580C", background: "#FFFBF5" }}>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <MessageSquare size={10} style={{ color: "#EA580C" }} />
                    <span className="font-bold uppercase" style={{ fontSize: 9, fontFamily: "ui-monospace, monospace", letterSpacing: 1, color: "#EA580C" }}>
                      PRE-GAME SPEECH
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-white font-bold uppercase" style={{ fontSize: 8, fontFamily: "ui-monospace, monospace", background: "#EA580C" }}>
                      PXI-GENERATED
                    </span>
                  </div>
                  <p className="text-sm italic leading-relaxed" style={{ color: "#0F2942" }}>{pregameSpeech}</p>
                </div>
              ) : (
                <div className="rounded-lg px-4 py-3" style={{ borderLeft: "3px solid #DDE6EF", background: "#F8FAFC" }}>
                  <p className="text-xs font-bold uppercase mb-1" style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 1, color: "#8BA4BB" }}>PRE-GAME SPEECH</p>
                  <p className="text-xs italic" style={{ color: "#8BA4BB" }}>Not yet written. Edit session or use PXI Speech.</p>
                </div>
              )}
            </div>

            {/* Post-Game Win */}
            <div>
              {postgameWin ? (
                <div className="rounded-lg px-4 py-3" style={{ borderLeft: "3px solid #16A34A", background: "#F0FDF4" }}>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Trophy size={10} style={{ color: "#16A34A" }} />
                    <span className="font-bold uppercase" style={{ fontSize: 9, fontFamily: "ui-monospace, monospace", letterSpacing: 1, color: "#16A34A" }}>
                      POST-GAME WIN
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: "#0F2942" }}>{postgameWin}</p>
                </div>
              ) : (
                <div className="rounded-lg px-4 py-3" style={{ borderLeft: "3px solid #DDE6EF", background: "#F8FAFC" }}>
                  <p className="text-xs font-bold uppercase mb-1" style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 1, color: "#8BA4BB" }}>POST-GAME WIN</p>
                  <p className="text-xs italic" style={{ color: "#8BA4BB" }}>Not yet written.</p>
                </div>
              )}
            </div>

            {/* Post-Game Loss */}
            <div>
              {postgameLoss ? (
                <div className="rounded-lg px-4 py-3" style={{ borderLeft: "3px solid #DC2626", background: "#FEF2F2" }}>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className="font-bold" style={{ fontSize: 10, color: "#DC2626" }}>L</span>
                    <span className="font-bold uppercase" style={{ fontSize: 9, fontFamily: "ui-monospace, monospace", letterSpacing: 1, color: "#DC2626" }}>
                      POST-GAME LOSS
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: "#0F2942" }}>{postgameLoss}</p>
                </div>
              ) : (
                <div className="rounded-lg px-4 py-3" style={{ borderLeft: "3px solid #DDE6EF", background: "#F8FAFC" }}>
                  <p className="text-xs font-bold uppercase mb-1" style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 1, color: "#8BA4BB" }}>POST-GAME LOSS</p>
                  <p className="text-xs italic" style={{ color: "#8BA4BB" }}>Not yet written.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Film Clips Section ──────────────────────────────── */}
        <div className="mt-4 rounded-xl overflow-hidden" style={{ border: "1.5px solid #DDE6EF", borderLeft: "3px solid #EA580C", background: "#FFFFFF" }}>
          <div className="px-5 py-3 flex items-center justify-between" style={{ background: "#0F2942" }}>
            <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2" style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 2, color: "#FFFFFF" }}>
              <Film size={14} style={{ color: "#F97316" }} />
              Film Clips
              {linkedClips.length > 0 && (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: "rgba(13,148,136,0.15)", color: "#0D9488" }}>
                  {linkedClips.length}
                </span>
              )}
            </h3>
            <button
              onClick={openClipModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-colors"
              style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 1, background: "rgba(255,255,255,0.1)", color: "#FFFFFF" }}
            >
              <Plus size={12} />
              Link Clip
            </button>
          </div>
          <div className="p-5">
            {linkedClips.length === 0 ? (
              <div className="text-center py-6">
                <Scissors size={24} className="mx-auto mb-2" style={{ color: "#DDE6EF" }} />
                <p className="text-xs" style={{ color: "#8BA4BB" }}>No film clips linked to this session yet.</p>
                <p className="text-[10px] mt-1" style={{ color: "#B8C9DA" }}>
                  Link clips from the Film Room to reference during game prep.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {linkedClips.map((clip) => (
                  <div
                    key={clip.id}
                    className="flex items-center justify-between gap-3 py-2.5 px-3 rounded-lg transition-all"
                    style={{ border: "1px solid #E8EFF5" }}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: "#0F2942" }}>{clip.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="flex items-center gap-1 text-[10px] font-mono" style={{ color: "#0D9488" }}>
                            <Clock size={10} />
                            {fmtTime(clip.start_time_seconds)} — {fmtTime(clip.end_time_seconds)}
                          </span>
                          {clip.description && (
                            <span className="text-[10px] truncate" style={{ color: "#8BA4BB" }}>{clip.description}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {clip.session_id && (
                        <Link
                          href={`/film-room/sessions/${clip.session_id}?seek=${clip.start_time_seconds}`}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-colors"
                          style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 1, background: "rgba(13,148,136,0.08)", color: "#0D9488" }}
                        >
                          <Play size={10} />
                          Watch
                        </Link>
                      )}
                      <button
                        onClick={() => handleUnlinkClip(clip.id)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-colors hover:bg-red-50"
                        style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 1, color: "#8BA4BB" }}
                        title="Unlink clip"
                      >
                        <Unlink size={10} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Link Clip Modal ──────────────────────────────────── */}
        {showClipModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(15,41,66,0.5)" }}>
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4" style={{ border: "1.5px solid #DDE6EF" }}>
              <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid #DDE6EF" }}>
                <h3 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2" style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 2, color: "#0F2942" }}>
                  <Link2 size={14} style={{ color: "#0D9488" }} />
                  Link Film Clip
                </h3>
                <button onClick={() => setShowClipModal(false)} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
                  <X size={16} style={{ color: "#8BA4BB" }} />
                </button>
              </div>
              <div className="p-5 max-h-[400px] overflow-y-auto">
                {clipSearchLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 size={20} className="animate-spin" style={{ color: "#0D9488" }} />
                    <span className="ml-2 text-xs" style={{ color: "#8BA4BB" }}>Loading clips...</span>
                  </div>
                ) : availableClips.length === 0 ? (
                  <div className="text-center py-8">
                    <Scissors size={24} className="mx-auto mb-2" style={{ color: "#DDE6EF" }} />
                    <p className="text-xs" style={{ color: "#8BA4BB" }}>No available clips to link.</p>
                    <p className="text-[10px] mt-1" style={{ color: "#B8C9DA" }}>
                      Create clips in the Film Room first.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {availableClips.map((clip) => (
                      <div
                        key={clip.id}
                        className="flex items-center justify-between gap-3 py-2.5 px-3 rounded-lg transition-all hover:bg-teal/[0.02]"
                        style={{ border: "1px solid #E8EFF5" }}
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate" style={{ color: "#0F2942" }}>{clip.title}</p>
                          <span className="flex items-center gap-1 text-[10px] font-mono" style={{ color: "#0D9488" }}>
                            <Clock size={10} />
                            {fmtTime(clip.start_time_seconds)} — {fmtTime(clip.end_time_seconds)}
                          </span>
                        </div>
                        <button
                          onClick={() => handleLinkClip(clip.id)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-colors"
                          style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 1, background: "#0D9488", color: "#FFFFFF" }}
                        >
                          <Plus size={10} />
                          Link
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────────────── */

function SystemPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="font-bold uppercase" style={{ fontSize: 9, fontFamily: "ui-monospace, monospace", letterSpacing: 1, color: "#8BA4BB" }}>
        {label}
      </span>
      <span
        className="px-2.5 py-1 rounded-md font-bold"
        style={{ fontSize: 11, fontFamily: "ui-monospace, monospace", color: "#0D9488", background: "rgba(13,148,136,0.08)" }}
      >
        {value}
      </span>
    </div>
  );
}

function SystemCard({ icon, label, value, accentColor = "#0D9488" }: { icon: React.ReactNode; label: string; value: string; accentColor?: string }) {
  return (
    <div className="rounded-lg p-3" style={{ border: "1.5px solid #DDE6EF", borderLeft: `3px solid ${accentColor}` }}>
      <div className="flex items-center gap-1.5 mb-1.5">
        {icon}
        <span className="font-bold uppercase" style={{ fontSize: 9, fontFamily: "ui-monospace, monospace", letterSpacing: 1, color: "#5A7291" }}>
          {label}
        </span>
      </div>
      <p className="text-sm font-semibold" style={{ color: "#0F2942" }}>
        {value || <span className="italic font-normal" style={{ color: "#8BA4BB" }}>—</span>}
      </p>
    </div>
  );
}
