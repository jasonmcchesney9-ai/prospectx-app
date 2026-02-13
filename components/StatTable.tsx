import type { PlayerStats } from "@/types/api";

function formatTOI(seconds: number): string {
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

export default function StatTable({ stats }: { stats: PlayerStats[] }) {
  if (stats.length === 0) {
    return (
      <div className="text-center py-8 text-muted text-sm">
        No stats available for this player.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="px-3 py-2 font-oswald text-xs uppercase tracking-wider text-muted">Season</th>
            <th className="px-3 py-2 font-oswald text-xs uppercase tracking-wider text-muted">Type</th>
            <th className="px-3 py-2 font-oswald text-xs uppercase tracking-wider text-muted text-center">GP</th>
            <th className="px-3 py-2 font-oswald text-xs uppercase tracking-wider text-muted text-center">G</th>
            <th className="px-3 py-2 font-oswald text-xs uppercase tracking-wider text-muted text-center">A</th>
            <th className="px-3 py-2 font-oswald text-xs uppercase tracking-wider text-muted text-center">P</th>
            <th className="px-3 py-2 font-oswald text-xs uppercase tracking-wider text-muted text-center">+/-</th>
            <th className="px-3 py-2 font-oswald text-xs uppercase tracking-wider text-muted text-center">PIM</th>
            <th className="px-3 py-2 font-oswald text-xs uppercase tracking-wider text-muted text-center">TOI</th>
            <th className="px-3 py-2 font-oswald text-xs uppercase tracking-wider text-muted text-center">S%</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((s) => (
            <tr key={s.id} className="border-b border-border/50 hover:bg-navy/[0.02]">
              <td className="px-3 py-2 font-medium text-navy">{s.season || "—"}</td>
              <td className="px-3 py-2 text-muted capitalize">{s.stat_type}</td>
              <td className="px-3 py-2 text-center">{s.gp}</td>
              <td className="px-3 py-2 text-center font-semibold">{s.g}</td>
              <td className="px-3 py-2 text-center">{s.a}</td>
              <td className="px-3 py-2 text-center font-semibold text-teal">{s.p}</td>
              <td className="px-3 py-2 text-center">
                <span className={s.plus_minus > 0 ? "text-green-600" : s.plus_minus < 0 ? "text-red-600" : ""}>
                  {s.plus_minus > 0 ? "+" : ""}{s.plus_minus}
                </span>
              </td>
              <td className="px-3 py-2 text-center">{s.pim}</td>
              <td className="px-3 py-2 text-center text-muted">{formatTOI(s.toi_seconds)}</td>
              <td className="px-3 py-2 text-center text-muted">
                {s.shooting_pct != null ? `${s.shooting_pct}%` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
