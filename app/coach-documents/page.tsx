"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import { FileText } from "lucide-react";

export default function CoachDocumentsPage() {
  return (
    <ProtectedRoute>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-3 mb-8">
          <FileText className="text-teal" size={28} />
          <h1 className="text-2xl font-oswald font-bold uppercase tracking-wider text-navy">
            Coach Documents
          </h1>
        </div>

        <div className="bg-white rounded-xl border border-border p-8 text-center">
          <FileText className="mx-auto text-teal/30 mb-4" size={48} />
          <h2 className="text-lg font-oswald font-semibold text-navy mb-2">
            Coming Soon
          </h2>
          <p className="text-sm text-navy/60 max-w-md mx-auto">
            Upload and organize coaching documents, playbooks, scouting sheets, and reference materials for your staff.
          </p>
        </div>
      </div>
    </ProtectedRoute>
  );
}
