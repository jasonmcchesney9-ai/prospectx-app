"use client";

import { Briefcase, Users, FileText, TrendingUp, Target, Calendar } from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";

export default function MyClientsPage() {
  return (
    <ProtectedRoute>
      <NavBar />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#475569]/10 mb-4">
            <Briefcase size={32} className="text-[#475569]" />
          </div>
          <h1 className="text-2xl font-bold text-navy font-oswald uppercase tracking-wider">Client Management</h1>
          <p className="text-sm text-muted mt-2 max-w-md mx-auto">
            Manage your client roster, track their development, plan pathways, and generate agent-ready reports.
          </p>
          <span className="inline-block mt-3 px-3 py-1 rounded-full bg-[#475569]/10 text-[#475569] text-xs font-oswald font-bold uppercase tracking-wider">
            Coming Soon
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          {[
            { icon: Users, title: "Client Roster", desc: "Manage your full client list with contract status, contact info, and notes" },
            { icon: TrendingUp, title: "Progress Tracking", desc: "Season-over-season stat tracking and development milestones for each client" },
            { icon: Target, title: "Pathway Planning", desc: "Map out realistic hockey pathways — junior, prep school, NCAA, pro" },
            { icon: FileText, title: "Agent Packs", desc: "Generate professional agent packages with stats, scouting, and video highlights" },
            { icon: Calendar, title: "Exposure Calendar", desc: "Track showcases, camps, combines, and tryout dates for client visibility" },
            { icon: Briefcase, title: "Deal Tracker", desc: "Track offers, commitments, transfers, and contract timelines" },
          ].map((item) => (
            <div
              key={item.title}
              className="bg-white rounded-xl border border-border p-4 hover:border-[#475569]/30 hover:shadow-sm transition-all"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#475569]/10 flex items-center justify-center shrink-0">
                  <item.icon size={18} className="text-[#475569]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-navy">{item.title}</h3>
                  <p className="text-xs text-muted mt-0.5 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-navy/[0.03] rounded-xl border border-border p-5 text-center">
          <p className="text-xs text-muted">
            Client Management will integrate with PXI intelligence, scouting reports, and player stats for a complete agent workflow.
          </p>
        </div>
      </main>
    </ProtectedRoute>
  );
}
