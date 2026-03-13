"use client";

import { useState } from "react";
import { ThumbsUp, ThumbsDown, ArrowDownToLine, ArrowUpToLine, Bookmark } from "lucide-react";
import api from "@/lib/api";

interface Props {
  reportId: string;
  sectionKey: string;
}

const ACTIONS = [
  { action: "helpful", icon: ThumbsUp, title: "Helpful" },
  { action: "not_helpful", icon: ThumbsDown, title: "Not helpful" },
  { action: "too_long", icon: ArrowDownToLine, title: "Too long" },
  { action: "too_short", icon: ArrowUpToLine, title: "Too short" },
  { action: "save", icon: Bookmark, title: "Save" },
] as const;

export default function CoachFeedbackButton({ reportId, sectionKey }: Props) {
  const [clicked, setClicked] = useState<Set<string>>(new Set());
  const [flash, setFlash] = useState<string | null>(null);

  async function send(action: string) {
    if (clicked.has(action)) return;
    setClicked((prev) => new Set(prev).add(action));
    setFlash(action);
    setTimeout(() => setFlash(null), 600);
    try {
      await api.post("/coach-feedback", {
        report_id: reportId,
        section_key: sectionKey,
        action,
      });
    } catch {
      // silent fail — never show error to user
    }
  }

  return (
    <div
      style={{
        display: "flex",
        gap: "6px",
        marginTop: "8px",
        justifyContent: "flex-end",
      }}
    >
      {ACTIONS.map(({ action, icon: Icon, title }) => {
        const isClicked = clicked.has(action);
        const isFlashing = flash === action;
        return (
          <button
            key={action}
            title={title}
            disabled={isClicked}
            onClick={() => send(action)}
            style={{
              fontSize: "11px",
              padding: "3px 8px",
              border: "1px solid #E2E8F0",
              borderRadius: "4px",
              background: isFlashing ? "#0D9488" : "white",
              color: isFlashing ? "white" : isClicked ? "#CBD5E1" : "#64748B",
              cursor: isClicked ? "default" : "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "3px",
              transition: "background 0.2s, color 0.2s",
            }}
          >
            <Icon size={12} />
          </button>
        );
      })}
    </div>
  );
}
