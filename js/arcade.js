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
    console.log(`%c ARCADE CORE LOADED: 21:10 `, 'background: #00f3ff; color: #000; font-weight: bold;');
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
        root.style.setProperty('--hero-pt', '1.5rem'); 
        
        // Hero & Branding
        const hero = databaseCache.arcade_infrastructure.hero;
        const brand = databaseCache.navigation.branding;
        const titleParts = hero.title.split(' ');
        
        const heroHeading = document.getElementById('hero-heading');
        heroHeading.style.fontWeight = ui['nav-font-weight'] || '900';
        heroHeading.innerHTML = `
            <span style="color: ${brand.parts[0].color}">${titleParts[0]}</span> 
            <span style="color: ${brand.parts[0].color}">${titleParts[1]}</span> 
            <span style="color: var(--neon-color)">${titleParts[2]}</span>
        `;

        // SUBTITLE - ZERO BOTTOM MARGIN
        const subtitleEl = document.getElementById('hero-subheading');
        subtitleEl.textContent = hero.subtitle;
        subtitleEl.style.fontSize = "1rem";
        subtitleEl.style.color = "rgba(255, 255, 255, 0.95)";
        subtitleEl.style.fontWeight = "600";
        subtitleEl.style.marginBottom = "0px";
        subtitleEl.style.display = "block";

        document.getElementById('corp-name-display').innerHTML = 
            `<span style="color: ${brand.parts[0].color}">${brand.parts[0].text}</span> 
             <span style="color: ${brand.parts[1].color}">${brand.parts[1].text}</span>`;

        const superUserDisplay = document.getElementById('superuser-display');
        if (user && user.email === 'yertal-arcade@gmail.com') {
            superUserDisplay.textContent = "ACCESS: YERTAL-ARCADE";
            superUserDisplay.style.color = 'var(--neon-color)';
            superUserDisplay.classList.add('metallic-text');
        }

        renderCurrents(databaseCache.arcade_infrastructure.currents);
        
        statusText.textContent = "SYSTEM READY";
        statusText.classList.add('metallic-text');
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
        <section class="current-block w-full mb-12">
            <div class="flex flex-col md:flex-row items-end md:items-center gap-6 mb-4 border-b border-white/5 pb-4">
                
                <div class="flex flex-col min-w-[250px]">
                    <h2 class="current-title text-4xl font-black italic uppercase tracking-tighter leading-none" 
                        style="background: linear-gradient(to right, #fff, rgba(255,255,255,0.3)); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
                        ${current.name}
                    </h2>
                    <span class="text-[9px] uppercase tracking-[0.3em] font-black font-mono italic mt-1 opacity-70" 
                          style="color: var(--neon-color)">
                        BASED ON ${templateName}
                    </span>
                </div>

                <div class="flex flex-grow items-center gap-4 w-full">
                    <label class="text-[10px] text-white uppercase font-black tracking-widest whitespace-nowrap opacity-90">
                        Create Spark 
                    </label>
                    
                    <div class="flex items-center gap-2 bg-white/5 p-1 rounded-lg border border-white/10 flex-grow backdrop-blur-md">
                        <input type="text" id="input-${current.id}" 
                               placeholder="Prompt or URL..." 
                               class="bg-transparent border-none text-[13px] text-white px-3 py-1.5 w-full outline-none focus:ring-0 font-mono">
                    </div>

                    <button onclick="handleCreation('${current.id}')" 
                            ${sparkCount >= limits.max_sparks_per_current ? 'disabled' : ''}
                            class="generate-btn bg-[var(--neon-color)] text-black text-[10px] font-black px-8 py-2.5 rounded-md uppercase tracking-widest hover:scale-105 transition-all whitespace-nowrap">
                        Generate
                    </button>
                </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 w-full">
                ${renderSparks(current.sparks, current.id)}
            </div>
        </section>
    `}).join('');
}

function renderSparks(sparks, currentId) {
    if (!sparks || Object.keys(sparks).length === 0) return '';

    return Object.values(sparks).map(spark => {
        const viewportLink = `${window.location.origin}/arcade/spark.html?current=${currentId}&spark=${spark.id}`;
        const stats = spark.stats || { views: 0, likes: 0, tips: 0 };

        return `
            <div class="flex flex-col gap-3">
                <div class="action-card group relative flex items-center justify-center overflow-hidden min-h-[180px] rounded-[1.5rem] cursor-pointer" 
                     onclick="window.open('spark.html?current=${currentId}&spark=${spark.id}', '_blank')">
                    
                    <h4 class="relative z-20 text-white font-black text-[12px] uppercase tracking-[0.2em] text-center px-6">
                        ${spark.name}
                    </h4>

                    <div class="absolute inset-0 z-0">
                        <img src="${spark.image || '/assets/thumbnails/default.jpg'}" class="w-full h-full object-cover opacity-40 grayscale group-hover:grayscale-0 transition-all duration-700">
                        <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent"></div>
                    </div>
                </div>

                <div class="flex flex-col px-1 gap-2">
                    <div class="flex justify-between items-center">
                        <div class="flex gap-6 text-[8px] font-bold uppercase tracking-widest text-[#9ca3af]">
                            <span>${stats.views} <span class="opacity-50 text-[6px]">views </span></span>
                            <span>${stats.likes} <span class="opacity-50 text-[6px]">likes </span></span>
                            <span class="text-[var(--neon-color)]">${stats.tips || 0} <span class="opacity-60 text-[6px]">tips</span></span>
                        </div>

                        <button onclick="event.stopPropagation(); navigator.clipboard.writeText('${viewportLink}'); alert('Spark Link Copied!');" 
                                class="text-white/20 hover:text-[var(--neon-color)] transition-colors p-1">
                            <i class="fas fa-share-nodes text-[10px]"></i>
                        </button>
                    </div>
                    
                    <div class="text-[7px] uppercase tracking-[0.2em] font-bold text-white/10 italic">
                        CREATED: ${formatTimeAgo(spark.created)}
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
    if (!timestamp) return 'RECENTLY'; // Handles local latency during creation
    
    let date;
    
    // 1. Check for Firestore Timestamp object with .toDate() method
    if (typeof timestamp.toDate === 'function') {
        date = timestamp.toDate();
    } 
    // 2. Check for Firebase 'seconds' object
    else if (timestamp.seconds) {
        date = new Date(timestamp.seconds * 1000);
    } 
    // 3. Fallback for ISO strings or Date objects
    else {
        date = new Date(timestamp);
    }
    
    if (isNaN(date.getTime())) return 'SYNCING...';

    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    
    // Ensure we don't show negative time due to clock drift
    if (seconds < 5) return "JUST NOW";

    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + "Y AGO";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + "MO AGO";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + "D AGO";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + "H AGO";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + "M AGO";
    
    return Math.floor(seconds) + "S AGO";
}
