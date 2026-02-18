"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Pencil, Trash2, Check, X, Loader2 } from "lucide-react";
import type { PlayerStats } from "@/types/api";
import api from "@/lib/api";

const NOTE_PRESETS = [
  "Injured",
  "Limited Role",
  "Suspended",
  "Recalled",
  "Called Up",
  "Traded",
  "AP (Affiliate)",
  "Import Player",
  "Playoff Only",
];

function formatTOI(seconds: number): string {
  if (!seconds) return "—";
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

function formatAvgTOI(totalSeconds: number, gp: number): string {
  if (!totalSeconds || !gp) return "—";
  const avg = Math.round(totalSeconds / gp);
  const min = Math.floor(avg / 60);
  const sec = avg % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

interface StatTableProps {
  stats: PlayerStats[];
  editable?: boolean;
  onStatsChange?: () => void;
}

export default function StatTable({ stats, editable = false, onStatsChange }: StatTableProps) {
  const [showGameLogs, setShowGameLogs] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, number | string>>({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showNotePresets, setShowNotePresets] = useState(false);

  if (stats.length === 0) {
    return (
      <div className="text-center py-8 text-muted text-sm">
        No stats available for this player.
      </div>
    );
  }

  const seasonStats = stats.filter((s) => s.stat_type === "season");
  const gameLogs = stats.filter((s) => s.stat_type === "game");

  seasonStats.sort((a, b) => (b.season || "").localeCompare(a.season || ""));
  gameLogs.sort((a, b) => {
    const dateA = String(a.microstats?.date || "");
    const dateB = String(b.microstats?.date || "");
    if (dateA && dateB) return dateB.localeCompare(dateA);
    return 0;
  });

  const startEdit = (s: PlayerStats) => {
    setEditingId(s.id);
    setEditValues({
      season: s.season || "",
      team_name: s.team_name || "",
      gp: s.gp,
      g: s.g,
      a: s.a,
      p: s.p,
      plus_minus: s.plus_minus,
      pim: s.pim,
      notes: s.notes || "",
    });
    setShowNotePresets(false);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValues({});
    setShowNotePresets(false);
  };

  const [saveError, setSaveError] = useState<string | null>(null);

  const saveEdit = async () => {
    if (!editingId) return;
    setSaving(true);
    setSaveError(null);
    try {
      await api.put(`/stats/${editingId}`, editValues);
      setEditingId(null);
      setEditValues({});
      setShowNotePresets(false);
      onStatsChange?.();
    } catch (err: unknown) {
      const msg = err && typeof err === "object" && "response" in err
        ? String((err as { response?: { data?: { detail?: string } } }).response?.data?.detail || "Save failed")
        : "Save failed — check connection";
      setSaveError(msg);
      console.error("Stat save error:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (statId: string) => {
    if (!confirm("Delete this stat row? This cannot be undone.")) return;
    setDeleting(statId);
    try {
      await api.delete(`/stats/${statId}`);
      onStatsChange?.();
    } catch {
      // Ignore
    } finally {
      setDeleting(null);
    }
  };

  const editField = (field: string, value: string) => {
    if (field === "season" || field === "team_name" || field === "notes") {
      setEditValues(prev => ({ ...prev, [field]: value }));
      return;
    }
    const num = parseInt(value, 10);
    setEditValues(prev => ({
      ...prev,
      [field]: isNaN(num) ? 0 : num,
    }));
    if (field === "g" || field === "a") {
      const g = field === "g" ? (isNaN(num) ? 0 : num) : (editValues.g as number || 0);
      const a = field === "a" ? (isNaN(num) ? 0 : num) : (editValues.a as number || 0);
      setEditValues(prev => ({ ...prev, p: g + a }));
    }
  };

  const inputClass = "w-14 px-1.5 py-1 text-center text-sm border border-teal/30 rounded bg-white focus:ring-2 focus:ring-teal/20 focus:border-teal outline-none";

  return (
    <div>
      {/* Season Summary Table */}
      {seasonStats.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-teal/20 text-left">
                <th className="px-3 py-2 font-oswald text-xs uppercase tracking-wider text-muted">Season</th>
                <th className="px-3 py-2 font-oswald text-xs uppercase tracking-wider text-muted">Team</th>
                <th className="px-3 py-2 font-oswald text-xs uppercase tracking-wider text-muted text-center">GP</th>
                <th className="px-3 py-2 font-oswald text-xs uppercase tracking-wider text-muted text-center">G</th>
                <th className="px-3 py-2 font-oswald text-xs uppercase tracking-wider text-muted text-center">A</th>
                <th className="px-3 py-2 font-oswald text-xs uppercase tracking-wider text-muted text-center">P</th>
                <th className="px-3 py-2 font-oswald text-xs uppercase tracking-wider text-muted text-center">+/-</th>
                <th className="px-3 py-2 font-oswald text-xs uppercase tracking-wider text-muted text-center">PIM</th>
                <th className="px-3 py-2 font-oswald text-xs uppercase tracking-wider text-muted text-center">TOI/GP</th>
                <th className="px-3 py-2 font-oswald text-xs uppercase tracking-wider text-muted text-center">S%</th>
                <th className="px-3 py-2 font-oswald text-xs uppercase tracking-wider text-muted text-center">P/GP</th>
                <th className="px-3 py-2 font-oswald text-xs uppercase tracking-wider text-muted">Notes</th>
                {editable && <th className="px-2 py-2 font-oswald text-xs uppercase tracking-wider text-muted text-center w-20">Edit</th>}
              </tr>
            </thead>
            <tbody>
              {seasonStats.map((s) => {
                const isEditing = editingId === s.id;
                return (
                  <tr key={s.id} className={`border-b border-teal/10 ${isEditing ? "bg-teal/5" : "hover:bg-navy/[0.02]"}`}>
                    <td className="px-3 py-2.5 font-semibold text-navy whitespace-nowrap">
                      {isEditing ? (
                        <input className="w-24 px-1.5 py-1 text-sm border border-teal/30 rounded bg-white focus:ring-2 focus:ring-teal/20 outline-none"
                          value={editValues.season as string} onChange={e => editField("season", e.target.value)} />
                      ) : (
                        <span className="flex items-center gap-1.5">
                          {s.season || "—"}
                          {s.data_source && s.data_source !== "manual" && (
                            <span className={`inline-flex px-1 py-0.5 rounded text-[8px] font-oswald uppercase tracking-wide ${
                              s.data_source === "hockeytech" ? "bg-blue-100 text-blue-600" :
                              s.data_source?.startsWith("instat") ? "bg-purple-100 text-purple-600" :
                              "bg-gray-100 text-gray-500"
                            }`} title={`Source: ${s.data_source}`}>
                              {s.data_source === "hockeytech" ? "HT" : s.data_source?.startsWith("instat") ? "IS" : s.data_source}
                            </span>
                          )}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-navy/70 text-xs whitespace-nowrap">
                      {isEditing ? (
                        <input className="w-28 px-1.5 py-1 text-sm border border-teal/30 rounded bg-white focus:ring-2 focus:ring-teal/20 outline-none"
                          placeholder="Team name"
                          value={editValues.team_name as string} onChange={e => editField("team_name", e.target.value)} />
                      ) : s.team_name ? (
                        <span className="truncate max-w-[120px] inline-block" title={s.team_name}>{s.team_name}</span>
                      ) : (
                        <span className="text-muted/30">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-center font-medium">
                      {isEditing ? <input className={inputClass} value={editValues.gp as number} onChange={e => editField("gp", e.target.value)} /> : s.gp}
                    </td>
                    <td className="px-3 py-2.5 text-center font-semibold">
                      {isEditing ? <input className={inputClass} value={editValues.g as number} onChange={e => editField("g", e.target.value)} /> : s.g}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {isEditing ? <input className={inputClass} value={editValues.a as number} onChange={e => editField("a", e.target.value)} /> : s.a}
                    </td>
                    <td className="px-3 py-2.5 text-center font-semibold text-teal">
                      {isEditing ? <input className={inputClass} value={editValues.p as number} onChange={e => editField("p", e.target.value)} /> : s.p}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {isEditing ? (
                        <input className={inputClass} value={editValues.plus_minus as number} onChange={e => editField("plus_minus", e.target.value)} />
                      ) : (
                        <span className={s.plus_minus > 0 ? "text-green-600" : s.plus_minus < 0 ? "text-red-600" : ""}>
                          {s.plus_minus > 0 ? "+" : ""}{s.plus_minus}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {isEditing ? <input className={inputClass} value={editValues.pim as number} onChange={e => editField("pim", e.target.value)} /> : s.pim}
                    </td>
                    <td className="px-3 py-2.5 text-center text-muted">{formatAvgTOI(s.toi_seconds, s.gp)}</td>
                    <td className="px-3 py-2.5 text-center text-muted">
                      {s.shooting_pct != null ? `${s.shooting_pct}%` : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-center font-medium text-navy">
                      {s.gp > 0 ? (s.p / s.gp).toFixed(2) : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                      {isEditing ? (
                        <div className="relative">
                          <input
                            className="w-28 px-1.5 py-1 text-xs border border-teal/30 rounded bg-white focus:ring-2 focus:ring-teal/20 outline-none"
                            placeholder="e.g. Injured"
                            value={editValues.notes as string}
                            onChange={e => editField("notes", e.target.value)}
                            onFocus={() => setShowNotePresets(true)}
                          />
                          {showNotePresets && (
                            <div className="absolute left-0 top-full mt-1 w-40 bg-white border border-teal/20 rounded-lg shadow-lg z-50 py-1 max-h-40 overflow-y-auto">
                              {NOTE_PRESETS.map(preset => (
                                <button
                                  key={preset}
                                  type="button"
                                  onClick={() => {
                                    editField("notes", preset);
                                    setShowNotePresets(false);
                                  }}
                                  className="w-full text-left px-2.5 py-1.5 text-xs text-navy hover:bg-teal/5 transition-colors"
                                >
                                  {preset}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : s.notes ? (
                        <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-oswald font-bold uppercase tracking-wider ${
                          s.notes.toLowerCase().includes("injur") ? "bg-red-100 text-red-700" :
                          s.notes.toLowerCase().includes("suspend") ? "bg-yellow-100 text-yellow-700" :
                          s.notes.toLowerCase().includes("limit") ? "bg-orange/10 text-orange" :
                          s.notes.toLowerCase().includes("traded") ? "bg-purple-100 text-purple-700" :
                          "bg-navy/5 text-navy/60"
                        }`}>
                          {s.notes}
                        </span>
                      ) : (
                        <span className="text-muted/20">—</span>
                      )}
                    </td>
                    {editable && (
                      <td className="px-2 py-2.5 text-center">
                        {isEditing ? (
                          <div className="flex flex-col items-center gap-0.5">
                            <div className="flex items-center gap-1">
                              <button onClick={saveEdit} disabled={saving}
                                className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors disabled:opacity-50">
                                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                              </button>
                              <button onClick={cancelEdit} className="p-1 text-red-500 hover:bg-red-50 rounded transition-colors">
                                <X size={14} />
                              </button>
                            </div>
                            {saveError && <span className="text-[9px] text-red-500 max-w-[80px] truncate" title={saveError}>{saveError}</span>}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 justify-center">
                            <button onClick={() => startEdit(s)}
                              className="p-1 text-muted hover:text-teal hover:bg-teal/10 rounded transition-colors" title="Edit">
                              <Pencil size={13} />
                            </button>
                            <button onClick={() => handleDelete(s.id)} disabled={deleting === s.id}
                              className="p-1 text-muted hover:text-red-500 hover:bg-red-50 rounded transition-colors disabled:opacity-50" title="Delete">
                              {deleting === s.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                            </button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {seasonStats.length === 0 && gameLogs.length > 0 && (
        <p className="text-xs text-muted px-3 py-2">
          No season summary available. Showing game logs only.
        </p>
      )}

      {/* Game Logs — Collapsible */}
      {gameLogs.length > 0 && (
        <div className="border-t border-teal/20">
          <button
            onClick={() => setShowGameLogs(!showGameLogs)}
            className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-navy/[0.02] transition-colors"
          >
            <span className="text-xs font-oswald uppercase tracking-wider text-muted">
              Game Logs ({gameLogs.length} games)
            </span>
            <span className="flex items-center gap-1 text-xs text-teal">
              {showGameLogs ? (
                <>Hide <ChevronUp size={12} /></>
              ) : (
                <>Show <ChevronDown size={12} /></>
              )}
            </span>
          </button>

          {showGameLogs && (
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-teal/20 text-left">
                    <th className="px-3 py-1.5 font-oswald text-[10px] uppercase tracking-wider text-muted">Date</th>
                    <th className="px-3 py-1.5 font-oswald text-[10px] uppercase tracking-wider text-muted">Opponent</th>
                    <th className="px-3 py-1.5 font-oswald text-[10px] uppercase tracking-wider text-muted text-center">G</th>
                    <th className="px-3 py-1.5 font-oswald text-[10px] uppercase tracking-wider text-muted text-center">A</th>
                    <th className="px-3 py-1.5 font-oswald text-[10px] uppercase tracking-wider text-muted text-center">P</th>
                    <th className="px-3 py-1.5 font-oswald text-[10px] uppercase tracking-wider text-muted text-center">+/-</th>
                    <th className="px-3 py-1.5 font-oswald text-[10px] uppercase tracking-wider text-muted text-center">PIM</th>
                    <th className="px-3 py-1.5 font-oswald text-[10px] uppercase tracking-wider text-muted text-center">TOI</th>
                    <th className="px-3 py-1.5 font-oswald text-[10px] uppercase tracking-wider text-muted text-center">SOG</th>
                    <th className="px-3 py-1.5 font-oswald text-[10px] uppercase tracking-wider text-muted text-center">S%</th>
                  </tr>
                </thead>
                <tbody>
                  {gameLogs.map((s) => {
                    const micro = s.microstats || ({} as Record<string, unknown>);
                    const hasPoints = s.g > 0 || s.a > 0;
                    return (
                      <tr key={s.id} className={`border-b border-teal/8 ${hasPoints ? "bg-teal/[0.03]" : "hover:bg-navy/[0.02]"}`}>
                        <td className="px-3 py-1.5 text-muted whitespace-nowrap">{(micro.date as string) || "—"}</td>
                        <td className="px-3 py-1.5 text-navy font-medium whitespace-nowrap">
                          {(micro.opponent as string) || "—"}
                          {micro.score ? <span className="text-muted/50 ml-1.5">({String(micro.score)})</span> : null}
                        </td>
                        <td className="px-3 py-1.5 text-center font-semibold">
                          {s.g > 0 ? <span className="text-navy">{s.g}</span> : <span className="text-muted/30">0</span>}
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          {s.a > 0 ? <span className="text-navy">{s.a}</span> : <span className="text-muted/30">0</span>}
                        </td>
                        <td className="px-3 py-1.5 text-center font-semibold">
                          {s.p > 0 ? <span className="text-teal">{s.p}</span> : <span className="text-muted/30">0</span>}
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          <span className={s.plus_minus > 0 ? "text-green-600" : s.plus_minus < 0 ? "text-red-600" : "text-muted/30"}>
                            {s.plus_minus > 0 ? "+" : ""}{s.plus_minus}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          {s.pim > 0 ? <span className="text-orange">{s.pim}</span> : <span className="text-muted/30">0</span>}
                        </td>
                        <td className="px-3 py-1.5 text-center text-muted">{formatTOI(s.toi_seconds)}</td>
                        <td className="px-3 py-1.5 text-center text-muted">{s.sog || "—"}</td>
                        <td className="px-3 py-1.5 text-center text-muted">{s.shooting_pct != null ? `${s.shooting_pct}%` : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Fallback flat table */}
      {seasonStats.length === 0 && gameLogs.length === 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-teal/20 text-left">
                <th className="px-3 py-2 font-oswald text-xs uppercase tracking-wider text-muted">Season</th>
                <th className="px-3 py-2 font-oswald text-xs uppercase tracking-wider text-muted">Team</th>
                <th className="px-3 py-2 font-oswald text-xs uppercase tracking-wider text-muted">Type</th>
                <th className="px-3 py-2 font-oswald text-xs uppercase tracking-wider text-muted text-center">GP</th>
                <th className="px-3 py-2 font-oswald text-xs uppercase tracking-wider text-muted text-center">G</th>
                <th className="px-3 py-2 font-oswald text-xs uppercase tracking-wider text-muted text-center">A</th>
                <th className="px-3 py-2 font-oswald text-xs uppercase tracking-wider text-muted text-center">P</th>
                <th className="px-3 py-2 font-oswald text-xs uppercase tracking-wider text-muted text-center">+/-</th>
                <th className="px-3 py-2 font-oswald text-xs uppercase tracking-wider text-muted text-center">PIM</th>
                <th className="px-3 py-2 font-oswald text-xs uppercase tracking-wider text-muted text-center">TOI</th>
                <th className="px-3 py-2 font-oswald text-xs uppercase tracking-wider text-muted text-center">S%</th>
                <th className="px-3 py-2 font-oswald text-xs uppercase tracking-wider text-muted">Notes</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((s) => (
                <tr key={s.id} className="border-b border-teal/10 hover:bg-navy/[0.02]">
                  <td className="px-3 py-2 font-medium text-navy">{s.season || "—"}</td>
                  <td className="px-3 py-2 text-xs text-navy/70">{s.team_name || "—"}</td>
                  <td className="px-3 py-2 text-muted capitalize">{s.stat_type}</td>
                  <td className="px-3 py-2 text-center">{s.gp}</td>
                  <td className="px-3 py-2 text-center font-semibold">{s.g}</td>
                  <td className="px-3 py-2 text-center">{s.a}</td>
                  <td className="px-3 py-2 text-center font-semibold text-teal">{s.p}</td>
                  <td className="px-3 py-2 text-center">
                    <span className={s.plus_minus > 0 ? "text-green-600" : s.plus_minus < 0 ? "text-red-600" : ""}>
                      {s.plus_minus > 0 ? "+" : ""}{s.plus_minus}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">{s.pim}</td>
                  <td className="px-3 py-2 text-center text-muted">{formatTOI(s.toi_seconds)}</td>
                  <td className="px-3 py-2 text-center text-muted">{s.shooting_pct != null ? `${s.shooting_pct}%` : "—"}</td>
                  <td className="px-3 py-2 text-xs text-muted">{s.notes || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
