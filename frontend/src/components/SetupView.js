import React, { useState } from 'react';

function SetupView({ difficulty, setDifficulty, onStart }) {
  const [customSituationInput, setCustomSituationInput] = useState("");

  return (
    <div className="setup-view">
      <div className="step">
        <h3>1. 대화 난이도를 선택하세요</h3>
        <div className="difficulty-options">
          <button 
            className={`btn ${difficulty === 'easy' ? 'selected' : ''}`}
            onClick={() => setDifficulty('easy')}
          >
            쉬움
          </button>
          <button 
            className={`btn ${difficulty === 'medium' ? 'selected' : ''}`}
            onClick={() => setDifficulty('medium')}
          >
            보통
          </button>
          <button 
            className={`btn ${difficulty === 'hard' ? 'selected' : ''}`}
            onClick={() => setDifficulty('hard')}
          >
            어려움
          </button>
        </div>
      </div>
      
      <div className="step">
        <h3>2. 어떤 상황에서 대화할까요? (선택)</h3>
        <p style={{ marginTop: 0, color: '#666', fontSize: '0.9rem' }}>
          상황을 입력하지 않으면 AI가 친구처럼 대화를 시작합니다.
        </p>
        <textarea
          value={customSituationInput}
          onChange={(e) => setCustomSituationInput(e.target.value)}
          placeholder="예시: 저는 지금 스타벅스에 있고, 당신은 점원입니다. 저는 아이스 아메리카노를 주문하고 싶어요."
        />
        <button onClick={() => onStart(customSituationInput)} className="btn btn-primary">
          대화 시작하기
        </button>
      </div>
    </div>
  );
}

export default SetupView;

