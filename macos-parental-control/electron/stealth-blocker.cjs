/**
 * Stealth Blocker (Cross-platform: macOS & Windows)
 * 
 * Scans active tabs/windows. If a browser window matches a blocked rule
 * (Shorts, TikTok, or non-whitelisted YouTube channel):
 * - macOS: Uses AppleScript to reload/redirect the specific tab.
 * - Windows: Uses WScript.Shell via PowerShell to send key events (F5/Ctrl+W)
 *   to emulate lag or force-close the tab.
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

// Helper to run AppleScript (macOS)
function runAppleScript(script) {
  return new Promise((resolve) => {
    exec(`osascript -e '${script.replace(/'/g, "'\\''")}'`, (err, stdout, stderr) => {
      if (err) resolve('');
      else resolve(stdout.trim());
    });
  });
}

// Helper to run PowerShell commands (Windows)
function runPowerShell(cmd) {
  return new Promise((resolve) => {
    exec(`powershell -ExecutionPolicy Bypass -Command "${cmd.replace(/"/g, '\\"')}"`, (err, stdout, stderr) => {
      if (err) resolve('');
      else resolve(stdout.trim());
    });
  });
}

// Get all open tabs for Chromium-based browsers on macOS
async function getChromiumTabsMac(appName) {
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

// Get window titles on Windows (uses built-in PS command)
async function getActiveWindowsWin() {
  // Queries active window titles
  const cmd = `Get-Process | Where-Object {$_.MainWindowTitle} | Select-Object -ExpandProperty MainWindowTitle`;
  const output = await runPowerShell(cmd);
  if (!output) return [];
  return output.split('\r\n').map(title => title.trim()).filter(Boolean);
}

// Windows: Emulate lag loop by reloading the active browser window
async function reloadBrowserWin(browserName) {
  // Sends F5 to the active browser
  const cmd = `
    $wshell = New-Object -ComObject Wscript.Shell;
    if ($wshell.AppActivate("${browserName}")) {
      Start-Sleep -m 50;
      $wshell.SendKeys("{F5}");
    }
  `;
  await runPowerShell(cmd);
}

// Cache to store video -> channel mapping to avoid hitting oEmbed API too much
const channelCache = {};

// Handle blocking logic
async function checkAndEnforce() {
  loadRules();
  const isWin = process.platform === 'win32';
  const isMac = process.platform === 'darwin';

  if (isMac) {
    const browsers = ['Google Chrome', 'Microsoft Edge', 'Brave Browser'];
    for (const browser of browsers) {
      try {
        const tabs = await getChromiumTabsMac(browser);
        for (const tab of tabs) {
          const { url, id, title } = tab;

          // Rule 1: TikTok block
          if (rules.tiktok.block_all && url.includes('tiktok.com')) {
            await runAppleScript(`tell application "${browser}" to reload (tab id "${id}" of window 1)`);
            continue;
          }

          // Rule 2: YouTube Shorts block
          if (rules.youtube.block_shorts && (url.includes('youtube.com/shorts') || url.includes('youtu.be/shorts'))) {
            await runAppleScript(`tell application "${browser}" to reload (tab id "${id}" of window 1)`);
            continue;
          }

          // Rule 3: YouTube Channel Whitelist check
          if (url.includes('youtube.com/watch') || url.includes('youtu.be/')) {
            let channel = channelCache[url];
            if (channel === undefined) {
              const info = await fetchYouTubeInfo(url);
              if (info) {
                channel = info.channel;
                channelCache[url] = channel;
              } else {
                channelCache[url] = null;
              }
            }

            if (channel) {
              const isAllowed = rules.youtube.whitelist_channels.some(allowed => 
                channel.toLowerCase().includes(allowed.toLowerCase())
              );
              if (!isAllowed) {
                await runAppleScript(`tell application "${browser}" to reload (tab id "${id}" of window 1)`);
              }
            }
          }
        }
      } catch (e) { /* ignore browser not running */ }
    }
  } else if (isWin) {
    // Windows matching (based on window titles since we don't have AppleScript to read tab URLs easily without extension/CDP)
    try {
      const titles = await getActiveWindowsWin();
      for (const title of titles) {
        const lowerTitle = title.toLowerCase();
        let targetBrowser = null;
        if (lowerTitle.includes('chrome')) targetBrowser = 'Chrome';
        else if (lowerTitle.includes('edge')) targetBrowser = 'Edge';
        else if (lowerTitle.includes('brave')) targetBrowser = 'Brave';

        if (!targetBrowser) continue;

        // Rule 1: TikTok (window title matches)
        if (rules.tiktok.block_all && lowerTitle.includes('tiktok')) {
          console.log(`[StealthBlocker Win] Throttling TikTok window: ${title}`);
          await reloadBrowserWin(targetBrowser);
          continue;
        }

        // Rule 2: YouTube Shorts
        if (rules.youtube.block_shorts && lowerTitle.includes('shorts') && lowerTitle.includes('youtube')) {
          console.log(`[StealthBlocker Win] Throttling YouTube Shorts window: ${title}`);
          await reloadBrowserWin(targetBrowser);
          continue;
        }

        // Rule 3: YouTube videos
        if (lowerTitle.includes('youtube') && !lowerTitle.includes('shorts')) {
          // Window title: "Video Title - YouTube - Google Chrome"
          // We extract the video title
          const cleanTitle = title.replace(/\s*-\s*youtube.*/i, '').trim();
          
          // Check if this title is flagged as caution/danger (using content-analyzer)
          const { safety } = require('./content-analyzer.cjs').classifyContent('', cleanTitle);
          if (safety === 'danger' || (safety === 'caution' && rules.youtube.block_shorts)) {
            console.log(`[StealthBlocker Win] Blocked content title: ${cleanTitle}`);
            await reloadBrowserWin(targetBrowser);
          }
        }
      }
    } catch (e) {
      console.error('[StealthBlocker Win] Error:', e.message);
    }
  }
}

// Start background loop
function startStealthBlocker() {
  console.log('[StealthBlocker] Cross-platform Background Blocker Active.');
  setInterval(checkAndEnforce, 6000);
}

module.exports = { startStealthBlocker, checkAndEnforce };
