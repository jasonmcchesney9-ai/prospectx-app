"use client";

import { TrendingUp, TrendingDown, Minus, BarChart3 } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type { Progression } from "@/types/api";

interface Props {
  data: Progression;
}

const TREND_STYLES: Record<string, { icon: React.ComponentType<{ size?: number; className?: string }>; label: string; color: string; bg: string }> = {
  improving: { icon: TrendingUp, label: "Improving", color: "text-green-600", bg: "bg-green-50" },
  declining: { icon: TrendingDown, label: "Declining", color: "text-red-600", bg: "bg-red-50" },
  stable: { icon: Minus, label: "Stable", color: "text-navy/60", bg: "bg-navy/[0.05]" },
  insufficient_data: { icon: BarChart3, label: "Insufficient Data", color: "text-muted", bg: "bg-gray-50" },
};

function formatSeason(season: string): string {
  // "2024-2025" → "24-25"
  if (season && season.includes("-")) {
    const parts = season.split("-");
    return `${parts[0].slice(-2)}-${parts[1].slice(-2)}`;
  }
  return season;
}

export default function ProgressionChart({ data }: Props) {
  const { seasons, trend, yoy_delta } = data;
  const trendInfo = TREND_STYLES[trend] || TREND_STYLES.insufficient_data;
  const TrendIcon = trendInfo.icon;

  if (!seasons || seasons.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-teal/20 p-6 text-center">
        <BarChart3 size={32} className="mx-auto text-muted/30 mb-2" />
        <p className="text-sm text-muted">No progression data available.</p>
        <p className="text-xs text-muted/60 mt-1">Sync stats from HockeyTech to see season-over-season trends.</p>
      </div>
    );
  }

  // Prepare chart data
  const chartData = seasons.map((s) => ({
    season: formatSeason(s.season || ""),
    ppg: s.ppg_rate || 0,
    gpg: s.gpg_rate || 0,
    apg: s.apg_rate || 0,
    gp: s.gp || 0,
    p: s.p || 0,
    g: s.g || 0,
    a: s.a || 0,
  }));

  return (
    <div className="space-y-4">
      {/* Trend badge + YoY delta */}
      <div className="flex items-center justify-between">
        <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-oswald uppercase tracking-wider ${trendInfo.bg} ${trendInfo.color}`}>
          <TrendIcon size={12} />
          {trendInfo.label}
        </div>
        {yoy_delta && (typeof yoy_delta.ppg_rate === "number") && (
          <div className="text-xs text-muted">
            YoY PPG: <span className={yoy_delta.ppg_rate > 0 ? "text-green-600 font-semibold" : yoy_delta.ppg_rate < 0 ? "text-red-600 font-semibold" : "text-navy"}>
              {yoy_delta.ppg_rate > 0 ? "+" : ""}{yoy_delta.ppg_rate.toFixed(2)}
            </span>
            {typeof yoy_delta.p === "number" && (
              <span className="ml-3">
                Pts: <span className={yoy_delta.p > 0 ? "text-green-600 font-semibold" : yoy_delta.p < 0 ? "text-red-600 font-semibold" : "text-navy"}>
                  {yoy_delta.p > 0 ? "+" : ""}{yoy_delta.p}
                </span>
              </span>
            )}
          </div>
        )}
      </div>

      {/* PPG Line Chart */}
      <div className="bg-white rounded-xl border border-teal/20 p-4">
        <h4 className="text-[10px] font-oswald uppercase tracking-wider text-muted mb-3">Points Per Game by Season</h4>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="season" tick={{ fontSize: 11, fill: "#6B7280" }} />
              <YAxis tick={{ fontSize: 11, fill: "#6B7280" }} domain={[0, "auto"]} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E5E7EB" }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={((value: any, name: any) => [typeof value === "number" ? value.toFixed(2) : "0", name === "ppg" ? "PPG" : name === "gpg" ? "GPG" : "APG"]) as any}
              />
              <Line type="monotone" dataKey="ppg" stroke="#18B3A6" strokeWidth={2.5} dot={{ r: 4, fill: "#18B3A6" }} name="ppg" />
              <Line type="monotone" dataKey="gpg" stroke="#F36F21" strokeWidth={1.5} dot={{ r: 3, fill: "#F36F21" }} name="gpg" strokeDasharray="5 5" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Season-over-season table */}
      <div className="bg-white rounded-xl border border-teal/20 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-teal/20 bg-navy/[0.03]">
                <th className="text-left px-3 py-2 text-[10px] font-oswald uppercase tracking-wider text-muted">Season</th>
                <th className="text-right px-3 py-2 text-[10px] font-oswald uppercase tracking-wider text-muted">GP</th>
                <th className="text-right px-3 py-2 text-[10px] font-oswald uppercase tracking-wider text-muted">G</th>
                <th className="text-right px-3 py-2 text-[10px] font-oswald uppercase tracking-wider text-muted">A</th>
                <th className="text-right px-3 py-2 text-[10px] font-oswald uppercase tracking-wider text-muted">P</th>
                <th className="text-right px-3 py-2 text-[10px] font-oswald uppercase tracking-wider text-muted">+/-</th>
                <th className="text-right px-3 py-2 text-[10px] font-oswald uppercase tracking-wider text-muted">PIM</th>
                <th className="text-right px-3 py-2 text-[10px] font-oswald uppercase tracking-wider text-muted">PPG</th>
              </tr>
            </thead>
            <tbody>
              {seasons.map((s, i) => (
                <tr key={s.season || i} className="border-b border-teal/10 hover:bg-navy/[0.02]">
                  <td className="px-3 py-2 font-medium text-navy">{s.season || "—"}</td>
                  <td className="px-3 py-2 text-right">{s.gp || 0}</td>
                  <td className="px-3 py-2 text-right">{s.g || 0}</td>
                  <td className="px-3 py-2 text-right">{s.a || 0}</td>
                  <td className="px-3 py-2 text-right font-semibold text-navy">{s.p || 0}</td>
                  <td className="px-3 py-2 text-right">{s.plus_minus || 0}</td>
                  <td className="px-3 py-2 text-right">{s.pim || 0}</td>
                  <td className="px-3 py-2 text-right font-semibold text-teal">{s.ppg_rate?.toFixed(2) || "0.00"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
