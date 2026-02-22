"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  User,
  Activity,
  Brain,
  TrendingUp,
  Shield,
  Star,
  Heart,
  AlertTriangle,
  Printer,
  RefreshCw,
  Loader2,
  Target,
  Crosshair,
  Zap,
  Users,
  ChevronDown,
  ChevronUp,
  FileText,
  Edit3,
  Save,
  X,
  ExternalLink,
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
import TrendlineChart from "@/components/TrendlineChart";
import api, { assetUrl, hasRealImage } from "@/lib/api";
import type {
  PlayerCardData_V1,
  TrendlineResponse,
  RoleTag,
} from "@/types/api";

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

  return (
    <ProtectedRoute>
      <NavBar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 print:px-2 print:py-2">
        {/* ── Header bar ── */}
        <div className="flex items-center justify-between mb-5 print:hidden">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="text-muted hover:text-navy transition-colors">
              <ArrowLeft size={18} />
            </button>
            <h1 className="text-xl font-bold text-navy font-oswald uppercase tracking-wider">
              Player Card
            </h1>
            {league_context && (
              <span className="text-xs text-muted">
                {league_context.league} &middot; {league_context.season}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/players/${playerId}`}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-navy border border-teal/20 rounded-lg hover:bg-navy/[0.03] transition-colors"
            >
              <User size={13} />
              Full Profile
            </Link>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-navy border border-teal/20 rounded-lg hover:bg-navy/[0.03] transition-colors"
            >
              <Printer size={13} />
              Print
            </button>
          </div>
        </div>

        {/* ── 3-Column Grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 print:grid-cols-12 print:gap-2">

          {/* ════════ LEFT COLUMN — Identity (3 cols) ════════ */}
          <div className="lg:col-span-3 print:col-span-3 space-y-3">

            {/* Player photo + name */}
            <div className="bg-white rounded-xl border border-teal/20 p-4 text-center">
              {hasRealImage(id.image_url) ? (
                <img
                  src={assetUrl(id.image_url)}
                  alt={`${id.first_name} ${id.last_name}`}
                  className="w-24 h-24 rounded-full mx-auto mb-3 object-cover border-2 border-teal/20"
                />
              ) : (
                <div className="w-24 h-24 rounded-full mx-auto mb-3 bg-navy/[0.06] flex items-center justify-center">
                  <User size={36} className="text-muted/40" />
                </div>
              )}
              {id.jersey_number && (
                <span className="text-[10px] font-oswald uppercase tracking-wider text-muted">#{id.jersey_number}</span>
              )}
              <h2 className="text-lg font-bold text-navy font-oswald uppercase tracking-wider leading-tight">
                {id.first_name} {id.last_name}
              </h2>
              <p className="text-xs text-muted mt-0.5">{fullPos} {id.shoots ? `• ${id.shoots}` : ""}</p>
              {id.current_team && (
                <p className="text-xs text-navy/70 mt-1">{id.current_team}</p>
              )}
              {id.current_league && (
                <p className="text-[10px] text-muted">{id.current_league}</p>
              )}
            </div>

            {/* Bio details */}
            <div className="bg-white rounded-xl border border-teal/20 p-4 space-y-2">
              <h3 className="text-[10px] font-oswald uppercase tracking-wider text-muted mb-2">Details</h3>
              {id.dob && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted">DOB</span>
                  <span className="text-navy">{id.dob}{id.birth_year ? ` (${new Date().getFullYear() - id.birth_year}y)` : ""}</span>
                </div>
              )}
              {id.height_cm && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted">Height</span>
                  <span className="text-navy">{id.height_cm} cm</span>
                </div>
              )}
              {id.weight_kg && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted">Weight</span>
                  <span className="text-navy">{id.weight_kg} kg</span>
                </div>
              )}
              {id.commitment_status && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted">Commitment</span>
                  <span className="text-navy capitalize">{id.commitment_status.replace(/_/g, " ")}</span>
                </div>
              )}
              {id.elite_prospects_url && (
                <a
                  href={id.elite_prospects_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-teal hover:underline mt-1"
                >
                  <ExternalLink size={11} />
                  Elite Prospects
                </a>
              )}
            </div>

            {/* Health status */}
            <div className="bg-white rounded-xl border border-teal/20 p-4">
              <h3 className="text-[10px] font-oswald uppercase tracking-wider text-muted mb-2">Status</h3>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-oswald uppercase tracking-wider font-bold ${healthStyle.bg} ${healthStyle.text}`}>
                <Heart size={10} />
                {healthStyle.label}
              </span>
            </div>

            {/* Role tags */}
            {roleTags.length > 0 && (
              <div className="bg-white rounded-xl border border-teal/20 p-4">
                <h3 className="text-[10px] font-oswald uppercase tracking-wider text-muted mb-2">Role Tags</h3>
                <div className="flex flex-wrap gap-1.5">
                  {roleTags.map((tag, i) => {
                    const tc = ROLE_TAG_COLORS[tag.type] || ROLE_TAG_COLORS.status;
                    return (
                      <span key={i} className={`inline-flex px-2 py-0.5 rounded text-[10px] font-oswald uppercase tracking-wider font-bold ${tc.bg} ${tc.text}`}>
                        {tag.label}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Intelligence radar */}
            {radarData.length >= 3 && (
              <div className="bg-white rounded-xl border border-teal/20 p-4">
                <h3 className="text-[10px] font-oswald uppercase tracking-wider text-muted mb-2">Grade Profile</h3>
                {intel?.archetype ? (
                  <p className="text-xs text-teal font-semibold mb-2">{String(intel.archetype)}</p>
                ) : null}
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="72%">
                      <PolarGrid stroke="#E5E7EB" />
                      <PolarAngleAxis dataKey="subject" tick={{ fontSize: 9, fill: "#6B7280" }} />
                      <Radar
                        dataKey="value"
                        stroke="#18B3A6"
                        fill="#18B3A6"
                        fillOpacity={0.2}
                        strokeWidth={2}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
                {intel?.overall_grade != null && (
                  <div className="text-center mt-1">
                    <span className="text-lg font-bold text-navy">{String(intel.overall_grade)}</span>
                    <span className="text-[10px] text-muted ml-1">/ 10</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ════════ CENTER COLUMN — Performance (5 cols) ════════ */}
          <div className="lg:col-span-5 print:col-span-5 space-y-3">

            {/* Current season stats */}
            <div className="bg-white rounded-xl border border-teal/20 p-4">
              <h3 className="text-[10px] font-oswald uppercase tracking-wider text-muted mb-3">
                <Activity size={11} className="inline mr-1" />
                Season Stats
              </h3>
              {perf.current_stats ? (
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {Object.entries(perf.current_stats).map(([key, val]) => (
                    <div key={key} className="text-center">
                      <p className="text-[9px] font-oswald uppercase tracking-wider text-muted">{key.toUpperCase()}</p>
                      <p className="text-sm font-bold text-navy">
                        {typeof val === "number" ? (Number.isInteger(val) ? val : val.toFixed(1)) : val}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted">No stats available.</p>
              )}
            </div>

            {/* Trendline */}
            <div className="bg-white rounded-xl border border-teal/20 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[10px] font-oswald uppercase tracking-wider text-muted">
                  <TrendingUp size={11} className="inline mr-1" />
                  Trendline
                </h3>
                <select
                  value={trendMetric}
                  onChange={(e) => setTrendMetric(e.target.value)}
                  className="text-[10px] px-2 py-1 border border-teal/20 rounded text-navy bg-white print:hidden"
                >
                  {TRENDLINE_METRICS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
              {loadingTrend ? (
                <div className="flex justify-center py-6">
                  <Loader2 size={18} className="animate-spin text-muted" />
                </div>
              ) : trendData ? (
                <TrendlineChart data={trendData} />
              ) : (
                <p className="text-xs text-muted text-center py-6">No trendline data.</p>
              )}
            </div>

            {/* Game log */}
            <div className="bg-white rounded-xl border border-teal/20 p-4">
              <h3 className="text-[10px] font-oswald uppercase tracking-wider text-muted mb-3">
                <FileText size={11} className="inline mr-1" />
                Recent Games
              </h3>
              {perf.game_log && perf.game_log.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-teal/20 bg-navy/[0.03]">
                        <th className="text-left px-2 py-1.5 text-[9px] font-oswald uppercase tracking-wider text-muted">Date</th>
                        <th className="text-left px-2 py-1.5 text-[9px] font-oswald uppercase tracking-wider text-muted">Opp</th>
                        <th className="text-right px-2 py-1.5 text-[9px] font-oswald uppercase tracking-wider text-muted">G</th>
                        <th className="text-right px-2 py-1.5 text-[9px] font-oswald uppercase tracking-wider text-muted">A</th>
                        <th className="text-right px-2 py-1.5 text-[9px] font-oswald uppercase tracking-wider text-muted">P</th>
                        <th className="text-right px-2 py-1.5 text-[9px] font-oswald uppercase tracking-wider text-muted">SOG</th>
                        <th className="text-right px-2 py-1.5 text-[9px] font-oswald uppercase tracking-wider text-muted">+/-</th>
                      </tr>
                    </thead>
                    <tbody>
                      {perf.game_log.map((g, i) => (
                        <tr key={i} className="border-b border-teal/10 hover:bg-navy/[0.02]">
                          <td className="px-2 py-1.5 text-muted">{String(g.date || g.game_date || "—")}</td>
                          <td className="px-2 py-1.5 text-navy">{String(g.opponent || "—")}</td>
                          <td className="px-2 py-1.5 text-right">{String(g.g ?? g.goals ?? "—")}</td>
                          <td className="px-2 py-1.5 text-right">{String(g.a ?? g.assists ?? "—")}</td>
                          <td className="px-2 py-1.5 text-right font-semibold text-navy">{String(g.p ?? g.points ?? "—")}</td>
                          <td className="px-2 py-1.5 text-right">{String(g.sog ?? g.shots ?? "—")}</td>
                          <td className="px-2 py-1.5 text-right">{String(g.plus_minus ?? "—")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-muted">No game log available.</p>
              )}
            </div>

            {/* Event aggregates (InStat data) */}
            {perf.event_aggregates && perf.event_aggregates.has_event_data && (
              <div className="bg-white rounded-xl border border-teal/20 p-4">
                <h3 className="text-[10px] font-oswald uppercase tracking-wider text-muted mb-3">
                  <Crosshair size={11} className="inline mr-1" />
                  Event Intelligence
                </h3>
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
                <p className="text-[9px] text-muted mt-2">
                  {perf.event_aggregates.total_events} events across {perf.event_aggregates.games_with_events} games
                </p>
              </div>
            )}

            {/* Situation splits */}
            {perf.situation_splits && Object.keys(perf.situation_splits).length > 0 && (
              <div className="bg-white rounded-xl border border-teal/20 p-4">
                <h3 className="text-[10px] font-oswald uppercase tracking-wider text-muted mb-3">
                  <Shield size={11} className="inline mr-1" />
                  Situation Splits
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {Object.entries(perf.situation_splits).map(([sit, agg]) => (
                    <div key={sit} className="bg-navy/[0.03] rounded-lg p-3">
                      <p className="text-[9px] font-oswald uppercase tracking-wider text-teal mb-1.5">{sit}</p>
                      <div className="space-y-1 text-[10px]">
                        {agg.zone_entries_total > 0 && <p className="text-navy">Entry: {agg.zone_entry_pct.toFixed(0)}%</p>}
                        {agg.shot_attempts > 0 && <p className="text-navy">Shots: {agg.shot_attempts}</p>}
                        {agg.xg_for > 0 && <p className="text-navy">xG: {agg.xg_for.toFixed(2)}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ════════ RIGHT COLUMN — Development (4 cols) ════════ */}
          <div className="lg:col-span-4 print:col-span-4 space-y-3">

            {/* Skill profile */}
            <div className="bg-white rounded-xl border border-teal/20 p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[10px] font-oswald uppercase tracking-wider text-muted">
                  <Brain size={11} className="inline mr-1" />
                  Skill Profile
                </h3>
                <button
                  onClick={handleGenerateProfile}
                  disabled={generatingProfile}
                  className="flex items-center gap-1 text-[10px] text-teal hover:underline disabled:opacity-50 print:hidden"
                >
                  {generatingProfile ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
                  {generatingProfile ? "Generating..." : "Generate"}
                </button>
              </div>

              {/* PXI version */}
              {dev.skill_profile.pxi_version ? (
                <div className="mb-3">
                  <p className="text-[9px] font-oswald uppercase tracking-wider text-teal mb-1">PXI Assessment</p>
                  <p className="text-xs text-navy/80 leading-relaxed whitespace-pre-line">{dev.skill_profile.pxi_version}</p>
                </div>
              ) : (
                <p className="text-xs text-muted mb-3">No PXI profile yet. Click Generate to create one.</p>
              )}

              {/* Coach version */}
              <div>
                <div className="flex items-center justify-between">
                  <p className="text-[9px] font-oswald uppercase tracking-wider text-orange mb-1">Coach Notes</p>
                  {!editingCoachProfile && (
                    <button
                      onClick={() => {
                        setCoachProfileDraft(dev.skill_profile.coach_version || "");
                        setEditingCoachProfile(true);
                      }}
                      className="text-muted hover:text-navy print:hidden"
                    >
                      <Edit3 size={11} />
                    </button>
                  )}
                </div>
                {editingCoachProfile ? (
                  <div className="space-y-2 print:hidden">
                    <textarea
                      value={coachProfileDraft}
                      onChange={(e) => setCoachProfileDraft(e.target.value)}
                      rows={4}
                      className="w-full text-xs border border-teal/20 rounded-lg p-2 resize-none"
                      placeholder="Add coach assessment..."
                    />
                    <div className="flex gap-2">
                      <button onClick={handleSaveCoachProfile} className="flex items-center gap-1 px-2 py-1 bg-teal text-white text-[10px] rounded hover:bg-teal/90">
                        <Save size={10} /> Save
                      </button>
                      <button onClick={() => setEditingCoachProfile(false)} className="flex items-center gap-1 px-2 py-1 text-muted text-[10px] rounded hover:bg-gray-100">
                        <X size={10} /> Cancel
                      </button>
                    </div>
                  </div>
                ) : dev.skill_profile.coach_version ? (
                  <p className="text-xs text-navy/80 leading-relaxed whitespace-pre-line">{dev.skill_profile.coach_version}</p>
                ) : (
                  <p className="text-xs text-muted">No coach notes yet.</p>
                )}
              </div>

              {dev.skill_profile.updated_at && (
                <p className="text-[9px] text-muted mt-2">
                  Updated {new Date(dev.skill_profile.updated_at).toLocaleDateString()}
                </p>
              )}
            </div>

            {/* Active objectives */}
            <div className="bg-white rounded-xl border border-teal/20 p-4">
              <button
                onClick={() => setShowObjectives(!showObjectives)}
                className="flex items-center justify-between w-full text-left print:pointer-events-none"
              >
                <h3 className="text-[10px] font-oswald uppercase tracking-wider text-muted">
                  <Target size={11} className="inline mr-1" />
                  Development Objectives
                </h3>
                {showObjectives ? <ChevronUp size={12} className="text-muted print:hidden" /> : <ChevronDown size={12} className="text-muted print:hidden" />}
              </button>
              {showObjectives && (
                <div className="mt-3 space-y-2">
                  {dev.active_objectives.length > 0 ? (
                    dev.active_objectives.map((obj) => (
                      <div key={obj.id} className="bg-navy/[0.03] rounded-lg p-3">
                        <p className="text-xs font-semibold text-navy mb-1">{obj.title}</p>
                        <div className="flex flex-wrap gap-1 mb-1.5">
                          {obj.skill_focus.map((sf) => (
                            <span key={sf} className="inline-flex px-1.5 py-0.5 rounded text-[9px] font-oswald uppercase tracking-wider bg-teal/10 text-teal">
                              {sf}
                            </span>
                          ))}
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-muted">
                          <span>{obj.drill_log_count} drills logged</span>
                          {obj.last_drilled_at && (
                            <span>Last: {new Date(obj.last_drilled_at).toLocaleDateString()}</span>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-muted">No active objectives.</p>
                  )}
                </div>
              )}
            </div>

            {/* Intelligence details */}
            {intel && (
              <div className="bg-white rounded-xl border border-teal/20 p-4">
                <h3 className="text-[10px] font-oswald uppercase tracking-wider text-muted mb-3">
                  <Zap size={11} className="inline mr-1" />
                  Intelligence Summary
                </h3>

                {/* Strengths */}
                {intel.strengths ? (
                  <div className="mb-3">
                    <p className="text-[9px] font-oswald uppercase tracking-wider text-green-600 mb-1">Strengths</p>
                    <div className="flex flex-wrap gap-1">
                      {(Array.isArray(intel.strengths) ? intel.strengths : tryParseJson(intel.strengths)).map((s: string, i: number) => (
                        <span key={i} className="inline-flex px-2 py-0.5 rounded text-[10px] bg-green-50 text-green-700">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                {/* Development areas */}
                {intel.development_areas ? (
                  <div className="mb-3">
                    <p className="text-[9px] font-oswald uppercase tracking-wider text-orange mb-1">Development Areas</p>
                    <div className="flex flex-wrap gap-1">
                      {(Array.isArray(intel.development_areas) ? intel.development_areas : tryParseJson(intel.development_areas)).map((s: string, i: number) => (
                        <span key={i} className="inline-flex px-2 py-0.5 rounded text-[10px] bg-orange/10 text-orange">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                {/* Stat signature */}
                {intel.stat_signature ? (
                  <div>
                    <p className="text-[9px] font-oswald uppercase tracking-wider text-navy/60 mb-1">Stat Signature</p>
                    <p className="text-xs text-navy/80 leading-relaxed">{String(intel.stat_signature)}</p>
                  </div>
                ) : null}
              </div>
            )}

            {/* Recent scout notes */}
            <div className="bg-white rounded-xl border border-teal/20 p-4">
              <button
                onClick={() => setShowNotes(!showNotes)}
                className="flex items-center justify-between w-full text-left print:pointer-events-none"
              >
                <h3 className="text-[10px] font-oswald uppercase tracking-wider text-muted">
                  <FileText size={11} className="inline mr-1" />
                  Recent Scout Notes
                </h3>
                {showNotes ? <ChevronUp size={12} className="text-muted print:hidden" /> : <ChevronDown size={12} className="text-muted print:hidden" />}
              </button>
              {showNotes && (
                <div className="mt-3 space-y-2">
                  {dev.recent_notes.length > 0 ? (
                    dev.recent_notes.map((note) => (
                      <div key={note.id} className="bg-navy/[0.03] rounded-lg p-3">
                        <p className="text-xs text-navy/80 leading-relaxed mb-1.5">{note.note_text}</p>
                        <div className="flex items-center gap-2">
                          {note.tags.map((t) => (
                            <span key={t} className="inline-flex px-1.5 py-0.5 rounded text-[9px] font-oswald uppercase tracking-wider bg-navy/[0.06] text-navy/60">
                              {t}
                            </span>
                          ))}
                          <span className="text-[9px] text-muted ml-auto">
                            {new Date(note.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-muted">No recent notes.</p>
                  )}
                </div>
              )}
            </div>

            {/* Quick actions */}
            <div className="bg-white rounded-xl border border-teal/20 p-4 print:hidden">
              <h3 className="text-[10px] font-oswald uppercase tracking-wider text-muted mb-3">Quick Actions</h3>
              <div className="space-y-2">
                <Link
                  href={`/reports/generate?player_id=${playerId}`}
                  className="flex items-center gap-2 w-full px-3 py-2 text-xs text-navy border border-teal/20 rounded-lg hover:bg-navy/[0.03] transition-colors"
                >
                  <FileText size={13} />
                  Generate Report
                </Link>
                <Link
                  href={`/players/${playerId}?tab=notes`}
                  className="flex items-center gap-2 w-full px-3 py-2 text-xs text-navy border border-teal/20 rounded-lg hover:bg-navy/[0.03] transition-colors"
                >
                  <Edit3 size={13} />
                  Add Scout Note
                </Link>
              </div>
            </div>
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
