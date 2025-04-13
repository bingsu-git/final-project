import React, { useState, useEffect } from "react";

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = new SpeechRecognition();

recognition.interimResults = false;
recognition.continuous = false;
recognition.maxAlternatives = 1;

const removeEmojis = (text) =>
  text.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|[\uD83C-\uDBFF\uDC00-\uDFFF]|\uFE0F|\u200D)+/g, '');

function App() {
  const [chatLog, setChatLog] = useState([]);
  const [language, setLanguage] = useState("en-US");
  const [listening, setListening] = useState(false);
  const [sessionId, setSessionId] = useState("");

  useEffect(() => {
    const savedId = sessionStorage.getItem("sessionId");
    if (savedId) {
      setSessionId(savedId);
    } else {
      const newId = "session-" + Math.random().toString(36).substring(2, 10);
      sessionStorage.setItem("sessionId", newId);
      setSessionId(newId);
    }
  }, []);

  const playTTS = async (text) => {
    try {
      const res = await fetch("http://localhost:5000/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, languageCode: language }),
      });
      const data = await res.json();
      if (data.audioContent) {
        const audio = new Audio("data:audio/mp3;base64," + data.audioContent);
        audio.play();
      }
    } catch (err) {
      console.error("🔊 TTS 오류:", err);
    }
  };

  const sendMessage = async (text) => {
    if (!text.trim()) return;

    const userMsg = { role: "user", content: text };
    setChatLog((prev) => [...prev, userMsg]);

    try {
      const res = await fetch("http://localhost:5000/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, languageCode: language, sessionId }),
      });
      const data = await res.json();
      const gptMsg = { role: "assistant", content: data.response };
      setChatLog((prev) => [...prev, gptMsg]);
      await playTTS(removeEmojis(data.response));
    } catch (err) {
      console.error("💬 GPT 오류:", err);
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
      console.error("🎤 음성 인식 오류:", event.error);
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
    };
  };

  return (
    <div style={{ maxWidth: "600px", margin: "40px auto", fontFamily: "Arial" }}>
      <h2>외국어 회화 연습</h2>

      <div style={{ marginBottom: "10px" }}>
        <label>언어 선택: </label>
        <select value={language} onChange={(e) => setLanguage(e.target.value)}>
          <option value="en-US">영어</option>
          <option value="ja-JP">일본어</option>
        </select>
      </div>

      <div style={{
        border: "1px solid #ccc",
        padding: "10px",
        height: "300px",
        overflowY: "auto",
        backgroundColor: "#f9f9f9",
        marginBottom: "15px"
      }}>
        {chatLog.map((msg, i) => (
          <div key={i} style={{ marginBottom: "8px" }}>
            <strong>{msg.role === "user" ? "나" : "GPT"}:</strong> {msg.content}
          </div>
        ))}
      </div>

      <div style={{ textAlign: "center" }}>
        <button onClick={handleVoice} style={{ padding: "10px 20px", fontSize: "16px" }}>
          🎤 음성 입력
        </button>
      </div>
    </div>
  );
}

export default App;
