"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Briefcase,
  Eye,
  Lightbulb,
  Tag,
  Users,
  Star,
  ExternalLink,
} from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import api from "@/lib/api";
import type { ProAnalysisEntry } from "@/types/api";

/* ---------- Main page ---------- */
export default function ProAnalysisDetailPage() {
  return (
    <ProtectedRoute>
      <NavBar />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ProAnalysisDetailContent />
      </main>
    </ProtectedRoute>
  );
}

function ProAnalysisDetailContent() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [entry, setEntry] = useState<ProAnalysisEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    async function load() {
      try {
        const { data } = await api.get<ProAnalysisEntry>(`/pro-analysis/${id}`);
        setEntry(data);
      } catch (err: unknown) {
        const msg =
          (err as { response?: { data?: { detail?: string } } })?.response?.data
            ?.detail || "Failed to load entry.";
        setError(msg);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  /* Loading */
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-32 bg-gray-200 rounded animate-pulse" />
        <div className="h-10 w-96 bg-gray-200 rounded animate-pulse" />
        <div className="h-6 w-48 bg-gray-200 rounded animate-pulse" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-5 w-full bg-gray-200 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  /* Error */
  if (error || !entry) {
    return (
      <div className="text-center py-20">
        <Briefcase className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <p className="text-red-600 text-lg">{error || "Entry not found"}</p>
        <button
          onClick={() => router.push("/pro-analysis")}
          className="mt-4 text-teal hover:underline text-sm"
        >
          &larr; Back to Pro Analysis
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button
        onClick={() => router.push("/pro-analysis")}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-navy transition"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Pro Analysis
      </button>

      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <span className="px-3 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 capitalize">
            {entry.level}
          </span>
        </div>
        <h1 className="text-3xl font-oswald uppercase tracking-wider text-navy">
          {entry.concept_title}
        </h1>
        {entry.player_reference && (
          <p className="mt-1 text-gray-500 flex items-center gap-1.5">
            <Star className="h-4 w-4 text-orange-400" />
            {entry.player_reference}
          </p>
        )}
      </div>

      {/* Description */}
      {entry.description && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-gray-700 leading-relaxed">{entry.description}</p>
        </div>
      )}

      {/* Key Coaching Cues */}
      {entry.key_coaching_cues.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-oswald uppercase tracking-wider text-navy flex items-center gap-2 mb-4">
            <Lightbulb className="h-5 w-5 text-teal" />
            Key Coaching Cues
          </h2>
          <ol className="space-y-3">
            {entry.key_coaching_cues.map((cue, i) => (
              <li key={i} className="flex gap-3 text-sm text-gray-700">
                <span className="shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-teal/10 text-teal text-xs font-bold">
                  {i + 1}
                </span>
                <span className="leading-relaxed">{cue}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* What to Look For */}
      {entry.what_to_look_for.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-oswald uppercase tracking-wider text-navy flex items-center gap-2 mb-4">
            <Eye className="h-5 w-5 text-orange-500" />
            What to Look For
          </h2>
          <ul className="space-y-2">
            {entry.what_to_look_for.map((item, i) => (
              <li key={i} className="flex gap-3 text-sm text-gray-700">
                <span className="shrink-0 mt-1 w-1.5 h-1.5 rounded-full bg-orange-400" />
                <span className="leading-relaxed">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Video URL */}
      {entry.video_url && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <a
            href={entry.video_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-teal hover:underline font-medium"
          >
            <ExternalLink className="h-4 w-4" />
            Watch Video Breakdown
          </a>
        </div>
      )}

      {/* Skill Tags + Positions */}
      <div className="flex flex-wrap gap-6">
        {entry.skill_tags.length > 0 && (
          <div>
            <h3 className="text-xs font-oswald uppercase tracking-wider text-gray-400 flex items-center gap-1.5 mb-2">
              <Tag className="h-3.5 w-3.5" />
              Skill Tags
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {entry.skill_tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2.5 py-1 rounded-full bg-teal/10 text-teal text-xs font-medium"
                >
                  {tag.replace(/_/g, " ")}
                </span>
              ))}
            </div>
          </div>
        )}

        {entry.positions.length > 0 && (
          <div>
            <h3 className="text-xs font-oswald uppercase tracking-wider text-gray-400 flex items-center gap-1.5 mb-2">
              <Users className="h-3.5 w-3.5" />
              Positions
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {entry.positions.map((pos) => (
                <span
                  key={pos}
                  className="px-2.5 py-1 rounded-full bg-navy/10 text-navy text-xs font-bold"
                >
                  {pos}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
