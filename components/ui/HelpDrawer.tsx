"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { X } from "lucide-react";
import { HELP_GUIDES, getGuideForRoute, type HelpGuide } from "@/lib/helpContent";
import { usePathname } from "next/navigation";

interface HelpDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  initialGuideId?: string;
}

const SECTION_ORDER: { label: string; ids: string[] }[] = [
  {
    label: "Getting Started",
    ids: ["dashboard", "players_all", "player_profile", "reports"],
  },
  {
    label: "Film & Video",
    ids: ["film_hub", "film_session", "reel_builder"],
  },
  {
    label: "PXI Intelligence",
    ids: ["bench_talk", "dev_plan"],
  },
  {
    label: "Scouting",
    ids: ["scout_notes", "watchlist", "scouting_pipeline", "draft_board"],
  },
  {
    label: "Game Day",
    ids: ["game_hub", "war_room"],
  },
  {
    label: "Coaching",
    ids: ["practice_plans", "drill_library", "rink_builder", "series_planning"],
  },
  {
    label: "League & Data",
    ids: ["league_hub", "imports"],
  },
  {
    label: "Broadcast",
    ids: ["broadcast_hub"],
  },
  {
    label: "Player & Family",
    ids: ["player_guide", "my_player_parent"],
  },
  {
    label: "Reference",
    ids: ["glossary", "admin"],
  },
];

export default function HelpDrawer({ isOpen, onClose, initialGuideId }: HelpDrawerProps) {
  const pathname = usePathname();
  const [activeGuide, setActiveGuide] = useState<HelpGuide | null>(null);
  const [search, setSearch] = useState("");
  const [isDesktop, setIsDesktop] = useState(true);
  const prevOpen = useRef(false);

  /* ── Responsive check ── */
  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  /* ── Auto-select guide on open ── */
  useEffect(() => {
    if (isOpen && !prevOpen.current) {
      // Drawer just opened
      if (initialGuideId && HELP_GUIDES[initialGuideId]) {
        setActiveGuide(HELP_GUIDES[initialGuideId]);
      } else {
        const matched = getGuideForRoute(pathname);
        setActiveGuide(matched);
      }
      setSearch("");
    }
    prevOpen.current = isOpen;
  }, [isOpen, initialGuideId, pathname]);

  /* ── Search filter ── */
  const matchesSearch = useCallback(
    (guide: HelpGuide) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        guide.title.toLowerCase().includes(q) ||
        guide.steps.some((s) => s.toLowerCase().includes(q))
      );
    },
    [search]
  );

  /* ── Close on Escape ── */
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  return (
    <>
      {/* ── Backdrop ── */}
      {isOpen && (
        <div
          onClick={onClose}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            zIndex: 49,
          }}
        />
      )}

      {/* ── Drawer ── */}
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: isDesktop ? "400px" : "100%",
          background: "#0F2942",
          borderLeft: "1px solid rgba(255,255,255,0.1)",
          zIndex: 50,
          transform: isOpen ? "translateX(0)" : "translateX(100%)",
          transition: "transform 250ms ease",
          display: "flex",
          flexDirection: "column",
          fontFamily: "'Source Serif 4', serif",
        }}
      >
        {/* ── Header ── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px",
            borderBottom: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <h2
            style={{
              color: "#FFFFFF",
              fontWeight: 700,
              fontSize: "18px",
              fontFamily: "'Oswald', sans-serif",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              margin: 0,
            }}
          >
            Help
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "rgba(255,255,255,0.5)",
              padding: "4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Search ── */}
        <div style={{ padding: "12px 20px" }}>
          <input
            type="text"
            placeholder="Search guides..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 12px",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "6px",
              color: "#FFFFFF",
              fontSize: "13px",
              fontFamily: "'Source Serif 4', serif",
              outline: "none",
            }}
          />
        </div>

        {/* ── Content ── */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "0 20px 20px",
          }}
        >
          {activeGuide ? (
            /* ── Active Guide View ── */
            <div>
              <button
                onClick={() => setActiveGuide(null)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#0D9488",
                  fontSize: "12px",
                  fontFamily: "'Oswald', sans-serif",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  padding: "8px 0 16px",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                &larr; All Guides
              </button>

              <h3
                style={{
                  color: "#FFFFFF",
                  fontWeight: 700,
                  fontSize: "16px",
                  fontFamily: "'Oswald', sans-serif",
                  margin: "0 0 8px",
                }}
              >
                {activeGuide.title}
              </h3>

              <p
                style={{
                  color: "rgba(255,255,255,0.6)",
                  fontSize: "13px",
                  margin: "0 0 20px",
                  lineHeight: 1.5,
                }}
              >
                {activeGuide.outcome}
              </p>

              {/* Steps */}
              <ol style={{ listStyle: "none", padding: 0, margin: "0 0 20px" }}>
                {activeGuide.steps.map((step, i) => (
                  <li
                    key={i}
                    style={{
                      display: "flex",
                      gap: "10px",
                      marginBottom: "12px",
                      fontSize: "13px",
                      lineHeight: 1.5,
                    }}
                  >
                    <span
                      style={{
                        color: "#0D9488",
                        fontWeight: 700,
                        fontFamily: "'Oswald', sans-serif",
                        fontSize: "14px",
                        minWidth: "20px",
                        flexShrink: 0,
                      }}
                    >
                      {i + 1}
                    </span>
                    <span style={{ color: "rgba(255,255,255,0.8)" }}>{step}</span>
                  </li>
                ))}
              </ol>

              {/* Tips */}
              {activeGuide.tips && activeGuide.tips.length > 0 && (
                <div>
                  <h4
                    style={{
                      color: "rgba(255,255,255,0.5)",
                      fontSize: "11px",
                      fontFamily: "'Oswald', sans-serif",
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                      margin: "0 0 10px",
                    }}
                  >
                    Tips
                  </h4>
                  <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                    {activeGuide.tips.map((tip, i) => (
                      <li
                        key={i}
                        style={{
                          color: "rgba(13,148,136,0.6)",
                          fontSize: "12px",
                          fontStyle: "italic",
                          lineHeight: 1.5,
                          marginBottom: "8px",
                          paddingLeft: "12px",
                          position: "relative",
                        }}
                      >
                        <span
                          style={{
                            position: "absolute",
                            left: 0,
                            top: "2px",
                          }}
                        >
                          &bull;
                        </span>
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            /* ── Guide List ── */
            <div>
              {SECTION_ORDER.map((section) => {
                const guides = section.ids
                  .map((id) => HELP_GUIDES[id])
                  .filter(Boolean)
                  .filter(matchesSearch);
                if (guides.length === 0) return null;
                return (
                  <div key={section.label} style={{ marginBottom: "16px" }}>
                    <h4
                      style={{
                        color: "rgba(255,255,255,0.35)",
                        fontSize: "10px",
                        fontFamily: "'Oswald', sans-serif",
                        textTransform: "uppercase",
                        letterSpacing: "0.12em",
                        margin: "12px 0 6px",
                      }}
                    >
                      {section.label}
                    </h4>
                    {guides.map((guide) => (
                      <button
                        key={guide.id}
                        onClick={() => setActiveGuide(guide)}
                        style={{
                          display: "block",
                          width: "100%",
                          textAlign: "left",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          padding: "8px 10px",
                          borderRadius: "6px",
                          color: "rgba(255,255,255,0.8)",
                          fontSize: "13px",
                          fontFamily: "'Source Serif 4', serif",
                          transition: "background 0.15s ease",
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.background =
                            "rgba(255,255,255,0.05)";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.background = "none";
                        }}
                      >
                        {guide.title}
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
