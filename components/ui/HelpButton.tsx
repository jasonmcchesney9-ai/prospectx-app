"use client";

interface HelpButtonProps {
  onClick: () => void;
}

export default function HelpButton({ onClick }: HelpButtonProps) {
  return (
    <button
      onClick={onClick}
      style={{
        background: "#E67E22",
        color: "#FFFFFF",
        border: "none",
        cursor: "pointer",
        padding: "6px 12px",
        borderRadius: "8px",
        fontSize: "12px",
        fontFamily: "'Oswald', sans-serif",
        fontWeight: 700,
        textTransform: "uppercase" as const,
        letterSpacing: "0.05em",
        lineHeight: 1,
        whiteSpace: "nowrap" as const,
        transition: "opacity 0.15s ease",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.opacity = "0.85";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.opacity = "1";
      }}
    >
      Help
    </button>
  );
}
