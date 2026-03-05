"use client";

import { createContext, useContext, useState, useCallback } from "react";
import type { PxiContext } from "@/types/api";

interface BenchTalkContextType {
  isOpen: boolean;
  toggleBenchTalk: () => void;
  openBenchTalk: (initialMessage?: string, role?: string, pxiContext?: PxiContext) => void;
  closeBenchTalk: () => void;
  pendingMessage: string | null;
  clearPendingMessage: () => void;
  pendingRole: string | null;
  clearPendingRole: () => void;
  pendingPxiContext: PxiContext | null;
  clearPendingPxiContext: () => void;
  // Persistent page context (set by current page, used by BenchTalk)
  activePxiContext: PxiContext | null;
  setActivePxiContext: (ctx: PxiContext | null) => void;
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
  pendingPxiContext: null,
  clearPendingPxiContext: () => {},
  activePxiContext: null,
  setActivePxiContext: () => {},
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
  const [pendingPxiContext, setPendingPxiContext] = useState<PxiContext | null>(null);
  const [activePxiContext, setActivePxiContext] = useState<PxiContext | null>(null);
  const [roleOverride, _setRoleOverride] = useState<string | null>(null);

  // Wrap setter to sync to localStorage so axios interceptor can read it
  const setRoleOverride = useCallback((role: string | null) => {
    _setRoleOverride(role);
    try {
      if (role) {
        localStorage.setItem("prospectx_preview_role", role);
      } else {
        localStorage.removeItem("prospectx_preview_role");
      }
    } catch { /* SSR / private browsing */ }
  }, []);

  const toggleBenchTalk = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const openBenchTalk = useCallback((initialMessage?: string, role?: string, pxiContext?: PxiContext) => {
    if (initialMessage) {
      setPendingMessage(initialMessage);
    }
    if (role) {
      setPendingRole(role);
    }
    if (pxiContext) {
      setPendingPxiContext(pxiContext);
    }
    setIsOpen(true);
  }, []);

  const closeBenchTalk = useCallback(() => {
    setIsOpen(false);
  }, []);

  const clearPendingMessage = useCallback(() => {
    setPendingMessage(null);
    setPendingRole(null);
    setPendingPxiContext(null);
  }, []);

  const clearPendingRole = useCallback(() => {
    setPendingRole(null);
  }, []);

  const clearPendingPxiContext = useCallback(() => {
    setPendingPxiContext(null);
  }, []);

  return (
    <BenchTalkContext.Provider
      value={{ isOpen, toggleBenchTalk, openBenchTalk, closeBenchTalk, pendingMessage, clearPendingMessage, pendingRole, clearPendingRole, pendingPxiContext, clearPendingPxiContext, activePxiContext, setActivePxiContext, roleOverride, setRoleOverride }}
    >
      {children}
    </BenchTalkContext.Provider>
  );
}
