import { firebaseConfig, auth, saveToRealtimeDB, getArcadeData } from '/config/firebase-config.js';
import { watchAuthState, handleArcadeRouting, logout } from '/config/auth.js';
import { ENV } from '/config/env.js';

let user;
let databaseCache = {};
let selectedCategory = null;
const GEMINI_API_KEY = ENV.GEMINI_KEY;

async function refreshUI() {
    console.log("[SYSTEM]: INITIATING STRICT SYNC...");
    try {
        const data = await getArcadeData();
        databaseCache = data;

        const urlParams = new URLSearchParams(window.location.search);
        const slug = urlParams.get('user');

        if (!slug) {
            console.error("STRICT MODE: No slug detected in URL.");
            return;
        }

        const allUsers = data.users || {};
        const ownerUid = Object.keys(allUsers).find(uid => 
            allUsers[uid].profile && allUsers[uid].profile.slug === slug
        );

        console.table({
            "Target_Slug": slug,
            "Resolved_Owner_UID": ownerUid || "NOT_FOUND",
            "Logged_In_UID": user ? user.uid : "GUEST",
            "Access_Level": (user && user.uid === ownerUid) ? "OWNER" : "VIEWER"
        });

        if (!ownerUid) {
            const container = document.getElementById('currents-container');
            if (container) {
                container.innerHTML = `
                    <div style="text-align: center; padding: 5rem 0; opacity: 0.2; font-style: italic;">
                        STRICT MODE: No user owns the slug '${slug}'.
                    </div>`;
            }
            return;
        }

        const isOwner = (user && user.uid === ownerUid);
        const userData = allUsers[ownerUid];
        const ui = data.settings?.['ui-settings'] || {};

        document.documentElement.style.setProperty('--neon-color', ui['color-neon'] || '#00f2ff');
        
        renderTopBar(userData, isOwner, user, slug);
        renderCurrents(userData?.infrastructure?.currents || {}, isOwner, ownerUid, userData?.profile);

    } catch (e) {
        console.error("SYSTEM ERROR:", e);
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

watchAuthState(async (currentUser) => {
    if (!currentUser) {
        window.location.href = "/index.html";
        return;
    }

    user = currentUser;
    const data = await getArcadeData();
    databaseCache = data;

    // 1. CONDITIONAL GUARD: Check if the user already exists in the DB
    const userRecord = data.users?.[user.uid];

    // 2. ONLY SEED IF NEW: If no record exists, create the minimal identity
    if (!userRecord) {
        console.log("[SYSTEM]: NEW PILOT DETECTED. INITIALIZING MINIMAL IDENTITY...");
        
        const cleanSlug = user.displayName.toLowerCase().replace(/\s+/g, '-') + `-${Math.floor(1000 + Math.random() * 9000)}`;
        const profilePath = `users/${user.uid}/profile`;
        
        const minimalProfile = {
            display_name: user.displayName,
            uid: user.uid,
            slug: cleanSlug,
            plan_type: "free"
        };

        await saveToRealtimeDB(profilePath, minimalProfile);
        
        // Refresh local cache to include the new user
        if(!databaseCache.users) databaseCache.users = {};
        databaseCache.users[user.uid] = { profile: minimalProfile };

        window.location.href = `?user=${cleanSlug}`;
        return;
    }

    // 3. ROUTING FOR RETURNING USERS
    const urlParams = new URLSearchParams(window.location.search);
    const currentSlug = urlParams.get('user');

    // If a returning user hits /arcade/ without a slug, send them to their known slug
    if (!currentSlug && userRecord.profile?.slug) {
        window.location.href = `?user=${userRecord.profile.slug}`;
        return;
    }

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

function renderTopBar(userData, isOwner, authUser, mySlug) {
    const header = document.getElementById('arcade-header');
    if (!header) return;

    // STRICT DATA EXTRACTION
    const profile = userData?.profile || {};
    const arcadeLogo = profile.arcade_logo;
    const brandName = profile.display_name;
    const arcadeTitle = profile.arcade_title;
    const arcadeSubtitle = profile.arcade_subtitle;
    
    const titleParts = arcadeTitle ? arcadeTitle.split(' ') : [];

    header.innerHTML = `
        <nav style="display: flex; align-items: center; justify-content: space-between; padding: 0 1.5rem; height: 64px; filter: brightness(1.2);">
            
            <div style="display: flex; align-items: center; gap: 1rem;">
                <div style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;" onclick="window.location.href='/index.html'">
                    <div id="nav-logo" class="logo-container" style="width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;">
                        <img src="${arcadeLogo}" alt="${brandName}" style="height: 100%; width: auto; filter: drop-shadow(0 0 5px var(--neon-color));">
                    </div>
                    <h1 class="metallic-text" style="font-size: 1.1rem; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin: 0; line-height: 1;">
                        <span style="color: white;">${brandName}</span>
                    </h1>
                </div>

                <div style="display: flex; gap: 0.75rem; align-items: center; border-left: 1px solid rgba(255,255,255,0.1); padding-left: 1rem; margin-left: 0.5rem;">
                    <a href="/index.html" title="Showroom" style="color: rgba(255,255,255,0.6);"><i class="fas fa-door-open"></i></a>
                    <a href="?user=${mySlug}" title="My Arcade" style="color: rgba(255,255,255,0.6);"><i class="fas fa-home"></i></a>
                    <a href="?user=yertal-arcade" class="metallic-text" style="border: 1px solid var(--neon-color); padding: 0.2rem 0.5rem; border-radius: 4px; text-decoration: none; font-size: 8px; background: rgba(0, 242, 255, 0.05); box-shadow: 0 0 5px rgba(0, 242, 255, 0.2);">HUB</a>
                </div>
            </div>

            <div id="nav-hero-central" style="display: flex; flex-direction: column; align-items: center; text-align: center;">
                ${arcadeTitle ? `
                    <h1 style="margin: 0; font-size: 1.4rem; font-weight: 900; font-style: italic; text-transform: uppercase; letter-spacing: -0.05em; line-height: 1; text-shadow: 0 0 10px rgba(255,255,255,0.3);">
                        <span style="color: white">${titleParts[0] || ''} ${titleParts[1] || ''}</span> 
                        <span style="color: var(--neon-color); filter: drop-shadow(0 0 8px var(--neon-color));">${titleParts[2] || ''}</span>
                    </h1>
                    <p id="hero-subheading" style="color: white; opacity: 0.8; font-size: 10px; margin-top: 4px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">${arcadeSubtitle}</p>
                ` : isOwner ? `
                    <button onclick="openCreateArcadeModal()" class="generate-btn" style="padding: 0.5rem 1.5rem; border-radius: 4px; font-size: 10px; font-weight: 900; text-transform: uppercase;">
                        Initialize Arcade
                    </button>
                ` : ''}
            </div>

            <div id="auth-zone" style="display: flex; align-items: center; justify-content: flex-end; gap: 1.25rem;">
                <div class="hidden lg:block" style="position: relative;">
                    <input type="text" placeholder="SEARCH SPARKS..." class="glass" 
                           style="border: 1px solid var(--neon-color); border-radius: 9999px; padding: 0.25rem 1rem; font-size: 9px; color: white; width: 9rem; outline: none; background: rgba(255,255,255,0.05);">
                </div>
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                    <div style="text-align: right;">
                        <p id="pilot-display" style="margin: 0; line-height: 1; color: white; font-weight: 800; font-size: 10px; text-transform: uppercase;">
                            ${authUser.displayName}
                            <span style="margin-left: 4px; padding: 1px 4px; border: 1px solid var(--neon-color); border-radius: 3px; font-size: 7px; vertical-align: middle; color: var(--neon-color); background: rgba(0, 242, 255, 0.1);">${profile.plan_type || 'FREE'}</span>
                        </p>
                        <button onclick="handleLogout()" 
                                style="background: none; border: none; font-size: 8px; font-weight: 900; color: var(--neon-color); text-transform: uppercase; cursor: pointer; padding: 0; letter-spacing: 0.5px;">
                            Disconnect
                        </button>
                    </div>
                    <img src="${authUser.photoURL}" alt="Pilot Avatar" style="width: 2rem; height: 2rem; border-radius: 50%; border: 2px solid var(--neon-color); box-shadow: 0 0 8px var(--neon-color);">
                </div>
            </div>
        </nav>
        
        <div id="engine-status-container" class="status-bar" style="border-top: 1px solid rgba(0, 242, 255, 0.2); background: rgba(0,0,0,0.5); padding: 5px 1.5rem; display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
                <div class="status-dot" style="width: 8px; height: 8px; border-radius: 50%; background: var(--neon-color); box-shadow: 0 0 10px var(--neon-color);"></div>
                <span id="engine-status-text" style="color: white; font-weight: bold; font-size: 9px; text-shadow: 0 0 5px var(--neon-color);">LABORATORY SYSTEM READY</span>
            </div>
            <div style="font-size: 8px; font-weight: 900; color: var(--neon-color); opacity: 0.6; letter-spacing: 0.2em; text-transform: uppercase;">
                Arcade Environment v2.0
            </div>
        </div>
    `;
}

function renderCurrents(currents, isOwner, ownerUid, profile) {
    const container = document.getElementById('currents-container');
    if (!container) return;

    // 1. DYNAMIC PLAN LOOKUP FOR THE OWNER
    const ownerData = databaseCache.users?.[ownerUid] || {};
    const planType = ownerData.profile?.plan_type || 'free';
    const planLimits = databaseCache.settings?.['plan_limits']?.[planType] || databaseCache.settings?.['plan_limits']?.['free'];
    const maxSparks = planLimits.max_sparks_per_current;

    const currentsArray = currents ? Object.values(currents) : [];
    
    // --- EMPTY STATE LOGIC ---
    if (currentsArray.length === 0) {
        if (isOwner) {
            const firstName = profile?.display_name?.split(' ')[0] || "Engineer";
            container.innerHTML = `
                <div class="welcome-zone animate-fadeIn" style="text-align: center; padding: 8rem 2rem; border: 1px dashed rgba(0, 242, 255, 0.1); border-radius: 20px; margin: 2rem;">
                    <h1 class="metallic-text" style="font-size: clamp(2rem, 5vw, 3.5rem); margin-bottom: 1rem; letter-spacing: -1px;">
                        ${firstName}, Welcome to your Arcade
                    </h1>
                    <p style="color: var(--neon-color); opacity: 0.6; margin-bottom: 4rem; letter-spacing: 4px; font-size: 12px; font-family: 'Orbitron', sans-serif;">
                        SYSTEM STANDBY // NO ACTIVE CURRENTS DETECTED
                    </p>
                    <button onclick="window.openOnboardingHUD()" class="ethereal-btn">
                        <span class="btn-content">CREATE YOUR ARCADE</span>
                        <div class="btn-glow"></div>
                    </button>
                </div>
            `;
        } else {
            container.innerHTML = `
                <div style="text-align: center; padding: 5rem 0; opacity: 0.2; font-style: italic; letter-spacing: 2px;">
                    OFFLINE: No infrastructure detected for ID: ${ownerUid.substring(0,8)}
                </div>
            `;
        }
        return;
    }

    // --- ACTIVE STATE LOGIC ---
    container.innerHTML = currentsArray.map(current => {
        const sparks = current.sparks ? Object.values(current.sparks) : [];
        const sparkCount = sparks.length;
        const isFull = sparkCount >= maxSparks;
        const meterColor = isFull ? '#ef4444' : 'var(--neon-color)';
        
        // Hide controls if current is at capacity
        const controls = (isOwner && !isFull) ? `
            <div style="display: flex; align-items: center; gap: 0; margin-left: auto; background: rgba(0,0,0,0.6); border: 1px solid rgba(0,242,255,0.2); border-radius: 4px; padding: 2px 10px; box-shadow: inset 0 0 10px rgba(0,0,0,0.5);">
                <span style="font-family: monospace; color: var(--neon-color); font-size: 10px; margin-right: 10px; opacity: 0.7; font-weight: 900; letter-spacing: 1px;">FORGE_CMD></span>
                <input type="text" id="input-${current.id}" 
                       placeholder="SPECIFY INTENT..." 
                       class="glass"
                       style="background: transparent; border: none; padding: 0.5rem 0; font-size: 10px; width: 14rem; outline: none; color: white; font-family: 'Orbitron', sans-serif; letter-spacing: 2px;"
                       onkeydown="if(event.key==='Enter') window.handleCreation('${current.id}')">
                <button onclick="window.handleCreation('${current.id}')" 
                        class="generate-btn"
                        style="background: var(--neon-color); color: black; border: none; padding: 4px 14px; margin-left: 10px; border-radius: 2px; font-size: 9px; font-weight: 900; cursor: pointer; text-transform: uppercase; transition: all 0.3s; box-shadow: 0 0 10px var(--neon-color);">
                    EXEC
                </button>
            </div>
        ` : isFull && isOwner ? `
            <div style="margin-left: auto; color: #ef4444; font-size: 9px; font-weight: 900; letter-spacing: 1px; border: 1px solid #ef4444; padding: 4px 10px; border-radius: 4px; background: rgba(239, 68, 68, 0.05);">
                MAX CAPACITY REACHED
            </div>
        ` : `<div style="margin-left: auto; font-size: 10px; opacity: 0.3; font-family: monospace; letter-spacing: 2px; text-transform: uppercase;">Secure_Node [${ownerUid.substring(0,8)}]</div>`;

        return `
            <div class="current-block animate-fadeIn">
                <div style="display: flex; align-items: center; gap: 1.5rem; margin-bottom: 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 1rem;">
                    <h2 class="current-title" style="margin: 0;">${current.name || 'Active Current'}</h2>
                    
                    <div style="display: flex; align-items: center; gap: 0.5rem; font-family: 'Orbitron', sans-serif; font-size: 9px; color: ${meterColor}; opacity: 0.8; letter-spacing: 1px;">
                        <span style="opacity: 0.5;">CAPACITY:</span>
                        <span style="font-weight: 900;">${sparkCount} / ${maxSparks}</span>
                    </div>

                    ${controls}
                </div>
                
                <div class="experiment-zone">
                    <div id="sparks-${current.id}" class="grid">
                        ${sparks.map(spark => renderSparkCard(spark, isOwner, current.id)).join('')}
                    </div>
                </div>
            </div>
        `;
    }).join('');
    if (isOwner) {
        container.innerHTML += `
            <div style="display: flex; justify-content: center; margin-top: 3rem; padding-bottom: 5rem;">
                <button onclick="window.openOnboardingHUD()" class="terminal-btn" style="border: 1px dashed var(--neon-color); opacity: 0.6;">
                    <i class="fas fa-plus"></i> INITIALIZE NEW CURRENT
                </button>
            </div>
        `;
    }
}

/**
 * Objective: Modular infrastructure generator.
 * Handles DB entry, cache update, and initial spark generation.
 */
window.addNewCurrent = async (name, type, prompt, limits) => {
    const currentId = `current-${Date.now()}`;
    const logicType = predictLogicType(prompt);
    
    const currentData = {
        id: currentId,
        name: name,
        type_ref: type,
        logic_mode: logicType,
        privacy: 'private',
        created: Date.now()
    };

    // 1. Save to Database
    await saveToRealtimeDB(`users/${user.uid}/infrastructure/currents/${currentId}`, currentData);
    
    // 2. Local Cache Update
    if (!databaseCache.users[user.uid].infrastructure) {
        databaseCache.users[user.uid].infrastructure = { currents: {} };
    }
    databaseCache.users[user.uid].infrastructure.currents[currentId] = currentData;

    // 3. Spark Generation
    const defaultThumb = databaseCache.settings?.['ui-settings']?.['default-thumbnail'] || '/assets/thumbnails/default.jpg';
    const template = databaseCache.settings['arcade-current-types']?.find(t => t.id === type) || { name: 'Custom', image: defaultThumb };
    
    const countMatch = prompt.match(/\d+/);
    const finalCount = countMatch ? countMatch[0] : (limits?.num_mass_sparks || 3);
    const augmentedPrompt = countMatch ? prompt : `${prompt} ${finalCount}`;

    await executeMassSpark(
        currentId, 
        augmentedPrompt, 
        (logicType === 'source' ? 'sourcing' : 'prompt'), 
        template.name, 
        template.image
    );

    return currentId;
};

function renderSparkCard(spark, isOwner, currentId) {
    const targetUrl = `spark.html?current=${currentId}&spark=${spark.id}`;
    
    return `
        <div class="spark-unit" style="display: flex; flex-direction: column; gap: 0.75rem;">
            <div class="action-card" 
                 onclick="window.location.href='${targetUrl}'"
                 style="position: relative; display: flex; align-items: center; justify-content: center; overflow: hidden; min-height: 180px; cursor: pointer;">
                
                <h4 class="metallic-text" style="position: relative; z-index: 20; text-align: center; padding: 0 1.5rem; font-size: 12px; margin: 0;">
                    ${spark.name}
                </h4>

                <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; z-index: 0;">
                    <img src="${spark.image || '/assets/thumbnails/default.jpg'}" 
                         class="spark-thumbnail"
                         style="width: 100%; height: 100%; object-fit: cover; opacity: 0.4; filter: grayscale(100%); transition: all 0.7s;">
                    <div style="position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,0.9), transparent);"></div>
                </div>
            </div>

            <div class="card-stats-row" style="display: flex; justify-content: space-between; align-items: center; padding: 0 0.25rem;">
                <div class="metallic-text" style="font-size: 7px; opacity: 0.4; text-shadow: none; filter: none;">
                    ${spark.link ? 'SOURCED' : 'FORGED'}: ${formatTimeAgo(spark.created)}
                </div>
                
                <div style="display: flex; gap: 0.5rem;">
                    ${isOwner ? `
                        <button onclick="deleteSpark('${currentId}', '${spark.id}', '${user.uid}')" 
                                style="background: none; border: none; color: rgba(255,255,255,0.2); cursor: pointer; transition: color 0.3s;"
                                onmouseover="this.style.color='#ef4444'" onmouseout="this.style.color='rgba(255,255,255,0.2)'">
                            <i class="fas fa-trash" style="font-size: 10px;"></i>
                        </button>
                    ` : `
                        <button onclick="cloneSpark('${currentId}', '${spark.id}')" 
                                style="background: none; border: none; color: rgba(255,255,255,0.2); cursor: pointer; transition: color 0.3s;"
                                onmouseover="this.style.color='var(--neon-color)'" onmouseout="this.style.color='rgba(255,255,255,0.2)'">
                            <i class="fas fa-download" style="font-size: 10px;"></i>
                        </button>
                    `}
                </div>
            </div>
        </div>
    `;
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
    
    // 1. DYNAMIC PLAN LOOKUP
    const userProfile = databaseCache.users?.[user.uid]?.profile || {};
    const planType = userProfile.plan_type || 'free';
    const planLimits = databaseCache.settings?.['plan_limits']?.[planType] || databaseCache.settings?.['plan_limits']?.['free'];

    // 2. CAPACITY VALIDATION
    const userNode = databaseCache.users?.[user.uid];
    const currentSparks = userNode?.infrastructure?.currents?.[currentId]?.sparks || {};
    const existingCount = Object.keys(currentSparks).length;
    
    const maxSparks = planLimits.max_sparks_per_current;
    const remainingSpace = maxSparks - existingCount;

    if (remainingSpace <= 0) {
        status.textContent = `STORAGE FULL (${maxSparks}/${maxSparks})`;
        alert(`This Current has reached its plan capacity of ${maxSparks} sparks.`);
        return;
    }

    // 3. DETERMINE REQUESTED COUNT
    const countMatch = prompt.match(/\d+/);
    // Use num_mass_sparks as the default if no number is found in the prompt
    let requestedCount = countMatch ? parseInt(countMatch[0]) : (planLimits.num_mass_sparks || 3);

    // 4. APPLY LIMITS (Clip to remaining space)
    const finalForgeCount = Math.min(requestedCount, remainingSpace);

    if (finalForgeCount < requestedCount) {
        console.warn(`Clipping forge request from ${requestedCount} to ${finalForgeCount} due to ${planType} plan limits.`);
        status.textContent = `PLAN LIMIT REACHED: FORGING ${finalForgeCount}...`;
    } else {
        status.textContent = `FORGING ${finalForgeCount} SPARKS...`;
    }

    try {
        const defaultThumb = databaseCache.settings?.['ui-settings']?.['default-thumbnail'] || '/assets/thumbnails/default.jpg';
        const finalImageUrl = templateUrl || defaultThumb;

        if (mode === 'sourcing') {
            const links = await callGeminiAPI(prompt, finalForgeCount, 'source');
            for (const item of links) {
                await saveSpark(currentId, { 
                    name: item.name, 
                    link: item.url, 
                    type: 'link',
                    image: finalImageUrl
                }, templateName, finalImageUrl);
            }
        } else {
            for (let i = 0; i < finalForgeCount; i++) {
                const code = await callGeminiAPI(prompt, i, 'code');
                // Clean the prompt text for the name if a number was manually included
                const displayName = countMatch ? prompt.replace(countMatch[0], '').trim() : prompt;
                
                await saveSpark(currentId, { 
                    name: `${displayName} #${existingCount + i + 1}`,
                    code, 
                    type: 'code',
                    image: finalImageUrl
                }, templateName, finalImageUrl);
            }
        }
        
        status.textContent = "SYSTEM READY";
        await refreshUI(); 
    } catch (e) { 
        console.error("Forge Error:", e);
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

function renderCategoryButtons() {
    const grid = document.getElementById('category-grid');
    // Assuming 'appData' is your global variable containing the full JSON
    const categories = appData.settings['arcade-current-types'];
    
    grid.innerHTML = categories.map(cat => `
        <button class="cat-btn" onclick="selectCategory('${cat.id}', '${cat.name}')">
            <i class="fas fa-circle-notch"></i>
            <span>${cat.name}</span>
        </button>
    `).join('');
}

// --- CATEGORY SELECTION ---
window.selectCategory = (id, name) => {
    selectedCategory = id;
    document.querySelectorAll('.cat-btn').forEach(btn => btn.classList.remove('selected'));
    event.currentTarget.classList.add('selected');
    
    // Show/Hide Custom Name field
    const customWrap = document.getElementById('custom-category-wrap');
    customWrap.style.display = (id === 'custom') ? 'block' : 'none';

    const finalStep = document.getElementById('final-intent-step');
    finalStep.style.display = 'block';
    
    const promptInput = document.getElementById('initial-prompt');
    promptInput.placeholder = (id === 'custom') ? 
        "Describe what you want to build..." : 
        `e.g., Top 5 ${name.toLowerCase()} videos...`;
};
// --- SMART LOGIC ASSIGNER ---
function predictLogicType(prompt) {
    const p = prompt.toLowerCase();
    // Use the 20 arcade-current-types to see if it's a known 'source' type first
    const types = databaseCache.settings?.['arcade-current-types'] || [];
    const matchedType = types.find(t => p.includes(t.id) || p.includes(t.name.toLowerCase()));
    
    if (matchedType) return matchedType.logic;
    
    // Fallback Gemini-style keyword matching for Custom
    if (p.includes('generate') || p.includes('create') || p.includes('build') || p.includes('design')) return 'create';
    if (p.includes('top') || p.includes('find') || p.includes('list') || p.includes('show me')) return 'source';
    return 'hybrid'; 
}

window.handleInitialForge = async () => {
    // 1. Capture Inputs
    const arcadeName = document.getElementById('new-arcade-name').value;
    const arcadeSubtitle = document.getElementById('new-arcade-subtitle').value;
    const initialPrompt = document.getElementById('initial-prompt').value;
    const customName = document.getElementById('custom-cat-name').value;
    const arcadeLogo = document.getElementById('new-arcade-logo')?.value;
    const profilePic = document.getElementById('new-profile-pic')?.value;

    if (!arcadeName || !initialPrompt || !selectedCategory) {
        alert("System Error: Please define Name, Topic, and Intent.");
        return;
    }

    const userProfile = databaseCache.users?.[user.uid]?.profile || {};
    const planType = userProfile.plan_type || 'free';
    const limits = databaseCache.settings?.['plan_limits']?.[planType] || databaseCache.settings?.['plan_limits']?.['free'];

    try {
        // 2. Update Profile (Selective Merge)
        const newProfileData = {
            ...userProfile,
            arcade_title: arcadeName.toUpperCase(),
            arcade_subtitle: arcadeSubtitle,
            arcade_logo: arcadeLogo || userProfile.arcade_logo || databaseCache.settings?.['ui-settings']?.['default-logo'],
            profile_picture: profilePic || userProfile.profile_picture || user.photoURL,
            plan_type: 'free'
        };

        // Deep check for changes
        if (JSON.stringify(newProfileData) !== JSON.stringify(userProfile)) {
            await saveToRealtimeDB(`users/${user.uid}/profile`, newProfileData);
            databaseCache.users[user.uid].profile = newProfileData; 
        }

        // 3. REUSE Modular Function for Infrastructure
        const finalName = selectedCategory === 'custom' ? customName : `${selectedCategory} Lab`;
        await window.addNewCurrent(finalName, selectedCategory, initialPrompt, limits);

        // 4. Cleanup
        document.getElementById('onboarding-hud').classList.remove('active');
        await refreshUI(); 
        
    } catch (error) {
        console.error("FORGE FAILURE:", error);
    }
};

function renderLogicComponent(spark) {
    return `
        <div class="logic-display animate-slideUp">
            <div class="logic-header" style="display: flex; justify-content: space-between; align-items: center;">
                <h3 class="metallic-text">${spark.title}</h3>
                <div class="logic-actions">
                    ${spark.audio_hint ? 
                        `<button onclick="window.playSparkAudio('${spark.content}')" class="terminal-btn btn-pulse">
                            <i class="fas fa-play"></i> AUDIT_FREQUENCIES
                        </button>` : ''}
                    <button onclick="copyToClipboard('${spark.content}')" class="terminal-btn">COPY_DATA</button>
                </div>
            </div>
            
            <pre class="terminal-code"><code>${spark.content}</code></pre>
            
            <div class="logic-metadata">
                <span class="tag">LOGIC_MODE: ${spark.type.toUpperCase()}</span>
                <span class="tag">SOURCE: GEMINI_FORGE_V3</span>
            </div>
        </div>
    `;
}
window.openOnboardingHUD = () => {
    const hud = document.getElementById('onboarding-hud');
    if (hud) {
        hud.classList.add('active');
        // Logic to populate the 20 category buttons from your JSON settings
        renderCategoryButtons(); 
    }
};
/**
 * Objective: Retrieve dynamic limits based on the user's plan_type.
 */
function getPlanLimits(uid) {
    // 1. Identify the user's plan type (default to 'free')
    const userProfile = databaseCache.users?.[uid]?.profile || {};
    const planType = userProfile.plan_type || 'free';
    
    // 2. Map that plan type to the global settings
    const allPlanSettings = databaseCache.settings?.['plan_limits'] || {};
    const currentPlanLimits = allPlanSettings[planType] || allPlanSettings['free'];

    return {
        type: planType,
        maxCurrents: currentPlanLimits.max_currents || 3,
        maxSparks: currentPlanLimits.max_sparks_per_current || 10,
        initialRows: currentPlanLimits.display_rows_initial || 2,
        sparksPerRow: currentPlanLimits.sparks_per_row_desktop || 6
    };
}

// --- DEPLOYMENT TRACKER AT THE BOTTOM ---
window.auth = auth;
// attach the global logout function
window.handleCreation = handleCreation;
window.handleLogout = logout;
console.log("ARCADE CORE V.2026.02.17.22:29 - STATUS: COMPACT MODE ACTIVE");
