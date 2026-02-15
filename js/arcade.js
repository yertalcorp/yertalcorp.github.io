import { firebaseConfig, auth, saveToRealtimeDB, getArcadeData } from '/config/firebase-config.js';
import { watchAuthState, handleArcadeRouting, logout } from '/config/auth.js';
import { ENV } from '/config/env.js';

let user;
let databaseCache = {};
const GEMINI_API_KEY = ENV.GEMINI_KEY;

/**
 * Main UI Controller
 */
watchAuthState(async (user) => {
    if (!user) {
        window.location.href = "/index.html";
        return;
    }

    try {
        // High-level call: No Firebase SDK details visible here!
        const data = await getArcadeData();

        // Let Auth.js handle the "Where do I go?" logic
        const routeInfo = await handleArcadeRouting(user, data);

        if (routeInfo) {
            renderTopBar(routeInfo.userData, routeInfo.isOwner, user, routeInfo.mySlug);
            renderInfrastructure(routeInfo.userData.infrastructure, routeInfo.isOwner);
        }
    } catch (error) {
        console.error("Initialization Failed:", error);
    }
});

async function initArcade() {
    // Note: statusText is now used for background process updates only
    const statusText = document.getElementById('engine-status-text'); 
    try {
        const response = await fetch(`${firebaseConfig.databaseURL}/.json`);
        databaseCache = await response.json();
        
        // 1. Fetch user-specific node
        const userNode = databaseCache.users?.[user.uid] || {};
        const profile = userNode.profile || {};
        
        // 2. Branding fallbacks
        const arcadeName = profile.arcade_title || "THE YERTAL ARCADE";
        const arcadeSubtitle = profile.arcade_subtitle || "Laboratory Mode Active";
        const arcadeLogo = profile.arcade_logo || "/assets/images/Yertal_Corp_New_HR.png";

        const ui = databaseCache.settings['ui-settings'];
        const root = document.documentElement;
        root.style.setProperty('--neon-color', ui['color-neon']);

        // 3. User Title & Logo Injection
        const navHeroContainer = document.getElementById('nav-hero-central');
        const titleParts = arcadeName.split(' ');
        if (navHeroContainer) {
            navHeroContainer.innerHTML = `
                <div class="flex flex-col items-center">
                    <div class="flex items-center gap-3">
                        <img src="${arcadeLogo}" class="h-6 w-auto">
                        <h1 class="text-xl font-black italic uppercase tracking-tighter leading-none">
                            <span style="color: white">${titleParts[0]} ${titleParts[1] || ''}</span> <span style="color: var(--neon-color)">${titleParts[2] || ''}</span>
                        </h1>
                    </div>
                    <p class="text-[9px] font-bold tracking-[0.2em] opacity-60 uppercase mt-0.5">${arcadeSubtitle}</p>
                </div>
            `;
        }

        // 4. Top-Right Profile & Disconnect
        const profileContainer = document.getElementById('user-profile-nav'); // Add this ID to your HTML
        if (profileContainer) {
            profileContainer.innerHTML = `
                <div class="flex items-center gap-3">
                    <div class="text-right">
                        <p class="text-[10px] font-black text-white uppercase leading-none">${user.displayName || user.email.split('@')[0]}</p>
                        <button onclick="logout()" class="text-[8px] font-bold text-[var(--neon-color)] uppercase hover:underline">Disconnect</button>
                    </div>
                    <img src="${user.photoURL || '/assets/icons/default-avatar.png'}" class="w-8 h-8 rounded-full border border-white/20 shadow-lg">
                </div>
            `;
        }

        // 5. Render user-specific currents
        renderCurrents(userNode.infrastructure?.currents || {});
        if (statusText) statusText.textContent = "SYSTEM READY";

    } catch (e) { 
        console.error("Init Error:", e);
    }
}

function renderCurrents(currents) {
    const container = document.getElementById('currents-container');
    if (!container) return;

    const currentTypes = databaseCache.settings?.['arcade-current-types'] || [];
    const currentsArray = Object.values(currents);
    
    // If user has no currents yet, show an empty state or invitation
    if (currentsArray.length === 0) {
        container.innerHTML = `<div class="text-white/20 text-center py-20 font-black italic">NO CURRENTS INITIALIZED IN THIS ARCADE</div>`;
        return;
    }

    container.innerHTML = currentsArray.map(current => {
        const typeData = currentTypes.find(t => t.id === current.type_ref);
        const templateName = typeData ? typeData.name : "CORE LOGIC";

        return `
        <section class="current-block w-full mb-6">
            <div class="flex flex-row items-center gap-6 mb-2 border-b border-white/5 pb-2">
                <div class="flex flex-col min-w-[200px]">
                    <h2 class="text-2xl font-black italic uppercase tracking-tighter leading-none text-white">${current.name}</h2>
                    <span class="text-[9px] uppercase tracking-[0.2em] font-black italic mt-1" 
                          style="background: linear-gradient(to right, var(--neon-color), var(--accent-color)); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
                        BASED ON ${templateName}
                    </span>
                </div>
                <div class="flex flex-grow items-center gap-4">
                    <label class="text-[10px] text-white/80 uppercase font-black tracking-widest whitespace-nowrap">Create Spark</label>
                    <div class="flex-grow bg-white/5 rounded border border-white/10">
                        <input type="text" id="input-${current.id}" placeholder="Prompt..." class="bg-transparent text-[13px] text-white px-3 py-1 w-full outline-none font-mono">
                    </div>
                    <button onclick="handleCreation('${current.id}')" class="bg-[var(--neon-color)] text-black text-[10px] font-black px-6 py-1.5 rounded uppercase tracking-widest shadow-[0_0_15px_var(--neon-color)]">
                        Generate
                    </button>
                </div>
            </div>
            <div class="grid grid-cols-4 gap-4">
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
    
    // UPDATED PATH: users/[UID]/infrastructure/currents/...
    **const dbPath = `users/${user.uid}/infrastructure/currents/${currentId}/sparks/${sparkId}`;**
    
    const userNode = databaseCache.users?.[user.uid];
    const currentCurrent = userNode?.infrastructure?.currents?.[currentId];
    const rank = currentCurrent?.sparks ? Object.keys(currentCurrent.sparks).length + 1 : 1;

    await saveToRealtimeDB(dbPath, {
        id: sparkId,
        name: data.name || "Unnamed Spark",
        owner: **user.uid**, // Use UID for owner check, not email
        created: Date.now(),
        template_type: detectedTemplate,
        image: data.image || '/assets/thumbnails/default.jpg',
        internal_rank: rank,
        code: data.code || null,
        link: data.link || null,
        stats: { views: 0, likes: 0, tips: 0 }
    });
}

window.deleteSpark = async (currentId, sparkId, ownerUid) => {
    // Only allow deletion if user owns this specific arcade node
    **if (user.uid !== ownerUid && user.email !== 'yertal-arcade@gmail.com') return alert("Unauthorized.");**

    if (!confirm("Decommission this spark permanently?")) return;
    
    **const dbPath = `users/${user.uid}/infrastructure/currents/${currentId}/sparks/${sparkId}`;**
    await saveToRealtimeDB(dbPath, null);
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
