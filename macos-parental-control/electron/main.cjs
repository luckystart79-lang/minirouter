const { app, BrowserWindow, ipcMain, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { exec, spawn } = require('child_process');

let mainWindow;
const PARENT_PIN = '1234';

// --- Watchdog PID Management ---
const PID_DIR = path.join(os.homedir(), '.parental-control');
const MAIN_PID_FILE = path.join(PID_DIR, 'main.pid');
const WATCHDOG_PID_FILE = path.join(PID_DIR, 'watchdog.pid');

if (!fs.existsSync(PID_DIR)) {
  fs.mkdirSync(PID_DIR, { recursive: true });
}

// Write our PID so watchdog can find us
fs.writeFileSync(MAIN_PID_FILE, process.pid.toString());

function isPidAlive(pid) {
  try { process.kill(pid, 0); return true; } catch(e) { return false; }
}

function spawnWatchdog() {
  const watchdogScript = path.join(__dirname, 'watchdog.cjs');
  const nodePath = process.execPath; // Use the same node/electron binary
  
  // Use system node if available, otherwise fall back
  const isWin = process.platform === 'win32';
  const nodeCmd = isWin ? 'node' : 'node';
  
  const child = spawn(nodeCmd, [watchdogScript], {
    detached: true,
    stdio: 'ignore',
    cwd: path.join(__dirname, '..')
  });
  child.unref();
  console.log(`[Main] Spawned watchdog (PID: ${child.pid})`);
}

function checkWatchdog() {
  try {
    if (fs.existsSync(WATCHDOG_PID_FILE)) {
      const pid = parseInt(fs.readFileSync(WATCHDOG_PID_FILE, 'utf8').trim(), 10);
      if (!isNaN(pid) && isPidAlive(pid)) return; // Watchdog is alive
    }
  } catch(e) { /* ignore */ }
  // Watchdog is dead or missing, respawn it
  console.log('[Main] Watchdog is dead. Respawning...');
  spawnWatchdog();
}

// --- Persistence Config ---
const configPath = path.join(app.getPath('userData'), 'parental-config.json');

function loadConfig() {
  try {
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
  } catch(e) { console.error('Error loading config:', e); }
  return { quota: 120 * 60, lastResetDate: new Date().toDateString() };
}

function saveConfig(config) {
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  } catch(e) { console.error('Error saving config:', e); }
}

ipcMain.handle('get-config', () => loadConfig());
ipcMain.handle('save-config', (e, config) => saveConfig(config));

// --- PIN verification for quit ---
ipcMain.handle('verify-pin', (e, pin) => {
  return pin === PARENT_PIN;
});

ipcMain.handle('quit-app', (e, pin) => {
  if (pin === PARENT_PIN) {
    app.isQuiting = true;
    app.quit();
    return true;
  }
  return false;
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    show: false, // Start hidden — only secret hotkey reveals it
    skipTaskbar: true, // Don't show in taskbar
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadURL('http://localhost:5173');

  // Block ALL close attempts — window just hides
  mainWindow.on('close', (event) => {
    if (!app.isQuiting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  // Block Alt+F4 and other close shortcuts from the renderer
  mainWindow.webContents.on('before-input-event', (event, input) => {
    // Block Alt+F4
    if (input.alt && input.key === 'F4') {
      event.preventDefault();
    }
    // Block Ctrl+W
    if (input.control && input.key === 'w') {
      event.preventDefault();
    }
    // Block Ctrl+Q (macOS quit)
    if (input.control && input.key === 'q') {
      event.preventDefault();
    }
  });
}

app.whenReady().then(() => {
  createWindow();

  // Secret hotkey: Ctrl+Shift+P to toggle window visibility
  globalShortcut.register('CommandOrControl+Shift+P', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  // Auto-start on OS boot
  app.setLoginItemSettings({
    openAtLogin: true,
    path: app.getPath('exe')
  });

  // Spawn watchdog on startup
  spawnWatchdog();

  // Monitor watchdog health every 10 seconds
  setInterval(checkWatchdog, 10000);
});

// Prevent app from quitting when all windows are closed
app.on('window-all-closed', (e) => {
  e.preventDefault();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  // Clean up PID file only on legitimate quit (PIN verified)
  try { fs.unlinkSync(MAIN_PID_FILE); } catch(e) {}
  // Also kill watchdog on legitimate quit
  try {
    const wdPid = parseInt(fs.readFileSync(WATCHDOG_PID_FILE, 'utf8').trim(), 10);
    if (!isNaN(wdPid)) process.kill(wdPid, 'SIGTERM');
    fs.unlinkSync(WATCHDOG_PID_FILE);
  } catch(e) {}
});

// --- Cross-Platform Activity Monitoring --- //
ipcMain.handle('check-active-apps', async (event, monitoredApps = []) => {
  return new Promise((resolve) => {
    const isWin = process.platform === 'win32';
    const command = isWin ? 'tasklist' : 'ps -ax';

    exec(command, (error, stdout) => {
      if (error) {
        console.error(error);
        resolve([]);
        return;
      }

      const apps = [];
      const lowerOut = stdout.toLowerCase();
      monitoredApps.forEach(app => {
        if (lowerOut.includes(app.toLowerCase())) apps.push(app);
      });

      resolve(apps);
    });
  });
});

// --- Cross-Platform App Blocking --- //
ipcMain.handle('kill-apps', async (event, targetApps) => {
  const isWin = process.platform === 'win32';

  targetApps.forEach(appName => {
    let cmd = isWin ? `taskkill /IM ${appName}.exe /F` : `killall -9 ${appName}`;
    if (appName === 'chrome' && isWin) cmd = 'taskkill /IM chrome.exe /F';
    if (appName === 'safari' && isWin) return;

    exec(cmd, () => {
      console.log(`Force killed: ${appName}`);
    });
  });
  return true;
});

// --- Browser Activity Monitoring (ALL browsers, ALL content) --- //

// Known browser patterns in window titles
// Use regex to handle special chars (®, zero-width spaces, etc.)
const BROWSER_PATTERNS = [
  { regex: /google\s*chrome/i, name: 'Google Chrome' },
  { regex: /mozilla\s*firefox/i, name: 'Mozilla Firefox' },
  { regex: /microsoft.{0,3}edge/i, name: 'Microsoft Edge' },  // handles ®, ​, etc.
  { regex: /\bopera\b/i, name: 'Opera' },
  { regex: /\bbrave\b/i, name: 'Brave' },
  { regex: /\bvivaldi\b/i, name: 'Vivaldi' },
  { regex: /\bsafari\b/i, name: 'Safari' },
  { regex: /\barc\b/i, name: 'Arc' },
  { regex: /\bchromium\b/i, name: 'Chromium' },
  { regex: /\bwaterfox\b/i, name: 'Waterfox' },
  { regex: /\bcomet\b/i, name: 'Comet' },
  { regex: /zen\s*browser/i, name: 'Zen Browser' },
  { regex: /tor\s*browser/i, name: 'Tor Browser' },
  { regex: /\bcoc\s*coc\b/i, name: 'Coc Coc' },
];

// Website classification rules
const SITE_RULES = [
  // Entertainment / Social
  { pattern: 'youtube', site: 'YouTube', category: 'entertainment' },
  { pattern: 'tiktok', site: 'TikTok', category: 'entertainment' },
  { pattern: 'facebook', site: 'Facebook', category: 'social' },
  { pattern: 'instagram', site: 'Instagram', category: 'social' },
  { pattern: 'twitter', site: 'Twitter/X', category: 'social' },
  { pattern: 'reddit', site: 'Reddit', category: 'social' },
  { pattern: 'twitch', site: 'Twitch', category: 'entertainment' },
  { pattern: 'netflix', site: 'Netflix', category: 'entertainment' },
  { pattern: 'discord', site: 'Discord', category: 'social' },
  { pattern: 'telegram', site: 'Telegram', category: 'social' },
  { pattern: 'zalo', site: 'Zalo', category: 'social' },
  { pattern: 'messenger', site: 'Messenger', category: 'social' },
  { pattern: 'spotify', site: 'Spotify', category: 'entertainment' },
  // Gaming
  { pattern: 'roblox', site: 'Roblox', category: 'gaming' },
  { pattern: 'minecraft', site: 'Minecraft', category: 'gaming' },
  { pattern: 'steam', site: 'Steam', category: 'gaming' },
  { pattern: 'epic games', site: 'Epic Games', category: 'gaming' },
  { pattern: 'itch.io', site: 'Itch.io', category: 'gaming' },
  { pattern: 'coolmath', site: 'CoolMath Games', category: 'gaming' },
  { pattern: 'friv', site: 'Friv', category: 'gaming' },
  { pattern: 'y8.com', site: 'Y8 Games', category: 'gaming' },
  { pattern: 'poki.com', site: 'Poki Games', category: 'gaming' },
  // Educational
  { pattern: 'khan academy', site: 'Khan Academy', category: 'educational' },
  { pattern: 'duolingo', site: 'Duolingo', category: 'educational' },
  { pattern: 'wikipedia', site: 'Wikipedia', category: 'educational' },
  { pattern: 'google classroom', site: 'Google Classroom', category: 'educational' },
  { pattern: 'coursera', site: 'Coursera', category: 'educational' },
  { pattern: 'edx', site: 'edX', category: 'educational' },
  { pattern: 'google docs', site: 'Google Docs', category: 'productive' },
  { pattern: 'google sheets', site: 'Google Sheets', category: 'productive' },
  { pattern: 'google slides', site: 'Google Slides', category: 'productive' },
];

const CONTENT_KEYWORDS = {
  educational: [
    'learn', 'tutorial', 'education', 'lesson', 'course', 'study',
    'english', 'math', 'science', 'history', 'coding', 'programming',
    'lecture', 'how to', 'documentary', 'khan academy', 'crash course',
    'homework', 'exam', 'ielts', 'toefl', 'grammar', 'vocabulary',
    'học', 'bài giảng', 'tiếng anh', 'toán', 'lập trình', 'hướng dẫn'
  ],
  entertainment: [
    'gameplay', 'gaming', 'lets play', 'walkthrough', 'fortnite',
    'minecraft', 'roblox', 'gta', 'pubg', 'valorant', 'free fire',
    'tiktok', 'shorts', 'meme', 'funny', 'prank', 'challenge',
    'reaction', 'unboxing', 'asmr', 'music video', 'lyrics',
    'game', 'chơi game', 'hài', 'thử thách', 'phim'
  ]
};

function detectBrowser(title) {
  for (const bp of BROWSER_PATTERNS) {
    if (bp.regex.test(title)) {
      return bp.name;
    }
  }
  return null;
}

function detectSite(title) {
  const lower = title.toLowerCase();
  for (const rule of SITE_RULES) {
    if (lower.includes(rule.pattern)) {
      return { site: rule.site, category: rule.category };
    }
  }
  return null;
}

function classifyContent(title) {
  const lower = title.toLowerCase();
  const isEdu = CONTENT_KEYWORDS.educational.some(kw => lower.includes(kw));
  const isEnt = CONTENT_KEYWORDS.entertainment.some(kw => lower.includes(kw));
  if (isEdu && !isEnt) return 'educational';
  if (isEnt && !isEdu) return 'entertainment';
  if (isEdu && isEnt) return 'mixed';
  return 'unknown';
}

function extractPageTitle(fullTitle) {
  // Remove browser suffix: "Page Title - Google Chrome" -> "Page Title"
  for (const bp of BROWSER_PATTERNS) {
    const match = fullTitle.match(bp.regex);
    if (match) {
      const idx = fullTitle.indexOf(match[0]);
      if (idx > 0) {
        return fullTitle.substring(0, idx).replace(/\s*[-–—]\s*$/, '').trim();
      }
    }
  }
  return fullTitle;
}

ipcMain.handle('check-browser-activity', async () => {
  return new Promise((resolve) => {
    const isWin = process.platform === 'win32';

    let command;
    if (isWin) {
      const scriptPath = path.join(__dirname, 'get-window-titles.ps1');
      command = `cmd /c "chcp 65001 >nul & powershell -ExecutionPolicy Bypass -File "${scriptPath}""`;
    } else {
      // macOS: use dedicated shell script with AppleScript
      const scriptPath = path.join(__dirname, 'get-window-titles.sh');
      command = `bash "${scriptPath}"`;
    }

    exec(command, { timeout: 10000, encoding: 'utf8' }, (error, stdout) => {
      if (error || !stdout.trim()) {
        resolve({ browsers: [], hasYouTubeStream: false });
        return;
      }

      const lines = stdout.trim().split('\n').filter(Boolean);
      const browserTabs = [];
      let hasYouTubeStream = false;

      lines.forEach(line => {
        const trimmed = line.trim();

        if (trimmed.startsWith('TITLE:')) {
          const fullTitle = trimmed.substring(6);
          const browser = detectBrowser(fullTitle);

          if (browser) {
            const pageTitle = extractPageTitle(fullTitle, browser);
            const siteInfo = detectSite(fullTitle);
            const contentCategory = siteInfo ? siteInfo.category : classifyContent(fullTitle);

            browserTabs.push({
              browser,
              pageTitle,
              fullTitle,
              site: siteInfo ? siteInfo.site : null,
              category: contentCategory
            });
          }
        }

        if (trimmed.startsWith('NET:')) {
          hasYouTubeStream = true;
        }
      });

      resolve({
        browsers: browserTabs,
        hasYouTubeStream
      });
    });
  });
});
