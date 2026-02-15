import { firebaseConfig, auth, saveToRealtimeDB, getArcadeData } from '/config/firebase-config.js';
import { watchAuthState, handleArcadeRouting, logout } from '/config/auth.js';
import { ENV } from '/config/env.js';

let user;
let databaseCache = {};
const GEMINI_API_KEY = ENV.GEMINI_KEY;

watchAuthState(async (currentUser) => {
    if (!currentUser) {
        window.location.href = "/index.html";
        return;
    }
    user = currentUser; // Update global user variable for saveSpark functions

    try {
        const data = await getArcadeData();
        databaseCache = data; // Keep cache updated for rendering

        const routeInfo = await handleArcadeRouting(user, data);

        if (routeInfo) {
            // Render the new Top Bar
            renderTopBar(routeInfo.userData, routeInfo.isOwner, user, routeInfo.mySlug);
            
            // Render Infrastructure
            const container = document.getElementById('currents-container');
            if (container) {
                renderCurrents(routeInfo.userData?.infrastructure?.currents || {});
            }
        }
    } catch (error) {
        console.error("Initialization Failed:", error);
    }
});

window.openCreateArcadeModal = async () => {
    const title = prompt("ENTER ARCADE TITLE (e.g., THE QUANTUM LAB):");
    if (!title) return;
    const subtitle = prompt("ENTER SUBTITLE (e.g., DECODING REALITY):");
    
    const user = auth.currentUser;
    if (user && title) {
        const profilePath = `users/${user.uid}/profile`;
        await saveToRealtimeDB(profilePath, {
            arcade_title: title.toUpperCase(),
            arcade_subtitle: (subtitle || "LABORATORY MODE ACTIVE").toUpperCase(),
            arcade_logo: "/assets/images/Yertal_Corp_New_HR.png",
            display_name: user.displayName,
            privacy: "public"
        });
        
        // Refresh the page to load the new identity
        window.location.reload();
    }
};
function renderTopBar(userData, isOwner, authUser, mySlug) {
    const header = document.getElementById('arcade-header'); // Ensure this ID exists in index.html
    if (!header) return;

    // --- SECTION 1: TOP LEFT (Navigation & Brand) ---
    const profile = userData?.profile || {};
    const arcadeLogo = profile.arcade_logo || "/assets/images/Yertal_Corp_New_HR.png";
    
    const leftSide = `
        <div class="nav-left flex items-center gap-4">
            <img src="${arcadeLogo}" class="h-8 w-auto">
            <span class="text-white font-black tracking-tighter italic">YERTAL</span>
            <div class="flex gap-2 ml-4">
                <a href="/index.html" class="nav-icon-btn" title="Showroom"><i class="fas fa-door-open"></i></a>
                <a href="?user=${mySlug}" class="nav-icon-btn" title="Home"><i class="fas fa-home"></i></a>
                <a href="?user=yertal-arcade" class="text-[9px] font-black border border-white/20 px-2 py-1 rounded hover:bg-white hover:text-black transition-all">YERTAL ARCADE</a>
            </div>
        </div>
    `;

    // --- SECTION 2: TOP CENTER (Arcade Identity) ---
    let centerSideContent = "";
    if (profile.arcade_title) {
        const titleParts = profile.arcade_title.split(' ');
        centerSideContent = `
            <div class="flex flex-col items-center">
                <h1 class="text-xl font-black italic uppercase tracking-tighter leading-none">
                    <span style="color: white">${titleParts[0]} ${titleParts[1] || ''}</span> 
                    <span style="color: var(--neon-color)">${titleParts[2] || ''}</span>
                </h1>
                <p class="text-[9px] font-bold tracking-[0.2em] opacity-60 uppercase mt-1">${profile.arcade_subtitle || 'Laboratory Mode Active'}</p>
            </div>
        `;
    } else if (isOwner) {
        centerSideContent = `
            <button onclick="openCreateArcadeModal()" class="bg-white text-black text-[10px] font-black px-4 py-2 rounded uppercase tracking-widest hover:bg-[var(--neon-color)] transition-all">
                <i class="fas fa-plus-circle mr-2"></i> Create Your Arcade
            </button>
        `;
    }

    // --- SECTION 3: TOP RIGHT (Search & Auth) ---
    const rightSide = `
        <div class="nav-right flex items-center gap-6 justify-end">
            <div class="relative hidden md:block">
                <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-[10px]"></i>
                <input type="text" placeholder="SEARCH LOGIC..." class="bg-white/5 border border-white/10 rounded-full py-1 pl-8 pr-4 text-[10px] text-white focus:outline-none focus:border-[var(--neon-color)] w-48">
            </div>
            <div class="flex items-center gap-3">
                <div class="text-right">
                    <p class="text-[10px] font-black text-white uppercase leading-none">${authUser.displayName || 'PILOT'}</p>
                    <button onclick="logout()" class="text-[8px] font-bold text-[var(--neon-color)] uppercase hover:underline">Disconnect</button>
                </div>
                <img src="${authUser.photoURL || '/assets/icons/default-avatar.png'}" class="w-8 h-8 rounded-full border border-white/20">
            </div>
        </div>
    `;

    header.innerHTML = `
        <div class="grid grid-cols-3 items-center w-full">
            ${leftSide}
            <div class="nav-center">${centerSideContent}</div>
            ${rightSide}
        </div>
    `;
}
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
