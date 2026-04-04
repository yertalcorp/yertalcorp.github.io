import { firebaseConfig, auth, saveToRealtimeDB, getArcadeData, db, get, set, ref, update, push, runTransaction } from '/config/firebase-config.js';
import { watchAuthState, handleArcadeRouting, logout } from '/config/auth.js';

// --- ADD THE GLOBAL BRIDGE HERE ---
window.auth = auth;
window.db = db;
window.ref = ref;
window.update = update;
window.get = get;

// Build Check: Manually update the time string below when pushing new code
console.log(`%c YERTAL ARCADE LOADED | ${new Date().toLocaleDateString()} @ 18:11:00 `, "background: var(--bg-color); color: var(--branding-color); font-weight: bold; border: 1px solid var(--branding-color); padding: 4px;");

let user
let databaseCache = {};
let selectedCategory = null;
let globalTheme = "neon-dark";
let cachedGKey = null;

/*
 * Global Model Stats: [ ["model-name", failureCount], ... ]
 * Replaces the old flat 'availableModels' array.
 */
let modelStats = []; 
window.isInCooldown = false;

let currentModelIndex = 0;

/*
 * Objective: Laboratory Manual / Guided Viewlets
 * Logic: Uses element-masking to highlight specific UI nodes.
 */
let tutorialIndex = 0;
const steps = [
    {
        target: null,
        title: "ARCADE_INIT",
        msg: "Welcome to your Node. This is a versatile showroom for your projects, a social hub for friends, or a business storefront where you can collect tips and funding."
    },
    {
        target: ".settings-trigger", // Assuming three dots
        title: "OS_PREFERENCES",
        msg: "Access System Settings to change themes (like Autumn Ember) or upgrade plans. Business Plans allow you to rebrand 'Tips' to 'Funds' or 'Purchase' to match your shop."
    },
    {
        target: ".terminal-btn", 
        title: "INFRASTRUCTURE",
        msg: "Initialize a 'Current' to organize your work. You can Add, Rename (Update), or Decommission (Delete) Currents to manage your lab's data streams."
    },
    {
        target: ".generate-btn",
        title: "FORGE_GENERATION",
        msg: "This is the Forge. Paste a URL to scrape content or type a prompt—try: 'Top 3 movies for the current year'—to generate a Spark instantly."
    },
    {
        target: ".spark-stats-row", // Target the icons/stats row on a card
        title: "ENGAGEMENT_PROTOCOLS",
        msg: "Interact with Sparks via Save, Share, or Tip. In Business mode, these interactions become your revenue stream for tips or product funding."
    },
    {
        target: null,
        title: "SYSTEM_READY",
        msg: "Your Laboratory is online. Start forging Currents and share your unique URL to begin growing your audience and funding."
    }
];

window.showTutorial = function() {
    tutorialIndex = 0;
    renderTutorialStep();
};

function renderTutorialStep() {
    const step = steps[currentStep];
    const mask = document.getElementById('tutorial-mask');
    const existingTooltip = document.querySelector('.tutorial-tooltip');
    if (existingTooltip) existingTooltip.remove();

    if (!step) {
        if (mask) mask.remove();
        return;
    }

    const targetEl = step.target ? document.querySelector(step.target) : null;
    
    if (targetEl) {
        // --- SPOTLIGHT STATE ---
        const rect = targetEl.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        // Radius based on element size + padding
        const r = Math.max(rect.width, rect.height) / 1.5 + 15;

        mask.style.setProperty('--x', `${x}px`);
        mask.style.setProperty('--y', `${y}px`);
        mask.style.setProperty('--r', `${r}px`);

        // Position tooltip near the element, but check for screen overflow
        const spaceBelow = window.innerHeight - rect.bottom;
        const tooltipX = Math.min(rect.left, window.innerWidth - 360);
        const tooltipY = spaceBelow > 250 ? rect.bottom + 25 : rect.top - 250;
        
        createTooltip(tooltipX, tooltipY, step);
    } else {
        // --- CENTERED STATE (Intro/Outro) ---
        // Hide the spotlight by setting radius to 0
        mask.style.setProperty('--r', `0px`);
        
        // Center the tooltip exactly
        const centerX = (window.innerWidth / 2) - 170; // Half of tooltip width
        const centerY = (window.innerHeight / 2) - 100;
        
        createTooltip(centerX, centerY, step);
    }
}

/* Objective: Manage the System Drawer and Settings Sync 
*/

// 1. Toggle Drawer Visibility
/* * Objective: Unified Drawer Toggle
 * Task: Toggle 'active' class and inject menu content
 */
window.toggleDrawer = () => {
    const drawer = document.getElementById('main-drawer');
    if (!drawer) return;

    // Only populate if we are opening it (not active yet)
    if (!drawer.classList.contains('active')) {
        renderSettingsDrawer(); 
    }

    drawer.classList.toggle('active');
};

function renderSettingsDrawer() {
    const contentContainer = document.querySelector('#main-drawer .drawer-content'); 
    // Adjust selector above if your drawer content div has a different ID/Class
    if (!contentContainer) return;

    contentContainer.innerHTML = `
        <div class="drawer-section">
            <h4 class="drawer-header">HELP</h4>
            <div class="menu-list">
                <div class="menu-item" onclick="window.toggleDrawer(); window.showTutorial();">
                    <span>View Tutorial</span>
                    <i class="fas fa-play-circle"></i>
                </div>
                <div class="menu-item" onclick="openHelpSearch()">
                    <span>Search Help Topics</span>
                    <i class="fas fa-search"></i>
                </div>
                <div class="menu-item" onclick="startAutomatedSupport()">
                    <span>Chat for Support</span>
                    <i class="fas fa-robot"></i>
                </div>
            </div>
        </div>

        <hr class="drawer-hr">

        <div class="drawer-section">
            <h4 class="drawer-header">SETTINGS</h4>
            <div class="menu-list">
                <div class="menu-item" onclick="openArcadeSettings()">
                    <span>Arcade Settings</span>
                    <i class="fas fa-vial"></i>
                </div>
                <div class="menu-item" onclick="openUpgradePath()">
                    <span style="color: var(--branding-text-color); font-weight: 800;">Upgrade Plan</span>
                    <i class="fas fa-bolt" style="color: var(--branding-color); text-shadow: 0 0 8px var(--glow-color);"></i>
                </div>
            </div>
        </div>

        <hr class="drawer-hr">

        <div class="drawer-section">
            <h4 class="drawer-header">PERFORMANCE</h4>
            <div class="menu-list">
                <div class="menu-item" onclick="window.location.href='/analytics.html'">
                    <span>Analytics</span>
                    <i class="fas fa-chart-line"></i>
                </div>
            </div>
        </div>
    `;
}
// 2. Navigation between Main and Sub-menus
window.showSubMenu = (menuId) => {
    document.getElementById('drawer-main-nav').style.display = 'none';
    document.querySelectorAll('.sub-menu').forEach(m => m.style.display = 'none');
    document.getElementById(`drawer-${menuId}`).style.display = 'block';
    
    // Pre-fill settings if opening settings
    if(menuId === 'settings') prefillSettings();
};

window.showMainMenu = () => {
    document.querySelectorAll('.sub-menu').forEach(m => m.style.display = 'none');
    document.getElementById('drawer-main-nav').style.display = 'block';
};

// 3. Prefill the inputs with current cached data
function prefillSettings() {
    const profile = databaseCache.userProfile || {};
    document.getElementById('set-display-name').value = profile.display_name || "";
    document.getElementById('set-arcade-title').value = profile.arcade_title || "";
    document.getElementById('set-arcade-subtitle').value = profile.arcade_subtitle || "";
    document.getElementById('set-arcade-logo').value = profile.arcade_logo || "";
    document.getElementById('set-arcade-theme').value = profile.current_theme_id || "neon-dark";
}

// 4. Save and Apply
window.saveAllSettings = async () => {
    const updates = {
        display_name: document.getElementById('set-display-name').value,
        arcade_title: document.getElementById('set-arcade-title').value,
        arcade_subtitle: document.getElementById('set-arcade-subtitle').value,
        arcade_logo: document.getElementById('set-arcade-logo').value,
        current_theme_id: document.getElementById('set-arcade-theme').value
    };

    // Assuming you have a helper for Firebase
    await saveToRealtimeDB(`users/${user.uid}/profile`, updates);
    
    // Refresh the UI locally
    applyTheme(updates.current_theme_id);
    
    // If your logo/title are rendered via a function, call it here
    if (typeof renderTopBar === "function") renderTopBar(); 
    
    window.toggleDrawer();
    console.log("System Identity Re-Forged.");
};

/*
 * Objective: Apply the flattened theme properties to the document root.
 */
function applyTheme(themeId) {
    const themes = databaseCache.settings?.['ui-settings']?.themes;
    const activeTheme = themes[themeId] || themes['neon-dark']; // Default to Neon

    if (!activeTheme) return;

    const root = document.documentElement;

    // We iterate through the keys (bg-color, branding-size, etc.)
    Object.keys(activeTheme).forEach(key => {
        if (key !== 'name') {
            // This turns 'bg-color' into '--bg-color'
            root.style.setProperty(`--${key}`, activeTheme[key]);
        }
    });

    console.log(`[SYSTEM] Identity Initialized: ${activeTheme.name}`);
}

function renderThemeMenu() {
    const list = document.getElementById('theme-list');
    const themes = databaseCache.settings['ui-settings'].themes;

    Object.keys(themes).forEach(id => {
        const btn = document.createElement('button');
        btn.className = 'ethereal-btn-sm';
        btn.innerText = themes[id].name;
        btn.onclick = () => {
            applyTheme(id);
            // Save preference to Firebase so it persists
            updateUserPath(`profile/current_theme_id`, id);
        };
        list.appendChild(btn);
    });
}

// Helper for the satisfying click
const playClickSound = () => {
    const audio = new Audio('https://actions.google.com/sounds/v1/foley/button_click.ogg');
    audio.volume = 0.5;
    audio.play().catch(e => console.log("Audio play blocked by browser"));
};

window.likeSpark = async (btnElement, ownerUid, currentId, sparkId) => {
    // 1. Internal Safety Check
    if (!auth.currentUser || !ownerUid || ownerUid === "undefined") return;

    const visitorUid = auth.currentUser.uid;
    const icon = btnElement.querySelector('i');
    const likesRef = ref(db, `users/${ownerUid}/infrastructure/currents/${currentId}/sparks/${sparkId}/stats/likes`);

    try {
        const result = await runTransaction(likesRef, (currentData) => {
            if (!currentData) currentData = { count: 0, users: {} };
            if (!currentData.users) currentData.users = {};

            if (currentData.users[visitorUid]) {
                // TOGGLE OFF
                delete currentData.users[visitorUid];
                currentData.count = Math.max(0, (currentData.count || 1) - 1);
            } else {
                // TOGGLE ON
                currentData.users[visitorUid] = new Date().toISOString();
                currentData.count = (currentData.count || 0) + 1;
            }
            return currentData; 
        });

        // 2. UI and Style Updates (The Toggle Fix)
        if (result.committed) {
            const updated = result.snapshot.val(); 
            const isNowLiked = updated.users && updated.users[visitorUid];
            
            // Update Icon Color & Glow
            icon.style.color = isNowLiked ? "var(--glow-color)" : "#f3e5ab";
            icon.style.filter = isNowLiked ? "drop-shadow(0 0 8px var(--glow-color))" : "none";
            
            const card = btnElement.closest('.spark-card'); 
            const likeLabel = card.querySelector('.stat-likes');
            
            if (likeLabel) {
                const count = updated.count !== undefined ? updated.count : 0;
                // FIX: Matches the new labeled format in renderSparkCard
                likeLabel.innerHTML = `
                 <i class="fas fa-thumbs-up" style="margin-right: 2px;"></i> 
                     LIKES: ${count}
                 `;
            }

            // 3. Cache Synchronization
            try {
                if (window.databaseCache?.users?.[ownerUid]?.infrastructure?.currents?.[currentId]?.sparks?.[sparkId]) {
                    window.databaseCache.users[ownerUid].infrastructure.currents[currentId].sparks[sparkId].stats.likes = updated;
                }
            } catch (e) {}
        }
    } catch (error) {
        console.error("Like toggle failed:", error);
    }
};

window.shareSpark = async (btnElement, ownerId, currentId, sparkId) => {
    /* Overall Objective: Update share stats with timestamp and count, 
       then trigger sharing UI. Ensure user UID and Date are tracked. */

    const baseUrl = window.location.origin + window.location.pathname;
    const shareUrl = `${baseUrl}?user=${ownerId}&current=${currentId}&spark=${sparkId}`;
    const shareTitle = "Check out this Spark on Yertal Arcade!";
    const shareData = { title: shareTitle, text: 'Explore this brilliant spark:', url: shareUrl };
    const visitorUid = auth.currentUser ? auth.currentUser.uid : "anonymous";

    const setNeonFeedback = () => {
        const icon = btnElement.querySelector('i');
        if (icon) {
            icon.style.color = "var(--glow-color)";
            icon.style.filter = "drop-shadow(0 0 8px var(--glow-color))";
        }
    };

    const performReshareUpdate = async () => {
        // Path matches the rules update we discussed earlier
        const resharePath = `users/${ownerId}/infrastructure/currents/${currentId}/sparks/${sparkId}/stats/reshares`;
        const reshareRef = ref(db, resharePath);

        try {
            const result = await runTransaction(reshareRef, (currentData) => {
                // 1. Data Transformation Logic
                // If it's a number (old style) or empty, initialize the new object
                if (typeof currentData !== 'object' || currentData === null) {
                    const oldCount = typeof currentData === 'number' ? currentData : 0;
                    currentData = { count: oldCount, users: {} };
                }

                // 2. Ensure users map exists for UID tracking
                if (!currentData.users) {
                    currentData.users = {};
                }

                // 3. Update count and map UID to ISO Date
                currentData.count = (currentData.count || 0) + 1;
                currentData.users[visitorUid] = new Date().toISOString();

                return currentData;
            });

            if (result.committed) {
                const updated = result.snapshot.val();
                const card = btnElement.closest('.spark-card');
                const reshareLabel = card ? card.querySelector('.stat-reshares') : null;
                
                if (reshareLabel) {
                    const displayCount = updated.count || 0;
                    reshareLabel.innerHTML = `
                        <i class="fas fa-retweet" style="font-size: 8px; margin-right: 3px;"></i> 
                        SHARES: ${displayCount}
                    `;
                }
                
                setNeonFeedback();
                
                try {
                    if (window.databaseCache?.users?.[ownerId]?.infrastructure?.currents?.[currentId]?.sparks?.[sparkId]) {
                        window.databaseCache.users[ownerId].infrastructure.currents[currentId].sparks[sparkId].stats.forges = updated;
                    }
                } catch (e) {}
            }
        } catch (error) {
            console.error("[Share Error] Firebase transaction failed:", error);
        }
    };

    // 1. ATTEMPT NATIVE SHARE
    if (navigator.share && navigator.canShare(shareData)) {
        try {
            await navigator.share(shareData);
            await performReshareUpdate();
            return;
        } catch (err) {
            if (err.name === 'AbortError') return;
        }
    }

    // 2. FALLBACK
    if (typeof launchShareHUD === "function") {
        launchShareHUD(shareUrl, shareTitle);
    } else {
        await navigator.clipboard.writeText(shareUrl);
    }
    await performReshareUpdate();
};

function launchShareHUD(url, title) {
    navigator.clipboard.writeText(url);
    
    const platforms = {
        x: `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`,
        facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
        whatsapp: `https://api.whatsapp.com/send?text=${encodeURIComponent(title + " " + url)}`,
        email: `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent("Check this out: " + url)}`
    };

    const hud = document.createElement('div');
    hud.className = 'share-hud-overlay';
    hud.innerHTML = `
        <div class="share-hud-content">
            <h4 class="metallic-text" style="font-size: 14px; margin-bottom: 20px;">SHARE THIS BRILLIANCE</h4>
            <div class="share-grid" style="display: flex; gap: 20px; justify-content: center; margin-bottom: 20px;">
                <a href="${platforms.x}" target="_blank" style="color: var(--icon-color); font-size: 20px;"><i class="fab fa-x-twitter"></i></a>
                <a href="${platforms.facebook}" target="_blank" style="color: var(--icon-color); font-size: 20px;"><i class="fab fa-facebook"></i></a>
                <a href="${platforms.whatsapp}" target="_blank" style="color: var(--icon-color); font-size: 20px;"><i class="fab fa-whatsapp"></i></a>
                <a href="${platforms.email}" style="color: var(--icon-color); font-size: 20px;"><i class="fas fa-envelope"></i></a>
                <button onclick="copyToClipboard('${url}', this)" style="background:none; border:none; color: var(--icon-color); font-size: 20px; cursor:pointer;"><i class="fas fa-link"></i></button>
            </div>
            <p style="font-size: 9px; color: var(--glow-color); margin-bottom: 15px;">LINK COPIED TO CLIPBOARD</p>
            <button onclick="this.closest('.share-hud-overlay').remove()" class="close-hud">CLOSE</button>
        </div>
    `;
    document.body.appendChild(hud);
}

window.copyToClipboard = (text, btn) => {
    navigator.clipboard.writeText(text);
    const originalIcon = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-check" style="color: var(--glow-color)"></i>';
    setTimeout(() => btn.innerHTML = originalIcon, 2000);
};

/*
 * Objective: Single Source of Truth for Rendering [cite: 2026-02-01]
 * Logic: Fetches data, ensures user exists (Seeding), then triggers UI components.
 */
async function refreshUI() {
    console.log("--- [SYSTEM]: refreshUI START ---");
    try {
        // 1. DATA ACQUISITION
        const data = await getArcadeData();
        databaseCache = data;

        // 2. SILENT SEED: Ensure the logged-in user is registered [cite: 2026-02-01]
        // We check if the current auth UID exists in the fetched user tree
        if (!data.users?.[user.uid]) {
            console.log("[SYSTEM]: User record missing. Initializing via syncUserProfile...");
            await syncUserProfile(user);
            
            // Refresh local cache after seeding so the rest of the function has valid data
            const updatedUsers = await get(ref(db, 'users'));
            data.users = updatedUsers.val();
            databaseCache.users = data.users;
        }

        // 3. ROUTE RESOLUTION
        const urlParams = new URLSearchParams(window.location.search);
        const pageOwnerSlug = urlParams.get('user');

        if (!pageOwnerSlug) {
            console.error("STRICT MODE: No slug detected in URL.");
            return;
        }

        const allUsers = data.users || {};
        
        // Find the owner of the page by matching the URL slug to a profile slug
        const ownerUid = Object.keys(allUsers).find(uid => 
            allUsers[uid].profile && allUsers[uid].profile.slug === pageOwnerSlug
        );

        const loggedInUserRecord = allUsers[user?.uid];
        const userSlug = loggedInUserRecord?.profile?.slug || "NO_SLUG";
        const isOwner = (user && user.uid === ownerUid);

        console.table({
            "Page Owner Slug": pageOwnerSlug,
            "Page Owner UID": ownerUid || "NOT_FOUND",
            "Logged in User Slug": userSlug,
            "Access_Level": isOwner ? "OWNER" : "VIEWER",
        });

        // 4. HANDLE MISSING OWNER
        if (!ownerUid) {
            const container = document.getElementById('currents-container');
            if (container) {
                container.innerHTML = `
                    <div style="text-align: center; padding: 5rem 0; opacity: 0.2; font-style: italic;">
                        STRICT MODE: No user owns the slug '${pageOwnerSlug}'.
                    </div>`;
            }
            return;
        }

        const pageOwnerData = allUsers[ownerUid];
        const ownerProfile = pageOwnerData.profile || {};
        const branding = ownerProfile.branding || {};

        // 5. SLUG-OWNER BRANDING & THEME [cite: 2026-02-17]
        globalTheme = ownerProfile.theme || 'neon-dark';
        applyTheme(globalTheme);
        
        document.title = `${ownerProfile.display_name || 'Arcade'} | Showroom`;
        
        const brandingLogo = document.getElementById('branding-logo');
        if (brandingLogo) {
            brandingLogo.src = branding.logo || 'assets/default-logo.png';
        }

        const brandingName = document.getElementById('branding-name');
        if (brandingName) {
            brandingName.textContent = ownerProfile.display_name || 'Arcade';
        }

        // Apply owner-specific UI colors to CSS variables
        const ui = branding.ui_settings || {};
        document.documentElement.style.setProperty('--neon-color', ui['color-neon'] || '#00f2ff');

        // 6. COMPONENT RENDERING
        // TopBar needs the owner data and current user context
        renderTopBar(pageOwnerData, isOwner, user, userSlug);
        
        // Currents needs the infrastructure and owner profile for context
        renderCurrents(
            pageOwnerData?.infrastructure?.currents || {}, 
            isOwner, 
            ownerUid, 
            ownerProfile
        );

        console.log("--- [SYSTEM]: refreshUI COMPLETE ---");

    } catch (e) {
        console.error("SYSTEM ERROR in refreshUI:", e);
    }
}
/* Synchronize the user details */
async function syncUserProfile(currentUser) {
    const profilePath = `users/${currentUser.uid}/profile`;
    const profileRef = ref(db, profilePath);
    const fallbackAvatar = '/assets/images/avatar.jpg';

    try {
        const snapshot = await get(profileRef);
        const existingData = snapshot.val();

        const updates = {
            display_name: currentUser.displayName,
            email: currentUser.email,
            // Prioritize provider photo, then existing DB photo, then local fallback
            photoURL: currentUser.photoURL || (existingData && existingData.photoURL) || fallbackAvatar,
            uid: currentUser.uid,
            last_sync: new Date().toISOString()
        };

        if (!existingData || !existingData.slug) {
            updates.slug = currentUser.displayName.toLowerCase().replace(/\s+/g, '-') + 
                           `-${Math.floor(1000 + Math.random() * 9000)}`;
            updates.plan_type = "free";
            updates.joined_date = new Date().toISOString();
        }

        await update(profileRef, updates);
    } catch (error) {
        console.error("Identity Sync Failed:", error);
    }
}    

watchAuthState(async (currentUser) => {
    console.log("--- [DEBUG] watchAuthState Triggered ---");
    
    if (!currentUser) {
        console.warn("[AUTH]: No currentUser detected. Redirecting to index.html...");
        window.location.href = "/index.html";
        return;
    }
    
    console.log(`[AUTH]: Logged in as: ${currentUser.email} (${currentUser.uid})`);
    user = currentUser;

    // Default to the Hub if no slug is present
    const urlParams = new URLSearchParams(window.location.search);
    const slug = urlParams.get('user');
    
    if (!slug) {
        console.log("[ROUTING]: No 'user' slug in URL. Redirecting to yertal-arcade...");
        window.location.href = "?user=yertal-arcade";
        return;
    }

    console.log(`[ROUTING]: Target Page Owner Slug: "${slug}"`);
    console.log("[UI]: Triggering refreshUI()...");
    
    // Trigger the single source of truth
    refreshUI(); 
});

window.cloneSpark = async (btn, visitorUid, sourceOwnerId, sourceCurrentId, sparkId) => {
    // Paths
    const profilePath = `users/${visitorUid}/profile`;
    const sourcePath = `users/${sourceOwnerId}/infrastructure/currents/${sourceCurrentId}/sparks/${sparkId}`;
    const destinationCurrentPath = `users/${visitorUid}/infrastructure/currents/${sourceCurrentId}`;
    const destinationSparkPath = `${destinationCurrentPath}/sparks/${sparkId}`;

    const setNeonPermanent = () => {
        const icon = btn.querySelector('i');
        if (icon) {
            icon.style.color = "var(--glow-color)";
            icon.style.filter = "drop-shadow(0 0 5px var(--glow-color))";
            btn.style.pointerEvents = "none"; 
        }
    };

    try {
        // 1. Check if Arcade Identity exists. If not, Intercept with HUD and exit.
        const profileSnapshot = await get(ref(db, profilePath));
        const profileData = profileSnapshot.val();

        if (!profileData || !profileData.arcade_title) {
            console.log("[Identity Gate] No Arcade Name found. Launching Setup HUD...");
            window.openArcadeSettings(); 
            return; // Exit here. The user will click Forge again after Establish Identity.
        }

        // 2. Check if spark already exists in visitor's collection
        const checkSnapshot = await get(ref(db, destinationSparkPath));
        if (checkSnapshot.exists()) {
            setNeonPermanent();
            alert("This spark is already in your collection!");
            return;
        }

        // 3. Fetch original spark and source current metadata
        const sourceSnapshot = await get(ref(db, sourcePath));
        const sourceCurrentSnapshot = await get(ref(db, `users/${sourceOwnerId}/infrastructure/currents/${sourceCurrentId}`));

        if (sourceSnapshot.exists() && sourceCurrentSnapshot.exists()) {
            const sparkData = sourceSnapshot.val();
            const currentMeta = sourceCurrentSnapshot.val();
            const saveDate = new Date().toISOString();

            // 4. Ensure the Infrastructure "Current" container exists for the visitor
            const visitorCurrentSnapshot = await get(ref(db, destinationCurrentPath));
            if (!visitorCurrentSnapshot.exists()) {
                await set(ref(db, destinationCurrentPath), {
                    id: sourceCurrentId,
                    name: currentMeta.name || "My Collection",
                    privacy: "public",
                    type_ref: currentMeta.type_ref || "arcade",
                    sparks: {}
                });
            }

            // 5. Update forges analytic field on the ORIGINAL spark
            const sourceForgeRef = ref(db, `${sourcePath}/stats/forges`);
            await runTransaction(sourceForgeRef, (forgeObj) => {
                if (!forgeObj) {
                    forgeObj = { count: 1, users: { [visitorUid]: saveDate } };
                    return forgeObj;
                }
                
                forgeObj.count = (forgeObj.count || 0) + 1;
                if (!forgeObj.users) forgeObj.users = {};
                forgeObj.users[visitorUid] = saveDate;
                
                return forgeObj;
            });

            // 6. Create the forged copy for the visitor (Rule Compliant Stats)
            const clonedData = {
                ...sparkData,
                id: sparkId, 
                owner: visitorUid,
                clonedFrom: sourceOwnerId,
                created: Date.now(),
                stats: {
                    views: { count: 0, total_count: 0, last_viewed: saveDate, monthly_ledger: {} },
                    tips: { count: 0, total_amount: 0, ledger: {} },
                    likes: { count: 0, users: {} },
                    reshares: { count: 0, users: {} },
                    forges: { count: 0, users: {} },
                    feedback: { count: 0, entries: {} }
                }
            };

            // 7. Write to Visitor's DB
            await set(ref(db, destinationSparkPath), clonedData);
            
            // 8. UI Feedback
            setNeonPermanent();
            console.log(`[Forge Success] Spark ${sparkId} cloned from ${sourceOwnerId} to ${visitorUid}.`);
        }
    } catch (error) {
        console.error("[Clone Error]", error);
        if (error.message.includes("PERMISSION_DENIED")) {
            console.warn("Permission Denied: Check auth state or .validate rules.");
        }
    }
};


window.genLogo = (name, profilePic, isOwner) => {
    // SYSTEM LOGS: Debugging the state
    console.log(`[genLogo Debug]: Name: "${name}" | isOwner: ${isOwner} | Photo: ${profilePic ? 'FOUND' : 'MISSING'}`);

    // 1. VISITOR VIEW: Show the Owner's Profile Pic in a 3D lifted square
    if (!isOwner && profilePic) {
        return `
            <div class="visitor-logo-3d" style="
                background: var(--btn-gradient);
                width: 42px; height: 42px;
                display: flex; align-items: center; justify-content: center;
                border-radius: 8px;
                box-shadow: 0 4px 12px var(--card-shadow-color);
                border: 1px solid var(--border-color);
                transform: perspective(1000px) rotateX(10deg);
                overflow: hidden;
            ">
                <img src="${profilePic}" alt="${name}" style="width: 100%; height: 100%; object-fit: cover;">
            </div>
        `;
    }

    // 2. OWNER VIEW: Show the Cool 3D Initials Logo (Private to you)
    // Fix for single-word "Y" -> "YE"
    const words = name ? name.trim().split(' ') : ["YA"];
    const initials = words.length > 1 
        ? (words[0][0] + words[1][0]).toUpperCase()
        : (words[0].length > 1 ? words[0].substring(0, 2) : words[0]).toUpperCase();

    return `
        <div class="owner-logo-3d" style="
            background: var(--btn-gradient);
            width: 42px; height: 42px;
            display: flex; align-items: center; justify-content: center;
            box-shadow: 0 8px 15px var(--box-shadow-color);
            border-radius: 6px;
            transform: perspective(600px) rotateY(-15deg) rotateX(5deg);
            border: 1px solid var(--button-border-color);
            position: relative;
        ">
            <span style="
                font-family: var(--branding-font); 
                font-weight: var(--branding-weight); 
                color: var(--button-text-color); 
                font-size: 1.1rem;
                text-shadow: 
                    1px 1px 0px var(--button-text-shadow-color), 
                    2px 2px 4px var(--card-shadow-color);
            ">
                ${initials}
            </span>
        </div>
    `;
};

function renderTopBar(pageOwnerData, isOwner, authUser, userSlug) {
    const header = document.getElementById('arcade-header');
    if (!header) return;

    const profile = pageOwnerData?.profile || {};
    const arcadeLogo = profile.arcade_logo;
    const brandName = profile.display_name;
    const arcadeTitle = profile.arcade_title;
    const arcadeSubtitle = profile.arcade_subtitle;
    const avatarPath = '/assets/images/avatar.jpg';
    const isSetupComplete = profile.setup_complete === true;
    const titleParts = arcadeTitle ? arcadeTitle.split(' ') : [];

    // 1. Retrieve the photo specifically from the page owner's record
    // This is now guaranteed to exist if the owner has logged in since our update
    const ownerPhotoUrl = profile.photoURL || avatarPath; 

    // 2. Generate the 3D Logo 
    // If isOwner is false, genLogo shows the ownerPhotoUrl
    // If isOwner is true, genLogo shows the 3D initials
    const logoContent = window.genLogo(brandName, ownerPhotoUrl, isOwner);
        
    header.innerHTML = `
        <nav style="display: flex; align-items: center; justify-content: space-between; padding: 0 0.5rem; height: 64px; background: var(--bg-color); border-bottom: 1px solid var(--glow-aura);">
            
            <div style="display: flex; align-items: center; gap: 0.5rem;">
                <div style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;" onclick="window.location.href='/index.html'">
                    <div id="nav-logo" class="logo-container" style="width: 38px; height: 38px; display: flex; align-items: center; justify-content: center; flex: none; border: 1px solid var(--glow-color); border-radius: 4px; background: var(--bg-color); overflow: hidden;">
                        ${logoContent}
                    </div>
                    <h1 class="metallic-text" style="font-size: 1rem; font-weight: 800; text-transform: uppercase; margin: 0; line-height: 1;">
                        <span style="color: var(--branding-text-color);">${brandName}</span>
                    </h1>
                </div>

                <div style="display: flex; gap: 0.6rem; align-items: center; border-left: 1px solid var(--glow-aura); padding-left: 0.5rem; height: 16px; margin-left: 0.2rem;">
                    <a href="/index.html" title="Showroom" style="color: var(--branding-text-color); opacity: 0.7; font-size: 11px; transition: color 0.3s;" onmouseover="this.style.color='var(--branding-color)'" onmouseout="this.style.color='var(--branding-text-color)'"><i class="fas fa-door-open"></i></a>
                    <a href="?user=${userSlug}" title="My Arcade" style="color: var(--branding-text-color); opacity: 0.7; font-size: 11px; transition: color 0.3s;" onmouseover="this.style.color='var(--branding-color)'" onmouseout="this.style.color='var(--branding-text-color)'"><i class="fas fa-home"></i></a>
<a href="?user=yertal-arcade" class="metallic-text" style="border: 1px solid var(--border-color); padding: 2px 8px; border-radius: 3px; text-decoration: none; background: var(--branding-color); color: var(--bg-color); box-shadow: 0 0 5px var(--box-shadow-color); font-size: 10px; font-weight: 900;">HUB</a>
                </div>
            </div>

            <div id="nav-hero-central" style="display: flex; flex-direction: column; align-items: center; text-align: center;">
                ${arcadeTitle ? `
                <h1 style="margin: 0; font-size: 1.4rem; font-weight: 900; font-style: italic; text-transform: uppercase; letter-spacing: -0.05em; line-height: 1;">
                    <span style="color: var(--branding-text-color);">${titleParts[0] || ''} ${titleParts[1] || ''}</span> 
                    <span style="color: var(--glow-color); filter: drop-shadow(0 0 8px var(--glow-color));">${titleParts[2] || ''}</span>
                </h1>
                <p id="hero-subheading" style="color: var(--branding-text-color); opacity: 0.6; font-size: 10px; margin-top: 4px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">${arcadeSubtitle}</p>
                ` : ''}
            </div>

            <div id="auth-zone" style="display: flex; align-items: center; justify-content: flex-end; gap: 1.25rem;">
                <div class="hidden lg:block" style="position: relative;">
                    <input type="text" placeholder="SEARCH SPARKS..." class="glass" 
                           style="border: 1px solid var(--glow-aura); border-radius: 9999px; padding: 0.25rem 1rem; font-size: 9px; color: var(--branding-text-color); width: 9rem; outline: none; background: var(--bg-color);">
                </div>
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                    <div style="text-align: right;">
                        <p id="pilot-display" style="margin: 0; line-height: 1; color: var(--branding-text-color); font-weight: 800; font-size: 10px; text-transform: uppercase;">
                            ${authUser.displayName}
                            <span style="margin-left: 4px; padding: 1px 4px; border: 1px solid var(--glow-color); border-radius: 3px; font-size: 7px; vertical-align: middle; color: var(--bg-color); background: var(--branding-color); font-weight: 900;">${profile.plan_type || 'FREE'}</span>
                        </p>
                        <button onclick="handleLogout()" 
                                style="background: none; border: none; font-size: 8px; font-weight: 900; color: var(--glow-color); text-transform: uppercase; cursor: pointer; padding: 0; letter-spacing: 0.5px;">
                            Disconnect
                        </button>
                    </div>
                    <img src="${authUser.photoURL}" alt="Pilot Avatar" style="width: 2.5rem; height: 2.5rem; border-radius: 50%; border: 2px solid var(--glow-color); box-shadow: 0 0 10px var(--glow-aura); object-fit: cover;">
                    
                    ${(isOwner && isSetupComplete) ? `
                    <div id="system-menu-trigger" onclick="toggleDrawer()" style="cursor: pointer; padding-left: 0.5rem; color: var(--branding-color); font-size: 1.1rem; transition: transform 0.3s;">
                        <i class="fa-solid fa-ellipsis-vertical"></i>
                    </div>
                    ` : ''}
                </div>
            </div>
        </nav>
        
        <div id="engine-status-container" class="status-bar" style="border-top: 1px solid var(--glow-color); background: rgba(var(--bg-color), 0.9); padding: 5px 1.5rem; display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
                <div class="status-dot" style="width: 8px; height: 8px; border-radius: 50%; background: var(--glow-color); box-shadow: 0 0 10px var(--glow-color-aura);"></div>
                <span id="engine-status-text" style="color: var(--branding-text-color); background: var(--bg-color-low); font-weight: bold; font-size: 9px; text-shadow: 0 0 5px var(--glow-aura);">LABORATORY SYSTEM READY</span>
            </div>
            <div style="font-size: 8px; font-weight: 900; color: var(--branding-color); opacity: 0.6; letter-spacing: 0.2em; text-transform: uppercase;">
                Arcade Environment v2.0
            </div>
        </div>
    `;
}

function renderCurrents(currents, isOwner, ownerUid, profile, sharedCurrentId, sharedSparkId) {
    const container = document.getElementById('currents-container');
    if (!container) return;

    // 1. DYNAMIC PLAN LOOKUP FOR THE OWNER
    const ownerData = databaseCache.users?.[ownerUid] || {};
    const planType = ownerData.profile?.plan_type || 'free';
    const planLimits = databaseCache.settings?.['plan_limits']?.[planType] || databaseCache.settings?.['plan_limits']?.['free'];
    const maxSparks = planLimits.max_sparks_per_current;

    // 2. PRIVACY FILTERING LOGIC
    const currentsArray = currents ? Object.values(currents).filter(current => {
        const isPublic = current.privacy === 'public';
        const isTargetUnlisted = current.privacy === 'unlisted' && current.id === sharedCurrentId;
        return isOwner || isPublic || isTargetUnlisted;
    }) : [];
    
    // --- ARCADE SETUP ---
    if (currentsArray.length === 0) {
        if (isOwner) {
            const firstName = profile?.display_name?.split(' ')[0] || "Engineer";
            
            if (profile?.setup_complete === true) {
                container.innerHTML = `
                    <div class="welcome-zone animate-fadeIn" style="text-align: center; padding: 6rem 2rem; border: 1px solid var(--glow-aura); border-radius: 20px; margin: 2rem; background: var(--card-bg);">
                        <h1 class="metallic-text" style="font-size: 2.5rem; margin-bottom: 1rem; color: var(--branding-text-color);">
                            LABORATORY: ${profile.arcade_title || 'ACTIVE'}
                        </h1>
                        <p style="color: var(--glow-color); opacity: 0.6; margin-bottom: 3rem; letter-spacing: 2px; font-size: 11px; font-family: 'Orbitron', sans-serif;">
                            IDENTITY_VERIFIED // READY_FOR_INFRASTRUCTURE
                        </p>
                        <div style="display: flex; justify-content: center; gap: 20px;">
                            <button onclick="window.openArcadeSettings()" class="ethereal-btn-sm">
                                <i class="fas fa-plus"></i> INITIALIZE_FIRST_CURRENT
                            </button>
                            <button onclick="window.showTutorial()" class="ethereal-btn-sm" style="opacity: 0.7;">
                                <i class="fas fa-book-open"></i> VIEW_LAB_MANUAL
                            </button>
                        </div>
                    </div>
                `;
            } else {
                container.innerHTML = `
                    <div class="welcome-zone animate-fadeIn" style="text-align: center; padding: 8rem 2rem; border: 1px dashed var(--glow-aura); border-radius: 20px; margin: 2rem; background: var(--card-bg);">
                        <h1 class="metallic-text" style="font-size: clamp(2rem, 5vw, 3.5rem); margin-bottom: 1rem; letter-spacing: -1px; color: var(--branding-text-color);">
                            ${firstName}, Welcome to your Arcade
                        </h1>
                        <p style="color: var(--glow-color); opacity: 0.6; margin-bottom: 4rem; letter-spacing: 4px; font-size: 12px; font-family: 'Orbitron', sans-serif;">
                            SYSTEM STANDBY // NO ACTIVE CURRENTS DETECTED
                        </p>
                        <button onclick="window.openArcadeSettings()" class="ethereal-btn">
                            <span class="btn-content">CREATE YOUR ARCADE</span>
                            <div class="btn-glow"></div>
                        </button>
                    </div>
                `;
            }
        } else {
            container.innerHTML = `
                <div style="text-align: center; padding: 5rem 0; opacity: 0.4; font-style: italic; letter-spacing: 2px; color: var(--branding-text-color);">
                    OFFLINE: No infrastructure detected for ID: ${ownerUid.substring(0,8)}
                </div>
            `;
        }
        return;
    }

    // --- ACTIVE STATE ---
    container.innerHTML = currentsArray.map(current => {
        const sparks = current.sparks ? Object.values(current.sparks).filter(spark => {
            const isSparkPublic = spark.privacy === 'public';
            const isSparkTargetUnlisted = spark.privacy === 'unlisted' && spark.id === sharedSparkId;
            return isOwner || isSparkPublic || isSparkTargetUnlisted;
        }) : [];

        const sparkCount = sparks.length;
        const isFull = sparkCount >= maxSparks;
        const meterColor = isFull ? 'var(--error-color, #ef4444)' : 'var(--glow-color)';

const controls = (isOwner && !isFull) ? `
    <div class="current-prompt-container">
        <span class="current-prompt-label">CREATE A NEW SPARK CARD></span>
        <input type="text" id="input-${current.id}" 
               class="current-prompt-input"
               placeholder="Type your prompt or paste a URL.  Create one card for... or Source one link for..." 
               onkeydown="if(event.key==='Enter') window.handleCreation('${current.id}', '$(current.name}')">
        <button onclick="window.handleCreation('${current.id}', '${current.name}')" class="current-prompt-exec-button">
            EXEC
        </button>
    </div>
` : isFull && isOwner ? `
    <div class="capacity-alert">MAX CAPACITY REACHED</div>
` : `<div class="secure-node-static">Secure_Node [${ownerUid.substring(0,8)}]</div>`;

return `
    <div class="current-block animate-fadeIn">
        <div class="current-header-row">
            <h2 class="current-name">${current.name || 'Active Current'}</h2>
            
            <div class="current-capacity">
                <span class="capacity-text">CAPACITY:</span>
                <span class="current-meter">${sparkCount} / ${maxSparks}</span>
            </div>

            ${controls}
        </div>
        
        <div class="experiment-zone">
            <div id="sparks-${current.id}" class="grid">
                ${sparks.map(spark => renderSparkCard(spark, isOwner, current.id, ownerUid)).join('')}
            </div>
        </div>
    </div>
`;
    }).join('');

    if (isOwner) {
        container.innerHTML += `
            <div style="display: flex; justify-content: center; margin-top: 3rem; padding-bottom: 5rem;">
                <button onclick="window.openArcadeSettings()" class="terminal-btn" style="border: 1px dashed var(--glow-color); opacity: 0.6; color: var(--branding-text-color); background: var(--bg-color);">
                    <i class="fas fa-plus"></i> INITIALIZE NEW CURRENT
                </button>
            </div>
        `;
    }
}

/*
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

    await (
        currentId, 
        name,
        augmentedPrompt, 
        (logicType === 'source' ? 'sourcing' : 'prompt'), 
        template.name, 
        template.image
    );

    return currentId;
};

function shapeAiPrompt(rawPrompt, count, mode, activeBoardName) {
    // 1. Hand off prompt to your existing resolver to locate the matched capability
    const matchedCategory = resolveCategoryFromPrompt(rawPrompt, activeBoardName);
    
    // 2. Extract the rules payload we just added to the resolver
    const categoryRules = (matchedCategory && matchedCategory.rules) ? matchedCategory.rules : "";

    let expertPersona = "";
    let systemBoundaries = "";

    // 3. Fallback to resolution logic if explicit mode isn't passed
    const activeMode = mode || matchedCategory.logic || 'hybrid';

    if (activeMode === 'create') {
        expertPersona = `You are an elite software architect and UI designer specializing in single-file HTML5 canvas applications.`;
        systemBoundaries = `Strict constraints: Output ONLY valid, executable HTML with embedded CSS and JS in a single file. Do not use external libraries. Focus heavily on smooth high-FPS canvas operations.`;
    } else if (activeMode === 'source') {
        expertPersona = `You are a high-density data extraction specialist.`;
        systemBoundaries = `Return strictly formatted arrays of data points or media links without rendering interactive simulators.`;
    } else {
        expertPersona = `You are an advanced full-stack assistant.`;
        systemBoundaries = `Adapt fluidly between rendering visual tools and pulling data arrays depending strictly on the user's focus.`;
    }

    // 4. Interpolate the specific rules from your database right into the prompt
    const fullPrompt = `
    System: ${expertPersona}
    ${systemBoundaries}
    
    Category Hard Constraints:
    ${categoryRules}
    
    User Prompt: ${rawPrompt}
    `;

    return fullPrompt;
}

// UPDATED FUNCTION
function getDynamicCardCover(themeObject) {
    const canvas = document.createElement('canvas');
    canvas.width = 300; 
    canvas.height = 180; 
    const ctx = canvas.getContext('2d');
    
    // Fallback defaults if the active theme properties are somehow missing
    const bgHigh = themeObject['bg-color-high'] || 'rgba(0, 8, 15, 1.0)';
    const bgMid = themeObject['bg-color-mid'] || 'rgba(0, 2, 5, 1.0)';
    const bgLow = themeObject['bg-color-low'] || 'rgba(0, 5, 10, 1.0)';
    const glowColor = themeObject['glow-color'] || 'rgba(0, 242, 255, 1.0)';
    
    // 1. CREATE METALLIC GRADIENT BACKGROUND FROM THEME
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, bgLow);
    gradient.addColorStop(0.3, bgMid);
    gradient.addColorStop(0.5, bgHigh); // Highlight line centered
    gradient.addColorStop(0.7, bgMid);
    gradient.addColorStop(1, bgLow);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. RENDER RANDOM FRACTAL OVERLAY USING THEME GLOW
    ctx.strokeStyle = glowColor;
    ctx.globalAlpha = 0.12; // Ghostly, glowing fractal lines
    ctx.lineWidth = 1;
    ctx.shadowBlur = 10;
    ctx.shadowColor = glowColor;

    const iterations = 1500;
    let x = Math.random() * canvas.width;
    let y = Math.random() * canvas.height;
    
    ctx.beginPath();
    ctx.moveTo(x, y);
    
    for (let i = 0; i < iterations; i++) {
        const nx = x + (Math.sin(x * 0.02 + y * 0.03) * 15);
        const ny = y + (Math.cos(x * 0.03 - y * 0.02) * 15);
        
        ctx.lineTo(nx, ny);
        x = nx;
        y = ny;
        
        if (x < 0) x = canvas.width; if (x > canvas.width) x = 0;
        if (y < 0) y = canvas.height; if (y > canvas.height) y = 0;
    }
    ctx.stroke();
    
    ctx.globalAlpha = 1.0;
    ctx.shadowBlur = 0; 
    
    const finalImage = canvas.toDataURL('image/png');
    return finalImage;
}
// NEW FUNCTION
function getFinalSparkCountAndItems(prompt, manualUrls, planLimits, remainingSpace) {
    const actionVerbs = ['create', 'build', 'fetch', 'top', 'get', 'generate', 'show'];
    const numberWords = { 
        'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5, 
        'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10 
    };

    // 1. Strip URLs to read pure command text
    let cleanPrompt = prompt;
    manualUrls.forEach(url => { cleanPrompt = cleanPrompt.replace(url, ''); });
    const words = cleanPrompt.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").split(/\s+/);

    let requestedCount = null;

    // 2. Priority Logic: Check immediately after an action word
    for (let i = 0; i < words.length - 1; i++) {
        const currentWord = words[i].toLowerCase();
        
        if (actionVerbs.includes(currentWord)) {
            const nextWord = words[i + 1].toLowerCase();
            
            if (/^\d+$/.test(nextWord)) {
                requestedCount = parseInt(nextWord, 10);
                break;
            } else if (numberWords[nextWord]) {
                requestedCount = numberWords[nextWord];
                break;
            } else if (['a', 'an', 'the'].includes(nextWord)) {
                requestedCount = 1;
                break;
            }
        }
    }

    // 3. Fallback: Old regex search if direct priority didn't hit
    if (requestedCount === null) {
        const wordMatch = cleanPrompt.toLowerCase().match(/\b(one|two|three|four|five|six|seven|eight|nine|ten)\b/);
        const digitMatch = cleanPrompt.match(/\b\d{1,2}\b/);
        
        if (wordMatch) {
            requestedCount = numberWords[wordMatch[0]];
        } else if (digitMatch) {
            requestedCount = parseInt(digitMatch[0], 10);
        } else {
            requestedCount = 1;
        }
    }

    // 4. Calculate bounded final counts
    const cappedRequestedCount = Math.min(requestedCount, planLimits.num_mass_sparks);
    const finalForgeCount = Math.min(cappedRequestedCount, remainingSpace);

    // 5. Build workload collection for URLs if needed
    const textChunks = cleanPrompt.split(/,|\n/).map(str => str.trim()).filter(Boolean);
    
    return {
        count: finalForgeCount,
        textChunks: textChunks,
        isAiReferenceSearch: (manualUrls.length > 0 && requestedCount > 1)
    };
}

// FUNCTION: executeMassSpark
async function executeMassSpark(currentId, currentName, prompt, mode, templateName, templateUrl) {
    const status = document.getElementById('engine-status-text');
    
    // --------------------------------------------------------
    // 1. TIGHTENED TYPE & LOGIC CHECK
    // --------------------------------------------------------
    const prediction = resolveCategoryFromPrompt(prompt, currentName); 
    const predictedType = prediction.id;        
    let activeResolution = prediction.logic;  
    const predictedCurrentName = prediction.name; 
    
    if (predictedCurrentName.toLowerCase() === 'custom') {
        console.log("[FORGE]: Custom category detected. Defaulting to 'source' resolution.");
        activeResolution = 'source';
    }

    if (currentName && predictedCurrentName.toLowerCase() !== currentName.toLowerCase()) {
        if (predictedCurrentName.toLowerCase() !== 'custom') {
            const proceed = confirm(
                `⚠️ Warning: The prompt category doesn't match the current type.\n\n` +
                `Either change the prompt to use the current type [${currentName}] or create/use a current for [${predictedCurrentName}].\n\n` +
                `Do you want to continue anyway?`
            );
            if (!proceed) return; 
        }
    }
    
    // 2. DYNAMIC PLAN LOOKUP & CAPACITY VALIDATION
    const userProfile = databaseCache.users?.[user.uid]?.profile || {};
    const planType = userProfile.plan_type || 'free';
    const planLimits = databaseCache.settings?.['plan_limits']?.[planType] || databaseCache.settings?.['plan_limits']?.['free'];

    const userNode = databaseCache.users?.[user.uid];
    const currentSparks = userNode?.infrastructure?.currents?.[currentId]?.sparks || {};
    const existingCount = Object.keys(currentSparks).length;
    const maxSparks = planLimits.max_sparks_per_current;
    const remainingSpace = maxSparks - existingCount;

    if (remainingSpace <= 0) {
        status.textContent = `STORAGE FULL (${maxSparks}/${maxSparks})`;
        alert(`Limit reached: ${maxSparks} sparks.`);
        return;
    }

    // --------------------------------------------------------
    // 3. NEW DELEGATED COUNT & WORKLOAD LOGIC
    // --------------------------------------------------------
    const manualUrls = extractUrls(prompt);
    const resolution = getFinalSparkCountAndItems(prompt, manualUrls, planLimits, remainingSpace);
    const finalForgeCount = resolution.count;
    const textChunks = resolution.textChunks;
    const isAiReferenceSearch = resolution.isAiReferenceSearch;

    const updateForgeStatus = (text) => {
        if (!window.isInCooldown) status.textContent = text;
    };

    try {
        const defaultThumb = databaseCache.settings?.['ui-settings']?.['default-thumbnail'] || '/assets/thumbnails/default.jpg';
        const finalImageUrl = templateUrl || defaultThumb;
        const finalCategoryName = templateName;

        // --------------------------------------------------------
        // 5. FORGING LOGIC
        // --------------------------------------------------------
        if (activeResolution === 'source') {
            let linksToSave = [];

            if (manualUrls.length > 0 && !isAiReferenceSearch) {
                console.log("[FORGE]: Processing manual URLs and extracting surrounding text strings.");
                
                const itemsCountToTake = Math.min(manualUrls.length, finalForgeCount);
                
                for (let i = 0; i < itemsCountToTake; i++) {
                    linksToSave.push({
                        name: textChunks[i] || generateSparkName(currentId),
                        url: manualUrls[i]
                    });
                }
            } else {
                updateForgeStatus("CONSULTING MODEL POOL...");
                
                const structuredPrompt = shapeAiPrompt(prompt, finalForgeCount, 'source', predictedType);
                
                const aiLinks = await callGeminiAPI(structuredPrompt, finalForgeCount, activeResolution);
                let rawLinksArray = [];
                
                if (Array.isArray(aiLinks)) {
                    rawLinksArray = aiLinks;
                } else if (typeof aiLinks === 'string') {
                    console.warn("[FORGE]: Gemini returned raw text. Forcing string-split array fallback.");
                    rawLinksArray = aiLinks.split(/,|\n/).map(str => str.trim()).filter(Boolean);
                }

                linksToSave = rawLinksArray.slice(0, finalForgeCount).map(item => {
                    const extractedName = item.name || generateSparkName(currentId);
                    const extractedUrl = item.url || item;
                    return { name: extractedName, url: extractedUrl };
                });                    
            }

            for (let i = 0; i < linksToSave.length; i++) {
                const item = linksToSave[i];
                const sparkName = linksToSave.length > 1 && item.name.startsWith('spark_') ? `${item.name}-${i + 1}` : item.name;
                
                await saveSpark(currentId, { name: sparkName, link: item.url, prompt, type: 'link', image: finalImageUrl }, finalCategoryName, finalImageUrl);
                
                const progress = Math.round(((i + 1) / linksToSave.length) * 100);
                updateForgeStatus(`FORGING ${finalForgeCount} SPARKS [${"=".repeat(Math.floor(progress/10))}${"-".repeat(10-Math.floor(progress/10))}] ${progress}%`);
            }
        } else {
            // 'Create' Mode (activeResolution === 'create')
            for (let i = 0; i < finalForgeCount; i++) {
                const progress = Math.round((i / finalForgeCount) * 100);
                updateForgeStatus(`FORGING ${finalForgeCount} SPARKS [${"=".repeat(Math.floor(progress/10))}${"-".repeat(10-Math.floor(progress/10))}] ${progress}%`);

                const structuredPrompt = shapeAiPrompt(prompt, i, 'create', predictedType);

                const code = await callGeminiAPI(structuredPrompt, i, activeResolution);
                const sparkName = finalForgeCount > 1 ? `${generateSparkName(currentId)}-${i + 1}` : generateSparkName(currentId);
                
                const isCode = code.trim().startsWith('<') || code.trim().startsWith('function') || code.trim().startsWith('const') || code.trim().includes('document.');
                
                const payload = isCode ? { name: sparkName, code, prompt, type: 'code', image: finalImageUrl } 
                                       : { name: sparkName, link: code, prompt, type: 'link', image: finalImageUrl };

                await saveSpark(currentId, payload, finalCategoryName, finalImageUrl);
            }
            updateForgeStatus(`FORGING ${finalForgeCount} SPARKS [==========] 100%`);
        }

        setTimeout(async () => {
            status.textContent = "SYSTEM READY";
            await refreshUI(); 
        }, 1000);

    } catch (e) { 
        console.error("Forge Error:", e);
        if (!window.isInCooldown) status.textContent = "FORGE ERROR";
    }
}

/*
 * Processes the image field from the DB.
 * Returns the Base64 string if present, or a formatted asset path.
 */
function genSparkImage(sparkImageFromDB) {
    if (!sparkImageFromDB) {
        console.warn("Result: Fallback to default.jpg");
        return 'assets/thumbnails/default.jpg';
    }

    if (sparkImageFromDB.startsWith('data:image/')) {
        console.log("Result: Valid Data URI detected. Length:", sparkImageFromDB.length);
        // Check for common corruption: space at start or missing base64 tag
        if (sparkImageFromDB.includes(" ")) console.error("Validation Error: Data URI contains spaces!");
        return sparkImageFromDB;
    }

    console.log("Result: Treating as standard path/URL");
    return sparkImageFromDB;
}

// FUNCTION: renderSparkCard
function renderSparkCard(spark, isOwner, currentId, ownerId) {
    /* Overall Objective: Generate the HTML for a spark card with persistent 
        neon state for likes and shares based on user history. */
    
    const targetUrl = `spark.html?current=${currentId}&spark=${spark.id}`;
    const visitorUid = auth.currentUser ? auth.currentUser.uid : null;
    const sparkElementId = `save-btn-${spark.id}`;

    try {
        const sparkImage = genSparkImage(spark.image);

        // 0. Debug Log: Track final image path per card
        console.log(`[RENDER] Spark ID: ${spark.id} | Image Path: ${spark.image} | Image Path Length: ${sparkImage.length} | Start: ${sparkImage.substring(0, 30)}`);
    
        // DYNAMIC FALLBACK TRIGGER
        let finalRenderedImage = sparkImage;
        const defaultThumb = spark.image || '/assets/thumbnails/default.jpg';
    
        // PRE-RENDER TRY-CATCH GUARD

        if (!sparkImage || spark.image === "") {
            // Fetch the live active theme state on render
            const activeThemeKey = localStorage.getItem('arcade-theme') || 'neon-dark';
            const activeThemeData = databaseCache.settings?.['themes']?.[activeThemeKey] || {};
            
            console.log(`[RENDER]: Cover fallback triggered for ${spark.id}. Generating in-memory fractal.`);
            finalRenderedImage = getDynamicCardCover(activeThemeData);
        }
    } catch (error) {
        console.error(`[CRITICAL RENDER ERROR] Spark ID: ${spark.id} failed during canvas generation. Using default fallback asset.`, error);
        finalRenderedImage = getDynamicCardCover(activeThemeData);
    }

    // 1. Core Color Palette
    const pearlColor = "var(--list-color)";
    const neonColor = "var(--glow-color)";
    const neonGlow = "drop-shadow(0 0 5px var(--glow-color))";
    
    // 2. State Assignments (Persisting the Neon state)
    const hasLiked = spark.stats?.likes?.users?.[visitorUid] ? true : false;
    const likeIconColor = hasLiked ? neonColor : pearlColor;
    const likeIconGlow = hasLiked ? neonGlow : "none";

    // Task: Check if this visitor has shared this spark at least once
    const hasShared = spark.stats?.reshares?.users?.[visitorUid] ? true : false;
    const shareIconColor = hasShared ? neonColor : pearlColor;
    const shareIconGlow = hasShared ? neonGlow : "none";

    // Forge State Check (Internal Async)
    if (visitorUid && !isOwner) {
        (async () => {
            const savedRef = ref(db, `users/${visitorUid}/infrastructure/currents/${currentId}/sparks/${spark.id}`);
            const snapshot = await get(savedRef);
            if (snapshot.exists()) {
                const btn = document.getElementById(sparkElementId);
                if (btn) {
                    const icon = btn.querySelector('i');
                    icon.style.color = neonColor;
                    icon.style.filter = neonGlow;
                    btn.style.pointerEvents = "none";
                    btn.title = "Already in Your Arcade";
                }
            }
        })();
    }

    const toolIconColor = pearlColor;

    // 3. Extraction of Stats Counts
    const viewCount = spark.stats?.views?.count || 0;
    const likeCount = spark.stats?.likes?.count || 0;
    const shareCount = spark.stats?.reshares?.count || 0;
    const tipCount = spark.stats?.tips?.count || 0;

    // Shared Styles
    const btnStyle = `background: none; border: none; cursor: pointer; padding: 4px; display: flex; align-items: center; justify-content: center; transition: all 0.3s ease; filter: drop-shadow(0 0 2px var(--glow-color));`;
    const onHover = "this.style.filter='drop-shadow(0 0 8px var(--glow-color))'; this.style.transform='scale(1.2)';"
    const onOut = "this.style.filter='drop-shadow(0 0 2px var(--glow-color))'; this.style.transform='scale(1)';"
    
    // Define the emergency network fallback execution string for the inline HTML tag
    const activeThemeKeyForHtml = localStorage.getItem('arcade-theme') || 'neon-dark';
    const activeThemeDataForHtml = databaseCache.settings?.['themes']?.[activeThemeKeyForHtml] || {};
    
    const inlineFallbackJS = `console.error('IMAGE NETWORK FAILED: ${spark.id}. Activating dynamic fallback...'); this.onerror=null; try { this.src=getDynamicCardCover(${JSON.stringify(activeThemeDataForHtml)}); } catch(e) { this.src=\\'/assets/thumbnails/default.jpg\\'; }`;

    return `
        <div class="spark-card" data-spark-id="${spark.id}" style="display: flex; flex-direction: column; gap: 0.75rem; align-items: center; width: 100%;">
            <div class="action-card" 
                  onclick="window.location.href='${targetUrl}'"
                  style="position: relative; display: flex; align-items: center; justify-content: center; overflow: hidden; min-height: 180px; width: 100%; cursor: pointer; border-radius: 8px; background: #111 !important;">
                
                <h4 class="metallic-text" style="position: relative; z-index: 10; text-align: center; padding: 0 1.5rem; pointer-events: none;">
                    ${spark.name}
                </h4>
                
                <img src="${finalRenderedImage}" 
                       class="spark-thumbnail"
                       onerror="${inlineFallbackJS}"
                       onload="this.style.opacity='1'; console.log('IMAGE SUCCESS: ${spark.id}')"
                       style="z-index: 1; display: block; transition: opacity 0.5s ease;">
                
                <div style="position: absolute; inset: 0; background: var(--branding-color); opacity: 0.1; z-index: 2; pointer-events: none;"></div>
            </div>

            <div class="card-footer" style="display: flex; flex-direction: column; gap: 0.5rem; width: 100%; align-items: center;">
                
                <div class="stats-row" style="display: flex; justify-content: center; align-items: center; gap: 0.8rem; font-size: 8px; color: rgba(var(--fg-color-high),0.4); border-bottom: 1px solid rgba(var(--fg-color-high),0.1); width: 85%; padding-bottom: 6px; text-align: center; text-transform: uppercase; letter-spacing: 0.5px;">
                    <span class="stat-views" title="Total Views">
                        <i class="fas fa-eye" style="margin-right: 2px;"></i> 
                        VIEWS: ${viewCount}
                    </span>
                    <span class="stat-likes" title="Total Likes">
                        <i class="fas fa-thumbs-up" style="margin-right: 2px;"></i> 
                        LIKES: ${likeCount}
                    </span>
                    <span class="stat-reshares" title="Total Shares">
                        <i class="fas fa-retweet" style="margin-right: 2px;"></i> 
                        SHARES: ${shareCount}
                    </span>
                    <span class="stat-tips" title="Total Tips">
                        <i class="fas fa-coins" style="margin-right: 2px;"></i> 
                        TIPS: ${tipCount}
                    </span>
                </div>

                <div class="interaction-row" style="display: flex; flex-direction: column; align-items: center; gap: 0.4rem; width: 100%;">
                    <div class="metallic-text" style="font-size: 7px; opacity: 0.4; text-shadow: none; filter: none;">
                        ${spark.link ? 'SOURCED' : 'FORGED'}: ${formatTimeAgo(spark.created)}
                    </div>
                    
                    <div class="action-buttons" style="display: flex; gap: 0.8rem; align-items: center; justify-content: center;">
                        <button onclick="likeSpark(this, '${ownerId}', '${currentId}', '${spark.id}')" title="Like" style="${btnStyle}" onmouseover="${onHover}" onmouseout="${onOut}">
                            <i class="fas fa-thumbs-up" style="font-size: 10px; color: ${likeIconColor}; filter: ${likeIconGlow};"></i>
                        </button>

                        ${isOwner ? `
                            <button onclick="shareSpark(this, '${ownerId}', '${currentId}', '${spark.id}')" title="Share" style="${btnStyle}" onmouseover="${onHover}" onmouseout="${onOut}">
                                <i class="fas fa-share-alt" style="font-size: 10px; color: ${shareIconColor}; filter: ${shareIconGlow};"></i>
                            </button>
                            <button onclick="deleteSpark('${currentId}', '${spark.id}', '${visitorUid}')" title="Delete" 
                                    style="${btnStyle}" 
                                    onmouseover="this.style.color='var(--error-color)'; this.style.filter='drop-shadow(0 0 8px var(--error-color))'; this.style.transform='scale(1.2)';" 
                                    onmouseout="${onOut}">
                                <i class="fas fa-trash" style="font-size: 10px; color: ${toolIconColor};"></i>
                            </button>
                        ` : `
                            <button id="${sparkElementId}" onclick="cloneSpark(this, '${visitorUid}', '${ownerId}', '${currentId}', '${spark.id}')" title="Save to My Arcade" style="${btnStyle}" onmouseover="${onHover}" onmouseout="${onOut}">
                                <i class="fas fa-save" style="font-size: 10px; color: ${toolIconColor};"></i>
                            </button>
                            <button onclick="shareSpark(this, '${ownerId}', '${currentId}', '${spark.id}')" title="Share" style="${btnStyle}" onmouseover="${onHover}" onmouseout="${onOut}">
                                <i class="fas fa-share-alt" style="font-size: 10px; color: ${shareIconColor}; filter: ${shareIconGlow};"></i>
                            </button>
                            <button onclick="tipOwner(this, '${ownerId}', '${currentId}', '${spark.id}')" title="Tip Jar" style="${btnStyle}" onmouseover="${onHover}" onmouseout="${onOut}">
                                <i class="fas fa-coins" style="font-size: 10px; color: ${toolIconColor};"></i>
                            </button>
                        `}
                    </div>
                </div>
            </div>
        </div>
    `;
}

/*
 * Generates a concise Spark name: <CurrentName>-Spark#<DDMM-HHMM>
 * @param {string} currentName - The name of the parent Current
 * @returns {string}
 */
const generateSparkName = (currentName) => {
    const now = new Date();
    const datePart = now.getDate().toString().padStart(2, '0') + (now.getMonth() + 1).toString().padStart(2, '0');
    const timePart = now.getHours().toString().padStart(2, '0') + now.getMinutes().toString().padStart(2, '0');
    
    return `${currentName}-Spark#${datePart}-${timePart}`;
};

function resolveCategoryFromPrompt(prompt, currentName) {
    const cleanPrompt = prompt.toLowerCase().trim();
    // Split into words/tokens and remove punctuation
    const tokens = cleanPrompt.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"").split(/\s+/);
    
    console.log(`[DEBUG_REGEX]: Evaluating prompt: "${cleanPrompt}"`);
    console.log(`[DEBUG_REGEX]: Extracted tokens:`, tokens);
    
    const presets = databaseCache.settings?.['arcade-current-types'] || [];
    
    // ========================================================
    // 1. ACTIVE BOARD NAME CHECK (First Priority)
    // ========================================================
    // Check if any whole word in the prompt matches the active current's name
    if (currentName) {
        const cleanCurrentName = currentName.toLowerCase().trim();
        const currentNameRegex = new RegExp(`\\b${cleanCurrentName}\\b`, 'i');
        
        // Test if the prompt contains the current board's name as a whole word
        const boardMatches = currentNameRegex.test(cleanPrompt);
        
        if (boardMatches) {
            // Find that actual preset in the DB so we can return its correct image and logic
            const matchingPreset = presets.find(p => (p.name || '').toLowerCase().trim() === cleanCurrentName);
            
            if (matchingPreset) {
                console.log(`[DEBUG_REGEX]: Match found! Prompt matches active board: [${matchingPreset.name}]`);
                return {
                    id: matchingPreset.id,
                    name: matchingPreset.name,
                    logic: matchingPreset.logic,
                    image: matchingPreset.image,
                    rules: matchingPreset.rules || ""
                };
            }
        }
    }

    // ========================================================
    // 2. DB ID, NAME, & REGEX SCAN (Second Priority)
    // ========================================================
    const matchedCategory = presets.find(category => {
        const catId = (category.id || '').toLowerCase().trim();
        const catName = (category.name || '').toLowerCase().trim();
        
        // A. Check ID match (Whole Word)
        let idMatches = false;
        if (catId) {
            const idRegex = new RegExp(`\\b${catId}\\b`, 'i');
            idMatches = idRegex.test(cleanPrompt);
        }

        // B. Check Name match (Whole Word)
        let nameMatches = false;
        if (catName) {
            const nameRegex = new RegExp(`\\b${catName}\\b`, 'i');
            nameMatches = nameRegex.test(cleanPrompt);
        }
        
        // C. Check Regex match (Whole Word)
        let regexMatches = false;
        if (category.regex) {
            try {
                const boundedRegex = `\\b(${category.regex})\\b`;
                const regexPattern = new RegExp(boundedRegex, 'i');
                const promptHitsRegex = regexPattern.test(cleanPrompt);
                const tokenHitsRegex = tokens.some(token => regexPattern.test(token));
                
                regexMatches = promptHitsRegex || tokenHitsRegex;
            } catch (regexErr) {
                console.warn(`[DEBUG_REGEX]: Invalid regex defined for category ${category.id}:`, regexErr);
            }
        }
        
        // If it specifically matches the ID, Name, or defined Regex:
        if (idMatches || nameMatches || regexMatches) {
            let matchType = [];
            if (idMatches) matchType.push("ID");
            if (nameMatches) matchType.push("Name");
            if (regexMatches) matchType.push("Regex");
            
            console.log(`[DEBUG_REGEX]: DB Match found! Category [${category.name}] triggered via [${matchType.join(' + ')}]`);
            return true;
        }
        return false;
    });

    if (matchedCategory) {
        return {
            id: matchedCategory.id,
            name: matchedCategory.name,
            logic: matchedCategory.logic,
            image: matchedCategory.image,
            rules: matchedCategory.rules || ""
        };
    }

    // ==========================================
    // 3. ULTIMATE FALLBACK
    // ==========================================
    console.log(`[DEBUG_REGEX]: No matches found in DB. Falling back to [Custom].`);
    
    // Fallback still respects whole words
    const isCreate = /\b(generate|build|create)\b/i.test(cleanPrompt);
    
    return {
        id: 'custom',
        name: 'Custom',
        logic: isCreate ? 'create' : 'hybrid',
        image: '/assets/thumbnails/default.jpg',
        rules: "Maintain extreme flexibility. Do not enforce specialized rulesets."
    };
}
window.handleCreation = async (currentId, currentName) => {
    const promptInput = document.getElementById(`input-${currentId}`);
    const input = promptInput ? promptInput.value.trim() : '';
    if (!input) return;

    const status = document.getElementById('engine-status-text');
    status.textContent = "PROCESSING INFRASTRUCTURE...";

    try {
        // 1. SILENTLY EXTRACT TOKENS & RESOLVE CATEGORY LOCALLY
        const resolvedCategory = resolveCategoryFromPrompt(input);
        
        // 2. LOGIC ROUTING
        const isUrl = /^(http|https):\/\/[^ "]+$/.test(input);
        let mode = (resolvedCategory.logic === 'source' || isUrl) ? 'sourcing' : 'prompt';

        console.log(`[FORGE]: Originating Board: "${currentName}". Classified Spark Category: "${resolvedCategory.name}"`);

        // 3. TRIGGER MASS SPARK
        // We pass the root 'currentId' so it saves under the current board's infrastructure,
        // but we feed it the *resolved* category's name and image!
        await executeMassSpark(
            currentId, 
            currentName,
            input, 
            mode, 
            resolvedCategory.name, // The new category!
            resolvedCategory.image  // The new thumbnail!
        );
        
        if (promptInput) promptInput.value = '';

    } catch (e) {
        console.error("Creation Error:", e);
        await executeMassSpark(currentId, currentName, input, 'prompt', 'Custom', '/assets/thumbnails/default.jpg');
    }
};
/*
 * Extracts valid URLs from a string based on common separators
 * @param {string} text 
 * @returns {string[]}
 */
const extractUrls = (text) => {
    // Splits by comma, semicolon, space, or newline
    const potentialUrls = text.split(/[\s,;\n]+/);
    const urlPattern = /^(http|https):\/\/[^ "]+$/;
    return potentialUrls.filter(item => urlPattern.test(item.trim()));
};
    

/*
 * Objective: High-Availability Credential Retrieval
 * Logic: Extracts the key from cache (or direct fetch) and resolves the model.
 */
async function retrieveGeminiCredentials() {
    try {
        let manifest = databaseCache?.app_manifest;

        // 1. Last-resort direct fetch if cache is missing
        if (!manifest || !manifest.gkey) {
            const snap = await get(ref(db, 'app_manifest')).catch(() => null);
            if (snap && snap.exists()) {
                manifest = snap.val();
                if (databaseCache) databaseCache.app_manifest = manifest;
            }
        }

        // 2. Critical Check
        if (!manifest || !manifest.gkey) {
            throw new Error("Forge manifest or GKey missing in DB.");
        }

        const apiKey = manifest.gkey;
        const modelName = await getGeminiModel(apiKey);

        // 3. RETURN: Ensure these keys match your callGeminiAPI destructuring
        return { apiKey, modelName };
    } catch (e) {
        console.error("[FORGE ERROR]: Failed to assemble credentials:", e);
        return null; // This triggers the "AI Infrastructure Offline" error in the caller
    }
}

async function getGeminiModel(apiKey) {
    // 1. HYDRATE FROM MANIFEST
    if (databaseCache.app_manifest?.model_pool) {
        console.log("[FORGE]: Hydrating model pool from manifest.");
        
        const pool = databaseCache.app_manifest.model_pool;
        // Map the flat DB names into our 2D tracking array
        modelStats = pool.map(name => {
            const existing = (modelStats || []).find(m => m[0] === name);
            return existing ? existing : [name, 0];
        });

        return databaseCache.app_manifest.default_model;
    }

    try {
        console.log("[FORGE]: Discovering Flash models via Google API...");
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const data = await response.json();

        if (!data.models) throw new Error("No models property in API response.");

        // 2. FILTER & SORT
        const flashModels = data.models.filter(m => 
            m.name.includes('flash') && 
            m.supportedGenerationMethods.includes('generateContent') &&
            !m.name.endsWith('-latest')
        );

        // Sort so the newest versions are at the top initially
        flashModels.sort((a, b) => b.name.localeCompare(a.name));

        if (flashModels.length === 0) throw new Error("No suitable Flash models found.");

        // 3. INITIALIZE 2D ARRAY [[name, failures]]
        const flatNames = flashModels.map(m => m.name.split('/')[1]);
        modelStats = flatNames.map(name => [name, 0]);
        
        const resolvedModel = modelStats[0][0];
        console.log(`[FORGE]: Primary: ${resolvedModel}. Pool:`, modelStats);

        // 4. PERSIST TO FIREBASE
        await update(ref(db, 'app_manifest'), {
            default_model: resolvedModel,
            model_pool: flatNames, 
            last_model_sync: new Date().toISOString()
        });
        
        if (!databaseCache.app_manifest) databaseCache.app_manifest = {};
        databaseCache.app_manifest.default_model = resolvedModel;
        databaseCache.app_manifest.model_pool = flatNames;

        return resolvedModel;
    } catch (e) {
        console.warn("[FORGE]: Discovery failed. Falling back to defaults.", e);
        // Fallback pool if the API call fails
        modelStats = [['gemini-1.5-flash', 0], ['gemini-1.5-flash-8b', 0]];
        return modelStats[0][0]; 
    }
}

/*
 * Gemini API Wrapper: Weighted Rotation, Tie-Breaking, and Cooldown
 */
async function callGeminiAPI(prompt, val, type) {
    const isCode = type === 'code';
    const statusText = document.getElementById('engine-status-text');
    
    if (window.isInCooldown) {
        throw new Error("System is currently cooling down.");
    }

    // --- FIX: Fetch credentials and populate modelStats BEFORE evaluating the loop ---
    const credentials = await retrieveGeminiCredentials();
    if (!credentials) {
        throw new Error("Failed to retrieve Gemini credentials.");
    }
    // ---------------------------------------------------------------------------------

    // Defensive check to make sure modelStats was successfully filled by getGeminiModel
    if (!Array.isArray(modelStats) || modelStats.length === 0) {
        console.error("CRITICAL: modelStats is empty. No models available to route to!");
        throw new Error("No models available in pool. Cooldown ignored to prevent lock.");
    }

    // 1. ADVANCED SORTING: Sort by failures (primary) and original index (secondary)
    // This ensures if failures are equal, we always try the "best" model first.
    modelStats.sort((a, b) => a[1] - b[1]);
    
    // Maps the sorted array to just display the string names of the models
    const modelNames = modelStats.map(entry => entry[0]);
    console.log("Retrieved Gemini Models in queue order:", modelNames);
    
    let attempts = 0;
    const maxRetries = modelStats.length;

    while (attempts < maxRetries) {
        const currentEntry = modelStats[attempts];
        const modelName = currentEntry[0];

        try {
            // Reusing the apiKey retrieved at the top of the function
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${credentials.apiKey}`;

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    contents: [{ parts: [{ text: prompt }] }] 
                })
            });

            // 2. ROTATION ON ANY ERROR (429, 404, 500, etc.)
            if (!response.ok) {
                const errorBody = await response.text();
                console.warn(`[FAIL]: ${modelName} failed with HTTP status ${response.status}. Reason:`, errorBody);
                
                currentEntry[1]++; // Record the failure
                attempts++;
                
                // If we've exhausted the whole pool, exit the loop to trigger cooldown
                if (attempts >= maxRetries) break;

                await new Promise(r => setTimeout(r, 200));
                continue;
            }

            // 3. SUCCESS PATH
            console.log(`[SUCCESS]: ${modelName} responded successfully.`);
            
            const data = await response.json();
            
            // Successful model gets a "reputation boost" (capped at 0)
            if (currentEntry[1] > 0) currentEntry[1]--;

            const result = data.candidates[0].content.parts[0].text;
            
            if (isCode) {
                return result.replace(/```html|```javascript|```/g, '').trim();
            } else {
                // Defensive JSON check: If it's not valid JSON, just return the raw string!
                try {
                    return JSON.parse(result.replace(/```json|```/g, '').trim());
                } catch (jsonErr) {
                    console.warn(`[FORGE]: Model returned a raw string instead of JSON. Returning raw text.`);
                    return result.trim();
                }
            }

        } catch (error) {
            // CATCH BLOCK ADDED HERE
            // This prevents the "Missing catch or finally" error and handles network drops!
            console.warn(`[FAIL]: ${modelName} hit a network or execution error:`, error);
            
            currentEntry[1]++; // Record the failure
            attempts++;
            
            // If we've exhausted the whole pool, exit the loop to trigger cooldown
            if (attempts >= maxRetries) break;

            await new Promise(r => setTimeout(r, 200));
        }
    } // WHILE LOOP CLOSED PROPERLY HERE

    // 4. EXHAUSTION TRIGGER: If we reach here, every model in the pool failed.
    console.error("CRITICAL: All models in pool failed. Triggering 60s cooldown.");
    await initiateSystemCooldown(statusText);
    
    // After cooldown, we throw an error so the UI can update
    throw new Error("All models exhausted. Restarting cycle after cooldown.");
}

/*
 * System Cooldown & Reset Logic
 */
async function initiateSystemCooldown(statusElement) {
    window.isInCooldown = true;
    let timeLeft = 60;

    return new Promise((resolve) => {
        const timer = setInterval(() => {
            if (statusElement) {
                statusElement.textContent = `WAITING TO CONNECT TO MODEL... ${timeLeft}s`;
            }
            timeLeft--;

            if (timeLeft < 0) {
                clearInterval(timer);
                window.isInCooldown = false;
                
                // RECOVERY: Reset all failure counts to 0
                // This allows the next call to start fresh with the "best" model
                modelStats.forEach(m => m[1] = 0);
                
                if (statusElement) statusElement.textContent = "SYSTEM READY";
                resolve();
            }
        }, 1000);
    });
}
async function saveSpark(currentId, data, prompt, detectedTemplate = 'Custom', templateUrl = '/assets/thumbnails/custom.jpg') {
    const sparkId = `spark_${Date.now()}_${Math.floor(Math.random()*1000)}`;
    
    // UPDATED PATH: users/[UID]/infrastructure/currents/...
    const dbPath = `users/${user.uid}/infrastructure/currents/${currentId}/sparks/${sparkId}`;
    
    const userNode = databaseCache.users?.[user.uid];
    const currentCurrent = userNode?.infrastructure?.currents?.[currentId];
    const rank = currentCurrent?.sparks ? Object.keys(currentCurrent.sparks).length + 1 : 1;

    await saveToRealtimeDB(dbPath, {
        id: sparkId,
        name: data.name || "Unnamed Spark",
        prompt: prompt,
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
    
    // Replaced: refreshUI is the newer version of initArcade.
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

// --- SMART LOGIC ASSIGNER ---
function predictLogicType(prompt) {
    const p = prompt.toLowerCase();
    const types = databaseCache.settings?.['arcade-current-types'] || [];
    
    // Look for the matched type object from your DB list
    const matchedType = types.find(t => p.includes(t.id) || p.includes(t.name.toLowerCase()));
    
    // Scenario 1: No DB type matched at all
    if (!matchedType) {
        let fallbackLogic = 'hybrid';
        if (p.includes('generate') || p.includes('create') || p.includes('build') || p.includes('design')) fallbackLogic = 'create';
        if (p.includes('top') || p.includes('get') || p.includes('find') || p.includes('list') || p.includes('show me')) fallbackLogic = 'source';
        
        // If it's still hybrid after keywords, we safely default it to 'create' 
        // to prevent callGeminiAPI from getting stuck
        if (fallbackLogic === 'hybrid') fallbackLogic = 'create';
        
        return { id: 'custom', name: 'Custom', logic: fallbackLogic };
    }
    
    // Scenario 2: DB type matched, and it has a strict rule ('create' or 'source')
    if (matchedType.logic !== 'hybrid') {
        return matchedType; // Returns the exact object straight from the DB
    }
    
    // Scenario 3: DB type matched, but the logic is 'hybrid'
    // We must parse the prompt to determine the true intent!
    let resolvedLogic = 'create'; // Default fallback for safety
    
    if (p.includes('top') || p.includes('get') || p.includes('find') || p.includes('retrieve') || p.includes('list') || p.includes('show me')) {
        resolvedLogic = 'source';
    } else if (p.includes('generate') || p.includes('create') || p.includes('build') || p.includes('design')) {
        resolvedLogic = 'create';
    }
    
    console.log(`[FORGE]: Hybrid type [${matchedType.name}] resolved to logic [${resolvedLogic}] based on prompt.`);
    
    // Return the matched object, but with the 'logic' property strictly forced to an actionable target!
    return {
        ...matchedType,
        logic: resolvedLogic
    };
}
/*
 * HUD Controls: Closes the Arcade Settings overlay
 */
window.closeArcadeSettings = () => {
    const hud = document.getElementById('arcadesettings-hud');
    
    if (hud) {
        // Option A: Instantly hide it
        //hud.style.display = 'none';
        
        // Option B: If you are using a fade-out animation in showroom_style.css or arcade.css
        hud.classList.remove('active'); 
        
        console.log("[UI]: Arcade Settings HUD closed.");
    } else {
        console.warn("[UI]: Could not find 'arcadesettings-hud' to close.");
    }
};

/* * Objective: Initialize or Re-Forge Arcade Identity
 * Task: Dynamically generate HUD structure and populate with Firebase data.
 */
window.openArcadeSettings = () => {
    const hud = document.getElementById('arcadesettings-hud');
    if (!hud) return;

    // 1. IDENTITY & STATE CHECK
    const profile = (window.pageOwnerData && window.pageOwnerData.profile) ? window.pageOwnerData.profile : {};
    const isSetup = profile.hasOwnProperty('setup_complete') && profile.setup_complete === true;
    
    // 1. Check at the moment the script loads
    console.log("Global Scope Check - Profile:", typeof profile !== 'undefined' ? profile : "NOT DEFINED YET");

    // Target the dynamic zones defined in index.html
    const profileZone = document.getElementById('arcade-profile-zone');
    const planZone = document.getElementById('plan-selection-zone');

    // 2. GENERATE DYNAMIC PROFILE STRUCTURE
    if (profileZone) {
        profileZone.innerHTML = `
            <label class="hud-label-metallic">* ARCADE NAME</label>
            <input type="text" id="new-arcade-name" placeholder="e.g., Quantum Lab" class="hud-input">
            
            <label class="hud-label-metallic">SYSTEM SUBTITLE</label>
            <input type="text" id="new-arcade-subtitle" placeholder="Establish Your Arcade to Start Creating" class="hud-input">

            <label class="hud-label-metallic">INTERFACE THEME</label>
            <select id="arcade-theme-select" class="hud-input"></select>

            <label class="hud-label-metallic">PRIVACY_PROTOCOL</label>
            <select id="arcade-privacy-select" class="hud-input">
                <option value="public">PUBLIC</option>
                <option value="unlisted">UNLISTED</option>
                <option value="private">PRIVATE</option>
            </select>
        `;
    }

    // Capture newly created inputs
    const nameInput = document.getElementById('new-arcade-name');
    const subtitleInput = document.getElementById('new-arcade-subtitle');
    const themeSelect = document.getElementById('arcade-theme-select');
    const privacySelect = document.getElementById('arcade-privacy-select');
    const submitBtn = document.getElementById('submit-onboarding');

    // Sync values from Profile
    if (nameInput) nameInput.value = isSetup ? (profile.arcade_title || '') : '';
    if (subtitleInput) subtitleInput.value = isSetup ? (profile.arcade_subtitle || '') : '';
    if (privacySelect) privacySelect.value = isSetup ? (profile.privacy || 'public') : 'public';

    // Populate Themes
    const themes = databaseCache.settings?.['ui-settings']?.themes;
    if (themes && themeSelect) {
        themeSelect.innerHTML = ''; 
        Object.keys(themes).forEach(id => {
            const opt = document.createElement('option');
            opt.value = id;
            opt.textContent = themes[id].name.replace(/_/g, ' ').toUpperCase();
            themeSelect.appendChild(opt);
        });
        themeSelect.value = isSetup ? (profile.theme || 'neon-dark') : 'neon-dark';
        themeSelect.onchange = (e) => applyTheme(e.target.value);
        applyTheme(themeSelect.value);
    }

    // 3. METALLIC HEADER REFINEMENT
    const hudHeader = hud.querySelector('.hud-header');
    if (hudHeader) {
        hudHeader.innerHTML = `
            <div class="hud-header-content">
                <h2 class="hud-title-metallic">${isSetup ? 'RE-FORGE LABORATORY' : 'INITIALIZE YOUR ARCADE'}</h2>
                <p class="hud-subtitle-info">${isSetup ? 'Syncing Profile Data...' : 'Establish Your Arcade to Start Creating'}</p>
            </div>
            <button onclick="closeArcadeSettings()" class="close-hud-corner">&times;</button>
        `;
    }

    // 4. DYNAMIC 3-COLUMN PLAN GRID GENERATION
    const allPlans = databaseCache.settings?.plan_limits;
    if (allPlans && planZone) {
        planZone.innerHTML = `
            <label class="hud-label-metallic">SYSTEM_PLAN_SELECTION</label>
            <div class="plans-grid plan-selection-container"></div>
        `;

        const planContainer = planZone.querySelector('.plan-selection-container');
        
        Object.keys(allPlans).forEach(planId => {
            const plan = allPlans[planId];
            const userCurrentPlan = profile.plan_type || 'free';
            const isActive = (planId === userCurrentPlan);
            
            console.log(`[Plan Forge] ID: ${planId} | Identity: ${plan.identity} | Cost: ${plan.cost}`);
            
            const canSelect = (plan.enabled === true) || isActive;

            const planBox = document.createElement('div');
            planBox.className = `plan-card-rounded ${isActive ? 'active' : ''} ${!canSelect ? 'tier-locked' : ''}`;
            
            planBox.innerHTML = `
                <div class="plan-box-inner">
                    <div class="tier-identity-metallic">${(planId).toUpperCase()}-TIER</div>
                     <div class="tier-pitch">${plan.identity.toUpperCase()}</div>
                    <div class="tier-pitch">${plan.pitch}</div>
                    
                    <div class="tier-pricing">
                        <div class="price-main">
                            $${plan.cost}<small>/mo</small> 
                                <span class="price-annual" style="margin-left: 15px;">$${plan.cost * 10}<small>/yr</small></span>
                        </div>                    
                    </div>

                    <ul class="tier-specs-list">
                        <li><i class="fa-solid fa-folder"></i> <b>${plan.max_currents}</b> Topics</li>
                        <li><i class="fa-solid fa-microchip"></i> <b>${plan.max_sparks_per_current}</b> Action Cards</li>
                        <li><i class="fa-solid fa-wand-magic-sparkles"></i> <b>${plan.num_mass_sparks}</b> Cards/Prompt</li>
                        <hr class="metallic-divider">
                        <li><i class="fa-solid ${plan.analytics_enabled ? 'fa-square-check text-glow-green' : 'fa-square-xmark text-dim'}"></i> Analytics</li>
                        <li><i class="fa-solid ${plan.priority_support ? 'fa-square-check text-glow-green' : 'fa-square-xmark text-dim'}"></i> Priority Support</li>
                        <li><i class="fa-solid ${plan.monetization === 'sales' ? 'fa-square-check text-glow-green' : 'fa-square-xmark text-dim'}"></i> Direct Sales</li>
                    </ul>
                </div>
                
                <div class="plan-radio-dock">
                    <input type="radio" name="arcade-plan" id="radio-${planId}" value="${planId}" 
                        ${isActive ? 'checked' : ''} 
                        ${!canSelect ? 'disabled' : ''}>
                    <label for="radio-${planId}">${isActive ? ' CURRENT PLAN' : (canSelect ? ' SELECT PLAN' : ' DISABLED')}</label>
                </div>
            `;

            if (canSelect) {
                planBox.onclick = () => {
                    hud.querySelectorAll('.plan-card-rounded').forEach(el => el.classList.remove('active'));
                    planBox.classList.add('active');
                    planBox.querySelector('input').checked = true;
                };
            }

            planContainer.appendChild(planBox);
        });
    }

    // 5. BUTTON & HUD ACTIVATION
    if (submitBtn) {
        submitBtn.innerText = isSetup ? "UPDATE IDENTITY" : "ESTABLISH IDENTITY";
        submitBtn.style.display = "block";
        submitBtn.style.margin = "30px auto 10px auto";
    }
    
    hud.classList.add('active');
};

/*
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


/*
 * Updates the UI status when a user selects a logo file.
 */
window.updateLogoStatus = (input) => {
    const statusText = document.getElementById('logo-status-text');
    if (input.files && input.files[0]) {
        statusText.textContent = input.files[0].name;
        statusText.style.color = 'var(--glow-color)';
    } else {
        statusText.textContent = "No file selected";
        statusText.style.color = 'var(--text-secondary)';
    }
};

window.saveArcadeSettings = async () => {
    const nameInput = document.getElementById('new-arcade-name');
    const subtitleInput = document.getElementById('new-arcade-subtitle');
    const themeSelect = document.getElementById('arcade-theme-select');
    const privacySelect = document.getElementById('arcade-privacy-select');
    const planValue = document.querySelector('input[name="arcade-plan"]:checked')?.value || 'free';
  

    const arcadeName = nameInput.value.trim().toUpperCase();
    if (!arcadeName) {
        nameInput.style.border = "1px solid var(--error-glow, --error-color)";
        return;
    }

    const activeUser = window.auth?.currentUser;
    if (!activeUser) return;

    try {
        const profilePath = `users/${activeUser.uid}/profile`;
        
        // --- SAFE INITIALIZATION ---
        // Ensure the object exists so we don't crash on read
        if (!window.pageOwnerData) window.pageOwnerData = {};
        if (!window.pageOwnerData.profile) window.pageOwnerData.profile = {};
        
        const profile = window.pageOwnerData.profile;

        // 3. CONSTRUCT UPDATE PAYLOAD
        const updates = {};
        updates[`${profilePath}/arcade_title`] = arcadeName;
        updates[`${profilePath}/arcade_subtitle`] = subtitleInput.value.trim();
        updates[`${profilePath}/theme`] = themeSelect.value;
        updates[`${profilePath}/privacy`] = privacySelect.value;
        updates[`${profilePath}/plan_type`] = planValue;

        // 4. CONDITIONAL SETUP_COMPLETE
        if (profile.setup_complete === undefined || profile.setup_complete === null) {
            updates[`${profilePath}/setup_complete`] = true;
        }

        // 5. EXECUTE UPDATE
        await window.update(window.ref(window.db), updates);

        // 6. SYNC LOCAL STATE (SAFE MAPPING)
        Object.keys(updates).forEach(path => {
            const key = path.split('/').pop();
            // Assigning to the now-guaranteed profile object
            window.pageOwnerData.profile[key] = updates[path];
        });

        // 7. UI FINALIZATION
        
        applyTheme(themeSelect.value);
        document.getElementById('arcadesettings-hud').classList.remove('active');

        // --- START WINDOW RELOAD SECTION ---
            await refreshUI();
            console.log("[SYSTEM] SYNC COMPLETE. Identity Forged for:", activeUser.uid);
            console.log("[SYSTEM] CURRENT URL:", window.location.href);
        // --- END WINDOW RELOAD SECTION ---

    } catch (error) {
        console.error("FORGE_FAILURE:", error);
    }
};

/*
 * Helper to pull the primary branding color from the cached theme data
 */
function getThemeBrandingColor(themeId) {
    const themes = databaseCache.settings?.['ui-settings']?.themes;
    return themes?.[themeId]?.['branding-color'] || "#00f2ff";
}

// ----------------------------------
window.handleCreation = handleCreation;
// Force the function to be global so the HTML button can see it
window.closeArcadeSettings = closeArcadeSettings;
// At the bottom of arcade.js
window.likeSpark = likeSpark;
console.log("likeSpark function has been successfully bridged to the window scope.");

// Ensure this matches the function name in showroom.js and auth.js
window.handleLogout = window.handleLogout || logout;
