"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";
import { extractApiError } from "@/lib/api";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      await api.post("/auth/reset-password", { token, new_password: password });
      setSuccess(true);
    } catch (err: unknown) {
      setError(extractApiError(err, "Failed to reset password. The link may have expired."));
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-navy flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-xl shadow-xl p-8 text-center">
            <h2 className="font-oswald text-xl font-semibold text-navy mb-4">Invalid Reset Link</h2>
            <p className="text-sm text-muted mb-6">
              This password reset link is invalid or missing. Please request a new one.
            </p>
            <Link
              href="/forgot-password"
              className="inline-block px-6 py-2.5 bg-teal text-white font-oswald font-semibold uppercase tracking-wider rounded-lg hover:bg-teal/90 transition-colors text-sm"
            >
              Request New Link
            </Link>
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
          {success ? (
            <>
              <h2 className="font-oswald text-xl font-semibold text-navy mb-4">Password Reset</h2>
              <p className="text-sm text-muted mb-6">
                Your password has been reset successfully. You can now sign in with your new password.
              </p>
              <Link
                href="/login"
                className="block w-full py-2.5 bg-teal text-white font-oswald font-semibold uppercase tracking-wider rounded-lg hover:bg-teal/90 transition-colors text-sm text-center"
              >
                Sign In
              </Link>
            </>
          ) : (
            <>
              <h2 className="font-oswald text-xl font-semibold text-navy mb-2">Reset Password</h2>
              <p className="text-sm text-muted mb-6">
                Enter your new password below.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-oswald uppercase tracking-wider text-muted mb-1">
                    New Password
                  </label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-teal/20 rounded-lg text-sm"
                    placeholder="Minimum 8 characters"
                  />
                </div>

                <div>
                  <label className="block text-xs font-oswald uppercase tracking-wider text-muted mb-1">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-teal/20 rounded-lg text-sm"
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
                  {loading ? "Resetting..." : "Reset Password"}
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

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-navy flex items-center justify-center p-4">
          <div className="text-white/50 text-sm">Loading...</div>
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
