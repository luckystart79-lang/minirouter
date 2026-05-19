import React from 'react';

export default function Dashboard({ quota }) {
  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const isBlocked = quota <= 0;

  return (
    <div>
      <h1>Activity Dashboard</h1>
      <div style={{ 
        background: 'white', 
        padding: '30px', 
        borderRadius: '10px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        textAlign: 'center'
      }}>
        <h2 style={{ color: '#7f8c8d' }}>Remaining Entertainment Quota</h2>
        <div style={{ 
          fontSize: '4rem', 
          fontWeight: 'bold', 
          color: isBlocked ? '#e74c3c' : '#2ecc71',
          margin: '20px 0'
        }}>
          {formatTime(quota)}
        </div>
        
        {isBlocked && (
          <div style={{ color: '#e74c3c', fontSize: '1.2rem', fontWeight: 'bold' }}>
            Time is up! All games and YouTube are blocked. <br/>
            Go to the Learning Module to earn more time.
          </div>
        )}
      </div>
    </div>
  );
}
