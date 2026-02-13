"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Users,
  Shield,
  FileText,
  BarChart3,
  Zap,
  Swords,
  Target,
  PlusCircle,
  Building2,
} from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import ReportCard from "@/components/ReportCard";
import api from "@/lib/api";
import type { Player, Report, TeamSystem, TeamReference, SystemLibraryEntry } from "@/types/api";

type Tab = "roster" | "systems" | "reports" | "stats";

// Position group helpers
const FORWARD_POS = ["C", "LW", "RW", "F"];
const DEFENSE_POS = ["LD", "RD", "D"];
const GOALIE_POS = ["G"];

function posGroup(pos: string): "forwards" | "defense" | "goalies" | "other" {
  const p = pos.toUpperCase();
  if (FORWARD_POS.includes(p)) return "forwards";
  if (DEFENSE_POS.includes(p)) return "defense";
  if (GOALIE_POS.includes(p)) return "goalies";
  return "other";
}

export default function TeamDetailPage() {
  const params = useParams();
  const teamName = decodeURIComponent(params.name as string);

  const [roster, setRoster] = useState<Player[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [teamSystem, setTeamSystem] = useState<TeamSystem | null>(null);
  const [systemsLibrary, setSystemsLibrary] = useState<SystemLibraryEntry[]>([]);
  const [teamRef, setTeamRef] = useState<TeamReference | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("roster");

  useEffect(() => {
    async function load() {
      try {
        const [rosterRes, reportsRes, sysRes, libRes, refRes] = await Promise.allSettled([
          api.get<Player[]>(`/teams/${encodeURIComponent(teamName)}/roster`),
          api.get<Report[]>(`/teams/${encodeURIComponent(teamName)}/reports`),
          api.get<TeamSystem[]>("/hockey-os/team-systems"),
          api.get<SystemLibraryEntry[]>("/hockey-os/systems-library"),
          api.get<TeamReference[]>("/teams/reference"),
        ]);

        if (rosterRes.status === "fulfilled") setRoster(rosterRes.value.data);
        if (reportsRes.status === "fulfilled") setReports(reportsRes.value.data);
        if (libRes.status === "fulfilled") setSystemsLibrary(libRes.value.data);

        // Match team system by name
        if (sysRes.status === "fulfilled") {
          const match = sysRes.value.data.find(
            (s) => s.team_name.toLowerCase() === teamName.toLowerCase()
          );
          if (match) setTeamSystem(match);
        }

        // Match team reference for metadata
        if (refRes.status === "fulfilled") {
          const match = refRes.value.data.find(
            (t: TeamReference) => t.name.toLowerCase() === teamName.toLowerCase()
          );
          if (match) setTeamRef(match);
        }
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed to load team";
        setError(msg);
      } finally {
        setLoading(false);
      }
    }
    if (teamName) load();
  }, [teamName]);

  // Group roster by position
  const forwards = roster.filter((p) => posGroup(p.position) === "forwards");
  const defense = roster.filter((p) => posGroup(p.position) === "defense");
  const goalies = roster.filter((p) => posGroup(p.position) === "goalies");
  const other = roster.filter((p) => posGroup(p.position) === "other");

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

  return (
    <ProtectedRoute>
      <NavBar />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <Link href="/teams" className="flex items-center gap-1 text-sm text-muted hover:text-navy mb-6">
          <ArrowLeft size={14} /> Back to Teams
        </Link>

        {/* Team Header */}
        <div className="bg-gradient-to-br from-navy to-navy-light rounded-xl p-6 text-white mb-1">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg bg-white/10 flex items-center justify-center shrink-0 border border-white/10">
                {teamRef?.abbreviation ? (
                  <span className="font-oswald font-bold text-lg text-white">{teamRef.abbreviation}</span>
                ) : (
                  <Building2 size={28} className="text-white/50" />
                )}
              </div>
              <div>
                <h1 className="text-2xl font-bold">{teamName}</h1>
                <div className="flex items-center gap-3 mt-1.5 text-sm text-white/70">
                  {(teamRef?.league || roster[0]?.current_league) && (
                    <span className="px-2 py-0.5 bg-teal/20 text-teal rounded font-oswald font-bold text-xs">
                      {teamRef?.league || roster[0]?.current_league}
                    </span>
                  )}
                  {teamRef?.city && <span>{teamRef.city}</span>}
                  {teamSystem?.season && (
                    <span className="text-white/50">{teamSystem.season}</span>
                  )}
                </div>
                <p className="text-xs text-white/50 mt-1">
                  {roster.length} players · {reports.length} reports
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="ice-stripe mb-6 rounded-b-full" />

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 text-sm">{error}</div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-border">
          {([
            { key: "roster" as Tab, label: "Roster", icon: Users, count: roster.length },
            { key: "systems" as Tab, label: "Systems", icon: Shield, count: null },
            { key: "reports" as Tab, label: "Reports", icon: FileText, count: reports.length },
            { key: "stats" as Tab, label: "Stats", icon: BarChart3, count: null },
          ]).map(({ key, label, icon: Icon, count }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-oswald uppercase tracking-wider border-b-2 transition-colors ${
                activeTab === key
                  ? "border-teal text-teal font-semibold"
                  : "border-transparent text-muted hover:text-navy"
              }`}
            >
              <Icon size={14} />
              {label}
              {count !== null && <span className="text-xs opacity-60">({count})</span>}
            </button>
          ))}
        </div>

        {/* Roster Tab */}
        {activeTab === "roster" && (
          <section>
            {roster.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl border border-border">
                <Users size={32} className="mx-auto text-muted/40 mb-3" />
                <p className="text-muted text-sm">No players assigned to this team.</p>
                <Link href="/players/new" className="inline-block mt-3 text-sm text-teal hover:underline">
                  + Add a player
                </Link>
              </div>
            ) : (
              <div className="space-y-6">
                {[
                  { label: "Forwards", players: forwards },
                  { label: "Defense", players: defense },
                  { label: "Goalies", players: goalies },
                  ...(other.length > 0 ? [{ label: "Other", players: other }] : []),
                ].filter((g) => g.players.length > 0).map(({ label, players }) => (
                  <div key={label}>
                    <h3 className="text-xs font-oswald uppercase tracking-wider text-muted mb-2 flex items-center gap-2">
                      {label} <span className="text-navy font-bold">({players.length})</span>
                    </h3>
                    <div className="bg-white rounded-xl border border-border overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-navy/[0.03] border-b border-border">
                            <th className="px-4 py-2.5 text-left font-oswald text-xs uppercase tracking-wider text-muted">Player</th>
                            <th className="px-4 py-2.5 text-center font-oswald text-xs uppercase tracking-wider text-muted w-16">POS</th>
                            <th className="px-4 py-2.5 text-left font-oswald text-xs uppercase tracking-wider text-muted">Archetype</th>
                            <th className="px-4 py-2.5 text-center font-oswald text-xs uppercase tracking-wider text-muted w-16">Shoots</th>
                            <th className="px-4 py-2.5 text-right font-oswald text-xs uppercase tracking-wider text-muted w-20"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {players.map((p) => (
                            <tr key={p.id} className="border-b border-border/50 hover:bg-navy/[0.02] transition-colors">
                              <td className="px-4 py-2.5">
                                <Link href={`/players/${p.id}`} className="font-semibold text-navy hover:text-teal transition-colors">
                                  {p.image_url ? (
                                    <span className="inline-flex items-center gap-2">
                                      <img
                                        src={`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}${p.image_url}`}
                                        alt=""
                                        className="w-7 h-7 rounded-full object-cover"
                                      />
                                      {p.last_name}, {p.first_name}
                                    </span>
                                  ) : (
                                    <>{p.last_name}, {p.first_name}</>
                                  )}
                                </Link>
                              </td>
                              <td className="px-4 py-2.5 text-center">
                                <span className="inline-flex px-2 py-0.5 rounded text-xs font-bold bg-teal/10 text-teal font-oswald">
                                  {p.position}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-muted text-xs">
                                {p.archetype || "—"}
                              </td>
                              <td className="px-4 py-2.5 text-center text-muted">
                                {p.shoots || "—"}
                              </td>
                              <td className="px-4 py-2.5 text-right">
                                <Link
                                  href={`/reports/generate?player=${p.id}`}
                                  className="text-xs text-teal hover:underline"
                                >
                                  Report
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
                <Link
                  href="/players/new"
                  className="flex items-center gap-2 text-sm text-teal hover:underline"
                >
                  <PlusCircle size={14} />
                  Add Player to Team
                </Link>
              </div>
            )}
          </section>
        )}

        {/* Systems Tab */}
        {activeTab === "systems" && (
          <section>
            {teamSystem ? (
              <div className="bg-white rounded-xl border border-border p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-oswald uppercase tracking-wider text-muted flex items-center gap-2">
                    <Shield size={14} className="text-navy" /> Team Tactical Profile
                    {teamSystem.season && <span className="text-xs font-normal text-muted/60 ml-1">{teamSystem.season}</span>}
                  </h3>
                  <Link href="/team-systems" className="text-xs text-teal hover:underline">
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
                      <div key={label} className="p-3 rounded-lg bg-navy/[0.03] border border-border/50">
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
                  <div className="flex flex-wrap gap-2 mt-4">
                    {teamSystem.pace && (
                      <span className="text-xs px-2.5 py-1 rounded bg-orange/[0.06] text-navy/70">
                        <strong>Pace:</strong> {teamSystem.pace}
                      </span>
                    )}
                    {teamSystem.physicality && (
                      <span className="text-xs px-2.5 py-1 rounded bg-orange/[0.06] text-navy/70">
                        <strong>Physical:</strong> {teamSystem.physicality}
                      </span>
                    )}
                    {teamSystem.offensive_style && (
                      <span className="text-xs px-2.5 py-1 rounded bg-orange/[0.06] text-navy/70">
                        <strong>Offense:</strong> {teamSystem.offensive_style}
                      </span>
                    )}
                  </div>
                )}

                {teamSystem.identity_tags && teamSystem.identity_tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {teamSystem.identity_tags.map((tag) => (
                      <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-teal/10 text-teal font-medium">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {teamSystem.notes && (
                  <p className="text-xs text-muted/70 mt-3 italic">{teamSystem.notes}</p>
                )}
              </div>
            ) : (
              <div className="bg-navy/[0.02] rounded-xl border border-dashed border-border p-8 text-center">
                <Shield size={32} className="mx-auto text-muted/30 mb-3" />
                <p className="text-sm text-muted mb-1">No system profile for <strong>{teamName}</strong></p>
                <p className="text-xs text-muted/60 mb-3">
                  Configure your forecheck, defensive zone, and offensive zone structures.
                </p>
                <Link
                  href="/team-systems"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-teal text-white text-sm font-oswald font-semibold uppercase tracking-wider rounded-lg hover:bg-teal/90 transition-colors"
                >
                  <Shield size={14} />
                  Create Team System Profile
                </Link>
              </div>
            )}
          </section>
        )}

        {/* Reports Tab */}
        {activeTab === "reports" && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-navy">Team Reports</h2>
              <span className="text-xs text-muted">{reports.length} total</span>
            </div>
            {reports.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl border border-border">
                <FileText size={32} className="mx-auto text-muted/40 mb-3" />
                <p className="text-muted text-sm">No reports yet for players on this team.</p>
                <p className="text-xs text-muted/60 mt-1">
                  Generate reports from the roster tab or individual player pages.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {reports.map((r) => (
                  <ReportCard key={r.id} report={r} />
                ))}
              </div>
            )}
          </section>
        )}

        {/* Stats Tab */}
        {activeTab === "stats" && (
          <section>
            <div className="text-center py-12 bg-white rounded-xl border border-border">
              <BarChart3 size={32} className="mx-auto text-muted/40 mb-3" />
              <p className="text-muted text-sm font-semibold">Team Stats</p>
              <p className="text-xs text-muted/60 mt-1">
                Aggregate team statistics coming soon.
              </p>
            </div>
          </section>
        )}
      </main>
    </ProtectedRoute>
  );
}
