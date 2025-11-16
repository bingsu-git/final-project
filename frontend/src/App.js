import React, { useState, useEffect, useCallback, useRef } from "react";
import { auth, logout } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
import * as api from "./api";
import AuthView from "./components/AuthView";
import LanguageSelectView from "./components/LanguageSelectView";
import SetupView from "./components/SetupView";
import ChatView from "./components/ChatView";
import ReviewView from "./components/ReviewView";
import QuizView from "./components/QuizView";
import "./App.css";

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState("select");
  const [chatLog, setChatLog] = useState([]);
  const [listening, setListening] = useState(false);
  const [language, setLanguage] = useState("");
  const [situation, setSituation] = useState(null);
  const [progress, setProgress] = useState({ messageCount: 0, mistakeCount: 0 });
  const [difficulty, setDifficulty] = useState('medium');

  const recognitionRef = useRef(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
      if (currentUser) {
        setMode('select');
      }
    });
    return () => unsubscribe();
  }, []);

  const initSession = useCallback(() => {
    setChatLog([]);
  }, []);

  const updateProgress = useCallback(async () => {
    if (!user) return;
    try {
      const data = await api.fetchProgress();
      setProgress(data);
    } catch (err) {
      console.error("진행률 갱신 오류:", err);
    }
  }, [user]);

  const playTTS = useCallback(async (text) => {
    try {
      const cleanText = text.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|[\uD83C-\uDBFF\uDC00-\uDFFF]|\uFE0F|\u200D)+/g, '');
      const data = await api.fetchTTS({ text: cleanText, languageCode: language, situation });
      if (data.audioContent) {
        const audio = new Audio("data:audio/mp3;base64," + data.audioContent);
        audio.play();
      }
    } catch (err) {
      console.error("TTS 오류:", err);
    }
  }, [language, situation]);

  const sendMessage = useCallback(async (text) => {
    if (!text.trim() || !user) return;
    const userMsg = { role: "user", content: text };
    setChatLog((prev) => [...prev, userMsg]);

    try {
      const data = await api.fetchChatResponse({
        message: text,
        languageCode: language,
        situation,
        difficulty,
      });
      const gptMsg = { role: "assistant", content: data.response };
      setChatLog((prev) => [...prev, gptMsg]);
      await playTTS(data.response);
      updateProgress();
    } catch (err) {
      console.error("GPT 오류:", err);
    }
  }, [user, language, situation, difficulty, playTTS, updateProgress]);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.error("이 브라우저는 음성 인식을 지원하지 않습니다.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      sendMessage(transcript);
    };
    recognition.onerror = (event) => { console.error("음성 인식 오류:", event.error); };
    recognition.onend = () => { setListening(false); };
    recognitionRef.current = recognition;
  }, [sendMessage]);

  useEffect(() => {
    if (user) {
      initSession();
    }
  }, [user, initSession]);

  const startListening = () => {
    if (listening || !recognitionRef.current) return;
    recognitionRef.current.lang = language;
    setListening(true);
    recognitionRef.current.start();
  };

  const stopListening = () => {
    if (!listening || !recognitionRef.current) return;
    recognitionRef.current.stop();
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("로그아웃 실패:", error);
    }
  };

  const selectLanguage = (lang) => {
    initSession();
    setLanguage(lang);
    setMode("setup");
    setSituation(null);
  };

  const startConversation = (customSituation) => {
    initSession();
    setSituation(customSituation.trim());
    setMode("chat");
    updateProgress(); // 대화 시작 시 진행률 초기 로드
  };

  const resetToSetup = () => {
    setMode("setup");
    setSituation(null);
  };

  // 아래 중앙 배치용: 언어 선택 화면으로 이동
  const goToLanguageSelect = useCallback(() => {
    if (recognitionRef.current && listening) {
      recognitionRef.current.stop();
    }
    setListening(false);
    setChatLog([]);
    setLanguage("");
    setSituation(null);
    setMode("select");
  }, [listening]);

  const renderContent = () => {
    if (loading) return <div className="loading-spinner"></div>;
    if (!user) return <AuthView />;

    switch (mode) {
      case "select":
        return <LanguageSelectView onSelectLanguage={selectLanguage} />;
      case "setup":
        return <SetupView difficulty={difficulty} setDifficulty={setDifficulty} onStart={startConversation} />;
      case "chat":
        return <ChatView
          chatLog={chatLog} setChatLog={setChatLog}
          progress={progress}
          listening={listening} onStartListening={startListening} onStopListening={stopListening}
          onGoToReview={() => setMode("review")}
          onGoToQuiz={() => setMode("quiz")}
          onResetSetup={resetToSetup}
        />;
        case "review":
        return <ReviewView onBack={() => setMode("chat")} />;
      case "quiz":
        return <QuizView onBack={() => setMode("chat")} />;
      default:
        return <div>잘못된 모드입니다.</div>;
    }
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h2>챗버디</h2>
        {user && (
          <div className="user-info">
            <span>{user.email}</span>
            <button onClick={handleLogout} className="btn btn-secondary">로그아웃</button>
          </div>
        )}
      </header>

      <main className="app-content">
        {renderContent()}
        {user && (
          <footer className="app-footer">
            <button
              onClick={goToLanguageSelect}
              className="btn btn-secondary"
              title="언어 선택 화면으로 이동"
            >
              언어 선택
            </button>
          </footer>
        )}
      </main>
    </div>
  );
}

export default App;

