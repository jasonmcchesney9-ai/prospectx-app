"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Briefcase,
  Users,
  FileText,
  TrendingUp,
  Plus,
  Search,
  X,
  User,
  ExternalLink,
  Trash2,
  MapPin,
} from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import api from "@/lib/api";
import { formatLeague } from "@/lib/leagues";
import HockeyRink from "@/components/HockeyRink";
import type { AgentClient, AgentClientStatus } from "@/types/api";
import { AGENT_CLIENT_STATUS_COLORS } from "@/types/api";

// ── Player Search Result type ────────────────────────────────
interface PlayerSearchResult {
  id: string;
  first_name: string;
  last_name: string;
  position: string;
  current_team: string | null;
  current_league: string | null;
  dob: string | null;
}

// ── Age helper ───────────────────────────────────────────────
function calcAge(dob: string | null): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

// ══════════════════════════════════════════════════════════════
// Page wrapper
// ══════════════════════════════════════════════════════════════

export default function MyClientsPage() {
  return (
    <ProtectedRoute>
      <NavBar />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ClientManagement />
      </main>
    </ProtectedRoute>
  );
}

// ══════════════════════════════════════════════════════════════
// Main Client Management component
// ══════════════════════════════════════════════════════════════

function ClientManagement() {
  const router = useRouter();
  const [clients, setClients] = useState<AgentClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  // ── Fetch clients ─────────────────────────────────────────
  const fetchClients = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get<AgentClient[]>("/agent/clients");
      setClients(data);
    } catch {
      setError("Failed to load clients");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  // ── Remove client ─────────────────────────────────────────
  const handleRemove = async (id: string) => {
    setRemovingId(id);
    try {
      await api.delete(`/agent/clients/${id}`);
      setClients((prev) => prev.filter((c) => c.id !== id));
    } catch {
      setError("Failed to remove client");
    } finally {
      setRemovingId(null);
    }
  };

  // ── Client added callback ─────────────────────────────────
  const handleAdded = () => {
    setShowAddModal(false);
    fetchClients();
  };

  // ── Stats calculations ────────────────────────────────────
  const totalClients = clients.length;
  const activePathways = clients.filter(
    (c) => c.status === "active" || c.status === "committed"
  ).length;
  const reportsGenerated = clients.reduce(
    (sum, c) => sum + (c.reports?.length || 0),
    0
  );

  // ── Status filter ─────────────────────────────────────────
  const [statusFilter, setStatusFilter] = useState<"all" | AgentClientStatus>("all");
  const filteredClients =
    statusFilter === "all"
      ? clients
      : clients.filter((c) => c.status === statusFilter);

  const statusTabs: { value: "all" | AgentClientStatus; label: string }[] = [
    { value: "all", label: "All" },
    { value: "active", label: "Active" },
    { value: "committed", label: "Committed" },
    { value: "unsigned", label: "Unsigned" },
    { value: "inactive", label: "Inactive" },
  ];

  return (
    <div>
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-navy flex items-center gap-2 font-oswald uppercase tracking-wider">
            <Briefcase size={24} className="text-[#475569]" />
            Client Management
          </h1>
          <p className="text-muted text-sm mt-1">
            Manage your client roster, track pathways, and generate agent-ready reports.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-teal to-teal/80 text-white font-oswald font-semibold uppercase tracking-wider text-sm rounded-lg hover:shadow-md transition-shadow"
        >
          <Plus size={16} />
          Add Client
        </button>
      </div>

      {/* ── Stats Bar ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-teal/20 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-navy/5 flex items-center justify-center shrink-0">
            <Users size={18} className="text-navy" />
          </div>
          <div>
            <p className="text-2xl font-bold text-navy font-oswald">{totalClients}</p>
            <p className="text-xs text-muted font-oswald uppercase tracking-wider">
              Total Clients
            </p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-teal/20 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-teal/10 flex items-center justify-center shrink-0">
            <TrendingUp size={18} className="text-teal" />
          </div>
          <div>
            <p className="text-2xl font-bold text-navy font-oswald">{activePathways}</p>
            <p className="text-xs text-muted font-oswald uppercase tracking-wider">
              Active Pathways
            </p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-teal/20 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-orange/10 flex items-center justify-center shrink-0">
            <FileText size={18} className="text-orange" />
          </div>
          <div>
            <p className="text-2xl font-bold text-navy font-oswald">{reportsGenerated}</p>
            <p className="text-xs text-muted font-oswald uppercase tracking-wider">
              Reports Generated
            </p>
          </div>
        </div>
      </div>

      {/* ── Status Filter Tabs ─────────────────────────────── */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit mb-6">
        {statusTabs.map((t) => (
          <button
            key={t.value}
            onClick={() => setStatusFilter(t.value)}
            className={`px-4 py-2 rounded-lg text-sm font-oswald uppercase tracking-wider transition-colors ${
              statusFilter === t.value
                ? "bg-white text-navy shadow-sm"
                : "text-muted hover:text-navy"
            }`}
          >
            {t.label}
            {t.value !== "all" && (
              <span className="ml-1.5 text-[10px] opacity-60">
                {clients.filter((c) =>
                  t.value === "all" ? true : c.status === t.value
                ).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Error ──────────────────────────────────────────── */}
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

      {/* ── Loading State ──────────────────────────────────── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <HockeyRink size="card" />
          <p className="text-muted text-sm mt-3 font-oswald uppercase tracking-wider">
            Loading clients...
          </p>
        </div>
      ) : filteredClients.length === 0 && clients.length === 0 ? (
        /* ── Empty State ─────────────────────────────────── */
        <div className="bg-gray-50 border border-teal/20 rounded-xl p-10 text-center">
          <Briefcase size={40} className="mx-auto text-muted mb-4" />
          <h3 className="font-oswald font-semibold text-navy text-lg uppercase tracking-wider">
            No clients yet
          </h3>
          <p className="text-muted text-sm mt-2 max-w-md mx-auto">
            Add players to start building your roster. Track their development,
            plan pathways, and generate agent-ready reports.
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-teal text-white text-sm font-oswald uppercase tracking-wider rounded-lg hover:bg-teal/90 transition-colors"
          >
            <Plus size={14} />
            Add Your First Client
          </button>
        </div>
      ) : filteredClients.length === 0 ? (
        /* ── No results for filter ───────────────────────── */
        <div className="bg-gray-50 border border-teal/20 rounded-xl p-10 text-center">
          <Users size={32} className="mx-auto text-muted mb-3" />
          <p className="text-muted text-sm">
            No clients with status &quot;{statusFilter}&quot;
          </p>
        </div>
      ) : (
        /* ── Client Grid ─────────────────────────────────── */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClients.map((client) => (
            <ClientCard
              key={client.id}
              client={client}
              onRemove={handleRemove}
              removingId={removingId}
              router={router}
            />
          ))}
        </div>
      )}

      {/* ── Add Client Modal ─────────────────────────────── */}
      {showAddModal && (
        <AddClientModal
          onClose={() => setShowAddModal(false)}
          onAdded={handleAdded}
        />
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// Client Card
// ══════════════════════════════════════════════════════════════

function ClientCard({
  client,
  onRemove,
  removingId,
  router,
}: {
  client: AgentClient;
  onRemove: (id: string) => void;
  removingId: string | null;
  router: ReturnType<typeof useRouter>;
}) {
  const player = client.player;
  const statusConfig = AGENT_CLIENT_STATUS_COLORS[client.status] || AGENT_CLIENT_STATUS_COLORS.active;
  const age = player ? calcAge(player.dob) : null;

  return (
    <div className="bg-white rounded-xl border border-teal/20 p-4 hover:border-teal/30 hover:shadow-sm transition-all group">
      {/* Top: Name + Status */}
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-navy text-sm truncate">
            {player
              ? `${player.first_name} ${player.last_name}`
              : `Client #${client.id.slice(0, 8)}`}
          </h3>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {player?.current_team && (
              <span className="text-xs text-muted flex items-center gap-1">
                <MapPin size={10} />
                {player.current_team}
              </span>
            )}
            {player?.position && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-muted font-medium">
                {player.position}
              </span>
            )}
            {age !== null && (
              <span className="text-[10px] text-muted/60">
                Age {age}
              </span>
            )}
          </div>
        </div>
        <span
          className={`text-[10px] px-2 py-0.5 rounded-full font-oswald font-bold uppercase tracking-wider shrink-0 ${statusConfig.bg} ${statusConfig.text}`}
        >
          {statusConfig.label}
        </span>
      </div>

      {/* League */}
      {player?.current_league && (
        <p className="text-[10px] text-muted/50 mb-3">{formatLeague(player.current_league)}</p>
      )}

      {/* Pathway notes preview */}
      {client.pathway_notes && (
        <p className="text-xs text-muted line-clamp-2 mb-3 italic">
          {client.pathway_notes}
        </p>
      )}

      {/* Divider */}
      <div className="border-t border-teal/20 pt-3">
        {/* Quick Actions */}
        <div className="flex items-center gap-1 flex-wrap">
          <button
            onClick={() =>
              router.push(
                `/reports/generate?player_id=${client.player_id}&report_type=agent_pack`
              )
            }
            className="inline-flex items-center gap-1 px-2 py-1 text-[10px] text-teal hover:bg-teal/5 rounded font-oswald uppercase tracking-wider transition-colors"
          >
            <FileText size={10} />
            Agent Pack
          </button>
          <button
            onClick={() =>
              router.push(
                `/reports/generate?player_id=${client.player_id}&report_type=development_roadmap`
              )
            }
            className="inline-flex items-center gap-1 px-2 py-1 text-[10px] text-navy/60 hover:bg-navy/5 rounded font-oswald uppercase tracking-wider transition-colors"
          >
            <TrendingUp size={10} />
            Roadmap
          </button>
          <button
            onClick={() => router.push(`/my-clients/${client.id}`)}
            className="inline-flex items-center gap-1 px-2 py-1 text-[10px] text-navy/60 hover:bg-navy/5 rounded font-oswald uppercase tracking-wider transition-colors"
          >
            <ExternalLink size={10} />
            Detail
          </button>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Remove */}
          <button
            onClick={() => onRemove(client.id)}
            disabled={removingId === client.id}
            className="inline-flex items-center gap-1 px-2 py-1 text-[10px] text-red-400 hover:text-red-600 rounded font-oswald uppercase tracking-wider transition-colors disabled:opacity-50 opacity-0 group-hover:opacity-100"
          >
            {removingId === client.id ? (
              <span className="animate-spin rounded-full h-3 w-3 border border-red-400 border-t-transparent inline-block" />
            ) : (
              <Trash2 size={10} />
            )}
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// Add Client Modal (player picker)
// ══════════════════════════════════════════════════════════════

function AddClientModal({
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
          `/players?search=${encodeURIComponent(query.trim())}&limit=15`
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
      await api.post("/agent/clients", { player_id: player.id });
      onAdded();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "Failed to add client";
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
            Add Client
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
            className="w-full border border-teal/20 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
          />
        </div>

        {/* Error */}
        {error && (
          <div className="mb-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-red-700 text-xs">
            {error}
          </div>
        )}

        {/* Results */}
        <div className="border border-teal/20 rounded-lg max-h-64 overflow-y-auto">
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
                className="w-full text-left px-4 py-3 flex items-center justify-between hover:bg-gray-50 border-b border-teal/20 last:border-b-0 transition-colors disabled:opacity-50"
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
          Players will be added with Active status by default.
        </p>
      </div>
    </div>
  );
}
