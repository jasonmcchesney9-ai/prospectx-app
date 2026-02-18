"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  MessageSquare,
  Send,
  Plus,
  Trash2,
  ThumbsUp,
  ThumbsDown,
  Trophy,
  Search,
  FileText,
  Shield,
  Brain,
  GitCompareArrows,
  Loader2,
  Sparkles,
  X,
  User,
  MapPin,
  Clock,
  CheckCircle2,
  AlertCircle,
  Users,
  History,
  Layers,
  ChevronDown,
} from "lucide-react";
import api, { assetUrl, hasRealImage } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { useBenchTalk } from "./BenchTalkProvider";
import PXIIcon from "./PXIIcon";
import PXIBadge from "./PXIBadge";
import type {
  BenchTalkConversation,
  BenchTalkMessage,
  BenchTalkMessageResponse,
  BenchTalkSuggestion,
  BenchTalkContextResponse,
  Player,
  Report,
} from "@/types/api";
import { REPORT_TYPE_LABELS, TEAM_REPORT_TYPES } from "@/types/api";
import UpgradeModal from "./UpgradeModal";
import HockeyRink from "./HockeyRink";

// ── Suggestion Icons ─────────────────────────────────────────
const SUGGESTION_ICONS: Record<string, React.ElementType> = {
  trophy: Trophy,
  search: Search,
  compare: GitCompareArrows,
  shield: Shield,
  file: FileText,
  brain: Brain,
};

// ── Role Group + Theme Config for Bench Talk ─────────────────
type RoleGroup = "PRO" | "MEDIA" | "FAMILY" | "AGENT";

const ROLE_GROUP_MAP: Record<string, RoleGroup> = {
  scout: "PRO", coach: "PRO", gm: "PRO",
  player: "FAMILY", parent: "FAMILY",
  broadcaster: "MEDIA", producer: "MEDIA",
  agent: "AGENT",
};

interface BenchTalkTheme {
  accentColor: string;      // Tailwind color class for send button bg
  accentHover: string;      // Hover variant
  greeting: string;         // Welcome greeting text
  question: string;         // Welcome question (uses {name} placeholder)
  defaultMode: string;      // PXI mode to auto-select
  modeBadgeColor: string;   // Tailwind bg for mode badge chip
  pillBorderActive: string; // Active pill accent
  fallbackSuggestions: Array<{ text: string; icon: string }>;
}

const BENCH_TALK_THEMES: Record<RoleGroup, BenchTalkTheme> = {
  PRO: {
    accentColor: "bg-teal",
    accentHover: "hover:bg-teal/90",
    greeting: "I'm PXI, your hockey intelligence assistant. I can scout players, build game plans, analyze stats, or help with roster decisions.",
    question: "What player or team are you evaluating?",
    defaultMode: "scout",
    modeBadgeColor: "bg-teal/15 text-teal",
    pillBorderActive: "border-teal/30",
    fallbackSuggestions: [
      { text: "Scout a player", icon: "search" },
      { text: "Build a game plan", icon: "shield" },
      { text: "Compare two players", icon: "compare" },
      { text: "Analyze team trends", icon: "trophy" },
      { text: "Trade analysis", icon: "brain" },
    ],
  },
  FAMILY: {
    accentColor: "bg-[#3B6B8A]",
    accentHover: "hover:bg-[#3B6B8A]/90",
    greeting: "Hi! I'm PXI. I help families understand player progress and what you can do to support development. No jargon, just clear answers.",
    question: "How can I help with your player's development?",
    defaultMode: "parent",
    modeBadgeColor: "bg-[#3B6B8A]/15 text-[#3B6B8A]",
    pillBorderActive: "border-[#3B6B8A]/30",
    fallbackSuggestions: [
      { text: "How is my player doing?", icon: "search" },
      { text: "What should we work on?", icon: "brain" },
      { text: "Explain his stats", icon: "trophy" },
      { text: "Off-ice training ideas", icon: "shield" },
      { text: "Prep school options", icon: "file" },
    ],
  },
  MEDIA: {
    accentColor: "bg-orange",
    accentHover: "hover:bg-orange/90",
    greeting: "PXI in Broadcast mode. I'll build storylines, spotting boards, talk tracks, and live-game context. Let's get you game-ready.",
    question: "Which game are you prepping for?",
    defaultMode: "broadcast",
    modeBadgeColor: "bg-orange/15 text-orange",
    pillBorderActive: "border-orange/30",
    fallbackSuggestions: [
      { text: "Tonight's storylines", icon: "file" },
      { text: "Spotting board", icon: "search" },
      { text: "Coach interview Qs", icon: "brain" },
      { text: "Graphics ideas", icon: "trophy" },
      { text: "Post-game script", icon: "shield" },
    ],
  },
  AGENT: {
    accentColor: "bg-[#475569]",
    accentHover: "hover:bg-[#475569]/90",
    greeting: "PXI in Agent mode. Pathway planning, exposure strategy, and honest player positioning. No hype, just realistic plans.",
    question: "Which client are you working on?",
    defaultMode: "agent",
    modeBadgeColor: "bg-[#475569]/15 text-[#475569]",
    pillBorderActive: "border-[#475569]/30",
    fallbackSuggestions: [
      { text: "Pathway options", icon: "search" },
      { text: "90-day plan", icon: "brain" },
      { text: "Agent pack", icon: "file" },
      { text: "School recommendations", icon: "trophy" },
      { text: "Readiness assessment", icon: "shield" },
    ],
  },
};

function getRoleGroup(hockeyRole?: string): RoleGroup {
  return ROLE_GROUP_MAP[hockeyRole || "scout"] || "PRO";
}

// ── Mode Badge Labels ─────────────────────────────────────────
const MODE_LABELS: Record<string, string> = {
  scout: "SCOUT", coach: "COACH", gm: "GM", analyst: "ANALYST",
  agent: "AGENT", parent: "PARENT", skill_coach: "SKILL COACH",
  mental_coach: "MENTAL", broadcast: "BROADCAST", producer: "PRODUCER",
};

// ── Status Config for Report Cards ──────────────────────────
const STATUS_CONFIG = {
  complete: { icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50", label: "Complete" },
  processing: { icon: Loader2, color: "text-teal", bg: "bg-teal/10", label: "Generating..." },
  pending: { icon: Clock, color: "text-orange", bg: "bg-orange/10", label: "Pending" },
  failed: { icon: AlertCircle, color: "text-red-600", bg: "bg-red-50", label: "Failed" },
} as const;

// ── Markdown Renderer ────────────────────────────────────────
function formatInline(text: string): string {
  return text
    .replace(
      /\*\*(.+?)\*\*/g,
      '<strong class="font-semibold text-navy">$1</strong>'
    )
    .replace(
      /`(.+?)`/g,
      '<code class="bg-navy/5 text-navy px-1 py-0.5 rounded text-xs font-mono">$1</code>'
    );
}

function BenchTalkMessageContent({ content }: { content: string }) {
  const lines = content.split("\n");

  return (
    <div className="space-y-1 text-sm leading-relaxed">
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-2" />;

        const bulletMatch = line.match(/^(\s*)[•\-\*]\s+(.*)/);
        if (bulletMatch) {
          const indent = bulletMatch[1].length > 0;
          return (
            <div key={i} className={`flex gap-2 ${indent ? "ml-4" : ""}`}>
              <span className="text-teal mt-0.5 shrink-0">•</span>
              <span dangerouslySetInnerHTML={{ __html: formatInline(bulletMatch[2]) }} />
            </div>
          );
        }

        if (line.match(/^#{1,3}\s/)) {
          const text = line.replace(/^#{1,3}\s+/, "");
          return (
            <p key={i} className="font-oswald font-semibold text-navy mt-2 text-sm uppercase tracking-wider">
              {text}
            </p>
          );
        }

        return <p key={i} dangerouslySetInnerHTML={{ __html: formatInline(line) }} />;
      })}
    </div>
  );
}

// ── Compact Player Card (sidebar) ───────────────────────────
function CompactPlayerCard({ player }: { player: Player & { gp?: number; g?: number; a?: number; p?: number; ppg?: number } }) {
  return (
    <Link
      href={`/players/${player.id}`}
      className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-white border border-teal/20 hover:border-teal/30 hover:shadow-sm transition-all"
    >
      {hasRealImage(player.image_url) ? (
        <div className="w-8 h-8 rounded-full overflow-hidden bg-navy/10 shrink-0">
          <img
            src={assetUrl(player.image_url)}
            alt={`${player.first_name} ${player.last_name}`}
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        <div className="w-8 h-8 rounded-full bg-navy/10 flex items-center justify-center shrink-0">
          <User size={14} className="text-navy" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-navy truncate">
            {player.first_name} {player.last_name}
          </span>
          <span className="text-[10px] font-bold text-teal bg-teal/10 px-1.5 py-0.5 rounded font-oswald">
            {player.position}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-muted">
          {player.current_team && (
            <span className="flex items-center gap-0.5">
              <MapPin size={8} />
              {player.current_team}
            </span>
          )}
          {player.gp != null && (
            <span className="text-navy/40">
              {player.gp}GP {player.g}G {player.a}A {player.p}P
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

// ── Compact Report Card (sidebar) ───────────────────────────
function CompactReportCard({ report }: { report: Report }) {
  const statusInfo = STATUS_CONFIG[report.status] || STATUS_CONFIG.pending;
  const StatusIcon = statusInfo.icon;
  const isTeamReport = (TEAM_REPORT_TYPES as readonly string[]).includes(report.report_type);

  return (
    <Link
      href={`/reports/${report.id}`}
      className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-white border border-teal/20 hover:border-teal/30 hover:shadow-sm transition-all"
    >
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isTeamReport ? "bg-orange/10" : "bg-navy/5"}`}>
        <FileText size={14} className={isTeamReport ? "text-orange" : "text-navy"} />
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-xs font-semibold text-navy truncate block">
          {report.title || "Untitled Report"}
        </span>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium ${statusInfo.color}`}>
            <StatusIcon size={10} className={report.status === "processing" ? "animate-spin" : ""} />
            {statusInfo.label}
          </span>
          <span className="text-[10px] text-muted">
            {REPORT_TYPE_LABELS[report.report_type] || report.report_type}
          </span>
        </div>
      </div>
    </Link>
  );
}

// ── Mode Pill Bar ──────────────────────────────────────────
const PRIMARY_MODE_IDS = ["scout", "coach", "gm", "analyst", "agent", "parent"];
const SECONDARY_MODE_IDS = ["skill_coach", "mental_coach", "broadcast", "producer"];

interface ModePillBarProps {
  pxiModes: Array<{ id: string; name: string; primary_user: string; key_output: string; icon: string }>;
  currentMode: string;
  onModeChange: (modeId: string) => void;
  roleGroup: RoleGroup;
}

function ModePillBar({ pxiModes, currentMode, onModeChange, roleGroup }: ModePillBarProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    }
    if (moreOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [moreOpen]);

  // Split modes into primary (always visible) and secondary ("More" dropdown)
  const primaryModes = PRIMARY_MODE_IDS
    .map((id) => pxiModes.find((m) => m.id === id))
    .filter(Boolean) as ModePillBarProps["pxiModes"];

  const secondaryModes = SECONDARY_MODE_IDS
    .map((id) => pxiModes.find((m) => m.id === id))
    .filter(Boolean) as ModePillBarProps["pxiModes"];

  // If no modes loaded yet, show placeholder
  if (pxiModes.length === 0) {
    return (
      <div className="bg-white border-b border-teal/20 px-3 py-2 shrink-0">
        <div className="flex gap-1.5 overflow-x-auto">
          {PRIMARY_MODE_IDS.map((id) => (
            <span key={id} className="px-3 py-1 rounded-full bg-navy/5 text-[10px] text-muted animate-pulse">
              {MODE_LABELS[id] || id}
            </span>
          ))}
        </div>
      </div>
    );
  }

  const theme = BENCH_TALK_THEMES[roleGroup];
  const isSecondaryActive = SECONDARY_MODE_IDS.includes(currentMode);

  return (
    <div className="bg-white border-b border-teal/20 px-3 py-2 shrink-0">
      <div className="flex items-center gap-1.5">
        {/* Primary mode pills — always visible */}
        <div className="flex gap-1 overflow-x-auto flex-1 min-w-0">
          {primaryModes.map((mode) => {
            const isActive = currentMode === mode.id;
            return (
              <button
                key={mode.id}
                onClick={() => { onModeChange(mode.id); setMoreOpen(false); }}
                className={`px-3 py-1 rounded-full text-[10px] font-oswald font-bold tracking-wider whitespace-nowrap transition-all ${
                  isActive
                    ? "bg-teal text-white shadow-sm"
                    : "bg-transparent text-muted border border-teal/20 hover:border-teal/30 hover:text-navy"
                }`}
                title={mode.name}
              >
                {MODE_LABELS[mode.id] || mode.name}
              </button>
            );
          })}
        </div>

        {/* "More" dropdown for secondary modes */}
        {secondaryModes.length > 0 && (
          <div className="relative shrink-0" ref={moreRef}>
            <button
              onClick={() => setMoreOpen(!moreOpen)}
              className={`flex items-center gap-0.5 px-2.5 py-1 rounded-full text-[10px] font-oswald font-bold tracking-wider transition-all ${
                isSecondaryActive
                  ? "bg-teal text-white shadow-sm"
                  : "bg-transparent text-muted border border-teal/20 hover:border-teal/30 hover:text-navy"
              }`}
              title="More modes"
            >
              {isSecondaryActive ? (MODE_LABELS[currentMode] || "MORE") : "MORE"}
              <ChevronDown size={10} className={`transition-transform ${moreOpen ? "rotate-180" : ""}`} />
            </button>

            {moreOpen && (
              <div className="absolute top-full right-0 mt-1 w-40 bg-white border border-teal/20 rounded-lg shadow-lg z-50 py-1">
                {secondaryModes.map((mode) => {
                  const isActive = currentMode === mode.id;
                  return (
                    <button
                      key={mode.id}
                      onClick={() => { onModeChange(mode.id); setMoreOpen(false); }}
                      className={`w-full text-left px-3 py-1.5 text-[11px] font-medium transition-colors ${
                        isActive
                          ? "bg-teal/10 text-teal font-semibold"
                          : "text-navy hover:bg-navy/[0.03]"
                      }`}
                    >
                      <span className="font-oswald tracking-wider text-[10px] font-bold">
                        {MODE_LABELS[mode.id] || mode.name}
                      </span>
                      <span className="block text-[9px] text-muted mt-0.5">{mode.primary_user}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Bench Talk Drawer ──────────────────────────────────
export default function BenchTalkDrawer() {
  const { isOpen, toggleBenchTalk, closeBenchTalk, pendingMessage, clearPendingMessage, roleOverride } = useBenchTalk();

  // Effective hockey role — respects admin preview override
  const effectiveHockeyRole = roleOverride || getUser()?.hockey_role;

  const [conversations, setConversations] = useState<BenchTalkConversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<BenchTalkMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<BenchTalkSuggestion[]>([]);
  const [feedbackGiven, setFeedbackGiven] = useState<Record<string, string>>({});

  // Upgrade modal state
  const [upgradeModal, setUpgradeModal] = useState<{ open: boolean; used: number; limit: number }>({ open: false, used: 0, limit: 0 });

  // Context sidebar state
  const [sidebarTab, setSidebarTab] = useState<"context" | "history">("context");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [contextPlayers, setContextPlayers] = useState<Array<Player & { gp?: number; g?: number; a?: number; p?: number; ppg?: number }>>([]);
  const [contextReports, setContextReports] = useState<Report[]>([]);

  // PXI Mode state
  const [currentMode, setCurrentMode] = useState<string>(() => {
    const user = getUser();
    // Map old hockey_role to PXI mode (player → parent)
    const role = user?.hockey_role || "scout";
    return role === "player" ? "parent" : role;
  });
  const [pxiModes, setPxiModes] = useState<Array<{ id: string; name: string; primary_user: string; key_output: string; icon: string }>>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load conversations + modes on mount
  useEffect(() => {
    if (isOpen) {
      loadConversations();
      loadSuggestions();
      // Fetch PXI modes (only once)
      if (pxiModes.length === 0) {
        api.get("/pxi/modes").then(({ data }) => setPxiModes(data)).catch(() => {});
      }
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Focus input when drawer opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  // Handle pending message from other pages
  useEffect(() => {
    if (isOpen && pendingMessage && !loading) {
      sendMessage(pendingMessage);
      clearPendingMessage();
    }
  }, [isOpen, pendingMessage]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Fetch context entities when messages change
  useEffect(() => {
    fetchContextFromMessages(messages);
  }, [messages]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchContextFromMessages = async (msgs: BenchTalkMessage[]) => {
    const allPlayerIds = new Set<string>();
    const allReportIds = new Set<string>();

    for (const msg of msgs) {
      if (msg.role === "assistant" && msg.metadata) {
        try {
          const meta = typeof msg.metadata === "string" ? JSON.parse(msg.metadata) : msg.metadata;
          if (meta.player_ids) meta.player_ids.forEach((id: string) => allPlayerIds.add(id));
          if (meta.report_ids) meta.report_ids.forEach((id: string) => allReportIds.add(id));
        } catch {
          // metadata may not be valid JSON
        }
      }
    }

    if (allPlayerIds.size === 0 && allReportIds.size === 0) {
      setContextPlayers([]);
      setContextReports([]);
      return;
    }

    try {
      const res = await api.post<BenchTalkContextResponse>("/bench-talk/context", {
        player_ids: Array.from(allPlayerIds),
        report_ids: Array.from(allReportIds),
      });
      setContextPlayers(res.data.players || []);
      setContextReports(res.data.reports || []);
    } catch {
      // Silently fail — context is optional
    }
  };

  const loadConversations = async () => {
    try {
      const res = await api.get("/bench-talk/conversations");
      setConversations(res.data);
    } catch (err) {
      console.error("Failed to load conversations:", err);
    }
  };

  const loadSuggestions = async () => {
    try {
      const res = await api.get("/bench-talk/suggestions");
      setSuggestions(res.data.suggestions || []);
    } catch {
      setSuggestions([
        { text: "Show me GOHL scoring leaders", icon: "trophy" },
        { text: "Find all centers on the Chatham Maroons", icon: "search" },
        { text: "Compare two players side by side", icon: "compare" },
      ]);
    }
  };

  const loadMessages = useCallback(async (convId: string) => {
    try {
      const res = await api.get(`/bench-talk/conversations/${convId}`);
      setMessages(res.data.messages || []);
    } catch (err) {
      console.error("Failed to load messages:", err);
    }
  }, []);

  const selectConversation = useCallback((convId: string) => {
    setActiveConvId(convId);
    loadMessages(convId);
    setSidebarTab("context");
  }, [loadMessages]);

  const createNewConversation = async () => {
    try {
      const res = await api.post("/bench-talk/conversations");
      const newConvId = res.data.conversation_id;
      setActiveConvId(newConvId);
      setMessages([]);
      setContextPlayers([]);
      setContextReports([]);
      await loadConversations();
      inputRef.current?.focus();
    } catch (err) {
      console.error("Failed to create conversation:", err);
    }
  };

  const deleteConversation = async (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.delete(`/bench-talk/conversations/${convId}`);
      if (activeConvId === convId) {
        setActiveConvId(null);
        setMessages([]);
        setContextPlayers([]);
        setContextReports([]);
      }
      await loadConversations();
    } catch (err) {
      console.error("Failed to delete conversation:", err);
    }
  };

  const sendMessage = async (text?: string) => {
    const messageText = text || input.trim();
    if (!messageText || loading) return;

    let convId = activeConvId;
    if (!convId) {
      try {
        const res = await api.post("/bench-talk/conversations");
        convId = res.data.conversation_id;
        setActiveConvId(convId);
      } catch {
        return;
      }
    }

    const tempUserMsg: BenchTalkMessage = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: messageText,
      metadata: null,
      tokens_used: 0,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, tempUserMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await api.post<BenchTalkMessageResponse>(
        `/bench-talk/conversations/${convId}/messages`,
        { message: messageText, mode: currentMode }
      );
      setMessages((prev) => [...prev, res.data.message]);
      loadConversations();
    } catch (err: any) {
      // Check for 429 usage limit
      if (err?.response?.status === 429) {
        const detail = err.response.data?.detail;
        const used = detail?.used || 0;
        const limit = detail?.limit || 0;
        setMessages((prev) => [
          ...prev,
          {
            id: `limit-${Date.now()}`,
            role: "assistant",
            content: `You've reached your monthly Bench Talk limit (${used}/${limit} messages). [Upgrade your plan](/pricing) to keep the conversation going.`,
            metadata: null,
            tokens_used: 0,
            created_at: new Date().toISOString(),
          },
        ]);
        setUpgradeModal({ open: true, used, limit });
      } else {
        console.error("Bench Talk message error:", err);
        setMessages((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            role: "assistant",
            content: "I'm sorry, something went wrong. Please try again.",
            metadata: null,
            tokens_used: 0,
            created_at: new Date().toISOString(),
          },
        ]);
      }
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const submitFeedback = async (messageId: string, rating: string) => {
    try {
      await api.post("/bench-talk/feedback", { message_id: messageId, rating });
      setFeedbackGiven((prev) => ({ ...prev, [messageId]: rating }));
    } catch (err) {
      console.error("Feedback error:", err);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const isNewConversation = messages.length === 0 && !loading;
  const hasContext = contextPlayers.length > 0 || contextReports.length > 0;

  return (
    <>
      {/* ── Side Tab Handle (visible when closed) ── */}
      {!isOpen && (
        <button
          onClick={toggleBenchTalk}
          className="fixed right-0 top-1/2 -translate-y-1/2 z-[60] bg-gradient-to-b from-teal to-navy text-white pl-1.5 pr-1 py-3 rounded-l-xl shadow-lg hover:shadow-xl hover:pl-2.5 transition-all group"
          title="Open Bench Talk"
        >
          <div className="flex flex-col items-center gap-0.5">
            <PXIBadge size={28} variant="dark" showDot={true} className="group-hover:scale-110 transition-transform" />
          </div>
        </button>
      )}

      {/* ── Panel (full viewport height, overlays everything) ── */}
      <div
        className={`fixed top-0 right-0 bottom-0 z-[60] w-full sm:w-[480px] bg-bg border-l border-teal/20 shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* ── Header ── */}
        <div className="bg-navy px-4 py-3 flex items-center gap-3 shrink-0">
          <PXIBadge size={36} variant="dark" showDot={true} />
          <div className="flex-1">
            <h2 className="font-oswald font-bold text-white text-sm uppercase tracking-wider">Bench Talk</h2>
            <p className="text-[10px] text-white/40">Let&apos;s talk hockey.</p>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={createNewConversation}
              className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              title="New conversation"
            >
              <Plus size={16} />
            </button>
            <button
              onClick={closeBenchTalk}
              className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              title="Close Bench Talk"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ── PXI Mode Pill Bar ── */}
        <ModePillBar
          pxiModes={pxiModes}
          currentMode={currentMode}
          onModeChange={(modeId) => {
            setCurrentMode(modeId);
            if (activeConvId) {
              api.put(`/bench-talk/conversations/${activeConvId}/mode`, { mode: modeId }).catch(() => {});
            }
          }}
          roleGroup={getRoleGroup(effectiveHockeyRole)}
        />

        {/* ── Context / History Bar (collapsible) ── */}
        <div className="bg-white border-b border-teal/20 shrink-0">
          <div className="flex">
            <button
              onClick={() => { setSidebarTab("context"); setSidebarOpen(sidebarTab === "context" ? !sidebarOpen : true); }}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-[11px] font-medium transition-colors ${
                sidebarOpen && sidebarTab === "context"
                  ? "text-teal border-b-2 border-teal"
                  : "text-muted hover:text-navy"
              }`}
            >
              <Layers size={12} />
              Context
              {hasContext && (
                <span className="w-4 h-4 rounded-full bg-teal/10 text-teal text-[9px] flex items-center justify-center font-bold">
                  {contextPlayers.length + contextReports.length}
                </span>
              )}
            </button>
            <button
              onClick={() => { setSidebarTab("history"); setSidebarOpen(sidebarTab === "history" ? !sidebarOpen : true); }}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-[11px] font-medium transition-colors ${
                sidebarOpen && sidebarTab === "history"
                  ? "text-teal border-b-2 border-teal"
                  : "text-muted hover:text-navy"
              }`}
            >
              <History size={12} />
              History
              {conversations.length > 0 && (
                <span className="w-4 h-4 rounded-full bg-navy/5 text-muted text-[9px] flex items-center justify-center font-bold">
                  {conversations.length}
                </span>
              )}
            </button>
          </div>

          {/* Tab Content — only shown when expanded */}
          {sidebarOpen && (
            <div className="max-h-[180px] overflow-y-auto border-t border-teal/10">
              {sidebarTab === "context" ? (
                <div className="p-2 space-y-1.5">
                  {!hasContext ? (
                    <p className="text-[11px] text-muted text-center py-2">
                      Referenced players and reports appear here as you chat.
                    </p>
                  ) : (
                    <>
                      {contextPlayers.map((player) => (
                        <CompactPlayerCard key={player.id} player={player} />
                      ))}
                      {contextReports.map((report) => (
                        <CompactReportCard key={report.id} report={report} />
                      ))}
                    </>
                  )}
                </div>
              ) : (
                <div>
                  {conversations.length === 0 ? (
                    <p className="text-[11px] text-muted text-center py-2">
                      No conversations yet.
                    </p>
                  ) : (
                    conversations.map((conv) => (
                      <button
                        key={conv.id}
                        onClick={() => { selectConversation(conv.id); setSidebarOpen(false); }}
                        className={`w-full text-left px-3 py-2 border-b border-teal/10 hover:bg-navy/[0.02] transition-colors group ${
                          activeConvId === conv.id ? "bg-teal/5 border-l-2 border-l-teal" : ""
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-semibold text-navy truncate">{conv.title}</p>
                            {conv.last_message && (
                              <p className="text-[10px] text-muted truncate mt-0.5">{conv.last_message}</p>
                            )}
                          </div>
                          <button
                            onClick={(e) => deleteConversation(conv.id, e)}
                            className="opacity-0 group-hover:opacity-100 p-0.5 text-muted hover:text-red-500 transition-all shrink-0"
                            title="Delete conversation"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Chat Area ── */}
        <div className="flex-1 overflow-y-auto">
          {isNewConversation ? (
            /* Welcome Screen — themed per role */
            (() => {
              const user = getUser();
              const rg = getRoleGroup(effectiveHockeyRole);
              const theme = BENCH_TALK_THEMES[rg];
              const name = user?.first_name || "there";
              const displaySuggestions = suggestions.length > 0 ? suggestions : theme.fallbackSuggestions.map((s) => ({ ...s, text: s.text }));
              return (
            <div className="flex flex-col items-center justify-center h-full px-4">
              <div className="mb-4 drop-shadow-lg">
                <PXIBadge size={56} variant="dark" showDot={true} />
              </div>
              <h2 className="font-oswald text-lg font-bold text-navy tracking-wider uppercase mb-1" suppressHydrationWarning>
                Hey {name}
              </h2>
              <p className="text-muted text-xs text-center mb-2 max-w-sm">
                {theme.greeting}
              </p>
              <p className="text-navy/70 text-xs text-center mb-6 max-w-sm font-medium italic">
                {theme.question}
              </p>

              <div className={`grid gap-1.5 w-full max-w-md ${displaySuggestions.length > 4 ? "grid-cols-2" : "grid-cols-1 max-w-sm"}`}>
                {displaySuggestions.slice(0, 6).map((s, i) => {
                  const Icon = SUGGESTION_ICONS[s.icon] || Sparkles;
                  return (
                    <button
                      key={i}
                      onClick={() => sendMessage(s.text)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border border-teal/20 bg-white hover:bg-teal/5 hover:${theme.pillBorderActive} transition-all text-left group`}
                    >
                      <Icon size={14} className="text-teal shrink-0 group-hover:scale-110 transition-transform" />
                      <span className="text-[11px] text-navy leading-tight">{s.text}</span>
                    </button>
                  );
                })}
              </div>
            </div>
              );
            })()
          ) : (
            /* Message List */
            <div className="p-3 space-y-3">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "assistant" && (
                    <div className="mr-1.5 mt-1 shrink-0">
                      <PXIBadge size={32} variant="dark" showDot={false} />
                    </div>
                  )}
                  <div className={`max-w-[85%] ${msg.role === "user" ? "" : "flex-1 min-w-0"}`}>
                    {/* Mode badge on PXI responses */}
                    {msg.role === "assistant" && (
                      <div className="flex items-center gap-1.5 mb-1 ml-0.5">
                        <span className="text-[9px] font-oswald font-bold text-teal tracking-wider">PXI</span>
                        <span className={`text-[8px] font-oswald font-bold tracking-wider px-1.5 py-0.5 rounded-full ${BENCH_TALK_THEMES[getRoleGroup(effectiveHockeyRole)].modeBadgeColor}`}>
                          {MODE_LABELS[currentMode] || "SCOUT"}
                        </span>
                      </div>
                    )}
                    <div
                      className={`rounded-xl px-3 py-2.5 ${
                        msg.role === "user"
                          ? "bg-navy text-white"
                          : "bg-white border border-teal/20 shadow-sm"
                      }`}
                    >
                      {msg.role === "user" ? (
                        <p className="text-sm">{msg.content}</p>
                      ) : (
                        <BenchTalkMessageContent content={msg.content} />
                      )}
                    </div>

                    {/* Feedback buttons */}
                    {msg.role === "assistant" &&
                      !msg.id.startsWith("temp-") &&
                      !msg.id.startsWith("error-") &&
                      !msg.id.startsWith("limit-") && (
                        <div className="flex items-center gap-1.5 mt-1 ml-1">
                          <button
                            onClick={() => submitFeedback(msg.id, "positive")}
                            disabled={!!feedbackGiven[msg.id]}
                            className={`p-0.5 rounded transition-colors ${
                              feedbackGiven[msg.id] === "positive"
                                ? "text-green-600"
                                : "text-muted/40 hover:text-green-600"
                            }`}
                          >
                            <ThumbsUp size={11} />
                          </button>
                          <button
                            onClick={() => submitFeedback(msg.id, "negative")}
                            disabled={!!feedbackGiven[msg.id]}
                            className={`p-0.5 rounded transition-colors ${
                              feedbackGiven[msg.id] === "negative"
                                ? "text-red-500"
                                : "text-muted/40 hover:text-red-500"
                            }`}
                          >
                            <ThumbsDown size={11} />
                          </button>
                          {msg.tokens_used > 0 && (
                            <span className="text-[8px] text-muted/30 ml-0.5">
                              {msg.tokens_used.toLocaleString()} tokens
                            </span>
                          )}
                        </div>
                      )}
                  </div>
                </div>
              ))}

              {/* Typing indicator */}
              {loading && (
                <div className="flex justify-start">
                  <div className="mr-1.5 mt-1 shrink-0">
                    <PXIBadge size={32} variant="dark" showDot={false} />
                  </div>
                  <div className="bg-white border border-teal/20 rounded-xl px-3 py-2 shadow-sm">
                    <div className="flex flex-col items-start gap-1">
                      <HockeyRink size="chat" />
                      <span className="text-[10px] font-oswald uppercase tracking-wider text-muted/70">PXI is scanning...</span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* ── Input Bar ── */}
        <div className="bg-navy p-3 shrink-0">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask Bench Talk about players, stats, or reports..."
                rows={1}
                className="w-full resize-none border-2 border-teal/40 rounded-xl px-3 py-2.5 text-sm text-navy placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal transition-all bg-white"
                disabled={loading}
                style={{ minHeight: "42px", maxHeight: "100px" }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = "auto";
                  target.style.height = Math.min(target.scrollHeight, 100) + "px";
                }}
              />
            </div>
            <button
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
              className={`p-2.5 text-white rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0 ${BENCH_TALK_THEMES[getRoleGroup(effectiveHockeyRole)].accentColor} ${BENCH_TALK_THEMES[getRoleGroup(effectiveHockeyRole)].accentHover}`}
              title="Send message"
            >
              <Send size={16} />
            </button>
          </div>
          <p className="text-[9px] text-white/25 text-center mt-1.5">
            Bench Talk uses AI to analyze your scouting data. Responses may occasionally be inaccurate.
          </p>
        </div>
      </div>

      {/* Upgrade Modal */}
      <UpgradeModal
        isOpen={upgradeModal.open}
        onClose={() => setUpgradeModal({ ...upgradeModal, open: false })}
        limitType="bench_talk"
        currentTier={getUser()?.subscription_tier || "rookie"}
        used={upgradeModal.used}
        limit={upgradeModal.limit}
      />
    </>
  );
}
