"use client";

import { useState } from "react";
import Link from "next/link";
import api from "@/lib/api";
import { extractApiError } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email });
      setSent(true);
    } catch (err: unknown) {
      setError(extractApiError(err, "Failed to send reset email. Please try again."));
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
            <span className="text-teal">Prospect</span>
            <span className="text-orange">X</span>
          </h1>
          <p className="font-oswald text-xs tracking-widest text-white/30 uppercase mt-1">
            Decision-Grade Hockey Intelligence
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-xl shadow-xl p-8">
          {sent ? (
            <>
              <h2 className="font-oswald text-xl font-semibold text-navy mb-4">Check Your Email</h2>
              <p className="text-sm text-muted mb-6">
                If an account exists for <span className="font-semibold text-navy">{email}</span>,
                we&apos;ve sent a password reset link. Check your inbox and spam folder.
              </p>
              <Link
                href="/login"
                className="block w-full py-2.5 bg-teal text-white font-oswald font-semibold uppercase tracking-wider rounded-lg hover:bg-teal/90 transition-colors text-sm text-center"
              >
                Back to Sign In
              </Link>
            </>
          ) : (
            <>
              <h2 className="font-oswald text-xl font-semibold text-navy mb-2">Forgot Password?</h2>
              <p className="text-sm text-muted mb-6">
                Enter your email address and we&apos;ll send you a link to reset your password.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
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

                {error && (
                  <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-teal text-white font-oswald font-semibold uppercase tracking-wider rounded-lg hover:bg-teal/90 disabled:opacity-50 transition-colors text-sm"
                >
                  {loading ? "Sending..." : "Send Reset Link"}
                </button>
              </form>

              <div className="mt-6 text-center">
                <Link href="/login" className="text-sm text-teal hover:underline">
                  Back to Sign In
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
