"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2 } from "lucide-react";
import api from "@/lib/api";

interface SearchResult {
  id: string;
  first_name: string;
  last_name: string;
  current_team: string | null;
  position: string | null;
  jersey_number: string | null;
}

export default function PlayerSearchDropdown({ collapsed = false }: { collapsed?: boolean }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Click-outside to close
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        if (collapsed) setExpanded(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [collapsed]);

  // Debounced search
  const doSearch = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.length < 2) {
      setResults([]);
      setIsOpen(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await api.get("/players/search", { params: { q, limit: 8 } });
        setResults(res.data.results || []);
        setIsOpen(true);
        setHighlightIndex(-1);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    doSearch(val);
  };

  const selectResult = (result: SearchResult) => {
    router.push(`/players/${result.id}`);
    setQuery("");
    setResults([]);
    setIsOpen(false);
    if (collapsed) setExpanded(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) {
      if (e.key === "Escape") {
        setIsOpen(false);
        if (collapsed) setExpanded(false);
        inputRef.current?.blur();
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
        break;
      case "Enter":
        e.preventDefault();
        if (highlightIndex >= 0 && highlightIndex < results.length) {
          selectResult(results[highlightIndex]);
        } else if (results.length === 1) {
          selectResult(results[0]);
        }
        break;
      case "Escape":
        setIsOpen(false);
        if (collapsed) setExpanded(false);
        inputRef.current?.blur();
        break;
    }
  };

  // Collapsed mode: show icon-only button
  if (collapsed && !expanded) {
    return (
      <button
        onClick={() => {
          setExpanded(true);
          setTimeout(() => inputRef.current?.focus(), 50);
        }}
        className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/5 transition-colors"
      >
        <Search size={18} />
      </button>
    );
  }

  return (
    <div className="relative" ref={containerRef}>
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (query.length >= 2 && results.length > 0) setIsOpen(true); }}
          placeholder="Search players..."
          className="w-full max-w-[300px] pl-9 pr-8 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder-white/30 focus:outline-none focus:border-teal/40 focus:bg-white/10 transition-colors"
          autoComplete="off"
        />
        {loading && (
          <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 animate-spin" />
        )}
      </div>

      {/* Results dropdown */}
      {isOpen && query.length >= 2 && (
        <div className="absolute top-full left-0 mt-1 w-full min-w-[300px] max-w-[400px] bg-navy-light border border-white/10 rounded-lg shadow-xl overflow-hidden z-[60]">
          {results.length === 0 ? (
            <div className="px-4 py-3 text-sm text-white/40">No players found</div>
          ) : (
            results.map((r, i) => (
              <button
                key={r.id}
                onClick={() => selectResult(r)}
                onMouseEnter={() => setHighlightIndex(i)}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-3 ${
                  i === highlightIndex
                    ? "bg-white/10 text-teal"
                    : "text-white/70 hover:bg-white/5 hover:text-white"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-white">
                    {r.first_name} {r.last_name}
                  </span>
                  {r.current_team && (
                    <span className="text-white/40"> — {r.current_team}</span>
                  )}
                </div>
                {r.position && (
                  <span className="text-[10px] font-oswald font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/10 text-white/50 shrink-0">
                    {r.position}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
