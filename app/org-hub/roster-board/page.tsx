"use client";

import Link from "next/link";
import { ArrowLeft, Users } from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";

export default function RosterBoardPage() {
  return (
    <ProtectedRoute>
      <NavBar />
      <main className="min-h-screen" style={{ background: "#F0F4F8" }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

          {/* Header */}
          <div
            className="flex items-center justify-between mb-6"
            style={{ borderRadius: 12, border: "1.5px solid #DDE6EF", background: "#0F2942", padding: "16px 20px" }}
          >
            <div className="flex items-center gap-3">
              <Link href="/org-hub" className="hover:opacity-70 transition-opacity" style={{ color: "rgba(255,255,255,0.6)" }}>
                <ArrowLeft size={20} />
              </Link>
              <span className="w-2 h-2 rounded-full" style={{ background: "#14B8A6" }} />
              <Users size={16} className="text-white/80" />
              <h1
                className="font-bold uppercase text-white"
                style={{ fontSize: 14, fontFamily: "ui-monospace, monospace", letterSpacing: 2 }}
              >
                Roster Board
              </h1>
            </div>
            <span
              className="px-2.5 py-1 rounded-md text-white/60 font-bold uppercase"
              style={{ fontSize: 9, fontFamily: "ui-monospace, monospace", letterSpacing: 1, background: "rgba(255,255,255,0.1)" }}
            >
              Coming Soon
            </span>
          </div>

          {/* Content */}
          <div
            className="overflow-hidden"
            style={{ borderRadius: 12, border: "1.5px solid #DDE6EF", borderLeft: "3px solid #0D9488" }}
          >
            <div className="flex items-center gap-2 px-5 py-3" style={{ background: "#0F2942" }}>
              <span className="w-2 h-2 rounded-full" style={{ background: "#14B8A6" }} />
              <span
                className="font-bold uppercase text-white"
                style={{ fontSize: 10, fontFamily: "ui-monospace, monospace", letterSpacing: 2 }}
              >
                Visual Depth Chart
              </span>
            </div>
            <div className="bg-white px-5 py-12 text-center">
              <Users size={36} style={{ color: "#DDE6EF" }} className="mx-auto mb-4" />
              <p className="text-sm font-medium" style={{ color: "#0F2942" }}>
                Roster Board is under development.
              </p>
              <p className="text-xs mt-1" style={{ color: "#8BA4BB" }}>
                Visual depth chart with line combinations, system-fit scores, and trade values.
              </p>
              <Link
                href="/org-hub"
                className="inline-flex items-center gap-1.5 mt-6 px-4 py-2 rounded-lg text-xs font-bold uppercase transition-colors hover:opacity-90"
                style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 1, color: "#FFFFFF", background: "#0D9488" }}
              >
                <ArrowLeft size={11} />
                Back to Org Hub
              </Link>
            </div>
          </div>

        </div>
      </main>
    </ProtectedRoute>
  );
}
