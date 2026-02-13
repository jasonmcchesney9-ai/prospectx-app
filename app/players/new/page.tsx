"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import api from "@/lib/api";
import type { PlayerCreate, Player } from "@/types/api";

export default function NewPlayerPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<PlayerCreate>({
    first_name: "",
    last_name: "",
    position: "C",
    shoots: "L",
    current_team: "",
    current_league: "",
    height_cm: undefined,
    weight_kg: undefined,
    dob: "",
    notes: "",
  });

  const update = (field: keyof PlayerCreate, value: string | number | undefined) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await api.post<Player>("/players", form);
      router.push(`/players/${data.id}`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed to create player";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedRoute>
      <NavBar />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <Link href="/players" className="flex items-center gap-1 text-sm text-muted hover:text-navy mb-6">
          <ArrowLeft size={14} /> Back to Players
        </Link>

        <h1 className="text-2xl font-bold text-navy mb-6">Add Player</h1>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-border p-6 space-y-5">
          {/* Name */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-oswald uppercase tracking-wider text-muted mb-1">First Name *</label>
              <input required type="text" value={form.first_name} onChange={(e) => update("first_name", e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-oswald uppercase tracking-wider text-muted mb-1">Last Name *</label>
              <input required type="text" value={form.last_name} onChange={(e) => update("last_name", e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
            </div>
          </div>

          {/* Position + Shoots */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-oswald uppercase tracking-wider text-muted mb-1">Position *</label>
              <select value={form.position} onChange={(e) => update("position", e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm">
                {["C", "LW", "RW", "F", "LD", "RD", "D", "G"].map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-oswald uppercase tracking-wider text-muted mb-1">Shoots</label>
              <select value={form.shoots || ""} onChange={(e) => update("shoots", e.target.value || undefined)}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm">
                <option value="">—</option>
                <option value="L">Left</option>
                <option value="R">Right</option>
              </select>
            </div>
          </div>

          {/* Team + League */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-oswald uppercase tracking-wider text-muted mb-1">Team</label>
              <input type="text" value={form.current_team || ""} onChange={(e) => update("current_team", e.target.value)}
                placeholder="e.g., Chatham Maroons" className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-oswald uppercase tracking-wider text-muted mb-1">League</label>
              <input type="text" value={form.current_league || ""} onChange={(e) => update("current_league", e.target.value)}
                placeholder="e.g., GOJHL" className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
            </div>
          </div>

          {/* DOB + Height + Weight */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-oswald uppercase tracking-wider text-muted mb-1">Date of Birth</label>
              <input type="date" value={form.dob || ""} onChange={(e) => update("dob", e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-oswald uppercase tracking-wider text-muted mb-1">Height (cm)</label>
              <input type="number" value={form.height_cm || ""} onChange={(e) => update("height_cm", e.target.value ? parseInt(e.target.value) : undefined)}
                placeholder="183" className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-oswald uppercase tracking-wider text-muted mb-1">Weight (kg)</label>
              <input type="number" value={form.weight_kg || ""} onChange={(e) => update("weight_kg", e.target.value ? parseInt(e.target.value) : undefined)}
                placeholder="82" className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-oswald uppercase tracking-wider text-muted mb-1">Notes</label>
            <textarea value={form.notes || ""} onChange={(e) => update("notes", e.target.value)}
              rows={3} className="w-full px-3 py-2 border border-border rounded-lg text-sm" placeholder="Scout notes, observations..." />
          </div>

          {error && <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

          <button type="submit" disabled={loading}
            className="w-full py-2.5 bg-teal text-white font-oswald font-semibold uppercase tracking-wider rounded-lg hover:bg-teal/90 disabled:opacity-50 transition-colors text-sm">
            {loading ? "Creating..." : "Create Player"}
          </button>
        </form>
      </main>
    </ProtectedRoute>
  );
}
