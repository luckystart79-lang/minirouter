#!/usr/bin/env node

/**
 * 9Router Remote Agent — Telegram ↔ AI CLI Bridge + System API
 *
 * Chat from your phone on Telegram → AI CLI executes on your PC → results sent back.
 * Includes a local HTTP API bridge so AI CLI can trigger system actions
 * (send files, screenshots, run commands, web screenshots) via curl.
 *
 * Commands:
 *   /start        — Show help
 *   /cd           — Browse & select workspace (with pagination)
 *   /pwd          — Show current workspace
 *   /new          — Start fresh conversation (clear history)
 *   /stop         — Cancel running task
 *   /status       — Check if busy
 *   /file <path>  — Send file from PC to Telegram
 *   /run <cmd>    — Execute shell command directly
 *   /py <code>    — Run Python code
 *   /screen       — Screenshot desktop
 *   /web <url>    — Screenshot a web page
 *   /ls <dir>     — List directory contents
 *   /cat <file>   — Read and send file contents
 *   /9router ...  — Run in 9router workspace
 *   /coupon ...   — Run in coupon workspace
 *   (any text)    — Run via AI CLI in current workspace
 *
 * HTTP Bridge API (port 3847):
 *   POST /api/send-file      — {path} → send file to Telegram
 *   POST /api/screenshot      — {} → screenshot desktop
 *   POST /api/web-screenshot  — {url, width?, height?} → screenshot URL
 *   POST /api/run-command     — {command, cwd?} → execute shell command
 *   POST /api/run-python      — {code} → execute Python code
 *   POST /api/notify          — {message} → send message to Telegram
 *   POST /api/send-text       — {content, filename?} → send text as file
 */

require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const { spawn, exec } = require("child_process");
const { execSync } = require("child_process");
const http = require("http");
const path = require("path");
const fs = require("fs");

// ── Config ──────────────────────────────────────────────────────

const CONFIG = {
  token: process.env.TELEGRAM_BOT_TOKEN,
  allowedUsers: (process.env.ALLOWED_USER_IDS || "").split(",").map((s) => s.trim()).filter(Boolean),
  geminiCmd: process.env.GEMINI_CMD || "gemini",
  defaultWorkspace: process.env.DEFAULT_WORKSPACE || process.cwd(),
  workspaces: JSON.parse(process.env.WORKSPACES || "{}"),
  maxTimeout: parseInt(process.env.MAX_TIMEOUT || "600") * 1000,
  bridgePort: parseInt(process.env.BRIDGE_PORT || "3847"),
};

if (!CONFIG.token) {
  console.error("❌ TELEGRAM_BOT_TOKEN is required in .env");
  process.exit(1);
}

// ── State ───────────────────────────────────────────────────────

let currentTask = null;
let currentWorkspace = CONFIG.defaultWorkspace;
const TELEGRAM_MAX_LEN = 4000;
const PAGE_SIZE = 20;

// CLI backends — switch with /cli command
const CLI_BACKENDS = {
  gemini: {
    name: "Gemini CLI",
    cmd: "gemini",
    promptFlag: "-p",
    resumeCmd: "--resume latest",
    env: { FORCE_COLOR: "0", NO_COLOR: "1", GEMINI_CLI_TRUST_WORKSPACE: "true" },
  },
  codex: {
    name: "Codex CLI",
    cmd: "codex",
    promptFlag: "",  // codex uses positional prompt
    resumeCmd: "resume --last",  // codex resume is a subcommand
    env: { FORCE_COLOR: "0", NO_COLOR: "1" },
    extraFlags: "--dangerously-bypass-approvals-and-sandbox",  // headless bot mode
  },
};
let activeCli = "gemini";

// Session state — CLI stores its own session history
let hasSession = false;



// Path registry — maps short IDs to full paths (Telegram callback_data max 64 bytes)
const pathRegistry = new Map();
let pathIdCounter = 0;

function registerPath(fullPath) {
  // Reuse existing ID if path already registered
  for (const [id, p] of pathRegistry) {
    if (p === fullPath) return id;
  }
  const id = ++pathIdCounter;
  pathRegistry.set(id, fullPath);
  return id;
}

// ── Bot Setup ───────────────────────────────────────────────────

const bot = new TelegramBot(CONFIG.token, { polling: true });

console.log("🚀 9Router Remote Agent starting...");
console.log(`   Gemini CLI: ${CONFIG.geminiCmd}`);
console.log(`   Default workspace: ${CONFIG.defaultWorkspace}`);
console.log(`   Workspaces: ${Object.keys(CONFIG.workspaces).join(", ") || "none"}`);
console.log(`   Allowed users: ${CONFIG.allowedUsers.join(", ") || "ALL"}`);

bot.setMyCommands([
  { command: "cd", description: "📁 Browse & chọn workspace" },
  { command: "cli", description: "🔧 Switch CLI (gemini/codex)" },
  { command: "pwd", description: "📂 Xem workspace & CLI hiện tại" },
  { command: "new", description: "🆕 Session mới" },
  { command: "stop", description: "⛔ Hủy task" },
  { command: "status", description: "📊 Trạng thái" },
  { command: "file", description: "📎 Gửi file từ PC" },
  { command: "run", description: "⚡ Chạy lệnh shell" },
  { command: "py", description: "🐍 Chạy Python" },
  { command: "screen", description: "📸 Chụp màn hình" },
  { command: "web", description: "🌐 Chụp web page" },
  { command: "ls", description: "📋 Liệt kê thư mục" },
  { command: "cat", description: "📄 Đọc file" },
  { command: "start", description: "👋 Hướng dẫn" },
]);

// ── Auth ────────────────────────────────────────────────────────

function isAllowed(userId) {
  if (CONFIG.allowedUsers.length === 0) return true;
  return CONFIG.allowedUsers.includes(String(userId));
}

// ── /start ──────────────────────────────────────────────────────

bot.onText(/\/start/, (msg) => {
  if (!isAllowed(msg.from.id)) return;
  const name = msg.from.first_name || "bạn";
  const shortcuts = Object.entries(CONFIG.workspaces).map(([k, v]) => `  /${k} → ${v.replace(/([_*`\[])/g, '\\$1')}`).join("\n");

  const cli = CLI_BACKENDS[activeCli];
  bot.sendMessage(msg.chat.id,
    `👋 Chào ${name}!\n\n` +
    `📂 *Workspace:* \`${currentWorkspace}\`\n` +
    `🔧 *CLI:* ${cli.name}\n` +
    `🧠 *Session:* ${hasSession ? "đang tiếp tục" : "chưa bắt đầu"}\n\n` +
    `*Cách dùng:*\n` +
    `• Gõ bình thường → AI nhớ ngữ cảnh trước đó\n` +
    `• /cd → browse chọn workspace\n` +
    `• /new → xóa lịch sử, bắt đầu mới\n` +
    `• /coupon lệnh → chạy workspace shortcut\n` +
    `• /stop → hủy task\n\n` +
    `*Shortcuts:*\n${shortcuts || "  (chưa config)"}`,
    { parse_mode: "Markdown" }
  );
});

// ── /stop ───────────────────────────────────────────────────────

bot.onText(/\/stop/, (msg) => {
  if (!isAllowed(msg.from.id)) return;
  if (currentTask) {
    currentTask.process.kill("SIGTERM");
    currentTask = null;
    bot.sendMessage(msg.chat.id, "⛔ Task đã bị hủy.");
  } else {
    bot.sendMessage(msg.chat.id, "ℹ️ Không có task nào đang chạy.");
  }
});

// ── /status ─────────────────────────────────────────────────────

bot.onText(/\/status/, (msg) => {
  if (!isAllowed(msg.from.id)) return;
  if (currentTask) {
    const elapsed = Math.floor((Date.now() - currentTask.startTime) / 1000);
    bot.sendMessage(msg.chat.id, `⏳ Đang chạy (${elapsed}s)...\n🔧 ${CLI_BACKENDS[activeCli].name}\n📂 \`${currentWorkspace}\``);
  } else {
    bot.sendMessage(msg.chat.id, `✅ Sẵn sàng\n🔧 ${CLI_BACKENDS[activeCli].name}\n📂 \`${currentWorkspace}\`\n🧠 Session: ${hasSession ? "active" : "new"}`);
  }
});

// ── /new — clear conversation history ───────────────────────────

bot.onText(/\/new/, (msg) => {
  if (!isAllowed(msg.from.id)) return;
  hasSession = false;
  bot.sendMessage(msg.chat.id, "🆕 Session đã reset. Tin nhắn tiếp theo sẽ bắt đầu hội thoại mới!");
});

// ── /pwd ──────────────────────────────────────────────────────────

bot.onText(/\/pwd/, (msg) => {
  if (!isAllowed(msg.from.id)) return;
  bot.sendMessage(msg.chat.id, `🔧 ${CLI_BACKENDS[activeCli].name}\n📂 \`${currentWorkspace}\`\n🧠 Session: ${hasSession ? "active" : "new"}`, { parse_mode: "Markdown" });
});

// ── /cli — switch CLI backend ───────────────────────────────────────

bot.onText(/\/cli(.*)/, (msg, match) => {
  if (!isAllowed(msg.from.id)) return;
  const arg = (match[1] || "").trim().toLowerCase();

  if (!arg) {
    // Show available CLIs as buttons
    const buttons = Object.entries(CLI_BACKENDS).map(([key, cli]) => [{
      text: `${key === activeCli ? "✅ " : ""}${cli.name}`,
      callback_data: `cli:${key}`
    }]);
    bot.sendMessage(msg.chat.id, `🔧 *Chọn CLI:*\nHiện tại: *${CLI_BACKENDS[activeCli].name}*`, {
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: buttons }
    });
  } else if (CLI_BACKENDS[arg]) {
    activeCli = arg;
    hasSession = false;
    bot.sendMessage(msg.chat.id, `🔧 Đã chuyển sang *${CLI_BACKENDS[arg].name}*\n🆕 Session reset.`, { parse_mode: "Markdown" });
  } else {
    bot.sendMessage(msg.chat.id, `❌ Không tìm thấy CLI "${arg}". Có: ${Object.keys(CLI_BACKENDS).join(", ")}`);
  }
});

// ── /cd — interactive file browser with pagination ──────────────

bot.onText(/\/cd(.*)/, (msg, match) => {
  if (!isAllowed(msg.from.id)) return;
  const arg = (match[1] || "").trim();
  if (!arg) {
    showDrives(msg.chat.id);
  } else {
    browseDir(msg.chat.id, arg, 0);
  }
});

function showDrives(chatId, messageId = null) {
  try {
    const raw = execSync("wmic logicaldisk get name", { encoding: "utf-8" });
    const drives = raw.split("\n").map(l => l.trim()).filter(l => /^[A-Z]:$/.test(l));

    const buttons = drives.map(d => {
      const id = registerPath(d + "\\");
      return [{ text: `💽 ${d}\\`, callback_data: `b:${id}:0` }];
    });

    // Show current workspace shortcut
    const curId = registerPath(currentWorkspace);
    buttons.push([{ text: `📂 ${path.basename(currentWorkspace)} (hiện tại)`, callback_data: `s:${curId}` }]);

    const text = "📁 *Chọn ổ đĩa:*";
    const opts = { parse_mode: "Markdown", reply_markup: { inline_keyboard: buttons } };

    if (messageId) {
      opts.chat_id = chatId;
      opts.message_id = messageId;
      bot.editMessageText(text, opts).catch(() => { });
    } else {
      bot.sendMessage(chatId, text, opts);
    }
  } catch (e) {
    if (messageId) {
      bot.editMessageText(`❌ ${e.message}`, { chat_id: chatId, message_id: messageId }).catch(() => { });
    } else {
      bot.sendMessage(chatId, `❌ ${e.message}`);
    }
  }
}

function browseDir(chatId, dirPath, page, messageId) {
  try {
    const allEntries = fs.readdirSync(dirPath, { withFileTypes: true })
      .filter(e => e.isDirectory() && !e.name.startsWith(".") && e.name !== "node_modules" && e.name !== ".git")
      .sort((a, b) => a.name.localeCompare(b.name));

    const totalPages = Math.ceil(allEntries.length / PAGE_SIZE) || 1;
    const pageEntries = allEntries.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

    // 2-column folder buttons
    const buttons = [];
    for (let i = 0; i < pageEntries.length; i += 2) {
      const row = [];
      const id1 = registerPath(path.join(dirPath, pageEntries[i].name));
      row.push({ text: `📁 ${pageEntries[i].name}`, callback_data: `b:${id1}:0` });
      if (pageEntries[i + 1]) {
        const id2 = registerPath(path.join(dirPath, pageEntries[i + 1].name));
        row.push({ text: `📁 ${pageEntries[i + 1].name}`, callback_data: `b:${id2}:0` });
      }
      buttons.push(row);
    }

    // Pagination row
    if (totalPages > 1) {
      const dirId = registerPath(dirPath);
      const pagRow = [];
      if (page > 0) pagRow.push({ text: `◀️ Trang ${page}`, callback_data: `b:${dirId}:${page - 1}` });
      pagRow.push({ text: `📄 ${page + 1}/${totalPages}`, callback_data: `noop` });
      if (page < totalPages - 1) pagRow.push({ text: `Trang ${page + 2} ▶️`, callback_data: `b:${dirId}:${page + 1}` });
      buttons.push(pagRow);
    }

    // Navigation: up + select
    const navRow = [];
    const parent = path.dirname(dirPath);
    if (parent !== dirPath) {
      const parentId = registerPath(parent);
      navRow.push({ text: "⬆️ Lên", callback_data: `b:${parentId}:0` });
    } else {
      navRow.push({ text: "⬆️ Ổ đĩa", callback_data: "drives" });
    }
    const selectId = registerPath(dirPath);
    navRow.push({ text: "✅ Chọn folder này", callback_data: `s:${selectId}` });
    buttons.push(navRow);

    const text = `📂 \`${dirPath}\`\n_(${allEntries.length} thư mục — trang ${page + 1}/${totalPages})_`;
    const opts = { parse_mode: "Markdown", reply_markup: { inline_keyboard: buttons } };

    if (messageId) {
      bot.editMessageText(text, { chat_id: chatId, message_id: messageId, ...opts }).catch(() => { });
    } else {
      bot.sendMessage(chatId, text, opts);
    }
  } catch (e) {
    const errMsg = `❌ \`${dirPath}\`: ${e.message}`;
    if (messageId) {
      bot.editMessageText(errMsg, { chat_id: chatId, message_id: messageId, parse_mode: "Markdown" }).catch(() => { });
    } else {
      bot.sendMessage(chatId, errMsg, { parse_mode: "Markdown" });
    }
  }
}

// ── /get — interactive file downloader ──────────────────────────

bot.onText(/\/get(.*)/, (msg, match) => {
  if (!isAllowed(msg.from.id)) return;
  const arg = (match[1] || "").trim();
  if (!arg) {
    showDrivesGet(msg.chat.id);
  } else {
    browseGetDir(msg.chat.id, arg, 0);
  }
});

function showDrivesGet(chatId, messageId = null) {
  try {
    const raw = execSync("wmic logicaldisk get name", { encoding: "utf-8" });
    const drives = raw.split("\n").map(l => l.trim()).filter(l => /^[A-Z]:$/.test(l));

    const buttons = drives.map(d => {
      const id = registerPath(d + "\\");
      return [{ text: `💽 ${d}\\`, callback_data: `f:${id}:0` }];
    });

    const curId = registerPath(currentWorkspace);
    buttons.push([{ text: `📂 ${path.basename(currentWorkspace)} (hiện tại)`, callback_data: `f:${curId}:0` }]);

    const text = "📥 *Chọn ổ đĩa để tải file:*";
    const opts = { parse_mode: "Markdown", reply_markup: { inline_keyboard: buttons } };

    if (messageId) {
      opts.chat_id = chatId;
      opts.message_id = messageId;
      bot.editMessageText(text, opts).catch(() => { });
    } else {
      bot.sendMessage(chatId, text, opts);
    }
  } catch (e) {
    if (messageId) {
      bot.editMessageText(`❌ ${e.message}`, { chat_id: chatId, message_id: messageId }).catch(() => { });
    } else {
      bot.sendMessage(chatId, `❌ ${e.message}`);
    }
  }
}

function browseGetDir(chatId, dirPath, page, messageId) {
  try {
    const allEntries = fs.readdirSync(dirPath, { withFileTypes: true })
      .filter(e => !e.name.startsWith(".") && e.name !== "node_modules" && e.name !== ".git")
      .sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.localeCompare(b.name);
      });

    const totalPages = Math.ceil(allEntries.length / PAGE_SIZE) || 1;
    const pageEntries = allEntries.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

    // 1-column buttons (files names can be long)
    const buttons = [];
    for (const e of pageEntries) {
      const p = path.join(dirPath, e.name);
      const id = registerPath(p);
      if (e.isDirectory()) {
        buttons.push([{ text: `📁 ${e.name}`, callback_data: `f:${id}:0` }]);
      } else {
        buttons.push([{ text: `📄 ${e.name}`, callback_data: `d:${id}` }]);
      }
    }

    // Pagination row
    if (totalPages > 1) {
      const dirId = registerPath(dirPath);
      const pagRow = [];
      if (page > 0) pagRow.push({ text: `◀️ Trang ${page}`, callback_data: `f:${dirId}:${page - 1}` });
      pagRow.push({ text: `📄 ${page + 1}/${totalPages}`, callback_data: `noop` });
      if (page < totalPages - 1) pagRow.push({ text: `Trang ${page + 2} ▶️`, callback_data: `f:${dirId}:${page + 1}` });
      buttons.push(pagRow);
    }

    // Navigation: up
    const navRow = [];
    const parent = path.dirname(dirPath);
    if (parent !== dirPath) {
      const parentId = registerPath(parent);
      navRow.push({ text: "⬆️ Lên", callback_data: `f:${parentId}:0` });
    } else {
      navRow.push({ text: "⬆️ Ổ đĩa", callback_data: "drives_get" });
    }
    buttons.push(navRow);

    const text = `📥 \`${dirPath}\`\n_(${allEntries.length} mục — trang ${page + 1}/${totalPages})_`;
    const opts = { parse_mode: "Markdown", reply_markup: { inline_keyboard: buttons } };

    if (messageId) {
      bot.editMessageText(text, { chat_id: chatId, message_id: messageId, ...opts }).catch(() => { });
    } else {
      bot.sendMessage(chatId, text, opts);
    }
  } catch (e) {
    const errMsg = `❌ \`${dirPath}\`: ${e.message}`;
    if (messageId) {
      bot.editMessageText(errMsg, { chat_id: chatId, message_id: messageId, parse_mode: "Markdown" }).catch(() => { });
    } else {
      bot.sendMessage(chatId, errMsg, { parse_mode: "Markdown" });
    }
  }
}

// Handle button taps
bot.on("callback_query", (query) => {
  if (!isAllowed(query.from.id)) return;
  const data = query.data;
  const chatId = query.message.chat.id;
  const msgId = query.message.message_id;

  if (data === "noop") {
    return bot.answerCallbackQuery(query.id);
  }

  if (data === "drives") {
    showDrives(chatId, msgId);
    return bot.answerCallbackQuery(query.id);
  }

  if (data === "drives_get") {
    showDrivesGet(chatId, msgId);
    return bot.answerCallbackQuery(query.id);
  }

  if (data.startsWith("b:")) {
    // browse — format: b:pathId:page
    const parts = data.split(":");
    const pathId = parseInt(parts[1]);
    const page = parseInt(parts[2] || "0");
    const dirPath = pathRegistry.get(pathId);
    if (dirPath) {
      browseDir(chatId, dirPath, page, msgId);
    } else {
      bot.answerCallbackQuery(query.id, { text: "❌ Path expired, gõ /cd lại" });
    }
    bot.answerCallbackQuery(query.id).catch(() => { });
  } else if (data.startsWith("f:")) {
    // browse for /get — format: f:pathId:page
    const parts = data.split(":");
    const pathId = parseInt(parts[1]);
    const page = parseInt(parts[2] || "0");
    const dirPath = pathRegistry.get(pathId);
    if (dirPath) {
      browseGetDir(chatId, dirPath, page, msgId);
    } else {
      bot.answerCallbackQuery(query.id, { text: "❌ Path expired, gõ /get lại" });
    }
    bot.answerCallbackQuery(query.id).catch(() => { });
  } else if (data.startsWith("d:")) {
    // download file — format: d:pathId
    const pathId = parseInt(data.substring(2));
    const filePath = pathRegistry.get(pathId);
    if (filePath && fs.existsSync(filePath)) {
      bot.answerCallbackQuery(query.id, { text: `📥 Đang gửi ${path.basename(filePath)}...` }).catch(() => { });
      bot.sendMessage(chatId, `📥 Đang gửi \`${path.basename(filePath)}\`...`, { parse_mode: "Markdown" })
        .then(async (statusMsg) => {
          try {
            const stat = fs.statSync(filePath);
            if (stat.size > 50 * 1024 * 1024) {
              return bot.editMessageText(`❌ File quá lớn (${(stat.size/1024/1024).toFixed(1)}MB, max 50MB)`, { chat_id: chatId, message_id: statusMsg.message_id });
            }
            await bot.sendDocument(chatId, filePath, { caption: `📎 ${path.basename(filePath)}` });
            bot.deleteMessage(chatId, statusMsg.message_id).catch(() => {});
          } catch (e) {
            bot.editMessageText(`❌ Lỗi gửi file: ${e.message}`, { chat_id: chatId, message_id: statusMsg.message_id }).catch(() => {});
          }
        });
    } else {
      bot.answerCallbackQuery(query.id, { text: "❌ File không tồn tại hoặc path expired" }).catch(() => { });
    }
  } else if (data.startsWith("s:")) {
    // select — format: s:pathId
    const pathId = parseInt(data.substring(2));
    const selected = pathRegistry.get(pathId);
    if (selected) {
      currentWorkspace = selected;
      hasSession = false; // new workspace = fresh session
      bot.editMessageText(`✅ Workspace: \`${currentWorkspace}\`\n🆕 Session reset.`, {
        chat_id: chatId, message_id: msgId, parse_mode: "Markdown"
      }).catch(() => { });
    }
    bot.answerCallbackQuery(query.id, { text: selected ? `✅ ${path.basename(selected)}` : "❌ Error" }).catch(() => { });
  } else if (data.startsWith("cli:")) {
    // cli switch — format: cli:key
    const key = data.substring(4);
    if (CLI_BACKENDS[key]) {
      activeCli = key;
      hasSession = false;
      bot.editMessageText(`✅ Đã chuyển sang ${CLI_BACKENDS[key].name}`, { chat_id: chatId, message_id: msgId }).catch(() => { });
    }
    bot.answerCallbackQuery(query.id).catch(() => { });
  }
});

// ── Direct System Commands ──────────────────────────────────────

// /file <path> — send file to Telegram
bot.onText(/\/file\s+(.+)/, async (msg, match) => {
  if (!isAllowed(msg.from.id)) return;
  let filePath = match[1].trim();
  if (!path.isAbsolute(filePath)) {
    filePath = path.resolve(currentWorkspace, filePath);
  }
  try {
    if (!fs.existsSync(filePath)) return bot.sendMessage(msg.chat.id, `❌ File không tồn tại: ${filePath}`);
    const stat = fs.statSync(filePath);
    if (stat.size > 50 * 1024 * 1024) return bot.sendMessage(msg.chat.id, `❌ File quá lớn (${(stat.size/1024/1024).toFixed(1)}MB, max 50MB)`);
    await bot.sendDocument(msg.chat.id, filePath, { caption: `📎 ${path.basename(filePath)}` });
  } catch (e) {
    bot.sendMessage(msg.chat.id, `❌ ${e.message}`);
  }
});

// /run <command> — execute shell command
bot.onText(/\/run\s+(.+)/s, async (msg, match) => {
  if (!isAllowed(msg.from.id)) return;
  const command = match[1].trim();
  const statusMsg = await bot.sendMessage(msg.chat.id, `⚡ Đang chạy...\n\`${command.substring(0,60)}\``, { parse_mode: "Markdown" });
  try {
    const result = await execPromise(command, { cwd: currentWorkspace, timeout: 60000 });
    const output = (result.stdout + result.stderr).trim() || "(no output)";
    const safe = output.replace(/```/g, "'''").substring(0, TELEGRAM_MAX_LEN - 100);
    bot.editMessageText(`⚡ \`${command.substring(0,40)}\`\n\`\`\`\n${safe}\n\`\`\``, {
      chat_id: msg.chat.id, message_id: statusMsg.message_id, parse_mode: "Markdown"
    }).catch(() => {});
  } catch (e) {
    const errOut = ((e.stdout || "") + (e.stderr || "") + e.message).substring(0, 1000);
    bot.editMessageText(`❌ Exit ${e.code || "?"}\n\`\`\`\n${errOut.replace(/```/g, "'''")}\n\`\`\``, {
      chat_id: msg.chat.id, message_id: statusMsg.message_id, parse_mode: "Markdown"
    }).catch(() => {});
  }
});

// /py <code> — run Python code
bot.onText(/\/py\s+(.+)/s, async (msg, match) => {
  if (!isAllowed(msg.from.id)) return;
  const code = match[1].trim();
  const statusMsg = await bot.sendMessage(msg.chat.id, `🐍 Đang chạy Python...`);
  try {
    const escaped = code.replace(/"/g, '\\"');
    const result = await execPromise(`python -c "${escaped}"`, { cwd: currentWorkspace, timeout: 60000 });
    const output = (result.stdout + result.stderr).trim() || "(no output)";
    const safe = output.replace(/```/g, "'''").substring(0, TELEGRAM_MAX_LEN - 100);
    bot.editMessageText(`🐍 *Python*\n\`\`\`\n${safe}\n\`\`\``, {
      chat_id: msg.chat.id, message_id: statusMsg.message_id, parse_mode: "Markdown"
    }).catch(() => {});
  } catch (e) {
    bot.editMessageText(`❌ Python error\n\`\`\`\n${(e.stderr || e.message).substring(0,1000).replace(/```/g, "'''")}\n\`\`\``, {
      chat_id: msg.chat.id, message_id: statusMsg.message_id, parse_mode: "Markdown"
    }).catch(() => {});
  }
});

// /screen — screenshot desktop
bot.onText(/\/screen$/, async (msg) => {
  if (!isAllowed(msg.from.id)) return;
  const statusMsg = await bot.sendMessage(msg.chat.id, `📸 Đang chụp màn hình...`);
  try {
    const screenshot = require("screenshot-desktop");
    const imgPath = path.join(__dirname, `.screenshot_${Date.now()}.png`);
    await screenshot({ filename: imgPath, format: "png" });
    await bot.sendPhoto(msg.chat.id, imgPath, { caption: "📸 Desktop screenshot" });
    fs.unlinkSync(imgPath);
    bot.deleteMessage(msg.chat.id, statusMsg.message_id).catch(() => {});
  } catch (e) {
    bot.editMessageText(`❌ Screenshot failed: ${e.message}`, { chat_id: msg.chat.id, message_id: statusMsg.message_id }).catch(() => {});
  }
});

// /web <url> — screenshot a web page
bot.onText(/\/web\s+(.+)/, async (msg, match) => {
  if (!isAllowed(msg.from.id)) return;
  const url = match[1].trim();
  const statusMsg = await bot.sendMessage(msg.chat.id, `🌐 Đang chụp ${url}...`);
  try {
    const imgPath = await takeWebScreenshot(url);
    await bot.sendPhoto(msg.chat.id, imgPath, { caption: `🌐 ${url}` });
    fs.unlinkSync(imgPath);
    bot.deleteMessage(msg.chat.id, statusMsg.message_id).catch(() => {});
  } catch (e) {
    bot.editMessageText(`❌ Web screenshot failed: ${e.message}`, { chat_id: msg.chat.id, message_id: statusMsg.message_id }).catch(() => {});
  }
});

// /ls <dir> — list directory
bot.onText(/\/ls(.*)/, async (msg, match) => {
  if (!isAllowed(msg.from.id)) return;
  const dir = (match[1] || "").trim() || currentWorkspace;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
      .map(e => `${e.isDirectory() ? "📁" : "📄"} ${e.name}`)
      .join("\n");
    const safe = entries.substring(0, TELEGRAM_MAX_LEN - 100);
    bot.sendMessage(msg.chat.id, `📋 \`${dir}\`\n\`\`\`\n${safe}\n\`\`\``, { parse_mode: "Markdown" });
  } catch (e) {
    bot.sendMessage(msg.chat.id, `❌ ${e.message}`);
  }
});

// /cat <file> — read file
bot.onText(/\/cat\s+(.+)/, async (msg, match) => {
  if (!isAllowed(msg.from.id)) return;
  const filePath = match[1].trim();
  try {
    if (!fs.existsSync(filePath)) return bot.sendMessage(msg.chat.id, `❌ File không tồn tại`);
    const stat = fs.statSync(filePath);
    if (stat.size > 1024 * 1024) {
      return bot.sendDocument(msg.chat.id, filePath, { caption: `📄 ${path.basename(filePath)} (${(stat.size/1024).toFixed(0)}KB - quá lớn để hiển thị)` });
    }
    const content = fs.readFileSync(filePath, "utf-8");
    const safe = content.replace(/```/g, "'''").substring(0, TELEGRAM_MAX_LEN - 100);
    bot.sendMessage(msg.chat.id, `📄 \`${path.basename(filePath)}\`\n\`\`\`\n${safe}\n\`\`\``, { parse_mode: "Markdown" });
  } catch (e) {
    bot.sendMessage(msg.chat.id, `❌ ${e.message}`);
  }
});

// ── Main message handler ────────────────────────────────────────

const SKIP_COMMANDS = ["/start", "/stop", "/status", "/cd", "/pwd", "/new", "/cli", "/file", "/run", "/py", "/screen", "/web", "/ls", "/cat"];

bot.on("message", async (msg) => {
  if (!msg.text) return;
  if (SKIP_COMMANDS.some(cmd => msg.text.startsWith(cmd))) return;

  const chatId = msg.chat.id;
  if (!isAllowed(msg.from.id)) {
    return bot.sendMessage(chatId, `🚫 Không có quyền. ID: \`${msg.from.id}\``, { parse_mode: "Markdown" });
  }

  if (currentTask) {
    const elapsed = Math.floor((Date.now() - currentTask.startTime) / 1000);
    return bot.sendMessage(chatId, `⏳ Đang bận (${elapsed}s). /stop để hủy.`);
  }

  // Parse workspace shortcut: /alias prompt
  let workspace = currentWorkspace;
  let prompt = msg.text.trim();
  const prefixMatch = prompt.match(/^\/(\w+)\s+(.+)$/s);
  if (prefixMatch) {
    const alias = prefixMatch[1].toLowerCase();
    if (CONFIG.workspaces[alias]) {
      workspace = CONFIG.workspaces[alias];
      prompt = prefixMatch[2];
    }
  }

  // Use --resume latest if we already have a session in this workspace
  const resume = hasSession;
  const cli = CLI_BACKENDS[activeCli];

  const safePrompt = prompt.substring(0, 80).replace(/([_*`\[])/g, '\\$1') + (prompt.length > 80 ? "..." : "");
  const statusMsg = await bot.sendMessage(chatId,
    `🔄 *Đang xử lý...*${resume ? " (tiếp tục)" : ""} \`${cli.name}\`\n📂 \`${path.basename(workspace)}\`\n💬 ${safePrompt}`,
    { parse_mode: "Markdown" }
  );

  bot.sendChatAction(chatId, "typing");
  const typingInterval = setInterval(() => bot.sendChatAction(chatId, "typing"), 4000);

  try {
    const result = await runCLI(prompt, workspace, chatId, resume);
    clearInterval(typingInterval);
    hasSession = true;
    await sendResult(chatId, statusMsg.message_id, result);
  } catch (err) {
    clearInterval(typingInterval);
    bot.editMessageText(`❌ Lỗi: ${escapeMarkdown(err.message)}`, {
      chat_id: chatId, message_id: statusMsg.message_id, parse_mode: "Markdown"
    }).catch(() => { });
  }
});



// ── Generic CLI Runner ──────────────────────────────────────────

function runCLI(prompt, workspace, chatId, resume = false) {
  return new Promise((resolve, reject) => {
    const output = [];
    const startTime = Date.now();
    const cli = CLI_BACKENDS[activeCli];

    const escapedPrompt = prompt.replace(/"/g, '\\"').replace(/`/g, '\\`');

    // Build command based on CLI type
    let cmd;
    let codexOutputFile = null;
    if (activeCli === "gemini") {
      const resumeFlag = resume ? `${cli.resumeCmd} ` : '';
      cmd = `${cli.cmd} ${resumeFlag}${cli.promptFlag} "${escapedPrompt}"`;
    } else if (activeCli === "codex") {
      const extra = cli.extraFlags ? ` ${cli.extraFlags}` : '';
      codexOutputFile = path.join(__dirname, `.codex_output_${Date.now()}.txt`);
      if (resume) {
        cmd = `${cli.cmd} exec ${cli.resumeCmd} "${escapedPrompt}" -o "${codexOutputFile}"${extra}`;
      } else {
        cmd = `${cli.cmd} exec "${escapedPrompt}" -o "${codexOutputFile}"${extra}`;
      }
    }

    const proc = spawn(cmd, [], {
      cwd: workspace,
      shell: true,
      env: { ...process.env, ...cli.env },
      stdio: ["ignore", "pipe", "pipe"],
    });

    currentTask = { process: proc, chatId, startTime };

    proc.stdout.on("data", (data) => output.push(data.toString()));
    proc.stderr.on("data", (data) => {
      const text = data.toString();
      // Filter noise from both CLIs
      if (text.includes("ExperimentalWarning")) return;
      if (text.includes("deprecat")) return;
      if (text.includes("256-color")) return;
      if (text.includes("failed to load skill")) return;  // codex skill errors
      if (text.includes("Reading additional input")) return;
      output.push(text);
    });

    const timeout = setTimeout(() => {
      proc.kill("SIGTERM");
      reject(new Error(`Timeout ${CONFIG.maxTimeout / 1000}s`));
    }, CONFIG.maxTimeout);

    proc.on("close", (code) => {
      clearTimeout(timeout);
      currentTask = null;
      let finalOutput = output.join("");

      // If Codex was used with an output file, read it instead of stdout
      if (codexOutputFile && fs.existsSync(codexOutputFile)) {
        try {
          finalOutput = fs.readFileSync(codexOutputFile, "utf-8");
          fs.unlinkSync(codexOutputFile); // cleanup
        } catch (e) {
          console.error("Error reading codex output file:", e);
        }
      }

      resolve({ output: finalOutput, exitCode: code, elapsed: ((Date.now() - startTime) / 1000).toFixed(1) });
    });

    proc.on("error", (err) => {
      clearTimeout(timeout);
      currentTask = null;
      reject(err.code === "ENOENT" ? new Error(`'${CONFIG.geminiCmd}' not found`) : err);
    });
  });
}

// ── Send Result ─────────────────────────────────────────────────

async function sendResult(chatId, statusMsgId, result) {
  const { output, exitCode, elapsed } = result;
  const header = exitCode === 0 ? `✅ *Hoàn thành* (${elapsed}s)` : `⚠️ *Code ${exitCode}* (${elapsed}s)`;
  const cleanOutput = cleanCliOutput(stripAnsi(output)).trim().replace(/```/g, "'''");

  // Auto-detect file paths in output and send them to Telegram
  await autoDetectAndSendFiles(chatId, cleanOutput);

  if (!cleanOutput) {
    return bot.editMessageText(`${header}\n_(không có output)_`, {
      chat_id: chatId, message_id: statusMsgId, parse_mode: "Markdown"
    }).catch(() => { });
  }

  if (cleanOutput.length <= TELEGRAM_MAX_LEN - header.length - 20) {
    return bot.editMessageText(`${header}\n\`\`\`\n${cleanOutput}\n\`\`\``, {
      chat_id: chatId, message_id: statusMsgId, parse_mode: "Markdown"
    }).catch(() => { });
  }

  await bot.editMessageText(header, {
    chat_id: chatId, message_id: statusMsgId, parse_mode: "Markdown"
  }).catch(() => { });

  const chunks = chunkText(cleanOutput, TELEGRAM_MAX_LEN - 20);
  for (const chunk of chunks) {
    await bot.sendMessage(chatId, `\`\`\`\n${chunk}\n\`\`\``, { parse_mode: "Markdown" });
  }

  if (cleanOutput.length > TELEGRAM_MAX_LEN * 3) {
    const buf = Buffer.from(cleanOutput, "utf-8");
    await bot.sendDocument(chatId, buf, { caption: "📎 Full output" }, { filename: `result_${Date.now()}.txt`, contentType: "text/plain" });
  }
}

// ── Utilities ───────────────────────────────────────────────────

function cleanCliOutput(text) {
  const lines = text.split("\n").filter(line => {
    const t = line.trim();
    if (!t) return true; // keep blank lines
    if (t.startsWith("OpenAI Codex v")) return false;
    if (/^-{4,}$/.test(t)) return false;
    if (/^(workdir|model|provider|approval|sandbox|reasoning|session id)\s*:/i.test(t)) return false;
    if (t.startsWith("SUCCESS: The process with PID")) return false;
    if (t.startsWith("tokens used")) return false;
    if (/^[\d,]+$/.test(t)) return false;  // token count number
    if (t === "user" || t === "codex") return false;
    if (t.startsWith("Reading additional input")) return false;
    if (t.startsWith("failed to load skill")) return false;
    return true;
  });

  // Deduplicate: Codex CLI prints response twice (in conversation + as final output)
  // Remove duplicate trailing block
  const cleaned = lines.join("\n").trim();
  const half = Math.floor(cleaned.length / 2);
  if (half > 10) {
    const firstHalf = cleaned.substring(0, half).trim();
    const secondHalf = cleaned.substring(half).trim();
    if (firstHalf === secondHalf) return firstHalf;
  }
  return cleaned;
}

// ── Auto-detect files in AI output and send to Telegram ─────────

const IMAGE_EXTS = [".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp", ".svg"];
const SENDABLE_EXTS = [...IMAGE_EXTS, ".pdf", ".txt", ".csv", ".json", ".html", ".zip", ".docx", ".xlsx", ".mp4", ".mp3"];

async function autoDetectAndSendFiles(chatId, output) {
  // Match Windows file paths like e:/path/file.ext or E:\path\file.ext or C:\\path\\file.ext
  const pathRegex = /(?:[a-zA-Z]:[/\\]{1,2}[^\s"'\n\r,)}\]]+\.\w{2,5})/g;
  const matches = output.match(pathRegex) || [];

  // Also match markdown image syntax: ![text](path)
  const mdImageRegex = /!\[.*?\]\(([^)]+)\)/g;
  let mdMatch;
  while ((mdMatch = mdImageRegex.exec(output)) !== null) {
    matches.push(mdMatch[1]);
  }

  // Deduplicate
  const uniquePaths = [...new Set(matches)];
  let sentCount = 0;

  for (const filePath of uniquePaths) {
    const cleaned = filePath.replace(/['"]/g, "").trim();
    const ext = path.extname(cleaned).toLowerCase();

    if (!SENDABLE_EXTS.includes(ext)) continue;
    if (!fs.existsSync(cleaned)) continue;

    try {
      const stat = fs.statSync(cleaned);
      if (stat.size > 50 * 1024 * 1024) continue; // skip files > 50MB

      if (IMAGE_EXTS.includes(ext)) {
        await bot.sendPhoto(chatId, cleaned, { caption: `📸 ${path.basename(cleaned)}` });
      } else {
        await bot.sendDocument(chatId, cleaned, { caption: `📎 ${path.basename(cleaned)}` });
      }
      sentCount++;
      console.log(`📤 Auto-sent: ${cleaned}`);
    } catch (e) {
      console.error(`Failed to auto-send ${cleaned}:`, e.message);
    }
  }
  return sentCount;
}

function stripAnsi(str) {
  return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, "").replace(/\x1B\][^\x07]*\x07/g, "");
}

function escapeMarkdown(str) {
  return str.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, "\\$1");
}

function chunkText(text, maxLen) {
  const chunks = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxLen) { chunks.push(remaining); break; }
    let breakAt = remaining.lastIndexOf("\n", maxLen);
    if (breakAt < maxLen * 0.3) breakAt = maxLen;
    chunks.push(remaining.substring(0, breakAt));
    remaining = remaining.substring(breakAt).trimStart();
  }
  return chunks;
}

// ── Utility: exec as Promise ────────────────────────────────────

function execPromise(cmd, opts = {}) {
  return new Promise((resolve, reject) => {
    exec(cmd, { maxBuffer: 10 * 1024 * 1024, ...opts }, (err, stdout, stderr) => {
      if (err) { err.stdout = stdout; err.stderr = stderr; return reject(err); }
      resolve({ stdout: stdout || "", stderr: stderr || "" });
    });
  });
}

// ── Web Screenshot (Puppeteer) ──────────────────────────────────

async function takeWebScreenshot(url, width = 1280, height = 800) {
  // Try to find Chrome/Edge on Windows
  const browsers = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  ];
  let browserPath = browsers.find(b => fs.existsSync(b));
  if (!browserPath) throw new Error("Chrome/Edge not found");

  const puppeteer = require("puppeteer-core");
  const browser = await puppeteer.launch({
    executablePath: browserPath,
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width, height });
  await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
  const imgPath = path.join(__dirname, `.web_screenshot_${Date.now()}.png`);
  await page.screenshot({ path: imgPath, fullPage: true });
  await browser.close();
  return imgPath;
}

// ── HTTP Bridge API Server ──────────────────────────────────────

let activeChatId = null; // Track the last chat ID for bridge API
bot.on("message", (msg) => { if (isAllowed(msg.from?.id)) activeChatId = msg.chat.id; });

const bridgeServer = http.createServer(async (req, res) => {
  // CORS headers for local use
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json");

  if (req.method === "OPTIONS") { res.writeHead(200); return res.end(); }
  if (req.method !== "POST") { res.writeHead(405); return res.end(JSON.stringify({ error: "POST only" })); }
  if (!activeChatId) { res.writeHead(400); return res.end(JSON.stringify({ error: "No active chat. Send a message to the bot first." })); }

  let body = "";
  req.on("data", chunk => body += chunk);
  req.on("end", async () => {
    try {
      const data = body ? JSON.parse(body) : {};
      const chatId = activeChatId;

      switch (req.url) {
        case "/api/send-file": {
          if (!data.path) throw new Error("Missing 'path'");
          if (!fs.existsSync(data.path)) throw new Error(`File not found: ${data.path}`);
          await bot.sendDocument(chatId, data.path, { caption: data.caption || `📎 ${path.basename(data.path)}` });
          res.writeHead(200); res.end(JSON.stringify({ ok: true, message: "File sent to Telegram" }));
          break;
        }
        case "/api/screenshot": {
          const screenshot = require("screenshot-desktop");
          const imgPath = path.join(__dirname, `.bridge_screenshot_${Date.now()}.png`);
          await screenshot({ filename: imgPath, format: "png" });
          await bot.sendPhoto(chatId, imgPath, { caption: data.caption || "📸 Desktop screenshot" });
          fs.unlinkSync(imgPath);
          res.writeHead(200); res.end(JSON.stringify({ ok: true, message: "Screenshot sent" }));
          break;
        }
        case "/api/web-screenshot": {
          if (!data.url) throw new Error("Missing 'url'");
          const imgPath = await takeWebScreenshot(data.url, data.width || 1280, data.height || 800);
          await bot.sendPhoto(chatId, imgPath, { caption: data.caption || `🌐 ${data.url}` });
          fs.unlinkSync(imgPath);
          res.writeHead(200); res.end(JSON.stringify({ ok: true, message: "Web screenshot sent" }));
          break;
        }
        case "/api/run-command": {
          if (!data.command) throw new Error("Missing 'command'");
          const result = await execPromise(data.command, { cwd: data.cwd || currentWorkspace, timeout: data.timeout || 60000 });
          const output = (result.stdout + result.stderr).trim();
          if (data.silent !== true) {
            const safe = output.replace(/```/g, "'''").substring(0, TELEGRAM_MAX_LEN - 100);
            await bot.sendMessage(chatId, `⚡ \`${data.command.substring(0,40)}\`\n\`\`\`\n${safe}\n\`\`\``, { parse_mode: "Markdown" });
          }
          res.writeHead(200); res.end(JSON.stringify({ ok: true, output: output.substring(0, 5000) }));
          break;
        }
        case "/api/run-python": {
          if (!data.code) throw new Error("Missing 'code'");
          // Write to temp file to handle complex code
          const tmpFile = path.join(__dirname, `.bridge_py_${Date.now()}.py`);
          fs.writeFileSync(tmpFile, data.code, "utf-8");
          try {
            const result = await execPromise(`python "${tmpFile}"`, { cwd: data.cwd || currentWorkspace, timeout: data.timeout || 60000 });
            const output = (result.stdout + result.stderr).trim();
            if (data.silent !== true) {
              const safe = output.replace(/```/g, "'''").substring(0, TELEGRAM_MAX_LEN - 100);
              await bot.sendMessage(chatId, `🐍 *Python*\n\`\`\`\n${safe}\n\`\`\``, { parse_mode: "Markdown" });
            }
            res.writeHead(200); res.end(JSON.stringify({ ok: true, output: output.substring(0, 5000) }));
          } finally {
            fs.unlinkSync(tmpFile);
          }
          break;
        }
        case "/api/notify": {
          if (!data.message) throw new Error("Missing 'message'");
          const safe = data.message.substring(0, TELEGRAM_MAX_LEN);
          await bot.sendMessage(chatId, safe, data.parse_mode ? { parse_mode: data.parse_mode } : {});
          res.writeHead(200); res.end(JSON.stringify({ ok: true }));
          break;
        }
        case "/api/send-text": {
          if (!data.content) throw new Error("Missing 'content'");
          const filename = data.filename || `output_${Date.now()}.txt`;
          const buf = Buffer.from(data.content, "utf-8");
          await bot.sendDocument(chatId, buf, { caption: data.caption || `📄 ${filename}` }, { filename, contentType: "text/plain" });
          res.writeHead(200); res.end(JSON.stringify({ ok: true, message: "Text file sent" }));
          break;
        }
        default:
          res.writeHead(404); res.end(JSON.stringify({ error: `Unknown endpoint: ${req.url}`, available: ["/api/send-file", "/api/screenshot", "/api/web-screenshot", "/api/run-command", "/api/run-python", "/api/notify", "/api/send-text"] }));
      }
    } catch (e) {
      console.error("Bridge API error:", e.message);
      res.writeHead(500); res.end(JSON.stringify({ error: e.message }));
    }
  });
});

bridgeServer.listen(CONFIG.bridgePort, "127.0.0.1", () => {
  console.log(`🌉 Bridge API running on http://127.0.0.1:${CONFIG.bridgePort}`);
});

// ── Error handling ──────────────────────────────────────────────

bot.on("polling_error", (err) => console.error(`❌ Polling: ${err.message}`));
process.on("unhandledRejection", (err) => console.error(`❌ Unhandled: ${err.message}`));

console.log("📡 Waiting for Telegram messages...");
