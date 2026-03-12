"use client";

import { useState, useCallback } from "react";

interface TooltipProps {
  text: string;
  children: React.ReactNode;
  position?: "top" | "bottom" | "left" | "right";
  maxWidth?: number;
}

export function Tooltip({ text, children, position = "top", maxWidth = 280 }: TooltipProps) {
  const [visible, setVisible] = useState(false);

  const toggle = useCallback(() => setVisible((v) => !v), []);

  return (
    <div
      className="relative inline-flex items-center"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onClick={toggle}
    >
      {children}
      {visible && (
        <div
          className={`absolute z-[9999] px-3 py-2 rounded-lg shadow-lg pointer-events-none whitespace-normal ${
            position === "top" ? "bottom-full mb-2 left-1/2 -translate-x-1/2" : ""
          } ${
            position === "bottom" ? "top-full mt-2 left-1/2 -translate-x-1/2" : ""
          } ${
            position === "right" ? "left-full ml-2 top-1/2 -translate-y-1/2" : ""
          } ${
            position === "left" ? "right-full mr-2 top-1/2 -translate-y-1/2" : ""
          }`}
          style={{
            maxWidth,
            backgroundColor: "#0F2942",
            color: "#FFFFFF",
            fontFamily: "'Source Serif 4', serif",
            fontSize: "12px",
            lineHeight: "1.5",
          }}
        >
          {text}
          {/* Arrow */}
          <div
            className={`absolute w-2 h-2 rotate-45 ${
              position === "top" ? "left-1/2 -translate-x-1/2 -bottom-1" : ""
            } ${
              position === "bottom" ? "left-1/2 -translate-x-1/2 -top-1" : ""
            } ${
              position === "right" ? "top-1/2 -translate-y-1/2 -left-1" : ""
            } ${
              position === "left" ? "top-1/2 -translate-y-1/2 -right-1" : ""
            }`}
            style={{ backgroundColor: "#0F2942" }}
          />
        </div>
      )}
    </div>
  );
}
