import { firebaseConfig, auth, saveToRealtimeDB, getArcadeData } from '/config/firebase-config.js';
import { watchAuthState, handleArcadeRouting, logout } from '/config/auth.js';
import { ENV } from '/config/env.js';

// --- DEPLOYMENT TRACKER ---
console.log("ARCADE CORE V.2026.02.15.20:55 - STATUS: COMPACT MODE ACTIVE");

let user;
let databaseCache = {};
const GEMINI_API_KEY = ENV.GEMINI_KEY;

async function refreshUI() {
    console.log("[SYSTEM]: INITIATING STRICT SYNC...");

    try {
        const data = await getArcadeData();
        databaseCache = data; 

        const urlParams = new URLSearchParams(window.location.search);
        const slug = urlParams.get('user');

        // 1. STRICT SLUG CHECK (No fallback)
        if (!slug) {
            console.error("CRITICAL: No slug in URL. Access Denied.");
            return;
        }

        // 2. STRICT OWNER RESOLUTION
        const allUsers = data.users || {};
        const ownerUid = Object.keys(allUsers).find(uid => allUsers[uid].profile?.slug === slug);
        
        // 3. LOGIC DEBUGGING (Check your console for this!)
        console.table({
            "Action": "Identity Check",
            "Logged_In_UID": user?.uid,
            "Target_Slug": slug,
            "Resolved_Owner_UID": ownerUid,
            "Ownership_Match": user?.uid === ownerUid
        });

        if (!ownerUid) {
            console.error(`CRITICAL: Slug '${slug}' not found in database.`);
            return;
        }

        const isOwner = (user && user.uid === ownerUid);
        const userData = allUsers[ownerUid];

        // 4. UI INITIALIZATION
        const ui = data.settings?.['ui-settings'] || { 'color-neon': '#00f2ff' };
        document.documentElement.style.setProperty('--neon-color', ui['color-neon']);

        renderTopBar(userData, isOwner, user, slug);
        renderCurrents(userData?.infrastructure?.currents || {}, isOwner);

    } catch (e) {
        console.error("CRITICAL SYSTEM ERROR:", e);
    }
}
    
window.openCreateArcadeModal = async () => {
    const title = prompt("ENTER ARCADE TITLE:");
    if (!title) return;
    const name = prompt("ENTER YOUR DISPLAY NAME (e.g. Yertal Corp):");
    const slug = prompt("ENTER YOUR URL SLUG (e.g. yertal-corp):").toLowerCase().replace(/\s+/g, '-');
    
    if (user && title && slug) {
        const profilePath = `users/${user.uid}/profile`;
        await saveToRealtimeDB(profilePath, {
            arcade_title: title.toUpperCase(),
            arcade_subtitle: "LABORATORY ACTIVE",
            arcade_logo: "/assets/images/Yertal_Logo_New_HR.png",
            display_name: name || user.displayName,
            slug: slug,
            privacy: "public"
        });
        
        // Use history.replaceState so we stay on the page but update the URL for the next refresh
        window.history.replaceState({}, '', `?user=${slug}`);
        await refreshUI();
    }
};

/**
 * Objective: Primary System Observer
 * Monitors login status and triggers the specialized rendering pipeline.
 */
watchAuthState(async (currentUser) => {
    if (!currentUser) {
        window.location.href = "/index.html";
        return;
    }
    user = currentUser; 
    // Simply call refreshUI. It handles the fetch, route, and render.
    refreshUI(); 
});

window.cloneSpark = async (currentId, sparkId) => {
    try {
        // 1. Identify source spark from the cache
        // We look through all users in the cache to find the one currently being viewed
        const urlParams = new URLSearchParams(window.location.search);
        const viewedUserSlug = urlParams.get('user');
        
        // Find the user ID associated with the slug we are viewing
        const allUsers = databaseCache.users || {};
        const sourceUid = Object.keys(allUsers).find(uid => allUsers[uid].profile?.slug === viewedUserSlug);
        
        if (!sourceUid) return alert("Source Spark not found.");
        
        const sourceSpark = allUsers[sourceUid].infrastructure?.currents?.[currentId]?.sparks?.[sparkId];
        
        if (!sourceSpark) return alert("Spark data missing.");

        // 2. Prepare the clone for the CURRENT logged-in user
        const newSparkId = `spark_clone_${Date.now()}`;
        const targetPath = `users/${user.uid}/infrastructure/currents/${currentId}/sparks/${newSparkId}`;
        
        const clonedData = {
            ...sourceSpark,
            id: newSparkId,
            owner: user.uid,
            created: Date.now(),
            name: `${sourceSpark.name} (CLONE)`,
            stats: { views: 0, likes: 0, tips: 0 } // Reset stats for the clone
        };

        await saveToRealtimeDB(targetPath, clonedData);
        alert("Spark synchronized to your Laboratory!");
        
    } catch (e) {
        console.error("Clone Error:", e);
        alert("Failed to clone spark.");
    }
};

/**
 * Objective: Identity & Navigation Component
 */
function renderTopBar(userData, isOwner, authUser, mySlug) {
    const header = document.getElementById('arcade-header');
    if (!header) return;

    const profile = userData?.profile || {};
    
    // UI Label (Pretty Name) vs URL Parameter (Slug)
    const displayName = profile.display_name || "PILOT";
    const arcadeLogo = profile.arcade_logo || "/assets/images/Yertal_Logo_New_HR.png";
    const titleParts = (profile.arcade_title || "THE YERTAL ARCADE").split(' ');

    header.innerHTML = `
        <div class="grid grid-cols-3 items-center w-full">
            <div class="flex items-center gap-4">
                <img src="${arcadeLogo}" class="h-6 w-auto">
                <span class="text-white font-black italic tracking-tighter">YERTAL</span>
                <div class="flex gap-4 ml-4">
                    <a href="/index.html" class="text-white/40 hover:text-[var(--neon-color)]"><i class="fas fa-door-open"></i></a>
                    <a href="?user=${mySlug}" class="text-white/40 hover:text-[var(--neon-color)]"><i class="fas fa-home"></i></a>
                    <a href="?user=yertal-arcade" class="text-[8px] font-black border border-white/10 px-2 py-1 rounded hover:bg-white hover:text-black transition-all">HUB</a>
                </div>
            </div>

            <div class="flex flex-col items-center">
                ${profile.arcade_title ? `
                    <h1 class="text-xl font-black italic uppercase tracking-tighter leading-none">
                        <span style="color: white">${titleParts[0]} ${titleParts[1] || ''}</span> 
                        <span style="color: var(--neon-color)">${titleParts[2] || ''}</span>
                    </h1>
                    <p class="text-[9px] font-bold tracking-[0.2em] opacity-60 uppercase mt-0.5">${profile.arcade_subtitle || 'Laboratory Active'}</p>
                ` : isOwner ? `
                    <button onclick="openCreateArcadeModal()" class="bg-white text-black text-[9px] font-black px-4 py-1.5 rounded uppercase tracking-widest hover:shadow-[0_0_15px_var(--neon-color)] transition-all">
                        Create Arcade
                    </button>
                ` : ''}
            </div>

            <div class="flex items-center gap-4 justify-end">
                <div class="relative hidden lg:block">
                    <input type="text" placeholder="SEARCH SPARKS..." class="bg-white/5 border border-white/10 rounded-full py-1 px-4 text-[9px] text-white focus:outline-none focus:border-[var(--neon-color)] w-40">
                </div>
                <div class="flex items-center gap-3">
                    <div class="text-right">
                        <p class="text-[9px] font-black text-white uppercase leading-none">${displayName}</p>
                        <button onclick="logout()" class="text-[8px] font-bold text-[var(--neon-color)] uppercase hover:underline">Disconnect</button>
                    </div>
                    <img src="${authUser.photoURL || '/assets/icons/default-avatar.png'}" class="w-8 h-8 rounded-full border border-white/20">
                </div>
            </div>
        </div>
    `;
}

// --- 3. THE CONTENT ENGINES (Refined) ---
function renderCurrents(currents, isOwner) {
    const container = document.getElementById('currents-container');
    if (!container) return;

    const currentTypes = databaseCache.settings?.['arcade-current-types'] || [];
    const currentsArray = Object.values(currents);
    
    if (currentsArray.length === 0) {
        container.innerHTML = `<div class="text-white/20 text-center py-20 font-black italic">NO CURRENTS INITIALIZED</div>`;
        return;
    }

    container.innerHTML = currentsArray.map(current => {
        const typeData = currentTypes.find(t => t.id === current.type_ref);
        
const controls = isOwner ? `
    <div class="flex items-center gap-2 flex-nowrap ml-auto">
        <input type="text" id="input-${current.id}" placeholder="Create a Spark..." 
               class="bg-white/5 border border-white/10 rounded px-2 py-1 text-[11px] w-64 focus:border-[var(--neon-color)] outline-none">
        <button onclick="handleCreation('${current.id}')" 
                class="bg-[var(--neon-color)] text-black text-[9px] font-black px-4 py-2 rounded uppercase whitespace-nowrap">
            Generate
        </div>
    </div>
` : `<div class="ml-auto text-[10px] opacity-30 italic font-mono">ID:${ownerUid.substring(0,5)}... (VIEWER)</div>`;

        return `
            <section class="current-block w-full mb-4">
                <div class="flex flex-row items-center gap-4 border-b border-white/5 pb-1">
                    <div class="flex flex-row items-baseline gap-2 min-w-fit">
                        <h2 class="text-sm font-black italic uppercase text-white">${current.name}</h2>
                        <span class="text-[8px] uppercase tracking-widest text-[var(--neon-color)] opacity-60">
                            [${typeData?.name || "LOGIC"}]
                        </span>
                    </div>
                    ${controls}
                </div>
                <div class="grid grid-cols-4 gap-2 mt-2">
                    ${renderSparks(current.sparks, current.id, isOwner)}
                </div>
            </section>
        `;
    }).join('');
}

function renderSparks(sparks, currentId, isOwner) {
    if (!sparks || Object.keys(sparks).length === 0) return '';

    return Object.values(sparks).map(spark => {
        const viewportLink = `${window.location.origin}/arcade/spark.html?current=${currentId}&spark=${spark.id}`;
        
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

                <div class="flex justify-between items-center px-1">
                    <div class="text-[7px] uppercase tracking-[0.2em] font-bold text-white/10 italic">
                        CREATED: ${formatTimeAgo(spark.created)}
                    </div>
                    
                    ${isOwner ? `
                        <button onclick="deleteSpark('${currentId}', '${spark.id}', '${user.uid}')" class="text-white/20 hover:text-red-500 transition-colors">
                            <i class="fas fa-trash text-[10px]"></i>
                        </button>
                    ` : `
                        <button onclick="cloneSpark('${currentId}', '${spark.id}')" class="text-white/20 hover:text-[var(--neon-color)]">
                            <i class="fas fa-download text-[10px]"></i>
                        </button>
                    `}
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
        
        // This still calls your Gemini wrapper
        const detectedCategoryName = await callGeminiAPI(classificationPrompt, 1, 'text');
        
        const presets = Object.values(databaseCache.settings['arcade-current-types'] || {});
        let template = presets.find(t => t.name.toLowerCase() === detectedCategoryName.toLowerCase()) || presets.find(t => t.id === 'custom');

        const isUrl = /^(http|https):\/\/[^ "]+$/.test(input);
        let mode = (template.logic === 'source' || isUrl) ? 'sourcing' : 'prompt';

        // Trigger the Forge
        await executeMassSpark(currentId, input, mode, template.name, template.image);
        
        if (promptInput) promptInput.value = '';

    } catch (e) {
        console.error("Creation Error:", e);
        // Fallback to custom if AI classification fails
        await executeMassSpark(currentId, input, 'prompt', 'Custom', '/assets/thumbnails/default.jpg');
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
        
    // REPLACED: window.location.reload()
        await refreshUI();
        
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
    const dbPath = `users/${user.uid}/infrastructure/currents/${currentId}/sparks/${sparkId}`;
    
    const userNode = databaseCache.users?.[user.uid];
    const currentCurrent = userNode?.infrastructure?.currents?.[currentId];
    const rank = currentCurrent?.sparks ? Object.keys(currentCurrent.sparks).length + 1 : 1;

    await saveToRealtimeDB(dbPath, {
        id: sparkId,
        name: data.name || "Unnamed Spark",
        owner: user.uid, // Use UID for owner check, not email
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
    if (user.uid !== ownerUid) return alert("Unauthorized.");
    if (!confirm("Decommission this spark?")) return;
    
    const dbPath = `users/${user.uid}/infrastructure/currents/${currentId}/sparks/${sparkId}`;
    await saveToRealtimeDB(dbPath, null);
    
    // REPLACED: initArcade() or reload()
    await refreshUI(); 
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
