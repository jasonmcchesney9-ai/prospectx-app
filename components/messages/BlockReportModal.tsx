"use client";

import { useState } from "react";
import { X, Loader2, Ban, AlertTriangle } from "lucide-react";

interface BlockReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipientName: string;
  onSubmit: (reason: string, action: "block" | "report" | "both") => void;
  isLoading: boolean;
}

export default function BlockReportModal({
  isOpen,
  onClose,
  recipientName,
  onSubmit,
  isLoading,
}: BlockReportModalProps) {
  const [blockUser, setBlockUser] = useState(true);
  const [reportUser, setReportUser] = useState(false);
  const [reason, setReason] = useState("");

  function handleSubmit() {
    let action: "block" | "report" | "both";
    if (blockUser && reportUser) action = "both";
    else if (reportUser) action = "report";
    else action = "block";
    onSubmit(reason, action);
  }

  function handleClose() {
    setBlockUser(true);
    setReportUser(false);
    setReason("");
    onClose();
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-red-500" />
            <h2 className="font-oswald text-sm font-bold text-navy uppercase tracking-wider">
              Block &amp; Report
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="p-1 rounded-lg hover:bg-background transition-colors"
          >
            <X size={16} className="text-muted" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <p className="text-xs text-muted">
            Take action against <strong className="text-navy">{recipientName}</strong>:
          </p>

          {/* Options */}
          <div className="space-y-2">
            <label className="flex items-center gap-2.5 p-2.5 rounded-lg border border-border hover:border-red-200 transition-colors cursor-pointer">
              <input
                type="checkbox"
                checked={blockUser}
                onChange={(e) => setBlockUser(e.target.checked)}
                className="w-4 h-4 rounded border-border text-red-500 focus:ring-red-500"
              />
              <div>
                <p className="text-sm font-medium text-navy">Block User</p>
                <p className="text-[10px] text-muted/60">
                  Prevents all future messages from this user
                </p>
              </div>
            </label>

            <label className="flex items-center gap-2.5 p-2.5 rounded-lg border border-border hover:border-red-200 transition-colors cursor-pointer">
              <input
                type="checkbox"
                checked={reportUser}
                onChange={(e) => setReportUser(e.target.checked)}
                className="w-4 h-4 rounded border-border text-red-500 focus:ring-red-500"
              />
              <div>
                <p className="text-sm font-medium text-navy">Report to Admin</p>
                <p className="text-[10px] text-muted/60">
                  Notifies your organization admin for review
                </p>
              </div>
            </label>
          </div>

          {/* Reason */}
          <div>
            <label className="text-[10px] font-oswald uppercase tracking-wider text-muted block mb-1">
              Reason (optional)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Describe the issue..."
              rows={3}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-red-300 resize-none"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="px-4 py-3 border-t border-border flex items-center gap-2">
          <button
            onClick={handleClose}
            className="flex-1 px-4 py-2 rounded-lg border border-border text-sm text-muted hover:bg-background transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={(!blockUser && !reportUser) || isLoading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-bold hover:bg-red-600 transition-colors disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <>
                <Ban size={14} />
                Submit
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
