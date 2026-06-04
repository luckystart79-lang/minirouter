/**
 * Conversation Memory Skill — Persistent command history
 *
 * Saves all command results to a JSON log file.
 * Allows searching and retrieving past results.
 *
 * Commands:
 *   /history [n]           — Show last N commands (default 10)
 *   /history search <term> — Search in command history
 *   /history get <id>      — Get full output of a past command
 *   /history clear         — Clear all history
 */

const BaseSkill = require("./base");
const fs = require("fs");
const path = require("path");

const HISTORY_FILE = path.join(__dirname, "..", "data", "history.json");
const MAX_HISTORY = 500; // keep last 500 entries

class MemorySkill extends BaseSkill {
  constructor(context) {
    super(context);
    this.history = [];
    this._load();

    // Hook into bot message events to capture command results
    this._hookCapture();
  }

  get name() { return "Memory"; }
  get description() { return "Persistent command history with search"; }

  get commands() {
    return [
      {
        command: "/history",
        pattern: /\/history\s*(.*)/s,
        description: "📜 Command history (search, get, clear)",
        handler: this.handleHistory,
      },
    ];
  }

  _ensureDir() {
    const dir = path.dirname(HISTORY_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  _load() {
    try {
      this._ensureDir();
      if (fs.existsSync(HISTORY_FILE)) {
        this.history = JSON.parse(fs.readFileSync(HISTORY_FILE, "utf-8"));
      }
    } catch (e) {
      console.error("[Memory] Failed to load history:", e.message);
      this.history = [];
    }
  }

  _save() {
    try {
      this._ensureDir();
      // Trim to max size
      if (this.history.length > MAX_HISTORY) {
        this.history = this.history.slice(-MAX_HISTORY);
      }
      fs.writeFileSync(HISTORY_FILE, JSON.stringify(this.history, null, 2), "utf-8");
    } catch (e) {
      console.error("[Memory] Failed to save history:", e.message);
    }
  }

  /**
   * Public method — called by agent.js after each CLI task completes
   */
  addEntry(entry) {
    this.history.push({
      id: this.history.length + 1,
      timestamp: new Date().toISOString(),
      prompt: entry.prompt || "",
      cli: entry.cli || "unknown",
      workspace: entry.workspace || "",
      exitCode: entry.exitCode ?? null,
      elapsed: entry.elapsed || "0",
      output: (entry.output || "").substring(0, 5000), // cap output size
    });
    this._save();
  }

  _hookCapture() {
    // We don't hook here — agent.js will call addEntry() directly after CLI completes
    // This is cleaner than trying to intercept message events
  }

  async handleHistory(msg, match) {
    const chatId = msg.chat.id;
    const args = (match[1] || "").trim();

    // /history clear
    if (args === "clear") {
      this.history = [];
      this._save();
      return this.bot.sendMessage(chatId, "🗑️ History đã xóa.");
    }

    // /history search <term>
    const searchMatch = args.match(/^search\s+(.+)$/i);
    if (searchMatch) {
      const term = searchMatch[1].toLowerCase();
      const results = this.history.filter(h =>
        h.prompt.toLowerCase().includes(term) ||
        h.output.toLowerCase().includes(term)
      ).slice(-10);

      if (results.length === 0) {
        return this.bot.sendMessage(chatId, `🔍 Không tìm thấy "${term}" trong history.`);
      }

      const list = results.map(h => {
        const time = new Date(h.timestamp).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
        return `🔹 #${h.id} — ${time}\n   💬 ${h.prompt.substring(0, 60)}\n   ${h.exitCode === 0 ? "✅" : "⚠️"} ${h.cli} (${h.elapsed}s)`;
      }).join("\n\n");

      return this.bot.sendMessage(chatId, `🔍 *Kết quả cho "${term}":*\n\n${list}\n\nDùng \`/history get <id>\` để xem chi tiết.`, { parse_mode: "Markdown" });
    }

    // /history get <id>
    const getMatch = args.match(/^get\s+(\d+)$/i);
    if (getMatch) {
      const id = parseInt(getMatch[1]);
      const entry = this.history.find(h => h.id === id);
      if (!entry) {
        return this.bot.sendMessage(chatId, `❌ Không tìm thấy history #${id}.`);
      }

      const time = new Date(entry.timestamp).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
      const output = entry.output.replace(/```/g, "'''").substring(0, 3500);

      return this.bot.sendMessage(chatId,
        `📜 *History #${entry.id}*\n` +
        `⏰ ${time}\n` +
        `🔧 ${entry.cli} | 📂 ${entry.workspace}\n` +
        `💬 ${entry.prompt.substring(0, 100)}\n` +
        `${entry.exitCode === 0 ? "✅" : "⚠️"} Exit: ${entry.exitCode} (${entry.elapsed}s)\n\n` +
        `\`\`\`\n${output}\n\`\`\``,
        { parse_mode: "Markdown" }
      );
    }

    // /history [n] — show last N
    const count = parseInt(args) || 10;
    const recent = this.history.slice(-count);

    if (recent.length === 0) {
      return this.bot.sendMessage(chatId, "📭 History trống. Chạy lệnh AI để bắt đầu ghi lại.");
    }

    const list = recent.map(h => {
      const time = new Date(h.timestamp).toLocaleTimeString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
      const icon = h.exitCode === 0 ? "✅" : "⚠️";
      return `${icon} #${h.id} [${time}] ${h.prompt.substring(0, 50)}`;
    }).join("\n");

    this.bot.sendMessage(chatId,
      `📜 *History (${recent.length}/${this.history.length}):*\n\n${list}\n\n` +
      `Dùng \`/history get <id>\` để xem chi tiết\n` +
      `Dùng \`/history search <keyword>\` để tìm`,
      { parse_mode: "Markdown" }
    );
  }
}

module.exports = MemorySkill;
