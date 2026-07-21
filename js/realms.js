import { firebaseConfig, ref, set, get, push, runTransaction, auth, db, update, app } from '/config/firebase-config.js';;

import { loginWithProvider, logout, watchAuthState } from '/config/auth.js';

// Build Check: Manually update the time string below when pushing new code
console.log(`%c YERTAL REALMS-FX LOADED | ${new Date().toLocaleDateString()} @ 21:03:00 `, "background: #000; color: #00f2ff; font-weight: bold; border: 1px solid #00f2ff; padding: 4px;");

// 1. ADD these declarations at the very top of the file
let currentItems, currentAuth, currentUi, user, heroData;

/* Tag/Function: initRealmsHome */
async function initRealmsHome() {
    try {
        console.log("%c [SYSTEM INITIALIZATION] Fetching architecture paths...", "color: #00f2ff; font-weight: bold;");
        
        // Modified path from 'settings/realmshome' to 'realmshome'
        const paths = ['settings/ui-settings', 'realmshome', 'auth_ui'];
        const results = await Promise.all(paths.map(p => fetch(`${firebaseConfig.databaseURL}/${p}.json`).then(r => r.json())));
        const data = {};
        paths.forEach((p, i) => { data[p] = results[i]; });

        console.log("[SYSTEM DATA INITIALIZED] Payload received:", data);

        // Updated validation conditional check to match the new root payload key
        if (data && data['settings/ui-settings'] && data['realmshome']) {
            currentUi = data['settings/ui-settings'];
            currentAuth = data.auth_ui;
            const realms = data['realmshome'];

            console.log("[CONFIG SYNC] UI settings parsed successfully:", currentUi);
            console.log("[CONFIG SYNC] Realms home structural payload mapping:", realms);

            applyGlobalStyles({ 'ui-settings': currentUi });

            // Dynamic Router for the 10 System Sections
            const sectionRouter = {
                navigation: () => { 
                    console.log("-> Executing section: navigation");
                    renderBranding(realms.navigation.branding); 
                    renderNavbar(realms.navigation.menu_items); 
                },
                hero: async () => { 
                    console.log("-> Executing section: hero");
                    await renderHero(user, realms.hero); 
                },
                featured_realms: () => { 
                    console.log("-> Executing section: featured_realms");
                    renderFeaturedRealms(realms.featured_realms); 
                },
                how_realms_work: () => { 
                    console.log("-> Executing section: how_realms_work");
                    renderHowRealmsWork(realms.how_realms_work); 
                },
                trending_sparks: () => { 
                    console.log("-> Executing section: trending_sparks");
                    renderTrendingSparks(realms.trending_sparks); 
                },
                creation_templates: () => { 
                    console.log("-> Executing section: creation_templates");
                    renderTemplates(realms.creation_templates); 
                },
                learn_to_build: () => { 
                    console.log("-> Executing section: learn_to_build");
                    renderLearnToBuild(realms.learn_to_build); 
                },
                future_community: () => { 
                    console.log("-> Executing section: future_community");
                    renderCommunity(realms.future_community); 
                },
                final_cta: () => { 
                    console.log("-> Executing section: final_cta");
                    renderFinalCTA(realms.final_cta); 
                },
                footer: () => { 
                    console.log("-> Executing section: footer");
                    renderFooter(realms.footer); 
                }
            };

            Object.keys(realms).forEach(key => {
                if (sectionRouter[key]) {
                    sectionRouter[key]();
                } else {
                    console.warn(`[ROUTER WARNING] Unknown key matched in payload path: "${key}"`);
                }
            });

            // Animated cosmic particles engine forced prior to asynchronous watchers
            initBackgroundEffects();
            
            console.log("[AUTH SYNC] Binding secure gateway profiles...");
            watchAuthState((u) => {
                user = u;
                renderAuthStatus(user, currentAuth);
                if (realms && realms.hero) {
                    renderHero(user, realms.hero);
                }
            });
            
            document.body.style.opacity = '1';
            console.log("%c [SYSTEM ONLINE] View execution stream complete.", "color: #4ade80; font-weight: bold;");
        } else {
            console.error("[CRITICAL SHUTDOWN] Validation conditions failed. Missing 'settings/ui-settings' or 'realmshome' entries.");
        }
    } catch (error) {
        console.error("System Error: Realms Architecture Offline.", error);
    }
}

function initBackgroundEffects() {
    /*console.log("%c [CANVAS ENGINE] Initializing hardware particle layer... ", "background: #111; color: #00f2ff; font-weight: bold;");*/

    // 1. Create a true full-viewport background layout layer
    const canvas = document.createElement('canvas');
    const MAX_SPARKS = 1500;
    canvas.id = 'realms-bg-canvas';
    
    // Enforce explicit runtime layout rules directly to bypass missing framework utility classes
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '-1';
    
    document.body.prepend(canvas);
    /*console.log("[CANVAS ENGINE] Canvas element prepended to DOM body. ID:", canvas.id);*/

    const ctx = canvas.getContext('2d');
    if (!ctx) {
        console.error("[CANVAS ENGINE] Failed to acquire 2D context from canvas element.");
        return;
    }
    /*console.log("[CANVAS ENGINE] 2D Context acquired successfully.");*/

    let particles = [];

    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        
        /*console.log(`[CANVAS ENGINE] Dimensions updated -> Width: ${canvas.width}px, Height: ${canvas.height}px`);*/
        
        // RE-SYNC CENTER ATTRACTORS IMMEDIATELY ACROSS ALL LIVING SPARKS ON RESIZE
        if (particles.length > 0) {
            particles.forEach(p => {
                p.centerX = canvas.width / 2;
                p.centerY = canvas.height * 0.4;
            });
            /*console.log(`[CANVAS ENGINE] Recalculated orbit center point (${canvas.width / 2}, ${canvas.height * 0.4}) across ${particles.length} active particles.`);*/
        }
    }
    window.addEventListener('resize', resize);
    resize();

    class CosmicSpark {
        constructor() {
            this.reset(true); // Initial seed scatter
        }
reset(isInitial = false) {
            this.centerX = canvas.width / 2;
            this.centerY = canvas.height * 0.4; 

            this.angle = Math.random() * Math.PI * 2;
            
            const spreadFactor = Math.random();
            if (spreadFactor < 0.6) {
                // 60% of particles form a thick, concentrated halo around the text
                this.radiusX = Math.random() * 350 + 50;
                this.radiusY = Math.random() * 250 + 100; /* Increased from * 120 + 30 to widen the inner vertical ellipse */
            } else {
                // 40% drift outward across the full page view dimensions
                this.radiusX = Math.random() * (canvas.width * 0.8) + 200;
                this.radiusY = Math.random() * (canvas.height * 0.8) + 300; /* Increased from + 100 to broaden the outer field path */
            }

            // INCREASED VELOCITY FOR FASTER SWIRLING ROTATION
            this.orbitSpeed = (Math.random() * 0.004 + 0.0015) * (Math.random() > 0.5 ? 1 : -1); /* Boosted from 0.0015 + 0.0003 for a more kinetic momentum */
            
            this.waveSpeed = Math.random() * 0.01 + 0.005;
            this.waveOffset = Math.random() * 100;
            
            // EXTRA-LARGE BOOSTED LUMINOUS PARTICLE RADII
            this.size = Math.random() * 4.0 + 2.0;
            this.depth = Math.random() * 0.8 + 0.2; 
            
            this.alpha = isInitial ? Math.random() * 0.6 + 0.1 : 0;
            this.maxAlpha = Math.random() * 0.5 + 0.2;
            this.fadeInSpeed = Math.random() * 0.008 + 0.003;
            this.age = 0;
            this.lifespan = Math.random() * 500 + 400;
        }
        update(mouseX = 0, mouseY = 0) {
            this.age++;
            this.angle += this.orbitSpeed;
            this.waveOffset += this.waveSpeed;

            // Fluid orbital vector calculations with dynamic organic noise
            const noise = Math.sin(this.waveOffset) * 15 * this.depth;
            this.baseX = this.centerX + (this.radiusX + noise) * Math.cos(this.angle);
            this.baseY = this.centerY + (this.radiusY + noise) * Math.sin(this.angle);

            // Smooth opacity phase loops (fade in, glow, fade out)
            if (this.age < 50 && this.alpha < this.maxAlpha) {
                this.alpha += this.fadeInSpeed;
            } else if (this.age > this.lifespan - 50) {
                this.alpha -= this.fadeInSpeed;
            }

            // Endless continuous loop check
            if (this.age >= this.lifespan || this.alpha <= 0) {
                this.reset(false);
            }
        }
draw(mouseX = 0, mouseY = 0) {
            // Apply mouse parallax tracking relative to depth layers
            const parallaxX = (mouseX - canvas.width / 2) * 0.025 * this.depth;
            const parallaxY = (mouseY - canvas.height / 2) * 0.025 * this.depth;
            
            const renderX = this.baseX + parallaxX;
            const renderY = this.baseY + parallaxY;

            ctx.save();
            ctx.globalAlpha = Math.max(0, this.alpha);
            ctx.shadowBlur = 12 * this.depth;
            
            // Fix: Prioritize global runtime UI configuration payload over DOM style computations
            let neonColor = '#00f2ff';
            if (typeof currentUi !== 'undefined' && currentUi?.['neon-color']) {
                neonColor = currentUi['neon-color'];
            } else {
                const computedColor = getComputedStyle(document.documentElement).getPropertyValue('--neon-color').trim();
                if (computedColor) neonColor = computedColor;
            }
            
            ctx.shadowColor = neonColor;
            ctx.fillStyle = neonColor;
            
            ctx.beginPath();
            ctx.arc(renderX, renderY, this.size * this.depth, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
}

    // Interactive mouse state listeners
    let currentMouseX = window.innerWidth / 2;
    let currentMouseY = window.innerHeight / 2;
    window.addEventListener('mousemove', (e) => {
        currentMouseX = e.clientX;
        currentMouseY = e.clientY;
    });

    // Generate cloud assembly population size
    /*console.log(`[CANVAS ENGINE] Generating particle cloud assembly (${MAX_SPARKS} sparks)...`);*/
    for (let i = 0; i < MAX_SPARKS; i++) {
        const spark = new CosmicSpark();
        // Scatter particle timeframes evenly so they don't fade all at once
        spark.age = Math.random() * spark.lifespan;
        particles.push(spark);
    }
    /*console.log("[CANVAS ENGINE] Population generation complete. Swarm collection loaded.");*/

    let executionFrameCount = 0;
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Render the cloud engine elements
        particles.forEach(p => {
            p.update(currentMouseX, currentMouseY);
            p.draw(currentMouseX, currentMouseY);
        });
        
        if (executionFrameCount === 0) {
            console.log("%c [CANVAS ENGINE] Dynamic requestAnimationFrame loop successfully mounted and painting loops active. ", "color: #4ade80; font-weight: bold;");
        }
        executionFrameCount++;
        
        requestAnimationFrame(animate);
    }
    
    /*console.log("[CANVAS ENGINE] Spawning loop process thread...");*/
    animate();
}
function applyGlobalStyles(settings) {
    const ui = settings['ui-settings'];

    if (!ui) {
        console.error("Style Engine: 'ui-settings' missing from database.");
        return;
    }
    const root = document.documentElement;
    
    //  DYNAMIC FONT LOADING: Get the font name from DB and request all weights
    const selectedFont = ui.nav_font ;
    const cleanFontUrl = `https://fonts.googleapis.com/css2?family=${selectedFont.replace(' ', '+')}:wght@100..900&display=swap`;
    // Load the FA Fonts
    const faLink = document.getElementById('font-awesome-link');
    if (faLink) {
        faLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css';
    }
    const fontLink = document.getElementById('google-fonts-link');
    if (fontLink) {
        fontLink.href = cleanFontUrl;
    }
    
    // Direct JSON-to-CSS Mapping
    root.style.setProperty('--nav-font', ui.nav_font);
    root.style.setProperty('--nav-weight', ui['nav-font-weight']);
    root.style.setProperty('--card-blur', ui.card_blur);
    root.style.setProperty('--neon-color', ui['color-neon']);
    root.style.setProperty('--accent-color', ui['color-accent']);
    root.style.setProperty('--btn-radius', ui['button-radius'] + 'px');
    root.style.setProperty('--nav-text-color', ui.nav_text_color);
    root.style.setProperty('--nav-hover-color', ui.nav_hover_color);

    //set the icon font family and weight to be used as a variable
    root.style.setProperty('--icon-font-family', ui['icon-font-family'] || '"Font Awesome 6 Free"');
    root.style.setProperty('--icon-font-weight', ui['icon-font-weight'] || '900');
}

function renderBranding(brand) {
    const el = document.getElementById('nav-logo');
    if (!el) return;
    el.innerHTML = `
        <div class="flex items-center gap-3 cursor-pointer" onclick="location.reload()">
            <img src="${brand.logo_url}" class="h-10 w-auto">
            <h1 class="text-xl font-extrabold uppercase tracking-tighter">
                <span style="color: var(--neon-color);">${brand.text_part_1}</span> 
                <span class="text-white">${brand.text_part_2}</span>
            </h1>
        </div>
    `;
}

/* Tag/Function: renderNavbar */
function renderNavbar(items) {
    const el = document.getElementById('nav-menu');
    if (!el || !items) return;
    
    // Explicitly enforce the design variables to map font rules across rendering pipelines
    el.innerHTML = items.map(item => `
        <a href="${item.link}" 
           class="transition-colors uppercase tracking-[0.3em] font-bold text-xs hover:text-white" 
           style="font-family: var(--nav-font), sans-serif; font-weight: var(--nav-weight); color: var(--nav-text-color);">
            ${item.label}
        </a>
    `).join('');
}

/* Function that gets the safe Slug for a user */
const getSafeSlug = async (user) => {
    // 1. Session Storage Trace (Keep this, it's efficient)
    let cachedStr = sessionStorage.getItem('currentUser');
    if (cachedStr) {
        let cached = JSON.parse(cachedStr);
        if (cached?.slug) return cached.slug;
    }

    console.log("showroom.js: getSafeSlug: Fetching via SDK for UID:", user.uid);
    
    try {
        // --- THE CHANGE IS HERE ---
        // Use the Firebase SDK instead of fetch()
        // Ensure 'get', 'ref', and 'db' are accessible (usually from firebase-config.js)
        const snapshot = await get(ref(db, `users/${user.uid}/profile`));
        
        if (snapshot.exists()) {
            const profile = snapshot.val();
            console.log("getSafeSlug: Profile retrieved:", profile);
            
            if (profile?.slug) {
                sessionStorage.setItem('currentUser', JSON.stringify(profile));
                return profile.slug;
            }
        } else {
            console.warn("getSafeSlug: No profile found in DB for this UID.");
        }
    } catch (error) {
        console.error("getSafeSlug: SDK Error:", error);
    }

    // 3. Fallback to UID (Only if SDK fails or slug is missing)
    console.warn("showroom.js: getSafeSlug: Couldn't find the slug so Falling back to UID.");
    return user.uid; 
};

async function renderAuthStatus(user, authData) {
    const authZone = document.getElementById('auth-zone');
    if (!authZone || !authData) return;

    authZone.innerHTML = '';

    if (user) {
        // 1. CALCULATE CORRECT SLUG FOR LOGGED IN BUTTON
        const isSuperuser = user.email === 'yertalcorp@gmail.com';
        const cachedProfile = JSON.parse(sessionStorage.getItem('currentUser'));
        // This line stops the ReferenceError by defining 'finalSlug' properly
        const finalSlug = isSuperuser ? 'yertal-arcade' : await getSafeSlug(user);

        console.log('--- Debugging Slug Resolution ---');
        console.log("The resolved slug is:", finalSlug);        
        
    /* LOGGED IN VIEW */
        authZone.innerHTML = `
            <div class="flex items-center justify-center gap-6 bg-black/20 backdrop-blur-md border border-white/10 p-1.5 rounded-full" 
                 style="animation: fadeIn 0.8s ease-out forwards;">
                
                <button onclick="window.location.href='./arcade/index.html?user=${finalSlug}'" 
                        class="auth-trigger-btn"
                        style="color: var(--neon-color); border-color: var(--neon-color); background: color-mix(in srgb, var(--neon-color), transparent 90%);"
                        onmouseover="this.style.transform='translateY(-3px)'; this.style.boxShadow='0 10px 20px -5px var(--neon-color), 0 0 15px var(--neon-color)'; this.style.background='color-mix(in srgb, var(--neon-color), transparent 75%)'"
                        onmouseout="this.style.transform='translateY(0px)'; this.style.boxShadow='none'; this.style.background='color-mix(in srgb, var(--neon-color), transparent 90%)'"
                >
                    <span style="font-size: 11px; font-weight: 900; letter-spacing: 0.2em; text-align: center; text-transform: uppercase; pointer-events: none;">
                        ${authData.entry_label.toUpperCase()}
                    </span>
                </button>

                <div class="flex items-center gap-4 pr-2">
                    <div class="flex flex-col items-center leading-tight">
                        <span class="text-[9px] text-white/50 font-bold uppercase tracking-widest text-center">
                            ${cachedProfile?.display_name || user.displayName || user.email || 'AUTHORIZED USER'}
                        </span>
                        <div style="display: flex; align-items: center; justify-content: center; gap: 6px;">
                            <div style="
                                width: 4px; 
                                height: 4px; 
                                border-radius: 50%; 
                                background-color: var(--neon-color); 
                                animation: neon-glow-pulse 2s infinite ease-in-out;
                                box-shadow: 0 0 5px var(--neon-color);">
                            </div>
                            
                            <span class="text-[9px] text-[var(--neon-color)] font-mono uppercase tracking-tighter text-center">
                                System Active
                            </span>
                        </div>
                    </div>
                    
                    <img src="${user.photoURL || ''}" class="w-9 h-9 rounded-full border border-white/20 grayscale hover:grayscale-0 transition-all duration-500">
                    
                    <button onclick="window.handleLogout()" 
                            class="auth-trigger-btn"
                            style="background: #94a3b8; border-color: #334155; color: #000; min-width: 130px; margin-left: 8px;"
                            onmouseover="this.style.backgroundColor='#ef4444'; this.style.borderColor='#ef4444'; this.style.transform='translateY(-2px)';"
                            onmouseout="this.style.backgroundColor='#94a3b8'; this.style.borderColor='#334155'; this.style.transform='translateY(0px)';"
                    > 
                        <span style="font-size: 10px; font-weight: 900; letter-spacing: 0.15em; text-transform: uppercase; pointer-events: none;">
                            Disconnect
                        </span>
                    </button>
                </div>
            </div>`;
    } else {
    /* SIGN IN BUTTON VIEW */
        authZone.innerHTML = `
            <button onclick="window.openAuthHUD('personal')" 
                    class="auth-trigger-btn group px-5 py-2 flex items-center justify-center w-full"
                    style="color: var(--neon-color); border: 1px solid var(--neon-color); box-shadow: 0 0 15px var(--neon-color); display: flex; justify-content: center; align-items: center;">
                <div class="flex items-center justify-center">
                    <div class="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse mr-2"></div>
                    <span class="text-[14px] font-black uppercase tracking-[0.2em] text-center">
                        ${authData.signin_label.toUpperCase()}
                    </span>
                </div>
            </button>`;
    }
}

watchAuthState(async (newUser) => {
    user = newUser;

    // --- ENTRY LOGS ---
    console.log("%c [AUTH] STATE CHANGE DETECTED ", "background: #222; color: #bada55; padding: 2px 5px;");
    console.log("User Object:", newUser);
    
    if (user && currentAuth && currentUi) {
        try {
            let currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
            
            // Only fetch from DB if session is empty or user has changed
            if (!currentUser || currentUser.uid !== user.uid) {
                // Generate the ID token to authenticate the REST request
                const idToken = await user.getIdToken();
                const profileUrl = `${firebaseConfig.databaseURL}/users/${user.uid}/profile.json?auth=${idToken}`;

                const response = await fetch(profileUrl);
                let profile = await response.json();

                if (!profile) {
                    // CASE 1: Brand New User
                    // LOG: Profile not detected, initiating creation
                    console.log("%c [SYSTEM] PROFILE NOT DETECTED | CREATING NEW ENTRY ", "color: #f6ad55;");

                    const generatedSlug = (user.displayName || user.uid).toLowerCase().replace(/\s+/g, '-');
                    profile = {
                        display_name: user.displayName,
                        slug: generatedSlug,
                        arcade_logo: currentUi['default-logo'],
                        plan_type: 'free',
                        email: user.email,
                        photoURL: user.photoURL
                    };
                    
                    await fetch(profileUrl, {
                        method: 'PUT',
                        body: JSON.stringify(profile)
                    });
                    console.log("%c [SYSTEM] NEW PROFILE CREATED ", "color: #00f2ff;");
                } else {
                    // CASE 2: Existing Profile - Update missing or changed Email/Photo
                    const updates = {};
                    
                    // Check if email is missing or has changed
                    if (!profile.email || (user.email && profile.email !== user.email)) {
                        updates.email = user.email;
                    }
                    
                    // Check if photoURL is missing or has changed
                    if (!profile.photoURL || (user.photoURL && profile.photoURL !== user.photoURL)) {
                        updates.photoURL = user.photoURL;
                    }

                    // Only send a PATCH request if there is actually something to update
                    if (Object.keys(updates).length > 0) {
                        console.log("%c [SYSTEM] SYNCING PROFILE ATTRIBUTES ", "color: #f6ad55;", updates);
                        
                        await fetch(profileUrl, {
                            method: 'PATCH',
                            body: JSON.stringify(updates)
                        });

                        // Sync the local profile object so sessionStorage is up to date
                        profile = { ...profile, ...updates };
                    }
                }

                currentUser = profile;
                // Add the UID to the object before storing in session for consistency
                currentUser.uid = user.uid; 
                sessionStorage.setItem('currentUser', JSON.stringify(currentUser));
            }

            // UI is updated using the guaranteed data
            renderAuthStatus(user, currentAuth);
            console.log("%c [SYSTEM] USER RECOGNIZED | UI UPDATED ", "color: #00f2ff;");

        } catch (error) {
            console.error("USER_RETRIEVAL_ERROR:", error);
        }
    }
});

async function renderHero(user, hero) {
    const el = document.getElementById('hero-container');
    if (!el) return;
    // Calculate action based on the global user variable
    let ctaLink = "window.openAuthHUD('personal')";
    let heroBtnTxt = hero.primary_button.create_text;
    
    if (user) {
        const isSuperuser = user.email === 'yertalcorp@gmail.com';
        const finalSlug = isSuperuser ? 'yertal-arcade' : await getSafeSlug(user);
        ctaLink = `window.location.href='./arcade/index.html?user=${finalSlug}'`;
        heroBtnTxt = hero.primary_button.entry_text;
    }

    console.log(`The final ctaLink is ${ctaLink} and the final hero button text is ${heroBtnTxt}.`);
    el.innerHTML = `
        <div class="realms-hero-container text-center animate-fadeIn max-w-4xl">
            <h2 class="realms-hero-title">
                ${hero.main_headline}
            </h2>
            
            <div class="realms-hero-subtitle-wrapper">
                <p class="realms-hero-subtitle">
                    ${hero.subheadline}
                </p>
            </div>
            
            <div class="flex flex-col sm:flex-row gap-4 justify-center items-center realms-hero-btn-row">
                <button id="hero-primary-btn" data-link="${ctaLink}" onclick="${ctaLink}" class="realms-surreal-3d-btn">
                    <div class="realms-inner-content">
                        <i class="fas fa-power-off"></i>
                        <span>${heroBtnTxt}</span>
                        <i class="fas fa-microchip"></i>
                    </div>
                </button>
            </div>
            
            <div class="realms-hero-secondary-wrapper">
                <a href="${hero.secondary_button.link}" class="realms-hero-cta-secondary text-xs uppercase tracking-[0.3em] py-4 px-8">
                    ${hero.secondary_button.text}
                </a>
            </div>
        </div>
    `;
    initTiltEngine();
}
function initTiltEngine() {
    const btn = document.getElementById('hero-primary-btn');
    if (!btn) return;

    document.addEventListener('mousemove', (e) => {
        const rect = btn.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        btn.style.transform = `rotateX(${-y / 8}deg) rotateY(${x / 12}deg)`;
    });
}

function renderFeaturedRealms(items) {
    const headerEl = document.getElementById('featured-realms-header');
    
    if (headerEl) {
        headerEl.innerHTML = `
            <h2 class="text-3xl lg:text-4xl font-black uppercase tracking-tight text-white mb-2">Featured Ecosystems</h2>
            <p class="text-sm text-slate-400 font-light tracking-wide max-w-xl">Live prototype worlds engineered from core physics engines, procedural media frameworks, and structural systems.</p>
        `;
    }
    const el = document.getElementById('showcase-grid');
    if (!el || !Array.isArray(items)) return;
    el.innerHTML = items.map(item => `
        <div class="featured-card metallic-bezel pt-8 pb-2 rounded-[2rem] cursor-pointer aspect-video relative overflow-hidden group flex-1 min-w-[300px]"
             onclick="window.location.href='./arcade/index.html?user=${item.realm_slug}'"
             onmouseenter="const v=this.querySelector('video'); if(v && v.style.display !== 'none') { v.play().catch(err => console.warn('Video playback intercepted:', err.message)); }"
             onmouseleave="const v=this.querySelector('video'); if(v && v.style.display !== 'none') { v.pause(); v.currentTime=0; }">
            
            <!-- Layer 1 (Bottom): Static Image (Visible by default, vanishes completely on hover) -->
            <div id="fallback-img-${item.realm_id || item.realm_slug}" class="absolute inset-0 bg-cover bg-center transition-opacity duration-500 opacity-100 group-hover:opacity-0 rounded-[2rem]" style="background-image: url('${item.realm_image}')"></div>
            
            <!-- Layer 2: Video playing edge-to-edge (Forced geometric container matching layout rules) -->
            ${item.realm_animation_preview ? `<video src="${item.realm_animation_preview}" loop muted playsinline onerror="this.style.display='none'; console.warn('Media playback error.');" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: fill; margin: 0; padding: 0;" class="opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-[2rem] pointer-events-none z-0"></video>` : ''}
            
            <!-- Layer 3: Glass Tint Overlay -->            
            <div class="absolute inset-0 bg-slate-950/30 backdrop-blur-[1px] group-hover:bg-transparent transition-all duration-500 rounded-[2rem] z-10"></div>
            <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-80 rounded-[2rem] z-10"></div>
            
            
            <div class="relative z-20 flex flex-col h-full justify-between">
                <div class="flex justify-between items-start">
                    <span class="text-[10px] font-bold tracking-widest uppercase" style="color: var(--accent-color);">REALM PROTOCOL</span>
                    <i class="fas fa-rocket text-blue-500 text-2xl"></i>
                </div>
                <div>
                    <h3 class="uppercase tracking-tighter text-white text-xl">${item.realm_title}</h3>
                    <p class="text-xs text-slate-400 mt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300 max-w-sm">${item.realm_description}</p>
                    <span class="neon-text-sync block mt-2 text-[9px] font-bold tracking-[0.2em]" style="color: var(--neon-color);">${item.button_text} →</span>
                </div>
            </div>
        </div>
    `).join('');
}

// Global configuration constant for trending sparks marquee
const MAX_TRENDING_SPARK_CARDS = 50;

async function renderTrendingSparks(headerData) {
    const headerEl = document.getElementById('trending-sparks-header');
    if (headerEl) {
        headerEl.innerHTML = `
            <div>
                <h2 class="text-3xl font-bold uppercase tracking-tight text-white">${headerData?.title || 'Trending Sparks'}</h2>
                ${headerData?.subtitle ? `<p class="text-sm text-slate-400 font-light tracking-wide mt-2 max-w-xl">${headerData.subtitle}</p>` : ''}
            </div>
        `;
    }

    const gridEl = document.getElementById('trending-sparks-grid');
    if (!gridEl) return;

    try {
        const snapshot = await get(ref(db, 'analytics/trending_sparks')).catch(() => null);
        const data = snapshot?.val() || {};

        // Debug log to verify Firebase payload size
        console.log("Firebase raw keys count:", Object.keys(data).length);

        const sparks = Object.values(data)
            .sort((a, b) => (b.view_count || 0) - (a.view_count || 0))
            .slice(0, MAX_TRENDING_SPARK_CARDS);

        // Log the list of spark IDs retrieved and sorted
        console.log("Retrieved Spark IDs:", sparks.map(s => s.spark_id || s.current_id));
        
        if (sparks.length === 0) {
            gridEl.innerHTML = `<div class="text-slate-500 text-xs font-mono uppercase tracking-widest col-span-full">No active trending sparks detected</div>`;
            return;
        }

        const buildCard = (spark) => {
            const ownerSlug = spark.user_slug || 'yertal-arcade';
            let imgUrl = spark.spark_image || spark.image_url || spark.image || '';

            // Escape double quotes in data URIs or image URLs to prevent HTML attribute breakage
            if (imgUrl.includes('"')) {
                imgUrl = imgUrl.replace(/"/g, '&quot;');
            }

            const bgStyle = imgUrl ? `style="background-image: url('${imgUrl}');"` : '';
            const views = spark.view_count || 0;
            const sparkId = spark.spark_id || '';
            const currentId = spark.current_id || '';

            return `
                <div class="ticker-card-wrapper flex flex-col items-center gap-1 shrink-0">
                    <span class="text-[10px] font-mono font-bold tracking-widest text-slate-400 uppercase truncate max-w-[220px]">
                        @${ownerSlug}
                    </span>

                    <a href="https://yertal.in/arcade/spark.html?user=${ownerSlug}&current=${currentId}&spark=${sparkId}" 
                       class="glass-card metallic-bezel ticker-spark-card relative group overflow-hidden flex flex-col justify-between p-3 text-left"
                       ${bgStyle}>
                        <div class="absolute inset-0 bg-slate-950/20 backdrop-blur-[1px] group-hover:bg-transparent transition-all duration-300 rounded-[1rem]"></div>
                        <div class="relative z-10 flex justify-between items-center w-full">
                            <span class="text-[9px] font-mono tracking-widest text-slate-300 uppercase">// SPARK</span>
                            <i class="fas fa-bolt text-[11px]" style="color: var(--neon-color);"></i>
                        </div>
                        <div class="relative z-10 text-right">
                            <span class="text-[9px] font-black uppercase tracking-wider block" style="color: var(--neon-color);">REMIX →</span>
                        </div>
                    </a>

                    <span class="text-[9px] font-mono font-semibold tracking-wider text-slate-500 uppercase">
                        ${views.toLocaleString()} VIEWS
                    </span>
                </div>
            `;
        };

        // Render card markup
        let trackMarkup = sparks.map(buildCard).join('');

        // Removed stray backtick above this line
        if (sparks.length > 0 && sparks.length < MAX_TRENDING_SPARK_CARDS) {
            const repetitions = Math.ceil(MAX_TRENDING_SPARK_CARDS / sparks.length);
            trackMarkup = Array(repetitions).fill(trackMarkup).join('');
        }

        gridEl.className = 'w-full min-w-full overflow-hidden flex';
        gridEl.innerHTML = `
            <div class="marquee-track flex gap-6 min-w-max">
                ${trackMarkup}
                ${trackMarkup}
            </div>
        `;

        // Check if query limits exist on Firebase ref elsewhere
    } catch (err) {
        console.error("Error rendering trending sparks ticker:", err);
    }
}

function renderTemplates(items) {
    const headerEl = document.getElementById('templates-header');
    if (headerEl) {
        headerEl.innerHTML = `
            <h3 class="text-xs uppercase tracking-[0.5em] text-slate-500 mb-2">// ZERO COLD START</h3>
            <h2 class="text-3xl font-bold uppercase tracking-tight text-white">Start With A Template</h2>
        `;
    }
    const el = document.getElementById('templates-grid');
    if (!el || !items) return;
    el.innerHTML = items.map(t => `
        <div class="glass-card metallic-bezel p-6 flex flex-col items-center justify-center text-center cursor-pointer group hover:scale-[1.02] transition-transform">
            <i class="${t.icon} text-2xl mb-4" style="color: var(--neon-color);"></i>
            <span class="text-xs uppercase font-bold tracking-widest text-white">${t.type}</span>
        </div>
    `).join('');
}

function renderLearnToBuild(data) {
    const headerEl = document.getElementById('learn-header');
    if (headerEl) {
        headerEl.innerHTML = `
            <h3 class="text-xs uppercase tracking-[0.5em] text-slate-500 mb-2">// INTELLECTUAL CURRICULUM</h3>
            <h2 class="text-2xl font-bold uppercase tracking-tight text-white">${data.section_title || 'Learn to Build Realms'}</h2>
        `;
    }
    const el = document.getElementById('action-grid');
    if (!el || !data.modules) return;
    el.innerHTML = data.modules.map(m => `
        <div class="glass-card action-card p-8 flex flex-col h-full group cursor-pointer relative overflow-hidden" onclick="window.open('${m.link}', '_blank')">
            <div class="flex items-center justify-center"><i class="${m.icon} text-3xl" style="color: var(--neon-color);"></i></div>
            <h3 class="mt-8 mb-1 uppercase tracking-tighter text-white text-xl">${m.title}</h3>
            <span class="text-[9px] font-bold uppercase tracking-widest mt-4" style="color: var(--accent-color);">${data.cta_label || 'LEARN HOW REALMS ARE BUILT'} →</span>
        </div>
    `).join('');
}

function renderCommunity(data) {
    const el = document.getElementById('community-insight-container');
    if (!el) return;
    
    // Add the structural wrapper styling hooks dynamically here
    el.className = "mb-24 text-center py-12 glass-card metallic-bezel max-w-4xl mx-auto";
    
    el.innerHTML = `
        <h3 class="text-xs uppercase tracking-[0.4em] text-slate-400 mb-4">${data.optional_tagline.toUpperCase()}</h3>
        <p class="text-sm uppercase tracking-[0.2em] text-slate-500">${data.insights.join(' &bull; ')}</p>
    `;
}

function renderFinalCTA(cta) {
    const el = document.getElementById('final-cta-container');
    if (!el) return;
    el.innerHTML = `
        <h2 class="text-4xl lg:text-6xl font-black uppercase tracking-tight text-white mb-8">${cta.headline}</h2>
        <div class="flex flex-col sm:flex-row gap-4 justify-center">
            <button onclick="window.openAuthHUD('superuser')" class="glass-card metallic-bezel text-xs py-4 px-10 uppercase tracking-[0.3em] text-white font-bold">${cta.primary_btn.text}</button>
            <button class="text-xs py-4 px-10 uppercase tracking-[0.3em] text-slate-400 hover:text-white transition-all">${cta.secondary_btn.text}</button>
        </div>
    `;
}

function renderFooter(footer) {
    const el = document.getElementById('footer-container');
    if (!el || !footer.legal_links) return;
    el.innerHTML = `
        <div class="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
            <div class="flex flex-wrap gap-6 text-xs text-slate-400">
                ${footer.legal_links.map(l => `<button onclick="window.open('${l.url}', '_blank')" class="hover:text-white transition">${l.label}</button>`).join('')}
            </div>
            <div class="text-[10px] text-slate-500 uppercase tracking-widest">© 2026 YERTAL CORPORATION &bull; LAB PARADIGM</div>
        </div>
    `;
}

function initHeartbeatAnimation(targetContainer) {
    const container = targetContainer || document.getElementById('visual-flow-container');
    if (!container) return;

    if (document.getElementById('heartbeat-canvas')) return;

    const canvas = document.createElement('canvas');
    canvas.id = 'heartbeat-canvas';
    canvas.width = 1200;
    canvas.height = 80;
    canvas.style.display = 'block';
    canvas.style.maxWidth = '100%';
    canvas.style.height = 'auto';
    // Increased bottom margin from -10px to 12px to add a clean gap above "HOW REALMS WORK"
    canvas.style.margin = '0 auto 12px auto'; 

    container.insertBefore(canvas, container.firstChild);

    const ctx = canvas.getContext('2d');
    const glitchSound = new Audio('assets/audio/glitch-spark.mp3'); 
    glitchSound.volume = 0.3;

    let points = [];
    const maxPoints = 100;
    let xStep = canvas.width / maxPoints;
    let frame = 0;

    let activeSparks = [];

    for (let i = 0; i < maxPoints; i++) {
        points.push(canvas.height / 2);
    }

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        frame++;

        const centerY = canvas.height / 2;
        const maxAmplitude = (canvas.height / 2) - 8; 
        let nextY = centerY;
        
        // --- HYPER-ACTIVE HEARTBEAT GENERATOR ---
        // Shortened cycle from 70 to 35 frames for highly frequent, aggressive mountain peaks
        const cycle = frame % 35; if (cycle > 5 && cycle < 18) {
            let localFrame = cycle - 5;
            // Varies peak heights dynamically across cycles so they stay sharp but unique
            const heightVariant = (Math.floor(frame / 35) % 3 === 0) ? 1.0 : (Math.floor(frame / 35) % 3 === 1 ? 0.75 : 0.55);
            
            // Precise single-frame updates form razor-sharp angles instead of plateaus
            if (localFrame === 1) {
                nextY = centerY + (10 * heightVariant); // Quick dip (Q wave)
            } else if (localFrame === 3) {
                nextY = centerY - (maxAmplitude * heightVariant); // Extreme sharp peak (R wave)
                
                // Trigger glitch sound and sparks on high peaks
                if (heightVariant >= 0.75) {
                    triggerSparkVisual(canvas.width - xStep * 2, nextY);
                    glitchSound.currentTime = 0;
                    glitchSound.play().catch(() => {});
                }
            } else if (localFrame === 5) {
                nextY = centerY + (maxAmplitude * 0.9 * heightVariant); // Deep sharp plunge (S wave)
            } else if (localFrame === 8) {
                nextY = centerY - (14 * heightVariant); // Secondary recovery bump (T wave)
            }
        } else {
            nextY += (Math.sin(frame * 0.6) * 1.5) + ((Math.random() - 0.5) * 2);
        }

        if (nextY < 6) nextY = 6;
        if (nextY > canvas.height - 6) nextY = canvas.height - 6;

        points.shift();
        points.push(nextY);

        // --- RENDER DUAL-PASS YELLOW LIGHT RAY GLOW ---
        // Pass 1: Soft wide yellow ray neon glow blur background
        ctx.beginPath();
        ctx.strokeStyle = '#ffe600';
        ctx.lineWidth = 4;
        ctx.shadowBlur = 14;
        ctx.shadowColor = '#ffcc00';
        for (let i = 0; i < points.length; i++) {
            let x = i * xStep;
            if (i === 0) ctx.moveTo(x, points[i]);
            else ctx.lineTo(x, points[i]);
        }
        ctx.stroke();

        // Pass 2: Hyper-bright electric white-yellow core line
        ctx.beginPath();
        ctx.strokeStyle = '#fffdec';
        ctx.lineWidth = 2;
        ctx.shadowBlur = 4;
        ctx.shadowColor = '#fff';

        for (let i = 0; i < points.length; i++) {
            let x = i * xStep;
            if (i === 0) ctx.moveTo(x, points[i]);
            else ctx.lineTo(x, points[i]);
        }
        ctx.stroke();

        ctx.shadowBlur = 4;
        activeSparks = activeSparks.filter(spark => {
            spark.x -= xStep; 
            spark.y += spark.vy;
            spark.vx *= 0.98;
            spark.x += spark.vx;
            spark.life -= 0.04;

            if (spark.life > 0) {
                ctx.fillStyle = `rgba(255, 253, 236, ${spark.life})`; 
                ctx.strokeStyle = `rgba(255, 215, 0, ${spark.life * 0.7})`; 
                ctx.beginPath();
                ctx.arc(spark.x, spark.y, spark.size, 0, Math.PI * 2);
                ctx.fill();
                if (Math.random() > 0.4) ctx.stroke();
                return true;
            }
            return false;
        });

        requestAnimationFrame(animate);
    }

    function triggerSparkVisual(x, y) {
        ctx.fillStyle = '#fffdec';
        ctx.fillRect(x - 4, y - 4, 8, 8);
        
        for (let i = 0; i < 12; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 1 + Math.random() * 4;
            activeSparks.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: (Math.sin(angle) * speed) + 0.5, 
                size: 1 + Math.random() * 2,
                life: 1.0
            });
        }
    }

    animate();
}

function initNeuralNetworkSimulation(customNodes, uniformShape) {
    const canvas = document.getElementById('neural-nodes-canvas');
    if (!canvas) {
        console.log("❌ [Neural-Flow]: Canvas element not found in DOM.");
        return;
    }

    function resizeCanvas() {
        const rect = canvas.parentNode.getBoundingClientRect();
        canvas.width = rect.width;
        // Reliably snaps to the explicit 480px structural boundary established by the custom class wrapper
        canvas.height = rect.height || 480;
        
        /*console.log("📐 [Neural-Flow] Parent Container Rect:", { width: rect.width, height: rect.height });*/
        /*console.log("🎨 [Neural-Flow] Canvas Drawing Size Set To:", { width: canvas.width, height: canvas.height });*/
    }

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas, { passive: true });

    const ctx = canvas.getContext('2d');

    const nodes = customNodes.map(node => {
        const mappedY = node.y_pct * 0.84 + 0.08;;
        /*console.log(`📍 [Neural-Flow] Node Mapping (${node.label || 'Unnamed'}):`, { originalX: node.x_pct, originalY: node.y_pct, mappedY: mappedY });*/
        return {
            id: node.id,
            x_pct: node.x_pct,
            y_pct: mappedY,
            label: node.label,
            shape: uniformShape,
            color: node.color || '#00f2ff',
            pulse: Math.random() * Math.PI,
            glowIntensity: 0
        };
    });

    let particles = [];
    let activePulseIndex = 0;
    let pulseProgress = 0;

    const NODE_RADIUS = 105;

    function drawNodeShape(x, y, radius, shape) {
        ctx.beginPath();
        if (shape === 'diamond') {
            ctx.moveTo(x, y - radius);
            ctx.lineTo(x + radius, y);
            ctx.lineTo(x, y + radius);
            ctx.lineTo(x - radius, y);
            ctx.closePath();
        } else if (shape === 'hexagon') {
            for (let i = 0; i < 6; i++) {
                ctx.lineTo(x + radius * Math.cos(i * Math.PI / 3), y + radius * Math.sin(i * Math.PI / 3));
            }
            ctx.closePath();
        } else if (shape === 'octagon') {
            for (let i = 0; i < 8; i++) {
                ctx.lineTo(x + radius * Math.cos(i * Math.PI / 4), y + radius * Math.sin(i * Math.PI / 4));
            }
            ctx.closePath();
        } else {
            ctx.arc(x, y, radius, 0, Math.PI * 2);
        }
    }

    function drawSimulation() {
        // Corrected target check to match the active canvas ID container context
        if (!document.getElementById('neural-nodes-canvas')) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        pulseProgress += 0.025;
        if (pulseProgress >= 1) {
            pulseProgress = 0;
            activePulseIndex = (activePulseIndex + 1) % nodes.length;
            nodes[activePulseIndex].glowIntensity = 1.0;
        }

        // Dynamically compute lines based on current parent box widths
        for (let i = 0; i < nodes.length; i++) {
            const start = nodes[i];
            const end = nodes[(i + 1) % nodes.length];

            const startX = canvas.width * start.x_pct;
            const startY = canvas.height * start.y_pct;
            const endX = canvas.width * end.x_pct;
            const endY = canvas.height * end.y_pct;

            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            if (i === activePulseIndex) {
                let currentX = startX + (endX - startX) * pulseProgress;
                let currentY = startY + (endY - startY) * pulseProgress;

                ctx.beginPath();
                ctx.arc(currentX, currentY, 5, 0, Math.PI * 2);
                ctx.fillStyle = '#ffffff';
                ctx.strokeStyle = start.color;
                ctx.lineWidth = 2;
                ctx.shadowBlur = 12;
                ctx.shadowColor = start.color;
                ctx.fill();
                ctx.stroke();
                ctx.shadowBlur = 0;
            }
        }

        // Dynamically compute circle shapes and node titles
        nodes.forEach((node) => {
            node.glowIntensity *= 0.95;
            
            const nodeX = canvas.width * node.x_pct;
            const nodeY = canvas.height * node.y_pct;

            ctx.fillStyle = 'rgba(5, 5, 5, 0.85)';
            drawNodeShape(nodeX, nodeY, NODE_RADIUS, node.shape);
            ctx.fill();

            const currentGlow = node.glowIntensity;
            if (currentGlow > 0.05) {
                ctx.lineWidth = 3;
                ctx.strokeStyle = node.color;
                ctx.shadowBlur = 20 * currentGlow;
                ctx.shadowColor = node.color;
            } else {
                ctx.lineWidth = 1.5;
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
            }
            ctx.stroke();
            ctx.shadowBlur = 0;

            ctx.font = 'bold 25px monospace';
            ctx.fillStyle = currentGlow > 0.3 ? '#ffffff' : 'rgba(255, 255, 255, 0.85)';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(node.label, nodeX, nodeY);

            if (currentGlow > 0.5 && Math.random() > 0.3) {
                particles.push({
                    x: nodeX,
                    y: nodeY,
                    vx: (Math.random() - 0.5) * 2,
                    vy: (Math.random() - 0.5) * 2,
                    size: Math.random() * 2 + 1,
                    alpha: 1.0,
                    color: node.color
                });
            }
        });

        particles = particles.filter(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.alpha -= 0.02;

            if (p.alpha > 0) {
                ctx.fillStyle = p.color;
                ctx.globalAlpha = p.alpha;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
                return true;
            }
            return false;
        });
        ctx.globalAlpha = 1.0;

        requestAnimationFrame(drawSimulation);
    }

    drawSimulation();
}

window.switchRealmStep = function(index) {
    const steps = window.realmStepsData;
    if (!steps || !steps[index]) return;

    const currentStep = steps[index];

    steps.forEach((_, i) => {
        const btn = document.getElementById(`realm-step-btn-${i}`);
        if (btn) {
            if (i === index) {
                // Made the active border and neon glow significantly more prominent
                btn.style.border = '2px solid var(--neon-color, #00f2ff)';
                btn.style.boxShadow = '0 0 30px rgba(0, 242, 255, 0.65), inset 0 0 15px rgba(0, 242, 255, 0.3)';
            } else {
                btn.style.border = '1px solid rgba(255, 255, 255, 0.2)';
                btn.style.boxShadow = 'none';
            }
        }
    });

    const titleEl = document.getElementById('realm-step-title');
    const descEl = document.getElementById('realm-step-desc');
    const displayEl = document.getElementById('realm-visual-display');

    if (titleEl) {
        titleEl.innerText = currentStep.label;
        // Applied the decorative metallic text classification
        titleEl.className = 'text-3xl font-extrabold uppercase tracking-widest mb-1 metallic-text-header';
    }
    if (descEl) descEl.innerText = currentStep.description;

    if (displayEl) {
        let phaseHUD = document.getElementById('realm-step-phase');
        let layerHUD = document.getElementById('realm-step-layer');

        // If the overlay elements don't exist yet, construct them safely
        if (!phaseHUD) {
            displayEl.insertAdjacentHTML('beforeend', `
                <!-- Shifted text to top center using transform percentages to keep it unbeatably aligned -->
                <div id="realm-step-phase" class="absolute top-4 left-1/2 -translate-x-1/2 text-[14px] font-mono uppercase tracking-[0.4em] font-black z-20 text-center" style="color: var(--neon-color, #00f2ff); filter: drop-shadow(0 0 8px var(--neon-color, #00f2ff));"></div>
                <div id="realm-step-layer" style="display: none;"></div>
            `);
            phaseHUD = document.getElementById('realm-step-phase');
            layerHUD = document.getElementById('realm-step-layer');
        }

        phaseHUD.innerText = `PHASE ${currentStep.id}`;
        // Cleared secondary text tracking entirely to clear any possibility of canvas clutter
        layerHUD.innerText = '';
        
        initNeuralNetworkSimulation(currentStep.nodes || [], currentStep.shape || 'circle');
    }        
}

function renderHowRealmsWork(data) {
    const el = document.getElementById('visual-flow-container');
    if (!el || !data.steps) return;
    el.innerHTML = ''; 
    
    window.realmStepsData = data.steps;

el.insertAdjacentHTML('beforeend', `
    <div class="max-w-7xl mx-auto px-6 inner-flow-wrapper flex flex-col h-full">
        <h2 class="text-3xl font-extrabold text-white uppercase tracking-widest mb-2 text-glow">${data.title || 'HOW REALMS WORK'}</h2>
        
        <p class="text-slate-400 text-lg font-mono tracking-wider uppercase max-w-3xl mx-auto opacity-80">${data.subtitle || 'From an open prompt to a global interactive destination.'}</p>
        
        <div class="grid grid-cols-4 gap-4 max-w-5xl mx-auto mt-6 mb-6 font-mono text-xs">
            ${data.steps.map((step, index) => `
                <div class="w-full flex items-center justify-center">
                    <button onclick="switchRealmStep(${index})" id="realm-step-btn-${index}" class="surreal-3d-btn w-full rounded-xl text-white transition-all duration-300 group relative">
                        <div class="inner-content flex flex-col items-center justify-center pointer-events-none">
                            <div class="text-[8px] tracking-[0.1em] text-cyan-400/60 mb-1 group-hover:text-cyan-400 font-bold transition-colors">PHASE ${step.id}</div>
                            <div class="font-extrabold tracking-normal uppercase text-[10px] text-center leading-tight px-2">${step.label}</div>
                        </div>
                    </button>
                </div>
            `).join('')}
        </div>
        
<!-- Reduced entire panel container layout envelope footprint width by 10% -->
<div id="realm-immersive-panel" class="featured-card metallic-bezel realm-immersive-panel-container max-w-5xl mx-auto p-minimal">
    
    <div id="realm-visual-display" class="realm-visual-display-canvas-frame p-minimal">
        <canvas id="neural-nodes-canvas" class="w-full h-full absolute inset-0"></canvas>
    </div>
            <!-- TEXT BOX: Transformed to an accent-tinted light dashboard backdrop with dark readable text -->
            <div class="text-left p-6 shrink-0 bg-cyan-400 text-black rounded-b-xl">
                <!-- Swapped white text for black to stand out on the new light dashboard layout -->
                <h3 id="realm-step-title" class="text-3xl font-black text-black uppercase tracking-widest mb-3"></h3>
                <!-- Introduced a slight margin-top (mt-2) and shifted typography colors to dark neutral black -->
                <p id="realm-step-desc" class="text-slate-900 mt-2 text-base font-mono leading-relaxed tracking-wider m-0"></p>
            </div>
        </div>
    </div>
`);
    initHeartbeatAnimation(el.querySelector('.inner-flow-wrapper'));

    if (typeof window.switchRealmStep === 'undefined') {
        initRealmFlowEngine();
    }
    window.switchRealmStep(0);
}

function initRealmFlowEngine() {
    window.switchRealmStep = function(index) {
        const steps = window.realmStepsData;
        if (!steps || !steps[index]) return;
        
        const currentStep = steps[index];
        
        // Update Step Buttons styling
// Update Step Buttons styling and handle 3D scaling transformations inside initRealmFlowEngine
        steps.forEach((_, i) => {
            const btn = document.getElementById(`realm-step-btn-${i}`);
            if (btn) {
                if (i === index) {
                    btn.style.transform = 'translateY(-4px) translateZ(15px)';
                    btn.style.boxShadow = '0 20px 40px rgba(0, 242, 255, 0.25), inset 0 0 12px rgba(255,255,255,0.2)';
                    btn.style.borderColor = 'rgba(0, 242, 255, 0.6)';
                } else {
                    btn.style.transform = 'scale(0.98) translateZ(0)';
                    btn.style.boxShadow = '0 10px 20px rgba(0,0,0,0.4)';
                    btn.style.borderColor = 'rgba(255, 255, 255, 0.05)';
                    btn.style.opacity = '0.6';
                }
            }
        });

        // Update Text Components
        document.getElementById('realm-step-phase').innerText = `PHASE 0${currentStep.id}`;
        document.getElementById('realm-step-title').innerText = currentStep.label;
        document.getElementById('realm-step-desc').innerText = currentStep.description;

        // Render specific hardware-accelerated simulated visuals inside the visual display container
        const visualDisplay = document.getElementById('realm-visual-display');
        if (!visualDisplay) return;

        // Clear timeouts or internal loops if any were attached previously
        if (window.realmVisualInterval) clearInterval(window.realmVisualInterval);

        if (index === 0) {
            // STEP 1: Simulate the Re-Forge Laboratory Identity HUD updating
            visualDisplay.innerHTML = `
                <div class="w-full max-w-sm rounded-lg border border-cyan-400/40 bg-slate-900/90 p-4 font-mono text-[10px] text-left shadow-[0_0_15px_rgba(0,242,255,0.1)]">
                    <div class="text-center text-cyan-400 border-b border-cyan-400/20 pb-2 mb-3 tracking-widest uppercase animate-pulse">RE-FORGE HUD SIMULATION</div>
                    <div class="mb-2">
                        <span class="text-cyan-400/70 block mb-1">■ REALM_NAME:</span>
                        <div id="sim-realm-name" class="bg-black/60 p-1.5 border border-white/5 rounded text-white h-6 flex items-center"></div>
                    </div>
                    <div class="mb-2">
                        <span class="text-cyan-400/70 block mb-1">■ INTERFACE_THEME:</span>
                        <div id="sim-realm-theme" class="bg-black/60 p-1.5 border border-white/5 rounded text-slate-400 h-6 flex items-center">DEFAULT DARK</div>
                    </div>
                    <div class="grid grid-cols-3 gap-1 mt-4 pt-2 border-t border-white/5 text-[8px] text-center opacity-40">
                        <div class="border border-white/10 p-1 rounded">BIZ_TIER</div>
                        <div id="sim-free-tier" class="border border-cyan-400/50 p-1 rounded text-cyan-400 bg-cyan-950/20 font-bold">FREE_TIER</div>
                        <div class="border border-white/10 p-1 rounded">PERS_TIER</div>
                    </div>
                </div>
            `;
            
            // Text Decoded simulation logic
            const nameTarget = "THE YERTAL ARCADE";
            let nameIdx = 0;
            window.realmVisualInterval = setInterval(() => {
                if (nameIdx <= nameTarget.length) {
                    document.getElementById('sim-realm-name').innerText = nameTarget.slice(0, nameIdx) + (nameIdx < nameTarget.length ? '█' : '');
                    nameIdx++;
                } else if (nameIdx === nameTarget.length + 1) {
                    // Trigger theme change effect
                    const themeEl = document.getElementById('sim-realm-theme');
                    if(themeEl) {
                        themeEl.innerText = "NEON DARK";
                        themeEl.classList.remove('text-slate-400');
                        themeEl.classList.add('text-cyan-400', 'font-bold');
                        document.getElementById('realm-immersive-panel').style.borderColor = 'rgba(0, 242, 255, 0.7)';
                    }
                    nameIdx++;
                } else {
                    clearInterval(window.realmVisualInterval);
                }
            }, 80);

        } else if (index === 1) {
            // STEP 2: Initialize a Current (Circuit Pipeline System Flow Animation)
            visualDisplay.innerHTML = `
                <div class="w-full flex flex-col items-center justify-center p-4">
                    <svg class="w-full max-w-[280px]" viewBox="0 0 200 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M20 50 H180" stroke="rgba(255,255,255,0.05)" stroke-width="4" stroke-linecap="round"/>
                        <path d="M20 50 H180" stroke="url(#pipeline-grad)" stroke-width="2" stroke-linecap="round" stroke-dasharray="10 150" class="animate-dash"/>
                        
                        <circle cx="20" cy="50" r="8" fill="#020617" stroke="#00f2ff" stroke-width="2"/>
                        <circle cx="100" cy="50" r="10" fill="#020617" stroke="#00f2ff" stroke-width="2" class="animate-pulse"/>
                        <circle cx="180" cy="50" r="8" fill="#020617" stroke="#00f2ff" stroke-width="2"/>
                        
                        <defs>
                            <linearGradient id="pipeline-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stop-color="#00f2ff" />
                                <stop offset="100%" stop-color="#7000ff" />
                            </linearGradient>
                        </defs>
                    </svg>
                    <div class="mt-4 font-mono text-[9px] text-cyan-400/60 tracking-[0.2em] uppercase animate-pulse">STREAMING DATA ARCHITECTURE PIPELINE</div>
                </div>
            `;
            document.getElementById('realm-immersive-panel').style.borderColor = 'rgba(0, 242, 255, 0.3)';

        } else if (index === 2) {
            // STEP 3: Add Sparks (Prompt Cache Bubble Simulation)
            visualDisplay.innerHTML = `
                <div class="w-full max-w-sm flex flex-col items-center justify-end min-h-[220px] relative">
                    <div id="spark-bubble-arena" class="absolute inset-0 w-full h-[150px] overflow-hidden pointer-events-none"></div>
                    
                    <div class="w-full bg-slate-900 border border-purple-500/30 rounded p-2 font-mono text-[10px] text-left text-purple-400 flex items-center shadow-[0_0_15px_rgba(112,0,255,0.1)] mt-auto z-10">
                        <span class="text-purple-500 mr-1.5">></span>
                        <div id="sim-prompt-input" class="text-white"></div>
                    </div>
                </div>
            `;
            document.getElementById('realm-immersive-panel').style.borderColor = 'rgba(112, 0, 255, 0.4)';

            const promptTarget = "/generate interactive voxel workspace";
            let promptIdx = 0;
            const arena = document.getElementById('spark-bubble-arena');
            const keywords = ['[Three.js]', '[Physics]', '[AudioContext]', '[VoxelEngine]', '[Cache_Match]'];

            window.realmVisualInterval = setInterval(() => {
                if (promptIdx <= promptTarget.length) {
                    document.getElementById('sim-prompt-input').innerText = promptTarget.slice(0, promptIdx) + '█';
                    
                    // Periodically spawn a cache spark bubble as characters register
                    if (promptIdx > 0 && promptIdx % 6 === 0 && arena) {
                        const kw = keywords[Math.floor(Math.random() * keywords.length)];
                        const bubble = document.createElement('div');
                        bubble.className = "absolute bg-purple-950/40 border border-purple-400/40 px-2 py-0.5 rounded-full text-[8px] font-mono text-purple-300 shadow-[0_0_8px_rgba(112,0,255,0.2)] animate-float-bubble";
                        bubble.style.left = `${15 + Math.random() * 70}%`;
                        bubble.style.bottom = `10px`;
                        bubble.innerText = kw;
                        arena.appendChild(bubble);
                        
                        // Self destroy bubble after floating animation finishes
                        setTimeout(() => bubble.remove(), 2500);
                    }
                    promptIdx++;
                } else {
                    document.getElementById('sim-prompt-input').innerText = promptTarget;
                    clearInterval(window.realmVisualInterval);
                }
            }, 70);
        }
    };
}

function renderAdminGate(ui) {
    const gate = document.getElementById('admin-gateway');
    const config = ui['admin-btn'];
    gate.innerHTML = `<a href="${config.link}" class="fixed bottom-4 right-4 w-3 h-3 block transition-opacity duration-500 hover:opacity-100" 
                        style="background:${config.color}; opacity:${config.opacity}; border-radius:${config.shape === 'circle' ? '50%' : '2px'};"></a>`;
}

window.toggleMobileMenu = () => {
    const menu = document.getElementById('mobile-menu');
    menu.classList.toggle('hidden');
    menu.classList.toggle('flex');
};

window.handleSignupFlow = async () => {
     const email = prompt("Enter your email to join the Lab:");
     const password = prompt("Create a password (min 6 chars):");
     if (email && password) {
         try { 
             await signup(email, password); 
             alert("Welcome to the Laboratory!");
         } catch(e) { alert(e.message); }
     }
};

/* Tag/Function: handleLogout */
window.handleLogout = async () => {
    try {
        const globalLogoutUrl = await logout();

        user = null;
        // Restoring your explicit request to clear everything
        localStorage.clear();
        sessionStorage.clear();

        if (globalLogoutUrl) {
            window.location.href = globalLogoutUrl;
        } else {
            window.location.replace('/');
        }
    } catch (error) {
        console.error("Global Logout Failed:", error);
    }
};

/* Tag/Function: handleAuth */
window.handleAuth = async (providerId, mode='personal') => {
 try {
 const result = await loginWithProvider(providerId);
 if (result) {
 window.closeAuthHUD();
 // The watchAuthState observer will now trigger and perform the redirect -> not really working.
// Manually trigger the redirect since the one-time observer in openAuthHUD is finished
window.openAuthHUD(mode);
 console.log("%c [AUTH] SUCCESS. HANDOVER TO OBSERVER.", "color: var(--neon-color)");
 }
 } catch (error) {
 console.error("Auth Bridge Error:", error);
 }
};
    
/* Tag/Function: openAuthHUD */
window.openAuthHUD = async (mode = 'personal') => {
  
  // 1. WAIT FOR FIREBASE
  const activeUser = await new Promise((resolve) => {
    const unsubscribe = watchAuthState((user) => {
        
        // Safety check: Only call if it's been defined
        if (typeof unsubscribe === 'function') {
            unsubscribe(); 
        }
          resolve(user);
        });
  });

  // 2. REDIRECT IF LOGGED IN
  if (activeUser) {
    if (mode === 'superuser') {
        window.location.href = `./arcade/index.html?user=yertal-arcade`;
    } else {
        try {
            const response = await fetch(`${firebaseConfig.databaseURL}/users/${activeUser.uid}/profile.json`);
            const profile = await response.json();
            const slug = profile?.slug || (activeUser.displayName || activeUser.uid).toLowerCase().replace(/\s+/g, '-');
            window.location.href = `./arcade/index.html?user=${slug}`;
        } catch (err) {
            const fallback = (activeUser.displayName || activeUser.uid).toLowerCase().replace(/\s+/g, '-');
            window.location.href = `./arcade/index.html?user=${fallback}`;
        }
    }
    return; 
  }

  // 3. INITIALIZE HUD ONLY IF NO USER
  const hud = document.getElementById('auth-hud');
  const list = document.getElementById('provider-list');

  if (!currentAuth) {
      setTimeout(() => window.openAuthHUD(mode), 100);
      return;
  }

  // Since user is not logged in, show the HUD
  if (hud && list) {
    hud.classList.add('active'); 
    list.innerHTML = currentAuth.enabled_providers.map(provider => `
      <button onclick="window.handleAuth('${provider.id}', '${mode}')" 
              class="group flex items-center justify-between w-full bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[var(--neon-color)] px-6 py-4 rounded-xl transition-all duration-300 cursor-pointer mb-4">
        <span class="uppercase tracking-[0.3em] text-[30px]" style="font-family: var(--nav-font); color: var(--nav-text-color);">
          SIGNIN WITH <span style="color: var(--neon-color); font-weight: bold;">${provider.id.toUpperCase()}</span> :
        </span>
        <i class="${provider.icon} text-5xl transition-all duration-500 group-hover:scale-110" 
           style="color: var(--neon-color); filter: drop-shadow(0 0 15px var(--neon-color));">
        </i>
      </button>
    `).join('');
  }
};

window.closeAuthHUD = () => {
  const hud = document.getElementById('auth-hud');
  if (hud) hud.classList.remove('active');
};
let audioCtx = null;
let droneNodes = [];

function initDreamscapeAudio() {
    if (audioCtx) return; // Prevent double initialization

    // Initialize the Web Audio context
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    
    // Master volume configuration with a soft fade-in layer
    const masterGain = audioCtx.createGain();
    masterGain.gain.setValueAtTime(0, audioCtx.currentTime);
    masterGain.gain.linearRampToValueAtTime(0.25, audioCtx.currentTime + 4.0); // Smooth 4-second fade
    masterGain.connect(audioCtx.destination);

    // Lowpass filter engine to block harsh frequencies and provide a deep "underwater" feel
    const lowpassFilter = audioCtx.createBiquadFilter();
    lowpassFilter.type = 'lowpass';
    lowpassFilter.frequency.setValueAtTime(320, audioCtx.currentTime);
    lowpassFilter.connect(masterGain);

    // Oscillator configuration builder
    const createDroneOsc = (frequency, detuneValue) => {
        const osc = audioCtx.createOscillator();
        const oscGain = audioCtx.createGain();

        osc.type = 'sawtooth'; osc.frequency.setValueAtTime(frequency, audioCtx.currentTime);
        osc.detune.setValueAtTime(detuneValue, audioCtx.currentTime);
        
        oscGain.gain.setValueAtTime(0.05, audioCtx.currentTime);
        
        // LFO (Low-Frequency Oscillator) to slowly sweep volume up and down over time
        const lfo = audioCtx.createOscillator();
        const lfoGain = audioCtx.createGain();
        lfo.type = 'sine';
        lfo.frequency.setValueAtTime(0.08, audioCtx.currentTime); // Super slow cycle
        lfoGain.gain.setValueAtTime(0.02, audioCtx.currentTime);
        
        lfo.connect(lfoGain);
        lfoGain.connect(oscGain.gain);

        osc.connect(oscGain);
        oscGain.connect(lowpassFilter);
        
        osc.start();
        lfo.start();
        
        droneNodes.push(osc, lfo);
    };

    // Generate layered harmonic chords (Deep base tones mimicking space environments)
    createDroneOsc(55.00, -8);  // A1 note, detuned flat
    createDroneOsc(55.00, 8);   // A1 note, detuned sharp
    createDroneOsc(110.00, -4); // A2 note, octave up helper
    createDroneOsc(165.00, 0);  // E3 note, a pure perfect fifth for atmospheric depth
}

// Attach a global event listener to spin up the sound array on the user's first natural click interaction
window.addEventListener('click', () => {
    if (typeof initDreamscapeAudio === 'function') {
        initDreamscapeAudio();
        // If audio context was suspended by browser security policy, resume it dynamically
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
    }
}, { once: true }); // { once: true } auto-unregisters the click listener immediately after execution

window.onload = initRealmsHome;
