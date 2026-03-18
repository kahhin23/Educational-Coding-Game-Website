(function() {
  // Firebase Configuration (Compat SDK for local file support)
  // Note: We use the Compat scripts in index.html, which expose the global 'firebase' object.
  
  const firebaseConfig = {
    apiKey: "AIzaSyB1_ft77gPzGdEhASxFImlRFQsmMzgBVo0",
    authDomain: "storyboard-database-d0857.firebaseapp.com",
    projectId: "storyboard-database-d0857",
    storageBucket: "storyboard-database-d0857.firebasestorage.app",
    messagingSenderId: "823909108661",
    appId: "1:823909108661:web:a1a91427bda277546f67fc",
    measurementId: "G-SDHPGSLXE7"
  };

  // Initialize Firebase
  const app = firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();
  const db = firebase.firestore();
  const googleProvider = new firebase.auth.GoogleAuthProvider();

  // Exporting functions/constants to window for global access (replaces ES Modules)
  window.firebaseAuth = {
      auth,
      db,
      googleProvider,
      signInWithPopup: (auth, provider) => auth.signInWithPopup(provider),
      onAuthStateChanged: (auth, callback) => auth.onAuthStateChanged(callback)
  };
})();
