import React from 'react';

const styles = {
  wrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: 'calc(100vh - 200px)',
    color: '#e0e0e0',
  },
  title: {
    fontSize: '1.8rem',
    fontWeight: 'bold',
    marginBottom: '8px',
  },
  subtitle: {
    fontSize: '0.95rem',
    color: '#aaa',
    marginBottom: '32px',
  },
  cards: {
    display: 'flex',
    gap: '24px',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  card: {
    width: '220px',
    padding: '20px 18px',
    background: '#2c2c3e',
    borderRadius: '12px',
    border: '1px solid #444',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    transition: 'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease',
  },
  cardHover: {
    transform: 'translateY(-2px)',
    boxShadow: '0 6px 18px rgba(0,0,0,0.35)',
    borderColor: '#4A90E2',
  },
  flag: {
    fontSize: '2rem',
  },
  cardTitle: {
    fontSize: '1.05rem',
    fontWeight: 'bold',
    color: '#fff',
  },
  cardDesc: {
    fontSize: '0.85rem',
    color: '#bbb',
    textAlign: 'center',
    lineHeight: 1.5,
  },
};

function LanguageSelectView({ onSelect }) {
  const [hoverIndex, setHoverIndex] = React.useState(null);

  const cards = [
    {
      key: 'en',
      label: '영어 회화',
      flag: '🇺🇸',
      desc: '영어로 롤플레잉 대화를 연습합니다.',
      payload: { mode: 'roleplay', languageCode: 'en-US' },
    },
    {
      key: 'ja',
      label: '일본어 회화',
      flag: '🇯🇵',
      desc: '일본어로 롤플레잉 대화를 연습합니다.',
      payload: { mode: 'roleplay', languageCode: 'ja-JP' },
    },
    {
      key: 'rag',
      label: '법률 Q&A',
      flag: '📚',
      desc: '개인정보·전자상거래·저작권 등 법률을 질문합니다.',
      payload: { mode: 'rag', languageCode: 'ko-KR' },
    },
  ];

  return (
    <div style={styles.wrap}>
      <h3 style={styles.title}>연습할 언어 / 모드를 선택하세요</h3>
      <p style={styles.subtitle}>모드를 선택하면 다음 단계로 이동합니다.</p>
      <div style={styles.cards}>
        {cards.map((c, idx) => (
          <div
            key={c.key}
            style={{
              ...styles.card,
              ...(hoverIndex === idx ? styles.cardHover : {}),
            }}
            onMouseEnter={() => setHoverIndex(idx)}
            onMouseLeave={() => setHoverIndex(null)}
            onClick={() => onSelect(c.payload)}
          >
            <div style={styles.flag}>{c.flag}</div>
            <div style={styles.cardTitle}>{c.label}</div>
            <div style={styles.cardDesc}>{c.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default LanguageSelectView;
