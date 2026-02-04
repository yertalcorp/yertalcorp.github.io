import { firebaseConfig, auth } from '../config/firebase-config.js';
import { watchAuthState, logout } from '../config/auth.js';

let user;
let databaseCache = {};

// 1. THE BOUNCER & INITIALIZATION
watchAuthState((newUser) => {
    user = newUser;
    if (!user) {
        window.location.href = '../index.html'; // Kick to Showroom if not logged in
    } else {
        initArcade();
    }
});

async function initArcade() {
    try {
        const response = await fetch(`${firebaseConfig.databaseURL}/.json`);
        databaseCache = await response.json();
        
        if (!databaseCache) return;

        // Apply Branding & Hero from DB
        const brand = databaseCache.navigation.branding;
        document.getElementById('corp-name-display').textContent = brand.parts[0].text + brand.parts[1].text;
        
        const hero = databaseCache.arcade_hero || { title: "The Lab Hub", description: "Authorized Access" };
        document.getElementById('hero-heading').textContent = hero.title;
        document.getElementById('hero-subheading').textContent = hero.description;

        // Auth Button Setup
        const authBtn = document.getElementById('auth-trigger');
        authBtn.textContent = "SIGN OUT";
        authBtn.onclick = () => logout();

        renderCurrents(databaseCache.currents);

    } catch (error) {
        console.error("Arcade System Error:", error);
    }
}

// 2. RENDERING ENGINE (Currents & Sparks)
function renderCurrents(currentsData) {
    const container = document.getElementById('currents-container');
    if (!currentsData) return;

    container.innerHTML = Object.keys(currentsData).map(id => {
        const current = currentsData[id];
        return `
            <section class="current-row">
                <div class="current-header">
                    <div class="header-text">
                        <h3>${current.name}</h3>
                        <p class="focus-text">${current.focus || 'Laboratory Research'}</p>
                    </div>
                    <div class="creation-hub glass">
                        <div class="mode-selector">
                            <label><input type="radio" name="mode-${id}" value="prompt" checked> Spark It</label>
                            <label><input type="radio" name="mode-${id}" value="url"> URL Scout</label>
                        </div>
                        <div class="input-group">
                            <input type="text" id="input-${id}" placeholder="${current.examplePrompt}" maxlength="200">
                            <button class="btn-spark" onclick="handleCreation('${id}')">CREATE</button>
                        </div>
                    </div>
                </div>
                <div class="spark-grid" id="grid-${id}">
                    ${renderSparks(current.sparks || {})}
                </div>
            </section>
        `;
    }).join('');
}

function renderSparks(sparks) {
    return Object.keys(sparks).map(key => {
        const spark = sparks[key];
        return `
            <div class="action-card">
                <div class="card-top">
                    <span class="s-name">${spark.name}</span>
                    <span class="s-meta">${spark.dateCreated} by ${spark.ownerName}</span>
                </div>
                <div class="card-preview" onclick="window.open('${spark.url}', '_blank')">
                    <img src="${spark.screenshot || 'https://placehold.co/300x200/000/fff?text=No+Preview'}" alt="Preview">
                </div>
                <div class="card-stats">
                    <span><i class="fas fa-eye"></i> ${spark.views || 0}</span>
                    <span><i class="fas fa-coins"></i> ${spark.tips || 0}</span>
                </div>
                <div class="card-actions">
                    <button><i class="fas fa-bookmark"></i> Save</button>
                    <button><i class="fas fa-bell"></i> Sub</button>
                </div>
            </div>
        `;
    }).join('');
}

// 3. THE INTENT GATE (Logic & Gemini)
window.handleCreation = async (currentId) => {
    const inputField = document.getElementById(`input-${currentId}`);
    const prompt = inputField.value;
    const mode = document.querySelector(`input[name="mode-${currentId}"]:checked`).value;

    if (!prompt) return;

    if (mode === 'url') {
        // Simple URL validation
        if (prompt.startsWith('http')) {
            await saveSparkToDB(currentId, { type: 'url', url: prompt, name: 'External Link' });
        } else {
            alert("Please provide a valid URL.");
        }
        return;
    }

    // Path: Prompt Creation (The Intent Gate)
    try {
        // Analysis call to Gemini (Fixes typos + checks logic)
        const analysis = await geminiAnalyzePrompt(prompt, currentId);

        if (analysis.isVague) {
            showBinaryModal(analysis.choiceA, analysis.choiceB, (finalIntent) => {
                executeSparkGeneration(currentId, finalIntent);
            });
        } else {
            executeSparkGeneration(currentId, analysis.fixedPrompt);
        }
    } catch (e) {
        console.error("Analysis Failed", e);
    }
};

// 4. GENERATION & STORAGE
async function executeSparkGeneration(currentId, finalPrompt) {
    console.log(`Generating code for: ${finalPrompt}`);
    // 1. Call Gemini to get code
    // 2. Capture screenshot
    // 3. await saveSparkToDB(currentId, { ...data })
    alert("Generation Started: " + finalPrompt);
}

// UTILITY: Show the Two-Choice Modal
function showBinaryModal(a, b, callback) {
    const modal = document.getElementById('intent-modal');
    const btnA = document.getElementById('choice-a');
    const btnB = document.getElementById('choice-b');

    btnA.textContent = a;
    btnB.textContent = b;
    modal.style.display = 'flex';

    const handleSelect = (choice) => {
        modal.style.display = 'none';
        btnA.onclick = null;
        btnB.onclick = null;
        callback(choice);
    };

    btnA.onclick = () => handleSelect(a);
    btnB.onclick = () => handleSelect(b);
}

// Dummy Analysis (Replace with actual Gemini API call)
async function geminiAnalyzePrompt(prompt, cat) {
    // In reality, you'd fetch this from a Gemini endpoint
    return {
        isVague: prompt.length < 10,
        fixedPrompt: prompt,
        choiceA: `Technical focus on ${cat} logic`,
        choiceB: `Visual focus on ${cat} effects`
    };
}
