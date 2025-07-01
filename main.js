// --- DOM Elements ---
const difficultySelector = document.getElementById('difficulty-selector');
const newProblemBtn = document.getElementById('new-problem-btn');
const problemText = document.getElementById('problem-text');
const problemContainer = document.getElementById('problem-container');
const loader = document.getElementById('loader');
const answerSection = document.getElementById('answer-section');
const answerInput = document.getElementById('answer-input');
const submitAnswerBtn = document.getElementById('submit-answer-btn');
const feedbackContainer = document.getElementById('feedback-container');
const scoreEl = document.getElementById('score');
const probabilityEl = document.getElementById('probability');

// --- State Variables ---
let currentDifficulty = 'Medium';
let currentProblem = '';
let correctAnswers = 0;
let totalProblems = 0;
let isWaitingForAnswer = false;

// --- Gemini API Configuration ---
// The API key is left empty as it's handled by the execution environment.
const apiKey = ""; 
const genAIApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

// --- Event Listeners ---

/**
 * Handles clicks on the difficulty selection buttons.
 * Updates the `currentDifficulty` state and the UI to reflect the active selection.
 */
difficultySelector.addEventListener('click', (e) => {
    if (e.target.tagName === 'BUTTON') {
        document.querySelectorAll('.difficulty-btn').forEach(btn => btn.classList.remove('active'));
        e.target.classList.add('active');
        currentDifficulty = e.target.dataset.difficulty;
    }
});

/**
 * Attaches the `generateProblem` function to the "New Problem" button's click event.
 */
newProblemBtn.addEventListener('click', generateProblem);

/**
 * Attaches the `evaluateAnswer` function to the "Submit Answer" button's click event.
 */
submitAnswerBtn.addEventListener('click', evaluateAnswer);

/**
 * Allows the user to submit their answer by pressing the 'Enter' key in the input field.
 */
answerInput.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') {
        evaluateAnswer();
    }
});

// --- Core Functions ---

/**
 * Manages the visual loading state of the application.
 * Disables buttons and shows a spinner while waiting for API responses.
 * @param {boolean} isLoading - Whether to show or hide the loading state.
 */
function setLoading(isLoading) {
    if (isLoading) {
        loader.classList.remove('hidden');
        problemText.classList.add('hidden');
        newProblemBtn.disabled = true;
        newProblemBtn.classList.add('opacity-50', 'cursor-not-allowed');
        submitAnswerBtn.disabled = true;
        submitAnswerBtn.classList.add('opacity-50', 'cursor-not-allowed');
    } else {
        loader.classList.add('hidden');
        problemText.classList.remove('hidden');
        newProblemBtn.disabled = false;
        newProblemBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        submitAnswerBtn.disabled = false;
        submitAnswerBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    }
}

/**
 * Fetches a new math problem from the Gemini API based on the selected difficulty.
 */
async function generateProblem() {
    // Prevent getting a new problem if one is already waiting for an answer.
    if (isWaitingForAnswer) {
        feedbackContainer.innerHTML = `
            <div class="p-4 rounded-lg bg-yellow-100 border border-yellow-300 text-yellow-800">
                Please submit an answer for the current problem first.
            </div>
        `;
        return;
    }

    setLoading(true);
    feedbackContainer.innerHTML = ''; // Clear old feedback
    answerInput.value = ''; // Clear old answer

    const prompt = `Generate a single math word problem appropriate for a '${currentDifficulty}' difficulty level. The problem should have a clear, definitive numerical or simple algebraic answer. Do not include the answer in your response. Just provide the problem statement.`;

    try {
        const payload = {
            contents: [{ role: "user", parts: [{ text: prompt }] }]
        };
        const response = await fetch(genAIApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            throw new Error(`API Error: ${response.statusText}`);
        }

        const result = await response.json();
        
        // Safely access the generated text from the API response
        if (result.candidates && result.candidates[0].content && result.candidates[0].content.parts[0]) {
            currentProblem = result.candidates[0].content.parts[0].text.trim();
            problemText.textContent = currentProblem;
            answerSection.classList.remove('hidden'); // Show the answer input
            isWaitingForAnswer = true; // Set flag that we are waiting for an answer
        } else {
            problemText.textContent = 'Could not generate a problem. Please try again.';
            console.error("Unexpected API response structure:", result);
        }
    } catch (error) {
        problemText.textContent = 'Failed to fetch problem. Check the console for details.';
        console.error('Error generating problem:', error);
    } finally {
        setLoading(false);
    }
}

/**
 * Submits the user's answer to the Gemini API for evaluation.
 */
async function evaluateAnswer() {
    const userAnswer = answerInput.value.trim();
    if (!userAnswer) {
        displayFeedback({
            isCorrect: false,
            explanation: "Please enter an answer before submitting."
        });
        return;
    }

    setLoading(true);
    feedbackContainer.innerHTML = '';

    const prompt = `
        Math Problem: "${currentProblem}"
        User's Answer: "${userAnswer}"

        Is the user's answer correct? 
        Please respond with ONLY a JSON object in the format:
        {
          "isCorrect": boolean,
          "explanation": "A brief explanation of why the answer is correct or incorrect. If incorrect, provide the correct answer and the steps to get it."
        }
    `;
    
    try {
        const payload = {
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            // Request a JSON response from the API
            generationConfig: { responseMimeType: "application/json" }
        };
        const response = await fetch(genAIApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`API Error: ${response.statusText}`);
        }

        const result = await response.json();

        // Safely access and parse the JSON response
        if (result.candidates && result.candidates[0].content && result.candidates[0].content.parts[0]) {
            const evaluation = JSON.parse(result.candidates[0].content.parts[0].text);
            displayFeedback(evaluation);
            updateScore(evaluation.isCorrect);
            isWaitingForAnswer = false; // Problem cycle is complete
            answerSection.classList.add('hidden'); // Hide input until a new problem is requested
        } else {
            displayFeedback({
                isCorrect: false,
                explanation: "Could not evaluate the answer. Please try again."
            });
            console.error("Unexpected API response structure:", result);
        }
    } catch (error) {
        displayFeedback({
            isCorrect: false,
            explanation: "Failed to evaluate answer. Check the console for details."
        });
        console.error('Error evaluating answer:', error);
    } finally {
        setLoading(false);
    }
}

/**
 * Displays the feedback from the AI to the user in a styled card.
 * @param {object} evaluation - The evaluation object from the API.
 * @param {boolean} evaluation.isCorrect - If the answer was correct.
 * @param {string} evaluation.explanation - The AI's explanation.
 */
function displayFeedback(evaluation) {
    feedbackContainer.innerHTML = ''; // Clear previous feedback
    const feedbackCard = document.createElement('div');
    feedbackCard.classList.add('p-4', 'rounded-lg', 'border');

    if (evaluation.isCorrect) {
        feedbackCard.classList.add('bg-green-100', 'border-green-300', 'text-green-800', 'feedback-correct');
        feedbackCard.innerHTML = `
            <h3 class="font-bold text-lg">Correct! ✅</h3>
            <p class="mt-1">${evaluation.explanation}</p>
        `;
    } else {
        feedbackCard.classList.add('bg-red-100', 'border-red-300', 'text-red-800', 'feedback-incorrect');
        feedbackCard.innerHTML = `
            <h3 class="font-bold text-lg">Incorrect ❌</h3>
            <p class="mt-1">${evaluation.explanation}</p>
        `;
    }
    feedbackContainer.appendChild(feedbackCard);
}

/**
 * Updates the user's score and the probability display after each answer.
 * @param {boolean} wasCorrect - Whether the last answer was correct.
 */
function updateScore(wasCorrect) {
    totalProblems++;
    if (wasCorrect) {
        correctAnswers++;
    }

    // Update the score display (e.g., "1 / 2")
    scoreEl.textContent = `${correctAnswers} / ${totalProblems}`;

    // Calculate and display the probability of getting an answer correct
    if (totalProblems > 0) {
        const probability = (correctAnswers / totalProblems) * 100;
        probabilityEl.textContent = `${probability.toFixed(1)}%`;
    } else {
        probabilityEl.textContent = 'N/A';
    }
}
