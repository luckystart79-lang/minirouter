/**
 * Browser History Reader
 * 
 * Reads ALL visited URLs directly from browser SQLite History files.
 * No extension, no shortcut modification, no browser restart needed.
 * 
 * BONUS: Chrome Sync means we also see history from OTHER DEVICES
 * logged into the same Google account! Remote monitoring for free.
 * 
 * Scans ALL browser profiles (multiple Gmail accounts).
 */

const path = require('path');
const fs = require('fs');
const os = require('os');

// Find all Chrome profiles in a User Data directory
function findProfiles(userDataDir) {
  if (!fs.existsSync(userDataDir)) return [];
  
  const profiles = [];
  try {
    const entries = fs.readdirSync(userDataDir);
    for (const entry of entries) {
      // Chrome profiles: "Default", "Profile 1", "Profile 2", etc.
      if (entry === 'Default' || entry.startsWith('Profile')) {
        const historyFile = path.join(userDataDir, entry, 'History');
        if (fs.existsSync(historyFile)) {
          // Try to read profile name from Preferences
          let profileName = entry;
          try {
            const prefsFile = path.join(userDataDir, entry, 'Preferences');
            if (fs.existsSync(prefsFile)) {
              const prefs = JSON.parse(fs.readFileSync(prefsFile, 'utf8'));
              const name = prefs?.profile?.name;
              const email = prefs?.account_info?.[0]?.email;
              if (name) profileName = name;
              if (email) profileName += ` (${email})`;
            }
          } catch(e) { /* ignore */ }
          
          profiles.push({
            profileDir: entry,
            profileName,
            historyPath: historyFile
          });
        }
      }
    }
  } catch(e) { /* ignore */ }
  return profiles;
}

// Browser User Data directories (Windows / macOS)
function getAllBrowserProfiles() {
  const home = os.homedir();
  const isWin = process.platform === 'win32';
  const result = [];

  const browsers = isWin ? [
    { name: 'Google Chrome', dir: path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'User Data') },
    { name: 'Microsoft Edge', dir: path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Edge', 'User Data') },
    { name: 'Brave', dir: path.join(process.env.LOCALAPPDATA || '', 'BraveSoftware', 'Brave-Browser', 'User Data') },
    { name: 'Opera', dir: path.join(process.env.APPDATA || '', 'Opera Software', 'Opera Stable') },
    { name: 'Vivaldi', dir: path.join(process.env.LOCALAPPDATA || '', 'Vivaldi', 'User Data') },
    { name: 'Coc Coc', dir: path.join(process.env.LOCALAPPDATA || '', 'CocCoc', 'Browser', 'User Data') },
  ] : [
    { name: 'Google Chrome', dir: path.join(home, 'Library', 'Application Support', 'Google', 'Chrome') },
    { name: 'Microsoft Edge', dir: path.join(home, 'Library', 'Application Support', 'Microsoft Edge') },
    { name: 'Brave', dir: path.join(home, 'Library', 'Application Support', 'BraveSoftware', 'Brave-Browser') },
    { name: 'Opera', dir: path.join(home, 'Library', 'Application Support', 'com.operasoftware.Opera') },
    { name: 'Vivaldi', dir: path.join(home, 'Library', 'Application Support', 'Vivaldi') },
  ];

  for (const browser of browsers) {
    // Opera doesn't use profile folders like Chrome
    if (browser.name === 'Opera') {
      const historyFile = path.join(browser.dir, 'History');
      if (fs.existsSync(historyFile)) {
        result.push({ browser: browser.name, profileName: 'Default', historyPath: historyFile });
      }
    } else {
      const profiles = findProfiles(browser.dir);
      profiles.forEach(p => {
        result.push({ browser: browser.name, profileName: p.profileName, historyPath: p.historyPath });
      });
    }
  }

  return result;
}

/**
 * Read recent history from a single browser profile's SQLite file
 */
async function readProfileHistory(profileInfo, minutesBack = 30) {
  const { browser, profileName, historyPath } = profileInfo;

  // Copy the file because browser locks it
  const tmpDir = path.join(os.tmpdir(), 'parental-control');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  const safeName = `${browser}_${profileName}`.replace(/[^a-zA-Z0-9_-]/g, '_');
  const tmpFile = path.join(tmpDir, `${safeName}_History`);

  try {
    fs.copyFileSync(historyPath, tmpFile);
  } catch (e) {
    if (!fs.existsSync(tmpFile)) return null;
  }

  try {
    const initSqlJs = require('sql.js');
    const SQL = await initSqlJs();
    const buffer = fs.readFileSync(tmpFile);
    const db = new SQL.Database(buffer);

    // Chrome timestamps: microseconds since Jan 1, 1601
    const chromeEpochOffset = 11644473600000000n;
    const nowMicro = BigInt(Date.now()) * 1000n + chromeEpochOffset;
    const cutoffMicro = nowMicro - BigInt(minutesBack * 60) * 1000000n;

    const results = db.exec(`
      SELECT url, title, last_visit_time, visit_count
      FROM urls
      WHERE last_visit_time > ${cutoffMicro.toString()}
      ORDER BY last_visit_time DESC
      LIMIT 100
    `);

    db.close();

    if (!results.length || !results[0].values.length) return null;

    const entries = results[0].values.map(row => ({
      url: row[0],
      title: row[1] || '',
      lastVisit: Number((BigInt(row[2]) - chromeEpochOffset) / 1000n),
      visitCount: row[3],
      browser,
      profile: profileName
    }));

    return entries;
  } catch (e) {
    console.error(`[HistoryReader] Error reading ${browser}/${profileName}:`, e.message);
    return null;
  }
}

/**
 * Scan ALL browsers, ALL profiles, return recent history
 */
async function scanAllBrowserHistory(minutesBack = 30) {
  const allProfiles = getAllBrowserProfiles();
  const results = {};

  for (const profile of allProfiles) {
    const key = profile.profileName !== 'Default' 
      ? `${profile.browser} — ${profile.profileName}`
      : profile.browser;
    
    const entries = await readProfileHistory(profile, minutesBack);
    if (entries && entries.length > 0) {
      results[key] = entries;
    }
  }

  return results;
}

module.exports = { scanAllBrowserHistory, getAllBrowserProfiles };
