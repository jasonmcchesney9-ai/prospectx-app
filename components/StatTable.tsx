"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Pencil, Trash2, Check, X, Loader2 } from "lucide-react";
import type { PlayerStats } from "@/types/api";
import api from "@/lib/api";

function formatTOI(seconds: number): string {
  if (!seconds) return "—";
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

/** Format per-game average TOI from total seconds / GP */
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

  if (stats.length === 0) {
    return (
      <div className="text-center py-8 text-muted text-sm">
        No stats available for this player.
      </div>
    );
  }

  // Separate season summaries from game logs
  const seasonStats = stats.filter((s) => s.stat_type === "season");
  const gameLogs = stats.filter((s) => s.stat_type === "game");

  // Sort season stats by season descending
  seasonStats.sort((a, b) => (b.season || "").localeCompare(a.season || ""));

  // Sort game logs by date (from microstats) descending
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
      gp: s.gp,
      g: s.g,
      a: s.a,
      p: s.p,
      plus_minus: s.plus_minus,
      pim: s.pim,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValues({});
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setSaving(true);
    try {
      await api.put(`/stats/${editingId}`, editValues);
      setEditingId(null);
      setEditValues({});
      onStatsChange?.();
    } catch {
      // Ignore
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
    const num = parseInt(value, 10);
    setEditValues(prev => ({
      ...prev,
      [field]: field === "season" ? value : (isNaN(num) ? 0 : num),
    }));
    // Auto-calc points when g or a changes
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
              <tr className="border-b border-border text-left">
                <th className="px-3 py-2 font-oswald text-xs uppercase tracking-wider text-muted">Season</th>
                <th className="px-3 py-2 font-oswald text-xs uppercase tracking-wider text-muted text-center">GP</th>
                <th className="px-3 py-2 font-oswald text-xs uppercase tracking-wider text-muted text-center">G</th>
                <th className="px-3 py-2 font-oswald text-xs uppercase tracking-wider text-muted text-center">A</th>
                <th className="px-3 py-2 font-oswald text-xs uppercase tracking-wider text-muted text-center">P</th>
                <th className="px-3 py-2 font-oswald text-xs uppercase tracking-wider text-muted text-center">+/-</th>
                <th className="px-3 py-2 font-oswald text-xs uppercase tracking-wider text-muted text-center">PIM</th>
                <th className="px-3 py-2 font-oswald text-xs uppercase tracking-wider text-muted text-center">TOI/GP</th>
                <th className="px-3 py-2 font-oswald text-xs uppercase tracking-wider text-muted text-center">S%</th>
                <th className="px-3 py-2 font-oswald text-xs uppercase tracking-wider text-muted text-center">P/GP</th>
                {editable && <th className="px-2 py-2 font-oswald text-xs uppercase tracking-wider text-muted text-center w-20">Edit</th>}
              </tr>
            </thead>
            <tbody>
              {seasonStats.map((s) => {
                const isEditing = editingId === s.id;
                return (
                  <tr key={s.id} className={`border-b border-border/50 ${isEditing ? "bg-teal/5" : "hover:bg-navy/[0.02]"}`}>
                    <td className="px-3 py-2.5 font-semibold text-navy">
                      {isEditing ? (
                        <input className="w-24 px-1.5 py-1 text-sm border border-teal/30 rounded bg-white focus:ring-2 focus:ring-teal/20 outline-none"
                          value={editValues.season as string} onChange={e => editField("season", e.target.value)} />
                      ) : s.season || "—"}
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
                    {editable && (
                      <td className="px-2 py-2.5 text-center">
                        {isEditing ? (
                          <div className="flex items-center gap-1 justify-center">
                            <button onClick={saveEdit} disabled={saving}
                              className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors disabled:opacity-50">
                              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                            </button>
                            <button onClick={cancelEdit} className="p-1 text-red-500 hover:bg-red-50 rounded transition-colors">
                              <X size={14} />
                            </button>
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

      {/* If no season stats but we have game logs, show a note */}
      {seasonStats.length === 0 && gameLogs.length > 0 && (
        <p className="text-xs text-muted px-3 py-2">
          No season summary available. Showing game logs only.
        </p>
      )}

      {/* Game Logs — Collapsible */}
      {gameLogs.length > 0 && (
        <div className="border-t border-border">
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
                  <tr className="border-b border-border text-left">
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
                      <tr
                        key={s.id}
                        className={`border-b border-border/30 ${
                          hasPoints ? "bg-teal/[0.03]" : "hover:bg-navy/[0.02]"
                        }`}
                      >
                        <td className="px-3 py-1.5 text-muted whitespace-nowrap">
                          {(micro.date as string) || "—"}
                        </td>
                        <td className="px-3 py-1.5 text-navy font-medium whitespace-nowrap">
                          {(micro.opponent as string) || "—"}
                          {micro.score ? (
                            <span className="text-muted/50 ml-1.5">({String(micro.score)})</span>
                          ) : null}
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
                        <td className="px-3 py-1.5 text-center text-muted">
                          {s.shooting_pct != null ? `${s.shooting_pct}%` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Fallback: if we only have stats with no type distinction, show flat table */}
      {seasonStats.length === 0 && gameLogs.length === 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-3 py-2 font-oswald text-xs uppercase tracking-wider text-muted">Season</th>
                <th className="px-3 py-2 font-oswald text-xs uppercase tracking-wider text-muted">Type</th>
                <th className="px-3 py-2 font-oswald text-xs uppercase tracking-wider text-muted text-center">GP</th>
                <th className="px-3 py-2 font-oswald text-xs uppercase tracking-wider text-muted text-center">G</th>
                <th className="px-3 py-2 font-oswald text-xs uppercase tracking-wider text-muted text-center">A</th>
                <th className="px-3 py-2 font-oswald text-xs uppercase tracking-wider text-muted text-center">P</th>
                <th className="px-3 py-2 font-oswald text-xs uppercase tracking-wider text-muted text-center">+/-</th>
                <th className="px-3 py-2 font-oswald text-xs uppercase tracking-wider text-muted text-center">PIM</th>
                <th className="px-3 py-2 font-oswald text-xs uppercase tracking-wider text-muted text-center">TOI</th>
                <th className="px-3 py-2 font-oswald text-xs uppercase tracking-wider text-muted text-center">S%</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((s) => (
                <tr key={s.id} className="border-b border-border/50 hover:bg-navy/[0.02]">
                  <td className="px-3 py-2 font-medium text-navy">{s.season || "—"}</td>
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
                  <td className="px-3 py-2 text-center text-muted">
                    {s.shooting_pct != null ? `${s.shooting_pct}%` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
