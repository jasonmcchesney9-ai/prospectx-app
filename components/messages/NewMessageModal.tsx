"use client";

import { useState, useEffect } from "react";
import { X, Search, Loader2, Shield, Send, UserPlus } from "lucide-react";
import api from "@/lib/api";

interface SearchResult {
  id: string;
  name: string;
  role: string;
  org_name?: string;
  requires_approval?: boolean;
}

interface NewMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (recipientId: string, content: string) => void;
  onContactRequest: (targetPlayerId: string, message: string) => void;
  isSending: boolean;
}

export default function NewMessageModal({
  isOpen,
  onClose,
  onSend,
  onContactRequest,
  isSending,
}: NewMessageModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SearchResult | null>(null);
  const [messageText, setMessageText] = useState("");

  // Search for users when query changes
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setResults([]);
      return;
    }

    const timeout = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await api.get("/api/messages/search-users", {
          params: { q: searchQuery },
        });
        setResults(res.data || []);
      } catch {
        // Search endpoint may not exist yet — show empty
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [searchQuery]);

  function handleSubmit() {
    if (!selectedUser || !messageText.trim()) return;

    if (selectedUser.requires_approval) {
      onContactRequest(selectedUser.id, messageText.trim());
    } else {
      onSend(selectedUser.id, messageText.trim());
    }
  }

  function handleClose() {
    setSearchQuery("");
    setResults([]);
    setSelectedUser(null);
    setMessageText("");
    onClose();
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="font-oswald text-sm font-bold text-navy uppercase tracking-wider">
            New Message
          </h2>
          <button
            onClick={handleClose}
            className="p-1 rounded-lg hover:bg-background transition-colors"
          >
            <X size={16} className="text-muted" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Recipient picker */}
          {!selectedUser ? (
            <>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted/40" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search for a user or player..."
                  autoFocus
                  className="w-full pl-9 pr-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-teal/30"
                />
              </div>

              {/* Results */}
              {searching && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 size={16} className="text-teal animate-spin" />
                </div>
              )}

              {!searching && results.length > 0 && (
                <div className="space-y-1">
                  {results.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => setSelectedUser(user)}
                      className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-background transition-colors"
                    >
                      <div className="w-8 h-8 rounded-full bg-navy/10 flex items-center justify-center shrink-0">
                        <span className="text-[10px] font-bold text-navy/50 uppercase">
                          {user.name.charAt(0)}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-navy truncate">{user.name}</p>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-muted/50">{user.role}</span>
                          {user.org_name && (
                            <>
                              <span className="text-[10px] text-muted/30">·</span>
                              <span className="text-[10px] text-muted/50">{user.org_name}</span>
                            </>
                          )}
                        </div>
                      </div>
                      {user.requires_approval && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-orange/10 text-orange font-bold shrink-0">
                          Approval
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {!searching && searchQuery.length >= 2 && results.length === 0 && (
                <p className="text-center text-xs text-muted/50 py-4">No users found</p>
              )}
            </>
          ) : (
            <>
              {/* Selected recipient */}
              <div className="flex items-center gap-3 p-3 bg-background rounded-lg">
                <div className="w-8 h-8 rounded-full bg-navy/10 flex items-center justify-center shrink-0">
                  <span className="text-[10px] font-bold text-navy/50 uppercase">
                    {selectedUser.name.charAt(0)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-navy">{selectedUser.name}</p>
                  <p className="text-[10px] text-muted/50">{selectedUser.role}</p>
                </div>
                <button
                  onClick={() => setSelectedUser(null)}
                  className="p-1 rounded hover:bg-white transition-colors"
                >
                  <X size={12} className="text-muted/40" />
                </button>
              </div>

              {/* Approval warning */}
              {selectedUser.requires_approval && (
                <div className="flex items-start gap-2 p-3 bg-orange/5 rounded-lg border border-orange/10">
                  <Shield size={14} className="text-orange shrink-0 mt-0.5" />
                  <p className="text-[11px] text-orange leading-relaxed">
                    This will send a <strong>contact request</strong> to {selectedUser.name}&apos;s parent
                    for approval. You cannot message directly until approved.
                  </p>
                </div>
              )}

              {/* Message input */}
              <div>
                <label className="text-[10px] font-oswald uppercase tracking-wider text-muted block mb-1">
                  Message
                </label>
                <textarea
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder={
                    selectedUser.requires_approval
                      ? "Introduce yourself and explain why you'd like to connect..."
                      : "Type your message..."
                  }
                  rows={4}
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-teal/30 resize-none"
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {selectedUser && (
          <div className="px-4 py-3 border-t border-border">
            <button
              onClick={handleSubmit}
              disabled={!messageText.trim() || isSending}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-teal text-white text-sm font-bold hover:bg-teal/90 transition-colors disabled:opacity-50"
            >
              {isSending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : selectedUser.requires_approval ? (
                <>
                  <UserPlus size={14} />
                  Request Contact
                </>
              ) : (
                <>
                  <Send size={14} />
                  Send
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
