"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRightLeft,
  FileText,
  Upload,
  Zap,
  CheckCircle,
  PenLine,
  Send,
  Lock,
  Unlock,
  Trash2,
  Edit3,
  X,
  Shield,
  Swords,
  Target,
  TrendingUp,
  Activity,
  User,
  Camera,
  Save,
  Brain,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Star,
  AlertTriangle,
  Wand2,
  Flame,
  Download,
  ClipboardCheck,
  ExternalLink,
  Loader2,
  Plus,
  History,
  Sparkles,
  Eye,
  EyeOff,
  Video,
  Play,
  MoreVertical,
  Search,
  ListPlus,
  Clock,
  Scissors,
  Phone,
  Mail,
  Film,
  Share2,
} from "lucide-react";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  ResponsiveContainer,
} from "recharts";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import StatTable from "@/components/StatTable";
import ExtendedStatTable from "@/components/ExtendedStatTable";
import GoalieStatTable from "@/components/GoalieStatTable";
import ReportCard from "@/components/ReportCard";
import api, { assetUrl, hasRealImage } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { formatLeague } from "@/lib/leagues";
import ProgressionChart from "@/components/ProgressionChart";
import GameLogTable from "@/components/GameLogTable";
import PlayerStatusBadges from "@/components/PlayerStatusBadges";
import { useBenchTalk } from "@/components/BenchTalkProvider";
import TrendlineChart from "@/components/TrendlineChart";
import type { Player, PlayerStats, GoalieStats, Report, ScoutNote, TeamSystem, SystemLibraryEntry, PlayerIntelligence, PlayerMetrics, League, TeamReference, Progression, GameStatsResponse, RecentForm, PlayerCorrection, DevelopmentPlan, DevelopmentPlanSection, PlayerDrillLogsResponse, PlayerTransfer, PlayerAchievement, TeamSplit } from "@/types/api";
import CareerHistoryAccordion from "@/components/player/CareerHistoryAccordion";
import AchievementsAccordion from "@/components/player/AchievementsAccordion";
import { NOTE_TYPE_LABELS, NOTE_TAG_OPTIONS, NOTE_TAG_LABELS, PROSPECT_GRADES, STAT_SIGNATURE_LABELS, METRIC_COLORS, METRIC_ICONS, COMMITMENT_STATUS_OPTIONS, COMMITMENT_STATUS_COLORS, CORRECTABLE_FIELDS, CORRECTABLE_FIELD_LABELS, PROSPECT_STATUS_LABELS } from "@/types/api";

type Tab = "profile" | "stats" | "notes" | "reports" | "player" | "video";
type StatsSubView = "current" | "progression" | "gamelog";

const POSITION_LABELS: Record<string, string> = {
  C: "Center",
  LW: "Left Wing",
  RW: "Right Wing",
  D: "Defense",
  G: "Goalie",
  F: "Forward",
  LD: "Left Defense",
  RD: "Right Defense",
};

// Grade/score-to-number conversion (1-10 scale)
const GRADE_TO_NUMBER: Record<string, number> = {
  "A+": 10, "A": 9.5, "A-": 9, "B+": 8.5, "B": 8, "B-": 7.5,
  "C+": 7, "C": 6.5, "C-": 6, "D+": 5.5, "D": 5, "D-": 4.5, "F": 3, "NR": 0,
};
function gradeToNumber(grade: string | null | undefined): number {
  if (!grade || grade === "NR") return 0;
  return GRADE_TO_NUMBER[grade] ?? (parseFloat(grade) || 0);
}
function scoreLabel(score: number): string {
  if (score >= 9.0) return "Elite";
  if (score >= 8.0) return "Excellent";
  if (score >= 7.0) return "Strong";
  if (score >= 6.0) return "Developing";
  if (score >= 5.0) return "Building";
  return "Early Stage";
}

function gradeToOverallBand(grade: string | null | undefined): string | null {
  if (!grade || grade === "NR") return null;
  const score = GRADE_TO_NUMBER[grade] ?? (parseFloat(grade) || 0);
  if (score >= 9.0) return "Top prospect in league";
  if (score >= 8.0) return "Above-average at level";
  if (score >= 6.5) return "Average at level";
  if (score >= 5.0) return "Depth / fringe roster";
  return "Too early to project";
}

function fullPosition(pos: string | null | undefined): string {
  if (!pos) return "Unknown";
  return POSITION_LABELS[pos.toUpperCase()] || pos;
}

// ── PXI Radar + Donut helpers (ported from PXI_PlayerProfile_v3_styled mockup) ──

interface PxiMetricItem {
  key: string;
  label: string;
  score: number;
  icon: string;
  stroke: string;
  bg: string;
  text: string;
  pct: string;
}

function buildPxiMetrics(
  playerMetrics: PlayerMetrics | null,
  pxrData: { p1_offense: number | null; p2_defense: number | null; p3_possession: number | null; p4_physical: number | null } | null,
): PxiMetricItem[] {
  // Try real player metrics first, then PXR pillars, then placeholders
  type MetricKey = "sniper" | "playmaker" | "transition" | "defensive" | "compete" | "hockey_iq";
  const getIdx = (metricKey: MetricKey) => playerMetrics?.indices?.[metricKey];
  const get = (metricKey: MetricKey, pxrKey: string | null, fallback: number): number => {
    const idx = getIdx(metricKey);
    if (idx) return idx.value ?? fallback;
    if (pxrKey && pxrData && (pxrData as unknown as Record<string, number | null>)[pxrKey] != null)
      return Math.round(((pxrData as unknown as Record<string, number | null>)[pxrKey] as number));
    return fallback;
  };
  const pctBand = (v: number): string =>
    v >= 90 ? "Elite" : v >= 75 ? "Above Avg" : v >= 50 ? "Average" : v >= 25 ? "Below Avg" : "Developing";
  const pctile = (metricKey: MetricKey): number =>
    getIdx(metricKey)?.percentile ?? Math.round(Math.min(99, Math.max(1, (get(metricKey, null, 50) / 99) * 100)));

  const snp = get("sniper", "p1_offense", 50);
  const ply = get("playmaker", null, 50);
  const trn = get("transition", "p3_possession", 50);
  const def = get("defensive", "p2_defense", 50);
  const cmp = get("compete", "p4_physical", 50);
  const iq  = get("hockey_iq", null, 50);

  return [
    { key: "SNP", label: "Sniper",     score: snp, icon: "\u{1F3AF}", stroke: "#EF4444", bg: "#FEF2F2", text: "#EF4444", pct: `${pctBand(snp)} · P${pctile("sniper")}` },
    { key: "PLY", label: "Playmaker",  score: ply, icon: "\u270F\uFE0F",  stroke: "#6366F1", bg: "#EEF2FF", text: "#6366F1", pct: `${pctBand(ply)} · P${pctile("playmaker")}` },
    { key: "TRN", label: "Transition", score: trn, icon: "\u26A1",  stroke: "#0D9488", bg: "#F0FDF9", text: "#0D9488", pct: `${pctBand(trn)} · P${pctile("transition")}` },
    { key: "DEF", label: "Defensive",  score: def, icon: "\u{1F6E1}\uFE0F",  stroke: "#0F2942", bg: "#F0F4F8", text: "#0F2942", pct: `${pctBand(def)} · P${pctile("defensive")}` },
    { key: "CMP", label: "Compete",    score: cmp, icon: "\u{1F4AA}", stroke: "#F97316", bg: "#FFF7ED", text: "#F97316", pct: `${pctBand(cmp)} · P${pctile("compete")}` },
    { key: "IQ",  label: "Hockey IQ",  score: iq,  icon: "\u{1F9E0}", stroke: "#A855F7", bg: "#FAF5FF", text: "#A855F7", pct: `${pctBand(iq)} · P${pctile("hockey_iq")}` },
  ];
}

function PxiRadarChart({ metrics }: { metrics: PxiMetricItem[] }) {
  const size = 200, cx = 100, cy = 100, r = 72;
  const n = metrics.length;
  const angles = metrics.map((_, i) => (i * 2 * Math.PI / n) - Math.PI / 2);
  const dataPoints = metrics.map((m, i) => ({
    x: cx + r * (m.score / 100) * Math.cos(angles[i]),
    y: cy + r * (m.score / 100) * Math.sin(angles[i]),
  }));
  const poly = dataPoints.map(p => `${p.x},${p.y}`).join(" ");
  const gridLevels = [0.25, 0.5, 0.75, 1.0];
  const labelR = r + 20;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: "visible" }}>
      {gridLevels.map((lvl, gi) => {
        const pts = angles.map(a => `${cx + r * lvl * Math.cos(a)},${cy + r * lvl * Math.sin(a)}`).join(" ");
        return <polygon key={gi} points={pts} fill="none" stroke="#DDE6EF" strokeWidth="1" />;
      })}
      {angles.map((a, i) => (
        <line key={i} x1={cx} y1={cy} x2={cx + r * Math.cos(a)} y2={cy + r * Math.sin(a)} stroke="#DDE6EF" strokeWidth="1" />
      ))}
      <polygon points={poly} fill="rgba(13,148,136,.15)" stroke="#0D9488" strokeWidth="2.5" strokeLinejoin="round" />
      {dataPoints.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={4.5} fill="#0D9488" stroke="white" strokeWidth={1.5} />
      ))}
      {metrics.map((m, i) => {
        const lx = cx + labelR * Math.cos(angles[i]);
        const ly = cy + labelR * Math.sin(angles[i]);
        return (
          <text key={i} x={lx} y={ly} textAnchor="middle" dominantBaseline="middle"
            style={{ fontSize: 9.5, fontFamily: "'DM Sans', sans-serif", fill: "#5A7291", fontWeight: 600 }}>
            {m.label}
          </text>
        );
      })}
    </svg>
  );
}

function PxiDonutCircle({ m }: { m: PxiMetricItem }) {
  const rad = 29;
  const circ = 2 * Math.PI * rad;
  const dash = (m.score / 100) * circ;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, background: "#F7FAFB", borderRadius: 10, padding: "10px 6px 8px", border: "1px solid #EEF3F8" }}>
      <div style={{ position: "relative", width: 72, height: 72, flexShrink: 0 }}>
        <svg width="72" height="72" viewBox="0 0 72 72">
          <circle cx="36" cy="36" r={rad} fill={m.bg} stroke="#E5E7EB" strokeWidth="7" />
          <circle cx="36" cy="36" r={rad} fill="none"
            stroke={m.stroke} strokeWidth="7"
            strokeDasharray={`${dash} ${circ - dash}`}
            strokeLinecap="round"
            transform="rotate(-90 36 36)" />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 0 }}>
          <div style={{ fontSize: 13, lineHeight: 1, marginBottom: 1 }}>{m.icon}</div>
          <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1, letterSpacing: -0.5, color: m.text }}>{m.score}</div>
        </div>
      </div>
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase" as const, color: "#0F2942" }}>{m.key}</div>
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 8, fontWeight: 600, padding: "2px 6px", borderRadius: 3, letterSpacing: ".02em", background: m.bg, color: m.text }}>{m.pct}</div>
    </div>
  );
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.max(0, now - then);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

// Section titles for the 9-section development plan model
const DEV_PLAN_SECTION_TITLES: Record<number, string> = {
  1: "Current Performance",
  2: "Technical Skills",
  3: "Physical Development",
  4: "Mental Game",
  5: "Hockey IQ",
  6: "Goals & Milestones",
  7: "Action Plan",
  8: "Staff Notes",
};

// Plain-language stat labels for parents
const PARENT_STAT_LABELS: Record<string, string> = {
  "CF%": "Was on the ice for more shots than against (possession)",
  xGF: "Created high-quality scoring chances",
  "TOI/game": "Ice time per game",
  entry_success_rate: "Successfully carried the puck into the offensive zone",
  fo_pct: "Won faceoffs",
  battles_pct: "Won puck battles along the boards",
  inner_slot_pct: "Shot from high-danger areas",
};

// Interface for v2 dev plan with 9 section columns
interface DevPlanV2 {
  id: string;
  player_id: string;
  org_id?: string;
  version: number;
  title: string;
  status: "draft" | "final";
  season: string;
  created_by: string;
  created_by_name: string;
  plan_type: string;
  is_current: boolean;
  section_1_snapshot: string | null;
  section_2_context: string | null;
  section_3_strengths: string | null;
  section_4_development: string | null;
  section_5_phase_plan: string | null;
  section_6_integration: string | null;
  section_7_metrics: string | null;
  section_8_staff_notes: string | null;
  section_9_raw: string | null;
  section_1_visible_to_player: boolean;
  section_2_visible_to_player: boolean;
  section_3_visible_to_player: boolean;
  section_4_visible_to_player: boolean;
  section_5_visible_to_player: boolean;
  section_6_visible_to_player: boolean;
  section_7_visible_to_player: boolean;
  section_8_visible_to_player: boolean;
  sections?: DevelopmentPlanSection[];
  summary: string | null;
  created_at: string;
  updated_at: string;
}

const COACH_ROLES = new Set(["coach", "gm", "admin", "scout"]);
const FAMILY_ROLES = new Set(["parent", "player"]);

export default function PlayerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const playerId = params.id as string;
  const currentUser = useMemo(() => getUser(), []);
  const userRole = currentUser?.hockey_role || "scout";
  const { openBenchTalk, setActivePxiContext } = useBenchTalk();

  const [player, setPlayer] = useState<Player | null>(null);
  const [stats, setStats] = useState<PlayerStats[]>([]);
  const [goalieStats, setGoalieStats] = useState<GoalieStats[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [notes, setNotes] = useState<ScoutNote[]>([]);
  const [teamSystem, setTeamSystem] = useState<TeamSystem | null>(null);
  const [systemsLibrary, setSystemsLibrary] = useState<SystemLibraryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("profile");

  // Stats sub-views
  const [statsSubView, setStatsSubView] = useState<StatsSubView>("current");
  const [progression, setProgression] = useState<Progression | null>(null);
  const [gameLog, setGameLog] = useState<GameStatsResponse | null>(null);
  const [gameLogOffset, setGameLogOffset] = useState(0);
  const [recentForm, setRecentForm] = useState<RecentForm | null>(null);
  const [trendlineData, setTrendlineData] = useState<import("@/types/api").TrendlineResponse | null>(null);
  const [pxrData, setPxrData] = useState<{ pxr_score: number | null; p1_offense: number | null; p2_defense: number | null; p3_possession: number | null; p4_physical: number | null; league_percentile: number | null; cohort_percentile: number | null; age_modifier: number | null; toi_gate_met?: number; data_completeness: number | null; confidence_tier?: string | null; gp?: number | null; toi_minutes?: number | null; pxr_null_reason?: string | null } | null>(null);
  const [loadingProgression, setLoadingProgression] = useState(false);
  const [loadingGameLog, setLoadingGameLog] = useState(false);

  // Player Intelligence
  const [intelligence, setIntelligence] = useState<PlayerIntelligence | null>(null);
  const [intelHistory, setIntelHistory] = useState<PlayerIntelligence[]>([]);
  const [showIntelHistory, setShowIntelHistory] = useState(false);
  const [refreshingIntel, setRefreshingIntel] = useState(false);

  // ProspectX Metrics
  const [playerMetrics, setPlayerMetrics] = useState<PlayerMetrics | null>(null);

  // Archetype editing
  const [editingArchetype, setEditingArchetype] = useState(false);
  const [archetypeValue, setArchetypeValue] = useState("");

  // Inline bio editing
  const [editingBio, setEditingBio] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState("");
  const [editFields, setEditFields] = useState({
    current_team: "",
    current_league: "",
    position: "",
    shoots: "",
    dob: "",
    height_cm: "" as string | number,
    weight_kg: "" as string | number,
  });
  // Reference data for league/team dropdowns
  const [editLeagues, setEditLeagues] = useState<League[]>([]);
  const [editRefTeams, setEditRefTeams] = useState<TeamReference[]>([]);
  const [customLeague, setCustomLeague] = useState(false);
  const [customTeam, setCustomTeam] = useState(false);

  // Contact info editing
  const [editingContact, setEditingContact] = useState(false);
  const [savingContact, setSavingContact] = useState(false);
  const [contactFields, setContactFields] = useState({
    email: "", phone: "", parent_email: "", parent_phone: "", agent_email: "", agent_phone: "",
  });

  // Transfer modal
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferLeague, setTransferLeague] = useState("");
  const [transferTeam, setTransferTeam] = useState("");
  const [transferNote, setTransferNote] = useState("");
  const [transferCustomLeague, setTransferCustomLeague] = useState(false);
  const [transferCustomTeam, setTransferCustomTeam] = useState(false);
  const [submittingTransfer, setSubmittingTransfer] = useState(false);

  // Transfer tracking
  const [playerTransfers, setPlayerTransfers] = useState<PlayerTransfer[]>([]);
  const [playerAchievements, setPlayerAchievements] = useState<PlayerAchievement[]>([]);
  const [teamSplits, setTeamSplits] = useState<TeamSplit[]>([]);

  // CSV upload
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");

  // Image upload
  const [uploadingImage, setUploadingImage] = useState(false);

  // QuickActions overflow menu
  const [overflowOpen, setOverflowOpen] = useState(false);
  const overflowRef = useRef<HTMLDivElement>(null);

  // Correction form
  const [showCorrectionForm, setShowCorrectionForm] = useState(false);
  const [correctionField, setCorrectionField] = useState("");
  const [correctionValue, setCorrectionValue] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");
  const [correctionConfidence, setCorrectionConfidence] = useState<"low" | "medium" | "high">("medium");
  const [submittingCorrection, setSubmittingCorrection] = useState(false);
  const [correctionMsg, setCorrectionMsg] = useState("");
  const [pendingCorrections, setPendingCorrections] = useState(0);

  // Note form
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [noteType, setNoteType] = useState("general");
  const [noteTags, setNoteTags] = useState<string[]>([]);
  const [notePrivate, setNotePrivate] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);

  // Development Plans (legacy)
  const [devPlan, setDevPlan] = useState<DevelopmentPlan | null>(null);
  const [devPlanVersions, setDevPlanVersions] = useState<DevelopmentPlan[]>([]);
  const [loadingDevPlan, setLoadingDevPlan] = useState(false);
  const [generatingDevPlan, setGeneratingDevPlan] = useState(false);
  const [editingDevSection, setEditingDevSection] = useState<number | null>(null);
  const [editDevContent, setEditDevContent] = useState("");
  const [editDevTitle, setEditDevTitle] = useState("");
  const [savingDevPlan, setSavingDevPlan] = useState(false);
  const [showDevVersions, setShowDevVersions] = useState(false);

  // Development Plans v2 (9-section model)
  const [devPlanV2, setDevPlanV2] = useState<DevPlanV2 | null>(null);
  const [devPlanV2History, setDevPlanV2History] = useState<DevPlanV2[]>([]);
  const [draftSections, setDraftSections] = useState<Record<string, string> | null>(null);
  const [planStatus, setPlanStatus] = useState<"empty" | "generating" | "draft" | "saved">("empty");
  const [visibilityFlags, setVisibilityFlags] = useState<Record<string, boolean>>({});
  const [editingV2Section, setEditingV2Section] = useState<number | null>(null);
  const [editV2Content, setEditV2Content] = useState("");

  // Training Volume (drill logs)
  const [drillLogData, setDrillLogData] = useState<PlayerDrillLogsResponse | null>(null);

  // Parent Access (coach/admin only)
  const [linkedParents, setLinkedParents] = useState<{ link_id: string; user_id: string; email: string; first_name: string | null; last_name: string | null; created_at: string }[]>([]);
  const [parentEmail, setParentEmail] = useState("");
  const [linkingParent, setLinkingParent] = useState(false);

  // Film Room clips for this player
  const [filmClips, setFilmClips] = useState<{ id: string; title: string; description?: string | null; start_time_seconds: number; end_time_seconds: number; session_id?: string; created_at: string; session_title?: string; session_upload_count?: number }[]>([]);
  const [filmClipsLoading, setFilmClipsLoading] = useState(false);

  // Player reels
  const [playerReels, setPlayerReels] = useState<{ id: string; title: string; clip_ids?: string[]; status?: string; share_enabled?: boolean; share_token?: string; created_at: string }[]>([]);
  const [reelsLoading, setReelsLoading] = useState(false);

  // Film → Dev Plan bridge (P1): stat trends + PXI film suggestions
  const [statTrends, setStatTrends] = useState<{ stat_name: string; label: string; current_value: number | null; season_avg: number | null; pct_change: number | null; severity: string; trigger_reason: string; event_type_filter: string | null }[]>([]);
  const [statTrendsClipCounts, setStatTrendsClipCounts] = useState<Record<string, number>>({});
  const [statTrendsLoading, setStatTrendsLoading] = useState(false);
  const [filmSuggestions, setFilmSuggestions] = useState<{ stat_name: string; label: string; coaching_note: string; severity: string; trigger_reason: string; event_type_filter: string | null }[]>([]);

  // P2-C2: Post-game film summaries
  const [filmSummaries, setFilmSummaries] = useState<{ id: string; summary: string; session_id: string; created_at: string; data_sources_used?: Record<string, unknown> }[]>([]);

  const loadFilmClips = useCallback(async () => {
    setFilmClipsLoading(true);
    try {
      const { data } = await api.get("/film/clips", { params: { player_id: playerId, limit: 50 } });
      const clips = Array.isArray(data) ? data : [];
      // Fetch session metadata for multi-video grouping
      const uniqueSessionIds = [...new Set(clips.map((c: { session_id?: string }) => c.session_id).filter(Boolean))] as string[];
      const sessionMeta: Record<string, { title: string; upload_count: number }> = {};
      if (uniqueSessionIds.length > 0) {
        await Promise.all(uniqueSessionIds.map(async (sid) => {
          try {
            const { data: sData } = await api.get(`/film/sessions/${sid}`);
            sessionMeta[sid] = { title: sData.title || "Session", upload_count: sData.upload_count || 1 };
          } catch { /* non-critical */ }
        }));
      }
      // Enrich clips with session metadata
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setFilmClips(clips.map((c: any) => {
        const meta = c.session_id ? sessionMeta[c.session_id] : undefined;
        return { ...c, session_title: meta?.title, session_upload_count: meta?.upload_count };
      }));
    } catch {
      /* non-critical */
    } finally {
      setFilmClipsLoading(false);
    }
  }, [playerId]);

  const loadNotes = useCallback(async () => {
    try {
      const { data } = await api.get<ScoutNote[]>(`/players/${playerId}/notes`);
      setNotes(data);
    } catch {
      // non-critical
    }
  }, [playerId]);

  // Generate a v2 development plan (returns draft without saving)
  const handleGenerateV2 = async () => {
    setPlanStatus("generating");
    setGeneratingDevPlan(true);
    try {
      const { data } = await api.post(`/players/${playerId}/development-plan/generate`);
      // data has section_1_snapshot through section_9_raw
      const sections: Record<string, string> = {};
      for (let i = 1; i <= 8; i++) {
        const key = `section_${i}_${["snapshot", "context", "strengths", "development", "phase_plan", "integration", "metrics", "staff_notes"][i - 1]}`;
        sections[key] = data[key] || "";
      }
      sections.section_9_raw = data.section_9_raw || "";
      setDraftSections(sections);
      // Default visibility
      const vis: Record<string, boolean> = {};
      for (let i = 1; i <= 7; i++) vis[`section_${i}_visible_to_player`] = true;
      vis["section_8_visible_to_player"] = false;
      setVisibilityFlags(vis);
      setPlanStatus("draft");
      toast.success("Development plan generated — review and save");
    } catch {
      toast.error("Failed to generate plan");
      setPlanStatus(devPlanV2 ? "saved" : "empty");
    } finally {
      setGeneratingDevPlan(false);
    }
  };

  // Save draft as a new version
  const handleSaveV2 = async (status: "draft" | "final") => {
    if (!draftSections) return;
    setSavingDevPlan(true);
    try {
      const payload = {
        ...draftSections,
        ...visibilityFlags,
        season: new Date().getFullYear() > 6 ? `${new Date().getFullYear()}-${String(new Date().getFullYear() + 1).slice(2)}` : `${new Date().getFullYear() - 1}-${String(new Date().getFullYear()).slice(2)}`,
        status,
        title: `${player?.first_name} ${player?.last_name} Development Plan`,
        plan_type: "in_season",
        summary: draftSections.section_1_snapshot?.slice(0, 200) || null,
      };
      const { data } = await api.post<DevPlanV2>(`/players/${playerId}/development-plan`, payload);
      setDevPlanV2(data);
      setDraftSections(null);
      setPlanStatus("saved");
      toast.success(status === "final" ? "Plan finalized!" : "Draft saved");
      // Refresh history
      try {
        const histRes = await api.get<DevPlanV2[]>(`/players/${playerId}/development-plan/history`);
        setDevPlanV2History(histRes.data);
      } catch { /* Non-critical */ }
    } catch {
      toast.error("Failed to save plan");
    } finally {
      setSavingDevPlan(false);
    }
  };

  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadMsg("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const { data } = await api.post(`/stats/ingest?player_id=${playerId}`, formData);
      // Build smart feedback based on unified engine response
      const routedTo = data.routed_to || "player_stats";
      const pxrTriggered = data.pxr_triggered === true;
      const created = data.players_created || 0;
      let msg = routedTo.includes("instat")
        ? `✓ Advanced stats imported.${pxrTriggered ? " PXR score updating..." : ""}`
        : `✓ Stats imported successfully.`;
      if (created > 0) msg += ` ${created} new player profile${created > 1 ? "s" : ""} created.`;
      if (!msg.startsWith("✓")) msg = `✓ ${msg}`;
      setUploadMsg(msg);
      // Refresh stats table
      const statsRes = await api.get<PlayerStats[]>(`/stats/player/${playerId}`);
      setStats(statsRes.data);
      // If PXR was triggered, refetch PXR score after a short delay
      if (pxrTriggered) {
        setTimeout(async () => {
          try {
            const pxrRes = await api.get(`/pxr/player/${playerId}?season=2025-26`);
            if (pxrRes.data) setPxrData(pxrRes.data);
          } catch { /* non-critical */ }
        }, 3000);
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number; data?: { detail?: string } }; message?: string };
      const msg = axiosErr?.response?.data?.detail || axiosErr?.message || "Failed to upload CSV";
      setUploadMsg(`Error: ${msg}`);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const { data } = await api.post<{ image_url: string }>(`/players/${playerId}/image`, formData);
      setPlayer((prev) => prev ? { ...prev, image_url: data.image_url } : prev);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed to upload image";
      toast.error(msg);
    } finally {
      setUploadingImage(false);
      e.target.value = "";
    }
  };

  const handleDownloadPDF = () => {
    const prev = document.title;
    const fileName = `${player?.first_name}_${player?.last_name}_profile`.replace(/\s+/g, "_");
    document.title = fileName;
    window.print();
    setTimeout(() => { document.title = prev; }, 1000);
  };

  const handleImageDelete = async () => {
    if (!confirm("Remove player photo?")) return;
    try {
      await api.delete(`/players/${playerId}/image`);
      setPlayer((prev) => prev ? { ...prev, image_url: null } : prev);
    } catch {
      toast.error("Failed to delete image");
    }
  };

  const handleSaveNote = async () => {
    if (!noteText.trim()) return;
    setSavingNote(true);
    try {
      if (editingNoteId) {
        await api.put(`/notes/${editingNoteId}`, {
          note_text: noteText,
          note_type: noteType,
          tags: noteTags,
          is_private: notePrivate,
        });
      } else {
        await api.post(`/players/${playerId}/notes`, {
          note_text: noteText,
          note_type: noteType,
          tags: noteTags,
          is_private: notePrivate,
        });
      }
      setNoteText("");
      setNoteType("general");
      setNoteTags([]);
      setNotePrivate(false);
      setShowNoteForm(false);
      setEditingNoteId(null);
      await loadNotes();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed to save note";
      toast.error(msg);
    } finally {
      setSavingNote(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm("Delete this note? Your observation on this player will be permanently removed.")) return;
    try {
      await api.delete(`/notes/${noteId}`);
      await loadNotes();
    } catch {
      // ignore
    }
  };

  const handleEditNote = (note: ScoutNote) => {
    setEditingNoteId(note.id);
    setNoteText(note.note_text);
    setNoteType(note.note_type);
    setNoteTags(note.tags);
    setNotePrivate(note.is_private);
    setShowNoteForm(true);
  };

  const toggleTag = (tag: string) => {
    setNoteTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);
  };

  const handleRefreshIntelligence = async () => {
    setRefreshingIntel(true);
    try {
      const { data } = await api.post<PlayerIntelligence>(`/players/${playerId}/intelligence`);
      setIntelligence(data);
      // Update player with new archetype/tags
      if (data.archetype) {
        setPlayer((prev) => prev ? { ...prev, archetype: data.archetype || prev.archetype, tags: data.tags || prev.tags } : prev);
        setArchetypeValue(data.archetype);
      }
      // Refresh history
      try {
        const histRes = await api.get<PlayerIntelligence[]>(`/players/${playerId}/intelligence/history`);
        setIntelHistory(histRes.data);
      } catch { /* ok */ }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed to refresh intelligence";
      toast.error(msg);
    } finally {
      setRefreshingIntel(false);
    }
  };

  // Load reference data for league/team dropdowns when edit opens
  useEffect(() => {
    if ((!editingBio && !showTransferModal) || editLeagues.length > 0) return;
    Promise.all([
      api.get<League[]>("/leagues"),
      api.get<TeamReference[]>("/teams/reference"),
    ]).then(([l, t]) => {
      setEditLeagues(l.data);
      setEditRefTeams(t.data);
      // Auto-detect custom mode if current values aren't in the dropdown lists
      if (player) {
        const leagueInList = l.data.some((lg) => lg.name === player.current_league);
        if (player.current_league && !leagueInList) setCustomLeague(true);
        const teamInList = t.data.some((tm) => tm.name === player.current_team);
        if (player.current_team && !teamInList) setCustomTeam(true);
      }
    }).catch(() => { /* Non-critical — fallback to text inputs */ });
  }, [editingBio, showTransferModal]); // eslint-disable-line react-hooks/exhaustive-deps

  // Filter teams by selected league
  const filteredEditTeams = editFields.current_league
    ? editRefTeams.filter((t) => t.league === editFields.current_league)
    : editRefTeams;

  const filteredTransferTeams = transferLeague
    ? editRefTeams.filter((t) => t.league === transferLeague)
    : editRefTeams;

  const handleSaveEdit = async () => {
    if (!player) return;
    setSavingEdit(true);
    setEditError("");
    try {
      // Only send changed fields
      const updates: Record<string, string | number | null> = {};
      if (editFields.current_team !== (player.current_team || "")) updates.current_team = editFields.current_team;
      if (editFields.current_league !== (player.current_league || "")) updates.current_league = editFields.current_league;
      if (editFields.position !== (player.position || "")) updates.position = editFields.position;
      if (editFields.shoots !== (player.shoots || "")) updates.shoots = editFields.shoots;
      if (editFields.dob !== (player.dob || "")) updates.dob = editFields.dob;
      const newHeight = editFields.height_cm === "" ? null : Number(editFields.height_cm);
      const newWeight = editFields.weight_kg === "" ? null : Number(editFields.weight_kg);
      if (newHeight !== (player.height_cm ?? null)) updates.height_cm = newHeight;
      if (newWeight !== (player.weight_kg ?? null)) updates.weight_kg = newWeight;

      if (Object.keys(updates).length === 0) {
        setEditingBio(false);
        return;
      }

      await api.patch(`/players/${playerId}`, updates);
      // Reload player data
      const { data } = await api.get<Player>(`/players/${playerId}`);
      setPlayer(data);
      setEditingBio(false);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Save failed";
      setEditError(msg);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleSaveContact = async () => {
    if (!player) return;
    setSavingContact(true);
    try {
      const updates: Record<string, string | null> = {};
      const fields = ["email", "phone", "parent_email", "parent_phone", "agent_email", "agent_phone"] as const;
      for (const f of fields) {
        const newVal = contactFields[f].trim() || null;
        const oldVal = (player as unknown as Record<string, unknown>)[f] as string | null | undefined;
        if (newVal !== (oldVal || null)) updates[f] = newVal;
      }
      if (Object.keys(updates).length > 0) {
        await api.patch(`/players/${playerId}`, updates);
        const { data } = await api.get<Player>(`/players/${playerId}`);
        setPlayer(data);
      }
      setEditingContact(false);
    } catch {
      toast.error("Failed to save contact info");
    } finally {
      setSavingContact(false);
    }
  };

  const handleTransfer = async () => {
    if (!transferTeam.trim()) return;
    setSubmittingTransfer(true);
    try {
      await api.post(`/players/${playerId}/transfer`, {
        new_team: transferTeam.trim(),
        new_league: transferLeague.trim() || null,
        note: transferNote.trim() || null,
      });
      const { data } = await api.get<Player>(`/players/${playerId}`);
      setPlayer(data);
      setShowTransferModal(false);
      setTransferTeam("");
      setTransferLeague("");
      setTransferNote("");
      setTransferCustomLeague(false);
      setTransferCustomTeam(false);
      toast.success(`Transferred to ${transferTeam.trim()}`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Transfer failed";
      toast.error(msg);
    } finally {
      setSubmittingTransfer(false);
    }
  };

  const loadIntelHistory = async () => {
    if (intelHistory.length > 0) {
      setShowIntelHistory(!showIntelHistory);
      return;
    }
    try {
      const { data } = await api.get<PlayerIntelligence[]>(`/players/${playerId}/intelligence/history`);
      setIntelHistory(data);
      setShowIntelHistory(true);
    } catch { /* ok */ }
  };

  useEffect(() => {
    async function load() {
      try {
        const playerRes = await api.get<Player>(`/players/${playerId}`);
        setPlayer(playerRes.data);
        setArchetypeValue(playerRes.data.archetype || "");
        setEditFields({
          current_team: playerRes.data.current_team || "",
          current_league: playerRes.data.current_league || "",
          position: playerRes.data.position || "",
          shoots: playerRes.data.shoots || "",
          dob: playerRes.data.dob || "",
          height_cm: playerRes.data.height_cm ?? "",
          weight_kg: playerRes.data.weight_kg ?? "",
        });

        const [statsRes, reportsRes, notesRes, libRes, sysRes, goalieRes, intelRes] = await Promise.allSettled([
          api.get<PlayerStats[]>(`/stats/player/${playerId}`),
          api.get<Report[]>(`/reports?player_id=${playerId}`),
          api.get<ScoutNote[]>(`/players/${playerId}/notes`),
          api.get<SystemLibraryEntry[]>("/hockey-os/systems-library"),
          api.get<TeamSystem[]>("/hockey-os/team-systems"),
          api.get<GoalieStats[]>(`/stats/goalie/${playerId}`),
          api.get<PlayerIntelligence>(`/players/${playerId}/intelligence`),
        ]);
        if (statsRes.status === "fulfilled") setStats(statsRes.value.data);
        if (goalieRes.status === "fulfilled") setGoalieStats(goalieRes.value.data);
        if (reportsRes.status === "fulfilled") setReports(reportsRes.value.data);
        if (notesRes.status === "fulfilled") setNotes(notesRes.value.data);
        if (libRes.status === "fulfilled") setSystemsLibrary(libRes.value.data);
        if (intelRes.status === "fulfilled") setIntelligence(intelRes.value.data);

        // Load ProspectX Metrics (non-blocking — may fail if < 5 GP)
        try {
          const indicesRes = await api.get<PlayerMetrics>(`/analytics/player-indices/${playerId}`);
          setPlayerMetrics(indicesRes.data);
        } catch { /* Player may not have enough stats */ }

        // Load recent form (non-blocking — for profile badge)
        try {
          const formRes = await api.get<RecentForm>(`/stats/player/${playerId}/recent-form?last_n=5`);
          setRecentForm(formRes.data);
        } catch { /* May not have game data */ }

        // Load trendline data (non-blocking — for SeasonSnapshot sparkline)
        try {
          const trendRes = await api.get(`/players/${playerId}/trendline?metric=points&last_n=10`);
          setTrendlineData(trendRes.data);
        } catch { /* May not have game data */ }

        // Load PXR pillar scores (non-blocking — for SkillBars)
        try {
          const pxrRes = await api.get(`/pxr/player/${playerId}?season=2025-26`);
          if (pxrRes.data) setPxrData(pxrRes.data);
        } catch { /* PXR data may not exist */ }

        // Load pending corrections count (non-blocking)
        try {
          const corrRes = await api.get<PlayerCorrection[]>(`/players/${playerId}/corrections`);
          setPendingCorrections(corrRes.data.filter((c: PlayerCorrection) => c.status === "pending").length);
        } catch { /* Non-critical */ }

        // Load development plans — try v2 singular endpoint first, fallback to legacy
        try {
          const v2Res = await api.get<DevPlanV2>(`/players/${playerId}/development-plan`);
          setDevPlanV2(v2Res.data);
          setPlanStatus("saved");
          // Also try fetching version history
          try {
            const histRes = await api.get<DevPlanV2[]>(`/players/${playerId}/development-plan/history`);
            setDevPlanV2History(histRes.data);
            setDevPlanVersions(histRes.data as unknown as DevelopmentPlan[]);
          } catch { /* History may require coach role */ }
        } catch {
          // Fallback to legacy plural endpoint
          try {
            const plansRes = await api.get<DevelopmentPlan[]>(`/players/${playerId}/development-plans`);
            setDevPlanVersions(plansRes.data);
            if (plansRes.data.length > 0) setDevPlan(plansRes.data[0]);
          } catch { /* Non-critical */ }
        }

        // Load drill logs for Training Volume widget
        try {
          const dlRes = await api.get<PlayerDrillLogsResponse>(`/players/${playerId}/drill-logs?limit=20`);
          setDrillLogData(dlRes.data);
        } catch { /* Non-critical */ }

        // Load stat trends for Film → Dev Plan bridge (P1)
        try {
          setStatTrendsLoading(true);
          const trendsRes = await api.get(`/players/${playerId}/stat-trends`);
          const triggers = trendsRes.data?.triggers || [];
          setStatTrends(triggers);
          setStatTrendsClipCounts(trendsRes.data?.clip_counts || {});
          // If triggers found, fetch PXI film suggestions
          if (triggers.length > 0) {
            try {
              const sugRes = await api.post(`/players/${playerId}/film-suggestions`, { stat_trends: triggers });
              setFilmSuggestions(sugRes.data?.suggestions || []);
            } catch { /* PXI suggestion non-critical */ }
          }
        } catch { /* Non-critical */ }
        finally { setStatTrendsLoading(false); }

        // P2-C2: Load film summaries from intelligence history
        try {
          const intelRes = await api.get(`/players/${playerId}/intelligence/history`);
          const allIntel = Array.isArray(intelRes.data) ? intelRes.data : [];
          const summaries = allIntel
            .filter((i: { trigger?: string; summary?: string; session_id?: string }) => i.trigger === "film_summary" && i.summary && i.session_id)
            .map((i: { id: string; summary: string; session_id: string; created_at: string; data_sources_used?: Record<string, unknown> }) => ({
              id: i.id,
              summary: i.summary,
              session_id: i.session_id,
              created_at: i.created_at,
              data_sources_used: i.data_sources_used,
            }));
          setFilmSummaries(summaries);
        } catch { /* Non-critical */ }

        // Load transfer history (non-blocking)
        try {
          const xferRes = await api.get<PlayerTransfer[]>(`/players/${playerId}/transfers`);
          setPlayerTransfers(xferRes.data);
        } catch { /* Non-critical */ }

        // Load achievements (non-blocking)
        try {
          const achRes = await api.get<PlayerAchievement[]>(`/players/${playerId}/achievements`);
          setPlayerAchievements(achRes.data);
        } catch { /* Non-critical */ }

        // Load team splits (non-blocking)
        try {
          const splitsRes = await api.get<TeamSplit[]>(`/players/${playerId}/team-splits`);
          setTeamSplits(splitsRes.data);
        } catch { /* Non-critical */ }

        // Load linked parents (coach/admin only)
        if (COACH_ROLES.has(userRole)) {
          try {
            const parentsRes = await api.get<{ link_id: string; user_id: string; email: string; first_name: string | null; last_name: string | null; created_at: string }[]>(`/players/${playerId}/parents`);
            setLinkedParents(parentsRes.data);
          } catch { /* Non-critical */ }
        }

        // Match team system to player's current team
        if (sysRes.status === "fulfilled" && playerRes.data.current_team) {
          const match = sysRes.value.data.find(
            (s) => s.team_name.toLowerCase() === playerRes.data.current_team!.toLowerCase()
          );
          if (match) setTeamSystem(match);
        }
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed to load player";
        setError(msg);
      } finally {
        setLoading(false);
      }
    }
    if (playerId) load();
  }, [playerId]);

  // Set active PXI context for BenchTalk when viewing this player
  useEffect(() => {
    if (player) {
      setActivePxiContext({
        user: {
          id: currentUser?.id || "",
          name: `${currentUser?.first_name || ""} ${currentUser?.last_name || ""}`.trim() || "User",
          role: (currentUser?.hockey_role?.toUpperCase() || "SCOUT") as "SCOUT" | "COACH" | "GM" | "PARENT" | "AGENT" | "BROADCASTER" | "ANALYST",
          orgId: currentUser?.org_id || "",
          orgName: "ProspectX",
        },
        page: { id: "PLAYER_CARD", route: `/players/${playerId}` },
        entity: {
          type: "PLAYER",
          id: player.id,
          name: `${player.first_name} ${player.last_name}`,
          metadata: {
            position: player.position || undefined,
            team: player.current_team || undefined,
            league: player.current_league || undefined,
            archetype: intelligence?.archetype || undefined,
            overall_band: intelligence?.overall_grade ? gradeToOverallBand(intelligence.overall_grade) || undefined : undefined,
            pxr_score: pxrData?.pxr_score || undefined,
          },
        },
      });
    }
    return () => { setActivePxiContext(null); };
  }, [player, playerId, currentUser, intelligence, pxrData, setActivePxiContext]);

  // Auto-trigger: deep-link from dashboard with ?tab=devplan&generate=1
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const tabParam = sp.get("tab");
    const autoGen = sp.get("generate") || sp.get("autoGenerate");
    if (tabParam === "devplan" || tabParam === "player") {
      setActiveTab("player");
    }
    if ((autoGen === "1" || autoGen === "true") && !loading && !devPlanV2 && planStatus === "empty") {
      setActiveTab("player");
      handleGenerateV2();
      router.replace(`/players/${playerId}?tab=devplan`, { scroll: false });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  // Close overflow menu on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (overflowRef.current && !overflowRef.current.contains(e.target as Node)) setOverflowOpen(false);
    }
    if (overflowOpen) {
      document.addEventListener("mousedown", handler);
      return () => document.removeEventListener("mousedown", handler);
    }
  }, [overflowOpen]);

  // Lazy-load progression/game log when sub-view switches
  useEffect(() => {
    if (statsSubView === "progression" && !progression && !loadingProgression) {
      setLoadingProgression(true);
      api.get<Progression>(`/stats/player/${playerId}/progression`)
        .then((res) => setProgression(res.data))
        .catch(() => setProgression({ seasons: [], trend: "insufficient_data", yoy_delta: {} }))
        .finally(() => setLoadingProgression(false));
    }
    if (statsSubView === "gamelog" && !gameLog && !loadingGameLog) {
      setLoadingGameLog(true);
      api.get<GameStatsResponse>(`/stats/player/${playerId}/games?limit=50&offset=0`)
        .then((res) => setGameLog(res.data))
        .catch(() => setGameLog({ games: [], total: 0, source: "none" }))
        .finally(() => setLoadingGameLog(false));
    }
  }, [statsSubView, playerId, progression, gameLog, loadingProgression, loadingGameLog]);

  // Load film clips + reels when Video tab is active
  useEffect(() => {
    if (activeTab === "video" && filmClips.length === 0 && !filmClipsLoading) {
      loadFilmClips();
    }
    if (activeTab === "video" && playerReels.length === 0 && !reelsLoading) {
      setReelsLoading(true);
      api.get("/highlight-reels", { params: { player_id: playerId, limit: 50 } })
        .then(({ data }) => setPlayerReels(Array.isArray(data) ? data : []))
        .catch(() => { /* non-critical */ })
        .finally(() => setReelsLoading(false));
    }
  }, [activeTab, filmClips.length, filmClipsLoading, loadFilmClips, playerReels.length, reelsLoading, playerId]);

  // Handle game log pagination
  const handleGameLogPageChange = (newOffset: number) => {
    setGameLogOffset(newOffset);
    setLoadingGameLog(true);
    api.get<GameStatsResponse>(`/stats/player/${playerId}/games?limit=50&offset=${newOffset}`)
      .then((res) => setGameLog(res.data))
      .catch(() => {})
      .finally(() => setLoadingGameLog(false));
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <NavBar />
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-navy border-t-teal" />
        </div>
      </ProtectedRoute>
    );
  }

  if (!player) {
    return (
      <ProtectedRoute>
        <NavBar />
        <main className="max-w-4xl mx-auto px-4 py-8">
          {error ? (
            <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
              <p className="text-red-700 font-medium mb-2">Error Loading Player</p>
              <p className="text-red-600 text-sm">{error}</p>
              <Link href="/players" className="inline-block mt-4 text-sm text-teal hover:underline">
                ← Back to Players
              </Link>
            </div>
          ) : (
            <p className="text-muted">Player not found.</p>
          )}
        </main>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <NavBar />
      <main className="max-w-[1200px] mx-auto px-6 py-6" style={{ fontFamily: "'DM Sans', sans-serif", background: "#DCF0FA", minHeight: "100vh" }}>
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 mb-4 no-print" style={{ fontFamily: "'DM Mono', monospace", fontSize: 11.5, color: "#5A7291" }}>
          <Link href="/players" className="hover:underline" style={{ color: "#0D9488" }}>Players</Link>
          <span style={{ color: "#8BA4BB" }}>›</span>
          {player.current_team && (
            <>
              <Link href={`/teams/${encodeURIComponent(player.current_team)}`} className="hover:underline" style={{ color: "#0D9488" }}>{player.current_team}</Link>
              <span style={{ color: "#8BA4BB" }}>›</span>
            </>
          )}
          <span style={{ color: "#0F2942", fontWeight: 600 }}>{player.first_name} {player.last_name}</span>
        </div>

        {/* ── HERO ── */}
        <div style={{ background: "linear-gradient(145deg, #091C30 0%, #0F2942 60%, #1A3A5C 100%)", borderRadius: 14, border: "1px solid rgba(255,255,255,.07)", boxShadow: "0 4px 24px rgba(0,0,0,.2)", padding: "20px 24px 0", position: "relative", overflow: "hidden", marginBottom: 4 }}>
          {/* Teal left stripe */}
          <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: "#0D9488", borderRadius: "14px 0 0 14px" }} />
          {/* Decorative circle */}
          <div style={{ position: "absolute", right: -60, top: -60, width: 240, height: 240, border: "1.5px solid rgba(255,255,255,.04)", borderRadius: "50%", pointerEvents: "none" }} />

          <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
            {/* Player Photo */}
            <div style={{ flexShrink: 0, position: "relative" }}>
              {hasRealImage(player.image_url) ? (
                <div style={{ width: 88, height: 88, borderRadius: 12, border: "2px solid rgba(13,148,136,.4)", overflow: "hidden" }}>
                  <img src={assetUrl(player.image_url)} alt={`${player.first_name} ${player.last_name}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
              ) : (
                <div style={{ width: 88, height: 88, borderRadius: 12, background: "linear-gradient(145deg, #1A3A5C, #0F2942)", border: "2px solid rgba(13,148,136,.4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
                    <circle cx="22" cy="16" r="8" fill="white" opacity="0.4" />
                    <path d="M6 40c0-8.837 7.163-16 16-16s16 7.163 16 16" fill="white" opacity="0.3" />
                  </svg>
                </div>
              )}
              {player.jersey_number && (
                <div style={{ position: "absolute", bottom: -6, right: -6, background: "#0D9488", color: "white", fontFamily: "'DM Mono', monospace", fontSize: 10, fontWeight: 500, padding: "2px 6px", borderRadius: 4, border: "2px solid #091C30" }}>
                  #{player.jersey_number}
                </div>
              )}
            </div>

            {/* Player Identity */}
            <div style={{ flex: 1, paddingTop: 2 }}>
              <h1 style={{ fontSize: 26, fontWeight: 800, color: "white", letterSpacing: -0.4, lineHeight: 1, marginBottom: 5, fontFamily: "'DM Sans', sans-serif" }}>
                {player.first_name} {player.last_name}
              </h1>
              {/* Meta pills */}
              <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9.5, fontWeight: 500, padding: "3px 8px", borderRadius: 3, background: "rgba(13,148,136,.2)", color: "#14B8A8", letterSpacing: ".04em" }}>
                  {player.position || "—"}
                </span>
                <span style={{ color: "rgba(255,255,255,.2)", fontSize: 12 }}>·</span>
                {player.shoots && (
                  <>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9.5, fontWeight: 500, padding: "3px 8px", borderRadius: 3, background: "rgba(255,255,255,.09)", color: "rgba(255,255,255,.55)", letterSpacing: ".04em" }}>
                      {player.shoots}-shot
                    </span>
                    <span style={{ color: "rgba(255,255,255,.2)", fontSize: 12 }}>·</span>
                  </>
                )}
                {player.current_team && (
                  <>
                    <Link href={`/teams/${encodeURIComponent(player.current_team)}`} style={{ fontFamily: "'DM Mono', monospace", fontSize: 9.5, fontWeight: 500, padding: "3px 8px", borderRadius: 3, background: "rgba(13,148,136,.15)", color: "#14B8A8", letterSpacing: ".04em", cursor: "pointer", textDecoration: "none" }}>
                      {player.current_team}
                    </Link>
                    <span style={{ color: "rgba(255,255,255,.2)", fontSize: 12 }}>·</span>
                  </>
                )}
                {player.current_league && (
                  <>
                    <Link href={`/leagues?league=${encodeURIComponent(player.current_league)}`} style={{ fontFamily: "'DM Mono', monospace", fontSize: 9.5, fontWeight: 500, padding: "3px 8px", borderRadius: 3, background: "rgba(255,255,255,.09)", color: "rgba(255,255,255,.55)", letterSpacing: ".04em", textDecoration: "none" }}>
                      {formatLeague(player.current_league)}
                    </Link>
                    <span style={{ color: "rgba(255,255,255,.2)", fontSize: 12 }}>·</span>
                  </>
                )}
                {player.dob && (() => {
                  const birth = new Date(player.dob);
                  const today = new Date();
                  let age = today.getFullYear() - birth.getFullYear();
                  const m = today.getMonth() - birth.getMonth();
                  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
                  return (
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9.5, fontWeight: 500, padding: "3px 8px", borderRadius: 3, background: "rgba(255,255,255,.09)", color: "rgba(255,255,255,.55)", letterSpacing: ".04em" }}>
                      Age {age}
                    </span>
                  );
                })()}
                <PlayerStatusBadges tags={player.tags || []} size="md" />
              </div>
              {/* Physical row */}
              <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                {(player.height_cm || player.weight_kg) && (
                  <>
                    <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                      <span style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "rgba(255,255,255,.28)", fontFamily: "'DM Mono', monospace" }}>Height / Weight</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,.8)" }}>{player.height_cm ? `${player.height_cm} cm` : "—"} · {player.weight_kg ? `${player.weight_kg} kg` : "—"}</span>
                    </div>
                    <div style={{ width: 1, height: 28, background: "rgba(255,255,255,.08)" }} />
                  </>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  <span style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "rgba(255,255,255,.28)", fontFamily: "'DM Mono', monospace" }}>Status</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#14B8A8" }}>{player.roster_status === "inj" ? "Injured" : player.roster_status === "susp" ? "Suspended" : "Healthy"}</span>
                </div>
                <div style={{ width: 1, height: 28, background: "rgba(255,255,255,.08)" }} />
                <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  <span style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "rgba(255,255,255,.28)", fontFamily: "'DM Mono', monospace" }}>Commitment</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,.8)" }}>{player.commitment_status || "Uncommitted"}</span>
                </div>
                {intelligence?.archetype && (
                  <>
                    <div style={{ width: 1, height: 28, background: "rgba(255,255,255,.08)" }} />
                    <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                      <span style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "rgba(255,255,255,.28)", fontFamily: "'DM Mono', monospace" }}>Role</span>
                      <span style={{ fontSize: 11.5, fontWeight: 600, color: "rgba(255,255,255,.8)" }}>{intelligence.archetype}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Right: Draft chips + actions */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, flexShrink: 0 }}>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap", justifyContent: "flex-end" }}>
                {/* PXR Score pill — prominent in hero */}
                {pxrData && pxrData.pxr_score != null && pxrData.pxr_score > 0 && (
                  <span
                    style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 4, background: "rgba(13,148,136,.25)", color: "#14B8A8", letterSpacing: ".04em", border: "1px solid rgba(13,148,136,.35)" }}
                    title={`PXR Score — Composite rating: ${pxrData.pxr_score.toFixed(1)} / 100`}
                  >
                    PXR {pxrData.pxr_score.toFixed(1)}
                  </span>
                )}
                {intelligence?.overall_grade && gradeToOverallBand(intelligence.overall_grade) && (
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9.5, fontWeight: 500, padding: "3px 8px", borderRadius: 3, background: "rgba(234,88,12,.2)", color: "#FB923C", letterSpacing: ".04em" }}>
                    {gradeToOverallBand(intelligence.overall_grade)}
                  </span>
                )}
                {(() => {
                  const league = (player.current_league || "").toUpperCase();
                  const by = player.birth_year;
                  const chlLeagues = ["OHL", "WHL", "QMJHL", "LHJMQ"];
                  const ncaaLeagues = ["USHL", "NAHL", "PREP", "USHS", "US PREP"];
                  const isCHL = chlLeagues.some(l => league.includes(l));
                  const isNCAA = ncaaLeagues.some(l => league.includes(l));
                  const isDraftWindow = by != null && by >= 2004 && by <= 2007;
                  if (isCHL && isDraftWindow) {
                    return <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9.5, fontWeight: 500, padding: "3px 8px", borderRadius: 3, background: "rgba(13,148,136,.2)", color: "#14B8A8", letterSpacing: ".04em" }}>CHL + NCAA Viable</span>;
                  }
                  if (isNCAA) {
                    return <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9.5, fontWeight: 500, padding: "3px 8px", borderRadius: 3, background: "rgba(59,130,246,.2)", color: "#60A5FA", letterSpacing: ".04em" }}>NCAA Path Only</span>;
                  }
                  return null;
                })()}
                {playerTransfers.length > 0 && playerTransfers[0].from_team_name && (
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9.5, fontWeight: 500, padding: "3px 8px", borderRadius: 3, background: "rgba(234,88,12,.2)", color: "#FB923C", letterSpacing: ".04em" }}>
                    Acquired from {playerTransfers[0].from_team_name}
                  </span>
                )}
              </div>
              {/* Hero action buttons — hidden on Overview tab (duplicated by Quick Actions card) */}
              {activeTab !== "profile" && (
              <div style={{ display: "flex", gap: 6, marginTop: 4 }} className="no-print">
                <Link
                  href={`/reports/generate?player=${playerId}&type=pro_skater`}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700, background: "#0D9488", color: "white", border: "1.5px solid #0D9488", textDecoration: "none", fontFamily: "'DM Sans', sans-serif", cursor: "pointer", transition: "all .15s" }}
                  title="Generate PXI Scout Report for this player"
                >
                  <Sparkles size={12} />
                  Generate Report
                </Link>
                <button
                  onClick={handleDownloadPDF}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700, background: "white", color: "#0F2942", border: "1.5px solid #DDE6EF", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", transition: "all .15s" }}
                >
                  <Download size={12} />
                  PDF
                </button>
                <Link
                  href={`/players/${playerId}/card`}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700, background: "white", color: "#0F2942", border: "1.5px solid #DDE6EF", textDecoration: "none", fontFamily: "'DM Sans', sans-serif", cursor: "pointer", transition: "all .15s" }}
                >
                  <Eye size={12} />
                  Card
                </Link>
              </div>
              )}
            </div>
          </div>

          {/* ── Stat Bar ── */}
          <div style={{ display: "flex", borderTop: "1px solid rgba(255,255,255,.06)", margin: "14px -24px 0" }}>
            {(() => {
              const currentSeason = stats.filter(s => s.stat_type === "season").sort((a, b) => {
                const yearA = parseInt((a.season || "0").slice(0, 4), 10);
                const yearB = parseInt((b.season || "0").slice(0, 4), 10);
                return yearB - yearA;
              })[0];
              if (!currentSeason) return null;
              // Compute PXI composite average from 6 dimension scores
              const pxiMetricsForBar = buildPxiMetrics(playerMetrics, pxrData);
              const hasRealPxi = playerMetrics || pxrData;
              const pxiAvg = hasRealPxi ? Math.round(pxiMetricsForBar.reduce((sum, m) => sum + m.score, 0) / pxiMetricsForBar.length) : null;
              const statItems: [string, string | number, string | null][] = [
                ["GP", currentSeason.gp, null],
                ["G", currentSeason.g, null],
                ["A", currentSeason.a, null],
                ["PTS", currentSeason.p, null],
                ["PPG", currentSeason.gp > 0 ? (currentSeason.p / currentSeason.gp).toFixed(2) : "—", null],
                ["+/-", currentSeason.plus_minus != null ? (currentSeason.plus_minus >= 0 ? `+${currentSeason.plus_minus}` : `${currentSeason.plus_minus}`) : "—", null],
                ["SH%", currentSeason.shooting_pct != null ? `${currentSeason.shooting_pct.toFixed(1)}%` : (currentSeason.sog > 0 ? `${((currentSeason.g / currentSeason.sog) * 100).toFixed(1)}%` : "—"), null],
                ["PIM", currentSeason.pim, null],
                ["PXI", pxiAvg != null ? pxiAvg : "—", "#14B8A8"],
              ];
              return statItems.map(([label, value, colorOverride]) => (
                <div key={label as string} style={{ flex: 1, textAlign: "center", padding: "10px 8px", borderRight: "1px solid rgba(255,255,255,.05)" }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: colorOverride || (label === "PTS" ? "#14B8A8" : "white"), lineHeight: 1, letterSpacing: -0.3 }}>{value}</div>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 8.5, letterSpacing: ".1em", textTransform: "uppercase", color: "rgba(255,255,255,.3)", marginTop: 2 }}>{label as string}</div>
                </div>
              ));
            })()}
          </div>
        </div>

        {/* ── Tabs Bar ── attached to hero bottom */}
        <div className="no-print" style={{ display: "flex", background: "#0F2942", borderRadius: "0 0 14px 14px", border: "1px solid rgba(255,255,255,.06)", borderTop: "none", overflow: "hidden", marginBottom: 18, position: "sticky", top: 48, zIndex: 50 }}>
          {([
            { key: "profile" as Tab, label: "Overview", count: null },
            { key: "stats" as Tab, label: "Stats", count: stats.length },
            { key: "notes" as Tab, label: "Notes", count: notes.length },
            { key: "reports" as Tab, label: "Reports", count: reports.length },
            { key: "player" as Tab, label: "Dev Plan", count: devPlanV2History.length || devPlanVersions.length || null },
            { key: "video" as Tab, label: "Video", count: filmClips.length || null },
          ]).map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              style={{
                flex: 1,
                textAlign: "center",
                padding: "10px 4px",
                fontSize: 11.5,
                fontWeight: 600,
                color: activeTab === key ? "#14B8A8" : "rgba(255,255,255,.38)",
                cursor: "pointer",
                transition: "all .12s",
                borderBottom: activeTab === key ? "2px solid #0D9488" : "2px solid transparent",
                background: activeTab === key ? "rgba(13,148,136,.08)" : "transparent",
                whiteSpace: "nowrap",
                border: "none",
                borderBottomWidth: 2,
                borderBottomStyle: "solid",
                borderBottomColor: activeTab === key ? "#0D9488" : "transparent",
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              {label}
              {count !== null && count > 0 && <span style={{ marginLeft: 4, opacity: 0.6, fontSize: 10 }}>({count})</span>}
            </button>
          ))}
        </div>

        {/* ── Two-Column Layout (shared across all tabs) ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 14, alignItems: "start" }}>
          {/* ── LEFT COLUMN (tab content changes here) ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Profile / Overview Tab — Left Column */}
          {activeTab === "profile" && (
            <>

            {/* Quick Actions row (visible to staff) */}
            {!FAMILY_ROLES.has(userRole) && player && (
              <div className="no-print" style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => openBenchTalk(
                    `Scout ${player.first_name} ${player.last_name}. Give me a scouting overview, strengths, weaknesses, and role projection.`,
                    "scout"
                  )}
                  style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700, background: "#0D9488", color: "white", border: "1.5px solid #0D9488", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}
                >
                  <Search size={12} />
                  Scout in PXI
                </button>
                <button
                  onClick={() => { window.location.href = `/reports/generate?player_id=${playerId}`; }}
                  style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700, background: "white", color: "#0F2942", border: "1.5px solid #DDE6EF", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}
                >
                  <FileText size={12} />
                  Generate Report
                </button>
                <div className="relative" ref={overflowRef}>
                  <button
                    onClick={() => setOverflowOpen(!overflowOpen)}
                    style={{ padding: "8px 10px", borderRadius: 8, background: "white", color: "#5A7291", border: "1.5px solid #DDE6EF", cursor: "pointer" }}
                    title="More actions"
                  >
                    <MoreVertical size={14} />
                  </button>
                  {overflowOpen && (
                    <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-teal/20 rounded-lg shadow-xl z-50 py-1">
                      <button
                        onClick={() => { openBenchTalk(`Scout ${player.first_name} ${player.last_name}`, "scout"); setOverflowOpen(false); }}
                        className="w-full text-left px-3 py-2 text-xs text-navy hover:bg-navy/[0.03] flex items-center gap-2 transition-colors"
                      >
                        <Search size={12} className="text-teal" /> Scout in Bench Talk
                      </button>
                      <Link
                        href="/watchlist"
                        onClick={() => setOverflowOpen(false)}
                        className="block px-3 py-2 text-xs text-navy hover:bg-navy/[0.03] flex items-center gap-2 transition-colors"
                      >
                        <ListPlus size={12} className="text-muted" /> Add to Watchlist
                      </Link>
                      <Link
                        href={`/reports/generate?player_id=${playerId}&report_type=elite_profile`}
                        onClick={() => setOverflowOpen(false)}
                        className="block px-3 py-2 text-xs text-navy hover:bg-navy/[0.03] flex items-center gap-2 transition-colors"
                      >
                        <Wand2 size={12} className="text-muted" /> Generate PXI Assessment
                      </Link>
                      <Link
                        href={`/reports/custom?player=${playerId}`}
                        onClick={() => setOverflowOpen(false)}
                        className="block px-3 py-2 text-xs text-navy hover:bg-navy/[0.03] flex items-center gap-2 transition-colors"
                      >
                        <FileText size={12} className="text-muted" /> Custom Report
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            )}
            {/* ── Player Archetype Block ── */}
            <div style={{ background: "white", borderRadius: 14, border: "1.5px solid rgba(13,148,136,.45)", boxShadow: "0 1px 3px rgba(9,28,48,.05), 0 4px 16px rgba(9,28,48,.07)", overflow: "hidden", position: "relative" }}>
              <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, borderRadius: "14px 0 0 14px", background: "#EA580C" }} />
              <div style={{ background: "linear-gradient(145deg, #091C30, #0F2942 60%, #1A3A5C)", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "rgba(255,255,255,.5)", fontFamily: "'DM Mono', monospace", display: "flex", alignItems: "center", gap: 6 }}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1l1 3.5H11L8 6.5l1 3.5L6 8l-3 2 1-3.5L1 4.5h4L6 1Z" fill="#EA580C"/></svg>
                  Player Archetype
                </span>
                {!editingArchetype && (
                  <button onClick={() => setEditingArchetype(true)} style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, fontWeight: 500, letterSpacing: ".08em", padding: "2px 7px", borderRadius: 3, background: "rgba(255,255,255,.1)", color: "rgba(255,255,255,.5)", textTransform: "uppercase", border: "none", cursor: "pointer" }}>
                    <Edit3 size={10} />
                  </button>
                )}
              </div>
              <div style={{ padding: "14px 16px 16px" }}>
                {!editingArchetype ? (
                  <div>
                    {player.archetype ? (
                      <>
                        <div style={{ fontSize: 20, fontWeight: 800, color: "#0F2942", letterSpacing: -0.3, marginBottom: 4 }}>{player.archetype}</div>
                        <div style={{ fontSize: 11.5, color: "#5A7291", lineHeight: 1.5 }}>Compound archetypes help the AI understand the full player profile for system fit analysis.</div>
                      </>
                    ) : (
                      <button
                        onClick={() => setEditingArchetype(true)}
                        style={{ fontSize: 12, color: "#0D9488", background: "none", border: "none", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontWeight: 600 }}
                      >
                        + Assign archetype
                      </button>
                    )}
                    {intelligence?.archetype && player.archetype !== intelligence.archetype && (
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(13,148,136,.08)", border: "1px solid rgba(13,148,136,.2)", color: "#0D9488", borderRadius: 6, padding: "5px 12px", marginTop: 10, fontSize: 12.5, fontWeight: 700 }}>
                        <Star size={12} />
                        PXI Role: {intelligence.archetype}
                        {intelligence.overall_grade && gradeToOverallBand(intelligence.overall_grade) && (
                          <span style={{ display: "inline-block", background: "rgba(234,88,12,.1)", border: "1px solid rgba(234,88,12,.25)", color: "#EA580C", borderRadius: 4, padding: "2px 8px", marginLeft: 6, fontSize: 11, fontWeight: 700, fontFamily: "'DM Mono', monospace", letterSpacing: ".03em" }}>
                            {gradeToOverallBand(intelligence.overall_grade)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <input
                      type="text"
                      value={archetypeValue}
                      onChange={(e) => setArchetypeValue(e.target.value)}
                      placeholder="e.g., Two-Way Playmaking Forward"
                      style={{ width: "100%", padding: "8px 12px", border: "1.5px solid rgba(13,148,136,.3)", borderRadius: 8, fontSize: 13, marginBottom: 8, fontFamily: "'DM Sans', sans-serif", outline: "none" }}
                      autoFocus
                    />
                    <p style={{ fontSize: 10, color: "#8BA4BB", marginBottom: 8 }}>Click traits below to build a compound archetype, or type your own:</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                      {([
                        { group: "Style", chips: ["Two-Way", "Offensive", "Defensive", "Physical", "Speed", "Playmaking", "Sniper", "Power", "Shutdown"] },
                        { group: "Role", chips: ["Forward", "Center", "Winger", "Defenseman", "Goalie"] },
                        { group: "Traits", chips: ["Elite IQ", "Net-Front", "Transition", "Puck-Moving", "Grinder", "Energy", "Checking", "Hybrid"] },
                      ] as const).map(({ group, chips }) => (
                        <div key={group} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 4 }}>
                          <span style={{ fontSize: 9, fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: ".1em", color: "#8BA4BB", marginRight: 2 }}>{group}:</span>
                          {chips.map((chip) => (
                            <button
                              key={chip}
                              type="button"
                              onClick={() => {
                                const current = archetypeValue.trim();
                                if (current && !current.endsWith(" ")) {
                                  setArchetypeValue(current + " " + chip);
                                } else {
                                  setArchetypeValue((current + " " + chip).trim());
                                }
                              }}
                              style={{ padding: "2px 8px", fontSize: 10, borderRadius: 99, border: "1px solid rgba(13,148,136,.2)", background: "transparent", color: "#0F2942", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}
                            >
                              {chip}
                            </button>
                          ))}
                        </div>
                      ))}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <button
                        onClick={async () => {
                          try {
                            await api.put(`/players/${playerId}`, {
                              ...player,
                              archetype: archetypeValue.trim() || null,
                            });
                            setPlayer({ ...player, archetype: archetypeValue.trim() || null });
                            setEditingArchetype(false);
                          } catch {
                            toast.error("Failed to save archetype");
                          }
                        }}
                        style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 14px", background: "#0D9488", color: "white", fontSize: 12, fontWeight: 700, borderRadius: 8, border: "none", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}
                      >
                        <Save size={12} /> Save
                      </button>
                      <button
                        onClick={() => { setArchetypeValue(player.archetype || ""); setEditingArchetype(false); }}
                        style={{ padding: "6px 12px", fontSize: 12, color: "#5A7291", background: "none", border: "none", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}
                      >
                        Cancel
                      </button>
                      {archetypeValue && (
                        <button
                          onClick={() => setArchetypeValue("")}
                          style={{ padding: "4px 8px", fontSize: 11, color: "#8BA4BB", background: "none", border: "none", cursor: "pointer" }}
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── PXI Intelligence Card (Radar + Donut Grid) ── */}
            {intelligence && intelligence.version > 0 && (() => {
              const pxiMetrics = buildPxiMetrics(playerMetrics, pxrData);
              const gpSeason = stats.filter(s => s.stat_type === "season").sort((a, b) => {
                const yearA = parseInt((a.season || "0").slice(0, 4), 10);
                const yearB = parseInt((b.season || "0").slice(0, 4), 10);
                return yearB - yearA;
              })[0];
              return (
              <div style={{ background: "white", borderRadius: 14, border: "1.5px solid rgba(13,148,136,.45)", boxShadow: "0 1px 3px rgba(9,28,48,.05), 0 4px 16px rgba(9,28,48,.07)", overflow: "hidden", position: "relative" }}>
                {/* Teal left stripe */}
                <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, borderRadius: "14px 0 0 14px", background: "#0D9488" }} />
                {/* Card band header */}
                <div style={{ background: "linear-gradient(145deg, #091C30, #0F2942 60%, #1A3A5C)", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "rgba(255,255,255,.5)", fontFamily: "'DM Mono', monospace" }}>PXI Intelligence</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontFamily: "'DM Mono', monospace", fontSize: 9, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", background: "rgba(13,148,136,.12)", color: "#0D9488", padding: "3px 8px", borderRadius: 4, border: "1px solid rgba(13,148,136,.2)" }}>
                      <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#EA580C" }} />
                      PXI
                    </span>
                    {intelligence.created_at && (
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, fontWeight: 500, padding: "2px 7px", borderRadius: 3, background: "rgba(13,148,136,.2)", color: "#14B8A8", textTransform: "uppercase" }}>
                        Updated {new Date(intelligence.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ padding: "14px 16px 16px" }}>
                  {/* ── PROSPECTX METRICS heading ── */}
                  <div style={{ marginBottom: 6 }}>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "#0F2942", marginBottom: 2 }}>ProspectX Metrics</div>
                    <div style={{ fontSize: 11, color: "#8BA4BB" }}>PXI scores across 6 dimensions — derived from stats, scouting notes, and AI analysis</div>
                  </div>

                  {/* ── Radar Chart ── */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", margin: "12px 0 16px" }}>
                    <PxiRadarChart metrics={pxiMetrics} />
                  </div>

                  {/* ── Donut Circles — 3×2 grid ── */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                    {pxiMetrics.map(m => <PxiDonutCircle key={m.key} m={m} />)}
                  </div>
                  <div style={{ fontSize: 9.5, color: "#8BA4BB", marginTop: 10, fontFamily: "'DM Mono', monospace", textAlign: "right" as const }}>
                    Based on {gpSeason?.gp ?? "—"} GP ({gpSeason?.season || "2025-26"})
                  </div>

                  {/* ── Intel narrative ── */}
                  {intelligence.summary && (
                    <p style={{ fontSize: 13, lineHeight: 1.65, color: "#2A4A6A" }}>{intelligence.summary}</p>
                  )}

                  {/* ── Regenerate button ── */}
                  <button
                    onClick={handleRefreshIntelligence}
                    disabled={refreshingIntel}
                    style={{ width: "100%", padding: 10, background: "white", color: "#0D9488", border: "1.5px solid #0D9488", borderRadius: 8, fontFamily: "'DM Sans', sans-serif", fontSize: 12.5, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 12, opacity: refreshingIntel ? 0.5 : 1 }}
                  >
                    {refreshingIntel ? (
                      <><RefreshCw size={12} className="animate-spin" /> Regenerating...</>
                    ) : (
                      <><Plus size={12} /> Regenerate PXI Assessment</>
                    )}
                  </button>
                </div>
              </div>
              );
            })()}

            {/* Generate Intelligence CTA (when no intelligence exists) */}
            {(!intelligence || intelligence.version === 0) && (stats.length > 0 || goalieStats.length > 0 || notes.length > 0) && (
              <div className="bg-gradient-to-r from-navy/[0.02] to-teal/[0.02] rounded-xl border border-dashed border-teal/30 p-4 text-center">
                <Brain size={20} className="mx-auto text-teal/40 mb-1.5" />
                <p className="text-xs text-muted mb-2">No intelligence data yet — generate a profile to unlock AI scouting insights.</p>
                <button
                  onClick={handleRefreshIntelligence}
                  disabled={refreshingIntel}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal text-white text-xs font-oswald uppercase tracking-wider rounded-lg hover:bg-teal/90 transition-colors disabled:opacity-50"
                >
                  <Brain size={14} />
                  {refreshingIntel ? "Analyzing Player..." : "Generate Intelligence Profile"}
                </button>
              </div>
            )}

            {/* ── PXR Score Profile Card ── */}
            {(() => {
              const pxrTierLabel = (score: number): string => {
                if (score >= 90) return "ELITE";
                if (score >= 80) return "HIGH IMPACT";
                if (score >= 70) return "SOLID STARTER";
                if (score >= 60) return "DEPTH PLAYER";
                if (score >= 50) return "DEVELOPMENTAL";
                return "FRINGE";
              };
              const hasPxr = pxrData && pxrData.pxr_score != null && pxrData.pxr_score > 0;
              const isEstimated = hasPxr && (pxrData as Record<string, unknown>).score_type === 'estimated';
              const pxrAccent = isEstimated ? "#F59E0B" : "#0D9488";
              return (
                <div style={{ background: "white", borderRadius: 14, border: `1.5px solid ${isEstimated ? "rgba(245,158,11,.45)" : "rgba(13,148,136,.45)"}`, boxShadow: "0 1px 3px rgba(9,28,48,.05), 0 4px 16px rgba(9,28,48,.07)", overflow: "hidden", position: "relative" }}>
                  {/* Left stripe — teal for full, amber for estimated */}
                  <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, borderRadius: "14px 0 0 14px", background: pxrAccent }} />
                  {/* Card band header */}
                  <div style={{ background: "linear-gradient(145deg, #091C30, #0F2942 60%, #1A3A5C)", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "rgba(255,255,255,.5)", fontFamily: "'DM Mono', monospace" }}>PXR Score Profile{isEstimated ? " (Est.)" : ""}</span>
                    <span title={isEstimated ? "Estimated PXR — calculated from game stats. Full PXR requires advanced microstat data." : undefined} style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, fontWeight: 700, padding: "3px 8px", borderRadius: 4, letterSpacing: ".06em", textTransform: "uppercase", background: hasPxr ? (isEstimated ? "rgba(245,158,11,.15)" : "rgba(13,148,136,.15)") : "rgba(255,255,255,.08)", color: hasPxr ? pxrAccent : "rgba(255,255,255,.4)", border: hasPxr ? `1px solid ${isEstimated ? "rgba(245,158,11,.25)" : "rgba(13,148,136,.25)"}` : "1px solid rgba(255,255,255,.1)" }}>
                      {hasPxr ? (isEstimated ? "PXR~" : pxrTierLabel(pxrData.pxr_score!)) : "Needs Data"}
                    </span>
                  </div>

                  <div style={{ padding: "14px 16px 16px" }}>
                    {!hasPxr ? (
                      /* Empty state */
                      <div style={{ textAlign: "center", padding: "16px 0" }}>
                        <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.3 }}>📊</div>
                        <p style={{ fontSize: 12, color: "#5A7291", lineHeight: 1.6, maxWidth: 300, margin: "0 auto 14px" }}>
                          {pxrData?.pxr_null_reason === 'gp_gate'
                            ? `Insufficient data: fewer than 10 games played (${pxrData?.gp ?? 0} GP)`
                            : pxrData?.pxr_null_reason === 'toi_per_game_gate'
                            ? 'Insufficient data: average TOI below role threshold'
                            : pxrData?.pxr_null_reason === 'toi_gate'
                            ? 'Insufficient data: fewer than 60 total minutes played'
                            : pxrData?.pxr_null_reason === 'data_incomplete'
                            ? 'Insufficient data: missing advanced stats for scoring'
                            : 'PXR scores require advanced stats data. Import advanced stats to populate.'}
                        </p>
                        <Link href="/instat" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 700, background: "#0D9488", color: "white", textDecoration: "none", fontFamily: "'DM Sans', sans-serif" }}>
                          <Upload size={12} /> Import Data
                        </Link>
                      </div>
                    ) : (
                      /* PXR data display */
                      <>
                        {/* Large composite score */}
                        <div style={{ textAlign: "center", marginBottom: 16 }}>
                          <div style={{ fontSize: 42, fontWeight: 800, color: pxrAccent, lineHeight: 1, letterSpacing: -1 }}>{pxrData.pxr_score!.toFixed(1)}{isEstimated ? <span style={{ fontSize: 16, verticalAlign: "super", opacity: 0.6 }}>~</span> : null}</div>
                          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "#5A7291", marginTop: 4 }}>{isEstimated ? "ESTIMATED" : pxrTierLabel(pxrData.pxr_score!)}</div>
                        </div>

                        {/* Four pillar bars */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {([
                            ["P1 — Offense", pxrData.p1_offense],
                            ["P2 — Defense", pxrData.p2_defense],
                            ["P3 — Possession", pxrData.p3_possession],
                            ["P4 — Physical", pxrData.p4_physical],
                          ] as [string, number | null][]).map(([label, val]) => (
                            <div key={label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, fontWeight: 600, color: "#5A7291", width: 100, flexShrink: 0, letterSpacing: ".04em" }}>{label}</span>
                              <div style={{ flex: 1, height: 8, borderRadius: 4, background: "#EEF3F8", overflow: "hidden" }}>
                                <div style={{ height: "100%", width: `${Math.min(100, val ?? 0)}%`, borderRadius: 4, background: pxrAccent, transition: "width .3s" }} />
                              </div>
                              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 700, color: pxrAccent, width: 28, textAlign: "right", flexShrink: 0 }}>{val != null ? Math.round(val) : "—"}</span>
                            </div>
                          ))}
                        </div>

                        {/* Percentile chips + age modifier */}
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
                          {pxrData.league_percentile != null && (
                            <span title="League Percentile — ranks this player among all players at the same position in their league this season. P90 = top 10%." className="cursor-help" style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, fontWeight: 600, padding: "3px 8px", borderRadius: 4, background: "rgba(13,148,136,.1)", color: "#0D9488", letterSpacing: ".04em" }}>League P{Math.round(pxrData.league_percentile)}</span>
                          )}
                          {pxrData.cohort_percentile != null && (
                            <span title="Cohort Percentile — ranks this player among all same-position players born in the same year across all leagues. P90 = top 10%." className="cursor-help" style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, fontWeight: 600, padding: "3px 8px", borderRadius: 4, background: "rgba(13,148,136,.1)", color: "#0D9488", letterSpacing: ".04em" }}>Cohort P{Math.round(pxrData.cohort_percentile)}</span>
                          )}
                          {pxrData.age_modifier != null && pxrData.age_modifier !== 0 && (
                            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, fontWeight: 600, padding: "3px 8px", borderRadius: 4, background: pxrData.age_modifier > 0 ? "rgba(34,197,94,.1)" : "rgba(249,115,22,.1)", color: pxrData.age_modifier > 0 ? "#16A34A" : "#EA580C", letterSpacing: ".04em" }}>
                              Age {pxrData.age_modifier > 0 ? "+" : ""}{pxrData.age_modifier.toFixed(1)}
                            </span>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Team System Context */}
            {teamSystem ? (
              <div style={{ background: "white", borderRadius: 14, border: "1.5px solid rgba(13,148,136,.45)", boxShadow: "0 1px 3px rgba(9,28,48,.05), 0 4px 16px rgba(9,28,48,.07)", padding: "14px 16px 16px", position: "relative" }}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-oswald uppercase tracking-wider text-muted flex items-center gap-2">
                    <Shield size={14} className="text-navy" /> Team System — {teamSystem.team_name}
                    {teamSystem.season && <span className="text-xs font-normal text-muted/60 ml-1">{teamSystem.season}</span>}
                  </h3>
                  <Link
                    href="/team-systems"
                    className="text-xs text-teal hover:underline"
                  >
                    Edit Systems →
                  </Link>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  {([
                    { label: "Forecheck", value: teamSystem.forecheck, icon: Swords, color: "text-orange" },
                    { label: "DZ Coverage", value: teamSystem.dz_structure, icon: Shield, color: "text-navy" },
                    { label: "OZ Setup", value: teamSystem.oz_setup, icon: Target, color: "text-teal" },
                    { label: "Breakout", value: teamSystem.breakout, icon: Zap, color: "text-orange" },
                    { label: "PK", value: teamSystem.pk_formation, icon: Shield, color: "text-navy" },
                  ] as const).filter((f) => f.value).map(({ label, value, icon: Icon, color }) => {
                    const entry = systemsLibrary.find((e) => e.code === value);
                    return (
                      <div key={label} className="p-3 rounded-lg bg-navy/[0.03] border border-teal/10">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Icon size={12} className={color} />
                          <span className="text-[10px] font-oswald uppercase tracking-wider text-muted">{label}</span>
                        </div>
                        <p className="text-xs font-semibold text-navy">{entry?.name || value}</p>
                      </div>
                    );
                  })}
                </div>
                {/* Team Style */}
                {(teamSystem.pace || teamSystem.physicality || teamSystem.offensive_style) && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {teamSystem.pace && (
                      <span className="text-xs px-2 py-0.5 rounded bg-orange/[0.06] text-navy/70">
                        <strong>Pace:</strong> {teamSystem.pace}
                      </span>
                    )}
                    {teamSystem.physicality && (
                      <span className="text-xs px-2 py-0.5 rounded bg-orange/[0.06] text-navy/70">
                        <strong>Physical:</strong> {teamSystem.physicality}
                      </span>
                    )}
                    {teamSystem.offensive_style && (
                      <span className="text-xs px-2 py-0.5 rounded bg-orange/[0.06] text-navy/70">
                        <strong>Offense:</strong> {teamSystem.offensive_style}
                      </span>
                    )}
                  </div>
                )}
                {teamSystem.identity_tags && teamSystem.identity_tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {teamSystem.identity_tags.map((tag) => (
                      <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-teal/10 text-teal font-medium">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                {teamSystem.notes && (
                  <p className="text-xs text-muted/70 mt-2 italic">{teamSystem.notes}</p>
                )}
              </div>
            ) : player.current_team ? (
              <div className="bg-navy/[0.02] rounded-xl border border-dashed border-teal/20 p-5 text-center">
                <Shield size={24} className="mx-auto text-muted/30 mb-2" />
                <p className="text-sm text-muted mb-1">No system profile for <strong>{player.current_team}</strong></p>
                <Link
                  href="/team-systems"
                  className="text-xs text-teal hover:underline"
                >
                  Create team system profile →
                </Link>
              </div>
            ) : null}

            {/* Player Notes Preview */}
            {player.notes && (
              <div style={{ background: "white", borderRadius: 14, border: "1.5px solid rgba(13,148,136,.45)", boxShadow: "0 1px 3px rgba(9,28,48,.05), 0 4px 16px rgba(9,28,48,.07)", padding: "14px 16px 16px", position: "relative" }}>
                <h3 className="text-sm font-oswald uppercase tracking-wider text-muted mb-2">Player Notes</h3>
                <p className="text-sm text-navy/80 whitespace-pre-wrap">{player.notes}</p>
              </div>
            )}

            {/* Suggest Correction */}
            <div className="no-print" style={{ background: "white", borderRadius: 14, border: "1.5px solid rgba(13,148,136,.45)", boxShadow: "0 1px 3px rgba(9,28,48,.05), 0 4px 16px rgba(9,28,48,.07)", padding: "14px 16px 16px", position: "relative" }}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-oswald uppercase tracking-wider text-muted flex items-center gap-2">
                  <AlertTriangle size={14} className="text-orange" />
                  Data Corrections
                  {pendingCorrections > 0 && (
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-orange text-white text-[10px] font-bold">
                      {pendingCorrections}
                    </span>
                  )}
                </h3>
                <button
                  onClick={() => setShowCorrectionForm(!showCorrectionForm)}
                  className="text-xs text-teal hover:text-teal/70 flex items-center gap-1 transition-colors"
                >
                  {showCorrectionForm ? <X size={12} /> : <Edit3 size={12} />}
                  {showCorrectionForm ? "Cancel" : "Suggest Correction"}
                </button>
              </div>

              {correctionMsg && (
                <div className="mb-3 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-green-700 text-xs flex items-center gap-2">
                  <CheckCircle size={12} />
                  {correctionMsg}
                  <button onClick={() => setCorrectionMsg("")} className="ml-auto"><X size={10} /></button>
                </div>
              )}

              {showCorrectionForm && (
                <div className="space-y-3 p-3 bg-gray-50 rounded-lg border border-teal/20">
                  <div>
                    <label className="text-[10px] font-oswald uppercase tracking-wider text-muted">Field to Correct</label>
                    <select
                      value={correctionField}
                      onChange={(e) => setCorrectionField(e.target.value)}
                      className="w-full border border-teal/20 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-teal/30"
                    >
                      <option value="">Select field...</option>
                      {CORRECTABLE_FIELDS.map((f) => (
                        <option key={f} value={f}>{CORRECTABLE_FIELD_LABELS[f] || f}</option>
                      ))}
                    </select>
                  </div>

                  {correctionField && (
                    <div className="text-[10px] text-muted">
                      Current value: <span className="font-medium text-navy">
                        {String((player as unknown as Record<string, unknown>)[correctionField] ?? "—")}
                      </span>
                    </div>
                  )}

                  <div>
                    <label className="text-[10px] font-oswald uppercase tracking-wider text-muted">Correct Value</label>
                    <input
                      type="text"
                      value={correctionValue}
                      onChange={(e) => setCorrectionValue(e.target.value)}
                      placeholder="Enter the correct value..."
                      className="w-full border border-teal/20 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-teal/30"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-oswald uppercase tracking-wider text-muted">Reason (optional)</label>
                    <textarea
                      value={correctionReason}
                      onChange={(e) => setCorrectionReason(e.target.value)}
                      placeholder="Why is this incorrect?"
                      rows={2}
                      className="w-full border border-teal/20 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-teal/30 resize-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-oswald uppercase tracking-wider text-muted">Confidence</label>
                    <div className="flex gap-2 mt-1">
                      {(["low", "medium", "high"] as const).map((c) => (
                        <button
                          key={c}
                          onClick={() => setCorrectionConfidence(c)}
                          className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                            correctionConfidence === c
                              ? c === "high" ? "bg-green-100 text-green-700 border border-green-300"
                                : c === "medium" ? "bg-yellow-100 text-yellow-700 border border-yellow-300"
                                : "bg-red-100 text-red-700 border border-red-300"
                              : "bg-gray-100 text-muted border border-teal/20 hover:bg-gray-200"
                          }`}
                        >
                          {c.charAt(0).toUpperCase() + c.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={async () => {
                      if (!correctionField || !correctionValue) return;
                      setSubmittingCorrection(true);
                      try {
                        await api.post(`/players/${playerId}/corrections`, {
                          field_name: correctionField,
                          new_value: correctionValue,
                          reason: correctionReason,
                          confidence: correctionConfidence,
                        });
                        setCorrectionMsg("Correction submitted for review!");
                        setCorrectionField("");
                        setCorrectionValue("");
                        setCorrectionReason("");
                        setShowCorrectionForm(false);
                        setPendingCorrections((p) => p + 1);
                      } catch (err: unknown) {
                        const msg = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
                        toast.error(typeof msg === "string" ? msg : "Failed to submit correction");
                      } finally {
                        setSubmittingCorrection(false);
                      }
                    }}
                    disabled={submittingCorrection || !correctionField || !correctionValue}
                    className="w-full bg-gradient-to-r from-orange to-orange/80 text-white py-2 rounded-lg font-oswald font-semibold uppercase tracking-wider text-sm hover:shadow-md transition-shadow disabled:opacity-50"
                  >
                    {submittingCorrection ? "Submitting..." : "Submit Correction"}
                  </button>
                </div>
              )}

              {!showCorrectionForm && pendingCorrections === 0 && (
                <p className="text-xs text-muted">
                  See incorrect data? Click &quot;Suggest Correction&quot; to submit a fix for review.
                </p>
              )}
            </div>

            {/* ── BelowFold: Career Stats ── */}
            {stats.filter(s => s.stat_type === "season").length > 1 && (
              <div style={{ background: "white", borderRadius: 14, border: "1.5px solid rgba(13,148,136,.45)", boxShadow: "0 1px 3px rgba(9,28,48,.05), 0 4px 16px rgba(9,28,48,.07)", padding: "14px 16px 16px", position: "relative" }}>
                <h3 className="text-sm font-oswald uppercase tracking-wider text-muted mb-3 flex items-center gap-2">
                  <TrendingUp size={14} className="text-teal" /> Career Stats
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-navy/10">
                        <th className="text-left py-1.5 px-2 font-oswald uppercase tracking-wider text-muted text-[10px]">Season</th>
                        <th className="text-left py-1.5 px-2 font-oswald uppercase tracking-wider text-muted text-[10px]">Team</th>
                        <th className="text-center py-1.5 px-2 font-oswald uppercase tracking-wider text-muted text-[10px]">GP</th>
                        <th className="text-center py-1.5 px-2 font-oswald uppercase tracking-wider text-muted text-[10px]">G</th>
                        <th className="text-center py-1.5 px-2 font-oswald uppercase tracking-wider text-muted text-[10px]">A</th>
                        <th className="text-center py-1.5 px-2 font-oswald uppercase tracking-wider text-muted text-[10px]">P</th>
                        <th className="text-center py-1.5 px-2 font-oswald uppercase tracking-wider text-teal text-[10px]">PPG</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats
                        .filter(s => s.stat_type === "season")
                        .sort((a, b) => (b.season || "").localeCompare(a.season || ""))
                        .map((s) => (
                          <tr key={s.id} className="border-b border-navy/5 hover:bg-navy/[0.02]">
                            <td className="py-1.5 px-2 font-medium text-navy">{s.season || "—"}</td>
                            <td className="py-1.5 px-2 text-navy/70">{s.team_name || player.current_team || "—"}</td>
                            <td className="text-center py-1.5 px-2">{s.gp}</td>
                            <td className="text-center py-1.5 px-2">{s.g}</td>
                            <td className="text-center py-1.5 px-2">{s.a}</td>
                            <td className="text-center py-1.5 px-2 font-bold">{s.p}</td>
                            <td className="text-center py-1.5 px-2 font-bold text-teal">
                              {s.gp > 0 ? (s.p / s.gp).toFixed(2) : "—"}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── BelowFold: Recent Game Log ── */}
            {gameLog && gameLog.games.length > 0 && (
              <div style={{ background: "white", borderRadius: 14, border: "1.5px solid rgba(13,148,136,.45)", boxShadow: "0 1px 3px rgba(9,28,48,.05), 0 4px 16px rgba(9,28,48,.07)", padding: "14px 16px 16px", position: "relative" }}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-oswald uppercase tracking-wider text-muted flex items-center gap-2">
                    <Activity size={14} className="text-teal" /> Recent Games
                  </h3>
                  <button
                    onClick={() => setActiveTab("stats")}
                    className="text-[10px] text-teal hover:underline font-oswald uppercase tracking-wider"
                  >
                    View All →
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-navy/10">
                        <th className="text-left py-1.5 px-2 font-oswald uppercase tracking-wider text-muted text-[10px]">Date</th>
                        <th className="text-left py-1.5 px-2 font-oswald uppercase tracking-wider text-muted text-[10px]">Opponent</th>
                        <th className="text-center py-1.5 px-2 font-oswald uppercase tracking-wider text-muted text-[10px]">G</th>
                        <th className="text-center py-1.5 px-2 font-oswald uppercase tracking-wider text-muted text-[10px]">A</th>
                        <th className="text-center py-1.5 px-2 font-oswald uppercase tracking-wider text-muted text-[10px]">P</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gameLog.games.slice(0, 5).map((g, i) => (
                        <tr key={i} className="border-b border-navy/5 hover:bg-navy/[0.02]">
                          <td className="py-1.5 px-2 text-navy/70">
                            {g.game_date ? new Date(g.game_date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
                          </td>
                          <td className="py-1.5 px-2 text-navy">{g.opponent || "—"}</td>
                          <td className="text-center py-1.5 px-2">{g.goals ?? "—"}</td>
                          <td className="text-center py-1.5 px-2">{g.assists ?? "—"}</td>
                          <td className="text-center py-1.5 px-2 font-bold">{g.points ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── BelowFold: Scout Notes Preview ── */}
            {notes.length > 0 && (
              <div style={{ background: "white", borderRadius: 14, border: "1.5px solid rgba(13,148,136,.45)", boxShadow: "0 1px 3px rgba(9,28,48,.05), 0 4px 16px rgba(9,28,48,.07)", padding: "14px 16px 16px", position: "relative" }}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-oswald uppercase tracking-wider text-muted flex items-center gap-2">
                    <PenLine size={14} className="text-teal" /> Scout Notes
                    <span className="text-xs font-normal text-muted/60">({notes.length})</span>
                  </h3>
                  <button
                    onClick={() => setActiveTab("notes")}
                    className="text-[10px] text-teal hover:underline font-oswald uppercase tracking-wider"
                  >
                    View All →
                  </button>
                </div>
                <div className="space-y-2">
                  {notes.slice(0, 3).map((note) => (
                    <div key={note.id} className="flex items-start gap-2 p-2 rounded-lg bg-navy/[0.02]">
                      <span className={`px-1.5 py-0.5 text-[9px] rounded-full font-medium shrink-0 ${
                        note.note_type === "game" ? "bg-blue-50 text-blue-700" :
                        note.note_type === "practice" ? "bg-green-50 text-green-700" :
                        note.note_type === "interview" ? "bg-purple-50 text-purple-700" :
                        "bg-gray-50 text-gray-600"
                      }`}>
                        {NOTE_TYPE_LABELS[note.note_type] || note.note_type}
                      </span>
                      <p className="text-xs text-navy/80 line-clamp-2 flex-1">
                        {note.one_line_summary || note.note_text || "—"}
                      </p>
                      <span className="text-[10px] text-muted/50 shrink-0">{relativeTime(note.created_at)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Career History Accordion */}
            <CareerHistoryAccordion transfers={playerTransfers} />

            {/* Achievements Accordion */}
            <AchievementsAccordion achievements={playerAchievements} />

            </>
          )}

          {/* Stats Tab — Left Column */}
        {activeTab === "stats" && (
          <section>
            <p className="text-[11px] text-muted/70 font-oswald tracking-wider mb-2">Season stats, game log, and performance progression over time.</p>
            {/* Sub-view switcher */}
            <div className="flex items-center gap-1 mb-4 p-0.5 bg-navy/[0.04] rounded-lg w-fit">
              {([
                { key: "current" as StatsSubView, label: "Current" },
                { key: "progression" as StatsSubView, label: "Progression" },
                { key: "gamelog" as StatsSubView, label: "Game Log" },
              ]).map((sv) => (
                <button
                  key={sv.key}
                  onClick={() => setStatsSubView(sv.key)}
                  className={`px-3 py-1.5 text-xs font-oswald uppercase tracking-wider rounded-md transition-all ${
                    statsSubView === sv.key
                      ? "bg-white text-navy shadow-sm font-bold"
                      : "text-muted hover:text-navy"
                  }`}
                >
                  {sv.label}
                </button>
              ))}
            </div>

            {/* Current Stats Sub-View */}
            {statsSubView === "current" && (
              <>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h2 className="text-lg font-semibold text-navy">Season Stats</h2>
                    {stats.length > 0 && stats[0]?.created_at && (
                      <p className="text-[10px] text-muted/50 flex items-center gap-1.5 mt-0.5">
                        {(() => {
                          const ts = new Date(stats[0].created_at);
                          const diffDays = (Date.now() - ts.getTime()) / (1000 * 60 * 60 * 24);
                          const dot = diffDays <= 2 ? "bg-green-500" : diffDays <= 7 ? "bg-teal" : "bg-amber-500";
                          return (
                            <>
                              <span className={`inline-block w-1.5 h-1.5 rounded-full ${dot}`} />
                              Last updated {ts.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                              {diffDays > 7 && <span className="text-amber-600 font-medium ml-1">&middot; Sync may be needed</span>}
                            </>
                          );
                        })()}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <input
                      type="file"
                      accept=".csv,.xlsx,.xls,.xlsm"
                      onChange={handleCsvUpload}
                      disabled={uploading}
                      className="block text-sm text-muted file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-orange/30 file:text-xs file:font-oswald file:uppercase file:tracking-wider file:font-semibold file:bg-orange/10 file:text-orange hover:file:bg-orange/20 file:transition-colors file:cursor-pointer"
                    />
                    <p className="text-[10px] text-muted/60 mt-1">Supports XLSX analytics exports, CSV, Excel</p>
                  </div>
                </div>

                {uploadMsg && (
                  <div className={`mb-3 px-3 py-2 rounded-lg text-sm flex items-center gap-2 ${
                    uploadMsg.startsWith("✓") ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"
                  }`}>
                    {uploadMsg.startsWith("✓") ? <CheckCircle size={14} /> : null}
                    {uploadMsg}
                  </div>
                )}

                {/* Recent Form Badge */}
                {recentForm && recentForm.games_found > 0 && (
                  <div className="mb-4 p-3 rounded-lg bg-gradient-to-r from-teal/[0.04] to-transparent border border-teal/15">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-[10px] font-oswald uppercase tracking-wider text-teal font-bold">Last {recentForm.games_found} Games</span>
                      <span className="text-xs text-navy font-medium">{recentForm.totals.g}G {recentForm.totals.a}A {recentForm.totals.p}P</span>
                      <span className="text-xs text-muted">({recentForm.averages.ppg} PPG)</span>
                      {recentForm.streak && recentForm.streak !== "No active streak" && recentForm.streak !== "No game data available" && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-teal/10 text-teal text-[10px] font-bold">
                          <Flame size={9} />
                          {recentForm.streak}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Goalie Stats (if goalie position) */}
                {goalieStats.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-sm font-oswald uppercase tracking-wider text-muted mb-2">Goaltending</h3>
                    <div style={{ background: "white", borderRadius: 14, border: "1.5px solid rgba(13,148,136,.45)", boxShadow: "0 1px 3px rgba(9,28,48,.05), 0 4px 16px rgba(9,28,48,.07)", overflow: "hidden", position: "relative" }}>
                      <GoalieStatTable stats={goalieStats} />
                    </div>
                  </div>
                )}

                {/* Skater Stats */}
                <div style={{ background: "white", borderRadius: 14, border: "1.5px solid rgba(13,148,136,.45)", boxShadow: "0 1px 3px rgba(9,28,48,.05), 0 4px 16px rgba(9,28,48,.07)", overflow: "hidden", position: "relative" }}>
                  <StatTable stats={stats} editable={true} onStatsChange={async () => {
                    const res = await api.get<PlayerStats[]>(`/stats/player/${playerId}`);
                    setStats(res.data);
                  }} />
                </div>

                {/* Data freshness indicator */}
                {(stats.length > 0 || goalieStats.length > 0) && (() => {
                  const allStats = [...stats, ...goalieStats];
                  const newest = allStats.reduce((a, b) => (a.created_at > b.created_at ? a : b));
                  const source = newest.data_source || "manual";
                  const ts = new Date(newest.created_at);
                  const dateStr = isNaN(ts.getTime()) ? "" : ts.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
                  return dateStr ? (
                    <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#5A7291", marginTop: 6 }}>
                      Stats last updated: {dateStr} | Source: {source}
                    </p>
                  ) : null;
                })()}

                {stats.length === 0 && goalieStats.length === 0 && (
                  <p className="text-xs text-muted/60 mt-2">No stats yet — import via CSV/XLSX or sync from League Data.</p>
                )}

                {/* Extended Stats (Advanced Analytics) */}
                {stats.some((s) => s.extended_stats && Object.keys(s.extended_stats).length > 0) && (
                  <div className="mt-6">
                    <h3 className="text-sm font-oswald uppercase tracking-wider text-muted mb-3">
                      Advanced Analytics
                    </h3>
                    {stats
                      .filter((s) => s.extended_stats && Object.keys(s.extended_stats).length > 0)
                      .slice(0, 1)
                      .map((s) => (
                        <ExtendedStatTable
                          key={s.id}
                          stats={s.extended_stats!}
                          season={s.season}
                          source={s.data_source || undefined}
                        />
                      ))}
                  </div>
                )}

                {/* Goalie Extended Stats */}
                {goalieStats.some((s) => s.extended_stats && Object.keys(s.extended_stats).length > 0) && (
                  <div className="mt-6">
                    <h3 className="text-sm font-oswald uppercase tracking-wider text-muted mb-3">
                      Goaltending Advanced Analytics
                    </h3>
                    {goalieStats
                      .filter((s) => s.extended_stats && Object.keys(s.extended_stats).length > 0)
                      .slice(0, 1)
                      .map((s) => (
                        <ExtendedStatTable
                          key={s.id}
                          stats={s.extended_stats!}
                          season={s.season}
                          source={s.data_source || undefined}
                        />
                      ))}
                  </div>
                )}

                {/* Team Splits (multi-team season) */}
                {teamSplits.length > 1 && (
                  <div className="mt-6">
                    <h3 className="text-sm font-oswald uppercase tracking-wider text-navy mb-3 flex items-center gap-2">
                      <ArrowRightLeft size={14} className="text-teal" />
                      Team Splits (Current Season)
                    </h3>
                    <div style={{ background: "white", borderRadius: 14, border: "1.5px solid rgba(13,148,136,.45)", boxShadow: "0 1px 3px rgba(9,28,48,.05), 0 4px 16px rgba(9,28,48,.07)", overflow: "hidden", position: "relative" }}>
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-navy/[0.04] border-b border-border">
                            <th className="px-3 py-2 text-left font-oswald uppercase tracking-wider text-navy/60">Team</th>
                            <th className="px-3 py-2 text-left font-oswald uppercase tracking-wider text-navy/60">League</th>
                            <th className="px-3 py-2 text-center font-oswald uppercase tracking-wider text-navy/60">GP</th>
                            <th className="px-3 py-2 text-center font-oswald uppercase tracking-wider text-navy/60">G</th>
                            <th className="px-3 py-2 text-center font-oswald uppercase tracking-wider text-navy/60">A</th>
                            <th className="px-3 py-2 text-center font-oswald uppercase tracking-wider text-navy/60">P</th>
                            <th className="px-3 py-2 text-center font-oswald uppercase tracking-wider text-navy/60">+/-</th>
                            <th className="px-3 py-2 text-center font-oswald uppercase tracking-wider text-navy/60">PIM</th>
                          </tr>
                        </thead>
                        <tbody>
                          {teamSplits.map((ts) => (
                            <tr key={ts.id} className="border-b border-border/50 hover:bg-navy/[0.02]">
                              <td className="px-3 py-2 font-medium text-navy">{ts.team_name || "—"}</td>
                              <td className="px-3 py-2 text-navy/60">{ts.league || "—"}</td>
                              <td className="px-3 py-2 text-center">{ts.gp}</td>
                              <td className="px-3 py-2 text-center">{ts.g}</td>
                              <td className="px-3 py-2 text-center">{ts.a}</td>
                              <td className="px-3 py-2 text-center font-bold text-navy">{ts.p}</td>
                              <td className="px-3 py-2 text-center">{ts.plus_minus ?? "—"}</td>
                              <td className="px-3 py-2 text-center">{ts.pim ?? "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Progression Sub-View */}
            {statsSubView === "progression" && (
              <>
                <h2 className="text-lg font-semibold text-navy mb-3">Season Progression</h2>
                {loadingProgression ? (
                  <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-navy border-t-teal mx-auto" />
                    <p className="text-xs text-muted mt-2">Loading progression data...</p>
                  </div>
                ) : progression ? (
                  <ProgressionChart data={progression} />
                ) : null}
              </>
            )}

            {/* Game Log Sub-View */}
            {statsSubView === "gamelog" && (
              <>
                <h2 className="text-lg font-semibold text-navy mb-3">Game Log</h2>
                {loadingGameLog ? (
                  <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-navy border-t-teal mx-auto" />
                    <p className="text-xs text-muted mt-2">Loading game log...</p>
                  </div>
                ) : gameLog ? (
                  <GameLogTable
                    data={gameLog}
                    onPageChange={handleGameLogPageChange}
                    currentOffset={gameLogOffset}
                    pageSize={50}
                  />
                ) : null}
              </>
            )}
          </section>
        )}

          {/* Notes Tab — Left Column */}
        {/* Notes Tab */}
        {activeTab === "notes" && (
          <section>
            <p className="text-[11px] text-muted/70 font-oswald tracking-wider mb-2">Game observations, scouting notes, and tagged assessments from your team.</p>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-navy">Scout Notes</h2>
              <div className="flex items-center gap-2">
                <Link
                  href={`/scout-notes/new?player_id=${playerId}`}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs font-oswald uppercase tracking-wider rounded-lg bg-teal text-white hover:bg-teal/90 transition-colors"
                >
                  <ClipboardCheck size={14} />
                  Scout Evaluation
                </Link>
                <button
                  onClick={() => {
                    setShowNoteForm(!showNoteForm);
                    setEditingNoteId(null);
                    if (!showNoteForm) {
                      setNoteText("");
                      setNoteType("general");
                      setNoteTags([]);
                      setNotePrivate(false);
                    }
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs font-oswald uppercase tracking-wider rounded-lg bg-teal/10 text-teal hover:bg-teal/20 border border-teal/30 transition-colors"
                >
                  {showNoteForm ? <X size={14} /> : <PenLine size={14} />}
                  {showNoteForm ? "Cancel" : "Quick Note"}
                </button>
              </div>
            </div>

            {/* Note Form — Mobile Optimized */}
            {showNoteForm && (
              <div style={{ background: "white", borderRadius: 14, border: "1.5px solid rgba(13,148,136,.45)", boxShadow: "0 1px 3px rgba(9,28,48,.05), 0 4px 16px rgba(9,28,48,.07)", padding: "12px 16px 14px", marginBottom: 16, position: "relative" }}>
                <h3 className="text-sm font-semibold text-navy mb-3">
                  {editingNoteId ? "Edit Note" : "New Note"}
                </h3>

                {/* Note Type */}
                <div className="flex gap-2 mb-3 flex-wrap">
                  {Object.entries(NOTE_TYPE_LABELS).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setNoteType(key)}
                      className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                        noteType === key
                          ? "bg-teal text-white border-teal"
                          : "bg-white text-muted border-teal/20 hover:border-teal/50"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {/* Text Area — large touch target for mobile */}
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Enter your scouting observation..."
                  rows={4}
                  className="w-full px-3 py-2.5 border border-teal/20 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
                  autoFocus
                />

                {/* Tags */}
                <div className="mt-3">
                  <p className="text-xs text-muted mb-1.5">Tags</p>
                  <div className="flex flex-wrap gap-1.5">
                    {NOTE_TAG_OPTIONS.map((tag) => (
                      <button
                        key={tag}
                        onClick={() => toggleTag(tag)}
                        className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                          noteTags.includes(tag)
                            ? "bg-navy text-white border-navy"
                            : "bg-white text-muted border-teal/20 hover:border-navy/30"
                        }`}
                      >
                        {NOTE_TAG_LABELS[tag] || tag}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Private toggle + Save */}
                <div className="flex items-center justify-between mt-4">
                  <button
                    onClick={() => setNotePrivate(!notePrivate)}
                    className={`flex items-center gap-1.5 text-xs transition-colors ${
                      notePrivate ? "text-orange" : "text-muted"
                    }`}
                  >
                    {notePrivate ? <Lock size={14} /> : <Unlock size={14} />}
                    {notePrivate ? "Private (only you)" : "Shared with team"}
                  </button>
                  <button
                    onClick={handleSaveNote}
                    disabled={!noteText.trim() || savingNote}
                    className="flex items-center gap-2 px-4 py-2 bg-teal text-white text-xs font-oswald uppercase tracking-wider rounded-lg hover:bg-teal/90 disabled:opacity-50 transition-colors"
                  >
                    <Send size={14} />
                    {savingNote ? "Saving..." : editingNoteId ? "Update" : "Save Note"}
                  </button>
                </div>
              </div>
            )}

            {/* Notes List */}
            {notes.length === 0 ? (
              <div style={{ textAlign: "center", paddingTop: 32, paddingBottom: 32, background: "white", borderRadius: 14, border: "1.5px solid rgba(13,148,136,.45)", boxShadow: "0 1px 3px rgba(9,28,48,.05), 0 4px 16px rgba(9,28,48,.07)" }}>
                <PenLine size={24} className="mx-auto text-muted/40 mb-2" />
                <p className="text-muted text-sm">No notes yet for this player.</p>
                <p className="text-xs text-muted/60 mt-1">Add your first scouting observation above.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {notes.map((note) => (
                  <div key={note.id} style={{ background: "white", borderRadius: 14, border: "1.5px solid rgba(13,148,136,.45)", boxShadow: "0 1px 3px rgba(9,28,48,.05), 0 4px 16px rgba(9,28,48,.07)", padding: "12px 16px 14px", position: "relative" }}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        {/* Header */}
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                            note.note_type === "game" ? "bg-blue-50 text-blue-700" :
                            note.note_type === "practice" ? "bg-green-50 text-green-700" :
                            note.note_type === "interview" ? "bg-purple-50 text-purple-700" :
                            "bg-gray-50 text-gray-600"
                          }`}>
                            {NOTE_TYPE_LABELS[note.note_type] || note.note_type}
                          </span>
                          {note.is_private && (
                            <span className="flex items-center gap-0.5 text-xs text-orange">
                              <Lock size={10} /> Private
                            </span>
                          )}
                          <span className="text-xs text-muted" title={new Date(note.created_at).toLocaleString()}>
                            {relativeTime(note.created_at)}
                          </span>
                        </div>

                        {/* v2: Overall Grade + Prospect Status */}
                        {(note.overall_grade || note.prospect_status) && (
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            {note.overall_grade && (
                              <span className={`w-7 h-7 rounded flex items-center justify-center text-xs font-oswald font-bold ${
                                note.overall_grade >= 4 ? "bg-green-100 text-green-700" :
                                note.overall_grade === 3 ? "bg-amber-50 text-amber-700" :
                                "bg-red-100 text-red-700"
                              }`}>
                                {note.overall_grade}
                              </span>
                            )}
                            {note.prospect_status && PROSPECT_STATUS_LABELS[note.prospect_status] && (
                              <span className={`text-[9px] font-oswald uppercase tracking-wider px-1.5 py-0.5 rounded ${PROSPECT_STATUS_LABELS[note.prospect_status].color}`}>
                                {PROSPECT_STATUS_LABELS[note.prospect_status].label}
                              </span>
                            )}
                          </div>
                        )}

                        {/* v2: Ratings row */}
                        {(note.skating_rating || note.puck_skills_rating || note.hockey_iq_rating || note.compete_rating || note.defense_rating) && (
                          <div className="flex gap-1.5 mb-2 flex-wrap">
                            {[
                              { label: "SKT", value: note.skating_rating },
                              { label: "PKS", value: note.puck_skills_rating },
                              { label: "IQ", value: note.hockey_iq_rating },
                              { label: "CMP", value: note.compete_rating },
                              { label: "DEF", value: note.defense_rating },
                            ].filter(r => r.value).map((r) => (
                              <span key={r.label} className="text-[9px] font-oswald uppercase tracking-wider px-1.5 py-0.5 rounded bg-navy/5 text-navy/60">
                                {r.label} {r.value}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* v2: One-line summary */}
                        {note.one_line_summary && (
                          <p className="text-xs text-navy/80 mb-2 italic">{note.one_line_summary}</p>
                        )}

                        {/* v2: Strengths / Improvements */}
                        {note.strengths_notes && (
                          <p className="text-sm text-navy whitespace-pre-wrap mb-1"><span className="text-[10px] font-oswald uppercase tracking-wider text-navy/50">Strengths: </span>{note.strengths_notes}</p>
                        )}
                        {note.improvements_notes && (
                          <p className="text-sm text-navy whitespace-pre-wrap mb-1"><span className="text-[10px] font-oswald uppercase tracking-wider text-navy/50">Improve: </span>{note.improvements_notes}</p>
                        )}

                        {/* Note Text */}
                        {note.note_text && (
                          <p className="text-sm text-navy whitespace-pre-wrap">{note.note_text}</p>
                        )}

                        {/* Tags + Scout */}
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          {note.tags.map((tag) => (
                            <span key={tag} className="px-2 py-0.5 text-xs bg-navy/5 text-navy/70 rounded-full">
                              {NOTE_TAG_LABELS[tag] || tag}
                            </span>
                          ))}
                          {note.scout_name && (
                            <span className="text-xs text-muted ml-auto">
                              — {note.scout_name}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleEditNote(note)}
                          className="p-1.5 text-muted hover:text-navy rounded transition-colors"
                          title="Edit"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteNote(note.id)}
                          className="p-1.5 text-muted hover:text-red-600 rounded transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

          {/* Reports Tab — Left Column */}
        {/* Reports Tab */}
        {activeTab === "reports" && (
          <section>
            <p className="text-[11px] text-muted/70 font-oswald tracking-wider mb-2">AI-generated scouting reports and custom analysis for this player.</p>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-navy">Reports</h2>
              <span className="text-xs text-muted">{reports.length} total</span>
            </div>
            {reports.length === 0 ? (
              <div style={{ textAlign: "center", paddingTop: 32, paddingBottom: 32, background: "white", borderRadius: 14, border: "1.5px solid rgba(13,148,136,.45)", boxShadow: "0 1px 3px rgba(9,28,48,.05), 0 4px 16px rgba(9,28,48,.07)" }}>
                <FileText size={24} className="mx-auto text-muted/40 mb-2" />
                <p className="text-muted text-sm">No reports yet for this player.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {reports.map((r) => (
                  <ReportCard key={r.id} report={r} />
                ))}
              </div>
            )}
          </section>
        )}

          {/* Dev Plan Tab — Left Column */}
        {/* Player Tab */}
        {activeTab === "player" && (
          <section className="space-y-4">
            <p className="text-[11px] text-muted/70 font-oswald tracking-wider -mb-1">Player card, development plan, and long-term projection tools.</p>

            {/* ── Film Review Recommended Card (P1 Film → Dev Plan Bridge) ── */}
            {statTrends.length > 0 && !statTrendsLoading && (
              <div style={{ background: "white", borderRadius: 14, overflow: "hidden", borderLeft: "4px solid #0D9488", boxShadow: "0 1px 3px rgba(9,28,48,.05), 0 4px 16px rgba(9,28,48,.07)" }}>
                <div style={{ background: "linear-gradient(135deg, #0D9488 0%, #14B8A8 100%)", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div className="flex items-center gap-2">
                    <Film size={14} style={{ color: "white" }} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: "white", fontFamily: "'Oswald', sans-serif", letterSpacing: "0.08em", textTransform: "uppercase" }}>Film Review Recommended</span>
                  </div>
                  <span style={{ fontSize: 9, fontWeight: 600, color: "rgba(255,255,255,0.8)", fontFamily: "'Oswald', sans-serif", letterSpacing: "0.06em", textTransform: "uppercase", background: "rgba(255,255,255,0.2)", borderRadius: 4, padding: "2px 6px" }}>
                    {statTrends.length} {statTrends.length === 1 ? "trigger" : "triggers"}
                  </span>
                </div>
                <div style={{ padding: "12px 16px" }}>
                  {/* Trigger summaries */}
                  <div className="space-y-2 mb-3">
                    {statTrends.slice(0, 3).map((t, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <span style={{ width: 6, height: 6, borderRadius: "50%", marginTop: 5, flexShrink: 0, background: t.severity === "high" ? "#EF4444" : "#F59E0B" }} />
                        <div>
                          <span className="text-xs font-oswald uppercase tracking-wider text-navy font-bold">{t.label}</span>
                          <p className="text-[11px] text-muted/70 leading-snug">{t.trigger_reason}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Clip count */}
                  {(statTrendsClipCounts.total || 0) > 0 ? (
                    <p className="text-[11px] text-teal font-medium mb-3">
                      {statTrendsClipCounts.total} clip{statTrendsClipCounts.total !== 1 ? "s" : ""} available for review
                    </p>
                  ) : (
                    <p className="text-[11px] text-muted/50 mb-3">No film tagged yet — import game footage to enable clip review</p>
                  )}

                  {/* PXI coaching suggestions */}
                  {filmSuggestions.length > 0 && (
                    <div className="mb-3 space-y-1.5">
                      {filmSuggestions.slice(0, 3).map((s, idx) => (
                        <div key={idx} style={{ background: "rgba(13,148,136,0.05)", borderRadius: 6, padding: "6px 10px" }}>
                          <p className="text-[11px] text-navy/80 leading-snug">
                            <span className="font-bold text-teal">{s.label}:</span> {s.coaching_note}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Review Clips button */}
                  {(statTrendsClipCounts.total || 0) > 0 && (
                    <Link
                      href={`/film?player_id=${playerId}${statTrends[0]?.event_type_filter ? `&event_type=${statTrends[0].event_type_filter}` : ""}`}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-oswald uppercase tracking-wider text-white transition-colors"
                      style={{ background: "#0D9488" }}
                    >
                      <Play size={12} />
                      Review Clips
                    </Link>
                  )}
                </div>
              </div>
            )}

            {/* ── P2-C2: Recent Film Summaries ──────────────────── */}
            {filmSummaries.length > 0 && (
              <div style={{ background: "white", borderRadius: 14, overflow: "hidden", borderLeft: "4px solid #F97316", boxShadow: "0 1px 3px rgba(9,28,48,.05), 0 4px 16px rgba(9,28,48,.07)" }}>
                <div style={{ background: "linear-gradient(135deg, #F97316 0%, #FB923C 100%)", padding: "8px 16px", display: "flex", alignItems: "center", gap: 8 }}>
                  <Sparkles size={13} style={{ color: "white" }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: "white", fontFamily: "'Oswald', sans-serif", letterSpacing: "0.08em", textTransform: "uppercase" }}>Recent Film Summary</span>
                </div>
                <div style={{ padding: "12px 16px" }}>
                  {filmSummaries.slice(0, 3).map((fs) => (
                    <div key={fs.id} style={{ marginBottom: filmSummaries.indexOf(fs) < Math.min(filmSummaries.length, 3) - 1 ? 10 : 0, paddingBottom: filmSummaries.indexOf(fs) < Math.min(filmSummaries.length, 3) - 1 ? 10 : 0, borderBottom: filmSummaries.indexOf(fs) < Math.min(filmSummaries.length, 3) - 1 ? "1px solid rgba(0,0,0,0.06)" : "none" }}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-oswald uppercase tracking-wider text-muted/50">
                          {new Date(fs.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                      </div>
                      <p className="text-[12px] text-navy/80 leading-relaxed">{fs.summary}</p>
                      <Link
                        href={`/film/sessions/${fs.session_id}`}
                        className="inline-flex items-center gap-1 text-[10px] font-oswald uppercase tracking-wider text-teal hover:text-teal/80 mt-1"
                      >
                        View Full Analysis <ExternalLink size={9} />
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Section 1: Player Card ──────────────────────────── */}
            {player && (
              <div style={{ background: "white", borderRadius: 14, border: "1.5px solid rgba(13,148,136,.45)", boxShadow: "0 1px 3px rgba(9,28,48,.05), 0 4px 16px rgba(9,28,48,.07)", padding: "12px 16px 14px", position: "relative", display: "flex", alignItems: "center", gap: 16 }}>
                {player.image_url && hasRealImage(player.image_url) ? (
                  <img src={assetUrl(player.image_url)} alt={`${player.first_name} ${player.last_name}`} className="w-16 h-16 rounded-full object-cover border border-border" />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-navy/5 flex items-center justify-center text-lg font-oswald text-navy/40">
                    {player.first_name?.charAt(0)}{player.last_name?.charAt(0)}
                  </div>
                )}
                <div>
                  <h2 className="text-lg font-oswald font-bold text-navy uppercase tracking-wider">
                    {player.first_name} {player.last_name}
                  </h2>
                  <p className="text-sm text-muted">
                    {fullPosition(player.position)} {player.jersey_number ? `#${player.jersey_number}` : ""} {player.current_team ? `• ${player.current_team}` : ""} {player.current_league ? `• ${formatLeague(player.current_league)}` : ""}
                  </p>
                  {player.dob && (
                    <p className="text-xs text-muted/60 mt-0.5">
                      DOB: {new Date(player.dob).toLocaleDateString()} {player.shoots ? `• Shoots: ${player.shoots}` : ""}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* ── Section 2: Season Snapshot ───────────────────────── */}
            {stats.length > 0 && (
              <div style={{ background: "white", borderRadius: 14, border: "1.5px solid rgba(13,148,136,.45)", boxShadow: "0 1px 3px rgba(9,28,48,.05), 0 4px 16px rgba(9,28,48,.07)", padding: "12px 16px 14px", position: "relative" }}>
                <h3 className="text-xs font-oswald uppercase tracking-wider text-muted mb-3">Season Snapshot</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {(() => {
                    const s = stats.filter(st => st.stat_type === "season").sort((a, b) => {
                      const yearA = parseInt((a.season || "0").slice(0, 4), 10);
                      const yearB = parseInt((b.season || "0").slice(0, 4), 10);
                      return yearB - yearA;
                    })[0] || stats[0];
                    const isGoalie = player?.position?.toUpperCase() === "G";
                    const isFamily = FAMILY_ROLES.has(userRole);
                    if (isGoalie) {
                      return [
                        { label: isFamily ? "Games played" : "GP", value: s.gp },
                        { label: isFamily ? "Goals-against average" : "GAA", value: (s as unknown as Record<string, unknown>).gaa || "—" },
                        { label: isFamily ? "Save percentage" : "SV%", value: (s as unknown as Record<string, unknown>).sv_pct || "—" },
                        { label: isFamily ? "Shutouts" : "SO", value: (s as unknown as Record<string, unknown>).so || "—" },
                      ].map(({ label, value }) => (
                        <div key={label} className="text-center p-2 bg-gray-50 rounded-lg">
                          <p className="text-lg font-oswald font-bold text-navy">{String(value)}</p>
                          <p className="text-xs text-muted">{label}</p>
                        </div>
                      ));
                    }
                    return [
                      { label: isFamily ? "Games played" : "GP", value: s.gp },
                      { label: isFamily ? "Goals scored" : "G", value: s.g },
                      { label: isFamily ? "Assists" : "A", value: s.a },
                      { label: isFamily ? "Total points" : "P", value: s.p },
                      { label: isFamily ? "Points per game" : "PPG", value: s.gp > 0 ? (s.p / s.gp).toFixed(2) : "—" },
                      { label: isFamily ? "Plus/minus rating" : "+/-", value: s.plus_minus ?? "—" },
                      { label: isFamily ? "Penalty minutes" : "PIM", value: s.pim ?? "—" },
                      { label: isFamily ? "Shots on goal" : "SOG", value: s.shots ?? "—" },
                    ].map(({ label, value }) => (
                      <div key={label} className="text-center p-2 bg-gray-50 rounded-lg">
                        <p className="text-lg font-oswald font-bold text-navy">{String(value)}</p>
                        <p className="text-xs text-muted">{label}</p>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            )}

            {/* ── Section 3: Development Plan ─────────────────────── */}
            <div style={{ background: "white", borderRadius: 14, overflow: "hidden", position: "relative", borderLeft: "4px solid #0D9488" }}>
              <div style={{ background: "linear-gradient(135deg, #0F2942 0%, #1A3F54 100%)", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h3 style={{ fontSize: 12, fontWeight: 700, color: "white", fontFamily: "'DM Sans', sans-serif", letterSpacing: ".06em", textTransform: "uppercase" }}>Development Plan</h3>
                <div className="flex gap-2">
                  {/* Version history toggle (coach/admin only, saved state) */}
                  {COACH_ROLES.has(userRole) && devPlanV2History.length > 1 && planStatus === "saved" && (
                    <button
                      onClick={() => setShowDevVersions(!showDevVersions)}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-white/20 rounded-lg hover:bg-white/10 text-white/70"
                    >
                      <History size={14} />
                      v{devPlanV2?.version || 1} of {devPlanV2History.length}
                    </button>
                  )}
                  {/* Generate / New Version button (coach/admin only) */}
                  {COACH_ROLES.has(userRole) && planStatus !== "generating" && planStatus !== "draft" && (
                    <button
                      onClick={handleGenerateV2}
                      disabled={generatingDevPlan}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-teal text-white rounded-lg hover:bg-teal/90 disabled:opacity-50"
                    >
                      {generatingDevPlan ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                      {devPlanV2 ? "Generate New Version" : "Generate Dev Plan"}
                    </button>
                  )}
                </div>
              </div>

              <div style={{ padding: "12px 16px 14px" }}>
              {/* Version History Dropdown */}
              {showDevVersions && devPlanV2History.length > 1 && (
                <div className="bg-gray-50 rounded-lg border border-border p-3 space-y-1 mb-3">
                  <p className="text-xs font-oswald uppercase tracking-wider text-muted mb-2">Version History</p>
                  {devPlanV2History.map((v) => (
                    <button
                      key={v.id}
                      onClick={async () => {
                        try {
                          const { data } = await api.get<DevPlanV2>(`/players/${playerId}/development-plan/${v.version}`);
                          setDevPlanV2(data);
                          setShowDevVersions(false);
                        } catch {
                          toast.error("Failed to load version");
                        }
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between ${
                        v.id === devPlanV2?.id ? "bg-teal/10 text-teal" : "hover:bg-white text-navy"
                      }`}
                    >
                      <span>v{v.version} — {v.created_by_name}</span>
                      <span className="text-xs text-muted">{new Date(v.created_at).toLocaleDateString()}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* ── EMPTY STATE ──────────────────────────────────── */}
              {planStatus === "empty" && !loadingDevPlan && (
                <div className="text-center py-12">
                  <TrendingUp size={32} className="mx-auto text-muted/40 mb-3" />
                  {FAMILY_ROLES.has(userRole) ? (
                    <p className="text-muted text-sm">Your development plan hasn&apos;t been created yet. Ask your coach.</p>
                  ) : (
                    <>
                      <p className="text-muted text-sm mb-1">No development plan on file for {new Date().getFullYear()}-{String(new Date().getFullYear() + 1).slice(2)}</p>
                      <p className="text-muted/60 text-xs mb-4">Click below to create an AI-powered development roadmap.</p>
                      <button
                        onClick={handleGenerateV2}
                        disabled={generatingDevPlan}
                        className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-teal text-white rounded-lg hover:bg-teal/90 disabled:opacity-50"
                      >
                        <Sparkles size={16} />
                        Generate Dev Plan
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* ── GENERATING STATE ─────────────────────────────── */}
              {planStatus === "generating" && (
                <div className="text-center py-12">
                  <Loader2 size={28} className="mx-auto text-teal animate-spin mb-3" />
                  <p className="text-sm text-navy font-medium">&#9889; PXI is generating...</p>
                  <p className="text-xs text-muted mt-1">This may take 15-30 seconds</p>
                </div>
              )}

              {/* ── DRAFT STATE ──────────────────────────────────── */}
              {planStatus === "draft" && draftSections && (
                <div className="space-y-3">
                  {/* Draft banner */}
                  <div className="flex items-center gap-2 text-sm text-orange bg-orange/5 px-3 py-2 rounded-lg">
                    <AlertTriangle size={16} />
                    <span className="font-medium">Draft — review sections below, then save or finalize.</span>
                  </div>

                  {/* 9 editable section cards */}
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((num) => {
                    const sectionKey = `section_${num}_${["snapshot", "context", "strengths", "development", "phase_plan", "integration", "metrics", "staff_notes"][num - 1]}`;
                    const title = DEV_PLAN_SECTION_TITLES[num] || `Section ${num}`;
                    const content = draftSections[sectionKey] || "";
                    const isStaffOnly = num === 8;
                    const visKey = `section_${num}_visible_to_player`;

                    // Skip staff notes for non-coach roles
                    if (isStaffOnly && !COACH_ROLES.has(userRole)) return null;

                    return (
                      <div key={num} style={{ background: "white", borderRadius: 14, overflow: "hidden", position: "relative", borderLeft: "4px solid #0D9488" }}>
                        <div style={{ background: "linear-gradient(135deg, #0F2942 0%, #1A3F54 100%)", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <div className="flex items-center gap-2">
                            <span style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: "rgba(255,255,255,.4)" }}>{num}.</span>
                            <h4 style={{ fontSize: 12, fontWeight: 700, color: "white", fontFamily: "'DM Sans', sans-serif", letterSpacing: ".04em", textTransform: "uppercase" }}>{title}</h4>
                            {isStaffOnly && (
                              <span className="flex items-center gap-1 text-xs text-teal bg-teal/10 px-2 py-0.5 rounded-full">
                                <Lock size={10} /> Internal
                              </span>
                            )}
                          </div>
                          {/* Visibility toggle (sections 1-7 only, coach/admin) */}
                          {!isStaffOnly && COACH_ROLES.has(userRole) && (
                            <button
                              onClick={() => setVisibilityFlags((prev) => ({ ...prev, [visKey]: !prev[visKey] }))}
                              className={`p-1 rounded ${visibilityFlags[visKey] ? "text-teal" : "text-white/30"}`}
                              title={visibilityFlags[visKey] ? "Visible to player/parent" : "Hidden from player/parent"}
                            >
                              {visibilityFlags[visKey] ? <Eye size={14} /> : <EyeOff size={14} />}
                            </button>
                          )}
                        </div>
                        <div className="px-4 py-3">
                          <textarea
                            value={content}
                            onChange={(e) => setDraftSections((prev) => prev ? { ...prev, [sectionKey]: e.target.value } : prev)}
                            rows={6}
                            className="w-full text-sm text-navy/80 bg-gray-50 border border-border rounded-lg p-3 outline-none focus:border-teal/40 leading-relaxed resize-y"
                          />
                          <p className="text-xs text-muted/40 mt-1 text-right">{content.length} characters</p>
                        </div>
                      </div>
                    );
                  })}

                  {/* Draft action buttons */}
                  <div className="flex items-center gap-2 pt-2">
                    <button
                      onClick={() => handleSaveV2("draft")}
                      disabled={savingDevPlan}
                      className="flex items-center gap-1 px-4 py-2 text-sm font-oswald uppercase tracking-wider bg-navy text-white rounded-lg hover:bg-navy/90 disabled:opacity-50"
                    >
                      {savingDevPlan ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                      Save Plan
                    </button>
                    <button
                      onClick={() => handleSaveV2("final")}
                      disabled={savingDevPlan}
                      className="flex items-center gap-1 px-4 py-2 text-sm font-oswald uppercase tracking-wider bg-teal text-white rounded-lg hover:bg-teal/90 disabled:opacity-50"
                    >
                      <CheckCircle size={14} />
                      Mark Final
                    </button>
                    <button
                      onClick={() => { setDraftSections(null); setPlanStatus(devPlanV2 ? "saved" : "empty"); }}
                      className="px-4 py-2 text-sm text-muted hover:text-navy"
                    >
                      Discard
                    </button>
                  </div>
                </div>
              )}

              {/* ── SAVED STATE ──────────────────────────────────── */}
              {planStatus === "saved" && devPlanV2 && (
                <div className="space-y-3">
                  {/* Plan header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 text-xs rounded-full font-medium uppercase ${
                        devPlanV2.status === "final" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                      }`}>
                        {devPlanV2.status}
                      </span>
                      <span className="text-xs text-muted">v{devPlanV2.version} • {devPlanV2.season}</span>
                    </div>
                    <span className="text-xs text-muted">
                      {devPlanV2.created_by_name} • {new Date(devPlanV2.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Render saved sections */}
                  {[1, 2, 3, 4, 5, 6, 7].map((num) => {
                    const sectionKey = `section_${num}_${["snapshot", "context", "strengths", "development", "phase_plan", "integration", "metrics"][num - 1]}` as keyof DevPlanV2;
                    const content = devPlanV2[sectionKey] as string | null;
                    const visKey = `section_${num}_visible_to_player` as keyof DevPlanV2;
                    const isVisible = devPlanV2[visKey] as boolean;
                    const title = DEV_PLAN_SECTION_TITLES[num] || `Section ${num}`;

                    // Diff indicator: compare against previous version
                    const prevVersion = devPlanV2History.length > 1 ? devPlanV2History.find(v => v.version === devPlanV2.version - 1) : null;
                    const prevContent = prevVersion ? (prevVersion[sectionKey] as string | null) : null;
                    const isUpdated = devPlanV2.version > 1 && prevVersion && content !== prevContent;

                    // For family roles, skip hidden sections
                    if (FAMILY_ROLES.has(userRole) && !isVisible) return null;

                    return (
                      <div key={num} style={{ background: "white", borderRadius: 14, overflow: "hidden", position: "relative", borderLeft: "4px solid #0D9488" }}>
                        <div style={{ background: "linear-gradient(135deg, #0F2942 0%, #1A3F54 100%)", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <div className="flex items-center gap-2">
                            <span style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: "rgba(255,255,255,.4)" }}>{num}.</span>
                            <h4 style={{ fontSize: 12, fontWeight: 700, color: "white", fontFamily: "'DM Sans', sans-serif", letterSpacing: ".04em", textTransform: "uppercase" }}>{title}</h4>
                            {isUpdated && (
                              <span className="flex items-center gap-1 text-[10px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Updated
                              </span>
                            )}
                            {!isUpdated && devPlanV2.version > 1 && prevVersion && (
                              <span className="w-1.5 h-1.5 rounded-full bg-gray-300 shrink-0" title="Unchanged" />
                            )}
                            {!isVisible && COACH_ROLES.has(userRole) && (
                              <span className="flex items-center gap-1 text-xs text-white/40 bg-white/10 px-2 py-0.5 rounded-full">
                                <EyeOff size={10} /> Hidden
                              </span>
                            )}
                          </div>
                          {/* Per-section edit button (coach only) */}
                          {COACH_ROLES.has(userRole) && (
                            <div className="flex items-center gap-1">
                              {editingV2Section === num ? (
                                <>
                                  <button
                                    onClick={async () => {
                                      setSavingDevPlan(true);
                                      try {
                                        const updatePayload: Record<string, unknown> = {};
                                        const sk = `section_${num}_${["snapshot", "context", "strengths", "development", "phase_plan", "integration", "metrics"][num - 1]}`;
                                        updatePayload[sk] = editV2Content;
                                        // Copy all existing fields for save
                                        for (let i = 1; i <= 8; i++) {
                                          const k = `section_${i}_${["snapshot", "context", "strengths", "development", "phase_plan", "integration", "metrics", "staff_notes"][i - 1]}`;
                                          if (k !== sk) updatePayload[k] = (devPlanV2 as unknown as Record<string, unknown>)[k] || "";
                                        }
                                        for (let i = 1; i <= 8; i++) {
                                          const vk = `section_${i}_visible_to_player`;
                                          updatePayload[vk] = (devPlanV2 as unknown as Record<string, unknown>)[vk];
                                        }
                                        updatePayload.season = devPlanV2.season;
                                        updatePayload.status = devPlanV2.status;
                                        updatePayload.title = devPlanV2.title;
                                        updatePayload.plan_type = devPlanV2.plan_type;
                                        updatePayload.summary = devPlanV2.summary;
                                        const { data } = await api.post<DevPlanV2>(`/players/${playerId}/development-plan`, updatePayload);
                                        setDevPlanV2(data);
                                        setEditingV2Section(null);
                                        toast.success(`Saved as v${data.version}`);
                                        // Refresh history
                                        try {
                                          const histRes = await api.get<DevPlanV2[]>(`/players/${playerId}/development-plan/history`);
                                          setDevPlanV2History(histRes.data);
                                        } catch { /* Non-critical */ }
                                      } catch {
                                        toast.error("Failed to save");
                                      } finally {
                                        setSavingDevPlan(false);
                                      }
                                    }}
                                    disabled={savingDevPlan}
                                    className="p-1 text-teal hover:bg-white/10 rounded"
                                  >
                                    {savingDevPlan ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                  </button>
                                  <button onClick={() => setEditingV2Section(null)} className="p-1 text-white/50 hover:bg-white/10 rounded">
                                    <X size={14} />
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={() => { setEditingV2Section(num); setEditV2Content(content || ""); }}
                                  className="p-1 text-white/50 hover:bg-white/10 rounded"
                                >
                                  <Edit3 size={14} />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="px-4 py-3">
                          {editingV2Section === num ? (
                            <textarea
                              value={editV2Content}
                              onChange={(e) => setEditV2Content(e.target.value)}
                              rows={8}
                              className="w-full text-sm text-navy/80 bg-gray-50 border border-border rounded-lg p-3 outline-none focus:border-teal/40 leading-relaxed resize-y"
                            />
                          ) : content ? (
                            <div className="text-sm text-navy/80 leading-relaxed whitespace-pre-wrap">{content}</div>
                          ) : (
                            <p className="text-sm text-muted/40 italic">Not yet completed</p>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Section 8: Staff Notes (coach/admin only) */}
                  {COACH_ROLES.has(userRole) && (
                    <div style={{ background: "white", borderRadius: 14, overflow: "hidden", position: "relative", borderLeft: "4px solid #0D9488" }}>
                      <div style={{ background: "linear-gradient(135deg, #0F2942 0%, #1A3F54 100%)", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div className="flex items-center gap-2">
                          <span style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: "rgba(255,255,255,.4)" }}>8.</span>
                          <h4 style={{ fontSize: 12, fontWeight: 700, color: "white", fontFamily: "'DM Sans', sans-serif", letterSpacing: ".04em", textTransform: "uppercase" }}>Staff Notes</h4>
                          <span className="flex items-center gap-1 text-xs text-teal bg-teal/10 px-2 py-0.5 rounded-full">
                            <Lock size={10} /> Internal
                          </span>
                        </div>
                        <button
                          onClick={() => {
                            if (editingV2Section === 8) {
                              setEditingV2Section(null);
                            } else {
                              setEditingV2Section(8);
                              setEditV2Content(devPlanV2.section_8_staff_notes || "");
                            }
                          }}
                          className="p-1 text-white/50 hover:bg-white/10 rounded"
                        >
                          {editingV2Section === 8 ? <X size={14} /> : <Edit3 size={14} />}
                        </button>
                      </div>
                      <div className="px-4 py-3">
                        {editingV2Section === 8 ? (
                          <>
                            <textarea
                              value={editV2Content}
                              onChange={(e) => setEditV2Content(e.target.value)}
                              rows={6}
                              className="w-full text-sm text-navy/80 bg-gray-50 border border-border rounded-lg p-3 outline-none focus:border-teal/40 leading-relaxed resize-y"
                            />
                            <div className="flex gap-2 mt-2">
                              <button
                                onClick={async () => {
                                  setSavingDevPlan(true);
                                  try {
                                    const updatePayload: Record<string, unknown> = {};
                                    for (let i = 1; i <= 8; i++) {
                                      const k = `section_${i}_${["snapshot", "context", "strengths", "development", "phase_plan", "integration", "metrics", "staff_notes"][i - 1]}`;
                                      updatePayload[k] = i === 8 ? editV2Content : (devPlanV2 as unknown as Record<string, unknown>)[k] || "";
                                    }
                                    for (let i = 1; i <= 8; i++) {
                                      updatePayload[`section_${i}_visible_to_player`] = (devPlanV2 as unknown as Record<string, unknown>)[`section_${i}_visible_to_player`];
                                    }
                                    updatePayload.season = devPlanV2.season;
                                    updatePayload.status = devPlanV2.status;
                                    updatePayload.title = devPlanV2.title;
                                    updatePayload.plan_type = devPlanV2.plan_type;
                                    updatePayload.summary = devPlanV2.summary;
                                    const { data } = await api.post<DevPlanV2>(`/players/${playerId}/development-plan`, updatePayload);
                                    setDevPlanV2(data);
                                    setEditingV2Section(null);
                                    toast.success(`Staff notes saved as v${data.version}`);
                                  } catch {
                                    toast.error("Failed to save");
                                  } finally {
                                    setSavingDevPlan(false);
                                  }
                                }}
                                disabled={savingDevPlan}
                                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-teal text-white rounded-lg hover:bg-teal/90 disabled:opacity-50"
                              >
                                {savingDevPlan ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                Save
                              </button>
                              <button onClick={() => setEditingV2Section(null)} className="px-3 py-1.5 text-xs text-muted hover:text-navy">
                                Cancel
                              </button>
                            </div>
                          </>
                        ) : devPlanV2.section_8_staff_notes ? (
                          <div className="text-sm text-navy/80 leading-relaxed whitespace-pre-wrap">{devPlanV2.section_8_staff_notes}</div>
                        ) : (
                          <p className="text-sm text-muted/40 italic">No staff notes yet</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Recent Reports (coach/admin/scout only) */}
                  {COACH_ROLES.has(userRole) && reports.length > 0 && (
                    <div style={{ background: "white", borderRadius: 14, border: "1.5px solid rgba(13,148,136,.45)", boxShadow: "0 1px 3px rgba(9,28,48,.05), 0 4px 16px rgba(9,28,48,.07)", padding: "12px 16px 14px", position: "relative" }}>
                      <h3 className="text-xs font-oswald uppercase tracking-wider text-muted mb-3">Recent Reports</h3>
                      <div className="space-y-2">
                        {reports.slice(0, 3).map((r) => (
                          <Link key={r.id} href={`/reports/${r.id}`} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50 border border-border">
                            <div className="flex items-center gap-2">
                              <FileText size={14} className="text-muted" />
                              <span className="text-sm text-navy">{r.title || r.report_type.replace(/_/g, " ")}</span>
                            </div>
                            <span className="text-xs text-muted">{new Date(r.created_at).toLocaleDateString()}</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Legacy backward compat: show old sections model if no v2 sections */}
                  {!devPlanV2.section_1_snapshot && devPlan?.sections && devPlan.sections.length > 0 && (
                    <div style={{ background: "white", borderRadius: 14, border: "1.5px solid rgba(13,148,136,.45)", boxShadow: "0 1px 3px rgba(9,28,48,.05), 0 4px 16px rgba(9,28,48,.07)", padding: "12px 16px 14px", position: "relative" }}>
                      <h3 className="text-xs font-oswald uppercase tracking-wider text-muted mb-3">Legacy Plan Sections</h3>
                      {devPlan.sections.map((section: DevelopmentPlanSection, idx: number) => (
                        <div key={idx} className="mb-3 last:mb-0">
                          <h4 className="text-sm font-semibold text-navy mb-1">{section.title}</h4>
                          <div className="text-sm text-navy/80 leading-relaxed whitespace-pre-wrap">{section.content}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Loading state */}
              {loadingDevPlan && (
                <div className="text-center py-12">
                  <Loader2 size={24} className="mx-auto text-teal animate-spin mb-2" />
                  <p className="text-sm text-muted">Loading development plan...</p>
                </div>
              )}
              </div>
            </div>

            {/* ── Parent Access Card (coach/admin only) ───────── */}
            {COACH_ROLES.has(userRole) && (
              <div style={{ background: "white", borderRadius: 14, overflow: "hidden", position: "relative", borderLeft: "4px solid #0D9488" }}>
                <div style={{ background: "linear-gradient(135deg, #0F2942 0%, #1A3F54 100%)", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <h4 style={{ fontSize: 12, fontWeight: 700, color: "white", fontFamily: "'DM Sans', sans-serif", letterSpacing: ".04em", textTransform: "uppercase" }}>Parent Access</h4>
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-teal/20 text-teal">{linkedParents.length} linked</span>
                </div>
                <div className="px-4 py-3">
                  {/* Linked parents list */}
                  {linkedParents.length > 0 ? (
                    <div className="space-y-2 mb-3">
                      {linkedParents.map((p) => (
                        <div key={p.link_id} className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
                          <div className="flex items-center gap-2">
                            <User size={13} className="text-muted/50" />
                            <div>
                              <p className="text-sm text-navy font-medium">{p.first_name || ""} {p.last_name || ""}</p>
                              <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#6B7B8D" }}>{p.email}</p>
                            </div>
                          </div>
                          <button
                            onClick={async () => {
                              if (!confirm("Remove this parent's access?")) return;
                              try {
                                await api.delete(`/players/${playerId}/parents/${p.user_id}`);
                                setLinkedParents((prev) => prev.filter((lp) => lp.link_id !== p.link_id));
                                toast.success("Parent unlinked");
                              } catch {
                                toast.error("Failed to unlink parent");
                              }
                            }}
                            className="text-xs text-red-500 hover:text-red-700"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted/50 italic mb-3">No parent accounts linked. Add a parent email to give family access.</p>
                  )}
                  {/* Add parent form */}
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={parentEmail}
                      onChange={(e) => setParentEmail(e.target.value)}
                      placeholder="Parent email address"
                      className="flex-1 text-sm px-3 py-2 border border-border rounded-lg outline-none focus:border-teal/40 bg-gray-50"
                    />
                    <button
                      onClick={async () => {
                        if (!parentEmail.trim()) return;
                        setLinkingParent(true);
                        try {
                          const { data } = await api.post(`/players/${playerId}/link-parent`, { parent_email: parentEmail.trim() });
                          setLinkedParents((prev) => [...prev, {
                            link_id: data.id,
                            user_id: data.parent_id,
                            email: parentEmail.trim(),
                            first_name: data.parent_name?.split(" ")[0] || null,
                            last_name: data.parent_name?.split(" ").slice(1).join(" ") || null,
                            created_at: new Date().toISOString(),
                          }]);
                          setParentEmail("");
                          toast.success(`✓ Access granted. They can now log in and view ${player.first_name} ${player.last_name}'s Family Guide.`);
                        } catch (err: unknown) {
                          const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed to link parent";
                          toast.error(msg);
                        } finally {
                          setLinkingParent(false);
                        }
                      }}
                      disabled={linkingParent || !parentEmail.trim()}
                      className="flex items-center gap-1 px-4 py-2 text-xs font-medium bg-teal text-white rounded-lg hover:bg-teal/90 disabled:opacity-50"
                    >
                      {linkingParent ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                      Send Invite
                    </button>
                  </div>
                  <p className="text-[11px] text-muted/40 mt-2">Enter the parent&apos;s account email. They will gain Family access to this player&apos;s profile, development plan, and schedule.</p>
                </div>
              </div>
            )}
          </section>
        )}

          {/* Video Tab — Left Column */}
        {/* Video Tab */}
        {activeTab === "video" && (
          <section className="space-y-4">
            <p className="text-[11px] text-muted/70 font-oswald tracking-wider -mb-1">Video sessions, game film clips, and tagged highlights.</p>

            {/* ── Recruitment Reel Section ──────────────────────── */}
            <div style={{ background: "white", borderRadius: 14, border: "1.5px solid rgba(13,148,136,.45)", boxShadow: "0 1px 3px rgba(9,28,48,.05), 0 4px 16px rgba(9,28,48,.07)", padding: "14px 16px 16px", position: "relative" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <h3 className="text-sm font-oswald uppercase tracking-wider text-navy flex items-center gap-2 mb-0">
                  <Film size={14} className="text-teal" /> Recruitment Reels
                </h3>
                <Link
                  href={`/players/${playerId}/reels/build`}
                  className="flex items-center gap-1.5 bg-teal text-white px-3 py-1.5 rounded-lg font-oswald uppercase tracking-wider text-[11px] hover:bg-teal/90 transition-colors"
                >
                  <Film size={12} /> Build Recruitment Reel
                </Link>
              </div>
              <p className="text-xs text-muted mb-3">
                Pull clips across all sessions to build a cross-season recruitment reel.
              </p>

              {reelsLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 size={16} className="animate-spin text-teal" />
                  <span className="ml-2 text-xs text-muted">Loading reels...</span>
                </div>
              ) : playerReels.length === 0 ? (
                <div className="text-center py-4">
                  <Film size={28} className="mx-auto text-muted/20 mb-2" />
                  <p className="text-sm text-muted">No reels yet — build one above.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {playerReels.map((reel) => {
                    const clipCount = Array.isArray(reel.clip_ids) ? reel.clip_ids.length : 0;
                    return (
                      <div
                        key={reel.id}
                        className="flex items-center justify-between gap-3 py-2.5 px-3 rounded-lg border border-gray-100 hover:border-teal/20 transition-all"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-navy truncate">{reel.title}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-muted font-mono">{clipCount} clip{clipCount !== 1 ? "s" : ""}</span>
                            <span className="text-[10px] text-muted/60">{new Date(reel.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                            {reel.share_enabled ? (
                              <span className="flex items-center gap-1 text-[9px] font-oswald uppercase tracking-wider bg-teal/10 text-teal px-1.5 py-0.5 rounded">
                                <Share2 size={8} /> Shared
                              </span>
                            ) : (
                              <span className="text-[9px] font-oswald uppercase tracking-wider text-muted/40 px-1.5 py-0.5">Draft</span>
                            )}
                          </div>
                        </div>
                        <Link
                          href={`/reels/${reel.id}`}
                          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-teal/10 text-teal text-[10px] font-oswald uppercase tracking-wider rounded-lg hover:bg-teal hover:text-white transition-colors"
                        >
                          <Eye size={10} /> View
                        </Link>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={{ background: "white", borderRadius: 14, border: "1.5px solid rgba(13,148,136,.45)", boxShadow: "0 1px 3px rgba(9,28,48,.05), 0 4px 16px rgba(9,28,48,.07)", padding: "14px 16px 16px", position: "relative" }}>
              <h3 className="text-sm font-oswald uppercase tracking-wider text-navy flex items-center gap-2 mb-1">
                <Video size={14} className="text-teal" /> Game Film
              </h3>
              <p className="text-xs text-muted mb-5">
                Quick-access clips for this player&apos;s recent events.
              </p>

              {player && stats.length > 0 ? (
                <div className="flex flex-wrap gap-3">
                  {/* Last Game – All Events */}
                  <Link
                    href={`/video-sessions?player_id=${playerId}`}
                    className="px-4 py-2.5 bg-teal text-white text-sm font-oswald font-semibold uppercase tracking-wider rounded-lg hover:bg-teal/90 transition-colors flex items-center gap-2"
                  >
                    <Play size={14} /> Last Game – All Events
                  </Link>

                  {/* Last 3 Games – Shots */}
                  <Link
                    href={`/video-sessions?player_id=${playerId}&action=Shots`}
                    className="px-4 py-2.5 bg-navy/[0.06] text-navy text-sm font-oswald font-semibold uppercase tracking-wider rounded-lg hover:bg-navy/[0.1] transition-colors flex items-center gap-2"
                  >
                    <Target size={14} /> Last 3 Games – Shots
                  </Link>

                  {/* Last 3 Games – Faceoffs (C/F only) */}
                  {player.position && ["C", "F", "LW", "RW"].includes(player.position) && (
                    <Link
                      href={`/video-sessions?player_id=${playerId}&action=Faceoffs`}
                      className="px-4 py-2.5 bg-navy/[0.06] text-navy text-sm font-oswald font-semibold uppercase tracking-wider rounded-lg hover:bg-navy/[0.1] transition-colors flex items-center gap-2"
                    >
                      <Swords size={14} /> Last 3 Games – Faceoffs
                    </Link>
                  )}

                  {/* Defensive Zone Clips (D only) */}
                  {player.position === "D" && (
                    <Link
                      href={`/video-sessions?player_id=${playerId}&zone=DZ`}
                      className="px-4 py-2.5 bg-navy/[0.06] text-navy text-sm font-oswald font-semibold uppercase tracking-wider rounded-lg hover:bg-navy/[0.1] transition-colors flex items-center gap-2"
                    >
                      <Shield size={14} /> Defensive Zone Clips
                    </Link>
                  )}

                  {/* Goals Against (G only) */}
                  {player.position === "G" && (
                    <Link
                      href={`/video-sessions?player_id=${playerId}&action=Goals against`}
                      className="px-4 py-2.5 bg-navy/[0.06] text-navy text-sm font-oswald font-semibold uppercase tracking-wider rounded-lg hover:bg-navy/[0.1] transition-colors flex items-center gap-2"
                    >
                      <AlertTriangle size={14} /> Goals Against
                    </Link>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Video size={32} className="mx-auto text-muted/30 mb-2" />
                  <p className="text-sm text-muted">
                    No game film imported yet for this player.
                  </p>
                  <p className="text-xs text-muted/60 mt-1">
                    Upload a tagged game file in Game Sheets to get started.
                  </p>
                </div>
              )}
            </div>

            {/* Film Room Clips */}
            <div style={{ background: "white", borderRadius: 14, border: "1.5px solid rgba(13,148,136,.45)", boxShadow: "0 1px 3px rgba(9,28,48,.05), 0 4px 16px rgba(9,28,48,.07)", padding: "14px 16px 16px", position: "relative" }}>
              <h3 className="text-sm font-oswald uppercase tracking-wider text-navy flex items-center gap-2 mb-1">
                <Scissors size={14} className="text-teal" /> Film Room Clips
              </h3>
              <p className="text-xs text-muted mb-4">
                Clips tagged to this player in Film Room sessions.
              </p>

              {filmClipsLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 size={18} className="animate-spin text-teal" />
                  <span className="ml-2 text-xs text-muted">Loading clips...</span>
                </div>
              ) : filmClips.length === 0 ? (
                <div className="text-center py-6">
                  <Scissors size={28} className="mx-auto text-muted/20 mb-2" />
                  <p className="text-sm text-muted">No Film Room clips for this player yet.</p>
                  <p className="text-xs text-muted/60 mt-1">
                    Tag clips to this player in the Film Room to see them here.
                  </p>
                </div>
              ) : (() => {
                const fmtTime = (s: number) => {
                  const m = Math.floor(s / 60);
                  const sec = Math.floor(s % 60);
                  return `${m}:${sec.toString().padStart(2, "0")}`;
                };
                // Group clips by session_id
                const grouped: Record<string, typeof filmClips> = {};
                const noSession: typeof filmClips = [];
                filmClips.forEach((clip) => {
                  if (clip.session_id) {
                    if (!grouped[clip.session_id]) grouped[clip.session_id] = [];
                    grouped[clip.session_id].push(clip);
                  } else {
                    noSession.push(clip);
                  }
                });
                const sessionIds = Object.keys(grouped);
                return (
                  <div className="space-y-3">
                    {sessionIds.map((sid) => {
                      const firstClip = grouped[sid][0];
                      const uploadCount = firstClip?.session_upload_count || 1;
                      const sessionTitle = firstClip?.session_title || "Session";
                      return (
                        <div key={sid}>
                          {/* Session header */}
                          <div className="flex items-center gap-2 mb-1.5 px-1">
                            <span className="text-[11px] font-oswald uppercase tracking-wider text-navy/70 font-semibold truncate">{sessionTitle}</span>
                            {uploadCount > 1 && (
                              <>
                                <span className="text-[9px] font-oswald uppercase tracking-wider text-teal bg-teal/10 px-1.5 py-0.5 rounded">Full Game ({uploadCount} periods)</span>
                                <span className="text-[9px] font-mono text-muted/50">{uploadCount} videos</span>
                              </>
                            )}
                          </div>
                          <div className="space-y-2">
                            {grouped[sid].map((clip) => (
                              <div
                                key={clip.id}
                                className="flex items-center justify-between gap-3 py-2.5 px-3 rounded-lg border border-gray-100 hover:border-teal/20 transition-all"
                              >
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-navy truncate">{clip.title}</p>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className="flex items-center gap-1 text-[10px] text-teal font-mono">
                                      <Clock size={10} />
                                      {fmtTime(clip.start_time_seconds)} — {fmtTime(clip.end_time_seconds)}
                                    </span>
                                    {clip.description && (
                                      <span className="text-[10px] text-muted truncate">{clip.description}</span>
                                    )}
                                  </div>
                                </div>
                                <Link
                                  href={`/film-room/sessions/${sid}?seek=${clip.start_time_seconds}`}
                                  className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-teal/10 text-teal text-[10px] font-oswald uppercase tracking-wider rounded-lg hover:bg-teal hover:text-white transition-colors"
                                >
                                  <Play size={10} />
                                  Watch
                                </Link>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                    {/* Clips without a session */}
                    {noSession.length > 0 && (
                      <div className="space-y-2">
                        {noSession.map((clip) => (
                          <div
                            key={clip.id}
                            className="flex items-center justify-between gap-3 py-2.5 px-3 rounded-lg border border-gray-100 hover:border-teal/20 transition-all"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-navy truncate">{clip.title}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="flex items-center gap-1 text-[10px] text-teal font-mono">
                                  <Clock size={10} />
                                  {fmtTime(clip.start_time_seconds)} — {fmtTime(clip.end_time_seconds)}
                                </span>
                                {clip.description && (
                                  <span className="text-[10px] text-muted truncate">{clip.description}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </section>
        )}

          </div>

          {/* ── RIGHT COLUMN (persistent sidebar — all tabs) ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

            {/* Season Snapshot Card */}
            {(() => {
              const currentSeason = stats.filter(s => s.stat_type === "season").sort((a, b) => {
                const yearA = parseInt((a.season || "0").slice(0, 4), 10);
                const yearB = parseInt((b.season || "0").slice(0, 4), 10);
                return yearB - yearA;
              })[0];
              if (!currentSeason) return null;
              return (
                <div style={{ background: "white", borderRadius: 14, border: "1.5px solid rgba(13,148,136,.45)", boxShadow: "0 1px 3px rgba(9,28,48,.05), 0 4px 16px rgba(9,28,48,.07)", overflow: "hidden", position: "relative" }}>
                  <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, borderRadius: "14px 0 0 14px", background: "#0D9488" }} />
                  <div style={{ background: "linear-gradient(145deg, #091C30, #0F2942 60%, #1A3A5C)", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "rgba(255,255,255,.5)", fontFamily: "'DM Mono', monospace" }}>Season Snapshot</span>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, fontWeight: 500, padding: "2px 7px", borderRadius: 3, background: "rgba(13,148,136,.2)", color: "#14B8A8", textTransform: "uppercase" }}>
                      {currentSeason.season || "Current"}
                    </span>
                  </div>
                  <div style={{ padding: "14px 16px 16px" }}>
                    <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                      {[["GP", currentSeason.gp], ["G", currentSeason.g], ["A", currentSeason.a], ["PTS", currentSeason.p]].map(([l, v]) => (
                        <div key={l as string} style={{ textAlign: "center", flex: 1 }}>
                          <div style={{ fontSize: 22, fontWeight: 800, color: l === "PTS" ? "#0D9488" : "#0F2942", lineHeight: 1 }}>{v}</div>
                          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 8.5, color: "#8BA4BB", marginTop: 2, textTransform: "uppercase", letterSpacing: ".1em" }}>{l as string}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 6 }}>
                      {[
                        ["PPG", currentSeason.gp > 0 ? (currentSeason.p / currentSeason.gp).toFixed(2) : "—"],
                        ["+/-", currentSeason.plus_minus != null ? (currentSeason.plus_minus >= 0 ? `+${currentSeason.plus_minus}` : `${currentSeason.plus_minus}`) : "—"],
                        ["PIM", currentSeason.pim],
                        ["SH%", currentSeason.shooting_pct != null ? `${currentSeason.shooting_pct.toFixed(1)}%` : (currentSeason.sog > 0 ? `${((currentSeason.g / currentSeason.sog) * 100).toFixed(1)}%` : "—")],
                        ["SOG", currentSeason.sog > 0 ? currentSeason.sog : "—"],
                      ].map(([l, v]) => (
                        <div key={l as string} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                          <div style={{ fontSize: 14, fontWeight: 800, color: "#0F2942" }}>{v}</div>
                          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 8, color: "#8BA4BB", textTransform: "uppercase", letterSpacing: ".07em" }}>{l as string}</div>
                        </div>
                      ))}
                    </div>
                    {trendlineData && (
                      <>
                        <div style={{ height: 1, background: "#EEF3F8", margin: "12px 0" }} />
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9.5, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "#5A7291", marginBottom: 8, display: "flex", alignItems: "center", gap: 7 }}>
                          <span style={{ width: 6, height: 6, borderRadius: 2, background: "#0D9488", flexShrink: 0 }} />
                          Points Per Game Trend
                        </div>
                        <TrendlineChart data={trendlineData} />
                      </>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Quick Actions Card */}
            {!FAMILY_ROLES.has(userRole) && (
              <div style={{ background: "white", borderRadius: 14, border: "1.5px solid rgba(234,88,12,.45)", boxShadow: "0 1px 3px rgba(9,28,48,.05), 0 4px 16px rgba(9,28,48,.07)", overflow: "hidden", position: "relative" }}>
                <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, borderRadius: "14px 0 0 14px", background: "#EA580C" }} />
                <div style={{ background: "linear-gradient(145deg, #091C30, #0F2942 60%, #1A3A5C)", padding: "12px 16px" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "rgba(255,255,255,.5)", fontFamily: "'DM Mono', monospace" }}>Quick Actions</span>
                </div>
                <div style={{ padding: "14px 16px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
                  <Link href={`/reports/generate?player=${playerId}&type=pro_skater`} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700, background: "#0D9488", color: "white", border: "1.5px solid #0D9488", textDecoration: "none", fontFamily: "'DM Sans', sans-serif", width: "100%", justifyContent: "center" }}>
                    <Sparkles size={12} /> Generate PXI Report
                  </Link>
                  <Link href="/watchlist" style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700, background: "white", color: "#0F2942", border: "1.5px solid #DDE6EF", textDecoration: "none", fontFamily: "'DM Sans', sans-serif", width: "100%", justifyContent: "center" }}>
                    <ListPlus size={12} /> Add to Tracking
                  </Link>
                  <Link href={`/players/${playerId}/card`} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700, background: "white", color: "#0F2942", border: "1.5px solid #DDE6EF", textDecoration: "none", fontFamily: "'DM Sans', sans-serif", width: "100%", justifyContent: "center" }}>
                    <Eye size={12} /> Player Card
                  </Link>
                  <Link href={`/reports/custom?player=${playerId}`} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700, background: "white", color: "#EA580C", border: "1.5px solid rgba(234,88,12,.25)", textDecoration: "none", fontFamily: "'DM Sans', sans-serif", width: "100%", justifyContent: "center" }}>
                    <Wand2 size={12} /> Custom Report
                  </Link>
                </div>
              </div>
            )}

            {/* Physical Profile Card */}
            <div style={{ background: "white", borderRadius: 14, border: "1.5px solid rgba(13,148,136,.45)", boxShadow: "0 1px 3px rgba(9,28,48,.05), 0 4px 16px rgba(9,28,48,.07)", overflow: "hidden", position: "relative" }}>
              <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, borderRadius: "14px 0 0 14px", background: "#0D9488" }} />
              <div style={{ background: "linear-gradient(145deg, #091C30, #0F2942 60%, #1A3A5C)", padding: "12px 16px" }}>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "rgba(255,255,255,.5)", fontFamily: "'DM Mono', monospace" }}>Physical Profile</span>
              </div>
              <div style={{ padding: "14px 16px 16px" }}>
                {[
                  ["Height / Weight", `${player.height_cm ? `${player.height_cm} cm` : "—"} · ${player.weight_kg ? `${player.weight_kg} kg` : "—"}`],
                  ["Handedness", player.shoots ? `${player.shoots}-shot` : "—"],
                  ["Status", player.roster_status === "inj" ? "Injured" : player.roster_status === "susp" ? "Suspended" : "Healthy"],
                  ["Commitment", player.commitment_status || "Uncommitted"],
                  ["Birth Year", player.birth_year ? `${player.birth_year}` : "—"],
                ].map(([label, value]) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: "1px solid #EEF3F8" }}>
                    <span style={{ fontSize: 10, color: "#5A7291", fontFamily: "'DM Mono', monospace", letterSpacing: ".04em", textTransform: "uppercase" }}>{label}</span>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: label === "Status" ? "#0D9488" : "#0F2942" }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Data Sources Card */}
            <div style={{ background: "white", borderRadius: 14, border: "1.5px solid rgba(13,148,136,.45)", boxShadow: "0 1px 3px rgba(9,28,48,.05), 0 4px 16px rgba(9,28,48,.07)", overflow: "hidden", position: "relative" }}>
              <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, borderRadius: "14px 0 0 14px", background: "#0D9488" }} />
              <div style={{ padding: "12px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9.5, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "#5A7291", display: "flex", alignItems: "center", gap: 7 }}>
                    <span style={{ width: 6, height: 6, borderRadius: 2, background: "#0D9488", flexShrink: 0 }} />
                    Data Sources
                  </div>
                </div>
                <div style={{ height: 1, background: "#EEF3F8", margin: "8px 0" }} />
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                  {Boolean((player as unknown as Record<string, unknown>)["hockeytech_id"]) && (
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9.5, fontWeight: 500, padding: "3px 9px", borderRadius: 3, background: "rgba(13,148,136,.09)", color: "#0D9488", border: "1px solid rgba(13,148,136,.18)" }}>League Linked</span>
                  )}
                  {player.current_league && (
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9.5, fontWeight: 500, padding: "3px 9px", borderRadius: 3, background: "rgba(90,114,145,.08)", color: "#5A7291", border: "1px solid rgba(90,114,145,.15)" }}>{formatLeague(player.current_league)}</span>
                  )}
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9.5, fontWeight: 500, padding: "3px 9px", borderRadius: 3, background: "rgba(90,114,145,.08)", color: "#5A7291", border: "1px solid rgba(90,114,145,.15)" }}>Manual Entry</span>
                </div>
              </div>
            </div>

            {/* Training Volume Widget — shown on Dev Plan tab */}
            {activeTab === "player" && drillLogData && drillLogData.summary.total_season > 0 && (
              <section className="print:hidden" style={{ background: "white", borderRadius: 14, border: "1.5px solid rgba(13,148,136,.45)", boxShadow: "0 1px 3px rgba(9,28,48,.05), 0 4px 16px rgba(9,28,48,.07)", padding: "12px 16px 14px" }}>
                <h3 className="text-xs font-oswald uppercase tracking-wider text-muted mb-3">Training Volume</h3>
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center p-3 bg-teal/5 rounded-lg">
                    <p className="text-lg font-bold text-navy">{drillLogData.summary.this_week}</p>
                    <p className="text-[10px] font-oswald uppercase tracking-wider text-muted">This Week</p>
                  </div>
                  <div className="text-center p-3 bg-teal/5 rounded-lg">
                    <p className="text-lg font-bold text-navy">{drillLogData.summary.this_month}</p>
                    <p className="text-[10px] font-oswald uppercase tracking-wider text-muted">This Month</p>
                  </div>
                  <div className="text-center p-3 bg-teal/5 rounded-lg">
                    <p className="text-lg font-bold text-navy">{drillLogData.summary.total_season}</p>
                    <p className="text-[10px] font-oswald uppercase tracking-wider text-muted">Season Total</p>
                  </div>
                </div>
                {drillLogData.logs.length > 0 && (
                  <div className="mt-3 space-y-1">
                    <p className="text-[10px] font-oswald uppercase tracking-wider text-muted">Recent Drills</p>
                    {drillLogData.logs.slice(0, 5).map((log) => (
                      <div key={log.id} className="flex items-center justify-between text-xs py-1">
                        <span className="text-navy truncate">{log.drill_name}</span>
                        <span className="text-muted shrink-0 ml-2">{new Date(log.logged_at).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

          </div>

        </div>

        {/* Print Footer */}
        <div className="print-footer mt-8 pt-4 border-t border-navy/10 justify-center items-center gap-2 text-xs text-muted">
          <div className="text-center">
            <p className="font-oswald text-navy text-sm">ProspectX Intelligence</p>
            <p>Exported {new Date().toLocaleDateString()}</p>
          </div>
        </div>

        {/* Transfer Modal */}
        {showTransferModal && player && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center no-print" onClick={() => setShowTransferModal(false)}>
            <div className="bg-white rounded-xl border border-border shadow-xl w-full max-w-md mx-4 p-6" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-oswald uppercase tracking-wider text-navy mb-1">Change Team</h3>
              <p className="text-xs text-muted mb-4">
                Transfer <span className="font-semibold">{player.first_name} {player.last_name}</span> from{" "}
                <span className="font-semibold">{player.current_team || "no team"}</span>
              </p>

              {/* League */}
              <div className="mb-3">
                <label className="text-[10px] font-oswald uppercase tracking-wider text-muted">New League</label>
                {transferCustomLeague ? (
                  <div className="flex gap-1">
                    <input
                      type="text"
                      value={transferLeague}
                      onChange={(e) => setTransferLeague(e.target.value)}
                      placeholder="Enter league name"
                      className="flex-1 border border-border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-teal/30"
                    />
                    <button type="button" onClick={() => { setTransferCustomLeague(false); setTransferLeague(player.current_league || ""); }} className="text-[10px] text-teal hover:underline px-1 shrink-0">List</button>
                  </div>
                ) : (
                  <select
                    value={transferLeague}
                    onChange={(e) => {
                      if (e.target.value === "__custom__") {
                        setTransferCustomLeague(true);
                        setTransferLeague("");
                        setTransferCustomTeam(true);
                        setTransferTeam("");
                      } else {
                        setTransferLeague(e.target.value);
                        setTransferTeam("");
                        setTransferCustomTeam(false);
                      }
                    }}
                    className="w-full border border-border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-teal/30"
                  >
                    <option value="">Select league...</option>
                    {editLeagues.map((lg) => (
                      <option key={lg.id} value={lg.name}>{lg.name}</option>
                    ))}
                    <option value="__custom__">Custom...</option>
                  </select>
                )}
              </div>

              {/* Team */}
              <div className="mb-3">
                <label className="text-[10px] font-oswald uppercase tracking-wider text-muted">New Team</label>
                {transferCustomTeam ? (
                  <div className="flex gap-1">
                    <input
                      type="text"
                      value={transferTeam}
                      onChange={(e) => setTransferTeam(e.target.value)}
                      placeholder="Enter team name"
                      className="flex-1 border border-border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-teal/30"
                    />
                    {!transferCustomLeague && (
                      <button type="button" onClick={() => { setTransferCustomTeam(false); setTransferTeam(""); }} className="text-[10px] text-teal hover:underline px-1 shrink-0">List</button>
                    )}
                  </div>
                ) : (
                  <select
                    value={transferTeam}
                    onChange={(e) => {
                      if (e.target.value === "__custom__") {
                        setTransferCustomTeam(true);
                        setTransferTeam("");
                      } else {
                        setTransferTeam(e.target.value);
                      }
                    }}
                    className="w-full border border-border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-teal/30"
                  >
                    <option value="">Select team...</option>
                    {filteredTransferTeams.map((t) => (
                      <option key={t.id} value={t.name}>{t.name}{t.city ? ` (${t.city})` : ""}</option>
                    ))}
                    <option value="__custom__">Custom...</option>
                  </select>
                )}
              </div>

              {/* Note */}
              <div className="mb-4">
                <label className="text-[10px] font-oswald uppercase tracking-wider text-muted">Note (optional)</label>
                <input
                  type="text"
                  value={transferNote}
                  onChange={(e) => setTransferNote(e.target.value)}
                  placeholder="e.g. Mid-season trade, called up from Jr. B"
                  className="w-full border border-border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-teal/30"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => setShowTransferModal(false)}
                  className="flex-1 py-2 border border-border rounded text-sm font-oswald uppercase tracking-wider text-muted hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleTransfer}
                  disabled={submittingTransfer || !transferTeam.trim()}
                  className="flex-1 py-2 bg-teal text-white rounded text-sm font-oswald uppercase tracking-wider hover:bg-teal/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                >
                  {submittingTransfer ? <><Loader2 size={14} className="animate-spin" /> Transferring...</> : <><ArrowRightLeft size={14} /> Transfer</>}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </ProtectedRoute>
  );
}

// ── ProspectX Quick Indices ────────────────────────────────
// Simple performance indices calculated from available season stats.
// These give scouts a fast snapshot before diving into full reports.
function QuickMetrics({ stats, position }: { stats: PlayerStats[]; position: string }) {
  const season = stats
    .filter((s) => s.stat_type === "season")
    .sort((a, b) => parseInt((b.season || "0").slice(0, 4), 10) - parseInt((a.season || "0").slice(0, 4), 10))[0] || stats[0];

  if (!season) return null;

  const gp = season.gp || 1;
  const ppg = season.p / gp;
  const gpg = season.g / gp;
  const shootPct = season.shooting_pct ?? (season.sog > 0 ? (season.g / season.sog) * 100 : null);
  const pimPerGame = season.pim / gp;
  const pmPerGame = season.plus_minus / gp;

  const offenseIndex = Math.min(99, Math.round(
    (ppg / 1.5) * 40 + ((shootPct ?? 10) / 20) * 30 + (gpg / 0.6) * 30
  ));
  const twoWayIndex = Math.min(99, Math.round(
    Math.max(0, 50 + pmPerGame * 10) + Math.max(0, 30 - pimPerGame * 5) + (ppg / 1.0) * 20
  ));

  const ARC_R = 36;
  const CIRCUMFERENCE = 2 * Math.PI * ARC_R;

  const tiles: { key: string; label: string; arcVal: number; display: string; color: string; IconComp: typeof Zap }[] = [
    { key: "ppg", label: "PPG", arcVal: Math.min(99, Math.round((ppg / 1.5) * 99)), display: (ppg ?? 0).toFixed(2), color: "#18B3A6", IconComp: Zap },
    { key: "gpg", label: "GPG", arcVal: Math.min(99, Math.round((gpg / 0.6) * 99)), display: (gpg ?? 0).toFixed(2), color: "#ef4444", IconComp: Target },
    { key: "shot", label: "SHOT", arcVal: shootPct !== null ? Math.min(99, Math.round((shootPct / 20) * 99)) : 0, display: shootPct !== null ? `${shootPct.toFixed(0)}%` : "—", color: "#3b82f6", IconComp: Activity },
    { key: "off", label: "OFF", arcVal: offenseIndex, display: `${offenseIndex}`, color: "#F36F21", IconComp: Flame },
    { key: "2way", label: "2WAY", arcVal: twoWayIndex, display: `${twoWayIndex}`, color: "#0F2A3D", IconComp: Shield },
  ];

  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        {tiles.map(({ key, label, arcVal, display, color, IconComp }) => {
          const dashOffset = CIRCUMFERENCE * (1 - arcVal / 99);
          return (
            <div
              key={key}
              className="relative flex flex-col items-center py-2.5 px-1 rounded-lg bg-navy/[0.02] border border-navy/[0.06]"
            >
              <div className="relative w-[76px] h-[76px]">
                <svg width="76" height="76" viewBox="0 0 80 80" className="transform -rotate-90">
                  <circle cx="40" cy="40" r={ARC_R} fill="none" stroke={color} strokeWidth="5" opacity={0.08} />
                  <circle
                    cx="40" cy="40" r={ARC_R} fill="none" stroke={color} strokeWidth="5"
                    strokeLinecap="round"
                    strokeDasharray={CIRCUMFERENCE}
                    strokeDashoffset={dashOffset}
                    style={{ transition: "stroke-dashoffset 0.8s ease-out" }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <IconComp size={12} style={{ color }} className="mb-0.5" />
                  <span className="text-lg font-oswald font-bold leading-none tabular-nums" style={{ color }}>
                    {display}
                  </span>
                </div>
              </div>
              <span className="text-[9px] font-oswald uppercase tracking-widest text-muted mt-1">{label}</span>
            </div>
          );
        })}
        {/* 6th tile: PXI placeholder */}
        <div className="relative flex flex-col items-center justify-center py-2.5 px-1 rounded-lg border border-dashed border-teal/20 bg-teal/[0.02]">
          <div className="relative w-[76px] h-[76px] flex items-center justify-center">
            <Sparkles size={18} className="text-teal/30" />
          </div>
          <span className="text-[9px] font-oswald uppercase tracking-widest text-teal/40 mt-1">PXI</span>
          <span className="text-[7px] text-muted/40 mt-0.5">Run AI Analysis</span>
        </div>
      </div>
      <div className="flex items-center justify-between pt-2 mt-2 border-t border-teal/8">
        <p className="text-[9px] text-muted/50">
          Based on {season.gp} GP {season.season ? `(${season.season})` : ""} · Stat-derived estimates
        </p>
        <span className="text-[8px] text-muted/30 font-oswald uppercase tracking-widest">ProspectX</span>
      </div>
    </div>
  );
}

// ── Metrics Radar Chart ──────────────────────────────────────
const RADAR_LABEL_MAP: Record<string, string> = {
  sniper: "Sniper",
  playmaker: "Playmaker",
  transition: "Transition",
  defensive: "Defensive",
  compete: "Compete",
  hockey_iq: "Hockey IQ",
};

function MetricsRadarChart({ indices }: { indices: PlayerMetrics }) {
  const metricOrder = ["sniper", "playmaker", "transition", "defensive", "compete", "hockey_iq"] as const;
  const data = metricOrder.map((key) => ({
    axis: RADAR_LABEL_MAP[key],
    value: indices.indices[key]?.value ?? 0,
    fullMark: 99,
  }));

  return (
    <div className="h-[200px] mb-3">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="75%" data={data}>
          <PolarGrid stroke="#e5e7eb" strokeWidth={0.5} />
          <PolarAngleAxis
            dataKey="axis"
            tick={{ fontSize: 10, fill: "#6b7280", fontFamily: "Oswald, sans-serif" }}
            tickLine={false}
          />
          <Radar
            dataKey="value"
            stroke={METRIC_COLORS.transition}
            fill={METRIC_COLORS.transition}
            fillOpacity={0.2}
            strokeWidth={2}
            dot={{ r: 3, fill: METRIC_COLORS.transition }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── ProspectX Metrics Panel (6 proprietary indices — premium arc tile grid) ──
function ProspectXMetricsPanel({ indices }: { indices: PlayerMetrics }) {
  const metricOrder = ["sniper", "playmaker", "transition", "defensive", "compete", "hockey_iq"] as const;
  const ARC_R = 36;
  const CIRCUMFERENCE = 2 * Math.PI * ARC_R;
  const ABBREV: Record<string, string> = {
    sniper: "SNP", playmaker: "PLY", transition: "TRN",
    defensive: "DEF", compete: "CMP", hockey_iq: "IQ",
  };

  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        {metricOrder.map((key) => {
          const idx = indices.indices[key];
          if (!idx) return null;
          const color = METRIC_COLORS[key] || "#9ca3af";
          const icon = METRIC_ICONS[key] || "";
          const pctLabel = idx.percentile >= 90 ? "Elite" :
            idx.percentile >= 75 ? "Above Avg" :
            idx.percentile >= 50 ? "Average" :
            idx.percentile >= 25 ? "Below Avg" : "Developing";
          const dashOffset = CIRCUMFERENCE * (1 - idx.value / 99);

          const bgOpacity = Math.max(0.02, (idx.value / 99) * 0.08);

          return (
            <div
              key={key}
              className="relative flex flex-col items-center py-2.5 px-1 rounded-lg border border-navy/[0.06] hover:border-teal/20 transition-all duration-300"
              style={{ backgroundColor: color + Math.round(bgOpacity * 255).toString(16).padStart(2, "0") }}
              title={idx.description}
            >
              <div className="relative w-[76px] h-[76px]">
                <svg width="76" height="76" viewBox="0 0 80 80" className="transform -rotate-90">
                  <circle cx="40" cy="40" r={ARC_R} fill="none" stroke={color} strokeWidth="5" opacity={0.08} />
                  <circle
                    cx="40" cy="40" r={ARC_R} fill="none" stroke={color} strokeWidth="5"
                    strokeLinecap="round"
                    strokeDasharray={CIRCUMFERENCE}
                    strokeDashoffset={dashOffset}
                    style={{ transition: "stroke-dashoffset 0.8s ease-out" }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xs leading-none mb-0.5">{icon}</span>
                  <span
                    className="text-xl font-oswald font-bold leading-none tabular-nums"
                    style={{ color }}
                  >
                    {idx.value}
                  </span>
                </div>
              </div>
              <span className="text-[9px] font-oswald uppercase tracking-widest text-muted mt-1">
                {ABBREV[key] || idx.label}
              </span>
              <span
                className="text-[7px] font-medium px-1.5 py-0.5 rounded-full mt-0.5"
                style={{ backgroundColor: color + "12", color }}
              >
                {pctLabel} · P{idx.percentile}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between pt-2 mt-2 border-t border-teal/8">
        <p className="text-[9px] text-muted/50">
          Based on {indices.gp} GP {indices.season ? `(${indices.season})` : ""}
          {indices.has_extended_stats && (
            <span className="ml-1 text-teal/60">+ Extended Analytics</span>
          )}
        </p>
        <span className="text-[8px] text-muted/30 font-oswald uppercase tracking-widest">
          ProspectX
        </span>
      </div>
    </div>
  );
}
