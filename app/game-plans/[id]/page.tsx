"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Swords,
  ArrowLeft,
  Edit3,
  Save,
  X,
  Trash2,
  CheckCircle,
  Calendar,
  Target,
  Shield,
  Zap,
  MessageSquare,
  TrendingUp,
  TrendingDown,
  Printer,
  Download,
} from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import api from "@/lib/api";
import type { GamePlan, SessionType } from "@/types/api";
import { SESSION_TYPES, TACTICAL_OPTIONS } from "@/types/api";

// ── Talking-points JSON parser ───────────────────────────────
const parseTalkingPoints = (val: string | unknown): Record<string, string> => {
  if (typeof val === "object" && val !== null) return val as Record<string, string>;
  try { return JSON.parse(val as string); } catch { return {}; }
};

// ── Session-type badge colors ────────────────────────────────
const SESSION_TYPE_COLORS: Record<SessionType, string> = {
  pre_game: "bg-teal/10 text-teal",
  post_game: "bg-orange/10 text-orange",
  practice: "bg-navy/10 text-navy",
  season_notes: "bg-gray-100 text-gray-600",
};

export default function GamePlanDetailPage() {
  return (
    <ProtectedRoute>
      <NavBar />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <GamePlanDetail />
      </main>
    </ProtectedRoute>
  );
}

function GamePlanDetail() {
  const params = useParams();
  const router = useRouter();
  const planId = params.id as string;

  const [plan, setPlan] = useState<GamePlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [talkingPointsOpen, setTalkingPointsOpen] = useState(false);

  // Edit fields — includes all original + new fields
  const [editData, setEditData] = useState({
    team_name: "",
    opponent_team_name: "",
    game_date: "",
    opponent_analysis: "",
    our_strategy: "",
    special_teams_plan: "",
    keys_to_game: "",
    status: "draft" as string,
    session_type: "pre_game" as SessionType,
    forecheck: "",
    breakout: "",
    defensive_system: "",
    talking_points_preGame: "",
    talking_points_postGameWin: "",
    talking_points_postGameLoss: "",
    what_worked: "",
    what_didnt_work: "",
    game_result: "",
    game_score: "",
  });

  useEffect(() => {
    async function load() {
      try {
        const { data } = await api.get<GamePlan>(`/game-plans/${planId}`);
        setPlan(data);
        const tp = parseTalkingPoints(data.talking_points);
        setEditData({
          team_name: data.team_name,
          opponent_team_name: data.opponent_team_name,
          game_date: data.game_date || "",
          opponent_analysis: data.opponent_analysis || "",
          our_strategy: data.our_strategy || "",
          special_teams_plan: data.special_teams_plan || "",
          keys_to_game: data.keys_to_game || "",
          status: data.status,
          session_type: data.session_type || "pre_game",
          forecheck: data.forecheck || "",
          breakout: data.breakout || "",
          defensive_system: data.defensive_system || "",
          talking_points_preGame: tp.preGame || "",
          talking_points_postGameWin: tp.postGameWin || "",
          talking_points_postGameLoss: tp.postGameLoss || "",
          what_worked: data.what_worked || "",
          what_didnt_work: data.what_didnt_work || "",
          game_result: data.game_result || "",
          game_score: data.game_score || "",
        });
      } catch {
        setError("Game plan not found");
      } finally {
        setLoading(false);
      }
    }
    if (planId) load();
  }, [planId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        team_name: editData.team_name,
        opponent_team_name: editData.opponent_team_name,
        game_date: editData.game_date || null,
        opponent_analysis: editData.opponent_analysis,
        our_strategy: editData.our_strategy,
        special_teams_plan: editData.special_teams_plan,
        keys_to_game: editData.keys_to_game,
        status: editData.status,
        session_type: editData.session_type,
        forecheck: editData.forecheck,
        breakout: editData.breakout,
        defensive_system: editData.defensive_system,
        talking_points: {
          preGame: editData.talking_points_preGame,
          postGameWin: editData.talking_points_postGameWin,
          postGameLoss: editData.talking_points_postGameLoss,
        },
        what_worked: editData.what_worked,
        what_didnt_work: editData.what_didnt_work,
        game_result: editData.game_result,
        game_score: editData.game_score,
      };
      const { data } = await api.put<GamePlan>(`/game-plans/${planId}`, payload);
      setPlan(data);
      setEditing(false);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Save failed";
      alert(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this game plan? This cannot be undone.")) return;
    try {
      await api.delete(`/game-plans/${planId}`);
      router.push("/game-plans");
    } catch {
      alert("Failed to delete game plan");
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      const { data } = await api.put<GamePlan>(`/game-plans/${planId}`, { status: newStatus });
      setPlan(data);
      setEditData((prev) => ({ ...prev, status: newStatus }));
    } catch {
      alert("Failed to update status");
    }
  };

  const handleDownloadPDF = () => {
    const prev = document.title;
    const fileName = `${plan?.team_name}_vs_${plan?.opponent_team_name}_${plan?.session_type || "gameplan"}_${plan?.game_date || "draft"}`.replace(/\s+/g, "_");
    document.title = fileName;
    window.print();
    setTimeout(() => { document.title = prev; }, 1000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-navy border-t-teal" />
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="text-center py-16">
        <p className="text-muted">{error || "Game plan not found"}</p>
        <Link href="/game-plans" className="text-teal hover:underline text-sm mt-2 inline-block">
          &larr; Back to Game Plans
        </Link>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    draft: "bg-gray-100 text-gray-600",
    active: "bg-green-100 text-green-700",
    completed: "bg-blue-100 text-blue-700",
  };

  const sessionLabel = SESSION_TYPES.find((s) => s.value === plan.session_type)?.label || "Pre-Game";
  const sessionBadgeColor = SESSION_TYPE_COLORS[plan.session_type] || SESSION_TYPE_COLORS.pre_game;

  const tp = parseTalkingPoints(plan.talking_points);
  const isPostGame = plan.session_type === "post_game";
  const isWin = plan.game_result === "win";
  const isLoss = plan.game_result === "loss";

  const tacticalLabel = (key: keyof typeof TACTICAL_OPTIONS, value: string) => {
    const opt = TACTICAL_OPTIONS[key].find((o) => o.value === value);
    return opt?.label || value || "Not set";
  };

  // ── Shared textarea classes ────────────────────────────────
  const textareaClasses = "w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal/30 resize-none";
  const selectClasses = "w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal/30 bg-white";

  return (
    <div>
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/game-plans" className="text-muted hover:text-navy transition-colors no-print">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <h1 className="text-xl font-bold text-navy">
              {plan.team_name} vs {plan.opponent_team_name}
            </h1>
            <span className={`text-[10px] px-2 py-0.5 rounded font-medium uppercase ${sessionBadgeColor}`}>
              {sessionLabel}
            </span>
            <span className={`text-[10px] px-2 py-0.5 rounded font-medium uppercase ${statusColors[plan.status]}`}>
              {plan.status}
            </span>
          </div>
          {plan.game_date && (
            <p className="text-xs text-muted flex items-center gap-1">
              <Calendar size={10} />
              {new Date(plan.game_date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!editing && (
            <>
              <button
                onClick={handleDownloadPDF}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-teal/10 text-teal border border-teal/20 rounded-lg text-xs font-semibold hover:bg-teal/20 transition-colors no-print"
                title="Download as PDF"
              >
                <Download size={14} />
                PDF
              </button>
              {plan.status === "draft" && (
                <button
                  onClick={() => handleStatusChange("active")}
                  className="px-3 py-1.5 bg-green-100 text-green-700 text-xs font-oswald uppercase tracking-wider rounded-lg hover:bg-green-200 transition-colors flex items-center gap-1 no-print"
                >
                  <CheckCircle size={12} />
                  Activate
                </button>
              )}
              {plan.status === "active" && (
                <button
                  onClick={() => handleStatusChange("completed")}
                  className="px-3 py-1.5 bg-blue-100 text-blue-700 text-xs font-oswald uppercase tracking-wider rounded-lg hover:bg-blue-200 transition-colors flex items-center gap-1 no-print"
                >
                  <CheckCircle size={12} />
                  Complete
                </button>
              )}
              <button
                onClick={() => setEditing(true)}
                className="px-3 py-1.5 bg-teal/10 text-teal text-xs font-oswald uppercase tracking-wider rounded-lg hover:bg-teal/20 transition-colors flex items-center gap-1 no-print"
              >
                <Edit3 size={12} />
                Edit
              </button>
              <button
                onClick={handleDelete}
                className="px-3 py-1.5 bg-red-50 text-red-600 text-xs font-oswald uppercase tracking-wider rounded-lg hover:bg-red-100 transition-colors flex items-center gap-1 no-print"
              >
                <Trash2 size={12} />
              </button>
            </>
          )}
          {editing && (
            <>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-3 py-1.5 bg-teal text-white text-xs font-oswald uppercase tracking-wider rounded-lg hover:bg-teal/90 transition-colors flex items-center gap-1 disabled:opacity-50"
              >
                <Save size={12} />
                {saving ? "Saving..." : "Save"}
              </button>
              <button
                onClick={() => setEditing(false)}
                className="px-3 py-1.5 bg-gray-100 text-muted text-xs font-oswald uppercase tracking-wider rounded-lg hover:bg-gray-200 transition-colors"
              >
                <X size={12} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Sections ────────────────────────────────────────────── */}
      <div className="space-y-4">
        {/* Opponent Analysis */}
        <div className="bg-white rounded-xl border border-border p-5">
          <h3 className="text-sm font-oswald uppercase tracking-wider text-navy flex items-center gap-2 mb-3">
            <Target size={14} className="text-orange" />
            Opponent Analysis
          </h3>
          {editing ? (
            <textarea
              value={editData.opponent_analysis}
              onChange={(e) => setEditData({ ...editData, opponent_analysis: e.target.value })}
              rows={5}
              className={textareaClasses}
            />
          ) : (
            <p className="text-sm text-navy/80 whitespace-pre-wrap">
              {plan.opponent_analysis || "No opponent analysis yet."}
            </p>
          )}
        </div>

        {/* Our Strategy */}
        <div className="bg-white rounded-xl border border-border p-5">
          <h3 className="text-sm font-oswald uppercase tracking-wider text-navy flex items-center gap-2 mb-3">
            <Shield size={14} className="text-teal" />
            Our Strategy
          </h3>
          {editing ? (
            <textarea
              value={editData.our_strategy}
              onChange={(e) => setEditData({ ...editData, our_strategy: e.target.value })}
              rows={5}
              className={textareaClasses}
            />
          ) : (
            <p className="text-sm text-navy/80 whitespace-pre-wrap">
              {plan.our_strategy || "No strategy defined yet."}
            </p>
          )}
        </div>

        {/* Tactical Systems */}
        <div className="bg-white rounded-xl border border-border p-5">
          <h3 className="text-sm font-oswald uppercase tracking-wider text-navy flex items-center gap-2 mb-3">
            <Swords size={14} className="text-teal" />
            Tactical Systems
          </h3>
          {editing ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted mb-1">Forecheck</label>
                <select
                  value={editData.forecheck}
                  onChange={(e) => setEditData({ ...editData, forecheck: e.target.value })}
                  className={selectClasses}
                >
                  <option value="">-- Select --</option>
                  {TACTICAL_OPTIONS.forecheck.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted mb-1">Breakout</label>
                <select
                  value={editData.breakout}
                  onChange={(e) => setEditData({ ...editData, breakout: e.target.value })}
                  className={selectClasses}
                >
                  <option value="">-- Select --</option>
                  {TACTICAL_OPTIONS.breakout.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted mb-1">Defensive System</label>
                <select
                  value={editData.defensive_system}
                  onChange={(e) => setEditData({ ...editData, defensive_system: e.target.value })}
                  className={selectClasses}
                >
                  <option value="">-- Select --</option>
                  {TACTICAL_OPTIONS.defensive_system.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted mb-0.5">Forecheck</p>
                <p className="text-sm text-navy font-medium">{tacticalLabel("forecheck", plan.forecheck)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted mb-0.5">Breakout</p>
                <p className="text-sm text-navy font-medium">{tacticalLabel("breakout", plan.breakout)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted mb-0.5">Defensive System</p>
                <p className="text-sm text-navy font-medium">{tacticalLabel("defensive_system", plan.defensive_system)}</p>
              </div>
            </div>
          )}
        </div>

        {/* Special Teams */}
        <div className="bg-white rounded-xl border border-border p-5">
          <h3 className="text-sm font-oswald uppercase tracking-wider text-navy flex items-center gap-2 mb-3">
            <Zap size={14} className="text-orange" />
            Special Teams Plan
          </h3>
          {editing ? (
            <textarea
              value={editData.special_teams_plan}
              onChange={(e) => setEditData({ ...editData, special_teams_plan: e.target.value })}
              rows={4}
              className={textareaClasses}
            />
          ) : (
            <p className="text-sm text-navy/80 whitespace-pre-wrap">
              {plan.special_teams_plan || "No special teams plan yet."}
            </p>
          )}
        </div>

        {/* Keys to Game */}
        <div className="bg-white rounded-xl border border-border p-5">
          <h3 className="text-sm font-oswald uppercase tracking-wider text-navy flex items-center gap-2 mb-3">
            <Swords size={14} className="text-navy" />
            Keys to the Game
          </h3>
          {editing ? (
            <textarea
              value={editData.keys_to_game}
              onChange={(e) => setEditData({ ...editData, keys_to_game: e.target.value })}
              rows={4}
              className={textareaClasses}
            />
          ) : (
            <p className="text-sm text-navy/80 whitespace-pre-wrap">
              {plan.keys_to_game || "No keys to game defined yet."}
            </p>
          )}
        </div>

        {/* ── Talking Points (expandable) ───────────────────────── */}
        <div className="bg-white rounded-xl border border-border">
          <button
            type="button"
            onClick={() => setTalkingPointsOpen(!talkingPointsOpen)}
            className="w-full p-5 flex items-center justify-between text-left"
          >
            <h3 className="text-sm font-oswald uppercase tracking-wider text-navy flex items-center gap-2">
              <MessageSquare size={14} className="text-teal" />
              Talking Points
            </h3>
            <span className="text-muted text-xs">{talkingPointsOpen ? "Collapse" : "Expand"}</span>
          </button>

          {talkingPointsOpen && (
            <div className="px-5 pb-5 space-y-4 border-t border-border pt-4 print-section">
              {/* Pre-Game */}
              <div>
                <p className="text-xs font-oswald uppercase tracking-wider text-navy mb-1.5">Pre-Game Speech</p>
                {editing ? (
                  <textarea
                    value={editData.talking_points_preGame}
                    onChange={(e) => setEditData({ ...editData, talking_points_preGame: e.target.value })}
                    rows={4}
                    placeholder="Key messages before puck drop..."
                    className={textareaClasses}
                  />
                ) : (
                  <p className="text-sm text-navy/80 whitespace-pre-wrap">
                    {tp.preGame || "No pre-game talking points."}
                  </p>
                )}
              </div>

              {/* Post-Game Win */}
              <div>
                <p className="text-xs font-oswald uppercase tracking-wider text-green-700 mb-1.5">Post-Game Win</p>
                {editing ? (
                  <textarea
                    value={editData.talking_points_postGameWin}
                    onChange={(e) => setEditData({ ...editData, talking_points_postGameWin: e.target.value })}
                    rows={3}
                    placeholder="What to emphasize after a win..."
                    className={textareaClasses}
                  />
                ) : (
                  <p className="text-sm text-navy/80 whitespace-pre-wrap">
                    {tp.postGameWin || "No post-game win template."}
                  </p>
                )}
              </div>

              {/* Post-Game Loss */}
              <div>
                <p className="text-xs font-oswald uppercase tracking-wider text-red-600 mb-1.5">Post-Game Loss</p>
                {editing ? (
                  <textarea
                    value={editData.talking_points_postGameLoss}
                    onChange={(e) => setEditData({ ...editData, talking_points_postGameLoss: e.target.value })}
                    rows={3}
                    placeholder="What to emphasize after a loss..."
                    className={textareaClasses}
                  />
                ) : (
                  <p className="text-sm text-navy/80 whitespace-pre-wrap">
                    {tp.postGameLoss || "No post-game loss template."}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Post-Game Analysis (only for post_game session type) ── */}
        {isPostGame && (
          <div className="bg-white rounded-xl border border-border p-5 space-y-5">
            <h3 className="text-sm font-oswald uppercase tracking-wider text-navy flex items-center gap-2">
              <Target size={14} className="text-orange" />
              Post-Game Analysis
            </h3>

            {/* Game Result + Score */}
            <div className="flex items-center gap-4 flex-wrap">
              {editing ? (
                <>
                  <div>
                    <label className="block text-xs font-medium text-muted mb-1">Result</label>
                    <select
                      value={editData.game_result}
                      onChange={(e) => setEditData({ ...editData, game_result: e.target.value })}
                      className={selectClasses}
                    >
                      <option value="">-- Select --</option>
                      <option value="win">Win</option>
                      <option value="loss">Loss</option>
                      <option value="otl">OT Loss</option>
                      <option value="tie">Tie</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted mb-1">Score</label>
                    <input
                      type="text"
                      value={editData.game_score}
                      onChange={(e) => setEditData({ ...editData, game_score: e.target.value })}
                      placeholder="e.g. 4-2"
                      className="border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal/30 w-28"
                    />
                  </div>
                </>
              ) : (
                <>
                  {plan.game_result && (
                    <span
                      className={`text-sm font-oswald uppercase tracking-wider px-3 py-1 rounded-lg font-bold ${
                        isWin ? "bg-green-100 text-green-700" : isLoss ? "bg-red-100 text-red-600" : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {plan.game_result}
                    </span>
                  )}
                  {plan.game_score && (
                    <span className={`text-lg font-bold ${isWin ? "text-green-700" : isLoss ? "text-red-600" : "text-navy"}`}>
                      {plan.game_score}
                    </span>
                  )}
                  {!plan.game_result && !plan.game_score && (
                    <p className="text-sm text-muted">No game result recorded.</p>
                  )}
                </>
              )}
            </div>

            {/* What Worked (green accent) */}
            <div className="border-l-4 border-green-500 pl-4">
              <h4 className="text-xs font-oswald uppercase tracking-wider text-green-700 flex items-center gap-1.5 mb-2">
                <TrendingUp size={13} />
                What Worked
              </h4>
              {editing ? (
                <textarea
                  value={editData.what_worked}
                  onChange={(e) => setEditData({ ...editData, what_worked: e.target.value })}
                  rows={4}
                  placeholder="Effective plays, strong periods, standout players..."
                  className={textareaClasses}
                />
              ) : (
                <p className="text-sm text-navy/80 whitespace-pre-wrap">
                  {plan.what_worked || "Not recorded."}
                </p>
              )}
            </div>

            {/* What Didn't Work (red accent) */}
            <div className="border-l-4 border-red-500 pl-4">
              <h4 className="text-xs font-oswald uppercase tracking-wider text-red-600 flex items-center gap-1.5 mb-2">
                <TrendingDown size={13} />
                What Didn&apos;t Work
              </h4>
              {editing ? (
                <textarea
                  value={editData.what_didnt_work}
                  onChange={(e) => setEditData({ ...editData, what_didnt_work: e.target.value })}
                  rows={4}
                  placeholder="Breakdowns, turnovers, areas to address..."
                  className={textareaClasses}
                />
              ) : (
                <p className="text-sm text-navy/80 whitespace-pre-wrap">
                  {plan.what_didnt_work || "Not recorded."}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Print Footer ───────────────────────────────────────── */}
      <div className="print-footer mt-8 pt-4 border-t border-navy/10 justify-center items-center gap-2 text-xs text-muted">
        <div className="text-center">
          <p className="font-oswald text-navy text-sm">ProspectX Intelligence</p>
          <p>Exported {new Date().toLocaleDateString()}</p>
        </div>
      </div>
    </div>
  );
}
