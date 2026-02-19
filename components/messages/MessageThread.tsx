"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Loader2, Shield, Lock, Ban, MoreVertical } from "lucide-react";
import type { Conversation, Message } from "@/types/api";

interface MessageThreadProps {
  conversation: Conversation;
  messages: Message[];
  onSendMessage: (content: string) => void;
  onBlockUser: () => void;
  isLoading: boolean;
  isSending: boolean;
  currentUserId: string;
  isParentViewing?: boolean;
  playerName?: string;
}

export default function MessageThread({
  conversation,
  messages,
  onSendMessage,
  onBlockUser,
  isLoading,
  isSending,
  currentUserId,
  isParentViewing,
  playerName,
}: MessageThreadProps) {
  const [draft, setDraft] = useState("");
  const [showMenu, setShowMenu] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Close menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function handleSend() {
    const text = draft.trim();
    if (!text) return;
    onSendMessage(text);
    setDraft("");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const otherParticipants = conversation.participants.filter(
    (p) => p.user_id !== currentUserId
  );
  const headerName =
    otherParticipants.length > 0
      ? otherParticipants.map((p) => p.name).join(", ")
      : "Conversation";
  const headerRole = otherParticipants.length > 0 ? otherParticipants[0]?.role : "";
  const headerOrg = otherParticipants.length > 0 ? otherParticipants[0]?.org_name : "";

  const isBlocked = conversation.status === "blocked";
  const isPending = conversation.status === "pending_approval";

  function formatMessageTime(dateStr: string) {
    return new Date(dateStr).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function formatDateHeader(dateStr: string) {
    const d = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return "Today";
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
  }

  // Group messages by date
  const messagesByDate: { date: string; messages: Message[] }[] = [];
  const sorted = [...messages].sort(
    (a, b) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime()
  );

  for (const msg of sorted) {
    const dateKey = new Date(msg.sent_at).toDateString();
    const existing = messagesByDate.find((g) => g.date === dateKey);
    if (existing) {
      existing.messages.push(msg);
    } else {
      messagesByDate.push({ date: dateKey, messages: [msg] });
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-white">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-navy truncate">{headerName}</h3>
            {headerRole && (
              <span className="text-[9px] font-oswald uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-navy/10 text-navy/50">
                {headerRole}
              </span>
            )}
          </div>
          {headerOrg && (
            <p className="text-[10px] text-muted/50 mt-0.5">{headerOrg}</p>
          )}
        </div>

        {/* Actions menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1.5 rounded-lg hover:bg-background transition-colors"
          >
            <MoreVertical size={14} className="text-muted/50" />
          </button>
          {showMenu && (
            <div className="absolute right-0 mt-1 w-44 bg-white border border-border rounded-lg shadow-lg z-50 overflow-hidden">
              <button
                onClick={() => {
                  onBlockUser();
                  setShowMenu(false);
                }}
                className="w-full text-left px-3 py-2 text-xs text-red-500 hover:bg-red-50 transition-colors flex items-center gap-2"
              >
                <Ban size={12} />
                Block &amp; Report
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Parent visibility notice */}
      {isParentViewing && playerName && (
        <div className="px-4 py-2 bg-[#3B6B8A]/5 border-b border-[#3B6B8A]/10 flex items-center gap-2">
          <Shield size={12} className="text-[#3B6B8A]" />
          <p className="text-[10px] text-[#3B6B8A]">
            You can see this conversation because <strong>{playerName}</strong> is your linked player.
          </p>
        </div>
      )}

      {/* Status banners */}
      {isBlocked && (
        <div className="px-4 py-2 bg-red-50 border-b border-red-100 flex items-center gap-2">
          <Lock size={12} className="text-red-500" />
          <p className="text-[10px] text-red-600 font-medium">This conversation has been blocked.</p>
        </div>
      )}
      {isPending && (
        <div className="px-4 py-2 bg-orange/5 border-b border-orange/10 flex items-center gap-2">
          <Shield size={12} className="text-orange" />
          <p className="text-[10px] text-orange font-medium">Waiting for parental approval.</p>
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={20} className="text-teal animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-xs text-muted/50">No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messagesByDate.map((group) => (
            <div key={group.date}>
              {/* Date separator */}
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-border" />
                <span className="text-[10px] text-muted/40 font-medium">
                  {formatDateHeader(group.messages[0].sent_at)}
                </span>
                <div className="flex-1 h-px bg-border" />
              </div>

              {group.messages.map((msg) => {
                const isOwn = msg.sender_id === currentUserId;
                const isSystem = msg.is_system_message;

                if (isSystem) {
                  return (
                    <div key={msg.id} className="flex justify-center my-3">
                      <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-background">
                        <Shield size={10} className="text-teal" />
                        <span className="text-[10px] text-muted/60 italic">{msg.content}</span>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={msg.id}
                    className={`flex mb-2 ${isOwn ? "justify-end" : "justify-start"}`}
                  >
                    <div className={`max-w-[75%] ${isOwn ? "items-end" : "items-start"}`}>
                      {/* Sender name (not own) */}
                      {!isOwn && (
                        <p className="text-[10px] text-muted/50 mb-0.5 ml-1">
                          {msg.sender_name}
                        </p>
                      )}
                      <div
                        className={`px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                          isOwn
                            ? "bg-teal text-white rounded-br-md"
                            : "bg-background text-navy rounded-bl-md"
                        }`}
                      >
                        <p className="text-xs whitespace-pre-wrap">{msg.content}</p>
                      </div>
                      <p
                        className={`text-[9px] text-muted/40 mt-0.5 ${
                          isOwn ? "text-right mr-1" : "ml-1"
                        }`}
                      >
                        {formatMessageTime(msg.sent_at)}
                        {isOwn && msg.read_at && " · Read"}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      {!isBlocked && !isPending && (
        <div className="px-4 py-3 border-t border-border bg-white">
          <div className="flex items-end gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              rows={1}
              className="flex-1 resize-none px-3 py-2 text-xs bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-teal/30 max-h-24"
            />
            <button
              onClick={handleSend}
              disabled={!draft.trim() || isSending}
              className="p-2 rounded-lg bg-teal text-white hover:bg-teal/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              {isSending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Send size={14} />
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
