"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import api from "@/lib/api";
import { setToken, setUser, setRefreshToken } from "@/lib/auth";
import type { TokenResponse } from "@/types/api";

const SPIRIT_DEMO_ACCOUNTS = [
  { label: "Login as GM", email: "gm@saginawspirit.demo", role: "GM" },
  { label: "Login as Coach", email: "coach@saginawspirit.demo", role: "Coach" },
  { label: "Login as Scout", email: "scout@saginawspirit.demo", role: "Scout" },
];
const SPIRIT_DEMO_PASSWORD = "SpiritDemo2026!";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "register">(
    searchParams.get("mode") === "register" ? "register" : "login"
  );
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [hockeyRole, setHockeyRole] = useState("scout");

  // Spirit demo mode
  const isSpirit = searchParams.get("demo") === "spirit";

  // Invite detection
  const inviteParam = searchParams.get("invite");
  const [inviteToken, setInviteToken] = useState<string | null>(inviteParam);
  const [inviteData, setInviteData] = useState<{ org_name: string; email: string; hockey_role: string } | null>(null);
  const [inviteLoading, setInviteLoading] = useState(!!inviteParam);

  useEffect(() => {
    if (!inviteParam) return;
    setInviteLoading(true);
    setMode("register");
    api
      .get(`/org/invite/${inviteParam}/validate`)
      .then(({ data }) => {
        if (data.valid) {
          setInviteToken(inviteParam);
          setInviteData({ org_name: data.org_name, email: data.email, hockey_role: data.hockey_role });
          setEmail(data.email);
          setHockeyRole(data.hockey_role);
        } else {
          setError(data.reason || "This invite link is no longer valid.");
          setInviteToken(null);
        }
      })
      .catch(() => {
        setError("Could not validate invite link.");
        setInviteToken(null);
      })
      .finally(() => setInviteLoading(false));
  }, [inviteParam]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      let data: TokenResponse;
      if (inviteToken && mode === "register") {
        // Accept invite — join existing org
        const res = await api.post<TokenResponse>(`/org/invite/${inviteToken}/accept`, {
          email, password, first_name: firstName, last_name: lastName,
        });
        data = res.data;
      } else {
        const endpoint = mode === "login" ? "/auth/login" : "/auth/register";
        const body =
          mode === "login"
            ? { email, password }
            : { email, password, first_name: firstName, last_name: lastName, org_name: orgName, org_type: "team", hockey_role: hockeyRole };
        const res = await api.post<TokenResponse>(endpoint, body);
        data = res.data;
      }
      setToken(data.access_token);
      if (data.refresh_token) setRefreshToken(data.refresh_token);
      setUser(data.user);
      if (inviteToken) {
        router.push("/"); // Skip onboarding for invite joins
      } else if (mode === "register") {
        router.push("/onboarding");
      } else {
        router.push("/");
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "Something went wrong";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // ── Spirit Demo Login ─────────────────────────────────────────
  if (isSpirit) {
    return (
      <div className="min-h-screen flex" style={{ backgroundColor: "#003087" }}>
        {/* Left panel — Spirit branding */}
        <div className="hidden lg:flex flex-col items-center justify-center w-1/2 p-12">
          <img
            src="/logos/saginaw-spirit.png"
            alt="Saginaw Spirit"
            className="w-40 h-40 object-contain mb-8"
          />
          <h1 className="font-oswald text-4xl font-bold text-white tracking-wider uppercase text-center">
            Saginaw Spirit
          </h1>
          <p className="font-oswald text-sm tracking-widest uppercase mt-3 text-center" style={{ color: "#C8102E" }}>
            2024 Memorial Cup Champions
          </p>
          <p className="text-white/40 text-xs mt-6 font-oswald tracking-wider uppercase">
            Powered by <span className="text-teal">Prospect</span><span className="text-orange">X</span> + PXI
          </p>
        </div>

        {/* Right panel — Login form */}
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-md">
            {/* Mobile spirit logo */}
            <div className="lg:hidden text-center mb-6">
              <img src="/logos/saginaw-spirit.png" alt="Saginaw Spirit" className="w-20 h-20 object-contain mx-auto mb-3" />
              <h2 className="font-oswald text-xl font-bold text-white uppercase">Saginaw Spirit</h2>
              <p className="font-oswald text-[10px] tracking-widest uppercase mt-1" style={{ color: "#C8102E" }}>
                2024 Memorial Cup Champions
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-xl p-8">
              <h2 className="font-oswald text-xl font-semibold text-navy mb-2">Spirit Staff Login</h2>
              <p className="text-xs text-muted mb-6">Demo environment — select a role below or enter credentials</p>

              {/* Quick login buttons */}
              <div className="flex gap-2 mb-6">
                {SPIRIT_DEMO_ACCOUNTS.map((acct) => (
                  <button
                    key={acct.email}
                    type="button"
                    onClick={() => {
                      setEmail(acct.email);
                      setPassword(SPIRIT_DEMO_PASSWORD);
                    }}
                    className="flex-1 py-2 rounded-lg text-xs font-oswald uppercase tracking-wider font-semibold transition-colors"
                    style={{
                      backgroundColor: email === acct.email ? "#C8102E" : "#003087",
                      color: "#FFFFFF",
                    }}
                  >
                    {acct.role}
                  </button>
                ))}
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-oswald uppercase tracking-wider text-muted mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm"
                    placeholder="you@saginawspirit.demo"
                  />
                </div>
                <div>
                  <label className="block text-xs font-oswald uppercase tracking-wider text-muted mb-1">Password</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm"
                  />
                </div>

                {error && (
                  <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 text-white font-oswald font-semibold uppercase tracking-wider rounded-lg disabled:opacity-50 transition-colors text-sm"
                  style={{ backgroundColor: "#C8102E" }}
                >
                  {loading ? "Please wait..." : "Sign In"}
                </button>
              </form>

              <div className="mt-4 text-center">
                <a href="/login" className="text-xs text-muted hover:text-navy">
                  ← Back to standard login
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-navy flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <img src="/logos/prospectx-wordmark-transparent.png" alt="ProspectX Intelligence" className="h-12 object-contain mx-auto" />
          <p className="font-oswald text-xs tracking-widest text-white/30 uppercase mt-2">
            Decision-Grade Hockey Intelligence
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-xl shadow-xl p-8">
          <h2 className="font-oswald text-xl font-semibold text-navy mb-6">
            {inviteData ? "Join Organization" : mode === "login" ? "Sign In" : "Create Account"}
          </h2>

          {inviteLoading && (
            <div className="text-center py-4 text-sm text-muted">Validating invite...</div>
          )}

          {inviteData && (
            <div className="bg-teal/10 border border-teal/30 rounded-lg px-4 py-3 mb-4">
              <p className="text-sm text-navy font-semibold">
                You&apos;ve been invited to join <span className="text-teal">{inviteData.org_name}</span>
              </p>
              <p className="text-xs text-muted mt-0.5">
                Complete registration below to accept the invitation.
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "register" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-oswald uppercase tracking-wider text-muted mb-1">
                      First Name
                    </label>
                    <input
                      type="text"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full px-3 py-2 border border-teal/20 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-oswald uppercase tracking-wider text-muted mb-1">
                      Last Name
                    </label>
                    <input
                      type="text"
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full px-3 py-2 border border-teal/20 rounded-lg text-sm"
                    />
                  </div>
                </div>
                {!inviteData && (
                  <div>
                    <label className="block text-xs font-oswald uppercase tracking-wider text-muted mb-1">
                      Organization Name
                    </label>
                    <input
                      type="text"
                      required
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      placeholder="e.g., Chatham Maroons"
                      className="w-full px-3 py-2 border border-teal/20 rounded-lg text-sm"
                    />
                  </div>
                )}
                {!inviteData && (
                  <div>
                    <label className="block text-xs font-oswald uppercase tracking-wider text-muted mb-1">
                      Your Role in Hockey
                    </label>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {[
                        { value: "scout", label: "Scout", icon: "🔍" },
                        { value: "gm", label: "GM", icon: "📋" },
                        { value: "coach", label: "Coach", icon: "📣" },
                        { value: "player", label: "Player", icon: "🏒" },
                        { value: "parent", label: "Parent", icon: "👨‍👩‍👦" },
                      ].map((r) => (
                        <button
                          key={r.value}
                          type="button"
                          onClick={() => setHockeyRole(r.value)}
                          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                            hockeyRole === r.value
                              ? "border-teal bg-teal/10 text-teal ring-1 ring-teal/30"
                              : "border-teal/20 text-muted hover:border-teal/40 hover:text-navy"
                          }`}
                        >
                          <span>{r.icon}</span>
                          <span className="font-oswald text-xs uppercase tracking-wider">{r.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            <div>
              <label className="block text-xs font-oswald uppercase tracking-wider text-muted mb-1">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                readOnly={!!inviteData}
                className={`w-full px-3 py-2 border border-teal/20 rounded-lg text-sm ${inviteData ? "bg-gray-50 text-muted cursor-not-allowed" : ""}`}
                placeholder="you@team.com"
              />
            </div>

            <div>
              <label className="block text-xs font-oswald uppercase tracking-wider text-muted mb-1">
                Password
              </label>
              <input
                type="password"
                required
                minLength={mode === "register" ? 8 : 6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-teal/20 rounded-lg text-sm"
              />
              {mode === "login" && (
                <div className="mt-1 text-right">
                  <a href="/forgot-password" className="text-xs text-teal hover:underline">
                    Forgot Password?
                  </a>
                </div>
              )}
            </div>

            {error && (
              <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-teal text-white font-oswald font-semibold uppercase tracking-wider rounded-lg hover:bg-teal/90 disabled:opacity-50 transition-colors text-sm"
            >
              {loading
                ? "Please wait..."
                : inviteData
                  ? "Join Organization"
                  : mode === "login"
                    ? "Sign In"
                    : "Create Account"}
            </button>
          </form>

          {!inviteData && (
          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setMode(mode === "login" ? "register" : "login");
                setError("");
              }}
              className="text-sm text-teal hover:underline"
            >
              {mode === "login"
                ? "Need an account? Register"
                : "Already have an account? Sign In"}
            </button>
          </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-navy flex items-center justify-center p-4">
          <div className="text-white/50 text-sm">Loading...</div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
