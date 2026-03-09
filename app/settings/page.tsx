"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Users,
  Mail,
  Shield,
  UserPlus,
  ChevronDown,
  Loader2,
  X,
  CheckCircle,
  AlertTriangle,
  CreditCard,
  Building2,
  Upload,
  ExternalLink,
  Save,
  Info,
  User,
  Lock,
  Bell,
  Eye,
  EyeOff,
  Calendar,
} from "lucide-react";
import Link from "next/link";
import ProtectedRoute from "@/components/ProtectedRoute";
import NavBar from "@/components/NavBar";
import api, { extractApiError } from "@/lib/api";
import { getUser } from "@/lib/auth";

// ── Types ────────────────────────────────────────────────────────
interface TeamMember {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
  hockey_role: string;
  subscription_tier: string;
  status?: string;
  created_at: string;
  last_login?: string | null;
}

interface PendingInvite {
  id: string;
  email: string;
  hockey_role: string;
  created_at: string;
  status: string;
}

interface UsageData {
  tier: string;
  seats_used: number;
  seats_limit: number;
  reports_used: number;
  reports_limit: number;
  bench_talks_used: number;
  bench_talks_limit: number;
}

// ── Constants ────────────────────────────────────────────────────
type SettingsTab = "account" | "team" | "billing" | "org";

const HOCKEY_ROLES = [
  { value: "scout", label: "Scout" },
  { value: "coach", label: "Coach" },
  { value: "gm", label: "General Manager" },
  { value: "analyst", label: "Analyst" },
  { value: "admin", label: "Admin" },
  { value: "broadcaster", label: "Broadcaster" },
  { value: "agent", label: "Agent" },
];

const ROLE_BADGE_COLORS: Record<string, { bg: string; text: string }> = {
  scout: { bg: "rgba(13,148,136,0.12)", text: "#0D9488" },
  coach: { bg: "rgba(59,130,246,0.12)", text: "#3B82F6" },
  gm: { bg: "rgba(230,126,34,0.12)", text: "#E67E22" },
  analyst: { bg: "rgba(139,92,246,0.12)", text: "#8B5CF6" },
  admin: { bg: "rgba(239,68,68,0.12)", text: "#EF4444" },
  broadcaster: { bg: "rgba(245,158,11,0.12)", text: "#F59E0B" },
  producer: { bg: "rgba(245,158,11,0.12)", text: "#F59E0B" },
  agent: { bg: "rgba(107,114,128,0.12)", text: "#6B7280" },
  player: { bg: "rgba(16,185,129,0.12)", text: "#10B981" },
  parent: { bg: "rgba(236,72,153,0.12)", text: "#EC4899" },
};

const LEAGUE_OPTIONS: { code: string; label: string; full: string }[] = [
  // Professional
  { code: "ahl", label: "AHL", full: "American Hockey League" },
  { code: "echl", label: "ECHL", full: "ECHL" },
  { code: "sphl", label: "SPHL", full: "Southern Professional Hockey League" },
  { code: "pwhl", label: "PWHL", full: "Professional Women's Hockey League" },
  // Major Junior (CHL)
  { code: "ohl", label: "OHL", full: "Ontario Hockey League" },
  { code: "whl", label: "WHL", full: "Western Hockey League" },
  { code: "lhjmq", label: "QMJHL", full: "Quebec Major Junior Hockey League" },
  // Junior A
  { code: "bchl", label: "BCHL", full: "British Columbia Hockey League" },
  { code: "ajhl", label: "AJHL", full: "Alberta Junior Hockey League" },
  { code: "sjhl", label: "SJHL", full: "Saskatchewan Junior Hockey League" },
  { code: "mjhl", label: "MJHL", full: "Manitoba Junior Hockey League" },
  { code: "ushl", label: "USHL", full: "United States Hockey League" },
  { code: "ojhl", label: "OJHL", full: "Ontario Junior Hockey League" },
  { code: "cchl", label: "CCHL", full: "Central Canada Hockey League" },
  { code: "nojhl", label: "NOJHL", full: "Northern Ontario Junior Hockey League" },
  { code: "mhl", label: "MHL", full: "Maritime Hockey League" },
  { code: "gojhl", label: "GOJHL", full: "Greater Ontario Junior Hockey League" },
  // Junior B
  { code: "kijhl", label: "KIJHL", full: "Kootenay International Junior Hockey League" },
  { code: "pjhl", label: "PJHL", full: "Provincial Junior Hockey League" },
  { code: "vijhl", label: "VIJHL", full: "Vancouver Island Junior Hockey League" },
];

// ── Main Component ───────────────────────────────────────────────
export default function SettingsPage() {
  return (
    <ProtectedRoute>
      <NavBar />
      <SettingsContent />
    </ProtectedRoute>
  );
}

function SettingsContent() {
  const user = getUser();
  const [activeTab, setActiveTab] = useState<SettingsTab>("account");

  // ── Team tab state ──
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("scout");
  const [inviting, setInviting] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [roleChanging, setRoleChanging] = useState<string | null>(null);

  // ── Account tab state ──
  const [displayName, setDisplayName] = useState(`${user?.first_name || ""} ${user?.last_name || ""}`.trim());
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState("");
  const [profileError, setProfileError] = useState("");
  const [prefLeague, setPrefLeague] = useState(user?.preferred_league || "");
  const [emailDigest, setEmailDigest] = useState<"daily" | "weekly" | "off">("weekly");
  const [pxrAlerts, setPxrAlerts] = useState(true);
  const [teamOutcomeUpdates, setTeamOutcomeUpdates] = useState(true);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  // ── Org tab state ──
  const [orgName, setOrgName] = useState("");
  const [orgLeague, setOrgLeague] = useState("");
  const [orgTeam, setOrgTeam] = useState("");
  const [orgSaving, setOrgSaving] = useState(false);
  const [orgSuccess, setOrgSuccess] = useState("");
  const [orgError, setOrgError] = useState("");

  // ── Load data ──
  const loadTeamData = useCallback(async () => {
    setLoading(true);
    try {
      const [membersRes, usageRes] = await Promise.allSettled([
        api.get<TeamMember[]>("/admin/users"),
        api.get("/subscription/usage"),
      ]);
      if (membersRes.status === "fulfilled") setMembers(membersRes.value.data);
      if (usageRes.status === "fulfilled") setUsage(usageRes.value.data);

      // Try to load pending invites
      try {
        const invitesRes = await api.get<PendingInvite[]>("/org/invites");
        setInvites(invitesRes.data);
      } catch {
        // Endpoint may not exist yet — silently skip
        setInvites([]);
      }

      // Try to load org settings
      try {
        const orgRes = await api.get("/admin/org");
        if (orgRes.data) {
          setOrgName(orgRes.data.name || orgRes.data.org_name || "");
          setOrgLeague(orgRes.data.default_league || orgRes.data.league || "");
          setOrgTeam(orgRes.data.default_team || orgRes.data.team || "");
        }
      } catch {
        // Endpoint may not exist yet — silently skip
      }
    } catch {
      // Handled per-section
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTeamData();
  }, [loadTeamData]);

  // ── Load notification prefs from localStorage ──
  useEffect(() => {
    try {
      const savedDigest = localStorage.getItem("pxEmailDigest");
      if (savedDigest === "daily" || savedDigest === "weekly" || savedDigest === "off") setEmailDigest(savedDigest);
      const savedPxr = localStorage.getItem("pxPxrAlerts");
      if (savedPxr !== null) setPxrAlerts(savedPxr === "true");
      const savedTeam = localStorage.getItem("pxTeamOutcomeUpdates");
      if (savedTeam !== null) setTeamOutcomeUpdates(savedTeam === "true");
      const savedLeague = localStorage.getItem("pxPrefLeague");
      if (savedLeague) setPrefLeague(savedLeague);
    } catch { /* noop */ }
  }, []);

  // ── Invite handler ──
  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setInviteError("");
    setInviteSuccess("");
    try {
      await api.post("/org/invite", { email: inviteEmail.trim(), hockey_role: inviteRole });
      setInviteSuccess(`Invite sent to ${inviteEmail.trim()}`);
      setInviteEmail("");
      setInviteRole("scout");
      loadTeamData();
    } catch (err) {
      setInviteError(extractApiError(err, "Failed to send invite"));
    } finally {
      setInviting(false);
    }
  };

  // ── Role change handler ──
  const handleRoleChange = async (userId: string, newRole: string) => {
    setRoleChanging(userId);
    try {
      await api.put(`/admin/users/${userId}/role`, { hockey_role: newRole });
      loadTeamData();
    } catch {
      // silently fail
    } finally {
      setRoleChanging(null);
    }
  };

  // ── Deactivate handler ──
  const handleDeactivate = async (userId: string) => {
    if (!confirm("Are you sure you want to deactivate this user?")) return;
    try {
      await api.put(`/admin/users/${userId}/status`, { status: "inactive" });
      loadTeamData();
    } catch {
      // silently fail
    }
  };

  // ── Revoke invite handler ──
  const handleRevokeInvite = async (inviteId: string) => {
    try {
      await api.delete(`/org/invites/${inviteId}`);
      loadTeamData();
    } catch {
      // silently fail
    }
  };

  // ── Org save handler ──
  const handleOrgSave = async () => {
    setOrgSaving(true);
    setOrgError("");
    setOrgSuccess("");
    try {
      await api.put("/admin/org", { name: orgName, default_league: orgLeague, default_team: orgTeam });
      setOrgSuccess("Organization settings saved");
    } catch (err) {
      setOrgError(extractApiError(err, "Failed to save organization settings"));
    } finally {
      setOrgSaving(false);
    }
  };

  // ── Seat usage bar ──
  const seatsUsed = usage?.seats_used ?? members.length;
  const seatsLimit = usage?.seats_limit ?? 5;
  const seatPct = seatsLimit > 0 ? Math.min((seatsUsed / seatsLimit) * 100, 100) : 0;
  const seatBarColor = seatPct > 95 ? "#EF4444" : seatPct > 80 ? "#F59E0B" : "#0D9488";

  // ── Format date ──
  const fmtDate = (d: string | null | undefined) => {
    if (!d) return "—";
    try {
      return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    } catch {
      return "—";
    }
  };

  // ── Tab definitions ──
  const TABS: { key: SettingsTab; label: string }[] = [
    { key: "account", label: "ACCOUNT" },
    { key: "team", label: "TEAM" },
    { key: "billing", label: "BILLING" },
    { key: "org", label: "ORG" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#F0F4F8" }}>
      {/* ── Navy Gradient Header ── */}
      <div style={{ background: "linear-gradient(135deg, #0F2942 0%, #1A3F54 100%)", padding: "32px 0 0" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px" }}>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 3, color: "rgba(255,255,255,0.4)", fontFamily: "'Oswald', sans-serif", textTransform: "uppercase", marginBottom: 4 }}>
            ACCOUNT
          </p>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: "#FFFFFF", fontFamily: "'Oswald', sans-serif", letterSpacing: 1, textTransform: "uppercase", margin: 0 }}>
            SETTINGS
          </h1>
        </div>

        {/* ── Tab Bar ── */}
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px", marginTop: 20 }}>
          <div style={{ display: "flex", gap: 0, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            {TABS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                style={{
                  padding: "10px 24px",
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: 2,
                  color: activeTab === key ? "#14B8A6" : "rgba(255,255,255,0.38)",
                  cursor: "pointer",
                  transition: "all 0.12s",
                  border: "none",
                  borderBottom: `2px solid ${activeTab === key ? "#0D9488" : "transparent"}`,
                  background: activeTab === key ? "rgba(13,148,136,0.08)" : "transparent",
                  fontFamily: "'Oswald', sans-serif",
                  textTransform: "uppercase",
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Tab Content ── */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 24px 48px" }}>

        {/* ════════════ ACCOUNT TAB ════════════ */}
        {activeTab === "account" && (
          <div>
            {/* ── Profile Section ── */}
            <div style={{ background: "#FFFFFF", borderRadius: 12, border: "1px solid #DDE6EF", overflow: "hidden", marginBottom: 20 }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid #DDE6EF", display: "flex", alignItems: "center", gap: 8 }}>
                <User size={18} style={{ color: "#0D9488" }} />
                <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0F2942", fontFamily: "'Oswald', sans-serif", letterSpacing: 1, textTransform: "uppercase", margin: 0 }}>
                  Profile
                </h2>
              </div>
              <div style={{ padding: 24 }}>
                <div style={{ display: "flex", gap: 24, alignItems: "flex-start", flexWrap: "wrap" }}>
                  {/* Avatar — initials circle */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, minWidth: 80 }}>
                    <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#0D9488", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 700, color: "#FFFFFF", fontFamily: "'Oswald', sans-serif" }}>
                      {`${(user?.first_name || "?")[0]}${(user?.last_name || "?")[0]}`.toUpperCase()}
                    </div>
                    <button
                      disabled
                      title="Coming soon — photo upload not yet available"
                      style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: "#8BA4BB", cursor: "not-allowed", border: "none", background: "none", fontFamily: "'Oswald', sans-serif", textTransform: "uppercase" }}
                    >
                      Upload Photo
                    </button>
                  </div>

                  {/* Profile fields */}
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16, minWidth: 260 }}>
                    {/* Display Name */}
                    <div>
                      <label style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: 2, color: "#8BA4BB", fontFamily: "'Oswald', sans-serif", textTransform: "uppercase", marginBottom: 6 }}>
                        Display Name
                      </label>
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <input
                          type="text"
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          placeholder="Your name"
                          style={{ flex: 1, maxWidth: 320, padding: "10px 12px", fontSize: 13, borderRadius: 8, border: "1px solid #DDE6EF", background: "#F8FAFC", color: "#0F2942", outline: "none" }}
                        />
                        <button
                          disabled
                          title="Coming soon — PUT /users/me endpoint not yet available"
                          style={{
                            display: "flex", alignItems: "center", gap: 6, padding: "10px 16px", fontSize: 11, fontWeight: 700, letterSpacing: 1,
                            borderRadius: 8, border: "1px solid #DDE6EF", background: "#F8FAFC", color: "#8BA4BB", cursor: "not-allowed",
                            fontFamily: "'Oswald', sans-serif", textTransform: "uppercase",
                          }}
                        >
                          {profileSaving ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Save size={13} />}
                          Save
                          <Info size={11} style={{ marginLeft: 2, opacity: 0.5 }} />
                        </button>
                      </div>
                      {profileSuccess && (
                        <div style={{ marginTop: 8, fontSize: 12, color: "#0D9488", fontWeight: 600 }}>{profileSuccess}</div>
                      )}
                      {profileError && (
                        <div style={{ marginTop: 8, fontSize: 12, color: "#EF4444", fontWeight: 600 }}>{profileError}</div>
                      )}
                    </div>

                    {/* Email (read-only) */}
                    <div>
                      <label style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: 2, color: "#8BA4BB", fontFamily: "'Oswald', sans-serif", textTransform: "uppercase", marginBottom: 6 }}>
                        Email
                      </label>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <input
                          type="email"
                          value={user?.email || ""}
                          readOnly
                          style={{ flex: 1, maxWidth: 320, padding: "10px 12px", fontSize: 13, borderRadius: 8, border: "1px solid #DDE6EF", background: "#F0F4F8", color: "#5A7A95", outline: "none", cursor: "default" }}
                        />
                        <span title="Contact support to change your email" style={{ cursor: "help" }}>
                          <Info size={14} style={{ color: "#8BA4BB" }} />
                        </span>
                      </div>
                    </div>

                    {/* Role Badge */}
                    <div>
                      <label style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: 2, color: "#8BA4BB", fontFamily: "'Oswald', sans-serif", textTransform: "uppercase", marginBottom: 6 }}>
                        Hockey Role
                      </label>
                      <span style={{
                        display: "inline-block", padding: "5px 16px", borderRadius: 20, fontSize: 12, fontWeight: 700, letterSpacing: 1.5,
                        fontFamily: "'Oswald', sans-serif", textTransform: "uppercase",
                        background: (ROLE_BADGE_COLORS[user?.hockey_role || "scout"] || ROLE_BADGE_COLORS.scout).bg,
                        color: (ROLE_BADGE_COLORS[user?.hockey_role || "scout"] || ROLE_BADGE_COLORS.scout).text,
                      }}>
                        {user?.hockey_role || "Scout"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Preferences Section ── */}
            <div style={{ background: "#FFFFFF", borderRadius: 12, border: "1px solid #DDE6EF", overflow: "hidden", marginBottom: 20 }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid #DDE6EF", display: "flex", alignItems: "center", gap: 8 }}>
                <Bell size={18} style={{ color: "#0D9488" }} />
                <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0F2942", fontFamily: "'Oswald', sans-serif", letterSpacing: 1, textTransform: "uppercase", margin: 0 }}>
                  Preferences
                </h2>
              </div>
              <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
                {/* Preferred League */}
                <div>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: 2, color: "#8BA4BB", fontFamily: "'Oswald', sans-serif", textTransform: "uppercase", marginBottom: 6 }}>
                    Preferred League
                  </label>
                  <div style={{ position: "relative", maxWidth: 400 }}>
                    <select
                      value={prefLeague}
                      onChange={(e) => {
                        setPrefLeague(e.target.value);
                        try { localStorage.setItem("pxPrefLeague", e.target.value); } catch { /* noop */ }
                      }}
                      style={{ width: "100%", padding: "10px 28px 10px 12px", fontSize: 13, borderRadius: 8, border: "1px solid #DDE6EF", background: "#F8FAFC", color: "#0F2942", cursor: "pointer", appearance: "none", WebkitAppearance: "none" }}
                    >
                      <option value="">Select a league...</option>
                      {LEAGUE_OPTIONS.map((opt) => (
                        <option key={opt.code} value={opt.code}>{opt.label} — {opt.full}</option>
                      ))}
                    </select>
                    <ChevronDown size={12} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "#8BA4BB" }} />
                  </div>
                </div>

                {/* Notification Preferences */}
                <div>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: 2, color: "#8BA4BB", fontFamily: "'Oswald', sans-serif", textTransform: "uppercase", marginBottom: 10 }}>
                    Notifications
                  </label>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {/* Email Digest */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", maxWidth: 420 }}>
                      <span style={{ fontSize: 13, color: "#0F2942", fontFamily: "'Source Serif 4', serif" }}>Email Digest</span>
                      <div style={{ display: "flex", gap: 0, borderRadius: 8, overflow: "hidden", border: "1px solid #DDE6EF" }}>
                        {(["daily", "weekly", "off"] as const).map((opt) => (
                          <button
                            key={opt}
                            onClick={() => {
                              setEmailDigest(opt);
                              try { localStorage.setItem("pxEmailDigest", opt); } catch { /* noop */ }
                            }}
                            style={{
                              padding: "6px 14px", fontSize: 11, fontWeight: 700, letterSpacing: 1, border: "none",
                              background: emailDigest === opt ? "#0D9488" : "#F8FAFC",
                              color: emailDigest === opt ? "#FFFFFF" : "#5A7A95",
                              cursor: "pointer", fontFamily: "'Oswald', sans-serif", textTransform: "uppercase",
                            }}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* PXR Report Alerts */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", maxWidth: 420 }}>
                      <span style={{ fontSize: 13, color: "#0F2942", fontFamily: "'Source Serif 4', serif" }}>New PXR Report Alerts</span>
                      <button
                        onClick={() => {
                          const next = !pxrAlerts;
                          setPxrAlerts(next);
                          try { localStorage.setItem("pxPxrAlerts", String(next)); } catch { /* noop */ }
                        }}
                        style={{
                          width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer", position: "relative", transition: "background 0.2s",
                          background: pxrAlerts ? "#0D9488" : "#DDE6EF",
                        }}
                      >
                        <div style={{
                          width: 18, height: 18, borderRadius: "50%", background: "#FFFFFF", position: "absolute", top: 3, transition: "left 0.2s",
                          left: pxrAlerts ? 23 : 3, boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                        }} />
                      </button>
                    </div>

                    {/* Team Outcome Updates */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", maxWidth: 420 }}>
                      <span style={{ fontSize: 13, color: "#0F2942", fontFamily: "'Source Serif 4', serif" }}>Team Outcome Updates</span>
                      <button
                        onClick={() => {
                          const next = !teamOutcomeUpdates;
                          setTeamOutcomeUpdates(next);
                          try { localStorage.setItem("pxTeamOutcomeUpdates", String(next)); } catch { /* noop */ }
                        }}
                        style={{
                          width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer", position: "relative", transition: "background 0.2s",
                          background: teamOutcomeUpdates ? "#0D9488" : "#DDE6EF",
                        }}
                      >
                        <div style={{
                          width: 18, height: 18, borderRadius: "50%", background: "#FFFFFF", position: "absolute", top: 3, transition: "left 0.2s",
                          left: teamOutcomeUpdates ? 23 : 3, boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                        }} />
                      </button>
                    </div>
                  </div>
                  <p style={{ fontSize: 10, color: "#8BA4BB", marginTop: 10, fontStyle: "italic" }}>
                    Notification preferences are saved locally. Backend integration coming soon.
                  </p>
                </div>
              </div>
            </div>

            {/* ── Usage Section ── */}
            <div style={{ background: "#FFFFFF", borderRadius: 12, border: "1px solid #DDE6EF", overflow: "hidden", marginBottom: 20 }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid #DDE6EF", display: "flex", alignItems: "center", gap: 8 }}>
                <Calendar size={18} style={{ color: "#0D9488" }} />
                <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0F2942", fontFamily: "'Oswald', sans-serif", letterSpacing: 1, textTransform: "uppercase", margin: 0 }}>
                  My Activity This Month
                </h2>
              </div>
              <div style={{ padding: 24 }}>
                <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 20 }}>
                  {/* Reports Used */}
                  {(() => {
                    const used = usage?.reports_used ?? user?.monthly_reports_used ?? 0;
                    const limit = usage?.reports_limit ?? -1;
                    const isUnlimited = limit === -1;
                    const pct = isUnlimited ? Math.min(used * 2, 100) : (limit > 0 ? Math.min((used / limit) * 100, 100) : 0);
                    return (
                      <div style={{ flex: 1, minWidth: 200 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: "#0F2942", fontFamily: "'Oswald', sans-serif", letterSpacing: 1, textTransform: "uppercase" }}>Reports</span>
                          <span style={{ fontSize: 14, fontWeight: 700, color: "#0D9488", fontFamily: "'Oswald', sans-serif" }}>
                            {used} / {isUnlimited ? "∞" : limit}
                          </span>
                        </div>
                        <div style={{ width: "100%", height: 8, borderRadius: 4, background: "#DDE6EF" }}>
                          <div style={{ width: `${pct}%`, height: 8, borderRadius: 4, background: "#0D9488", transition: "width 0.3s ease" }} />
                        </div>
                      </div>
                    );
                  })()}

                  {/* Bench Talks Used */}
                  {(() => {
                    const used = usage?.bench_talks_used ?? user?.monthly_bench_talks_used ?? 0;
                    const limit = usage?.bench_talks_limit ?? -1;
                    const isUnlimited = limit === -1;
                    const pct = isUnlimited ? Math.min(used, 100) : (limit > 0 ? Math.min((used / limit) * 100, 100) : 0);
                    return (
                      <div style={{ flex: 1, minWidth: 200 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: "#0F2942", fontFamily: "'Oswald', sans-serif", letterSpacing: 1, textTransform: "uppercase" }}>Bench Talks</span>
                          <span style={{ fontSize: 14, fontWeight: 700, color: "#0D9488", fontFamily: "'Oswald', sans-serif" }}>
                            {used} / {isUnlimited ? "∞" : limit}
                          </span>
                        </div>
                        <div style={{ width: "100%", height: 8, borderRadius: 4, background: "#DDE6EF" }}>
                          <div style={{ width: `${pct}%`, height: 8, borderRadius: 4, background: "#0D9488", transition: "width 0.3s ease" }} />
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Member since / Last login */}
                <div style={{ display: "flex", gap: 32, flexWrap: "wrap", paddingTop: 16, borderTop: "1px solid #DDE6EF" }}>
                  <div>
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: "#8BA4BB", fontFamily: "'Oswald', sans-serif", textTransform: "uppercase" }}>Member Since</span>
                    <div style={{ fontSize: 13, color: "#0F2942", fontFamily: "'Source Serif 4', serif", marginTop: 4 }}>
                      {(() => {
                        const member = members.find(m => m.id === user?.id);
                        return member ? fmtDate(member.created_at) : "—";
                      })()}
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: "#8BA4BB", fontFamily: "'Oswald', sans-serif", textTransform: "uppercase" }}>Last Login</span>
                    <div style={{ fontSize: 13, color: "#0F2942", fontFamily: "'Source Serif 4', serif", marginTop: 4 }}>
                      {(() => {
                        const member = members.find(m => m.id === user?.id);
                        return member?.last_login ? fmtDate(member.last_login) : "—";
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Password Section ── */}
            <div style={{ background: "#FFFFFF", borderRadius: 12, border: "1px solid #DDE6EF", overflow: "hidden" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid #DDE6EF", display: "flex", alignItems: "center", gap: 8 }}>
                <Lock size={18} style={{ color: "#0D9488" }} />
                <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0F2942", fontFamily: "'Oswald', sans-serif", letterSpacing: 1, textTransform: "uppercase", margin: 0 }}>
                  Change Password
                </h2>
              </div>
              <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16, maxWidth: 400 }}>
                {/* Current Password */}
                <div>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: 2, color: "#8BA4BB", fontFamily: "'Oswald', sans-serif", textTransform: "uppercase", marginBottom: 6 }}>
                    Current Password
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      type={showCurrentPw ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="••••••••"
                      disabled
                      style={{ width: "100%", padding: "10px 36px 10px 12px", fontSize: 13, borderRadius: 8, border: "1px solid #DDE6EF", background: "#F0F4F8", color: "#8BA4BB", outline: "none", cursor: "not-allowed" }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPw(!showCurrentPw)}
                      style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", border: "none", background: "none", cursor: "pointer", color: "#8BA4BB", padding: 0 }}
                    >
                      {showCurrentPw ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                {/* New Password */}
                <div>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: 2, color: "#8BA4BB", fontFamily: "'Oswald', sans-serif", textTransform: "uppercase", marginBottom: 6 }}>
                    New Password
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      type={showNewPw ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      disabled
                      style={{ width: "100%", padding: "10px 36px 10px 12px", fontSize: 13, borderRadius: 8, border: "1px solid #DDE6EF", background: "#F0F4F8", color: "#8BA4BB", outline: "none", cursor: "not-allowed" }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPw(!showNewPw)}
                      style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", border: "none", background: "none", cursor: "pointer", color: "#8BA4BB", padding: 0 }}
                    >
                      {showNewPw ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                {/* Confirm Password */}
                <div>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: 2, color: "#8BA4BB", fontFamily: "'Oswald', sans-serif", textTransform: "uppercase", marginBottom: 6 }}>
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    disabled
                    style={{ width: "100%", padding: "10px 12px", fontSize: 13, borderRadius: 8, border: "1px solid #DDE6EF", background: "#F0F4F8", color: "#8BA4BB", outline: "none", cursor: "not-allowed" }}
                  />
                </div>

                {/* Save button — disabled */}
                <div style={{ paddingTop: 8, borderTop: "1px solid #DDE6EF" }}>
                  <button
                    disabled
                    title="Coming soon — POST /auth/change-password endpoint not yet available"
                    style={{
                      display: "flex", alignItems: "center", gap: 8, padding: "12px 24px", fontSize: 12, fontWeight: 700, letterSpacing: 2,
                      borderRadius: 8, border: "1px solid #DDE6EF", background: "#F8FAFC", color: "#8BA4BB", cursor: "not-allowed",
                      fontFamily: "'Oswald', sans-serif", textTransform: "uppercase",
                    }}
                  >
                    <Lock size={14} />
                    Change Password
                    <Info size={12} style={{ marginLeft: 4, opacity: 0.5 }} />
                  </button>
                  <p style={{ fontSize: 10, color: "#8BA4BB", marginTop: 8, fontStyle: "italic" }}>
                    Password change coming soon — endpoint not yet built
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════════════ TEAM TAB ════════════ */}
        {activeTab === "team" && (
          <div>
            {loading ? (
              <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
                <Loader2 size={24} style={{ color: "#0D9488", animation: "spin 1s linear infinite" }} />
              </div>
            ) : (
              <>
                {/* ── Team Members Table ── */}
                <div style={{ background: "#FFFFFF", borderRadius: 12, border: "1px solid #DDE6EF", overflow: "hidden", marginBottom: 20 }}>
                  <div style={{ padding: "16px 20px", borderBottom: "1px solid #DDE6EF", display: "flex", alignItems: "center", gap: 8 }}>
                    <Users size={18} style={{ color: "#0D9488" }} />
                    <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0F2942", fontFamily: "'Oswald', sans-serif", letterSpacing: 1, textTransform: "uppercase", margin: 0 }}>
                      Team Members
                    </h2>
                    <span style={{ fontSize: 11, color: "#8BA4BB", marginLeft: 4 }}>({members.length})</span>
                  </div>

                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: "#F8FAFC" }}>
                          {["NAME", "EMAIL", "ROLE", "JOINED", "LAST ACTIVE", "ACTIONS"].map((h) => (
                            <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 9, fontWeight: 700, letterSpacing: 2, color: "#8BA4BB", fontFamily: "'Oswald', sans-serif", textTransform: "uppercase", borderBottom: "1px solid #DDE6EF" }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {members.map((m) => {
                          const initials = `${(m.first_name || "?")[0]}${(m.last_name || "?")[0]}`.toUpperCase();
                          const roleBadge = ROLE_BADGE_COLORS[m.hockey_role] || ROLE_BADGE_COLORS.scout;
                          const isCurrentUser = m.id === user?.id;
                          return (
                            <tr key={m.id} style={{ borderBottom: "1px solid #F0F4F8" }}>
                              {/* NAME */}
                              <td style={{ padding: "12px 16px" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#0D9488", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#FFFFFF", fontFamily: "'Oswald', sans-serif", flexShrink: 0 }}>
                                    {initials}
                                  </div>
                                  <span style={{ fontWeight: 600, color: "#0F2942" }}>
                                    {m.first_name || ""} {m.last_name || ""}
                                    {isCurrentUser && <span style={{ fontSize: 10, color: "#8BA4BB", marginLeft: 6 }}>(you)</span>}
                                  </span>
                                </div>
                              </td>
                              {/* EMAIL */}
                              <td style={{ padding: "12px 16px", color: "#5A7A95" }}>{m.email}</td>
                              {/* ROLE */}
                              <td style={{ padding: "12px 16px" }}>
                                <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 20, fontSize: 10, fontWeight: 700, letterSpacing: 1, fontFamily: "'Oswald', sans-serif", textTransform: "uppercase", background: roleBadge.bg, color: roleBadge.text }}>
                                  {m.hockey_role || "scout"}
                                </span>
                              </td>
                              {/* JOINED */}
                              <td style={{ padding: "12px 16px", color: "#8BA4BB", fontSize: 12 }}>{fmtDate(m.created_at)}</td>
                              {/* LAST ACTIVE */}
                              <td style={{ padding: "12px 16px", color: "#8BA4BB", fontSize: 12 }}>{fmtDate(m.last_login)}</td>
                              {/* ACTIONS */}
                              <td style={{ padding: "12px 16px" }}>
                                {!isCurrentUser && (
                                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    {/* Change Role dropdown */}
                                    <div style={{ position: "relative" }}>
                                      <select
                                        value={m.hockey_role}
                                        onChange={(e) => handleRoleChange(m.id, e.target.value)}
                                        disabled={roleChanging === m.id}
                                        style={{ padding: "4px 24px 4px 8px", fontSize: 11, borderRadius: 6, border: "1px solid #DDE6EF", background: "#FFFFFF", color: "#0F2942", cursor: "pointer", appearance: "none", WebkitAppearance: "none" }}
                                      >
                                        {HOCKEY_ROLES.map((r) => (
                                          <option key={r.value} value={r.value}>{r.label}</option>
                                        ))}
                                      </select>
                                      <ChevronDown size={10} style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "#8BA4BB" }} />
                                    </div>
                                    {/* Deactivate */}
                                    <button
                                      onClick={() => handleDeactivate(m.id)}
                                      style={{ padding: "4px 10px", fontSize: 10, fontWeight: 700, borderRadius: 6, border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.06)", color: "#EF4444", cursor: "pointer", fontFamily: "'Oswald', sans-serif", textTransform: "uppercase", letterSpacing: 1 }}
                                    >
                                      Deactivate
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                        {members.length === 0 && (
                          <tr>
                            <td colSpan={6} style={{ padding: 32, textAlign: "center", color: "#8BA4BB" }}>
                              No team members found
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* ── Seat Usage Bar ── */}
                <div style={{ background: "#FFFFFF", borderRadius: 12, border: "1px solid #DDE6EF", padding: 20, marginBottom: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#0F2942", fontFamily: "'Oswald', sans-serif", letterSpacing: 1, textTransform: "uppercase" }}>
                      Seat Usage
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: seatBarColor }}>
                      {seatsUsed} / {seatsLimit} seats used
                    </span>
                  </div>
                  <div style={{ width: "100%", height: 8, borderRadius: 4, background: "#DDE6EF" }}>
                    <div style={{ width: `${seatPct}%`, height: 8, borderRadius: 4, background: seatBarColor, transition: "width 0.3s ease" }} />
                  </div>
                </div>

                {/* ── Invite Team Member ── */}
                <div style={{ background: "#FFFFFF", borderRadius: 12, border: "1px solid #DDE6EF", overflow: "hidden", marginBottom: 20 }}>
                  <div style={{ padding: "16px 20px", borderBottom: "1px solid #DDE6EF", display: "flex", alignItems: "center", gap: 8 }}>
                    <UserPlus size={18} style={{ color: "#0D9488" }} />
                    <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0F2942", fontFamily: "'Oswald', sans-serif", letterSpacing: 1, textTransform: "uppercase", margin: 0 }}>
                      Invite Team Member
                    </h2>
                  </div>
                  <div style={{ padding: 20 }}>
                    <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
                      {/* Email */}
                      <div style={{ flex: 1, minWidth: 220 }}>
                        <label style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: 2, color: "#8BA4BB", fontFamily: "'Oswald', sans-serif", textTransform: "uppercase", marginBottom: 6 }}>
                          Email Address
                        </label>
                        <div style={{ position: "relative" }}>
                          <Mail size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#8BA4BB" }} />
                          <input
                            type="email"
                            value={inviteEmail}
                            onChange={(e) => setInviteEmail(e.target.value)}
                            placeholder="colleague@team.com"
                            style={{ width: "100%", padding: "10px 12px 10px 32px", fontSize: 13, borderRadius: 8, border: "1px solid #DDE6EF", background: "#F8FAFC", color: "#0F2942", outline: "none" }}
                            onKeyDown={(e) => { if (e.key === "Enter") handleInvite(); }}
                          />
                        </div>
                      </div>
                      {/* Role */}
                      <div style={{ minWidth: 160 }}>
                        <label style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: 2, color: "#8BA4BB", fontFamily: "'Oswald', sans-serif", textTransform: "uppercase", marginBottom: 6 }}>
                          Hockey Role
                        </label>
                        <div style={{ position: "relative" }}>
                          <select
                            value={inviteRole}
                            onChange={(e) => setInviteRole(e.target.value)}
                            style={{ width: "100%", padding: "10px 28px 10px 12px", fontSize: 13, borderRadius: 8, border: "1px solid #DDE6EF", background: "#F8FAFC", color: "#0F2942", cursor: "pointer", appearance: "none", WebkitAppearance: "none" }}
                          >
                            {HOCKEY_ROLES.map((r) => (
                              <option key={r.value} value={r.value}>{r.label}</option>
                            ))}
                          </select>
                          <ChevronDown size={12} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "#8BA4BB" }} />
                        </div>
                      </div>
                      {/* Send button */}
                      <button
                        onClick={handleInvite}
                        disabled={inviting || !inviteEmail.trim()}
                        style={{
                          display: "flex", alignItems: "center", gap: 6, padding: "10px 20px", fontSize: 11, fontWeight: 700, letterSpacing: 2,
                          borderRadius: 8, border: "none", background: "#0D9488", color: "#FFFFFF", cursor: inviting || !inviteEmail.trim() ? "not-allowed" : "pointer",
                          opacity: inviting || !inviteEmail.trim() ? 0.5 : 1, fontFamily: "'Oswald', sans-serif", textTransform: "uppercase", transition: "opacity 0.15s",
                        }}
                      >
                        {inviting ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <UserPlus size={13} />}
                        Send Invite
                      </button>
                    </div>

                    {/* Success / Error messages */}
                    {inviteSuccess && (
                      <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 8, background: "rgba(13,148,136,0.06)", border: "1px solid rgba(13,148,136,0.2)" }}>
                        <CheckCircle size={14} style={{ color: "#0D9488" }} />
                        <span style={{ fontSize: 12, color: "#0D9488", fontWeight: 600 }}>{inviteSuccess}</span>
                        <button onClick={() => setInviteSuccess("")} style={{ marginLeft: "auto", border: "none", background: "none", cursor: "pointer", color: "#0D9488" }}><X size={12} /></button>
                      </div>
                    )}
                    {inviteError && (
                      <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 8, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)" }}>
                        <AlertTriangle size={14} style={{ color: "#EF4444" }} />
                        <span style={{ fontSize: 12, color: "#EF4444", fontWeight: 600 }}>{inviteError}</span>
                        <button onClick={() => setInviteError("")} style={{ marginLeft: "auto", border: "none", background: "none", cursor: "pointer", color: "#EF4444" }}><X size={12} /></button>
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Pending Invites ── */}
                {invites.length > 0 && (
                  <div style={{ background: "#FFFFFF", borderRadius: 12, border: "1px solid #DDE6EF", overflow: "hidden" }}>
                    <div style={{ padding: "16px 20px", borderBottom: "1px solid #DDE6EF", display: "flex", alignItems: "center", gap: 8 }}>
                      <Mail size={18} style={{ color: "#E67E22" }} />
                      <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0F2942", fontFamily: "'Oswald', sans-serif", letterSpacing: 1, textTransform: "uppercase", margin: 0 }}>
                        Pending Invites
                      </h2>
                      <span style={{ fontSize: 11, color: "#8BA4BB", marginLeft: 4 }}>({invites.length})</span>
                    </div>

                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: "#F8FAFC" }}>
                          {["EMAIL", "ROLE", "SENT", "ACTIONS"].map((h) => (
                            <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 9, fontWeight: 700, letterSpacing: 2, color: "#8BA4BB", fontFamily: "'Oswald', sans-serif", textTransform: "uppercase", borderBottom: "1px solid #DDE6EF" }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {invites.map((inv) => {
                          const roleBadge = ROLE_BADGE_COLORS[inv.hockey_role] || ROLE_BADGE_COLORS.scout;
                          return (
                            <tr key={inv.id} style={{ borderBottom: "1px solid #F0F4F8" }}>
                              <td style={{ padding: "12px 16px", color: "#5A7A95" }}>{inv.email}</td>
                              <td style={{ padding: "12px 16px" }}>
                                <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 20, fontSize: 10, fontWeight: 700, letterSpacing: 1, fontFamily: "'Oswald', sans-serif", textTransform: "uppercase", background: roleBadge.bg, color: roleBadge.text }}>
                                  {inv.hockey_role}
                                </span>
                              </td>
                              <td style={{ padding: "12px 16px", color: "#8BA4BB", fontSize: 12 }}>{fmtDate(inv.created_at)}</td>
                              <td style={{ padding: "12px 16px" }}>
                                <button
                                  onClick={() => handleRevokeInvite(inv.id)}
                                  style={{ padding: "4px 10px", fontSize: 10, fontWeight: 700, borderRadius: 6, border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.06)", color: "#EF4444", cursor: "pointer", fontFamily: "'Oswald', sans-serif", textTransform: "uppercase", letterSpacing: 1 }}
                                >
                                  Revoke
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ════════════ BILLING TAB ════════════ */}
        {activeTab === "billing" && (
          <div>
            {/* ── Current Plan Card ── */}
            <div style={{ background: "#FFFFFF", borderRadius: 12, border: "1px solid #DDE6EF", overflow: "hidden", marginBottom: 20 }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid #DDE6EF", display: "flex", alignItems: "center", gap: 8 }}>
                <CreditCard size={18} style={{ color: "#0D9488" }} />
                <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0F2942", fontFamily: "'Oswald', sans-serif", letterSpacing: 1, textTransform: "uppercase", margin: 0 }}>
                  Current Plan
                </h2>
              </div>
              <div style={{ padding: 24 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 16 }}>
                  <span style={{ fontSize: 32, fontWeight: 700, color: "#0F2942", fontFamily: "'Oswald', sans-serif", textTransform: "uppercase", letterSpacing: 1 }}>
                    {usage?.tier || user?.subscription_tier || "Rookie"}
                  </span>
                  <span style={{ fontSize: 18, fontWeight: 600, color: "#0D9488" }}>
                    {(() => {
                      const tier = (usage?.tier || user?.subscription_tier || "rookie").toLowerCase();
                      if (tier === "rookie") return "Free";
                      if (tier === "novice") return "$25/mo";
                      if (tier === "pro") return "$49.99/mo";
                      if (tier === "team") return "$299.99/mo";
                      if (tier === "aaa_org") return "$499/mo";
                      return "";
                    })()}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 24, flexWrap: "wrap", fontSize: 13, color: "#5A7A95" }}>
                  <span><strong style={{ color: "#0F2942" }}>{usage?.seats_limit ?? "—"}</strong> seats included</span>
                  <span><strong style={{ color: "#0F2942" }}>{usage?.reports_limit === -1 ? "Unlimited" : (usage?.reports_limit ?? "—")}</strong> reports/month</span>
                  <span>Next billing: <strong style={{ color: "#0F2942" }}>—</strong></span>
                </div>
              </div>
            </div>

            {/* ── Usage Meters ── */}
            <div style={{ background: "#FFFFFF", borderRadius: 12, border: "1px solid #DDE6EF", overflow: "hidden", marginBottom: 20 }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid #DDE6EF" }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0F2942", fontFamily: "'Oswald', sans-serif", letterSpacing: 1, textTransform: "uppercase", margin: 0 }}>
                  Current Month Usage
                </h2>
              </div>
              <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
                {/* Reports meter */}
                {(() => {
                  const used = usage?.reports_used ?? 0;
                  const limit = usage?.reports_limit ?? 0;
                  const isUnlimited = limit === -1;
                  const pct = isUnlimited ? 15 : (limit > 0 ? Math.min((used / limit) * 100, 100) : 0);
                  return (
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#0F2942", fontFamily: "'Oswald', sans-serif", letterSpacing: 1, textTransform: "uppercase" }}>Reports</span>
                        <span style={{ fontSize: 12, color: "#5A7A95" }}>{used} of {isUnlimited ? "Unlimited" : limit} used</span>
                      </div>
                      <div style={{ width: "100%", height: 8, borderRadius: 4, background: "#DDE6EF" }}>
                        <div style={{ width: `${pct}%`, height: 8, borderRadius: 4, background: "#0D9488", transition: "width 0.3s ease" }} />
                      </div>
                    </div>
                  );
                })()}

                {/* Bench Talk meter */}
                {(() => {
                  const used = usage?.bench_talks_used ?? 0;
                  const limit = usage?.bench_talks_limit ?? 0;
                  const isUnlimited = limit === -1;
                  const pct = isUnlimited ? 15 : (limit > 0 ? Math.min((used / limit) * 100, 100) : 0);
                  return (
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#0F2942", fontFamily: "'Oswald', sans-serif", letterSpacing: 1, textTransform: "uppercase" }}>PXI / Bench Talk</span>
                        <span style={{ fontSize: 12, color: "#5A7A95" }}>{used} of {isUnlimited ? "Unlimited" : limit} used</span>
                      </div>
                      <div style={{ width: "100%", height: 8, borderRadius: 4, background: "#DDE6EF" }}>
                        <div style={{ width: `${pct}%`, height: 8, borderRadius: 4, background: "#0D9488", transition: "width 0.3s ease" }} />
                      </div>
                    </div>
                  );
                })()}

                {/* Seats meter */}
                {(() => {
                  const used = usage?.seats_used ?? members.length;
                  const limit = usage?.seats_limit ?? 5;
                  const pct = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
                  const barColor = pct > 95 ? "#EF4444" : pct > 80 ? "#F59E0B" : "#0D9488";
                  return (
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#0F2942", fontFamily: "'Oswald', sans-serif", letterSpacing: 1, textTransform: "uppercase" }}>Seats</span>
                        <span style={{ fontSize: 12, color: "#5A7A95" }}>{used} of {limit} used</span>
                      </div>
                      <div style={{ width: "100%", height: 8, borderRadius: 4, background: "#DDE6EF" }}>
                        <div style={{ width: `${pct}%`, height: 8, borderRadius: 4, background: barColor, transition: "width 0.3s ease" }} />
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* ── Action Buttons ── */}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {/* Manage Billing — disabled placeholder */}
              <div style={{ position: "relative" }}>
                <button
                  disabled
                  style={{
                    display: "flex", alignItems: "center", gap: 8, padding: "12px 24px", fontSize: 12, fontWeight: 700, letterSpacing: 2,
                    borderRadius: 8, border: "1px solid #DDE6EF", background: "#F8FAFC", color: "#8BA4BB", cursor: "not-allowed",
                    fontFamily: "'Oswald', sans-serif", textTransform: "uppercase",
                  }}
                  title="Coming soon — Stripe billing portal will be available here"
                >
                  <CreditCard size={14} />
                  Manage Billing
                  <Info size={12} style={{ marginLeft: 4, opacity: 0.5 }} />
                </button>
              </div>
              {/* Upgrade Plan */}
              <Link
                href="/pricing"
                style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "12px 24px", fontSize: 12, fontWeight: 700, letterSpacing: 2,
                  borderRadius: 8, border: "none", background: "#0D9488", color: "#FFFFFF", textDecoration: "none",
                  fontFamily: "'Oswald', sans-serif", textTransform: "uppercase",
                }}
              >
                <ExternalLink size={14} />
                Upgrade Plan
              </Link>
            </div>
          </div>
        )}

        {/* ════════════ ORG TAB ════════════ */}
        {activeTab === "org" && (
          <div>
            {/* ── Org Settings Card ── */}
            <div style={{ background: "#FFFFFF", borderRadius: 12, border: "1px solid #DDE6EF", overflow: "hidden", marginBottom: 20 }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid #DDE6EF", display: "flex", alignItems: "center", gap: 8 }}>
                <Building2 size={18} style={{ color: "#0D9488" }} />
                <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0F2942", fontFamily: "'Oswald', sans-serif", letterSpacing: 1, textTransform: "uppercase", margin: 0 }}>
                  Organization Settings
                </h2>
              </div>
              <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
                {/* Org Name */}
                <div>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: 2, color: "#8BA4BB", fontFamily: "'Oswald', sans-serif", textTransform: "uppercase", marginBottom: 6 }}>
                    Organization Name
                  </label>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <input
                      type="text"
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      placeholder="e.g. Chatham Maroons"
                      style={{ flex: 1, maxWidth: 400, padding: "10px 12px", fontSize: 13, borderRadius: 8, border: "1px solid #DDE6EF", background: "#F8FAFC", color: "#0F2942", outline: "none" }}
                    />
                  </div>
                </div>

                {/* Default League */}
                <div>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: 2, color: "#8BA4BB", fontFamily: "'Oswald', sans-serif", textTransform: "uppercase", marginBottom: 6 }}>
                    Default League
                  </label>
                  <div style={{ position: "relative", maxWidth: 400 }}>
                    <select
                      value={orgLeague}
                      onChange={(e) => setOrgLeague(e.target.value)}
                      style={{ width: "100%", padding: "10px 28px 10px 12px", fontSize: 13, borderRadius: 8, border: "1px solid #DDE6EF", background: "#F8FAFC", color: "#0F2942", cursor: "pointer", appearance: "none", WebkitAppearance: "none" }}
                    >
                      <option value="">Select a league...</option>
                      <optgroup label="Professional">
                        {LEAGUE_OPTIONS.filter((_, i) => i < 4).map((opt) => (
                          <option key={opt.code} value={opt.code}>{opt.label} — {opt.full}</option>
                        ))}
                      </optgroup>
                      <optgroup label="Major Junior (CHL)">
                        {LEAGUE_OPTIONS.filter((_, i) => i >= 4 && i < 7).map((opt) => (
                          <option key={opt.code} value={opt.code}>{opt.label} — {opt.full}</option>
                        ))}
                      </optgroup>
                      <optgroup label="Junior A">
                        {LEAGUE_OPTIONS.filter((_, i) => i >= 7 && i < 17).map((opt) => (
                          <option key={opt.code} value={opt.code}>{opt.label} — {opt.full}</option>
                        ))}
                      </optgroup>
                      <optgroup label="Junior B">
                        {LEAGUE_OPTIONS.filter((_, i) => i >= 17).map((opt) => (
                          <option key={opt.code} value={opt.code}>{opt.label} — {opt.full}</option>
                        ))}
                      </optgroup>
                    </select>
                    <ChevronDown size={12} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "#8BA4BB" }} />
                  </div>
                </div>

                {/* Default Team */}
                <div>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: 2, color: "#8BA4BB", fontFamily: "'Oswald', sans-serif", textTransform: "uppercase", marginBottom: 6 }}>
                    Default Team
                  </label>
                  <input
                    type="text"
                    value={orgTeam}
                    onChange={(e) => setOrgTeam(e.target.value)}
                    placeholder="e.g. Chatham Maroons"
                    style={{ maxWidth: 400, width: "100%", padding: "10px 12px", fontSize: 13, borderRadius: 8, border: "1px solid #DDE6EF", background: "#F8FAFC", color: "#0F2942", outline: "none" }}
                  />
                </div>

                {/* Logo Upload — disabled placeholder */}
                <div>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: 2, color: "#8BA4BB", fontFamily: "'Oswald', sans-serif", textTransform: "uppercase", marginBottom: 6 }}>
                    Organization Logo
                  </label>
                  <button
                    disabled
                    style={{
                      display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", fontSize: 11, fontWeight: 700, letterSpacing: 1,
                      borderRadius: 8, border: "1.5px dashed #DDE6EF", background: "#F8FAFC", color: "#8BA4BB", cursor: "not-allowed",
                      fontFamily: "'Oswald', sans-serif", textTransform: "uppercase",
                    }}
                    title="Coming soon — R2 storage not yet built"
                  >
                    <Upload size={14} />
                    Upload Logo
                    <Info size={12} style={{ marginLeft: 4, opacity: 0.5 }} />
                  </button>
                  <p style={{ fontSize: 10, color: "#8BA4BB", marginTop: 6, fontStyle: "italic" }}>
                    Logo upload coming soon — R2 storage not yet built
                  </p>
                </div>

                {/* Save button */}
                <div style={{ paddingTop: 8, borderTop: "1px solid #DDE6EF" }}>
                  <button
                    onClick={handleOrgSave}
                    disabled={orgSaving}
                    style={{
                      display: "flex", alignItems: "center", gap: 8, padding: "12px 24px", fontSize: 12, fontWeight: 700, letterSpacing: 2,
                      borderRadius: 8, border: "none", background: "#0D9488", color: "#FFFFFF", cursor: orgSaving ? "not-allowed" : "pointer",
                      opacity: orgSaving ? 0.5 : 1, fontFamily: "'Oswald', sans-serif", textTransform: "uppercase", transition: "opacity 0.15s",
                    }}
                  >
                    {orgSaving ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Save size={14} />}
                    Save Settings
                  </button>

                  {orgSuccess && (
                    <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 8, background: "rgba(13,148,136,0.06)", border: "1px solid rgba(13,148,136,0.2)" }}>
                      <CheckCircle size={14} style={{ color: "#0D9488" }} />
                      <span style={{ fontSize: 12, color: "#0D9488", fontWeight: 600 }}>{orgSuccess}</span>
                      <button onClick={() => setOrgSuccess("")} style={{ marginLeft: "auto", border: "none", background: "none", cursor: "pointer", color: "#0D9488" }}><X size={12} /></button>
                    </div>
                  )}
                  {orgError && (
                    <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 8, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)" }}>
                      <AlertTriangle size={14} style={{ color: "#EF4444" }} />
                      <span style={{ fontSize: 12, color: "#EF4444", fontWeight: 600 }}>{orgError}</span>
                      <button onClick={() => setOrgError("")} style={{ marginLeft: "auto", border: "none", background: "none", cursor: "pointer", color: "#EF4444" }}><X size={12} /></button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
