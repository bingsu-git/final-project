import React, { useEffect, useState } from 'react';
import * as api from '../api';

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
  card: {
    background: '#2f3242',
    borderRadius: '12px',
    padding: '20px 20px 18px',
    border: '1px solid #444',
    position: 'relative',
  },
  cardCorrect: {
    borderColor: '#4CAF50',
  },
  cardWrong: {
    borderColor: '#D0021B',
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
  stem: {
    fontSize: '0.85rem',
    color: '#a9a9b8',
    marginBottom: '6px',
  },
  prompt: {
    fontSize: '1.1rem',
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: '14px',
    padding: '10px 12px',
    background: 'rgba(0,0,0,0.18)',
    borderRadius: '8px',
  },
  textarea: {
    width: '100%',
    height: '80px',
    background: 'rgba(0,0,0,0.25)',
    border: '1px solid #555',
    borderRadius: '8px',
    color: '#e0e0e0',
    padding: '10px 12px',
    fontSize: '0.95rem',
    boxSizing: 'border-box',
    fontFamily: 'Arial, sans-serif',
  },
  actions: {
    marginTop: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
  },
  btnPrimary: {
    background: '#4A90E2',
    color: '#ffffff',
    fontWeight: 'bold',
    padding: '9px 16px',
    fontSize: '0.9rem',
    borderRadius: '999px',
    border: 'none',
    cursor: 'pointer',
  },
  badge: {
    padding: '6px 12px',
    borderRadius: '15px',
    fontWeight: 'bold',
    fontSize: '0.85rem',
  },
  badgeOk: {
    background: '#4CAF50',
    color: 'white',
  },
  badgeNo: {
    background: '#D0021B',
    color: 'white',
  },
  feedback: {
    marginTop: '14px',
    paddingTop: '12px',
    borderTop: '1px solid #444',
    fontSize: '0.95rem',
  },
  pMuted: {
    fontSize: '0.8rem',
    color: '#888',
    marginTop: '6px',
  },
  empty: {
    textAlign: 'center',
    padding: '40px 10px',
    color: '#aaa',
    fontSize: '0.95rem',
  },
};

export default function QuizView({ onBack }) {
  const [items, setItems] = useState([]);
  const [answers, setAnswers] = useState({});
  const [results, setResults] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        let due = await api.fetchQuizDue();
        if (Array.isArray(due) && due.length === 0) {
          await api.fetchQuizGenerate(10);
          due = await api.fetchQuizDue();
        }
        setItems(Array.isArray(due) ? due : []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const submitOne = async (it, idx) => {
    const text = answers[idx] ?? '';
    if (!text.trim()) {
      console.warn('답을 입력하세요.');
      return;
    }
    try {
      const r = await api.submitQuizAnswer(it._id, text);
      setResults(prev => ({ ...prev, [idx]: r }));
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteQuiz = async (idToDelete) => {
    console.log('퀴즈 삭제 시도:', idToDelete);
    try {
      await api.deleteQuizItem(idToDelete);
      setItems(prev => prev.filter(item => item._id !== idToDelete));
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) return <div className="loading-spinner" />;

  return (
    <div className="quiz-wrap" style={styles.wrap}>
      <div className="view-header" style={styles.header}>
        <h3 style={styles.h3}>퀴즈</h3>
        <button style={styles.btnSecondary} onClick={onBack}>대화로 돌아가기</button>
      </div>

      {items.length === 0 ? (
        <p style={styles.empty}>풀어야 할 문제가 없습니다. 먼저 AI와 대화를 통해 틀린 문장을 조금 더 모아 보세요.</p>
      ) : (
        <div className="quiz-list" style={styles.list}>
          {items.map((it, idx) => {
            const r = results[idx];
            const judged = !!r;
            const ok = r?.correct;

            const cardStyle = {
              ...styles.card,
              ...(judged ? (ok ? styles.cardCorrect : styles.cardWrong) : {}),
            };

            return (
              <div key={it._id || idx} style={cardStyle}>
                <button
                  style={styles.deleteBtn}
                  title="이 문제 삭제"
                  onClick={() => handleDeleteQuiz(it._id)}
                >
                  ×
                </button>

                <div style={styles.stem}>{it.stem || '다음 문장을 올바르게 고치세요.'}</div>
                <div style={styles.prompt}>{it.prompt}</div>

                <textarea
                  style={styles.textarea}
                  placeholder="여기에 고친 문장을 입력하세요"
                  value={answers[idx] || ''}
                  onChange={(e) => setAnswers(p => ({ ...p, [idx]: e.target.value }))}
                  disabled={judged}
                />

                <div style={styles.actions}>
                  {!judged ? (
                    <button
                      style={styles.btnPrimary}
                      onClick={() => submitOne(it, idx)}
                    >
                      제출
                    </button>
                  ) : (
                    <span
                      style={{
                        ...styles.badge,
                        ...(ok ? styles.badgeOk : styles.badgeNo),
                      }}
                    >
                      {ok ? '정답' : '오답'}
                    </span>
                  )}
                </div>

                {judged && (
                  <div style={styles.feedback}>
                    {!ok && (
                      <p>
                        <strong>정답:</strong> {r.expected}
                      </p>
                    )}
                    {r.explanation && (
                      <p>
                        <strong>설명:</strong> {r.explanation}
                      </p>
                    )}
                    {r.nextDueAt && (
                      <p style={styles.pMuted}>
                        다음 복습 예정: {new Date(r.nextDueAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
