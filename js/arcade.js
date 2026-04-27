import { firebaseConfig, auth, saveToRealtimeDB, getArcadeData, db, get, set, ref, update, push, runTransaction } from '/config/firebase-config.js';
import { watchAuthState, handleArcadeRouting, logout } from '/config/auth.js';

// --- ADD THE GLOBAL BRIDGE HERE ---
window.auth = auth;
window.db = db;
window.ref = ref;
window.update = update;
window.get = get;

// Build Check: Manually update the time string below when pushing new code
console.log(`%c YERTAL ARCADE LOADED | ${new Date().toLocaleDateString()} @19:29:00 `, "background: var(--bg-color); color: var(--branding-color); font-weight: bold; border: 1px solid var(--branding-color); padding: 4px;");

/* export variables that spark.js will use */
export let databaseCache = {};
export let globalTheme = "neon-dark";

/* local variables of entire file scope */
let user
let selectedCategory = null;
let cachedGKey = null;

/*
 * Global Model Stats: [ ["model-name", failureCount], ... ]
 * Replaces the old flat 'availableModels' array.
 */
let modelStats = []; 
window.isInCooldown = false;

let currentModelIndex = 0;

window.confirmDeleteCurrent = async (userId, currentId) => {
    const confirmation = confirm(`Are you sure you want to delete the whole current [${currentId}]?\n\nAll associated sparks will be permanently deleted. This action cannot be undone.`);
    
    if (confirmation) {
        try {
            // 1. Database Removal
            const dbPath = `users/${userId}/infrastructure/currents/${currentId}`;
            await saveToRealtimeDB(dbPath, null);

            // 2. Cache Cleanup
            if (databaseCache.users?.[userId]?.infrastructure?.currents?.[currentId]) {
                delete databaseCache.users[userId].infrastructure.currents[currentId];
            }

            // 3. UI Refresh
            await refreshUI();
            
            console.log(`System: Infrastructure for ${currentId} decommissioned.`);
        } catch (error) {
            console.error("Critical: Deletion protocol failed.", error);
            alert("System error: Could not decommission infrastructure.");
        }
    }
};
/*
 * Objective: Close the Add Current HUD and reset visibility.
 */
window.closeAddCurrentHud = () => {
    const hud = document.getElementById('add-current-hud');
    if (hud) {
        hud.style.display = 'none';
    }
};

/*
 * Objective: Laboratory Manual / Guided Viewlets
 * Logic: Uses element-masking to highlight specific UI nodes.
 */
let currentTutorialStep = 0;
const steps = [
    {
        target: null,
        title: "ARCADE_INIT",
        content: "Welcome to your Arcade. This is a versatile showroom for your projects, a social hub for friends, or a business storefront where you can collect tips and funding."
    },
    {
        target: ".settings-trigger", // Assuming three dots
        title: "OS_PREFERENCES",
        content: "Access System Settings to change themes (like Autumn Ember) or upgrade plans. Business Plans allow you to rebrand 'Tips' to 'Funds' or 'Purchase' to match your shop."
    },
    {
        target: ".terminal-btn", 
        title: "INFRASTRUCTURE",
        content: "Initialize a 'Current' to organize your work. You can Add, Rename (Update), or Decommission (Delete) Currents to manage your lab's data streams."
    },
    {
        target: ".generate-btn",
        title: "FORGE_GENERATION",
        content: "This is the Forge. Paste a URL to scrape content or type a prompt—try: 'Top 3 movies for the current year'—to generate a Spark instantly."
    },
    {
        target: ".spark-stats-row", // Target the icons/stats row on a card
        title: "ENGAGEMENT_PROTOCOLS",
        content: "Interact with Sparks via Save, Share, or Tip. In Business mode, these interactions become your revenue stream for tips or product funding."
    },
    {
        target: null,
        title: "SYSTEM_READY",
        content: "Your Laboratory is online. Start forging Currents and share your unique URL to begin growing your audience and funding."
    }
];

window.handleMenuTrigger = (type) => {
    const drawer = document.getElementById('main-drawer');
    if (drawer) drawer.classList.remove('active');

    // 1. Check if the cache exists
    if (!databaseCache) {
        console.error("Navigator Error: databaseCache is not initialized yet.");
        return;
    }

    setTimeout(() => {
        switch (type) {
            case 'chat':
                // 2. Safely extract chat_config
                const chatData = databaseCache?.chat_config;

                if (!chatData || !chatData.nodes) {
                    console.error("Navigator Error: chat_config is missing from databaseCache.");
                    // Optional: Show a small toast to the user "System loading..."
                    return;
                }

                if (!window.navigatorAgent) {
                    window.navigatorAgent = new ArcadeNavigator(chatData);
                }
                window.navigatorAgent.initChatAgent();
                break;

            case 'tutorial':
                if (typeof window.showTutorial === 'function') window.showTutorial();
                break;
        }
    }, 500);
};

window.showTutorial = function() {
    currentTutorialStep = 0; 
    
    const mask = document.querySelector('.tutorial-mask');
    if (mask) {
        mask.classList.add('active');
        // Reset coordinates to clear any previous spotlight
        mask.style.setProperty('--r', '0px');
    }
    
    if (!mask) {
        console.error("Tutorial Mask not found in DOM.");
        return;
    }

    setTimeout(() => {
        renderTutorialStep();
    }, 300); 
};
// --- arcade.js ---

function renderTutorialStep() {
    const step = steps[currentTutorialStep];
    const mask = document.querySelector('.tutorial-mask');
    const existingTooltip = document.querySelector('.tutorial-tooltip');
    if (existingTooltip) existingTooltip.remove();

    if (!step) {
        window.endTutorial();
        return;
    }

    // Handle Spotlight (Mask)
    const targetEl = step.target ? document.querySelector(step.target) : null;
    if (targetEl) {
        const rect = targetEl.getBoundingClientRect();
        // getBoundingClientRect is relative to viewport, which matches fixed mask
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        const r = Math.max(rect.width, rect.height) / 1.5 + 15;

        mask.style.setProperty('--x', `${x}px`);
        mask.style.setProperty('--y', `${y}px`);
        mask.style.setProperty('--r', `${r}px`);
    } else {
        mask.style.setProperty('--r', `0px`);
    }

    // FIXED TOP-CENTERED POSITIONING
    const totalSteps = steps.length;
    const startPercent = 15;
    const endPercent = 85;
    const horizontalPercent = startPercent + (currentTutorialStep * ((endPercent - startPercent) / (totalSteps - 1)));

    // For Mobile: Always center horizontally (50%)
    // For Desktop: Progress horizontally
    const finalLeft = window.innerWidth < 600 ? 50 : horizontalPercent;
    
    // Y-Position: Fixed at 25% from top to avoid scrolling issues
    const finalTop = 10; createTooltip(finalLeft, finalTop, step);
}

function createTooltip(percentX, percentY, step) {
    const tooltip = document.createElement('div');
    tooltip.className = 'tutorial-tooltip active';
    
    // Apply viewport-relative percentage coordinates
    tooltip.style.left = `${percentX}%`;
    tooltip.style.top = `${percentY}%`;
    tooltip.style.transform = 'translate(-50%, 0)'; /* Anchor from top-center */

    tooltip.innerHTML = `
        <div class="tooltip-header">
            <span class="metallic-text">PHASE_${currentTutorialStep + 1} // ${steps.length}</span>
            <button onclick="window.endTutorial()" class="close-tutorial">&times;</button>
        </div>
        
        <h3>${step.title}</h3>
        <p>${step.content}</p>

        <div class="tooltip-nav" style="display: flex; gap: 12px;">
            <button onclick="window.prevStep()" class="tutorial-next-btn" style="clip-path: none; flex: 1;" ${currentTutorialStep === 0 ? 'disabled' : ''}>PREV</button>
            <button onclick="window.nextStep()" class="tutorial-next-btn" style="flex: 2;">
                ${currentTutorialStep === steps.length - 1 ? 'FINISH_INIT' : 'NEXT_PHASE'}
            </button>
        </div>
    `;
    document.body.appendChild(tooltip);
}

window.nextStep = function() {
    currentTutorialStep++;
    if (currentTutorialStep < steps.length) {
        renderTutorialStep();
    } else {
        endTutorial();
    }
};

window.prevStep = function() {
    if (currentTutorialStep > 0) {
        currentTutorialStep--;
        renderTutorialStep();
    }
};

window.endTutorial = function() {
    const mask = document.querySelector('.tutorial-mask');
    const tooltip = document.querySelector('.tutorial-tooltip');
    if (mask) mask.classList.remove('active');
    if (tooltip) tooltip.remove();
};
    
/* * Objective: Drawer Navigation & State Management
 * Task: Toggle visibility of static HTML sections and manage origin levels
 */
window.toggleDrawer = (menuType = 'main') => {
    const drawer = document.getElementById('main-drawer');
    if (!drawer) return;

    const isActive = drawer.classList.contains('active');

    // 1. If opening fresh, lock the origin and show the correct section
    if (!isActive) {
        drawer.dataset.originMode = menuType;
        if (menuType !== 'main') {
            window.showSubMenu(menuType);
        } else {
            window.showMainMenu();
        }
        drawer.classList.add('active');
    } 
    // 2. If already open and switching modes via top-bar icons
    else if (drawer.dataset.currentMode !== menuType) {
        drawer.dataset.originMode = menuType; // Update origin if explicitly switched via icon
        window.showSubMenu(menuType);
    }
    // 3. Close the drawer if clicking the same icon/close button
    else {
        drawer.classList.remove('active');
    }

    drawer.dataset.currentMode = menuType;
};

window.showSubMenu = (menuType) => {
    const drawer = document.getElementById('main-drawer');
    const origin = drawer.dataset.originMode || 'main';

    // Hide all navigation containers
    document.getElementById('drawer-main-nav').style.display = 'none';
    document.getElementById('drawer-settings').style.display = 'none';
    document.getElementById('drawer-help').style.display = 'none';

    // Show the specific target
    const targetSub = document.getElementById(`drawer-${menuType}`);
    if (targetSub) {
        targetSub.style.display = 'block';
        
        // Back Button Logic: Only show if we didn't START at this menu level
        const backBtn = targetSub.querySelector('.back-btn');
        if (backBtn) {
            backBtn.style.display = (origin === 'main') ? 'flex' : 'none';
        }
    }
};

window.showMainMenu = () => {
    document.getElementById('drawer-main-nav').style.display = 'block';
    document.getElementById('drawer-settings').style.display = 'none';
    document.getElementById('drawer-help').style.display = 'none';
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
export function applyTheme(themeId) {
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
                if (databaseCache?.users?.[ownerUid]?.infrastructure?.currents?.[currentId]?.sparks?.[sparkId]) {
                    databaseCache.users[ownerUid].infrastructure.currents[currentId].sparks[sparkId].stats.likes = updated;
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
                    if (databaseCache?.users?.[ownerId]?.infrastructure?.currents?.[currentId]?.sparks?.[sparkId]) {
                        databaseCache.users[ownerId].infrastructure.currents[currentId].sparks[sparkId].stats.forges = updated;
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

    const ownerPhotoUrl = profile.photoURL || avatarPath; 

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
                    <a href="/index.html" title="Showroom" style="color: var(--branding-text-color); opacity: 0.7; font-size: var(--nav-font-size);; transition: color 0.3s;" onmouseover="this.style.color='var(--branding-color)'" onmouseout="this.style.color='var(--branding-text-color)'"><i class="fas fa-door-open"></i></a>
                    <a href="?user=${userSlug}" title="My Arcade" style="color: var(--branding-text-color); opacity: 0.7; font-size: var(--nav-font-size);; transition: color 0.3s;" onmouseover="this.style.color='var(--branding-color)'" onmouseout="this.style.color='var(--branding-text-color)'"><i class="fas fa-home"></i></a>
                    <a href="?user=yertal-arcade" class="metallic-text" style="border: 1px solid var(--border-color); padding: 2px 8px; border-radius: 3px; text-decoration: none; background: var(--branding-color); color: var(--bg-color); box-shadow: 0 0 5px var(--box-shadow-color); font-size: var(--nav-font-size); font-weight: 900;">HUB</a>
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
                <div style="display: flex; align-items: center; gap: 0.8rem; margin-right: 0.5rem;">
                    <i class="fa-solid fa-square-plus" title="Add Current" onclick="window.openAddCurrentHud()" style="cursor: pointer; color: var(--branding-color); font-size: var(--nav-font-size); transition: opacity 0.2s;" onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'"></i>
                    <i class="fa-solid fa-circle-question" title="Help Hub" onclick="window.toggleDrawer('help')" style="cursor: pointer; color: var(--branding-color); font-size: var(--nav-font-size); transition: opacity 0.2s;" onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'"></i>
                </div>
                <div style="display: flex; align-items: center; gap: 0.4rem; position: relative;">
                    <input type="text" id="arcade-search-input" placeholder="GO TO SLUG..." class="glass" style="border: 2px solid var(--glow-aura); border-radius: 9999px; padding: 0.25rem 0.75rem; font-size: var(--nav-font-size); color: var(--branding-text-color); width: 9rem; outline: none; background: var(--bg-color);">
                    <i class="fa-solid fa-magnifying-glass" 
                       onclick="const slug = document.getElementById('arcade-search-input').value; if(slug) window.location.href='?user=' + slug;" 
                       onkeydown="const slug = document.getElementById('arcade-search-input').value; if(slug) window.location.href='?user=' + slug;" 
                       style="cursor: pointer; color: var(--branding-color); font-size: var(--nav-font-size); transition: transform 0.2s;" 
                       onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'"></i>
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
                    <div id="system-menu-trigger" onclick="window.toggleDrawer('main')" style="cursor: pointer; padding-left: 0.5rem; color: var(--branding-color); font-size: 1.1rem; transition: transform 0.3s;">
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

window.handleCreation = async (currentId, currentName, currentPrivacy) => {
    const promptInput = document.getElementById(`input-${currentId}`);
    const input = promptInput ? promptInput.value.trim() : '';
    if (!input) return;

    const categorySelectObject = document.getElementById(`select-${currentId}`);
    const status = document.getElementById('engine-status-text');
    status.textContent = "PROCESSING INFRASTRUCTURE...";
    // Access the text of the currently selected option
    const categorySelect = categorySelectObject.options[categorySelectObject.selectedIndex].text.trim();
    
    let resolvedCategory;

    console.log("handleCreation: Selected Category is: ", categorySelect);
    
    try {
        // Use categorySelect.value directly to determine resolution path
        if (!categorySelect || categorySelect === '-- CUSTOM PROMPT --' || categorySelect === '') {
            resolvedCategory = resolveCategoryFromPrompt(input);
        } else {
            // Access databaseCache and perform find inline
            resolvedCategory = databaseCache.settings?.['arcade-current-types']?.find(
            t => t.name?.trim().toLowerCase() === categorySelect.trim().toLowerCase());
            
            // If find fails, fallback to regex as a last resort
            if (!resolvedCategory) resolvedCategory = resolveCategoryFromPrompt(input, categorySelect);
        }
        console.log("handleCreation: After databaseCache Lookup, Resolved current type is:", resolvedCategory?.name);
        // Pass the resolved object directly to the engine
        await executeMassSpark(
            currentId, 
            currentName, 
            input, 
            (resolvedCategory.logic === 'source' || /^(http|https):\/\/[^ "]+$/.test(input)) ? 'source' : 'create', 
            resolvedCategory,
            currentPrivacy
        );
        
        promptInput.value = '';

    } catch (e) {
        console.error("Creation Error:", e);
        await executeMassSpark(currentId, currentName, input, 'create', { name: 'Custom', id: 'custom', logic: 'create', image: '/assets/thumbnails/default.jpg' }, currentPrivacy);
    }
};

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
                            <button onclick="window.openAddCurrentHud()" class="ethereal-btn-sm">
                                <i class="fas fa-plus"></i> INITIALIZE_FIRST_CURRENT
                            </button>
                            <button onclick="window.showTutorial()" class="ethereal-btn-sm" style="opacity: 0.7;">
                                <i class="fas fa-book-open"></i> VIEW_TUTORIAL
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
        const capacityPct = Math.min((sparkCount / maxSparks) * 100, 100);
        
        // Dynamic Color Logic based on remaining capacity
        let meterColor = 'var(--glow-color)';
        if (capacityPct >= 90) {
            meterColor = 'var(--error-color, #ef4444)';
        } else if (capacityPct >= 80) {
            meterColor = 'var(--warning-color, #ffcc00)';
        }

        const capacityMeterHTML = `
            <div class="capacity-meter-wrapper" title="Sparks: ${sparkCount} / ${maxSparks}" style="display: flex; align-items: center; gap: 8px;">
                <span style="font-family: 'Courier New', monospace; font-size: 0.7rem; color: var(--branding-text-color);">CAPACITY</span>
                <div class="fuel-rail" style="width: 50px; height: 10px; background: rgba(255,255,255,0.05); border: 1px solid ${meterColor}; border-radius: 2px; overflow: hidden;">
                    <div class="fuel-fill" style="width: ${capacityPct}%; height: 100%; background: ${meterColor}; transition: width 0.4s ease;"></div>
                </div>
                <span style="font-family: 'Courier New', monospace; font-size: 0.7rem; color: ${meterColor};">${sparkCount}/${maxSparks}</span>
            </div>
        `;

        const actionIcons = isOwner ? `
            <div class="current-actions" style="display: flex; gap: 12px; margin-left: 10px; align-items: center;">
                <i class="fas fa-sync-alt" onclick="window.updateCurrent('${current.id}')" title="Update" style="cursor: pointer; opacity: 0.6; color: var(--branding-text-color);"></i>
                <i class="fas fa-trash-alt" onclick="window.confirmDeleteCurrent('${ownerUid}', '${current.id}')" title="Delete" style="cursor: pointer; opacity: 0.6; color: var(--error-color, #ef4444);"></i>
            </div>
        ` : '';

        const controls = (isOwner && !isFull) ? `
            <div class="current-prompt-container" style="display: flex; align-items: center; gap: 10px; width: 100%;">
                <div class="current-type-selector-wrapper">
                    <span class="current-prompt-label" style="display: block; font-size: 10px; color: var(--fg-color-high);">CREATE OR SOURCE</span>
                    <select id="select-${current.id}" class="current-prompt-input" onchange="const inp = document.getElementById('input-${current.id}'); inp.value = this.value; inp.focus(); inp.scrollLeft = 0; inp.setSelectionRange(0, 0);">
                        <option value="">-- CUSTOM PROMPT --</option>
                        ${(databaseCache.settings?.['arcade-current-types'] || []).map(type => `
                            <option value="${type.example_prompt}">${type.name.toUpperCase()}</option>
                        `).join('')}
                    </select>
                </div>
                <input type="text" id="input-${current.id}" 
                       class="current-prompt-input"
                       placeholder=" Type your prompt or paste a URL..." 
                       onkeydown="if(event.key==='Enter') window.handleCreation('${current.id}', '${current.name}', '${current.privacy}')">
                <button onclick="window.handleCreation('${current.id}', '${current.name}', '${current.privacy}')" class="current-prompt-exec-button">EXEC</button>
                ${actionIcons}
            </div>
        ` : (isFull && isOwner) ? `
            <div class="capacity-alert-container" style="display: flex; align-items: center; gap: 15px; width: 100%;">
                <span style="color: var(--error-color, #ef4444); font-weight: bold; font-family: 'Orbitron', sans-serif; font-size: 0.8rem;">FULL</span>
                ${capacityMeterHTML}
                ${actionIcons}
            </div>
        ` : `
            <div class="viewer-node-status" style="display: flex; align-items: center; gap: 15px; opacity: 0.8;">
                ${capacityMeterHTML}
                <div class="secure-node-static">Secure_Node [${ownerUid.substring(0,8)}]</div>
            </div>
        `;

        return `
            <div class="current-block animate-fadeIn">
                <div class="current-header-row" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem;">
                    <h2 class="current-name" style="margin: 0; font-size: 14px; line-height: 1;">${current.name || 'Active Current'}</h2>
                    ${!isOwner ? '' : capacityMeterHTML}
                </div>
                
                ${controls}
                
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
                <button onclick="window.openAddCurrentHud()" class="terminal-btn" style="border: 1px dashed var(--glow-color); opacity: 0.6; color: var(--branding-text-color); background: var(--bg-color);">
                    <i class="fas fa-plus"></i> INITIALIZE NEW CURRENT
                </button>
            </div>
        `;
    }
}
/*
 * Objective: Initialize the update sequence for an existing Current.
 * [cite: 2026-04-14]
 */
window.updateCurrent = (currentId) => {
    console.log(`[ACTION]: Initiating update for Current: ${currentId}`);
    // We pass the ID so the HUD knows which record to fetch/reference
    window.openAddCurrentHud('update', currentId);
};
/* window.openAddCurrentHud */
window.openAddCurrentHud = async (action = 'add', targetId = null) => {
    const hud = document.getElementById('add-current-hud');
    if (!hud) return;

    const title = hud.querySelector('.current-title');
    const submitBtn = document.getElementById('submit-current-btn');
    const nameInput = document.getElementById('current-name-input');
    const typeSelect = document.getElementById('current-type-select');
    const typeInput = document.getElementById('current-type-input'); // The primary source
    const privacySelect = document.getElementById('current-privacy-select');

    // 1. Populate Picker Options
    if (typeSelect) {
        const types = databaseCache.settings?.['arcade-current-types'] || [];
        let optionsHTML = `<option value="">-- PICK A TYPE --</option>`;
        optionsHTML += types.map(t => 
            `<option value="${t.name}">${t.name.toUpperCase()}</option>`
        ).join('');
        typeSelect.innerHTML = optionsHTML;
    }

    if (action === 'update' && targetId) {
        if (title) title.innerText = "UPDATE_INFRASTRUCTURE";
        if (submitBtn) submitBtn.innerText = "CONFIRM_CHANGES";
        
        const ownerUid = window.auth?.currentUser?.uid;
        const currentData = databaseCache.users?.[ownerUid]?.infrastructure?.currents?.[targetId];

        /* --- Inside openAddCurrentHud (Update Block) --- */
        if (currentData) {
            if (nameInput) nameInput.value = currentData.name || '';
            if (typeInput) typeInput.value = currentData.type || '';
            if (typeSelect) typeSelect.value = ''; 
            if (privacySelect) privacySelect.value = currentData.privacy || 'private';
    
            // THE FIX: Save the previous state for submitNewCurrent to compare against
            hud.dataset.targetId = targetId;
            hud.dataset.mode = 'update';
            hud.dataset.prevName = (currentData.name || '').trim().toLowerCase();
            hud.dataset.prevType = (currentData.type || '').trim().toLowerCase();
            hud.dataset.prevPrivacy = (currentData.privacy || 'private').trim().toLowerCase();
        }
    } else {
        if (title) title.innerText = "INITIALIZE_CURRENT";
        if (submitBtn) submitBtn.innerText = "GENERATE_INFRASTRUCTURE";
        
        if (nameInput) nameInput.value = '';
        if (typeInput) typeInput.value = ''; // Blank for new
        if (typeSelect) typeSelect.value = '';
        if (privacySelect) privacySelect.value = 'private';
        
        hud.dataset.mode = 'add';
        delete hud.dataset.targetId;
        // Add these to be perfectly clean:
        delete hud.dataset.prevName;
        delete hud.dataset.prevType;
        delete hud.dataset.prevPrivacy;
    }

    hud.style.display = 'flex';
    hud.classList.add('active');
};

window.submitNewCurrent = async () => {
    const hud = document.getElementById('add-current-hud');
    const mode = hud.dataset.mode; // 'add' or 'update'
    const prevId = hud.dataset.targetId; // The ID before editing
    
    // 1. Grab current form values
    const newName = document.getElementById('current-name-input').value.trim();
    const newType = document.getElementById('current-type-input').value.trim() || "Custom";
    const newPrivacy = document.getElementById('current-privacy-select').value;

    // 2. Validation: Null Check
    if (!newName || newName.toLowerCase() === 'null') {
        console.warn("[SYSTEM] current name was null: Operation Aborted.");
        return;
    }

    // 3. Identification & Comparison
    // We assume the HUD was populated with these data attributes in openAddCurrentHud
    const prevName = hud.dataset.prevName || '';
    const prevType = hud.dataset.prevType || '';
    const prevPrivacy = hud.dataset.prevPrivacy || 'private';

    let finalId;
    let nameChanged = newName !== prevName;

    if (nameChanged) {
        // Generate new ID because name changed (or it's a brand new 'add')
        finalId = newName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    } else {
        // No name change: preserve the existing ID
        finalId = prevId;
    }

    // 4. Change Detection Guard
    const hasTypeChanged = newType !== prevType;
    const hasPrivacyChanged = newPrivacy !== prevPrivacy;

    if (mode === 'update' && !nameChanged && !hasTypeChanged && !hasPrivacyChanged) {
        console.log("[SYSTEM] No modifications detected. Deployment bypassed.");
        window.closeAddCurrentHud();
        return;
    }

    // 5. Database Execution
    try {
        const ownerUid = auth.currentUser?.uid;
        const timestamp = Date.now();
        
        // Prepare the data packet
        const dataPacket = {
            id: finalId,
            name: newName,
            type: newType,
            privacy: newPrivacy,
            last_updated: timestamp
        };

        if (mode === 'add') {
            const path = `users/${ownerUid}/infrastructure/currents/${finalId}`;
            await saveToRealtimeDB(path, { ...dataPacket, date_created: timestamp });
        } else {
            // UPDATE MODE
            if (nameChanged) {
                // Name changed: We must move the record (Delete old, Create new)
                // We'll need to fetch sparks first to carry them over
                const oldPath = `users/${ownerUid}/infrastructure/currents/${prevId}`;
                const newPath = `users/${ownerUid}/infrastructure/currents/${finalId}`;
                
                // Carry over the sparks from our local cache before deleting
                const sparks = databaseCache.users?.[ownerUid]?.infrastructure?.currents?.[prevId]?.sparks || {};
                const originalDate = databaseCache.users?.[ownerUid]?.infrastructure?.currents?.[prevId]?.date_created || timestamp;

                await saveToRealtimeDB(oldPath, null); // Remove old
                await saveToRealtimeDB(newPath, { ...dataPacket, date_created: originalDate, sparks }); // Set new
            } else {
                // Only non-ID fields changed: standard update
                const path = `users/${ownerUid}/infrastructure/currents/${prevId}`;
                await update(ref(db, path), dataPacket);
            }
        }

        window.closeAddCurrentHud();
        await refreshUI();

    } catch (e) {
        console.error("Infrastructure Deployment Failed:", e);
    }
};

/*
 * Objective: Create a new Current with specific metadata.
 */
window.addNewCurrent = async (name, type, privacy, oldId = null) => {
    const activeUser = window.auth?.currentUser;
    if (!activeUser) throw new Error("Authentication required.");

    const newId = name.toUpperCase().replace(/\s+/g, '-');
    const basePath = `users/${activeUser.uid}/infrastructure/currents`;
    const updates = {};

    if (oldId) {
        // UPDATE MODE: Fetch existing nested data (sparks, etc.) to ensure nothing is lost
        const snapshot = await window.get(window.ref(window.db, `${basePath}/${oldId}`));
        const existingData = snapshot.val() || {};

        // Merge existing sparks/data with new metadata
        updates[`${basePath}/${newId}`] = {
            ...existingData,
            id: newId,
            name: name,
            type: type,
            privacy: privacy,
            updated_at: Date.now()
        };

        // If the ID changed, delete the old node
        if (newId !== oldId) {
            updates[`${basePath}/${oldId}`] = null;
        }
    } else {
        // ADD MODE: Create fresh record
        updates[`${basePath}/${newId}`] = {
            id: newId,
            name: name,
            type: type,
            privacy: privacy,
            created_at: Date.now()
        };
    }

    return window.update(window.ref(window.db), updates);
};

function verifyAndFixCode(rawCode, isCodeMode = false) {
    if (!rawCode || typeof rawCode !== 'string') return "";

    // 1. Scrub UNICODE spaces (non-breaking spaces, etc.) and Markdown ticks
    let fixed = rawCode
        .replace(/[\u00A0\u1680\u180E\u2000-\u200B\u202F\u205F\u3000\uFEFF]/g, ' ')
        .replace(/^```[a-z]*\n?|```$/gi, '')
        .trim();

    return fixed;
}

function verifyAndFixCodeComplex(rawCode, isCodeMode = false) {
    if (!rawCode || typeof rawCode !== 'string') return "";

    // A. Token Sanitization: Clean illegal characters and hidden control tokens
    let fixed = rawCode
        .replace(/\u00A0/g, ' ') // Replace non-breaking spaces
        .replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F-\u009F]/g, "") // Remove control characters
        .replace(/^```[a-z]*\n?|```$/gi, '') // Strip markdown blocks
        .trim();

    // 1. Emergency Wrap: If the AI only sent raw JS, wrap it in a proper HTML shell
    if (!fixed.includes('<script') && (fixed.includes('function') || fixed.includes('const') || fixed.includes('let') || fixed.includes('canvas'))) {
        fixed = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>body{margin:0;overflow:hidden;background:#000;}canvas{display:block;width:100vw;height:100vh;}</style></head><body><canvas id="canvas"></canvas><script>${fixed}<\/script></body></html>`;
    }

    // 2. HEALER LOGIC: Specialized for Code/Create modes
    if (isCodeMode) {
        const hasOnLoad = fixed.includes('window.onload') || 
                         fixed.includes('addEventListener(\'load\'') || 
                         fixed.includes('addEventListener("load"') ||
                         fixed.includes('DOMContentLoaded');
        
        const hasInit = fixed.includes('function init') || fixed.includes('const init');
        const hasLoop = fixed.match(/function (loop|draw|render|update)/) || fixed.match(/const (loop|draw|render|update)/);

        // --- NEW: DE-DUPLICATION GUARD ---
        // If a lifecycle runner is already present, do NOT inject a second one
        const needsRunner = (hasInit || hasLoop) && !hasOnLoad;

        // --- SCOPE & VISIBILITY HEALERS ---
        if (fixed.includes('opacity') || fixed.includes('rgba')) {
            fixed = fixed.replace(/\/\s*100(?!\d)/g, '/ 40'); 
            fixed = fixed.replace(/\/\s*255(?!\d)/g, '/ 120');
        }

        // --- COORDINATE HEALER (Bounding Rect) ---
        if (fixed.includes('clientX') && !fixed.includes('getBoundingClientRect')) {
            fixed = fixed.replace(/(function|const|let)\s+(\w+Mouse\w+|handle\w+|on\w+)\s*=\s*\(?(e|evt)\)?\s*=>?\s*\{|function\s+(\w+)\s*\((e|evt)\)\s*\{/g, 
            (match, p1, p2, p3, p4, p5) => {
                const ev = p3 || p5;
                return `${match} const rect = (document.querySelector('canvas') || ${ev}.target).getBoundingClientRect(); const mx = ${ev}.clientX - rect.left; const my = ${ev}.clientY - rect.top; `;
            });
        }

        // --- AUDIO & MATH PROTECTION ---
        fixed = fixed.replace(/Math\.sqrt\(([^)]+)\)/g, 'Math.max(0.001, Math.sqrt($1))');
        if (fixed.includes('AudioContext')) {
            fixed = fixed.replace(/oscillator\.frequency/g, '(window.oscillator && window.oscillator.frequency)');
        }

        // --- STRUCTURAL INTEGRITY ---
        
        // Ensure Canvas exists if context is called
        if (fixed.includes('.getContext') && !fixed.includes('<canvas')) {
            if (fixed.includes('<body>')) {
                fixed = fixed.replace('<body>', '<body><canvas id="canvas"></canvas>');
            } else {
                fixed = `<canvas id="canvas"></canvas>${fixed}`;
            }
        }

        // Inject Resize into Init if missing
        if (hasInit && fixed.includes('function resize') && !fixed.match(/init\s*\([^)]*\)\s*\{[^}]*resize/)) {
            fixed = fixed.replace(/init\s*\([^)]*\)\s*\{/, 'init() { if(typeof resize === "function") resize(); ');
        }

        // --- FINAL LIFECYCLE INJECTION (If missing) ---
        if (needsRunner) {
            const runner = `
<script id="yertal-lifecycle-runner">
    (function() {
        const start = () => {
            console.log('Yertal Lifecycle: Auto-starting sequence...');
            if(typeof init === 'function') init(); 
            if(typeof render === 'function') render();
            else if(typeof loop === 'function') loop(); 
            else if(typeof draw === 'function') draw(); 
        };
        if (document.readyState === 'complete') start();
        else window.addEventListener('load', start);
    })();
<\/script>`;
            
            // Inject before closing body or at the end of the string
            if (fixed.includes('</body>')) {
                fixed = fixed.replace('</body>', `${runner}</body>`);
            } else {
                fixed += runner;
            }
        }

        // Meta Viewport check
        if (!fixed.includes('<meta name="viewport"')) {
            fixed = fixed.replace('<head>', '<head><meta name="viewport" content="width=device-width, initial-scale=1.0">');
        }
    }

    return fixed;
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

function shapeAiPrompt(rawPrompt, count, mode, currentName, promptTypeObject) {
    const isSource = mode === 'source';
    const isPictures = promptTypeObject.name === "Pictures";

    let instructions = "";

    if (isSource) {
            instructions = `- Research specific items that match the task.
                            ${promptTypeObject.rules}
                         - Format: JSON array [{"name", "url", "thumbnail"}] and name has maximum 3 words. The thumbnail must be a publicly existing, high-resolution image URL relevant to the item.`;
    } else {
        // Your existing code generation logic
        instructions = `Write a visually stunning, fully working HTML/Javascript application.
                     - Format: JSON object {"name", "code", "thumbnail"} and name has maximum 3 words. Fetch a thumbnail that represents the application.`;
    } 

    const returnString = isSource ? 
        `${rawPrompt}. Category to locate: ${promptTypeObject.name}.`: `${rawPrompt}. Use this capability: ${promptTypeObject.name}.`;

    const fullPrompt = `
        ${returnString}
        ${instructions}
        Quantity: ${Math.max(1, count)} ${isSource ? "entries" : "code variations"}.
    `.trim();
    console.log(`shapeAIPrompt: Category: ${promptTypeObject.name} Prompt: ${rawPrompt}. Full shaped Prompt: ${fullPrompt}`);
    return fullPrompt;
}

function shapeAiPromptPrev(rawPrompt, count, mode, currentName, promptTypeObject) {
    const isSource = mode === 'source';
    const isPictures = promptTypeObject.name === "Pictures";

    let instructions = "";

    if (isSource) {
            instructions = `- Research specific items that match the task.
                            ${promptTypeObject.rules}
                         - Format: JSON array [{"name", "url"}] and name has maximum 3 words.`;
    } else {
        // Your existing code generation logic
        instructions = `Write a visually stunning, fully working HTML/Javascript application with gradient colors and 3D objects.
                     - Format: JSON object {"name", "code"} and name has maximum 3 words.`;
    }

    const returnString = isSource ? 
        `${rawPrompt}. Category to source: ${promptTypeObject.name}.`: `${rawPrompt}. Follow this model: ${promptTypeObject.name}.`;

    const fullPrompt = `
        ${returnString}
        ${instructions}
        Quantity: ${Math.max(1, count)} ${isSource ? "entries" : "code variations"}.
    `.trim();
    console.log(`shapeAIPrompt: Category: ${promptTypeObject.name} Prompt: ${rawPrompt}. Full shaped Prompt: ${fullPrompt}`);
    return fullPrompt;
}

// FUNCTION: executeMassSpark
async function executeMassSpark(currentId, currentName, prompt, mode, promptTypeObject, currentPrivacy) {
    const status = document.getElementById('engine-status-text');
    
    // 1. SAFETY CHECK DISABLED FOR NOW.  LET USERS CREATE WHATEVER THEY WANT.
    /*
    if (currentName && promptTypeObject.name.toLowerCase() !== currentName.toLowerCase() && promptTypeObject.name.toLowerCase() !== 'custom') {
        if (!confirm(`⚠️ Warning: The prompt category doesn't match the current type.\n\n` +
                     `Either change the prompt to use the current type [${currentName}] or create/use a current for [${promptTypeObject.name}].\n\n` +
                     `Do you want to continue anyway?`)) return; 
    }
    */
    // 2. CAPACITY VALIDATION
    const planLimits = databaseCache.settings?.['plan_limits']?.[databaseCache.users?.[user.uid]?.profile?.plan_type || 'free'] || databaseCache.settings?.['plan_limits']?.['free'];
    const remainingSpace = planLimits.max_sparks_per_current - Object.keys(databaseCache.users?.[user.uid]?.infrastructure?.currents?.[currentId]?.sparks || {}).length;

    if (remainingSpace <= 0) {
        status.textContent = `STORAGE FULL (${planLimits.max_sparks_per_current}/${planLimits.max_sparks_per_current})`;
        alert(`Limit reached: ${planLimits.max_sparks_per_current} sparks.`);
        return;
    }

    // 3. WORKLOAD LOGIC
    const manualUrls = extractUrls(prompt);
    const resolution = getFinalSparkCountAndItems(prompt, manualUrls, planLimits, remainingSpace);

    const updateForgeStatus = (text) => {
        if (!window.isInCooldown) status.textContent = text;
    };

    try {
        if (mode === 'source') {
            let linksToSave = [];

            if (manualUrls.length > 0 && !resolution.isAiReferenceSearch) {
                for (let i = 0; i < Math.min(manualUrls.length, resolution.count); i++) {
                    linksToSave.push({
                        name: resolution.textChunks[i] || generateSparkName(currentId),
                        url: manualUrls[i],
                        image: promptTypeObject.image || '/assets/thumbnails/default.jpg'
                    });
                }
            } else {
                updateForgeStatus("CONSULTING MODEL POOL...");
                const aiLinks = await callGeminiAPI(shapeAiPrompt(prompt, resolution.count, mode, currentName, promptTypeObject), resolution.count, mode);

                linksToSave = (Array.isArray(aiLinks) ? aiLinks : (typeof aiLinks === 'string' ? aiLinks.split(/,|\n/).map(str => str.trim()).filter(Boolean) : []))
                    .slice(0, resolution.count)
                    .map(item => ({
                        name: item.name || generateSparkName(currentId),
                        url: item.url || item,
                        image: item.thumbnail || promptTypeObject.image || null
                    }));                    
            }

            for (let i = 0; i < linksToSave.length; i++) {
                const sparkName = linksToSave.length > 1 && linksToSave[i].name.startsWith('spark_') ? `${linksToSave[i].name}-${i + 1}` : linksToSave[i].name;

                console.log(`executeMassSpark spark mode=${mode} spark image URL=${linksToSave[i].image}`);
                await saveSpark(currentId, {name: sparkName, link: linksToSave[i].url,image: linksToSave[i].image},prompt, promptTypeObject.name, promptTypeObject.image, currentPrivacy);
                
                const progress = Math.round(((i + 1) / linksToSave.length) * 100);
                updateForgeStatus(`FORGING ${resolution.count} SPARKS [${"=".repeat(Math.floor(progress/10))}${"-".repeat(10-Math.floor(progress/10))}] ${progress}%`);
            }
        } else {
            // CREATE MODE: Handling JSON objects for smart naming and code extraction
            for (let i = 0; i < resolution.count; i++) {
                const progress = Math.round((i / resolution.count) * 100);
                updateForgeStatus(`FORGING ${resolution.count} SPARKS [${"=".repeat(Math.floor(progress/10))}${"-".repeat(10-Math.floor(progress/10))}] ${progress}%`);

                // We pass 'source' here to trigger JSON parsing inside callGeminiAPI
                const response = await callGeminiAPI(shapeAiPrompt(prompt, i, 'create', currentName, promptTypeObject), i, 'source');
                
                // Extract and SCRUB name
                const sparkName = response.name || (resolution.count > 1 ? `${generateSparkName(currentId)}-${i + 1}` : generateSparkName(currentId));
                
                // VERIFY AND FIX: Scrub the code field explicitly
                const sparkContent = verifyAndFixCode(response.code, mode); 
                
                // Extract thumbnail URL
                const sparkImage = response.thumbnail || promptTypeObject.image || null;
                console.log(`executeMassSpark spark mode=${mode} spark image URL=${sparkImage}`);
                const isCode = typeof sparkContent === 'string' && (sparkContent.trim().startsWith('<') || sparkContent.trim().startsWith('function') || sparkContent.trim().startsWith('const') || sparkContent.trim().includes('document.'));
                
                await saveSpark(
                    currentId, 
                    { 
                        name: sparkName, 
                        [isCode ? 'code' : 'link']: sparkContent, 
                        image: sparkImage
                    }, 
                    prompt,
                    promptTypeObject.name,
                    promptTypeObject.image,
                    currentPrivacy
                );
            }
            updateForgeStatus(`FORGING ${resolution.count} SPARKS [==========] 100%`);
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

    console.log("genSparkImage: Treating the image as a standard path/URL");
    return sparkImageFromDB;
}

// FUNCTION: renderSparkCard
function renderSparkCard(spark, isOwner, currentId, ownerId) {
    /* Overall Objective: Generate the HTML for a spark card with persistent 
        neon state for likes and shares based on user history. */
    
    // Retrieve the page owner's slug from the cache using the ownerId and create the spark card's launch URL.
    const ownerData = databaseCache?.users?.[ownerId];
    const userSlug = ownerData?.profile?.slug;
    const targetUrl = `spark.html?user=${userSlug}&current=${currentId}&spark=${spark.id}`;

    // Now check for the visitor user's credentials.
    const visitorUid = auth.currentUser ? auth.currentUser.uid : null;
    const sparkElementId = `save-btn-${spark.id}`;

    let finalRenderedImage = '/assets/thumbnails/default.jpg'; // Safe default

    const sparkImage = genSparkImage(spark.image);

    // DYNAMIC FALLBACK TRIGGER
    finalRenderedImage = sparkImage;
        
    // PRE-RENDER TRY-CATCH GUARD

    if (!sparkImage || spark.image === "") {
       // Fetch the live active theme state on render
       const activeThemeKey = localStorage.getItem('arcade-theme') || 'neon-dark';
       const activeThemeData = databaseCache.settings?.['themes']?.[activeThemeKey] || {};
            
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
    
    const inlineFallbackJS = `console.error('IMAGE NETWORK FAILED: ${spark.id}'); this.onerror=null; try { const tk = localStorage.getItem('arcade-theme') || 'neon-dark'; const td = databaseCache.settings['themes'][tk] || {}; this.src=getDynamicCardCover(td); } catch(e) { this.src='/assets/thumbnails/default.jpg'; }`;

    return `
        <div class="spark-card" data-spark-id="${spark.id}" style="display: flex; flex-direction: column; gap: 1.5rem; align-items: center; width: 100%;">
            <div class="action-card" 
                  onclick="window.location.href='${targetUrl}'"
                  style="position: relative; display: flex; align-items: center; justify-content: center; overflow: hidden; min-height: 180px; width: 100%; cursor: pointer; border-radius: 8px; background: #111 !important;">
                
                <h4 class="metallic-text" style="position: relative; z-index: 10; text-align: center; padding: 0 1.5rem; pointer-events: none;">
                    ${spark.name}
                </h4>
                
                <img src="${finalRenderedImage}" 
                       class="spark-thumbnail"
                       onerror="${inlineFallbackJS}"
                       onload="this.style.opacity='1';"
                       style="opacity: 0;">
                
                <div style="position: absolute; inset: 0; background: var(--bg-color); opacity: 0.1; z-index: 2; pointer-events: none;"></div>
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
    
    console.log(`[resolveCategoryFromPrompt]: Evaluating prompt: "${cleanPrompt}"`);
    console.log(`[resolveCategoryFromPrompt]: Extracted tokens:`, tokens);
    
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
        // CLEANUP: Remove leading/trailing pipes and double pipes which create "empty" matches
        const sanitizedRegex = category.regex.replace(/^\|+|\|+$/g, '').replace(/\|\|+/g, '|');
        
        if (sanitizedRegex) {
            const boundedRegex = `\\b(${sanitizedRegex})\\b`;
            const regexPattern = new RegExp(boundedRegex, 'i');
            
            const promptHitsRegex = regexPattern.test(cleanPrompt);
            const tokenHitsRegex = tokens.some(token => regexPattern.test(token));
            
            regexMatches = promptHitsRegex || tokenHitsRegex;
        }
    } catch (regexErr) {
        console.warn(`[resolveCategoryFromPrompt]: Invalid regex for ${category.id}:`, regexErr);
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
    console.log(`[resolveCategoryFromPrompt]: No matches found in DB. Falling back to [Custom].`);
    
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
    

async function retrieveGeminiCredentials() {
    try {
        let manifest = databaseCache?.app_manifest;

        if (!manifest || !manifest.gkey) {
            const snap = await get(ref(db, 'app_manifest')).catch(() => null);
            if (snap && snap.exists()) {
                manifest = snap.val();
                if (databaseCache) databaseCache.app_manifest = manifest;
            }
        }

        if (!manifest || !manifest.gkey) {
            throw new Error("Forge manifest or GKey missing in DB.");
        }

        const apiKey = manifest.gkey;
        
        // ONLY call getGeminiModel if the local pool OR the manifest pool is empty
        const isPoolEmpty = !Array.isArray(modelStats) || modelStats.length === 0;
        const isManifestPoolEmpty = !Array.isArray(manifest.model_pool) || manifest.model_pool.length === 0;

        if (isPoolEmpty || isManifestPoolEmpty) {
            await getGeminiModel(apiKey);
        }

        // Return the API key; callGeminiAPI handles the iteration via modelStats
        return { apiKey };
    } catch (e) {
        console.error("[FORGE ERROR]: Failed to assemble credentials:", e);
        return null;
    }
}

async function getGeminiModel(apiKey) {
    // 1. IMMEDIATE RETURN: If modelStats is already populated, get the healthiest model.
    if (typeof modelStats !== 'undefined' && Array.isArray(modelStats) && modelStats.length > 0) {
        const sorted = [...modelStats].sort((a, b) => a[1] - b[1]);
        return sorted[0][0];
    }

    // 2. HYDRATE FROM CACHE: If memory is empty, check the databaseCache object.
    if (databaseCache.app_manifest?.model_pool) {
        console.log("[FORGE]: Hydrating model pool from manifest cache.");
        
        const pool = databaseCache.app_manifest.model_pool;
        // Map names into our 2D tracking array [[name, failures]]
        modelStats = pool.map(name => [name, 0]);

        return databaseCache.app_manifest.default_model;
    }

    // 3. DISCOVERY: Only runs if both memory and cache are empty.
    try {
        console.log("[FORGE]: Discovering models via Google API...");
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const data = await response.json();

        if (!data.models) throw new Error("No models property in API response.");

        // Filter: Flash and Pro only, exclude Lite and latest aliases.
        const filteredModels = data.models.filter(m => 
            (m.name.includes('flash') || m.name.includes('pro')) && 
            m.supportedGenerationMethods.includes('generateContent') &&
            !m.name.toLowerCase().includes('lite') &&
            !m.name.endsWith('-latest')
        );

        // Sort so newest versions are at the top initially.
        filteredModels.sort((a, b) => b.name.localeCompare(a.name));

        if (filteredModels.length === 0) throw new Error("No suitable models found.");

        const flatNames = filteredModels.map(m => m.name.split('/')[1]);
        modelStats = flatNames.map(name => [name, 0]);
        
        const resolvedModel = modelStats[0][0];
        console.log(`[FORGE]: Primary: ${resolvedModel}. Pool:`, modelStats);

        // 4. PERSIST TO FIREBASE (Non-blocking for speed)
        update(ref(db, 'app_manifest'), {
            default_model: resolvedModel,
            model_pool: flatNames, 
            last_model_sync: new Date().toISOString()
        }).catch(err => console.warn("[FORGE]: Manifest sync failed", err));
        
        if (!databaseCache.app_manifest) databaseCache.app_manifest = {};
        databaseCache.app_manifest.default_model = resolvedModel;
        databaseCache.app_manifest.model_pool = flatNames;

        return resolvedModel;

    } catch (e) {
        console.warn("[FORGE]: Discovery failed. Falling back to high-reasoning defaults.", e);
        // Modern Fallback (Removed dead 1.5 versions)
        // This is an array of model, failed_counts
        modelStats = [
            ['gemini-3-flash-preview', 0], 
            ['gemini-2.5-flash', 0], 
            ['gemini-2.5-pro', 0]
        ];
        return modelStats[0][0]; 
    }
}

async function callGeminiAPI(prompt, val, type) {
    const isCode = type === 'code' || type === 'create';
    const statusText = document.getElementById('engine-status-text');

    if (window.isInCooldown) throw new Error("System is currently cooling down.");

    const credentials = await retrieveGeminiCredentials();
    if (!credentials) throw new Error("Failed to retrieve Gemini credentials.");

    // modelStats is now guaranteed to be hydrated by retrieveGeminiCredentials if it was missing
    modelStats.sort((a, b) => a[1] - b[1]);
    
    let attempts = 0;
    const maxRetries = modelStats.length;

    while (attempts < maxRetries) {
        const currentEntry = modelStats[attempts];
        if (!currentEntry) {
            attempts++;
            continue;
        }

        const modelName = currentEntry[0];

        // --- THROTTLE & STATUS UPDATE ---
        if (statusText) statusText.innerText = `READYING ENGINE... (4s THROTTLE)`;
        await new Promise(r => setTimeout(r, 4000));
        
        if (statusText) statusText.innerText = `RETRIEVING MODEL ${modelName.toUpperCase()}...`;

        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${credentials.apiKey}`;

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    contents: [{ parts: [{ text: prompt }] }] 
                })
            });

            if (!response.ok) {
                if (response.status === 429) console.warn(`[LIMIT]: 429 hit on ${modelName}.`);
                currentEntry[1]++;
                attempts++;
                await new Promise(r => setTimeout(r, 200));
                continue;
            }

            const data = await response.json();
            if (currentEntry[1] > 0) currentEntry[1]--;

            const rawResult = data.candidates[0].content.parts[0].text;
            let sanitized = verifyAndFixCode(rawResult, isCode);
            
            if (isCode) {
                if (sanitized.includes('<!DOCTYPE') || sanitized.includes('<html')) {
                    const start = Math.max(sanitized.indexOf('<!DOCTYPE'), sanitized.indexOf('<html'));
                    if (start !== -1) sanitized = sanitized.substring(start);
                }
                return sanitized;
            } else {
                try {
                    const parsed = JSON.parse(sanitized);
                    if (parsed && typeof parsed.code === 'string') {
                        parsed.code = verifyAndFixCode(parsed.code, true);
                    } else if (Array.isArray(parsed)) {
                        parsed.forEach(item => {
                            if (item.url) item.url = verifyAndFixCode(item.url);
                            if (item.code) item.code = verifyAndFixCode(item.code, true);
                        });
                    }
                    return parsed;
                } catch (jsonErr) {
                    if (sanitized.includes('<!DOCTYPE') || sanitized.includes('<html')) {
                        const start = Math.max(sanitized.indexOf('<!DOCTYPE'), sanitized.indexOf('<html'));
                        if (start !== -1) sanitized = sanitized.substring(start);
                    }
                    return sanitized;
                }
            }
        } catch (error) {
            console.warn(`[FAIL]: ${modelName} hit an error:`, error);
            currentEntry[1]++;
            attempts++;
            if (attempts < maxRetries) await new Promise(r => setTimeout(r, 200));
        }
    }

    await initiateSystemCooldown(statusText);
    throw new Error("All models exhausted.");
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
async function saveSpark(currentId, data, prompt, detectedTemplate = 'Custom', templateUrl = '/assets/thumbnails/custom.jpg', currentPrivacy) {
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
        image: data.image || templateUrl || '/assets/thumbnails/default.jpg',
        internal_rank: rank,
        code: data.code || null,
        link: data.link || null,
        privacy: currentPrivacy,
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
 * Task: Dynamically generate HUD structure, populate from cache, and ensure Close UI is present.
 */
window.openArcadeSettings = () => {
    const hud = document.getElementById('arcadesettings-hud');
    if (!hud) return;

    // 1. IDENTITY & STATE CHECK
    const currentUid = window.auth?.currentUser?.uid;
    
    // Retrieve profile from databaseCache as the Source of Truth
    const profile = (databaseCache.users && currentUid && databaseCache.users[currentUid]) 
                    ? databaseCache.users[currentUid].profile 
                    : {};

    const isSetup = profile.hasOwnProperty('setup_complete') && profile.setup_complete === true;
    
    console.log("openArcadeSettings - Profile Source:", isSetup ? "DATABASE_CACHE" : "NEW_USER");

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

    // 3. PRE-POPULATE FIELDS FROM CACHE
    if (nameInput) nameInput.value = isSetup ? (profile.arcade_title || '') : '';
    if (subtitleInput) subtitleInput.value = isSetup ? (profile.arcade_subtitle || '') : '';
    if (privacySelect) privacySelect.value = isSetup ? (profile.privacy || 'public') : 'public';

    // 4. POPULATE THEMES & APPLY INITIAL STYLE
    const themes = databaseCache.settings?.['ui-settings']?.themes;
    if (themes && themeSelect) {
        themeSelect.innerHTML = ''; 
        Object.keys(themes).forEach(id => {
            const opt = document.createElement('option');
            opt.value = id;
            opt.textContent = themes[id].name.replace(/_/g, ' ').toUpperCase();
            themeSelect.appendChild(opt);
        });

        const activeThemeId = isSetup ? (profile.theme || 'spring-bloom') : 'spring-bloom';
        themeSelect.value = activeThemeId;
        
        themeSelect.onchange = (e) => {
            if (typeof applyTheme === 'function') applyTheme(e.target.value);
            const selectedTheme = themes[e.target.value];
            if (selectedTheme && selectedTheme['button-text-color'] && submitBtn) {
                submitBtn.style.color = selectedTheme['button-text-color'];
            }
        };

        if (typeof applyTheme === 'function') applyTheme(activeThemeId);
    }

    // 5. METALLIC HEADER REFINEMENT (WITH CANCEL BUTTON)
    const hudHeader = hud.querySelector('.hud-header-content');
    if (hudHeader) {
        hudHeader.innerHTML = `
            <div class="hud-header-text">
                <h2 class="hud-title-metallic">${isSetup ? 'RE-FORGE LABORATORY' : 'INITIALIZE YOUR ARCADE'}</h2>
                <p class="hud-subtitle-info">${isSetup ? 'Syncing Profile Data...' : 'Establish Your Arcade to Start Creating'}</p>
            </div>
            <button onclick="closeArcadeSettings()" class="close-hud-corner" aria-label="Close Settings">
                <i class="fa-solid fa-xmark"></i>
            </button>
        `;
    }

    // 6. DYNAMIC PLAN GRID GENERATION
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
                        <hr class="metallic-divider">
                        <li><i class="fa-solid ${plan.analytics_enabled ? 'fa-square-check text-glow-green' : 'fa-square-xmark text-dim'}"></i> Analytics</li>
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

    // 7. BUTTON CONFIGURATION & VISIBILITY
    if (submitBtn) {
        submitBtn.innerText = isSetup ? "UPDATE IDENTITY" : "ESTABLISH IDENTITY";
        submitBtn.style.display = "block";
        submitBtn.style.margin = "30px auto 10px auto";

        const activeTheme = themes?.[themeSelect.value];
        if (activeTheme && activeTheme['button-text-color']) {
            submitBtn.style.color = activeTheme['button-text-color'];
        }
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
        
        // Ensure local state exists
        if (!window.pageOwnerData) window.pageOwnerData = {};
        if (!window.pageOwnerData.profile) window.pageOwnerData.profile = {};
        
        const profile = window.pageOwnerData.profile;
        
        // --- RELIABLE SLUG RECOVERY ---
        // We pull directly from the URL params (?user=slug) as the source of truth
        const urlParams = new URLSearchParams(window.location.search);
        const currentSlug = urlParams.get('user') || profile.slug || window.currentPageOwnerSlug;
        
        const selectedPrivacy = privacySelect.value;

        // 1. CONSTRUCT UPDATE PAYLOAD
        const updates = {};
        updates[`${profilePath}/arcade_title`] = arcadeName;
        updates[`${profilePath}/arcade_subtitle`] = subtitleInput.value.trim();
        updates[`${profilePath}/theme`] = themeSelect.value;
        updates[`${profilePath}/privacy`] = selectedPrivacy;
        updates[`${profilePath}/plan_type`] = planValue;

        // Ensure slug is synced in the profile node if it was missing
        if (currentSlug) {
            updates[`${profilePath}/slug`] = currentSlug;
        }

        if (profile.setup_complete === undefined || profile.setup_complete === null) {
            updates[`${profilePath}/setup_complete`] = true;
        }

        // 2. GRANULAR SEARCH INDEX MANAGEMENT
        if (currentSlug) {
            if (selectedPrivacy === 'public') {
                // Map the slug to the active UID
                updates[`search_index/${currentSlug}`] = activeUser.uid;
                console.log(`[INDEX]: Syncing public access for ${currentSlug}`);
            } else {
                // Remove slug from index if private/unlisted
                updates[`search_index/${currentSlug}`] = null;
                console.log(`[INDEX]: Removing ${currentSlug} from public directory.`);
            }
        } else {
            console.warn("[INDEX_SKIPPED]: No valid slug found in URL, Profile, or Global state.");
        }

        // 3. ATOMIC EXECUTION
        // One update call handles both the user profile and the search index
        await window.update(window.ref(window.db), updates);

        // 4. SYNC LOCAL STATE
        Object.keys(updates).forEach(path => {
            if (path.startsWith(profilePath)) {
                const key = path.split('/').pop();
                window.pageOwnerData.profile[key] = updates[path];
            }
        });

        // 5. UI REFRESH
        if (typeof applyTheme === 'function') applyTheme(themeSelect.value);
        document.getElementById('arcadesettings-hud').classList.remove('active');

        await refreshUI();
        console.log("[SYSTEM]: Settings and Search Index Synchronized.");

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

window.handleLauncherClick = function() {
    const chatData = databaseCache?.chat_config;

    if (!window.navigatorAgent && chatData) {
        window.navigatorAgent = new ArcadeNavigator(chatData);
        window.navigatorAgent.initChatAgent();
        
        // Use a small delay to let the DOM settle
        setTimeout(() => {
            const widget = document.querySelector('.yertal-navigator-widget');
            if (widget) {
                // Force it open directly to avoid the "flicker" of a toggle conflict
                widget.classList.add('active');
                // Also update the icon manually so it's in sync
                const icon = document.querySelector('.navigator-launcher i');
                if (icon) icon.className = 'fa-solid fa-xmark';
            }
        }, 50);
        return;
    }

    if (window.navigatorAgent) {
        window.navigatorAgent.toggleNavigator();
    }
};

class ArcadeNavigator {
    constructor(dbData) {
        console.log("ArcadeNavigator: Initializing with data:", dbData);
        this.nodes = dbData.nodes;
        this.setup = dbData.setup;
        this.currentNode = dbData.setup.initial_node;
        this.history = [];
    }

    // Inside your ArcadeNavigator class in arcade.js

    initChatAgent() {
        console.log("ArcadeNavigator: initChatAgent called.");
        let widget = document.getElementById('yertal-nav-container');
    
        if (!widget) {
            console.log("ArcadeNavigator: Widget not found in HTML, creating dynamically...");
            widget = document.createElement('div');
            widget.id = 'yertal-nav-container';
            widget.className = 'yertal-navigator-widget';
            document.body.appendChild(widget);
        }
    
        // Ensure it's visible and animated
        widget.style.display = 'flex';
        widget.style.opacity = '1';
        widget.style.pointerEvents = 'all';
        
        this.renderNode(this.currentNode);
    }

// Inside your ArcadeNavigator class in arcade.js

renderNode(nodeId) {
    console.log("ArcadeNavigator: Rendering node ->", nodeId);
    const node = this.nodes[nodeId];
    
    if (!node) {
        console.error("ArcadeNavigator: Node ID '" + nodeId + "' not found in dbData.nodes!");
        return;
    }

    const container = document.getElementById('yertal-nav-container');
    
    // Ensure container is visible when rendering
    if (container.style.display === 'none') {
        container.style.display = 'flex';
    }

    // Dynamically inject the agent name from your DB setup
    container.innerHTML = `
        <div class="navigator-header">
            <span>${this.setup.agent_name}</span>
            <i class="fa-solid fa-xmark" style="cursor:pointer;" onclick="window.navigatorAgent.closeNavigator()"></i>
        </div>
        <div class="navigator-body">
            <div class="navigator-question">${node.question}</div>
            <div id="nav-options"></div>
        </div>
    `;

    const optionsBox = container.querySelector('#nav-options');
    Object.entries(node.options).forEach(([key, data]) => {
        const btn = document.createElement('div');
        btn.className = 'navigator-option';
        btn.innerText = data.text;
        btn.onclick = () => this.processSelection(data);
        optionsBox.appendChild(btn);
    });
}
toggleNavigator() {
    const widget = document.getElementById('yertal-nav-container');
    const launcherIcon = document.querySelector('#yertal-nav-launcher i');
    const isHidden = widget.style.display === 'none' || widget.style.display === '';

    if (isHidden) {
        launcherIcon.classList.remove('fa-comment-dots');
        launcherIcon.classList.add('fa-xmark');
        this.initChatAgent(); 
    } else {
        launcherIcon.classList.remove('fa-xmark');
        launcherIcon.classList.add('fa-comment-dots');
        this.closeNavigator();
    }
}
closeNavigator() {
    const widget = document.getElementById('yertal-nav-container');
    const launcherIcon = document.querySelector('#yertal-nav-launcher i');
    
    if (widget) {
        widget.style.display = 'none';
        if (launcherIcon) {
            launcherIcon.classList.remove('fa-xmark');
            launcherIcon.classList.add('fa-comment-dots');
        }
    }
}
    submitPriorityMessage() {
    const message = document.getElementById('nav-message-input').value;
    if (!message.trim()) return;

    // Placeholder for your Firebase push logic (Firestore or Realtime DB)
    console.log("Saving Message:", message);

    const body = document.querySelector('.navigator-body');
    body.innerHTML = `
        <div class="navigator-question">Thank you. Your message has been logged for review.</div>
        <button class="navigator-option" onclick="window.navigatorAgent.renderNode('start')">Return to Start</button>
    `;
}
    processSelection(option) {
    console.log("ArcadeNavigator: Option selected:", option);
    if (option.action === 'link') {
        window.open(option.url, '_blank');
    } else if (option.action === 'collect_message') {
        this.renderMessageForm();
    } else if (option.next) {
        this.currentNode = option.next;
        this.renderNode(this.currentNode);
    }
}
    // Add these methods to your ArcadeNavigator class in arcade.js

    renderMessageForm() {
        console.log("ArcadeNavigator: Rendering priority message form.");
        const container = document.getElementById('yertal-nav-container');
        const body = container.querySelector('.navigator-body');
    
        body.innerHTML = `
            <div class="navigator-question">Please enter your priority message below:</div>
            <textarea id="nav-message-input" class="nav-textarea" placeholder="Describe the issue or request..."></textarea>
            <button class="navigator-option" onclick="window.navigatorAgent.submitPriorityMessage()">Send Message</button>
            <button class="navigator-option" style="opacity:0.6" onclick="window.navigatorAgent.renderNode('start')">Back</button>
        `;
    }
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
