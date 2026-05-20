/**
 * Browser History Reader
 * 
 * Reads ALL visited URLs directly from browser SQLite History files.
 * No extension, no shortcut modification, no browser restart needed.
 * 
 * The kid CANNOT hide from this — browsers always write to History.
 * Even if they delete history, we capture it in real-time.
 */

const path = require('path');
const fs = require('fs');
const os = require('os');

// Browser profile paths (Windows / macOS)
function getBrowserPaths() {
  const home = os.homedir();
  const isWin = process.platform === 'win32';

  if (isWin) {
    const localAppData = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
    const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
    return [
      { name: 'Google Chrome', path: path.join(localAppData, 'Google', 'Chrome', 'User Data', 'Default', 'History') },
      { name: 'Microsoft Edge', path: path.join(localAppData, 'Microsoft', 'Edge', 'User Data', 'Default', 'History') },
      { name: 'Brave', path: path.join(localAppData, 'BraveSoftware', 'Brave-Browser', 'User Data', 'Default', 'History') },
      { name: 'Opera', path: path.join(appData, 'Opera Software', 'Opera Stable', 'History') },
      { name: 'Vivaldi', path: path.join(localAppData, 'Vivaldi', 'User Data', 'Default', 'History') },
      { name: 'Coc Coc', path: path.join(localAppData, 'CocCoc', 'Browser', 'User Data', 'Default', 'History') },
    ];
  } else {
    // macOS
    const appSupport = path.join(home, 'Library', 'Application Support');
    return [
      { name: 'Google Chrome', path: path.join(appSupport, 'Google', 'Chrome', 'Default', 'History') },
      { name: 'Microsoft Edge', path: path.join(appSupport, 'Microsoft Edge', 'Default', 'History') },
      { name: 'Brave', path: path.join(appSupport, 'BraveSoftware', 'Brave-Browser', 'Default', 'History') },
      { name: 'Opera', path: path.join(appSupport, 'com.operasoftware.Opera', 'History') },
      { name: 'Vivaldi', path: path.join(appSupport, 'Vivaldi', 'Default', 'History') },
    ];
  }
}

/**
 * Read recent history from a single browser's SQLite file
 * Chrome locks the file while running, so we copy it first
 */
async function readBrowserHistory(browserInfo, minutesBack = 30) {
  const { name, path: historyPath } = browserInfo;

  if (!fs.existsSync(historyPath)) return null;

  // Copy the file because Chrome locks it
  const tmpDir = path.join(os.tmpdir(), 'parental-control');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  const tmpFile = path.join(tmpDir, `${name.replace(/\s+/g, '_')}_History`);

  try {
    fs.copyFileSync(historyPath, tmpFile);
  } catch (e) {
    // File might be locked — try reading the copy from last time
    if (!fs.existsSync(tmpFile)) return null;
  }

  try {
    const initSqlJs = require('sql.js');
    const SQL = await initSqlJs();
    const buffer = fs.readFileSync(tmpFile);
    const db = new SQL.Database(buffer);

    // Chrome stores timestamps as microseconds since Jan 1, 1601
    // Convert to JS epoch: subtract 11644473600 seconds, divide by 1000000
    const chromeEpochOffset = 11644473600000000n;
    const nowMicro = BigInt(Date.now()) * 1000n + chromeEpochOffset;
    const cutoffMicro = nowMicro - BigInt(minutesBack * 60) * 1000000n;

    const results = db.exec(`
      SELECT url, title, last_visit_time, visit_count
      FROM urls
      WHERE last_visit_time > ${cutoffMicro.toString()}
      ORDER BY last_visit_time DESC
      LIMIT 50
    `);

    db.close();

    if (!results.length || !results[0].values.length) return null;

    const entries = results[0].values.map(row => ({
      url: row[0],
      title: row[1] || '',
      lastVisit: Number((BigInt(row[2]) - chromeEpochOffset) / 1000n), // JS timestamp
      visitCount: row[3],
      browser: name
    }));

    return { browser: name, entries };
  } catch (e) {
    console.error(`[HistoryReader] Error reading ${name}:`, e.message);
    return null;
  }
}

/**
 * Scan ALL browsers and return recent history
 */
async function scanAllBrowserHistory(minutesBack = 30) {
  const browsers = getBrowserPaths();
  const results = {};

  for (const browser of browsers) {
    const data = await readBrowserHistory(browser, minutesBack);
    if (data && data.entries.length > 0) {
      results[data.browser] = data.entries;
    }
  }

  return results;
}

module.exports = { scanAllBrowserHistory, getBrowserPaths };
