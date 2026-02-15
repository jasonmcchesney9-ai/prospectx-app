"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Database,
  Users,
  Upload,
  FileText,
  PenLine,
  CheckCircle,
  Clock,
  XCircle,
  ArrowRight,
} from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import api from "@/lib/api";
import type { MyDataSummary, MyDataUpload, PlayerCorrection } from "@/types/api";
import { CORRECTABLE_FIELD_LABELS } from "@/types/api";

type Tab = "overview" | "uploads" | "players" | "corrections";

interface MyPlayer {
  id: string;
  first_name: string;
  last_name: string;
  position: string | null;
  current_team: string | null;
  current_league: string | null;
  created_at: string;
}

export default function MyDataPage() {
  return (
    <ProtectedRoute>
      <NavBar />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <MyDataDashboard />
      </main>
    </ProtectedRoute>
  );
}

function MyDataDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [summary, setSummary] = useState<MyDataSummary | null>(null);
  const [uploads, setUploads] = useState<MyDataUpload[]>([]);
  const [players, setPlayers] = useState<MyPlayer[]>([]);
  const [corrections, setCorrections] = useState<PlayerCorrection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const { data } = await api.get<MyDataSummary>("/my-data/summary");
        setSummary(data);
      } catch {
        // handle error
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    if (activeTab === "uploads" && uploads.length === 0) {
      api.get<MyDataUpload[]>("/my-data/uploads").then(({ data }) => setUploads(data)).catch(() => {});
    }
    if (activeTab === "players" && players.length === 0) {
      api.get<MyPlayer[]>("/my-data/players").then(({ data }) => setPlayers(data)).catch(() => {});
    }
    if (activeTab === "corrections" && corrections.length === 0) {
      api.get<PlayerCorrection[]>("/my-data/corrections").then(({ data }) => setCorrections(data)).catch(() => {});
    }
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-navy border-t-teal" />
      </div>
    );
  }

  const stats = [
    { label: "Players Created", value: summary?.players_created ?? 0, icon: Users, color: "text-teal" },
    { label: "Uploads", value: summary?.uploads ?? 0, icon: Upload, color: "text-orange" },
    { label: "Corrections", value: summary?.corrections_submitted ?? 0, icon: PenLine, color: "text-navy" },
    { label: "Reports", value: summary?.reports_generated ?? 0, icon: FileText, color: "text-teal" },
  ];

  const tabs: { key: Tab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "uploads", label: "Uploads" },
    { key: "players", label: "Players" },
    { key: "corrections", label: "Corrections" },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-navy flex items-center gap-2">
          <Database size={24} className="text-teal" />
          My Data
        </h1>
        <p className="text-muted text-sm mt-1">
          Your contributions and activity across ProspectX
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {stats.map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-border p-4">
            <div className="flex items-center gap-2 mb-2">
              <s.icon size={14} className={s.color} />
              <span className="text-[10px] font-oswald uppercase tracking-wider text-muted">{s.label}</span>
            </div>
            <p className="text-2xl font-oswald font-bold text-navy">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-4 py-2 rounded-lg text-sm font-oswald uppercase tracking-wider transition-colors ${
              activeTab === key
                ? "bg-white text-navy shadow-sm"
                : "text-muted hover:text-navy"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && summary && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-border p-5">
            <h3 className="text-sm font-oswald uppercase tracking-wider text-navy mb-3">Activity Summary</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">Players Created</span>
                <span className="font-medium text-navy">{summary.players_created}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Files Uploaded</span>
                <span className="font-medium text-navy">{summary.uploads}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Corrections Submitted</span>
                <span className="font-medium text-navy">{summary.corrections_submitted}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Corrections Approved</span>
                <span className="font-medium text-green-600">{summary.corrections_approved}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Reports Generated</span>
                <span className="font-medium text-navy">{summary.reports_generated}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Notes Created</span>
                <span className="font-medium text-navy">{summary.notes_created}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "uploads" && (
        <div>
          {uploads.length === 0 ? (
            <div className="bg-gray-50 border border-border rounded-xl p-6 text-center">
              <Upload size={32} className="mx-auto text-muted mb-3" />
              <h3 className="font-oswald font-semibold text-navy">No Uploads Yet</h3>
              <p className="text-muted text-sm mt-1">Your CSV imports will appear here.</p>
              <Link href="/players/import" className="inline-flex items-center gap-1 mt-3 text-sm text-teal hover:underline">
                Import Players <ArrowRight size={12} />
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {uploads.map((u) => (
                <div key={u.id} className="bg-white rounded-xl border border-border p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-navy">{u.filename}</p>
                    <div className="flex items-center gap-3 text-xs text-muted mt-1">
                      <span>{u.total_rows} rows</span>
                      <span>{u.imported} imported</span>
                      {u.duplicates_found > 0 && <span className="text-orange">{u.duplicates_found} duplicates</span>}
                      {u.errors > 0 && <span className="text-red-500">{u.errors} errors</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                      u.status === "completed" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                    }`}>
                      {u.status}
                    </span>
                    <p className="text-[10px] text-muted mt-1">
                      {new Date(u.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "players" && (
        <div>
          {players.length === 0 ? (
            <div className="bg-gray-50 border border-border rounded-xl p-6 text-center">
              <Users size={32} className="mx-auto text-muted mb-3" />
              <h3 className="font-oswald font-semibold text-navy">No Players Created</h3>
              <p className="text-muted text-sm mt-1">Players you create will appear here.</p>
              <Link href="/players/new" className="inline-flex items-center gap-1 mt-3 text-sm text-teal hover:underline">
                Create Player <ArrowRight size={12} />
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {players.map((p) => (
                <Link
                  key={p.id}
                  href={`/players/${p.id}`}
                  className="block bg-white rounded-xl border border-border p-4 hover:border-teal/30 hover:shadow-sm transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-navy text-sm">
                        {p.first_name} {p.last_name}
                      </span>
                      {p.position && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-muted">{p.position}</span>
                      )}
                      {p.current_team && <span className="text-xs text-muted">{p.current_team}</span>}
                    </div>
                    <span className="text-[10px] text-muted">
                      {new Date(p.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "corrections" && (
        <div>
          {corrections.length === 0 ? (
            <div className="bg-gray-50 border border-border rounded-xl p-6 text-center">
              <PenLine size={32} className="mx-auto text-muted mb-3" />
              <h3 className="font-oswald font-semibold text-navy">No Corrections Submitted</h3>
              <p className="text-muted text-sm mt-1">
                Submit corrections from any player profile page.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {corrections.map((c) => (
                <div key={c.id} className="bg-white rounded-xl border border-border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Link
                          href={`/players/${c.player_id}`}
                          className="font-medium text-navy text-sm hover:text-teal transition-colors"
                        >
                          {c.first_name} {c.last_name}
                        </Link>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                          c.status === "pending" ? "bg-yellow-100 text-yellow-700"
                            : c.status === "approved" ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}>
                          {c.status === "pending" ? <Clock size={8} className="inline mr-0.5" /> : c.status === "approved" ? <CheckCircle size={8} className="inline mr-0.5" /> : <XCircle size={8} className="inline mr-0.5" />}
                          {c.status}
                        </span>
                      </div>
                      <p className="text-xs text-muted">
                        {CORRECTABLE_FIELD_LABELS[c.field_name] || c.field_name}:{" "}
                        <span className="line-through text-red-500">{c.old_value || "—"}</span>
                        {" → "}
                        <span className="text-green-600 font-medium">{c.new_value}</span>
                      </p>
                    </div>
                    <span className="text-[10px] text-muted">
                      {new Date(c.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
