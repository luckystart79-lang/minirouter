import React, { useState, useEffect } from 'react';

export default function Learning({ onEarnBonus }) {
  const [studyTime, setStudyTime] = useState(0);
  const [isStudying, setIsStudying] = useState(false);
  
  // Requirement: 60 minutes (Changed to 10 seconds for testing)
  const REQUIRED_TIME = 10; 

  useEffect(() => {
    let interval;
    if (isStudying) {
      interval = setInterval(() => {
        setStudyTime(prev => {
          const newTime = prev + 1;
          if (newTime >= REQUIRED_TIME) {
            // Reward 10 minutes (600 seconds)
            onEarnBonus(600);
            setIsStudying(false);
            alert("Congratulations! You earned 10 minutes of bonus time.");
            return 0; // Reset for next session
          }
          return newTime;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isStudying, onEarnBonus]);

  return (
    <div>
      <h1>English Learning Module</h1>
      
      <div style={{ background: 'white', padding: '20px', borderRadius: '10px' }}>
        <h3>Session Progress: {Math.floor(studyTime / 60)} / 60 minutes</h3>
        
        <div style={{ width: '100%', background: '#eee', height: '20px', borderRadius: '10px', overflow: 'hidden' }}>
          <div style={{ 
            width: `${(studyTime / REQUIRED_TIME) * 100}%`, 
            background: '#3498db', 
            height: '100%' 
          }}></div>
        </div>
        
        <div style={{ marginTop: '20px' }}>
          <button 
            onClick={() => setIsStudying(!isStudying)}
            style={{ 
              padding: '10px 20px', 
              background: isStudying ? '#e67e22' : '#3498db',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            {isStudying ? 'Pause Studying' : 'Start Studying'}
          </button>
        </div>

        <hr style={{ margin: '30px 0' }} />

        {/* Dummy Quiz UI */}
        <div>
          <h4>Lesson 1: Daily Conversation (Audio)</h4>
          <button style={{ padding: '8px 15px', marginBottom: '20px' }}>▶ Play Audio</button>
          
          <div style={{ background: '#f9f9f9', padding: '15px', borderRadius: '5px' }}>
            <p><strong>Quiz:</strong> What is the main topic of the conversation?</p>
            <div><label><input type="radio" name="q1" /> A) Weather</label></div>
            <div><label><input type="radio" name="q1" /> B) School</label></div>
            <div><label><input type="radio" name="q1" /> C) Food</label></div>
          </div>
        </div>
      </div>
    </div>
  );
}
