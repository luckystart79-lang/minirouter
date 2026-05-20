/**
 * Watchdog Process
 * ----------------
 * A lightweight sentinel that runs independently of the main Electron app.
 * If the main Electron process is killed, the watchdog restarts it automatically.
 * The main Electron app also monitors this watchdog — if the watchdog dies, Electron respawns it.
 * 
 * Result: A 13-year-old has to kill BOTH processes simultaneously to escape. Good luck.
 */

const { exec, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// --- Config ---
const CHECK_INTERVAL = 3000; // Check every 3 seconds
const PID_DIR = path.join(os.homedir(), '.parental-control');
const MAIN_PID_FILE = path.join(PID_DIR, 'main.pid');
const WATCHDOG_PID_FILE = path.join(PID_DIR, 'watchdog.pid');

// Ensure PID directory exists
if (!fs.existsSync(PID_DIR)) {
  fs.mkdirSync(PID_DIR, { recursive: true });
}

// Write our own PID
fs.writeFileSync(WATCHDOG_PID_FILE, process.pid.toString());
console.log(`[Watchdog] Started with PID ${process.pid}`);

// --- Check if a PID is alive ---
function isPidAlive(pid) {
  try {
    process.kill(pid, 0); // Signal 0 = just check, don't actually kill
    return true;
  } catch (e) {
    return false;
  }
}

// --- Read PID from file ---
function readPid(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      const pid = parseInt(fs.readFileSync(filePath, 'utf8').trim(), 10);
      return isNaN(pid) ? null : pid;
    }
  } catch (e) { /* ignore */ }
  return null;
}

// --- Restart the main Electron app ---
function restartMainApp() {
  console.log('[Watchdog] Main app is DEAD! Restarting...');

  const isWin = process.platform === 'win32';
  const electronPath = path.join(__dirname, '..', 'node_modules', '.bin', isWin ? 'electron.cmd' : 'electron');
  const appPath = path.join(__dirname, '..');

  const child = spawn(electronPath, [appPath], {
    detached: true,
    stdio: 'ignore',
    cwd: appPath
  });

  child.unref();
  console.log(`[Watchdog] Restarted main app (PID: ${child.pid})`);
}

// --- Main loop ---
setInterval(() => {
  const mainPid = readPid(MAIN_PID_FILE);

  if (mainPid === null) {
    // PID file doesn't exist yet — main app may not have started
    console.log('[Watchdog] No main PID file found. Waiting...');
    return;
  }

  if (!isPidAlive(mainPid)) {
    restartMainApp();
  }
}, CHECK_INTERVAL);

// Graceful shutdown
process.on('SIGINT', () => {
  try { fs.unlinkSync(WATCHDOG_PID_FILE); } catch(e) {}
  process.exit(0);
});

process.on('SIGTERM', () => {
  try { fs.unlinkSync(WATCHDOG_PID_FILE); } catch(e) {}
  process.exit(0);
});

// Keep process alive
process.stdin.resume();
console.log('[Watchdog] Monitoring main app...');
