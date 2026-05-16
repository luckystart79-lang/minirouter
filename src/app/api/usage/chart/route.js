import { NextResponse } from "next/server";
import { getChartData } from "@/lib/usageDb";

const VALID_PERIODS = new Set(["today", "24h", "7d", "30d", "60d", "all"]);
const VALID_GROUP_BY = new Set(["hour", "day", "week", "month"]);

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "7d";
    const groupBy = searchParams.get("groupBy") || null;

    if (!VALID_PERIODS.has(period)) {
      return NextResponse.json({ error: "Invalid period" }, { status: 400 });
    }

    if (groupBy && !VALID_GROUP_BY.has(groupBy)) {
      return NextResponse.json({ error: "Invalid groupBy" }, { status: 400 });
    }

    const data = await getChartData(period, groupBy);
    return NextResponse.json(data);
  } catch (error) {
    console.error("[API] Failed to get chart data:", error);
    return NextResponse.json({ error: "Failed to fetch chart data" }, { status: 500 });
  }
}
