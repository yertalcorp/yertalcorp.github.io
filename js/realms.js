import { firebaseConfig, ref, set, get, push, runTransaction, auth, db, update, app } from '/config/firebase-config.js';;

import { loginWithProvider, logout, watchAuthState } from '/config/auth.js';

// Build Check: Manually update the time string below when pushing new code
console.log(`%c YERTAL SYSTEM-FX LOADED | ${new Date().toLocaleDateString()} @ 14:24:00 `, "background: #000; color: #00f2ff; font-weight: bold; border: 1px solid #00f2ff; padding: 4px;");

// 1. ADD these declarations at the very top of the file
let currentItems, currentAuth, currentUi, user, heroData;

    
async function initRealmsHome() {
    try {
        const paths = ['settings/ui-settings', 'settings/realmshome', 'auth_ui'];
        const results = await Promise.all(paths.map(p => fetch(`${firebaseConfig.databaseURL}/${p}.json`).then(r => r.json())));
        const data = {};
        paths.forEach((p, i) => { data[p] = results[i]; });

        if (data && data['settings/ui-settings'] && data['settings/realmshome']) {
            currentUi = data['settings/ui-settings'];
            currentAuth = data.auth_ui;
            const realms = data['settings/realmshome'];

            applyGlobalStyles({ 'ui-settings': currentUi });

            // Dynamic Router for the 10 System Sections
            const sectionRouter = {
                navigation: () => { renderBranding(realms.navigation.branding); renderNavbar(realms.navigation.menu_items); },
                hero: () => renderHero(realms.hero),
                featured_realms: () => renderFeaturedRealms(realms.featured_realms),
                how_realms_work: () => renderHowRealmsWork(realms.how_realms_work),
                trending_sparks: () => renderTrendingSparks(realms.trending_sparks),
                creation_templates: () => renderTemplates(realms.creation_templates),
                learn_to_build: () => renderLearnToBuild(realms.learn_to_build),
                future_community: () => renderCommunity(realms.future_community),
                final_cta: () => renderFinalCTA(realms.final_cta),
                footer: () => renderFooter(realms.footer)
            };

            Object.keys(realms).forEach(key => {
                if (sectionRouter[key]) sectionRouter[key]();
            });

            renderAuthStatus(user, currentAuth);
            document.body.style.opacity = '1';
        }
    } catch (error) {
        console.error("System Error: Realms Architecture Offline.", error);
    }
}
// --- 2. THE BRANDING & UI ENGINE ---

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

function renderNavbar(items) {
    const el = document.getElementById('nav-menu');
    if (!el || !items) return;
    el.innerHTML = items.map(item => `
        <a href="${item.link}" class="transition-colors uppercase tracking-widest font-bold" style="color: var(--nav-text-color);">
            ${item.label}
        </a>
    `).join('');
}

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
// --- 3. HERO & INTERACTION ENGINE ---
function renderHero(hero) {
    const el = document.getElementById('hero-container');
    if (!el) return;
    const ctaLink = hero.primary_button.link || './arcade/index.html?user=yertal-arcade';
    el.innerHTML = `
        <div class="py-16 text-center animate-fadeIn max-w-4xl">
            <h2 class="text-6xl lg:text-8xl font-black uppercase tracking-tighter text-white leading-none">
                ${hero.main_headline}
            </h2>
            <p class="text-xl lg:text-2xl text-slate-400 mt-6 font-light max-w-2xl mx-auto tracking-wide">
                ${hero.subheadline}
            </p>
            <div class="flex flex-col sm:flex-row gap-4 justify-center items-center mt-10">
                <button id="arcade-trigger" data-link="${ctaLink}" onclick="window.openAuthHUD('superuser')" class="glass-card metallic-bezel text-sm py-4 px-8 uppercase tracking-[0.3em] text-white font-bold bg-white/5 hover:bg-white/10 transition-all">
                    ${hero.primary_button.text}
                </button>
                <a href="${hero.secondary_button.link}" class="text-xs uppercase tracking-[0.3em] text-slate-500 hover:text-white transition-colors py-4 px-8">
                    ${hero.secondary_button.text}
                </a>
            </div>
        </div>
    `;
    initTiltEngine();
}

function initTiltEngine() {
    const btn = document.getElementById('arcade-trigger');
    if (!btn) return;

    document.addEventListener('mousemove', (e) => {
        const rect = btn.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        btn.style.transform = `rotateX(${-y / 8}deg) rotateY(${x / 12}deg)`;
    });
}

function renderFeaturedRealms(items) {
    const el = document.getElementById('showcase-grid');
    if (!el || !Array.isArray(items)) return;
    el.innerHTML = items.map(item => `
        <div class="featured-card metallic-bezel p-8 rounded-[2rem] cursor-pointer aspect-video relative overflow-hidden group flex-1 min-w-[300px]"
             onclick="window.location.href='./arcade/index.html?realm=${item.realm_slug}'"
             onmouseenter="const v=this.querySelector('video'); if(v) v.play();"
             onmouseleave="const v=this.querySelector('video'); if(v) { v.pause(); v.currentTime=0; }">
            <div class="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105 brightness-110 contrast-105 rounded-[2rem]" style="background-image: url('${item.realm_image}')"></div>
            ${item.realm_animation_preview ? `<video src="${item.realm_animation_preview}" loop muted playsinline class="absolute inset-0 w-full h-full object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-[2rem] pointer-events-none"></video>` : ''}
            <div class="absolute inset-0 bg-slate-950/30 backdrop-blur-[1px] group-hover:bg-transparent transition-all duration-500 rounded-[2rem]"></div>
            <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-80 rounded-[2rem]"></div>
            <div class="relative z-10 flex flex-col h-full justify-between">
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

function renderHowRealmsWork(data) {
    const el = document.getElementById('visual-flow-container');
    if (!el || !data.steps) return;
    el.innerHTML = `
        <h3 class="text-xs uppercase tracking-[0.5em] text-slate-500 mb-12">// THE ALCHEMY</h3>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-12 items-center max-w-4xl mx-auto">
            ${data.steps.map(step => `
                <div class="glass-card metallic-bezel p-8 flex flex-col items-center">
                    <div class="text-3xl font-bold text-white mb-2">${step.id}</div>
                    <div class="uppercase tracking-widest text-sm text-slate-400 font-bold">${step.label}</div>
                </div>
            `).join('')}
        </div>
    `;
}

function renderTrendingSparks(items) {
    const el = document.getElementById('trending-sparks-grid');
    if (!el || !items) return;
    el.innerHTML = items.map(spark => `
        <div class="glass-card metallic-bezel p-6 flex flex-col justify-between relative overflow-hidden group">
            <div class="flex justify-between items-start">
                <span class="text-[10px] tracking-widest text-slate-500 uppercase">// ATOMIC_CORE</span>
                <span class="text-[10px] font-bold" style="color: var(--neon-color);">${spark.remix_count} REMIXES</span>
            </div>
            <div class="py-8 text-center text-sm font-mono text-slate-400 uppercase tracking-wider">
                [ ${spark.preview_type.toUpperCase()} ]
            </div>
            <div class="flex justify-between items-center border-t border-white/5 pt-4">
                <span class="text-[9px] text-slate-500 tracking-wider">CREATOR: ${spark.creator_name}</span>
                <span class="text-[10px] font-black uppercase tracking-wider cursor-pointer" style="color: var(--accent-color);">REMIX →</span>
            </div>
        </div>
    `).join('');
}

function renderTemplates(items) {
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
    const el = document.getElementById('action-grid');
    if (!el || !data.modules) return;
    el.innerHTML = data.modules.map(m => `
        <div class="glass-card action-card p-8 flex flex-col h-full group cursor-pointer relative overflow-hidden" onclick="window.open('${m.link}', '_blank')">
            <div class="flex items-center justify-center"><i class="${m.icon} text-3xl" style="color: var(--neon-color);"></i></div>
            <h3 class="mt-8 mb-1 uppercase tracking-tighter text-white text-xl">${m.title}</h3>
            <span class="text-[9px] font-bold uppercase tracking-widest mt-4" style="color: var(--accent-color);">Access Module →</span>
        </div>
    `).join('');
}

function renderCommunity(data) {
    const el = document.querySelector('#learn-container + section');
    if (!el) return;
    el.innerHTML = `
        <h3 class="text-xs uppercase tracking-[0.4em] text-slate-400 mb-4">${data.optional_tagline.toUpperCase()}</h3>
        <p class="text-sm uppercase tracking-[0.2em] text-slate-500">${data.insights.join(' &bull; ')}</p>
    `;
}

function renderFinalCTA(cta) {
    const el = document.querySelector('main > section:last-of-type');
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
// --- 4. CARD RENDERING (Sequential) ---

async function renderActionCards(cards) {
    const grid = document.getElementById('action-grid');
    const keys = Object.keys(cards);
    grid.innerHTML = '';

    keys.forEach((key, i) => {
        const card = cards[key];

    
        const cardEl = document.createElement('div');
        cardEl.className = 'glass-card action-card p-8 flex flex-col h-full group opacity-0 translate-y-4 transition-all duration-500 relative overflow-hidden';
        cardEl.onclick = () => window.open(card.link, '_blank');
        
        cardEl.innerHTML = `
            <div class="card-icon-badge flex items-center justify-center transition-transform duration-500">
                <i class="${card.icon} text-3xl relative z-20" style="color: var(--neon-color);"></i>
                <i class="${card.icon} text-3xl absolute blur-[2px] opacity-0 group-hover:opacity-70 transition-opacity duration-500 z-10" style="color: var(--neon-color);"></i>
                <i class="${card.icon} text-3xl absolute translate-y-1 translate-x-1 blur-[1px] z-0"style="opacity: 0.2; color: var(--neon-color);"></i>
            </div>
            <h3 class="mt-8 mb-1 uppercase tracking-tighter text-white text-xl" style="font-family: var(--nav-font); font-weight: var(--nav-weight); font-variation-settings: 'wght' var(--nav-weight);">${card.title}</h3>
            <p class="text-[11px] text-slate-500 mb-6 font-light leading-relaxed flex-grow">${card.desc}</p>
            <div class="flex items-center gap-2">
                <span class="text-[9px] font-bold text-blue-500 uppercase tracking-widest" style="color: var(--accent-color);">Execute →</span>
            </div>
        `;

        grid.appendChild(cardEl);
        setTimeout(() => cardEl.classList.remove('opacity-0', 'translate-y-4'), i * 80);
    });
}

function renderShowcase(items) {
    const grid = document.getElementById('showcase-grid');
    grid.innerHTML = Object.keys(items).map(key => {
        const item = items[key];
        return `
            <div class="featured-card metallic-bezel p-8 rounded-[2rem] cursor-pointer aspect-video relative overflow-hidden group flex-1 min-w-[300px]"
                 onclick="window.location.href='${item.path || '#'}'">
                
                <div class="absolute inset-0 bg-cover bg-no-repeat bg-center transition-transform duration-700 group-hover:scale-105 brightness-110 contrast-105 rounded-[2rem]" 
                     style="background-image: url('${item.img}')">
                </div>

                 <div class="absolute inset-0 bg-slate-950/30 backdrop-blur-[1px] group-hover:bg-transparent transition-all duration-500 rounded-[2rem]"></div>
                
                <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-80 rounded-[2rem]"></div>

                
                <div class="relative z-10 flex flex-col h-full justify-between">
                    <div class="flex justify-between items-start">
                        <span class="text-blue-400 text-[10px] font-bold tracking-widest uppercase" style="color: var(--accent-color);">Showcased: ${item.category || 'Laboratory'}</span>
                        <i class="fas fa-rocket text-blue-500 text-2xl group-hover:text-cyan-400 transition-colors"></i>
                    </div>
                    <div>
                        <h3 class="uppercase tracking-tighter text-white text-xl" style="font-family: var(--nav-font); font-weight: var(--nav-weight);">${item.title}</h3>
                        <span class="neon-text-sync block mt-2 text-[9px] text-blue-400 uppercase font-bold tracking-[0.2em]">Initialize →</span>
                    </div>
                </div>
            </div>`;
    }).join('');
}
function renderFooter(footer) {
    const container = document.getElementById('footer-container');
    container.innerHTML = `
        <div class="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-10">
            ${footer.columns.map(col => `
                <div>
                    <h4 class="text-blue-500 font-bold uppercase text-xs mb-4">${col.heading}</h4>
                    <div class="flex flex-col gap-2 text-xs text-slate-400">
                        ${col.links.map(link => `<button onclick="window.open('${link.url}', '_blank')" class="text-left hover:text-white transition">${link.label}</button>`).join('')}
                    </div>
                </div>
            `).join('')}
            <div class="text-[10px] text-slate-500 uppercase tracking-widest flex flex-col justify-center md:items-end">
                <span>© 2026 YERTAL CORPORATION</span>
                <span class="mt-1 opacity-50 italic">Systems Built in the Lab</span>
            </div>
        </div>
    `;
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

window.onload = initShowroom;
