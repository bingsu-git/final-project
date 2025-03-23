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
  const [formality, setFormality] = useState("polite");
  const [emotion, setEmotion] = useState("smile");

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
          formality,
        }),
      });

      const data = await res.json();
      const gptResponse = { role: "assistant", content: data.response };
      setChatLog((prev) => [...prev, gptResponse]);

      if (data.emotion) {
        setEmotion(data.emotion); // joy, sad, surprised 등
      }

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
    <div
      style={{
        backgroundImage: "url('/images/izakaya-bg.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        height: "100vh",
        padding: "30px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        fontFamily: "Arial",
        color: "#fff",
        textShadow: "1px 1px 4px rgba(0,0,0,0.8)",
      }}
    >
      {/* 🎨 중앙 AI 캐릭터 */}
      <div style={{ flex: 1, textAlign: "center" }}>
     <img
        src={`/images/${emotion}.png`} // 예: joy.png, surprised.png
        alt=""
        style={{ width: "300px", height: "auto", borderRadius: "20px" }}
      />
      </div>
  
      {/* 💬 채팅 UI 영역 */}
      <div
        style={{
          width: "380px",
          backgroundColor: "rgba(255, 255, 255, 0.9)",
          padding: "20px",
          borderRadius: "15px",
          color: "#000",
          height: "80vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        {/* 언어/난이도/말투 선택 */}
        <div>
          <div style={{ marginBottom: "10px" }}>
            <label>언어: </label>
            <select value={language} onChange={(e) => setLanguage(e.target.value)}>
              <option value="en-US">영어</option>
              <option value="ko-KR">한국어</option>
              <option value="ja-JP">일본어</option>
              <option value="fr-FR">프랑스어</option>
              <option value="zh-CN">중국어</option>
              <option value="es-ES">스페인어</option>
            </select>
          </div>
  
          <div style={{ marginBottom: "10px" }}>
            <label>난이도: </label>
            <select value={level} onChange={(e) => setLevel(e.target.value)}>
              <option value="beginner">초급</option>
              <option value="intermediate">중급</option>
              <option value="advanced">고급</option>
            </select>
          </div>
  
          <div style={{ marginBottom: "10px" }}>
            <label>말투: </label>
            <select value={formality} onChange={(e) => setFormality(e.target.value)}>
              <option value="polite">존댓말</option>
              <option value="casual">반말</option>
            </select>
          </div>
        </div>
  
        {/* 💬 채팅 로그 */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            marginBottom: "10px",
            padding: "10px",
            background: "#f4f4f4",
            borderRadius: "10px",
          }}
        >
          {chatLog.map((msg, i) => (
            <div key={i} style={{ marginBottom: "10px" }}>
              <strong>{msg.role === "user" ? "나" : "GPT"}:</strong> {msg.content}
            </div>
          ))}
        </div>
  
        {/* 입력창 + 버튼 */}
        <div>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="메시지를 입력하세요"
            style={{ width: "100%", padding: "8px", marginBottom: "10px" }}
          />
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <button onClick={() => handleSubmit()} style={{ flex: 1, marginRight: "10px" }}>
              보내기
            </button>
            <button onClick={handleVoiceInput} style={{ flex: 1 }}>
              🎤 음성 입력
            </button>
          </div>
        </div>
      </div>
    </div>
  );
  
}

export default App;
