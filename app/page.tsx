"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, FileText, PlusCircle, Zap } from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import LandingPage from "@/components/LandingPage";
import ReportCard from "@/components/ReportCard";
import api from "@/lib/api";
import { getUser, isAuthenticated } from "@/lib/auth";
import type { Player, Report } from "@/types/api";

export default function HomePage() {
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    setAuthed(isAuthenticated());
  }, []);

  // Still checking auth
  if (authed === null) {
    return (
      <div className="min-h-screen bg-navy flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-navy border-t-teal" />
      </div>
    );
  }

  // Not logged in — show public landing page
  if (!authed) {
    return <LandingPage />;
  }

  // Logged in — show dashboard
  return (
    <ProtectedRoute>
      <Dashboard />
    </ProtectedRoute>
  );
}

// ── Dashboard (authenticated users) ──────────────
function Dashboard() {
  const [playerCount, setPlayerCount] = useState(0);
  const [reportCount, setReportCount] = useState(0);
  const [recentReports, setRecentReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const user = getUser();

  useEffect(() => {
    async function load() {
      try {
        const [playersRes, reportsRes] = await Promise.all([
          api.get<Player[]>("/players?limit=200"),
          api.get<Report[]>("/reports?limit=5"),
        ]);
        setPlayerCount(playersRes.data.length);
        setReportCount(reportsRes.data.length);
        setRecentReports(reportsRes.data);
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
          || (err as { message?: string })?.message
          || "Failed to connect to backend";
        setError(msg);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <>
      <NavBar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-navy">
            Hockey Intelligence Platform
          </h1>
          <p className="text-muted text-sm mt-1">
            Welcome back{user?.first_name ? `, ${user.first_name}` : ""}.
          </p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-3">
            <span className="text-red-500 mt-0.5">!</span>
            <div>
              <p className="text-red-700 font-medium text-sm">Backend Connection Error</p>
              <p className="text-red-600 text-xs mt-0.5">{error}</p>
              <p className="text-red-500 text-xs mt-1">Make sure the backend is running at {process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl border border-border p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-teal/10 flex items-center justify-center">
                <Users size={20} className="text-teal" />
              </div>
              <div>
                <p className="text-2xl font-oswald font-bold text-navy">
                  {loading ? "\u2014" : playerCount}
                </p>
                <p className="text-xs text-muted font-oswald uppercase tracking-wider">Players</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-border p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-orange/10 flex items-center justify-center">
                <FileText size={20} className="text-orange" />
              </div>
              <div>
                <p className="text-2xl font-oswald font-bold text-navy">
                  {loading ? "\u2014" : reportCount}
                </p>
                <p className="text-xs text-muted font-oswald uppercase tracking-wider">Reports</p>
              </div>
            </div>
          </div>

          <Link href="/players/new" className="bg-white rounded-xl border border-border p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-navy/5 flex items-center justify-center">
                <PlusCircle size={20} className="text-navy" />
              </div>
              <div>
                <p className="text-sm font-oswald font-semibold text-navy">Add Player</p>
                <p className="text-xs text-muted">Create new player profile</p>
              </div>
            </div>
          </Link>

          <Link href="/reports/generate" className="bg-gradient-to-br from-navy to-navy-light rounded-xl p-5 text-white hover:shadow-lg transition-shadow">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
                <Zap size={20} className="text-teal" />
              </div>
              <div>
                <p className="text-sm font-oswald font-semibold">Generate Report</p>
                <p className="text-xs text-white/60">AI-powered scouting</p>
              </div>
            </div>
          </Link>
        </div>

        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-navy">Recent Reports</h2>
            <Link href="/reports" className="text-sm text-teal hover:underline">View all</Link>
          </div>

          {loading ? (
            <div className="text-center py-12 text-muted text-sm">Loading...</div>
          ) : recentReports.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-border">
              <FileText size={32} className="mx-auto text-muted/40 mb-3" />
              <p className="text-muted text-sm">No reports generated yet.</p>
              <Link href="/reports/generate" className="inline-block mt-3 text-sm text-teal hover:underline">
                Generate your first report
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {recentReports.map((r) => (
                <ReportCard key={r.id} report={r} />
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
