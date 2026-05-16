"use client";

import { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import Card from "@/shared/components/Card";

const fmtTokens = (n) => {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n || 0);
};

const fmtNumber = (n) => new Intl.NumberFormat("vi-VN").format(n || 0);

const GROUP_OPTIONS = [
  { value: "hour", label: "Giờ" },
  { value: "day", label: "Ngày" },
  { value: "week", label: "Tuần" },
  { value: "month", label: "Tháng" },
];

export default function UsageChart({ period = "7d" }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [groupBy, setGroupBy] = useState(() => {
    if (period === "today" || period === "24h") return "hour";
    return "day";
  });

  // Reset groupBy when period changes
  useEffect(() => {
    if (period === "today" || period === "24h") setGroupBy("hour");
    else setGroupBy("day");
  }, [period]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/usage/chart?period=${period}&groupBy=${groupBy}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (e) {
      console.error("Failed to fetch chart data:", e);
    } finally {
      setLoading(false);
    }
  }, [period, groupBy]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const hasData = data.some((d) => d.tokens > 0 || d.requests > 0);

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{
        backgroundColor: "var(--color-bg, #1a1a2e)",
        border: "1px solid var(--color-border, #333)",
        borderRadius: "8px",
        padding: "10px 14px",
        fontSize: "12px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
      }}>
        <div style={{ color: "var(--color-text-muted, #888)", marginBottom: 6, fontWeight: 600 }}>{label}</div>
        {payload.map((entry, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: entry.color, display: "inline-block" }} />
            <span style={{ color: entry.color }}>
              {entry.name === "Requests" ? fmtNumber(entry.value) : fmtTokens(entry.value)}
            </span>
            <span style={{ color: "var(--color-text-muted, #888)" }}>{entry.name}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Card className="flex min-w-0 flex-col gap-3 p-3 sm:p-4">
      {/* Title */}
      <h3 className="text-sm font-semibold" style={{ color: "var(--color-text, #e0e0e0)" }}>
        Biểu đồ sử dụng theo thời gian
      </h3>

      {/* Chart */}
      {loading ? (
        <div className="h-56 flex items-center justify-center text-text-muted text-sm">
          <span className="material-symbols-outlined text-[24px] animate-spin mr-2">progress_activity</span>
          Đang tải...
        </div>
      ) : !hasData ? (
        <div className="h-56 flex items-center justify-center text-text-muted text-sm">Không có dữ liệu trong khoảng thời gian này</div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gradTokensDual" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="gradRequestsDual" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f97316" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#f97316" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.08} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: "currentColor", fillOpacity: 0.5 }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              yAxisId="tokens"
              orientation="left"
              tick={{ fontSize: 10, fill: "#6366f1", fillOpacity: 0.7 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={fmtTokens}
              width={55}
            />
            <YAxis
              yAxisId="requests"
              orientation="right"
              tick={{ fontSize: 10, fill: "#f97316", fillOpacity: 0.7 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(n) => fmtNumber(n)}
              width={50}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              verticalAlign="bottom"
              height={32}
              iconType="circle"
              formatter={(value) => <span style={{ fontSize: 12, color: "var(--color-text-muted, #888)" }}>{value}</span>}
            />
            <Area
              yAxisId="tokens"
              type="monotone"
              dataKey="tokens"
              name="Tokens"
              stroke="#6366f1"
              strokeWidth={2}
              fill="url(#gradTokensDual)"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2 }}
            />
            <Area
              yAxisId="requests"
              type="monotone"
              dataKey="requests"
              name="Requests"
              stroke="#f97316"
              strokeWidth={2}
              fill="url(#gradRequestsDual)"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}

      {/* GroupBy selector - below chart */}
      <div className="flex items-center gap-2 self-end">
        <span className="text-[11px] font-medium uppercase tracking-wider text-text-muted">Xem theo</span>
        <div className="flex items-center gap-1 rounded-lg border border-border bg-bg-subtle p-0.5">
          {GROUP_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setGroupBy(opt.value)}
              className={`rounded-md px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                groupBy === opt.value
                  ? "bg-primary text-white shadow-sm"
                  : "text-text-muted hover:text-text hover:bg-bg-hover"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </Card>
  );
}

UsageChart.propTypes = {
  period: PropTypes.string,
};
