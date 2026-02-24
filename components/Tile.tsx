/**
 * Tile — Reusable card component for Family Guide
 *
 * Visual: gradient header band (navy→teal), SVG icon, badge label,
 * white body with title + description, accent dot.
 */

interface TileProps {
  icon: React.ComponentType<{ className?: string }>;
  badge: string;
  title: string;
  description: string;
  dotColor?: string;
  onClick?: () => void;
  className?: string;
}

export default function Tile({
  icon: Icon,
  badge,
  title,
  description,
  dotColor = "#0D9488",
  onClick,
  className = "",
}: TileProps) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-[14px] overflow-hidden relative cursor-pointer transition-all duration-200 hover:-translate-y-[3px] ${className}`}
      style={{
        boxShadow: "0 1px 3px rgba(15,41,66,.08), 0 4px 16px rgba(15,41,66,.06)",
      }}
    >
      {/* Header band — navy-to-teal gradient */}
      <div
        className="relative flex items-end overflow-hidden"
        style={{
          height: "108px",
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
          {badge}
        </span>

        {/* Icon */}
        <div className="absolute" style={{ top: "14px", right: "16px", width: "40px", height: "40px", opacity: 0.85 }}>
          <Icon className="w-full h-full" />
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: "14px 16px 16px" }}>
        <p className="font-bold leading-tight" style={{ fontSize: "14px", color: "#0F2942", marginBottom: "5px" }}>
          {title}
        </p>
        <p style={{ fontSize: "11.5px", color: "#64748B", lineHeight: 1.5 }}>
          {description}
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
          background: dotColor,
        }}
      />
    </div>
  );
}
