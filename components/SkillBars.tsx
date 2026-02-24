"use client";

// ── Grade-to-number mapping for letter grades ──
const GRADE_TO_NUMBER: Record<string, number> = {
  "A+": 10, "A": 9, "A-": 8, "B+": 7, "B": 6, "B-": 5,
  "C+": 4, "C": 3, "C-": 2, "D+": 1.5, "D": 1, "NR": 0,
};

function gradeToNumber(grade: unknown): number {
  if (grade == null) return 0;
  if (typeof grade === "number") return grade;
  const str = String(grade);
  return GRADE_TO_NUMBER[str] ?? (parseFloat(str) || 0);
}

// ── Tier label + color based on grade value ──
function getTier(value: number): { label: string; color: string; bg: string } {
  if (value >= 8) return { label: "Strength", color: "#1E6B3C", bg: "rgba(30, 107, 60, 0.15)" };
  if (value >= 6) return { label: "Above Avg", color: "#0D9488", bg: "rgba(13, 148, 136, 0.15)" };
  if (value >= 4) return { label: "Average", color: "#F39C12", bg: "rgba(243, 156, 18, 0.15)" };
  if (value >= 1) return { label: "Below Avg", color: "#C0392B", bg: "rgba(192, 57, 43, 0.15)" };
  return { label: "N/A", color: "#666666", bg: "rgba(102, 102, 102, 0.1)" };
}

// ── Primary bar config ──
const PRIMARY_BARS = [
  { key: "skating_grade", label: "Skating" },
  { key: "hockey_iq_grade", label: "Hockey IQ" },
  { key: "compete_grade", label: "Compete" },
] as const;

// ── Secondary grid config ──
const SECONDARY_ITEMS = [
  { key: "offensive_grade", label: "Offense" },
  { key: "defensive_grade", label: "Defense" },
] as const;

interface Props {
  intelligence: Record<string, unknown> | null;
}

function SkillBar({ label, value }: { label: string; value: number }) {
  const tier = getTier(value);
  const widthPct = Math.max(5, (value / 10) * 100);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-oswald uppercase tracking-wider text-navy/70">{label}</span>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-oswald font-bold" style={{ color: tier.color }}>{value.toFixed(1)}</span>
          <span className="text-[9px] font-oswald uppercase tracking-wider" style={{ color: tier.color }}>{tier.label}</span>
        </div>
      </div>
      <div className="h-2 bg-navy/[0.06] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${widthPct}%`, backgroundColor: tier.color }}
        />
      </div>
    </div>
  );
}

function SecondaryMetric({ label, value }: { label: string; value: number }) {
  const tier = getTier(value);

  return (
    <div className="rounded-lg p-2 text-center" style={{ backgroundColor: tier.bg }}>
      <p className="text-[9px] font-oswald uppercase tracking-wider text-muted mb-0.5">{label}</p>
      <p className="text-sm font-oswald font-bold" style={{ color: tier.color }}>{value.toFixed(1)}</p>
      <p className="text-[8px] font-oswald uppercase tracking-wider" style={{ color: tier.color }}>{tier.label}</p>
    </div>
  );
}

export default function SkillBars({ intelligence }: Props) {
  if (!intelligence) return null;

  const primaryValues = PRIMARY_BARS.map(({ key, label }) => ({
    label,
    value: gradeToNumber(intelligence[key]),
  }));

  const secondaryValues = SECONDARY_ITEMS.map(({ key, label }) => ({
    label,
    value: gradeToNumber(intelligence[key]),
  }));

  // If all values are 0, don't render
  const allZero = [...primaryValues, ...secondaryValues].every(v => v.value === 0);
  if (allZero) return null;

  return (
    <div className="bg-white rounded-xl border border-teal/20 p-4">
      <h3 className="text-[10px] font-oswald uppercase tracking-wider text-muted mb-3">Skill Profile</h3>

      {/* Primary bars */}
      <div className="space-y-2.5 mb-3">
        {primaryValues.filter(v => v.value > 0).map(({ label, value }) => (
          <SkillBar key={label} label={label} value={value} />
        ))}
      </div>

      {/* Secondary grid */}
      {secondaryValues.some(v => v.value > 0) && (
        <div className="grid grid-cols-2 gap-2">
          {secondaryValues.filter(v => v.value > 0).map(({ label, value }) => (
            <SecondaryMetric key={label} label={label} value={value} />
          ))}
        </div>
      )}
    </div>
  );
}
