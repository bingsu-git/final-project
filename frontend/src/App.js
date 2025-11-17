import React, { useState, useEffect, useRef } from 'react';
import { auth } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import * as api from './api';
import './App.css';

// 컴포넌트
import AuthView from './components/AuthView';
import SetupView from './components/SetupView';
import ChatView from './components/ChatView';
import ReviewView from './components/ReviewView';
import QuizView from './components/QuizView';
import LanguageSelectView from './components/LanguageSelectView';

// Web Speech API 브라우저 호환성 체크
const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.lang = 'en-US';
  recognition.interimResults = false;
}

// ✨ 다크모드 전역 스타일
const styles = {
  app: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    width: '100vw',
    backgroundColor: '#1e1e2f',
    color: '#e0e0e0',
    fontFamily: 'Arial, sans-serif',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 32px',
    backgroundColor: '#2c2c3e',
    borderBottom: '1px solid #444',
  },
  logo: {
    fontSize: '1.5rem',
    fontWeight: 'bold',
    color: '#ffffff',
  },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  userEmail: {
    fontSize: '0.9rem',
    color: '#aaa',
  },
  logoutButton: {
    background: '#555',
    color: 'white',
    border: 'none',
    padding: '8px 12px',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  main: {
    flexGrow: 1,
    overflowY: 'auto',
    padding: '20px',
  },
  loading: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    fontSize: '1.5rem',
  },
};

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState('auth'); // 'auth' → 'language' → 'setup'/'chat'

  // 채팅 상태
  const [chatLog, setChatLog] = useState([]);
  const [difficulty, setDifficulty] = useState('medium');

  // 모드 / 언어 / 상황 등 통합 설정
  const [chatConfig, setChatConfig] = useState({
    situation: '',
    difficulty: 'medium',
    mode: 'roleplay', // 'roleplay' | 'rag'
    languageCode: 'en-US',
  });

  // difficulty 상태와 chatConfig 동기화
  useEffect(() => {
    setChatConfig((prev) => ({ ...prev, difficulty }));
  }, [difficulty]);

  // 음성 인식 / 전송 상태
  const [listening, setListening] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const audioRef = useRef(null); // AI 음성 재생용

  // 1. 로그인 상태 감지 → 뷰 전환
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
      setCurrentView(currentUser ? 'language' : 'auth');
    });
    return () => unsubscribe();
  }, []);

  // 2. STT 이벤트 핸들러
  useEffect(() => {
    if (!recognition) return;

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setListening(false);
      sendMessage(transcript);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setListening(false);
    };
  }, [chatConfig]);

  // 3. 메시지 전송 (RAG / 롤플레잉 공통)
  const sendMessage = async (message) => {
    if (isSending || !message.trim()) return;
    setIsSending(true);

    const userMessage = { role: 'user', content: message };
    setChatLog((prev) => [...prev, userMessage]);

    try {
      let aiResponseText = '';
      const currentMode = chatConfig.mode;
      const currentLang =
        currentMode === 'rag'
          ? chatConfig.languageCode || 'ko-KR'
          : chatConfig.languageCode || 'en-US';

      if (currentMode === 'rag') {
        // 법률 RAG 모드
        const data = await api.fetchRagResponse(message);
        aiResponseText = data.response;
      } else {
        // 롤플레잉 모드
        const config = {
          message,
          languageCode: currentLang,
          situation: chatConfig.situation,
          difficulty: chatConfig.difficulty,
        };
        const data = await api.fetchChatResponse(config);
        aiResponseText = data.response;
      }

      const aiMessage = { role: 'assistant', content: aiResponseText };
      setChatLog((prev) => [...prev, aiMessage]);

      // 🔇 RAG 모드에서는 TTS 완전 비활성화
      if (currentMode !== 'rag') {
        const ttsData = await api.fetchTTS({
          text: aiResponseText,
          languageCode: currentLang,
        });
        const audioContent = ttsData.audioContent;

        if (audioContent && audioRef.current) {
          const audioSrc = `data:audio/mpeg;base64,${audioContent}`;
          audioRef.current.src = audioSrc;
          audioRef.current.play();
        }
      }
    } catch (err) {
      console.error('Message sending failed:', err);
    } finally {
      setIsSending(false);
    }
  };

  // 4. 음성 인식 컨트롤
  const handleStartListening = () => {
    if (listening || isSending || !recognition) return;
    try {
      recognition.lang =
        chatConfig.mode === 'rag'
          ? 'ko-KR'
          : chatConfig.languageCode || 'en-US';
      recognition.start();
      setListening(true);
    } catch (err) {
      console.error('STT start failed:', err);
    }
  };

  const handleStopListening = () => {
    if (!listening || !recognition) return;
    recognition.stop();
    setListening(false);
  };

  // 5. 언어/모드 선택 (영어/일본어/법률 RAG)
  const handleLanguageSelect = ({ mode, languageCode }) => {
    if (mode === 'rag') {
      // 법률 RAG는 바로 채팅 진입
      setChatConfig({
      situation: "",
      difficulty: "medium",
      mode: "rag",
      languageCode: "ko-KR",
      });
      setChatLog([]);
      setCurrentView('chat');
    } else {
      // 롤플레잉 모드 → 난이도/상황 설정
      setChatConfig((prev) => ({
        ...prev,
        mode: 'roleplay',
        languageCode,
        situation: '',
      }));
      setCurrentView('setup');
    }
  };

  const handleResetLanguage = () => {
    setChatConfig((prev) => ({
      ...prev,
      mode: 'roleplay',
      situation: '',
    }));
    setCurrentView('language');
  };

  // 6. 롤플레잉용 Setup 완료 → 채팅 진입
  const handleStartChat = (situation) => {
    setChatConfig((prev) => ({
      ...prev,
      situation,
      mode: 'roleplay',
      difficulty,
    }));
    setChatLog([]);
    setCurrentView('chat');
  };

  const handleResetSetup = () => {
    setCurrentView('language');
  };

  if (loading) {
    return <div style={styles.loading}>Loading...</div>;
  }

  const renderView = () => {
    switch (currentView) {
      case 'auth':
        return <AuthView />;

      case 'language':
        return <LanguageSelectView onSelect={handleLanguageSelect} />;

      case 'setup':
        return (
          <SetupView
            difficulty={difficulty}
            setDifficulty={setDifficulty}
            onStart={handleStartChat}
            onResetLanguage={handleResetLanguage}
          />
        );

      case 'chat':
        return (
          <ChatView
            chatLog={chatLog}
            setChatLog={setChatLog}
            listening={listening || isSending}
            onStartListening={handleStartListening}
            onStopListening={handleStopListening}
            onGoToReview={() => setCurrentView('review')}
            onGoToQuiz={() => setCurrentView('quiz')}
            onResetSetup={() => setCurrentView('language')}
            chatConfig={chatConfig}     
            onSendText={sendMessage}    
          />
        );

      case 'review':
        return <ReviewView onBack={() => setCurrentView('chat')} />;

      case 'quiz':
        return <QuizView onBack={() => setCurrentView('chat')} />;

      default:
        return <AuthView />;
    }
  };

  return (
    <div className="App" style={styles.app}>
      {user && (
        <header style={styles.header}>
          <div style={styles.logo}>챗버디</div>
          <div style={styles.userInfo}>
            <span style={styles.userEmail}>{user.email}</span>
            <button style={styles.logoutButton} onClick={() => signOut(auth)}>
              로그아웃
            </button>
          </div>
        </header>
      )}
      <main style={styles.main}>{renderView()}</main>
      <audio ref={audioRef} hidden />
    </div>
  );
}

export default App;
