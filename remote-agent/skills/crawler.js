/**
 * Crawler Skill — Fetch and extract web page content
 *
 * Commands:
 *   /crawl <url>  — Fetch URL, extract text content, send to Telegram
 */

const BaseSkill = require("./base");
const https = require("https");
const http = require("http");
const { URL } = require("url");

class CrawlerSkill extends BaseSkill {
  get name() { return "Crawler"; }
  get description() { return "Fetch and extract web page content"; }

  get commands() {
    return [
      {
        command: "/crawl",
        pattern: /\/crawl\s+(.+)/,
        description: "🕷️ Fetch URL and extract text",
        handler: this.handleCrawl,
      },
    ];
  }

  async handleCrawl(msg, match) {
    const chatId = msg.chat.id;
    let url = match[1].trim();
    if (!url.startsWith("http")) url = "https://" + url;

    const statusMsg = await this.bot.sendMessage(chatId, `🕷️ Đang crawl \`${url}\`...`, { parse_mode: "Markdown" });

    try {
      const html = await this._fetch(url);
      // Strip HTML tags, keep text
      let text = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/\s+/g, " ")
        .trim();

      // Extract title
      const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : "No title";

      if (!text) {
        return this.bot.editMessageText(`⚠️ Không tìm thấy text content từ URL.`, {
          chat_id: chatId, message_id: statusMsg.message_id
        });
      }

      const maxLen = 3500;
      const truncated = text.length > maxLen ? text.substring(0, maxLen) + "..." : text;

      await this.bot.editMessageText(
        `🕷️ *${title.substring(0, 60)}*\n📏 ${text.length} chars\n\n\`\`\`\n${truncated.replace(/```/g, "'''")}\n\`\`\``,
        { chat_id: chatId, message_id: statusMsg.message_id, parse_mode: "Markdown" }
      ).catch(() => {});

      // If too long, also send as file
      if (text.length > maxLen) {
        const buf = Buffer.from(text, "utf-8");
        await this.bot.sendDocument(chatId, buf,
          { caption: `📄 Full content (${text.length} chars)` },
          { filename: `crawl_${Date.now()}.txt`, contentType: "text/plain" }
        );
      }
    } catch (e) {
      this.bot.editMessageText(`❌ Crawl failed: ${e.message}`, {
        chat_id: chatId, message_id: statusMsg.message_id
      }).catch(() => {});
    }
  }

  _fetch(url, maxRedirects = 5) {
    return new Promise((resolve, reject) => {
      if (maxRedirects <= 0) return reject(new Error("Too many redirects"));

      const parsed = new URL(url);
      const client = parsed.protocol === "https:" ? https : http;

      const req = client.get(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,*/*",
        },
        timeout: 15000,
      }, (res) => {
        // Follow redirects
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
          const redirectUrl = new URL(res.headers.location, url).href;
          return resolve(this._fetch(redirectUrl, maxRedirects - 1));
        }

        if (res.statusCode >= 400) {
          return reject(new Error(`HTTP ${res.statusCode}`));
        }

        let data = "";
        res.on("data", (c) => data += c);
        res.on("end", () => resolve(data));
      });

      req.on("error", reject);
      req.on("timeout", () => { req.destroy(); reject(new Error("Timeout 15s")); });
    });
  }
}

module.exports = CrawlerSkill;
