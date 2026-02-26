"use client";

import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Eye } from "lucide-react";

export default function WatchlistPage() {
  return (
    <ProtectedRoute>
      <NavBar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-16">
          <Eye size={40} className="mx-auto text-teal/40 mb-4" />
          <h1 className="text-2xl font-bold text-navy font-oswald uppercase tracking-wider">
            Watchlist
          </h1>
          <p className="text-sm text-muted mt-2">Coming Soon</p>
        </div>
      </main>
    </ProtectedRoute>
  );
}
