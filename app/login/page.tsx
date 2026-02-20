"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import api from "@/lib/api";
import { setToken, setUser } from "@/lib/auth";
import type { TokenResponse } from "@/types/api";

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const endpoint = mode === "login" ? "/auth/login" : "/auth/register";
      const body =
        mode === "login"
          ? { email, password }
          : { email, password, first_name: firstName, last_name: lastName, org_name: orgName, org_type: "team", hockey_role: hockeyRole };

      const { data } = await api.post<TokenResponse>(endpoint, body);
      setToken(data.access_token);
      setUser(data.user);
      router.push("/");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "Something went wrong";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-navy flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="font-oswald text-3xl font-bold tracking-widest uppercase">
            <span className="text-teal">Prospect</span><span className="text-orange">X</span>
          </h1>
          <p className="font-oswald text-xs tracking-widest text-white/30 uppercase mt-1">
            Decision-Grade Hockey Intelligence
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-xl shadow-xl p-8">
          <h2 className="font-oswald text-xl font-semibold text-navy mb-6">
            {mode === "login" ? "Sign In" : "Create Account"}
          </h2>

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
                className="w-full px-3 py-2 border border-teal/20 rounded-lg text-sm"
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
                : mode === "login"
                  ? "Sign In"
                  : "Create Account"}
            </button>
          </form>

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
