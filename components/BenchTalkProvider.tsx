"use client";

import { createContext, useContext, useState, useCallback } from "react";

interface BenchTalkContextType {
  isOpen: boolean;
  toggleBenchTalk: () => void;
  openBenchTalk: (initialMessage?: string, role?: string) => void;
  closeBenchTalk: () => void;
  pendingMessage: string | null;
  clearPendingMessage: () => void;
  pendingRole: string | null;
  clearPendingRole: () => void;
  // Admin role preview
  roleOverride: string | null;
  setRoleOverride: (role: string | null) => void;
}

const BenchTalkContext = createContext<BenchTalkContextType>({
  isOpen: false,
  toggleBenchTalk: () => {},
  openBenchTalk: () => {},
  closeBenchTalk: () => {},
  pendingMessage: null,
  clearPendingMessage: () => {},
  pendingRole: null,
  clearPendingRole: () => {},
  roleOverride: null,
  setRoleOverride: () => {},
});

export function useBenchTalk() {
  return useContext(BenchTalkContext);
}

export default function BenchTalkProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [pendingRole, setPendingRole] = useState<string | null>(null);
  const [roleOverride, setRoleOverride] = useState<string | null>(null);

  const toggleBenchTalk = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const openBenchTalk = useCallback((initialMessage?: string, role?: string) => {
    if (initialMessage) {
      setPendingMessage(initialMessage);
    }
    if (role) {
      setPendingRole(role);
    }
    setIsOpen(true);
  }, []);

  const closeBenchTalk = useCallback(() => {
    setIsOpen(false);
  }, []);

  const clearPendingMessage = useCallback(() => {
    setPendingMessage(null);
    setPendingRole(null);
  }, []);

  const clearPendingRole = useCallback(() => {
    setPendingRole(null);
  }, []);

  return (
    <BenchTalkContext.Provider
      value={{ isOpen, toggleBenchTalk, openBenchTalk, closeBenchTalk, pendingMessage, clearPendingMessage, pendingRole, clearPendingRole, roleOverride, setRoleOverride }}
    >
      {children}
    </BenchTalkContext.Provider>
  );
}
