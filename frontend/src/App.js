import React, { useState, useEffect, useCallback } from "react";
import * as api from "./api"; // API 모듈 import
import LanguageSelectView from "./components/LanguageSelectView";
import SetupView from "./components/SetupView";
import ChatView from "./components/ChatView";
import ReviewView from "./components/ReviewView";
import "./App.css"; // CSS 파일 import

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = new SpeechRecognition();
recognition.interimResults = false;
recognition.continuous = false;
recognition.maxAlternatives = 1;

function App() {
  const [mode, setMode] = useState("select");
  const [sessionId, setSessionId] = useState("");
  const [chatLog, setChatLog] = useState([]);
  const [listening, setListening] = useState(false);
  const [language, setLanguage] = useState("");
  const [situation, setSituation] = useState(null);
  const [progress, setProgress] = useState({ messageCount: 0, mistakeCount: 0 });
  const [difficulty, setDifficulty] = useState('medium');

  const initSession = useCallback(() => {
    const newId = "session-" + Math.random().toString(36).substring(2, 10);
    sessionStorage.setItem("sessionId", newId);
    setSessionId(newId);
    setChatLog([]);
  }, []);

  useEffect(() => {
    initSession();
  }, [initSession]);

  const updateProgress = useCallback(async () => {
    if (!sessionId) return;
    try {
      const data = await api.fetchProgress(sessionId);
      setProgress(data);
    } catch (err) {
      console.error("진행률 갱신 오류:", err);
    }
  }, [sessionId]);

  const sendMessage = async (text) => {
    if (!text.trim()) return;
    const userMsg = { role: "user", content: text };
    setChatLog((prev) => [...prev, userMsg]);

    try {
      const data = await api.fetchChatResponse({
        message: text,
        languageCode: language,
        sessionId,
        situation,
        difficulty,
      });
      const gptMsg = { role: "assistant", content: data.response };
      setChatLog((prev) => [...prev, gptMsg]);
      await playTTS(data.response);
      updateProgress();
    } catch (err) {
      console.error("GPT 오류:", err);
      // You can add error message to chat log here
    }
  };

  const playTTS = async (text) => {
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
  };

  const handleVoice = () => {
    if (listening) return;

    recognition.lang = language;
    setListening(true);
    recognition.start();

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      sendMessage(transcript);
      setListening(false);
    };
    recognition.onerror = (event) => {
      console.error("음성 인식 오류:", event.error);
      setListening(false);
    };
    recognition.onend = () => {
      setListening(false);
    };
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
  };

  const resetToLanguageSelect = () => {
    setMode("select");
    setLanguage("");
    setSituation(null);
  };
  
  const resetToSetup = () => {
    setMode("setup");
    setSituation(null);
  };

  const renderContent = () => {
    switch (mode) {
      case "select":
        return <LanguageSelectView onSelectLanguage={selectLanguage} />;
      case "setup":
        return <SetupView difficulty={difficulty} setDifficulty={setDifficulty} onStart={startConversation} />;
      case "chat":
        return (
          <ChatView
            chatLog={chatLog}
            setChatLog={setChatLog}
            onSendMessage={sendMessage}
            progress={progress}
            listening={listening}
            onVoiceInput={handleVoice}
            onGoToReview={() => setMode("review")}
            onResetSetup={resetToSetup}
          />
        );
      case "review":
        return <ReviewView sessionId={sessionId} onBack={() => setMode("chat")} />;
      default:
        return <div>잘못된 모드입니다.</div>;
    }
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h2>AI 회화 연습 🤖</h2>
      </header>
      <main className="app-content">
        {renderContent()}
      </main>
       <footer style={{textAlign: 'center', padding: '10px', fontSize: '0.8rem', color: '#aaa'}}>
          <button className="btn btn-secondary" onClick={resetToLanguageSelect}>언어 선택으로 돌아가기</button>
       </footer>
    </div>
  );
}

export default App;

