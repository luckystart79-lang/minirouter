import React, { useState, useEffect, useRef } from 'react';
import quizData from '../data/quizzes.json';

export default function Learning({ onEarnBonus }) {
  const [studyTime, setStudyTime] = useState(0);
  const [isStudying, setIsStudying] = useState(false);
  const [currentLessonIdx, setCurrentLessonIdx] = useState(0);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [totalAnswered, setTotalAnswered] = useState(0);
  const [lessonComplete, setLessonComplete] = useState(false);

  const REQUIRED_TIME = 60 * 60; // 60 minutes
  const BONUS_SECONDS = 10 * 60; // 10 minutes bonus

  const lesson = quizData.lessons[currentLessonIdx];
  const question = lesson?.questions[currentQuestionIdx];

  // Study timer
  useEffect(() => {
    let interval;
    if (isStudying) {
      interval = setInterval(() => {
        setStudyTime(prev => {
          const newTime = prev + 1;
          if (newTime >= REQUIRED_TIME) {
            onEarnBonus(BONUS_SECONDS);
            setIsStudying(false);
            return 0;
          }
          return newTime;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isStudying, onEarnBonus]);

  const handleAnswer = (optionIdx) => {
    if (isAnswered) return;
    setSelectedAnswer(optionIdx);
    setIsAnswered(true);
    setTotalAnswered(t => t + 1);
    if (optionIdx === question.correctIndex) {
      setScore(s => s + 1);
    }
  };

  const handleNext = () => {
    if (currentQuestionIdx < lesson.questions.length - 1) {
      setCurrentQuestionIdx(q => q + 1);
    } else {
      setLessonComplete(true);
    }
    setSelectedAnswer(null);
    setIsAnswered(false);
  };

  const handleNextLesson = () => {
    const nextIdx = (currentLessonIdx + 1) % quizData.lessons.length;
    setCurrentLessonIdx(nextIdx);
    setCurrentQuestionIdx(0);
    setSelectedAnswer(null);
    setIsAnswered(false);
    setScore(0);
    setTotalAnswered(0);
    setLessonComplete(false);
  };

  const formatTime = (s) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = Math.floor(s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  const progressPct = (studyTime / REQUIRED_TIME) * 100;

  return (
    <div style={{ maxWidth: 700, margin: '0 auto' }}>
      <h1 style={{ marginBottom: 5 }}>📚 English Learning Module</h1>
      <p style={{ color: '#7f8c8d', marginTop: 0 }}>Study for 60 minutes to earn 10 minutes of bonus play time!</p>

      {/* Timer & Progress */}
      <div style={{ background: 'white', padding: 20, borderRadius: 10, marginBottom: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>
            ⏱ Session: {formatTime(studyTime)} / 60:00
          </span>
          <button
            onClick={() => setIsStudying(!isStudying)}
            style={{
              padding: '8px 20px',
              background: isStudying ? '#e67e22' : '#27ae60',
              color: 'white',
              border: 'none',
              borderRadius: 5,
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            {isStudying ? '⏸ Pause' : '▶ Start Studying'}
          </button>
        </div>
        <div style={{ width: '100%', background: '#ecf0f1', height: 12, borderRadius: 6, overflow: 'hidden' }}>
          <div style={{
            width: `${progressPct}%`,
            background: 'linear-gradient(90deg, #2ecc71, #27ae60)',
            height: '100%',
            transition: 'width 0.5s ease'
          }} />
        </div>
      </div>

      {/* Lesson Selector */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {quizData.lessons.map((l, idx) => (
          <button
            key={l.id}
            onClick={() => {
              setCurrentLessonIdx(idx);
              setCurrentQuestionIdx(0);
              setSelectedAnswer(null);
              setIsAnswered(false);
              setScore(0);
              setTotalAnswered(0);
              setLessonComplete(false);
            }}
            style={{
              padding: '6px 14px',
              background: idx === currentLessonIdx ? '#2c3e50' : '#bdc3c7',
              color: idx === currentLessonIdx ? 'white' : '#2c3e50',
              border: 'none',
              borderRadius: 5,
              cursor: 'pointer',
              fontWeight: idx === currentLessonIdx ? 'bold' : 'normal'
            }}
          >
            Lesson {l.id}
          </button>
        ))}
      </div>

      {/* Lesson Content */}
      <div style={{ background: 'white', padding: 25, borderRadius: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
        <h2 style={{ marginTop: 0 }}>📖 {lesson.title}</h2>
        <p style={{ color: '#7f8c8d' }}>{lesson.description}</p>

        {lessonComplete ? (
          <div style={{ textAlign: 'center', padding: 30 }}>
            <div style={{ fontSize: '3rem', marginBottom: 10 }}>🎉</div>
            <h3>Lesson Complete!</h3>
            <p style={{ fontSize: '1.3rem' }}>
              Score: <strong>{score}</strong> / {lesson.questions.length}
              {score === lesson.questions.length && ' — Perfect! 🌟'}
            </p>
            <button
              onClick={handleNextLesson}
              style={{
                padding: '10px 25px',
                background: '#3498db',
                color: 'white',
                border: 'none',
                borderRadius: 5,
                cursor: 'pointer',
                marginTop: 15,
                fontWeight: 'bold'
              }}
            >
              Next Lesson →
            </button>
          </div>
        ) : (
          <>
            {/* Question progress */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 15, color: '#95a5a6', fontSize: '0.9rem' }}>
              <span>Question {currentQuestionIdx + 1} of {lesson.questions.length}</span>
              <span>Score: {score}/{totalAnswered}</span>
            </div>

            {/* Question */}
            <div style={{ background: '#f8f9fa', padding: 20, borderRadius: 8, marginBottom: 15 }}>
              <p style={{ fontWeight: 'bold', fontSize: '1.1rem', marginTop: 0 }}>{question.text}</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {question.options.map((option, idx) => {
                  let bg = '#fff';
                  let border = '2px solid #ddd';
                  let color = '#2c3e50';

                  if (isAnswered) {
                    if (idx === question.correctIndex) {
                      bg = '#d5f5e3'; border = '2px solid #27ae60'; color = '#1e8449';
                    } else if (idx === selectedAnswer && idx !== question.correctIndex) {
                      bg = '#fadbd8'; border = '2px solid #e74c3c'; color = '#c0392b';
                    }
                  } else if (idx === selectedAnswer) {
                    bg = '#ebf5fb'; border = '2px solid #3498db';
                  }

                  return (
                    <div
                      key={idx}
                      onClick={() => handleAnswer(idx)}
                      style={{
                        padding: '12px 16px',
                        background: bg,
                        border,
                        borderRadius: 8,
                        cursor: isAnswered ? 'default' : 'pointer',
                        color,
                        fontWeight: isAnswered && idx === question.correctIndex ? 'bold' : 'normal',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      {String.fromCharCode(65 + idx)}) {option}
                      {isAnswered && idx === question.correctIndex && ' ✅'}
                      {isAnswered && idx === selectedAnswer && idx !== question.correctIndex && ' ❌'}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Next button */}
            {isAnswered && (
              <div style={{ textAlign: 'right' }}>
                <button
                  onClick={handleNext}
                  style={{
                    padding: '10px 25px',
                    background: '#3498db',
                    color: 'white',
                    border: 'none',
                    borderRadius: 5,
                    cursor: 'pointer',
                    fontWeight: 'bold'
                  }}
                >
                  {currentQuestionIdx < lesson.questions.length - 1 ? 'Next Question →' : 'Finish Lesson →'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
