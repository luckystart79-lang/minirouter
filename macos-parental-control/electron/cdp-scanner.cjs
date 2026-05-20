/**
 * Chrome DevTools Protocol (CDP) Tab Scanner
 * 
 * Enables remote debugging on Chromium browsers (Chrome, Edge, Brave, Opera)
 * so we can query ALL open tabs without any browser extension.
 * 
 * How it works:
 * 1. Finds browser shortcuts and adds --remote-debugging-port flag
 * 2. Queries http://localhost:<port>/json to get all tabs
 * 3. Returns tab URLs, titles, and metadata
 */

const http = require('http');
const https = require('https');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Each Chromium browser gets its own debug port to avoid conflicts
const BROWSER_PORTS = {
  chrome: 9222,
  msedge: 9223,
  brave: 9224,
  opera: 9225
};

/**
 * Query a Chromium browser's debug port for all open tabs
 */
function queryDebugPort(port, timeout = 3000) {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/json`, { timeout }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const tabs = JSON.parse(data);
          resolve(tabs.filter(t => t.type === 'page').map(t => ({
            title: t.title || '',
            url: t.url || '',
            favIconUrl: t.faviconUrl || '',
            active: false, // CDP doesn't tell us which is active
            audible: false  // CDP doesn't expose audio state
          })));
        } catch (e) {
          resolve([]);
        }
      });
    });
    req.on('error', () => resolve([]));
    req.on('timeout', () => { req.destroy(); resolve([]); });
  });
}

/**
 * Scan all Chromium browsers for open tabs via CDP
 */
async function scanAllBrowserTabs() {
  const results = {};

  for (const [browser, port] of Object.entries(BROWSER_PORTS)) {
    const tabs = await queryDebugPort(port);
    if (tabs.length > 0) {
      const displayName = {
        chrome: 'Google Chrome',
        msedge: 'Microsoft Edge',
        brave: 'Brave',
        opera: 'Opera'
      }[browser] || browser;

      results[displayName] = { tabs, timestamp: Date.now() };
    }
  }

  return results;
}

/**
 * Enable remote debugging on a browser by modifying its shortcut
 * Works on Windows — modifies the desktop/start menu shortcut target
 */
function enableDebugPort(browserExeName, port) {
  const isWin = process.platform === 'win32';
  if (!isWin) return; // macOS approach would use launchctl or similar

  // PowerShell script to find and modify browser shortcuts
  const psScript = `
$flag = "--remote-debugging-port=${port}"
$shell = New-Object -ComObject WScript.Shell

# Search common shortcut locations
$locations = @(
    [Environment]::GetFolderPath("CommonDesktopDirectory"),
    [Environment]::GetFolderPath("Desktop"),
    [Environment]::GetFolderPath("CommonStartMenu") + "\\Programs",
    [Environment]::GetFolderPath("StartMenu") + "\\Programs"
)

foreach ($loc in $locations) {
    Get-ChildItem -Path $loc -Filter "*.lnk" -Recurse -ErrorAction SilentlyContinue | ForEach-Object {
        $lnk = $shell.CreateShortcut($_.FullName)
        if ($lnk.TargetPath -match '${browserExeName}') {
            if ($lnk.Arguments -notmatch 'remote-debugging-port') {
                $lnk.Arguments = $lnk.Arguments + " $flag"
                $lnk.Save()
                Write-Output "MODIFIED:$($_.FullName)"
            }
        }
    }
}
`;

  // Write temp script and execute
  const tempScript = path.join(os.tmpdir(), `enable-debug-${browserExeName}.ps1`);
  fs.writeFileSync(tempScript, psScript);

  exec(`powershell -ExecutionPolicy Bypass -File "${tempScript}"`, (err, stdout) => {
    if (stdout && stdout.includes('MODIFIED')) {
      console.log(`[CDP] Enabled debug port ${port} for ${browserExeName}`);
    }
    try { fs.unlinkSync(tempScript); } catch(e) {}
  });
}

/**
 * Enable debug ports on all known Chromium browsers
 */
function enableAllDebugPorts() {
  enableDebugPort('chrome', BROWSER_PORTS.chrome);
  enableDebugPort('msedge', BROWSER_PORTS.msedge);
  enableDebugPort('brave', BROWSER_PORTS.brave);
  enableDebugPort('opera', BROWSER_PORTS.opera);
}

module.exports = {
  scanAllBrowserTabs,
  queryDebugPort,
  enableAllDebugPorts,
  BROWSER_PORTS
};
