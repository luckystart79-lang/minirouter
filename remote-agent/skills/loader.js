/**
 * Skill Loader — Auto-discovers and loads all skill modules from skills/ directory
 *
 * Usage in agent.js:
 *   const { loadSkills } = require('./skills/loader');
 *   const skills = loadSkills(context);
 *
 * Each .js file in skills/ (except base.js and loader.js) is loaded as a skill.
 * Skills must export a class that extends BaseSkill.
 */

const fs = require("fs");
const path = require("path");

function loadSkills(context) {
  const skillsDir = __dirname;
  const skipFiles = ["base.js", "loader.js"];
  const loaded = [];
  const failed = [];
  const instances = new Map(); // name → skill instance

  const files = fs.readdirSync(skillsDir)
    .filter(f => f.endsWith(".js") && !skipFiles.includes(f))
    .sort();

  for (const file of files) {
    try {
      const SkillClass = require(path.join(skillsDir, file));
      const skill = new SkillClass(context);
      skill.register();
      loaded.push({ name: skill.name, file, commands: skill.commands.length });
      instances.set(skill.name, skill);
      console.log(`   ✅ ${skill.name} (${skill.commands.length} commands)`);
    } catch (e) {
      failed.push({ file, error: e.message });
      console.error(`   ❌ Failed to load ${file}: ${e.message}`);
    }
  }

  return { loaded, failed, instances };
}

module.exports = { loadSkills };
