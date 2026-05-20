import React, { useState, useEffect } from 'react';
const { ipcRenderer } = window.require('electron');

const CATEGORY_STYLES = {
  educational: { bg: '#d5f5e3', color: '#1e8449', icon: '📗', label: 'Educational' },
  entertainment: { bg: '#fadbd8', color: '#c0392b', icon: '🎬', label: 'Entertainment' },
  social: { bg: '#d6eaf8', color: '#2471a3', icon: '💬', label: 'Social' },
  gaming: { bg: '#f5b7b1', color: '#922b21', icon: '🎮', label: 'Gaming' },
  productive: { bg: '#d4efdf', color: '#1e8449', icon: '💼', label: 'Productive' },
  unknown: { bg: '#eaecee', color: '#566573', icon: '🌐', label: 'Other' }
};

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
    { patterns: ['zalo.me'], site: 'Zalo', category: 'social' },
    { patterns: ['roblox.com'], site: 'Roblox', category: 'gaming' },
    { patterns: ['minecraft.net'], site: 'Minecraft', category: 'gaming' },
    { patterns: ['store.steampowered.com'], site: 'Steam', category: 'gaming' },
    { patterns: ['poki.com'], site: 'Poki', category: 'gaming' },
    { patterns: ['khanacademy.org'], site: 'Khan Academy', category: 'educational' },
    { patterns: ['duolingo.com'], site: 'Duolingo', category: 'educational' },
    { patterns: ['wikipedia.org'], site: 'Wikipedia', category: 'educational' },
    { patterns: ['coursera.org'], site: 'Coursera', category: 'educational' },
    { patterns: ['docs.google.com'], site: 'Google Docs', category: 'productive' },
  ];
  for (const rule of rules) {
    if (rule.patterns.some(p => lower.includes(p))) return { site: rule.site, category: rule.category };
  }
  return { site: null, category: 'unknown' };
}

export default function BrowserMonitor() {
  const [windowData, setWindowData] = useState({ browsers: [] });
  const [openTabs, setOpenTabs] = useState([]);
  const [allEntries, setAllEntries] = useState([]);
  const [filter, setFilter] = useState('all'); // 'all' | 'danger' | 'caution' | 'safe'

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 6000);
    return () => clearInterval(interval);
  }, []);

  async function fetchData() {
    // 1. Window titles (Real-time active window)
    const winData = await ipcRenderer.invoke('check-browser-activity');
    setWindowData(winData);

    // 2. Open tabs from extension (if installed)
    try {
      const extData = await ipcRenderer.invoke('get-extension-tabs');
      const tabs = [];
      const seen = new Set();
      for (const [browser, bData] of Object.entries(extData)) {
        if (bData.tabs) {
          bData.tabs.forEach(t => {
            if (t.url && !seen.has(t.url)) {
              seen.add(t.url);
              tabs.push({ ...t, browser });
            }
          });
        }
      }
      setOpenTabs(tabs);
    } catch(e) {}

    // 3. Complete SQLite History (Last 30 mins)
    const { analyzed } = await ipcRenderer.invoke('scan-browser-history');
    if (analyzed && analyzed.length > 0) {
      const enriched = analyzed.map(e => ({
        ...e,
        ...classifyUrl(e.url, e.enrichedTitle || e.title),
        timestamp: new Date(e.lastVisit).toLocaleTimeString()
      }));
      enriched.sort((a, b) => b.lastVisit - a.lastVisit);
      setAllEntries(enriched);
    }
  }

  // Filter
  const filtered = filter === 'all' ? allEntries : allEntries.filter(t => t.safety === filter);

  // Counts
  const dangerCount = allEntries.filter(t => t.safety === 'danger').length;
  const cautionCount = allEntries.filter(t => t.safety === 'caution').length;
  const safeCount = allEntries.filter(t => t.safety === 'safe').length;

  const FILTER_TABS = [
    { key: 'all', label: `All (${allEntries.length})`, color: '#2c3e50' },
    { key: 'danger', label: `🚫 Danger (${dangerCount})`, color: '#e74c3c' },
    { key: 'caution', label: `⚠️ Caution (${cautionCount})`, color: '#f39c12' },
    { key: 'safe', label: `✅ Safe (${safeCount})`, color: '#27ae60' },
  ];

  return (
    <div style={{ maxWidth: 750, margin: '0 auto' }}>
      <h1 style={{ marginBottom: 5 }}>🌐 Browser Activity Monitor</h1>
      <p style={{ color: '#7f8c8d', marginTop: 0, fontSize: '0.85rem' }}>
        {allEntries.length > 0
          ? `${allEntries.length} URLs tracked (last 30 min) — Content analysis active`
          : '📡 Scanning...'}
      </p>

      {/* DANGER ALERT */}
      {dangerCount > 0 && (
        <div style={{
          background: 'linear-gradient(135deg, #e74c3c, #c0392b)',
          padding: 15, borderRadius: 10, color: 'white', marginBottom: 15,
          boxShadow: '0 4px 15px rgba(231,76,60,0.3)', cursor: 'pointer'
        }} onClick={() => setFilter('danger')}>
          <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>
            🚨 {dangerCount} Dangerous Content Detected! (click to view)
          </div>
        </div>
      )}

      {/* Safety summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 15 }}>
        {[
          { label: 'Danger', count: dangerCount, icon: '🚫', color: '#e74c3c', key: 'danger' },
          { label: 'Caution', count: cautionCount, icon: '⚠️', color: '#f39c12', key: 'caution' },
          { label: 'Safe', count: safeCount, icon: '✅', color: '#27ae60', key: 'safe' },
        ].map(s => (
          <div key={s.key} onClick={() => setFilter(s.key)}
            style={{
              background: filter === s.key ? s.color + '15' : '#fff',
              padding: 10, borderRadius: 8, textAlign: 'center', cursor: 'pointer',
              border: filter === s.key ? `2px solid ${s.color}` : '1px solid #eee',
              transition: 'all 0.2s'
            }}>
            <div style={{ fontSize: '1.3rem' }}>{s.icon}</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: s.color }}>{s.count}</div>
            <div style={{ fontSize: '0.65rem', color: '#95a5a6' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Active windows */}
      {windowData.browsers && windowData.browsers.length > 0 && (
        <div style={{ background: 'white', padding: 12, borderRadius: 10, marginBottom: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <h3 style={{ marginTop: 0, fontSize: '0.95rem' }}>👁 Active Right Now</h3>
          {windowData.browsers.map((tab, idx) => {
            const catStyle = CATEGORY_STYLES[tab.category] || CATEGORY_STYLES.unknown;
            return (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 6px', background: '#eaf2f8', borderRadius: 4, marginBottom: 3, borderLeft: `3px solid ${catStyle.color}` }}>
                <span>{catStyle.icon}</span>
                <div style={{ flex: 1, fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tab.pageTitle}</div>
                <span style={{ fontSize: '0.6rem', color: '#95a5a6' }}>{tab.browser}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Open Tabs (CDP + Extension) */}
      {openTabs.length > 0 && (
        <div style={{ background: 'white', padding: 12, borderRadius: 10, marginBottom: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <h3 style={{ marginTop: 0, fontSize: '0.95rem' }}>📑 All Open Tabs ({openTabs.length})</h3>
          <div style={{ maxHeight: 200, overflow: 'auto' }}>
            {openTabs.map((tab, idx) => {
              const catStyle = CATEGORY_STYLES[classifyUrl(tab.url, tab.title).category] || CATEGORY_STYLES.unknown;
              return (
                <div key={idx} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '4px 6px', background: tab.active ? '#eaf2f8' : '#f8f9fa',
                  borderRadius: 4, marginBottom: 3,
                  borderLeft: `3px solid ${catStyle.color}`
                }}>
                  <span style={{ fontSize: '0.8rem' }}>{tab.active ? '👁' : '💤'}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {tab.title || 'Untitled'}
                    </div>
                    <div style={{ fontSize: '0.65rem', color: '#bdc3c7', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {tab.url}
                    </div>
                  </div>
                  <span style={{ fontSize: '0.6rem', color: '#95a5a6', whiteSpace: 'nowrap' }}>{tab.browser}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* FILTER TABS */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 0, background: '#ecf0f1', borderRadius: '8px 8px 0 0', overflow: 'hidden' }}>
        {FILTER_TABS.map(tab => (
          <div key={tab.key} onClick={() => setFilter(tab.key)}
            style={{
              flex: 1, padding: '10px 8px', textAlign: 'center', cursor: 'pointer',
              fontSize: '0.75rem', fontWeight: filter === tab.key ? 'bold' : 'normal',
              background: filter === tab.key ? 'white' : 'transparent',
              color: filter === tab.key ? tab.color : '#7f8c8d',
              borderBottom: filter === tab.key ? `3px solid ${tab.color}` : '3px solid transparent',
              transition: 'all 0.2s'
            }}>
            {tab.label}
          </div>
        ))}
      </div>

      {/* HISTORY LIST */}
      <div style={{ background: 'white', padding: 15, borderRadius: '0 0 10px 10px', marginBottom: 15, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', minHeight: 100 }}>
        {filtered.length === 0 ? (
          <p style={{ color: '#bdc3c7', textAlign: 'center', fontSize: '0.9rem' }}>
            {allEntries.length === 0 ? 'Waiting for data...' : `No ${filter} content found`}
          </p>
        ) : (
          <div style={{ maxHeight: 450, overflow: 'auto' }}>
            {filtered.map((tab, idx) => {
              const catStyle = CATEGORY_STYLES[tab.category] || CATEGORY_STYLES.unknown;
              const safetyBg = tab.safety === 'danger' ? '#fdedec' : tab.safety === 'caution' ? '#fef9e7' : '#f8f9fa';
              const safetyBorder = tab.safety === 'danger' ? '#e74c3c' : tab.safety === 'caution' ? '#f39c12' : '#27ae60';
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
                    <div style={{ fontSize: '0.65rem', color: '#aab7b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {tab.url}
                    </div>
                    <div style={{ fontSize: '0.6rem', color: '#bdc3c7' }}>
                      {tab.browser} {tab.profile && tab.profile !== 'Default' ? `(${tab.profile})` : ''} • {tab.site ? `${tab.site} • ` : ''}{tab.timestamp} • {tab.visitCount}x
                    </div>
                    {tab.flags && tab.flags.length > 0 && (
                      <div style={{ fontSize: '0.65rem', marginTop: 2, color: tab.safety === 'danger' ? '#c0392b' : '#e67e22' }}>
                        {tab.flags.join(' • ')}
                      </div>
                    )}
                  </div>
                  <span style={{ fontSize: '0.55rem', padding: '1px 4px', background: catStyle.bg, color: catStyle.color, borderRadius: 3, fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                    {catStyle.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
