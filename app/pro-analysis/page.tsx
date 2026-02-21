"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Search, Briefcase, Hash, Filter, Star } from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import api from "@/lib/api";
import type { ProAnalysisEntry } from "@/types/api";

const POSITIONS = ["C", "LW", "RW", "D", "G"] as const;

/* ---------- Main page ---------- */
export default function ProAnalysisPage() {
  return (
    <ProtectedRoute>
      <NavBar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ProAnalysisContent />
      </main>
    </ProtectedRoute>
  );
}

function ProAnalysisContent() {
  const router = useRouter();
  const [entries, setEntries] = useState<ProAnalysisEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [activePosition, setActivePosition] = useState("all");

  /* Fetch on mount */
  useEffect(() => {
    async function load() {
      try {
        const { data } = await api.get<ProAnalysisEntry[]>("/pro-analysis");
        setEntries(data);
      } catch (err: unknown) {
        const msg =
          (err as { response?: { data?: { detail?: string } } })?.response?.data
            ?.detail || "Failed to load pro analysis entries. Is the backend running?";
        setError(msg);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  /* Filter */
  const filtered = useMemo(() => {
    let result = entries;

    if (activePosition !== "all") {
      result = result.filter(
        (e) => e.positions && e.positions.includes(activePosition)
      );
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (e) =>
          e.concept_title.toLowerCase().includes(q) ||
          (e.description && e.description.toLowerCase().includes(q)) ||
          (e.player_reference && e.player_reference.toLowerCase().includes(q)) ||
          e.skill_tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    return result.sort((a, b) => a.concept_title.localeCompare(b.concept_title));
  }, [entries, activePosition, search]);

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
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-8 w-16 bg-gray-200 rounded-full animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
              <div className="h-6 w-48 bg-gray-200 rounded animate-pulse" />
              <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
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
        <Briefcase className="mx-auto h-12 w-12 text-gray-400 mb-4" />
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
          <Briefcase className="h-8 w-8 text-teal" />
          Pro Analysis
        </h1>
        <p className="mt-1 text-gray-500">
          {entries.length} elite player breakdowns — study how the pros execute key skills and apply the cues to your coaching.
        </p>
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search by concept, player, or skill tag..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-12 pr-4 py-3 rounded-lg border border-gray-300 bg-white text-navy placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal focus:border-teal transition"
        />
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
              onClick={() =>
                setActivePosition(activePosition === pos ? "all" : pos)
              }
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
          {filtered.length}{" "}
          {filtered.length === 1 ? "entry" : "entries"}
          {activePosition !== "all" && (
            <>
              {" "}
              for{" "}
              <span className="font-medium text-navy">{activePosition}</span>
            </>
          )}
          {search && (
            <>
              {" "}
              matching &ldquo;
              <span className="font-medium text-navy">{search}</span>&rdquo;
            </>
          )}
        </span>
      </div>

      {/* Entry cards or empty state */}
      {filtered.length === 0 ? (
        <div className="text-center py-20">
          <Search className="mx-auto h-12 w-12 text-gray-300 mb-4" />
          <p className="text-gray-500 text-lg">No entries found.</p>
          <p className="text-gray-400 text-sm mt-1">
            Try a different search or position filter.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((e) => (
            <button
              key={e.id}
              onClick={() => router.push(`/pro-analysis/${e.id}`)}
              className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-teal/40 transition-all duration-200 flex flex-col text-left"
            >
              {/* Title + player reference */}
              <div className="mb-2">
                <h3 className="text-base font-bold text-navy leading-tight">
                  {e.concept_title}
                </h3>
                {e.player_reference && (
                  <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
                    <Star className="h-3.5 w-3.5 text-orange-400" />
                    {e.player_reference}
                  </p>
                )}
              </div>

              {/* Description snippet */}
              {e.description && (
                <p className="text-gray-600 text-sm leading-relaxed line-clamp-2 flex-1 mb-3">
                  {e.description}
                </p>
              )}

              {/* Positions */}
              {e.positions.length > 0 && (
                <div className="flex gap-1 mb-2">
                  {e.positions.map((pos) => (
                    <span
                      key={pos}
                      className="px-2 py-0.5 rounded-full bg-navy/10 text-navy text-[10px] font-bold"
                    >
                      {pos}
                    </span>
                  ))}
                </div>
              )}

              {/* Skill tags */}
              {e.skill_tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-auto">
                  {e.skill_tags.slice(0, 4).map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 rounded-full bg-teal/10 text-teal text-[10px] font-medium"
                    >
                      {tag.replace(/_/g, " ")}
                    </span>
                  ))}
                  {e.skill_tags.length > 4 && (
                    <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-400 text-[10px]">
                      +{e.skill_tags.length - 4}
                    </span>
                  )}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
