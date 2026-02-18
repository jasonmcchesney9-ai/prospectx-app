"use client";

import { MessageSquare, Shield, Users, Bell, Lock } from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";

export default function MessagesPage() {
  return (
    <ProtectedRoute>
      <NavBar />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-teal/10 mb-4">
            <MessageSquare size={32} className="text-teal" />
          </div>
          <h1 className="text-2xl font-bold text-navy font-oswald uppercase tracking-wider">Messages</h1>
          <p className="text-sm text-muted mt-2 max-w-md mx-auto">
            Secure messaging between scouts, coaches, agents, and families — with built-in safety controls.
          </p>
          <span className="inline-block mt-3 px-3 py-1 rounded-full bg-teal/10 text-teal text-xs font-oswald font-bold uppercase tracking-wider">
            Coming Soon
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          {[
            { icon: Users, title: "Role-Based Channels", desc: "Conversations organized by role — team staff, families, agents" },
            { icon: Bell, title: "Smart Notifications", desc: "Configurable alerts for new messages, report shares, and updates" },
            { icon: Lock, title: "End-to-End Privacy", desc: "All messages encrypted and stored securely within your organization" },
            { icon: MessageSquare, title: "Report Sharing", desc: "Share scouting reports and game plans directly in conversation threads" },
          ].map((item) => (
            <div
              key={item.title}
              className="bg-white rounded-xl border border-teal/20 p-4 hover:border-teal/30 hover:shadow-sm transition-all"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-teal/10 flex items-center justify-center shrink-0">
                  <item.icon size={18} className="text-teal" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-navy">{item.title}</h3>
                  <p className="text-xs text-muted mt-0.5 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Safety System Note */}
        <div className="bg-navy rounded-xl p-5 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Shield size={16} className="text-teal" />
            <h3 className="font-oswald text-sm font-bold text-white uppercase tracking-wider">Safety First</h3>
          </div>
          <p className="text-xs text-white/60 max-w-md mx-auto leading-relaxed">
            Messages involving minor players require <strong className="text-white/80">parental approval</strong> before delivery.
            All communications are logged and auditable. ProspectX follows best practices for youth athlete
            safety including role verification, message filtering, and organizational oversight.
          </p>
        </div>
      </main>
    </ProtectedRoute>
  );
}
