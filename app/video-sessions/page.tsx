"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Video,
  Search,
  Filter,
  Calendar,
  X,
  Play,
  Folder,
  Info,
  ChevronDown,
  Upload,
  CheckCircle,
  ChevronUp,
  Wrench,
} from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import api from "@/lib/api";

/* ── Types ─────────────────────────────────────────────────── */
interface VideoEvent {
  id: string;
  game_date: string;
  team_name: string;
  opponent_name: string;
  player_id: string | null;
  player_name: string | null;
  period: number;
  clock_time: string;
  start_s: number;
  end_s: number | null;
  action: string;
  result: string | null;
  zone: string | null;
  short_description: string;
  pos_x: number | null;
  pos_y: number | null;
}

interface VideoSession {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
  clip_count: number;
}

interface PlayerSearchResult {
  id: string;
  first_name: string;
  last_name: string;
  position: string;
  current_team: string;
}

/* ── Action chip config ─────────────────────────────────────── */
const ACTION_CHIPS = [
  { label: "Faceoffs", values: ["Faceoffs", "Faceoffs won", "Faceoffs lost", "Faceoffs in OZ", "Faceoffs in DZ", "Faceoffs in NZ"] },
  { label: "Shots", values: ["Shots", "Shots on goal", "Missed shots", "Power play shots", "Short-handed shots"] },
  { label: "Goals", values: ["Goals"] },
  { label: "Hits", values: ["Hits"] },
  { label: "Blocked Shots", values: ["Blocked shots", "Shots blocking"] },
  { label: "Penalties", values: ["Penalties"] },
  { label: "Shifts", values: ["All shifts", "Even strength shifts", "Power play shifts", "Penalty kill shifts", "OZ play shifts", "DZ play shifts", "NZ play shifts"] },
];

const ZONE_CHIPS = [
  { label: "All", value: "" },
  { label: "OZ", value: "OZ" },
  { label: "NZ", value: "NZ" },
  { label: "DZ", value: "DZ" },
];

const POSITION_GROUPS = [
  { label: "All", value: "" },
  { label: "Forwards", value: "F" },
  { label: "Defence", value: "D" },
  { label: "Goalies", value: "G" },
];

/* ── Main Page ─────────────────────────────────────────────── */
export default function VideoSessionsPage() {
  return (
    <ProtectedRoute>
      <NavBar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <VideoSessionsContent />
      </main>
    </ProtectedRoute>
  );
}

function VideoSessionsContent() {
  const router = useRouter();

  /* ── Filter state ───────────────────────────────────────── */
  const [playerSearch, setPlayerSearch] = useState("");
  const [playerResults, setPlayerResults] = useState<PlayerSearchResult[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerSearchResult | null>(null);
  const [showPlayerDropdown, setShowPlayerDropdown] = useState(false);
  const [positionGroup, setPositionGroup] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedActions, setSelectedActions] = useState<string[]>([]);
  const [selectedZone, setSelectedZone] = useState("");
  const playerDropdownRef = useRef<HTMLDivElement>(null);

  /* ── Events state ───────────────────────────────────────── */
  const [events, setEvents] = useState<VideoEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  /* ── Sessions state ─────────────────────────────────────── */
  const [sessions, setSessions] = useState<VideoSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);

  /* ── Selection state ────────────────────────────────────── */
  const [selectedEventIds, setSelectedEventIds] = useState<Set<string>>(new Set());

  /* ── Modal state ────────────────────────────────────────── */
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [sessionName, setSessionName] = useState("");
  const [sessionDescription, setSessionDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  /* ── Upload state ──────────────────────────────────────── */
  const [uploadExpanded, setUploadExpanded] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadLeague, setUploadLeague] = useState("gojhl");
  const [uploadSeason, setUploadSeason] = useState("2025-26");
  const [uploadVideoUrl, setUploadVideoUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    events: number; home: string; away: string; date: string; matched: number;
  } | null>(null);
  const [uploadError, setUploadError] = useState("");
  const uploadFileRef = useRef<HTMLInputElement>(null);

  /* ── Drawer state ───────────────────────────────────────── */
  const [drawerEvent, setDrawerEvent] = useState<VideoEvent | null>(null);

  /* ── Load initial params from URL ───────────────────────── */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const pid = sp.get("player_id");
    const act = sp.get("action");
    const zone = sp.get("zone");
    const from = sp.get("from_date");
    const to = sp.get("to_date");
    if (pid) {
      // Load player info
      api.get(`/players/${pid}`).then((r) => {
        const p = r.data;
        setSelectedPlayer({ id: p.id, first_name: p.first_name, last_name: p.last_name, position: p.position, current_team: p.current_team });
      }).catch(() => {});
    }
    if (act) setSelectedActions([act]);
    if (zone) setSelectedZone(zone);
    if (from) setDateFrom(from);
    if (to) setDateTo(to);
    // Auto-search if params present
    if (pid || act || zone || from || to) {
      setTimeout(() => handleApplyFilters(), 300);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Load sessions ──────────────────────────────────────── */
  const loadSessions = useCallback(() => {
    setLoadingSessions(true);
    api.get<VideoSession[]>("/video/sessions")
      .then((r) => setSessions(r.data))
      .catch(() => {})
      .finally(() => setLoadingSessions(false));
  }, []);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  /* ── Player typeahead ───────────────────────────────────── */
  useEffect(() => {
    if (playerSearch.length < 2) { setPlayerResults([]); return; }
    const timer = setTimeout(() => {
      api.get(`/players?search=${encodeURIComponent(playerSearch)}&limit=10`)
        .then((r) => setPlayerResults(r.data.players || r.data || []))
        .catch(() => setPlayerResults([]));
    }, 300);
    return () => clearTimeout(timer);
  }, [playerSearch]);

  /* ── Close player dropdown on outside click ─────────────── */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (playerDropdownRef.current && !playerDropdownRef.current.contains(e.target as Node)) {
        setShowPlayerDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  /* ── Apply filters → fetch events ──────────────────────── */
  const handleApplyFilters = useCallback(() => {
    setLoadingEvents(true);
    setHasSearched(true);

    const params = new URLSearchParams();
    if (selectedPlayer) params.set("player_id", selectedPlayer.id);
    if (selectedZone) params.set("zone", selectedZone);
    if (dateFrom) params.set("from_date", dateFrom);
    if (dateTo) params.set("to_date", dateTo);
    if (selectedActions.length > 0) params.set("action", selectedActions[0]); // API supports one at a time
    params.set("limit", "200");

    api.get<VideoEvent[]>(`/video/events?${params.toString()}`)
      .then((r) => {
        let filtered = r.data;
        // Client-side filter for multi-action + position group
        if (selectedActions.length > 1) {
          const allValues = ACTION_CHIPS.filter(c => selectedActions.includes(c.label)).flatMap(c => c.values);
          filtered = filtered.filter(e => allValues.includes(e.action));
        }
        setEvents(filtered);
      })
      .catch(() => setEvents([]))
      .finally(() => setLoadingEvents(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPlayer, selectedZone, dateFrom, dateTo, selectedActions]);

  /* ── Clear filters ──────────────────────────────────────── */
  const handleClear = () => {
    setPlayerSearch("");
    setSelectedPlayer(null);
    setPositionGroup("");
    setDateFrom("");
    setDateTo("");
    setSelectedActions([]);
    setSelectedZone("");
    setEvents([]);
    setHasSearched(false);
    setSelectedEventIds(new Set());
  };

  /* ── Toggle action chip ─────────────────────────────────── */
  const toggleAction = (label: string) => {
    setSelectedActions((prev) =>
      prev.includes(label) ? prev.filter((a) => a !== label) : [...prev, label]
    );
  };

  /* ── Toggle event selection ─────────────────────────────── */
  const toggleEventSelection = (id: string) => {
    setSelectedEventIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedEventIds.size === events.length) {
      setSelectedEventIds(new Set());
    } else {
      setSelectedEventIds(new Set(events.map((e) => e.id)));
    }
  };

  /* ── Create session ─────────────────────────────────────── */
  const handleCreateSession = async () => {
    if (!sessionName.trim()) return;
    setCreating(true);
    setCreateError("");
    try {
      await api.post("/video/sessions", {
        name: sessionName.trim(),
        description: sessionDescription.trim() || null,
        event_ids: Array.from(selectedEventIds),
      });
      setShowCreateModal(false);
      setSessionName("");
      setSessionDescription("");
      setSelectedEventIds(new Set());
      loadSessions();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed to create session";
      setCreateError(msg);
    } finally {
      setCreating(false);
    }
  };

  /* ── Format date for display ────────────────────────────── */
  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    try {
      const d = new Date(dateStr + "T00:00:00");
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    } catch { return dateStr; }
  };

  /* ── Period label ───────────────────────────────────────── */
  const periodLabel = (p: number) => {
    if (p === 1) return "1st";
    if (p === 2) return "2nd";
    if (p === 3) return "3rd";
    if (p === 4) return "OT";
    return `P${p}`;
  };

  /* ── Zone chip color ────────────────────────────────────── */
  const zoneColor = (z: string | null) => {
    if (z === "OZ") return "bg-green-100 text-green-700";
    if (z === "DZ") return "bg-red-100 text-red-700";
    if (z === "NZ") return "bg-gray-100 text-gray-600";
    return "bg-gray-50 text-gray-400";
  };

  /* ── Action display ─────────────────────────────────────── */
  const formatAction = (action: string, result: string | null) => {
    const singular: Record<string, string> = {
      "Goals": "Goal", "Assists": "Assist", "Shots on goal": "Shot on goal",
      "Missed shots": "Missed shot", "Blocked shots": "Blocked shot",
      "Shots blocking": "Shot block", "Hits": "Hit", "Penalties": "Penalty",
      "Faceoffs won": "Faceoff – Won", "Faceoffs lost": "Faceoff – Lost",
      "Faceoffs": "Faceoff", "Saves": "Save",
      "All shifts": "Shift", "Even strength shifts": "ES Shift",
      "Power play shifts": "PP Shift", "Penalty kill shifts": "PK Shift",
    };
    return singular[action] || action;
  };

  /* ── Upload handler ─────────────────────────────────────── */
  const handleUpload = async () => {
    if (!uploadFile) return;
    setUploading(true);
    setUploadError("");
    setUploadResult(null);
    try {
      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("league", uploadLeague);
      formData.append("season", uploadSeason);
      if (uploadVideoUrl.trim()) formData.append("video_url", uploadVideoUrl.trim());
      const res = await api.post("/instat/import-xml", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const d = res.data;
      setUploadResult({
        events: d.events_created || d.events_imported || 0,
        home: d.home_team || "",
        away: d.away_team || "",
        date: d.game_date || "",
        matched: d.players_matched || 0,
      });
      setUploadFile(null);
      if (uploadFileRef.current) uploadFileRef.current.value = "";
      // Collapse after successful upload
      setTimeout(() => setUploadExpanded(false), 3000);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Upload failed";
      setUploadError(msg);
    } finally {
      setUploading(false);
    }
  };

  /* ── Auto-expand upload if no events exist ─────────────── */
  const hasAnyEvents = events.length > 0 || sessions.length > 0;

  const GS_LEAGUE_OPTIONS = [
    { value: "gojhl", label: "GOJHL" },
    { value: "ojhl", label: "OJHL" },
    { value: "ohl", label: "OHL" },
    { value: "whl", label: "WHL" },
    { value: "qmjhl", label: "QMJHL" },
    { value: "pwhl", label: "PWHL" },
  ];

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-teal/10 flex items-center justify-center">
            <Video size={20} className="text-teal" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-oswald text-navy">Game Video Sessions</h1>
            <p className="text-muted text-sm">
              Your game film, organized. Filter by player, situation, or zone — then save a playlist for your next team meeting, 1-on-1 session, or pre-game prep. PXI can help you find the right clips — just ask in Bench Talk.
            </p>
          </div>
        </div>
        <p className="text-muted/70 text-xs mt-2">
          Upload a tagged game file below to get started, or filter your existing clips.
        </p>
      </div>

      {/* Upload Section — collapsed by default when events exist */}
      <div className="mb-6">
        <button
          onClick={() => setUploadExpanded(!uploadExpanded)}
          className="flex items-center gap-2 text-sm font-oswald uppercase tracking-wider text-navy hover:text-teal transition-colors"
        >
          <Upload size={14} className="text-teal" />
          Add Game Film
          {uploadExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {(uploadExpanded || (!hasAnyEvents && !loadingSessions)) && (
          <div className="mt-3 bg-white rounded-xl border border-teal/20 p-5">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-9 h-9 rounded-lg bg-teal/10 flex items-center justify-center shrink-0">
                <Upload size={18} className="text-teal" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-navy">Upload Game File</h3>
                <p className="text-xs text-muted mt-0.5">
                  Upload the tagged export file from your last game. ProspectX reads every event — every shot, faceoff, hit, and zone entry — and organizes it here automatically. One file per game.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              {/* File picker */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-navy mb-1">Game File</label>
                <input
                  ref={uploadFileRef}
                  type="file"
                  accept=".xml"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="w-full text-sm text-navy file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-oswald file:font-semibold file:uppercase file:tracking-wider file:bg-teal/10 file:text-teal hover:file:bg-teal/20 file:cursor-pointer"
                />
              </div>

              {/* League */}
              <div>
                <label className="block text-xs font-semibold text-navy mb-1">League</label>
                <select
                  value={uploadLeague}
                  onChange={(e) => setUploadLeague(e.target.value)}
                  className="w-full border border-teal/20 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
                >
                  {GS_LEAGUE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* Season */}
              <div>
                <label className="block text-xs font-semibold text-navy mb-1">Season</label>
                <input
                  type="text"
                  value={uploadSeason}
                  onChange={(e) => setUploadSeason(e.target.value)}
                  className="w-full border border-teal/20 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
                />
              </div>

              {/* Video URL */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-navy mb-1">
                  Game Video Link <span className="text-xs text-muted font-normal">(optional)</span>
                </label>
                <input
                  type="url"
                  value={uploadVideoUrl}
                  onChange={(e) => setUploadVideoUrl(e.target.value)}
                  placeholder="Paste a link to the game footage (optional — enables in-app playback)"
                  className="w-full border border-teal/20 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
                />
                <p className="text-xs text-muted/60 mt-1">You can add or update this later.</p>
              </div>
            </div>

            {/* Upload button */}
            <button
              onClick={handleUpload}
              disabled={!uploadFile || uploading}
              className="px-5 py-2 bg-teal text-white text-sm font-oswald font-semibold uppercase tracking-wider rounded-lg hover:bg-teal/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent" />
                  Processing...
                </span>
              ) : (
                "Upload & Process"
              )}
            </button>

            {/* Upload success */}
            {uploadResult && (
              <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-800 flex items-center gap-2">
                  <CheckCircle size={14} className="text-green-600" />
                  Game file processed — {uploadResult.events} events imported from {uploadResult.home} vs {uploadResult.away} on {uploadResult.date}. {uploadResult.matched} players matched.
                </p>
                <button
                  onClick={() => { setUploadResult(null); handleApplyFilters(); }}
                  className="mt-2 text-xs text-teal font-oswald uppercase tracking-wider hover:text-teal/70 transition-colors"
                >
                  Filter your new clips ↓
                </button>
              </div>
            )}

            {/* Upload error */}
            {uploadError && (
              <p className="mt-3 text-xs text-red-600">{uploadError}</p>
            )}

            {/* Link when events exist */}
            {hasAnyEvents && (
              <p className="mt-3 text-xs text-muted">
                Already have game film?{" "}
                <button
                  onClick={() => setUploadExpanded(false)}
                  className="text-teal hover:text-teal/70 transition-colors"
                >
                  Jump to filters ↓
                </button>
              </p>
            )}
          </div>
        )}
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left: Filters + Events (60%) */}
        <div className="lg:col-span-3 space-y-6">
          {/* Filters Panel */}
          <div className="bg-white rounded-xl border border-teal/20 p-5">
            <h3 className="text-sm font-oswald uppercase tracking-wider text-navy flex items-center gap-2 mb-1">
              <Filter size={14} className="text-teal" /> Filter your game film
            </h3>
            <p className="text-xs text-muted mb-4">
              Select a player, play type, or zone to build your clip list.
            </p>

            {/* Player search */}
            <div className="mb-4" ref={playerDropdownRef}>
              <label className="block text-xs font-semibold text-navy mb-1">Player</label>
              <div className="relative">
                {selectedPlayer ? (
                  <div className="flex items-center gap-2 border border-teal/20 rounded-lg px-3 py-2 text-sm bg-teal/5">
                    <span className="font-medium text-navy">
                      {selectedPlayer.first_name} {selectedPlayer.last_name}
                    </span>
                    <span className="text-xs text-muted">
                      {selectedPlayer.position} · {selectedPlayer.current_team}
                    </span>
                    <button
                      onClick={() => { setSelectedPlayer(null); setPlayerSearch(""); }}
                      className="ml-auto text-muted hover:text-red-500"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <>
                    <Search size={14} className="absolute left-3 top-2.5 text-muted" />
                    <input
                      type="text"
                      value={playerSearch}
                      onChange={(e) => { setPlayerSearch(e.target.value); setShowPlayerDropdown(true); }}
                      onFocus={() => setShowPlayerDropdown(true)}
                      placeholder="Search by player name..."
                      className="w-full border border-teal/20 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
                    />
                  </>
                )}
                {showPlayerDropdown && playerResults.length > 0 && !selectedPlayer && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-teal/20 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {playerResults.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => {
                          setSelectedPlayer(p);
                          setPlayerSearch("");
                          setShowPlayerDropdown(false);
                        }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-navy/[0.02] flex items-center justify-between"
                      >
                        <span className="text-navy">{p.first_name} {p.last_name}</span>
                        <span className="text-xs text-muted">{p.position} · {p.current_team}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Position group */}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-navy mb-1 flex items-center gap-1">
                Position Group
                <span className="group relative">
                  <Info size={12} className="text-muted cursor-help" />
                  <span className="hidden group-hover:block absolute left-0 bottom-full mb-1 w-48 bg-navy text-white text-xs rounded-lg px-3 py-2 shadow-lg z-20">
                    Filter events to forwards, defencemen, or goalies only.
                  </span>
                </span>
              </label>
              <div className="flex gap-2">
                {POSITION_GROUPS.map((pg) => (
                  <button
                    key={pg.value}
                    onClick={() => setPositionGroup(pg.value)}
                    className={`px-3 py-1.5 text-xs font-oswald uppercase tracking-wider rounded-lg transition-colors ${
                      positionGroup === pg.value
                        ? "bg-teal text-white"
                        : "bg-navy/[0.04] text-navy hover:bg-navy/[0.08]"
                    }`}
                  >
                    {pg.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Date range */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-xs font-semibold text-navy mb-1">From</label>
                <div className="relative">
                  <Calendar size={14} className="absolute left-3 top-2.5 text-muted" />
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-full border border-teal/20 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-navy mb-1">To</label>
                <div className="relative">
                  <Calendar size={14} className="absolute left-3 top-2.5 text-muted" />
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-full border border-teal/20 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
                  />
                </div>
              </div>
            </div>

            {/* Action chips */}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-navy mb-1 flex items-center gap-1">
                Play Type
                <span className="group relative">
                  <Info size={12} className="text-muted cursor-help" />
                  <span className="hidden group-hover:block absolute left-0 bottom-full mb-1 w-56 bg-navy text-white text-xs rounded-lg px-3 py-2 shadow-lg z-20">
                    Choose the type of play to review — faceoffs, shots, hits, etc.
                  </span>
                </span>
              </label>
              <div className="flex flex-wrap gap-2">
                {ACTION_CHIPS.map((chip) => (
                  <button
                    key={chip.label}
                    onClick={() => toggleAction(chip.label)}
                    className={`px-3 py-1.5 text-xs font-oswald uppercase tracking-wider rounded-lg transition-colors ${
                      selectedActions.includes(chip.label)
                        ? "bg-teal text-white"
                        : "bg-navy/[0.04] text-navy hover:bg-navy/[0.08]"
                    }`}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Zone chips */}
            <div className="mb-5">
              <label className="block text-xs font-semibold text-navy mb-1 flex items-center gap-1">
                Ice Zone
                <span className="group relative">
                  <Info size={12} className="text-muted cursor-help" />
                  <span className="hidden group-hover:block absolute left-0 bottom-full mb-1 w-56 bg-navy text-white text-xs rounded-lg px-3 py-2 shadow-lg z-20">
                    Filter by where on the ice the event happened: offensive, neutral, or defensive zone.
                  </span>
                </span>
              </label>
              <div className="flex gap-2">
                {ZONE_CHIPS.map((chip) => (
                  <button
                    key={chip.label}
                    onClick={() => setSelectedZone(chip.value)}
                    className={`px-3 py-1.5 text-xs font-oswald uppercase tracking-wider rounded-lg transition-colors ${
                      selectedZone === chip.value
                        ? "bg-teal text-white"
                        : "bg-navy/[0.04] text-navy hover:bg-navy/[0.08]"
                    }`}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Apply / Clear */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleApplyFilters}
                className="px-5 py-2 bg-teal text-white text-sm font-oswald font-semibold uppercase tracking-wider rounded-lg hover:bg-teal/90 transition-colors"
              >
                Find Clips
              </button>
              <button
                onClick={handleClear}
                className="text-sm text-teal hover:text-teal/70 transition-colors"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Events Table */}
          {loadingEvents ? (
            <div className="bg-white rounded-xl border border-teal/20 p-12 text-center">
              <div className="flex items-center justify-center gap-2 text-muted text-sm">
                <span className="animate-spin rounded-full h-4 w-4 border-2 border-teal border-t-transparent" />
                Loading events...
              </div>
            </div>
          ) : hasSearched && events.length === 0 ? (
            <div className="bg-white rounded-xl border border-teal/20 p-12 text-center">
              <p className="text-muted text-sm">
                No clips match your filters. Try a wider date range, a different player, or a different play type.
              </p>
              <p className="text-muted/60 text-xs mt-2">
                No game film imported yet? Upload your first tagged game file above — ProspectX will read every event and organize your footage by player, situation, and zone automatically.
              </p>
            </div>
          ) : events.length > 0 ? (
            <div className="bg-white rounded-xl border border-teal/20 overflow-hidden">
              {/* Table header bar */}
              <div className="px-4 py-3 border-b border-teal/10 flex items-center justify-between">
                <span className="text-xs text-muted font-oswald uppercase tracking-wider">
                  Showing {events.length} events
                </span>
                <label className="flex items-center gap-2 text-xs text-navy cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedEventIds.size === events.length && events.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded border-teal/20 text-teal focus:ring-teal/30"
                  />
                  Select all
                </label>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-navy/[0.02]">
                      <th className="w-8 px-3 py-2"></th>
                      <th className="text-left px-3 py-2 text-xs font-oswald uppercase tracking-wider text-muted">Date</th>
                      <th className="text-left px-3 py-2 text-xs font-oswald uppercase tracking-wider text-muted">Matchup</th>
                      <th className="text-left px-3 py-2 text-xs font-oswald uppercase tracking-wider text-muted">Per</th>
                      <th className="text-left px-3 py-2 text-xs font-oswald uppercase tracking-wider text-muted">Time</th>
                      <th className="text-left px-3 py-2 text-xs font-oswald uppercase tracking-wider text-muted">Player</th>
                      <th className="text-left px-3 py-2 text-xs font-oswald uppercase tracking-wider text-muted">Action</th>
                      <th className="text-left px-3 py-2 text-xs font-oswald uppercase tracking-wider text-muted">Zone</th>
                      <th className="w-8 px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.map((ev) => (
                      <tr
                        key={ev.id}
                        className={`border-t border-teal/5 hover:bg-navy/[0.01] transition-colors ${
                          selectedEventIds.has(ev.id) ? "bg-teal/5" : ""
                        }`}
                      >
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={selectedEventIds.has(ev.id)}
                            onChange={() => toggleEventSelection(ev.id)}
                            className="rounded border-teal/20 text-teal focus:ring-teal/30"
                          />
                        </td>
                        <td className="px-3 py-2 text-navy whitespace-nowrap">{formatDate(ev.game_date)}</td>
                        <td className="px-3 py-2 text-navy whitespace-nowrap">
                          {ev.team_name} vs {ev.opponent_name}
                        </td>
                        <td className="px-3 py-2 text-navy">{periodLabel(ev.period)}</td>
                        <td className="px-3 py-2 text-navy font-mono text-xs">{ev.clock_time}</td>
                        <td className="px-3 py-2 text-navy">{ev.player_name || "—"}</td>
                        <td className="px-3 py-2 text-navy">{formatAction(ev.action, ev.result)}</td>
                        <td className="px-3 py-2">
                          {ev.zone ? (
                            <span className={`px-2 py-0.5 rounded text-xs font-oswald font-bold ${zoneColor(ev.zone)}`}>
                              {ev.zone}
                            </span>
                          ) : (
                            <span className="text-xs text-muted">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <button
                            onClick={() => setDrawerEvent(ev)}
                            className="text-teal hover:text-teal/70 transition-colors"
                            title="Play clip"
                          >
                            <Play size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>

        {/* Right: Saved Sessions (40%) */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-teal/20 p-5">
            <h3 className="text-sm font-oswald uppercase tracking-wider text-navy flex items-center gap-2 mb-4">
              <Folder size={14} className="text-teal" /> Saved Sessions
            </h3>

            {loadingSessions ? (
              <div className="py-8 text-center">
                <span className="animate-spin rounded-full h-4 w-4 border-2 border-teal border-t-transparent inline-block" />
              </div>
            ) : sessions.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-muted text-sm">
                  No saved sessions yet. Filter for the clips you want, select them, then save as a session with a clear focus — e.g., &quot;D-zone coverage&quot; or &quot;Net-front battles&quot;.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {sessions.map((s) => (
                  <div
                    key={s.id}
                    className="border border-teal/10 rounded-lg p-3 hover:border-teal/30 transition-colors"
                  >
                    <p className="font-semibold text-navy text-sm">{s.name}</p>
                    <p className="text-xs text-muted mt-1">
                      {s.clip_count} clips · Created {formatDate(s.created_at)}
                    </p>
                    <div className="flex items-center gap-3 mt-2">
                      <Link
                        href={`/video-sessions/${s.id}`}
                        className="inline-flex items-center gap-1 text-xs text-teal hover:text-teal/70 font-oswald uppercase tracking-wider transition-colors"
                      >
                        <Play size={12} /> Open Session
                      </Link>
                      <button
                        disabled
                        className="inline-flex items-center gap-1 text-xs text-muted/40 font-oswald uppercase tracking-wider cursor-not-allowed"
                        title="Coming soon — generate a practice segment from this session"
                      >
                        <Wrench size={12} /> Build Practice Segment
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sticky selection bar */}
      {selectedEventIds.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-navy text-white px-6 py-3 flex items-center justify-between z-40 shadow-lg">
          <span className="text-sm font-oswald uppercase tracking-wider">
            {selectedEventIds.size} clip{selectedEventIds.size !== 1 ? "s" : ""} selected
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-1.5 bg-teal text-white text-sm font-oswald font-semibold uppercase tracking-wider rounded-lg hover:bg-teal/90 transition-colors"
            >
              Create Session
            </button>
            <button
              onClick={() => setSelectedEventIds(new Set())}
              className="text-sm text-white/70 hover:text-white transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Video Drawer */}
      {drawerEvent && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-teal shadow-2xl z-50 p-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-sm font-semibold text-navy">{drawerEvent.short_description}</p>
                <p className="text-xs text-muted mt-0.5">
                  {drawerEvent.team_name} vs {drawerEvent.opponent_name} · {formatDate(drawerEvent.game_date)}
                </p>
              </div>
              <button
                onClick={() => setDrawerEvent(null)}
                className="text-muted hover:text-navy transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="bg-navy/[0.03] rounded-lg p-6 text-center">
              <Video size={32} className="mx-auto text-muted/40 mb-2" />
              <p className="text-sm text-muted">
                Video URL not configured for this game.
              </p>
              <p className="text-xs text-muted/60 mt-1">
                Add a video link in the game settings to enable playback.
              </p>
            </div>
            <div className="mt-3 grid grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-xs text-muted uppercase tracking-wider">Period</p>
                <p className="text-sm font-oswald font-bold text-navy">{periodLabel(drawerEvent.period)}</p>
              </div>
              <div>
                <p className="text-xs text-muted uppercase tracking-wider">Time</p>
                <p className="text-sm font-oswald font-bold text-navy">{drawerEvent.clock_time}</p>
              </div>
              <div>
                <p className="text-xs text-muted uppercase tracking-wider">Player</p>
                <p className="text-sm font-oswald font-bold text-navy">{drawerEvent.player_name || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted uppercase tracking-wider">Action</p>
                <p className="text-sm font-oswald font-bold text-navy">{formatAction(drawerEvent.action, drawerEvent.result)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Session Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-teal/20 p-6 w-full max-w-md">
            <h3 className="text-lg font-oswald font-bold text-navy mb-4">Save as Session</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-navy mb-1">
                  Session Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                  placeholder="e.g. Najim OZ Faceoffs – Feb 16"
                  className="w-full border border-teal/20 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-navy mb-1">
                  Description <span className="text-xs text-muted font-normal">(optional)</span>
                </label>
                <textarea
                  value={sessionDescription}
                  onChange={(e) => setSessionDescription(e.target.value)}
                  placeholder="Notes for your coaching staff or players"
                  rows={3}
                  className="w-full border border-teal/20 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal/30 resize-none"
                />
              </div>

              <p className="text-xs text-muted">
                This session will include {selectedEventIds.size} clip{selectedEventIds.size !== 1 ? "s" : ""}.
              </p>

              {createError && (
                <p className="text-xs text-red-600">{createError}</p>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 mt-5">
              <button
                onClick={() => { setShowCreateModal(false); setCreateError(""); }}
                className="px-4 py-2 text-sm text-navy hover:text-navy/70 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateSession}
                disabled={!sessionName.trim() || creating}
                className="px-4 py-2 bg-teal text-white text-sm font-oswald font-semibold uppercase tracking-wider rounded-lg hover:bg-teal/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent" />
                    Saving...
                  </span>
                ) : (
                  "Save Session"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
