"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Film, Loader2 } from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import api from "@/lib/api";

/* ── Types ─────────────────────────────────────────────────── */
interface SimpleTeam {
  id: string;
  name: string;
}

const SESSION_TYPES = [
  { value: "pre_game", label: "Pre-Game", desc: "Prepare for an upcoming game" },
  { value: "post_game", label: "Post-Game", desc: "Review what happened on film" },
  { value: "practice", label: "Practice", desc: "Evaluate practice sessions" },
  { value: "opponent_study", label: "Opponent Study", desc: "Study opponent tendencies" },
  { value: "free_view", label: "Free View", desc: "Open film review — no structure" },
];

/* ── Page ──────────────────────────────────────────────────── */
export default function NewFilmRoomSessionPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [sessionType, setSessionType] = useState("pre_game");
  const [teamId, setTeamId] = useState("");
  const [teams, setTeams] = useState<SimpleTeam[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/teams")
      .then((r) => setTeams(Array.isArray(r.data) ? r.data : []))
      .catch(() => {});
  }, []);

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError("Session title is required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await api.post("/film/sessions", {
        title: title.trim(),
        session_type: sessionType,
        team_id: teamId || null,
      });
      router.push(`/film-room/sessions/${res.data.id}`);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        "Failed to create session";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ProtectedRoute>
      <NavBar />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/film-room" className="text-muted hover:text-navy transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-navy font-oswald uppercase tracking-wider flex items-center gap-2">
              <Film size={22} className="text-teal" />
              New Film Session
            </h1>
            <p className="text-sm text-muted mt-0.5">
              Set up your session, then add video and clips
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm">
            {error}
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
          {/* Title */}
          <div>
            <label className="block text-xs font-oswald uppercase tracking-wider text-navy mb-1.5">
              Session Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Game Review — Saginaw vs Sarnia"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
            />
          </div>

          {/* Session Type */}
          <div>
            <label className="block text-xs font-oswald uppercase tracking-wider text-navy mb-2">
              Session Type
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SESSION_TYPES.map((st) => (
                <button
                  key={st.value}
                  onClick={() => setSessionType(st.value)}
                  className={`text-left border rounded-xl p-3 transition-all ${
                    sessionType === st.value
                      ? "border-teal bg-teal/5 ring-2 ring-teal/20"
                      : "border-gray-200 hover:border-teal/30"
                  }`}
                >
                  <div className="font-oswald font-semibold text-navy text-sm uppercase tracking-wider">
                    {st.label}
                  </div>
                  <div className="text-xs text-muted mt-0.5">{st.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Team */}
          <div>
            <label className="block text-xs font-oswald uppercase tracking-wider text-navy mb-1.5">
              Team
            </label>
            <select
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-navy bg-white focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
            >
              <option value="">Select team (optional)</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* Submit */}
          <div className="flex justify-end pt-2">
            <button
              onClick={handleSubmit}
              disabled={saving || !title.trim()}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-oswald uppercase tracking-wider text-sm transition-colors ${
                saving || !title.trim()
                  ? "bg-gray-200 text-muted/50 cursor-not-allowed"
                  : "bg-teal text-white hover:bg-teal/90"
              }`}
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              {saving ? "Creating..." : "Create Session"}
            </button>
          </div>
        </div>
      </main>
    </ProtectedRoute>
  );
}
