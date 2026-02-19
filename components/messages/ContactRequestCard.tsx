"use client";

import { useState } from "react";
import { CheckCircle, XCircle, Loader2, UserCheck, ExternalLink } from "lucide-react";
import type { ContactRequest } from "@/types/api";

interface ContactRequestCardProps {
  request: ContactRequest;
  onApprove: (id: string) => void;
  onDeny: (id: string) => void;
  isLoading: boolean;
}

export default function ContactRequestCard({ request, onApprove, onDeny, isLoading }: ContactRequestCardProps) {
  const [action, setAction] = useState<"approve" | "deny" | null>(null);

  function handleApprove() {
    setAction("approve");
    onApprove(request.id);
  }

  function handleDeny() {
    setAction("deny");
    onDeny(request.id);
  }

  return (
    <div className="bg-white rounded-xl border border-orange/20 p-4">
      <div className="flex items-start gap-3">
        {/* Avatar placeholder */}
        <div className="w-10 h-10 rounded-full bg-navy/10 flex items-center justify-center shrink-0">
          <UserCheck size={18} className="text-navy/50" />
        </div>

        <div className="flex-1 min-w-0">
          {/* Requester info */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-sm text-navy">{request.requester_name}</span>
            <span className="text-[10px] font-oswald uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-navy/10 text-navy/60">
              {request.requester_role}
            </span>
            <span className="text-[10px] text-muted">{request.requester_org}</span>
          </div>

          {/* Target info */}
          <p className="text-xs text-muted mt-1">
            Requesting contact with{" "}
            <strong className="text-navy">{request.target_player_name || "your player"}</strong>
          </p>

          {/* Intro message */}
          {request.message && (
            <div className="mt-2 p-2 bg-background rounded-lg">
              <p className="text-xs text-navy/80 italic">&ldquo;{request.message}&rdquo;</p>
            </div>
          )}

          {/* Timestamp */}
          <p className="text-[10px] text-muted/60 mt-2">
            {new Date(request.requested_at).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </p>
        </div>
      </div>

      {/* Actions */}
      {request.status === "pending" && (
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
          <button
            onClick={handleApprove}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500 text-white text-xs font-bold hover:bg-green-600 transition-colors disabled:opacity-50"
          >
            {isLoading && action === "approve" ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <CheckCircle size={12} />
            )}
            Approve
          </button>
          <button
            onClick={handleDeny}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-bold hover:bg-red-100 transition-colors disabled:opacity-50"
          >
            {isLoading && action === "deny" ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <XCircle size={12} />
            )}
            Deny
          </button>
          {request.target_player_name && (
            <a
              href={`/players?search=${encodeURIComponent(request.requester_name)}`}
              className="ml-auto flex items-center gap-1 text-[10px] text-teal hover:underline"
            >
              <ExternalLink size={10} />
              View Profile
            </a>
          )}
        </div>
      )}

      {/* Resolved status */}
      {request.status === "approved" && (
        <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-border text-xs text-green-600">
          <CheckCircle size={12} />
          Approved
          {request.resolved_at && (
            <span className="text-muted/60 ml-1">
              — {new Date(request.resolved_at).toLocaleDateString()}
            </span>
          )}
        </div>
      )}

      {request.status === "denied" && (
        <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-border text-xs text-red-500">
          <XCircle size={12} />
          Denied
          {request.resolved_at && (
            <span className="text-muted/60 ml-1">
              — 30-day cooldown active
            </span>
          )}
        </div>
      )}
    </div>
  );
}
