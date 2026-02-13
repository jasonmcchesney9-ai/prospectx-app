"use client";

import { useEffect, useState, useCallback } from "react";
import {
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
  Gauge,
  Flame,
  Crosshair,
} from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import api from "@/lib/api";
import type { SystemLibraryEntry, TeamSystem } from "@/types/api";

// ── Options ────────────────────────────────────────────────
const PACE_OPTIONS = ["Slow / Controlled", "Moderate", "Fast", "Up-Tempo / Push Pace"];
const PHYSICALITY_OPTIONS = ["Low", "Moderate", "High", "Very High / Intimidation"];
const OFFENSIVE_STYLE_OPTIONS = ["Cycle / Grind", "Rush / Transition", "Balanced", "Perimeter / Shot Volume", "Net-Front / Dirty Areas"];

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
  pace: "",
  physicality: "",
  offensive_style: "",
  notes: "",
};

// ── Page ───────────────────────────────────────────────────
export default function TeamSystemsPage() {
  const [library, setLibrary] = useState<SystemLibraryEntry[]>([]);
  const [teamSystems, setTeamSystems] = useState<TeamSystem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

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
      pace: sys.pace || "",
      physicality: sys.physicality || "",
      offensive_style: sys.offensive_style || "",
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

  const getOptions = (type: string) => library.filter((e) => e.system_type === type);
  const getSystemName = (code: string) => library.find((e) => e.code === code)?.name || code || "—";

  return (
    <ProtectedRoute>
      <NavBar />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-navy">Team Systems Configuration</h1>
          {!showForm && (
            <button
              onClick={() => { setShowForm(true); setEditingId(null); setForm({ ...EMPTY_FORM }); }}
              className="flex items-center gap-2 px-4 py-2 bg-teal text-white text-sm font-oswald font-semibold uppercase tracking-wider rounded-lg hover:bg-teal/90 transition-colors"
            >
              <PlusCircle size={16} />
              New Team
            </button>
          )}
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            {error}
            <button onClick={() => setError("")} className="ml-2 text-red-500">&times;</button>
          </div>
        )}

        {/* ── Form ─────────────────────────────────────────── */}
        {showForm && (
          <div className="mb-8 bg-white rounded-xl border border-border overflow-hidden">
            <div className="bg-gradient-to-r from-navy to-navy-light px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-oswald font-semibold text-white uppercase tracking-wider">
                {editingId ? "Edit Team System" : "Team Systems Configuration"}
              </h2>
              <button onClick={() => { setShowForm(false); setEditingId(null); }} className="text-white/60 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <div className="ice-stripe" />

            <div className="p-6 space-y-5">
              {/* Team */}
              <div>
                <label className="block text-xs font-oswald uppercase tracking-wider text-muted mb-1.5">Team</label>
                <input
                  type="text"
                  value={form.team_name}
                  onChange={(e) => setForm({ ...form, team_name: e.target.value })}
                  placeholder="e.g., Chatham Maroons"
                  className="w-full px-3 py-2.5 border border-border rounded-lg text-sm"
                />
              </div>

              {/* Season */}
              <div>
                <label className="block text-xs font-oswald uppercase tracking-wider text-muted mb-1.5">Season</label>
                <input
                  type="text"
                  value={form.season}
                  onChange={(e) => setForm({ ...form, season: e.target.value })}
                  placeholder="2025-26"
                  className="w-full px-3 py-2.5 border border-border rounded-lg text-sm"
                />
              </div>

              <hr className="border-border/50" />

              {/* Primary Forecheck */}
              <SystemSelect
                label="Primary Forecheck"
                value={form.forecheck}
                onChange={(v) => setForm({ ...form, forecheck: v })}
                options={getOptions("forecheck")}
              />

              {/* Defensive Zone */}
              <SystemSelect
                label="Defensive Zone"
                value={form.dz_structure}
                onChange={(v) => setForm({ ...form, dz_structure: v })}
                options={getOptions("dz_coverage")}
              />

              {/* Offensive Zone */}
              <SystemSelect
                label="Offensive Zone"
                value={form.oz_setup}
                onChange={(v) => setForm({ ...form, oz_setup: v })}
                options={getOptions("oz_setup")}
              />

              {/* Power Play */}
              <SystemSelect
                label="Power Play"
                value={form.pp_formation}
                onChange={(v) => setForm({ ...form, pp_formation: v })}
                options={getOptions("oz_setup")}
              />

              {/* Penalty Kill */}
              <SystemSelect
                label="Penalty Kill"
                value={form.pk_formation}
                onChange={(v) => setForm({ ...form, pk_formation: v })}
                options={getOptions("pk_formation")}
              />

              {/* Breakout */}
              <SystemSelect
                label="Breakout"
                value={form.breakout}
                onChange={(v) => setForm({ ...form, breakout: v })}
                options={getOptions("breakout")}
              />

              <hr className="border-border/50" />

              {/* Team Style */}
              <div>
                <h3 className="text-sm font-oswald uppercase tracking-wider text-navy mb-4">Team Style</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-oswald uppercase tracking-wider text-muted mb-1.5">Pace</label>
                    <select
                      value={form.pace}
                      onChange={(e) => setForm({ ...form, pace: e.target.value })}
                      className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white"
                    >
                      <option value="">Select...</option>
                      {PACE_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-oswald uppercase tracking-wider text-muted mb-1.5">Physicality</label>
                    <select
                      value={form.physicality}
                      onChange={(e) => setForm({ ...form, physicality: e.target.value })}
                      className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white"
                    >
                      <option value="">Select...</option>
                      {PHYSICALITY_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-oswald uppercase tracking-wider text-muted mb-1.5">Offensive Style</label>
                    <select
                      value={form.offensive_style}
                      onChange={(e) => setForm({ ...form, offensive_style: e.target.value })}
                      className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white"
                    >
                      <option value="">Select...</option>
                      {OFFENSIVE_STYLE_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Save */}
              <div className="pt-2">
                <button
                  onClick={handleSave}
                  disabled={saving || !form.team_name.trim()}
                  className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-teal text-white text-sm font-oswald font-semibold uppercase tracking-wider rounded-lg hover:bg-teal/90 disabled:opacity-50 transition-colors"
                >
                  <Save size={16} />
                  {saving ? "Saving..." : "Save Systems"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Team Systems List ─────────────────────────────── */}
        {loading ? (
          <div className="flex items-center justify-center min-h-[30vh]">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-navy border-t-teal" />
          </div>
        ) : teamSystems.length === 0 && !showForm ? (
          <div className="text-center py-16 bg-white rounded-xl border border-border">
            <Shield size={40} className="mx-auto text-muted/30 mb-3" />
            <p className="text-muted text-sm mb-2">No team systems defined yet.</p>
            <p className="text-xs text-muted/60 mb-4">
              Define how your team plays — these profiles feed directly into AI report generation.
            </p>
            <button
              onClick={() => { setShowForm(true); setEditingId(null); setForm({ ...EMPTY_FORM }); }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-teal text-white text-sm font-oswald font-semibold uppercase tracking-wider rounded-lg hover:bg-teal/90 transition-colors"
            >
              <PlusCircle size={14} />
              Create First Team System
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {teamSystems.map((sys) => (
              <TeamSystemCard
                key={sys.id}
                system={sys}
                getSystemName={getSystemName}
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

// ── Reusable full-width system dropdown ────────────────────
function SystemSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: SystemLibraryEntry[];
}) {
  return (
    <div>
      <label className="block text-xs font-oswald uppercase tracking-wider text-muted mb-1.5">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white"
      >
        <option value="">Select...</option>
        {options.map((opt) => (
          <option key={opt.code} value={opt.code}>{opt.name}</option>
        ))}
      </select>
    </div>
  );
}

// ── Compact card for the list ──────────────────────────────
function TeamSystemCard({
  system,
  getSystemName,
  onEdit,
  onDelete,
}: {
  system: TeamSystem;
  getSystemName: (code: string) => string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const systemPairs = [
    ["Forecheck", system.forecheck],
    ["DZ", system.dz_structure],
    ["OZ", system.oz_setup],
    ["PP", system.pp_formation],
    ["PK", system.pk_formation],
    ["Breakout", system.breakout],
  ].filter(([, v]) => v) as [string, string][];

  const stylePairs = [
    ["Pace", system.pace],
    ["Physicality", system.physicality],
    ["Offensive Style", system.offensive_style],
  ].filter(([, v]) => v) as [string, string][];

  const tags = Array.isArray(system.identity_tags) ? system.identity_tags : [];

  return (
    <div className="bg-white rounded-xl border border-border overflow-hidden">
      {/* Header row */}
      <div
        className="px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-navy/[0.02] transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-navy">{system.team_name}</h3>
            {system.season && (
              <span className="text-xs text-muted bg-navy/[0.04] px-2 py-0.5 rounded">{system.season}</span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {systemPairs.slice(0, 3).map(([label, code]) => (
              <span key={label} className="text-xs text-navy/70">
                <strong>{label}:</strong> {getSystemName(code)}
              </span>
            ))}
            {systemPairs.length > 3 && <span className="text-[10px] text-muted">+{systemPairs.length - 3} more</span>}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 ml-3">
          <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="p-1.5 rounded hover:bg-navy/5 text-muted hover:text-navy" title="Edit">
            <Edit3 size={14} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-1.5 rounded hover:bg-red-50 text-muted hover:text-red-600" title="Delete">
            <Trash2 size={14} />
          </button>
          {expanded ? <ChevronUp size={16} className="text-muted" /> : <ChevronDown size={16} className="text-muted" />}
        </div>
      </div>

      {/* Expanded */}
      {expanded && (
        <div className="px-5 pb-5 border-t border-border/50 pt-4 space-y-3">
          {/* Systems */}
          <div className="space-y-1.5">
            {systemPairs.map(([label, code]) => (
              <div key={label} className="flex items-center justify-between text-sm">
                <span className="text-muted">{label}</span>
                <span className="font-semibold text-navy">{getSystemName(code)}</span>
              </div>
            ))}
          </div>

          {/* Style */}
          {stylePairs.length > 0 && (
            <>
              <hr className="border-border/50" />
              <div className="space-y-1.5">
                {stylePairs.map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between text-sm">
                    <span className="text-muted">{label}</span>
                    <span className="font-semibold text-navy">{value}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Tags */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {tags.map((tag) => (
                <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-teal/10 text-teal font-medium">{tag}</span>
              ))}
            </div>
          )}

          {/* Notes */}
          {system.notes && (
            <p className="text-xs text-muted/70 italic pt-1">{system.notes}</p>
          )}
        </div>
      )}
    </div>
  );
}
