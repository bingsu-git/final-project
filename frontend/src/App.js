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
  const [mistakeList, setMistakeList] = useState([]);

  useEffect(() => {
    // 새로고침 시 초기화
    window.addEventListener("beforeunload", () => {
      sessionStorage.removeItem("sessionId");
      sessionStorage.removeItem("initialized");
    });
    initSession();
  }, []);

  useEffect(() => {
    if (mode === "review") {
      fetch(`http://localhost:5000/review/mistakes/${sessionId}`)
        .then(res => res.json())
        .then(data => {
          console.log("mistake response:", data);
          setMistakeList(Array.isArray(data) ? data : []);
        })
        .catch(err => console.error("복습 데이터 오류:", err));
    }
  }, [mode, sessionId]);

  const initSession = () => {
    const newId = "session-" + Math.random().toString(36).substring(2, 10);
    sessionStorage.setItem("sessionId", newId);
    sessionStorage.setItem("initialized", "true");
    setSessionId(newId);
    setChatLog([]);
  };
  

  const playTTS = async (text) => {
    try {
      const res = await fetch("http://localhost:5000/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, languageCode: language, situation }),
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
    console.log("🎤 handleVoice 호출됨");
  
    if (listening) {
      console.log("이미 듣는 중이므로 종료");
      return;
    }
  
    recognition.lang = language;
    setListening(true);
    console.log("🎤 음성 인식 시작 시도: ", language);
    recognition.start();
  
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      console.log("📝 인식된 텍스트:", transcript);
      sendMessage(transcript);
      setListening(false);
    };
  
    recognition.onerror = (event) => {
      console.error("❌ 음성 인식 오류:", event.error);
      setListening(false);
    };
  
    recognition.onend = () => {
      console.log("🔚 음성 인식 종료됨");
      setListening(false);
    };
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

  const goToReview = () => {
    setMode("review");
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
      <h2>외국어 회화 시뮬레이션</h2>

      {mode === "select" && (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: "30px", gap: "15px" }}>
        <button
          onClick={() => selectLanguage("en-US")}
          style={{ width: "200px", padding: "10px 20px", fontSize: "16px" }}
        >
          영어
        </button>
        <button
          onClick={() => selectLanguage("ja-JP")}
          style={{ width: "200px", padding: "10px 20px", fontSize: "16px" }}
        >
          일본어
        </button>
      </div>
    )}

{mode === "review" && (
  <div style={{ padding: "20px" }}>
    <h3>복습하기</h3>
    {mistakeList.length === 0 ? (
      <p>저장된 틀린 표현이 없습니다.</p>
    ) : (
      mistakeList.map((item, idx) => (
        <div key={idx} style={{ marginBottom: "15px", borderBottom: "1px solid #ccc", paddingBottom: "10px" }}>
          <p><strong>내 문장:</strong> {item.original}</p>
          <p><strong>교정:</strong> {item.corrected}</p>
          {item.explanation && <p><strong>이유:</strong> {item.explanation}</p>}
        </div>
      ))
    )}
    <div style={{ marginTop: "20px", textAlign: "center" }}>
      <button onClick={backToLanguageSelect} style={{ fontSize: "14px", padding: "6px 12px" }}>
        다시 언어 선택으로
      </button>
    </div>
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
                이자캬야에서 만난 손님
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
          {mode === "en" && (
  <div style={{ marginBottom: "15px", display: "flex", gap: "10px" }}>
    <button
      onClick={() => selectSituation("airport-traveler")}
      style={{
        fontSize: "14px",
        padding: "6px 12px",
        backgroundColor: situation === "airport-traveler" ? "#d1e7dd" : "#fff",
        border: "1px solid #ccc",
      }}
    >
      공항에서 만난 여행자
    </button>
    {situation === "airport-traveler" && (
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

                    <div style={{ textAlign: "center", marginBottom: "15px" }}>
            <button onClick={goToReview} style={{ padding: "10px 20px", fontSize: "16px" }}>
              복습하기
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
