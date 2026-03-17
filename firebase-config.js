// Firebase Configuration
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-analytics.js";

const firebaseConfig = {
  apiKey: "AIzaSyB1_ft77gPzGdEhASxFImlRFQsmMzgBVo0",
  authDomain: "storyboard-database-d0857.firebaseapp.com",
  projectId: "storyboard-database-d0857",
  storageBucket: "storyboard-database-d0857.firebasestorage.app",
  messagingSenderId: "823909108661",
  appId: "1:823909108661:web:a1a91427bda277546f67fc",
  measurementId: "G-SDHPGSLXE7"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

export { auth, db, googleProvider, signInWithPopup, onAuthStateChanged };
