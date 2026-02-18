"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { useBenchTalk } from "@/components/BenchTalkProvider";
import HockeyRink from "@/components/HockeyRink";

const QUICK_SUGGESTIONS = [
  "What should my U14 eat before a tournament?",
  "How do I help my player bounce back from a bad game?",
  "What's the difference between Jr. A and Major Junior?",
  "Is my player ready for travel hockey?",
];

export default function PXIQuickAsk() {
  const [input, setInput] = useState("");
  const { openBenchTalk } = useBenchTalk();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    openBenchTalk(`[Parent Mode] ${input.trim()}`);
    setInput("");
  }

  function handleSuggestion(suggestion: string) {
    openBenchTalk(`[Parent Mode] ${suggestion}`);
  }

  return (
    <div className="bg-white rounded-xl border border-teal/20 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-navy/[0.03] border-b border-teal/20">
        <div className="w-8 h-8 rounded-lg bg-teal/10 flex items-center justify-center">
          <HockeyRink size="toast" />
        </div>
        <div>
          <h3 className="text-sm font-oswald uppercase tracking-wider text-navy font-bold">
            Ask PXI
          </h3>
          <p className="text-[10px] text-gray-400">
            Parent Mode — Ask anything about your player&apos;s development
          </p>
        </div>
      </div>

      {/* Quick suggestions */}
      <div className="px-4 py-3 flex flex-wrap gap-1.5">
        {QUICK_SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => handleSuggestion(s)}
            className="px-2.5 py-1.5 rounded-full bg-teal/5 border border-teal/20 text-[10px] text-teal hover:bg-teal/10 transition-colors"
          >
            {s}
          </button>
        ))}
      </div>

      {/* Input bar */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2 px-4 pb-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask PXI about your player's development..."
          className="flex-1 px-3 py-2.5 rounded-lg border border-gray-300 text-xs text-navy placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal focus:border-teal transition"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="px-3 py-2.5 rounded-lg bg-teal text-white disabled:opacity-40 hover:bg-teal/90 transition-colors"
        >
          <Send size={14} />
        </button>
      </form>
    </div>
  );
}
