import { firebaseConfig, auth, saveToRealtimeDB } from '/config/firebase-config.js';
import { watchAuthState, logout } from '/config/auth.js';
import { ENV } from '/config/env.js';

let user;
let databaseCache = {};
const GEMINI_API_KEY = ENV.GEMINI_KEY;

// --- 1. INITIALIZATION & AUTH BOUNCER ---
watchAuthState((newUser) => {
    user = newUser;
    if (newUser === null) {
        window.location.replace('/index.html'); 
    } else if (newUser) {
        initArcade();
    }
});

async function initArcade() {
    console.log(`%c ARCADE CORE LOADED: 16:15 `, 'background: #00f3ff; color: #000; font-weight: bold;');
    const statusText = document.getElementById('engine-status-text');
    try {
        statusText.textContent = "SYNCHRONIZING WITH CORE...";
        
        const response = await fetch(`${firebaseConfig.databaseURL}/.json`);
        databaseCache = await response.json();
        
        if (!databaseCache) throw new Error("Database Empty");

        // UI Genetics
        const ui = databaseCache.settings['ui-settings'];
        const root = document.documentElement;
        root.style.setProperty('--neon-color', ui['color-neon']);
        root.style.setProperty('--accent-color', ui['color-accent']);
        root.style.setProperty('--nav-font', ui.nav_font);
        
        // Hero & Branding
        const hero = databaseCache.arcade_infrastructure.hero;
        const brand = databaseCache.navigation.branding;
        
        document.getElementById('hero-heading').textContent = hero.title;
        document.getElementById('hero-subheading').textContent = hero.subtitle;
        document.getElementById('corp-name-display').innerHTML = 
            `<span style="color: ${brand.parts[0].color}">${brand.parts[0].text}</span> 
             <span style="color: ${brand.parts[1].color}">${brand.parts[1].text}</span>`;

        // Superuser Display
        const superUserDisplay = document.getElementById('superuser-display');
        if (user && user.email === 'yertal-arcade@gmail.com') {
            superUserDisplay.textContent = "SYS_ADMIN: CONNECTED";
            superUserDisplay.style.color = 'var(--neon-color)';
        }

        renderCurrents(databaseCache.arcade_infrastructure.currents);
        
        statusText.textContent = "SYSTEM READY";
        document.body.style.opacity = '1';

    } catch (e) { 
        console.error("Initialization Error:", e);
        statusText.textContent = "CRITICAL ERROR: DATABASE OFFLINE";
    }
}

// --- 2. RENDER ENGINE (CURRENTS) ---
// --- 2. RENDER ENGINE (CURRENTS) ---
function renderCurrents(currents) {
    const container = document.getElementById('currents-container');
    if (!container || !currents) return;

    const limits = databaseCache.settings?.plan_limits?.free || { max_currents: 16, max_sparks_per_current: 48 };
    const currentTypes = databaseCache.settings?.['arcade-current-types'] || [];
    const currentsArray = Object.values(currents).slice(0, limits.max_currents);
    
    container.innerHTML = currentsArray.map(current => {
        const sparkCount = current.sparks ? Object.keys(current.sparks).length : 0;
        const typeData = currentTypes.find(t => t.id === current.type_ref);
        const templateName = typeData ? typeData.name : "Custom Logic";

        return `
        <section class="current-block mb-32 w-full">
            <div class="flex flex-col md:flex-row items-end justify-between gap-6 mb-6">
                <div class="flex-grow">
                    <div class="text-[10px] text-[var(--neon-color)] font-black tracking-[0.4em] uppercase mb-3">Active Stream</div>
                    <h2 class="text-5xl font-black italic uppercase tracking-tighter text-white leading-none mb-4">
                        ${current.name} 
                    </h2>
                    
                    <div class="flex flex-wrap gap-x-6 gap-y-2 opacity-50 text-[10px] uppercase tracking-[0.2em] font-bold">
                        <div class="text-[var(--neon-color)]">Based on ${templateName}</div>
                        <div class="text-white/40">Architect: <span class="text-white">${current.owner || 'yertal-arcade'}</span></div>
                        <div class="text-white/40">Uptime: <span class="text-white">${formatTimeAgo(current.created)}</span></div>
                    </div>
                </div>
                
                <div class="flex items-center gap-2 bg-white/5 p-2 rounded-2xl border border-white/10 w-full md:w-auto backdrop-blur-md">
                    <input type="text" id="input-${current.id}" 
                           placeholder="Prompt new logic..." 
                           class="bg-transparent border-none text-[12px] text-white px-4 py-2 rounded flex-grow md:w-72 outline-none focus:ring-0">
                    
                    <button onclick="handleCreation('${current.id}')" 
                            ${sparkCount >= limits.max_sparks_per_current ? 'disabled' : ''}
                            class="bg-[var(--neon-color)] text-black text-[10px] font-black px-8 py-3 rounded-xl uppercase tracking-tighter">
                        ${sparkCount >= limits.max_sparks_per_current ? 'Full' : 'Generate'}
                    </button>
                </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-12 mt-12">
                ${renderSparks(current.sparks, current.id)}
            </div>
        </section>
    `}).join('');
}

function renderSparks(sparks, currentId) {
    if (!sparks || Object.keys(sparks).length === 0) {
        return `<div class="col-span-full py-24 border border-dashed border-white/5 rounded-[2rem] text-center bg-white/[0.01]">
                    <p class="text-white/20 text-[10px] uppercase tracking-[0.6em] italic font-light">Zero Sparks Detected in Current</p>
                </div>`;
    }

    const sortedSparks = Object.values(sparks).sort((a, b) => b.created - a.created);

    return sortedSparks.map(spark => {
        const hasRealCover = spark.image && !spark.image.includes('default.jpg');
        const viewportLink = `spark.html?current=${currentId}&spark=${spark.id}`;
        const stats = spark.stats || { views: 0, likes: 0, tips: 0 };
        const isOwner = user && (user.email.split('@')[0] === spark.owner || user.email === 'yertal-arcade@gmail.com');

        return `
            <div class="flex flex-col gap-4">
                <div class="action-card group relative overflow-hidden" onclick="window.open('${viewportLink}', '_blank')" style="cursor: pointer;">
                    
                    <div class="absolute top-4 left-0 w-full z-10 text-center px-4">
                        <h4 class="text-white font-black text-[11px] uppercase tracking-[0.2em] drop-shadow-md group-hover:text-[var(--neon-color)] transition-colors">
                            ${spark.name}
                        </h4>
                    </div>

                    <div class="card-preview w-full h-full min-h-[160px] m-0 border-none">
                        <img src="${spark.image || '/assets/thumbnails/default.jpg'}" 
                             class="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110 ${hasRealCover ? '' : 'opacity-20 grayscale'}">
                    </div>

                    <div class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div class="border border-[var(--neon-color)] px-4 py-1 rounded text-[8px] text-[var(--neon-color)] font-bold uppercase tracking-widest">
                            Initialize Viewport
                        </div>
                    </div>
                </div>

                <div class="px-2">
                    <div class="flex items-center gap-4 text-[10px] font-bold uppercase tracking-tighter">
                        <span class="text-white/60">${stats.views} views</span>
                        <span class="text-white/60">${stats.likes} likes</span>
                        <span class="text-[var(--neon-color)]">${stats.tips || 0} tips</span>
                    </div>

                    <div class="flex justify-between items-center mt-3 pt-3 border-t border-white/5">
                        <div class="flex flex-col gap-1">
                            <span class="text-[8px] text-white/20 uppercase font-black">Rank #${spark.internal_rank || 0}</span>
                            <span class="text-[8px] text-white/20 uppercase font-black">${formatTimeAgo(spark.created)}</span>
                        </div>

                        <div class="flex gap-4">
                            <button onclick="event.stopPropagation(); navigator.clipboard.writeText(window.location.origin + '/arcade/${viewportLink}'); alert('Link Copied');" 
                                    class="text-white/20 hover:text-[var(--neon-color)] transition-colors bg-transparent border-none p-0 shadow-none">
                                <i class="fas fa-share-alt text-[11px]"></i>
                            </button>
                            ${isOwner ? `
                            <button onclick="event.stopPropagation(); deleteSpark('${currentId}', '${spark.id}', '${spark.owner}')" 
                                    class="text-red-500/20 hover:text-red-500 transition-colors text-[8px] font-black uppercase bg-transparent border-none p-0 shadow-none">
                                [ KILL ]
                            </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// --- 4. CORE LOGIC & ACTIONS ---
window.handleCreation = async (currentId) => {
    const promptInput = document.getElementById(`input-${currentId}`);
    const input = promptInput ? promptInput.value.trim() : '';
    if (!input) return;

    const status = document.getElementById('engine-status-text');
    status.textContent = "CLASSIFYING LOGIC...";

    try {
        const typeNames = databaseCache.settings['arcade-current-types'].map(t => t.name).join(', ');
        const classificationPrompt = `Analyze: "${input}". Pick one: [${typeNames}]. Return ONLY the name.`;
        const detectedCategoryName = await callGeminiAPI(classificationPrompt, 1, 'text');
        
        const presets = Object.values(databaseCache.settings['arcade-current-types'] || {});
        let template = presets.find(t => t.name.toLowerCase() === detectedCategoryName.toLowerCase()) || presets.find(t => t.id === 'custom');

        const isUrl = /^(http|https):\/\/[^ "]+$/.test(input);
        let mode = (template.logic === 'source' || isUrl) ? 'sourcing' : 'prompt';

        executeMassSpark(currentId, input, mode, template.name, template.image);
        if (promptInput) promptInput.value = '';

    } catch (e) {
        executeMassSpark(currentId, input, 'prompt', 'Custom', '/assets/thumbnails/default.jpg');
    }
};

async function executeMassSpark(currentId, prompt, mode, templateName, templateUrl) {
    const status = document.getElementById('engine-status-text');
    const countMatch = prompt.match(/\d+/);
    const count = countMatch ? Math.min(parseInt(countMatch[0]), 48) : 6;
    
    status.textContent = `FORGING ${count} SPARKS...`;

    try {
        if (mode === 'sourcing') {
            const links = await callGeminiAPI(prompt, count, 'source');
            for (const item of links) {
                await saveSpark(currentId, { ...item, type: 'link', image: null }, templateName, templateUrl);
            }
        } else {
            for (let i = 0; i < count; i++) {
                const code = await callGeminiAPI(prompt, i, 'code');
                await saveSpark(currentId, { name: `${prompt} #${i+1}`, code, type: 'code', image: null }, templateName, templateUrl);
            }
        }
        status.textContent = "SYSTEM READY";
        initArcade();
    } catch (e) { 
        status.textContent = "FORGE ERROR"; 
    }
}

// Gemini API Wrapper
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

async function saveSpark(currentId, data, detectedTemplate = 'Custom', templateUrl = '/assets/thumbnails/custom.jpg') {
    const sparkId = `spark_${Date.now()}_${Math.floor(Math.random()*1000)}`;
    const dbPath = `arcade_infrastructure/currents/${currentId}/sparks/${sparkId}`;
    const currentCurrent = Object.values(databaseCache.arcade_infrastructure.currents).find(c => c.id === currentId);
    const rank = currentCurrent && currentCurrent.sparks ? Object.keys(currentCurrent.sparks).length + 1 : 1;

    await saveToRealtimeDB(dbPath, {
        id: sparkId,
        name: data.name || "Unnamed Spark",
        owner: user ? user.email.split('@')[0] : "yertal-arcade",
        created: Date.now(),
        template_type: detectedTemplate,
        image: data.image || '/assets/thumbnails/default.jpg',
        internal_rank: rank,
        code: data.code || null,
        link: data.link || null,
        stats: { views: 0, likes: 0, tips: 0 }
    });
}

window.deleteSpark = async (currentId, sparkId, ownerPrefix) => {
    const currentUserPrefix = user ? user.email.split('@')[0] : null;
    const isSuperUser = user && user.email === 'yertal-arcade@gmail.com';
    if (currentUserPrefix !== ownerPrefix && !isSuperUser) return alert("Unauthorized.");

    if (!confirm("Decommission this spark permanently?")) return;
    await saveToRealtimeDB(`arcade_infrastructure/currents/${currentId}/sparks/${sparkId}`, null);
    initArcade();
};

function formatTimeAgo(timestamp) {
    if (!timestamp) return "---";
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return "Just now";
    if (seconds < 3600) return `${Math.floor(seconds/60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds/3600)}h ago`;
    return new Date(timestamp).toLocaleDateString();
}
