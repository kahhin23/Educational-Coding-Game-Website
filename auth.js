// auth.js — Handles login page authentication logic
import { auth, db, googleProvider, signInWithPopup, onAuthStateChanged }
    from './firebase-config.js';
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// --- DOM Elements ---
const btnGoogle = document.getElementById('btn-google');
const btnGuest  = document.getElementById('btn-guest');
const statusEl  = document.getElementById('auth-status');

// Initial load: setup stars
initStars();

// --- Auth State Handler ---
// This will be called on page load and after every sign-in/out
export function setupAuthListener(onUserAuthenticated, onUserLoggedOut) {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // Check if user exists in Firestore, if not create
            const playerDoc = await getPlayerData(user.uid);
            if (!playerDoc) {
                await createPlayerProfile(user);
            }
            onUserAuthenticated(user, false); // false = not a guest
        } else {
            // Check session storage for guest
            const guest = sessionStorage.getItem('pythonQuestUser');
            if (guest) {
                onUserAuthenticated(JSON.parse(guest), true); // true = is a guest
            } else {
                onUserLoggedOut();
            }
        }
    });
}

async function getPlayerData(uid) {
    const playerRef = doc(db, 'players', uid);
    const snap = await getDoc(playerRef);
    return snap.exists() ? snap.data() : null;
}

async function createPlayerProfile(user) {
    const playerRef = doc(db, 'players', user.uid);
    await setDoc(playerRef, {
        displayName: user.displayName,
        email:       user.email,
        photoURL:    user.photoURL,
        progress:    {},
        createdAt:   new Date(),
        xp: 0,
        level: 1
    });
}

// --- Interaction Handlers ---
btnGoogle.addEventListener('click', async () => {
    showStatus('loading', '<i class="fa-solid fa-spinner fa-spin"></i> Connecting to Google…');
    try {
        await signInWithPopup(auth, googleProvider);
        // onAuthStateChanged will handle the view switch
    } catch (err) {
        console.error(err);
        showStatus('error', '<i class="fa-solid fa-triangle-exclamation"></i> Sign-in failed.');
    }
});

btnGuest.addEventListener('click', () => {
    const guestUser = { displayName: 'Guest Explorer', type: 'guest' };
    sessionStorage.setItem('pythonQuestUser', JSON.stringify(guestUser));
    // Trigger manual start for guest since onAuthStateChanged won't fire
    window.dispatchEvent(new CustomEvent('guest-login', { detail: guestUser }));
});

function showStatus(type, html) {
    if (!statusEl) return;
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
