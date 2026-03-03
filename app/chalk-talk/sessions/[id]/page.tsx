"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
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
  Maximize2,
  Eye,
  EyeOff,
  Sparkles,
  Mic,
  Target,
  ShieldCheck,
  Trophy,
  AlertTriangle,
  MessageSquare,
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
  const sessionId = params.id as string;

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
      <div className="bg-white px-5 py-4 flex items-center justify-between mb-4" style={{ borderRadius: 12, border: "1.5px solid #DDE6EF" }}>
        <div className="flex items-center gap-3">
          <Link href="/chalk-talk/sessions" className="hover:opacity-70 transition-opacity" style={{ color: "#8BA4BB" }}>
            <ArrowLeft size={20} />
          </Link>
          <span
            className="px-2.5 py-1 rounded-md text-white font-bold uppercase"
            style={{ fontSize: 10, fontFamily: "ui-monospace, monospace", letterSpacing: 2, background: "#EA580C" }}
          >
            {sessionType}
          </span>
          <div>
            <h1 className="text-lg font-bold" style={{ color: "#0F2942" }}>
              {teamName || "Untitled"}{opponentName ? ` vs ${opponentName}` : ""}
            </h1>
            {displayDate && <p className="text-xs" style={{ color: "#8BA4BB" }}>{displayDate}</p>}
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
            style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 1, color: "#0F2942", border: "1.5px solid #DDE6EF" }}
          >
            <PenTool size={12} />
            Edit Session
          </Link>
          <a
            href={`/rink-builder?mode=chalk_talk&session_id=${sessionId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-white text-xs font-bold uppercase transition-colors hover:opacity-90"
            style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 1, background: "#0D9488" }}
          >
            <Maximize2 size={12} />
            Open Whiteboard
          </a>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="p-2 rounded-lg transition-colors disabled:opacity-30"
            style={{ color: "#8BA4BB" }}
            title="Delete session"
          >
            <Trash2 size={16} />
          </button>
        </div>
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
          2. SYSTEMS STRIP — white bar
          ═══════════════════════════════════════════════════════ */}
      <div className="bg-white px-5 py-3 flex items-center gap-3 flex-wrap mb-4" style={{ borderRadius: 12, border: "1.5px solid #DDE6EF" }}>
        <span
          className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${STATUS_COLORS[status] || STATUS_COLORS.draft}`}
          style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 1 }}
        >
          {STATUS_LABELS[status] || status}
        </span>
        {teamName && <SystemPill label="Team" value={teamName} />}
        {opponentName && <SystemPill label="Opponent" value={opponentName} />}
        {forecheck && <SystemPill label="Forecheck" value={forecheck} />}
        {breakout && <SystemPill label="Breakout" value={breakout} />}
        {defensiveSystem && <SystemPill label="Defence" value={defensiveSystem} />}
      </div>

      {/* ═══════════════════════════════════════════════════════
          3. CANVAS SECTION — collapsible
          ═══════════════════════════════════════════════════════ */}
      <div className="bg-white mb-4 overflow-hidden" style={{ borderRadius: 12, border: "1.5px solid #DDE6EF", borderBottom: "2px solid #0D9488" }}>
        {/* Canvas toolbar bar */}
        <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: canvasExpanded ? "1px solid #DDE6EF" : "none" }}>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ background: "#0D9488" }} />
            <span
              className="font-bold uppercase"
              style={{ fontSize: 10, fontFamily: "ui-monospace, monospace", letterSpacing: 2, color: "#0F2942" }}
            >
              BOARD
            </span>
            {boardName && <span className="text-xs" style={{ color: "#8BA4BB" }}>— {boardName}</span>}
          </div>
          <button
            onClick={() => setCanvasExpanded(!canvasExpanded)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-colors hover:opacity-80"
            style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 1, color: "#5A7291", border: "1px solid #DDE6EF" }}
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
        <div className="overflow-hidden" style={{ borderRadius: 12, border: "1.5px solid #DDE6EF", borderBottom: "2px solid #EA580C" }}>
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
        <div className="overflow-hidden" style={{ borderRadius: 12, border: "1.5px solid #DDE6EF", borderBottom: "2px solid #0D9488" }}>
          {/* White header */}
          <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: "1px solid #DDE6EF" }}>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ background: "#0D9488" }} />
              <span
                className="font-bold uppercase"
                style={{ fontSize: 10, fontFamily: "ui-monospace, monospace", letterSpacing: 2, color: "#0F2942" }}
              >
                OUR SYSTEM
              </span>
            </div>
            <button
              className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold uppercase transition-colors hover:opacity-80"
              style={{ fontFamily: "ui-monospace, monospace", fontSize: 9, letterSpacing: 1, color: "#0D9488", background: "rgba(13,148,136,0.08)" }}
              title="PXI Recommend — coming soon"
            >
              <Sparkles size={10} /> PXI RECOMMEND
            </button>
          </div>
          {/* Body: 3 system cards */}
          <div className="bg-white px-5 py-4">
            <div className="grid grid-cols-3 gap-3 mb-4">
              <SystemCard icon={<Target size={14} style={{ color: "#0D9488" }} />} label="Forecheck" value={forecheck} />
              <SystemCard icon={<ArrowLeft size={14} className="rotate-180" style={{ color: "#0D9488" }} />} label="Breakout" value={breakout} />
              <SystemCard icon={<ShieldCheck size={14} style={{ color: "#0D9488" }} />} label="Defensive" value={defensiveSystem} />
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
        <div className="overflow-hidden" style={{ borderRadius: 12, border: "1.5px solid #DDE6EF", borderBottom: "2px solid #0D9488" }}>
          {/* White header */}
          <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: "1px solid #DDE6EF" }}>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ background: "#0D9488" }} />
              <span
                className="font-bold uppercase"
                style={{ fontSize: 10, fontFamily: "ui-monospace, monospace", letterSpacing: 2, color: "#0F2942" }}
              >
                KEYS TO THE GAME
              </span>
            </div>
            <button
              className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold uppercase transition-colors hover:opacity-80"
              style={{ fontFamily: "ui-monospace, monospace", fontSize: 9, letterSpacing: 1, color: "#0D9488", background: "rgba(13,148,136,0.08)" }}
              title="PXI Generate — coming soon"
            >
              <Sparkles size={10} /> PXI GENERATE
            </button>
          </div>
          {/* Body */}
          <div className="bg-white px-5 py-4">
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
        <div className="overflow-hidden" style={{ borderRadius: 12, border: "1.5px solid #DDE6EF", borderBottom: "2px solid #EA580C" }}>
          {/* Dark navy header */}
          <div className="flex items-center justify-between px-5 py-3" style={{ background: "#0F2942" }}>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ background: "#F97316" }} />
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

function SystemCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg p-3" style={{ border: "1.5px solid #DDE6EF", borderBottom: "2px solid #0D9488" }}>
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
