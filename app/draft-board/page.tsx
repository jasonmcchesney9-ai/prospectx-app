"use client";

import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import { BarChart3 } from "lucide-react";

export default function DraftBoardPage() {
  return (
    <ProtectedRoute>
      <NavBar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-16">
          <BarChart3 size={40} className="mx-auto text-teal/40 mb-4" />
          <h1 className="text-2xl font-bold text-navy font-oswald uppercase tracking-wider">
            Draft Board (PXR)
          </h1>
          <p className="text-sm text-muted mt-2">Coming Soon</p>
        </div>
      </main>
    </ProtectedRoute>
  );
}
