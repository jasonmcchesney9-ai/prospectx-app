"use client";

import { useRef, useState, useCallback } from "react";
import {
  ChevronDown,
  ChevronUp,
  Pin,
  Copy,
  RefreshCw,
  Check,
} from "lucide-react";
import HockeyRink from "@/components/HockeyRink";
import type { BroadcastMode } from "@/types/api";

interface Props {
  title: string;
  mode: BroadcastMode;
  timestamp: string | null;
  isPinned: boolean;
  isCollapsed: boolean;
  isLoading: boolean;
  onPin: () => void;
  onCollapse: () => void;
  onCopy?: () => void;
  onRegenerate: () => void;
  children: React.ReactNode;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function BroadcastToolCard({
  title,
  mode,
  timestamp,
  isPinned,
  isCollapsed,
  isLoading,
  onPin,
  onCollapse,
  onCopy,
  onRegenerate,
  children,
}: Props) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (onCopy) {
      onCopy();
    } else if (contentRef.current) {
      try {
        await navigator.clipboard.writeText(contentRef.current.innerText);
      } catch {
        // Fallback
        const range = document.createRange();
        range.selectNodeContents(contentRef.current);
        window.getSelection()?.removeAllRanges();
        window.getSelection()?.addRange(range);
        document.execCommand("copy");
        window.getSelection()?.removeAllRanges();
      }
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [onCopy]);

  return (
    <div
      className={`bg-white rounded-xl border transition-all ${
        isPinned
          ? "border-l-4 border-l-teal border-t border-r border-b border-border shadow-sm"
          : "border-border"
      }`}
    >
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/50">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={onCollapse}
            className="text-muted hover:text-navy transition-colors shrink-0"
            aria-label={isCollapsed ? "Expand" : "Collapse"}
          >
            {isCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>
          <h3 className="text-sm font-oswald font-semibold text-navy uppercase tracking-wider truncate">
            {title}
          </h3>
          {isPinned && (
            <span className="text-[9px] font-oswald uppercase tracking-wider text-teal bg-teal/10 px-1.5 py-0.5 rounded">
              Pinned
            </span>
          )}
          <span
            className={`text-[9px] font-oswald uppercase tracking-wider px-1.5 py-0.5 rounded ${
              mode === "broadcast"
                ? "bg-teal/10 text-teal"
                : "bg-orange/10 text-orange"
            }`}
          >
            {mode}
          </span>
          {timestamp && (
            <span className="text-[10px] text-muted/60 whitespace-nowrap hidden sm:inline">
              {timeAgo(timestamp)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onPin}
            className={`p-1.5 rounded-md transition-colors ${
              isPinned
                ? "text-teal bg-teal/10 hover:bg-teal/20"
                : "text-muted/50 hover:text-navy hover:bg-navy/5"
            }`}
            title={isPinned ? "Unpin" : "Pin to top"}
          >
            <Pin size={13} />
          </button>
          <button
            onClick={handleCopy}
            className="p-1.5 rounded-md text-muted/50 hover:text-navy hover:bg-navy/5 transition-colors"
            title="Copy to clipboard"
          >
            {copied ? (
              <Check size={13} className="text-green-600" />
            ) : (
              <Copy size={13} />
            )}
          </button>
          <button
            onClick={onRegenerate}
            disabled={isLoading}
            className="p-1.5 rounded-md text-muted/50 hover:text-navy hover:bg-navy/5 transition-colors disabled:opacity-30"
            title="Regenerate"
          >
            <RefreshCw size={13} className={isLoading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Content area */}
      <div
        className={`transition-all duration-300 ease-in-out overflow-hidden ${
          isCollapsed ? "max-h-0" : "max-h-[5000px]"
        }`}
      >
        <div ref={contentRef} className="p-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-6">
              <HockeyRink size="card" animate label={`Generating ${title.toLowerCase()}...`} />
            </div>
          ) : (
            children
          )}
        </div>
      </div>
    </div>
  );
}
