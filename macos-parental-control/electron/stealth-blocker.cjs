/**
 * Stealth Blocker (macOS)
 * 
 * Uses AppleScript to scan open tabs in Google Chrome, Microsoft Edge, Brave, etc.
 * If a tab matches a blocked rule (Shorts, TikTok, or non-whitelisted YouTube channel):
 * - Emulates a lag/connection loop by reloading the tab continuously, OR
 * - Quietly redirects it to about:blank.
 */

const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const { fetchYouTubeInfo } = require('./content-analyzer.cjs');

const RULES_PATH = path.join(__dirname, 'parental-rules.json');
let rules = {
  youtube: { whitelist_channels: [], block_shorts: true },
  tiktok: { block_all: true }
};

// Load rules
function loadRules() {
  try {
    if (fs.existsSync(RULES_PATH)) {
      rules = JSON.parse(fs.readFileSync(RULES_PATH, 'utf8'));
    }
  } catch (e) {
    console.error('[StealthBlocker] Failed to load rules:', e.message);
  }
}

// Helper to run AppleScript
function runAppleScript(script) {
  return new Promise((resolve) => {
    exec(`osascript -e '${script.replace(/'/g, "'\\''")}'`, (err, stdout, stderr) => {
      if (err) resolve('');
      else resolve(stdout.trim());
    });
  });
}

// Get all open tabs for Chromium-based browsers on macOS
async function getChromiumTabs(appName) {
  const script = `
    tell application "${appName}"
      if not (exists window 1) then return ""
      set tabList to {}
      repeat with w in windows
        repeat with t in tabs of w
          set end of tabList to (id of t as string) & "|||" & URL of t & "|||" & title of t
        end repeat
      end repeat
      return tabList as string
    end tell
  `;
  
  const output = await runAppleScript(script);
  if (!output) return [];

  // Parse lines: ID|||URL|||Title
  return output.split(', ').map(line => {
    const parts = line.split('|||');
    return {
      browser: appName,
      id: parts[0],
      url: parts[1] || '',
      title: parts[2] || ''
    };
  }).filter(t => t.url);
}

// Action: Reload a specific tab to emulate lag loop
async function reloadTab(browser, tabId) {
  const script = `
    tell application "${browser}"
      repeat with w in windows
        repeat with t in tabs of w
          if (id of t as string) is "${tabId}" then
            reload t
            exit repeat
          end if
        end repeat
      end repeat
    end tell
  `;
  await runAppleScript(script);
}

// Action: Redirect tab to empty page (stealth block)
async function redirectTab(browser, tabId, destUrl = 'about:blank') {
  const script = `
    tell application "${browser}"
      repeat with w in windows
        repeat with t in tabs of w
          if (id of t as string) is "${tabId}" then
            set URL of t to "${destUrl}"
            exit repeat
          end if
        end repeat
      end repeat
    end tell
  `;
  await runAppleScript(script);
}

// Cache to store video -> channel mapping to avoid hitting oEmbed API too much
const channelCache = {};

async function checkAndEnforce() {
  loadRules();
  if (process.platform !== 'darwin') return; // macOS only

  const browsers = ['Google Chrome', 'Microsoft Edge', 'Brave Browser'];
  
  for (const browser of browsers) {
    try {
      const tabs = await getChromiumTabs(browser);
      for (const tab of tabs) {
        const { url, id } = tab;

        // Rule 1: TikTok block
        if (rules.tiktok.block_all && url.includes('tiktok.com')) {
          console.log(`[StealthBlocker] Throttling TikTok tab: ${url}`);
          await reloadTab(browser, id); // Infinite reload loop!
          continue;
        }

        // Rule 2: YouTube Shorts block
        if (rules.youtube.block_shorts && (url.includes('youtube.com/shorts') || url.includes('youtu.be/shorts'))) {
          console.log(`[StealthBlocker] Throttling YouTube Shorts tab: ${url}`);
          await reloadTab(browser, id); // Infinite reload loop!
          continue;
        }

        // Rule 3: YouTube Channel Whitelist check
        if (url.includes('youtube.com/watch') || url.includes('youtu.be/')) {
          let channel = channelCache[url];

          // Fetch channel if not cached
          if (channel === undefined) {
            const info = await fetchYouTubeInfo(url);
            if (info) {
              channel = info.channel;
              channelCache[url] = channel;
            } else {
              channelCache[url] = null; // Mark as failed
            }
          }

          if (channel) {
            const isAllowed = rules.youtube.whitelist_channels.some(allowed => 
              channel.toLowerCase().includes(allowed.toLowerCase())
            );

            if (!isAllowed) {
              console.log(`[StealthBlocker] Blocked channel "${channel}" on video: ${url}`);
              // Lag emulation: reload the video to prevent playing
              await reloadTab(browser, id);
            }
          }
        }
      }
    } catch (e) {
      // Browser might not be running or scripting not allowed
    }
  }
}

// Start background loop (runs every 6 seconds)
function startStealthBlocker() {
  if (process.platform !== 'darwin') return;
  console.log('[StealthBlocker] macOS Background Blocker Active.');
  setInterval(checkAndEnforce, 6000);
}

module.exports = { startStealthBlocker, checkAndEnforce };
