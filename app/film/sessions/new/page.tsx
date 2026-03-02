"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Film } from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import api from "@/lib/api";
import toast from "react-hot-toast";

interface ReadyUpload {
  id: string;
  title: string;
  status: string;
}

const SESSION_TYPES = [
  { value: "general", label: "General" },
  { value: "game_review", label: "Game Review" },
  { value: "opponent_prep", label: "Opponent Prep" },
  { value: "practice", label: "Practice" },
  { value: "recruitment", label: "Recruitment" },
];

export default function NewFilmSessionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedUpload = searchParams.get("upload") || "";

  const [title, setTitle] = useState("");
  const [sessionType, setSessionType] = useState("general");
  const [description, setDescription] = useState("");
  const [uploadId, setUploadId] = useState(preselectedUpload);
  const [readyUploads, setReadyUploads] = useState<ReadyUpload[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingUploads, setLoadingUploads] = useState(true);

  useEffect(() => {
    api
      .get("/film/uploads")
      .then((r) => {
        const ready = (r.data as ReadyUpload[]).filter((u) => u.status === "ready");
        setReadyUploads(ready);
      })
      .catch(() => {})
      .finally(() => setLoadingUploads(false));
  }, []);

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, string | null> = {
        title: title.trim(),
        session_type: sessionType,
        description: description.trim() || null,
      };
      // If an upload was selected, include video_upload_id
      if (uploadId) {
        payload.video_upload_id = uploadId;
      }
      const res = await api.post("/film/sessions", payload);
      toast.success("Film session created");
      router.push(`/film/sessions/${res.data.id}`);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { detail?: string } } }).response?.data?.detail ||
        "Failed to create session";
      toast.error(msg);
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
          <Link href="/film/sessions" className="text-muted hover:text-navy transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-2xl font-bold text-navy font-oswald uppercase tracking-wider">
            New Film Session
          </h1>
        </div>

        <div className="bg-white rounded-xl border border-border p-6 space-y-5">
          {/* Title */}
          <div>
            <label className="block text-xs font-oswald uppercase tracking-wider text-navy mb-1.5">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Game Review — Saginaw vs Sarnia"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
            />
          </div>

          {/* Session Type */}
          <div>
            <label className="block text-xs font-oswald uppercase tracking-wider text-navy mb-1.5">
              Session Type
            </label>
            <select
              value={sessionType}
              onChange={(e) => setSessionType(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal bg-white"
            >
              {SESSION_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-oswald uppercase tracking-wider text-navy mb-1.5">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional session notes..."
              rows={3}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal resize-none"
            />
          </div>

          {/* Attach Upload */}
          <div>
            <label className="block text-xs font-oswald uppercase tracking-wider text-navy mb-1.5">
              Attach Video Upload
            </label>
            {loadingUploads ? (
              <div className="flex items-center gap-2 text-sm text-muted py-2">
                <Loader2 size={14} className="animate-spin" />
                Loading uploads...
              </div>
            ) : readyUploads.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-muted/60 py-2">
                <Film size={14} />
                No ready uploads available.{" "}
                <Link href="/film/upload" className="text-teal underline">
                  Upload a video
                </Link>
              </div>
            ) : (
              <select
                value={uploadId}
                onChange={(e) => setUploadId(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal bg-white"
              >
                <option value="">None (no video attached)</option>
                {readyUploads.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.title}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Submit */}
          <div className="flex justify-end pt-2">
            <button
              onClick={handleSubmit}
              disabled={saving || !title.trim()}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-oswald uppercase tracking-wider text-sm transition-colors ${
                saving || !title.trim()
                  ? "bg-border text-muted/50 cursor-not-allowed"
                  : "bg-teal text-white hover:bg-teal/90"
              }`}
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              Create Session
            </button>
          </div>
        </div>
      </main>
    </ProtectedRoute>
  );
}
