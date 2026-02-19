"use client";

interface RatingSliderProps {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
}

const LABELS = ["Below Avg", "Average", "Above Avg", "Very Good", "Elite"];

export default function RatingSlider({ label, value, onChange }: RatingSliderProps) {
  return (
    <div>
      <p className="text-xs font-oswald uppercase tracking-wider text-navy/70 mb-2">{label}</p>
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-muted w-14 text-right shrink-0">Below Avg</span>
        <div className="flex gap-1.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onChange(value === n ? null : n)}
              className={`w-11 h-11 rounded-full flex items-center justify-center text-sm font-oswald font-bold transition-all border-2 ${
                value === n
                  ? "bg-teal border-teal text-white shadow-sm"
                  : "bg-white border-teal/20 text-navy/50 hover:border-teal/50 hover:text-navy"
              }`}
              title={LABELS[n - 1]}
            >
              {n}
            </button>
          ))}
        </div>
        <span className="text-[10px] text-muted w-8 shrink-0">Elite</span>
      </div>
    </div>
  );
}
