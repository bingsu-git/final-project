import React from 'react';
import { signInWithGoogle } from '../firebase';

function AuthView() {
  const handleLogin = async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error("구글 로그인 실패:", error);
    }
  };

  return (
    <div className="auth-view">
      <div className="auth-card">
        <h3>챗버디 시작하기</h3>
        <p>구글 계정으로 로그인하고<br/>나만의 학습 기록을 관리해보세요.</p>
        <button className="btn btn-primary" onClick={handleLogin}>
          Google 계정으로 로그인
        </button>
      </div>
    </div>
  );
}

export default AuthView;
