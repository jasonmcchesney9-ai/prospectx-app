/**
 * PXI Badge — Reusable text mark component
 *
 * Three variants:
 * - dark:  Dark background (#1A2332), white text, teal border, orange dot
 * - light: Transparent, teal text + teal border
 * - nav:   Solid teal background, white text, no border, green online dot
 */
export default function PXIBadge({
  size = 24,
  variant = "dark",
  showDot = true,
  className = "",
}: {
  size?: number;
  variant?: "dark" | "light" | "nav";
  showDot?: boolean;
  className?: string;
}) {
  const fontSize = Math.round(size * 0.42);
  const dotSize = Math.round(size * 0.16);
  const borderRadius = Math.round(size * 0.22);
  const padX = Math.round(size * 0.15);
  const padY = Math.round(size * 0.1);

  const styles: Record<string, React.CSSProperties> = {
    dark: {
      backgroundColor: "#1A2332",
      border: "1.5px solid #18B3A6",
      color: "#FFFFFF",
    },
    light: {
      backgroundColor: "transparent",
      border: "1px solid #18B3A6",
      color: "#18B3A6",
    },
    nav: {
      backgroundColor: "#0D9488",
      border: "none",
      color: "#FFFFFF",
    },
  };

  const dotColors: Record<string, string> = {
    dark: "#F97316",    // Orange dot
    light: "#F97316",
    nav: "#22C55E",     // Green "online" dot
  };

  const style = styles[variant];

  return (
    <span
      className={`inline-flex items-center justify-center relative font-oswald font-bold ${className}`}
      style={{
        ...style,
        fontSize: `${fontSize}px`,
        letterSpacing: "-0.5px",
        borderRadius: `${borderRadius}px`,
        paddingLeft: `${padX}px`,
        paddingRight: `${padX}px`,
        paddingTop: `${padY}px`,
        paddingBottom: `${padY}px`,
        lineHeight: 1,
        minWidth: `${size}px`,
        height: `${Math.round(size * 0.7)}px`,
      }}
    >
      PXI
      {showDot && (
        <span
          className="absolute rounded-full"
          style={{
            width: `${dotSize}px`,
            height: `${dotSize}px`,
            backgroundColor: dotColors[variant],
            top: `-${Math.round(dotSize * 0.25)}px`,
            right: `-${Math.round(dotSize * 0.25)}px`,
          }}
        />
      )}
    </span>
  );
}
