import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;

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

  // If in dev mode (Vite defaults to 5173)
  mainWindow.loadURL('http://localhost:5173');
}

app.whenReady().then(createWindow);

// --- Cross-Platform Activity Monitoring --- //
ipcMain.handle('check-active-apps', async () => {
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
      // Simple string matching for target MVP apps
      if (lowerOut.includes('roblox')) apps.push('roblox');
      if (lowerOut.includes('steam')) apps.push('steam');
      if (lowerOut.includes('chrome')) apps.push('chrome');
      if (lowerOut.includes('safari')) apps.push('safari');
      
      resolve(apps);
    });
  });
});

// --- Cross-Platform App Blocking --- //
ipcMain.handle('kill-apps', async (event, targetApps) => {
  const isWin = process.platform === 'win32';
  
  targetApps.forEach(appName => {
    // For Windows: taskkill /IM RobloxPlayerBeta.exe /F
    // For Mac: killall Roblox
    let cmd = isWin ? `taskkill /IM ${appName}.exe /F` : `killall -9 ${appName}`;
    // Naive mapping for MVP
    if (appName === 'chrome' && isWin) cmd = 'taskkill /IM chrome.exe /F';
    if (appName === 'safari' && isWin) return; // No Safari on Win
    
    exec(cmd, () => {
      console.log(`Force killed: ${appName}`);
    });
  });
  return true;
});
