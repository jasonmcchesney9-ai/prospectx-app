"use client";

import { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Film,
  Loader2,
  Sparkles,
  GripVertical,
  Trash2,
  Plus,
  User,
  Clock,
  Save,
} from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import api from "@/lib/api";
import toast from "react-hot-toast";

/* ─── Types ─── */

interface ClipData {
  id: string;
  title: string;
  description?: string;
  start_time_seconds: number;
  end_time_seconds: number;
  clip_type?: string;
  tags?: string[];
  player_ids?: string[];
}

interface PlayerOption {
  id: string;
  first_name: string;
  last_name: string;
  position?: string;
  team?: string;
}

interface PxiSuggestions {
  suggested_order?: string[];
  section_breaks?: { after_clip_index: number; label: string }[];
  opening_note?: string;
  closing_note?: string;
  cut_suggestions?: string[];
  duration_estimate_seconds?: number;
  notes?: string;
  raw_response?: string;
}

/* ─── Constants ─── */

const LEVEL_OPTIONS = [
  { value: "junior", label: "Junior", desc: "OHL, WHL, QMJHL, USHL" },
  { value: "college", label: "College", desc: "NCAA D1, D3, CIS" },
  { value: "pro", label: "Pro", desc: "AHL, ECHL, NHL" },
];

const STEPS = [
  { label: "Template", desc: "Title, level, and player" },
  { label: "Player Info", desc: "Confirm player details" },
  { label: "Select Clips", desc: "Choose and order clips" },
  { label: "Review", desc: "Finalize and save" },
];

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/* ─── Main Page ─── */

export default function NewHighlightReelPageWrapper() {
  return (
    <Suspense fallback={
      <ProtectedRoute>
        <NavBar />
        <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-center py-20">
            <Loader2 size={32} className="animate-spin" style={{ color: "#0D9488" }} />
          </div>
        </main>
      </ProtectedRoute>
    }>
      <NewHighlightReelPage />
    </Suspense>
  );
}

function NewHighlightReelPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preSessionId = searchParams.get("session");
  const prePlayerId = searchParams.get("player");

  const [step, setStep] = useState(0);

  // Step 1 — Template
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [level, setLevel] = useState("junior");
  const [playerId, setPlayerId] = useState(prePlayerId || "");
  const [players, setPlayers] = useState<PlayerOption[]>([]);
  const [playerSearch, setPlayerSearch] = useState("");
  const [loadingPlayers, setLoadingPlayers] = useState(false);

  // Step 2 — Player Info (auto-populated)
  const [playerInfo, setPlayerInfo] = useState<Record<string, string>>({
    height: "",
    weight: "",
    shoots: "",
    highlights: "",
  });

  // Step 3 — Clips
  const [availableClips, setAvailableClips] = useState<ClipData[]>([]);
  const [selectedClipIds, setSelectedClipIds] = useState<string[]>([]);
  const [loadingClips, setLoadingClips] = useState(false);
  const [pxiSuggestions, setPxiSuggestions] = useState<PxiSuggestions | null>(null);
  const [generatingSuggestions, setGeneratingSuggestions] = useState(false);

  // Step 4 — Saving
  const [saving, setSaving] = useState(false);

  /* ─── Load players for search (debounced API search) ─── */
  useEffect(() => {
    const trimmed = playerSearch.trim();
    if (!trimmed && !prePlayerId) {
      // No query and no pre-selected player — load first batch
      setLoadingPlayers(true);
      api.get("/players", { params: { limit: 50 } })
        .then((res) => setPlayers(Array.isArray(res.data) ? res.data : res.data.players || []))
        .catch(() => {})
        .finally(() => setLoadingPlayers(false));
      return;
    }
    if (!trimmed) return; // pre-selected player but no search text — skip
    setLoadingPlayers(true);
    const debounce = setTimeout(() => {
      api.get("/players", { params: { search: trimmed, limit: 50 } })
        .then((res) => setPlayers(Array.isArray(res.data) ? res.data : res.data.players || []))
        .catch(() => {})
        .finally(() => setLoadingPlayers(false));
    }, 300);
    return () => clearTimeout(debounce);
  }, [playerSearch, prePlayerId]);

  /* ─── Load clips from session ─── */
  useEffect(() => {
    if (!preSessionId) return;
    async function loadClips() {
      setLoadingClips(true);
      try {
        const res = await api.get("/film/clips", { params: { session_id: preSessionId, limit: 200 } });
        setAvailableClips(Array.isArray(res.data) ? res.data : []);
      } catch {
        // Silently handle
      } finally {
        setLoadingClips(false);
      }
    }
    loadClips();
  }, [preSessionId]);

  /* ─── Load player info when player selected ─── */
  useEffect(() => {
    if (!playerId) return;
    async function loadPlayerInfo() {
      try {
        const res = await api.get(`/players/${playerId}`);
        const p = res.data;
        setPlayerInfo({
          height: p.height || "",
          weight: p.weight || "",
          shoots: p.shoots || "",
          highlights: p.strengths || "",
        });
        // Ensure selected player is in the players list for selectedPlayer lookup
        setPlayers((prev) => {
          if (prev.some((x) => x.id === p.id)) return prev;
          return [...prev, { id: p.id, first_name: p.first_name, last_name: p.last_name, position: p.position, team: p.current_team }];
        });
      } catch {
        // Silently handle
      }
    }
    loadPlayerInfo();
  }, [playerId]);

  /* ─── Filtered players for search (API already filters — just limit display) ─── */
  const filteredPlayers = useMemo(() => {
    return players.slice(0, 20);
  }, [players]);

  const selectedPlayer = useMemo(
    () => players.find((p) => p.id === playerId) || null,
    [players, playerId]
  );

  /* ─── Clip selection helpers ─── */
  const toggleClip = useCallback((clipId: string) => {
    setSelectedClipIds((prev) =>
      prev.includes(clipId)
        ? prev.filter((id) => id !== clipId)
        : [...prev, clipId]
    );
  }, []);

  const moveClip = useCallback((fromIndex: number, toIndex: number) => {
    setSelectedClipIds((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }, []);

  const selectedClips = useMemo(
    () => selectedClipIds.map((id) => availableClips.find((c) => c.id === id)).filter(Boolean) as ClipData[],
    [selectedClipIds, availableClips]
  );

  const totalDuration = useMemo(
    () => selectedClips.reduce((sum, c) => sum + (c.end_time_seconds - c.start_time_seconds), 0),
    [selectedClips]
  );

  /* ─── PXI Suggest ─── */
  const handlePxiSuggest = useCallback(async (reelId: string) => {
    setGeneratingSuggestions(true);
    try {
      const res = await api.post(`/highlight-reels/${reelId}/generate-suggestions`);
      if (res.data.suggestions) {
        setPxiSuggestions(res.data.suggestions);
        // Apply suggested order if available
        if (res.data.suggestions.suggested_order) {
          setSelectedClipIds(res.data.suggestions.suggested_order);
        }
        toast.success("PXI suggestions generated!");
      }
    } catch {
      toast.error("Failed to generate suggestions");
    } finally {
      setGeneratingSuggestions(false);
    }
  }, []);

  /* ─── Save reel ─── */
  const handleSave = useCallback(async () => {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    setSaving(true);
    try {
      const res = await api.post("/highlight-reels", {
        title: title.trim(),
        description: description.trim(),
        level,
        player_id: playerId || null,
        clip_ids: selectedClipIds,
        clip_order: selectedClipIds,
        player_info: playerInfo,
        status: "draft",
      });
      toast.success("Highlight reel created!");
      router.push(`/reels/${res.data.id}`);
    } catch {
      toast.error("Failed to create highlight reel");
    } finally {
      setSaving(false);
    }
  }, [title, description, level, playerId, selectedClipIds, playerInfo, router]);

  /* ─── Step validation ─── */
  const canAdvance = useMemo(() => {
    if (step === 0) return title.trim().length > 0;
    if (step === 1) return true; // Player info is optional
    if (step === 2) return selectedClipIds.length > 0;
    return true;
  }, [step, title, selectedClipIds]);

  return (
    <ProtectedRoute>
      <NavBar />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* ═══ Header ═══ */}
        <div className="px-5 py-4 flex items-center justify-between mb-6" style={{ borderRadius: 12, border: "1.5px solid #DDE6EF", background: "#0F2942" }}>
          <div className="flex items-center gap-3">
            <Link href="/highlight-reels" className="hover:opacity-70 transition-opacity" style={{ color: "rgba(255,255,255,0.6)" }}>
              <ArrowLeft size={20} />
            </Link>
            <span className="px-2.5 py-1 rounded-md text-white font-bold uppercase" style={{ fontSize: 10, fontFamily: "ui-monospace, monospace", letterSpacing: 2, background: "#EA580C" }}>
              HIGHLIGHT REEL
            </span>
            <h1 className="text-lg font-bold text-white">Build New Reel</h1>
          </div>
        </div>

        {/* ═══ Stepper ═══ */}
        <div className="flex items-center gap-1 mb-6">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center gap-1 flex-1">
              <button
                onClick={() => i < step && setStep(i)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold uppercase transition-colors w-full ${
                  i === step
                    ? "text-white"
                    : i < step
                    ? "text-white cursor-pointer hover:opacity-90"
                    : "cursor-default"
                }`}
                style={{
                  fontFamily: "ui-monospace, monospace",
                  letterSpacing: 1,
                  background: i === step ? "#0D9488" : i < step ? "#0F2942" : "#DDE6EF",
                  color: i === step ? "#FFFFFF" : i < step ? "#FFFFFF" : "#8BA4BB",
                }}
                disabled={i > step}
              >
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold"
                  style={{
                    background: i <= step ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.05)",
                  }}
                >
                  {i < step ? <Check size={10} /> : i + 1}
                </span>
                <span className="hidden sm:inline">{s.label}</span>
              </button>
              {i < STEPS.length - 1 && (
                <div className="w-4 h-px shrink-0" style={{ background: "#DDE6EF" }} />
              )}
            </div>
          ))}
        </div>

        {/* ═══ Step Content ═══ */}
        <div className="overflow-hidden" style={{ borderRadius: 12, border: "1.5px solid #DDE6EF", borderLeft: "3px solid #EA580C" }}>
          {/* Step header */}
          <div className="flex items-center gap-2 px-5 py-3" style={{ background: "#0F2942" }}>
            <span className="w-2 h-2 rounded-full" style={{ background: "#EA580C" }} />
            <span className="font-bold uppercase text-white" style={{ fontSize: 10, fontFamily: "ui-monospace, monospace", letterSpacing: 2 }}>
              Step {step + 1}: {STEPS[step].label}
            </span>
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
              {STEPS[step].desc}
            </span>
          </div>

          <div className="bg-white px-5 py-5">
            {/* ═══════════ STEP 1: Template ═══════════ */}
            {step === 0 && (
              <div className="space-y-4">
                {/* Title */}
                <div>
                  <label className="font-bold uppercase mb-1 block" style={{ fontSize: 9, fontFamily: "ui-monospace, monospace", letterSpacing: 1, color: "#8BA4BB" }}>
                    Reel Title *
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Ewan McChesney — 2025-26 Season Highlights"
                    className="w-full px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
                    style={{ borderRadius: 8, border: "1.5px solid #DDE6EF", color: "#0F2942" }}
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="font-bold uppercase mb-1 block" style={{ fontSize: 9, fontFamily: "ui-monospace, monospace", letterSpacing: 1, color: "#8BA4BB" }}>
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief description of this highlight reel..."
                    rows={2}
                    className="w-full px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal/30 resize-none"
                    style={{ borderRadius: 8, border: "1.5px solid #DDE6EF", color: "#0F2942" }}
                  />
                </div>

                {/* Level */}
                <div>
                  <label className="font-bold uppercase mb-1 block" style={{ fontSize: 9, fontFamily: "ui-monospace, monospace", letterSpacing: 1, color: "#8BA4BB" }}>
                    Target Level
                  </label>
                  <div className="flex gap-2">
                    {LEVEL_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setLevel(opt.value)}
                        className="flex-1 px-3 py-2.5 rounded-lg text-xs font-bold uppercase transition-colors"
                        style={{
                          fontFamily: "ui-monospace, monospace",
                          letterSpacing: 1,
                          background: level === opt.value ? "#EA580C" : "transparent",
                          color: level === opt.value ? "#FFFFFF" : "#5A7291",
                          border: `1.5px solid ${level === opt.value ? "#EA580C" : "#DDE6EF"}`,
                        }}
                      >
                        <span className="block">{opt.label}</span>
                        <span className="block font-normal mt-0.5" style={{ fontSize: 8, opacity: 0.7, letterSpacing: 0 }}>
                          {opt.desc}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Player selection */}
                <div>
                  <label className="font-bold uppercase mb-1 block" style={{ fontSize: 9, fontFamily: "ui-monospace, monospace", letterSpacing: 1, color: "#8BA4BB" }}>
                    Player
                  </label>
                  {selectedPlayer ? (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ border: "1.5px solid #DDE6EF" }}>
                      <User size={14} style={{ color: "#0D9488" }} />
                      <span className="text-sm font-medium" style={{ color: "#0F2942" }}>
                        {selectedPlayer.first_name} {selectedPlayer.last_name}
                        {selectedPlayer.position ? ` (${selectedPlayer.position})` : ""}
                      </span>
                      <button
                        onClick={() => setPlayerId("")}
                        className="ml-auto text-xs hover:opacity-70 transition-opacity"
                        style={{ color: "#5A7291" }}
                      >
                        Change
                      </button>
                    </div>
                  ) : (
                    <div>
                      <input
                        type="text"
                        value={playerSearch}
                        onChange={(e) => setPlayerSearch(e.target.value)}
                        placeholder="Search players..."
                        className="w-full px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
                        style={{ borderRadius: 8, border: "1.5px solid #DDE6EF", color: "#0F2942" }}
                      />
                      {loadingPlayers ? (
                        <div className="flex items-center justify-center py-3">
                          <Loader2 size={16} className="animate-spin" style={{ color: "#0D9488" }} />
                        </div>
                      ) : (
                        <div className="mt-1 max-h-[200px] overflow-y-auto rounded-lg" style={{ border: "1.5px solid #DDE6EF" }}>
                          {filteredPlayers.map((p) => (
                            <button
                              key={p.id}
                              onClick={() => { setPlayerId(p.id); setPlayerSearch(""); }}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition-colors flex items-center gap-2"
                              style={{ color: "#0F2942", borderBottom: "1px solid #DDE6EF" }}
                            >
                              <User size={12} style={{ color: "#8BA4BB" }} />
                              {p.first_name} {p.last_name}
                              {p.position ? <span className="text-[10px] ml-1" style={{ color: "#8BA4BB" }}>({p.position})</span> : null}
                              {p.team ? <span className="text-[10px] ml-auto" style={{ color: "#8BA4BB" }}>{p.team}</span> : null}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ═══════════ STEP 2: Player Info ═══════════ */}
            {step === 1 && (
              <div className="space-y-4">
                <p className="text-sm" style={{ color: "#5A7291" }}>
                  Confirm or edit the player details that will appear on the reel.
                  {!playerId && " No player selected — you can skip this step."}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: "height", label: "Height", placeholder: "e.g. 6'1\"" },
                    { key: "weight", label: "Weight", placeholder: "e.g. 185 lbs" },
                    { key: "shoots", label: "Shoots", placeholder: "L or R" },
                  ].map((field) => (
                    <div key={field.key}>
                      <label className="font-bold uppercase mb-1 block" style={{ fontSize: 9, fontFamily: "ui-monospace, monospace", letterSpacing: 1, color: "#8BA4BB" }}>
                        {field.label}
                      </label>
                      <input
                        type="text"
                        value={playerInfo[field.key] || ""}
                        onChange={(e) => setPlayerInfo((prev) => ({ ...prev, [field.key]: e.target.value }))}
                        placeholder={field.placeholder}
                        className="w-full px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
                        style={{ borderRadius: 8, border: "1.5px solid #DDE6EF", color: "#0F2942" }}
                      />
                    </div>
                  ))}
                </div>
                <div>
                  <label className="font-bold uppercase mb-1 block" style={{ fontSize: 9, fontFamily: "ui-monospace, monospace", letterSpacing: 1, color: "#8BA4BB" }}>
                    Key Highlights / Strengths
                  </label>
                  <textarea
                    value={playerInfo.highlights || ""}
                    onChange={(e) => setPlayerInfo((prev) => ({ ...prev, highlights: e.target.value }))}
                    placeholder="Speed, hockey IQ, compete level..."
                    rows={3}
                    className="w-full px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal/30 resize-none"
                    style={{ borderRadius: 8, border: "1.5px solid #DDE6EF", color: "#0F2942" }}
                  />
                </div>
              </div>
            )}

            {/* ═══════════ STEP 3: Select & Order Clips ═══════════ */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm" style={{ color: "#5A7291" }}>
                    {selectedClipIds.length} clip{selectedClipIds.length !== 1 ? "s" : ""} selected
                    {totalDuration > 0 && ` (${formatDuration(totalDuration)} total)`}
                  </p>
                </div>

                {/* Available clips */}
                {loadingClips ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 size={20} className="animate-spin" style={{ color: "#0D9488" }} />
                  </div>
                ) : availableClips.length === 0 ? (
                  <div className="text-center py-8">
                    <Film size={32} className="mx-auto mb-2" style={{ color: "#DDE6EF" }} />
                    <p className="text-sm" style={{ color: "#5A7291" }}>No clips available.</p>
                    <p className="text-xs mt-1" style={{ color: "#8BA4BB" }}>
                      Create clips in the Film Room first, then come back here.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {/* Left: Available clips */}
                    <div>
                      <p className="font-bold uppercase mb-2" style={{ fontSize: 9, fontFamily: "ui-monospace, monospace", letterSpacing: 1, color: "#8BA4BB" }}>
                        Available Clips
                      </p>
                      <div className="space-y-1 max-h-[400px] overflow-y-auto">
                        {availableClips.map((clip) => {
                          const isSelected = selectedClipIds.includes(clip.id);
                          return (
                            <button
                              key={clip.id}
                              onClick={() => toggleClip(clip.id)}
                              className="w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center gap-2"
                              style={{
                                border: `1.5px solid ${isSelected ? "#0D9488" : "#DDE6EF"}`,
                                background: isSelected ? "rgba(13,148,136,0.05)" : "transparent",
                              }}
                            >
                              <span
                                className="w-4 h-4 rounded shrink-0 flex items-center justify-center"
                                style={{
                                  border: `1.5px solid ${isSelected ? "#0D9488" : "#DDE6EF"}`,
                                  background: isSelected ? "#0D9488" : "transparent",
                                }}
                              >
                                {isSelected && <Check size={10} className="text-white" />}
                              </span>
                              <div className="min-w-0 flex-1">
                                <span className="text-sm font-medium block truncate" style={{ color: "#0F2942" }}>
                                  {clip.title}
                                </span>
                                <span className="text-[10px] flex items-center gap-1" style={{ color: "#8BA4BB" }}>
                                  <Clock size={9} />
                                  {formatDuration(clip.start_time_seconds)} - {formatDuration(clip.end_time_seconds)}
                                  <span className="ml-1">({formatDuration(clip.end_time_seconds - clip.start_time_seconds)})</span>
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Right: Selected clip order */}
                    <div>
                      <p className="font-bold uppercase mb-2" style={{ fontSize: 9, fontFamily: "ui-monospace, monospace", letterSpacing: 1, color: "#8BA4BB" }}>
                        Reel Order (drag to reorder)
                      </p>
                      {selectedClips.length === 0 ? (
                        <div className="text-center py-8 rounded-lg" style={{ border: "1.5px dashed #DDE6EF" }}>
                          <Plus size={20} className="mx-auto mb-1" style={{ color: "#DDE6EF" }} />
                          <p className="text-xs" style={{ color: "#8BA4BB" }}>Select clips from the left</p>
                        </div>
                      ) : (
                        <div className="space-y-1 max-h-[400px] overflow-y-auto">
                          {selectedClips.map((clip, idx) => (
                            <div
                              key={clip.id}
                              className="flex items-center gap-2 px-3 py-2 rounded-lg"
                              style={{ border: "1.5px solid #DDE6EF", background: "#FAFBFC" }}
                            >
                              <span className="text-[10px] font-bold w-5 text-center shrink-0" style={{ fontFamily: "ui-monospace, monospace", color: "#8BA4BB" }}>
                                {idx + 1}
                              </span>
                              <GripVertical size={12} className="shrink-0 cursor-grab" style={{ color: "#DDE6EF" }} />
                              <div className="min-w-0 flex-1">
                                <span className="text-sm font-medium block truncate" style={{ color: "#0F2942" }}>
                                  {clip.title}
                                </span>
                                <span className="text-[10px]" style={{ color: "#8BA4BB" }}>
                                  {formatDuration(clip.end_time_seconds - clip.start_time_seconds)}
                                </span>
                              </div>
                              <div className="flex items-center gap-0.5 shrink-0">
                                {idx > 0 && (
                                  <button
                                    onClick={() => moveClip(idx, idx - 1)}
                                    className="p-1 rounded hover:bg-slate-100 transition-colors text-[10px]"
                                    style={{ color: "#5A7291" }}
                                  >
                                    &uarr;
                                  </button>
                                )}
                                {idx < selectedClips.length - 1 && (
                                  <button
                                    onClick={() => moveClip(idx, idx + 1)}
                                    className="p-1 rounded hover:bg-slate-100 transition-colors text-[10px]"
                                    style={{ color: "#5A7291" }}
                                  >
                                    &darr;
                                  </button>
                                )}
                                <button
                                  onClick={() => toggleClip(clip.id)}
                                  className="p-1 rounded hover:bg-red-50 transition-colors"
                                  style={{ color: "#8BA4BB" }}
                                >
                                  <Trash2 size={11} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ═══════════ STEP 4: Review & Save ═══════════ */}
            {step === 3 && (
              <div className="space-y-4">
                {/* Summary */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="font-bold uppercase mb-1" style={{ fontSize: 9, fontFamily: "ui-monospace, monospace", letterSpacing: 1, color: "#8BA4BB" }}>
                      Title
                    </p>
                    <p className="text-sm font-medium" style={{ color: "#0F2942" }}>{title}</p>
                  </div>
                  <div>
                    <p className="font-bold uppercase mb-1" style={{ fontSize: 9, fontFamily: "ui-monospace, monospace", letterSpacing: 1, color: "#8BA4BB" }}>
                      Level
                    </p>
                    <p className="text-sm font-medium capitalize" style={{ color: "#0F2942" }}>{level}</p>
                  </div>
                  <div>
                    <p className="font-bold uppercase mb-1" style={{ fontSize: 9, fontFamily: "ui-monospace, monospace", letterSpacing: 1, color: "#8BA4BB" }}>
                      Player
                    </p>
                    <p className="text-sm" style={{ color: "#0F2942" }}>
                      {selectedPlayer
                        ? `${selectedPlayer.first_name} ${selectedPlayer.last_name}`
                        : "No player selected"}
                    </p>
                  </div>
                  <div>
                    <p className="font-bold uppercase mb-1" style={{ fontSize: 9, fontFamily: "ui-monospace, monospace", letterSpacing: 1, color: "#8BA4BB" }}>
                      Clips
                    </p>
                    <p className="text-sm" style={{ color: "#0F2942" }}>
                      {selectedClipIds.length} clips ({formatDuration(totalDuration)})
                    </p>
                  </div>
                </div>

                {/* PXI Suggestions */}
                {pxiSuggestions && (
                  <div className="overflow-hidden" style={{ borderRadius: 8, border: "1.5px solid rgba(13,148,136,0.2)" }}>
                    <div className="px-4 py-2 flex items-center gap-2" style={{ background: "rgba(13,148,136,0.05)" }}>
                      <Sparkles size={12} style={{ color: "#0D9488" }} />
                      <span className="font-bold uppercase" style={{ fontSize: 9, fontFamily: "ui-monospace, monospace", letterSpacing: 1, color: "#0D9488" }}>
                        PXI Suggestions
                      </span>
                    </div>
                    <div className="px-4 py-3 space-y-2">
                      {pxiSuggestions.opening_note && (
                        <p className="text-xs" style={{ color: "#5A7291" }}>
                          <strong style={{ color: "#0F2942" }}>Opening:</strong> {pxiSuggestions.opening_note}
                        </p>
                      )}
                      {pxiSuggestions.closing_note && (
                        <p className="text-xs" style={{ color: "#5A7291" }}>
                          <strong style={{ color: "#0F2942" }}>Closing:</strong> {pxiSuggestions.closing_note}
                        </p>
                      )}
                      {pxiSuggestions.notes && (
                        <p className="text-xs" style={{ color: "#5A7291" }}>
                          <strong style={{ color: "#0F2942" }}>Notes:</strong> {pxiSuggestions.notes}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Clip order list */}
                <div>
                  <p className="font-bold uppercase mb-2" style={{ fontSize: 9, fontFamily: "ui-monospace, monospace", letterSpacing: 1, color: "#8BA4BB" }}>
                    Final Clip Order
                  </p>
                  <div className="space-y-1">
                    {selectedClips.map((clip, idx) => (
                      <div key={clip.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ border: "1px solid #DDE6EF" }}>
                        <span className="text-[10px] font-bold w-5 text-center shrink-0" style={{ fontFamily: "ui-monospace, monospace", color: "#EA580C" }}>
                          {idx + 1}
                        </span>
                        <span className="text-sm truncate" style={{ color: "#0F2942" }}>{clip.title}</span>
                        <span className="text-[10px] ml-auto shrink-0" style={{ fontFamily: "ui-monospace, monospace", color: "#8BA4BB" }}>
                          {formatDuration(clip.end_time_seconds - clip.start_time_seconds)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ═══ Navigation ═══ */}
        <div className="flex items-center justify-between mt-4">
          <button
            onClick={() => setStep(Math.max(0, step - 1))}
            disabled={step === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold uppercase transition-colors disabled:opacity-30"
            style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 1, color: "#5A7291", border: "1.5px solid #DDE6EF" }}
          >
            <ArrowLeft size={12} />
            Back
          </button>

          <div className="flex items-center gap-2">
            {step === 3 && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-bold uppercase transition-colors hover:opacity-90 disabled:opacity-50 text-white"
                style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 1, background: "#EA580C" }}
              >
                {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                {saving ? "Saving..." : "Save Reel"}
              </button>
            )}
            {step < 3 && (
              <button
                onClick={() => setStep(Math.min(3, step + 1))}
                disabled={!canAdvance}
                className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-bold uppercase transition-colors hover:opacity-90 disabled:opacity-30 text-white"
                style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 1, background: canAdvance ? "#0D9488" : "#DDE6EF" }}
              >
                Next
                <ArrowRight size={12} />
              </button>
            )}
          </div>
        </div>
      </main>
    </ProtectedRoute>
  );
}
