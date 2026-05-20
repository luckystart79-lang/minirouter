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
          entries.push({ ...entry, ...info, timestamp: new Date(entry.lastVisit).toLocaleTimeString() });
        }
      });
    }
    entries.sort((a, b) => b.lastVisit - a.lastVisit);

    // Content safety analysis
    const analyzed = await ipcRenderer.invoke('analyze-content', entries);
    setAllEntries(analyzed);
  }

  const hasHistory = allEntries.length > 0;
  const allTabs = allEntries;

  // Safety stats
  const dangerCount = allTabs.filter(t => t.safety === 'danger').length;
  const cautionCount = allTabs.filter(t => t.safety === 'caution').length;
  const safeCount = allTabs.filter(t => t.safety === 'safe').length;

  // Category stats
  const categoryCounts = {};
  allTabs.forEach(t => {
    categoryCounts[t.category] = (categoryCounts[t.category] || 0) + 1;
  });

  return (
    <div style={{ maxWidth: 750, margin: '0 auto' }}>
      <h1 style={{ marginBottom: 5 }}>🌐 Browser Activity Monitor</h1>
      <p style={{ color: '#7f8c8d', marginTop: 0 }}>
        {hasHistory
          ? `✅ ${allTabs.length} URLs tracked (last 30 min) — Content analysis active`
          : '📡 Scanning browsers...'}
      </p>

      {/* DANGER ALERT */}
      {dangerCount > 0 && (
        <div style={{
          background: 'linear-gradient(135deg, #e74c3c, #c0392b)',
          padding: 15, borderRadius: 10, color: 'white', marginBottom: 15,
          boxShadow: '0 4px 15px rgba(231,76,60,0.3)'
        }}>
          <div style={{ fontWeight: 'bold', fontSize: '1.1rem', marginBottom: 8 }}>
            🚨 {dangerCount} Dangerous Content Detected!
          </div>
          {allTabs.filter(t => t.safety === 'danger').map((tab, idx) => (
            <div key={idx} style={{ fontSize: '0.85rem', padding: '4px 0', borderTop: idx ? '1px solid rgba(255,255,255,0.2)' : 'none' }}>
              <strong>{tab.enrichedTitle || tab.title}</strong>
              {tab.channel && <span style={{ opacity: 0.7 }}> — {tab.channel}</span>}
              <div style={{ fontSize: '0.75rem', opacity: 0.8, marginTop: 2 }}>
                {tab.flags?.join(' • ')}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Safety summary bar */}
      {hasHistory && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 15 }}>
          <div style={{ background: dangerCount > 0 ? '#fdedec' : '#f8f9fa', padding: 10, borderRadius: 8, textAlign: 'center', border: dangerCount > 0 ? '2px solid #e74c3c' : '1px solid #eee' }}>
            <div style={{ fontSize: '1.3rem' }}>🚫</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#e74c3c' }}>{dangerCount}</div>
            <div style={{ fontSize: '0.65rem', color: '#95a5a6' }}>Dangerous</div>
          </div>
          <div style={{ background: cautionCount > 0 ? '#fef9e7' : '#f8f9fa', padding: 10, borderRadius: 8, textAlign: 'center', border: cautionCount > 0 ? '2px solid #f39c12' : '1px solid #eee' }}>
            <div style={{ fontSize: '1.3rem' }}>⚠️</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#f39c12' }}>{cautionCount}</div>
            <div style={{ fontSize: '0.65rem', color: '#95a5a6' }}>Caution</div>
          </div>
          <div style={{ background: '#f8f9fa', padding: 10, borderRadius: 8, textAlign: 'center', border: '1px solid #eee' }}>
            <div style={{ fontSize: '1.3rem' }}>✅</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#27ae60' }}>{safeCount}</div>
            <div style={{ fontSize: '0.65rem', color: '#95a5a6' }}>Safe</div>
          </div>
        </div>
      )}

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
              const safetyBg = tab.safety === 'danger' ? '#fdedec' : tab.safety === 'caution' ? '#fef9e7' : '#f8f9fa';
              const safetyBorder = tab.safety === 'danger' ? '#e74c3c' : tab.safety === 'caution' ? '#f39c12' : catStyle.color;
              const safetyIcon = tab.safety === 'danger' ? '🚫' : tab.safety === 'caution' ? '⚠️' : '✅';
              return (
                <div key={idx} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 8,
                  padding: '8px', marginBottom: 4,
                  background: safetyBg, borderRadius: 5,
                  borderLeft: `4px solid ${safetyBorder}`
                }}>
                  <span style={{ fontSize: '0.9rem', marginTop: 2 }}>{safetyIcon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: tab.safety === 'danger' ? 'bold' : 'normal' }}>
                      {tab.enrichedTitle || tab.title || 'Untitled'}
                    </div>
                    {tab.channel && (
                      <div style={{ fontSize: '0.7rem', color: '#8e44ad' }}>📺 {tab.channel}</div>
                    )}
                    <div style={{ fontSize: '0.7rem', color: '#aab7b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {tab.url}
                    </div>
                    <div style={{ fontSize: '0.6rem', color: '#bdc3c7' }}>
                      {tab.browser} {tab.profile ? `(${tab.profile})` : ''} • {tab.site ? `${tab.site} • ` : ''}{tab.timestamp} • {tab.visitCount}x
                    </div>
                    {tab.flags && tab.flags.length > 0 && (
                      <div style={{ fontSize: '0.65rem', marginTop: 3, color: tab.safety === 'danger' ? '#c0392b' : '#f39c12' }}>
                        {tab.flags.join(' • ')}
                      </div>
                    )}
                  </div>
                  <span style={{
                    fontSize: '0.55rem', padding: '1px 4px', whiteSpace: 'nowrap',
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
