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

function writeStore(store) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(store, null, 2), "utf8");
  } catch (e) {
    console.error("[Parental Sync] Error writing store:", e);
  }
}

export async function POST(req) {
  try {
    const payload = await req.json();
    const { clientUuid, commandType, value } = payload;

    if (!clientUuid || !commandType) {
      return NextResponse.json({ error: "Missing clientUuid or commandType" }, { status: 400 });
    }

    const store = readStore();
    
    if (!store.commands[clientUuid]) {
      store.commands[clientUuid] = [];
    }

    // Queue the command
    store.commands[clientUuid].push({
      type: commandType,
      value: value,
      timestamp: new Date().toISOString()
    });

    writeStore(store);

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}
