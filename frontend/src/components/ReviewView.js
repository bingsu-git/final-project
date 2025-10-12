import React, { useState, useEffect } from 'react';
import * as api from "../api";

function ReviewItem({ item }) {
  const [guess, setGuess] = useState("");
  const [showAnswer, setShowAnswer] = useState(false);
  const [feedback, setFeedback] = useState(null); // 'correct', 'incorrect'

  const handleCheck = () => {
    const normalize = (str) => str.trim().toLowerCase().replace(/[.,!?]/g, "");
    const isCorrect = normalize(guess) === normalize(item.corrected);
    setFeedback(isCorrect ? 'correct' : 'incorrect');
    if(isCorrect) {
        setShowAnswer(true);
    }
  };

  return (
    <div className="review-item">
      <p><strong>틀린 문장:</strong> {item.original}</p>
      <input
        type="text"
        placeholder="내가 고쳐보기"
        value={guess}
        onChange={(e) => {
          setGuess(e.target.value);
          setFeedback(null); // Reset feedback when typing
        }}
      />
      <div className="controls">
        <button className="btn btn-primary" onClick={handleCheck}>맞춰보기</button>
        <button className="btn btn-secondary" onClick={() => setShowAnswer(!showAnswer)}>
          {showAnswer ? "답 숨기기" : "답 보기"}
        </button>
      </div>

      {feedback && (
        <div className={`feedback-message ${feedback}`}>
          {feedback === 'correct' ? "정답입니다! 🎉" : "아쉬워요, 다시 시도해보세요!"}
        </div>
      )}

      {showAnswer && (
        <div className="answer">
          <p><strong>정답:</strong> {item.corrected}</p>
          {item.explanation && <p><strong>이유:</strong> {item.explanation}</p>}
        </div>
      )}
    </div>
  );
}

function ReviewView({ sessionId, onBack }) {
  const [mistakeList, setMistakeList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMistakes = async () => {
      if (!sessionId) return;
      try {
        setLoading(true);
        const data = await api.fetchMistakes(sessionId);
        setMistakeList(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("복습 데이터 로딩 오류:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchMistakes();
  }, [sessionId]);

  return (
    <div className="review-view">
       <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
         <h3>틀린 표현 다시 보기</h3>
         <button className="btn btn-secondary" onClick={onBack}>대화로 돌아가기</button>
       </div>

      {loading ? (
        <p>복습 노트를 불러오는 중입니다...</p>
      ) : mistakeList.length === 0 ? (
        <p>저장된 틀린 표현이 없습니다.</p>
      ) : (
        mistakeList.map((item, idx) => (
          <ReviewItem key={item._id || idx} item={item} />
        ))
      )}
    </div>
  );
}

export default ReviewView;

