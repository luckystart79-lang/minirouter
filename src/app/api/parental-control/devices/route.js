import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { DATA_DIR } from "@/lib/dataDir.js";

const DB_FILE = path.join(DATA_DIR, "parental-control-store.json");

function readStore() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, "utf8");
      return JSON.parse(data);
    }
  } catch (e) {
    console.error("[Parental Sync] Error reading store:", e);
  }
  return { devices: {}, commands: {} };
}

export async function GET() {
  try {
    const store = readStore();
    return NextResponse.json({ ok: true, devices: store.devices || {} });
  } catch (e) {
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}
