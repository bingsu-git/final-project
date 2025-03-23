import React, { useState } from "react";

// 🎤 음성 인식 전역 설정
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = new SpeechRecognition();
recognition.interimResults = false;
recognition.continuous = false;
recognition.maxAlternatives = 1;
function removeEmojis(text) {
  // 유니코드 이모지 제거 정규식
  return text.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|[\uD83C-\uDBFF\uDC00-\uDFFF]|\uFE0F|\u200D)+/g, '');
}

function App() {
  const [input, setInput] = useState("");
  const [chatLog, setChatLog] = useState([]);
  const [recognitionListening, setRecognitionListening] = useState(false);
  const [language, setLanguage] = useState("en-US");
  const [level, setLevel] = useState("beginner");

  // ✅ Google TTS 백엔드 호출 및 음성 재생
  const playTTS = async (text, lang = "en-US") => {
    try {
      const res = await fetch("http://localhost:5000/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          languageCode: lang,
          gender: "NEUTRAL",
        }),
      });

      const data = await res.json();

      if (data.audioContent) {
        const audio = new Audio("data:audio/mp3;base64," + data.audioContent);
        audio.play();
      } else {
        console.error("🔇 오디오 생성 실패:", data);
      }
    } catch (err) {
      console.error("❌ TTS 오류:", err);
    }
  };

  // ✉️ GPT에 메시지 전송
  const handleSubmit = async (message = input) => {
    const text = typeof message === "string" ? message : String(message);
    if (!text.trim()) return;

    const userMessage = { role: "user", content: text };
    setChatLog([...chatLog, userMessage]);
    setInput("");

    try {
      const res = await fetch("http://localhost:5000/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          level,
          languageCode: language, // 같이 보내면 백엔드에서 더 자연스럽게 사용 가능
        }),
      });

      const data = await res.json();
      const gptResponse = { role: "assistant", content: data.response };
      setChatLog((prev) => [...prev, gptResponse]);

      await playTTS(removeEmojis(data.response), language); // 🔊 GPT 응답을 자동으로 읽음
    } catch (err) {
      console.error("❌ GPT 통신 오류:", err);
    }
  };

  // 🎤 음성 인식 시작
  const handleVoiceInput = () => {
    if (recognitionListening) return;

    recognition.lang = language;
    setRecognitionListening(true);
    recognition.start();

    recognition.onstart = () => console.log("🎤 음성 인식 시작");

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      console.log("🗣️ 인식된 내용:", transcript);
      setInput(transcript);
      handleSubmit(transcript); // 자동 전송
      setRecognitionListening(false);
    };

    recognition.onerror = (event) => {
      console.error("❌ 음성 인식 오류:", event.error);
      setRecognitionListening(false);
    };

    recognition.onend = () => {
      console.log("🔚 음성 인식 종료");
      setRecognitionListening(false);
    };
  };

  return (
    <div style={{ maxWidth: "600px", margin: "50px auto", fontFamily: "Arial" }}>
      <h2>🌐 Chat to learn with AI</h2>

      {/* 🌍 언어 선택 */}
      <div style={{ marginBottom: "15px" }}>
        <label>언어 설정 (음성 인식 & TTS): </label>
        <select value={language} onChange={(e) => setLanguage(e.target.value)}>
          <option value="en-US">🇺🇸 영어</option>
          <option value="ko-KR">🇰🇷 한국어</option>
          <option value="ja-JP">🇯🇵 일본어</option>
          <option value="fr-FR">🇫🇷 프랑스어</option>
          <option value="zh-CN">🇨🇳 중국어</option>
          <option value="es-ES">🇪🇸 스페인어</option>
        </select>
      </div>

      <div style={{ marginBottom: "15px" }}>
  <label>회화 난이도: </label>
  <select value={level} onChange={(e) => setLevel(e.target.value)}>
    <option value="beginner">🔰 Beginner</option>
    <option value="intermediate">🚶 Intermediate</option>
    <option value="advanced">🧠 Advanced</option>
  </select>
</div>

      {/* 💬 채팅창 */}
      <div
        style={{
          border: "1px solid #ccc",
          padding: "10px",
          height: "300px",
          overflowY: "scroll",
          marginBottom: "20px",
          backgroundColor: "#f9f9f9",
        }}
      >
        {chatLog.map((msg, i) => (
          <div key={i} style={{ marginBottom: "10px" }}>
            <strong>{msg.role === "user" ? "🙋 나" : "🤖 GPT"}:</strong> {msg.content}
          </div>
        ))}
      </div>

      {/* 입력창 + 버튼 */}
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="말하거나 입력해보세요!"
        style={{ width: "70%", padding: "8px" }}
      />
      <button onClick={() => handleSubmit()} style={{ marginLeft: "10px" }}>
        보내기
      </button>
      <button onClick={handleVoiceInput} style={{ marginLeft: "10px" }}>
        🎤 음성 입력
      </button>
    </div>
  );
}

export default App;
