import React from 'react';

export default function Dashboard({ quota, blockedApps }) {
  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const isBlocked = quota <= 0;
  const totalQuota = 120 * 60;
  const usedTime = totalQuota - Math.min(quota, totalQuota);
  const usedPct = Math.min(100, (usedTime / totalQuota) * 100);

  return (
    <div style={{ maxWidth: 700, margin: '0 auto' }}>
      <h1 style={{ marginBottom: 5 }}>🖥 Activity Dashboard</h1>
      <p style={{ color: '#7f8c8d', marginTop: 0 }}>Real-time monitoring of entertainment usage</p>

      {/* Main Quota Card */}
      <div style={{
        background: isBlocked
          ? 'linear-gradient(135deg, #e74c3c, #c0392b)'
          : 'linear-gradient(135deg, #2ecc71, #27ae60)',
        padding: 30,
        borderRadius: 12,
        color: 'white',
        textAlign: 'center',
        marginBottom: 20,
        boxShadow: '0 4px 15px rgba(0,0,0,0.15)'
      }}>
        <div style={{ fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: 2, opacity: 0.9 }}>
          Remaining Entertainment Quota
        </div>
        <div style={{ fontSize: '4rem', fontWeight: 'bold', margin: '10px 0', fontFamily: 'monospace' }}>
          {formatTime(quota)}
        </div>
        {isBlocked && (
          <div style={{ fontSize: '1rem', background: 'rgba(0,0,0,0.2)', padding: '8px 15px', borderRadius: 5, display: 'inline-block' }}>
            🚫 All restricted apps are BLOCKED — Go study to earn more time!
          </div>
        )}
        {!isBlocked && quota > 0 && quota < 30 * 60 && (
          <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>
            ⚠️ Less than 30 minutes remaining!
          </div>
        )}
      </div>

      {/* Usage Bar */}
      <div style={{ background: 'white', padding: 20, borderRadius: 10, marginBottom: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontWeight: 'bold' }}>Daily Usage</span>
          <span style={{ color: '#7f8c8d' }}>{formatTime(usedTime)} / {formatTime(totalQuota)}</span>
        </div>
        <div style={{ width: '100%', background: '#ecf0f1', height: 14, borderRadius: 7, overflow: 'hidden' }}>
          <div style={{
            width: `${usedPct}%`,
            background: usedPct > 80 ? '#e74c3c' : usedPct > 50 ? '#f39c12' : '#3498db',
            height: '100%',
            transition: 'width 0.5s ease'
          }} />
        </div>
      </div>

      {/* Info Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15 }}>
        <div style={{ background: 'white', padding: 20, borderRadius: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <div style={{ color: '#7f8c8d', fontSize: '0.85rem', marginBottom: 5 }}>🎮 Monitored Apps</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#2c3e50' }}>
            {blockedApps ? blockedApps.length : 0}
          </div>
          <div style={{ color: '#95a5a6', fontSize: '0.8rem' }}>apps being tracked</div>
        </div>
        <div style={{ background: 'white', padding: 20, borderRadius: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <div style={{ color: '#7f8c8d', fontSize: '0.85rem', marginBottom: 5 }}>💰 Earn More Time</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#27ae60' }}>+10 min</div>
          <div style={{ color: '#95a5a6', fontSize: '0.8rem' }}>per 60 min of studying</div>
        </div>
      </div>

      {/* Status */}
      <div style={{ background: 'white', padding: 20, borderRadius: 10, marginTop: 15, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
        <div style={{ fontWeight: 'bold', marginBottom: 10 }}>System Status</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#2ecc71', display: 'inline-block' }} />
          <span>Activity Monitor: Running (5s polling)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
          <span style={{
            width: 10, height: 10, borderRadius: '50%',
            background: isBlocked ? '#e74c3c' : '#2ecc71',
            display: 'inline-block'
          }} />
          <span>App Blocker: {isBlocked ? 'ACTIVE — Blocking apps' : 'Standby'}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#3498db', display: 'inline-block' }} />
          <span>Data Persistence: Saved to disk</span>
        </div>
      </div>
    </div>
  );
}
