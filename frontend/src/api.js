import { auth } from "./firebase";

const request = async (endpoint, options = {}) => {
  const token = await auth.currentUser?.getIdToken();

  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };
  
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

export const deleteMistake = (id) => request(`/review/mistakes/${id}`, { method: "DELETE" });

export const fetchProgress = () => request("/progress");

export const fetchQuizGenerate = (total=10) =>
  request("/quiz/generate", { method: "POST", body: JSON.stringify({ total }) });

export const fetchQuizDue = () => request("/quiz/due");

export const submitQuizAnswer = (itemId, userAnswer) =>
  request("/quiz/answer", { method: "POST", body: JSON.stringify({ itemId, userAnswer }) });

export const deleteQuizItem = (id) =>
  request(`/quiz/item/${id}`, { method: "DELETE" });

