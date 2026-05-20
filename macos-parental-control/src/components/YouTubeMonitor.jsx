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
  const [windowData, setWindowData] = useState({ browsers: [] });
  const [historyData, setHistoryData] = useState({});
  const [allEntries, setAllEntries] = useState([]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  async function fetchData() {
    // Source 1: Window titles (real-time, what's active NOW)
    const winData = await ipcRenderer.invoke('check-browser-activity');
    setWindowData(winData);

    // Source 2: Browser History SQLite (last 30 min, ALL URLs, can't hide!)
    const histData = await ipcRenderer.invoke('scan-browser-history');
    setHistoryData(histData);

    // Merge history entries (deduplicate by URL)
    const entries = [];
    const seenUrls = new Set();
    for (const [browser, urls] of Object.entries(histData)) {
      urls.forEach(entry => {
        if (!seenUrls.has(entry.url) && !entry.url.startsWith('chrome://') && !entry.url.startsWith('edge://') && !entry.url.startsWith('about:')) {
          seenUrls.add(entry.url);
          const info = classifyUrl(entry.url, entry.title);
          entries.push({
            ...entry,
            ...info,
            timestamp: new Date(entry.lastVisit).toLocaleTimeString()
          });
        }
      });
    }
    // Sort by most recent first
    entries.sort((a, b) => b.lastVisit - a.lastVisit);
    setAllEntries(entries);
  }

  const hasHistory = allEntries.length > 0;

  // Merge all tabs for display (deduplicate)
  const allTabs = allEntries;

  // Stats
  const categoryCounts = {};
  allTabs.forEach(t => {
    categoryCounts[t.category] = (categoryCounts[t.category] || 0) + 1;
  });

  return (
    <div style={{ maxWidth: 750, margin: '0 auto' }}>
      <h1 style={{ marginBottom: 5 }}>🌐 Browser Activity Monitor</h1>
      <p style={{ color: '#7f8c8d', marginTop: 0 }}>
        {hasHistory
          ? `✅ Reading browser history — ${allTabs.length} URLs tracked (last 30 min)`
          : '📡 Scanning browsers...'}
      </p>

      {/* Real-time Active Windows */}
      {windowData.browsers && windowData.browsers.length > 0 && (
        <div style={{ background: 'white', padding: 15, borderRadius: 10, marginBottom: 15, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <h3 style={{ marginTop: 0 }}>👁 Active Right Now</h3>
          {windowData.browsers.map((tab, idx) => {
            const catStyle = CATEGORY_STYLES[tab.category] || CATEGORY_STYLES.unknown;
            return (
              <div key={idx} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 8px', marginBottom: 3,
                background: '#eaf2f8', borderRadius: 5,
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
                  borderRadius: 3, fontWeight: 'bold'
                }}>{catStyle.label}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* ALL browsed URLs from SQLite History — THE KEY FEATURE */}
      {hasHistory && (
        <div style={{ background: 'white', padding: 15, borderRadius: 10, marginBottom: 15, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <h3 style={{ marginTop: 0 }}>📑 Browsing History — Last 30 Minutes ({allTabs.length} URLs)</h3>
          <div style={{ maxHeight: 400, overflow: 'auto' }}>
            {allTabs.map((tab, idx) => {
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
                      {tab.title || 'Untitled'}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#aab7b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {tab.url}
                    </div>
                    <div style={{ fontSize: '0.6rem', color: '#bdc3c7' }}>
                      {tab.browser} • {tab.site ? `${tab.site} • ` : ''}{tab.timestamp} • {tab.visitCount}x visits
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
    </div>
  );
}
