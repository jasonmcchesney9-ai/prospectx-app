"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Shield,
  Mail,
  Loader2,
  TrendingUp,
  Calendar,
  ChevronRight,
  Eye,
  Apple,
  Brain,
  GraduationCap,
  Lightbulb,
  Shuffle,
  CheckCircle,
  Circle,
  MessageSquare,
  HelpCircle,
  MapPin,
} from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import { getUser } from "@/lib/auth";
import api from "@/lib/api";
import { useBenchTalk } from "@/components/BenchTalkProvider";
import type { Player, PlayerStats, PlayerIntelligence, HTGame } from "@/types/api";

/* ── HT league code mapping ──────────────────────────────────── */
const HT_LEAGUE_CODES: Record<string, string> = {
  GOJHL: "gojhl", GOHL: "gojhl",
  OHL: "ohl", OJHL: "ojhl",
  WHL: "whl", QMJHL: "qmjhl", LHJMQ: "qmjhl", PWHL: "pwhl",
  BCHL: "bchl", AJHL: "ajhl", SJHL: "sjhl", MJHL: "mjhl",
  CCHL: "cchl", NOJHL: "nojhl", MHL: "mhl",
  USHL: "ushl", NAHL: "nahl",
  SPHL: "sphl", ECHL: "echl", AHL: "ahl",
};

/* ── DevPlanV2 interface (subset) ─────────────────────────────── */
interface DevPlanV2 {
  id: string;
  version: number;
  status: string;
  section_1_snapshot: string | null;
  section_3_strengths: string | null;
  section_6_integration: string | null;
}

/* ── Parent Tip Pool ──────────────────────────────────────────── */
const PARENT_TIPS = [
  { do: "Model good sportsmanship by staying calm with officials.", dont: "Argue calls from the stands." },
  { do: "Ask \u2018what was fun about today?\u2019 after every game.", dont: "Lead with stats or critique." },
  { do: "Let the coach do the coaching \u2014 your job is support.", dont: "Give tactical feedback in the car." },
  { do: "Celebrate effort and improvement, not just goals.", dont: "Compare your player to teammates." },
  { do: "Make sure they get 9 hours of sleep before game days.", dont: "Schedule late activities the night before games." },
  { do: "Ask your player what they need from you on game days.", dont: "Assume they want the same support every time." },
  { do: "Stay positive in the stands \u2014 your energy affects them.", dont: "Show frustration visibly during the game." },
];

/* ── After-Game Scripts ───────────────────────────────────────── */
const AFTER_GAME_SCRIPTS: { emoji: string; label: string; script: string }[] = [
  { emoji: "\uD83D\uDE0A", label: "Win \u2014 Felt Good", script: "You looked really comfortable out there. What did you enjoy most?" },
  { emoji: "\uD83D\uDE14", label: "Win \u2014 Seemed Flat", script: "Sometimes games feel off even when you win. How are you feeling?" },
  { emoji: "\uD83D\uDE1E", label: "Tough Loss", script: "I\u2019m proud of how you kept pushing. That effort was real. Want to grab food?" },
  { emoji: "\uD83D\uDE2D", label: "Loss \u2014 Made a Mistake", script: "Every player has those moments. What matters is what comes next. Want to talk about it or just decompress?" },
  { emoji: "\uD83D\uDE20", label: "Scratched / Low Ice Time", script: "That\u2019s a tough spot. I know it\u2019s frustrating. Let\u2019s give it some space tonight and talk when you\u2019re ready." },
];

/* ── Card band header helper ──────────────────────────────────── */
function BandHeader({ title, badgeText, badgeColor = "bg-teal/20 text-teal" }: { title: string; badgeText?: string; badgeColor?: string }) {
  return (
    <div style={{ background: "linear-gradient(135deg, #0F2942 0%, #1A3F54 100%)", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <h4 style={{ fontSize: 12, fontWeight: 700, color: "white", fontFamily: "'DM Sans', sans-serif", letterSpacing: ".04em", textTransform: "uppercase" }}>{title}</h4>
      {badgeText && (
        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${badgeColor}`}>{badgeText}</span>
      )}
    </div>
  );
}

/* ── Section label with pip ───────────────────────────────────── */
function SectionLabel({ label, pipColor }: { label: string; pipColor: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="w-2 h-2 rounded-full" style={{ background: pipColor }} />
      <h3 style={{ fontSize: 13, fontWeight: 700, color: "#0F2942", fontFamily: "'DM Sans', sans-serif", letterSpacing: ".06em", textTransform: "uppercase" }}>{label}</h3>
    </div>
  );
}

/* ── Data row helper ──────────────────────────────────────────── */
function DataRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
      <span style={{ fontSize: 12, color: "#6B7B8D", fontFamily: "'DM Mono', monospace" }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: valueColor || "#0F2942", fontFamily: "'DM Sans', sans-serif" }}>{value}</span>
    </div>
  );
}

/* ── Completion bar helper ────────────────────────────────────── */
function CompletionBar({ label, chars }: { label: string; chars: number }) {
  const pct = Math.min(100, Math.round((chars / 500) * 100));
  return (
    <div className="mb-2 last:mb-0">
      <div className="flex items-center justify-between mb-1">
        <span style={{ fontSize: 11, color: "#6B7B8D", fontFamily: "'DM Mono', monospace" }}>{label}</span>
        <span style={{ fontSize: 10, color: "#6B7B8D" }}>{pct}%</span>
      </div>
      <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "#0D9488", transition: "width .3s" }} />
      </div>
    </div>
  );
}

/* ── Mental checklist item ────────────────────────────────────── */
function CheckItem({ label, checked }: { label: string; checked: boolean }) {
  return (
    <div className="flex items-center gap-2 py-1.5">
      {checked ? <CheckCircle size={14} className="text-purple-600 shrink-0" /> : <Circle size={14} className="text-gray-300 shrink-0" />}
      <span style={{ fontSize: 12, color: checked ? "#0F2942" : "#6B7B8D", fontFamily: "'DM Sans', sans-serif" }}>{label}</span>
    </div>
  );
}

/* ========================================================================= */
/*  MAIN PAGE                                                                 */
/* ========================================================================= */
export default function PlayerGuidePage() {
  const router = useRouter();
  const user = useMemo(() => getUser(), []);
  const { openBenchTalk, setActivePxiContext, roleOverride } = useBenchTalk();
  const role = roleOverride || user?.hockey_role || "";
  const roleAllowed = role === "parent" || role === "player";
  const linkedPlayerId = user?.linked_player_id || null;

  // ── Data state ───────────────────────────────────────────────
  const [player, setPlayer] = useState<Player | null>(null);
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [intel, setIntel] = useState<PlayerIntelligence | null>(null);
  const [devPlan, setDevPlan] = useState<DevPlanV2 | null>(null);
  const [games, setGames] = useState<HTGame[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Tip state ────────────────────────────────────────────────
  const [tipIndex, setTipIndex] = useState(() => new Date().getDay());
  const tip = PARENT_TIPS[tipIndex % PARENT_TIPS.length];

  // ── After-game script state ──────────────────────────────────
  const [selectedEmotion, setSelectedEmotion] = useState(2); // default: Tough Loss

  // ── Player age helper ────────────────────────────────────────
  const playerAge = useMemo(() => {
    if (!player?.dob) return null;
    const born = new Date(player.dob);
    const now = new Date();
    let age = now.getFullYear() - born.getFullYear();
    if (now.getMonth() < born.getMonth() || (now.getMonth() === born.getMonth() && now.getDate() < born.getDate())) age--;
    return age;
  }, [player?.dob]);

  const ageStr = playerAge ? `${playerAge}` : "your age";
  const levelStr = player?.current_league || "their level";

  // ── PXI context ──────────────────────────────────────────────
  useEffect(() => {
    setActivePxiContext({
      user: {
        id: user?.id || "",
        name: `${user?.first_name || ""} ${user?.last_name || ""}`.trim() || "User",
        role: (user?.hockey_role?.toUpperCase() || "PARENT") as "COACH" | "PARENT" | "SCOUT" | "GM" | "AGENT" | "BROADCASTER" | "ANALYST",
        orgId: user?.org_id || "",
        orgName: "ProspectX",
      },
      page: { id: "FAMILY_GUIDE", route: "/player-guide" },
    });
    return () => { setActivePxiContext(null); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Data fetch ───────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    if (!linkedPlayerId) { setLoading(false); return; }
    setLoading(true);
    try {
      const [playerRes, statsRes] = await Promise.allSettled([
        api.get<Player>(`/players/${linkedPlayerId}`),
        api.get<PlayerStats[]>(`/stats/player/${linkedPlayerId}`),
      ]);
      const p = playerRes.status === "fulfilled" ? playerRes.value.data : null;
      setPlayer(p);
      if (statsRes.status === "fulfilled" && Array.isArray(statsRes.value.data) && statsRes.value.data.length > 0) {
        setStats(statsRes.value.data[0]);
      }

      // Wave 2: intelligence, dev plan, games
      const wave2: Promise<unknown>[] = [
        api.get<PlayerIntelligence>(`/players/${linkedPlayerId}/intelligence`),
        api.get<DevPlanV2>(`/players/${linkedPlayerId}/development-plan`),
      ];
      // Scorebar for upcoming games
      if (p?.current_league) {
        const htCode = HT_LEAGUE_CODES[p.current_league.toUpperCase()];
        if (htCode) wave2.push(api.get<HTGame[]>(`/hockeytech/${htCode}/scorebar?days_back=0&days_ahead=14`));
      }
      const wave2Res = await Promise.allSettled(wave2);
      if (wave2Res[0].status === "fulfilled") setIntel((wave2Res[0] as PromiseFulfilledResult<{ data: PlayerIntelligence }>).value.data);
      if (wave2Res[1].status === "fulfilled") setDevPlan((wave2Res[1] as PromiseFulfilledResult<{ data: DevPlanV2 }>).value.data);
      if (wave2Res[2]?.status === "fulfilled") {
        const allGames = (wave2Res[2] as PromiseFulfilledResult<{ data: HTGame[] }>).value.data;
        // Filter to upcoming (Not Started) games for player's team
        const teamName = p?.current_team?.toLowerCase() || "";
        const upcoming = allGames
          .filter((g) => g.status === "Not Started" && (g.home_team.toLowerCase().includes(teamName) || g.away_team.toLowerCase().includes(teamName)))
          .slice(0, 3);
        setGames(upcoming);
      }
    } catch {
      // Non-critical
    } finally {
      setLoading(false);
    }
  }, [linkedPlayerId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── PXI ask helpers ──────────────────────────────────────────
  const askPxi = (prompt: string) => openBenchTalk(prompt, "parent");

  // ── Role guard: non-family ────────────────────────────────────
  if (!roleAllowed) {
    return (
      <ProtectedRoute>
        <NavBar />
        <main className="max-w-2xl mx-auto px-4 py-16 text-center">
          <Shield size={48} className="text-muted/40 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-navy mb-2">This page is for players and families.</h2>
          <p className="text-muted text-sm mb-6">Your current role: <span className="font-medium text-navy">{role || "none"}</span></p>
          <button onClick={() => router.push("/players")} className="inline-flex items-center gap-2 px-4 py-2 bg-navy text-white text-sm font-oswald font-semibold uppercase tracking-wider rounded-lg hover:bg-navy/90">
            Go to Players
          </button>
        </main>
      </ProtectedRoute>
    );
  }

  // ── Role guard: no linked player ──────────────────────────────
  if (!linkedPlayerId) {
    return (
      <ProtectedRoute>
        <NavBar />
        <main className="max-w-2xl mx-auto px-4 py-16 text-center" style={{ background: "#DCF0FA", minHeight: "100vh" }}>
          <Mail size={48} className="text-teal mx-auto mb-4" />
          <h2 className="text-xl font-bold text-navy mb-2">Your player link hasn&apos;t been set up yet.</h2>
          <p className="text-muted text-sm">Ask your coach to connect your account.</p>
        </main>
      </ProtectedRoute>
    );
  }

  // ── Loading ───────────────────────────────────────────────────
  if (loading) {
    return (
      <ProtectedRoute>
        <NavBar />
        <main className="flex items-center justify-center py-32" style={{ background: "#DCF0FA", minHeight: "100vh" }}>
          <Loader2 size={32} className="text-teal animate-spin" />
        </main>
      </ProtectedRoute>
    );
  }

  // ── Full position helper ──────────────────────────────────────
  const pos: Record<string, string> = { C: "Centre", LW: "Left Wing", RW: "Right Wing", D: "Defence", G: "Goaltender", F: "Forward" };
  const fullPos = pos[player?.position?.toUpperCase() || ""] || player?.position || "";

  return (
    <ProtectedRoute>
      <NavBar />
      <main style={{ background: "#DCF0FA", minHeight: "100vh" }} className="pb-16">
        <div className="max-w-[1160px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

          {/* ── Page Title Block ───────────────────────────────── */}
          <div>
            <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#6B7B8D", textTransform: "uppercase", letterSpacing: ".08em" }}>
              My Player &middot; Family Hub
            </p>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0F2942", fontFamily: "'DM Sans', sans-serif", marginTop: 4 }}>
              Player &amp; Family Guide
            </h1>
            <p style={{ fontSize: 13, color: "#6B7B8D", marginTop: 4, fontFamily: "'DM Sans', sans-serif" }}>
              Everything you need to support your player&apos;s development journey.
            </p>
          </div>

          {/* ════════ SECTION 1 — MY PLAYER ════════════════════ */}
          <div>
            <SectionLabel label="My Player" pipColor="#0D9488" />
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">

              {/* ── Card 1: Player Snapshot (span 2) ──────────── */}
              <div className="md:col-span-2" style={{ background: "white", borderRadius: 14, overflow: "hidden", borderLeft: "4px solid #0D9488" }}>
                <BandHeader title="Player Snapshot" badgeText="2025\u201326" />
                {/* Player header row */}
                <div className="px-4 pt-4 pb-3 flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-teal/10 flex items-center justify-center text-lg font-oswald font-bold text-teal">
                    {player?.first_name?.charAt(0)}{player?.last_name?.charAt(0)}
                  </div>
                  <div>
                    <p style={{ fontSize: 15, fontWeight: 700, color: "#0F2942" }}>{player?.first_name} {player?.last_name}</p>
                    <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#6B7B8D" }}>
                      {fullPos}{player?.jersey_number ? ` #${player.jersey_number}` : ""}{player?.current_team ? ` \u2022 ${player.current_team}` : ""}{player?.current_league ? ` \u2022 ${player.current_league}` : ""}
                    </p>
                  </div>
                </div>
                {/* Data rows */}
                <div className="px-4 pb-3">
                  <DataRow label="How They're Playing" value={intel?.overall_grade || "Generating assessment\u2026"} />
                  <DataRow label="Biggest Strength" value={intel?.strengths?.[0] || "\u2014"} valueColor="#0D9488" />
                  <DataRow label="Focus Area" value={intel?.development_areas?.[0] || "\u2014"} valueColor="#F36F21" />
                </div>
                {/* Stat bar */}
                {stats && (
                  <div className="grid grid-cols-5 border-t border-border/30" style={{ background: "#FAFBFC" }}>
                    {([
                      ["GP", stats.gp],
                      ["G", stats.g],
                      ["A", stats.a],
                      ["PTS", stats.p],
                      ["+/-", stats.plus_minus ?? "\u2014"],
                    ] as [string, string | number][]).map(([label, value]) => (
                      <div key={label} className="text-center py-2.5">
                        <p style={{ fontSize: 16, fontWeight: 800, color: label === "PTS" ? "#0D9488" : "#0F2942" }}>{String(value)}</p>
                        <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "#6B7B8D", textTransform: "uppercase", letterSpacing: ".08em" }}>{label}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Card 2: Development Plan ──────────────────── */}
              <div style={{ background: "white", borderRadius: 14, overflow: "hidden", borderLeft: "4px solid #0D9488" }}>
                <BandHeader title="Development Plan" badgeText={devPlan ? `v${devPlan.version}` : undefined} />
                <div className="px-4 py-4">
                  {devPlan ? (
                    <>
                      <CompletionBar label="Current Performance" chars={(devPlan.section_1_snapshot || "").length} />
                      <CompletionBar label="Physical Development" chars={(devPlan.section_3_strengths || "").length} />
                      <CompletionBar label="Goals & Milestones" chars={(devPlan.section_6_integration || "").length} />
                      <button
                        onClick={() => router.push(`/players/${linkedPlayerId}?tab=devplan`)}
                        className="mt-3 w-full flex items-center justify-center gap-1 px-3 py-2 text-xs font-medium border border-teal/30 text-teal rounded-lg hover:bg-teal/5"
                      >
                        View Full Plan <ChevronRight size={14} />
                      </button>
                    </>
                  ) : (
                    <p className="text-sm text-muted/60 italic py-4 text-center">Your coach hasn&apos;t created a development plan yet.</p>
                  )}
                </div>
              </div>

              {/* ── Card 3: Upcoming Games ────────────────────── */}
              <div style={{ background: "white", borderRadius: 14, overflow: "hidden", borderLeft: "4px solid #F36F21" }}>
                <BandHeader title="Upcoming Games" badgeText="Next 3" badgeColor="bg-orange/20 text-orange" />
                <div className="px-4 py-4">
                  {games.length > 0 ? (
                    <div className="space-y-3">
                      {games.map((g, i) => {
                        const isHome = g.home_team.toLowerCase().includes((player?.current_team || "").toLowerCase());
                        const opponent = isHome ? g.away_team : g.home_team;
                        const dotColor = i === 0 ? "#F36F21" : i === 1 ? "#0D9488" : "#CBD5E1";
                        return (
                          <div key={g.game_id} className="flex items-start gap-2.5">
                            <div className="w-2.5 h-2.5 rounded-full mt-1 shrink-0" style={{ background: dotColor }} />
                            <div>
                              <p style={{ fontSize: 13, fontWeight: 600, color: "#0F2942" }}>{opponent}</p>
                              <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#6B7B8D" }}>
                                {g.game_date} &middot; {g.time} &middot; {isHome ? "Home" : "Away"}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted/60 italic py-4 text-center">No upcoming games scheduled.</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ════════ SECTION 2 — DEVELOPMENT RESOURCES ════════ */}
          <div>
            <SectionLabel label="Development Resources" pipColor="#F36F21" />
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">

              {/* ── Card 4: Nutrition & Recovery ──────────────── */}
              <div style={{ background: "white", borderRadius: 14, overflow: "hidden", borderLeft: "4px solid #16A34A", border: "1px solid rgba(22,163,74,.2)", borderLeftWidth: 4 }}>
                <BandHeader title="Nutrition & Recovery" badgeText="Guide" badgeColor="bg-green-100 text-green-700" />
                <div className="px-4 py-3">
                  <DataRow label="Pre-Game Meal" value="3\u20134 hrs before" />
                  <DataRow label="Hydration" value="500ml per hour of play" valueColor="#16A34A" />
                  <DataRow label="Recovery Window" value="30 min post-game" />
                  <div className="flex flex-wrap gap-1.5 mt-3 mb-3">
                    {["Sleep 9hrs", "Protein first", "Ice bath"].map((t) => (
                      <span key={t} className="text-[10px] px-2 py-1 rounded-full bg-green-50 text-green-700 font-medium">{t}</span>
                    ))}
                  </div>
                  <button
                    onClick={() => askPxi(`I'm a hockey parent. My player is ${ageStr} and plays ${levelStr}. What should they eat before and after games this weekend? Keep it practical \u2014 things I can actually prepare at home.`)}
                    className="w-full flex items-center justify-center gap-1 px-3 py-2 text-xs font-medium bg-teal text-white rounded-lg hover:bg-teal/90"
                  >
                    <MessageSquare size={13} /> Ask PXI about nutrition
                  </button>
                </div>
              </div>

              {/* ── Card 5: Mental Performance ────────────────── */}
              <div style={{ background: "white", borderRadius: 14, overflow: "hidden", borderLeft: "4px solid #9333EA", border: "1px solid rgba(147,51,234,.2)", borderLeftWidth: 4 }}>
                <BandHeader title="Mental Performance" badgeText="Mind" badgeColor="bg-purple-100 text-purple-700" />
                <div className="px-4 py-3">
                  <CheckItem label="Pre-game routine established" checked />
                  <CheckItem label="Bounce-back strategy reviewed" checked />
                  <CheckItem label="Confidence journal \u2014 week 3" checked={false} />
                  <CheckItem label="Pressure conversation with coach" checked={false} />
                  <button
                    onClick={() => askPxi(`I'm a hockey parent. My player is ${ageStr} and plays ${levelStr}. They sometimes struggle with nerves before big games. What are some simple pre-game routines or mental tools that work well at this age?`)}
                    className="w-full flex items-center justify-center gap-1 px-3 py-2 text-xs font-medium bg-teal text-white rounded-lg hover:bg-teal/90 mt-3"
                  >
                    <MessageSquare size={13} /> Ask PXI about mental game
                  </button>
                </div>
              </div>

              {/* ── Card 6: Education & Development ───────────── */}
              <div style={{ background: "white", borderRadius: 14, overflow: "hidden", borderLeft: "4px solid #0D9488" }}>
                <BandHeader title="Education & Development" badgeText="Academics" />
                <div className="px-4 py-3">
                  <DataRow label="Eligibility Status" value="Eligible \u2713" valueColor="#16A34A" />
                  <DataRow label="NCAA Deadline" value="Register by Sept 2026" valueColor="#F36F21" />
                  <DataRow label="USPORTS" value="Open \u2014 no dead period" />
                  <div className="flex flex-wrap gap-1.5 mt-3 mb-3">
                    {["OHL draft eligible", "USPORTS", "NCAA"].map((t) => (
                      <span key={t} className="text-[10px] px-2 py-1 rounded-full bg-teal/10 text-teal font-medium">{t}</span>
                    ))}
                  </div>
                  <button
                    onClick={() => askPxi(`I'm a hockey parent. My player is ${ageStr} and plays ${levelStr}. They've been hard on themselves lately. What should I be saying \u2014 and what should I avoid saying \u2014 to help them stay confident without putting more pressure on them?`)}
                    className="w-full flex items-center justify-center gap-1 px-3 py-2 text-xs font-medium bg-teal text-white rounded-lg hover:bg-teal/90"
                  >
                    <MessageSquare size={13} /> Ask PXI about pathways
                  </button>
                </div>
              </div>

              {/* ── Card 7: Parent Tip of the Day ────────────── */}
              <div style={{ background: "white", borderRadius: 14, overflow: "hidden", borderLeft: "4px solid #F59E0B", border: "1px solid rgba(245,158,11,.2)", borderLeftWidth: 4 }}>
                <div style={{ background: "linear-gradient(135deg, #0F2942 0%, #1A3F54 100%)", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <h4 style={{ fontSize: 12, fontWeight: 700, color: "white", fontFamily: "'DM Sans', sans-serif", letterSpacing: ".04em", textTransform: "uppercase" }}>Parent Tip of the Day</h4>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Daily</span>
                    <button onClick={() => setTipIndex(Math.floor(Math.random() * PARENT_TIPS.length))} className="p-1 text-white/50 hover:bg-white/10 rounded" title="Shuffle tip">
                      <Shuffle size={13} />
                    </button>
                  </div>
                </div>
                <div className="px-4 py-3 space-y-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-green-600">DO</span>
                    <p style={{ fontSize: 12, color: "#0F2942", marginTop: 2, lineHeight: 1.5 }}>{tip.do}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-red-500">DON&apos;T</span>
                    <p style={{ fontSize: 12, color: "#0F2942", marginTop: 2, lineHeight: 1.5 }}>{tip.dont}</p>
                  </div>
                  <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "#94A3B8", marginTop: 6 }}>
                    Rotates daily &middot; Based on child development research
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ════════ SECTION 3 — PATHWAY PLANNING ═════════════ */}
          <div>
            <SectionLabel label="Pathway Planning" pipColor="#3B82F6" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

              {/* ── Card 8: Hockey Pathway ────────────────────── */}
              <div style={{ background: "white", borderRadius: 14, overflow: "hidden", borderLeft: "4px solid #3B82F6", border: "1px solid rgba(59,130,246,.2)", borderLeftWidth: 4 }}>
                <BandHeader title="Hockey Pathway" badgeText={player?.current_league || "Hockey"} badgeColor="bg-blue-100 text-blue-700" />
                <div className="px-4 py-4 space-y-4">
                  {/* Current */}
                  <div className="flex items-start gap-2.5">
                    <div className="w-2.5 h-2.5 rounded-full mt-1 shrink-0" style={{ background: "#F36F21" }} />
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 600, color: "#0F2942" }}>{player?.current_team || "Current Team"} &middot; {player?.current_league || "League"} &middot; 2025\u201326</p>
                      <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#6B7B8D" }}>Current level</p>
                    </div>
                  </div>
                  {/* Next */}
                  <div className="flex items-start gap-2.5">
                    <div className="w-2.5 h-2.5 rounded-full mt-1 shrink-0" style={{ background: "#0D9488" }} />
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 600, color: "#0F2942" }}>OHL / Major Junior \u2014 Draft window: 2026</p>
                      <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#6B7B8D" }}>Next level</p>
                    </div>
                  </div>
                  {/* Future */}
                  <div className="flex items-start gap-2.5">
                    <div className="w-2.5 h-2.5 rounded-full mt-1 shrink-0" style={{ background: "#CBD5E1" }} />
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 600, color: "#0F2942" }}>NCAA / USPORTS / Pro \u2014 2027\u20132029 projection</p>
                      <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#6B7B8D" }}>Future</p>
                    </div>
                  </div>
                  <button
                    onClick={() => askPxi(`I'm a hockey parent. My player is ${ageStr} and plays ${levelStr}. Can you walk me through the realistic pathway from here to junior or college hockey? What are the key ages and decisions we should be thinking about now?`)}
                    className="w-full flex items-center justify-center gap-1 px-3 py-2 text-xs font-medium bg-teal text-white rounded-lg hover:bg-teal/90 mt-2"
                  >
                    <MessageSquare size={13} /> Ask PXI About Pathways
                  </button>
                </div>
              </div>

              {/* ── Card 9: Key Dates & Deadlines ────────────── */}
              <div style={{ background: "white", borderRadius: 14, overflow: "hidden", borderLeft: "4px solid #0D9488" }}>
                <BandHeader title="Key Dates & Deadlines" badgeText="2026" />
                <div className="px-4 py-3">
                  <DataRow label="OHL Priority Selection" value="Jan 15, 2026" valueColor="#F36F21" />
                  <DataRow label="NCAA Eligibility Centre" value="Register by Sept 2026" />
                  <DataRow label="Showcase Season" value="April \u2013 June 2026" valueColor="#0D9488" />
                  <DataRow label="USPORTS Recruiting" value="Open \u2014 no dead period" />
                </div>
              </div>

              {/* ── Card 10: After-Game Scripts ───────────────── */}
              <div style={{ background: "white", borderRadius: 14, overflow: "hidden", borderLeft: "4px solid #F36F21", border: "1px solid rgba(243,111,33,.2)", borderLeftWidth: 4 }}>
                <BandHeader title="After-Game Scripts" badgeText="What To Say" badgeColor="bg-orange/20 text-orange" />
                <div className="px-4 py-3">
                  {/* Emotion chips */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {AFTER_GAME_SCRIPTS.map((s, i) => (
                      <button
                        key={i}
                        onClick={() => setSelectedEmotion(i)}
                        className="text-[10px] px-2 py-1.5 rounded-full font-medium transition-colors"
                        style={{
                          background: selectedEmotion === i ? "#0F2942" : "#F0F4F8",
                          color: selectedEmotion === i ? "white" : "#0F2942",
                        }}
                      >
                        {s.emoji} {s.label}
                      </button>
                    ))}
                  </div>
                  {/* Script */}
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p style={{ fontSize: 13, color: "#0F2942", lineHeight: 1.6, fontStyle: "italic" }}>
                      &ldquo;{AFTER_GAME_SCRIPTS[selectedEmotion].script}&rdquo;
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ════════ ASK PXI BAR ══════════════════════════════ */}
          <div
            style={{
              background: "linear-gradient(135deg, #0F2942 0%, #1A3F54 100%)",
              borderRadius: 14,
              border: "1px solid rgba(13,148,136,.4)",
              padding: "16px 20px",
              display: "flex",
              alignItems: "center",
              gap: 14,
            }}
          >
            <HelpCircle size={24} className="text-teal shrink-0" />
            <div className="flex-1 min-w-0">
              <p style={{ fontSize: 13, color: "rgba(255,255,255,.5)", fontFamily: "'DM Sans', sans-serif" }}>
                Ask PXI anything about your player&apos;s development, pathway, or upcoming games&hellip;
              </p>
            </div>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "rgba(255,255,255,.3)", textTransform: "uppercase", letterSpacing: ".08em", whiteSpace: "nowrap" }}>
              Parent Mode
            </span>
            <button
              onClick={() => askPxi("")}
              className="shrink-0 px-4 py-2 text-xs font-medium bg-teal text-white rounded-lg hover:bg-teal/90"
            >
              Ask PXI
            </button>
          </div>

        </div>
      </main>
    </ProtectedRoute>
  );
}
