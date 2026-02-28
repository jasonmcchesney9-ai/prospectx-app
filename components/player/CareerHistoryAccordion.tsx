"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, ArrowRightLeft } from "lucide-react";
import type { PlayerTransfer } from "@/types/api";

interface CareerHistoryAccordionProps {
  transfers: PlayerTransfer[];
}

const TRANSFER_TYPE_LABELS: Record<string, string> = {
  trade: "Trade",
  release: "Release",
  draft: "Draft",
  signing: "Signing",
  loan: "Loan",
  callup: "Call-Up",
  senddown: "Send-Down",
};

export default function CareerHistoryAccordion({ transfers }: CareerHistoryAccordionProps) {
  const [open, setOpen] = useState(false);

  if (!transfers || transfers.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-border overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-3 bg-gradient-to-r from-navy/[0.04] to-teal/[0.04] border-b border-teal/10 hover:from-navy/[0.06] hover:to-teal/[0.06] transition-colors"
      >
        <div className="flex items-center gap-2">
          <ArrowRightLeft size={16} className="text-teal" />
          <h3 className="text-sm font-oswald uppercase tracking-wider text-navy">
            Career History
          </h3>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal/10 text-teal font-medium">
            {transfers.length}
          </span>
        </div>
        {open ? <ChevronUp size={16} className="text-navy/50" /> : <ChevronDown size={16} className="text-navy/50" />}
      </button>
      {open && (
        <div className="p-4">
          <div className="space-y-3">
            {transfers.map((t) => (
              <div key={t.id} className="flex items-start gap-3 p-3 rounded-lg bg-navy/[0.02] border border-border/50">
                <div className="shrink-0 mt-0.5">
                  <div className="w-8 h-8 rounded-full bg-teal/10 flex items-center justify-center">
                    <ArrowRightLeft size={14} className="text-teal" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium text-navy">
                      {t.from_team_name || "Unknown"}
                    </span>
                    <span className="text-[10px] text-navy/40">&rarr;</span>
                    <span className="text-xs font-medium text-navy">
                      {t.to_team_name || "Unknown"}
                    </span>
                    {t.transfer_type && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-orange/10 text-orange font-medium uppercase tracking-wide">
                        {TRANSFER_TYPE_LABELS[t.transfer_type] || t.transfer_type}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-navy/50">
                    {t.transfer_date && (
                      <span>{new Date(t.transfer_date).toLocaleDateString()}</span>
                    )}
                    {t.season && (
                      <>
                        <span className="text-navy/20">|</span>
                        <span>{t.season}</span>
                      </>
                    )}
                    {t.from_league && t.to_league && t.from_league !== t.to_league && (
                      <>
                        <span className="text-navy/20">|</span>
                        <span>{t.from_league} &rarr; {t.to_league}</span>
                      </>
                    )}
                    {t.source && (
                      <>
                        <span className="text-navy/20">|</span>
                        <span className="italic">{t.source}</span>
                      </>
                    )}
                  </div>
                  {t.notes && (
                    <p className="text-[11px] text-navy/60 mt-1">{t.notes}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
