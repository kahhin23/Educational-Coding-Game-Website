// app.js
import { setupAuthListener } from './auth.js';
import { db, auth } from './firebase-config.js';
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { signOut } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

// --- Global State ---
let pyodideInstance = null;
let currentStageId = null;
let currentMode = 'learn';
let currentUser = null;
let isGuest = false;

// --- Course Data ---
const courseData = {
    stages: [
        {
            id: 'stage-1',
            title: '1. The Awakening',
            locked: false,
            learningContent: `
                <p>Welcome to <strong>Python Quest</strong>. In this world, you control the elements using a powerful language.</p>
                <p>To begin your journey, you must first prove you can speak to the console.</p>
                <p>The standard way to make the console speak is by using the <span class="inline-code">print()</span> function.</p>
                <p>For example: <span class="inline-code">print("I am alive!")</span></p>
            `,
            mcq: {
                question: 'Which of the following is the correct way to make the console say "Hello"?',
                options: [
                    'console.log("Hello")',
                    'print("Hello")',
                    'say Hello',
                    'echo "Hello"'
                ],
                correctIndex: 1
            },
            codingChallenge: {
                prompt: 'Write a Python program that prints exactly: <strong>Hello World</strong>',
                expectedOutput: 'Hello World\n'
            }
        },
        {
            id: 'stage-2',
            title: '2. Storing Energy',
            locked: true,
            learningContent: '<p>You have learned to speak. Now you must learn to remember variables...</p><p>Variables are used to store calculations or values. For example: <span class="inline-code">x = 5</span></p>',
            mcq: { question: 'How do you assign the value 10 to a variable named energy?', options: ['energy := 10', 'energy = 10', 'set energy to 10'], correctIndex: 1 },
            codingChallenge: { prompt: 'Create a variable named <strong>power</strong> and set it to <strong>9000</strong>, then print it.', expectedOutput: '9000\n' }
        },
        {
            id: 'stage-3',
            title: '3. Making Choices',
            locked: true,
            learningContent: '<p>The path splits. Use <span class="inline-code">if</span> statements to make decisions.</p>',
            mcq: { question: 'Coming soon...', options: ['A'], correctIndex: 0 },
            codingChallenge: { prompt: 'Coming soon...', expectedOutput: '' }
        }
    ]
};

// --- DOM Elements ---
const viewLogin = document.getElementById('view-login');
const gameContainer = document.getElementById('game-container');
const viewMap = document.getElementById('view-map');
const viewStage = document.getElementById('view-stage');
const stageNodesWrapper = document.getElementById('stage-nodes-wrapper');

const btnBackMap = document.getElementById('btn-back-map');
const btnSignOut = document.getElementById('btn-signout');
const stageTitleEl = document.getElementById('stage-title');

// Left Panel Modes
const learningContentEl = document.getElementById('learning-content');
const codingInstructionsEl = document.getElementById('coding-instructions');
const codingPromptEl = document.getElementById('coding-prompt');
const expectedOutputTextEl = document.getElementById('expected-output-text');

// Right Panel Modes
const mcqContainer = document.getElementById('mcq-container');
const editorContainer = document.getElementById('editor-container');
const mcqQuestionEl = document.getElementById('mcq-question');
const mcqOptionsEl = document.getElementById('mcq-options');
const mcqFeedbackEl = document.getElementById('mcq-feedback');

// Python Editor
const codeEditor = document.getElementById('code-editor');
const consoleOutput = document.getElementById('console-output');
const btnRun = document.getElementById('btn-run');
const editorFeedbackEl = document.getElementById('editor-feedback');

// --- Initialization ---
async function init() {
    initEventListeners();
    await initPyodide();

    // Setup Auth
    setupAuthListener(startSession, endSession);
    
    // Listen for Guest login
    window.addEventListener('guest-login', (e) => startSession(e.detail, true));
}

async function startSession(user, guestMode = false) {
    currentUser = user;
    isGuest = guestMode;
    
    // Logic: Hide login, show game
    viewLogin.classList.remove('active-view');
    viewLogin.style.display = 'none';
    gameContainer.style.display = 'block';
    
    // Fetch persistence if not guest
    if (!isGuest) {
        await fetchProgress();
    }
    
    renderMap();
    switchView(viewMap);
}

function endSession() {
    currentUser = null;
    isGuest = false;
    
    // Reset Progress in memory
    resetCourseData();
    
    // Reset UI
    gameContainer.style.display = 'none';
    viewLogin.style.display = 'flex';
    viewLogin.classList.add('active-view');
    
    // Reset Header UI
    document.querySelector('.level-badge').textContent = 'Lvl 1';
    document.querySelector('.user-progress').childNodes[1].textContent = 'XP: 0/100';
}

function resetCourseData() {
    courseData.stages.forEach((stage, idx) => {
        stage.completed = false;
        stage.locked = idx === 0 ? false : true;
    });
}

async function fetchProgress() {
    try {
        const playerRef = doc(db, 'players', currentUser.uid);
        const snap = await getDoc(playerRef);
        if (snap.exists()) {
            const data = snap.data();
            const progress = data.progress || {};
            // Update courseData
            courseData.stages.forEach(stage => {
                if (progress[stage.id]) {
                    stage.completed = true;
                    stage.locked = false;
                }
            });
            // Unlock next stage logic
            for (let i = 0; i < courseData.stages.length - 1; i++) {
                if (courseData.stages[i].completed) {
                    courseData.stages[i+1].locked = false;
                }
            }
            
            // Update XP/Level UI
            document.querySelector('.level-badge').textContent = `Lvl ${data.level || 1}`;
            document.querySelector('.user-progress').childNodes[1].textContent = `XP: ${data.xp || 0}/100`;
        }
    } catch (err) {
        console.error("Error fetching progress:", err);
    }
}

async function saveProgress(stageId) {
    if (isGuest) return;
    try {
        const playerRef = doc(db, 'players', currentUser.uid);
        const snap = await getDoc(playerRef);
        let currentXP = 0;
        let currentLevel = 1;

        if (snap.exists()) {
            currentXP = snap.data().xp || 0;
            currentLevel = snap.data().level || 1;
        }

        // Add 50 XP per stage
        currentXP += 50;
        if (currentXP >= 100) {
            currentXP -= 100;
            currentLevel += 1;
        }

        await updateDoc(playerRef, {
            [`progress.${stageId}`]: true,
            xp: currentXP,
            level: currentLevel
        });

        // Update UI
        document.querySelector('.level-badge').textContent = `Lvl ${currentLevel}`;
        document.querySelector('.user-progress').childNodes[1].textContent = `XP: ${currentXP}/100`;
    } catch (err) {
        console.error("Error saving progress:", err);
    }
}

async function initPyodide() {
    if (!btnRun) return;
    btnRun.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Loading Engine...';
    btnRun.disabled = true;
    try {
        pyodideInstance = await loadPyodide();
        btnRun.innerHTML = '<i class="fa-solid fa-play"></i> Run Code';
        btnRun.disabled = false;
    } catch (err) {
        console.error('Failed to load Pyodide', err);
    }
}

// --- Map View Logic ---
function renderMap() {
    stageNodesWrapper.innerHTML = '';
    courseData.stages.forEach((stage, index) => {
        const node = document.createElement('div');
        node.className = `stage-node ${stage.locked ? 'locked' : ''} ${stage.completed ? 'completed' : ''}`;
        node.setAttribute('data-title', stage.title);
        node.textContent = index + 1;
        node.addEventListener('click', () => {
            if (!stage.locked) openStage(stage.id);
        });
        stageNodesWrapper.appendChild(node);
    });
}

function openStage(stageId) {
    currentStageId = stageId;
    const stageData = courseData.stages.find(s => s.id === stageId);
    stageTitleEl.textContent = stageData.title;
    learningContentEl.innerHTML = stageData.learningContent;
    mcqQuestionEl.textContent = stageData.mcq.question;
    renderMCQOptions(stageData.mcq);
    hideFeedback(mcqFeedbackEl);
    codingPromptEl.innerHTML = stageData.codingChallenge.prompt;
    expectedOutputTextEl.textContent = stageData.codingChallenge.expectedOutput;
    codeEditor.value = '';
    consoleOutput.textContent = '';
    hideFeedback(editorFeedbackEl);
    switchView(viewStage);
    setMode('learn');
}

function renderMCQOptions(mcqData) {
    mcqOptionsEl.innerHTML = '';
    mcqData.options.forEach((opt, index) => {
        const div = document.createElement('div');
        div.className = 'mcq-option';
        div.textContent = opt;
        div.addEventListener('click', () => handleMCQAnswer(index, mcqData.correctIndex, div));
        mcqOptionsEl.appendChild(div);
    });
}

function handleMCQAnswer(selectedIndex, correctIndex, optionElement) {
    if (selectedIndex === correctIndex) {
        optionElement.classList.add('correct');
        showFeedback(mcqFeedbackEl, 'Correct! Concept verified.', 'success');
        setTimeout(() => setMode('code'), 1000);
    } else {
        optionElement.classList.add('incorrect');
        showFeedback(mcqFeedbackEl, 'Incorrect. Review the content.', 'error');
    }
}

async function runPythonCode() {
    const code = codeEditor.value;
    const stageData = courseData.stages.find(s => s.id === currentStageId);
    const expectedOutput = stageData.codingChallenge.expectedOutput;
    consoleOutput.textContent = '';
    let output = '';
    pyodideInstance.setStdout({ batched: (str) => { output += str + '\n'; consoleOutput.textContent += str + '\n'; }});
    try {
        await pyodideInstance.runPythonAsync(code);
        if (output === expectedOutput) {
            showFeedback(editorFeedbackEl, 'Success! Stage completed.', 'success');
            markStageCompleted(currentStageId);
            await saveProgress(currentStageId);
            setTimeout(() => { switchView(viewMap); renderMap(); }, 1500);
        } else {
            showFeedback(editorFeedbackEl, 'Output does not match.', 'error');
        }
    } catch (err) {
        consoleOutput.textContent += err.toString();
        showFeedback(editorFeedbackEl, 'Error', 'error');
    }
}

function markStageCompleted(stageId) {
    const idx = courseData.stages.findIndex(s => s.id === stageId);
    if (idx > -1) {
        courseData.stages[idx].completed = true;
        if (idx + 1 < courseData.stages.length) courseData.stages[idx+1].locked = false;
    }
}

function switchView(target) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active-view'));
    target.classList.add('active-view');
}

function setMode(mode) {
    currentMode = mode;
    if (mode === 'learn') {
        learningContentEl.classList.add('active-mode'); mcqContainer.classList.add('active-mode');
        codingInstructionsEl.classList.remove('active-mode'); editorContainer.classList.remove('active-mode');
    } else {
        learningContentEl.classList.remove('active-mode'); mcqContainer.classList.remove('active-mode');
        codingInstructionsEl.classList.add('active-mode'); editorContainer.classList.add('active-mode');
    }
}

function showFeedback(el, text, type) { el.textContent = text; el.className = `feedback-msg show ${type}`; }
function hideFeedback(el) { el.className = 'feedback-msg'; }

function initEventListeners() {
    btnBackMap?.addEventListener('click', () => { switchView(viewMap); renderMap(); });
    btnRun?.addEventListener('click', runPythonCode);
    btnSignOut?.addEventListener('click', async () => {
        sessionStorage.removeItem('pythonQuestUser');
        await signOut(auth);
        endSession();
    });
}

init();
