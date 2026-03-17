// app.js

// --- Global State ---
let pyodideInstance = null;
let currentStageId = null;
let currentMode = 'learn'; // 'learn' (includes MCQ) -> 'code' (coding challenge)

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
            locked: true, // Initially locked
            learningContent: '<p>You have learned to speak. Now you must learn to remember...</p>',
            mcq: { question: 'Coming soon...', options: ['A'], correctIndex: 0 },
            codingChallenge: { prompt: 'Coming soon...', expectedOutput: '' }
        },
        {
            id: 'stage-3',
            title: '3. Making Choices',
            locked: true,
            learningContent: '<p>The path splits. How will your code decide which way to go?</p>',
            mcq: { question: 'Coming soon...', options: ['A'], correctIndex: 0 },
            codingChallenge: { prompt: 'Coming soon...', expectedOutput: '' }
        }
    ]
};

// --- DOM Elements ---
const viewMap = document.getElementById('view-map');
const viewStage = document.getElementById('view-stage');
const stageNodesWrapper = document.getElementById('stage-nodes-wrapper');

const btnBackMap = document.getElementById('btn-back-map');
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
    renderMap();
    initEventListeners();
    await initPyodide();
}

async function initPyodide() {
    btnRun.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Loading Engine...';
    btnRun.disabled = true;
    try {
        pyodideInstance = await loadPyodide();
        console.log('Pyodide initialized.');
        btnRun.innerHTML = '<i class="fa-solid fa-play"></i> Run Code';
        btnRun.disabled = false;
    } catch (err) {
        console.error('Failed to load Pyodide', err);
        btnRun.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Error';
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
            if (!stage.locked) {
                openStage(stage.id);
            }
        });

        stageNodesWrapper.appendChild(node);
    });
}

// --- Stage View Logic ---
function openStage(stageId) {
    currentStageId = stageId;
    currentMode = 'learn';
    
    const stageData = courseData.stages.find(s => s.id === stageId);
    if (!stageData) return;

    // Set Data
    stageTitleEl.textContent = stageData.title;
    learningContentEl.innerHTML = stageData.learningContent;
    
    // MCQ
    mcqQuestionEl.textContent = stageData.mcq.question;
    renderMCQOptions(stageData.mcq);
    hideFeedback(mcqFeedbackEl);
    
    // Coding Challenge
    codingPromptEl.innerHTML = stageData.codingChallenge.prompt;
    expectedOutputTextEl.textContent = stageData.codingChallenge.expectedOutput;
    codeEditor.value = '';
    consoleOutput.textContent = '';
    consoleOutput.className = 'console-box';
    hideFeedback(editorFeedbackEl);

    // Switch Views & Modes
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
    // Reset classes
    document.querySelectorAll('.mcq-option').forEach(el => {
        el.classList.remove('correct', 'incorrect');
        el.style.pointerEvents = 'none'; // Disable click temporarily
    });

    if (selectedIndex === correctIndex) {
        optionElement.classList.add('correct');
        showFeedback(mcqFeedbackEl, 'Correct! Concept verified.', 'success');
        
        // Transition to coding mode after a short delay
        setTimeout(() => {
            setMode('code');
        }, 1500);
    } else {
        optionElement.classList.add('incorrect');
        showFeedback(mcqFeedbackEl, 'Incorrect. Review the content on the left.', 'error');
        
        // Re-enable clicks
        setTimeout(() => {
            document.querySelectorAll('.mcq-option').forEach(el => el.style.pointerEvents = 'auto');
        }, 1000);
    }
}

// --- Code Execution Logic ---
async function runPythonCode() {
    if (!pyodideInstance) {
        showFeedback(editorFeedbackEl, 'Engine not ready yet.', 'error');
        return;
    }

    const code = codeEditor.value;
    const stageData = courseData.stages.find(s => s.id === currentStageId);
    const expectedOutput = stageData.codingChallenge.expectedOutput;

    // Reset console
    consoleOutput.textContent = '';
    consoleOutput.className = 'console-box';
    hideFeedback(editorFeedbackEl);

    // Setup stdout capture
    let output = '';
    pyodideInstance.setStdout({
        batched: (str) => {
            output += str + '\n';
            consoleOutput.textContent += str + '\n';
        }
    });

    try {
        btnRun.disabled = true;
        btnRun.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Running...';
        
        // Execute Code
        await pyodideInstance.runPythonAsync(code);
        
        // Verification
        if (output === expectedOutput) {
            showFeedback(editorFeedbackEl, 'Success! Stage completed.', 'success');
            markStageCompleted(currentStageId);
            
            // Go back to map after delay
            setTimeout(() => {
                switchView(viewMap);
                renderMap();
            }, 2000);
        } else {
            showFeedback(editorFeedbackEl, 'Output does not match expected result.', 'error');
        }

    } catch (err) {
        consoleOutput.textContent += err.toString();
        consoleOutput.className = 'console-box error-text';
        showFeedback(editorFeedbackEl, 'Execution Error', 'error');
    } finally {
        btnRun.disabled = false;
        btnRun.innerHTML = '<i class="fa-solid fa-play"></i> Run Code';
        // Reset stdout to default just in case
        pyodideInstance.setStdout({}); 
    }
}

function markStageCompleted(stageId) {
    const stageIndex = courseData.stages.findIndex(s => s.id === stageId);
    if (stageIndex > -1) {
        courseData.stages[stageIndex].completed = true;
        // Unlock next stage if it exists
        if (stageIndex + 1 < courseData.stages.length) {
            courseData.stages[stageIndex + 1].locked = false;
        }
    }
}

// --- UI Helpers ---
function switchView(targetView) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active-view'));
    targetView.classList.add('active-view');
}

function setMode(mode) {
    currentMode = mode;
    if (mode === 'learn') {
        learningContentEl.classList.add('active-mode');
        codingInstructionsEl.classList.remove('active-mode');
        
        mcqContainer.classList.add('active-mode');
        editorContainer.classList.remove('active-mode');
    } else if (mode === 'code') {
        learningContentEl.classList.remove('active-mode');
        codingInstructionsEl.classList.add('active-mode');
        
        mcqContainer.classList.remove('active-mode');
        editorContainer.classList.add('active-mode');
    }
}

function showFeedback(element, text, type) {
    element.textContent = text;
    element.className = `feedback-msg show ${type}`;
}
function hideFeedback(element) {
    element.className = 'feedback-msg';
}

function initEventListeners() {
    btnBackMap.addEventListener('click', () => {
        switchView(viewMap);
        renderMap();
    });

    btnRun.addEventListener('click', runPythonCode);
    
    // Tab support in editor
    codeEditor.addEventListener('keydown', function(e) {
        if (e.key == 'Tab') {
            e.preventDefault();
            var start = this.selectionStart;
            var end = this.selectionEnd;
            this.value = this.value.substring(0, start) +
                "    " + this.value.substring(end);
            this.selectionStart =
                this.selectionEnd = start + 4;
        }
    });
}

// Kickoff
document.addEventListener('DOMContentLoaded', init);
