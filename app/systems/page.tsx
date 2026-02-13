"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  PlusCircle,
  Shield,
  Swords,
  Target,
  Zap,
  Edit3,
  Trash2,
  Save,
  X,
  ChevronDown,
  ChevronUp,
  BookOpen,
} from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import api from "@/lib/api";
import type { SystemLibraryEntry, TeamSystem } from "@/types/api";

type SystemType = "forecheck" | "dz_coverage" | "oz_setup" | "breakout" | "pk_formation";

const SYSTEM_TYPE_LABELS: Record<string, string> = {
  forecheck: "Forecheck",
  dz_coverage: "Defensive Zone",
  oz_setup: "Offensive Zone / PP",
  breakout: "Breakout",
  pk_formation: "Penalty Kill",
};

const SYSTEM_TYPE_ICONS: Record<string, typeof Swords> = {
  forecheck: Swords,
  dz_coverage: Shield,
  oz_setup: Target,
  breakout: Zap,
  pk_formation: Shield,
};

function SystemTypeColor(type: string): string {
  switch (type) {
    case "forecheck": return "text-orange bg-orange/10 border-orange/30";
    case "dz_coverage": return "text-navy bg-navy/10 border-navy/30";
    case "oz_setup": return "text-teal bg-teal/10 border-teal/30";
    case "breakout": return "text-orange bg-orange/10 border-orange/30";
    case "pk_formation": return "text-navy bg-navy/10 border-navy/30";
    default: return "text-muted bg-gray-50 border-border";
  }
}

// Empty form for new team system
const EMPTY_FORM = {
  team_name: "",
  season: "2025-26",
  forecheck: "",
  dz_structure: "",
  oz_setup: "",
  pp_formation: "",
  pk_formation: "",
  neutral_zone: "",
  breakout: "",
  identity_tags: [] as string[],
  notes: "",
};

const IDENTITY_TAG_OPTIONS = [
  "aggressive", "structured", "physical", "speed", "skill", "defensive",
  "high-event", "low-event", "puck-possession", "transition", "grind",
  "counter-attack", "cycle-heavy", "shooting-team",
];

export default function SystemsPage() {
  const [library, setLibrary] = useState<SystemLibraryEntry[]>([]);
  const [teamSystems, setTeamSystems] = useState<TeamSystem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  // Library browser
  const [showLibrary, setShowLibrary] = useState(false);
  const [libraryFilter, setLibraryFilter] = useState<string>("");

  const loadData = useCallback(async () => {
    try {
      setError("");
      const [libRes, sysRes] = await Promise.all([
        api.get<SystemLibraryEntry[]>("/hockey-os/systems-library"),
        api.get<TeamSystem[]>("/hockey-os/team-systems"),
      ]);
      setLibrary(libRes.data);
      setTeamSystems(sysRes.data);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed to load";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSave = async () => {
    if (!form.team_name.trim()) return;
    setSaving(true);
    try {
      if (editingId) {
        await api.put(`/hockey-os/team-systems/${editingId}`, form);
      } else {
        await api.post("/hockey-os/team-systems", form);
      }
      setShowForm(false);
      setEditingId(null);
      setForm({ ...EMPTY_FORM });
      loadData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed to save";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (sys: TeamSystem) => {
    setForm({
      team_name: sys.team_name,
      season: sys.season || "2025-26",
      forecheck: sys.forecheck || "",
      dz_structure: sys.dz_structure || "",
      oz_setup: sys.oz_setup || "",
      pp_formation: sys.pp_formation || "",
      pk_formation: sys.pk_formation || "",
      neutral_zone: sys.neutral_zone || "",
      breakout: sys.breakout || "",
      identity_tags: sys.identity_tags || [],
      notes: sys.notes || "",
    });
    setEditingId(sys.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this team system profile?")) return;
    await api.delete(`/hockey-os/team-systems/${id}`);
    loadData();
  };

  // Group library entries by type
  const libraryByType = library.reduce((acc, entry) => {
    if (!acc[entry.system_type]) acc[entry.system_type] = [];
    acc[entry.system_type].push(entry);
    return acc;
  }, {} as Record<string, SystemLibraryEntry[]>);

  // Get options for a dropdown from library
  const getOptions = (type: string) => library.filter((e) => e.system_type === type);

  return (
    <ProtectedRoute>
      <NavBar />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-navy">Team Systems</h1>
            <p className="text-sm text-muted mt-1">Define how your teams play — forecheck, DZ coverage, breakouts, and more.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowLibrary(!showLibrary)}
              className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm text-muted hover:text-navy hover:border-navy/30 transition-colors"
            >
              <BookOpen size={16} />
              Systems Library
            </button>
            <button
              onClick={() => { setShowForm(true); setEditingId(null); setForm({ ...EMPTY_FORM }); }}
              className="flex items-center gap-2 px-4 py-2 bg-teal text-white text-sm font-oswald font-semibold uppercase tracking-wider rounded-lg hover:bg-teal/90 transition-colors"
            >
              <PlusCircle size={16} />
              New Team System
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            {error}
            <button onClick={() => setError("")} className="ml-2 text-red-500">&times;</button>
          </div>
        )}

        {/* Systems Library Browser */}
        {showLibrary && (
          <div className="mb-6 bg-white rounded-xl border border-border p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-navy">Systems Library</h2>
              <button onClick={() => setShowLibrary(false)} className="text-muted hover:text-navy"><X size={18} /></button>
            </div>
            <div className="flex gap-2 mb-4 flex-wrap">
              <button
                onClick={() => setLibraryFilter("")}
                className={`px-3 py-1.5 rounded-lg text-xs font-oswald uppercase tracking-wider border transition-colors ${
                  !libraryFilter ? "bg-navy text-white border-navy" : "bg-white text-muted border-border hover:border-navy/30"
                }`}
              >All</button>
              {Object.keys(SYSTEM_TYPE_LABELS).map((type) => (
                <button
                  key={type}
                  onClick={() => setLibraryFilter(type)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-oswald uppercase tracking-wider border transition-colors ${
                    libraryFilter === type ? "bg-navy text-white border-navy" : "bg-white text-muted border-border hover:border-navy/30"
                  }`}
                >{SYSTEM_TYPE_LABELS[type]}</button>
              ))}
            </div>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {Object.entries(libraryByType)
                .filter(([type]) => !libraryFilter || type === libraryFilter)
                .map(([type, entries]) => (
                <div key={type}>
                  <h3 className="text-xs font-oswald uppercase tracking-wider text-muted mb-2 sticky top-0 bg-white py-1">
                    {SYSTEM_TYPE_LABELS[type] || type}
                  </h3>
                  {entries.map((entry) => (
                    <div key={entry.id} className={`p-3 rounded-lg border mb-2 ${SystemTypeColor(type)}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold">{entry.name}</span>
                        <span className="text-[10px] font-mono opacity-60">{entry.code}</span>
                      </div>
                      <p className="text-xs opacity-80 leading-relaxed">{entry.description}</p>
                      {entry.ideal_personnel && (
                        <p className="text-[11px] opacity-60 mt-1"><strong>Ideal personnel:</strong> {entry.ideal_personnel}</p>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Create/Edit Form */}
        {showForm && (
          <div className="mb-6 bg-white rounded-xl border border-border p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-navy">
                {editingId ? "Edit Team System" : "New Team System"}
              </h2>
              <button onClick={() => { setShowForm(false); setEditingId(null); }} className="text-muted hover:text-navy"><X size={18} /></button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Team Name */}
              <div>
                <label className="block text-xs font-oswald uppercase tracking-wider text-muted mb-1">Team Name *</label>
                <input
                  type="text"
                  value={form.team_name}
                  onChange={(e) => setForm({ ...form, team_name: e.target.value })}
                  placeholder="e.g., Chatham Maroons"
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-oswald uppercase tracking-wider text-muted mb-1">Season</label>
                <input
                  type="text"
                  value={form.season}
                  onChange={(e) => setForm({ ...form, season: e.target.value })}
                  placeholder="2025-26"
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm"
                />
              </div>

              {/* System dropdowns */}
              {([
                ["forecheck", "Forecheck System", "forecheck"],
                ["dz_structure", "DZ Coverage", "dz_coverage"],
                ["oz_setup", "OZ Setup / PP", "oz_setup"],
                ["breakout", "Breakout System", "breakout"],
                ["pk_formation", "PK Formation", "pk_formation"],
              ] as [string, string, string][]).map(([field, label, libType]) => (
                <div key={field}>
                  <label className="block text-xs font-oswald uppercase tracking-wider text-muted mb-1">{label}</label>
                  <select
                    value={(form as Record<string, unknown>)[field] as string}
                    onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm"
                  >
                    <option value="">Select...</option>
                    {getOptions(libType).map((opt) => (
                      <option key={opt.code} value={opt.code}>{opt.name}</option>
                    ))}
                  </select>
                </div>
              ))}

              {/* Neutral Zone — freetext since not in library yet */}
              <div>
                <label className="block text-xs font-oswald uppercase tracking-wider text-muted mb-1">Neutral Zone</label>
                <input
                  type="text"
                  value={form.neutral_zone}
                  onChange={(e) => setForm({ ...form, neutral_zone: e.target.value })}
                  placeholder="e.g., 1-2-2 trap, aggressive NZ"
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm"
                />
              </div>
            </div>

            {/* Identity Tags */}
            <div className="mt-4">
              <label className="block text-xs font-oswald uppercase tracking-wider text-muted mb-2">Team Identity Tags</label>
              <div className="flex flex-wrap gap-2">
                {IDENTITY_TAG_OPTIONS.map((tag) => {
                  const active = form.identity_tags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => {
                        setForm({
                          ...form,
                          identity_tags: active
                            ? form.identity_tags.filter((t) => t !== tag)
                            : [...form.identity_tags, tag],
                        });
                      }}
                      className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                        active
                          ? "bg-teal/10 border-teal/30 text-teal font-semibold"
                          : "bg-white border-border text-muted hover:border-navy/30"
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Notes */}
            <div className="mt-4">
              <label className="block text-xs font-oswald uppercase tracking-wider text-muted mb-1">Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="System tendencies, special situations, coaching philosophy..."
                rows={3}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm"
              />
            </div>

            {/* Save/Cancel */}
            <div className="flex items-center gap-3 mt-4">
              <button
                onClick={handleSave}
                disabled={saving || !form.team_name.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-teal text-white text-sm font-oswald font-semibold uppercase tracking-wider rounded-lg hover:bg-teal/90 disabled:opacity-50 transition-colors"
              >
                <Save size={14} />
                {saving ? "Saving..." : editingId ? "Update" : "Create"}
              </button>
              <button
                onClick={() => { setShowForm(false); setEditingId(null); }}
                className="px-4 py-2 text-sm text-muted hover:text-navy transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Team Systems List */}
        {loading ? (
          <div className="flex items-center justify-center min-h-[30vh]">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-navy border-t-teal" />
          </div>
        ) : teamSystems.length === 0 && !showForm ? (
          <div className="text-center py-16 bg-white rounded-xl border border-border">
            <Shield size={40} className="mx-auto text-muted/30 mb-3" />
            <p className="text-muted text-sm mb-2">No team systems defined yet.</p>
            <p className="text-xs text-muted/60 mb-4">Define how your team plays — these profiles feed directly into AI report generation.</p>
            <button
              onClick={() => { setShowForm(true); setEditingId(null); setForm({ ...EMPTY_FORM }); }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-teal text-white text-sm font-oswald font-semibold uppercase tracking-wider rounded-lg hover:bg-teal/90 transition-colors"
            >
              <PlusCircle size={14} />
              Create First Team System
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {teamSystems.map((sys) => (
              <TeamSystemCard
                key={sys.id}
                system={sys}
                library={library}
                onEdit={() => handleEdit(sys)}
                onDelete={() => handleDelete(sys.id)}
              />
            ))}
          </div>
        )}
      </main>
    </ProtectedRoute>
  );
}

function TeamSystemCard({
  system,
  library,
  onEdit,
  onDelete,
}: {
  system: TeamSystem;
  library: SystemLibraryEntry[];
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const getSystemName = (code: string) => {
    const entry = library.find((e) => e.code === code);
    return entry?.name || code || "—";
  };

  const systemFields = [
    { label: "Forecheck", value: system.forecheck, icon: Swords },
    { label: "DZ Coverage", value: system.dz_structure, icon: Shield },
    { label: "OZ Setup", value: system.oz_setup, icon: Target },
    { label: "Breakout", value: system.breakout, icon: Zap },
    { label: "PK", value: system.pk_formation, icon: Shield },
  ].filter((f) => f.value);

  const tags = Array.isArray(system.identity_tags) ? system.identity_tags : [];

  return (
    <div className="bg-white rounded-xl border border-border overflow-hidden">
      <div
        className="px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-navy/[0.02] transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div>
          <h3 className="text-lg font-semibold text-navy">{system.team_name}</h3>
          <div className="flex items-center gap-3 mt-1">
            {system.season && <span className="text-xs text-muted">{system.season}</span>}
            {tags.map((tag) => (
              <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-teal/10 text-teal font-medium">
                {tag}
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="p-1.5 rounded hover:bg-navy/5 text-muted hover:text-navy transition-colors">
            <Edit3 size={14} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-1.5 rounded hover:bg-red-50 text-muted hover:text-red-600 transition-colors">
            <Trash2 size={14} />
          </button>
          {expanded ? <ChevronUp size={16} className="text-muted" /> : <ChevronDown size={16} className="text-muted" />}
        </div>
      </div>

      {/* Quick summary row */}
      {!expanded && systemFields.length > 0 && (
        <div className="px-5 pb-3 flex flex-wrap gap-2">
          {systemFields.map(({ label, value }) => (
            <span key={label} className="text-xs px-2 py-1 rounded bg-navy/[0.04] text-navy/80">
              <strong>{label}:</strong> {getSystemName(value)}
            </span>
          ))}
        </div>
      )}

      {/* Expanded details */}
      {expanded && (
        <div className="px-5 pb-5 border-t border-border/50 pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {systemFields.map(({ label, value, icon: Icon }) => {
              const entry = library.find((e) => e.code === value);
              return (
                <div key={label} className="p-3 rounded-lg bg-navy/[0.03] border border-border/50">
                  <div className="flex items-center gap-2 mb-1">
                    <Icon size={14} className="text-teal" />
                    <span className="text-xs font-oswald uppercase tracking-wider text-muted">{label}</span>
                  </div>
                  <p className="text-sm font-semibold text-navy">{entry?.name || value}</p>
                  {entry?.description && (
                    <p className="text-xs text-muted/70 mt-1 leading-relaxed">{entry.description}</p>
                  )}
                </div>
              );
            })}
          </div>
          {system.notes && (
            <div className="mt-3 p-3 rounded-lg bg-orange/5 border border-orange/20">
              <span className="text-xs font-oswald uppercase tracking-wider text-orange/60">Notes</span>
              <p className="text-sm text-navy/80 mt-1">{system.notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
