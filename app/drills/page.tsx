"use client";

import { useEffect, useState } from "react";
import { Search, PlusCircle, ChevronDown, ChevronUp, Clock, Users, Flame, Snowflake, Upload } from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import api from "@/lib/api";
import { assetUrl } from "@/lib/api";
import type { Drill } from "@/types/api";
import { DRILL_CATEGORIES, DRILL_AGE_LEVELS, DRILL_AGE_LEVEL_LABELS, ICE_SURFACES, INTENSITY_COLORS } from "@/types/api";

export default function DrillsPage() {
  const [drills, setDrills] = useState<Drill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [ageFilter, setAgeFilter] = useState("");
  const [surfaceFilter, setSurfaceFilter] = useState("");
  const [intensityFilter, setIntensityFilter] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setError("");
        const params = new URLSearchParams();
        if (search) params.set("search", search);
        if (categoryFilter) params.set("category", categoryFilter);
        if (ageFilter) params.set("age_level", ageFilter);
        if (surfaceFilter) params.set("ice_surface", surfaceFilter);
        if (intensityFilter) params.set("intensity", intensityFilter);
        params.set("limit", "200");
        const { data } = await api.get<Drill[]>(`/drills?${params}`);
        setDrills(data);
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed to load drills. Is the backend running?";
        setError(msg);
        console.error("Failed to load drills:", err);
      } finally {
        setLoading(false);
      }
    }
    const timer = setTimeout(load, 300);
    return () => clearTimeout(timer);
  }, [search, categoryFilter, ageFilter, surfaceFilter, intensityFilter]);

  async function handleDiagramUpload(drillId: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    try {
      const { data } = await api.post<{ diagram_url: string }>(`/drills/${drillId}/diagram`, formData);
      setDrills((prev) =>
        prev.map((d) => (d.id === drillId ? { ...d, diagram_url: data.diagram_url } : d))
      );
    } catch (err) {
      console.error("Failed to upload diagram:", err);
    }
    e.target.value = "";
  }

  return (
    <ProtectedRoute>
      <NavBar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-navy">Drill Library</h1>
            {!loading && (
              <p className="text-xs text-muted mt-0.5">{drills.length} drill{drills.length !== 1 ? "s" : ""}</p>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder="Search drills..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm bg-white"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 border border-border rounded-lg text-sm bg-white"
          >
            <option value="">All Categories</option>
            {Object.entries(DRILL_CATEGORIES).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <select
            value={ageFilter}
            onChange={(e) => setAgeFilter(e.target.value)}
            className="px-3 py-2 border border-border rounded-lg text-sm bg-white"
          >
            <option value="">All Ages</option>
            {DRILL_AGE_LEVELS.map((a) => (
              <option key={a} value={a}>{DRILL_AGE_LEVEL_LABELS[a]}</option>
            ))}
          </select>
          <select
            value={surfaceFilter}
            onChange={(e) => setSurfaceFilter(e.target.value)}
            className="px-3 py-2 border border-border rounded-lg text-sm bg-white"
          >
            <option value="">All Ice</option>
            {Object.entries(ICE_SURFACES).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <select
            value={intensityFilter}
            onChange={(e) => setIntensityFilter(e.target.value)}
            className="px-3 py-2 border border-border rounded-lg text-sm bg-white"
          >
            <option value="">All Intensity</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 text-sm">{error}</div>
        )}

        {/* Drill Cards */}
        {loading ? (
          <div className="text-center py-16 text-muted text-sm">Loading drills...</div>
        ) : drills.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-border">
            <p className="text-muted text-sm">No drills found matching your filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {drills.map((drill) => {
              const isExpanded = expandedId === drill.id;
              const ic = INTENSITY_COLORS[drill.intensity] || INTENSITY_COLORS.medium;
              return (
                <div
                  key={drill.id}
                  className="bg-white rounded-xl border border-border hover:border-teal/30 transition-colors overflow-hidden"
                >
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : drill.id)}
                    className="w-full text-left p-4"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="text-sm font-bold text-navy leading-tight pr-2">{drill.name}</h3>
                      {isExpanded ? <ChevronUp size={14} className="text-muted shrink-0 mt-0.5" /> : <ChevronDown size={14} className="text-muted shrink-0 mt-0.5" />}
                    </div>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-oswald uppercase tracking-wider bg-teal/10 text-teal font-bold">
                        {DRILL_CATEGORIES[drill.category] || drill.category}
                      </span>
                      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-oswald uppercase tracking-wider font-bold ${ic.bg} ${ic.text}`}>
                        {ic.label}
                      </span>
                      <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-oswald uppercase tracking-wider bg-navy/[0.05] text-navy/60">
                        {ICE_SURFACES[drill.ice_surface] || drill.ice_surface}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-muted">
                      <span className="flex items-center gap-1"><Clock size={10} />{drill.duration_minutes} min</span>
                      {drill.players_needed > 0 && (
                        <span className="flex items-center gap-1"><Users size={10} />{drill.players_needed}+ players</span>
                      )}
                    </div>
                    {/* Age level tags */}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {drill.age_levels.map((age) => (
                        <span key={age} className="text-[9px] px-1.5 py-0.5 rounded bg-navy/[0.04] text-navy/50 font-oswald">
                          {age}
                        </span>
                      ))}
                    </div>
                  </button>

                  {/* Expanded Detail */}
                  {isExpanded && (
                    <div className="border-t border-border/50 p-4 bg-navy/[0.02]">
                      {/* Drill Diagram */}
                      {drill.diagram_url ? (
                        <div className="mb-3">
                          <img
                            src={assetUrl(drill.diagram_url)}
                            alt={`${drill.name} diagram`}
                            className="w-full max-h-52 object-contain rounded-lg border border-border/30 bg-white p-2"
                          />
                        </div>
                      ) : (
                        <div className="mb-3 h-28 rounded-lg border border-dashed border-border/50 bg-navy/[0.02] flex items-center justify-center">
                          <div className="text-center text-muted/40">
                            <svg viewBox="0 0 200 100" className="w-20 h-10 mx-auto mb-1 opacity-30">
                              <rect x="5" y="5" width="190" height="90" rx="20" fill="none" stroke="#0F2A3D" strokeWidth="2"/>
                              <line x1="100" y1="5" x2="100" y2="95" stroke="#CC0000" strokeWidth="1.5"/>
                              <circle cx="100" cy="50" r="15" fill="none" stroke="#CC0000" strokeWidth="1"/>
                            </svg>
                            <span className="text-[9px] font-oswald uppercase tracking-wider">No Diagram</span>
                          </div>
                        </div>
                      )}

                      {/* Upload/Replace Diagram */}
                      <div className="flex items-center gap-2 mb-3">
                        <label className="cursor-pointer text-[10px] font-oswald uppercase tracking-wider text-teal hover:text-teal/80 flex items-center gap-1 transition-colors">
                          <Upload size={10} />
                          {drill.diagram_url ? "Replace Diagram" : "Upload Diagram"}
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/svg+xml"
                            className="hidden"
                            onChange={(e) => handleDiagramUpload(drill.id, e)}
                          />
                        </label>
                      </div>

                      <div className="space-y-3 text-sm text-navy/80">
                        {drill.setup && (
                          <div>
                            <h4 className="text-[10px] font-oswald uppercase tracking-wider text-muted mb-1">Setup</h4>
                            <p className="text-xs leading-relaxed">{drill.setup}</p>
                          </div>
                        )}
                        <div>
                          <h4 className="text-[10px] font-oswald uppercase tracking-wider text-muted mb-1">Description</h4>
                          <p className="text-xs leading-relaxed">{drill.description}</p>
                        </div>
                        {drill.coaching_points && (
                          <div>
                            <h4 className="text-[10px] font-oswald uppercase tracking-wider text-teal mb-1">Coaching Points</h4>
                            <p className="text-xs leading-relaxed">{drill.coaching_points}</p>
                          </div>
                        )}
                        {drill.equipment && drill.equipment !== "None" && (
                          <div>
                            <h4 className="text-[10px] font-oswald uppercase tracking-wider text-muted mb-1">Equipment</h4>
                            <p className="text-xs">{drill.equipment}</p>
                          </div>
                        )}
                        {drill.concept_id && (
                          <div className="text-[10px] text-muted/50">
                            Concept: {drill.concept_id}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </ProtectedRoute>
  );
}
