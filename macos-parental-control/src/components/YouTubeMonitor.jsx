import React, { useState, useEffect } from 'react';
const { ipcRenderer } = window.require('electron');

const CATEGORY_STYLES = {
  educational: { bg: '#d5f5e3', color: '#1e8449', icon: '📗', label: 'Educational' },
  entertainment: { bg: '#fadbd8', color: '#c0392b', icon: '🎬', label: 'Entertainment' },
  social: { bg: '#d6eaf8', color: '#2471a3', icon: '💬', label: 'Social Media' },
  gaming: { bg: '#f5b7b1', color: '#922b21', icon: '🎮', label: 'Gaming' },
  productive: { bg: '#d4efdf', color: '#1e8449', icon: '💼', label: 'Productive' },
  mixed: { bg: '#fdebd0', color: '#d35400', icon: '⚠️', label: 'Mixed' },
  unknown: { bg: '#eaecee', color: '#566573', icon: '🌐', label: 'Other' }
};

// Classify a URL into categories
function classifyUrl(url, title) {
  const lower = (url + ' ' + title).toLowerCase();
  const rules = [
    { patterns: ['youtube.com', 'youtu.be'], site: 'YouTube', category: 'entertainment' },
    { patterns: ['tiktok.com'], site: 'TikTok', category: 'entertainment' },
    { patterns: ['netflix.com'], site: 'Netflix', category: 'entertainment' },
    { patterns: ['twitch.tv'], site: 'Twitch', category: 'entertainment' },
    { patterns: ['spotify.com'], site: 'Spotify', category: 'entertainment' },
    { patterns: ['facebook.com', 'fb.com'], site: 'Facebook', category: 'social' },
    { patterns: ['instagram.com'], site: 'Instagram', category: 'social' },
    { patterns: ['twitter.com', 'x.com'], site: 'Twitter/X', category: 'social' },
    { patterns: ['reddit.com'], site: 'Reddit', category: 'social' },
    { patterns: ['discord.com'], site: 'Discord', category: 'social' },
    { patterns: ['messenger.com'], site: 'Messenger', category: 'social' },
    { patterns: ['zalo.me'], site: 'Zalo', category: 'social' },
    { patterns: ['roblox.com'], site: 'Roblox', category: 'gaming' },
    { patterns: ['minecraft.net'], site: 'Minecraft', category: 'gaming' },
    { patterns: ['store.steampowered.com', 'steamcommunity.com'], site: 'Steam', category: 'gaming' },
    { patterns: ['epicgames.com'], site: 'Epic Games', category: 'gaming' },
    { patterns: ['poki.com'], site: 'Poki', category: 'gaming' },
    { patterns: ['friv.com'], site: 'Friv', category: 'gaming' },
    { patterns: ['y8.com'], site: 'Y8', category: 'gaming' },
    { patterns: ['coolmathgames.com'], site: 'CoolMath', category: 'gaming' },
    { patterns: ['khanacademy.org'], site: 'Khan Academy', category: 'educational' },
    { patterns: ['duolingo.com'], site: 'Duolingo', category: 'educational' },
    { patterns: ['wikipedia.org'], site: 'Wikipedia', category: 'educational' },
    { patterns: ['coursera.org'], site: 'Coursera', category: 'educational' },
    { patterns: ['classroom.google.com'], site: 'Google Classroom', category: 'educational' },
    { patterns: ['docs.google.com'], site: 'Google Docs', category: 'productive' },
    { patterns: ['sheets.google.com'], site: 'Google Sheets', category: 'productive' },
  ];
  for (const rule of rules) {
    if (rule.patterns.some(p => lower.includes(p))) {
      return { site: rule.site, category: rule.category };
    }
  }
  return { site: null, category: 'unknown' };
}

export default function BrowserMonitor() {
  const [windowData, setWindowData] = useState({ browsers: [], hasYouTubeStream: false });
  const [extensionData, setExtensionData] = useState({});
  const [cdpData, setCdpData] = useState({});
  const [history, setHistory] = useState([]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  async function fetchData() {
    // Source 1: Window titles (always works, active tab only)
    const winData = await ipcRenderer.invoke('check-browser-activity');
    setWindowData(winData);

    // Source 2: CDP — Chrome DevTools Protocol (ALL tabs, no extension!)
    const cdp = await ipcRenderer.invoke('scan-cdp-tabs');
    setCdpData(cdp);

    // Source 3: Extension tab data (if installed)
    const extData = await ipcRenderer.invoke('get-extension-tabs');
    setExtensionData(extData);

    // Merge all tab data into history
    const allSources = { ...cdp, ...extData };
    const hasDeep = Object.keys(allSources).length > 0;

    if (hasDeep) {
      // Deep scan: use CDP + Extension data (has URLs)
      for (const [browser, bData] of Object.entries(allSources)) {
        if (bData.tabs) {
          const newEntries = bData.tabs
            .filter(tab => tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('edge://') && !tab.url.startsWith('about:'))
            .filter(tab => !history.some(h => h.url === tab.url))
            .map(tab => {
              const info = classifyUrl(tab.url, tab.title);
              return { ...tab, browser, ...info, timestamp: new Date().toLocaleTimeString() };
            });
          if (newEntries.length > 0) {
            setHistory(prev => [...newEntries, ...prev].slice(0, 200));
          }
        }
      }
    } else if (winData.browsers && winData.browsers.length > 0) {
      // Fallback: use window title data (no URL, but still useful)
      setHistory(prev => {
        const newEntries = winData.browsers
          .filter(tab => !prev.some(h => h.fullTitle === tab.fullTitle))
          .map(tab => ({
            ...tab,
            title: tab.pageTitle,
            timestamp: new Date().toLocaleTimeString()
          }));
        return [...newEntries, ...prev].slice(0, 200);
      });
    }
  }

  // Check data sources
  const hasExtension = Object.keys(extensionData).length > 0;
  const hasCdp = Object.keys(cdpData).length > 0;
  const hasDeepScan = hasExtension || hasCdp;

  // Merge ALL tabs from CDP + Extension (deduplicate by URL)
  const allTabs = [];
  const seenUrls = new Set();
  const allSources = { ...cdpData, ...extensionData }; // Extension overwrites CDP (has audible info)

  for (const [browser, bData] of Object.entries(allSources)) {
    if (bData.tabs) {
      bData.tabs.forEach(tab => {
        if (tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('edge://') && !tab.url.startsWith('about:') && !seenUrls.has(tab.url)) {
          seenUrls.add(tab.url);
          const info = classifyUrl(tab.url, tab.title);
          allTabs.push({ ...tab, browser, ...info });
        }
      });
    }
  }

  // Find audible (playing audio) tabs — THE KEY FEATURE!
  const audibleTabs = allTabs.filter(t => t.audible);

  // Stats
  const categoryCounts = {};
  allTabs.forEach(t => {
    categoryCounts[t.category] = (categoryCounts[t.category] || 0) + 1;
  });

  return (
    <div style={{ maxWidth: 750, margin: '0 auto' }}>
      <h1 style={{ marginBottom: 5 }}>🌐 Browser Activity Monitor</h1>
      <p style={{ color: '#7f8c8d', marginTop: 0 }}>
        {hasDeepScan
          ? `✅ Deep scan active (${hasCdp ? 'CDP' : ''}${hasCdp && hasExtension ? ' + ' : ''}${hasExtension ? 'Extension' : ''}) — ALL tabs visible`
          : '🪟 Window titles only — restart browser to enable deep scan'}
      </p>

      {/* AUDIBLE ALERT — tabs playing audio */}
      {audibleTabs.length > 0 && (
        <div style={{
          background: 'linear-gradient(135deg, #e74c3c, #c0392b)',
          padding: 15, borderRadius: 10, color: 'white', marginBottom: 15,
          boxShadow: '0 4px 15px rgba(231,76,60,0.3)'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: 8 }}>🔊 Audio Playing in Background!</div>
          {audibleTabs.map((tab, idx) => (
            <div key={idx} style={{ fontSize: '0.9rem', padding: '4px 0', opacity: 0.95 }}>
              🎵 <strong>{tab.title}</strong>
              <span style={{ opacity: 0.7 }}> — {tab.browser}</span>
            </div>
          ))}
        </div>
      )}

      {/* Info: how deep scan works */}
      {!hasDeepScan && (
        <div style={{ background: '#ebf5fb', border: '1px solid #aed6f1', padding: 12, borderRadius: 8, marginBottom: 15, fontSize: '0.82rem' }}>
          <strong>💡 Deep Tab Scan (auto, no extension needed):</strong>
          <p style={{ margin: '6px 0 0 0', lineHeight: 1.5 }}>
            App tự động thêm debug flag vào shortcut trình duyệt. Chỉ cần <strong>tắt rồi mở lại trình duyệt</strong> là tất cả tabs sẽ hiện.
            Nếu cần audible detection (phát hiện audio), cài thêm extension trong <code>browser-extension/</code>.
          </p>
        </div>
      )}

      {/* ALL TABS from CDP + Extension */}
      {hasDeepScan && allTabs.length > 0 && (
        <div style={{ background: 'white', padding: 15, borderRadius: 10, marginBottom: 15, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <h3 style={{ marginTop: 0 }}>📑 All Open Tabs ({allTabs.length})</h3>
          <div style={{ maxHeight: 350, overflow: 'auto' }}>
            {allTabs.map((tab, idx) => {
              const catStyle = CATEGORY_STYLES[tab.category] || CATEGORY_STYLES.unknown;
              return (
                <div key={idx} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 8px', marginBottom: 3,
                  background: tab.audible ? '#fdedec' : (tab.active ? '#eaf2f8' : '#f8f9fa'),
                  borderRadius: 5,
                  borderLeft: `3px solid ${catStyle.color}`
                }}>
                  {tab.audible && <span title="Playing audio">🔊</span>}
                  {tab.active && !tab.audible && <span title="Active tab">👁</span>}
                  {!tab.active && !tab.audible && <span style={{ width: 16 }} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {tab.title || 'Untitled'}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#aab7b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {tab.url}
                    </div>
                  </div>
                  <span style={{
                    fontSize: '0.6rem', padding: '1px 5px', whiteSpace: 'nowrap',
                    background: catStyle.bg, color: catStyle.color,
                    borderRadius: 3, fontWeight: 'bold'
                  }}>{catStyle.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Fallback: Window titles (when no deep scan available) */}
      {!hasDeepScan && windowData.browsers.length > 0 && (
        <div style={{ background: 'white', padding: 15, borderRadius: 10, marginBottom: 15, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <h3 style={{ marginTop: 0 }}>🪟 Active Tabs (Window Titles)</h3>
          <div style={{ background: '#fef9e7', padding: '6px 10px', borderRadius: 5, marginBottom: 10, fontSize: '0.75rem', color: '#7d6608' }}>
            ⚠️ Only active tabs visible. Restart browser to enable deep scan.
          </div>
          {windowData.browsers.map((tab, idx) => {
            const catStyle = CATEGORY_STYLES[tab.category] || CATEGORY_STYLES.unknown;
            return (
              <div key={idx} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 8px', marginBottom: 3,
                background: '#f8f9fa', borderRadius: 5,
                borderLeft: `3px solid ${catStyle.color}`
              }}>
                <span>{catStyle.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {tab.pageTitle}
                  </div>
                  <span style={{ fontSize: '0.7rem', color: '#aab7b8' }}>{tab.browser}</span>
                </div>
                <span style={{
                  fontSize: '0.6rem', padding: '1px 5px',
                  background: catStyle.bg, color: catStyle.color,
                  borderRadius: 3
                }}>{catStyle.label}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Category Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 15 }}>
        {['entertainment', 'gaming', 'social', 'educational'].map(cat => {
          const style = CATEGORY_STYLES[cat];
          return (
            <div key={cat} style={{ background: 'white', padding: 10, borderRadius: 8, textAlign: 'center', boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize: '1.3rem' }}>{style.icon}</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: style.color }}>{categoryCounts[cat] || 0}</div>
              <div style={{ fontSize: '0.65rem', color: '#95a5a6' }}>{style.label}</div>
            </div>
          );
        })}
      </div>

      {/* History */}
      <div style={{ background: 'white', padding: 15, borderRadius: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
        <h3 style={{ marginTop: 0 }}>📋 Browsing History ({history.length})</h3>
        {history.length === 0 ? (
          <p style={{ color: '#95a5a6', fontSize: '0.9rem' }}>No activity recorded yet...</p>
        ) : (
          <div style={{ maxHeight: 250, overflow: 'auto' }}>
            {history.map((entry, idx) => {
              const catStyle = CATEGORY_STYLES[entry.category] || CATEGORY_STYLES.unknown;
              return (
                <div key={idx} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '4px 0', borderBottom: '1px solid #f5f5f5', fontSize: '0.8rem'
                }}>
                  <span>{catStyle.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {entry.title || entry.pageTitle}
                    </div>
                    <div style={{ fontSize: '0.65rem', color: '#bdc3c7' }}>
                      {entry.browser} {entry.site ? `• ${entry.site}` : ''} • {entry.timestamp}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
