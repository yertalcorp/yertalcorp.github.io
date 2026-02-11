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
        if (fontLink) fontLink.href = databaseCache.settings.external_assets.google_fonts_url;

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
        const part1 = `<span style="color: ${brand.parts[0].color}">${brand.parts[0].text}</span>`;
        const part2 = `<span style="color: ${brand.parts[1].color}">${brand.parts[1].text}</span>`;
        document.getElementById('corp-name-display').innerHTML = `${part1} ${part2}`;
        
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

function renderCurrents(currents) {
    const container = document.getElementById('currents-container');
    if (!container || !currents) return;

    container.innerHTML = currents.map(current => `
        <section class="current-block mb-12 w-full">
            <div class="flex items-center gap-4 mb-6">
                <h2 class="text-2xl font-black italic uppercase tracking-tighter text-white">${current.name}</h2>
                <div class="h-[1px] flex-grow bg-gradient-to-r from-white/20 to-transparent"></div>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                ${renderSparks(current.sparks)}
            </div>
        </section>
    `).join('');
}
    
function renderSparks(sparks) {
    if (!sparks) return '<p class="text-slate-500 text-[10px] italic">No sparks generated yet.</p>';

    // 1. Convert Object to Array and Sort by Timestamp (Newest First)
    const sortedSparks = Object.values(sparks).sort((a, b) => b.created - a.created);

    // 2. Map the sorted array to HTML
    return sortedSparks.map(spark => `
        <div class="action-card glass p-4 rounded-xl border border-white/5 hover:border-[var(--neon-color)] transition-all">
            <div class="card-top flex justify-between items-start mb-4">
                <div>
                    <h4 class="text-white font-bold text-xs uppercase tracking-tighter">${spark.name}</h4>
                    <small class="text-[9px] text-slate-500 uppercase">${formatTimeAgo(spark.created)}</small>
                </div>
                <div class="text-[10px] font-black text-[var(--neon-color)]">#${spark.internal_rank}</div>
            </div>
            
            <div class="card-preview mb-4 overflow-hidden rounded-lg bg-black/40 aspect-video flex items-center justify-center cursor-pointer" 
                 onclick="window.open('${spark.link || '#'}', '_blank')">
                <img src="${spark.image || '../assets/sparks/default.jpg'}" alt="Preview" class="w-full h-full object-cover opacity-80 hover:opacity-100 transition">
            </div>

            <div class="card-stats grid grid-cols-3 gap-1 border-t border-white/5 pt-3">
                <div class="text-center"><span class="block text-white text-[10px] font-bold">${spark.stats.views}</span><span class="text-[7px] text-slate-500 uppercase">Views</span></div>
                <div class="text-center"><span class="block text-white text-[10px] font-bold">${spark.stats.likes}</span><span class="text-[7px] text-slate-500 uppercase">Likes</span></div>
                <div class="text-center"><span class="block text-white text-[10px] font-bold">${spark.stats.tips}</span><span class="text-[7px] text-slate-500 uppercase">Tips</span></div>
            </div>
        </div>
    `).join('');
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
    } catch (e) { 
        console.error("Mass Spark Failed:", e);
        status.textContent = "ERROR"; 
    }
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

// js/arcade.js

function formatTimeAgo(timestamp) {
 if (!timestamp || typeof timestamp !== 'number') return "Unknown date";
 const seconds = Math.floor((Date.now() - timestamp) / 1000);
 if (seconds < 60) return "Just now";
 const minutes = Math.floor(seconds / 60);
 if (minutes < 60) return `${minutes}m ago`;
 const hours = Math.floor(minutes / 60);
 if (hours < 24) return `${hours}h ago`;
 return new Date(timestamp).toLocaleDateString();
}
    
async function saveSpark(currentId, data) {
    const sparkId = `spark_${Date.now()}_${Math.floor(Math.random()*1000)}`;
    const dbPath = `arcade_infrastructure/currents/${currentId}/sparks/${sparkId}`;
    
    // Get numeric index for internal_rank based on current sparks (simplified)
    const currentSparks = databaseCache.arcade_infrastructure.currents.find(c => c.id === currentId)?.sparks || {};
    const rank = Object.keys(currentSparks).length + 1;

    await saveToRealtimeDB(dbPath, {
        // Core Identity
        id: sparkId,
        name: data.name || "Unnamed Spark",
        desc: data.desc || "AI generated atmospheric logic.",
        owner: user ? user.email.split('@')[0] : "yertal-arcade",
        
        // Metadata & Visuals
        created: Date.now(), // Or use a time-ago helper
        image: data.image || "assets/sparks/default.jpg",
        internal_rank: rank,
        
        // Data Payload (The actual code or link)
        code: data.code || null,
        link: data.link || null,

        // Full Stats Object
        stats: {
            comments: 0,
            dislikes: 0,
            likes: 0,
            reshares: 0,
            tips: 0,
            views: 0
        }
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
