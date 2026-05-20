import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import Learning from './components/Learning';
import Settings from './components/Settings';
const { ipcRenderer } = window.require('electron');

const BASE_QUOTA = 120 * 60; // 2 hours

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [quota, setQuota] = useState(null);
  const [lastResetDate, setLastResetDate] = useState(null);
  const [blockedApps, setBlockedApps] = useState(['roblox', 'steam', 'chrome', 'safari']);
  const [showQuitDialog, setShowQuitDialog] = useState(false);
  const [quitPin, setQuitPin] = useState('');
  const [quitError, setQuitError] = useState('');

  // Load config on startup
  useEffect(() => {
    ipcRenderer.invoke('get-config').then((config) => {
      const today = new Date().toDateString();
      if (config.blockedApps) {
        setBlockedApps(config.blockedApps);
      }
      if (config.lastResetDate !== today) {
        setQuota(BASE_QUOTA);
        setLastResetDate(today);
      } else {
        setQuota(config.quota);
        setLastResetDate(config.lastResetDate);
      }
    });
  }, []);

  // Save config whenever state changes
  useEffect(() => {
    if (quota !== null && lastResetDate !== null) {
      ipcRenderer.invoke('save-config', { quota, lastResetDate, blockedApps });
    }
  }, [quota, lastResetDate, blockedApps]);

  // Monitoring Logic
  useEffect(() => {
    if (quota === null) return;

    const interval = setInterval(async () => {
      const apps = await ipcRenderer.invoke('check-active-apps', blockedApps);
      
      if (apps.length > 0 && quota > 0) {
        setQuota(q => Math.max(0, q - 5)); 
      }
      
      if (apps.length > 0 && quota <= 0) {
        await ipcRenderer.invoke('kill-apps', apps);
      }
    }, 5000); 
    
    return () => clearInterval(interval);
  }, [quota, blockedApps]);

  const addBonusTime = (seconds) => {
    setQuota(q => q + seconds);
  };

  const handleQuit = async (e) => {
    e.preventDefault();
    const ok = await ipcRenderer.invoke('quit-app', quitPin);
    if (!ok) {
      setQuitError('Wrong PIN. Access denied.');
      setQuitPin('');
    }
  };

  if (quota === null) return <div style={{ padding: 40 }}>Loading system configs...</div>;

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      {/* Sidebar */}
      <div style={{ width: '200px', background: '#2c3e50', color: 'white', padding: '20px', display: 'flex', flexDirection: 'column' }}>
        <h2 style={{ marginTop: 0 }}>Menu</h2>
        <div 
          onClick={() => setActiveTab('dashboard')}
          style={{ padding: '10px', cursor: 'pointer', borderRadius: 5, background: activeTab === 'dashboard' ? '#34495e' : 'transparent', marginBottom: 4 }}
        >🖥 Dashboard</div>
        <div 
          onClick={() => setActiveTab('learning')}
          style={{ padding: '10px', cursor: 'pointer', borderRadius: 5, background: activeTab === 'learning' ? '#34495e' : 'transparent', marginBottom: 4 }}
        >📚 Learning</div>
        <div 
          onClick={() => setActiveTab('settings')}
          style={{ padding: '10px', cursor: 'pointer', borderRadius: 5, background: activeTab === 'settings' ? '#34495e' : 'transparent', marginBottom: 4 }}
        >⚙️ Settings</div>

        <div style={{ flex: 1 }} />

        <div 
          onClick={() => { setShowQuitDialog(true); setQuitPin(''); setQuitError(''); }}
          style={{ padding: '10px', cursor: 'pointer', borderRadius: 5, background: '#c0392b', textAlign: 'center', fontWeight: 'bold', marginTop: 10 }}
        >🔒 Quit App</div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, padding: '20px', background: '#ecf0f1', overflow: 'auto' }}>
        {activeTab === 'dashboard' && <Dashboard quota={quota} blockedApps={blockedApps} />}
        {activeTab === 'learning' && <Learning onEarnBonus={addBonusTime} />}
        {activeTab === 'settings' && <Settings blockedApps={blockedApps} setBlockedApps={setBlockedApps} />}
      </div>

      {/* Quit PIN Dialog (modal overlay) */}
      {showQuitDialog && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999
        }}>
          <div style={{ background: 'white', padding: 30, borderRadius: 10, width: 350, textAlign: 'center' }}>
            <h3 style={{ marginTop: 0 }}>🔐 Parent Verification</h3>
            <p style={{ color: '#7f8c8d' }}>Enter parent PIN to quit the application.</p>
            <form onSubmit={handleQuit}>
              <input
                type="password"
                value={quitPin}
                onChange={e => setQuitPin(e.target.value)}
                placeholder="Enter PIN"
                autoFocus
                style={{ width: '100%', padding: 10, marginBottom: 10, boxSizing: 'border-box', fontSize: '1.1rem', textAlign: 'center', letterSpacing: 8 }}
              />
              {quitError && <div style={{ color: '#e74c3c', marginBottom: 10, fontWeight: 'bold' }}>{quitError}</div>}
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowQuitDialog(false)}
                  style={{ flex: 1, padding: 10, background: '#bdc3c7', border: 'none', borderRadius: 5, cursor: 'pointer' }}
                >Cancel</button>
                <button
                  type="submit"
                  style={{ flex: 1, padding: 10, background: '#e74c3c', color: 'white', border: 'none', borderRadius: 5, cursor: 'pointer', fontWeight: 'bold' }}
                >Quit</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
