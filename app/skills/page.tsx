"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Search, Dumbbell, Hash, Filter } from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import api from "@/lib/api";
import type { SkillLesson } from "@/types/api";
import { SKILL_CATEGORIES } from "@/types/api";

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

const POSITIONS = ["C", "LW", "RW", "D", "G"] as const;

/* ---------- Main page ---------- */
export default function SkillsPage() {
  return (
    <ProtectedRoute>
      <NavBar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <SkillsContent />
      </main>
    </ProtectedRoute>
  );
}

function SkillsContent() {
  const router = useRouter();
  const [lessons, setLessons] = useState<SkillLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [activePosition, setActivePosition] = useState("all");

  /* Fetch skills on mount */
  useEffect(() => {
    async function load() {
      try {
        const { data } = await api.get<SkillLesson[]>("/skills");
        setLessons(data);
      } catch (err: unknown) {
        const msg =
          (err as { response?: { data?: { detail?: string } } })?.response?.data
            ?.detail || "Failed to load skills. Is the backend running?";
        setError(msg);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  /* Derive category counts */
  const categoryCounts = useMemo(() => {
    const map: Record<string, number> = {};
    lessons.forEach((l) => {
      map[l.category] = (map[l.category] || 0) + 1;
    });
    return map;
  }, [lessons]);

  /* Filter lessons */
  const filtered = useMemo(() => {
    let result = lessons;

    if (activeCategory !== "all") {
      result = result.filter((l) => l.category === activeCategory);
    }

    if (activePosition !== "all") {
      result = result.filter((l) =>
        l.positions && l.positions.includes(activePosition)
      );
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (l) =>
          l.title.toLowerCase().includes(q) ||
          (l.description && l.description.toLowerCase().includes(q)) ||
          (l.series && l.series.toLowerCase().includes(q)) ||
          l.skill_tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    return result;
  }, [lessons, activeCategory, activePosition, search]);

  /* Group by series */
  const groupedBySeries = useMemo(() => {
    const map: Record<string, SkillLesson[]> = {};
    filtered.forEach((l) => {
      const key = l.series || "Uncategorized";
      if (!map[key]) map[key] = [];
      map[key].push(l);
    });
    // Sort each group by lesson_number
    Object.values(map).forEach((arr) =>
      arr.sort((a, b) => a.lesson_number - b.lesson_number)
    );
    return map;
  }, [filtered]);

  /* ---------- Loading skeleton ---------- */
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <div className="h-9 w-64 bg-gray-200 rounded animate-pulse" />
          <div className="h-5 w-96 bg-gray-200 rounded animate-pulse" />
        </div>
        <div className="h-12 w-full bg-gray-200 rounded-lg animate-pulse" />
        <div className="flex gap-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-8 w-24 bg-gray-200 rounded-full animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
              <div className="h-6 w-40 bg-gray-200 rounded animate-pulse" />
              <div className="h-4 w-20 bg-gray-200 rounded-full animate-pulse" />
              <div className="space-y-2">
                <div className="h-4 w-full bg-gray-200 rounded animate-pulse" />
                <div className="h-4 w-3/4 bg-gray-200 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* ---------- Error state ---------- */
  if (error) {
    return (
      <div className="text-center py-20">
        <Dumbbell className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <p className="text-red-600 text-lg">{error}</p>
      </div>
    );
  }

  /* ---------- Render ---------- */
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-oswald uppercase tracking-wider text-navy flex items-center gap-3">
          <Dumbbell className="h-8 w-8 text-teal" />
          Skills Library
        </h1>
        <p className="mt-1 text-gray-500">
          {lessons.length} coaching lessons across {Object.keys(categoryCounts).length} categories — tap any card to view full details.
        </p>
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search lessons, series, or skill tags..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-12 pr-4 py-3 rounded-lg border border-gray-300 bg-white text-navy placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal focus:border-teal transition"
        />
      </div>

      {/* Category filter pills */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setActiveCategory("all")}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
            activeCategory === "all"
              ? "bg-navy text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          All
          <span className="ml-1.5 opacity-75">({lessons.length})</span>
        </button>
        {SKILL_CATEGORIES.map((cat) => {
          const { bg, text } = categoryColor(cat);
          const isActive = activeCategory === cat;
          const count = categoryCounts[cat] || 0;
          if (count === 0) return null;
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(isActive ? "all" : cat)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
                isActive ? "bg-navy text-white" : `${bg} ${text} hover:opacity-80`
              }`}
            >
              {cat}
              <span className="ml-1.5 opacity-75">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Position filter */}
      <div className="flex items-center gap-3">
        <Filter className="h-4 w-4 text-gray-400" />
        <span className="text-sm text-gray-500">Position:</span>
        <div className="flex gap-1.5">
          <button
            onClick={() => setActivePosition("all")}
            className={`px-3 py-1 rounded-full text-xs font-medium transition ${
              activePosition === "all"
                ? "bg-navy text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            All
          </button>
          {POSITIONS.map((pos) => (
            <button
              key={pos}
              onClick={() => setActivePosition(activePosition === pos ? "all" : pos)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                activePosition === pos
                  ? "bg-navy text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {pos}
            </button>
          ))}
        </div>
      </div>

      {/* Result count */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Hash className="h-4 w-4" />
        <span>
          {filtered.length} {filtered.length === 1 ? "lesson" : "lessons"}
          {activeCategory !== "all" && (
            <> in <span className="font-medium text-navy">{activeCategory}</span></>
          )}
          {activePosition !== "all" && (
            <> for <span className="font-medium text-navy">{activePosition}</span></>
          )}
          {search && (
            <> matching &ldquo;<span className="font-medium text-navy">{search}</span>&rdquo;</>
          )}
        </span>
      </div>

      {/* Lessons or empty state */}
      {filtered.length === 0 ? (
        <div className="text-center py-20">
          <Search className="mx-auto h-12 w-12 text-gray-300 mb-4" />
          <p className="text-gray-500 text-lg">No lessons found.</p>
          <p className="text-gray-400 text-sm mt-1">Try a different search, category, or position filter.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedBySeries)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([series, seriesLessons]) => (
              <div key={series}>
                <h2 className="text-lg font-oswald uppercase tracking-wider text-navy/70 mb-3 border-b border-gray-200 pb-1">
                  {series}
                  <span className="ml-2 text-sm font-normal normal-case text-gray-400">
                    ({seriesLessons.length} {seriesLessons.length === 1 ? "lesson" : "lessons"})
                  </span>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {seriesLessons.map((l) => {
                    const { bg, text } = categoryColor(l.category);
                    return (
                      <button
                        key={l.id}
                        onClick={() => router.push(`/skills/${l.id}`)}
                        className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-teal/40 transition-all duration-200 flex flex-col text-left"
                      >
                        {/* Title + category */}
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h3 className="text-base font-bold text-navy leading-tight">
                            {l.series && (
                              <span className="text-xs text-gray-400 font-normal block mb-0.5">
                                Lesson {l.lesson_number}
                              </span>
                            )}
                            {l.title}
                          </h3>
                          <span
                            className={`shrink-0 px-2.5 py-0.5 rounded-full text-[10px] font-medium ${bg} ${text}`}
                          >
                            {l.category}
                          </span>
                        </div>

                        {/* Description snippet */}
                        {l.description && (
                          <p className="text-gray-600 text-sm leading-relaxed line-clamp-2 flex-1 mb-3">
                            {l.description}
                          </p>
                        )}

                        {/* Skill tags */}
                        {l.skill_tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-auto">
                            {l.skill_tags.slice(0, 4).map((tag) => (
                              <span
                                key={tag}
                                className="px-2 py-0.5 rounded-full bg-teal/10 text-teal text-[10px] font-medium"
                              >
                                {tag.replace(/_/g, " ")}
                              </span>
                            ))}
                            {l.skill_tags.length > 4 && (
                              <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-400 text-[10px]">
                                +{l.skill_tags.length - 4}
                              </span>
                            )}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
