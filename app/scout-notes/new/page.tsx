"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ClipboardCheck } from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import ScoutNoteForm from "@/components/ScoutNoteForm";

export default function NewScoutNotePage() {
  return (
    <ProtectedRoute>
      <NavBar />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-navy flex items-center gap-2">
            <ClipboardCheck size={24} className="text-teal" />
            New Scout Note
          </h1>
          <p className="text-muted text-sm mt-1">
            Create a structured scouting evaluation
          </p>
        </div>
        <div className="bg-white rounded-xl border border-border p-5">
          <Suspense fallback={<div className="py-8 text-center text-muted text-sm">Loading...</div>}>
            <FormWithParams />
          </Suspense>
        </div>
      </main>
    </ProtectedRoute>
  );
}

function FormWithParams() {
  const searchParams = useSearchParams();
  const playerId = searchParams.get("player_id") || undefined;
  return <ScoutNoteForm initialPlayerId={playerId} />;
}
