/**
 * Parental Control — Browser Extension Background Worker
 * 
 * Runs silently in the background. Every 5 seconds:
 * 1. Queries ALL open tabs (title + URL + audible status)
 * 2. Sends the data to the Electron app via localhost HTTP
 * 
 * This catches EVERYTHING — even background tabs playing audio.
 */

const REPORT_INTERVAL = 5000; // 5 seconds
const ELECTRON_ENDPOINT = 'http://localhost:7700/tabs';

// --- Report all tabs to Electron ---
async function reportTabs() {
  try {
    const tabs = await chrome.tabs.query({});

    const tabData = tabs.map(tab => ({
      id: tab.id,
      windowId: tab.windowId,
      title: tab.title || '',
      url: tab.url || '',
      active: tab.active,
      audible: tab.audible || false, // true if tab is playing audio!
      favIconUrl: tab.favIconUrl || ''
    }));

    await fetch(ELECTRON_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        browser: getBrowserName(),
        timestamp: Date.now(),
        tabs: tabData
      })
    });
  } catch (err) {
    // Electron app might not be running — silently retry next cycle
  }
}

// --- Detect which browser we're running in ---
function getBrowserName() {
  const ua = navigator.userAgent;
  if (ua.includes('Edg/')) return 'Microsoft Edge';
  if (ua.includes('OPR/') || ua.includes('Opera')) return 'Opera';
  if (ua.includes('Brave')) return 'Brave';
  if (ua.includes('Vivaldi')) return 'Vivaldi';
  if (ua.includes('Chrome')) return 'Google Chrome';
  if (ua.includes('Firefox')) return 'Firefox';
  return 'Unknown Browser';
}

// --- Set up recurring alarm ---
chrome.alarms.create('reportTabs', { periodInMinutes: 0.083 }); // ~5 seconds

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'reportTabs') {
    reportTabs();
  }
});

// Also report immediately on startup
reportTabs();

// Report when tabs change
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'complete' || changeInfo.audible !== undefined) {
    reportTabs();
  }
});

chrome.tabs.onCreated.addListener(() => reportTabs());
chrome.tabs.onRemoved.addListener(() => reportTabs());
