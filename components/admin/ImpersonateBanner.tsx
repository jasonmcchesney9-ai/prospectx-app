"use client";

import { useState, useEffect, useCallback } from "react";
import { UserCog, X, Clock } from "lucide-react";

export default function ImpersonateBanner() {
  const [active, setActive] = useState(false);
  const [email, setEmail] = useState("");
  const [remaining, setRemaining] = useState("");

  const endSession = useCallback(() => {
    sessionStorage.removeItem("impersonate_token");
    sessionStorage.removeItem("impersonate_email");
    sessionStorage.removeItem("impersonate_expires");
    setActive(false);
    // Redirect to superadmin page
    window.location.href = "/superadmin";
  }, []);

  useEffect(() => {
    // Check if we're in an impersonation session
    const token = sessionStorage.getItem("impersonate_token");
    const impEmail = sessionStorage.getItem("impersonate_email");
    const expiresStr = sessionStorage.getItem("impersonate_expires");

    if (!token || !impEmail || !expiresStr) {
      setActive(false);
      return;
    }

    const expires = parseInt(expiresStr, 10);
    if (isNaN(expires) || Date.now() >= expires) {
      endSession();
      return;
    }

    setActive(true);
    setEmail(impEmail);

    // Update countdown every second
    const interval = setInterval(() => {
      const now = Date.now();
      const expiresAt = parseInt(sessionStorage.getItem("impersonate_expires") || "0", 10);
      if (now >= expiresAt) {
        endSession();
        return;
      }
      const diff = Math.max(0, Math.ceil((expiresAt - now) / 1000));
      const mins = Math.floor(diff / 60);
      const secs = diff % 60;
      setRemaining(`${mins}:${secs.toString().padStart(2, "0")}`);
    }, 1000);

    return () => clearInterval(interval);
  }, [endSession]);

  if (!active) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-gradient-to-r from-orange to-teal text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <UserCog size={16} />
          <span className="text-sm font-semibold">
            Impersonating <span className="underline">{email}</span>
          </span>
          <span className="flex items-center gap-1 text-xs bg-white/20 px-2 py-0.5 rounded-full">
            <Clock size={10} />
            {remaining} remaining
          </span>
        </div>
        <button
          onClick={endSession}
          className="flex items-center gap-1 px-3 py-1 text-xs font-semibold bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
        >
          <X size={12} />
          End Session
        </button>
      </div>
    </div>
  );
}
