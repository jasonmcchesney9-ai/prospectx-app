"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Trophy,
  ArrowLeft,
  Save,
} from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import api from "@/lib/api";
import type { SeriesPlan } from "@/types/api";
import { SERIES_FORMATS } from "@/types/api";

export default function NewSeriesPage() {
  return (
    <ProtectedRoute>
      <NavBar />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <SeriesForm />
      </main>
    </ProtectedRoute>
  );
}

function SeriesForm() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [teamName, setTeamName] = useState("");
  const [opponentName, setOpponentName] = useState("");
  const [seriesName, setSeriesName] = useState("");
  const [seriesFormat, setSeriesFormat] = useState("best_of_7");

  const handleSubmit = async () => {
    if (!teamName || !opponentName) {
      setError("Your team and opponent names are required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const { data } = await api.post<SeriesPlan>("/series", {
        team_name: teamName,
        opponent_team_name: opponentName,
        series_name: seriesName || `${teamName} vs ${opponentName}`,
        series_format: seriesFormat,
      });
      router.push(`/series/${data.id}`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
      setError(typeof msg === "string" ? msg : JSON.stringify(msg) || "Failed to create series");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/series" className="text-muted hover:text-navy transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-navy flex items-center gap-2">
            <Trophy size={24} className="text-teal" />
            New Series
          </h1>
          <p className="text-muted text-sm mt-0.5">
            Set up a new playoff or tournament series plan
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="space-y-6">
        {/* Teams */}
        <div className="bg-white rounded-xl border border-border p-5">
          <h3 className="text-sm font-oswald uppercase tracking-wider text-navy mb-4 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-teal/10 text-teal flex items-center justify-center text-xs font-bold">1</span>
            Teams
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-navy mb-1">Your Team *</label>
              <input
                type="text"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="e.g. Chatham Maroons"
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-navy mb-1">Opponent *</label>
              <input
                type="text"
                value={opponentName}
                onChange={(e) => setOpponentName(e.target.value)}
                placeholder="e.g. Leamington Flyers"
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
              />
            </div>
          </div>
        </div>

        {/* Series Details */}
        <div className="bg-white rounded-xl border border-border p-5">
          <h3 className="text-sm font-oswald uppercase tracking-wider text-navy mb-4 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-orange/10 text-orange flex items-center justify-center text-xs font-bold">2</span>
            Series Details
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-navy mb-1">Series Name</label>
              <input
                type="text"
                value={seriesName}
                onChange={(e) => setSeriesName(e.target.value)}
                placeholder="e.g. Western Conference Semi-Final"
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
              />
              <p className="text-[10px] text-muted mt-1">
                Optional. Defaults to &quot;Team vs Opponent&quot;
              </p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-navy mb-1">Format</label>
              <select
                value={seriesFormat}
                onChange={(e) => setSeriesFormat(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
              >
                {SERIES_FORMATS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={saving || !teamName || !opponentName}
          className="w-full bg-gradient-to-r from-teal to-teal/80 text-white py-3 rounded-xl font-oswald font-semibold uppercase tracking-wider text-sm hover:shadow-md transition-shadow disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {saving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
              Creating...
            </>
          ) : (
            <>
              <Save size={16} />
              Create Series Plan
            </>
          )}
        </button>
      </div>
    </div>
  );
}
