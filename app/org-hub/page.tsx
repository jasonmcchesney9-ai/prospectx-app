"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Users,
  ArrowLeftRight,
  Trophy,
  BookOpen,
  TrendingUp,
  Eye,
  Film,
  PenTool,
  Upload,
  FileText,
  RefreshCw,
  Loader2,
  Sparkles,
} from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import { getUser } from "@/lib/auth";
import api from "@/lib/api";

/* ── Panel Card Data ────────────────────────────────────────── */
interface PanelCard {
  title: string;
  description: string;
  icon: React.ElementType;
  href: string;
  accent: string; // teal | orange | navy
}

const PANELS: PanelCard[] = [
  {
    title: "Roster Board",
    description: "Visual depth chart with line combinations, system-fit scores, and trade values",
    icon: Users,
    href: "/org-hub/roster-board",
    accent: "teal",
  },
  {
    title: "Trade Board",
    description: "Track available players, targets, and trade priorities with real-time market comps",
    icon: ArrowLeftRight,
    href: "/org-hub/trade-board",
    accent: "orange",
  },
  {
    title: "Draft Board",
    description: "Ranked prospect list with PXI scouting grades and system-fit analysis",
    icon: Trophy,
    href: "/org-hub/draft-board",
    accent: "teal",
  },
  {
    title: "System Playbook",
    description: "Team tactical identity — forecheck, breakout, PP, PK diagrams saved and shareable",
    icon: BookOpen,
    href: "/org-hub/playbook",
    accent: "navy",
  },
  {
    title: "Development Dashboard",
    description: "Player development tracking across the entire roster with traffic light indicators",
    icon: TrendingUp,
    href: "/org-hub/development",
    accent: "teal",
  },
  {
    title: "Scouting Pipeline",
    description: "Scout assignments, upcoming games, reports submitted and pending, workload balancing",
    icon: Eye,
    href: "/org-hub/scouting",
    accent: "orange",
  },
  {
    title: "Film Library",
    description: "All film sessions organized by game, opponent, and date — quick access to any footage",
    icon: Film,
    href: "/org-hub/film-library",
    accent: "teal",
  },
  {
    title: "Whiteboard",
    description: "Shared tactical boards for meetings, planning, and between-period adjustments",
    icon: PenTool,
    href: "/org-hub/whiteboard",
    accent: "navy",
  },
];

const ACCENT_COLORS: Record<string, { border: string; dot: string }> = {
  teal:   { border: "#0D9488", dot: "#14B8A6" },
  orange: { border: "#EA580C", dot: "#F97316" },
  navy:   { border: "#0F2942", dot: "#5A7291" },
};

/* ── Page Component ─────────────────────────────────────────── */
export default function OrgHubPage() {
  const user = getUser();
  const orgName = user?.org_short_name || user?.org_name || "Your Organization";
  const [syncing, setSyncing] = useState(false);

  return (
    <ProtectedRoute>
      <NavBar />
      <main className="min-h-screen" style={{ background: "#F0F4F8" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

          {/* ── Page Header ─────────────────────────────────── */}
          <div
            className="flex items-center justify-between mb-6"
            style={{ borderRadius: 12, border: "1.5px solid #DDE6EF", background: "#0F2942", padding: "16px 20px" }}
          >
            <div className="flex items-center gap-3">
              <span
                className="px-2.5 py-1 rounded-md text-white font-bold uppercase"
                style={{ fontSize: 10, fontFamily: "ui-monospace, monospace", letterSpacing: 2, background: "#0D9488" }}
              >
                ORG HUB
              </span>
              <h1 className="text-lg font-bold text-white font-oswald uppercase tracking-wider">
                Digital Front Office
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <span
                className="text-xs text-white/60"
                style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 1 }}
              >
                {orgName}
              </span>
            </div>
          </div>

          {/* ── PXI Intel Strip ─────────────────────────────── */}
          <div
            className="flex items-center gap-2 px-5 py-3 mb-6"
            style={{ borderRadius: 12, border: "1.5px solid rgba(13,148,136,0.2)", background: "rgba(13,148,136,0.04)" }}
          >
            <Sparkles size={14} style={{ color: "#0D9488" }} />
            <span
              className="text-[10px] font-bold uppercase"
              style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 1, color: "#0D9488" }}
            >
              PXI Org Insights
            </span>
            <span className="text-[11px]" style={{ color: "#5A7291" }}>
              — Org-wide intelligence coming soon: roster health, development risks, scouting gaps, trade market.
            </span>
          </div>

          {/* ── Panel Grid ──────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
            {PANELS.map((panel) => {
              const colors = ACCENT_COLORS[panel.accent];
              const Icon = panel.icon;
              return (
                <Link
                  key={panel.href}
                  href={panel.href}
                  className="group block overflow-hidden transition-all duration-200 hover:shadow-lg"
                  style={{
                    borderRadius: 12,
                    border: "1.5px solid #DDE6EF",
                    borderLeft: `3px solid ${colors.border}`,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}
                >
                  {/* Navy header */}
                  <div
                    className="flex items-center gap-2 px-5 py-3"
                    style={{ background: "#0F2942" }}
                  >
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ background: colors.dot }}
                    />
                    <Icon size={13} className="text-white/80" />
                    <span
                      className="font-bold uppercase text-white"
                      style={{ fontSize: 10, fontFamily: "ui-monospace, monospace", letterSpacing: 2 }}
                    >
                      {panel.title}
                    </span>
                  </div>
                  {/* Body */}
                  <div className="bg-white px-5 py-4">
                    <p className="text-xs leading-relaxed" style={{ color: "#5A7291" }}>
                      {panel.description}
                    </p>
                    <div className="flex items-center gap-1 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span
                        className="text-[10px] font-bold uppercase"
                        style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 1, color: colors.border }}
                      >
                        Open Panel
                      </span>
                      <span style={{ color: colors.border }}>&rarr;</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* ── Quick Actions ───────────────────────────────── */}
          <div
            className="overflow-hidden"
            style={{ borderRadius: 12, border: "1.5px solid #DDE6EF" }}
          >
            <div
              className="flex items-center gap-2 px-5 py-3"
              style={{ background: "#0F2942" }}
            >
              <span className="w-2 h-2 rounded-full" style={{ background: "#14B8A6" }} />
              <span
                className="font-bold uppercase text-white"
                style={{ fontSize: 10, fontFamily: "ui-monospace, monospace", letterSpacing: 2 }}
              >
                Quick Actions
              </span>
            </div>
            <div className="bg-white px-5 py-4 flex flex-wrap items-center gap-3">
              {[
                { label: "New Board", icon: PenTool, href: "/org-hub/playbook" },
                { label: "Upload Film", icon: Upload, href: "/film/upload" },
                { label: "Generate Report", icon: FileText, href: "/reports/generate" },
              ].map((action) => {
                const ActionIcon = action.icon;
                return (
                  <Link
                    key={action.href}
                    href={action.href}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold uppercase transition-colors hover:opacity-90"
                    style={{
                      fontFamily: "ui-monospace, monospace",
                      letterSpacing: 1,
                      color: "#0F2942",
                      background: "rgba(13,148,136,0.08)",
                      border: "1.5px solid rgba(13,148,136,0.2)",
                    }}
                  >
                    <ActionIcon size={12} />
                    {action.label}
                  </Link>
                );
              })}
              <button
                onClick={async () => {
                  if (syncing) return;
                  setSyncing(true);
                  try {
                    await api.post("/hockeytech/gojhl/sync-roster/3515");
                  } catch { /* ignore — user may not have sync perms */ }
                  setSyncing(false);
                }}
                disabled={syncing}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold uppercase transition-colors hover:opacity-90"
                style={{
                  fontFamily: "ui-monospace, monospace",
                  letterSpacing: 1,
                  color: "#0F2942",
                  background: "rgba(13,148,136,0.08)",
                  border: "1.5px solid rgba(13,148,136,0.2)",
                  opacity: syncing ? 0.6 : 1,
                }}
              >
                {syncing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                {syncing ? "Syncing..." : "Sync Roster"}
              </button>
            </div>
          </div>

        </div>
      </main>
    </ProtectedRoute>
  );
}
