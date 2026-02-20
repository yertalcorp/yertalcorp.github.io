import { firebaseConfig, auth, db } from '/config/firebase-config.js';
import { loginWithProvider, logout, watchAuthState } from '/config/auth.js';

// Build Check: Manually update the time string below when pushing new code
console.log(`%c YERTAL SYSTEM-FX LOADED | ${new Date().toLocaleDateString()} @ 15:57:00 `, "background: #000; color: #00f2ff; font-weight: bold; border: 1px solid #00f2ff; padding: 4px;");

// 1. ADD these declarations at the very top of the file
let currentItems, currentAuth, currentUi, user, heroData;
    
async function initShowroom() {
    try {
        const response = await fetch(`${firebaseConfig.databaseURL}/.json`);
        const data = await response.json();
    
        if (data && data.settings) {
            // 2. ASSIGN values to the global variables here
            currentItems = data.navigation.menu_items;
            currentAuth = data.auth_ui;
            currentUi = data.settings['ui-settings'];
           
                       
            applyGlobalStyles(data.settings);
            renderBranding(data.navigation.branding);
            renderNavbar(currentItems, currentUi);
            renderHero(data.hero_section);
                renderShowcase(data['showcase-items']);
                renderActionCards(data['action-cards']);
            renderFooter(data.navigation.footer);
            renderAdminGate(data.settings['ui-settings']);
            renderAuthStatus(user, currentAuth);

            document.body.style.opacity = '1';
        }
    } catch (error) {
        console.error("System Error: Laboratory Data Unreachable.", error);
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
    const container = document.getElementById('nav-logo');
    container.innerHTML = `
        <div class="flex items-center gap-3 cursor-pointer" onclick="location.reload()">
            <img src="/assets/images/Yertal_Logo_New_HR.png" alt="Logo" onerror="this.src='https://placehold.co/40x40/3b82f6/white?text=Y'" class="h-10 w-auto">
            <h1 class="text-xl font-extrabold uppercase tracking-tighter">
                <span style="color:${brand.parts[0].color}">${brand.parts[0].text}</span>
                <span class="text-blue-500">${brand.parts[1].text}</span>
            </h1>
        </div>
    `;
}

function renderNavbar(items, ui) {
    const nav = document.getElementById('nav-menu');
    if (!nav || !items) return;

    nav.innerHTML = items.map(item => `
        <button onclick="window.open('${item.link}', '_blank')" 
                class="transition-colors duration-300 uppercase tracking-widest font-bold"
                style="color: var(--nav-text-color); font-family: var(--nav-font); font-size: ${ui.nav_font_size}">
            ${item.label}
        </button>
    `).join('');
}

function renderAuthStatus(user, auth) {
    const authZone = document.getElementById('auth-zone');
    if (!authZone || !auth) return;

    authZone.innerHTML = '';
    if (user === undefined) {
        authZone.innerHTML = '<span class="text-[9px] text-slate-500 animate-pulse uppercase tracking-widest">Verifying...</span>';
        return;
    }
    if (user) {
        /* RENDER: LOGGED IN HUD */
        authZone.innerHTML = `
            <div class="flex items-center gap-4 animate-fadeIn">
                <div class="flex flex-col items-end leading-none">
                    <span class="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">
                        ${user.email === 'yertal-arcade@gmail.com' ? 'SUPERUSER' : 'RESEARCHER'}
                    </span>
                    <span class="text-[8px] text-[var(--neon-color)] opacity-70 font-mono">STATUS: ACTIVE</span>
                </div>
                
                <img src="${user.photoURL || '/assets/images/default-avatar.png'}" 
                     class="w-9 h-9 rounded-full border-2 border-[var(--neon-color)] shadow-[0_0_15px_rgba(0,242,255,0.2)]">

                <button onclick="handleLogout()"
                        class="border border-white/10 hover:border-red-500/50 hover:bg-red-500/10 px-4 py-2 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all duration-300 text-white/60 hover:text-white">
                    DISCONNECT
                </button>
            </div>`;
    } else {
        /* RENDER: ACCESS PORTAL BUTTON (Corrected to single button) */
        authZone.innerHTML = `
            <button onclick="window.openAuthHUD()" class="glass-card" style="padding: 0.5rem 1.2rem; font-size: 10px; font-weight: 900; color: white; text-transform: uppercase; border: 1px solid rgba(255,255,255,0.1); cursor: pointer;">
                [ SIGN INTO ARCADE ]
            </button>`;
    }
}

watchAuthState(async (newUser) => {
    user = newUser;

    if (user && currentAuth && currentUi) {
        renderAuthStatus(user, currentAuth);
        
        try {
            // 1. Retrieve from Session Storage first to avoid hardcoded pathing
            let currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
        
            if (!currentUser || currentUser.uid !== user.uid) {
                const profileUrl = firebaseConfig.databaseURL + "/users/" + user.uid + "/profile.json";
                const response = await fetch(profileUrl);
                let profile = await response.json();

                if (!profile) {
                    const generatedSlug = (user.displayName || user.uid).toLowerCase().replace(/\s+/g, '-');
                    profile = {
                        display_name: user.displayName,
                        slug: generatedSlug,
                        arcade_logo: currentUi['default-logo'],
                        plan_type: 'free'
                    };
                    
                    await fetch(profileUrl, {
                        method: 'PUT',
                        body: JSON.stringify(profile)
                    });
                }
                // Update currentUser for the session
                currentUser = profile;
                sessionStorage.setItem('currentUser', JSON.stringify(currentUser));
            }

            const forceSuperuser = sessionStorage.getItem('yertal_redirect_override');
            // 2026-02-01: Superuser is yertal-arcade
            const finalSlug = forceSuperuser ? 'yertal-arcade' : currentUser.slug;
            
            sessionStorage.removeItem('yertal_redirect_override'); 
            window.location.href = "./arcade/index.html?user=" + finalSlug;

        } catch (error) {
            console.error("USER_RETRIEVAL_ERROR:", error);
        }
    }
});

/* added new */
window.handleArcadeEntry = async (btn) => {
    await auth.authStateReady();
    const liveuser = auth.currentUser;
    const targetLink = btn.getAttribute('data-link');
    
    if (liveuser) {
        window.location.href = targetLink;
    } else {
        // Set a flag so the watchAuthState knows to ignore the user's personal slug and use the superuser one
        sessionStorage.setItem('yertal_redirect_override', 'true');
        window.openAuthHUD();
    }
};

// --- 3. HERO & INTERACTION ENGINE ---
function renderHero(hero) {
    const container = document.getElementById('hero-container');
    const ctaLink = hero.holographic_cta.link || './arcade/index.html?user=yertal-arcade';
    container.innerHTML = `
        <div class="py-8 animate-fadeIn text-center">
            <h2 class="text-5xl lg:text-7xl uppercase tracking-tighter text-glow"
            style="font-family: var(--nav-font); font-weight: var(--nav-weight); font-variation-settings: 'wght' var(--nav-weight), 'ital' 0;">
                ${hero.title_parts[0].text} <span class="italic" style="color: var(--accent-color); font-weight: inherit; font-style: italic; font-variation-settings: 'wght' var(--nav-weight), 'ital' 1;">${hero.title_parts[1].text}</span>
            </h2>
            <p class="text-slate-400 mt-4 text-lg italic font-light tracking-wide mx-auto max-w-2xl">
                ${hero.description}
            </p>
            <div class="w-full flex justify-center mt-8 mb-9" style="perspective: 1000px;">
                <button id="arcade-trigger" data-link="${ctaLink}" onclick="handleArcadeEntry(this)" class="surreal-3d-btn group relative px-20 py-8 rounded-2xl uppercase text-lg tracking-[0.5em] text-white">
                    <div class="inner-content flex items-center gap-6">
                        <i class="fas fa-power-off text-blue-400 opacity-70 group-hover:scale-125 transition-transform"></i>
                        ${hero.holographic_cta.text}
                        <i class="fas fa-microchip text-blue-400 opacity-70 group-hover:rotate-180 transition-transform duration-1000"></i>
                    </div>
                </button>
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
                <i class="${card.icon} text-3xl relative z-20" style="color: var(--neon-color); font-family: var(--icon-font-family); font-weight: var(--icon-font-weight);"></i>
                <i class="${card.icon} text-3xl absolute blur-[2px] opacity-0 group-hover:opacity-70 transition-opacity duration-500 z-10" style="color: var(--neon-color); font-family: var(--icon-font-family); font-weight: var(--icon-font-weight);"></i>
                <i class="${card.icon} text-3xl absolute translate-y-1 translate-x-1 blur-[1px] z-0" style="opacity: 0.2; font-family: var(--icon-font-family); font-weight: var(--icon-font-weight);"></i>
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

window.handleLogout = async () => {
    try {
        // 1. Get the Global Logout URL from our auth helper
        const globalLogoutUrl = await logout();

        // 2. Local Cleanup
        user = null;
        localStorage.clear();
        sessionStorage.clear();

        // 3. The Nuclear Option
        if (globalLogoutUrl) {
            // This sends the user to Google/GitHub to kill that session too
            // They will need to manually navigate back or you can append a redirect param if supported
            window.location.href = globalLogoutUrl;
        } else {
            window.location.replace('/');
        }
    } catch (error) {
        console.error("Global Logout Failed:", error);
    }
};

/* Tag/Function: openAuthHUD */
window.openAuthHUD = () => {
    const hud = document.getElementById('auth-hud');
    const list = document.getElementById('provider-list');
    
    if (hud && list) {
        hud.style.display = 'block'; // display: block works better with position: absolute children
        
        list.innerHTML = ['google', 'github', 'yahoo'].map(provider => `
            <button onclick="handleAuth('${provider}')" class="flex flex-col items-center gap-1 group bg-transparent border-none cursor-pointer">
                <i class="fab fa-${provider} text-2xl text-white/70 group-hover:text-[var(--neon-color)] transition-all"></i>
                <span class="text-[8px] tracking-[0.3em] uppercase opacity-40 group-hover:opacity-100">${provider}</span>
            </button>
        `).join('');
    }
};

window.onload = initShowroom;
