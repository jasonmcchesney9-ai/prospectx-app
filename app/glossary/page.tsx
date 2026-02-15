"use client";

import { useState, useEffect, useMemo } from "react";
import { Search, BookOpen, Tag, Hash } from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import api from "@/lib/api";

/* ---------- Types ---------- */
interface GlossaryTerm {
  id: string;
  term: string;
  category: string;
  definition: string;
  aliases: string; // JSON string
  usage_context: string | null;
  created_at: string;
}

/* ---------- Category colour map ---------- */
const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  transition:  { bg: "bg-teal-100",    text: "text-teal-800" },
  tactics:     { bg: "bg-blue-100",    text: "text-blue-800" },
  analytics:   { bg: "bg-purple-100",  text: "text-purple-800" },
  scoring:     { bg: "bg-orange-100",  text: "text-orange-800" },
  defense:     { bg: "bg-red-100",     text: "text-red-800" },
  offense:     { bg: "bg-green-100",   text: "text-green-800" },
  systems:     { bg: "bg-indigo-100",  text: "text-indigo-800" },
  roles:       { bg: "bg-amber-100",   text: "text-amber-800" },
  penalties:   { bg: "bg-red-100",     text: "text-red-700" },
  slang:       { bg: "bg-pink-100",    text: "text-pink-800" },
  rink:        { bg: "bg-gray-100",    text: "text-gray-800" },
  gear:        { bg: "bg-zinc-100",    text: "text-zinc-800" },
  compete:     { bg: "bg-emerald-100", text: "text-emerald-800" },
  forecheck:   { bg: "bg-cyan-100",    text: "text-cyan-800" },
  breakout:    { bg: "bg-sky-100",     text: "text-sky-800" },
  archetypes:  { bg: "bg-violet-100",  text: "text-violet-800" },
  strategy:    { bg: "bg-slate-100",   text: "text-slate-800" },
};

function categoryColor(cat: string) {
  return CATEGORY_COLORS[cat] ?? { bg: "bg-gray-100", text: "text-gray-700" };
}

function parseAliases(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/* ---------- Main page ---------- */
export default function GlossaryPage() {
  return (
    <ProtectedRoute>
      <NavBar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <GlossaryContent />
      </main>
    </ProtectedRoute>
  );
}

function GlossaryContent() {
  const [terms, setTerms] = useState<GlossaryTerm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");

  /* Fetch glossary on mount */
  useEffect(() => {
    async function load() {
      try {
        const { data } = await api.get<GlossaryTerm[]>("/hockey-os/glossary");
        setTerms(data);
      } catch (err: unknown) {
        const msg =
          (err as { response?: { data?: { detail?: string } } })?.response?.data
            ?.detail || "Failed to load glossary. Is the backend running?";
        setError(msg);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  /* Derive categories with counts */
  const categoryCounts = useMemo(() => {
    const map: Record<string, number> = {};
    terms.forEach((t) => {
      map[t.category] = (map[t.category] || 0) + 1;
    });
    return map;
  }, [terms]);

  const sortedCategories = useMemo(
    () => Object.keys(categoryCounts).sort(),
    [categoryCounts]
  );

  /* Filter terms */
  const filtered = useMemo(() => {
    let result = terms;

    // Category filter
    if (activeCategory !== "all") {
      result = result.filter((t) => t.category === activeCategory);
    }

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((t) => {
        const aliases = parseAliases(t.aliases);
        return (
          t.term.toLowerCase().includes(q) ||
          t.definition.toLowerCase().includes(q) ||
          aliases.some((a) => a.toLowerCase().includes(q))
        );
      });
    }

    // Sort alphabetically by term
    return result.sort((a, b) => a.term.localeCompare(b.term));
  }, [terms, activeCategory, search]);

  /* ---------- Loading skeleton ---------- */
  if (loading) {
    return (
      <div className="space-y-6">
        {/* Header skeleton */}
        <div className="space-y-2">
          <div className="h-9 w-64 bg-gray-200 rounded animate-pulse" />
          <div className="h-5 w-96 bg-gray-200 rounded animate-pulse" />
        </div>
        {/* Search skeleton */}
        <div className="h-12 w-full bg-gray-200 rounded-lg animate-pulse" />
        {/* Pills skeleton */}
        <div className="flex gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-8 w-24 bg-gray-200 rounded-full animate-pulse" />
          ))}
        </div>
        {/* Card skeletons */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
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
        <BookOpen className="mx-auto h-12 w-12 text-gray-400 mb-4" />
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
          <BookOpen className="h-8 w-8 text-teal" />
          Hockey Glossary
        </h1>
        <p className="mt-1 text-gray-500">
          Your reference guide to hockey terminology — from analytics to slang.
        </p>
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search terms, definitions, or aliases..."
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
          <span className="ml-1.5 opacity-75">({terms.length})</span>
        </button>
        {sortedCategories.map((cat) => {
          const { bg, text } = categoryColor(cat);
          const isActive = activeCategory === cat;
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(isActive ? "all" : cat)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium capitalize transition ${
                isActive ? "bg-navy text-white" : `${bg} ${text} hover:opacity-80`
              }`}
            >
              {cat}
              <span className="ml-1.5 opacity-75">({categoryCounts[cat]})</span>
            </button>
          );
        })}
      </div>

      {/* Result count */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Hash className="h-4 w-4" />
        <span>
          {filtered.length} {filtered.length === 1 ? "term" : "terms"}
          {activeCategory !== "all" && (
            <> in <span className="capitalize font-medium text-navy">{activeCategory}</span></>
          )}
          {search && (
            <> matching &ldquo;<span className="font-medium text-navy">{search}</span>&rdquo;</>
          )}
        </span>
      </div>

      {/* Term cards or empty state */}
      {filtered.length === 0 ? (
        <div className="text-center py-20">
          <Search className="mx-auto h-12 w-12 text-gray-300 mb-4" />
          <p className="text-gray-500 text-lg">No terms found.</p>
          <p className="text-gray-400 text-sm mt-1">Try a different search or category.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((t) => {
            const aliases = parseAliases(t.aliases);
            const { bg, text } = categoryColor(t.category);
            return (
              <div
                key={t.id}
                className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-teal/40 transition-all duration-200 flex flex-col"
              >
                {/* Term + category */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <h3 className="text-lg font-bold text-navy leading-tight">
                    {t.term}
                  </h3>
                  <span
                    className={`shrink-0 px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${bg} ${text}`}
                  >
                    {t.category}
                  </span>
                </div>

                {/* Definition */}
                <p className="text-gray-700 text-sm leading-relaxed flex-1">
                  {t.definition}
                </p>

                {/* Aliases */}
                {aliases.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Tag className="h-3.5 w-3.5 text-gray-400 mt-0.5 shrink-0" />
                    {aliases.map((alias) => (
                      <span
                        key={alias}
                        className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-xs"
                      >
                        {alias}
                      </span>
                    ))}
                  </div>
                )}

                {/* Usage context */}
                {t.usage_context && (
                  <p className="mt-3 text-xs italic text-gray-400 border-t border-gray-100 pt-2">
                    {t.usage_context}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
