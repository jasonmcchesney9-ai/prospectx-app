"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Dumbbell, CheckCircle2, AlertTriangle, Tag, Users } from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import api from "@/lib/api";
import type { SkillLesson } from "@/types/api";

/* ---------- Category colour map ---------- */
const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  Shooting:          { bg: "bg-red-100",     text: "text-red-800" },
  Skating:           { bg: "bg-blue-100",    text: "text-blue-800" },
  "Puck Handling":   { bg: "bg-teal-100",    text: "text-teal-800" },
  Awareness:         { bg: "bg-purple-100",  text: "text-purple-800" },
  "Positional Play": { bg: "bg-indigo-100",  text: "text-indigo-800" },
  "Off-Ice Training":{ bg: "bg-amber-100",   text: "text-amber-800" },
  "Drill Add-Ons":   { bg: "bg-green-100",   text: "text-green-800" },
};

function categoryColor(cat: string) {
  return CATEGORY_COLORS[cat] ?? { bg: "bg-gray-100", text: "text-gray-700" };
}

/* ---------- Main page ---------- */
export default function SkillDetailPage() {
  return (
    <ProtectedRoute>
      <NavBar />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <SkillDetailContent />
      </main>
    </ProtectedRoute>
  );
}

function SkillDetailContent() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [lesson, setLesson] = useState<SkillLesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    async function load() {
      try {
        const { data } = await api.get<SkillLesson>(`/skills/${id}`);
        setLesson(data);
      } catch (err: unknown) {
        const msg =
          (err as { response?: { data?: { detail?: string } } })?.response?.data
            ?.detail || "Failed to load lesson.";
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
  if (error || !lesson) {
    return (
      <div className="text-center py-20">
        <Dumbbell className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <p className="text-red-600 text-lg">{error || "Lesson not found"}</p>
        <button
          onClick={() => router.push("/skills")}
          className="mt-4 text-teal hover:underline text-sm"
        >
          &larr; Back to Skills Library
        </button>
      </div>
    );
  }

  const { bg, text } = categoryColor(lesson.category);

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button
        onClick={() => router.push("/skills")}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-navy transition"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Skills Library
      </button>

      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${bg} ${text}`}>
            {lesson.category}
          </span>
          {lesson.age_level !== "all" && (
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
              {lesson.age_level}
            </span>
          )}
        </div>
        <h1 className="text-3xl font-oswald uppercase tracking-wider text-navy">
          {lesson.title}
        </h1>
        {lesson.series && (
          <p className="mt-1 text-gray-500">
            {lesson.series} &mdash; Lesson {lesson.lesson_number}
          </p>
        )}
      </div>

      {/* Description */}
      {lesson.description && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-gray-700 leading-relaxed">{lesson.description}</p>
        </div>
      )}

      {/* Coaching Points */}
      {lesson.coaching_points.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-oswald uppercase tracking-wider text-navy flex items-center gap-2 mb-4">
            <CheckCircle2 className="h-5 w-5 text-teal" />
            Coaching Points
          </h2>
          <ol className="space-y-3">
            {lesson.coaching_points.map((point, i) => (
              <li key={i} className="flex gap-3 text-sm text-gray-700">
                <span className="shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-teal/10 text-teal text-xs font-bold">
                  {i + 1}
                </span>
                <span className="leading-relaxed">{point}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Common Errors */}
      {lesson.common_errors.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-oswald uppercase tracking-wider text-navy flex items-center gap-2 mb-4">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Common Errors
          </h2>
          <ul className="space-y-2">
            {lesson.common_errors.map((err, i) => (
              <li key={i} className="flex gap-3 text-sm text-gray-700">
                <span className="shrink-0 mt-1 w-1.5 h-1.5 rounded-full bg-orange-400" />
                <span className="leading-relaxed">{err}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Skill Tags + Positions */}
      <div className="flex flex-wrap gap-6">
        {lesson.skill_tags.length > 0 && (
          <div>
            <h3 className="text-xs font-oswald uppercase tracking-wider text-gray-400 flex items-center gap-1.5 mb-2">
              <Tag className="h-3.5 w-3.5" />
              Skill Tags
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {lesson.skill_tags.map((tag) => (
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

        {lesson.positions.length > 0 && (
          <div>
            <h3 className="text-xs font-oswald uppercase tracking-wider text-gray-400 flex items-center gap-1.5 mb-2">
              <Users className="h-3.5 w-3.5" />
              Positions
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {lesson.positions.map((pos) => (
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
