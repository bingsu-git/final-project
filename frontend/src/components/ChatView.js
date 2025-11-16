// src/components/ChatView.js
import React, { useState, useEffect, useRef } from 'react';
import * as api from "../api";

function ChatView({ 
  chatLog, 
  setChatLog, 
  listening, 
  onStartListening,
  onStopListening,
  onGoToReview,
  onGoToQuiz,
  onResetSetup 
}) {
  const [visibleExtras, setVisibleExtras] = useState({});
  const chatLogRef = useRef(null);

  const styles = {
    container: {
      display: 'flex',
      flexDirection: 'column',
      gap: '20px',
    },
    log: {
      border: '1px solid rgba(255,255,255,0.06)',
      background: 'rgba(255,255,255,0.02)',
      borderRadius: '12px',
      padding: '16px',
      overflowY: 'auto',
      maxHeight: '52vh',
    },
    messageRow: {
      display: 'flex',
      alignItems: 'flex-end',
      gap: '10px',
      marginBottom: '12px',
    },
    avatar: {
      width: '36px',
      height: '36px',
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontWeight: 700,
      color: '#fff',
      background: '#3498db',
      flex: '0 0 36px',
    },
    avatarUser: { background: '#2ecc71' },
    bubble: {
      maxWidth: '70%',
      padding: '12px 16px',
      borderRadius: '14px',
      lineHeight: 1.6,
      background: 'rgba(236,240,241,0.12)',
      color: '#e5e7eb',
      wordBreak: 'break-word',
    },
    bubbleUser: {
      background: '#2b6cb0',
      color: '#fff',
    },
    extras: {
      marginTop: '10px',
      paddingTop: '8px',
      borderTop: '1px solid rgba(255,255,255,0.08)',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
    },
    extraContent: {
      fontSize: '0.95rem',
      background: 'rgba(0,0,0,0.18)',
      padding: '8px',
      borderRadius: '8px',
    },
    controlsWrap: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '14px',
    },
    speakBtn: {
      borderRadius: '999px',
      padding: '14px 28px',
      fontSize: '1.05rem',
      fontWeight: 700,
      color: '#fff',
      minWidth: '140px',
      backgroundColor: listening ? '#D0021B' : '#4A90E2',
      border: 'none',
      cursor: 'pointer',
      display: 'inline-flex',
      justifyContent: 'center',
      alignItems: 'center',
      transition: 'all .2s ease',
      boxShadow: '0 4px 12px rgba(0,0,0,.2)',
    },
    subControls: {
      display: 'flex',
      gap: '10px',
      flexWrap: 'wrap',
      justifyContent: 'center',
    },
  };

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
    <div className="chat-view" style={styles.container}>
      <div
        className="chat-log"
        style={styles.log}
        ref={chatLogRef}
        role="log"
        aria-live="polite"
        aria-relevant="additions"
      >
        {chatLog.map((msg, i) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={i}
              className={`chat-message ${msg.role}`}
              style={{ 
                ...styles.messageRow, 
                justifyContent: isUser ? 'flex-end' : 'flex-start'
              }}
            >
              {/* AI: 아바타 -> 말풍선 */}
              {!isUser && <div style={styles.avatar}>AI</div>}

              {isUser ? (
                // 사용자: 말풍선 -> 아바타(오른쪽에 붙음). 채팅은 오른쪽 정렬 유지.
                <>
                  <div className="chat-bubble" style={{ ...styles.bubble, ...styles.bubbleUser }}>
                    {msg.content}
                  </div>
                  <div style={{ ...styles.avatar, ...styles.avatarUser }}>나</div>
                </>
              ) : (
                <div className="chat-bubble" style={styles.bubble}>
                  {msg.content}
                  <div className="chat-extras" style={styles.extras}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-secondary" onClick={() => toggleExtra(i, "translation")}>번역</button>
                      <button className="btn btn-secondary" onClick={() => toggleExtra(i, "pronunciation")}>발음</button>
                    </div>
                    {visibleExtras[i]?.translation && msg.translation && (
                      <div className="extra-content" style={styles.extraContent}>
                        <strong>번역:</strong> {msg.translation}
                      </div>
                    )}
                    {visibleExtras[i]?.pronunciation && msg.pronunciation && (
                      <div className="extra-content" style={styles.extraContent}>
                        <strong>발음:</strong> {msg.pronunciation}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="chat-controls" style={styles.controlsWrap}>
        <button
          style={styles.speakBtn}
          onClick={listening ? onStopListening : onStartListening}
          aria-pressed={listening}
          aria-label={listening ? '음성 입력 중지' : '음성 입력 시작'}
          title={listening ? '음성 입력 중지' : '음성 입력 시작'}
        >
          {listening ? '중지' : '말하기'}
        </button>

        <div className="sub-controls" style={styles.subControls}>
          <button className="btn btn-secondary" onClick={onGoToReview}>복습하기</button>
          <button className="btn btn-secondary" onClick={onGoToQuiz}>퀴즈 풀기</button>
          <button className="btn btn-secondary" onClick={onResetSetup}>다른 상황 설정</button>
        </div>
      </div>
    </div>
  );
}

export default ChatView;
