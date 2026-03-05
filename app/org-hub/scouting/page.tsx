"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Eye,
  Plus,
  Loader2,
  GripVertical,
  Search,
  XIcon,
  User,
  Calendar,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Ban,
  FileText,
  Sparkles,
} from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import api from "@/lib/api";
import { useBenchTalk } from "@/components/BenchTalkProvider";
import { getUser } from "@/lib/auth";
import MicButton from "@/components/MicButton";

/* ── Types ────────────────────────────────────────────────── */
interface Assignment {
  id: string;
  scout_user_id: string | null;
  scout_name: string;
  team_to_scout: string | null;
  league: string | null;
  game_date: string | null;
  venue: string | null;
  priority: string;
  status: string;
  notes: string | null;
  report_submitted: boolean;
  report_id: string | null;
  created_at: string;
}

interface ScoutWorkload {
  scout_id: string;
  scout_name: string;
  total: number;
  completed: number;
  pending: number;
  reports_this_month: number;
  overdue: number;
  health: "on_track" | "overloaded" | "behind";
}

interface PipelineData {
  assignments: Record<string, Assignment[]>;
  workload: ScoutWorkload[];
  total_assignments: number;
}

interface OrgUser {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  hockey_role: string;
}

/* ── Constants ────────────────────────────────────────────── */
const MONO = "ui-monospace, monospace";

const COLUMNS = [
  { key: "assigned", label: "Assigned", icon: Clock, color: "#3B82F6", bg: "rgba(59,130,246,0.10)" },
  { key: "in_progress", label: "In Progress", icon: AlertTriangle, color: "#F59E0B", bg: "rgba(245,158,11,0.10)" },
  { key: "completed", label: "Completed", icon: CheckCircle2, color: "#10B981", bg: "rgba(16,185,129,0.10)" },
  { key: "canceled", label: "Canceled", icon: Ban, color: "#6B7280", bg: "rgba(107,114,128,0.10)" },
] as const;

const PRIORITY_CFG: Record<string, { label: string; color: string; bg: string }> = {
  high: { label: "HIGH", color: "#EF4444", bg: "rgba(239,68,68,0.12)" },
  normal: { label: "NORMAL", color: "#0D9488", bg: "rgba(13,148,136,0.12)" },
  low: { label: "LOW", color: "#6B7280", bg: "rgba(107,114,128,0.12)" },
};

const HEALTH_CFG: Record<string, { label: string; color: string; bg: string }> = {
  on_track: { label: "On Track", color: "#10B981", bg: "rgba(16,185,129,0.12)" },
  overloaded: { label: "Heavy Load", color: "#F59E0B", bg: "rgba(245,158,11,0.12)" },
  behind: { label: "Behind", color: "#EF4444", bg: "rgba(239,68,68,0.12)" },
};

function fmtDate(d: string | null): string {
  if (!d) return "TBD";
  try {
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return d;
  }
}

/* ── Component ────────────────────────────────────────────── */
export default function ScoutingPipeline() {
  const [data, setData] = useState<PipelineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);

  // New assignment form
  const [formScout, setFormScout] = useState("");
  const [formTeam, setFormTeam] = useState("");
  const [formLeague, setFormLeague] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formVenue, setFormVenue] = useState("");
  const [formPriority, setFormPriority] = useState("normal");
  const [formNotes, setFormNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Team autocomplete
  const [teamSuggestions, setTeamSuggestions] = useState<string[]>([]);
  const [showTeamDropdown, setShowTeamDropdown] = useState(false);
  const teamRef = useRef<HTMLDivElement>(null);

  // Org scouts list
  const [orgScouts, setOrgScouts] = useState<OrgUser[]>([]);

  // Drag state
  const [dragId, setDragId] = useState<string | null>(null);

  const user = getUser();
  const { openBenchTalk } = useBenchTalk();

  const fetchPipeline = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/org-hub/scouting-pipeline");
      setData(res.data);
    } catch {
      setError("Failed to load scouting pipeline.");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchScouts = useCallback(async () => {
    try {
      const res = await api.get("/org/users");
      const scouts = (res.data || []).filter((u: OrgUser) => u.hockey_role === "scout");
      setOrgScouts(scouts);
    } catch {
      // Fallback: workload scouts from pipeline data
    }
  }, []);

  useEffect(() => {
    fetchPipeline();
    fetchScouts();
  }, [fetchPipeline, fetchScouts]);

  /* ── Team autocomplete ─────────────────────────────────── */
  const searchTeams = useCallback(async (q: string) => {
    if (q.length < 2) { setTeamSuggestions([]); return; }
    try {
      const res = await api.get(`/teams?search=${encodeURIComponent(q)}&limit=8`);
      const names = (res.data || []).map((t: { name: string }) => t.name);
      setTeamSuggestions(names);
      setShowTeamDropdown(names.length > 0);
    } catch {
      setTeamSuggestions([]);
    }
  }, []);

  /* ── Create assignment ─────────────────────────────────── */
  const handleCreate = async () => {
    if (!formTeam.trim()) return;
    setSubmitting(true);
    try {
      await api.post("/org-hub/scouting-pipeline/assign", {
        scout_user_id: formScout || null,
        team_to_scout: formTeam,
        league: formLeague || null,
        game_date: formDate || null,
        venue: formVenue || null,
        priority: formPriority,
        notes: formNotes || null,
      });
      setShowModal(false);
      resetForm();
      await fetchPipeline();
    } catch {
      // silent
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormScout(""); setFormTeam(""); setFormLeague(""); setFormDate("");
    setFormVenue(""); setFormPriority("normal"); setFormNotes("");
  };

  /* ── Drag between columns ──────────────────────────────── */
  const handleDragStart = (id: string) => setDragId(id);

  const handleColumnDrop = async (targetStatus: string) => {
    if (!dragId) return;
    setDragId(null);
    try {
      await api.patch(`/org-hub/scouting-pipeline/${dragId}`, { status: targetStatus });
      await fetchPipeline();
    } catch {
      // silent
    }
  };

  /* ── Delete assignment ─────────────────────────────────── */
  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/org-hub/scouting-pipeline/${id}`);
      await fetchPipeline();
    } catch {
      // silent
    }
  };

  /* ── Derive scouts from workload if orgScouts empty ──── */
  const scoutOptions = orgScouts.length > 0
    ? orgScouts.map((s) => ({ id: s.id, name: `${s.first_name || ""} ${s.last_name || ""}`.trim() || s.email }))
    : (data?.workload || []).map((w) => ({ id: w.scout_id, name: w.scout_name }));

  return (
    <ProtectedRoute>
      <NavBar />
      <main className="min-h-screen" style={{ background: "#F0F4F8" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

          {/* ── Header ──────────────────────────────────────── */}
          <div
            className="flex items-center justify-between mb-6"
            style={{ borderRadius: 12, border: "1.5px solid #DDE6EF", background: "#0F2942", padding: "16px 20px" }}
          >
            <div className="flex items-center gap-3">
              <Link href="/org-hub" className="hover:opacity-70 transition-opacity" style={{ color: "rgba(255,255,255,0.6)" }}>
                <ArrowLeft size={20} />
              </Link>
              <span className="w-2 h-2 rounded-full" style={{ background: "#F97316" }} />
              <Eye size={16} className="text-white/80" />
              <h1
                className="font-bold uppercase text-white"
                style={{ fontSize: 14, fontFamily: MONO, letterSpacing: 2 }}
              >
                Scouting Pipeline
              </h1>
            </div>
            <div className="flex items-center gap-3">
              {user && (
                <span
                  className="px-2.5 py-1 rounded-md text-white/60 font-bold uppercase hidden sm:block"
                  style={{ fontSize: 9, fontFamily: MONO, letterSpacing: 1, background: "rgba(255,255,255,0.1)" }}
                >
                  {user.org_name || "My Org"}
                </span>
              )}
              <button
                onClick={() => openBenchTalk("Analyse my current scouting pipeline. What are my coverage gaps? Which upcoming games should I prioritize? Suggest scout assignments to maximize coverage.")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold uppercase transition-colors hover:opacity-90"
                style={{ fontSize: 10, fontFamily: MONO, letterSpacing: 1, color: "#FFFFFF", background: "rgba(13,148,136,0.8)", border: "1px solid rgba(255,255,255,0.15)" }}
                title="PXI Scout Priorities — analyse coverage gaps and priorities"
              >
                <Sparkles size={11} />
                PXI Priorities
              </button>
              <button
                onClick={() => setShowModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white font-bold uppercase transition-colors hover:opacity-90"
                style={{ fontSize: 10, fontFamily: MONO, letterSpacing: 1, background: "#0D9488" }}
              >
                <Plus size={12} />
                New Assignment
              </button>
            </div>
          </div>

          {/* ── Loading / Error ──────────────────────────────── */}
          {loading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={28} className="animate-spin" style={{ color: "#0D9488" }} />
            </div>
          )}
          {error && (
            <div className="text-center py-12">
              <p className="text-sm" style={{ color: "#EF4444" }}>{error}</p>
              <button onClick={fetchPipeline} className="mt-3 text-xs underline" style={{ color: "#0D9488" }}>Retry</button>
            </div>
          )}

          {!loading && !error && data && (
            <>
              {/* ── Section 1: Scout Workload ────────────────── */}
              {data.workload.length > 0 && (
                <div className="mb-6">
                  <div
                    className="flex items-center gap-2 px-4 py-2.5 mb-3"
                    style={{ borderRadius: "12px 12px 0 0", background: "#0F2942" }}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ background: "#F97316" }} />
                    <span className="font-bold uppercase text-white" style={{ fontSize: 10, fontFamily: MONO, letterSpacing: 2 }}>
                      Scout Workload
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {data.workload.map((w) => {
                      const hcfg = HEALTH_CFG[w.health] || HEALTH_CFG.on_track;
                      return (
                        <div
                          key={w.scout_id}
                          className="px-4 py-3"
                          style={{ borderRadius: 12, border: "1.5px solid #DDE6EF", background: "#FFFFFF" }}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <User size={13} style={{ color: "#5A7291" }} />
                            <span className="font-bold text-xs truncate" style={{ color: "#0F2942" }}>{w.scout_name}</span>
                          </div>
                          <div className="flex items-center gap-2 mb-1.5">
                            <span
                              className="px-1.5 py-0.5 rounded-full font-bold uppercase"
                              style={{ fontSize: 8, fontFamily: MONO, letterSpacing: 0.5, color: hcfg.color, background: hcfg.bg }}
                            >
                              {hcfg.label}
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-1 text-center">
                            {[
                              { label: "Total", val: w.total },
                              { label: "Done", val: w.completed },
                              { label: "Pending", val: w.pending },
                            ].map((s) => (
                              <div key={s.label}>
                                <div className="font-bold" style={{ fontSize: 16, fontFamily: MONO, color: "#0F2942" }}>{s.val}</div>
                                <div className="font-bold uppercase" style={{ fontSize: 7, fontFamily: MONO, letterSpacing: 1, color: "#8BA4BB" }}>{s.label}</div>
                              </div>
                            ))}
                          </div>
                          {w.overdue > 0 && (
                            <div className="mt-2 text-center">
                              <span className="font-bold uppercase" style={{ fontSize: 8, fontFamily: MONO, color: "#EF4444" }}>
                                {w.overdue} overdue
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── Section 2: Assignments Board ────────────── */}
              <div className="mb-6">
                <div
                  className="flex items-center gap-2 px-4 py-2.5 mb-3"
                  style={{ borderRadius: "12px 12px 0 0", background: "#0F2942" }}
                >
                  <span className="w-2 h-2 rounded-full" style={{ background: "#14B8A6" }} />
                  <span className="font-bold uppercase text-white" style={{ fontSize: 10, fontFamily: MONO, letterSpacing: 2 }}>
                    Assignments Board
                  </span>
                  <span className="ml-auto text-white/40 font-bold uppercase" style={{ fontSize: 9, fontFamily: MONO, letterSpacing: 1 }}>
                    {data.total_assignments} total
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {COLUMNS.map((col) => {
                    const Icon = col.icon;
                    const items = data.assignments[col.key] || [];
                    return (
                      <div
                        key={col.key}
                        className="flex flex-col"
                        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
                        onDrop={() => handleColumnDrop(col.key)}
                        style={{ minHeight: 200 }}
                      >
                        {/* Column header */}
                        <div
                          className="flex items-center gap-2 px-3 py-2 mb-2"
                          style={{ borderRadius: 8, background: col.bg }}
                        >
                          <Icon size={13} style={{ color: col.color }} />
                          <span className="font-bold uppercase" style={{ fontSize: 9, fontFamily: MONO, letterSpacing: 1.5, color: col.color }}>
                            {col.label}
                          </span>
                          <span
                            className="ml-auto px-1.5 py-0.5 rounded font-bold"
                            style={{ fontSize: 10, fontFamily: MONO, color: col.color, background: "rgba(255,255,255,0.6)" }}
                          >
                            {items.length}
                          </span>
                        </div>

                        {/* Cards */}
                        <div className="flex flex-col gap-2 flex-1">
                          {items.length === 0 && (
                            <div className="py-6 text-center" style={{ borderRadius: 8, border: "1px dashed #DDE6EF" }}>
                              <span className="text-xs" style={{ color: "#CCD6E0" }}>No assignments</span>
                            </div>
                          )}
                          {items.map((a) => {
                            const pcfg = PRIORITY_CFG[a.priority] || PRIORITY_CFG.normal;
                            return (
                              <div
                                key={a.id}
                                draggable
                                onDragStart={() => handleDragStart(a.id)}
                                className="group cursor-grab active:cursor-grabbing"
                                style={{ borderRadius: 10, border: "1.5px solid #DDE6EF", background: "#FFFFFF", overflow: "hidden" }}
                              >
                                <div className="px-3 py-2.5">
                                  {/* Top row */}
                                  <div className="flex items-start justify-between mb-1.5">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <GripVertical size={12} style={{ color: "#CCD6E0" }} className="shrink-0" />
                                      {a.team_to_scout ? (
                                        <Link href={`/teams/${encodeURIComponent(a.team_to_scout)}`} className="font-bold text-xs truncate hover:text-teal transition-colors" style={{ color: "#0F2942" }}>
                                          {a.team_to_scout}
                                        </Link>
                                      ) : (
                                        <span className="font-bold text-xs" style={{ color: "#0F2942" }}>TBD</span>
                                      )}
                                    </div>
                                    <span
                                      className="shrink-0 px-1.5 py-0.5 rounded font-bold uppercase"
                                      style={{ fontSize: 7, fontFamily: MONO, letterSpacing: 0.5, color: pcfg.color, background: pcfg.bg }}
                                    >
                                      {pcfg.label}
                                    </span>
                                  </div>

                                  {/* Details */}
                                  {a.league && (
                                    <span className="text-xs block mb-0.5" style={{ color: "#5A7291" }}>{a.league}</span>
                                  )}
                                  <div className="flex items-center gap-3 mb-1.5">
                                    {a.game_date && (
                                      <span className="flex items-center gap-1 text-xs" style={{ color: "#5A7291" }}>
                                        <Calendar size={10} /> {fmtDate(a.game_date)}
                                      </span>
                                    )}
                                    {a.venue && (
                                      <span className="flex items-center gap-1 text-xs truncate" style={{ color: "#8BA4BB" }}>
                                        <MapPin size={10} /> {a.venue}
                                      </span>
                                    )}
                                  </div>

                                  {/* Scout */}
                                  <div className="flex items-center gap-1 mb-1">
                                    <User size={10} style={{ color: "#8BA4BB" }} />
                                    <span className="text-xs font-medium" style={{ color: "#5A7291" }}>{a.scout_name}</span>
                                  </div>

                                  {/* Notes */}
                                  {a.notes && (
                                    <p className="text-xs truncate" style={{ color: "#8BA4BB" }}>{a.notes}</p>
                                  )}

                                  {/* Report link + delete */}
                                  <div className="flex items-center justify-between mt-2">
                                    {a.report_submitted && a.report_id ? (
                                      <Link
                                        href={`/reports/${a.report_id}`}
                                        className="flex items-center gap-1 text-xs font-bold uppercase hover:underline"
                                        style={{ fontSize: 8, fontFamily: MONO, letterSpacing: 0.5, color: "#0D9488" }}
                                      >
                                        <FileText size={10} /> View Report
                                      </Link>
                                    ) : a.report_submitted ? (
                                      <span className="flex items-center gap-1 text-xs" style={{ fontSize: 8, fontFamily: MONO, color: "#10B981" }}>
                                        <CheckCircle2 size={10} /> Report Filed
                                      </span>
                                    ) : (
                                      <span />
                                    )}
                                    <button
                                      onClick={() => handleDelete(a.id)}
                                      className="opacity-0 group-hover:opacity-100 transition-opacity text-xs hover:underline"
                                      style={{ color: "#EF4444", fontSize: 9, fontFamily: MONO }}
                                    >
                                      Remove
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── Section 3: Coverage Gaps (empty state) ──── */}
              <div
                className="overflow-hidden"
                style={{ borderRadius: 12, border: "1.5px solid #DDE6EF" }}
              >
                <div className="flex items-center gap-2 px-5 py-3" style={{ background: "#0F2942" }}>
                  <span className="w-2 h-2 rounded-full" style={{ background: "#EF4444" }} />
                  <span className="font-bold uppercase text-white" style={{ fontSize: 10, fontFamily: MONO, letterSpacing: 2 }}>
                    Upcoming Coverage Gaps
                  </span>
                  <span className="ml-auto text-white/40 font-bold uppercase" style={{ fontSize: 9, fontFamily: MONO, letterSpacing: 1 }}>
                    Next 7 Days
                  </span>
                </div>
                <div className="bg-white px-5 py-8 text-center">
                  <Calendar size={24} style={{ color: "#DDE6EF" }} className="mx-auto mb-2" />
                  <p className="text-xs" style={{ color: "#8BA4BB" }}>
                    Coverage gap detection requires synced game schedules. Use the Assignments Board above to track all scouting coverage.
                  </p>
                </div>
              </div>
            </>
          )}

          {/* ── New Assignment Modal ─────────────────────── */}
          {showModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
              <div
                className="mx-4 w-full max-w-lg"
                style={{ borderRadius: 12, border: "1.5px solid #DDE6EF", background: "#FFFFFF", overflow: "hidden" }}
              >
                {/* Modal header */}
                <div className="flex items-center justify-between px-5 py-3" style={{ background: "#0F2942" }}>
                  <div className="flex items-center gap-2">
                    <Plus size={14} className="text-white/80" />
                    <span className="font-bold uppercase text-white" style={{ fontSize: 11, fontFamily: MONO, letterSpacing: 2 }}>
                      New Assignment
                    </span>
                  </div>
                  <button onClick={() => { setShowModal(false); resetForm(); }} className="text-white/40 hover:text-white">
                    <XIcon size={16} />
                  </button>
                </div>

                {/* Form */}
                <div className="px-5 py-4 space-y-3">
                  {/* Scout selector */}
                  <div>
                    <label className="block font-bold uppercase mb-1" style={{ fontSize: 9, fontFamily: MONO, letterSpacing: 1.5, color: "#5A7291" }}>
                      Assign Scout
                    </label>
                    <select
                      value={formScout}
                      onChange={(e) => setFormScout(e.target.value)}
                      className="w-full px-3 py-2 rounded-md text-xs"
                      style={{ border: "1px solid #DDE6EF", color: "#0F2942", fontFamily: MONO, background: "#F8FAFC" }}
                    >
                      <option value="">Unassigned</option>
                      {scoutOptions.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Team to scout */}
                  <div ref={teamRef} className="relative">
                    <label className="block font-bold uppercase mb-1" style={{ fontSize: 9, fontFamily: MONO, letterSpacing: 1.5, color: "#5A7291" }}>
                      Team to Scout *
                    </label>
                    <div className="relative">
                      <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "#8BA4BB" }} />
                      <input
                        type="text"
                        value={formTeam}
                        onChange={(e) => { setFormTeam(e.target.value); searchTeams(e.target.value); }}
                        onFocus={() => teamSuggestions.length > 0 && setShowTeamDropdown(true)}
                        placeholder="Search teams..."
                        className="w-full pl-8 pr-3 py-2 rounded-md text-xs"
                        style={{ border: "1px solid #DDE6EF", color: "#0F2942", fontFamily: MONO, background: "#F8FAFC" }}
                      />
                    </div>
                    {showTeamDropdown && teamSuggestions.length > 0 && (
                      <div
                        className="absolute z-10 w-full mt-1 py-1 shadow-lg"
                        style={{ borderRadius: 8, border: "1px solid #DDE6EF", background: "#FFFFFF", maxHeight: 150, overflowY: "auto" }}
                      >
                        {teamSuggestions.map((t) => (
                          <button
                            key={t}
                            className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50"
                            style={{ color: "#0F2942" }}
                            onClick={() => { setFormTeam(t); setShowTeamDropdown(false); }}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* League + Date row */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold uppercase mb-1" style={{ fontSize: 9, fontFamily: MONO, letterSpacing: 1.5, color: "#5A7291" }}>
                        League
                      </label>
                      <select
                        value={formLeague}
                        onChange={(e) => setFormLeague(e.target.value)}
                        className="w-full px-3 py-2 rounded-md text-xs"
                        style={{ border: "1px solid #DDE6EF", color: "#0F2942", fontFamily: MONO, background: "#F8FAFC" }}
                      >
                        <option value="">Select...</option>
                        {["OHL", "GOJHL", "OJHL", "WHL", "QMJHL", "PWHL"].map((l) => (
                          <option key={l} value={l}>{l}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block font-bold uppercase mb-1" style={{ fontSize: 9, fontFamily: MONO, letterSpacing: 1.5, color: "#5A7291" }}>
                        Game Date
                      </label>
                      <input
                        type="date"
                        value={formDate}
                        onChange={(e) => setFormDate(e.target.value)}
                        className="w-full px-3 py-2 rounded-md text-xs"
                        style={{ border: "1px solid #DDE6EF", color: "#0F2942", fontFamily: MONO, background: "#F8FAFC" }}
                      />
                    </div>
                  </div>

                  {/* Venue + Priority row */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold uppercase mb-1" style={{ fontSize: 9, fontFamily: MONO, letterSpacing: 1.5, color: "#5A7291" }}>
                        Venue
                      </label>
                      <input
                        type="text"
                        value={formVenue}
                        onChange={(e) => setFormVenue(e.target.value)}
                        placeholder="Arena name..."
                        className="w-full px-3 py-2 rounded-md text-xs"
                        style={{ border: "1px solid #DDE6EF", color: "#0F2942", fontFamily: MONO, background: "#F8FAFC" }}
                      />
                    </div>
                    <div>
                      <label className="block font-bold uppercase mb-1" style={{ fontSize: 9, fontFamily: MONO, letterSpacing: 1.5, color: "#5A7291" }}>
                        Priority
                      </label>
                      <select
                        value={formPriority}
                        onChange={(e) => setFormPriority(e.target.value)}
                        className="w-full px-3 py-2 rounded-md text-xs"
                        style={{ border: "1px solid #DDE6EF", color: "#0F2942", fontFamily: MONO, background: "#F8FAFC" }}
                      >
                        <option value="high">High</option>
                        <option value="normal">Normal</option>
                        <option value="low">Low</option>
                      </select>
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block font-bold uppercase mb-1" style={{ fontSize: 9, fontFamily: MONO, letterSpacing: 1.5, color: "#5A7291" }}>
                      Notes
                    </label>
                    <div className="flex items-start gap-1">
                      <textarea
                        value={formNotes}
                        onChange={(e) => setFormNotes(e.target.value)}
                        rows={3}
                        placeholder="Scouting focus, players to watch..."
                        className="flex-1 px-3 py-2 rounded-md text-xs resize-none"
                        style={{ border: "1px solid #DDE6EF", color: "#0F2942", fontFamily: MONO, background: "#F8FAFC" }}
                      />
                      <MicButton onTranscript={(t) => setFormNotes((p) => (p ? p + " " + t : t))} />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      onClick={() => { setShowModal(false); resetForm(); }}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold uppercase"
                      style={{ fontFamily: MONO, letterSpacing: 1, color: "#5A7291", border: "1px solid #DDE6EF" }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCreate}
                      disabled={submitting || !formTeam.trim()}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-bold uppercase transition-colors hover:opacity-90 disabled:opacity-50"
                      style={{ fontFamily: MONO, letterSpacing: 1, background: "#0D9488" }}
                    >
                      {submitting ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
                      Create Assignment
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>
    </ProtectedRoute>
  );
}
