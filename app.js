(function() {
    // app.js
    // Accessing globals from firebase-config.js and auth.js
    const { auth, db } = window.firebaseAuth;
    const { setupAuthListener, clearAuthStatus } = window.authApp;

    // --- Global State ---
    let pyodideInstance = null;
    let currentStageId = null;
    let currentMode = 'learn';
    let currentUser = null;
    let isGuest = false;
    let currentChapter = 1;
    let selectedCourseId = null;
    const STAGES_PER_CHAPTER = 20;

    // --- Course List Data ---
    const courseList = {
        'python': {
            title: 'Python Quest',
            tag: 'Master the Serpent',
            icon: 'fa-brands fa-python',
            description: 'Embark on an epic journey to master Python. From the basics of printing to advanced AI integration, this course guided by stages will make you a pro.',
            highlights: ['Interactive Stages', 'Python Console', 'AI Code Review', 'Real-time Logic'],
            entryPath: 'map'
        },
        'csharp': {
            title: 'C# Vanguard',
            tag: 'Next Gen Systems',
            icon: 'fa-solid fa-hashtag',
            description: 'Deep dive into the world of .NET and system architecture. Perfect for game development with Unity and robust enterprise applications.',
            highlights: ['OOP mastery', 'Unity Integration', 'Type Safety', 'High Performance'],
            entryPath: 'direct'
        },
        'cpp': {
            title: 'C++ Architect',
            tag: 'Core Power',
            icon: 'fa-solid fa-c',
            description: 'The foundation of modern computing. C++ gives you the power to build operating systems, game engines, and high-performance software.',
            highlights: ['Memory Management', 'Pointers & References', 'Templates', 'Speed Optimization'],
            entryPath: 'direct'
        }
    };

    // --- Course Data (Programmatically Generated) ---
    const courseData = {
        stages: []
    };

    // Programmatically generate 1000 stages
    function generateStages(count = 1000) {
        const tutorialStages = [
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
                    options: ['console.log("Hello")', 'print("Hello")', 'say Hello', 'echo "Hello"'],
                    correctIndex: 1
                },
                codingChallenge: {
                    prompt: 'Write a Python program that prints exactly: <strong>Hello World</strong>',
                    expectedOutput: 'Hello World\n'
                },
                paid: true // Stage 1 is free
            },
            {
                id: 'stage-2',
                title: '2. Storing Energy',
                locked: true,
                paid: false,
                learningContent: '<p>You have learned to speak. Now you must learn to remember variables...</p><p>Variables are used to store calculations or values. For example: <span class="inline-code">x = 5</span></p>',
                mcq: { question: 'How do you assign the value 10 to a variable named energy?', options: ['energy := 10', 'energy = 10', 'set energy to 10'], correctIndex: 1 },
                codingChallenge: { prompt: 'Create a variable named <strong>power</strong> and set it to <strong>9000</strong>, then print it.', expectedOutput: '9000\n' }
            }
        ];

        courseData.stages = [...tutorialStages];

        for (let i = courseData.stages.length + 1; i <= count; i++) {
            courseData.stages.push({
                id: `stage-${i}`,
                title: `${i}. Quest of Knowledge`,
                locked: true,
                paid: false, // Default to unpaid
                learningContent: `<p>You have reached stage ${i}. Continue your journey through the Python realm to unlock deeper secrets of the craft.</p>`,
                mcq: {
                    question: `A quick check for Stage ${i}: How do you output text?`,
                    options: ['print("Hello")', 'echo "Hello"', 'say "Hello"'],
                    correctIndex: 0
                },
                codingChallenge: {
                    prompt: `Print the number <strong>${i}</strong> to complete this stage.`,
                    expectedOutput: `${i}\n`
                }
            });
        }
    }
    // Generate stages immediately
    generateStages(1000);

    // --- DOM Elements ---
    const viewLogin = document.getElementById('view-login');
    const gameContainer = document.getElementById('game-container');
    const viewCourseSelection = document.getElementById('view-course-selection');
    const courseItemsEl = document.getElementById('course-items');
    const courseIntroContentEl = document.getElementById('course-intro-content');
    const introActionsEl = document.querySelector('.intro-actions');
    const btnEnterCourse = document.getElementById('btn-enter-course');
    const btnBackCourses = document.getElementById('btn-back-courses');

    const viewMap = document.getElementById('view-map');
    const viewStage = document.getElementById('view-stage');
    const stageNodesWrapper = document.getElementById('stage-nodes-wrapper');
    const btnPrevChapter = document.getElementById('btn-prev-chapter');
    const btnNextChapter = document.getElementById('btn-next-chapter');
    const currentChapterNameEl = document.getElementById('current-chapter-name');
    const chapterRangeEl = document.getElementById('chapter-range');
    const inputJumpStage = document.getElementById('input-jump-stage');
    const btnJumpStage = document.getElementById('btn-jump-stage');

    // Payment Elements
    const paymentOverlay = document.getElementById('payment-overlay');
    const paymentStageTitle = document.getElementById('payment-stage-title');
    const btnPayNow = document.getElementById('btn-pay-now');
    const btnCancelPayment = document.getElementById('btn-cancel-payment');

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
        
        clearAuthStatus();
        
        // Land on Course Selection
        renderCourseSelection();
        switchView(viewCourseSelection);
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

        clearAuthStatus();
    }

    function resetCourseData() {
        courseData.stages.forEach((stage, idx) => {
            stage.completed = false;
            stage.locked = idx === 0 ? false : true;
            stage.paid = idx === 0 ? true : false;
        });
    }

    async function fetchProgress() {
        try {
            const playerRef = firebase.firestore().doc(`players/${currentUser.uid}`);
            const snap = await playerRef.get();
            if (snap.exists) {
                const data = snap.data();
                const progress = data.progress || {};
                // Update courseData
                courseData.stages.forEach((stage, idx) => {
                    if (progress[stage.id]) {
                        stage.completed = true;
                        stage.locked = false;
                        stage.paid = true; // Completed stages must have been paid
                    }
                    if (idx === 0) stage.paid = true; // Stage 1 is always free
                });
                // Unlock next stage logic
                for (let i = 0; i < courseData.stages.length - 1; i++) {
                    if (courseData.stages[i].completed) {
                        courseData.stages[i+1].locked = false;
                        // stage[i+1].paid remains false if it wasn't already paid/completed
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
            const playerRef = firebase.firestore().doc(`players/${currentUser.uid}`);
            const snap = await playerRef.get();
            let currentXP = 0;
            let currentLevel = 1;

            if (snap.exists) {
                currentXP = snap.data().xp || 0;
                currentLevel = snap.data().level || 1;
            }

            // Add 50 XP per stage
            currentXP += 50;
            if (currentXP >= 100) {
                currentXP -= 100;
                currentLevel += 1;
            }

            await playerRef.update({
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

    // --- Course Selection Logic ---
    function renderCourseSelection() {
        courseItemsEl.innerHTML = '';
        btnBackCourses.style.display = 'none';

        Object.keys(courseList).forEach(id => {
            const course = courseList[id];
            const div = document.createElement('div');
            div.className = `course-item ${selectedCourseId === id ? 'active' : ''}`;
            div.innerHTML = `
                <div class="course-icon"><i class="${course.icon}"></i></div>
                <div class="course-info">
                    <h3>${course.title}</h3>
                    <p>${course.tag}</p>
                </div>
            `;
            div.onclick = () => selectCourse(id);
            courseItemsEl.appendChild(div);
        });
    }

    function selectCourse(id) {
        selectedCourseId = id;
        renderCourseSelection();
        showCourseIntro(id);
    }

    function showCourseIntro(id) {
        const course = courseList[id];
        courseIntroContentEl.innerHTML = `
            <div class="course-intro-header">
                <span class="course-tag">${course.tag}</span>
                <h2>${course.title}</h2>
            </div>
            <p class="intro-text">${course.description}</p>
            <div class="course-highlights">
                ${course.highlights.map(h => `
                    <div class="highlight-item">
                        <i class="fa-solid fa-check"></i>
                        <span>${h}</span>
                    </div>
                `).join('')}
            </div>
        `;
        introActionsEl.style.display = 'flex';
    }

    function enterCourse() {
        if (!selectedCourseId) return;
        
        const course = courseList[selectedCourseId];
        btnBackCourses.style.display = 'flex';

        if (course.entryPath === 'map') {
            // Python: Go to stage map
            // Find chapter for current progress
            const firstIncompleteIdx = courseData.stages.findIndex(s => !s.completed);
            currentChapter = Math.floor((firstIncompleteIdx >= 0 ? firstIncompleteIdx : 0) / STAGES_PER_CHAPTER) + 1;
            renderMap();
            switchView(viewMap);
        } else {
            // Others: Go direct to a placeholder stage or editor
            // For now, let's just open a generic stage-like view
            showFeedback(document.getElementById('editor-feedback'), `${course.title} initialized. No stages required.`, 'success');
            openDirectCourse(course);
        }
    }

    function openDirectCourse(course) {
        // Simple direct entry simulation
        currentStageId = 'direct-entry';
        stageTitleEl.textContent = course.title + ' Dashboard';
        learningContentEl.innerHTML = `<h3>Welcome to ${course.title}</h3><p>You have entered the direct access path. No stage levels are required for this course.</p>`;
        mcqQuestionEl.textContent = 'Ready to code?';
        mcqOptionsEl.innerHTML = '<div class="mcq-option">Yes, let\'s go!</div>';
        codingPromptEl.innerHTML = `Start your <strong>${course.title}</strong> journey here.`;
        expectedOutputTextEl.textContent = 'Success';
        codeEditor.value = `// Welcome to ${course.title}`;
        consoleOutput.textContent = '';
        switchView(viewStage);
        setMode('learn');
    }
    function renderMap() {
        stageNodesWrapper.innerHTML = '';
        const fragment = document.createDocumentFragment();
        
        // Calculate stage range for current chapter
        const startIndex = (currentChapter - 1) * STAGES_PER_CHAPTER;
        const endIndex = Math.min(startIndex + STAGES_PER_CHAPTER, courseData.stages.length);
        const activeStages = courseData.stages.slice(startIndex, endIndex);

        // Update UI Info
        if (currentChapterNameEl) currentChapterNameEl.textContent = `Chapter ${currentChapter}`;
        if (chapterRangeEl) chapterRangeEl.textContent = `Stages ${startIndex + 1} - ${endIndex}`;
        if (btnPrevChapter) btnPrevChapter.disabled = currentChapter === 1;
        if (btnNextChapter) btnNextChapter.disabled = endIndex >= courseData.stages.length;

        activeStages.forEach((stage) => {
            const node = document.createElement('div');
            // Only show 'unpaid' if it's NOT locked and NOT paid
            const isUnpaid = !stage.locked && !stage.paid;
            node.className = `stage-node ${stage.locked ? 'locked' : ''} ${stage.completed ? 'completed' : ''} ${isUnpaid ? 'unpaid' : ''}`;
            node.setAttribute('data-title', stage.title);
            node.setAttribute('id', `node-${stage.id}`);
            node.textContent = stage.id.split('-')[1]; // Show stage number
            node.addEventListener('click', () => {
                if (!stage.locked) openStage(stage.id);
            });
            fragment.appendChild(node);
        });
        stageNodesWrapper.appendChild(fragment);
    }

    function changeChapter(delta) {
        const newChapter = currentChapter + delta;
        const totalChapters = Math.ceil(courseData.stages.length / STAGES_PER_CHAPTER);
        if (newChapter >= 1 && newChapter <= totalChapters) {
            currentChapter = newChapter;
            renderMap();
        }
    }

    function jumpToStage() {
        const stageNum = parseInt(inputJumpStage.value);
        if (isNaN(stageNum) || stageNum < 1 || stageNum > courseData.stages.length) {
            showFeedback(document.getElementById('editor-feedback'), 'Invalid stage number', 'error');
            return;
        }
        currentChapter = Math.ceil(stageNum / STAGES_PER_CHAPTER);
        renderMap();
        
        // Highlight the node briefly
        setTimeout(() => {
            const node = document.getElementById(`node-stage-${stageNum}`);
            if (node) {
                node.style.borderColor = 'var(--primary)';
                node.style.boxShadow = '0 0 30px var(--primary)';
            }
        }, 100);
    }

    function openStage(stageId) {
        currentStageId = stageId;
        const stageData = courseData.stages.find(s => s.id === stageId);
        
        // Payment Check
        if (!stageData.paid) {
            showPaymentOverlay(stageData);
            return;
        }

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

    function showPaymentOverlay(stageData) {
        paymentStageTitle.textContent = stageData.title;
        paymentOverlay.style.display = 'flex';
    }

    function hidePaymentOverlay() {
        paymentOverlay.style.display = 'none';
    }

    function processPayment() {
        if (!currentStageId) return;
        const stage = courseData.stages.find(s => s.id === currentStageId);
        if (stage) {
            stage.paid = true;
            hidePaymentOverlay();
            renderMap();
            // Automatically open after "payment"
            openStage(currentStageId);
        }
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
            await auth.signOut();
            endSession();
        });

        // Chapter Navigation
        btnPrevChapter?.addEventListener('click', () => changeChapter(-1));
        btnNextChapter?.addEventListener('click', () => changeChapter(1));
        btnJumpStage?.addEventListener('click', jumpToStage);
        inputJumpStage?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') jumpToStage();
        });

        // Course Selection
        btnEnterCourse?.addEventListener('click', enterCourse);
        btnBackCourses?.addEventListener('click', () => {
            switchView(viewCourseSelection);
            renderCourseSelection();
        });

        // Payment
        btnPayNow?.addEventListener('click', processPayment);
        btnCancelPayment?.addEventListener('click', hidePaymentOverlay);
    }

    init();
})();
