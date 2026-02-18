import { SECTION_LABELS } from "@/types/api";
import { assetUrl } from "@/lib/api";
import { Shield, Star, TrendingUp, Target, Zap, ClipboardList } from "lucide-react";

interface Props {
  sectionKey: string;
  content: string;
}

// Sections that get special visual treatment
const HIGHLIGHT_SECTIONS: Record<string, {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  gradient: string;
  accent: string;
  badge?: string;
}> = {
  SYSTEM_FIT: {
    icon: Shield,
    gradient: "from-navy/[0.06] via-teal/[0.04] to-navy/[0.02]",
    accent: "bg-gradient-to-b from-teal to-navy",
    badge: "Hockey OS",
  },
  EXECUTIVE_SUMMARY: {
    icon: Star,
    gradient: "from-navy/[0.04] to-transparent",
    accent: "bg-navy",
  },
  PROJECTION: {
    icon: TrendingUp,
    gradient: "from-orange/[0.04] to-transparent",
    accent: "bg-orange",
  },
  BOTTOM_LINE: {
    icon: Target,
    gradient: "from-teal/[0.04] to-transparent",
    accent: "bg-teal",
  },
  RECOMMENDED_DRILLS: {
    icon: ClipboardList,
    gradient: "from-teal/[0.04] via-navy/[0.02] to-transparent",
    accent: "bg-gradient-to-b from-teal to-navy",
    badge: "Drill Library",
  },
};

/** Parse system fit rating from content (e.g., "Elite Fit", "Strong Fit") */
function extractFitRating(content: string): string | null {
  const patterns = [
    /(?:system\s+compatibility|overall\s+(?:system\s+)?fit|system\s+fit\s+rating)\s*[:—]\s*\**\s*(Elite Fit|Strong Fit|Developing Fit|Adjustment Needed)\b/i,
    /\*\*(Elite Fit|Strong Fit|Developing Fit|Adjustment Needed)\*\*/i,
  ];
  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function fitRatingColor(rating: string): { bg: string; text: string } {
  const lower = rating.toLowerCase();
  if (lower.includes("elite")) return { bg: "bg-teal/15", text: "text-teal" };
  if (lower.includes("strong")) return { bg: "bg-navy/10", text: "text-navy" };
  if (lower.includes("developing")) return { bg: "bg-orange/15", text: "text-orange" };
  return { bg: "bg-red-50", text: "text-red-600" };
}

/**
 * Render content with markdown image support and bold text.
 * Handles: ![alt](url) → <img>, **text** → <strong>
 */
function RichContent({ text, className }: { text: string; className?: string }) {
  // Split content into segments: text, images, bold
  const parts: React.ReactNode[] = [];
  // Regex to match markdown images: ![alt](url)
  const imgRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  let lastIndex = 0;
  let match;
  let partKey = 0;

  while ((match = imgRegex.exec(text)) !== null) {
    // Add text before the image
    if (match.index > lastIndex) {
      const textBefore = text.slice(lastIndex, match.index);
      parts.push(<BoldText key={partKey++} text={textBefore} />);
    }

    // Render the image
    const alt = match[1];
    const url = match[2];
    // Resolve the URL using assetUrl if it's a relative path
    const resolvedUrl = url.startsWith("/") ? assetUrl(url) : url;
    parts.push(
      <div key={partKey++} className="my-3">
        <img
          src={resolvedUrl}
          alt={alt}
          className="max-w-full sm:max-w-[400px] max-h-52 object-contain rounded-lg border border-teal/8 bg-white p-2"
        />
      </div>
    );

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(<BoldText key={partKey++} text={text.slice(lastIndex)} />);
  }

  // If no images found, just render with bold support
  if (parts.length === 0) {
    return <BoldText text={text} className={className} />;
  }

  return <div className={className}>{parts}</div>;
}

/** Render text with **bold** markdown support */
function BoldText({ text, className }: { text: string; className?: string }) {
  const boldRegex = /\*\*([^*]+)\*\*/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;
  let partKey = 0;

  while ((match = boldRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<span key={partKey++}>{text.slice(lastIndex, match.index)}</span>);
    }
    parts.push(<strong key={partKey++} className="font-semibold text-navy">{match[1]}</strong>);
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(<span key={partKey++}>{text.slice(lastIndex)}</span>);
  }

  if (parts.length === 0) {
    return <span className={className}>{text}</span>;
  }

  return <span className={className}>{parts}</span>;
}

/** Check if content contains markdown images */
function hasImages(content: string): boolean {
  return /!\[[^\]]*\]\([^)]+\)/.test(content);
}

export default function ReportSection({ sectionKey, content }: Props) {
  const label = SECTION_LABELS[sectionKey] || sectionKey.replace(/_/g, " ");
  const highlight = HIGHLIGHT_SECTIONS[sectionKey];
  const contentHasImages = hasImages(content);

  // Special RECOMMENDED_DRILLS rendering
  if (sectionKey === "RECOMMENDED_DRILLS") {
    return (
      <section className="mb-8">
        <div className="rounded-xl border border-teal/20 bg-gradient-to-br from-teal/[0.04] via-navy/[0.02] to-transparent p-5 sm:p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal to-navy flex items-center justify-center">
                <ClipboardList size={16} className="text-white" />
              </div>
              <div>
                <h3 className="font-oswald text-sm font-bold uppercase tracking-wider text-navy">
                  {label}
                </h3>
                <span className="text-[10px] font-oswald uppercase tracking-widest text-teal/70">
                  ProspectX Drill Library
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1 px-2 py-1 rounded bg-navy/[0.06]">
              <Zap size={10} className="text-teal" />
              <span className="text-[9px] font-oswald uppercase tracking-wider text-navy/50">Drills</span>
            </div>
          </div>

          {/* Ice stripe accent */}
          <div className="ice-stripe mb-4 rounded-full" />

          {/* Content with images */}
          <div className="text-sm leading-relaxed text-navy/85 whitespace-pre-wrap">
            <RichContent text={content} />
          </div>
        </div>
      </section>
    );
  }

  // Special SYSTEM_FIT rendering
  if (sectionKey === "SYSTEM_FIT") {
    const fitRating = extractFitRating(content);
    return (
      <section className="mb-8">
        <div className={`rounded-xl border border-teal/20 bg-gradient-to-br ${highlight.gradient} p-5 sm:p-6`}>
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal to-navy flex items-center justify-center">
                <Shield size={16} className="text-white" />
              </div>
              <div>
                <h3 className="font-oswald text-sm font-bold uppercase tracking-wider text-navy">
                  {label}
                </h3>
                <span className="text-[10px] font-oswald uppercase tracking-widest text-teal/70">
                  Hockey Operating System
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {fitRating && (
                <span className={`px-3 py-1 rounded-full text-xs font-oswald font-bold uppercase tracking-wider ${fitRatingColor(fitRating).bg} ${fitRatingColor(fitRating).text}`}>
                  {fitRating}
                </span>
              )}
              <div className="flex items-center gap-1 px-2 py-1 rounded bg-navy/[0.06]">
                <Zap size={10} className="text-teal" />
                <span className="text-[9px] font-oswald uppercase tracking-wider text-navy/50">ProspectX</span>
              </div>
            </div>
          </div>

          {/* Ice stripe accent */}
          <div className="ice-stripe mb-4 rounded-full" />

          {/* Content */}
          <div className="text-sm leading-relaxed text-navy/85 whitespace-pre-wrap">
            {contentHasImages ? <RichContent text={content} /> : content}
          </div>
        </div>
      </section>
    );
  }

  // Highlighted sections (Executive Summary, Projection, Bottom Line)
  if (highlight) {
    const Icon = highlight.icon;
    return (
      <section className="mb-6">
        <div className={`rounded-lg bg-gradient-to-r ${highlight.gradient} p-4 sm:p-5 border border-teal/8`}>
          <div className="flex items-center gap-2 mb-3">
            <div className={`w-1 h-5 ${highlight.accent} rounded-full`} />
            <Icon size={14} className="text-navy/60" />
            <h3 className="font-oswald text-sm font-semibold uppercase tracking-wider text-navy">
              {label}
            </h3>
          </div>
          <div className="text-sm leading-relaxed text-body whitespace-pre-wrap pl-3">
            {contentHasImages ? <RichContent text={content} /> : content}
          </div>
        </div>
      </section>
    );
  }

  // Default section rendering
  return (
    <section className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-1 h-5 bg-teal rounded-full" />
        <h3 className="font-oswald text-sm font-semibold uppercase tracking-wider text-navy">
          {label}
        </h3>
      </div>
      <div className="text-sm leading-relaxed text-body whitespace-pre-wrap pl-3">
        {contentHasImages ? <RichContent text={content} /> : content}
      </div>
    </section>
  );
}
