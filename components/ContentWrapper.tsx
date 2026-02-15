"use client";

import { useEffect, useState } from "react";
import { useBenchTalk } from "./BenchTalkProvider";

/**
 * Wraps all page content. When Bench Talk drawer is open on desktop,
 * shifts everything left so the page isn't hidden behind the panel.
 */
export default function ContentWrapper({ children }: { children: React.ReactNode }) {
  const { isOpen } = useBenchTalk();
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  return (
    <div
      className="transition-[margin] duration-300 ease-in-out min-h-screen"
      style={{ marginRight: isOpen && isDesktop ? "480px" : "0" }}
    >
      {children}
    </div>
  );
}
