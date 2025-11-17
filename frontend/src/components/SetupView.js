import React, { useState } from 'react';

const styles = {
  setupView: {
    maxWidth: '700px',
    margin: '40px auto',
    padding: '24px 32px',
    background: '#2c2c3e',
    borderRadius: '12px',
    color: '#e0e0e0',
    fontFamily: 'Arial, sans-serif',
    position: 'relative',
  },
  topRight: {
    position: 'absolute',
    top: '20px',
    right: '24px',
    fontSize: '0.8rem',
    background: 'transparent',
    border: '1px solid #555',
    borderRadius: '20px',
    padding: '6px 12px',
    color: '#ccc',
    cursor: 'pointer',
  },
  step: {
    marginBottom: '28px',
  },
  h3: {
    color: '#ffffff',
    borderBottom: '1px solid #444',
    paddingBottom: '8px',
    marginTop: '0px',
    fontSize: '1.25rem',
  },
  p: {
    marginTop: '8px',
    color: '#aaa',
    fontSize: '0.9rem',
    lineHeight: 1.5,
  },
  optionsContainer: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
  },
  btn: {
    background: 'transparent',
    border: '1px solid #555',
    color: '#e0e0e0',
    padding: '10px 16px',
    borderRadius: '20px',
    cursor: 'pointer',
    fontSize: '0.9rem',
    transition: 'all 0.2s',
  },
  btnSelected: {
    background: '#4A90E2',
    color: '#ffffff',
    borderColor: '#4A90E2',
    fontWeight: 'bold',
  },
  textarea: {
    width: '100%',
    height: '100px',
    background: 'rgba(0,0,0,0.2)',
    border: '1px solid #555',
    borderRadius: '8px',
    color: '#e0e0e0',
    padding: '12px',
    fontSize: '1rem',
    boxSizing: 'border-box',
    marginTop: '10px',
    fontFamily: 'Arial, sans-serif',
  },
  btnPrimary: {
    background: '#4A90E2',
    color: '#ffffff',
    fontWeight: 'bold',
    padding: '12px 20px',
    fontSize: '1rem',
    borderRadius: '25px',
    border: 'none',
    cursor: 'pointer',
    marginTop: '16px',
    transition: 'all 0.2s',
  },
};

function SetupView({ difficulty, setDifficulty, onStart, onResetLanguage }) {
  const [customSituationInput, setCustomSituationInput] = useState("");

  return (
    <div className="setup-view" style={styles.setupView}>
      <button style={styles.topRight} onClick={onResetLanguage}>
        모드 선택
      </button>

      <div className="step" style={styles.step}>
        <h3 style={styles.h3}>1. 대화 난이도를 선택하세요</h3>
        <div className="difficulty-options" style={styles.optionsContainer}>
          <button
            style={{ ...styles.btn, ...(difficulty === 'easy' ? styles.btnSelected : {}) }}
            onClick={() => setDifficulty('easy')}
          >
            쉬움
          </button>
          <button
            style={{ ...styles.btn, ...(difficulty === 'medium' ? styles.btnSelected : {}) }}
            onClick={() => setDifficulty('medium')}
          >
            보통
          </button>
          <button
            style={{ ...styles.btn, ...(difficulty === 'hard' ? styles.btnSelected : {}) }}
            onClick={() => setDifficulty('hard')}
          >
            어려움
          </button>
        </div>
      </div>

      <div className="step" style={styles.step}>
        <h3 style={styles.h3}>2. 어떤 상황에서 대화할까요? (선택)</h3>
        <p style={styles.p}>
          상황을 입력하지 않으면 AI가 친구처럼 자연스럽게 대화를 시작합니다.
        </p>
        <textarea
          style={styles.textarea}
          value={customSituationInput}
          onChange={(e) => setCustomSituationInput(e.target.value)}
          placeholder="예시: 저는 지금 스타벅스에 있고, 당신은 점원입니다. 저는 아이스 아메리카노를 주문하고 싶어요."
        />
        <button
          onClick={() => onStart(customSituationInput)}
          style={styles.btnPrimary}
        >
          대화 시작하기
        </button>
      </div>
    </div>
  );
}

export default SetupView;
