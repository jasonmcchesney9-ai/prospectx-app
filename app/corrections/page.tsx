"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  CheckSquare,
  CheckCircle,
  XCircle,
  Clock,
  Filter,
  ArrowRight,
  ThumbsUp,
  ThumbsDown,
  X,
} from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import api from "@/lib/api";
import type { PlayerCorrection } from "@/types/api";
import { CORRECTABLE_FIELD_LABELS } from "@/types/api";

type StatusFilter = "pending" | "approved" | "rejected" | "all";

export default function CorrectionsPage() {
  return (
    <ProtectedRoute>
      <NavBar />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <CorrectionsAdmin />
      </main>
    </ProtectedRoute>
  );
}

function CorrectionsAdmin() {
  const [corrections, setCorrections] = useState<PlayerCorrection[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [processing, setProcessing] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const loadCorrections = async () => {
    setLoading(true);
    try {
      const params = statusFilter !== "all" ? `?status=${statusFilter}` : "";
      const { data } = await api.get<{ total: number; corrections: PlayerCorrection[] }>(
        `/corrections${params}`
      );
      setCorrections(data.corrections);
      setTotal(data.total);
    } catch {
      // handle error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCorrections();
  }, [statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleReview = async (correctionId: string, action: "approve" | "reject") => {
    setProcessing(true);
    try {
      await api.put(`/corrections/${correctionId}/review`, {
        action,
        review_note: reviewNote,
      });
      setSuccessMsg(`Correction ${action === "approve" ? "approved" : "rejected"} successfully.`);
      setReviewingId(null);
      setReviewNote("");
      loadCorrections();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Review failed";
      alert(msg);
    } finally {
      setProcessing(false);
    }
  };

  const statusTabs: { key: StatusFilter; label: string; icon: React.ElementType }[] = [
    { key: "pending", label: "Pending", icon: Clock },
    { key: "approved", label: "Approved", icon: CheckCircle },
    { key: "rejected", label: "Rejected", icon: XCircle },
    { key: "all", label: "All", icon: Filter },
  ];

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-navy flex items-center gap-2">
            <CheckSquare size={24} className="text-teal" />
            Review Corrections
          </h1>
          <p className="text-muted text-sm mt-1">
            Review and approve player data corrections submitted by users
          </p>
        </div>
        <Link href="/players" className="text-sm text-teal hover:underline flex items-center gap-1">
          ← Back to Players
        </Link>
      </div>

      {successMsg && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-2">
          <CheckCircle size={16} className="text-green-600" />
          <p className="text-green-700 text-sm">{successMsg}</p>
          <button onClick={() => setSuccessMsg("")} className="ml-auto text-green-500 hover:text-green-700">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Status Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
        {statusTabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setStatusFilter(key)}
            className={`px-4 py-2 rounded-lg text-sm font-oswald uppercase tracking-wider transition-colors flex items-center gap-1.5 ${
              statusFilter === key
                ? "bg-white text-navy shadow-sm"
                : "text-muted hover:text-navy"
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-navy border-t-teal" />
        </div>
      ) : corrections.length === 0 ? (
        <div className="bg-gray-50 border border-teal/20 rounded-xl p-8 text-center">
          <CheckSquare size={32} className="mx-auto text-muted mb-3" />
          <h3 className="font-oswald font-semibold text-navy">No {statusFilter !== "all" ? statusFilter : ""} Corrections</h3>
          <p className="text-muted text-sm mt-1">
            {statusFilter === "pending"
              ? "No corrections awaiting review."
              : "No corrections match this filter."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted mb-2">{total} correction(s) found</p>
          {corrections.map((c) => (
            <div key={c.id} className="bg-white rounded-xl border border-teal/20 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <Link
                      href={`/players/${c.player_id}`}
                      className="font-medium text-navy text-sm hover:text-teal transition-colors"
                    >
                      {c.first_name} {c.last_name}
                    </Link>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                      c.status === "pending" ? "bg-yellow-100 text-yellow-700"
                        : c.status === "approved" ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}>
                      {c.status.toUpperCase()}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                      c.confidence === "high" ? "bg-green-50 text-green-600"
                        : c.confidence === "medium" ? "bg-yellow-50 text-yellow-600"
                        : "bg-red-50 text-red-600"
                    }`}>
                      {c.confidence} confidence
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-sm mb-1">
                    <span className="text-muted text-xs font-medium">
                      {CORRECTABLE_FIELD_LABELS[c.field_name] || c.field_name}:
                    </span>
                    <span className="text-red-600 line-through text-xs">{c.old_value || "—"}</span>
                    <ArrowRight size={10} className="text-muted" />
                    <span className="text-green-700 font-medium text-xs">{c.new_value}</span>
                  </div>

                  {c.reason && (
                    <p className="text-xs text-muted italic mt-1">&quot;{c.reason}&quot;</p>
                  )}

                  <div className="text-[10px] text-muted/60 mt-1">
                    Submitted by {c.submitter_email || "unknown"} •{" "}
                    {new Date(c.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    {c.reviewed_at && (
                      <span>
                        {" "}• Reviewed {new Date(c.reviewed_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    )}
                  </div>

                  {c.review_note && (
                    <p className="text-[10px] text-navy/60 mt-1 bg-gray-50 rounded px-2 py-1">
                      Review note: {c.review_note}
                    </p>
                  )}
                </div>

                {/* Actions for pending corrections */}
                {c.status === "pending" && (
                  <div className="shrink-0">
                    {reviewingId === c.id ? (
                      <div className="space-y-2 w-56">
                        <textarea
                          value={reviewNote}
                          onChange={(e) => setReviewNote(e.target.value)}
                          placeholder="Review note (optional)..."
                          rows={2}
                          className="w-full border border-teal/20 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-teal/30 resize-none"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleReview(c.id, "approve")}
                            disabled={processing}
                            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-green-100 text-green-700 text-xs font-medium rounded hover:bg-green-200 transition-colors disabled:opacity-50"
                          >
                            <ThumbsUp size={10} />
                            Approve
                          </button>
                          <button
                            onClick={() => handleReview(c.id, "reject")}
                            disabled={processing}
                            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-red-100 text-red-700 text-xs font-medium rounded hover:bg-red-200 transition-colors disabled:opacity-50"
                          >
                            <ThumbsDown size={10} />
                            Reject
                          </button>
                        </div>
                        <button
                          onClick={() => { setReviewingId(null); setReviewNote(""); }}
                          className="w-full text-[10px] text-muted hover:text-navy text-center"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setReviewingId(c.id)}
                        className="px-3 py-1.5 bg-teal/10 text-teal text-xs font-oswald uppercase tracking-wider rounded-lg hover:bg-teal/20 transition-colors"
                      >
                        Review
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
