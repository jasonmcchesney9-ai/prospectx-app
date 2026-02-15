"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
  Target,
  Plus,
  Search,
  X,
  Eye,
  Trash2,
  ExternalLink,
  User,
  ChevronDown,
} from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import api from "@/lib/api";
import type { ScoutingListItem } from "@/types/api";
import { TARGET_REASONS } from "@/types/api";

// ── Priority helpers ─────────────────────────────────────────

type Priority = "high" | "medium" | "low";

const PRIORITY_DOT: Record<Priority, string> = {
  high: "bg-red-500",
  medium: "bg-yellow-500",
  low: "bg-green-500",
};

const PRIORITY_BADGE: Record<Priority, string> = {
  high: "bg-red-100 text-red-700",
  medium: "bg-yellow-100 text-yellow-700",
  low: "bg-green-100 text-green-700",
};

const TARGET_REASON_BADGE: Record<string, string> = {
  draft: "bg-purple-100 text-purple-700",
  trade: "bg-orange-100 text-orange-700",
  recruit: "bg-teal/10 text-teal",
  watch: "bg-gray-100 text-gray-600",
};

// ── Search result type ────────────────────────────────────────

interface PlayerSearchResult {
  id: string;
  first_name: string;
  last_name: string;
  position: string;
  current_team: string | null;
}

// ══════════════════════════════════════════════════════════════
// Page wrapper
// ══════════════════════════════════════════════════════════════

export default function ScoutingListPage() {
  return (
    <ProtectedRoute>
      <NavBar />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ScoutingList />
      </main>
    </ProtectedRoute>
  );
}

// ══════════════════════════════════════════════════════════════
// Main scouting list component
// ══════════════════════════════════════════════════════════════

function ScoutingList() {
  const [items, setItems] = useState<ScoutingListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<"all" | Priority>("all");
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);

  // ── Fetch list ──────────────────────────────────────────────

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (priorityFilter !== "all") params.set("priority", priorityFilter);
      if (search.trim()) params.set("search", search.trim());
      const qs = params.toString();
      const { data } = await api.get<ScoutingListItem[]>(
        `/scouting-list${qs ? `?${qs}` : ""}`
      );
      setItems(data);
    } catch {
      setError("Failed to load scouting list");
    } finally {
      setLoading(false);
    }
  }, [priorityFilter, search]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  // ── Handlers ────────────────────────────────────────────────

  const handleRemove = async (id: string) => {
    try {
      await api.delete(`/scouting-list/${id}`);
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch {
      setError("Failed to remove player from scouting list");
    }
  };

  const handleUpdate = async (
    id: string,
    payload: Partial<{ priority: Priority; scout_notes: string; target_reason: string }>
  ) => {
    try {
      const { data } = await api.put<ScoutingListItem>(`/scouting-list/${id}`, payload);
      setItems((prev) => prev.map((i) => (i.id === id ? data : i)));
    } catch {
      setError("Failed to update scouting list item");
    }
  };

  const handleAdded = () => {
    setShowAddModal(false);
    fetchList();
  };

  // ── Filter tabs ─────────────────────────────────────────────

  const filterTabs: { value: "all" | Priority; label: string }[] = [
    { value: "all", label: "All" },
    { value: "high", label: "High" },
    { value: "medium", label: "Medium" },
    { value: "low", label: "Low" },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-navy flex items-center gap-2">
            <Target size={24} className="text-teal" />
            Scouting List
          </h1>
          <p className="text-muted text-sm mt-1">
            Track and manage prospects you&apos;re watching
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-teal to-teal/80 text-white font-oswald font-semibold uppercase tracking-wider text-sm rounded-lg hover:shadow-md transition-shadow"
        >
          <Plus size={16} />
          Add Player
        </button>
      </div>

      {/* Filters row */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        {/* Priority tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
          {filterTabs.map((t) => (
            <button
              key={t.value}
              onClick={() => setPriorityFilter(t.value)}
              className={`px-4 py-2 rounded-lg text-sm font-oswald uppercase tracking-wider transition-colors ${
                priorityFilter === t.value
                  ? "bg-white text-navy shadow-sm"
                  : "text-muted hover:text-navy"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-2.5 text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search player names..."
            className="w-full border border-border rounded-lg pl-9 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-2.5 text-muted hover:text-navy"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-2">
          <p className="text-red-700 text-sm">{error}</p>
          <button
            onClick={() => setError("")}
            className="ml-auto text-red-400 hover:text-red-600"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-navy border-t-teal" />
        </div>
      ) : items.length === 0 ? (
        /* Empty state */
        <div className="bg-gray-50 border border-border rounded-xl p-10 text-center">
          <Target size={40} className="mx-auto text-muted mb-4" />
          <h3 className="font-oswald font-semibold text-navy text-lg">
            No players on your scouting list yet
          </h3>
          <p className="text-muted text-sm mt-2 max-w-md mx-auto">
            Start tracking prospects by clicking &quot;Add Player&quot; above to search and add players to your list.
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-teal text-white text-sm font-oswald uppercase tracking-wider rounded-lg hover:bg-teal/90 transition-colors"
          >
            <Plus size={14} />
            Add Your First Player
          </button>
        </div>
      ) : (
        /* Player cards */
        <div className="space-y-3">
          {items.map((item) => (
            <ScoutingCard
              key={item.id}
              item={item}
              onRemove={handleRemove}
              onUpdate={handleUpdate}
            />
          ))}
        </div>
      )}

      {/* Add Player Modal */}
      {showAddModal && (
        <AddPlayerModal
          onClose={() => setShowAddModal(false)}
          onAdded={handleAdded}
        />
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// Scouting Card
// ══════════════════════════════════════════════════════════════

function ScoutingCard({
  item,
  onRemove,
  onUpdate,
}: {
  item: ScoutingListItem;
  onRemove: (id: string) => void;
  onUpdate: (id: string, payload: Partial<{ priority: Priority; scout_notes: string; target_reason: string }>) => void;
}) {
  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState(item.scout_notes || "");
  const [removing, setRemoving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync local state if parent updates
  useEffect(() => {
    setNotes(item.scout_notes || "");
  }, [item.scout_notes]);

  // Auto-focus textarea on edit
  useEffect(() => {
    if (editingNotes && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.selectionStart = textareaRef.current.value.length;
    }
  }, [editingNotes]);

  const handleNotesBlur = () => {
    setEditingNotes(false);
    if (notes !== (item.scout_notes || "")) {
      onUpdate(item.id, { scout_notes: notes });
    }
  };

  const handleRemoveClick = async () => {
    setRemoving(true);
    await onRemove(item.id);
    setRemoving(false);
  };

  const priority = item.priority as Priority;
  const reasonObj = TARGET_REASONS.find((r) => r.value === item.target_reason);
  const reasonLabel = reasonObj?.label || item.target_reason || "Watch List";
  const reasonBadgeClass = TARGET_REASON_BADGE[item.target_reason] || TARGET_REASON_BADGE.watch;

  return (
    <div className="bg-white rounded-xl border border-border p-4">
      <div className="flex items-start gap-3">
        {/* Priority dot */}
        <div className="pt-1.5 shrink-0">
          <div className={`w-3 h-3 rounded-full ${PRIORITY_DOT[priority]}`} />
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Top row: name, badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-navy text-sm">
              {item.first_name} {item.last_name}
            </span>
            {item.position && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-muted font-medium">
                {item.position}
              </span>
            )}
            {item.current_team && (
              <span className="text-xs text-muted">{item.current_team}</span>
            )}
            {item.current_league && (
              <span className="text-[10px] text-muted/60">{item.current_league}</span>
            )}
            {/* Target reason badge */}
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${reasonBadgeClass}`}
            >
              {reasonLabel}
            </span>
          </div>

          {/* Scout notes preview / inline edit */}
          <div className="mt-2">
            {editingNotes ? (
              <textarea
                ref={textareaRef}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={handleNotesBlur}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setNotes(item.scout_notes || "");
                    setEditingNotes(false);
                  }
                }}
                rows={3}
                className="w-full border border-teal/30 rounded-lg px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-teal/30 resize-y"
                placeholder="Add scout notes..."
              />
            ) : (
              <button
                onClick={() => setEditingNotes(true)}
                className="text-left w-full"
              >
                {notes ? (
                  <p className="text-sm text-muted line-clamp-2">{notes}</p>
                ) : (
                  <p className="text-sm text-muted/50 italic">Click to add scout notes...</p>
                )}
              </button>
            )}
          </div>

          {/* Bottom row: inline controls + meta */}
          <div className="mt-3 flex items-center gap-3 flex-wrap">
            {/* Priority dropdown */}
            <div className="relative inline-flex items-center gap-1">
              <span className="text-[10px] font-oswald uppercase tracking-wider text-muted">
                Priority:
              </span>
              <div className="relative">
                <select
                  value={priority}
                  onChange={(e) =>
                    onUpdate(item.id, { priority: e.target.value as Priority })
                  }
                  className={`appearance-none text-[10px] font-medium px-2 py-0.5 pr-5 rounded cursor-pointer border-0 focus:outline-none focus:ring-1 focus:ring-teal/30 ${PRIORITY_BADGE[priority]}`}
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
                <ChevronDown
                  size={10}
                  className="absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none opacity-60"
                />
              </div>
            </div>

            {/* Target reason dropdown */}
            <div className="relative inline-flex items-center gap-1">
              <span className="text-[10px] font-oswald uppercase tracking-wider text-muted">
                Reason:
              </span>
              <div className="relative">
                <select
                  value={item.target_reason || "watch"}
                  onChange={(e) =>
                    onUpdate(item.id, { target_reason: e.target.value })
                  }
                  className={`appearance-none text-[10px] font-medium px-2 py-0.5 pr-5 rounded cursor-pointer border-0 focus:outline-none focus:ring-1 focus:ring-teal/30 ${reasonBadgeClass}`}
                >
                  {TARGET_REASONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={10}
                  className="absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none opacity-60"
                />
              </div>
            </div>

            {/* Last viewed */}
            {item.last_viewed && (
              <span className="text-[10px] text-muted/60 flex items-center gap-1">
                <Eye size={10} />
                {new Date(item.last_viewed).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            )}

            {/* Spacer */}
            <div className="flex-1" />

            {/* Quick actions */}
            <div className="flex items-center gap-2 shrink-0">
              <Link
                href={`/players/${item.player_id}`}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-teal hover:text-teal/70 font-oswald uppercase tracking-wider transition-colors"
              >
                <ExternalLink size={12} />
                View Profile
              </Link>
              <button
                onClick={handleRemoveClick}
                disabled={removing}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-red-400 hover:text-red-600 font-oswald uppercase tracking-wider transition-colors disabled:opacity-50"
              >
                {removing ? (
                  <span className="animate-spin rounded-full h-3 w-3 border border-red-400 border-t-transparent inline-block" />
                ) : (
                  <Trash2 size={12} />
                )}
                Remove
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// Add Player Modal
// ══════════════════════════════════════════════════════════════

function AddPlayerModal({
  onClose,
  onAdded,
}: {
  onClose: () => void;
  onAdded: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlayerSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-focus on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length < 2) {
      setResults([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const { data } = await api.get<PlayerSearchResult[]>(
          `/players?search=${encodeURIComponent(query.trim())}&limit=10`
        );
        setResults(data);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const handleSelect = async (player: PlayerSearchResult) => {
    setAdding(player.id);
    setError("");
    try {
      await api.post("/scouting-list", {
        player_id: player.id,
        priority: "medium",
        target_reason: "watch",
      });
      onAdded();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "Failed to add player to scouting list";
      setError(msg);
      setAdding(null);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
        {/* Modal header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-oswald font-bold text-navy uppercase tracking-wider flex items-center gap-2">
            <User size={18} className="text-teal" />
            Add Player to Scouting List
          </h2>
          <button
            onClick={onClose}
            className="text-muted hover:text-navy transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Search input */}
        <div className="relative mb-3">
          <Search size={14} className="absolute left-3 top-2.5 text-muted" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search players by name..."
            className="w-full border border-border rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
          />
        </div>

        {/* Error */}
        {error && (
          <div className="mb-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-red-700 text-xs">
            {error}
          </div>
        )}

        {/* Results */}
        <div className="border border-border rounded-lg max-h-64 overflow-y-auto">
          {searching ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-navy border-t-teal" />
            </div>
          ) : results.length > 0 ? (
            results.map((p) => (
              <button
                key={p.id}
                onClick={() => handleSelect(p)}
                disabled={adding !== null}
                className="w-full text-left px-4 py-3 flex items-center justify-between hover:bg-gray-50 border-b border-border last:border-b-0 transition-colors disabled:opacity-50"
              >
                <div>
                  <span className="font-medium text-navy text-sm">
                    {p.first_name} {p.last_name}
                  </span>
                  {p.position && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-muted font-medium ml-2">
                      {p.position}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted">
                    {p.current_team || "No team"}
                  </span>
                  {adding === p.id ? (
                    <span className="animate-spin rounded-full h-4 w-4 border-2 border-teal border-t-transparent inline-block" />
                  ) : (
                    <Plus size={14} className="text-teal" />
                  )}
                </div>
              </button>
            ))
          ) : query.trim().length >= 2 ? (
            <div className="py-8 text-center">
              <User size={24} className="mx-auto text-muted mb-2" />
              <p className="text-sm text-muted">No players found</p>
            </div>
          ) : (
            <div className="py-8 text-center">
              <Search size={24} className="mx-auto text-muted mb-2" />
              <p className="text-sm text-muted">
                Type at least 2 characters to search
              </p>
            </div>
          )}
        </div>

        {/* Footer hint */}
        <p className="text-[10px] text-muted/60 mt-3 text-center">
          Players will be added with Medium priority and Watch reason by default.
        </p>
      </div>
    </div>
  );
}
