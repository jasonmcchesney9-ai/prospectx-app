"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Swords,
  ArrowLeft,
  Save,
  ChevronDown,
  MessageSquare,
  Trophy,
  Target,
  ShieldCheck,
} from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import api from "@/lib/api";
import type { GamePlan } from "@/types/api";
import { SESSION_TYPES, TACTICAL_OPTIONS } from "@/types/api";
import type { SessionType } from "@/types/api";

export default function NewChalkTalkPage() {
  return (
    <ProtectedRoute>
      <NavBar />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ChalkTalkForm />
      </main>
    </ProtectedRoute>
  );
}

function ChalkTalkForm() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Session type
  const [sessionType, setSessionType] = useState<SessionType>("pre_game");

  // Game details
  const [teamName, setTeamName] = useState("");
  const [opponentName, setOpponentName] = useState("");
  const [gameDate, setGameDate] = useState("");

  // Tactical dropdowns
  const [forecheck, setForecheck] = useState("");
  const [breakout, setBreakout] = useState("");
  const [defensiveSystem, setDefensiveSystem] = useState("");

  // Original text fields
  const [opponentAnalysis, setOpponentAnalysis] = useState("");
  const [ourStrategy, setOurStrategy] = useState("");
  const [specialTeamsPlan, setSpecialTeamsPlan] = useState("");
  const [keysToGame, setKeysToGame] = useState("");

  // Talking points
  const [preGameSpeech, setPreGameSpeech] = useState("");
  const [postGameWin, setPostGameWin] = useState("");
  const [postGameLoss, setPostGameLoss] = useState("");

  // Post-game extra fields
  const [gameResult, setGameResult] = useState("");
  const [gameScore, setGameScore] = useState("");
  const [whatWorked, setWhatWorked] = useState("");
  const [whatDidntWork, setWhatDidntWork] = useState("");

  const handleSubmit = async () => {
    if (!teamName || !opponentName) {
      setError("Team and opponent names are required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const { data } = await api.post<GamePlan>("/game-plans", {
        team_name: teamName,
        opponent_team_name: opponentName,
        game_date: gameDate || null,
        session_type: sessionType,
        forecheck: forecheck || null,
        breakout: breakout || null,
        defensive_system: defensiveSystem || null,
        opponent_analysis: opponentAnalysis,
        our_strategy: ourStrategy,
        special_teams_plan: specialTeamsPlan,
        keys_to_game: keysToGame,
        talking_points: {
          pre_game_speech: preGameSpeech,
          post_game_win: postGameWin,
          post_game_loss: postGameLoss,
        },
        game_result: gameResult || null,
        game_score: gameScore || null,
        what_worked: whatWorked || null,
        what_didnt_work: whatDidntWork || null,
        status: "draft",
      });
      router.push(`/game-plans/${data.id}`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
      setError(typeof msg === "string" ? msg : JSON.stringify(msg) || "Failed to create session");
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal/30";
  const textareaClass = `${inputClass} resize-none`;
  const selectClass = `${inputClass} appearance-none bg-white`;

  let sectionNum = 0;
  const nextSection = () => ++sectionNum;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/game-plans" className="text-muted hover:text-navy transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-navy flex items-center gap-2">
            <Swords size={24} className="text-teal" />
            New Chalk Talk Session
          </h1>
          <p className="text-muted text-sm mt-0.5">
            Prepare your strategy, review games, or capture coaching notes
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="space-y-6">
        {/* Session Type Picker */}
        <div className="bg-white rounded-xl border border-border p-5">
          <h3 className="text-sm font-oswald uppercase tracking-wider text-navy mb-4 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-teal/10 text-teal flex items-center justify-center text-xs font-bold">{nextSection()}</span>
            Session Type
          </h3>
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {SESSION_TYPES.map((st) => (
              <button
                key={st.value}
                onClick={() => setSessionType(st.value)}
                className={`flex-1 px-3 py-2 rounded-lg text-xs font-oswald uppercase tracking-wider transition-all ${
                  sessionType === st.value
                    ? "bg-white text-navy shadow-sm font-semibold"
                    : "text-muted hover:text-navy"
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>

        {/* Teams & Date */}
        <div className="bg-white rounded-xl border border-border p-5">
          <h3 className="text-sm font-oswald uppercase tracking-wider text-navy mb-4 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-orange/10 text-orange flex items-center justify-center text-xs font-bold">{nextSection()}</span>
            Game Details
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-navy mb-1">Your Team *</label>
              <input
                type="text"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="e.g. Chatham Maroons"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-navy mb-1">Opponent *</label>
              <input
                type="text"
                value={opponentName}
                onChange={(e) => setOpponentName(e.target.value)}
                placeholder="e.g. Leamington Flyers"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-navy mb-1">Game Date</label>
              <input
                type="date"
                value={gameDate}
                onChange={(e) => setGameDate(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
        </div>

        {/* Tactical Systems */}
        <div className="bg-white rounded-xl border border-border p-5">
          <h3 className="text-sm font-oswald uppercase tracking-wider text-navy mb-4 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-teal/10 text-teal flex items-center justify-center text-xs font-bold">{nextSection()}</span>
            Tactical Systems
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-navy mb-1 flex items-center gap-1">
                <Target size={12} className="text-teal" />
                Forecheck
              </label>
              <div className="relative">
                <select
                  value={forecheck}
                  onChange={(e) => setForecheck(e.target.value)}
                  className={selectClass}
                >
                  <option value="">Select forecheck...</option>
                  {TACTICAL_OPTIONS.forecheck.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-navy mb-1 flex items-center gap-1">
                <ArrowLeft size={12} className="text-teal rotate-180" />
                Breakout
              </label>
              <div className="relative">
                <select
                  value={breakout}
                  onChange={(e) => setBreakout(e.target.value)}
                  className={selectClass}
                >
                  <option value="">Select breakout...</option>
                  {TACTICAL_OPTIONS.breakout.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-navy mb-1 flex items-center gap-1">
                <ShieldCheck size={12} className="text-teal" />
                Defensive System
              </label>
              <div className="relative">
                <select
                  value={defensiveSystem}
                  onChange={(e) => setDefensiveSystem(e.target.value)}
                  className={selectClass}
                >
                  <option value="">Select system...</option>
                  {TACTICAL_OPTIONS.defensive_system.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
              </div>
            </div>
          </div>
        </div>

        {/* Opponent Analysis */}
        <div className="bg-white rounded-xl border border-border p-5">
          <h3 className="text-sm font-oswald uppercase tracking-wider text-navy mb-4 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-orange/10 text-orange flex items-center justify-center text-xs font-bold">{nextSection()}</span>
            Opponent Analysis
          </h3>
          <textarea
            value={opponentAnalysis}
            onChange={(e) => setOpponentAnalysis(e.target.value)}
            placeholder="Key players, tendencies, strengths, weaknesses..."
            rows={5}
            className={textareaClass}
          />
        </div>

        {/* Our Strategy */}
        <div className="bg-white rounded-xl border border-border p-5">
          <h3 className="text-sm font-oswald uppercase tracking-wider text-navy mb-4 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-teal/10 text-teal flex items-center justify-center text-xs font-bold">{nextSection()}</span>
            Our Strategy
          </h3>
          <textarea
            value={ourStrategy}
            onChange={(e) => setOurStrategy(e.target.value)}
            placeholder="Game plan, approach, tactical priorities..."
            rows={5}
            className={textareaClass}
          />
        </div>

        {/* Special Teams */}
        <div className="bg-white rounded-xl border border-border p-5">
          <h3 className="text-sm font-oswald uppercase tracking-wider text-navy mb-4 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-navy/10 text-navy flex items-center justify-center text-xs font-bold">{nextSection()}</span>
            Special Teams Plan
          </h3>
          <textarea
            value={specialTeamsPlan}
            onChange={(e) => setSpecialTeamsPlan(e.target.value)}
            placeholder="Power play approach, penalty kill strategy..."
            rows={4}
            className={textareaClass}
          />
        </div>

        {/* Keys to the Game */}
        <div className="bg-white rounded-xl border border-border p-5">
          <h3 className="text-sm font-oswald uppercase tracking-wider text-navy mb-4 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-orange/10 text-orange flex items-center justify-center text-xs font-bold">{nextSection()}</span>
            Keys to the Game
          </h3>
          <textarea
            value={keysToGame}
            onChange={(e) => setKeysToGame(e.target.value)}
            placeholder={"1. Win the faceoff battle\n2. Limit odd-man rushes\n3. ..."}
            rows={4}
            className={textareaClass}
          />
        </div>

        {/* Talking Points */}
        <div className="bg-white rounded-xl border border-border p-5">
          <h3 className="text-sm font-oswald uppercase tracking-wider text-navy mb-4 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-teal/10 text-teal flex items-center justify-center text-xs font-bold">{nextSection()}</span>
            <MessageSquare size={14} className="text-teal" />
            Talking Points
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-navy mb-1">Pre-Game Speech</label>
              <textarea
                value={preGameSpeech}
                onChange={(e) => setPreGameSpeech(e.target.value)}
                placeholder="Set the tone, key message, energy level..."
                rows={3}
                className={textareaClass}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-navy mb-1 flex items-center gap-1">
                  <Trophy size={12} className="text-green-600" />
                  Post-Game Win Message
                </label>
                <textarea
                  value={postGameWin}
                  onChange={(e) => setPostGameWin(e.target.value)}
                  placeholder="Celebrate what went right, maintain standards..."
                  rows={3}
                  className={textareaClass}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-navy mb-1 flex items-center gap-1">
                  <span className="text-red-500 text-xs font-bold">L</span>
                  Post-Game Loss Message
                </label>
                <textarea
                  value={postGameLoss}
                  onChange={(e) => setPostGameLoss(e.target.value)}
                  placeholder="Address effort, identify fixable issues, rally the group..."
                  rows={3}
                  className={textareaClass}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Post-Game Review (conditional) */}
        {sessionType === "post_game" && (
          <div className="bg-white rounded-xl border border-border p-5">
            <h3 className="text-sm font-oswald uppercase tracking-wider text-navy mb-4 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-orange/10 text-orange flex items-center justify-center text-xs font-bold">{nextSection()}</span>
              Post-Game Review
            </h3>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-navy mb-1">Game Result</label>
                  <div className="relative">
                    <select
                      value={gameResult}
                      onChange={(e) => setGameResult(e.target.value)}
                      className={selectClass}
                    >
                      <option value="">Select result...</option>
                      <option value="win">Win</option>
                      <option value="loss">Loss</option>
                      <option value="ot_loss">OT Loss</option>
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-navy mb-1">Game Score</label>
                  <input
                    type="text"
                    value={gameScore}
                    onChange={(e) => setGameScore(e.target.value)}
                    placeholder="e.g. 5-3"
                    className={inputClass}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-navy mb-1 flex items-center gap-1">
                  <Trophy size={12} className="text-green-600" />
                  What Worked
                </label>
                <textarea
                  value={whatWorked}
                  onChange={(e) => setWhatWorked(e.target.value)}
                  placeholder="Effective tactics, standout efforts, systems that clicked..."
                  rows={4}
                  className={textareaClass}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-navy mb-1 flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-red-100 flex items-center justify-center text-red-500 text-[8px] font-bold">!</span>
                  What Didn&apos;t Work
                </label>
                <textarea
                  value={whatDidntWork}
                  onChange={(e) => setWhatDidntWork(e.target.value)}
                  placeholder="Breakdowns, areas to address, adjustments needed..."
                  rows={4}
                  className={textareaClass}
                />
              </div>
            </div>
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={saving || !teamName || !opponentName}
          className="w-full bg-gradient-to-r from-teal to-teal/80 text-white py-3 rounded-xl font-oswald font-semibold uppercase tracking-wider text-sm hover:shadow-lg transition-shadow disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving ? (
            <>
              <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
              Creating...
            </>
          ) : (
            <>
              <Save size={16} />
              Create Chalk Talk Session
            </>
          )}
        </button>
      </div>
    </div>
  );
}
