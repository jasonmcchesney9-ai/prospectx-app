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
} from "lucide-react";
import api, { assetUrl, hasRealImage } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { useBenchTalk } from "./BenchTalkProvider";
import PXIIcon from "./PXIIcon";
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

// ── Suggestion Icons ─────────────────────────────────────────
const SUGGESTION_ICONS: Record<string, React.ElementType> = {
  trophy: Trophy,
  search: Search,
  compare: GitCompareArrows,
  shield: Shield,
  file: FileText,
  brain: Brain,
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
      className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-white border border-border hover:border-teal/30 hover:shadow-sm transition-all"
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
      className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-white border border-border hover:border-teal/30 hover:shadow-sm transition-all"
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

// ── Main Bench Talk Drawer ──────────────────────────────────
export default function BenchTalkDrawer() {
  const { isOpen, toggleBenchTalk, closeBenchTalk, pendingMessage, clearPendingMessage } = useBenchTalk();

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
            <PXIIcon size={28} className="group-hover:scale-110 transition-transform" />
          </div>
        </button>
      )}

      {/* ── Panel (full viewport height, overlays everything) ── */}
      <div
        className={`fixed top-0 right-0 bottom-0 z-[60] w-full sm:w-[480px] bg-bg border-l border-border shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* ── Header ── */}
        <div className="bg-navy px-4 py-3 flex items-center gap-3 shrink-0">
          <PXIIcon size={36} />
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

        {/* ── PXI Mode Selector ── */}
        {pxiModes.length > 0 && (
          <div className="bg-white border-b border-border px-2 py-1.5 shrink-0 flex items-center gap-1 overflow-x-auto"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {pxiModes.map((m) => (
              <button
                key={m.id}
                onClick={() => {
                  setCurrentMode(m.id);
                  // Persist to conversation if active
                  if (activeConvId) {
                    api.put(`/bench-talk/conversations/${activeConvId}/mode`, { mode: m.id }).catch(() => {});
                  }
                }}
                className={`px-2.5 py-1 rounded-full text-[10px] font-oswald uppercase tracking-wider whitespace-nowrap transition-colors ${
                  currentMode === m.id
                    ? "bg-teal text-white"
                    : "bg-gray-100 text-muted hover:text-navy hover:bg-gray-200"
                }`}
                title={`${m.name} — ${m.key_output}`}
              >
                {m.name}
              </button>
            ))}
          </div>
        )}

        {/* ── Context / History Bar (collapsible) ── */}
        <div className="bg-white border-b border-border shrink-0">
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
            <div className="max-h-[180px] overflow-y-auto border-t border-border/50">
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
                        className={`w-full text-left px-3 py-2 border-b border-border/50 hover:bg-navy/[0.02] transition-colors group ${
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
            /* Welcome Screen */
            <div className="flex flex-col items-center justify-center h-full px-4">
              <div className="mb-4 drop-shadow-lg">
                <PXIIcon size={72} />
              </div>
              <h2 className="font-oswald text-lg font-bold text-navy tracking-wider uppercase mb-1">
                {(() => {
                  const user = getUser();
                  const name = user?.first_name || "there";
                  return `Hey ${name}`;
                })()}
              </h2>
              <p className="text-muted text-xs text-center mb-6 max-w-sm">
                {(() => {
                  const user = getUser();
                  const modeTaglines: Record<string, string> = {
                    scout: "Ready to find the next gem? Let\u2019s dig into prospects, stats, and reports.",
                    gm: "Let\u2019s build something. Roster moves, trade targets, or the big picture.",
                    coach: "Game prep, line combos, or systems fit \u2014 what are we working on?",
                    player: "Let\u2019s level up your game. Stats, development, or see how you stack up.",
                    parent: "I\u2019m here to help you understand the game. Ask me anything.",
                    analyst: "Let\u2019s dig into the numbers. Trends, benchmarks, and what the data really says.",
                    agent: "Pathways, exposure, and positioning. Let\u2019s map out the plan.",
                    skill_coach: "Cues, drills, and progressions. What are we working on today?",
                    mental_coach: "Reset routines, focus, and confidence. Let\u2019s build the mental game.",
                    broadcast: "Storylines, talk tracks, and the angles that make great broadcasts.",
                    producer: "Rundowns, replay triggers, and graphics. Let\u2019s build the show.",
                  };
                  return modeTaglines[currentMode] || modeTaglines.scout;
                })()}
              </p>

              <div className={`grid gap-1.5 w-full max-w-md ${suggestions.length > 4 ? "grid-cols-2" : "grid-cols-1 max-w-sm"}`}>
                {suggestions.slice(0, 6).map((s, i) => {
                  const Icon = SUGGESTION_ICONS[s.icon] || Sparkles;
                  return (
                    <button
                      key={i}
                      onClick={() => sendMessage(s.text)}
                      className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border bg-white hover:bg-teal/5 hover:border-teal/30 transition-all text-left group"
                    >
                      <Icon size={14} className="text-teal shrink-0 group-hover:scale-110 transition-transform" />
                      <span className="text-[11px] text-navy leading-tight">{s.text}</span>
                    </button>
                  );
                })}
              </div>
            </div>
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
                      <PXIIcon size={24} />
                    </div>
                  )}
                  <div className={`max-w-[85%] ${msg.role === "user" ? "" : "flex-1 min-w-0"}`}>
                    <div
                      className={`rounded-xl px-3 py-2.5 ${
                        msg.role === "user"
                          ? "bg-navy text-white"
                          : "bg-white border border-border shadow-sm"
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
                    <PXIIcon size={24} />
                  </div>
                  <div className="bg-white border border-border rounded-xl px-3 py-2.5 shadow-sm">
                    <div className="flex items-center gap-2">
                      <Loader2 size={13} className="animate-spin text-teal" />
                      <span className="text-xs text-muted">Bench Talk is thinking...</span>
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
              className="p-2.5 bg-teal text-white rounded-xl hover:bg-teal/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
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
