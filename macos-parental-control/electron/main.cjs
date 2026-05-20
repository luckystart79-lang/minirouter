const { app, BrowserWindow, ipcMain, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

let mainWindow;
const PARENT_PIN = '1234';

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
});

// Prevent app from quitting when all windows are closed
app.on('window-all-closed', (e) => {
  e.preventDefault();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
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
