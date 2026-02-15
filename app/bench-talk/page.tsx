"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useBenchTalk } from "@/components/BenchTalkProvider";
import ProtectedRoute from "@/components/ProtectedRoute";

function BenchTalkRedirect() {
  const router = useRouter();
  const { openBenchTalk } = useBenchTalk();

  useEffect(() => {
    openBenchTalk();
    router.replace("/");
  }, [openBenchTalk, router]);

  return (
    <div className="flex items-center justify-center h-[calc(100vh-64px)]">
      <p className="text-muted text-sm">Opening Bench Talk...</p>
    </div>
  );
}

export default function BenchTalkPage() {
  return (
    <ProtectedRoute>
      <BenchTalkRedirect />
    </ProtectedRoute>
  );
}
