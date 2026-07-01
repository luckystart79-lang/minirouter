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
    const { clientUuid, type, action, data } = payload;

    if (!clientUuid || !type || !action) {
      return NextResponse.json({ error: "Missing clientUuid, type, or action" }, { status: 400 });
    }

    const store = readStore();
    const device = store.devices[clientUuid];

    if (!device) {
      return NextResponse.json({ error: "Device not found" }, { status: 404 });
    }

    if (!device.profile) device.profile = {};
    if (!device.profile.quizzes) device.profile.quizzes = [];
    if (!device.profile.videos) device.profile.videos = [];
    if (!device.profile.tasks) device.profile.tasks = [];

    if (!store.commands[clientUuid]) {
      store.commands[clientUuid] = [];
    }

    const nowTimestamp = new Date().toISOString();

    if (type === "QUIZ") {
      if (action === "ASSIGN") {
        // Prevent duplicate quizzes
        const quizExists = device.profile.quizzes.some((q) => q.id === data.id);
        if (!quizExists) {
          device.profile.quizzes.push(data);
        }
        device.profile.updatedAt = Date.now();

        // Queue command
        store.commands[clientUuid].push({
          type: "UPDATE_QUIZZES",
          value: JSON.stringify(device.profile.quizzes),
          timestamp: nowTimestamp
        });
      } else if (action === "UNASSIGN") {
        device.profile.quizzes = device.profile.quizzes.filter((q) => q.id !== data.quizId);
        device.profile.updatedAt = Date.now();

        // Queue command
        store.commands[clientUuid].push({
          type: "UPDATE_QUIZZES",
          value: JSON.stringify(device.profile.quizzes),
          timestamp: nowTimestamp
        });
      }
    } else if (type === "VIDEO") {
      if (action === "ASSIGN") {
        // Queue local crawl command on child PC
        store.commands[clientUuid].push({
          type: "ADD_VIDEO_URL",
          value: JSON.stringify({
            url: data.url,
            title: data.title || "",
            level: data.level || "A2"
          }),
          timestamp: nowTimestamp
        });
      } else if (action === "UNASSIGN") {
        device.profile.videos = device.profile.videos.filter((v) => v.id !== data.videoId);
        device.profile.updatedAt = Date.now();

        // Queue command
        store.commands[clientUuid].push({
          type: "UPDATE_VIDEOS",
          value: JSON.stringify(device.profile.videos),
          timestamp: nowTimestamp
        });
      }
    }

    writeStore(store);

    return NextResponse.json({ ok: true, profile: device.profile });
  } catch (e) {
    console.error("[Parental Assign] Error:", e);
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}
