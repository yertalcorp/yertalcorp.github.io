import { firebaseConfig, auth, saveToRealtimeDB } from '../config/firebase-config.js';
import { watchAuthState, logout } from '../config/auth.js';
import { ENV } from '../config/env.js';

let user;
let databaseCache = {};
const GEMINI_API_KEY = ENV.GEMINI_KEY;

// 1. THE BOUNCER & INITIALIZATION
watchAuthState((newUser) => {
    user = newUser;
    if (newUser === null) {
        // If at any point the user is null, bounce them out immediately
        window.location.replace('../index.html'); 
    } else if (newUser) {
        initArcade();
    }
});

async function initArcade() {
    try {
        const response = await fetch(`${firebaseConfig.databaseURL}/.json`);
        databaseCache = await response.json();
        
        // 1. APPLY UI GENETICS (From Showroom Style Logic)
        const ui = databaseCache.settings['ui-settings'];
        const root = document.documentElement;
        
        root.style.setProperty('--neon-color', ui['color-neon']);
        root.style.setProperty('--accent-color', ui['color-accent']);
        root.style.setProperty('--nav-font', ui.nav_font);
        
        // Load fonts dynamically as we did in showroom
        const fontLink = document.getElementById('google-fonts-link');
        if (fontLink) fontLink.href = data.settings.external_assets.google_fonts_url;

        // 2. HERO HUD POPULATION
        const hero = databaseCache.arcade_infrastructure.hero;
        document.getElementById('hero-heading').textContent = hero.title;
        document.getElementById('hero-subheading').textContent = hero.subtitle;
        
        // Handle the 3D Button text (CTA)
        const createBtn = document.getElementById('create-arcade-btn');
        if (createBtn) {
            const btnSpan = createBtn.querySelector('.inner-content');
            btnSpan.textContent = hero.cta_create || "SPAWN NEW CURRENT";
            createBtn.onclick = handleCreateCurrent;
        }

        // 3. BRANDING & AUTH HUD
        const brand = databaseCache.navigation.branding;
        document.getElementById('corp-name-display').innerHTML = `${brand.parts[0].text} <span style="color:${brand.parts[1].color}">${brand.parts[1].text}</span>`;
        
        const authBtn = document.getElementById('auth-trigger');
        authBtn.textContent = "TERMINATE SESSION";
        authBtn.onclick = () => logout();

        // 4. SUPERUSER VERIFICATION
        const superUserDisplay = document.getElementById('superuser-display');
        if (user && user.email === 'yertal-arcade@gmail.com') {
            superUserDisplay.textContent = "ACCESS: YERTAL-ARCADE-ADMIN";
            superUserDisplay.style.color = 'var(--neon-color)';
        }

        // CHANGE: Pass arcade_infrastructure.currents
        renderCurrents(databaseCache.arcade_infrastructure.currents);
        
        // FINALIZE: Reveal the Lab
        document.body.style.opacity = '1';

    } catch (e) { 
        console.error("Laboratory Initialization Failed:", e); 
        document.getElementById('engine-status-text').textContent = "SYSTEM OFFLINE";
    }
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
