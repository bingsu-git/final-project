import React from 'react';
import { auth } from '../firebase';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';

// ✨ [디자인 복원] AuthView 스타일 객체
const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: 'calc(100vh - 200px)', // (헤더 등을 제외한 영역)
    textAlign: 'center',
    color: '#e0e0e0',
  },
  title: {
    fontSize: '2.5rem',
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: '16px',
  },
  subtitle: {
    fontSize: '1.2rem',
    color: '#aaa',
    marginBottom: '40px',
  },
  googleButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 24px',
    backgroundColor: '#ffffff',
    color: '#333',
    border: 'none',
    borderRadius: '8px',
    fontSize: '1rem',
    fontWeight: 'bold',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
    transition: 'all 0.2s',
  },
  googleIcon: { // (구글 아이콘 SVG)
    width: '20px',
    height: '20px',
  }
};

const GoogleIcon = () => (
  <svg style={styles.googleIcon} viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

function AuthView() {

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      // (onAuthStateChanged가 App.js에서 화면을 자동으로 바꿔줄 것입니다)
    } catch (error) {
      console.error("Google 로그인 실패:", error);
    }
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>챗버디 시작하기</h1>
      <p style={styles.subtitle}>AI와 함께하는 실전 회화 연습</p>
      <button style={styles.googleButton} onClick={handleGoogleLogin}>
        <GoogleIcon />
        Google 계정으로 로그인
      </button>
    </div>
  );
}

export default AuthView;