"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";
import { extractApiError } from "@/lib/api";

function VerifyEmailForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setErrorMsg("No verification token provided.");
      return;
    }

    api
      .post("/auth/verify-email", { token })
      .then(() => setStatus("success"))
      .catch((err: unknown) => {
        setStatus("error");
        setErrorMsg(extractApiError(err, "Verification failed. The link may have expired."));
      });
  }, [token]);

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
        <div className="bg-white rounded-xl shadow-xl p-8 text-center">
          {status === "verifying" && (
            <>
              <h2 className="font-oswald text-xl font-semibold text-navy mb-4">Verifying Email...</h2>
              <p className="text-sm text-muted">Please wait while we verify your email address.</p>
            </>
          )}

          {status === "success" && (
            <>
              <h2 className="font-oswald text-xl font-semibold text-navy mb-4">Email Verified</h2>
              <p className="text-sm text-muted mb-6">
                Your email has been verified successfully. You now have full access to ProspectX.
              </p>
              <Link
                href="/login"
                className="inline-block px-6 py-2.5 bg-teal text-white font-oswald font-semibold uppercase tracking-wider rounded-lg hover:bg-teal/90 transition-colors text-sm"
              >
                Sign In
              </Link>
            </>
          )}

          {status === "error" && (
            <>
              <h2 className="font-oswald text-xl font-semibold text-navy mb-4">Verification Failed</h2>
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg mb-6">{errorMsg}</p>
              <Link
                href="/login"
                className="inline-block px-6 py-2.5 bg-teal text-white font-oswald font-semibold uppercase tracking-wider rounded-lg hover:bg-teal/90 transition-colors text-sm"
              >
                Back to Sign In
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-navy flex items-center justify-center p-4">
          <div className="text-white/50 text-sm">Loading...</div>
        </div>
      }
    >
      <VerifyEmailForm />
    </Suspense>
  );
}
