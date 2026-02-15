"use client";

import { createContext, useContext, useState, useCallback } from "react";

interface BenchTalkContextType {
  isOpen: boolean;
  toggleBenchTalk: () => void;
  openBenchTalk: (initialMessage?: string) => void;
  closeBenchTalk: () => void;
  pendingMessage: string | null;
  clearPendingMessage: () => void;
}

const BenchTalkContext = createContext<BenchTalkContextType>({
  isOpen: false,
  toggleBenchTalk: () => {},
  openBenchTalk: () => {},
  closeBenchTalk: () => {},
  pendingMessage: null,
  clearPendingMessage: () => {},
});

export function useBenchTalk() {
  return useContext(BenchTalkContext);
}

export default function BenchTalkProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);

  const toggleBenchTalk = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const openBenchTalk = useCallback((initialMessage?: string) => {
    if (initialMessage) {
      setPendingMessage(initialMessage);
    }
    setIsOpen(true);
  }, []);

  const closeBenchTalk = useCallback(() => {
    setIsOpen(false);
  }, []);

  const clearPendingMessage = useCallback(() => {
    setPendingMessage(null);
  }, []);

  return (
    <BenchTalkContext.Provider
      value={{ isOpen, toggleBenchTalk, openBenchTalk, closeBenchTalk, pendingMessage, clearPendingMessage }}
    >
      {children}
    </BenchTalkContext.Provider>
  );
}
