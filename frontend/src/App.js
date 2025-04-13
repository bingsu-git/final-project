import React, { useState, useEffect } from "react";

const getCachedData = (text) => {
  const raw = sessionStorage.getItem("translationCache");
  if (!raw) return null;
  const cache = JSON.parse(raw);
  return cache[text];
};

const setCachedData = (text, data) => {
  const raw = sessionStorage.getItem("translationCache");
  const cache = raw ? JSON.parse(raw) : {};
  cache[text] = data;
  sessionStorage.setItem("translationCache", JSON.stringify(cache));
};
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = new SpeechRecognition();
recognition.interimResults = false;
recognition.continuous = false;
recognition.maxAlternatives = 1;

const removeEmojis = (text) =>
  text.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|[\uD83C-\uDBFF\uDC00-\uDFFF]|\uFE0F|\u200D)+/g, '');

function App() {
  const [mode, setMode] = useState("select");
  const [sessionId, setSessionId] = useState("");
  const [chatLog, setChatLog] = useState([]);
  const [visibleExtras, setVisibleExtras] = useState({});
  const [listening, setListening] = useState(false);
  const [language, setLanguage] = useState("");
  const [situation, setSituation] = useState("");

  useEffect(() => {
    initSession();
  }, []);

  const initSession = () => {
    const newId = "session-" + Math.random().toString(36).substring(2, 10);
    sessionStorage.setItem("sessionId", newId);
    setSessionId(newId);
    setChatLog([]);
  };

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
      console.error("TTS 오류:", err);
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
        body: JSON.stringify({
          message: text,
          languageCode: language,
          sessionId,
          situation,
        }),
      });
      const data = await res.json();
      const gptMsg = {
        role: "assistant",
        content: data.response,
        translation: null,
        pronunciation: null,
      };
      setChatLog((prev) => [...prev, gptMsg]);
      await playTTS(removeEmojis(data.response));
    } catch (err) {
      console.error("GPT 오류:", err);
    }
  };

  const handleTranslateOnly = async (text, index) => {
    const cached = getCachedData(text);
    if (cached?.translation) {
      updateMessageWithExtras(index, cached.translation, undefined);
      return;
    }
  
    try {
      const res = await fetch("http://localhost:5000/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
  
      const data = await res.json();
      if (data.result) {
        const prev = getCachedData(text) || {};
        const updated = { ...prev, translation: data.result };
        setCachedData(text, updated);
        updateMessageWithExtras(index, data.result, prev.pronunciation);
      }
    } catch (err) {
      console.error("번역 오류:", err);
    }
  };
  
  const handlePronounceOnly = async (text, index) => {
    const cached = getCachedData(text);
    if (cached?.pronunciation) {
      updateMessageWithExtras(index, undefined, cached.pronunciation);
      return;
    }
  
    try {
      const res = await fetch("http://localhost:5000/pronounce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
  
      const data = await res.json();
      if (data.result) {
        const prev = getCachedData(text) || {};
        const updated = { ...prev, pronunciation: data.result };
        setCachedData(text, updated);
        updateMessageWithExtras(index, prev.translation, data.result);
      }
    } catch (err) {
      console.error("발음 오류:", err);
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

    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
  };
  
  const toggleExtra = async (index, type) => {
    const msg = chatLog[index];
  
    // 이미 표시 중이면 → 단순히 토글만
    if (visibleExtras[index]?.[type]) {
      setVisibleExtras((prev) => ({
        ...prev,
        [index]: {
          ...prev[index],
          [type]: false,
        },
      }));
      return;
    }
  
    // 표시 안 돼 있고, 데이터도 없음 → API 호출
    if (!msg[type]) {
      const endpoint = type === "translation" ? "translate" : "pronounce";
  
      try {
        const res = await fetch(`http://localhost:5000/${endpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: msg.content }),
        });
  
        const data = await res.json();
        if (data.result) {
          const updated = [...chatLog];
          updated[index] = {
            ...updated[index],
            [type]: data.result,
          };
          setChatLog(updated);
        }
      } catch (err) {
        console.error(`${type} 오류:`, err);
      }
    }
  
    // 토글 ON 처리
    setVisibleExtras((prev) => ({
      ...prev,
      [index]: {
        ...prev[index],
        [type]: true,
      },
    }));
  };
  
  

  const updateMessageWithExtras = (index, translation, pronunciation) => {
    setChatLog((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        translation: translation ?? updated[index].translation,
        pronunciation: pronunciation ?? updated[index].pronunciation,
      };
      return updated;
    });
  };
  

  const selectLanguage = (lang) => {
    initSession();
    setMode(lang === "ja-JP" ? "ja" : "en");
    setLanguage(lang);
    setSituation("");
  };

  const backToLanguageSelect = () => {
    initSession();
    setMode("select");
    setSituation("");
  };

  const selectSituation = (desc) => {
    setSituation(desc);
    initSession();
  };

  const cancelSituation = () => {
    setSituation("");
    initSession();
  };

  return (
    <div style={{ maxWidth: "600px", margin: "40px auto", fontFamily: "Arial" }}>
      <h2>외국어 회화 연습</h2>

      {mode === "select" && (
        <div style={{ textAlign: "center", marginTop: "30px" }}>
          <button onClick={() => selectLanguage("ja-JP")} style={{ padding: "10px 20px", marginBottom: "15px" }}>
            일본어로 연습하기
          </button>
          <br />
          <button onClick={() => selectLanguage("en-US")} style={{ padding: "10px 20px" }}>
            영어로 연습하기
          </button>
        </div>
      )}

      {mode !== "select" && (
        <>
          {mode === "ja" && (
            <div style={{ marginBottom: "15px", display: "flex", gap: "10px" }}>
              <button
                onClick={() => selectSituation("izakaya-banker")}
                style={{
                  fontSize: "14px",
                  padding: "6px 12px",
                  backgroundColor: situation ? "#d1e7dd" : "#fff",
                  border: "1px solid #ccc",
                }}
              >
                이자카야에서 만난 손님
              </button>
              {situation && (
                <button
                  onClick={cancelSituation}
                  style={{
                    fontSize: "14px",
                    padding: "6px 12px",
                    backgroundColor: "#f8d7da",
                    border: "1px solid #ccc",
                  }}
                >
                  취소
                </button>
              )}
            </div>
          )}

          <div style={{
            border: "1px solid #ccc",
            padding: "10px",
            height: "300px",
            overflowY: "auto",
            backgroundColor: "#f9f9f9",
            marginBottom: "15px"
          }}>
            {chatLog.map((msg, i) => (
            <div key={i} style={{ marginBottom: "10px" }}>
              <strong>{msg.role === "user" ? "나" : "GPT"}:</strong> {msg.content}

              {msg.role === "assistant" && (
                <div style={{ marginTop: "5px", fontSize: "0.9em" }}>
                  <button onClick={() => toggleExtra(i, "translation")} style={{ marginRight: "8px" }}>
                    번역
                  </button>
                  <button onClick={() => toggleExtra(i, "pronunciation")}>
                    발음
                  </button>



                  {visibleExtras[i]?.translation && msg.translation && (
                    <div style={{ marginTop: "5px", color: "#333" }}>
                      <strong>번역:</strong> {msg.translation}
                    </div>
                  )}

                  {visibleExtras[i]?.pronunciation && msg.pronunciation && (
                    <div style={{ marginTop: "3px", color: "#555" }}>
                      <strong>발음:</strong> {msg.pronunciation}
                    </div>
                  )}

                </div>
              )}
            </div>
          ))}

          </div>

          <div style={{ textAlign: "center", marginBottom: "15px" }}>
            <button onClick={handleVoice} style={{ padding: "10px 20px", fontSize: "16px" }}>
              음성 입력
            </button>
          </div>

          <div style={{ textAlign: "center" }}>
            <button onClick={backToLanguageSelect} style={{ fontSize: "14px", padding: "6px 12px" }}>
              다시 언어 선택으로
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default App;
