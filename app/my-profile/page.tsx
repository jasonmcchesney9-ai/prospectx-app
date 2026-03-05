"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getUser } from "@/lib/auth";
import ProtectedRoute from "@/components/ProtectedRoute";
import NavBar from "@/components/NavBar";

export default function MyProfilePage() {
  const router = useRouter();

  useEffect(() => {
    const user = getUser();
    if (!user) {
      router.replace("/login");
      return;
    }
    if (user.linked_player_id) {
      router.replace(`/players/${user.linked_player_id}`);
    } else {
      router.replace("/players");
    }
  }, [router]);

  return (
    <ProtectedRoute>
      <NavBar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-navy border-t-teal" />
        </div>
      </main>
    </ProtectedRoute>
  );
}
