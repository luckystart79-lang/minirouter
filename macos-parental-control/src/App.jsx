import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import Learning from './components/Learning';
import Settings from './components/Settings';
const { ipcRenderer } = window.require('electron');

const BASE_QUOTA = 120 * 60; // 2 hours

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [quota, setQuota] = useState(null); // null means loading
  const [lastResetDate, setLastResetDate] = useState(null);
  const [blockedApps, setBlockedApps] = useState(['roblox', 'steam', 'chrome', 'safari']);

  // Load config on startup
  useEffect(() => {
    ipcRenderer.invoke('get-config').then((config) => {
      const today = new Date().toDateString();
      if (config.blockedApps) {
        setBlockedApps(config.blockedApps);
      }
      if (config.lastResetDate !== today) {
        // New day, reset quota
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

  if (quota === null) return <div style={{ padding: 40 }}>Loading system configs...</div>;

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <div style={{ width: '200px', background: '#2c3e50', color: 'white', padding: '20px' }}>
        <h2>Menu</h2>
        <div 
          onClick={() => setActiveTab('dashboard')}
          style={{ padding: '10px', cursor: 'pointer', background: activeTab === 'dashboard' ? '#34495e' : 'transparent' }}
        >Dashboard</div>
        <div 
          onClick={() => setActiveTab('learning')}
          style={{ padding: '10px', cursor: 'pointer', background: activeTab === 'learning' ? '#34495e' : 'transparent' }}
        >Learning Module</div>
        <div 
          onClick={() => setActiveTab('settings')}
          style={{ padding: '10px', cursor: 'pointer', background: activeTab === 'settings' ? '#34495e' : 'transparent', marginTop: 'auto' }}
        >⚙️ Settings</div>
      </div>

      <div style={{ flex: 1, padding: '20px', background: '#ecf0f1' }}>
        {activeTab === 'dashboard' && <Dashboard quota={quota} blockedApps={blockedApps} />}
        {activeTab === 'learning' && <Learning onEarnBonus={addBonusTime} />}
        {activeTab === 'settings' && <Settings blockedApps={blockedApps} setBlockedApps={setBlockedApps} />}
      </div>
    </div>
  );
}
