"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Users,
  Sparkles,
  Loader2,
  Save,
  LayoutGrid,
  List,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
} from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import api from "@/lib/api";
import ListenButton from "@/components/ListenButton";

/* ── Types ────────────────────────────────────────────────── */
interface RosterPlayer {
  id: string;
  first_name: string;
  last_name: string;
  position: string;
  jersey_number: string | null;
  birth_year: number | null;
  image_url: string | null;
  current_team: string | null;
  stats: { gp: number; g: number; a: number; p: number; plus_minus: number; pim: number; season: string | null } | null;
  goalie_stats: { gp: number; ga: number; sv: number; gaa: number | null; sv_pct: string | null } | null;
  pxr: { score: number; confidence_tier: number | null; gp: number | null } | null;
}

interface SlotPlayer {
  player_id: string;
  name: string;
  jersey: string;
  position: string;
}

interface LineGroup {
  order: number;
  label: string;
  players: SlotPlayer[];
}

interface LineupState {
  forwards: LineGroup[];
  defense: LineGroup[];
  goalies: LineGroup[];
}

type ViewMode = "lines" | "list";
type SortKey = "jersey" | "name" | "position" | "age" | "gp" | "g" | "a" | "p" | "ppg" | "pxr";
type SortDir = "asc" | "desc";

/* ── Helpers ──────────────────────────────────────────────── */
function playerAge(birthYear: number | null): number | null {
  return birthYear ? 2026 - birthYear : null;
}

function calcPPG(stats: RosterPlayer["stats"]): string {
  if (!stats || !stats.gp) return "—";
  return (stats.p / stats.gp).toFixed(2);
}

const FORWARD_POSITIONS = new Set(["LW", "C", "RW", "F", "W"]);
const DEFENSE_POSITIONS = new Set(["LD", "RD", "D"]);
const GOALIE_POSITIONS = new Set(["G"]);

function posGroup(pos: string): "F" | "D" | "G" {
  if (GOALIE_POSITIONS.has(pos)) return "G";
  if (DEFENSE_POSITIONS.has(pos)) return "D";
  return "F";
}

function toSlotPlayer(p: RosterPlayer): SlotPlayer {
  return { player_id: p.id, name: `${p.first_name} ${p.last_name}`, jersey: p.jersey_number || "", position: p.position };
}

/* ── Default Lineup Builder ────────────────────────────────── */
function buildDefaultLineup(players: RosterPlayer[]): LineupState {
  const forwards = players.filter(p => posGroup(p.position) === "F").sort((a, b) => (b.stats?.p || 0) - (a.stats?.p || 0));
  const defense = players.filter(p => posGroup(p.position) === "D").sort((a, b) => (b.stats?.p || 0) - (a.stats?.p || 0));
  const goalies = players.filter(p => posGroup(p.position) === "G").sort((a, b) => (b.goalie_stats?.gp || 0) - (a.goalie_stats?.gp || 0));

  const fwdLines: LineGroup[] = [
    { order: 1, label: "1st Line", players: forwards.slice(0, 3).map(toSlotPlayer) },
    { order: 2, label: "2nd Line", players: forwards.slice(3, 6).map(toSlotPlayer) },
    { order: 3, label: "3rd Line", players: forwards.slice(6, 9).map(toSlotPlayer) },
    { order: 4, label: "4th Line", players: forwards.slice(9, 12).map(toSlotPlayer) },
  ];
  const defPairs: LineGroup[] = [
    { order: 1, label: "1st Pair", players: defense.slice(0, 2).map(toSlotPlayer) },
    { order: 2, label: "2nd Pair", players: defense.slice(2, 4).map(toSlotPlayer) },
    { order: 3, label: "3rd Pair", players: defense.slice(4, 6).map(toSlotPlayer) },
  ];
  const goalieGroup: LineGroup[] = [
    { order: 1, label: "Goalies", players: goalies.slice(0, 2).map(toSlotPlayer) },
  ];

  return { forwards: fwdLines, defense: defPairs, goalies: goalieGroup };
}

/* ── Merge saved lines with roster ──────────────────────────── */
function mergeWithSavedLines(players: RosterPlayer[], savedLines: Array<{ line_type: string; line_order: number; line_label: string | null; player_refs: SlotPlayer[] | null }>): LineupState {
  if (!savedLines.length) return buildDefaultLineup(players);

  const fwdLines: LineGroup[] = [];
  const defPairs: LineGroup[] = [];
  const goalieGroups: LineGroup[] = [];

  for (const line of savedLines) {
    const group: LineGroup = {
      order: line.line_order || 0,
      label: line.line_label || "",
      players: (line.player_refs || []).map(pr => ({
        player_id: pr.player_id || "",
        name: pr.name || "",
        jersey: pr.jersey || "",
        position: pr.position || "",
      })),
    };
    if (line.line_type === "forwards") fwdLines.push(group);
    else if (line.line_type === "defense") defPairs.push(group);
    else if (line.line_type === "goalies") goalieGroups.push(group);
  }

  // Ensure minimum structure
  while (fwdLines.length < 4) fwdLines.push({ order: fwdLines.length + 1, label: `${fwdLines.length + 1}${["st","nd","rd","th"][fwdLines.length] || "th"} Line`, players: [] });
  while (defPairs.length < 3) defPairs.push({ order: defPairs.length + 1, label: `${defPairs.length + 1}${["st","nd","rd","th"][defPairs.length] || "th"} Pair`, players: [] });
  if (!goalieGroups.length) goalieGroups.push({ order: 1, label: "Goalies", players: [] });

  return { forwards: fwdLines, defense: defPairs, goalies: goalieGroups };
}

/* ── Page Component ──────────────────────────────────────────── */
export default function RosterBoardPage() {
  const [teams, setTeams] = useState<Array<{ name: string }>>([]);
  const [selectedTeam, setSelectedTeam] = useState("");
  const [players, setPlayers] = useState<RosterPlayer[]>([]);
  const [lineup, setLineup] = useState<LineupState>({ forwards: [], defense: [], goalies: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("lines");
  const [analysing, setAnalysing] = useState(false);
  const [analysis, setAnalysis] = useState("");
  const [analysisOpen, setAnalysisOpen] = useState(false);

  // Drag state
  const dragSrc = useRef<{ section: keyof LineupState; groupIdx: number; slotIdx: number } | null>(null);

  // Sort state (list view)
  const [sortKey, setSortKey] = useState<SortKey>("p");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Load teams
  useEffect(() => {
    api.get("/teams").then(({ data }) => {
      const t = (data || []).map((tm: { name: string }) => ({ name: tm.name }));
      setTeams(t);
      if (t.length > 0 && !selectedTeam) setSelectedTeam(t[0].name);
    }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load roster board data when team changes
  useEffect(() => {
    if (!selectedTeam) return;
    setLoading(true);
    setAnalysis("");
    setDirty(false);
    api.get(`/org-hub/roster-board/${encodeURIComponent(selectedTeam)}`)
      .then(({ data }) => {
        const pl = data.players || [];
        setPlayers(pl);
        setLineup(mergeWithSavedLines(pl, data.lines || []));
      })
      .catch(() => {
        setPlayers([]);
        setLineup({ forwards: [], defense: [], goalies: [] });
      })
      .finally(() => setLoading(false));
  }, [selectedTeam]);

  // Save lines
  const handleSave = useCallback(async () => {
    if (!selectedTeam || saving) return;
    setSaving(true);
    try {
      await api.post("/org-hub/roster-board/save-lines", { team_name: selectedTeam, lines: lineup });
      setDirty(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch { /* ignore */ }
    setSaving(false);
  }, [selectedTeam, saving, lineup]);

  // PXI Analyse
  const handleAnalyse = useCallback(async () => {
    if (!selectedTeam || analysing) return;
    setAnalysing(true);
    setAnalysisOpen(true);
    try {
      const res = await api.post("/org-hub/roster-board/analyse", { team_name: selectedTeam });
      setAnalysis(res.data.analysis || "No analysis returned.");
    } catch {
      setAnalysis("Analysis failed. Please try again.");
    }
    setAnalysing(false);
  }, [selectedTeam, analysing]);

  // Drag-and-drop handlers
  const handleDragStart = (section: keyof LineupState, groupIdx: number, slotIdx: number) => {
    dragSrc.current = { section, groupIdx, slotIdx };
  };

  const handleDrop = (section: keyof LineupState, groupIdx: number, slotIdx: number) => {
    const src = dragSrc.current;
    if (!src) return;
    if (src.section === section && src.groupIdx === groupIdx && src.slotIdx === slotIdx) return;

    setLineup(prev => {
      const next = JSON.parse(JSON.stringify(prev)) as LineupState;
      const srcGroup = next[src.section][src.groupIdx];
      const dstGroup = next[section][groupIdx];
      if (!srcGroup || !dstGroup) return prev;

      // Swap players
      const srcPlayer = srcGroup.players[src.slotIdx] || null;
      const dstPlayer = dstGroup.players[slotIdx] || null;

      // Ensure arrays are long enough
      while (srcGroup.players.length <= src.slotIdx) srcGroup.players.push({ player_id: "", name: "", jersey: "", position: "" });
      while (dstGroup.players.length <= slotIdx) dstGroup.players.push({ player_id: "", name: "", jersey: "", position: "" });

      srcGroup.players[src.slotIdx] = dstPlayer || { player_id: "", name: "", jersey: "", position: "" };
      dstGroup.players[slotIdx] = srcPlayer || { player_id: "", name: "", jersey: "", position: "" };

      return next;
    });
    setDirty(true);
    dragSrc.current = null;
  };

  // Players assigned vs unassigned
  const assignedIds = new Set<string>();
  [lineup.forwards, lineup.defense, lineup.goalies].forEach(groups =>
    groups.forEach(g => g.players.forEach(p => { if (p.player_id) assignedIds.add(p.player_id); }))
  );
  const unassigned = players.filter(p => !assignedIds.has(p.id));

  // Sorted players for list view
  const sortedPlayers = [...players].sort((a, b) => {
    let va: number | string = 0, vb: number | string = 0;
    switch (sortKey) {
      case "jersey": va = parseInt(a.jersey_number || "999"); vb = parseInt(b.jersey_number || "999"); break;
      case "name": va = `${a.last_name} ${a.first_name}`; vb = `${b.last_name} ${b.first_name}`; break;
      case "position": va = a.position; vb = b.position; break;
      case "age": va = playerAge(a.birth_year) || 99; vb = playerAge(b.birth_year) || 99; break;
      case "gp": va = a.stats?.gp || 0; vb = b.stats?.gp || 0; break;
      case "g": va = a.stats?.g || 0; vb = b.stats?.g || 0; break;
      case "a": va = a.stats?.a || 0; vb = b.stats?.a || 0; break;
      case "p": va = a.stats?.p || 0; vb = b.stats?.p || 0; break;
      case "ppg": va = a.stats && a.stats.gp ? a.stats.p / a.stats.gp : 0; vb = b.stats && b.stats.gp ? b.stats.p / b.stats.gp : 0; break;
      case "pxr": va = a.pxr?.score || 0; vb = b.pxr?.score || 0; break;
    }
    if (typeof va === "string" && typeof vb === "string") return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
    return sortDir === "asc" ? (va as number) - (vb as number) : (vb as number) - (va as number);
  });

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  return (
    <ProtectedRoute>
      <NavBar />
      <main className="min-h-screen" style={{ background: "#F0F4F8" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

          {/* ── Header ──────────────────────────────────────── */}
          <div
            className="flex items-center justify-between mb-4"
            style={{ borderRadius: 12, border: "1.5px solid #DDE6EF", background: "#0F2942", padding: "14px 20px" }}
          >
            <div className="flex items-center gap-3">
              <Link href="/org-hub" className="hover:opacity-70 transition-opacity" style={{ color: "rgba(255,255,255,0.6)" }}>
                <ArrowLeft size={20} />
              </Link>
              <div>
                <span
                  className="px-2.5 py-1 rounded-md text-white font-bold uppercase inline-block"
                  style={{ fontSize: 10, fontFamily: "ui-monospace, monospace", letterSpacing: 2, background: "#0D9488" }}
                >
                  Roster Board
                </span>
                <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.5)" }}>Drag and drop players between lines. Save your lineup and get PXI roster analysis.</p>
              </div>
              {/* Team selector */}
              {teams.length > 1 && (
                <select
                  value={selectedTeam}
                  onChange={e => setSelectedTeam(e.target.value)}
                  className="text-sm text-white bg-transparent border border-white/20 rounded-lg px-2 py-1"
                  style={{ fontFamily: "ui-monospace, monospace" }}
                >
                  {teams.map(t => <option key={t.name} value={t.name} className="text-navy bg-white">{t.name}</option>)}
                </select>
              )}
              {teams.length === 1 && (
                <span className="text-sm text-white/80" style={{ fontFamily: "ui-monospace, monospace" }}>{selectedTeam}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleAnalyse}
                disabled={analysing || !selectedTeam}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-colors hover:opacity-90"
                style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 1, color: "#FFFFFF", background: "#0D9488", opacity: analysing ? 0.6 : 1 }}
              >
                {analysing ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                PXI Analyse Roster
              </button>
            </div>
          </div>

          {/* ── Toolbar ─────────────────────────────────────── */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setViewMode("lines")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-colors"
                style={{
                  fontFamily: "ui-monospace, monospace", letterSpacing: 1,
                  background: viewMode === "lines" ? "#0F2942" : "rgba(15,41,66,0.06)",
                  color: viewMode === "lines" ? "#FFFFFF" : "#0F2942",
                  border: "1.5px solid #DDE6EF",
                }}
              >
                <LayoutGrid size={11} /> Lines View
              </button>
              <button
                onClick={() => setViewMode("list")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-colors"
                style={{
                  fontFamily: "ui-monospace, monospace", letterSpacing: 1,
                  background: viewMode === "list" ? "#0F2942" : "rgba(15,41,66,0.06)",
                  color: viewMode === "list" ? "#FFFFFF" : "#0F2942",
                  border: "1.5px solid #DDE6EF",
                }}
              >
                <List size={11} /> List View
              </button>
            </div>
            {dirty && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold uppercase transition-colors hover:opacity-90"
                style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 1, color: "#FFFFFF", background: "#0D9488" }}
              >
                {saving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
                {saveSuccess ? "Saved!" : "Save Lines"}
              </button>
            )}
            <span className="text-[10px]" style={{ fontFamily: "ui-monospace, monospace", color: "#8BA4BB" }}>
              {players.length} players
            </span>
          </div>

          {/* ── Loading ─────────────────────────────────────── */}
          {loading && (
            <div className="text-center py-16">
              <Loader2 size={24} className="animate-spin mx-auto" style={{ color: "#0D9488" }} />
              <p className="text-sm mt-2" style={{ color: "#5A7291" }}>Loading roster... If no players appear, sync your roster from the dashboard.</p>
            </div>
          )}

          {/* ── Lines View ──────────────────────────────────── */}
          {!loading && viewMode === "lines" && (
            <div className="space-y-4">
              <DepthSection title="FORWARD LINES" groups={lineup.forwards} section="forwards" onDragStart={handleDragStart} onDrop={handleDrop} />
              <DepthSection title="DEFENSE PAIRS" groups={lineup.defense} section="defense" onDragStart={handleDragStart} onDrop={handleDrop} />
              <DepthSection title="GOALIES" groups={lineup.goalies} section="goalies" onDragStart={handleDragStart} onDrop={handleDrop} />

              {/* Extras / Unassigned */}
              {unassigned.length > 0 && (
                <div className="overflow-hidden" style={{ borderRadius: 12, border: "1.5px solid #DDE6EF", borderLeft: "3px solid #5A7291" }}>
                  <div className="flex items-center gap-2 px-5 py-2.5" style={{ background: "#0F2942" }}>
                    <span className="w-2 h-2 rounded-full" style={{ background: "#5A7291" }} />
                    <span className="font-bold uppercase text-white" style={{ fontSize: 10, fontFamily: "ui-monospace, monospace", letterSpacing: 2 }}>
                      Extras ({unassigned.length})
                    </span>
                  </div>
                  <div className="bg-white px-4 py-3 flex flex-wrap gap-2">
                    {unassigned.map(p => (
                      <Link key={p.id} href={`/players/${p.id}`} className="group">
                        <div
                          className="flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 hover:shadow-md"
                          style={{ border: "1.5px solid #DDE6EF", borderLeft: "3px solid #8BA4BB", background: "#FFFFFF" }}
                        >
                          <span className="text-sm font-bold" style={{ color: "#0F2942", fontFamily: "ui-monospace, monospace" }}>
                            {p.jersey_number || "—"}
                          </span>
                          <div>
                            <p className="text-[11px] font-medium" style={{ color: "#0F2942" }}>{p.first_name} {p.last_name}</p>
                            <p className="text-[9px]" style={{ color: "#8BA4BB" }}>{p.position}</p>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── List View ───────────────────────────────────── */}
          {!loading && viewMode === "list" && (
            <div className="overflow-hidden" style={{ borderRadius: 12, border: "1.5px solid #DDE6EF", borderLeft: "3px solid #0D9488" }}>
              <div className="flex items-center gap-2 px-5 py-2.5" style={{ background: "#0F2942" }}>
                <span className="w-2 h-2 rounded-full" style={{ background: "#14B8A6" }} />
                <span className="font-bold uppercase text-white" style={{ fontSize: 10, fontFamily: "ui-monospace, monospace", letterSpacing: 2 }}>
                  Full Roster
                </span>
              </div>
              <div className="bg-white overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr style={{ borderBottom: "1.5px solid #DDE6EF" }}>
                      {([
                        ["#", "jersey"], ["Name", "name"], ["Pos", "position"], ["Age", "age"],
                        ["GP", "gp"], ["G", "g"], ["A", "a"], ["P", "p"], ["PPG", "ppg"], ["PXR", "pxr"],
                      ] as [string, SortKey][]).map(([label, key]) => (
                        <th
                          key={key}
                          onClick={() => toggleSort(key)}
                          className="px-3 py-2.5 cursor-pointer select-none hover:bg-gray-50 transition-colors"
                          style={{ fontSize: 10, fontFamily: "ui-monospace, monospace", letterSpacing: 1, color: sortKey === key ? "#0D9488" : "#8BA4BB" }}
                        >
                          <span className="flex items-center gap-1 uppercase">
                            {label}
                            {sortKey === key && <ArrowUpDown size={9} />}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedPlayers.map(p => (
                      <tr
                        key={p.id}
                        className="hover:bg-gray-50/50 transition-colors cursor-pointer"
                        style={{ borderBottom: "1px solid #F0F4F8" }}
                        onClick={() => window.location.href = `/players/${p.id}`}
                      >
                        <td className="px-3 py-2 text-sm font-bold" style={{ color: "#0F2942", fontFamily: "ui-monospace, monospace" }}>
                          {p.jersey_number || "—"}
                        </td>
                        <td className="px-3 py-2">
                          <span className="text-xs font-medium" style={{ color: "#0F2942" }}>{p.first_name} {p.last_name}</span>
                        </td>
                        <td className="px-3 py-2 text-xs" style={{ color: "#5A7291" }}>{p.position}</td>
                        <td className="px-3 py-2 text-xs" style={{ color: "#5A7291" }}>{playerAge(p.birth_year) ?? "—"}</td>
                        <td className="px-3 py-2 text-xs" style={{ color: "#5A7291", fontFamily: "ui-monospace, monospace" }}>{p.stats?.gp || "—"}</td>
                        <td className="px-3 py-2 text-xs" style={{ color: "#5A7291", fontFamily: "ui-monospace, monospace" }}>{p.stats?.g ?? "—"}</td>
                        <td className="px-3 py-2 text-xs" style={{ color: "#5A7291", fontFamily: "ui-monospace, monospace" }}>{p.stats?.a ?? "—"}</td>
                        <td className="px-3 py-2 text-xs font-medium" style={{ color: "#0F2942", fontFamily: "ui-monospace, monospace" }}>{p.stats?.p ?? "—"}</td>
                        <td className="px-3 py-2 text-xs" style={{ color: "#5A7291", fontFamily: "ui-monospace, monospace" }}>{calcPPG(p.stats)}</td>
                        <td className="px-3 py-2">
                          {p.pxr?.score ? (
                            <span
                              className="inline-block px-2 py-0.5 rounded text-[10px] font-bold"
                              style={{ fontFamily: "ui-monospace, monospace", background: "rgba(13,148,136,0.1)", color: "#0D9488" }}
                            >
                              {p.pxr.score.toFixed(1)}
                            </span>
                          ) : (
                            <span className="text-xs" style={{ color: "#DDE6EF" }}>—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── PXI Analysis Output ─────────────────────────── */}
          {(analysis || analysing) && (
            <div className="mt-6 overflow-hidden" style={{ borderRadius: 12, border: "1.5px solid rgba(13,148,136,0.3)", borderLeft: "3px solid #0D9488" }}>
              <button
                onClick={() => setAnalysisOpen(!analysisOpen)}
                className="w-full flex items-center justify-between px-5 py-3"
                style={{ background: "#0F2942" }}
              >
                <div className="flex items-center gap-2">
                  <Sparkles size={12} style={{ color: "#14B8A6" }} />
                  <span className="font-bold uppercase text-white" style={{ fontSize: 10, fontFamily: "ui-monospace, monospace", letterSpacing: 2 }}>
                    PXI Roster Analysis
                  </span>
                </div>
                {analysisOpen ? <ChevronUp size={14} className="text-white/50" /> : <ChevronDown size={14} className="text-white/50" />}
              </button>
              {analysisOpen && (
                <div className="bg-white px-5 py-4">
                  {analysing ? (
                    <div className="text-center py-6">
                      <Loader2 size={20} className="animate-spin mx-auto" style={{ color: "#0D9488" }} />
                      <p className="text-xs mt-2" style={{ color: "#5A7291" }}>Generating analysis...</p>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-end mb-2">
                        <ListenButton text={analysis} label="Listen" />
                      </div>
                      <div className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "#0F2942" }}>
                        {analysis}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

        </div>
      </main>
    </ProtectedRoute>
  );
}

/* ── Depth Chart Section Component ────────────────────────── */
function DepthSection({
  title, groups, section, onDragStart, onDrop,
}: {
  title: string;
  groups: LineGroup[];
  section: keyof LineupState;
  onDragStart: (section: keyof LineupState, groupIdx: number, slotIdx: number) => void;
  onDrop: (section: keyof LineupState, groupIdx: number, slotIdx: number) => void;
}) {
  const accentColor = section === "defense" ? "#EA580C" : "#0D9488";
  const dotColor = section === "defense" ? "#F97316" : "#14B8A6";

  return (
    <div className="overflow-hidden" style={{ borderRadius: 12, border: "1.5px solid #DDE6EF", borderLeft: `3px solid ${accentColor}` }}>
      <div className="flex items-center gap-2 px-5 py-2.5" style={{ background: "#0F2942" }}>
        <span className="w-2 h-2 rounded-full" style={{ background: dotColor }} />
        <span className="font-bold uppercase text-white" style={{ fontSize: 10, fontFamily: "ui-monospace, monospace", letterSpacing: 2 }}>
          {title}
        </span>
      </div>
      <div className="bg-white px-4 py-3 space-y-2">
        {groups.map((group, gIdx) => (
          <div key={gIdx} className="flex items-center gap-2">
            {/* Line label */}
            <span
              className="w-16 text-right text-[10px] font-bold uppercase shrink-0"
              style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 1, color: "#8BA4BB" }}
            >
              {group.label}
            </span>
            {/* Player slots */}
            <div className="flex flex-wrap gap-2 flex-1">
              {(group.players.length > 0 ? group.players : [{ player_id: "", name: "", jersey: "", position: "" }]).map((player, sIdx) => (
                <div
                  key={sIdx}
                  draggable={!!player.player_id}
                  onDragStart={() => { if (player.player_id) onDragStart(section, gIdx, sIdx); }}
                  onDragOver={e => e.preventDefault()}
                  onDrop={() => onDrop(section, gIdx, sIdx)}
                  className="transition-all duration-200 hover:shadow-md"
                  style={{
                    width: 160,
                    borderRadius: 8,
                    border: "1.5px solid #DDE6EF",
                    borderLeft: `3px solid ${player.player_id ? accentColor : "#DDE6EF"}`,
                    background: "#FFFFFF",
                    cursor: player.player_id ? "grab" : "default",
                    opacity: player.player_id ? 1 : 0.4,
                  }}
                >
                  {player.player_id ? (
                    <Link href={`/players/${player.player_id}`} onClick={e => e.stopPropagation()} className="block px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-base font-bold" style={{ color: "#0F2942", fontFamily: "ui-monospace, monospace" }}>
                          {player.jersey || "—"}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-medium truncate" style={{ color: "#0F2942" }}>{player.name}</p>
                          <p className="text-[9px]" style={{ color: "#8BA4BB" }}>{player.position}</p>
                        </div>
                      </div>
                    </Link>
                  ) : (
                    <div className="px-3 py-2 text-center">
                      <p className="text-[10px]" style={{ color: "#DDE6EF" }}>Empty</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
