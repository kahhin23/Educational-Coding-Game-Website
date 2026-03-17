// auth.js — Handles login page authentication logic
import { auth, db, googleProvider, signInWithPopup, onAuthStateChanged }
    from './firebase-config.js';
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// --- DOM Elements ---
const btnGoogle = document.getElementById('btn-google');
const btnGuest  = document.getElementById('btn-guest');
const statusEl  = document.getElementById('auth-status');

// Star canvas background
initStars();

// If already signed-in (Google), redirect straight to game
onAuthStateChanged(auth, (user) => {
    if (user) {
        // Google user already authenticated — redirect
        window.location.href = 'index.html';
    }
});

// --- Google Sign-In ---
btnGoogle.addEventListener('click', async () => {
    showStatus('loading', '<i class="fa-solid fa-spinner fa-spin"></i> Connecting to Google…');
    try {
        const result = await signInWithPopup(auth, googleProvider);
        const user   = result.user;

        // Create/update Firestore player doc
        const playerRef = doc(db, 'players', user.uid);
        const playerDoc = await getDoc(playerRef);
        if (!playerDoc.exists()) {
            await setDoc(playerRef, {
                displayName: user.displayName,
                email:       user.email,
                photoURL:    user.photoURL,
                progress:    {},
                createdAt:   new Date()
            });
        }

        // onAuthStateChanged will fire and redirect automatically
    } catch (err) {
        console.error(err);
        showStatus('error', '<i class="fa-solid fa-triangle-exclamation"></i> Sign-in failed. Please try again.');
    }
});

// --- Guest Login ---
btnGuest.addEventListener('click', () => {
    // Mark session as guest (no Firebase auth needed)
    sessionStorage.setItem('pythonQuestUser', JSON.stringify({ type: 'guest' }));
    window.location.href = 'index.html';
});

// --- UI Helpers ---
function showStatus(type, html) {
    statusEl.innerHTML  = html;
    statusEl.className  = `auth-status show ${type}`;
}

// --- Star Canvas ---
function initStars() {
    const canvas = document.getElementById('star-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let stars = [];

    function resize() {
        canvas.width  = window.innerWidth;
        canvas.height = window.innerHeight;
    }

    function createStars(count) {
        stars = [];
        for (let i = 0; i < count; i++) {
            stars.push({
                x:      Math.random() * canvas.width,
                y:      Math.random() * canvas.height,
                r:      Math.random() * 1.2 + 0.2,
                alpha:  Math.random(),
                dAlpha: (Math.random() * 0.006 + 0.002) * (Math.random() > 0.5 ? 1 : -1)
            });
        }
    }

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (const s of stars) {
            s.alpha += s.dAlpha;
            if (s.alpha <= 0 || s.alpha >= 1) s.dAlpha *= -1;
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(165,180,252,${s.alpha})`;
            ctx.fill();
        }
        requestAnimationFrame(draw);
    }

    resize();
    createStars(160);
    draw();
    window.addEventListener('resize', () => { resize(); createStars(160); });
}
