import React, { useState, useEffect } from 'react';
import * as api from "../api";

// ✨ 통일된 다크모드 스타일
const styles = {
  wrap: {
    maxWidth: '820px',
    margin: '40px auto',
    padding: '28px 32px 32px',
    background: '#2c2c3e',
    borderRadius: '16px',
    border: '1px solid #3b3b4d',
    boxShadow: '0 14px 30px rgba(0,0,0,0.45)',
    color: '#e0e0e0',
    fontFamily: 'Arial, sans-serif',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #3a3a4a',
    paddingBottom: '12px',
    marginBottom: '20px',
  },
  h3: {
    color: '#ffffff',
    margin: 0,
    fontSize: '1.4rem',
    fontWeight: 'bold',
  },
  btnSecondary: {
    background: 'transparent',
    color: '#e0e0e0',
    border: '1px solid #555',
    padding: '8px 14px',
    borderRadius: '16px',
    cursor: 'pointer',
    fontSize: '0.85rem',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  item: {
    background: '#2f3242',
    borderRadius: '12px',
    padding: '20px 20px 18px',
    border: '1px solid #444',
    position: 'relative',
  },
  deleteBtn: {
    position: 'absolute',
    top: '10px',
    right: '12px',
    background: 'transparent',
    border: 'none',
    color: '#888',
    fontSize: '1.4rem',
    cursor: 'pointer',
    padding: 0,
    lineHeight: 1,
  },
  label: {
    display: 'inline-block',
    fontSize: '0.75rem',
    padding: '3px 8px',
    borderRadius: '999px',
    background: '#3b3f52',
    color: '#cdd4f5',
    marginBottom: '6px',
  },
  pOriginal: {
    fontSize: '1rem',
    color: '#e0e0e0',
    margin: '0 0 14px 0',
    lineHeight: 1.6,
  },
  buttonsContainer: {
    marginTop: '4px',
  },
  btnPrimary: {
    background: '#4A90E2',
    color: '#ffffff',
    fontWeight: 'bold',
    padding: '9px 15px',
    fontSize: '0.9rem',
    borderRadius: '999px',
    border: 'none',
    cursor: 'pointer',
  },
  answerBox: {
    marginTop: '16px',
    paddingTop: '14px',
    borderTop: '1px solid #444',
  },
  pCorrectLabel: {
    display: 'inline-block',
    fontSize: '0.75rem',
    padding: '3px 8px',
    borderRadius: '999px',
    background: '#164d30',
    color: '#aee8c2',
    marginBottom: '6px',
  },
  pCorrect: {
    fontSize: '1rem',
    fontWeight: 'bold',
    color: '#e6ffe9',
    margin: '0 0 10px 0',
  },
  pExplanation: {
    fontSize: '0.95rem',
    color: '#e0e0e0',
    margin: 0,
    lineHeight: 1.6,
  },
  emptyState: {
    textAlign: 'center',
    padding: '40px 10px',
    color: '#aaa',
    fontSize: '0.95rem',
    lineHeight: 1.6,
  }
};

function ReviewView({ onBack }) {
  const [mistakeList, setMistakeList] = useState([]);
  const [showAnswer, setShowAnswer] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadMistakes = async () => {
      setLoading(true);
      try {
        const data = await api.fetchMistakes();
        setMistakeList(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("복습 데이터 로딩 오류:", err);
      } finally {
        setLoading(false);
      }
    };
    loadMistakes();
  }, []);

  const handleDeleteMistake = async (idToDelete) => {
    console.log('복습 노트 삭제 시도:', idToDelete);
    try {
      await api.deleteMistake(idToDelete);
      setMistakeList(prevList => prevList.filter(item => item._id !== idToDelete));
    } catch (err) {
      console.error("복습 노트 삭제 실패:", err);
    }
  };

  if (loading) {
    return <div className="loading-spinner"></div>;
  }

  return (
    <div className="review-view" style={styles.wrap}>
      <div className="view-header" style={styles.header}>
        <h3 style={styles.h3}>틀린 표현 복습하기</h3>
        <button onClick={onBack} style={styles.btnSecondary}>대화로 돌아가기</button>
      </div>

      <div className="review-list" style={styles.list}>
        {mistakeList.length === 0 ? (
          <div style={styles.emptyState}>
            <p>저장된 틀린 표현이 없습니다.</p>
            <p style={{ color: '#888', marginTop: '6px' }}>
              AI와 대화하면서 틀린 문장을 모아 나만의 복습 노트를 만들어 보세요.
            </p>
          </div>
        ) : (
          mistakeList.map((item, idx) => (
            <div key={item._id || idx} style={styles.item}>
              <button
                style={styles.deleteBtn}
                title="이 노트 삭제"
                onClick={() => handleDeleteMistake(item._id)}
              >
                ×
              </button>

              <div style={styles.label}>내가 쓴 문장</div>
              <p style={styles.pOriginal}>{item.original}</p>

              <div style={styles.buttonsContainer}>
                <button
                  style={styles.btnPrimary}
                  onClick={() => setShowAnswer(prev => ({ ...prev, [idx]: !prev[idx] }))}
                >
                  {showAnswer[idx] ? "정답 접기" : "정답 및 해설 보기"}
                </button>
              </div>

              {showAnswer[idx] && (
                <div style={styles.answerBox}>
                  <div style={styles.pCorrectLabel}>올바른 문장</div>
                  <p style={styles.pCorrect}>{item.corrected}</p>
                  {item.explanation && (
                    <p style={styles.pExplanation}>
                      <strong>설명:</strong> {item.explanation}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default ReviewView;
