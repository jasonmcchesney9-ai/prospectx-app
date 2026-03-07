"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  User,
  Printer,
  RefreshCw,
  Loader2,
  FileText,
  Edit3,
  Save,
  X,
  Search,
} from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import TrendlineChart from "@/components/TrendlineChart";
import api, { assetUrl, hasRealImage } from "@/lib/api";
import type {
  PlayerCardData_V1,
  TrendlineResponse,
  RoleTag,
} from "@/types/api";
import { useBenchTalk } from "@/components/BenchTalkProvider";
import { getUser } from "@/lib/auth";

// ── Constants ──

const HEALTH_COLORS: Record<string, { label: string; bg: string; text: string }> = {
  healthy: { label: "Healthy", bg: "bg-green-50", text: "text-green-700" },
  injured: { label: "Injured", bg: "bg-red-50", text: "text-red-700" },
  recovering: { label: "Recovering", bg: "bg-yellow-50", text: "text-yellow-700" },
  day_to_day: { label: "Day-to-Day", bg: "bg-orange-50", text: "text-orange-700" },
};

const ROLE_TAG_COLORS: Record<string, { bg: string; text: string }> = {
  line_pair: { bg: "bg-teal/10", text: "text-teal" },
  special_teams: { bg: "bg-orange/10", text: "text-orange" },
  system_role: { bg: "bg-navy/[0.08]", text: "text-navy" },
  status: { bg: "bg-purple-50", text: "text-purple-700" },
};

const POSITION_LABELS: Record<string, string> = {
  C: "Center", LW: "Left Wing", RW: "Right Wing",
  D: "Defense", G: "Goalie", F: "Forward",
  LD: "Left Defense", RD: "Right Defense",
};

const TRENDLINE_METRICS = [
  { value: "points", label: "Points" },
  { value: "goals", label: "Goals" },
  { value: "assists", label: "Assists" },
  { value: "shots", label: "Shots" },
];

const GRADE_LABELS: Record<string, string> = {
  overall_grade: "Overall",
  offensive_grade: "Offense",
  defensive_grade: "Defense",
  skating_grade: "Skating",
  hockey_iq_grade: "Hockey IQ",
  compete_grade: "Compete",
};

const GRADE_TO_SCORE: Record<string, number> = {
  "A+": 10, "A": 9.5, "A-": 9, "B+": 8.5, "B": 8, "B-": 7.5,
  "C+": 7, "C": 6.5, "C-": 6, "D+": 5.5, "D": 5, "D-": 4.5, "F": 3, "NR": 0,
};
function gradeToScore(grade: unknown): number {
  if (!grade || grade === "NR") return 0;
  const s = String(grade);
  return GRADE_TO_SCORE[s] ?? (parseFloat(s) || 0);
}

// ── Page Component ──

export default function PlayerCardPage() {
  const params = useParams();
  const router = useRouter();
  const playerId = params.id as string;

  const [card, setCard] = useState<PlayerCardData_V1 | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Trendline
  const [trendMetric, setTrendMetric] = useState("points");
  const [trendData, setTrendData] = useState<TrendlineResponse | null>(null);
  const [loadingTrend, setLoadingTrend] = useState(false);

  // Skill profile
  const [generatingProfile, setGeneratingProfile] = useState(false);
  const [editingCoachProfile, setEditingCoachProfile] = useState(false);
  const [coachProfileDraft, setCoachProfileDraft] = useState("");

  // Collapsed sections
  const [showNotes, setShowNotes] = useState(true);
  const [showObjectives, setShowObjectives] = useState(true);

  // Overflow menu
  const [overflowOpen, setOverflowOpen] = useState(false);
  const overflowRef = useRef<HTMLDivElement>(null);

  // ── Hooks that must be called unconditionally (before any early returns) ──
  const { openBenchTalk, setActivePxiContext } = useBenchTalk();
  const currentUser = getUser();
  const userRole = currentUser?.hockey_role;

  // Set active PXI context for BenchTalk when viewing this player card
  useEffect(() => {
    if (card) {
      const ci = card.identity;
      setActivePxiContext({
        user: {
          id: currentUser?.id || "",
          name: `${currentUser?.first_name || ""} ${currentUser?.last_name || ""}`.trim() || "User",
          role: (currentUser?.hockey_role?.toUpperCase() || "SCOUT") as "SCOUT" | "COACH" | "GM" | "PARENT" | "AGENT" | "BROADCASTER" | "ANALYST",
          orgId: currentUser?.org_id || "",
          orgName: "ProspectX",
        },
        page: { id: "PLAYER_CARD", route: `/players/${playerId}/card` },
        entity: {
          type: "PLAYER",
          id: playerId,
          name: `${ci.first_name} ${ci.last_name}`,
          metadata: {
            position: ci.position || undefined,
            team: ci.current_team || undefined,
            league: ci.current_league || undefined,
          },
        },
      });
    }
    return () => { setActivePxiContext(null); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card, playerId, setActivePxiContext]);

  // ── Load card ──
  const loadCard = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get<PlayerCardData_V1>(`/players/${playerId}/card`);
      setCard(data);
    } catch {
      setError("Failed to load player card.");
    } finally {
      setLoading(false);
    }
  }, [playerId]);

  useEffect(() => { loadCard(); }, [loadCard]);

  // ── Load trendline ──
  const loadTrendline = useCallback(async () => {
    try {
      setLoadingTrend(true);
      const { data } = await api.get<TrendlineResponse>(
        `/players/${playerId}/trendline?metric=${trendMetric}&last_n=20`
      );
      setTrendData(data);
    } catch {
      setTrendData(null);
    } finally {
      setLoadingTrend(false);
    }
  }, [playerId, trendMetric]);

  useEffect(() => { loadTrendline(); }, [loadTrendline]);

  // ── PXR confidence data ──
  const [pxrConfidence, setPxrConfidence] = useState<{ confidence_tier?: string | null; gp?: number | null } | null>(null);
  useEffect(() => {
    api.get("/pxr/draft-board?season=2025-26").then((res) => {
      const match = (res.data.players || []).find((p: { player_id: string }) => p.player_id === playerId);
      if (match) setPxrConfidence({ confidence_tier: match.confidence_tier, gp: match.gp });
    }).catch(() => {});
  }, [playerId]);

  // ── Overflow click-outside ──
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (overflowRef.current && !overflowRef.current.contains(e.target as Node)) setOverflowOpen(false);
    }
    if (overflowOpen) {
      document.addEventListener("mousedown", handler);
      return () => document.removeEventListener("mousedown", handler);
    }
  }, [overflowOpen]);

  // ── Generate skill profile ──
  async function handleGenerateProfile() {
    try {
      setGeneratingProfile(true);
      await api.post(`/players/${playerId}/skill-profile/generate`);
      await loadCard();
    } catch {
      // silent
    } finally {
      setGeneratingProfile(false);
    }
  }

  // ── Save coach profile ──
  async function handleSaveCoachProfile() {
    try {
      await api.put(`/players/${playerId}`, { skill_profile_coach: coachProfileDraft });
      setEditingCoachProfile(false);
      await loadCard();
    } catch {
      // silent
    }
  }

  // ── Print ──
  function handlePrint() {
    window.print();
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <NavBar />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center min-h-[50vh]">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-navy border-t-teal" />
          </div>
        </main>
      </ProtectedRoute>
    );
  }

  if (error || !card) {
    return (
      <ProtectedRoute>
        <NavBar />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-16">
            <User size={32} className="mx-auto text-muted/40 mb-3" />
            <p className="text-muted text-sm">{error || "Player card not found."}</p>
            <button onClick={() => router.back()} className="mt-4 text-teal text-sm hover:underline">
              Go Back
            </button>
          </div>
        </main>
      </ProtectedRoute>
    );
  }

  const { identity: id, performance: perf, development: dev, league_context } = card;
  const fullPos = POSITION_LABELS[id.position?.toUpperCase()] || id.position || "Unknown";
  const healthStyle = HEALTH_COLORS[id.health_status] || HEALTH_COLORS.healthy;
  const roleTags: RoleTag[] = id.role_tags || [];

  // Radar data from intelligence grades
  const intel = dev.intelligence;
  const radarData = intel ? Object.entries(GRADE_LABELS)
    .filter(([k]) => intel[k] != null)
    .map(([k, label]) => ({
      subject: label,
      value: typeof intel[k] === "number" ? intel[k] as number : parseFloat(String(intel[k])) || 0,
      fullMark: 10,
    })) : [];
  const allZeroRadar = radarData.every(d => d.value === 0);

  // ── PXI average score (average of 6 dimension scores) ──
  const pxiDimensions = intel ? [
    { key: "overall_grade", label: "SNP" },
    { key: "offensive_grade", label: "IQ" },
    { key: "defensive_grade", label: "PLY" },
    { key: "skating_grade", label: "TRN" },
    { key: "compete_grade", label: "DEF" },
    { key: "hockey_iq_grade", label: "CMP" },
  ].map(d => ({ ...d, value: gradeToScore(intel[d.key]) })) : [];
  const pxiScoredDimensions = pxiDimensions.filter(d => d.value > 0);
  const pxiAvg = pxiScoredDimensions.length > 0
    ? pxiScoredDimensions.reduce((s, d) => s + d.value, 0) / pxiScoredDimensions.length
    : 0;
  const pxiGradeLabel = pxiAvg >= 8.5 ? "ELITE" : pxiAvg >= 7 ? "ABOVE AVERAGE" : pxiAvg >= 5 ? "AVERAGE" : pxiAvg >= 3 ? "BELOW AVERAGE" : "N/A";

  // ── Spider chart SVG helper ──
  function renderSpiderSVG(size: number, dimensions: { label: string; value: number }[]) {
    const cx = size / 2, cy = size / 2, r = size * 0.4;
    const n = dimensions.length;
    if (n < 3) return null;
    const angleStep = (2 * Math.PI) / n;
    const startAngle = -Math.PI / 2;
    const gridLevels = [0.25, 0.5, 0.75, 1.0];
    const getPoint = (i: number, scale: number) => {
      const angle = startAngle + i * angleStep;
      return { x: cx + r * scale * Math.cos(angle), y: cy + r * scale * Math.sin(angle) };
    };
    const hexPath = (scale: number) => dimensions.map((_, i) => {
      const p = getPoint(i, scale);
      return `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    }).join(" ") + " Z";
    const dataPath = dimensions.map((d, i) => {
      const scale = Math.min(d.value / 10, 1);
      const p = getPoint(i, scale);
      return `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    }).join(" ") + " Z";

    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {gridLevels.map(s => (
          <path key={s} d={hexPath(s)} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
        ))}
        {dimensions.map((_, i) => {
          const p = getPoint(i, 1);
          return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="rgba(255,255,255,0.04)" strokeWidth="1" />;
        })}
        <path d={dataPath} fill="rgba(13,148,136,0.2)" stroke="rgba(13,148,136,0.8)" strokeWidth="1.5" />
        {dimensions.map((d, i) => {
          const p = getPoint(i, 1.22);
          return (
            <text key={i} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="central"
              style={{ fontSize: 7, fontFamily: "'JetBrains Mono', monospace", fill: "rgba(255,255,255,0.35)" }}>
              {d.label}
            </text>
          );
        })}
      </svg>
    );
  }

  return (
    <ProtectedRoute>
      <NavBar />
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 16px" }} className="print:px-2 print:py-2">
        {/* ── Header bar ── */}
        <div className="flex items-center justify-between mb-5 print:hidden">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} style={{ color: "#666666" }} className="hover:opacity-70 transition-colors">
              <ArrowLeft size={18} />
            </button>
            <h1 style={{ fontSize: 18, fontFamily: "'Oswald', sans-serif", fontWeight: 700, color: "#0F2942", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Player Card
            </h1>
            {league_context && (
              <span style={{ fontSize: 11, color: "#666666" }}>
                {league_context.league} &middot; {league_context.season}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/players/${playerId}`}
              style={{ fontSize: 11, color: "#0F2942", border: "1px solid #DDE6EF", borderRadius: 7, padding: "6px 12px", fontFamily: "'Oswald', sans-serif", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}
              className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
            >
              <User size={13} />
              Full Profile
            </Link>
            <button
              onClick={handlePrint}
              style={{ fontSize: 11, color: "#0F2942", border: "1px solid #DDE6EF", borderRadius: 7, padding: "6px 12px", fontFamily: "'Oswald', sans-serif", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}
              className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
            >
              <Printer size={13} />
              Print
            </button>
          </div>
        </div>

        {/* ── 3-Column Grid: 280px | 1fr | 280px ── */}
        <div style={{ display: "grid", gridTemplateColumns: "280px 1fr 280px", gap: 16, alignItems: "start" }} className="print:block">

          {/* ════════ LEFT COLUMN — Identity Panel ════════ */}
          <div style={{ background: "#0F2942", borderRadius: 10, overflow: "hidden" }}>

            {/* Hero Banner */}
            <div style={{ background: "linear-gradient(135deg, #071E33 0%, #162E4A 50%, rgba(13,148,136,0.15) 100%)", padding: "20px 16px 16px", position: "relative", textAlign: "center" }}>
              {id.jersey_number && (
                <span style={{ position: "absolute", top: 8, right: 12, fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 48, color: "rgba(255,255,255,0.06)" }}>
                  {id.jersey_number}
                </span>
              )}
              <div style={{ width: 90, height: 90, borderRadius: "50%", border: "3px solid #0D9488", boxShadow: "0 0 0 4px rgba(13,148,136,0.15)", margin: "0 auto 10px", overflow: "hidden", position: "relative", background: "linear-gradient(145deg, #162E4A 0%, #1A3A56 100%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {hasRealImage(id.image_url) ? (
                  <img src={assetUrl(id.image_url)} alt={`${id.first_name} ${id.last_name}`} style={{ width: "100%", height: "100%", objectFit: "cover", position: "absolute", inset: 0 }} />
                ) : (
                  <span style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, color: "rgba(255,255,255,0.55)", fontSize: 28, position: "relative", zIndex: 1 }}>
                    {(id.first_name?.[0] || "")}{(id.last_name?.[0] || "")}
                  </span>
                )}
              </div>
              <p style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 22, color: "#FFFFFF", textTransform: "uppercase", letterSpacing: "0.04em", lineHeight: 1.1 }}>
                {id.first_name} {id.last_name}
              </p>
              <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "rgba(255,255,255,0.45)", marginTop: 4 }}>
                {fullPos}{id.shoots ? ` · ${id.shoots}` : ""}{id.current_team ? ` · ${id.current_team}` : ""}
              </p>
              <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                {intel?.archetype != null && (
                  <span style={{ background: "rgba(13,148,136,0.12)", border: "1px solid rgba(13,148,136,0.25)", borderRadius: 20, padding: "2px 8px", fontFamily: "'Oswald', sans-serif", fontWeight: 600, fontSize: 10, color: "#14B8A8" }}>
                    {String(intel.archetype)}
                  </span>
                )}
                {id.birth_year && (
                  <span style={{ background: "rgba(255,255,255,0.07)", borderRadius: 20, padding: "2px 8px", fontFamily: "'Oswald', sans-serif", fontWeight: 600, fontSize: 10, color: "rgba(255,255,255,0.5)" }}>
                    {id.birth_year + 18} DRAFT
                  </span>
                )}
              </div>
            </div>

            {/* PXI Score Strip */}
            <div style={{ background: "rgba(0,0,0,0.2)", borderTop: "1px solid rgba(255,255,255,0.06)", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>PXI SCORE</p>
                <p style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 32, color: "#14B8A8", lineHeight: 1 }}>
                  {pxiAvg > 0 ? pxiAvg.toFixed(1) : "—"}
                </p>
                <p style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 600, fontSize: 9, color: "#0D9488", marginTop: 2 }}>
                  {pxiAvg > 0 ? pxiGradeLabel : "NEEDS DATA"} {"·"} PXI
                </p>
              </div>
              <div>
                {pxiDimensions.length >= 3 && pxiAvg > 0
                  ? renderSpiderSVG(140, pxiDimensions)
                  : renderSpiderSVG(140, [
                      { label: "SNP", value: 0 }, { label: "IQ", value: 0 },
                      { label: "PLY", value: 0 }, { label: "TRN", value: 0 },
                      { label: "DEF", value: 0 }, { label: "CMP", value: 0 },
                    ])
                }
              </div>
            </div>

            {/* Physical Details */}
            <div style={{ padding: "14px 16px" }}>
              {id.dob && (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "rgba(255,255,255,0.3)", textTransform: "uppercase" }}>DOB</span>
                  <span style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 600, fontSize: 11, color: "rgba(255,255,255,0.75)" }}>{id.dob}{id.birth_year ? ` (${new Date().getFullYear() - id.birth_year}y)` : ""}</span>
                </div>
              )}
              {id.height_cm && (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "rgba(255,255,255,0.3)", textTransform: "uppercase" }}>Height</span>
                  <span style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 600, fontSize: 11, color: "rgba(255,255,255,0.75)" }}>{id.height_cm} cm</span>
                </div>
              )}
              {id.weight_kg && (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "rgba(255,255,255,0.3)", textTransform: "uppercase" }}>Weight</span>
                  <span style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 600, fontSize: 11, color: "rgba(255,255,255,0.75)" }}>{id.weight_kg} kg</span>
                </div>
              )}
              {id.commitment_status && (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "rgba(255,255,255,0.3)", textTransform: "uppercase" }}>Commitment</span>
                  <span style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 600, fontSize: 11, color: "rgba(255,255,255,0.75)", textTransform: "capitalize" }}>{id.commitment_status.replace(/_/g, " ")}</span>
                </div>
              )}
            </div>

            {/* Status Row */}
            <div style={{ background: id.health_status === "healthy" ? "rgba(30,107,60,0.08)" : "rgba(192,57,43,0.08)", borderTop: id.health_status === "healthy" ? "1px solid rgba(30,107,60,0.15)" : "1px solid rgba(192,57,43,0.15)", padding: "10px 16px", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: id.health_status === "healthy" ? "#22C55E" : "#C0392B", flexShrink: 0 }} />
              <span style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: id.health_status === "healthy" ? "#22C55E" : "#C0392B" }}>
                {healthStyle.label}
              </span>
            </div>

            {/* Scout Now Button */}
            {userRole !== "parent" && (
              <div style={{ padding: "0 16px 16px" }} className="print:hidden">
                <button
                  onClick={() => openBenchTalk(`Scout ${id.first_name} ${id.last_name}. Give me a scouting overview, strengths, weaknesses, and role projection.`, "scout", {
                    user: { id: getUser()?.id || "", name: getUser()?.first_name || "User", role: "SCOUT", orgId: getUser()?.org_id || "", orgName: "ProspectX" },
                    page: { id: "PLAYER_CARD", route: `/players/${playerId}/card` },
                    entity: { type: "PLAYER", id: playerId, name: `${id.first_name} ${id.last_name}`, metadata: { position: id.position || undefined, team: id.current_team || undefined, league: id.current_league || undefined } },
                  })}
                  style={{ width: "100%", background: "#0D9488", color: "#FFFFFF", fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 11, textTransform: "uppercase", padding: "10px", borderRadius: 7, border: "none", cursor: "pointer", marginTop: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                  className="hover:opacity-90 transition-opacity"
                >
                  <Search size={11} />
                  Scout Now
                </button>
              </div>
            )}
          </div>

          {/* ════════ MIDDLE COLUMN — Stats + PXI ════════ */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Season Stats Card */}
            <div style={{ background: "#FFFFFF", borderRadius: 10, overflow: "hidden", border: "1px solid #DDE6EF" }}>
              <div style={{ background: "#162E4A", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 600, fontSize: 10, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Season Stats</span>
                {league_context && (
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "rgba(255,255,255,0.3)" }}>{league_context.season}</span>
                )}
              </div>
              <div style={{ padding: 16 }}>
                {perf.current_stats ? (() => {
                  const HIDE_KEYS = new Set(["toi_seconds", "toi"]);
                  const entries = Object.entries(perf.current_stats!).filter(([k]) => !HIDE_KEYS.has(k.toLowerCase()));
                  return (
                    <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(entries.length, 7)}, 1fr)`, gap: 0 }}>
                      {entries.map(([key, val], i) => {
                        const isHighlight = ["p", "ppg"].includes(key.toLowerCase());
                        return (
                          <div key={key} style={{ textAlign: "center", padding: "4px 0", borderRight: i < entries.length - 1 ? "1px solid #DDE6EF" : "none" }}>
                            <p style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 24, color: isHighlight ? "#0D9488" : "#0F2942", lineHeight: 1.2 }}>
                              {typeof val === "number" ? (Number.isInteger(val) ? val : val.toFixed(1)) : val}
                            </p>
                            <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "#94A3B8", textTransform: "uppercase" }}>{key.toUpperCase()}</p>
                          </div>
                        );
                      })}
                    </div>
                  );
                })() : (
                  <p style={{ fontSize: 12, color: "#666666" }}>No stats available.</p>
                )}
              </div>
            </div>

            {/* PXI Scout Summary Card */}
            <div style={{ background: "#FFFFFF", borderRadius: 10, overflow: "hidden", border: "1px solid #DDE6EF" }}>
              <div style={{ background: "#162E4A", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#0D9488" }} />
                  <span style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 600, fontSize: 10, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.1em" }}>PXI Scout Summary</span>
                </div>
                {dev.skill_profile.updated_at && (
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "rgba(255,255,255,0.3)" }}>
                    Updated {new Date(dev.skill_profile.updated_at).toLocaleDateString()}
                  </span>
                )}
              </div>
              <div style={{ padding: 16 }}>
                {dev.skill_profile.pxi_version ? (
                  <div>
                    {intel?.strengths != null && (
                      <div style={{ display: "flex", gap: 10, marginBottom: 12, paddingBottom: 12, borderBottom: "1px solid #DDE6EF" }}>
                        <span style={{ background: "rgba(30,107,60,0.1)", color: "#1E6B3C", border: "1px solid rgba(30,107,60,0.2)", borderRadius: 4, padding: "2px 8px", fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em", flexShrink: 0, height: "fit-content" }}>Strengths</span>
                        <p style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 12.5, lineHeight: 1.6, color: "#2D3748" }}>
                          {(Array.isArray(intel.strengths) ? intel.strengths : tryParseJson(intel.strengths)).join(", ")}
                        </p>
                      </div>
                    )}
                    {intel?.development_areas != null && (
                      <div style={{ display: "flex", gap: 10, marginBottom: 12, paddingBottom: 12, borderBottom: "1px solid #DDE6EF" }}>
                        <span style={{ background: "rgba(230,126,34,0.1)", color: "#E67E22", border: "1px solid rgba(230,126,34,0.2)", borderRadius: 4, padding: "2px 8px", fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em", flexShrink: 0, height: "fit-content" }}>Develop</span>
                        <p style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 12.5, lineHeight: 1.6, color: "#2D3748" }}>
                          {(Array.isArray(intel.development_areas) ? intel.development_areas : tryParseJson(intel.development_areas)).join(", ")}
                        </p>
                      </div>
                    )}
                    {intel?.stat_signature != null && (
                      <div style={{ display: "flex", gap: 10 }}>
                        <span style={{ background: "rgba(13,148,136,0.1)", color: "#0D9488", border: "1px solid rgba(13,148,136,0.2)", borderRadius: 4, padding: "2px 8px", fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em", flexShrink: 0, height: "fit-content" }}>Projection</span>
                        <p style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 12.5, lineHeight: 1.6, color: "#2D3748" }}>
                          {String(intel.stat_signature)}
                        </p>
                      </div>
                    )}
                    {intel?.strengths == null && intel?.development_areas == null && (
                      <p style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 12.5, lineHeight: 1.6, color: "#2D3748" }}>{dev.skill_profile.pxi_version}</p>
                    )}
                  </div>
                ) : (
                  <div style={{ textAlign: "center", padding: "16px 0" }}>
                    <p style={{ fontSize: 12, color: "#666666", marginBottom: 8 }}>No PXI profile yet.</p>
                    <button
                      onClick={handleGenerateProfile}
                      disabled={generatingProfile}
                      style={{ background: "rgba(13,148,136,0.1)", color: "#0D9488", border: "1px solid rgba(13,148,136,0.2)", borderRadius: 7, padding: "6px 16px", fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 10, textTransform: "uppercase", cursor: "pointer" }}
                      className="hover:opacity-80 transition-opacity print:hidden"
                    >
                      {generatingProfile ? <Loader2 size={10} className="animate-spin inline mr-1" /> : <RefreshCw size={10} className="inline mr-1" />}
                      {generatingProfile ? "Generating..." : "Generate Profile"}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Trendline Card */}
            <div style={{ background: "#FFFFFF", borderRadius: 10, overflow: "hidden", border: "1px solid #DDE6EF" }}>
              <div style={{ background: "#162E4A", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 600, fontSize: 10, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Trendline</span>
                <select
                  value={trendMetric}
                  onChange={(e) => setTrendMetric(e.target.value)}
                  style={{ fontSize: 10, padding: "2px 8px", background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 4 }}
                  className="print:hidden"
                >
                  {TRENDLINE_METRICS.map((m) => (
                    <option key={m.value} value={m.value} style={{ background: "#162E4A", color: "#FFFFFF" }}>{m.label}</option>
                  ))}
                </select>
              </div>
              <div style={{ padding: 16 }}>
                {loadingTrend ? (
                  <div className="flex justify-center py-6">
                    <Loader2 size={18} className="animate-spin" style={{ color: "#666666" }} />
                  </div>
                ) : trendData ? (
                  <TrendlineChart data={trendData} />
                ) : (
                  <p style={{ fontSize: 12, color: "#666666", textAlign: "center", padding: "24px 0" }}>No trendline data.</p>
                )}
              </div>
            </div>

            {/* Event aggregates */}
            {perf.event_aggregates && perf.event_aggregates.has_event_data && (
              <div style={{ background: "#FFFFFF", borderRadius: 10, overflow: "hidden", border: "1px solid #DDE6EF" }}>
                <div style={{ background: "#162E4A", padding: "10px 16px" }}>
                  <span style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 600, fontSize: 10, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Event Intelligence</span>
                </div>
                <div style={{ padding: 16 }}>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <StatCell label="Zone Entry %" value={`${perf.event_aggregates.zone_entry_pct.toFixed(1)}%`} sub={`${perf.event_aggregates.zone_entries_controlled}/${perf.event_aggregates.zone_entries_total}`} />
                    <StatCell label="Zone Exit %" value={`${perf.event_aggregates.zone_exit_pct.toFixed(1)}%`} sub={`${perf.event_aggregates.zone_exits_controlled}/${perf.event_aggregates.zone_exits_total}`} />
                    <StatCell label="Retrievals" value={String(perf.event_aggregates.retrievals)} />
                    <StatCell label="Shot Attempts" value={String(perf.event_aggregates.shot_attempts)} />
                    <StatCell label="xG For" value={perf.event_aggregates.xg_for.toFixed(2)} />
                    <StatCell label="Chances" value={String(perf.event_aggregates.chances_for)} />
                    {perf.event_aggregates.faceoff_total > 0 && (
                      <StatCell label="Faceoff %" value={`${perf.event_aggregates.faceoff_pct.toFixed(1)}%`} sub={`${perf.event_aggregates.faceoff_wins}/${perf.event_aggregates.faceoff_total}`} />
                    )}
                  </div>
                  <p style={{ fontSize: 9, color: "#666666", marginTop: 8 }}>
                    {perf.event_aggregates.total_events} events across {perf.event_aggregates.games_with_events} games
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* ════════ RIGHT COLUMN — Skills + Intelligence ════════ */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Skill Profile Card */}
            <div style={{ background: "#FFFFFF", borderRadius: 10, overflow: "hidden", border: "1px solid #DDE6EF" }}>
              <div style={{ background: "#162E4A", padding: "10px 16px" }}>
                <span style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 600, fontSize: 10, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Skill Profile</span>
              </div>
              <div style={{ padding: 16 }}>
                {intel && (() => {
                  const bars = [
                    { key: "skating_grade", label: "Skating" },
                    { key: "hockey_iq_grade", label: "Hockey IQ" },
                    { key: "compete_grade", label: "Compete" },
                  ];
                  const barData = bars.map(b => ({ label: b.label, value: gradeToScore(intel[b.key]) })).filter(b => b.value > 0);
                  if (barData.length === 0) return null;
                  return (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 }}>
                      {barData.map(b => {
                        const pct = Math.max(5, (b.value / 10) * 100);
                        const tierLabel = b.value >= 8.5 ? "ELITE" : b.value >= 7 ? "ABOVE AVG" : b.value >= 5 ? "AVERAGE" : "BELOW AVG";
                        const barColor = b.value >= 8.5 ? "#22C55E" : b.value >= 7 ? "#0D9488" : b.value >= 5 ? "#F59E0B" : "#E67E22";
                        return (
                          <div key={b.label}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                              <span style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 600, fontSize: 10, textTransform: "uppercase", color: "#2D3748" }}>{b.label}</span>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#0F2942" }}>{b.value.toFixed(1)}</span>
                                <span style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 600, fontSize: 9, textTransform: "uppercase", color: barColor }}>{tierLabel}</span>
                              </div>
                            </div>
                            <div style={{ height: 5, background: "#E8EFF6", borderRadius: 3, overflow: "hidden" }}>
                              <div style={{ height: "100%", width: `${pct}%`, background: barColor, borderRadius: 3 }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
                {intel && (() => {
                  const offense = gradeToScore(intel.offensive_grade);
                  const defense = gradeToScore(intel.defensive_grade);
                  if (offense === 0 && defense === 0) return null;
                  const offLabel = offense >= 8.5 ? "ELITE" : offense >= 7 ? "ABOVE AVG" : offense >= 5 ? "AVERAGE" : "BELOW AVG";
                  const defLabel = defense >= 8.5 ? "ELITE" : defense >= 7 ? "ABOVE AVG" : defense >= 5 ? "AVERAGE" : "BELOW AVG";
                  return (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      {offense > 0 && (
                        <div style={{ background: "#0F2942", borderRadius: 8, padding: 10, textAlign: "center" }}>
                          <p style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 26, color: "#14B8A8" }}>{offense.toFixed(1)}</p>
                          <p style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 600, fontSize: 9, color: "rgba(255,255,255,0.4)", textTransform: "uppercase" }}>Offense</p>
                          <p style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 600, fontSize: 8, color: "#22C55E", marginTop: 2, textTransform: "uppercase" }}>{offLabel}</p>
                        </div>
                      )}
                      {defense > 0 && (
                        <div style={{ background: "#0F2942", borderRadius: 8, padding: 10, textAlign: "center" }}>
                          <p style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 26, color: "#14B8A8" }}>{defense.toFixed(1)}</p>
                          <p style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 600, fontSize: 9, color: "rgba(255,255,255,0.4)", textTransform: "uppercase" }}>Defense</p>
                          <p style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 600, fontSize: 8, color: "#22C55E", marginTop: 2, textTransform: "uppercase" }}>{defLabel}</p>
                        </div>
                      )}
                    </div>
                  );
                })()}
                {!intel && <p style={{ fontSize: 12, color: "#666666" }}>No skill data available.</p>}
              </div>
            </div>

            {/* Intelligence Summary Card */}
            {intel && (
              <div style={{ background: "#FFFFFF", borderRadius: 10, overflow: "hidden", border: "1px solid #DDE6EF" }}>
                <div style={{ background: "#162E4A", padding: "10px 16px" }}>
                  <span style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 600, fontSize: 10, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Intelligence Summary</span>
                </div>
                <div style={{ padding: 16 }}>
                  {intel.strengths != null && (
                    <div style={{ marginBottom: 12 }}>
                      <p style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: "#94A3B8", marginBottom: 6 }}>Strengths</p>
                      {(Array.isArray(intel.strengths) ? intel.strengths : tryParseJson(intel.strengths)).map((s: string, i: number) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#22C55E", flexShrink: 0 }} />
                          <span style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 12, color: "#2D3748" }}>{s}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {intel.development_areas != null && (
                    <div>
                      <p style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: "#94A3B8", marginBottom: 6 }}>Development Areas</p>
                      {(Array.isArray(intel.development_areas) ? intel.development_areas : tryParseJson(intel.development_areas)).map((s: string, i: number) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#E67E22", flexShrink: 0 }} />
                          <span style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 12, color: "#2D3748" }}>{s}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Recent Games Table */}
            {perf.game_log && perf.game_log.length > 0 && (
              <div style={{ background: "#FFFFFF", borderRadius: 10, overflow: "hidden", border: "1px solid #DDE6EF" }}>
                <div style={{ background: "#162E4A", padding: "10px 16px" }}>
                  <span style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 600, fontSize: 10, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Recent Games</span>
                </div>
                <div>
                  <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#FAFBFC" }}>
                        <th style={{ textAlign: "left", padding: "6px 8px", fontFamily: "'Oswald', sans-serif", fontWeight: 600, fontSize: 9, textTransform: "uppercase", color: "#94A3B8" }}>Date</th>
                        <th style={{ textAlign: "left", padding: "6px 8px", fontFamily: "'Oswald', sans-serif", fontWeight: 600, fontSize: 9, textTransform: "uppercase", color: "#94A3B8" }}>Opp</th>
                        <th style={{ textAlign: "right", padding: "6px 8px", fontFamily: "'Oswald', sans-serif", fontWeight: 600, fontSize: 9, textTransform: "uppercase", color: "#94A3B8" }}>G</th>
                        <th style={{ textAlign: "right", padding: "6px 8px", fontFamily: "'Oswald', sans-serif", fontWeight: 600, fontSize: 9, textTransform: "uppercase", color: "#94A3B8" }}>A</th>
                        <th style={{ textAlign: "right", padding: "6px 8px", fontFamily: "'Oswald', sans-serif", fontWeight: 600, fontSize: 9, textTransform: "uppercase", color: "#94A3B8" }}>P</th>
                        <th style={{ textAlign: "right", padding: "6px 8px", fontFamily: "'Oswald', sans-serif", fontWeight: 600, fontSize: 9, textTransform: "uppercase", color: "#94A3B8" }}>SOG</th>
                        <th style={{ textAlign: "right", padding: "6px 8px", fontFamily: "'Oswald', sans-serif", fontWeight: 600, fontSize: 9, textTransform: "uppercase", color: "#94A3B8" }}>+/-</th>
                      </tr>
                    </thead>
                    <tbody>
                      {perf.game_log.slice(0, 8).map((g, i) => (
                        <tr key={i} style={{ borderBottom: "1px solid #DDE6EF" }} className="hover:bg-[#F8FBFF]">
                          <td style={{ padding: "6px 8px", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#94A3B8" }}>{String(g.date || g.game_date || "—")}</td>
                          <td style={{ padding: "6px 8px", fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 12, fontWeight: 600, color: "#0F2942" }}>{String(g.opponent || "—")}</td>
                          <td style={{ padding: "6px 8px", textAlign: "right", fontFamily: "'JetBrains Mono', monospace" }}>{String(g.g ?? g.goals ?? "—")}</td>
                          <td style={{ padding: "6px 8px", textAlign: "right", fontFamily: "'JetBrains Mono', monospace" }}>{String(g.a ?? g.assists ?? "—")}</td>
                          <td style={{ padding: "6px 8px", textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, color: "#0F2942" }}>{String(g.p ?? g.points ?? "—")}</td>
                          <td style={{ padding: "6px 8px", textAlign: "right", fontFamily: "'JetBrains Mono', monospace" }}>{String(g.sog ?? g.shots ?? "—")}</td>
                          <td style={{ padding: "6px 8px", textAlign: "right", fontFamily: "'JetBrains Mono', monospace" }}>{String(g.plus_minus ?? "—")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Coach Notes */}
            <div style={{ background: "#FFFFFF", borderRadius: 10, overflow: "hidden", border: "1px solid #DDE6EF" }}>
              <div style={{ background: "#162E4A", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 600, fontSize: 10, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Coach Notes</span>
                {!editingCoachProfile && (
                  <button
                    onClick={() => {
                      setCoachProfileDraft(dev.skill_profile.coach_version || "");
                      setEditingCoachProfile(true);
                    }}
                    style={{ color: "rgba(255,255,255,0.4)", cursor: "pointer", background: "none", border: "none" }}
                    className="hover:opacity-80 print:hidden"
                  >
                    <Edit3 size={11} />
                  </button>
                )}
              </div>
              <div style={{ padding: 16 }}>
                {editingCoachProfile ? (
                  <div className="print:hidden" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <textarea
                      value={coachProfileDraft}
                      onChange={(e) => setCoachProfileDraft(e.target.value)}
                      rows={4}
                      style={{ width: "100%", fontSize: 12, border: "1px solid #DDE6EF", borderRadius: 8, padding: 8, resize: "none", fontFamily: "'Source Serif 4', Georgia, serif" }}
                      placeholder="Add coach assessment..."
                    />
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={handleSaveCoachProfile} style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", background: "#0D9488", color: "#FFFFFF", fontSize: 10, borderRadius: 4, border: "none", cursor: "pointer" }}>
                        <Save size={10} /> Save
                      </button>
                      <button onClick={() => setEditingCoachProfile(false)} style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", color: "#666666", fontSize: 10, borderRadius: 4, border: "none", cursor: "pointer", background: "#F5F5F5" }}>
                        <X size={10} /> Cancel
                      </button>
                    </div>
                  </div>
                ) : dev.skill_profile.coach_version ? (
                  <p style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 12, lineHeight: 1.6, color: "#2D3748" }}>{dev.skill_profile.coach_version}</p>
                ) : (
                  <p style={{ fontSize: 12, color: "#666666" }}>No coach notes yet.</p>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            {userRole !== "parent" && (
              <div style={{ display: "flex", gap: 8 }} className="print:hidden">
                <button
                  onClick={() => openBenchTalk(`Scout ${id.first_name} ${id.last_name}. Give me a scouting overview, strengths, weaknesses, and role projection.`, "scout", {
                    user: { id: getUser()?.id || "", name: getUser()?.first_name || "User", role: "SCOUT", orgId: getUser()?.org_id || "", orgName: "ProspectX" },
                    page: { id: "PLAYER_CARD", route: `/players/${playerId}/card` },
                    entity: { type: "PLAYER", id: playerId, name: `${id.first_name} ${id.last_name}`, metadata: { position: id.position || undefined, team: id.current_team || undefined, league: id.current_league || undefined } },
                  })}
                  style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px 12px", background: "rgba(13,148,136,0.1)", color: "#0D9488", border: "1px solid rgba(13,148,136,0.2)", borderRadius: 7, fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 10, textTransform: "uppercase", cursor: "pointer" }}
                  className="hover:opacity-80 transition-opacity"
                >
                  <Search size={11} />
                  Scout
                </button>
                <Link
                  href={`/reports/generate?player_id=${playerId}`}
                  style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px 12px", background: "#F5F5F5", color: "#2D3748", border: "1px solid #DDE6EF", borderRadius: 7, fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 10, textTransform: "uppercase" }}
                  className="hover:opacity-80 transition-opacity"
                >
                  <FileText size={11} />
                  Report
                </Link>
              </div>
            )}
          </div>
        </div>
      </main>
    </ProtectedRoute>
  );
}


// ── Helper components ──

function StatCell({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="text-center bg-navy/[0.03] rounded-lg p-2">
      <p className="text-[9px] font-oswald uppercase tracking-wider text-muted">{label}</p>
      <p className="text-sm font-bold text-navy">{value}</p>
      {sub && <p className="text-[9px] text-muted">{sub}</p>}
    </div>
  );
}

function tryParseJson(val: unknown): string[] {
  if (Array.isArray(val)) return val;
  if (typeof val === "string") {
    try { return JSON.parse(val); } catch { return [val]; }
  }
  return [];
}

function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  const diffWeek = Math.floor(diffDay / 7);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  if (diffWeek < 4) return `${diffWeek}w ago`;
  return date.toLocaleDateString();
}
