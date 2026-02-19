"use client";

import { useState } from "react";
import { Search, Plus, MessageSquare, ChevronDown, ChevronUp, Bell } from "lucide-react";
import type { Conversation, ContactRequest } from "@/types/api";
import ContactRequestCard from "./ContactRequestCard";

interface ConversationListProps {
  conversations: Conversation[];
  contactRequests: ContactRequest[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewMessage: () => void;
  onApproveRequest: (id: string) => void;
  onDenyRequest: (id: string) => void;
  requestLoading: boolean;
  isParentOrAdmin: boolean;
}

export default function ConversationList({
  conversations,
  contactRequests,
  activeConversationId,
  onSelectConversation,
  onNewMessage,
  onApproveRequest,
  onDenyRequest,
  requestLoading,
  isParentOrAdmin,
}: ConversationListProps) {
  const [search, setSearch] = useState("");
  const [requestsExpanded, setRequestsExpanded] = useState(true);

  const pendingRequests = contactRequests.filter((r) => r.status === "pending");

  const filtered = conversations.filter((conv) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return conv.participants.some(
      (p) => p.name.toLowerCase().includes(q) || p.role.toLowerCase().includes(q)
    );
  });

  function formatTime(dateStr: string) {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const hours = diff / (1000 * 60 * 60);
    if (hours < 1) return `${Math.max(1, Math.round(diff / 60000))}m ago`;
    if (hours < 24) return `${Math.round(hours)}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-oswald text-sm font-bold text-navy uppercase tracking-wider">Messages</h2>
          <button
            onClick={onNewMessage}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal text-white text-xs font-bold hover:bg-teal/90 transition-colors"
          >
            <Plus size={12} />
            New
          </button>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted/40" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversations..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-teal/30"
          />
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* Pending Requests (parents/admins only) */}
        {isParentOrAdmin && pendingRequests.length > 0 && (
          <div className="border-b border-border">
            <button
              onClick={() => setRequestsExpanded(!requestsExpanded)}
              className="w-full flex items-center justify-between px-3 py-2 bg-orange/5 hover:bg-orange/10 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Bell size={12} className="text-orange" />
                <span className="text-xs font-bold text-orange">
                  Pending Requests ({pendingRequests.length})
                </span>
              </div>
              {requestsExpanded ? (
                <ChevronUp size={12} className="text-orange" />
              ) : (
                <ChevronDown size={12} className="text-orange" />
              )}
            </button>

            {requestsExpanded && (
              <div className="p-2 space-y-2">
                {pendingRequests.map((req) => (
                  <ContactRequestCard
                    key={req.id}
                    request={req}
                    onApprove={onApproveRequest}
                    onDeny={onDenyRequest}
                    isLoading={requestLoading}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Conversation list */}
        {filtered.length === 0 ? (
          <div className="p-6 text-center">
            <MessageSquare size={24} className="mx-auto text-muted/30 mb-2" />
            <p className="text-xs text-muted/60">
              {conversations.length === 0 ? "No conversations yet" : "No matches found"}
            </p>
          </div>
        ) : (
          <div>
            {filtered.map((conv) => {
              const isActive = conv.id === activeConversationId;
              const otherParticipants = conv.participants.filter(
                (p) => conv.participant_ids.length <= 2 || p.user_id !== conv.participant_ids[0]
              );
              const displayName =
                otherParticipants.length > 0
                  ? otherParticipants.map((p) => p.name).join(", ")
                  : "Unknown";
              const displayRole =
                otherParticipants.length > 0 ? otherParticipants[0]?.role : "";

              return (
                <button
                  key={conv.id}
                  onClick={() => onSelectConversation(conv.id)}
                  className={`w-full text-left px-3 py-3 border-b border-border/50 transition-colors ${
                    isActive
                      ? "bg-teal/5 border-l-2 border-l-teal"
                      : "hover:bg-background"
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    {/* Avatar */}
                    <div className="w-8 h-8 rounded-full bg-navy/10 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-[10px] font-bold text-navy/50 uppercase">
                        {displayName.charAt(0)}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-sm font-bold text-navy truncate">{displayName}</span>
                          {displayRole && (
                            <span className="text-[9px] font-oswald uppercase tracking-wider px-1 py-0.5 rounded bg-navy/5 text-navy/40 shrink-0">
                              {displayRole}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-muted/50 shrink-0 ml-2">
                          {formatTime(conv.updated_at)}
                        </span>
                      </div>

                      {/* Last message preview */}
                      {conv.last_message && (
                        <p className="text-[11px] text-muted/70 truncate mt-0.5">
                          {conv.last_message.is_system_message ? (
                            <span className="italic">{conv.last_message.content}</span>
                          ) : (
                            conv.last_message.content
                          )}
                        </p>
                      )}

                      {/* Status badges */}
                      <div className="flex items-center gap-1.5 mt-1">
                        {conv.status === "blocked" && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-50 text-red-500 font-bold">
                            Blocked
                          </span>
                        )}
                        {conv.status === "pending_approval" && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-orange/10 text-orange font-bold">
                            Pending
                          </span>
                        )}
                        {conv.unread_count > 0 && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-teal text-white font-bold">
                            {conv.unread_count}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
