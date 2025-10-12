// frontend/src/api.js

const API_BASE_URL = "http://localhost:5000";

// API 요청을 위한 기본 헬퍼 함수
async function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  try {
    const response = await fetch(url, { ...options, headers });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`API request failed for endpoint: ${endpoint}`, error);
    throw error;
  }
}

// 💬 GPT 대화 요청
export const fetchChatResponse = ({ message, languageCode, sessionId, situation, difficulty }) => {
  return request("/chat", {
    method: "POST",
    body: JSON.stringify({ message, languageCode, sessionId, situation, difficulty }),
  });
};

// 🗣️ TTS 음성 요청
export const fetchTTS = ({ text, languageCode, situation }) => {
  return request("/speak", {
    method: "POST",
    body: JSON.stringify({ text, languageCode, situation }),
  });
};

// 🌐 번역 요청
export const fetchTranslation = (text) => {
  return request("/translate", {
    method: "POST",
    body: JSON.stringify({ text }),
  });
};

// 🗣️ 발음 요청 (✨✨✨ 이 부분의 주소가 "/pronounce"로 수정되었습니다 ✨✨✨)
export const fetchPronunciation = (text) => {
  return request("/pronounce", { // <--- 여기가 "/translate"가 아닌 "/pronounce"여야 합니다.
    method: "POST",
    body: JSON.stringify({ text }),
  });
};

// 📊 진행률 요청
export const fetchProgress = (userId) => {
  return request(`/progress/${userId}`);
};

// ✅ 복습 데이터 요청
export const fetchMistakes = (userId) => {
  return request(`/review/mistakes/${userId}`);
};

