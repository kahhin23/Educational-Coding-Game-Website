(function () {
    // app.js
    // Accessing globals from firebase-config.js and auth.js
    const { auth, db } = window.firebaseAuth;
    const { setupAuthListener, clearAuthStatus } = window.authApp;

    // --- Global State ---
    const CSV_URL = 'https://raw.githubusercontent.com/kahhin23/Educational-Coding-Game-Website/main/python%20course%20data.csv';
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

    // --- Course Data ---
    const courseData = {
        stages: []
    };

    // AI Backend URLs
    const AI_BASE_URL = 'http://188.166.229.212:8080';
    const AI_LOGIN_URL = `${AI_BASE_URL}/api/program/login`;
    const AI_CHAT_URL = `${AI_BASE_URL}/api/program/chat`;

    // CSV Parser Utility
    function parseCSV(text) {
        const lines = text.trim().split('\n');
        const headers = lines[0].split(',');
        return lines.slice(1).map(line => {
            // Handle quoted commas in CSV
            const values = [];
            let current = '';
            let inQuotes = false;
            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                if (char === '"' && line[i + 1] === '"') {
                    current += '"';
                    i++;
                } else if (char === '"') {
                    inQuotes = !inQuotes;
                } else if (char === ',' && !inQuotes) {
                    values.push(current.trim());
                    current = '';
                } else {
                    current += char;
                }
            }
            values.push(current.trim());

            const obj = {};
            headers.forEach((header, i) => {
                obj[header.trim()] = values[i] ? values[i].replace(/\\n/g, '\n') : '';
            });
            return obj;
        });
    }

    async function loadCourseData() {
        try {
            console.log("Fetching course data from:", CSV_URL);
            const response = await fetch(CSV_URL);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const csvText = await response.text();
            const rawData = parseCSV(csvText);

            // Group rows by ID to consolidate multi-part stages
            const stageGroups = {};
            const orderedIds = [];
            rawData.forEach(row => {
                const clean = (val) => (val === '-' || !val) ? '' : val;
                const idStr = clean(row.ID);
                if (!idStr) return;

                if (!stageGroups[idStr]) {
                    stageGroups[idStr] = {
                        id: `stage-${idStr}`,
                        title: '',
                        learningContent: '',
                        mcq: null,
                        codingChallenge: null
                    };
                    orderedIds.push(idStr);
                }

                const type = clean(row.Type);
                if (type === 'reading material') {
                    stageGroups[idStr].title = clean(row.Title) || stageGroups[idStr].title;
                    stageGroups[idStr].learningContent = clean(row.Question);
                } else if (type === 'mc') {
                    stageGroups[idStr].title = stageGroups[idStr].title || clean(row.Title);
                    stageGroups[idStr].mcq = {
                        question: clean(row.Question),
                        options: clean(row.Option).split(';').map(o => o.trim()),
                        correctIndex: parseInt(clean(row['Answer Index']))
                    };
                } else if (type === 'coding') {
                    stageGroups[idStr].title = stageGroups[idStr].title || clean(row.Title);
                    stageGroups[idStr].codingChallenge = {
                        prompt: clean(row.Question),
                        preCode: clean(row['Pre-Code']),
                        exactInput: clean(row['Exact Input']),
                        expectedOutput: clean(row['Expected Output']) ? clean(row['Expected Output']).replace(/\\n/g, '\n') : ''
                    };
                    if (stageGroups[idStr].codingChallenge.expectedOutput && !stageGroups[idStr].codingChallenge.expectedOutput.endsWith('\n')) {
                        stageGroups[idStr].codingChallenge.expectedOutput += '\n'; // standard print line suffix
                    }
                }
            });

            // Convert to ordered array and set status
            courseData.stages = orderedIds.map((id, index) => ({
                ...stageGroups[id],
                locked: index === 0 ? false : true,
                completed: false,
                paid: index === 0 ? true : false
            }));

            console.log("Grouped Course data loaded:", courseData.stages);
        } catch (err) {
            console.error("Failed to load course data:", err);
            // Fallback
            courseData.stages = [{
                id: 'stage-1-1',
                title: 'Error Loading Data',
                learningContent: '<p>Could not load course data accurately. Please check your GitHub link.</p>',
                locked: false,
                paid: true
            }];
        }
    }

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
    const headerXpInfo = document.getElementById('header-xp-info');

    // Python Editor
    const codeEditor = document.getElementById('code-editor');
    const consoleOutput = document.getElementById('console-output');
    const btnRun = document.getElementById('btn-run');
    const editorFeedbackEl = document.getElementById('editor-feedback');

    // --- Initialization ---
    async function init() {
        initEventListeners();
        await initPyodide();
        await loadCourseData();

        // AI Backend Test
        await testAIBackend();

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
        document.getElementById('header-xp').textContent = 'XP: 0/100';

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
                        courseData.stages[i + 1].locked = false;
                        // stage[i+1].paid remains false if it wasn't already paid/completed
                    }
                }

                // Update XP/Level UI
                document.querySelector('.level-badge').textContent = `Lvl ${data.level || 1}`;
                document.getElementById('header-xp').textContent = `XP: ${data.xp || 0}/100`;
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
            document.getElementById('header-xp').textContent = `XP: ${currentXP}/100`;
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

        if (course.entryPath === 'map') {
            btnBackCourses.style.display = 'flex';

            // Python: Go to stage map
            // Find chapter for current progress
            const firstIncompleteIdx = courseData.stages.findIndex(s => !s.completed);
            currentChapter = Math.floor((firstIncompleteIdx >= 0 ? firstIncompleteIdx : 0) / STAGES_PER_CHAPTER) + 1;
            renderMap();
            switchView(viewMap);
        } else {
            // Others: Go direct to a placeholder stage or editor
            openDirectCourse(course);
        }
    }

    function openDirectCourse(course) {
        // Simple direct entry simulation
        currentStageId = 'direct-entry';
        btnBackCourses.style.display = 'flex';
        btnBackMap.style.display = 'none'; // Hide "Back to Map" in direct mode

        stageTitleEl.textContent = course.title;
        learningContentEl.innerHTML = `<h3>Welcome to ${course.title}</h3><p>You have entered the direct access path. No stage levels are required for this course.</p>`;
        mcqQuestionEl.textContent = 'Ready to code?';
        mcqOptionsEl.innerHTML = '<div class="mcq-option">Yes, let\'s go!</div>';
        codingPromptEl.innerHTML = `Start your <strong>${course.title}</strong> journey here.`;
        expectedOutputTextEl.textContent = 'Success';
        codeEditor.value = `// Welcome to ${course.title}`;
        consoleOutput.textContent = '';

        switchView(viewStage);
        setMode('learn');

        // Show success feedback in the stage editor
        setTimeout(() => {
            showFeedback(editorFeedbackEl, `${course.title} mode active.`, 'success');
        }, 500);
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
            node.textContent = stage.id.replace('stage-', ''); // Show stage ID (e.g. 1-1)
            node.addEventListener('click', () => {
                if (!stage.locked) {
                    btnBackMap.style.display = 'flex'; // Ensure Map back button shows
                    openStage(stage.id);
                }
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
        try {
            console.log("Opening stage:", stageId);
            currentStageId = stageId;
            const stageData = courseData.stages.find(s => s.id === stageId);
            if (!stageData) {
                console.error("Stage data not found for id:", stageId);
                return;
            }

            // Defensive: Reset stage view content before switching or returning
            stageTitleEl.textContent = 'Loading...';
            learningContentEl.innerHTML = '';
            mcqOptionsEl.innerHTML = '';
            hideFeedback(mcqFeedbackEl);
            hideFeedback(editorFeedbackEl);
            codeEditor.value = '';
            consoleOutput.textContent = '';

            // Payment Check
            if (!stageData.paid) {
                console.log("Stage is unpaid, showing overlay:", stageId);
                showPaymentOverlay(stageData);
                return;
            }

            stageTitleEl.textContent = stageData.title;
            learningContentEl.innerHTML = stageData.learningContent || '<p>No content available.</p>';

            if (stageData.codingChallenge) {
                codingPromptEl.innerHTML = stageData.codingChallenge.prompt;
                expectedOutputTextEl.textContent = stageData.codingChallenge.expectedOutput;
                codeEditor.value = stageData.codingChallenge.preCode || '';
            }

            // Determine interaction mode
            if (stageData.mcq) {
                // MCQ exists (could follow reading content)
                mcqQuestionEl.textContent = stageData.mcq.question;
                renderMCQOptions(stageData.mcq);
                setMode('learn');
            } else if (stageData.codingChallenge) {
                // No MCQ, but coding exists. Show transition button if there was reading content.
                if (stageData.learningContent) {
                    mcqQuestionEl.textContent = 'Ready for the Challenge?';
                    const btn = document.createElement('button');
                    btn.className = 'btn-primary';
                    btn.style.width = '100%';
                    btn.innerHTML = 'Start Coding Challenge <i class="fa-solid fa-code"></i>';
                    btn.onclick = () => setMode('code');
                    mcqOptionsEl.appendChild(btn);
                    setMode('learn');
                } else {
                    // Coding only: go direct to CODE mode
                    setMode('code');
                }
            } else {
                // Reading Only stage
                mcqQuestionEl.textContent = 'Learning Material';
                const btn = document.createElement('button');
                btn.className = 'btn-primary';
                btn.style.width = '100%';
                btn.innerHTML = 'Complete Reading <i class="fa-solid fa-check"></i>';
                btn.onclick = async () => {
                    showFeedback(mcqFeedbackEl, 'Well done! Reading complete.', 'success');
                    markStageCompleted(currentStageId);
                    await saveProgress(currentStageId);
                    setTimeout(() => { switchView(viewMap); renderMap(); }, 1000);
                };
                mcqOptionsEl.appendChild(btn);
                setMode('learn');
            }

            switchView(viewStage);
        } catch (err) {
            console.error("Error opening stage:", err);
            showFeedback(editorFeedbackEl, "Failed to load stage.", "error");
        }
    }

    function showPaymentOverlay(stageData) {
        console.log("Showing payment overlay for:", stageData.id);
        paymentStageTitle.textContent = stageData.title;
        paymentOverlay.style.display = 'flex';
    }

    function hidePaymentOverlay() {
        console.log("Hiding payment overlay");
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

    async function handleMCQAnswer(selectedIndex, correctIndex, optionElement) {
        if (selectedIndex === correctIndex) {
            optionElement.classList.add('correct');
            showFeedback(mcqFeedbackEl, 'Correct! Concept verified.', 'success');

            const stageData = courseData.stages.find(s => s.id === currentStageId);
            if (stageData && stageData.codingChallenge) {
                setTimeout(() => setMode('code'), 1000);
            } else {
                markStageCompleted(currentStageId);
                await saveProgress(currentStageId);
                setTimeout(() => { switchView(viewMap); renderMap(); }, 1500);
            }
        } else {
            optionElement.classList.add('incorrect');
            showFeedback(mcqFeedbackEl, 'Incorrect. Review the content.', 'error');
        }
    }

    async function runPythonCode() {
        const code = codeEditor.value.trim();
        const stageData = courseData.stages.find(s => s.id === currentStageId);
        const challenge = stageData.codingChallenge;

        consoleOutput.textContent = '';
        consoleOutput.classList.remove('error-text');
        let output = '';
        pyodideInstance.setStdout({ batched: (str) => { output += str + '\n'; consoleOutput.textContent += str + '\n'; } });

        try {
            await pyodideInstance.runPythonAsync(code);

            const trimmedOutput = output.trim();
            const expected = challenge.expectedOutput ? challenge.expectedOutput.trim() : '';
            const exact = challenge.exactInput ? challenge.exactInput.trim() : '';
            const preCode = challenge.preCode ? challenge.preCode.trim() : '';

            let isCorrect = true;
            let feedback = 'Success! Stage completed.';

            // Check Output (if expected output is defined)
            if (expected && trimmedOutput !== expected) {
                isCorrect = false;
                feedback = 'Output does not match expected result.';
            }

            // Check Exact Input (Filtering Pre-Code)
            if (exact) {
                // Subtract the pre-populated code to check only what the user added/modified
                const userAddedCode = code.replace(preCode, '').trim();
                if (userAddedCode !== exact) {
                    isCorrect = false;
                    feedback = 'Code does not match exact required input.';
                }
            }

            if (isCorrect) {
                showFeedback(editorFeedbackEl, feedback, 'success');
                markStageCompleted(currentStageId);
                await saveProgress(currentStageId);
                setTimeout(() => { switchView(viewMap); renderMap(); }, 1500);
            } else {
                showFeedback(editorFeedbackEl, feedback, 'error');
            }
        } catch (err) {
            consoleOutput.textContent = err.message;
            consoleOutput.classList.add('error-text');
            showFeedback(editorFeedbackEl, 'Execution Error', 'error');
        }
    }

    function markStageCompleted(stageId) {
        const idx = courseData.stages.findIndex(s => s.id === stageId);
        if (idx > -1) {
            courseData.stages[idx].completed = true;
            if (idx + 1 < courseData.stages.length) courseData.stages[idx + 1].locked = false;
        }
    }

    function switchView(target) {
        console.log("Switching view to:", target.id);
        document.querySelectorAll('.view').forEach(v => {
            v.classList.remove('active-view');
            v.style.display = 'none'; // Explicitly hide
        });
        target.classList.add('active-view');
        target.style.display = 'flex'; // Explicitly show

        // Always hide payment overlay when switching main views
        hidePaymentOverlay();
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

    async function testAIBackend() {
        console.log("--- AI Multi-Step Test Start (Processing Index Page) ---");
        
        try {
            // STEP 1: LOGIN (Get Token)
            console.log("Step 1: Logging in to get token...");
            const loginRes = await fetch(AI_LOGIN_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: 'admin', password: 'hiddenboss123' })
            });
            
            if (!loginRes.ok) {
                const error = await loginRes.text();
                throw new Error(`Login failed (${loginRes.status}): ${error}`);
            }
            
            const loginData = await loginRes.json();
            const token = loginData.token;
            console.log("Login Success! Token obtained.");
            
            // STEP 2: CHAT (Use Token)
            console.log("Step 2: Sending message to DeepSeek...");
            const chatRes = await fetch(AI_CHAT_URL, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ message: 'Hello from the Educational Game! Are you working?' })
            });
            
            if (!chatRes.ok) {
                const error = await chatRes.text();
                throw new Error(`Chat failed (${chatRes.status}): ${error}`);
            }
            
            const chatData = await chatRes.json();
            console.log("AI Response Results:", chatData.text || chatData);
            
        } catch (err) {
            console.error("AI Multi-Step Integration Error:", err);
            console.warn("Hint: Ensure backend CORS is enabled for GitHub origin and allows 'Authorization' header.");
        }
        console.log("--- AI Multi-Step Test (End) ---");
    }

    init();
})();
