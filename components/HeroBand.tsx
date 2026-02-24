/**
 * HeroBand — Wide "Development Journey" tile for Family Guide
 *
 * Spans 2 columns in the tile grid. Taller band (120px).
 * Navy-to-teal gradient with JourneyIcon.
 */
import { JourneyIcon } from "./tile-icons";

interface HeroBandProps {
  className?: string;
}

export default function HeroBand({ className = "" }: HeroBandProps) {
  return (
    <div
      className={`bg-white rounded-[14px] overflow-hidden relative col-span-2 ${className}`}
      style={{
        boxShadow: "0 1px 3px rgba(15,41,66,.08), 0 4px 16px rgba(15,41,66,.06)",
      }}
    >
      {/* Header band — navy-to-teal gradient, taller */}
      <div
        className="relative flex items-end overflow-hidden"
        style={{
          height: "120px",
          padding: "14px 16px",
          background: "linear-gradient(135deg, #0F2942 0%, #1A3A5C 55%, #0D9488 100%)",
        }}
      >
        {/* Geometric accent circles */}
        <div
          className="absolute rounded-full"
          style={{
            right: "-20px",
            top: "-20px",
            width: "100px",
            height: "100px",
            background: "rgba(255,255,255,.05)",
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            right: "20px",
            bottom: "-30px",
            width: "70px",
            height: "70px",
            background: "rgba(255,255,255,.04)",
          }}
        />

        {/* Badge label */}
        <span
          className="absolute font-mono uppercase"
          style={{
            top: "12px",
            left: "14px",
            fontSize: "9px",
            fontWeight: 500,
            letterSpacing: "0.1em",
            color: "rgba(255,255,255,.55)",
            background: "rgba(255,255,255,.1)",
            padding: "3px 7px",
            borderRadius: "4px",
          }}
        >
          Journey
        </span>

        {/* Icon */}
        <div className="absolute" style={{ top: "14px", right: "16px", width: "40px", height: "40px", opacity: 0.85 }}>
          <JourneyIcon className="w-full h-full" />
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: "14px 16px 16px" }}>
        <p className="font-bold leading-tight" style={{ fontSize: "14px", color: "#0F2942", marginBottom: "5px" }}>
          Your Player&apos;s Development Journey
        </p>
        <p style={{ fontSize: "11.5px", color: "#64748B", lineHeight: 1.5 }}>
          Track progress, generate assessments, and get a personalized monthly focus plan.
        </p>
      </div>

      {/* Accent dot */}
      <div
        className="absolute rounded-full"
        style={{
          bottom: "14px",
          right: "14px",
          width: "7px",
          height: "7px",
          background: "#0D9488",
        }}
      />
    </div>
  );
}
