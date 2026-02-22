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
  ReferenceLine,
} from "recharts";
import type { TrendlineResponse } from "@/types/api";

interface Props {
  data: TrendlineResponse;
}

const TREND_STYLES: Record<string, { icon: React.ComponentType<{ size?: number; className?: string }>; label: string; color: string; bg: string }> = {
  improving: { icon: TrendingUp, label: "Trending Up", color: "text-green-600", bg: "bg-green-50" },
  declining: { icon: TrendingDown, label: "Trending Down", color: "text-red-600", bg: "bg-red-50" },
  stable: { icon: Minus, label: "Stable", color: "text-navy/60", bg: "bg-navy/[0.05]" },
  insufficient_data: { icon: BarChart3, label: "Not Enough Data", color: "text-muted", bg: "bg-gray-50" },
};

const METRIC_LABELS: Record<string, string> = {
  points: "Points",
  goals: "Goals",
  assists: "Assists",
  shots: "Shots",
  plus_minus: "+/-",
  toi: "TOI",
};

export default function TrendlineChart({ data }: Props) {
  const { trendline, trend, metric, games_found } = data;
  const trendInfo = TREND_STYLES[trend] || TREND_STYLES.insufficient_data;
  const TrendIcon = trendInfo.icon;

  if (!trendline || trendline.length === 0) {
    return (
      <div className="text-center py-6">
        <BarChart3 size={24} className="mx-auto text-muted/30 mb-2" />
        <p className="text-xs text-muted">No trendline data available.</p>
      </div>
    );
  }

  const avg = trendline.length > 0
    ? trendline.reduce((s, p) => s + p.value, 0) / trendline.length
    : 0;

  return (
    <div className="space-y-3">
      {/* Trend badge */}
      <div className="flex items-center justify-between">
        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-oswald uppercase tracking-wider ${trendInfo.bg} ${trendInfo.color}`}>
          <TrendIcon size={11} />
          {trendInfo.label}
        </div>
        <span className="text-[10px] text-muted">{games_found} games</span>
      </div>

      {/* Chart */}
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={trendline} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis
              dataKey="opponent"
              tick={{ fontSize: 9, fill: "#6B7280" }}
              interval={Math.max(0, Math.floor(trendline.length / 6))}
            />
            <YAxis tick={{ fontSize: 10, fill: "#6B7280" }} domain={[0, "auto"]} />
            <Tooltip
              contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #E5E7EB" }}
              labelFormatter={(_, payload) => {
                const p = payload?.[0]?.payload;
                return p ? `${p.date} vs ${p.opponent}` : "";
              }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={((value: any, name: any) => [
                typeof value === "number" ? value.toFixed(name === "rolling_avg" ? 2 : 0) : "0",
                name === "rolling_avg" ? "Rolling Avg" : METRIC_LABELS[metric] || metric,
              ]) as any}
            />
            <ReferenceLine y={avg} stroke="#9CA3AF" strokeDasharray="4 4" />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#18B3A6"
              strokeWidth={2}
              dot={{ r: 3, fill: "#18B3A6" }}
              name={metric}
            />
            <Line
              type="monotone"
              dataKey="rolling_avg"
              stroke="#F36F21"
              strokeWidth={1.5}
              dot={false}
              strokeDasharray="5 5"
              name="rolling_avg"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
