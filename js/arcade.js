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
    console.log(`%c ARCADE CORE LOADED: 17:44 `, 'background: #00f3ff; color: #000; font-weight: bold;');
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
        <section class="current-block w-full pt-6 border-t border-white/5">
            <div class="flex flex-col lg:flex-row items-center gap-8 mb-4">
                <h2 class="text-5xl font-black italic uppercase tracking-tighter leading-none" 
                    style="background: linear-gradient(to right, #fff, rgba(255,255,255,0.2)); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
                    ${current.name}
                </h2>
                
                <div class="flex items-center gap-2 bg-white/5 p-1.5 rounded-xl border border-white/10 flex-grow max-w-2xl backdrop-blur-md">
                    <input type="text" id="input-${current.id}" 
                           placeholder="Type your Prompt or URL here..." 
                           class="bg-transparent border-none text-[11px] text-white px-4 py-1.5 flex-grow outline-none focus:ring-0 font-mono">
                    
                    <button onclick="handleCreation('${current.id}')" 
                            ${sparkCount >= limits.max_sparks_per_current ? 'disabled' : ''}
                            class="bg-[var(--neon-color)] text-black text-[9px] font-black px-6 py-2 rounded-lg uppercase tracking-tight hover:scale-105 transition-transform">
                        Generate New Card
                    </button>
                </div>
            </div>

            <div class="mb-2">
                <span class="text-[10px] uppercase tracking-[0.4em] font-black text-[var(--neon-color)] opacity-80 font-mono">
                    BASED ON ${templateName}
                </span>
            </div>

            <div class="flex items-center gap-3 text-[9px] uppercase tracking-widest font-bold text-white/30">
                <span class="text-white/60">${current.owner || 'yertal-arcade-arcade'}</span> 
                <span class="opacity-20">•</span> 
                <span>CREATED: ${formatTimeAgo(current.created)}</span>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                ${renderSparks(current.sparks, current.id)}
            </div>
        </section>
    `}).join('');
}

function renderSparks(sparks, currentId) {
    if (!sparks || Object.keys(sparks).length === 0) {
        return `<div class="col-span-full py-16 border border-dashed border-white/5 rounded-[2rem] text-center bg-white/[0.01]">
                    <p class="text-white/20 text-[9px] uppercase tracking-[0.5em] font-mono">Stream Offline</p>
                </div>`;
    }

    const sortedSparks = Object.values(sparks).sort((a, b) => b.created - a.created);

    return sortedSparks.map(spark => {
        const hasRealCover = spark.image && !spark.image.includes('default.jpg');
        const viewportLink = `spark.html?current=${currentId}&spark=${spark.id}`;
        const stats = spark.stats || { views: 0, likes: 0, tips: 0 };
        const isOwner = user && (user.email.split('@')[0] === spark.owner || user.email === 'yertal-arcade-arcade@gmail.com');

        return `
            <div class="flex flex-col gap-4">
                <div class="action-card group relative flex items-center justify-center overflow-hidden min-h-[190px] rounded-[1.5rem] cursor-pointer" 
                     onclick="window.open('${viewportLink}', '_blank')">
                    
                    <h4 class="relative z-20 text-white font-black text-[13px] uppercase tracking-[0.2em] text-center px-6 drop-shadow-[0_2px_15px_rgba(0,0,0,1)] group-hover:text-[var(--neon-color)] transition-colors">
                        ${spark.name}
                    </h4>

                    <div class="absolute inset-0 z-0">
                        <img src="${spark.image || '/assets/thumbnails/default.jpg'}" 
                             class="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110 ${hasRealCover ? 'opacity-40' : 'opacity-10 grayscale'}">
                        <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent"></div>
                    </div>
                </div>

                <div class="flex justify-between items-center px-1">
                    <div class="flex gap-4 text-[10px] font-bold uppercase tracking-tight">
                        <span class="text-white/40">${stats.views} <span class="text-[7px] opacity-40">views</span></span>
                        <span class="text-white/40">${stats.likes} <span class="text-[7px] opacity-40">likes</span></span>
                        <span class="text-[var(--neon-color)]">${stats.tips || 0} <span class="text-[7px] opacity-60">tips</span></span>
                    </div>

                    <div class="flex gap-3">
                        <button onclick="event.stopPropagation(); navigator.clipboard.writeText(window.location.origin + '/arcade/${viewportLink}'); alert('Link Copied');" 
                                class="text-white/20 hover:text-[var(--neon-color)] transition-colors">
                            <i class="fas fa-share-alt text-[10px]"></i>
                        </button>
                        ${isOwner ? `
                        <button onclick="event.stopPropagation(); deleteSpark('${currentId}', '${spark.id}', '${spark.owner}')" 
                                class="text-red-500/20 hover:text-red-500 transition-colors text-[9px] font-black">
                            [X]
                        </button>
                        ` : ''}
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
