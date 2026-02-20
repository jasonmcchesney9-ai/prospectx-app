"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Shield,
  Users,
  BarChart3,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  Trash2,
  RefreshCw,
  Crown,
} from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import api from "@/lib/api";
import { getUser } from "@/lib/auth";
import type { AdminUser, AdminStats, AdminErrorLog } from "@/types/api";

type Tab = "users" | "platform" | "errors";

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

function formatTime(dateStr: string | null) {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

// ── Users Tab ──────────────────────────────────────────
function UsersTab() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState("");

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get<AdminUser[]>("/admin/users");
      setUsers(data);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed to load users";
      setError(typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const handleTierChange = async (userId: string, newTier: string) => {
    setUpdating(userId);
    setSuccessMsg("");
    try {
      const { data } = await api.put<{ message: string }>(`/admin/users/${userId}/tier`, { tier: newTier });
      setSuccessMsg(data.message);
      // Update local state
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, subscription_tier: newTier } : u));
      // If updating own tier, update localStorage
      const currentUser = getUser();
      if (currentUser && currentUser.id === userId) {
        const updated = { ...currentUser, subscription_tier: newTier };
        localStorage.setItem("prospectx_user", JSON.stringify(updated));
      }
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed to update tier";
      setError(typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      setUpdating(null);
    }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-teal" size={32} /></div>;
  if (error) return <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{error}</div>;

  return (
    <div className="space-y-4">
      {successMsg && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700 flex items-center gap-2">
          <CheckCircle2 size={16} />
          {successMsg}
        </div>
      )}

      <div className="bg-white rounded-xl border border-teal/20 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-navy/5 border-b border-teal/20">
                <th className="text-left px-4 py-3 font-semibold text-navy text-xs uppercase tracking-wider">User</th>
                <th className="text-left px-4 py-3 font-semibold text-navy text-xs uppercase tracking-wider">Role</th>
                <th className="text-left px-4 py-3 font-semibold text-navy text-xs uppercase tracking-wider">Tier</th>
                <th className="text-center px-4 py-3 font-semibold text-navy text-xs uppercase tracking-wider">Reports</th>
                <th className="text-center px-4 py-3 font-semibold text-navy text-xs uppercase tracking-wider">Bench Talks</th>
                <th className="text-left px-4 py-3 font-semibold text-navy text-xs uppercase tracking-wider">Joined</th>
                <th className="text-left px-4 py-3 font-semibold text-navy text-xs uppercase tracking-wider">Change Tier</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-teal/10 hover:bg-navy/[0.02] transition-colors">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-semibold text-navy">
                        {user.first_name || user.last_name
                          ? `${user.first_name || ""} ${user.last_name || ""}`.trim()
                          : "—"}
                      </p>
                      <p className="text-xs text-muted">{user.email}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-muted capitalize">{user.hockey_role || user.role || "—"}</span>
                  </td>
                  <td className="px-4 py-3">{tierBadge(user.subscription_tier)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="font-semibold text-navy">{user.usage.reports_count}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="font-semibold text-navy">{user.usage.bench_talks_count}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted">{formatDate(user.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <select
                        value={user.subscription_tier || "rookie"}
                        onChange={(e) => handleTierChange(user.id, e.target.value)}
                        disabled={updating === user.id}
                        className="text-xs border border-teal/20 rounded-lg px-2 py-1.5 bg-white text-navy focus:ring-2 focus:ring-teal/30 focus:border-teal outline-none disabled:opacity-50"
                      >
                        {TIER_OPTIONS.map(t => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                      {updating === user.id && <Loader2 size={14} className="animate-spin text-teal" />}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {users.length === 0 && (
          <div className="text-center py-8 text-muted text-sm">No users found</div>
        )}
      </div>
    </div>
  );
}

// ── Platform Tab ──────────────────────────────────────
function PlatformTab() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const { data } = await api.get<AdminStats>("/admin/stats");
        setStats(data);
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed to load stats";
        setError(typeof msg === "string" ? msg : JSON.stringify(msg));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-teal" size={32} /></div>;
  if (error) return <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{error}</div>;
  if (!stats) return null;

  const statCards = [
    { label: "Users", value: stats.total_users, icon: Users, color: "text-teal" },
    { label: "Players", value: stats.total_players, icon: Shield, color: "text-navy" },
    { label: "Reports", value: stats.total_reports, icon: BarChart3, color: "text-orange" },
    { label: "Teams", value: stats.total_teams, icon: Crown, color: "text-blue-600" },
    { label: "Scout Notes", value: stats.total_notes, icon: BarChart3, color: "text-purple-600" },
    { label: "Game Plans", value: stats.total_game_plans, icon: Shield, color: "text-green-600" },
    { label: "Drills", value: stats.total_drills, icon: RefreshCw, color: "text-teal" },
    { label: "Conversations", value: stats.total_conversations, icon: Users, color: "text-navy" },
  ];

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {statCards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl border border-teal/20 p-4 text-center">
            <Icon size={20} className={`${color} mx-auto mb-2`} />
            <p className="text-2xl font-bold text-navy">{value}</p>
            <p className="text-[10px] text-muted uppercase tracking-wider font-semibold">{label}</p>
          </div>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-xl border border-teal/20 p-5">
        <h3 className="text-sm font-semibold text-navy uppercase tracking-wider mb-3">Last 7 Days</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-3xl font-bold text-teal">{stats.recent_reports}</p>
            <p className="text-xs text-muted">Reports Generated</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-orange">{stats.recent_notes}</p>
            <p className="text-xs text-muted">Scout Notes Created</p>
          </div>
        </div>
      </div>

      {/* Reports by Status */}
      {stats.reports_by_status.length > 0 && (
        <div className="bg-white rounded-xl border border-teal/20 p-5">
          <h3 className="text-sm font-semibold text-navy uppercase tracking-wider mb-3">Reports by Status</h3>
          <div className="flex flex-wrap gap-3">
            {stats.reports_by_status.map(({ status, count }) => {
              const statusColors: Record<string, string> = {
                completed: "bg-green-100 text-green-700",
                pending: "bg-yellow-100 text-yellow-700",
                generating: "bg-blue-100 text-blue-700",
                failed: "bg-red-100 text-red-700",
              };
              return (
                <div key={status} className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${statusColors[status] || "bg-gray-100 text-gray-700"}`}>
                  {status}: {count}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Users by Tier */}
      {stats.users_by_tier.length > 0 && (
        <div className="bg-white rounded-xl border border-teal/20 p-5">
          <h3 className="text-sm font-semibold text-navy uppercase tracking-wider mb-3">Users by Tier</h3>
          <div className="flex flex-wrap gap-3">
            {stats.users_by_tier.map(({ tier, count }) => (
              <div key={tier} className="flex items-center gap-2">
                {tierBadge(tier)}
                <span className="text-sm font-bold text-navy">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Errors Tab ──────────────────────────────────────
function ErrorsTab() {
  const [errors, setErrors] = useState<AdminErrorLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [clearing, setClearing] = useState(false);

  const loadErrors = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get<AdminErrorLog[]>("/admin/errors?limit=100");
      setErrors(data);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed to load errors";
      setError(typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadErrors(); }, [loadErrors]);

  const handleClear = async () => {
    setClearing(true);
    try {
      await api.delete("/admin/errors");
      setErrors([]);
    } catch {
      // Ignore
    } finally {
      setClearing(false);
    }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-teal" size={32} /></div>;
  if (error) return <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{error}</div>;

  return (
    <div className="space-y-4">
      {errors.length > 0 && (
        <div className="flex justify-end">
          <button
            onClick={handleClear}
            disabled={clearing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            {clearing ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
            Clear All Errors
          </button>
        </div>
      )}

      {errors.length === 0 ? (
        <div className="bg-white rounded-xl border border-teal/20 p-8 text-center">
          <CheckCircle2 size={32} className="text-green-500 mx-auto mb-3" />
          <p className="text-navy font-semibold">No errors recorded</p>
          <p className="text-muted text-sm mt-1">Server errors (500s) will appear here when they occur</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-teal/20 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-red-50/50 border-b border-teal/20">
                  <th className="text-left px-4 py-3 font-semibold text-navy text-xs uppercase tracking-wider">Method</th>
                  <th className="text-left px-4 py-3 font-semibold text-navy text-xs uppercase tracking-wider">Path</th>
                  <th className="text-center px-4 py-3 font-semibold text-navy text-xs uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 font-semibold text-navy text-xs uppercase tracking-wider">Error</th>
                  <th className="text-left px-4 py-3 font-semibold text-navy text-xs uppercase tracking-wider">Time</th>
                </tr>
              </thead>
              <tbody>
                {errors.map((err) => (
                  <tr key={err.id} className="border-b border-teal/10 hover:bg-red-50/30 transition-colors">
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 bg-navy/10 text-navy rounded text-xs font-mono font-semibold">
                        {err.request_method}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-navy max-w-[200px] truncate">
                      {err.request_path}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-semibold">
                        {err.status_code}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-red-600 max-w-[300px] truncate">
                      {err.error_message}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted whitespace-nowrap">
                      {formatTime(err.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Admin Page ──────────────────────────────────
function AdminDashboard() {
  const [tab, setTab] = useState<Tab>("users");
  const user = getUser();

  // Check admin role
  if (user && user.role !== "admin" && user.role !== "superadmin") {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <Shield size={48} className="text-red-400 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-navy mb-2">Access Denied</h2>
        <p className="text-muted">You need admin privileges to access this page.</p>
      </div>
    );
  }

  const tabs: { key: Tab; label: string; icon: typeof Users }[] = [
    { key: "users", label: "Users", icon: Users },
    { key: "platform", label: "Platform", icon: BarChart3 },
    { key: "errors", label: "Errors", icon: AlertTriangle },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-navy flex items-center gap-2">
          <Shield size={24} className="text-orange" />
          Admin Dashboard
        </h1>
        <p className="text-muted text-sm mt-1">
          Manage users, monitor platform usage, and review errors
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-semibold transition-all ${
              tab === key
                ? "bg-white text-navy shadow-sm"
                : "text-muted hover:text-navy"
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === "users" && <UsersTab />}
      {tab === "platform" && <PlatformTab />}
      {tab === "errors" && <ErrorsTab />}
    </div>
  );
}

export default function AdminPage() {
  return (
    <ProtectedRoute>
      <NavBar />
      <main className="min-h-screen bg-[#F8F9FA]">
        <AdminDashboard />
      </main>
    </ProtectedRoute>
  );
}
