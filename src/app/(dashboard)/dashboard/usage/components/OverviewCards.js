"use client";

import PropTypes from "prop-types";
import Card from "@/shared/components/Card";

const fmtCompact = (n) => {
  if (!n) return "0";
  if (n >= 1000000000) return `${(n / 1000000000).toFixed(1)}B`;
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return new Intl.NumberFormat().format(n);
};
const fmtCost = (n) => `$${(n || 0).toFixed(2)}`;

export default function OverviewCards({ stats }) {
  const totalTokens = (stats.totalPromptTokens || 0) + (stats.totalCompletionTokens || 0);

  return (
    <div className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 sm:gap-4">
      <Card className="flex min-w-0 flex-col gap-1 px-4 py-3">
        <span className="text-text-muted text-xs uppercase font-semibold">Total Requests</span>
        <span className="truncate text-2xl font-bold">{fmtCompact(stats.totalRequests)}</span>
      </Card>
      <Card className="flex min-w-0 flex-col gap-1 px-4 py-3">
        <span className="text-text-muted text-xs uppercase font-semibold">Input Tokens</span>
        <span className="truncate text-2xl font-bold text-primary">{fmtCompact(stats.totalPromptTokens)}</span>
      </Card>
      <Card className="flex min-w-0 flex-col gap-1 px-4 py-3">
        <span className="text-text-muted text-xs uppercase font-semibold">Output Tokens</span>
        <span className="truncate text-2xl font-bold text-success">{fmtCompact(stats.totalCompletionTokens)}</span>
      </Card>
      <Card className="flex min-w-0 flex-col gap-1 px-4 py-3">
        <span className="text-text-muted text-xs uppercase font-semibold">Total Tokens</span>
        <span className="truncate text-2xl font-bold">{fmtCompact(totalTokens)}</span>
      </Card>
      <Card className="flex min-w-0 flex-col gap-1 px-4 py-3">
        <span className="text-text-muted text-xs uppercase font-semibold">Trung bình/ngày</span>
        <span className="truncate text-2xl font-bold">{fmtCompact(stats.avgTokensPerDay || 0)}</span>
      </Card>
      <Card className="flex min-w-0 flex-col gap-1 px-4 py-3">
        <span className="text-text-muted text-xs uppercase font-semibold">Est. Cost</span>
        <span className="truncate text-2xl font-bold text-warning">~{fmtCost(stats.totalCost)}</span>
        <span className="text-[10px] text-text-muted">Estimated, not actual billing</span>
      </Card>
    </div>
  );
}

OverviewCards.propTypes = {
  stats: PropTypes.object.isRequired,
};
