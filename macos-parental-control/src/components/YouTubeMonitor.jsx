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

export default function BrowserMonitor() {
  const [data, setData] = useState({ browsers: [], hasYouTubeStream: false });
  const [history, setHistory] = useState([]);

  useEffect(() => {
    // Initial fetch
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  async function fetchData() {
    const result = await ipcRenderer.invoke('check-browser-activity');
    setData(result);

    // Log unique entries into history
    if (result.browsers.length > 0) {
      setHistory(prev => {
        const newEntries = result.browsers
          .filter(tab => !prev.some(h => h.fullTitle === tab.fullTitle))
          .map(tab => ({ ...tab, timestamp: new Date().toLocaleTimeString() }));
        return [...newEntries, ...prev].slice(0, 100);
      });
    }
  }

  // Group current tabs by browser
  const byBrowser = {};
  data.browsers.forEach(tab => {
    if (!byBrowser[tab.browser]) byBrowser[tab.browser] = [];
    byBrowser[tab.browser].push(tab);
  });

  // Count categories
  const categoryCounts = {};
  history.forEach(h => {
    categoryCounts[h.category] = (categoryCounts[h.category] || 0) + 1;
  });

  const dangerCount = history.filter(h => ['entertainment', 'gaming', 'social'].includes(h.category)).length;

  return (
    <div style={{ maxWidth: 750, margin: '0 auto' }}>
      <h1 style={{ marginBottom: 5 }}>🌐 Browser Activity Monitor</h1>
      <p style={{ color: '#7f8c8d', marginTop: 0 }}>Real-time scan of ALL browsers, tabs, and web content</p>

      {/* Live Status */}
      <div style={{
        background: data.browsers.length > 0
          ? 'linear-gradient(135deg, #3498db, #2c3e50)'
          : 'linear-gradient(135deg, #95a5a6, #7f8c8d)',
        padding: 20, borderRadius: 10, color: 'white', marginBottom: 20,
        boxShadow: '0 4px 15px rgba(0,0,0,0.15)'
      }}>
        <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
          {data.browsers.length > 0
            ? `🔍 ${Object.keys(byBrowser).length} browser(s) active — ${data.browsers.length} tab(s) detected`
            : '😴 No browser activity detected'}
        </div>
        {data.hasYouTubeStream && (
          <div style={{ marginTop: 8, fontSize: '0.85rem', background: 'rgba(231,76,60,0.3)', padding: '5px 10px', borderRadius: 5, display: 'inline-block' }}>
            🔊 YouTube network stream detected (may be playing in background)
          </div>
        )}
      </div>

      {/* Limitation note */}
      <div style={{ background: '#fef9e7', border: '1px solid #f9e79f', padding: '8px 12px', borderRadius: 6, marginBottom: 15, fontSize: '0.8rem', color: '#7d6608' }}>
        ⚠️ <strong>Note:</strong> Only the <em>active tab</em> per browser window is visible. Hidden tabs require a Browser Extension (Phase 2).
      </div>

      {/* Active Browsers with Tabs */}
      {Object.keys(byBrowser).length > 0 && (
        <div style={{ marginBottom: 20 }}>
          {Object.entries(byBrowser).map(([browser, tabs]) => (
            <div key={browser} style={{ background: 'white', padding: 15, borderRadius: 10, marginBottom: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
              <div style={{ fontWeight: 'bold', fontSize: '1rem', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '1.3rem' }}>🌍</span>
                {browser}
                <span style={{ fontSize: '0.8rem', color: '#95a5a6', fontWeight: 'normal' }}>({tabs.length} tab{tabs.length > 1 ? 's' : ''})</span>
              </div>
              {tabs.map((tab, idx) => {
                const catStyle = CATEGORY_STYLES[tab.category] || CATEGORY_STYLES.unknown;
                return (
                  <div key={idx} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 10px', marginBottom: 4,
                    background: '#f8f9fa', borderRadius: 6,
                    borderLeft: `3px solid ${catStyle.color}`
                  }}>
                    <span style={{ fontSize: '1.1rem' }}>{catStyle.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {tab.pageTitle}
                      </div>
                      {tab.site && (
                        <span style={{ fontSize: '0.7rem', color: '#95a5a6' }}>{tab.site}</span>
                      )}
                    </div>
                    <span style={{
                      fontSize: '0.65rem', padding: '2px 6px', whiteSpace: 'nowrap',
                      background: catStyle.bg, color: catStyle.color,
                      borderRadius: 3, fontWeight: 'bold'
                    }}>{catStyle.label}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* Category Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
        {['entertainment', 'gaming', 'social', 'educational'].map(cat => {
          const style = CATEGORY_STYLES[cat];
          return (
            <div key={cat} style={{ background: 'white', padding: 12, borderRadius: 8, textAlign: 'center', boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize: '1.5rem' }}>{style.icon}</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: style.color }}>{categoryCounts[cat] || 0}</div>
              <div style={{ fontSize: '0.7rem', color: '#95a5a6' }}>{style.label}</div>
            </div>
          );
        })}
      </div>

      {/* History Log */}
      <div style={{ background: 'white', padding: 20, borderRadius: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
        <h3 style={{ marginTop: 0 }}>📋 Browsing History (Session)</h3>
        {history.length === 0 ? (
          <p style={{ color: '#95a5a6' }}>No browser activity recorded yet. Scanning every 5 seconds...</p>
        ) : (
          <div style={{ maxHeight: 300, overflow: 'auto' }}>
            {history.map((entry, idx) => {
              const catStyle = CATEGORY_STYLES[entry.category] || CATEGORY_STYLES.unknown;
              return (
                <div key={idx} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 0', borderBottom: '1px solid #f5f5f5'
                }}>
                  <span>{catStyle.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {entry.pageTitle}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#bdc3c7' }}>
                      {entry.browser} {entry.site ? `• ${entry.site}` : ''} • {entry.timestamp}
                    </div>
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
      </div>
    </div>
  );
}
