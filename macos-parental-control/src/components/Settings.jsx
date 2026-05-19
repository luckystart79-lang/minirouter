import React, { useState } from 'react';

const AVAILABLE_APPS = [
  { id: 'roblox', name: 'Roblox' },
  { id: 'steam', name: 'Steam' },
  { id: 'chrome', name: 'Google Chrome' },
  { id: 'safari', name: 'Safari (Mac)' },
  { id: 'minecraft', name: 'Minecraft' }
];

export default function Settings({ blockedApps, setBlockedApps }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const handleLogin = (e) => {
    e.preventDefault();
    if (pin === '1234') {
      setIsAuthenticated(true);
      setError('');
    } else {
      setError('Incorrect PIN. Hint: 1234');
      setPin('');
    }
  };

  const handleToggleApp = (appId) => {
    if (blockedApps.includes(appId)) {
      setBlockedApps(blockedApps.filter(id => id !== appId));
    } else {
      setBlockedApps([...blockedApps, appId]);
    }
  };

  if (!isAuthenticated) {
    return (
      <div style={{ maxWidth: 400, margin: '50px auto', background: 'white', padding: 30, borderRadius: 10 }}>
        <h2>Parental Lock</h2>
        <p>Enter PIN to configure app restrictions.</p>
        <form onSubmit={handleLogin}>
          <input 
            type="password" 
            value={pin} 
            onChange={e => setPin(e.target.value)}
            placeholder="Enter PIN (1234)"
            style={{ width: '100%', padding: 10, marginBottom: 10 }}
          />
          {error && <div style={{ color: 'red', marginBottom: 10 }}>{error}</div>}
          <button style={{ width: '100%', padding: 10, background: '#34495e', color: 'white', border: 'none' }}>
            Unlock Settings
          </button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ background: 'white', padding: 30, borderRadius: 10 }}>
      <h2>Restricted Applications</h2>
      <p>Select the applications that should consume the daily time quota and be blocked when time runs out.</p>
      
      <div style={{ marginTop: 20 }}>
        {AVAILABLE_APPS.map(app => (
          <div key={app.id} style={{ display: 'flex', alignItems: 'center', marginBottom: 15 }}>
            <input 
              type="checkbox" 
              id={`chk-${app.id}`}
              checked={blockedApps.includes(app.id)}
              onChange={() => handleToggleApp(app.id)}
              style={{ width: 20, height: 20, marginRight: 15 }}
            />
            <label htmlFor={`chk-${app.id}`} style={{ fontSize: '1.1rem', cursor: 'pointer' }}>
              {app.name}
            </label>
          </div>
        ))}
      </div>

      <button 
        onClick={() => setIsAuthenticated(false)}
        style={{ marginTop: 30, padding: '10px 20px', background: '#e74c3c', color: 'white', border: 'none', borderRadius: 5 }}
      >
        Lock Settings
      </button>
    </div>
  );
}
