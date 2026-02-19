"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App error boundary caught:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#F0F4F8] flex items-center justify-center p-6">
      <div className="bg-white rounded-xl border border-red-200 p-8 max-w-lg w-full text-center">
        <h2 className="text-lg font-bold text-[#0F2A3D] mb-2">Something went wrong</h2>
        <p className="text-sm text-gray-600 mb-4">{error.message}</p>
        {error.digest && (
          <p className="text-xs text-gray-400 mb-4 font-mono">Digest: {error.digest}</p>
        )}
        <button
          onClick={reset}
          className="px-4 py-2 bg-[#0F2A3D] text-white text-sm rounded-lg hover:opacity-90"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
