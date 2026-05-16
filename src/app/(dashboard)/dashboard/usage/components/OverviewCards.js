"use client";

import PropTypes from "prop-types";
import Card from "@/shared/components/Card";

const fmt = (n) => new Intl.NumberFormat().format(n || 0);
const fmtCost = (n) => `$${(n || 0).toFixed(2)}`;

function getPeriodLabel(period) {
  const now = new Date();
  const days = period === "24h" || period === "today" ? 1 : period === "7d" ? 7 : period === "30d" ? 30 : 60;
  const start = new Date(now);
  start.setDate(start.getDate() - days);
  const f = (d) => d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
  return `${f(start)} đến ${f(now)}`;
}

export default function OverviewCards({ stats, period = "7d" }) {
  const totalTokens = (stats.totalPromptTokens || 0) + (stats.totalCompletionTokens || 0);
  const days = period === "24h" || period === "today" ? 1 : period === "7d" ? 7 : period === "30d" ? 30 : 60;
  const avgPerDay = days > 0 ? Math.round(totalTokens / days) : 0;

  return (
    <div className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 sm:gap-4">
      <Card className="flex min-w-0 flex-col gap-1 px-4 py-3">
        <span className="text-text-muted text-xs uppercase font-semibold">Total Requests</span>
        <span className="truncate text-2xl font-bold">{fmt(stats.totalRequests)}</span>
      </Card>
      <Card className="flex min-w-0 flex-col gap-1 px-4 py-3">
        <span className="text-text-muted text-xs uppercase font-semibold">Total Tokens</span>
        <span className="truncate text-2xl font-bold text-primary">{fmt(totalTokens)}</span>
      </Card>
      <Card className="flex min-w-0 flex-col gap-1 px-4 py-3">
        <span className="text-text-muted text-xs uppercase font-semibold">Trung bình/ngày</span>
        <span className="truncate text-2xl font-bold">{fmt(avgPerDay)}</span>
      </Card>
      <Card className="flex min-w-0 flex-col gap-1 px-4 py-3">
        <span className="text-text-muted text-xs uppercase font-semibold">Est. Cost</span>
        <span className="truncate text-2xl font-bold text-warning">~{fmtCost(stats.totalCost)}</span>
        <span className="text-[10px] text-text-muted">Estimated, not actual billing</span>
      </Card>
      <Card className="col-span-2 flex min-w-0 flex-col gap-1 px-4 py-3">
        <span className="text-text-muted text-xs uppercase font-semibold">Khoảng thời gian</span>
        <span className="truncate text-lg font-medium">{getPeriodLabel(period)}</span>
      </Card>
    </div>
  );
}

OverviewCards.propTypes = {
  stats: PropTypes.object.isRequired,
  period: PropTypes.string,
};
