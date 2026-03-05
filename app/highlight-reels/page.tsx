"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Film,
  Plus,
  Loader2,
  Clock,
  User,
  Trash2,
  Sparkles,
} from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import api from "@/lib/api";
import toast from "react-hot-toast";

interface HighlightReel {
  id: string;
  title: string;
  description?: string;
  level: string;
  player_id?: string;
  player_first_name?: string;
  player_last_name?: string;
  clip_ids: string[];
  status: string;
  pxi_status: string;
  created_at: string;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  draft: { bg: "rgba(139,164,187,0.1)", text: "#8BA4BB" },
  ready: { bg: "rgba(13,148,136,0.1)", text: "#0D9488" },
  shared: { bg: "rgba(234,88,12,0.1)", text: "#EA580C" },
};

export default function HighlightReelsPage() {
  const [reels, setReels] = useState<HighlightReel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadReels() {
      try {
        const res = await api.get("/highlight-reels");
        setReels(Array.isArray(res.data) ? res.data : []);
      } catch {
        // Silently handle
      } finally {
        setLoading(false);
      }
    }
    loadReels();
  }, []);

  const handleDelete = async (reelId: string) => {
    if (!confirm("Delete this highlight reel?")) return;
    try {
      await api.delete(`/highlight-reels/${reelId}`);
      setReels((prev) => prev.filter((r) => r.id !== reelId));
      toast.success("Reel deleted");
    } catch {
      toast.error("Failed to delete reel");
    }
  };

  return (
    <ProtectedRoute>
      <NavBar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ═══ Header ═══ */}
        <div className="px-5 py-4 flex items-center justify-between mb-6" style={{ borderRadius: 12, border: "1.5px solid #DDE6EF", background: "#0F2942" }}>
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 rounded-md text-white font-bold uppercase flex items-center gap-1.5" style={{ fontSize: 10, fontFamily: "ui-monospace, monospace", letterSpacing: 2, background: "#EA580C" }}>
              <Film size={10} />
              HIGHLIGHT REELS
            </span>
            <div>
              <h1 className="text-lg font-bold text-white">Highlight Reels</h1>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>
                Build recruiting-ready highlight packages for your players.
              </p>
            </div>
          </div>
          <Link
            href="/highlight-reels/new"
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold uppercase transition-colors hover:opacity-90 text-white"
            style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 1, background: "#EA580C" }}
          >
            <Plus size={12} />
            New Reel
          </Link>
        </div>

        {/* ═══ Content ═══ */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="animate-pulse overflow-hidden" style={{ borderRadius: 12, border: "1.5px solid #DDE6EF" }}>
                <div style={{ background: "#0F2942", height: 44 }} />
                <div className="bg-white p-5 space-y-3">
                  <div style={{ background: "#DDE6EF", height: 16, width: 200, borderRadius: 4 }} />
                  <div style={{ background: "#DDE6EF", height: 14, width: "100%", borderRadius: 4 }} />
                </div>
              </div>
            ))}
          </div>
        ) : reels.length === 0 ? (
          <div className="text-center py-20">
            <Film size={48} className="mx-auto mb-4" style={{ color: "#DDE6EF" }} />
            <p className="text-lg font-medium" style={{ color: "#5A7291" }}>No highlight reels yet</p>
            <p className="text-sm mt-1" style={{ color: "#8BA4BB" }}>
              Create clips in the Film Room, then build a reel to showcase your players.
            </p>
            <Link
              href="/highlight-reels/new"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-sm font-bold uppercase mt-4 transition-colors hover:opacity-90 text-white"
              style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 1, background: "#EA580C" }}
            >
              <Plus size={14} />
              Build Your First Reel
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {reels.map((reel) => {
              const ss = STATUS_STYLES[reel.status] || STATUS_STYLES.draft;
              return (
                <div key={reel.id} className="overflow-hidden group" style={{ borderRadius: 12, border: "1.5px solid #DDE6EF", borderLeft: "3px solid #EA580C" }}>
                  <div className="flex items-center justify-between px-5 py-3" style={{ background: "#0F2942" }}>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ background: "#EA580C" }} />
                      <Link
                        href={`/highlight-reels/${reel.id}`}
                        className="font-bold uppercase text-white hover:underline"
                        style={{ fontSize: 10, fontFamily: "ui-monospace, monospace", letterSpacing: 2 }}
                      >
                        {reel.title}
                      </Link>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className="px-2 py-0.5 rounded text-[9px] font-bold uppercase"
                        style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 1, background: ss.bg, color: ss.text }}
                      >
                        {reel.status}
                      </span>
                      {reel.pxi_status === "completed" && (
                        <span title="PXI suggestions available">
                          <Sparkles size={10} style={{ color: "#0D9488" }} />
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="bg-white px-5 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {reel.player_first_name && (
                        <span className="flex items-center gap-1 text-sm" style={{ color: "#0F2942" }}>
                          <User size={12} style={{ color: "#0D9488" }} />
                          {reel.player_first_name} {reel.player_last_name}
                        </span>
                      )}
                      <span className="text-xs font-bold uppercase px-2 py-0.5 rounded" style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 1, background: "rgba(234,88,12,0.06)", color: "#EA580C" }}>
                        {reel.level}
                      </span>
                      <span className="text-xs" style={{ color: "#8BA4BB" }}>
                        {reel.clip_ids?.length || 0} clips
                      </span>
                      <span className="flex items-center gap-1 text-xs" style={{ color: "#8BA4BB" }}>
                        <Clock size={10} />
                        {formatDate(reel.created_at)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/highlight-reels/${reel.id}`}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-colors hover:opacity-90 text-white"
                        style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 1, background: "#0D9488" }}
                      >
                        View
                      </Link>
                      <button
                        onClick={() => handleDelete(reel.id)}
                        className="p-1.5 rounded-lg transition-colors opacity-0 group-hover:opacity-100 hover:bg-red-50"
                        style={{ color: "#8BA4BB" }}
                        title="Delete reel"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </ProtectedRoute>
  );
}
