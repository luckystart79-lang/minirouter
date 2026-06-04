/**
 * System Info Skill — System monitoring commands
 *
 * Commands:
 *   /sysinfo  — Show CPU, RAM, disk, uptime
 *   /ip       — Show public IP address
 *   /uptime   — Show bot uptime and stats
 */

const BaseSkill = require("./base");
const os = require("os");

class SystemInfoSkill extends BaseSkill {
  get name() { return "System Info"; }
  get description() { return "System monitoring and diagnostics"; }

  get commands() {
    return [
      {
        command: "/sysinfo",
        pattern: /\/sysinfo/,
        description: "💻 Show system info (CPU, RAM, disk)",
        handler: this.handleSysInfo,
      },
      {
        command: "/ip",
        pattern: /\/ip/,
        description: "🌐 Show public IP address",
        handler: this.handleIp,
      },
      {
        command: "/uptime",
        pattern: /\/uptime/,
        description: "⏱️ Show bot uptime and task stats",
        handler: this.handleUptime,
      },
    ];
  }

  async handleSysInfo(msg) {
    const chatId = msg.chat.id;
    const cpus = os.cpus();
    const totalMem = (os.totalmem() / 1024 / 1024 / 1024).toFixed(1);
    const freeMem = (os.freemem() / 1024 / 1024 / 1024).toFixed(1);
    const usedMem = (totalMem - freeMem).toFixed(1);
    const memPercent = ((usedMem / totalMem) * 100).toFixed(0);
    const uptimeHrs = (os.uptime() / 3600).toFixed(1);

    // Get disk info
    let diskInfo = "N/A";
    try {
      const { stdout } = await this.utils.execPromise(
        'wmic logicaldisk get size,freespace,caption /format:csv',
        { timeout: 5000 }
      );
      const lines = stdout.split("\n").filter(l => l.trim() && !l.startsWith("Node"));
      diskInfo = lines.map(line => {
        const parts = line.split(",");
        if (parts.length < 4) return null;
        const drive = parts[1];
        const free = (parseInt(parts[2]) / 1024 / 1024 / 1024).toFixed(0);
        const total = (parseInt(parts[3]) / 1024 / 1024 / 1024).toFixed(0);
        if (isNaN(free) || isNaN(total)) return null;
        return `  ${drive} ${total - free}/${total}GB`;
      }).filter(Boolean).join("\n");
    } catch (e) { /* ignore */ }

    this.bot.sendMessage(chatId,
      `💻 *System Info*\n\n` +
      `🖥️ ${os.hostname()} (${os.platform()} ${os.arch()})\n` +
      `⚡ ${cpus[0]?.model || "Unknown CPU"} (${cpus.length} cores)\n` +
      `🧠 RAM: ${usedMem}/${totalMem}GB (${memPercent}%)\n` +
      `⏱️ OS Uptime: ${uptimeHrs}h\n` +
      `💾 Disks:\n${diskInfo}`,
      { parse_mode: "Markdown" }
    );
  }

  async handleIp(msg) {
    const chatId = msg.chat.id;
    try {
      const https = require("https");
      const ip = await new Promise((resolve, reject) => {
        https.get("https://api.ipify.org", (res) => {
          let data = "";
          res.on("data", (c) => data += c);
          res.on("end", () => resolve(data.trim()));
        }).on("error", reject);
      });
      this.bot.sendMessage(chatId, `🌐 Public IP: \`${ip}\``, { parse_mode: "Markdown" });
    } catch (e) {
      this.bot.sendMessage(chatId, `❌ Cannot get public IP: ${e.message}`);
    }
  }

  async handleUptime(msg) {
    const chatId = msg.chat.id;
    const state = this.getState();
    const botUptime = process.uptime();
    const hrs = Math.floor(botUptime / 3600);
    const mins = Math.floor((botUptime % 3600) / 60);

    this.bot.sendMessage(chatId,
      `⏱️ *Bot Uptime*\n\n` +
      `🤖 Agent: ${hrs}h ${mins}m\n` +
      `📊 Active tasks: ${state.taskMap?.size || 0}\n` +
      `🔧 CLI: ${state.activeCli}\n` +
      `📂 Workspace: \`${state.currentWorkspace}\`\n` +
      `🧠 Session: ${state.hasSession ? "active" : "new"}`,
      { parse_mode: "Markdown" }
    );
  }
}

module.exports = SystemInfoSkill;
