import React, { useState, useEffect, useRef } from 'react';
import * as api from "../api";

function ChatView({ 
  chatLog, 
  setChatLog, 
  progress, 
  listening, 
  onStartListening,
  onStopListening,
  onGoToReview,
  onGoToQuiz,
  onResetSetup 
}) {
  const [visibleExtras, setVisibleExtras] = useState({});
  const chatLogRef = useRef(null);

  useEffect(() => {
    if (chatLogRef.current) {
      chatLogRef.current.scrollTop = chatLogRef.current.scrollHeight;
    }
  }, [chatLog]);

  const toggleExtra = async (index, type) => {
    const currentVisibility = visibleExtras[index]?.[type];
    
    setVisibleExtras(prev => ({
      ...prev,
      [index]: { ...prev[index], [type]: !currentVisibility },
    }));

    if (!currentVisibility && !chatLog[index][type]) {
      try {
        const text = chatLog[index].content;
        const data = type === 'translation' 
          ? await api.fetchTranslation(text)
          : await api.fetchPronunciation(text);
        
        setChatLog(prev => {
          const updated = [...prev];
          updated[index] = { ...updated[index], [type]: data.result };
          return updated;
        });
      } catch (err) {
        console.error(`${type} 로딩 오류:`, err);
        setVisibleExtras(prev => ({
          ...prev,
          [index]: { ...prev[index], [type]: false },
        }));
      }
    }
  };

  return (
    <div className="chat-view">
      <div className="progress-bar">
        <span>주고받은 대화: {progress.messageCount}</span> | <span>틀린 표현: {progress.mistakeCount}</span>
      </div>
      <div
        className="chat-log"
        ref={chatLogRef}
        role="log"
        aria-live="polite"
        aria-relevant="additions"
      >
        {chatLog.map((msg, i) => (
          <div key={i} className={`chat-message ${msg.role}`}>
            <div className="avatar">{msg.role === 'user' ? '나' : 'AI'}</div>
            <div className="chat-bubble">
              {msg.content}
              {msg.role === 'assistant' && (
                <div className="chat-extras">
                  <button className="btn btn-secondary" onClick={() => toggleExtra(i, "translation")}>번역</button>
                  <button className="btn btn-secondary" onClick={() => toggleExtra(i, "pronunciation")}>발음</button>
                  {visibleExtras[i]?.translation && msg.translation && (
                    <div className="extra-content"><strong>번역:</strong> {msg.translation}</div>
                  )}
                  {visibleExtras[i]?.pronunciation && msg.pronunciation && (
                    <div className="extra-content"><strong>발음:</strong> {msg.pronunciation}</div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="chat-controls">
        {/* 마이크 단일 토글 버튼 */}
        <button
          className={`voice-btn ${listening ? 'listening' : ''}`}
          onClick={listening ? onStopListening : onStartListening}
          aria-pressed={listening}
          aria-label={listening ? '음성 입력 중지' : '음성 입력 시작'}
          title={listening ? '음성 입력 중지' : '음성 입력 시작'}
        >
          {listening ? '중지' : '말하기'}
        </button>

        <div className="sub-controls">
          <button className="btn btn-secondary" onClick={onGoToReview}>복습하기</button>
          <button className="btn btn-secondary" onClick={onGoToQuiz}>퀴즈 풀기</button>
          <button className="btn btn-secondary" onClick={onResetSetup}>다른 상황 설정</button>
        </div>
      </div>
    </div>
  );
}

export default ChatView;
