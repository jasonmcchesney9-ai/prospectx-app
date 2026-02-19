"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import toast from "react-hot-toast";
import { MessageSquare, ArrowLeft } from "lucide-react";
import ProtectedRoute from "@/components/ProtectedRoute";
import SafetyBanner from "@/components/messages/SafetyBanner";
import ConversationList from "@/components/messages/ConversationList";
import MessageThread from "@/components/messages/MessageThread";
import NewMessageModal from "@/components/messages/NewMessageModal";
import BlockReportModal from "@/components/messages/BlockReportModal";
import api from "@/lib/api";
import { getUser } from "@/lib/auth";
import type { Conversation, Message, ContactRequest } from "@/types/api";

export default function MessagesPage() {
  const user = getUser();
  const currentUserId = user?.id || "";
  const hockeyRole = user?.hockey_role || "";
  const isParentOrAdmin = hockeyRole === "parent" || user?.role === "admin";

  // Core state
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [contactRequests, setContactRequests] = useState<ContactRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [requestLoading, setRequestLoading] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);

  // Modals
  const [showNewMessage, setShowNewMessage] = useState(false);
  const [showBlockReport, setShowBlockReport] = useState(false);

  // Mobile: show thread vs list
  const [mobileShowThread, setMobileShowThread] = useState(false);

  // Polling refs
  const convPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const msgPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const activeConversation = conversations.find((c) => c.id === activeConversationId) || null;

  // ── Fetch conversations ────────────────────────────
  const fetchConversations = useCallback(async () => {
    try {
      const res = await api.get("/api/messages/conversations");
      setConversations(res.data || []);
    } catch (err) {
      console.error("Failed to fetch conversations:", err);
    }
  }, []);

  // ── Fetch contact requests ─────────────────────────
  const fetchContactRequests = useCallback(async () => {
    if (!isParentOrAdmin) return;
    try {
      const res = await api.get("/api/messages/contact-requests");
      setContactRequests(res.data || []);
    } catch (err) {
      console.error("Failed to fetch contact requests:", err);
    }
  }, [isParentOrAdmin]);

  // ── Fetch messages for active conversation ─────────
  const fetchMessages = useCallback(async (convId: string) => {
    try {
      const res = await api.get(`/api/messages/${convId}`);
      setMessages(res.data || []);
    } catch (err) {
      console.error("Failed to fetch messages:", err);
    }
  }, []);

  // ── Initial load ───────────────────────────────────
  useEffect(() => {
    async function init() {
      setLoading(true);
      await Promise.all([fetchConversations(), fetchContactRequests()]);
      setLoading(false);
    }
    init();
  }, [fetchConversations, fetchContactRequests]);

  // ── Conversation polling (15s) ─────────────────────
  useEffect(() => {
    convPollRef.current = setInterval(() => {
      fetchConversations();
      fetchContactRequests();
    }, 15000);
    return () => {
      if (convPollRef.current) clearInterval(convPollRef.current);
    };
  }, [fetchConversations, fetchContactRequests]);

  // ── Message polling (5s when conversation open) ────
  useEffect(() => {
    if (msgPollRef.current) clearInterval(msgPollRef.current);
    if (!activeConversationId) return;

    msgPollRef.current = setInterval(() => {
      fetchMessages(activeConversationId);
    }, 5000);

    return () => {
      if (msgPollRef.current) clearInterval(msgPollRef.current);
    };
  }, [activeConversationId, fetchMessages]);

  // ── Select conversation ────────────────────────────
  async function handleSelectConversation(convId: string) {
    setActiveConversationId(convId);
    setMobileShowThread(true);
    setMessagesLoading(true);
    await fetchMessages(convId);
    setMessagesLoading(false);
  }

  // ── Send message ───────────────────────────────────
  async function handleSendMessage(content: string) {
    if (!activeConversationId) return;
    setIsSending(true);
    try {
      await api.post("/api/messages/send", {
        conversation_id: activeConversationId,
        content,
      });
      await fetchMessages(activeConversationId);
      await fetchConversations();
    } catch (err) {
      console.error("Failed to send message:", err);
    } finally {
      setIsSending(false);
    }
  }

  // ── New message (direct) ───────────────────────────
  async function handleNewMessageSend(recipientId: string, content: string) {
    setIsSending(true);
    try {
      const res = await api.post("/api/messages/send", {
        recipient_id: recipientId,
        content,
      });
      setShowNewMessage(false);
      await fetchConversations();
      // Select the new/existing conversation
      if (res.data?.conversation_id) {
        await handleSelectConversation(res.data.conversation_id);
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      if (error.response?.data?.detail === "approval_required") {
        toast.error("This contact requires parental approval. Please send a contact request instead.");
      } else {
        console.error("Failed to send message:", err);
      }
    } finally {
      setIsSending(false);
    }
  }

  // ── Contact request ────────────────────────────────
  async function handleContactRequest(targetPlayerId: string, message: string) {
    setIsSending(true);
    try {
      await api.post("/api/messages/contact-request", {
        target_player_id: targetPlayerId,
        message,
      });
      setShowNewMessage(false);
      toast.success("Contact request sent. You'll be notified when it's reviewed.");
    } catch (err) {
      console.error("Failed to send contact request:", err);
    } finally {
      setIsSending(false);
    }
  }

  // ── Approve/Deny requests ──────────────────────────
  async function handleApproveRequest(requestId: string) {
    setRequestLoading(true);
    try {
      await api.put(`/api/messages/contact-requests/${requestId}`, { status: "approved" });
      await Promise.all([fetchContactRequests(), fetchConversations()]);
    } catch (err) {
      console.error("Failed to approve request:", err);
    } finally {
      setRequestLoading(false);
    }
  }

  async function handleDenyRequest(requestId: string) {
    setRequestLoading(true);
    try {
      await api.put(`/api/messages/contact-requests/${requestId}`, { status: "denied" });
      await fetchContactRequests();
    } catch (err) {
      console.error("Failed to deny request:", err);
    } finally {
      setRequestLoading(false);
    }
  }

  // ── Block user ─────────────────────────────────────
  async function handleBlockSubmit(reason: string, _action: "block" | "report" | "both") {
    if (!activeConversation) return;
    const otherParticipant = activeConversation.participants.find(
      (p) => p.user_id !== currentUserId
    );
    if (!otherParticipant) return;

    setBlockLoading(true);
    try {
      await api.post("/api/messages/block", {
        blocked_id: otherParticipant.user_id,
        reason,
      });
      setShowBlockReport(false);
      await fetchConversations();
      if (activeConversationId) {
        await fetchMessages(activeConversationId);
      }
    } catch (err) {
      console.error("Failed to block user:", err);
    } finally {
      setBlockLoading(false);
    }
  }

  // ── Get other participant name for block modal ─────
  const blockTargetName = activeConversation
    ? activeConversation.participants.find((p) => p.user_id !== currentUserId)?.name || "User"
    : "User";

  return (
    <ProtectedRoute>
      <main className="h-[calc(100vh-64px)] flex flex-col">
        {/* Safety banner */}
        <div className="px-4 pt-3 pb-2">
          <SafetyBanner />
        </div>

        {/* Main layout */}
        <div className="flex-1 flex overflow-hidden px-4 pb-4">
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <MessageSquare size={32} className="mx-auto text-teal/30 mb-3" />
                <p className="text-sm text-muted/50">Loading messages...</p>
              </div>
            </div>
          ) : (
            <>
              {/* Left panel: Conversation list */}
              <div
                className={`w-full md:w-80 md:shrink-0 border border-border rounded-xl bg-white overflow-hidden ${
                  mobileShowThread ? "hidden md:flex md:flex-col" : "flex flex-col"
                }`}
              >
                <ConversationList
                  conversations={conversations}
                  contactRequests={contactRequests}
                  activeConversationId={activeConversationId}
                  onSelectConversation={handleSelectConversation}
                  onNewMessage={() => setShowNewMessage(true)}
                  onApproveRequest={handleApproveRequest}
                  onDenyRequest={handleDenyRequest}
                  requestLoading={requestLoading}
                  isParentOrAdmin={isParentOrAdmin}
                />
              </div>

              {/* Right panel: Message thread */}
              <div
                className={`flex-1 md:ml-3 border border-border rounded-xl bg-white overflow-hidden ${
                  mobileShowThread ? "flex flex-col" : "hidden md:flex md:flex-col"
                }`}
              >
                {activeConversation ? (
                  <>
                    {/* Mobile back button */}
                    <div className="md:hidden flex items-center gap-2 px-3 py-2 border-b border-border">
                      <button
                        onClick={() => {
                          setMobileShowThread(false);
                          setActiveConversationId(null);
                        }}
                        className="p-1 rounded-lg hover:bg-background transition-colors"
                      >
                        <ArrowLeft size={16} className="text-muted" />
                      </button>
                      <span className="text-xs text-muted">Back to conversations</span>
                    </div>

                    <MessageThread
                      conversation={activeConversation}
                      messages={messages}
                      onSendMessage={handleSendMessage}
                      onBlockUser={() => setShowBlockReport(true)}
                      isLoading={messagesLoading}
                      isSending={isSending}
                      currentUserId={currentUserId}
                    />
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                      <MessageSquare size={32} className="mx-auto text-muted/20 mb-3" />
                      <p className="text-sm text-muted/50">Select a conversation</p>
                      <p className="text-xs text-muted/30 mt-1">
                        or start a new message
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Modals */}
        <NewMessageModal
          isOpen={showNewMessage}
          onClose={() => setShowNewMessage(false)}
          onSend={handleNewMessageSend}
          onContactRequest={handleContactRequest}
          isSending={isSending}
        />

        <BlockReportModal
          isOpen={showBlockReport}
          onClose={() => setShowBlockReport(false)}
          recipientName={blockTargetName}
          onSubmit={handleBlockSubmit}
          isLoading={blockLoading}
        />
      </main>
    </ProtectedRoute>
  );
}
