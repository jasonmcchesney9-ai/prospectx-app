"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Briefcase,
  FileText,
  TrendingUp,
  ChevronDown,
  MapPin,
  Calendar,
  Star,
  Zap,
  Target,
  BookOpen,
  Clock,
  ExternalLink,
  X,
} from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import api from "@/lib/api";
import HockeyRink from "@/components/HockeyRink";
import type { AgentClient, AgentPackData, AgentClientStatus, Report } from "@/types/api";
import { AGENT_CLIENT_STATUS_COLORS, REPORT_TYPE_LABELS } from "@/types/api";

// ── Age helper ───────────────────────────────────────────────
function calcAge(dob: string | null | undefined): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

// ══════════════════════════════════════════════════════════════
// Page wrapper
// ══════════════════════════════════════════════════════════════

export default function ClientDetailPage() {
  return (
    <ProtectedRoute>
      <NavBar />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ClientDetail />
      </main>
    </ProtectedRoute>
  );
}

// ══════════════════════════════════════════════════════════════
// Main Detail Component
// ══════════════════════════════════════════════════════════════

function ClientDetail() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.id as string;

  const [client, setClient] = useState<AgentClient | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Status update
  const [statusSaving, setStatusSaving] = useState(false);

  // Pathway notes
  const [notes, setNotes] = useState("");
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);

  // Agent Pack
  const [agentPack, setAgentPack] = useState<AgentPackData | null>(null);
  const [generatingPack, setGeneratingPack] = useState(false);
  const [packError, setPackError] = useState("");

  // ── Fetch client detail ───────────────────────────────────
  const fetchDetail = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get<AgentClient>(`/agent/clients/${clientId}/detail`);
      setClient(data);
      setNotes(data.pathway_notes || "");
    } catch {
      setError("Failed to load client details");
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  // ── Update status ─────────────────────────────────────────
  const handleStatusChange = async (newStatus: AgentClientStatus) => {
    if (!client) return;
    setStatusSaving(true);
    try {
      const { data } = await api.put<AgentClient>(`/agent/clients/${clientId}`, {
        status: newStatus,
      });
      setClient((prev) => (prev ? { ...prev, status: data.status } : prev));
    } catch {
      setError("Failed to update status");
    } finally {
      setStatusSaving(false);
    }
  };

  // ── Save pathway notes on blur ────────────────────────────
  const handleNotesSave = async () => {
    if (!client || notes === (client.pathway_notes || "")) return;
    setNotesSaving(true);
    setNotesSaved(false);
    try {
      await api.put(`/agent/clients/${clientId}`, {
        pathway_notes: notes,
      });
      setClient((prev) => (prev ? { ...prev, pathway_notes: notes } : prev));
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 2000);
    } catch {
      setError("Failed to save pathway notes");
    } finally {
      setNotesSaving(false);
    }
  };

  // ── Generate Agent Pack ───────────────────────────────────
  const handleGeneratePack = async () => {
    if (!client) return;
    setGeneratingPack(true);
    setPackError("");
    try {
      const { data } = await api.post<AgentPackData>("/agent/generate-pack", {
        player_id: client.player_id,
      });
      setAgentPack(data);
    } catch {
      setPackError("Failed to generate agent pack. Please try again.");
    } finally {
      setGeneratingPack(false);
    }
  };

  // ── Loading state ─────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <HockeyRink size="card" />
        <p className="text-muted text-sm mt-3 font-oswald uppercase tracking-wider">
          Loading client details...
        </p>
      </div>
    );
  }

  // ── Error state ───────────────────────────────────────────
  if (error && !client) {
    return (
      <div>
        <button
          onClick={() => router.push("/my-clients")}
          className="flex items-center gap-2 text-sm text-muted hover:text-navy transition-colors mb-6"
        >
          <ArrowLeft size={16} />
          Back to Clients
        </button>
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!client) return null;

  const player = client.player;
  const age = calcAge(player?.dob);
  const statusConfig = AGENT_CLIENT_STATUS_COLORS[client.status] || AGENT_CLIENT_STATUS_COLORS.active;
  const reports = client.reports || [];

  const statusOptions: AgentClientStatus[] = ["active", "committed", "unsigned", "inactive"];

  return (
    <div>
      {/* ── Back button ──────────────────────────────────────── */}
      <button
        onClick={() => router.push("/my-clients")}
        className="flex items-center gap-2 text-sm text-muted hover:text-navy transition-colors mb-6"
      >
        <ArrowLeft size={16} />
        Back to Clients
      </button>

      {/* ── Error banner ─────────────────────────────────────── */}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-2">
          <p className="text-red-700 text-sm">{error}</p>
          <button
            onClick={() => setError("")}
            className="ml-auto text-red-400 hover:text-red-600"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════ */}
      {/* Player Profile Header                                */}
      {/* ══════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-xl border border-teal/20 p-6 mb-6">
        <div className="flex flex-col sm:flex-row items-start gap-4">
          {/* Player info */}
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-navy font-oswald uppercase tracking-wider">
              {player
                ? `${player.first_name} ${player.last_name}`
                : `Client #${client.id.slice(0, 8)}`}
            </h1>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              {player?.current_team && (
                <span className="text-sm text-muted flex items-center gap-1">
                  <MapPin size={12} />
                  {player.current_team}
                </span>
              )}
              {player?.current_league && (
                <span className="text-xs text-muted/60">{player.current_league}</span>
              )}
              {player?.position && (
                <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-muted font-medium">
                  {player.position}
                </span>
              )}
              {age !== null && (
                <span className="text-xs text-muted/60 flex items-center gap-1">
                  <Calendar size={10} />
                  Age {age}
                </span>
              )}
              {player?.shoots && (
                <span className="text-xs text-muted/60">
                  Shoots {player.shoots}
                </span>
              )}
            </div>

            {/* Quick stats from player data */}
            {player && (
              <div className="flex items-center gap-4 mt-3">
                {player.archetype && (
                  <span className="text-xs px-2 py-0.5 rounded bg-teal/10 text-teal font-medium">
                    {player.archetype}
                  </span>
                )}
                {player.commitment_status && (
                  <span className="text-xs text-muted/60">
                    {player.commitment_status}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Status selector + View profile link */}
          <div className="flex flex-col items-end gap-3 shrink-0">
            {/* Status dropdown */}
            <div className="relative">
              <label className="block text-[10px] font-oswald uppercase tracking-wider text-muted mb-1 text-right">
                Status
              </label>
              <div className="relative">
                <select
                  value={client.status}
                  onChange={(e) => handleStatusChange(e.target.value as AgentClientStatus)}
                  disabled={statusSaving}
                  className={`appearance-none text-sm font-oswald font-bold uppercase tracking-wider px-3 py-1.5 pr-8 rounded-lg cursor-pointer border-0 focus:outline-none focus:ring-2 focus:ring-teal/30 disabled:opacity-50 ${statusConfig.bg} ${statusConfig.text}`}
                >
                  {statusOptions.map((s) => (
                    <option key={s} value={s}>
                      {AGENT_CLIENT_STATUS_COLORS[s].label}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={12}
                  className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-60"
                />
              </div>
            </div>

            {/* View full player profile */}
            {player && (
              <Link
                href={`/players/${player.id}`}
                className="inline-flex items-center gap-1 text-xs text-teal hover:text-teal/70 font-oswald uppercase tracking-wider transition-colors"
              >
                <ExternalLink size={12} />
                View Full Profile
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════ */}
      {/* Pathway Notes                                        */}
      {/* ══════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-xl border border-teal/20 p-6 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-oswald font-bold text-navy uppercase tracking-wider flex items-center gap-2">
            <BookOpen size={16} className="text-teal" />
            Pathway Notes
          </h2>
          <div className="flex items-center gap-2">
            {notesSaving && (
              <span className="text-[10px] text-muted font-oswald uppercase tracking-wider animate-pulse">
                Saving...
              </span>
            )}
            {notesSaved && (
              <span className="text-[10px] text-green-600 font-oswald uppercase tracking-wider">
                Saved
              </span>
            )}
          </div>
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={handleNotesSave}
          rows={4}
          placeholder="Track pathway planning, development notes, target programs, and next steps for this client..."
          className="w-full border border-teal/20 rounded-lg px-4 py-3 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-teal/30 resize-y"
        />
      </div>

      {/* ══════════════════════════════════════════════════════ */}
      {/* Reports Section                                      */}
      {/* ══════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-xl border border-teal/20 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-oswald font-bold text-navy uppercase tracking-wider flex items-center gap-2">
            <FileText size={16} className="text-orange" />
            Reports
            {reports.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange/10 text-orange">
                {reports.length}
              </span>
            )}
          </h2>
          <button
            onClick={() =>
              router.push(
                `/reports/generate?player_id=${client.player_id}&report_type=agent_pack`
              )
            }
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs text-white bg-teal rounded-lg font-oswald uppercase tracking-wider hover:bg-teal/90 transition-colors"
          >
            <FileText size={12} />
            New Report
          </button>
        </div>

        {reports.length === 0 ? (
          <div className="py-6 text-center bg-gray-50 rounded-lg">
            <FileText size={28} className="mx-auto text-muted mb-2" />
            <p className="text-sm text-muted">
              No reports generated for this player yet.
            </p>
            <p className="text-xs text-muted/60 mt-1">
              Generate an Agent Pack or Development Roadmap to get started.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {reports.map((report: Report) => (
              <Link
                key={report.id}
                href={`/reports/${report.id}`}
                className="flex items-center justify-between px-4 py-3 rounded-lg border border-teal/20 hover:border-teal/30 hover:bg-gray-50 transition-all"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-orange/10 flex items-center justify-center shrink-0">
                    <FileText size={14} className="text-orange" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-navy truncate">
                      {report.title ||
                        REPORT_TYPE_LABELS[report.report_type] ||
                        report.report_type}
                    </p>
                    <p className="text-[10px] text-muted/60">
                      {report.generated_at
                        ? new Date(report.generated_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        : new Date(report.created_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                      report.status === "complete"
                        ? "bg-green-100 text-green-700"
                        : report.status === "processing"
                        ? "bg-yellow-100 text-yellow-700"
                        : report.status === "failed"
                        ? "bg-red-100 text-red-700"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {report.status}
                  </span>
                  {report.quality_score !== null && report.quality_score !== undefined && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal/10 text-teal font-medium">
                      Q: {report.quality_score}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════ */}
      {/* Agent Pack Generator                                 */}
      {/* ══════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-xl border border-teal/20 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-oswald font-bold text-navy uppercase tracking-wider flex items-center gap-2">
            <Briefcase size={16} className="text-[#475569]" />
            Agent Pack
          </h2>
          <button
            onClick={handleGeneratePack}
            disabled={generatingPack}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#475569] to-[#475569]/80 text-white font-oswald font-semibold uppercase tracking-wider text-xs rounded-lg hover:shadow-md transition-shadow disabled:opacity-50"
          >
            {generatingPack ? (
              <>
                <span className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent inline-block" />
                Generating...
              </>
            ) : (
              <>
                <Zap size={14} />
                Generate Agent Pack
              </>
            )}
          </button>
        </div>

        {/* Pack error */}
        {packError && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-red-700 text-xs">
            {packError}
          </div>
        )}

        {/* Generating state */}
        {generatingPack && !agentPack && (
          <div className="flex flex-col items-center justify-center py-10">
            <HockeyRink size="card" />
            <p className="text-muted text-xs mt-3 font-oswald uppercase tracking-wider">
              Generating intelligence-grade agent pack...
            </p>
          </div>
        )}

        {/* Agent Pack display */}
        {agentPack && (
          <div className="space-y-4">
            {/* Player Summary */}
            <div className="bg-navy/[0.03] rounded-lg p-4">
              <h3 className="text-xs font-oswald font-bold text-navy uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Star size={12} className="text-teal" />
                Player Summary
              </h3>
              <p className="text-sm text-navy/80 leading-relaxed">
                {agentPack.player_summary}
              </p>
            </div>

            {/* Strengths */}
            {agentPack.strengths && agentPack.strengths.length > 0 && (
              <div className="bg-navy/[0.03] rounded-lg p-4">
                <h3 className="text-xs font-oswald font-bold text-navy uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <TrendingUp size={12} className="text-teal" />
                  Key Strengths
                </h3>
                <ul className="space-y-1.5">
                  {agentPack.strengths.map((s, i) => (
                    <li key={i} className="text-sm text-navy/80 flex items-start gap-2">
                      <span className="text-teal mt-0.5 shrink-0">-</span>
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Pathway Assessment */}
            <div className="bg-navy/[0.03] rounded-lg p-4">
              <h3 className="text-xs font-oswald font-bold text-navy uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Target size={12} className="text-orange" />
                Pathway Assessment
              </h3>
              <p className="text-sm text-navy/80 leading-relaxed">
                {agentPack.pathway_assessment}
              </p>
            </div>

            {/* 90-Day Plan */}
            {agentPack.ninety_day_plan && agentPack.ninety_day_plan.length > 0 && (
              <div className="bg-navy/[0.03] rounded-lg p-4">
                <h3 className="text-xs font-oswald font-bold text-navy uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Clock size={12} className="text-orange" />
                  90-Day Plan
                </h3>
                <ol className="space-y-1.5">
                  {agentPack.ninety_day_plan.map((step, i) => (
                    <li key={i} className="text-sm text-navy/80 flex items-start gap-2">
                      <span className="text-orange font-oswald font-bold text-xs mt-0.5 shrink-0">
                        {i + 1}.
                      </span>
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Target Programs */}
            {agentPack.target_programs && agentPack.target_programs.length > 0 && (
              <div className="bg-navy/[0.03] rounded-lg p-4">
                <h3 className="text-xs font-oswald font-bold text-navy uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Target size={12} className="text-teal" />
                  Target Programs
                </h3>
                <div className="flex flex-wrap gap-2">
                  {agentPack.target_programs.map((prog, i) => (
                    <span
                      key={i}
                      className="text-xs px-2.5 py-1 rounded-full bg-teal/10 text-teal font-medium"
                    >
                      {prog}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Generated timestamp */}
            {agentPack.generated_at && (
              <p className="text-[10px] text-muted/50 text-right">
                Generated{" "}
                {new Date(agentPack.generated_at).toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </p>
            )}
          </div>
        )}

        {/* Empty state for agent pack */}
        {!agentPack && !generatingPack && (
          <div className="py-6 text-center bg-gray-50 rounded-lg">
            <Briefcase size={28} className="mx-auto text-muted mb-2" />
            <p className="text-sm text-muted">
              No agent pack generated yet.
            </p>
            <p className="text-xs text-muted/60 mt-1">
              Click &quot;Generate Agent Pack&quot; to create a comprehensive player package
              with summary, strengths, pathway assessment, and target programs.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
