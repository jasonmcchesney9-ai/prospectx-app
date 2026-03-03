"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Swords,
  ArrowLeft,
  Save,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  Trophy,
  Target,
  ShieldCheck,
  PenTool,
} from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import api from "@/lib/api";
import type { ChalkTalkSession } from "@/types/api";

/* ── Session type definitions ──────────────────────────────── */
const SESSION_TYPE_OPTIONS = [
  { value: "Pre-Game", label: "Pre-Game", desc: "Game prep, opponent scouting, strategy" },
  { value: "Post-Game", label: "Post-Game", desc: "Review what happened, what worked" },
  { value: "Practice", label: "Practice", desc: "Practice planning, drill focus, system work" },
  { value: "Season Notes", label: "Season Notes", desc: "Big-picture strategy, mid-season adjustments" },
];

/* ── Tactical system dropdowns ─────────────────────────────── */
const FORECHECK_OPTIONS = [
  "1-2-2 Aggressive",
  "2-1-2 Neutral Zone",
  "1-3-1 Conservative",
  "2-3 Passive",
  "Custom",
];
const BREAKOUT_OPTIONS = [
  "Quick Up",
  "Reverse",
  "Stretch Pass",
  "Rim Play",
  "Custom",
];
const DEFENSIVE_OPTIONS = [
  "Man-on-Man",
  "Zone Coverage",
  "Hybrid",
  "Collapsing",
  "Custom",
];

/* ── Steps ─────────────────────────────────────────────────── */
const STEPS = [
  "Session Type",
  "Game Details",
  "Tactical Systems",
  "Opponent Analysis",
  "Our Strategy",
  "Special Teams",
  "Keys to the Game",
  "Talking Points",
  "Review & Create",
];

interface SimpleTeam {
  id: string;
  name: string;
}

export default function NewChalkTalkSessionPage() {
  return (
    <ProtectedRoute>
      <NavBar />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <SessionForm />
      </main>
    </ProtectedRoute>
  );
}

function SessionForm() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  /* Teams */
  const [teams, setTeams] = useState<SimpleTeam[]>([]);
  useEffect(() => {
    api.get<SimpleTeam[]>("/teams").then(({ data }) => setTeams(data)).catch(() => {});
  }, []);

  /* Form state */
  const [sessionType, setSessionType] = useState("Pre-Game");
  const [teamId, setTeamId] = useState("");
  const [opponentTeamId, setOpponentTeamId] = useState("");
  const [gameDate, setGameDate] = useState("");

  const [forecheck, setForecheck] = useState("");
  const [forecheckCustom, setForecheckCustom] = useState("");
  const [breakout, setBreakout] = useState("");
  const [breakoutCustom, setBreakoutCustom] = useState("");
  const [defensiveSystem, setDefensiveSystem] = useState("");
  const [defensiveCustom, setDefensiveCustom] = useState("");

  const [opponentAnalysis, setOpponentAnalysis] = useState("");
  const [ourStrategy, setOurStrategy] = useState("");
  const [specialTeamsPlan, setSpecialTeamsPlan] = useState("");
  const [keysToGame, setKeysToGame] = useState("");

  const [pregameSpeech, setPregameSpeech] = useState("");
  const [postgameWin, setPostgameWin] = useState("");
  const [postgameLoss, setPostgameLoss] = useState("");

  /* Derived: does this type need opponent? */
  const needsOpponent = sessionType === "Pre-Game" || sessionType === "Post-Game";

  /* Resolve final tactical values (handle "Custom" + custom text) */
  const resolveValue = (selected: string, custom: string) =>
    selected === "Custom" ? custom || "Custom" : selected;

  const canProceed = () => {
    if (step === 0) return !!sessionType;
    if (step === 1) return !!teamId;
    return true;
  };

  const handleSubmit = async () => {
    if (!teamId) {
      setError("Team is required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const { data } = await api.post<ChalkTalkSession>("/chalk-talk-sessions", {
        session_type: sessionType,
        team_id: teamId,
        opponent_team_id: opponentTeamId || null,
        game_date: gameDate || null,
        forecheck: resolveValue(forecheck, forecheckCustom) || null,
        breakout: resolveValue(breakout, breakoutCustom) || null,
        defensive_system: resolveValue(defensiveSystem, defensiveCustom) || null,
        opponent_analysis: opponentAnalysis || null,
        our_strategy: ourStrategy || null,
        special_teams_plan: specialTeamsPlan || null,
        keys_to_game: keysToGame || null,
        pregame_speech: pregameSpeech || null,
        postgame_win_message: postgameWin || null,
        postgame_loss_message: postgameLoss || null,
      });
      // Navigate to rink builder with the session's chalk_talk board
      router.push(`/rink-builder?mode=chalk_talk&session_id=${data.id}`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
      setError(typeof msg === "string" ? msg : "Failed to create session");
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "w-full border border-teal/20 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal/30";
  const textareaClass = `${inputClass} resize-none`;
  const selectClass = `${inputClass} appearance-none bg-white`;

  /* Find team name for display */
  const teamName = teams.find((t) => t.id === teamId)?.name || "";
  const opponentName = teams.find((t) => t.id === opponentTeamId)?.name || "";

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/chalk-talk/sessions" className="text-muted hover:text-navy transition-colors">
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

      {/* Step Progress */}
      <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-1">
        {STEPS.map((s, i) => (
          <button
            key={s}
            onClick={() => i <= step && setStep(i)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-oswald uppercase tracking-wider whitespace-nowrap transition-colors ${
              i === step
                ? "bg-teal/10 text-teal font-semibold"
                : i < step
                ? "text-teal/60 hover:text-teal cursor-pointer"
                : "text-muted/40"
            }`}
          >
            <span
              className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${
                i === step
                  ? "bg-teal text-white"
                  : i < step
                  ? "bg-teal/20 text-teal"
                  : "bg-gray-100 text-muted/40"
              }`}
            >
              {i + 1}
            </span>
            <span className="hidden sm:inline">{s}</span>
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Step 0: Session Type */}
      {step === 0 && (
        <div className="bg-white rounded-xl border border-teal/20 p-5">
          <h3 className="text-sm font-oswald uppercase tracking-wider text-navy mb-4">
            What type of session is this?
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {SESSION_TYPE_OPTIONS.map((st) => (
              <button
                key={st.value}
                onClick={() => setSessionType(st.value)}
                className={`text-left border rounded-xl p-4 transition-all ${
                  sessionType === st.value
                    ? "border-teal bg-teal/5 ring-2 ring-teal/20"
                    : "border-gray-200 hover:border-teal/30"
                }`}
              >
                <div className="font-oswald font-semibold text-navy text-sm uppercase tracking-wider">
                  {st.label}
                </div>
                <div className="text-xs text-muted mt-1">{st.desc}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 1: Game Details */}
      {step === 1 && (
        <div className="bg-white rounded-xl border border-teal/20 p-5">
          <h3 className="text-sm font-oswald uppercase tracking-wider text-navy mb-4">
            Game Details
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-navy mb-1">Your Team *</label>
              <div className="relative">
                <select value={teamId} onChange={(e) => setTeamId(e.target.value)} className={selectClass}>
                  <option value="">Select your team...</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
              </div>
            </div>
            {needsOpponent && (
              <div>
                <label className="block text-xs font-semibold text-navy mb-1">Opponent</label>
                <div className="relative">
                  <select value={opponentTeamId} onChange={(e) => setOpponentTeamId(e.target.value)} className={selectClass}>
                    <option value="">Select opponent...</option>
                    {teams.filter((t) => t.id !== teamId).map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                </div>
              </div>
            )}
            {needsOpponent && (
              <div>
                <label className="block text-xs font-semibold text-navy mb-1">Game Date</label>
                <input type="date" value={gameDate} onChange={(e) => setGameDate(e.target.value)} className={inputClass} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 2: Tactical Systems */}
      {step === 2 && (
        <div className="bg-white rounded-xl border border-teal/20 p-5">
          <h3 className="text-sm font-oswald uppercase tracking-wider text-navy mb-4">
            Tactical Systems
          </h3>
          <div className="space-y-4">
            {/* Forecheck */}
            <div>
              <label className="block text-xs font-semibold text-navy mb-1 flex items-center gap-1">
                <Target size={12} className="text-teal" /> Forecheck
              </label>
              <div className="relative">
                <select value={forecheck} onChange={(e) => setForecheck(e.target.value)} className={selectClass}>
                  <option value="">Select forecheck...</option>
                  {FORECHECK_OPTIONS.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
              </div>
              {forecheck === "Custom" && (
                <input
                  type="text"
                  value={forecheckCustom}
                  onChange={(e) => setForecheckCustom(e.target.value)}
                  placeholder="Describe your forecheck..."
                  className={`${inputClass} mt-2`}
                />
              )}
            </div>
            {/* Breakout */}
            <div>
              <label className="block text-xs font-semibold text-navy mb-1 flex items-center gap-1">
                <ArrowLeft size={12} className="text-teal rotate-180" /> Breakout
              </label>
              <div className="relative">
                <select value={breakout} onChange={(e) => setBreakout(e.target.value)} className={selectClass}>
                  <option value="">Select breakout...</option>
                  {BREAKOUT_OPTIONS.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
              </div>
              {breakout === "Custom" && (
                <input
                  type="text"
                  value={breakoutCustom}
                  onChange={(e) => setBreakoutCustom(e.target.value)}
                  placeholder="Describe your breakout..."
                  className={`${inputClass} mt-2`}
                />
              )}
            </div>
            {/* Defensive System */}
            <div>
              <label className="block text-xs font-semibold text-navy mb-1 flex items-center gap-1">
                <ShieldCheck size={12} className="text-teal" /> Defensive System
              </label>
              <div className="relative">
                <select value={defensiveSystem} onChange={(e) => setDefensiveSystem(e.target.value)} className={selectClass}>
                  <option value="">Select system...</option>
                  {DEFENSIVE_OPTIONS.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
              </div>
              {defensiveSystem === "Custom" && (
                <input
                  type="text"
                  value={defensiveCustom}
                  onChange={(e) => setDefensiveCustom(e.target.value)}
                  placeholder="Describe your system..."
                  className={`${inputClass} mt-2`}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Opponent Analysis */}
      {step === 3 && (
        <div className="bg-white rounded-xl border border-teal/20 p-5">
          <h3 className="text-sm font-oswald uppercase tracking-wider text-navy mb-4">
            Opponent Analysis
          </h3>
          <textarea
            value={opponentAnalysis}
            onChange={(e) => setOpponentAnalysis(e.target.value)}
            placeholder="Key players, tendencies, strengths, weaknesses..."
            rows={8}
            className={textareaClass}
          />
        </div>
      )}

      {/* Step 4: Our Strategy */}
      {step === 4 && (
        <div className="bg-white rounded-xl border border-teal/20 p-5">
          <h3 className="text-sm font-oswald uppercase tracking-wider text-navy mb-4">
            Our Strategy
          </h3>
          <textarea
            value={ourStrategy}
            onChange={(e) => setOurStrategy(e.target.value)}
            placeholder="Game plan, approach, tactical priorities..."
            rows={8}
            className={textareaClass}
          />
        </div>
      )}

      {/* Step 5: Special Teams */}
      {step === 5 && (
        <div className="bg-white rounded-xl border border-teal/20 p-5">
          <h3 className="text-sm font-oswald uppercase tracking-wider text-navy mb-4">
            Special Teams Plan
          </h3>
          <textarea
            value={specialTeamsPlan}
            onChange={(e) => setSpecialTeamsPlan(e.target.value)}
            placeholder="Power play approach, penalty kill strategy, faceoff plays..."
            rows={8}
            className={textareaClass}
          />
        </div>
      )}

      {/* Step 6: Keys to the Game */}
      {step === 6 && (
        <div className="bg-white rounded-xl border border-teal/20 p-5">
          <h3 className="text-sm font-oswald uppercase tracking-wider text-navy mb-4">
            Keys to the Game
          </h3>
          <textarea
            value={keysToGame}
            onChange={(e) => setKeysToGame(e.target.value)}
            placeholder={"1. Win the faceoff battle\n2. Limit odd-man rushes\n3. Forecheck with purpose\n4. ..."}
            rows={8}
            className={textareaClass}
          />
        </div>
      )}

      {/* Step 7: Talking Points */}
      {step === 7 && (
        <div className="bg-white rounded-xl border border-teal/20 p-5">
          <h3 className="text-sm font-oswald uppercase tracking-wider text-navy mb-4 flex items-center gap-2">
            <MessageSquare size={14} className="text-teal" />
            Talking Points
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-navy mb-1">Pre-Game Speech</label>
              <textarea
                value={pregameSpeech}
                onChange={(e) => setPregameSpeech(e.target.value)}
                placeholder="Set the tone, key message, energy level..."
                rows={4}
                className={textareaClass}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-navy mb-1 flex items-center gap-1">
                  <Trophy size={12} className="text-green-600" /> Post-Game Win Message
                </label>
                <textarea
                  value={postgameWin}
                  onChange={(e) => setPostgameWin(e.target.value)}
                  placeholder="Celebrate what went right, maintain standards..."
                  rows={3}
                  className={textareaClass}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-navy mb-1 flex items-center gap-1">
                  <span className="text-red-500 text-xs font-bold">L</span> Post-Game Loss Message
                </label>
                <textarea
                  value={postgameLoss}
                  onChange={(e) => setPostgameLoss(e.target.value)}
                  placeholder="Address effort, identify fixable issues, rally the group..."
                  rows={3}
                  className={textareaClass}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 8: Review & Create */}
      {step === 8 && (
        <div className="bg-white rounded-xl border border-teal/20 p-5">
          <h3 className="text-sm font-oswald uppercase tracking-wider text-navy mb-4">
            Review & Create
          </h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted w-28">Session Type</span>
              <span className="text-navy font-medium">{sessionType}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted w-28">Team</span>
              <span className="text-navy font-medium">{teamName || "—"}</span>
            </div>
            {needsOpponent && (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-muted w-28">Opponent</span>
                  <span className="text-navy font-medium">{opponentName || "—"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-muted w-28">Game Date</span>
                  <span className="text-navy font-medium">{gameDate || "—"}</span>
                </div>
              </>
            )}
            {forecheck && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-muted w-28">Forecheck</span>
                <span className="text-navy">{resolveValue(forecheck, forecheckCustom)}</span>
              </div>
            )}
            {breakout && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-muted w-28">Breakout</span>
                <span className="text-navy">{resolveValue(breakout, breakoutCustom)}</span>
              </div>
            )}
            {defensiveSystem && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-muted w-28">Defense</span>
                <span className="text-navy">{resolveValue(defensiveSystem, defensiveCustom)}</span>
              </div>
            )}
            {opponentAnalysis && (
              <div>
                <span className="text-xs font-semibold text-muted">Opponent Analysis</span>
                <p className="text-navy text-xs mt-1 line-clamp-3">{opponentAnalysis}</p>
              </div>
            )}
            {ourStrategy && (
              <div>
                <span className="text-xs font-semibold text-muted">Our Strategy</span>
                <p className="text-navy text-xs mt-1 line-clamp-3">{ourStrategy}</p>
              </div>
            )}
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100 text-xs text-muted">
            A whiteboard will be auto-created and linked to this session.
          </div>
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between mt-6">
        <button
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="flex items-center gap-1 px-4 py-2 text-sm font-oswald uppercase tracking-wider text-muted hover:text-navy transition-colors disabled:opacity-30"
        >
          <ArrowLeft size={14} />
          Back
        </button>

        {step < STEPS.length - 1 ? (
          <button
            onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
            disabled={!canProceed()}
            className="flex items-center gap-1 px-5 py-2 bg-navy text-white text-sm font-oswald uppercase tracking-wider rounded-lg hover:bg-navy/90 transition-colors disabled:opacity-50"
          >
            Next
            <ChevronRight size={14} />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={saving || !teamId}
            className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-teal to-teal/80 text-white text-sm font-oswald font-semibold uppercase tracking-wider rounded-lg hover:shadow-lg transition-shadow disabled:opacity-50"
          >
            {saving ? (
              <>
                <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                Creating...
              </>
            ) : (
              <>
                <PenTool size={14} />
                Create & Open Whiteboard
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
