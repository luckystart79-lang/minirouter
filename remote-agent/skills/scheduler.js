/**
 * Scheduler Skill — Run commands on a schedule
 *
 * Commands:
 *   /schedule <cron|interval> <command>  — Schedule a recurring command
 *   /schedule list                       — List active schedules
 *   /schedule remove <id>                — Remove a schedule
 *
 * Examples:
 *   /schedule 30m npm test               — Run "npm test" every 30 minutes
 *   /schedule 1h git status              — Run "git status" every hour
 *   /schedule list                       — Show all schedules
 *   /schedule remove 1                   — Remove schedule #1
 */

const BaseSkill = require("./base");
const { exec } = require("child_process");

class SchedulerSkill extends BaseSkill {
  constructor(context) {
    super(context);
    this.schedules = new Map(); // id → { interval, command, timer, chatId, workspace, lastRun, runCount }
    this.scheduleIdCounter = 0;
  }

  get name() { return "Scheduler"; }
  get description() { return "Run commands on a recurring schedule"; }

  get commands() {
    return [
      {
        command: "/schedule",
        pattern: /\/schedule\s*(.*)/s,
        description: "⏰ Schedule recurring commands",
        handler: this.handleSchedule,
        requireSession: true,
      },
    ];
  }

  async handleSchedule(msg, match) {
    const chatId = msg.chat.id;
    const args = (match[1] || "").trim();

    if (!args || args === "help") {
      return this.bot.sendMessage(chatId,
        `⏰ *Scheduler*\n\n` +
        `Dùng: \`/schedule <interval> <command>\`\n\n` +
        `*Interval:*\n` +
        `  \`30m\` → 30 phút\n` +
        `  \`1h\` → 1 giờ\n` +
        `  \`2h30m\` → 2 giờ 30 phút\n\n` +
        `*Ví dụ:*\n` +
        `  \`/schedule 30m npm test\`\n` +
        `  \`/schedule 1h git status\`\n\n` +
        `*Quản lý:*\n` +
        `  \`/schedule list\` → xem danh sách\n` +
        `  \`/schedule remove <id>\` → xóa`,
        { parse_mode: "Markdown" }
      );
    }

    // /schedule list
    if (args === "list") {
      if (this.schedules.size === 0) {
        return this.bot.sendMessage(chatId, "📭 Không có schedule nào.");
      }
      const list = [...this.schedules.entries()].map(([id, s]) => {
        const lastRun = s.lastRun ? new Date(s.lastRun).toLocaleTimeString("vi-VN") : "chưa chạy";
        return `🔹 #${id} — every ${s.intervalStr}\n   📂 ${s.workspace}\n   ⚡ \`${s.command.substring(0, 50)}\`\n   📊 Đã chạy: ${s.runCount} lần (lần cuối: ${lastRun})`;
      }).join("\n\n");
      return this.bot.sendMessage(chatId, `⏰ *Schedules (${this.schedules.size}):*\n\n${list}`, { parse_mode: "Markdown" });
    }

    // /schedule remove <id>
    const removeMatch = args.match(/^remove\s+(\d+)$/i);
    if (removeMatch) {
      const id = parseInt(removeMatch[1]);
      const schedule = this.schedules.get(id);
      if (schedule) {
        clearInterval(schedule.timer);
        this.schedules.delete(id);
        return this.bot.sendMessage(chatId, `✅ Schedule #${id} đã xóa.`);
      }
      return this.bot.sendMessage(chatId, `❌ Không tìm thấy schedule #${id}.`);
    }

    // /schedule <interval> <command>
    const parsed = args.match(/^(\d+[hm](?:\d+[m])?)\s+(.+)$/is);
    if (!parsed) {
      return this.bot.sendMessage(chatId, `❌ Sai cú pháp. Dùng: \`/schedule 30m npm test\``, { parse_mode: "Markdown" });
    }

    const intervalStr = parsed[1].toLowerCase();
    const command = parsed[2].trim();
    const ms = this._parseInterval(intervalStr);

    if (!ms || ms < 60000) {
      return this.bot.sendMessage(chatId, `❌ Interval tối thiểu 1 phút (1m).`);
    }

    if (ms > 24 * 60 * 60 * 1000) {
      return this.bot.sendMessage(chatId, `❌ Interval tối đa 24 giờ.`);
    }

    const state = this.getState();
    const workspace = state.currentWorkspace;
    const id = ++this.scheduleIdCounter;

    const timer = setInterval(() => this._runScheduled(id), ms);

    this.schedules.set(id, {
      timer,
      command,
      intervalStr,
      intervalMs: ms,
      chatId,
      workspace,
      lastRun: null,
      runCount: 0,
    });

    this.bot.sendMessage(chatId,
      `✅ Schedule #${id} đã tạo!\n\n` +
      `⏰ Every: ${intervalStr}\n` +
      `⚡ Command: \`${command}\`\n` +
      `📂 Workspace: \`${workspace}\`\n\n` +
      `Dùng \`/schedule list\` để xem, \`/schedule remove ${id}\` để xóa.`,
      { parse_mode: "Markdown" }
    );
  }

  async _runScheduled(id) {
    const schedule = this.schedules.get(id);
    if (!schedule) return;

    schedule.runCount++;
    schedule.lastRun = Date.now();

    try {
      const result = await new Promise((resolve, reject) => {
        exec(schedule.command, {
          cwd: schedule.workspace,
          timeout: 60000,
          maxBuffer: 5 * 1024 * 1024,
        }, (err, stdout, stderr) => {
          if (err) {
            resolve({ output: (stdout || "") + (stderr || "") + "\n" + err.message, exitCode: err.code || 1 });
          } else {
            resolve({ output: (stdout || "") + (stderr || ""), exitCode: 0 });
          }
        });
      });

      const output = result.output.trim() || "(no output)";
      const safe = output.replace(/```/g, "'''").substring(0, 3000);
      const icon = result.exitCode === 0 ? "✅" : "⚠️";

      this.bot.sendMessage(schedule.chatId,
        `⏰ *Schedule #${id}* (run #${schedule.runCount})\n` +
        `${icon} \`${schedule.command.substring(0, 50)}\`\n` +
        `\`\`\`\n${safe}\n\`\`\``,
        { parse_mode: "Markdown" }
      ).catch(() => {});
    } catch (e) {
      this.bot.sendMessage(schedule.chatId,
        `⏰ Schedule #${id} ❌ Error: ${e.message}`
      ).catch(() => {});
    }
  }

  _parseInterval(str) {
    let ms = 0;
    const hours = str.match(/(\d+)h/);
    const minutes = str.match(/(\d+)m/);
    if (hours) ms += parseInt(hours[1]) * 60 * 60 * 1000;
    if (minutes) ms += parseInt(minutes[1]) * 60 * 1000;
    return ms;
  }
}

module.exports = SchedulerSkill;
