import React, { useState, useEffect } from 'react';
const { ipcRenderer } = window.require('electron');

const CATEGORY_STYLES = {
  educational: { bg: '#d5f5e3', color: '#1e8449', icon: '📗', label: 'Educational' },
  entertainment: { bg: '#fadbd8', color: '#c0392b', icon: '🎮', label: 'Entertainment' },
  mixed: { bg: '#fdebd0', color: '#d35400', icon: '⚠️', label: 'Mixed' },
  unknown: { bg: '#eaecee', color: '#566573', icon: '❓', label: 'Unclassified' }
};

export default function YouTubeMonitor() {
  const [youtubeData, setYoutubeData] = useState({ isWatchingYouTube: false, tabs: [] });
  const [history, setHistory] = useState([]);

  useEffect(() => {
    const interval = setInterval(async () => {
      const data = await ipcRenderer.invoke('check-youtube-activity');
      setYoutubeData(data);

      // Log new YouTube tabs into history
      if (data.tabs.length > 0) {
        setHistory(prev => {
          const newEntries = data.tabs
            .filter(tab => !prev.some(h => h.fullTitle === tab.fullTitle))
            .map(tab => ({ ...tab, timestamp: new Date().toLocaleTimeString() }));
          return [...newEntries, ...prev].slice(0, 50); // Keep last 50 entries
        });
      }
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const entertainmentCount = history.filter(h => h.category === 'entertainment').length;
  const educationalCount = history.filter(h => h.category === 'educational').length;

  return (
    <div style={{ maxWidth: 700, margin: '0 auto' }}>
      <h1 style={{ marginBottom: 5 }}>📺 YouTube Monitor</h1>
      <p style={{ color: '#7f8c8d', marginTop: 0 }}>Real-time detection of YouTube content via browser window titles</p>

      {/* Live Status */}
      <div style={{
        background: youtubeData.isWatchingYouTube
          ? 'linear-gradient(135deg, #e74c3c, #c0392b)'
          : 'linear-gradient(135deg, #2ecc71, #27ae60)',
        padding: 20,
        borderRadius: 10,
        color: 'white',
        marginBottom: 20,
        boxShadow: '0 4px 15px rgba(0,0,0,0.15)'
      }}>
        <div style={{ fontSize: '1.3rem', fontWeight: 'bold' }}>
          {youtubeData.isWatchingYouTube
            ? `🔴 LIVE — Watching YouTube (${youtubeData.tabs.length} tab${youtubeData.tabs.length > 1 ? 's' : ''})`
            : '🟢 Not watching YouTube'}
        </div>
      </div>

      {/* Currently Playing */}
      {youtubeData.tabs.length > 0 && (
        <div style={{ background: 'white', padding: 20, borderRadius: 10, marginBottom: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <h3 style={{ marginTop: 0 }}>🎬 Currently Playing</h3>
          {youtubeData.tabs.map((tab, idx) => {
            const style = CATEGORY_STYLES[tab.category];
            return (
              <div key={idx} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: 12, marginBottom: 8,
                background: '#f8f9fa', borderRadius: 8,
                borderLeft: `4px solid ${style.color}`
              }}>
                <span style={{ fontSize: '1.5rem' }}>{style.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{tab.videoTitle}</div>
                  <span style={{
                    fontSize: '0.75rem', padding: '2px 8px',
                    background: style.bg, color: style.color,
                    borderRadius: 3, fontWeight: 'bold'
                  }}>{style.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 15, marginBottom: 20 }}>
        <div style={{ background: 'white', padding: 15, borderRadius: 10, textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#2c3e50' }}>{history.length}</div>
          <div style={{ color: '#7f8c8d', fontSize: '0.85rem' }}>Total Detected</div>
        </div>
        <div style={{ background: 'white', padding: 15, borderRadius: 10, textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#e74c3c' }}>{entertainmentCount}</div>
          <div style={{ color: '#7f8c8d', fontSize: '0.85rem' }}>🎮 Entertainment</div>
        </div>
        <div style={{ background: 'white', padding: 15, borderRadius: 10, textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#27ae60' }}>{educationalCount}</div>
          <div style={{ color: '#7f8c8d', fontSize: '0.85rem' }}>📗 Educational</div>
        </div>
      </div>

      {/* History Log */}
      <div style={{ background: 'white', padding: 20, borderRadius: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
        <h3 style={{ marginTop: 0 }}>📋 Watch History (Today)</h3>
        {history.length === 0 ? (
          <p style={{ color: '#95a5a6' }}>No YouTube activity detected yet. Scanning every 5 seconds...</p>
        ) : (
          <div style={{ maxHeight: 300, overflow: 'auto' }}>
            {history.map((entry, idx) => {
              const style = CATEGORY_STYLES[entry.category];
              return (
                <div key={idx} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 0',
                  borderBottom: '1px solid #f0f0f0'
                }}>
                  <span style={{ fontSize: '1.2rem' }}>{style.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.9rem' }}>{entry.videoTitle}</div>
                    <div style={{ fontSize: '0.75rem', color: '#95a5a6' }}>{entry.timestamp}</div>
                  </div>
                  <span style={{
                    fontSize: '0.7rem', padding: '2px 6px',
                    background: style.bg, color: style.color,
                    borderRadius: 3
                  }}>{style.label}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
