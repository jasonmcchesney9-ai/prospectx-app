"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ClipboardCheck,
  Plus,
  Search,
  X,
  Filter,
  Loader2,
} from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import ScoutNoteCard from "@/components/ScoutNoteCard";
import api from "@/lib/api";
import { getUser } from "@/lib/auth";
import type { ScoutNote } from "@/types/api";
import { COMPETITION_LEVEL_LABELS, PROSPECT_STATUS_LABELS } from "@/types/api";

export default function ScoutNotesPage() {
  return (
    <ProtectedRoute>
      <NavBar />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ScoutNotesList />
      </main>
      {/* Mobile FAB */}
      <Link
        href="/scout-notes/new"
        className="fixed bottom-6 right-6 sm:hidden w-14 h-14 bg-teal text-white rounded-full flex items-center justify-center shadow-lg hover:bg-teal/90 transition-colors z-40"
      >
        <Plus size={24} />
      </Link>
    </ProtectedRoute>
  );
}

function ScoutNotesList() {
  const [notes, setNotes] = useState<ScoutNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [levelFilter, setLevelFilter] = useState("");
  const [myNotesOnly, setMyNotesOnly] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  const currentUser = getUser();

  const fetchNotes = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("player_id", ""); // We'll use search differently
      if (statusFilter) params.set("prospect_status", statusFilter);
      if (levelFilter) params.set("competition_level", levelFilter);
      if (myNotesOnly) params.set("visibility", "mine");
      params.set("limit", "50");
      const qs = params.toString();
      const { data } = await api.get<ScoutNote[]>(`/scout-notes${qs ? `?${qs}` : ""}`);
      setNotes(data);
    } catch {
      setError("Failed to load scout notes");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, levelFilter, myNotesOnly, search]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  // Client-side search filter (player name)
  const filteredNotes = search.trim()
    ? notes.filter((n) =>
        (n.player_name || "").toLowerCase().includes(search.trim().toLowerCase())
      )
    : notes;

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-navy flex items-center gap-2">
            <ClipboardCheck size={24} className="text-teal" />
            Scout Notes
          </h1>
          <p className="text-muted text-sm mt-1">
            Structured scouting evaluations — tag strengths, flag concerns, and track player development over time
          </p>
        </div>
        <Link
          href="/scout-notes/new"
          className="hidden sm:flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-teal to-teal/80 text-white font-oswald font-semibold uppercase tracking-wider text-sm rounded-lg hover:shadow-md transition-shadow"
        >
          <Plus size={16} />
          New Note
        </Link>
      </div>

      {/* Toggle: My Notes / All Shared */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
          <button
            onClick={() => setMyNotesOnly(true)}
            className={`px-4 py-2 rounded-lg text-sm font-oswald uppercase tracking-wider transition-colors ${
              myNotesOnly
                ? "bg-white text-navy shadow-sm"
                : "text-muted hover:text-navy"
            }`}
          >
            My Notes
          </button>
          <button
            onClick={() => setMyNotesOnly(false)}
            className={`px-4 py-2 rounded-lg text-sm font-oswald uppercase tracking-wider transition-colors ${
              !myNotesOnly
                ? "bg-white text-navy shadow-sm"
                : "text-muted hover:text-navy"
            }`}
          >
            All Shared
          </button>
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-2.5 text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by player name..."
            className="w-full border border-teal/20 rounded-lg pl-9 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
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

        {/* Filter toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm font-medium transition-all ${
            showFilters || statusFilter || levelFilter
              ? "border-teal/30 bg-teal/5 text-teal"
              : "border-teal/20 text-muted hover:text-navy"
          }`}
        >
          <Filter size={14} />
          Filters
          {(statusFilter || levelFilter) && (
            <span className="w-2 h-2 rounded-full bg-teal" />
          )}
        </button>
      </div>

      {/* Expanded filters */}
      {showFilters && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5 p-4 bg-gray-50 rounded-xl border border-border">
          <div>
            <label className="block text-xs font-oswald uppercase tracking-wider text-navy/70 mb-1">Prospect Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-teal/20 rounded-lg text-sm bg-white"
            >
              <option value="">All statuses</option>
              {Object.entries(PROSPECT_STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-oswald uppercase tracking-wider text-navy/70 mb-1">Competition Level</label>
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
              className="w-full px-3 py-2 border border-teal/20 rounded-lg text-sm bg-white"
            >
              <option value="">All levels</option>
              {Object.entries(COMPETITION_LEVEL_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          {(statusFilter || levelFilter) && (
            <button
              onClick={() => { setStatusFilter(""); setLevelFilter(""); }}
              className="text-xs text-teal hover:underline col-span-full"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-2">
          <p className="text-red-700 text-sm">{error}</p>
          <button onClick={() => setError("")} className="ml-auto text-red-400 hover:text-red-600">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={32} className="animate-spin text-teal" />
        </div>
      ) : filteredNotes.length === 0 ? (
        /* Empty state */
        <div className="bg-gray-50 border border-teal/20 rounded-xl p-10 text-center">
          <ClipboardCheck size={40} className="mx-auto text-muted mb-4" />
          <h3 className="font-oswald font-semibold text-navy text-lg">
            {notes.length === 0
              ? "No scout notes yet"
              : "No notes match your filters"}
          </h3>
          <p className="text-muted text-sm mt-2 max-w-md mx-auto">
            {notes.length === 0
              ? "Create your first structured scouting evaluation to get started."
              : "Try adjusting your search or filter criteria."}
          </p>
          {notes.length === 0 && (
            <Link
              href="/scout-notes/new"
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-teal text-white text-sm font-oswald uppercase tracking-wider rounded-lg hover:bg-teal/90 transition-colors"
            >
              <Plus size={14} />
              Create First Note
            </Link>
          )}
        </div>
      ) : (
        /* Note cards grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredNotes.map((note) => (
            <ScoutNoteCard key={note.id} note={note} />
          ))}
        </div>
      )}
    </div>
  );
}
