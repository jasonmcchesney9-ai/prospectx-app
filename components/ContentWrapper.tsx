"use client";

import { useEffect, useState, useCallback } from "react";
import { useBenchTalk } from "./BenchTalkProvider";
import { getUser, isAuthenticated } from "@/lib/auth";
import api from "@/lib/api";

/**
 * Wraps all page content. When Bench Talk drawer is open on desktop,
 * shifts everything left so the page isn't hidden behind the panel.
 */
export default function ContentWrapper({ children }: { children: React.ReactNode }) {
  const { isOpen } = useBenchTalk();
  const [isDesktop, setIsDesktop] = useState(false);
  const [showVerifyBanner, setShowVerifyBanner] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (!isAuthenticated()) return;
    const user = getUser();
    if (user && user.email_verified === false) {
      setShowVerifyBanner(true);
    }
  }, []);

  const handleResend = useCallback(async () => {
    setResending(true);
    try {
      await api.post("/auth/send-verification");
      setResent(true);
    } catch {
      // Silent fail — banner stays visible
    } finally {
      setResending(false);
    }
  }, []);

  return (
    <div
      className="transition-[margin] duration-300 ease-in-out min-h-screen"
      style={{ marginRight: isOpen && isDesktop ? "480px" : "0" }}
    >
      {showVerifyBanner && (
        <div className="bg-orange/10 border-b border-orange/30 px-4 py-2.5 flex items-center justify-center gap-3 text-sm">
          <span className="text-navy font-medium">
            Please verify your email to access all features.
          </span>
          {resent ? (
            <span className="text-teal font-medium text-xs">Verification email sent!</span>
          ) : (
            <button
              onClick={handleResend}
              disabled={resending}
              className="text-xs font-oswald uppercase tracking-wider font-semibold text-teal hover:underline disabled:opacity-50"
            >
              {resending ? "Sending..." : "Resend Verification Email"}
            </button>
          )}
        </div>
      )}
      {children}
      <footer style={{ textAlign: "center", padding: "8px 0", color: "#94A3B8", fontSize: 11, fontFamily: "'Source Serif 4', serif" }}>
        © 2026 ProspectX Intelligence. All rights reserved.
      </footer>
    </div>
  );
}
