"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Users,
  Plus,
  X,
  Save,
  Loader2,
  CheckCircle2,
  ChevronDown,
  Trash2,
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

// Map line_type + line_order → existing line combo
type LineKey = string; // e.g. "forwards_1"

interface SlotPlayer {
  player_id: string;
  name: string;
  jersey: string;
  position: string;
  image_url?: string;
}

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

export default function LineBuilder({
  teamName,
  season,
  roster,
  existingLines,
  onLinesChanged,
}: LineBuilderProps) {
  // Map existing lines by key
  const [lineMap, setLineMap] = useState<Map<LineKey, LineCombination>>(new Map());
  // Track per-line slot assignments: lineKey → array of SlotPlayer | null
  const [slots, setSlots] = useState<Map<LineKey, (SlotPlayer | null)[]>>(new Map());
  // Which slot is currently open for picking
  const [activePicker, setActivePicker] = useState<{ lineKey: string; slotIdx: number } | null>(null);
  const [pickerSearch, setPickerSearch] = useState("");
  const [saving, setSaving] = useState<LineKey | null>(null);
  const [saved, setSaved] = useState<LineKey | null>(null);
  const [deleting, setDeleting] = useState<LineKey | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Initialize slots from existingLines
  useEffect(() => {
    const lm = new Map<LineKey, LineCombination>();
    const sm = new Map<LineKey, (SlotPlayer | null)[]>();

    for (const line of existingLines) {
      if (line.data_source !== "manual") continue;
      const key = `${line.line_type}_${line.line_order}`;
      lm.set(key, line);

      // Parse player_refs into slots
      const config = LINE_SLOT_CONFIG[line.line_type]?.find((c) => c.order === line.line_order);
      const numSlots = config?.slots || 3;
      const refs = line.player_refs || [];
      const slotArr: (SlotPlayer | null)[] = [];
      for (let i = 0; i < numSlots; i++) {
        const ref = refs[i];
        if (ref && ref.name) {
          // Try to find matching roster player for image_url
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

  // Get all currently assigned player_ids (for graying out)
  const assignedPlayerIds = useCallback((): Map<string, string> => {
    const map = new Map<string, string>(); // player_id → lineKey
    slots.forEach((slotArr, lineKey) => {
      for (const s of slotArr) {
        if (s?.player_id) map.set(s.player_id, lineKey);
      }
    });
    return map;
  }, [slots]);

  // Get human-readable line name from key
  function lineKeyToLabel(key: string): string {
    const [type, orderStr] = key.split("_");
    const order = parseInt(orderStr);
    const config = LINE_SLOT_CONFIG[type]?.find((c) => c.order === order);
    return config?.label || key;
  }

  // Assign a player to a slot
  async function assignPlayer(lineKey: string, slotIdx: number, player: Player) {
    const [lineType, orderStr] = lineKey.split("_");
    const lineOrder = parseInt(orderStr);
    const config = LINE_SLOT_CONFIG[lineType]?.find((c) => c.order === lineOrder);
    if (!config) return;

    // Build new slot array
    const currentSlots = slots.get(lineKey) || new Array(config.slots).fill(null);
    const newSlots = [...currentSlots];
    newSlots[slotIdx] = {
      player_id: player.id,
      name: `${player.first_name} ${player.last_name}`,
      jersey: "",
      position: player.position,
      image_url: player.image_url || undefined,
    };

    // Update state immediately
    setSlots((prev) => new Map(prev).set(lineKey, newSlots));
    setActivePicker(null);
    setPickerSearch("");

    // Save to backend
    await saveLine(lineKey, lineType, lineOrder, config.label, newSlots);
  }

  // Remove a player from a slot
  async function removePlayer(lineKey: string, slotIdx: number) {
    const [lineType, orderStr] = lineKey.split("_");
    const lineOrder = parseInt(orderStr);
    const config = LINE_SLOT_CONFIG[lineType]?.find((c) => c.order === lineOrder);
    if (!config) return;

    const currentSlots = slots.get(lineKey) || new Array(config.slots).fill(null);
    const newSlots = [...currentSlots];
    newSlots[slotIdx] = null;

    setSlots((prev) => new Map(prev).set(lineKey, newSlots));

    // If all slots are empty and line exists, delete it
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

  // Save line to backend (create or update)
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
        // Update
        const res = await api.put<LineCombination>(`/lines/${existing.id}`, {
          player_refs: playerRefs,
          line_label: lineLabel,
          line_order: lineOrder,
        });
        setLineMap((prev) => new Map(prev).set(lineKey, res.data));
      } else {
        // Create
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

  // Filter roster for picker
  function getPickerPlayers(slotPosition: string): Player[] {
    const assigned = assignedPlayerIds();
    const search = pickerSearch.toLowerCase();

    return roster
      .filter((p) => p.position.toUpperCase() !== "G") // Never show goalies in line slots
      .sort((a, b) => {
        // Matching position first
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

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  const sections: { type: string; label: string; icon: string }[] = [
    { type: "forwards", label: "Forward Lines", icon: "FWD" },
    { type: "defense", label: "Defensive Pairs", icon: "DEF" },
    { type: "pp", label: "Power Play", icon: "PP" },
    { type: "pk", label: "Penalty Kill", icon: "PK" },
  ];

  if (roster.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-xl border border-border">
        <Users size={32} className="mx-auto text-muted/40 mb-3" />
        <p className="text-muted text-sm">No players on this roster yet.</p>
        <p className="text-xs text-muted/60 mt-1">
          Sync a roster from the League Hub or add players manually.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
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

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {configs.map((config) => {
                const lineKey = `${section.type}_${config.order}`;
                const lineSlots = slots.get(lineKey) || new Array(config.slots).fill(null);
                const isSaving = saving === lineKey;
                const isSaved = saved === lineKey;
                const isDeleting = deleting === lineKey;

                return (
                  <div
                    key={lineKey}
                    className="bg-white rounded-xl border border-border overflow-hidden"
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

                    {/* Player Slots */}
                    <div className="p-3 flex gap-2 flex-wrap relative">
                      {config.positions.map((pos, slotIdx) => {
                        const player = lineSlots[slotIdx];
                        const isPickerOpen =
                          activePicker?.lineKey === lineKey && activePicker?.slotIdx === slotIdx;

                        return (
                          <div key={slotIdx} className="relative flex-1 min-w-[100px]">
                            {player ? (
                              /* Filled Slot */
                              <div className="border-2 border-teal/30 bg-teal/5 rounded-lg p-2 text-center relative group">
                                <button
                                  onClick={() => removePlayer(lineKey, slotIdx)}
                                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
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
                              /* Empty Slot */
                              <button
                                onClick={() => {
                                  setActivePicker(
                                    isPickerOpen ? null : { lineKey, slotIdx },
                                  );
                                  setPickerSearch("");
                                }}
                                className="w-full border-2 border-dashed border-border/40 rounded-lg p-2 text-center hover:border-teal/40 hover:bg-teal/5 transition-colors"
                              >
                                <div className="w-8 h-8 rounded-full bg-border/20 flex items-center justify-center mx-auto mb-1">
                                  <Plus size={14} className="text-muted/40" />
                                </div>
                                <p className="text-[10px] font-oswald uppercase tracking-wider text-muted/60">
                                  {pos}
                                </p>
                              </button>
                            )}

                            {/* Player Picker Dropdown */}
                            {isPickerOpen && (
                              <div
                                ref={pickerRef}
                                className="absolute top-full left-0 mt-1 w-56 bg-white border border-border rounded-xl shadow-lg z-50 max-h-64 overflow-hidden"
                              >
                                <div className="p-2 border-b border-border">
                                  <input
                                    type="text"
                                    placeholder="Search players..."
                                    value={pickerSearch}
                                    onChange={(e) => setPickerSearch(e.target.value)}
                                    className="w-full px-2 py-1.5 text-xs border border-border rounded-lg focus:outline-none focus:border-teal"
                                    autoFocus
                                  />
                                </div>
                                <div className="overflow-y-auto max-h-48">
                                  {getPickerPlayers(pos).map((p) => {
                                    const assignedTo = (p as Player & { _assignedTo: string | null })._assignedTo;
                                    const isAssigned = !!assignedTo;
                                    const matchesPos = matchesSlotPosition(p.position, pos);
                                    return (
                                      <button
                                        key={p.id}
                                        onClick={() => {
                                          if (!isAssigned) assignPlayer(lineKey, slotIdx, p);
                                        }}
                                        disabled={isAssigned}
                                        className={`w-full px-3 py-2 text-left flex items-center gap-2 text-xs transition-colors ${
                                          isAssigned
                                            ? "opacity-40 cursor-not-allowed bg-gray-50"
                                            : "hover:bg-teal/5"
                                        }`}
                                      >
                                        {hasRealImage(p.image_url) ? (
                                          <img
                                            src={assetUrl(p.image_url)}
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
                                            {p.last_name}, {p.first_name}
                                          </p>
                                          {isAssigned && (
                                            <p className="text-[9px] text-orange">
                                              on {lineKeyToLabel(assignedTo)}
                                            </p>
                                          )}
                                        </div>
                                        <span
                                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold font-oswald ${
                                            matchesPos
                                              ? "bg-teal/10 text-teal"
                                              : "bg-navy/5 text-navy/40"
                                          }`}
                                        >
                                          {p.position}
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
  );
}
