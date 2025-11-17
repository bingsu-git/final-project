import { auth } from "./firebase";

// API 요청을 보내기 전에 인증 토큰을 헤더에 추가하는 래퍼 함수
const request = async (endpoint, options = {}) => {
  const token = await auth.currentUser?.getIdToken();

  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };
  
  // 로그인 상태일 때만 Authorization 헤더 추가
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`http://localhost:5000${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
};


export const fetchTTS = (body) => request("/speak", { method: "POST", body: JSON.stringify(body) });

export const fetchChatResponse = (body) => request("/chat", { method: "POST", body: JSON.stringify(body) });

export const fetchTranslation = (text) => request("/translate", { method: "POST", body: JSON.stringify({ text }) });

export const fetchPronunciation = (text) => request("/pronounce", { method: "POST", body: JSON.stringify({ text }) });

export const fetchMistakes = () => request("/review/mistakes");

// 복습 노트를 삭제하는 API 호출 함수
export const deleteMistake = (id) => request(`/review/mistakes/${id}`, { method: "DELETE" });

export const fetchProgress = () => request("/progress");

export const fetchQuizGenerate = (total=10) =>
  request("/quiz/generate", { method: "POST", body: JSON.stringify({ total }) });

export const fetchQuizDue = () => request("/quiz/due");

export const submitQuizAnswer = (itemId, userAnswer) =>
  request("/quiz/answer", { method: "POST", body: JSON.stringify({ itemId, userAnswer }) });

export const deleteQuizItem = (id) =>
  request(`/quiz/item/${id}`, { method: "DELETE" });

export const fetchRagResponse = (message) => 
  request("/chat-rag", { 
    method: "POST", 
    body: JSON.stringify({ message }) 
  });

  export const fetchAvatars = () => request("/profile/avatars");

export const updateAvatars = (body) =>
  request("/profile/avatars", { method: "POST", body: JSON.stringify(body) });

export const fetchExamples = (body) =>
  request("/examples", { method: "POST", body: JSON.stringify(body) });

export const fetchRagExamples = () =>
  request("/chat-rag/examples", { method: "GET" });

