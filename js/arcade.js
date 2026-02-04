import { firebaseConfig, auth, saveToRealtimeDB } from '../config/firebase-config.js';
import { watchAuthState, logout } from '../config/auth.js';

let user;
let databaseCache = {};
const GEMINI_API_KEY = "AIzaSyBm_hgTArPco_CCk__xPadS39vK6eJSAMs";

// 1. THE BOUNCER & INITIALIZATION
watchAuthState((newUser) => {
    user = newUser;
    if (!user) {
        window.location.href = '../index.html';
    } else {
        initArcade();
    }
});

async function initArcade() {
    try {
        const response = await fetch(`${firebaseConfig.databaseURL}/.json`);
        databaseCache = await response.json();
        
        // Setup Create Current Button
        const createBtn = document.getElementById('create-arcade-btn');
        if (createBtn) {
            createBtn.textContent = "Spawn New Current";
            createBtn.onclick = handleCreateCurrent;
        }

        // Branding & Hero
        const brand = databaseCache.navigation.branding;
        document.getElementById('corp-name-display').textContent = brand.parts[0].text + brand.parts[1].text;
        document.getElementById('hero-heading').textContent = databaseCache.arcade_hero?.title || "Arcade Hub";
        
        // Logout setup
        const authBtn = document.getElementById('auth-trigger');
        authBtn.textContent = "LOGOUT";
        authBtn.onclick = () => logout();

        renderCurrents(databaseCache.currents);
    } catch (e) { console.error("Arcade Init Error:", e); }
}

// 2. DYNAMIC RENDERING
function renderCurrents(currentsData) {
    const container = document.getElementById('currents-container');
    if (!currentsData) return;

    container.innerHTML = Object.keys(currentsData).map(id => {
        const current = currentsData[id];
        return `
            <section class="current-row">
                <div class="current-header">
                    <div>
                        <h3>${current.name}</h3>
                        <p class="focus-tag">${current.focus || 'Active'}</p>
                    </div>
                    <div class="creation-hub glass">
                        <div class="mode-toggle">
                            <label><input type="radio" name="mode-${id}" value="prompt" checked> Spark It</label>
                            <label><input type="radio" name="mode-${id}" value="sourcing"> Source Web</label>
                        </div>
                        <div class="input-row">
                            <input type="text" id="input-${id}" placeholder="What shall we create?" maxlength="200">
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
                <div class="card-top">${spark.name} <br> <small>${spark.dateCreated}</small></div>
                <div class="card-preview" onclick="window.open('${spark.url}', '_blank')">
                    <img src="${spark.screenshot || ''}" alt="Preview">
                </div>
                <div class="card-stats">
                    <span>Views: ${spark.views || 0}</span>
                    <span>Tips: ${spark.tips || 0}</span>
                </div>
            </div>
        `;
    }).join('');
}

// 3. THE INTENT GATE & GENERATION LOGIC
window.handleCreation = async (currentId) => {
    const prompt = document.getElementById(`input-${currentId}`).value;
    const mode = document.querySelector(`input[name="mode-${currentId}"]:checked`).value;
    if (!prompt) return;

    // Boundary Check
    const isVague = prompt.length < 15;
    const mustSource = /movie|latest|news|top|best/i.test(prompt);

    if (mode === 'prompt' && mustSource) {
        if (!confirm("This topic requires live sourcing. Continue with Sourcing mode?")) return;
        executeMassSpark(currentId, prompt, 'sourcing');
        return;
    }

    if (isVague) {
        showBinaryModal(
            `Focus on mechanics/logic`, 
            `Focus on visuals/vibe`, 
            (choice) => executeMassSpark(currentId, `${prompt} (${choice})`, mode)
        );
    } else {
        executeMassSpark(currentId, prompt, mode);
    }
};

async function executeMassSpark(currentId, prompt, mode) {
    const status = document.getElementById('engine-status-text');
    const countMatch = prompt.match(/\d+/);
    const count = countMatch ? Math.min(parseInt(countMatch[0]), 48) : 6;
    
    status.textContent = `GENERATING ${count} SPARKS...`;

    try {
        if (mode === 'sourcing') {
            const links = await callGeminiAPI(prompt, count, 'source');
            for (const item of links) {
                await saveSpark(currentId, { ...item, type: 'link' });
            }
        } else {
            for (let i = 0; i < count; i++) {
                const code = await callGeminiAPI(prompt, i, 'code');
                await saveSpark(currentId, { name: `${prompt} #${i+1}`, code, type: 'code' });
            }
        }
        status.textContent = "READY";
        initArcade();
    } catch (e) { status.textContent = "ERROR"; }
}

// 4. API & DB HELPERS
async function callGeminiAPI(prompt, val, type) {
    const isCode = type === 'code';
    const systemText = isCode 
        ? `Create a single-file HTML/JS app: ${prompt}. Variant ${val}.`
        : `Return a JSON array of ${val} real URLs for: ${prompt}. Format: [{"name":"", "url":""}]`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: systemText }] }] })
    });
    const data = await response.json();
    const result = data.candidates[0].content.parts[0].text;
    return isCode ? result : JSON.parse(result.replace(/```json|```/g, ''));
}

async function saveSpark(currentId, data) {
    const id = `spark_${Date.now()}_${Math.floor(Math.random()*1000)}`;
    await saveToRealtimeDB(`currents/${currentId}/sparks/${id}`, {
        ...data,
        ownerName: user.email.split('@')[0],
        dateCreated: new Date().toLocaleDateString(),
        views: 0,
        tips: 0
    });
}

async function handleCreateCurrent() {
    const name = prompt("New Current Name:");
    if (!name) return;
    const id = name.toLowerCase().replace(/\s+/g, '_');
    await saveToRealtimeDB(`currents/${id}`, { name, sparks: {} });
    initArcade();
}

function showBinaryModal(a, b, callback) {
    const modal = document.getElementById('intent-modal');
    const btnA = document.getElementById('choice-a');
    const btnB = document.getElementById('choice-b');
    btnA.textContent = a; btnB.textContent = b;
    modal.style.display = 'flex';
    btnA.onclick = () => { modal.style.display='none'; callback(a); };
    btnB.onclick = () => { modal.style.display='none'; callback(b); };
}
