import { SECTION_LABELS } from "@/types/api";

interface Props {
  sectionKey: string;
  content: string;
}

export default function ReportSection({ sectionKey, content }: Props) {
  const label = SECTION_LABELS[sectionKey] || sectionKey.replace(/_/g, " ");

  return (
    <section className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-1 h-5 bg-teal rounded-full" />
        <h3 className="font-oswald text-sm font-semibold uppercase tracking-wider text-navy">
          {label}
        </h3>
      </div>
      <div className="text-sm leading-relaxed text-body whitespace-pre-wrap pl-3">
        {content}
      </div>
    </section>
  );
}
