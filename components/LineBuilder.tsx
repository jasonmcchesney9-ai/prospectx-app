"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Users,
  Plus,
  X,
  Loader2,
  CheckCircle2,
  Search,
  GripVertical,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import api, { assetUrl, hasRealImage } from "@/lib/api";
import type { Player, LineCombination, LineCombinationCreate } from "@/types/api";
import { LINE_SLOT_CONFIG } from "@/types/api";

interface LineBuilderProps {
  teamName: string;
  season: string;
  roster: Player[];
  existingLines: LineCombination[];
  onLinesChanged: () => void;
}

type LineKey = string; // e.g. "forwards_1"

interface SlotPlayer {
  player_id: string;
  name: string;
  jersey: string;
  position: string;
  image_url?: string;
}

type PosFilter = "all" | "forwards" | "defense";

const FORWARD_POS = ["C", "LW", "RW", "F"];
const DEFENSE_POS = ["LD", "RD", "D"];

function getPositionGroup(pos: string): "forward" | "defense" | "goalie" | "other" {
  const p = pos.toUpperCase();
  if (FORWARD_POS.includes(p)) return "forward";
  if (DEFENSE_POS.includes(p)) return "defense";
  if (p === "G") return "goalie";
  return "other";
}

function matchesSlotPosition(playerPos: string, slotPos: string): boolean {
  const pg = getPositionGroup(playerPos);
  const sp = slotPos.toUpperCase();
  if (sp === "F") return pg === "forward";
  if (sp === "D" || sp === "LD" || sp === "RD") return pg === "defense";
  if (sp === "LW" || sp === "C" || sp === "RW") return pg === "forward";
  return true;
}

// ── Main Component ──────────────────────────────────────────

export default function LineBuilder({
  teamName,
  season,
  roster,
  existingLines,
  onLinesChanged,
}: LineBuilderProps) {
  // ── Line state ────────────────────────────────────────
  const [lineMap, setLineMap] = useState<Map<LineKey, LineCombination>>(new Map());
  const [slots, setSlots] = useState<Map<LineKey, (SlotPlayer | null)[]>>(new Map());
  const [saving, setSaving] = useState<LineKey | null>(null);
  const [saved, setSaved] = useState<LineKey | null>(null);
  const [deleting, setDeleting] = useState<LineKey | null>(null);

  // ── Click picker (mobile fallback) ────────────────────
  const [activePicker, setActivePicker] = useState<{ lineKey: string; slotIdx: number } | null>(null);
  const [pickerSearch, setPickerSearch] = useState("");
  const pickerRef = useRef<HTMLDivElement>(null);

  // ── Drag-and-drop state ───────────────────────────────
  const [draggedPlayer, setDraggedPlayer] = useState<Player | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<string | null>(null); // "lineKey:slotIdx"

  // ── Roster sidebar state ──────────────────────────────
  const [rosterSearch, setRosterSearch] = useState("");
  const [posFilter, setPosFilter] = useState<PosFilter>("all");
  const [rosterOpen, setRosterOpen] = useState(false); // mobile toggle

  // Initialize slots from existingLines
  useEffect(() => {
    const lm = new Map<LineKey, LineCombination>();
    const sm = new Map<LineKey, (SlotPlayer | null)[]>();

    for (const line of existingLines) {
      if (line.data_source !== "manual") continue;
      const key = `${line.line_type}_${line.line_order}`;
      lm.set(key, line);

      const config = LINE_SLOT_CONFIG[line.line_type]?.find((c) => c.order === line.line_order);
      const numSlots = config?.slots || 3;
      const refs = line.player_refs || [];
      const slotArr: (SlotPlayer | null)[] = [];
      for (let i = 0; i < numSlots; i++) {
        const ref = refs[i];
        if (ref && ref.name) {
          const rosterMatch = roster.find((p) => p.id === ref.player_id);
          slotArr.push({
            player_id: ref.player_id || "",
            name: ref.name,
            jersey: ref.jersey || "",
            position: ref.position || "",
            image_url: rosterMatch?.image_url || undefined,
          });
        } else {
          slotArr.push(null);
        }
      }
      sm.set(key, slotArr);
    }

    setLineMap(lm);
    setSlots(sm);
  }, [existingLines, roster]);

  // Close picker on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setActivePicker(null);
        setPickerSearch("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // ── Assigned player tracking ──────────────────────────
  const assignedPlayerIds = useCallback((): Map<string, string> => {
    const map = new Map<string, string>();
    slots.forEach((slotArr, lineKey) => {
      for (const s of slotArr) {
        if (s?.player_id) map.set(s.player_id, lineKey);
      }
    });
    return map;
  }, [slots]);

  function lineKeyToLabel(key: string): string {
    const [type, orderStr] = key.split("_");
    const order = parseInt(orderStr);
    const config = LINE_SLOT_CONFIG[type]?.find((c) => c.order === order);
    return config?.label || key;
  }

  // ── Assign / Remove / Save ────────────────────────────

  async function assignPlayer(lineKey: string, slotIdx: number, player: Player) {
    const [lineType, orderStr] = lineKey.split("_");
    const lineOrder = parseInt(orderStr);
    const config = LINE_SLOT_CONFIG[lineType]?.find((c) => c.order === lineOrder);
    if (!config) return;

    const currentSlots = slots.get(lineKey) || new Array(config.slots).fill(null);
    const newSlots = [...currentSlots];
    newSlots[slotIdx] = {
      player_id: player.id,
      name: `${player.first_name} ${player.last_name}`,
      jersey: "",
      position: player.position,
      image_url: player.image_url || undefined,
    };

    setSlots((prev) => new Map(prev).set(lineKey, newSlots));
    setActivePicker(null);
    setPickerSearch("");

    await saveLine(lineKey, lineType, lineOrder, config.label, newSlots);
  }

  async function removePlayer(lineKey: string, slotIdx: number) {
    const [lineType, orderStr] = lineKey.split("_");
    const lineOrder = parseInt(orderStr);
    const config = LINE_SLOT_CONFIG[lineType]?.find((c) => c.order === lineOrder);
    if (!config) return;

    const currentSlots = slots.get(lineKey) || new Array(config.slots).fill(null);
    const newSlots = [...currentSlots];
    newSlots[slotIdx] = null;

    setSlots((prev) => new Map(prev).set(lineKey, newSlots));

    if (newSlots.every((s) => s === null)) {
      const existing = lineMap.get(lineKey);
      if (existing) {
        setDeleting(lineKey);
        try {
          await api.delete(`/lines/${existing.id}`);
          setLineMap((prev) => {
            const nm = new Map(prev);
            nm.delete(lineKey);
            return nm;
          });
          onLinesChanged();
        } catch { /* ignore */ }
        setDeleting(null);
      }
      return;
    }

    await saveLine(lineKey, lineType, lineOrder, config.label, newSlots);
  }

  async function saveLine(
    lineKey: string,
    lineType: string,
    lineOrder: number,
    lineLabel: string,
    slotArr: (SlotPlayer | null)[],
  ) {
    setSaving(lineKey);
    const playerRefs = slotArr
      .filter((s): s is SlotPlayer => s !== null)
      .map((s) => ({
        player_id: s.player_id,
        name: s.name,
        jersey: s.jersey,
        position: s.position,
      }));

    try {
      const existing = lineMap.get(lineKey);
      if (existing) {
        const res = await api.put<LineCombination>(`/lines/${existing.id}`, {
          player_refs: playerRefs,
          line_label: lineLabel,
          line_order: lineOrder,
        });
        setLineMap((prev) => new Map(prev).set(lineKey, res.data));
      } else {
        const body: LineCombinationCreate = {
          team_name: teamName,
          season,
          line_type: lineType,
          line_label: lineLabel,
          line_order: lineOrder,
          player_refs: playerRefs,
        };
        const res = await api.post<LineCombination>(
          `/teams/${encodeURIComponent(teamName)}/lines`,
          body,
        );
        setLineMap((prev) => new Map(prev).set(lineKey, res.data));
      }
      setSaved(lineKey);
      setTimeout(() => setSaved(null), 1500);
      onLinesChanged();
    } catch (err) {
      console.error("Failed to save line:", err);
    } finally {
      setSaving(null);
    }
  }

  // ── Drag-and-Drop Handlers ────────────────────────────

  function handleDragStart(e: React.DragEvent, player: Player) {
    e.dataTransfer.setData("text/plain", player.id);
    e.dataTransfer.effectAllowed = "copy";
    setDraggedPlayer(player);
  }

  function handleDragEnd() {
    setDraggedPlayer(null);
    setDragOverSlot(null);
  }

  function handleSlotDragOver(e: React.DragEvent, lineKey: string, slotIdx: number, slotPos: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    const key = `${lineKey}:${slotIdx}`;
    if (dragOverSlot !== key) setDragOverSlot(key);
  }

  function handleSlotDragLeave(e: React.DragEvent, lineKey: string, slotIdx: number) {
    const key = `${lineKey}:${slotIdx}`;
    if (dragOverSlot === key) {
      // Only clear if we're actually leaving the slot (not entering a child)
      const related = e.relatedTarget as HTMLElement | null;
      const current = e.currentTarget as HTMLElement;
      if (!related || !current.contains(related)) {
        setDragOverSlot(null);
      }
    }
  }

  function handleSlotDrop(e: React.DragEvent, lineKey: string, slotIdx: number, slotPos: string) {
    e.preventDefault();
    setDragOverSlot(null);
    setDraggedPlayer(null);

    const playerId = e.dataTransfer.getData("text/plain");
    const player = roster.find((p) => p.id === playerId);
    if (!player) return;

    // Validate position
    if (!matchesSlotPosition(player.position, slotPos)) return;

    assignPlayer(lineKey, slotIdx, player);
  }

  // ── Roster filter for picker dropdown (mobile fallback) ──
  function getPickerPlayers(slotPosition: string): Player[] {
    const assigned = assignedPlayerIds();
    const search = pickerSearch.toLowerCase();

    return roster
      .filter((p) => p.position.toUpperCase() !== "G")
      .sort((a, b) => {
        const aMatch = matchesSlotPosition(a.position, slotPosition) ? 0 : 1;
        const bMatch = matchesSlotPosition(b.position, slotPosition) ? 0 : 1;
        if (aMatch !== bMatch) return aMatch - bMatch;
        return a.last_name.localeCompare(b.last_name);
      })
      .filter((p) => {
        if (!search) return true;
        const full = `${p.first_name} ${p.last_name}`.toLowerCase();
        return full.includes(search);
      })
      .map((p) => ({
        ...p,
        _assignedTo: assigned.get(p.id) || null,
      })) as (Player & { _assignedTo: string | null })[];
  }

  // ── Roster sidebar filter ─────────────────────────────
  function getFilteredRoster(): (Player & { _assignedTo: string | null })[] {
    const assigned = assignedPlayerIds();
    const search = rosterSearch.toLowerCase();

    return roster
      .filter((p) => {
        const pg = getPositionGroup(p.position);
        if (pg === "goalie") return false;
        if (posFilter === "forwards" && pg !== "forward") return false;
        if (posFilter === "defense" && pg !== "defense") return false;
        return true;
      })
      .filter((p) => {
        if (!search) return true;
        const full = `${p.first_name} ${p.last_name}`.toLowerCase();
        return full.includes(search);
      })
      .sort((a, b) => a.last_name.localeCompare(b.last_name))
      .map((p) => ({
        ...p,
        _assignedTo: assigned.get(p.id) || null,
      }));
  }

  // ── Section config ────────────────────────────────────
  const sections: { type: string; label: string; icon: string }[] = [
    { type: "forwards", label: "Forward Lines", icon: "FWD" },
    { type: "defense", label: "Defensive Pairs", icon: "DEF" },
    { type: "pp", label: "Power Play", icon: "PP" },
    { type: "pk", label: "Penalty Kill", icon: "PK" },
  ];

  const assigned = assignedPlayerIds();
  const rosterPlayers = getFilteredRoster();
  const totalSkaters = roster.filter((p) => getPositionGroup(p.position) !== "goalie").length;
  const totalAssigned = assigned.size;

  // ── Empty roster ──────────────────────────────────────
  if (roster.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-xl border border-teal/20">
        <Users size={32} className="mx-auto text-muted/40 mb-3" />
        <p className="text-muted text-sm">No players on this roster yet.</p>
        <p className="text-xs text-muted/60 mt-1">
          Sync a roster from the League Hub or add players manually.
        </p>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────
  return (
    <div className="flex gap-4">
      {/* ══════════════════════════════════════════════════
          ROSTER SIDEBAR — Desktop (always visible)
          ══════════════════════════════════════════════════ */}
      <div className="hidden lg:flex lg:flex-col w-[280px] shrink-0">
        <div className="bg-white rounded-xl border border-teal/20 overflow-hidden sticky top-20">
          {/* Sidebar Header */}
          <div className="bg-gradient-to-r from-navy to-navy/80 px-4 py-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-oswald uppercase tracking-wider text-white font-bold">
                Team Roster
              </h3>
              <span className="text-[10px] font-oswald text-white/60">
                {totalAssigned}/{totalSkaters} assigned
              </span>
            </div>
          </div>

          {/* Search */}
          <div className="px-3 pt-3 pb-2">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted/50" />
              <input
                type="text"
                placeholder="Search roster..."
                value={rosterSearch}
                onChange={(e) => setRosterSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-teal/20 rounded-lg focus:outline-none focus:border-teal bg-white"
              />
            </div>
          </div>

          {/* Position Filters */}
          <div className="flex gap-1 px-3 pb-2">
            {(["all", "forwards", "defense"] as PosFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setPosFilter(f)}
                className={`flex-1 px-2 py-1 rounded text-[10px] font-oswald font-bold uppercase tracking-wider transition-colors ${
                  posFilter === f
                    ? "bg-teal text-white"
                    : "bg-navy/5 text-navy/50 hover:bg-navy/10"
                }`}
              >
                {f === "all" ? "All" : f === "forwards" ? "FWD" : "DEF"}
              </button>
            ))}
          </div>

          {/* Player List */}
          <div className="overflow-y-auto max-h-[calc(100vh-280px)] border-t border-teal/10">
            {rosterPlayers.length === 0 ? (
              <p className="px-3 py-6 text-xs text-muted text-center">No players match</p>
            ) : (
              rosterPlayers.map((p) => {
                const isAssigned = !!p._assignedTo;
                const posGroup = getPositionGroup(p.position);
                return (
                  <div
                    key={p.id}
                    draggable={!isAssigned}
                    onDragStart={(e) => {
                      if (!isAssigned) handleDragStart(e, p);
                    }}
                    onDragEnd={handleDragEnd}
                    className={`flex items-center gap-2 px-3 py-2 border-b border-teal/8 transition-all ${
                      isAssigned
                        ? "opacity-40 cursor-default bg-navy/[0.02]"
                        : "cursor-grab hover:bg-teal/5 active:cursor-grabbing"
                    } ${draggedPlayer?.id === p.id ? "opacity-30" : ""}`}
                  >
                    {/* Drag handle */}
                    {!isAssigned && (
                      <GripVertical size={12} className="text-navy/20 shrink-0" />
                    )}
                    {isAssigned && (
                      <div className="w-3 shrink-0" />
                    )}

                    {/* Avatar */}
                    {hasRealImage(p.image_url) ? (
                      <img
                        src={assetUrl(p.image_url)}
                        alt=""
                        className="w-7 h-7 rounded-full object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-navy/8 flex items-center justify-center shrink-0">
                        <span className="text-[9px] font-bold text-navy/40">
                          {p.first_name[0]}{p.last_name[0]}
                        </span>
                      </div>
                    )}

                    {/* Name + assignment info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-semibold text-navy truncate leading-tight">
                        {p.last_name}, {p.first_name}
                      </p>
                      {isAssigned && (
                        <p className="text-[9px] text-orange truncate">
                          {lineKeyToLabel(p._assignedTo!)}
                        </p>
                      )}
                    </div>

                    {/* Position badge */}
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold font-oswald shrink-0 ${
                        posGroup === "forward"
                          ? "bg-teal/10 text-teal"
                          : "bg-navy/10 text-navy/60"
                      }`}
                    >
                      {p.position}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════
          MOBILE ROSTER TOGGLE
          ══════════════════════════════════════════════════ */}
      <div className="lg:hidden w-full">
        {/* Mobile toggle button */}
        <button
          onClick={() => setRosterOpen(!rosterOpen)}
          className="w-full flex items-center justify-between px-4 py-2.5 bg-white rounded-xl border border-teal/20 mb-3 hover:bg-navy/[0.02] transition-colors"
        >
          <div className="flex items-center gap-2">
            <Users size={16} className="text-navy/50" />
            <span className="text-xs font-oswald uppercase tracking-wider text-navy font-bold">
              Team Roster
            </span>
            <span className="text-[10px] text-muted bg-navy/[0.04] px-2 py-0.5 rounded-full">
              {totalAssigned}/{totalSkaters} assigned
            </span>
          </div>
          {rosterOpen ? (
            <ChevronDown size={14} className="text-navy/40" />
          ) : (
            <ChevronRight size={14} className="text-navy/40" />
          )}
        </button>

        {/* Mobile roster panel (expanded) */}
        {rosterOpen && (
          <div className="bg-white rounded-xl border border-teal/20 overflow-hidden mb-4">
            <div className="px-3 pt-3 pb-2">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted/50" />
                <input
                  type="text"
                  placeholder="Search roster..."
                  value={rosterSearch}
                  onChange={(e) => setRosterSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs border border-teal/20 rounded-lg focus:outline-none focus:border-teal bg-white"
                />
              </div>
            </div>
            <div className="flex gap-1 px-3 pb-2">
              {(["all", "forwards", "defense"] as PosFilter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setPosFilter(f)}
                  className={`flex-1 px-2 py-1 rounded text-[10px] font-oswald font-bold uppercase tracking-wider transition-colors ${
                    posFilter === f
                      ? "bg-teal text-white"
                      : "bg-navy/5 text-navy/50 hover:bg-navy/10"
                  }`}
                >
                  {f === "all" ? "All" : f === "forwards" ? "FWD" : "DEF"}
                </button>
              ))}
            </div>
            <div className="max-h-60 overflow-y-auto border-t border-teal/10">
              <p className="px-3 py-2 text-[10px] text-muted italic">
                Tap a player, then tap an empty slot to assign. Drag-and-drop works on desktop.
              </p>
              {rosterPlayers.map((p) => {
                const isAssigned = !!p._assignedTo;
                const posGroup = getPositionGroup(p.position);
                return (
                  <div
                    key={p.id}
                    className={`flex items-center gap-2 px-3 py-2 border-b border-teal/8 ${
                      isAssigned ? "opacity-40" : ""
                    }`}
                  >
                    {hasRealImage(p.image_url) ? (
                      <img
                        src={assetUrl(p.image_url)}
                        alt=""
                        className="w-6 h-6 rounded-full object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-navy/8 flex items-center justify-center shrink-0">
                        <span className="text-[8px] font-bold text-navy/40">
                          {p.first_name[0]}{p.last_name[0]}
                        </span>
                      </div>
                    )}
                    <p className="text-[11px] font-semibold text-navy truncate flex-1">
                      {p.last_name}, {p.first_name}
                    </p>
                    {isAssigned && (
                      <span className="text-[9px] text-orange truncate">
                        {lineKeyToLabel(p._assignedTo!)}
                      </span>
                    )}
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold font-oswald shrink-0 ${
                        posGroup === "forward"
                          ? "bg-teal/10 text-teal"
                          : "bg-navy/10 text-navy/60"
                      }`}
                    >
                      {p.position}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Line Sections (mobile) */}
        <div className="space-y-6">
          {sections.map((section) => {
            const configs = LINE_SLOT_CONFIG[section.type] || [];
            return (
              <div key={section.type}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="inline-flex px-2 py-0.5 rounded text-xs font-bold bg-navy/10 text-navy font-oswald">
                    {section.icon}
                  </span>
                  <h3 className="text-sm font-oswald uppercase tracking-wider text-navy font-semibold">
                    {section.label}
                  </h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {configs.map((config) => {
                    const lineKey = `${section.type}_${config.order}`;
                    const lineSlots = slots.get(lineKey) || new Array(config.slots).fill(null);
                    const isSaving = saving === lineKey;
                    const isSaved = saved === lineKey;
                    const isDeleting = deleting === lineKey;

                    return (
                      <div key={lineKey} className="bg-white rounded-xl border border-teal/20 overflow-hidden">
                        <div className="bg-gradient-to-r from-navy to-navy/80 px-4 py-2 flex items-center justify-between">
                          <h4 className="text-xs font-oswald uppercase tracking-wider text-white font-bold">
                            {config.label}
                          </h4>
                          <div className="flex items-center gap-1">
                            {isSaving && <Loader2 size={12} className="text-white/60 animate-spin" />}
                            {isSaved && <CheckCircle2 size={12} className="text-green-400" />}
                            {isDeleting && <Loader2 size={12} className="text-red-400 animate-spin" />}
                          </div>
                        </div>
                        <div className="p-3 flex gap-2 flex-wrap relative">
                          {config.positions.map((pos, slotIdx) => {
                            const player = lineSlots[slotIdx];
                            const isPickerOpen =
                              activePicker?.lineKey === lineKey && activePicker?.slotIdx === slotIdx;

                            return (
                              <div key={slotIdx} className="relative flex-1 min-w-[80px]">
                                {player ? (
                                  <div className="border-2 border-teal/30 bg-teal/5 rounded-lg p-2 text-center relative group">
                                    <button
                                      onClick={() => removePlayer(lineKey, slotIdx)}
                                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                      title="Remove player"
                                    >
                                      <X size={10} />
                                    </button>
                                    {hasRealImage(player.image_url) ? (
                                      <img src={assetUrl(player.image_url)} alt="" className="w-8 h-8 rounded-full object-cover mx-auto mb-1" />
                                    ) : (
                                      <div className="w-8 h-8 rounded-full bg-navy/10 flex items-center justify-center mx-auto mb-1">
                                        <span className="text-[10px] font-bold text-navy/50">
                                          {player.name.split(" ").map((n: string) => n[0]).join("")}
                                        </span>
                                      </div>
                                    )}
                                    <p className="text-[11px] font-semibold text-navy truncate leading-tight">
                                      {player.name.split(" ").slice(-1)[0]}
                                    </p>
                                    <span className="text-[9px] text-teal font-oswald font-bold">
                                      {player.position || pos}
                                    </span>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => {
                                      setActivePicker(isPickerOpen ? null : { lineKey, slotIdx });
                                      setPickerSearch("");
                                    }}
                                    className="w-full border-2 border-dashed border-teal/10 rounded-lg p-2 text-center hover:border-teal/40 hover:bg-teal/5 transition-colors"
                                  >
                                    <div className="w-8 h-8 rounded-full bg-border/20 flex items-center justify-center mx-auto mb-1">
                                      <Plus size={14} className="text-muted/40" />
                                    </div>
                                    <p className="text-[10px] font-oswald uppercase tracking-wider text-muted/60">{pos}</p>
                                  </button>
                                )}

                                {/* Mobile picker dropdown */}
                                {isPickerOpen && (
                                  <div ref={pickerRef} className="absolute top-full left-0 mt-1 w-56 bg-white border border-teal/20 rounded-xl shadow-lg z-50 max-h-64 overflow-hidden">
                                    <div className="p-2 border-b border-teal/20">
                                      <input
                                        type="text"
                                        placeholder="Search players..."
                                        value={pickerSearch}
                                        onChange={(e) => setPickerSearch(e.target.value)}
                                        className="w-full px-2 py-1.5 text-xs border border-teal/20 rounded-lg focus:outline-none focus:border-teal"
                                        autoFocus
                                      />
                                    </div>
                                    <div className="overflow-y-auto max-h-48">
                                      {getPickerPlayers(pos).map((pp) => {
                                        const assignedTo = (pp as Player & { _assignedTo: string | null })._assignedTo;
                                        const isAssigned = !!assignedTo;
                                        const matchesPos = matchesSlotPosition(pp.position, pos);
                                        return (
                                          <button
                                            key={pp.id}
                                            onClick={() => { if (!isAssigned) assignPlayer(lineKey, slotIdx, pp); }}
                                            disabled={isAssigned}
                                            className={`w-full px-3 py-2 text-left flex items-center gap-2 text-xs transition-colors ${
                                              isAssigned ? "opacity-40 cursor-not-allowed bg-gray-50" : "hover:bg-teal/5"
                                            }`}
                                          >
                                            {hasRealImage(pp.image_url) ? (
                                              <img src={assetUrl(pp.image_url)} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
                                            ) : (
                                              <div className="w-6 h-6 rounded-full bg-navy/10 flex items-center justify-center flex-shrink-0">
                                                <Users size={10} className="text-navy/40" />
                                              </div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                              <p className="font-medium text-navy truncate">{pp.last_name}, {pp.first_name}</p>
                                              {isAssigned && (
                                                <p className="text-[9px] text-orange">on {lineKeyToLabel(assignedTo!)}</p>
                                              )}
                                            </div>
                                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold font-oswald ${matchesPos ? "bg-teal/10 text-teal" : "bg-navy/5 text-navy/40"}`}>
                                              {pp.position}
                                            </span>
                                          </button>
                                        );
                                      })}
                                      {getPickerPlayers(pos).length === 0 && (
                                        <p className="px-3 py-4 text-xs text-muted text-center">No players found</p>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════
          LINE SLOT GRID — Desktop (with drop zones)
          ══════════════════════════════════════════════════ */}
      <div className="hidden lg:block flex-1 space-y-6">
        {sections.map((section) => {
          const configs = LINE_SLOT_CONFIG[section.type] || [];
          return (
            <div key={section.type}>
              {/* Section Header */}
              <div className="flex items-center gap-2 mb-3">
                <span className="inline-flex px-2 py-0.5 rounded text-xs font-bold bg-navy/10 text-navy font-oswald">
                  {section.icon}
                </span>
                <h3 className="text-sm font-oswald uppercase tracking-wider text-navy font-semibold">
                  {section.label}
                </h3>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                {configs.map((config) => {
                  const lineKey = `${section.type}_${config.order}`;
                  const lineSlots = slots.get(lineKey) || new Array(config.slots).fill(null);
                  const isSaving = saving === lineKey;
                  const isSaved = saved === lineKey;
                  const isDeleting = deleting === lineKey;

                  return (
                    <div
                      key={lineKey}
                      className="bg-white rounded-xl border border-teal/20 overflow-hidden"
                    >
                      {/* Line Header */}
                      <div className="bg-gradient-to-r from-navy to-navy/80 px-4 py-2 flex items-center justify-between">
                        <h4 className="text-xs font-oswald uppercase tracking-wider text-white font-bold">
                          {config.label}
                        </h4>
                        <div className="flex items-center gap-1">
                          {isSaving && <Loader2 size={12} className="text-white/60 animate-spin" />}
                          {isSaved && <CheckCircle2 size={12} className="text-green-400" />}
                          {isDeleting && <Loader2 size={12} className="text-red-400 animate-spin" />}
                        </div>
                      </div>

                      {/* Player Slots (with drop zones) */}
                      <div className="p-3 flex gap-2 flex-wrap">
                        {config.positions.map((pos, slotIdx) => {
                          const player = lineSlots[slotIdx];
                          const slotDropKey = `${lineKey}:${slotIdx}`;
                          const isOver = dragOverSlot === slotDropKey;
                          const posValid = draggedPlayer
                            ? matchesSlotPosition(draggedPlayer.position, pos)
                            : true;
                          const isDragging = !!draggedPlayer;

                          return (
                            <div key={slotIdx} className="relative flex-1 min-w-[100px]">
                              {player ? (
                                /* ── Filled Slot ── */
                                <div className="border-2 border-teal/30 bg-teal/5 rounded-lg p-2 text-center relative group">
                                  <button
                                    onClick={() => removePlayer(lineKey, slotIdx)}
                                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                    title="Remove player"
                                  >
                                    <X size={10} />
                                  </button>
                                  {hasRealImage(player.image_url) ? (
                                    <img
                                      src={assetUrl(player.image_url)}
                                      alt=""
                                      className="w-8 h-8 rounded-full object-cover mx-auto mb-1"
                                    />
                                  ) : (
                                    <div className="w-8 h-8 rounded-full bg-navy/10 flex items-center justify-center mx-auto mb-1">
                                      <span className="text-[10px] font-bold text-navy/50">
                                        {player.name
                                          .split(" ")
                                          .map((n: string) => n[0])
                                          .join("")}
                                      </span>
                                    </div>
                                  )}
                                  <p className="text-[11px] font-semibold text-navy truncate leading-tight">
                                    {player.name.split(" ").slice(-1)[0]}
                                  </p>
                                  <span className="text-[9px] text-teal font-oswald font-bold">
                                    {player.position || pos}
                                  </span>
                                </div>
                              ) : (
                                /* ── Empty Slot (drop zone + click fallback) ── */
                                <div
                                  onDragOver={(e) => handleSlotDragOver(e, lineKey, slotIdx, pos)}
                                  onDragLeave={(e) => handleSlotDragLeave(e, lineKey, slotIdx)}
                                  onDrop={(e) => handleSlotDrop(e, lineKey, slotIdx, pos)}
                                  onClick={() => {
                                    setActivePicker(
                                      activePicker?.lineKey === lineKey && activePicker?.slotIdx === slotIdx
                                        ? null
                                        : { lineKey, slotIdx },
                                    );
                                    setPickerSearch("");
                                  }}
                                  className={`w-full border-2 rounded-lg p-2 text-center transition-all cursor-pointer ${
                                    isOver && posValid
                                      ? "border-teal bg-teal/10 shadow-[0_0_0_3px_rgba(24,179,166,0.15)] scale-[1.02]"
                                      : isOver && !posValid
                                      ? "border-orange/50 bg-orange/5"
                                      : isDragging && posValid
                                      ? "border-dashed border-teal/40 bg-teal/[0.02]"
                                      : "border-dashed border-teal/10 hover:border-teal/40 hover:bg-teal/5"
                                  }`}
                                >
                                  <div
                                    className={`w-8 h-8 rounded-full flex items-center justify-center mx-auto mb-1 transition-colors ${
                                      isOver && posValid
                                        ? "bg-teal/20"
                                        : isOver && !posValid
                                        ? "bg-orange/10"
                                        : "bg-border/20"
                                    }`}
                                  >
                                    <Plus
                                      size={14}
                                      className={
                                        isOver && posValid
                                          ? "text-teal"
                                          : isOver && !posValid
                                          ? "text-orange/60"
                                          : "text-muted/40"
                                      }
                                    />
                                  </div>
                                  <p
                                    className={`text-[10px] font-oswald uppercase tracking-wider ${
                                      isOver && posValid
                                        ? "text-teal font-bold"
                                        : isOver && !posValid
                                        ? "text-orange/60"
                                        : "text-muted/60"
                                    }`}
                                  >
                                    {isOver && posValid
                                      ? "Drop here"
                                      : isOver && !posValid
                                      ? "Wrong pos"
                                      : pos}
                                  </p>
                                </div>
                              )}

                              {/* Desktop click-picker dropdown (fallback) */}
                              {activePicker?.lineKey === lineKey &&
                                activePicker?.slotIdx === slotIdx &&
                                !player && (
                                  <div
                                    ref={pickerRef}
                                    className="absolute top-full left-0 mt-1 w-56 bg-white border border-teal/20 rounded-xl shadow-lg z-50 max-h-64 overflow-hidden"
                                  >
                                    <div className="p-2 border-b border-teal/20">
                                      <input
                                        type="text"
                                        placeholder="Search players..."
                                        value={pickerSearch}
                                        onChange={(e) => setPickerSearch(e.target.value)}
                                        className="w-full px-2 py-1.5 text-xs border border-teal/20 rounded-lg focus:outline-none focus:border-teal"
                                        autoFocus
                                      />
                                    </div>
                                    <div className="overflow-y-auto max-h-48">
                                      {getPickerPlayers(pos).map((pp) => {
                                        const assignedTo = (pp as Player & { _assignedTo: string | null })._assignedTo;
                                        const isPlayerAssigned = !!assignedTo;
                                        const matchPos = matchesSlotPosition(pp.position, pos);
                                        return (
                                          <button
                                            key={pp.id}
                                            onClick={() => {
                                              if (!isPlayerAssigned) assignPlayer(lineKey, slotIdx, pp);
                                            }}
                                            disabled={isPlayerAssigned}
                                            className={`w-full px-3 py-2 text-left flex items-center gap-2 text-xs transition-colors ${
                                              isPlayerAssigned
                                                ? "opacity-40 cursor-not-allowed bg-gray-50"
                                                : "hover:bg-teal/5"
                                            }`}
                                          >
                                            {hasRealImage(pp.image_url) ? (
                                              <img
                                                src={assetUrl(pp.image_url)}
                                                alt=""
                                                className="w-6 h-6 rounded-full object-cover flex-shrink-0"
                                              />
                                            ) : (
                                              <div className="w-6 h-6 rounded-full bg-navy/10 flex items-center justify-center flex-shrink-0">
                                                <Users size={10} className="text-navy/40" />
                                              </div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                              <p className="font-medium text-navy truncate">
                                                {pp.last_name}, {pp.first_name}
                                              </p>
                                              {isPlayerAssigned && (
                                                <p className="text-[9px] text-orange">
                                                  on {lineKeyToLabel(assignedTo!)}
                                                </p>
                                              )}
                                            </div>
                                            <span
                                              className={`px-1.5 py-0.5 rounded text-[9px] font-bold font-oswald ${
                                                matchPos
                                                  ? "bg-teal/10 text-teal"
                                                  : "bg-navy/5 text-navy/40"
                                              }`}
                                            >
                                              {pp.position}
                                            </span>
                                          </button>
                                        );
                                      })}
                                      {getPickerPlayers(pos).length === 0 && (
                                        <p className="px-3 py-4 text-xs text-muted text-center">
                                          No players found
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
