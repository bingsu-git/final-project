import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";

// 여기에 Firebase 콘솔에서 복사한 firebaseConfig 객체를 붙여넣으세요.
const firebaseConfig = {
  apiKey: "AIzaSyDVb7OCtzB0-J96u_rZw160bpttExu6eJY",
  authDomain: "lgb-finalproject.firebaseapp.com",
  projectId: "lgb-finalproject",
  storageBucket: "lgb-finalproject.firebasestorage.app",
  messagingSenderId: "786976432365",
  appId: "1:786976432365:web:cd4344fb7f767853352ce4",
  measurementId: "G-NZ9W10C91Q"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();

export const signInWithGoogle = () => {
  return signInWithPopup(auth, provider);
};

export const logout = () => {
  return signOut(auth);
};

