"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Shield,
  Users,
  BarChart3,
  Building2,
  DollarSign,
  Loader2,
  CheckCircle2,
  Search,
  UserCog,
  FileText,
  Calendar,
} from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import { getUser } from "@/lib/auth";
import {
  getOrgs,
  getOrgUsers,
  getAllUsers,
  updateUserTier,
  impersonateUser,
  getStats,
} from "@/lib/superadmin-api";
import type { SuperadminOrg, SuperadminStats, SuperadminUser } from "@/types/api";

// ── Shared Helpers ──────────────────────────────────────

const TIER_OPTIONS = [
  { value: "rookie", label: "Rookie", color: "text-gray-600" },
  { value: "parent", label: "Parent", color: "text-pink-600" },
  { value: "scout", label: "Scout", color: "text-blue-600" },
  { value: "pro", label: "Pro", color: "text-teal" },
  { value: "elite", label: "Elite", color: "text-violet-600" },
  { value: "team_org", label: "Team", color: "text-orange" },
  { value: "program_org", label: "Program", color: "text-navy" },
  { value: "enterprise", label: "Enterprise", color: "text-purple-600" },
];

function tierBadge(tier: string | null) {
  const t = tier || "rookie";
  const colors: Record<string, string> = {
    rookie: "bg-gray-100 text-gray-700",
    parent: "bg-pink-100 text-pink-700",
    scout: "bg-blue-100 text-blue-700",
    pro: "bg-teal/10 text-teal",
    elite: "bg-violet-100 text-violet-700",
    team_org: "bg-orange/10 text-orange",
    program_org: "bg-navy/10 text-navy",
    enterprise: "bg-purple-100 text-purple-700",
  };
  const labels: Record<string, string> = {
    rookie: "Rookie",
    parent: "Parent",
    scout: "Scout",
    pro: "Pro",
    elite: "Elite",
    team_org: "Team",
    program_org: "Program",
    enterprise: "Enterprise",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${colors[t] || colors.rookie}`}>
      {labels[t] || t}
    </span>
  );
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function roleBadge(role: string | null) {
  const r = role || "scout";
  const colors: Record<string, string> = {
    scout: "bg-blue-100 text-blue-700",
    coach: "bg-green-100 text-green-700",
    gm: "bg-purple-100 text-purple-700",
    parent: "bg-pink-100 text-pink-700",
    player: "bg-teal/10 text-teal",
    broadcaster: "bg-yellow-100 text-yellow-700",
    producer: "bg-orange/10 text-orange",
    agent: "bg-red-100 text-red-700",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${colors[r] || "bg-gray-100 text-gray-700"}`}>
      {r}
    </span>
  );
}

// ── Stats Bar ──────────────────────────────────────

function StatsBar() {
  const [stats, setStats] = useState<SuperadminStats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await getStats();
      setStats(data);
    } catch {
      // Silently retry on next interval
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, [load]);

  if (loading || !stats) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-teal/20 p-4 text-center animate-pulse">
            <div className="h-5 w-5 bg-gray-200 rounded mx-auto mb-2" />
            <div className="h-8 w-16 bg-gray-200 rounded mx-auto mb-1" />
            <div className="h-3 w-20 bg-gray-100 rounded mx-auto" />
          </div>
        ))}
      </div>
    );
  }

  const cards = [
    { label: "Organizations", value: stats.total_orgs, icon: Building2, color: "text-teal" },
    { label: "Total Users", value: stats.total_users, icon: Users, color: "text-navy" },
    { label: "Total Reports", value: stats.total_reports, icon: FileText, color: "text-orange" },
    {
      label: "Monthly Revenue",
      value: `$${stats.monthly_revenue_estimate.toLocaleString()}`,
      icon: DollarSign,
      color: "text-green-600",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      {cards.map(({ label, value, icon: Icon, color }) => (
        <div key={label} className="bg-white rounded-xl border border-teal/20 p-4 text-center">
          <Icon size={20} className={`${color} mx-auto mb-2`} />
          <p className="text-2xl font-bold text-navy">{value}</p>
          <p className="text-[10px] text-muted uppercase tracking-wider font-semibold">{label}</p>
        </div>
      ))}
    </div>
  );
}

// ── Org List Panel ──────────────────────────────────────

interface OrgUser {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
  hockey_role: string;
  subscription_tier: string;
  created_at: string;
  subscription_started_at: string | null;
  monthly_reports_used: number;
  monthly_bench_talks_used: number;
  usage: {
    reports_count: number;
    bench_talks_count: number;
    practice_plans_count: number;
    uploads_count: number;
  };
}

function OrgListPanel({
  selectedOrgId,
  onSelectOrg,
  onSearchUsers,
}: {
  selectedOrgId: string | null;
  onSelectOrg: (orgId: string, orgName: string) => void;
  onSearchUsers: (users: SuperadminUser[]) => void;
}) {
  const [orgs, setOrgs] = useState<SuperadminOrg[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await getOrgs();
        setOrgs(data.orgs);
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed to load orgs";
        setError(typeof msg === "string" ? msg : JSON.stringify(msg));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleSearch = useCallback(
    (value: string) => {
      setSearch(value);
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
      if (!value.trim()) {
        onSearchUsers([]);
        return;
      }
      searchTimeout.current = setTimeout(async () => {
        setSearching(true);
        try {
          const users = await getAllUsers({ search: value.trim() });
          onSearchUsers(users);
        } catch {
          // Ignore
        } finally {
          setSearching(false);
        }
      }, 400);
    },
    [onSearchUsers]
  );

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="animate-spin text-teal" size={24} />
      </div>
    );
  }
  if (error) {
    return <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{error}</div>;
  }

  return (
    <div>
      {/* Search */}
      <div className="relative mb-3">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="text"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search by email across all orgs..."
          className="w-full pl-9 pr-3 py-2 text-sm border border-teal/20 rounded-lg bg-white text-navy focus:ring-2 focus:ring-teal/30 focus:border-teal outline-none"
        />
        {searching && <Loader2 size={14} className="animate-spin text-teal absolute right-3 top-1/2 -translate-y-1/2" />}
      </div>

      {/* Org list */}
      <div className="space-y-1.5 max-h-[calc(100vh-340px)] overflow-y-auto pr-1">
        {orgs.map((org) => (
          <button
            key={org.org_id}
            onClick={() => onSelectOrg(org.org_id, org.name)}
            className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all ${
              selectedOrgId === org.org_id
                ? "bg-teal/5 border-teal/30 shadow-sm"
                : "bg-white border-teal/10 hover:border-teal/20 hover:bg-navy/[0.02]"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-navy text-sm truncate">{org.name}</span>
              {tierBadge(org.highest_tier)}
            </div>
            <div className="flex items-center gap-3 text-[10px] text-muted">
              <span className="flex items-center gap-1">
                <Users size={10} />
                {org.user_count} user{org.user_count !== 1 ? "s" : ""}
              </span>
              <span className="flex items-center gap-1">
                <FileText size={10} />
                {org.report_count} reports
              </span>
              <span className="flex items-center gap-1">
                <Calendar size={10} />
                {formatDate(org.created_at)}
              </span>
            </div>
          </button>
        ))}
        {orgs.length === 0 && (
          <div className="text-center py-8 text-muted text-sm">No organizations found</div>
        )}
      </div>
    </div>
  );
}

// ── Org Detail Panel ──────────────────────────────────────

function OrgDetailPanel({
  orgId,
  orgName,
  searchResults,
}: {
  orgId: string | null;
  orgName: string | null;
  searchResults: SuperadminUser[];
}) {
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [updatingTier, setUpdatingTier] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState("");
  const [impersonating, setImpersonating] = useState<string | null>(null);

  useEffect(() => {
    if (!orgId) {
      setUsers([]);
      return;
    }
    async function load() {
      setLoading(true);
      setError("");
      try {
        const data = await getOrgUsers(orgId!);
        setUsers(data);
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed to load users";
        setError(typeof msg === "string" ? msg : JSON.stringify(msg));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [orgId]);

  const handleTierChange = async (userId: string, newTier: string) => {
    setUpdatingTier(userId);
    setSuccessMsg("");
    try {
      const result = await updateUserTier(userId, newTier);
      setSuccessMsg(result.message);
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, subscription_tier: newTier } : u))
      );
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed to update tier";
      setError(typeof msg === "string" ? msg : JSON.stringify(msg));
      setTimeout(() => setError(""), 3000);
    } finally {
      setUpdatingTier(null);
    }
  };

  const handleImpersonate = async (userId: string, email: string) => {
    if (!confirm(`Impersonate ${email}? This will log you in as them for 15 minutes.`)) return;
    setImpersonating(userId);
    try {
      const result = await impersonateUser(userId);
      // Store in sessionStorage for the new tab
      sessionStorage.setItem("impersonate_token", result.token);
      sessionStorage.setItem("impersonate_email", result.email);
      sessionStorage.setItem(
        "impersonate_expires",
        String(Date.now() + result.expires_in * 1000)
      );
      // Open dashboard in new tab
      window.open("/", "_blank");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed to impersonate";
      setError(typeof msg === "string" ? msg : JSON.stringify(msg));
      setTimeout(() => setError(""), 3000);
    } finally {
      setImpersonating(null);
    }
  };

  // Show search results if present
  if (searchResults.length > 0) {
    return (
      <div>
        <h3 className="text-sm font-semibold text-navy uppercase tracking-wider mb-3">
          Search Results ({searchResults.length} users)
        </h3>
        <div className="bg-white rounded-xl border border-teal/20 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-navy/5 border-b border-teal/20">
                  <th className="text-left px-4 py-3 font-semibold text-navy text-xs uppercase tracking-wider">User</th>
                  <th className="text-left px-4 py-3 font-semibold text-navy text-xs uppercase tracking-wider">Org</th>
                  <th className="text-left px-4 py-3 font-semibold text-navy text-xs uppercase tracking-wider">Role</th>
                  <th className="text-left px-4 py-3 font-semibold text-navy text-xs uppercase tracking-wider">Tier</th>
                  <th className="text-left px-4 py-3 font-semibold text-navy text-xs uppercase tracking-wider">Joined</th>
                </tr>
              </thead>
              <tbody>
                {searchResults.map((u) => (
                  <tr key={u.id} className="border-b border-teal/10 hover:bg-navy/[0.02] transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-navy text-sm">
                        {u.first_name || u.last_name
                          ? `${u.first_name || ""} ${u.last_name || ""}`.trim()
                          : "—"}
                      </p>
                      <p className="text-xs text-muted truncate max-w-[200px]">{u.email}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-navy">{u.org_name || "—"}</td>
                    <td className="px-4 py-3">{roleBadge(u.hockey_role)}</td>
                    <td className="px-4 py-3">{tierBadge(u.subscription_tier)}</td>
                    <td className="px-4 py-3 text-xs text-muted">{formatDate(u.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // No org selected
  if (!orgId) {
    return (
      <div className="flex items-center justify-center h-64 text-muted text-sm">
        <div className="text-center">
          <Building2 size={32} className="mx-auto mb-3 text-teal/30" />
          <p>Select an organization to view its users</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="animate-spin text-teal" size={24} />
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-navy uppercase tracking-wider mb-3">
        {orgName || "Organization"} — {users.length} user{users.length !== 1 ? "s" : ""}
      </h3>

      {successMsg && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-2 text-sm text-green-700 flex items-center gap-2 mb-3">
          <CheckCircle2 size={14} />
          {successMsg}
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2 text-sm text-red-700 mb-3">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-teal/20 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-navy/5 border-b border-teal/20">
                <th className="text-left px-4 py-3 font-semibold text-navy text-xs uppercase tracking-wider">User</th>
                <th className="text-left px-4 py-3 font-semibold text-navy text-xs uppercase tracking-wider">Hockey Role</th>
                <th className="text-left px-4 py-3 font-semibold text-navy text-xs uppercase tracking-wider">Tier</th>
                <th className="text-center px-4 py-3 font-semibold text-navy text-xs uppercase tracking-wider">Reports</th>
                <th className="text-left px-4 py-3 font-semibold text-navy text-xs uppercase tracking-wider">Joined</th>
                <th className="text-left px-4 py-3 font-semibold text-navy text-xs uppercase tracking-wider">Change Tier</th>
                <th className="text-center px-4 py-3 font-semibold text-navy text-xs uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-teal/10 hover:bg-navy/[0.02] transition-colors">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-semibold text-navy">
                        {u.first_name || u.last_name
                          ? `${u.first_name || ""} ${u.last_name || ""}`.trim()
                          : "—"}
                      </p>
                      <p className="text-xs text-muted truncate max-w-[200px]">{u.email}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">{roleBadge(u.hockey_role)}</td>
                  <td className="px-4 py-3">{tierBadge(u.subscription_tier)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="font-semibold text-navy">{u.usage?.reports_count ?? 0}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted">{formatDate(u.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <select
                        value={u.subscription_tier || "rookie"}
                        onChange={(e) => handleTierChange(u.id, e.target.value)}
                        disabled={updatingTier === u.id}
                        className="text-xs border border-teal/20 rounded-lg px-2 py-1.5 bg-white text-navy focus:ring-2 focus:ring-teal/30 focus:border-teal outline-none disabled:opacity-50"
                      >
                        {TIER_OPTIONS.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                      {updatingTier === u.id && (
                        <Loader2 size={14} className="animate-spin text-teal" />
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleImpersonate(u.id, u.email)}
                      disabled={impersonating === u.id || u.role === "superadmin"}
                      title={u.role === "superadmin" ? "Cannot impersonate superadmin" : `Impersonate ${u.email}`}
                      className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-orange border border-orange/30 rounded-lg hover:bg-orange/5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      {impersonating === u.id ? (
                        <Loader2 size={10} className="animate-spin" />
                      ) : (
                        <UserCog size={10} />
                      )}
                      Impersonate
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {users.length === 0 && (
          <div className="text-center py-8 text-muted text-sm">No users in this organization</div>
        )}
      </div>
    </div>
  );
}

// ── Main Superadmin Page ──────────────────────────────────

function SuperadminDashboard() {
  const user = getUser();
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [selectedOrgName, setSelectedOrgName] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<SuperadminUser[]>([]);

  // Guard: superadmin only
  if (user && user.role !== "superadmin") {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <Shield size={48} className="text-red-400 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-navy mb-2">Access Denied</h2>
        <p className="text-muted">Superadmin privileges required.</p>
      </div>
    );
  }

  const handleSelectOrg = (orgId: string, orgName: string) => {
    setSelectedOrgId(orgId);
    setSelectedOrgName(orgName);
    setSearchResults([]);
  };

  const handleSearchUsers = (users: SuperadminUser[]) => {
    setSearchResults(users);
    if (users.length > 0) {
      setSelectedOrgId(null);
      setSelectedOrgName(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-navy flex items-center gap-2">
          <Shield size={24} className="text-orange" />
          Superadmin Dashboard
        </h1>
        <p className="text-muted text-sm mt-1">
          Manage all organizations, users, and tiers across the platform
        </p>
      </div>

      {/* Stats Bar */}
      <StatsBar />

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Org List — 40% */}
        <div className="lg:col-span-2">
          <div className="bg-gray-50/50 rounded-xl border border-teal/10 p-4">
            <h3 className="text-xs font-semibold text-navy uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Building2 size={12} />
              Organizations
            </h3>
            <OrgListPanel
              selectedOrgId={selectedOrgId}
              onSelectOrg={handleSelectOrg}
              onSearchUsers={handleSearchUsers}
            />
          </div>
        </div>

        {/* Org Detail — 60% */}
        <div className="lg:col-span-3">
          <div className="bg-gray-50/50 rounded-xl border border-teal/10 p-4">
            <h3 className="text-xs font-semibold text-navy uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <BarChart3 size={12} />
              {searchResults.length > 0
                ? "Search Results"
                : selectedOrgName
                  ? `${selectedOrgName} Users`
                  : "Organization Detail"}
            </h3>
            <OrgDetailPanel
              orgId={selectedOrgId}
              orgName={selectedOrgName}
              searchResults={searchResults}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SuperadminPage() {
  return (
    <ProtectedRoute>
      <NavBar />
      <main className="min-h-screen bg-[#F8F9FA]">
        <SuperadminDashboard />
      </main>
    </ProtectedRoute>
  );
}
