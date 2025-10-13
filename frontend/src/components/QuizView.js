import React, { useEffect, useState } from 'react';
import * as api from '../api';

export default function QuizView({ onBack }) {
  const [items, setItems] = useState([]);
  const [answers, setAnswers] = useState({});
  const [results, setResults] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        // 오늘 풀 항목
        let due = await api.fetchQuizDue();
        if (Array.isArray(due) && due.length === 0) {
          // 없으면 생성 후 다시 로드
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
    if (!text.trim()) return alert('수정한 문장을 입력하세요.');
    try {
      const r = await api.submitQuizAnswer(it._id, text);
      setResults(prev => ({ ...prev, [idx]: r }));
    } catch (e) {
      console.error(e);
      alert('제출 실패');
    }
  };

  if (loading) return <div className="loading-spinner" />;

  return (
    <div className="quiz-wrap">
      <div className="view-header">
        <h3>퀴즈</h3>
        <button className="btn btn-secondary" onClick={onBack}>뒤로</button>
      </div>

      {items.length === 0 ? (
        <p>풀어야 할 문제가 없습니다.</p>
      ) : (
        <div className="quiz-list">
          {items.map((it, idx) => {
            const r = results[idx];
            const judged = !!r;
            const ok = r?.correct;

            return (
            <div key={it._id || idx} className={`quiz-card ${judged ? (ok ? 'correct' : 'wrong') : ''}`}>
              <button
                className="quiz-delete"
                title="이 문제 삭제"
                onClick={async () => {
                  if (!window.confirm('이 문제를 삭제할까요?')) return;
                  try {
                    await api.deleteQuizItem(it._id);
                    setItems(prev => prev.filter((_, i) => i !== idx));
                  } catch (e) {
                    console.error(e); alert('삭제 실패');
                  }
                }}
              >×</button>
                <div className="quiz-stem">{it.stem || '다음 문장을 올바르게 고치세요.'}</div>
                <div className="quiz-prompt">{it.prompt}</div>

                <textarea
                  className="quiz-input"
                  placeholder="여기에 고친 문장을 입력하세요"
                  value={answers[idx] || ''}
                  onChange={(e)=> setAnswers(p => ({ ...p, [idx]: e.target.value }))}
                  disabled={judged}
                />

                <div className="quiz-actions">
                  {!judged ? (
                    <button className="btn btn-primary" onClick={() => submitOne(it, idx)}>제출</button>
                  ) : (
                    <span className={`badge ${ok ? 'ok' : 'no'}`}>{ok ? '정답' : '오답'}</span>
                  )}
                </div>

                {judged && (
                  <div className="quiz-feedback">
                    {!ok && <p><strong>정답:</strong> {r.expected}</p>}
                    {r.explanation && <p><strong>설명:</strong> {r.explanation}</p>}
                    {r.nextDueAt && (
                      <p className="muted">다음 복습: {new Date(r.nextDueAt).toLocaleString()}</p>
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
