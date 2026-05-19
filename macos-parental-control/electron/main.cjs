const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

let mainWindow;
let tray = null;

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

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadURL('http://localhost:5173');

  // Prevent window close, hide to tray instead
  mainWindow.on('close', (event) => {
    if (!app.isQuiting) {
      event.preventDefault();
      mainWindow.hide();
    }
    return false;
  });
}

function createTray() {
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon);
  tray.setToolTip('Parental Control Monitor');
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Open Dashboard', click: () => mainWindow.show() },
    { type: 'separator' },
    { label: 'Force Quit (Parent Only)', click: () => {
        app.isQuiting = true;
        app.quit();
    }}
  ]);
  tray.setContextMenu(contextMenu);
}

app.whenReady().then(() => {
  createWindow();
  createTray();
  
  // Auto-start on OS boot
  app.setLoginItemSettings({
    openAtLogin: true,
    path: app.getPath("exe")
  });
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
