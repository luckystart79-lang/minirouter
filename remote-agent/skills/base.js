/**
 * BaseSkill — Abstract base class for all agent skills
 *
 * Each skill must extend this class and implement:
 *   - commands: array of { pattern, handler, description, requireSession }
 *   - name: skill display name
 *   - description: what this skill does
 *
 * Skills are auto-loaded from the skills/ directory by the skill loader.
 */

class BaseSkill {
  constructor(context) {
    this.bot = context.bot;
    this.config = context.config;
    this.getState = context.getState;       // () => { currentWorkspace, activeCli, hasSession, taskMap, ... }
    this.setState = context.setState;       // (partial) => merge into state
    this.isAllowed = context.isAllowed;
    this.isSessionActive = context.isSessionActive;
    this.auditLog = context.auditLog;
    this.utils = context.utils;             // { stripAnsi, escapeMarkdown, chunkText, execPromise, ... }
  }

  /** @returns {string} Skill name */
  get name() { throw new Error("Skill must implement 'name' getter"); }

  /** @returns {string} Skill description */
  get description() { throw new Error("Skill must implement 'description' getter"); }

  /**
   * @returns {Array<{
   *   command: string,
   *   pattern: RegExp,
   *   handler: (msg: object, match: Array) => Promise<void>,
   *   description: string,
   *   requireSession?: boolean
   * }>}
   */
  get commands() { return []; }

  /**
   * Called once after skill is loaded. Override for async init.
   */
  async init() {}

  /**
   * Register all commands with the Telegram bot.
   * Called by the skill loader — do not override.
   */
  register() {
    for (const cmd of this.commands) {
      this.bot.onText(cmd.pattern, async (msg, match) => {
        if (!this.isAllowed(msg.from.id)) return;
        if (cmd.requireSession && !this.isSessionActive(msg.chat.id, msg.from.id)) return;
        try {
          await cmd.handler.call(this, msg, match);
        } catch (e) {
          console.error(`[Skill:${this.name}] Error in ${cmd.command}:`, e.message);
          this.bot.sendMessage(msg.chat.id, `❌ [${this.name}] ${e.message}`).catch(() => {});
        }
      });
    }
  }
}

module.exports = BaseSkill;
