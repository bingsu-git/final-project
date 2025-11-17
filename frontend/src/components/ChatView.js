// src/components/ChatView.js
import React, { useState, useEffect, useRef } from 'react';
import * as api from '../api';

const styles = {
  chatView: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    maxHeight: 'calc(100vh - 160px)',
  },
  chatLog: {
    flexGrow: 1,
    overflowY: 'auto',
    marginBottom: '16px',
    padding: '10px 20px 0',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  chatMessage: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: '10px',
    maxWidth: '85%',
  },
  userMessage: {
    alignSelf: 'flex-end',
    flexDirection: 'row-reverse',
  },
  assistantMessage: {
    alignSelf: 'flex-start',
  },
  avatar: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    color: 'white',
    fontWeight: 'bold',
    flexShrink: 0,
    cursor: 'pointer',
    overflow: 'hidden',
  },
  userAvatar: {
    backgroundColor: '#4CAF50',
  },
  assistantAvatar: {
    backgroundColor: '#4A90E2',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  chatBubble: {
    padding: '12px 16px',
    borderRadius: '18px',
    color: '#E0E0E0',
    fontSize: '1rem',
    wordBreak: 'break-word',
    background: 'rgba(255, 255, 255, 0.05)',
    maxWidth: '100%',
  },
  userBubble: {
    backgroundColor: '#005D4B',
    borderBottomRightRadius: '4px',
  },
  assistantBubble: {
    backgroundColor: '#373E4E',
    borderBottomLeftRadius: '4px',
  },
  chatExtras: {
    marginTop: '10px',
    paddingTop: '8px',
    borderTop: '1px solid #555',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  extraButtons: {
    display: 'flex',
    gap: '8px',
  },
  extraButton: {
    backgroundColor: 'transparent',
    color: '#A9BCD0',
    border: '1px solid #555',
    borderRadius: '15px',
    padding: '6px 12px',
    fontSize: '0.8rem',
    cursor: 'pointer',
  },
  extraContent: {
    marginTop: '8px',
    padding: '8px',
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: '8px',
    fontSize: '0.9rem',
  },

  // 예시 영역
  suggestionContainer: {
    marginBottom: '12px',
    padding: '0 20px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  suggestionLabel: {
    fontSize: '0.85rem',
    color: '#A0A6B8',
    textAlign: 'center',
  },
  suggestionChips: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    justifyContent: 'center',
  },
  suggestionTrigger: {
    backgroundColor: 'transparent',
    border: '1px dashed #555',
    borderRadius: '18px',
    padding: '6px 14px',
    fontSize: '0.85rem',
    color: '#E0E0E0',
    cursor: 'pointer',
  },

  mainButton: {
    borderRadius: '50px',
    padding: '16px 32px',
    fontSize: '1.1rem',
    fontWeight: 'bold',
    color: 'white',
    minWidth: '140px',
    backgroundColor: '#4A90E2',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.2s ease-in-out',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
  },
  listeningButton: {
    backgroundColor: '#D0021B',
  },
  secondaryButton: {
    background: '#4a4a6b',
    color: '#e0e0e0',
    border: 'none',
    padding: '10px 15px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '0.9rem',
    // flex: 'none', // ✨ 추가: 버튼 크기가 내용에 따라 변하지 않도록 고정
    whiteSpace: 'nowrap', // ✨ 추가: 텍스트가 줄바꿈되지 않도록
    minWidth: '80px', // ✨ 추가: 최소 너비 지정 (모드 선택 버튼이 너무 작아지는 것 방지)
  },

  controlsContainer: {
    borderTop: '1px solid #444',
    padding: '16px 0 24px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
  },
  subControlsContainer: {
    display: 'flex',
    gap: '10px',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%', // ✅ 이 라인을 추가하세요
  },
};

// 기본 예시(백업용)
function getDefaultSuggestions(mode, languageCode) {
  if (mode === 'rag') {
    return [
      '개인정보 보호법에서 유효한 동의 요건을 알려주세요.',
      '온라인 쇼핑몰 환불 규정은 전자상거래법에서 어떻게 정리되나요?',
      '개발자 야근과 관련된 근로기준법 규정을 설명해 주세요.',
      '클라우드에 고객 데이터를 저장할 때 꼭 지켜야 할 법적 요건이 있나요?',
    ];
  }

  if (languageCode === 'ja-JP') {
    return [
      'すみません、アイスコーヒーを一つお願いします。',
      'おすすめのメニューはありますか？',
      'もう少しゆっくり話してもらえますか？',
      'テイクアウトできますか？',
    ];
  }

  return [
    'Hi, I would like to order a coffee.',
    'Could you recommend something sweet?',
    'Sorry, could you speak a little more slowly?',
    'Is this seat taken?',
  ];
}

function ChatView({
  chatLog,
  setChatLog,
  listening,
  onStartListening,
  onStopListening,
  onGoToReview,
  onGoToQuiz,
  onResetSetup,   // 모드 / 언어 선택으로
  chatConfig,     // { mode, languageCode, difficulty, situation }
  onSendText,     // 예시 클릭 시 메시지 보내기
}) {
  const [visibleExtras, setVisibleExtras] = useState({});
  const [suggestions, setSuggestions] = useState([]);
  const [makingSuggestions, setMakingSuggestions] = useState(false);

  const [avatars, setAvatars] = useState({
    user: null,
    assistant: null,
  });

  const chatLogRef = useRef(null);
  const userFileInputRef = useRef(null);
  const aiFileInputRef = useRef(null);

  const currentMode = chatConfig?.mode || 'roleplay';
  const currentLang = chatConfig?.languageCode || 'en-US';
  const isRag = currentMode === 'rag';

  // 스크롤 맨 아래로
  useEffect(() => {
    if (chatLogRef.current) {
      chatLogRef.current.scrollTop = chatLogRef.current.scrollHeight;
    }
  }, [chatLog]);

  // 로그인한 사용자별 아바타 로딩
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const data = await api.fetchAvatars();
        if (cancelled) return;
        setAvatars({
          user: data?.userAvatar || null,
          assistant: data?.assistantAvatar || null,
        });
      } catch (e) {
        console.error('아바타 로딩 실패:', e);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // 모드/언어 변경 시 예시 초기화
  useEffect(() => {
    setSuggestions([]);
  }, [currentMode, currentLang]);

  const toggleExtra = async (index, type) => {
    const currentVisibility = visibleExtras[index]?.[type];

    setVisibleExtras((prev) => ({
      ...prev,
      [index]: { ...prev[index], [type]: !currentVisibility },
    }));

    if (!currentVisibility && !chatLog[index][type]) {
      try {
        const text = chatLog[index].content;
        const data =
          type === 'translation'
            ? await api.fetchTranslation(text)
            : await api.fetchPronunciation(text);

        setChatLog((prev) => {
          const updated = [...prev];
          updated[index] = { ...updated[index], [type]: data.result };
          return updated;
        });
      } catch (err) {
        console.error(`${type} 로딩 오류:`, err);
        setVisibleExtras((prev) => ({
          ...prev,
          [index]: { ...prev[index], [type]: false },
        }));
      }
    }
  };

  const handleSuggestionClick = (text) => {
    if (typeof onSendText === 'function') {
      onSendText(text);
    }
  };

  // 예시 새로 생성 (API 우선, 실패하면 기본값)
  const handleGenerateSuggestions = async () => {
    setMakingSuggestions(true);
    try {
      let list = [];

      if (isRag) {
        // 법률 RAG 질문 예시
        const data = await api.fetchRagExamples();
        if (Array.isArray(data)) {
          list = data;
        } else if (Array.isArray(data?.examples)) {
          list = data.examples;
        }
      } else {
        // 회화 예시 (상황/난이도/최근 대화 반영)
        const payload = {
          languageCode: currentLang,
          mode: 'roleplay',
          difficulty: chatConfig?.difficulty || 'medium',
          situation: chatConfig?.situation || '',
          history: chatLog.slice(-4),
        };
        const data = await api.fetchExamples(payload);
        if (Array.isArray(data)) {
          list = data;
        } else if (Array.isArray(data?.examples)) {
          list = data.examples;
        }
      }

      if (!list || list.length === 0) {
        list = getDefaultSuggestions(currentMode, currentLang);
      }

      // 1. (수정) 원본 텍스트 목록(string[])을 먼저 준비
      const rawList = list
        .map((s) => String(s || '').trim())
        .filter(Boolean)
        .slice(0, 8);
    
      // 2. (추가) 원본 목록을 순회하며 번역 API 호출
      const translatedList = await Promise.all(
        rawList.map(async (text) => {
          // RAG 모드(isRag) 예시는 이미 한국어이므로 번역 안 함
          if (isRag) {
            return { text, translation: text };
          }
          // 회화 모드일 때만 번역
          try {
            const data = await api.fetchTranslation(text);
            return { text: text, translation: data.result || text };
          } catch (e) {
            console.error('Suggestion translation failed:', e);
            return { text: text, translation: text }; // 실패 시 원본 표시
          }
        })
      );

      // 3. (수정) {text, translation} 객체 배열을 state에 저장
      setSuggestions(translatedList);

    } catch (e) {
      console.error('예시 생성 실패, 기본값 사용:', e);
      setSuggestions(getDefaultSuggestions(currentMode, currentLang));
    } finally {
      setMakingSuggestions(false);
    }
  };

  // 아바타 클릭 → 파일 선택창 열기
  const handleAvatarClick = (who) => {
    if (who === 'user' && userFileInputRef.current) {
      userFileInputRef.current.click();
    } else if (who === 'assistant' && aiFileInputRef.current) {
      aiFileInputRef.current.click();
    }
  };

  // 파일 선택 후 업로드
  const handleAvatarChange = async (event, who) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const dataUrl = reader.result; // base64 data URL
      try {
        if (who === 'user') {
          await api.updateAvatars({ userAvatar: dataUrl });
          setAvatars((prev) => ({ ...prev, user: dataUrl }));
        } else {
          await api.updateAvatars({ assistantAvatar: dataUrl });
          setAvatars((prev) => ({ ...prev, assistant: dataUrl }));
        }
      } catch (e) {
        console.error('아바타 업데이트 실패:', e);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="chat-view" style={styles.chatView}>
      {/* 숨겨진 파일 입력 */}
      <input
        type="file"
        accept="image/*"
        ref={userFileInputRef}
        style={{ display: 'none' }}
        onChange={(e) => handleAvatarChange(e, 'user')}
      />
      <input
        type="file"
        accept="image/*"
        ref={aiFileInputRef}
        style={{ display: 'none' }}
        onChange={(e) => handleAvatarChange(e, 'assistant')}
      />

      <div style={styles.chatLog} ref={chatLogRef}>
        {chatLog.map((msg, i) => (
          <div
            key={i}
            style={{
              ...styles.chatMessage,
              ...(msg.role === 'user'
                ? styles.userMessage
                : styles.assistantMessage),
            }}
          >
            <div
              style={{
                ...styles.avatar,
                ...(msg.role === 'user'
                  ? styles.userAvatar
                  : styles.assistantAvatar),
              }}
              onClick={() =>
                handleAvatarClick(msg.role === 'user' ? 'user' : 'assistant')
              }
              title="아이콘 변경"
            >
              {msg.role === 'user'
                ? avatars.user
                  ? <img src={avatars.user} alt="user avatar" style={styles.avatarImage} />
                  : '나'
                : avatars.assistant
                  ? <img src={avatars.assistant} alt="AI avatar" style={styles.avatarImage} />
                  : 'AI'}
            </div>

            <div
              style={{
                ...styles.chatBubble,
                ...(msg.role === 'user'
                  ? styles.userBubble
                  : styles.assistantBubble),
              }}
            >
              {msg.content}
              {!isRag && (
                <div style={styles.chatExtras}>
                  <div style={styles.extraButtons}>
                    <button
                      style={styles.extraButton}
                      onClick={() => toggleExtra(i, 'translation')}
                    >
                      번역
                    </button>
                    <button
                      style={styles.extraButton}
                      onClick={() => toggleExtra(i, 'pronunciation')}
                    >
                      발음
                    </button>
                  </div>
                  {visibleExtras[i]?.translation && msg.translation && (
                    <div style={styles.extraContent}>
                      <strong>번역:</strong> {msg.translation}
                    </div>
                  )}
                  {visibleExtras[i]?.pronunciation && msg.pronunciation && (
                    <div style={styles.extraContent}>
                      <strong>발음:</strong> {msg.pronunciation}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 예시 버튼 + 예시 목록 */}
      <div style={styles.suggestionContainer}>
        <button
          style={styles.suggestionTrigger}
          onClick={handleGenerateSuggestions}
        >
          {makingSuggestions
            ? '예시 생성 중...'
            : isRag
            ? '질문 예시 보기'
            : '대화 예시 보기'}
        </button>

        {suggestions.length > 0 && (
          <>
            <div style={styles.suggestionLabel}>
              {isRag
                ? '무슨 질문을 해야 할지 모르겠다면 아래 예시를 눌러보세요.'
                : '뭐라고 말할지 모르겠다면 아래 예시 문장을 눌러보세요.'}
            </div>
            <div style={styles.suggestionChips}>
  {suggestions.map((item, idx) => (
    <button
      key={idx}
      onClick={() => handleSuggestionClick(item.text)}
      title={item.translation}
      style={{
        // 1) 버튼 기본 스타일 싸그리 재정의
        all: 'unset',              // 브라우저 기본 버튼 스타일 제거
        boxSizing: 'border-box',

        // 2) 네가 원하는 모양
        background: 'transparent',
        border: '1px solid #555',
        borderRadius: '16px',
        color: '#E0E0E0',

        // 3) 왼쪽 공백/패딩 제어
        padding: '6px 10px 6px 10px',  // ← 왼쪽만 4px, 필요하면 0으로
        maxWidth: '260px',
        whiteSpace: 'nowrap',
        textOverflow: 'ellipsis',
        overflow: 'hidden',

        // 4) 레이아웃
        display: 'inline-block',
        cursor: 'pointer',
        textAlign: 'left',
        verticalAlign: 'top',
        margin: 0,
      }}
    >
      {item.text}
    </button>
  ))}
</div>

          </>
        )}
      </div>

      {/* 하단 컨트롤 (정렬 맞춤) */}
      <div style={styles.controlsContainer}>
        <button
          style={{
            ...styles.mainButton,
            ...(listening ? styles.listeningButton : {}),
          }}
          onClick={listening ? onStopListening : onStartListening}
        >
          {listening ? '중지' : '말하기'}
        </button>

        <div style={styles.subControlsContainer}>
          {isRag ? (
            // RAG 모드일 때: '모드 선택' 버튼 1개만 중앙 정렬
            <button style={styles.secondaryButton} onClick={onResetSetup}>
           모드 선택
            </button>
          ) : (
            // RAG 모드가 아닐 때: 3개 버튼을 중앙 정렬
            <>
              <button style={styles.secondaryButton} onClick={onGoToReview}>
                복습하기
              </button>
              <button style={styles.secondaryButton} onClick={onGoToQuiz}>
                퀴즈 풀기
              </button>
              <button style={styles.secondaryButton} onClick={onResetSetup}>
                모드 선택
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default ChatView;
