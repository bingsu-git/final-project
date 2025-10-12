import React from 'react';

function LanguageSelectView({ onSelectLanguage }) {
  return (
    <div className="language-select-view">
      <h3>연습할 언어를 선택하세요</h3>
      <div className="language-card" onClick={() => onSelectLanguage("en-US")}>
        <div className="flag">🇺🇸</div>
        <div>영어 (English)</div>
      </div>
      <div className="language-card" onClick={() => onSelectLanguage("ja-JP")}>
        <div className="flag">🇯🇵</div>
        <div>일본어 (日本語)</div>
      </div>
    </div>
  );
}

export default LanguageSelectView;

