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

// ✅ 복습 아이템 한 개용 컴포넌트
function ReviewItem({ item, idx, guessInputs, setGuessInputs, showAnswers, setShowAnswers }) {

  const normalize = (str) => str.trim().toLowerCase().replace(/\s+/g, " ");

  return (
    <div style={{ marginBottom: "15px", borderBottom: "1px solid #ccc", paddingBottom: "10px" }}>
      <p><strong>틀린 문장:</strong> {item.original}</p>

      <input
        type="text"
        placeholder="내가 고쳐보기"
        value={guessInputs[idx] || ""}
        onChange={(e) =>
          setGuessInputs(prev => ({ ...prev, [idx]: e.target.value }))
        }
        style={{ width: "100%", padding: "5px", marginBottom: "10px" }}
      />

      <button
        onClick={() => {
          const isCorrect =
            normalize(guessInputs[idx] || "") === normalize(item.corrected);
          alert(isCorrect ? "정답입니다!" : "틀렸습니다!");
        }}
        style={{ marginRight: "10px" }}
      >
        맞춰보기
      </button>

      <button
        onClick={() =>
          setShowAnswers(prev => ({ ...prev, [idx]: !prev[idx] }))
        }
      >
        {showAnswers[idx] ? "답 숨기기" : "답 보기"}
      </button>

      {showAnswers[idx] && (
        <>
          <p style={{ marginTop: "10px" }}><strong>정답:</strong> {item.corrected}</p>
          {item.explanation && (
            <p><strong>이유:</strong> {item.explanation}</p>
          )}
        </>
      )}
    </div>
  );
}



function App() {
  const [mode, setMode] = useState("select");
  const [sessionId, setSessionId] = useState("");
  const [chatLog, setChatLog] = useState([]);
  const [visibleExtras, setVisibleExtras] = useState({});
  const [listening, setListening] = useState(false);
  const [language, setLanguage] = useState("");
  const [situation, setSituation] = useState(null); // 초기값을 null로 변경
  const [mistakeList, setMistakeList] = useState([]);
  const [progress, setProgress] = useState({ messageCount: 0, mistakeCount: 0 });
  const [guessInputs, setGuessInputs] = useState({});
  const [showAnswers, setShowAnswers] = useState({});
  const [customSituationInput, setCustomSituationInput] = useState("");
  // --- ✨ 새로운 기능 추가: 난이도 상태 ---
  const [difficulty, setDifficulty] = useState('medium');


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
          // --- ✨ 새로운 기능 추가: 난이도 정보 전송 ---
          difficulty,
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
      fetch(`http://localhost:5000/progress/${sessionId}`)
        .then(res => res.json())
        .then(data => setProgress(data))
        .catch(err => console.error("진행률 갱신 오류:", err));

      if (mode === "review") {
          fetch(`http://localhost:5000/review/mistakes/${sessionId}`)
            .then(res => res.json())
            .then(data => {
              console.log("mistake 갱신:", data);
              setMistakeList(Array.isArray(data) ? data : []);
            })
            .catch(err => console.error("복습 갱신 오류:", err));
        }


      await playTTS(removeEmojis(data.response));
    } catch (err) {
      console.error("GPT 오류:", err);
    }
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
  
    setVisibleExtras((prev) => ({
      ...prev,
      [index]: {
        ...prev[index],
        [type]: true,
      },
    }));
  };
  
  const selectLanguage = (lang) => {
    initSession();
    setMode(lang === "ja-JP" ? "ja" : "en");
    setLanguage(lang);
    setSituation(null); // 언어 선택 시 situation은 null로 초기화
  };

  const backToLanguageSelect = () => {
    initSession();
    setMode("select");
    setSituation(null);
  };

  const goToReview = () => {
    setMode("review");
  };

  const cancelSituation = () => {
    setSituation(null); // 상황 설정 화면으로 돌아가기
    initSession();
  };

  const startCustomSituation = () => {
    // 상황을 입력했든 안 했든, 대화를 시작하므로 situation을 입력값으로 설정
    // null은 '상황 설정 전', ""은 '상황 없이 대화 시작'을 의미
    setSituation(customSituationInput.trim());
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
            <ReviewItem
              key={idx}
              item={item}
              idx={idx}
              guessInputs={guessInputs}
              setGuessInputs={setGuessInputs}
              showAnswers={showAnswers}
              setShowAnswers={setShowAnswers}
            />
          ))
        )}
        <div style={{ marginTop: "20px", textAlign: "center" }}>
          <button onClick={backToLanguageSelect} style={{ fontSize: "14px", padding: "6px 12px" }}>
            다시 언어 선택으로
          </button>
        </div>
      </div>
    )}

    {/* 상황 설정 화면 (situation이 null일 때) */}
    {mode !== "select" && situation === null && (
      <div style={{ border: "1px solid #eee", padding: "20px", borderRadius: "8px", marginTop: "20px" }}>
        {/* --- ✨ 새로운 기능 추가: 난이도 선택 UI --- */}
        <div>
          <h3 style={{marginTop: 0}}>1. 대화 난이도를 선택하세요:</h3>
          <div style={{display: 'flex', gap: '10px', marginBottom: '20px'}}>
            <button onClick={() => setDifficulty('easy')} style={{backgroundColor: difficulty === 'easy' ? '#d1e7dd' : '#fff', border: '1px solid #ccc', padding: '8px 15px', borderRadius: '4px', cursor: 'pointer'}}>하 (쉬움)</button>
            <button onClick={() => setDifficulty('medium')} style={{backgroundColor: difficulty === 'medium' ? '#d1e7dd' : '#fff', border: '1px solid #ccc', padding: '8px 15px', borderRadius: '4px', cursor: 'pointer'}}>중 (보통)</button>
            <button onClick={() => setDifficulty('hard')} style={{backgroundColor: difficulty === 'hard' ? '#d1e7dd' : '#fff', border: '1px solid #ccc', padding: '8px 15px', borderRadius: '4px', cursor: 'pointer'}}>상 (어려움)</button>
          </div>
        </div>
        <hr style={{margin: '20px 0', border: 'none', borderTop: '1px solid #eee'}} />
        <div>
          <h3 style={{marginTop: 0}}>2. 어떤 상황에서 대화할까요?</h3>
          <p style={{marginTop: 0, color: '#666'}}>상황을 입력하지 않고 시작하면 AI가 친구처럼 대화를 시작합니다.</p>
          <textarea 
              value={customSituationInput}
              onChange={(e) => setCustomSituationInput(e.target.value)}
              placeholder="예시: 저는 지금 스타벅스에 있고, 당신은 점원입니다. 저는 아이스 아메리카노를 주문하고 싶어요."
              style={{width: '100%', minHeight: '80px', padding: '10px', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ccc'}}
          />
          <button onClick={startCustomSituation} style={{fontSize: "16px", padding: "10px 20px", marginTop: '10px', width: '100%', backgroundColor: '#0d6efd', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer'}}>
            대화 시작하기
          </button>
        </div>
      </div>
    )}

    {/* 대화창 화면 (situation이 null이 아닐 때) */}
    {mode !== "select" && situation !== null && (
        <>
        <div style={{ textAlign: "center", marginBottom: "15px" }}>
          <p>메시지 수: {progress.messageCount} | 틀린 표현 수: {progress.mistakeCount}</p>
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
            <button onClick={cancelSituation} style={{ fontSize: "14px", padding: "6px 12px", marginRight: '10px' }}>
              다른 상황 설정하기
            </button>
            <button onClick={backToLanguageSelect} style={{ fontSize: "14px", padding: "6px 12px" }}>
              언어 다시 선택하기
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default App;

