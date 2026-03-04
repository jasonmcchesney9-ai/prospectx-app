"use client";

import { useState, useEffect, useMemo } from "react";
import { Search, BookOpen, Tag, Hash, Sparkles } from "lucide-react";
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
        <div className="animate-pulse" style={{ borderRadius: 12, background: "#0F2942", height: 72 }} />
        {/* Search skeleton */}
        <div className="animate-pulse" style={{ borderRadius: 12, background: "#DDE6EF", height: 48 }} />
        {/* Pills skeleton */}
        <div className="flex gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse" style={{ borderRadius: 8, background: "#DDE6EF", height: 32, width: 96 }} />
          ))}
        </div>
        {/* Card skeletons */}
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="overflow-hidden animate-pulse" style={{ borderRadius: 12, border: "1.5px solid #DDE6EF" }}>
              <div style={{ background: "#0F2942", height: 44 }} />
              <div className="bg-white p-5 space-y-3">
                <div style={{ background: "#DDE6EF", height: 16, width: 160, borderRadius: 4 }} />
                <div style={{ background: "#DDE6EF", height: 14, width: "100%", borderRadius: 4 }} />
                <div style={{ background: "#DDE6EF", height: 14, width: "75%", borderRadius: 4 }} />
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
        <BookOpen className="mx-auto h-12 w-12 mb-4" style={{ color: "#8BA4BB" }} />
        <p className="text-lg" style={{ color: "#B91C1C" }}>{error}</p>
      </div>
    );
  }

  /* ---------- Render ---------- */
  return (
    <div className="space-y-6">
      {/* ═══════════════════════════════════════════════════════
          HEADER — navy bar (war room style)
          ═══════════════════════════════════════════════════════ */}
      <div className="px-5 py-4 flex items-center justify-between" style={{ borderRadius: 12, border: "1.5px solid #DDE6EF", background: "#0F2942" }}>
        <div className="flex items-center gap-3">
          <span
            className="px-2.5 py-1 rounded-md text-white font-bold uppercase flex items-center gap-1.5"
            style={{ fontSize: 10, fontFamily: "ui-monospace, monospace", letterSpacing: 2, background: "#0D9488" }}
          >
            <Sparkles size={10} />
            PXI
          </span>
          <div>
            <h1 className="text-lg font-bold text-white">
              HOCKEY GLOSSARY
            </h1>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>
              Your reference guide to hockey terminology — from analytics to slang.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="font-bold uppercase text-white"
            style={{ fontSize: 10, fontFamily: "ui-monospace, monospace", letterSpacing: 2 }}
          >
            {terms.length} TERMS
          </span>
        </div>
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5" style={{ color: "#0D9488" }} />
        <input
          type="text"
          placeholder="Search terms, definitions, or aliases..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-12 pr-4 py-3 bg-white focus:outline-none focus:ring-2"
          style={{ borderRadius: 12, border: "1.5px solid #DDE6EF", color: "#0F2942" }}
        />
      </div>

      {/* Category filter pills */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setActiveCategory("all")}
          className="px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase transition-colors"
          style={activeCategory === "all"
            ? { fontFamily: "ui-monospace, monospace", letterSpacing: 1, background: "#0D9488", color: "#FFFFFF" }
            : { fontFamily: "ui-monospace, monospace", letterSpacing: 1, color: "#5A7291", border: "1.5px solid #DDE6EF" }
          }
        >
          All
          <span className="ml-1.5 opacity-75">({terms.length})</span>
        </button>
        {sortedCategories.map((cat) => {
          const isActive = activeCategory === cat;
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(isActive ? "all" : cat)}
              className="px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase transition-colors capitalize"
              style={isActive
                ? { fontFamily: "ui-monospace, monospace", letterSpacing: 1, background: "#0D9488", color: "#FFFFFF" }
                : { fontFamily: "ui-monospace, monospace", letterSpacing: 1, color: "#5A7291", border: "1.5px solid #DDE6EF" }
              }
            >
              {cat}
              <span className="ml-1.5 opacity-75">({categoryCounts[cat]})</span>
            </button>
          );
        })}
      </div>

      {/* Result count */}
      <div className="flex items-center gap-2">
        <Hash className="h-3.5 w-3.5" style={{ color: "#5A7291" }} />
        <span
          className="font-bold uppercase"
          style={{ fontSize: 10, fontFamily: "ui-monospace, monospace", letterSpacing: 2, color: "#5A7291" }}
        >
          {filtered.length} {filtered.length === 1 ? "term" : "terms"}
          {activeCategory !== "all" && (
            <> in <span className="capitalize" style={{ color: "#0F2942" }}>{activeCategory}</span></>
          )}
          {search && (
            <> matching &ldquo;<span style={{ color: "#0F2942" }}>{search}</span>&rdquo;</>
          )}
        </span>
      </div>

      {/* Term cards or empty state */}
      {filtered.length === 0 ? (
        <div className="text-center py-20">
          <Search className="mx-auto h-12 w-12 mb-4" style={{ color: "#8BA4BB" }} />
          <p className="text-lg" style={{ color: "#5A7291" }}>No terms found.</p>
          <p className="text-sm mt-1" style={{ color: "#8BA4BB" }}>Try a different search or category.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Group filtered terms by category */}
          {(() => {
            const grouped: Record<string, GlossaryTerm[]> = {};
            filtered.forEach((t) => {
              if (!grouped[t.category]) grouped[t.category] = [];
              grouped[t.category].push(t);
            });
            const categoryKeys = Object.keys(grouped).sort();
            return categoryKeys.map((cat) => (
              <div key={cat} className="overflow-hidden" style={{ borderRadius: 12, border: "1.5px solid #DDE6EF", borderLeft: "3px solid #0D9488" }}>
                {/* Navy header */}
                <div className="flex items-center justify-between px-5 py-3" style={{ background: "#0F2942" }}>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ background: "#0D9488" }} />
                    <span
                      className="font-bold uppercase text-white"
                      style={{ fontSize: 10, fontFamily: "ui-monospace, monospace", letterSpacing: 2 }}
                    >
                      {cat}
                    </span>
                  </div>
                  <span
                    className="font-bold uppercase"
                    style={{ fontSize: 9, fontFamily: "ui-monospace, monospace", letterSpacing: 1, color: "rgba(255,255,255,0.5)" }}
                  >
                    {grouped[cat].length} {grouped[cat].length === 1 ? "TERM" : "TERMS"}
                  </span>
                </div>
                {/* Term rows */}
                <div className="bg-white divide-y" style={{ borderColor: "#DDE6EF" }}>
                  {grouped[cat].map((t) => {
                    const aliases = parseAliases(t.aliases);
                    return (
                      <div key={t.id} className="px-5 py-4">
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="text-sm font-bold leading-tight" style={{ color: "#0F2942" }}>
                            {t.term}
                          </h3>
                        </div>
                        <p className="text-sm leading-relaxed mt-1.5" style={{ color: "#5A7291" }}>
                          {t.definition}
                        </p>
                        {aliases.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5 items-center">
                            <Tag className="h-3 w-3 shrink-0" style={{ color: "#8BA4BB" }} />
                            {aliases.map((alias) => (
                              <span
                                key={alias}
                                className="px-2 py-0.5 rounded text-[10px]"
                                style={{ background: "rgba(13,148,136,0.06)", color: "#0D9488" }}
                              >
                                {alias}
                              </span>
                            ))}
                          </div>
                        )}
                        {t.usage_context && (
                          <p className="mt-2 text-xs italic pt-2" style={{ color: "#8BA4BB", borderTop: "1px solid #DDE6EF" }}>
                            {t.usage_context}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ));
          })()}
        </div>
      )}
    </div>
  );
}
