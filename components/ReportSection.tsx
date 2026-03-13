import { SECTION_LABELS } from "@/types/api";
import { assetUrl } from "@/lib/api";
import { Shield, Star, TrendingUp, Target, Zap, ClipboardList } from "lucide-react";
import ListenButton from "./ListenButton";

interface ImageSnapshot {
  event_id: string;
  image_ref: string;
  label: string;
  timecode: string;
}

interface Props {
  sectionKey: string;
  content: string;
  imageSnapshots?: ImageSnapshot[] | null;
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

/** Check if content contains markdown images or [image:N] tokens */
function hasImages(content: string, snapshots?: ImageSnapshot[] | null): boolean {
  if (/!\[[^\]]*\]\([^)]+\)/.test(content)) return true;
  if (snapshots && snapshots.length > 0 && /\[image:\d+\]/.test(content)) return true;
  return false;
}

type BodySegment =
  | { type: "text"; content: string }
  | { type: "image"; src: string; label: string; timecode: string; index: number };

/** Parse report body text, replacing [image:N] tokens with image segments */
function parseReportBody(
  bodyText: string,
  snapshots?: ImageSnapshot[] | null,
): BodySegment[] {
  if (!snapshots || snapshots.length === 0) {
    return [{ type: "text", content: bodyText }];
  }

  const segments: BodySegment[] = [];
  const tokenRegex = /\[image:(\d+)\]/g;
  let lastIndex = 0;
  let match;

  while ((match = tokenRegex.exec(bodyText)) !== null) {
    // Text before the token
    if (match.index > lastIndex) {
      segments.push({ type: "text", content: bodyText.slice(lastIndex, match.index) });
    }

    const n = parseInt(match[1], 10);
    if (snapshots[n] && snapshots[n].image_ref) {
      segments.push({
        type: "image",
        src: snapshots[n].image_ref,
        label: snapshots[n].label || "",
        timecode: snapshots[n].timecode || "",
        index: n,
      });
    }
    // Else: skip token entirely — no broken image

    lastIndex = match.index + match[0].length;
  }

  // Remaining text
  if (lastIndex < bodyText.length) {
    segments.push({ type: "text", content: bodyText.slice(lastIndex) });
  }

  return segments;
}

/** Inline image still from a frozen video keyframe */
function ReportImageStill({
  src,
  label,
  timecode,
}: {
  src: string;
  label: string;
  timecode: string;
  index: number;
}) {
  return (
    <div
      style={{
        maxWidth: "100%",
        margin: "16px 0",
        borderRadius: "8px",
        overflow: "hidden",
        border: "1px solid #E2E8F0",
      }}
    >
      <img
        src={src}
        alt={label}
        style={{ width: "100%", display: "block" }}
        onError={(e) => {
          // Hide entire component on load error
          const target = e.currentTarget;
          if (target.parentElement) {
            target.parentElement.style.display = "none";
          }
        }}
      />
      <div
        style={{
          background: "#0F2942",
          padding: "8px 12px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span
          style={{
            color: "#FFFFFF",
            fontSize: "13px",
            fontFamily: "JetBrains Mono, monospace",
          }}
        >
          {label}
        </span>
        <span style={{ color: "#94A3B8", fontSize: "12px" }}>{timecode}</span>
      </div>
    </div>
  );
}

/** Render report body segments — text through existing renderer, images inline */
function ReportBodyRenderer({
  content,
  snapshots,
  textClassName,
}: {
  content: string;
  snapshots?: ImageSnapshot[] | null;
  textClassName?: string;
}) {
  const segments = parseReportBody(content, snapshots);
  const contentNeedsRich = hasImages(content, snapshots);

  // Single text segment with no images — use existing render path exactly
  if (segments.length === 1 && segments[0].type === "text" && !contentNeedsRich) {
    return <>{content}</>;
  }

  return (
    <>
      {segments.map((seg, i) => {
        if (seg.type === "image") {
          return (
            <ReportImageStill
              key={`img-${i}`}
              src={seg.src}
              label={seg.label}
              timecode={seg.timecode}
              index={seg.index}
            />
          );
        }
        // Text segment — use RichContent if it contains markdown images, else plain
        const textHasMarkdownImages = /!\[[^\]]*\]\([^)]+\)/.test(seg.content);
        if (textHasMarkdownImages) {
          return <RichContent key={`txt-${i}`} text={seg.content} className={textClassName} />;
        }
        return <BoldText key={`txt-${i}`} text={seg.content} className={textClassName} />;
      })}
    </>
  );
}

export default function ReportSection({ sectionKey, content, imageSnapshots }: Props) {
  const label = SECTION_LABELS[sectionKey] || sectionKey.replace(/_/g, " ");
  const highlight = HIGHLIGHT_SECTIONS[sectionKey];
  const contentHasImages = hasImages(content, imageSnapshots);

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
            <ReportBodyRenderer content={content} snapshots={imageSnapshots} />
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
            {contentHasImages ? <ReportBodyRenderer content={content} snapshots={imageSnapshots} /> : content}
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
            <h3 className="font-oswald text-sm font-semibold uppercase tracking-wider text-navy flex-1">
              {label}
            </h3>
            <ListenButton text={content} />
          </div>
          <div className="text-sm leading-relaxed text-body whitespace-pre-wrap pl-3">
            {contentHasImages ? <ReportBodyRenderer content={content} snapshots={imageSnapshots} /> : content}
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
        <h3 className="font-oswald text-sm font-semibold uppercase tracking-wider text-navy flex-1">
          {label}
        </h3>
        <ListenButton text={content} />
      </div>
      <div className="text-sm leading-relaxed text-body whitespace-pre-wrap pl-3">
        {contentHasImages ? <ReportBodyRenderer content={content} snapshots={imageSnapshots} /> : content}
      </div>
    </section>
  );
}
