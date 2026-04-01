import { firebaseConfig, auth, db } from '/config/firebase-config.js';
import { loginWithProvider, logout, watchAuthState } from '/config/auth.js';

// Build Check: Manually update the time string below when pushing new code
console.log(`%c YERTAL SYSTEM-FX LOADED | ${new Date().toLocaleDateString()} @ 8:29:00 `, "background: #000; color: #00f2ff; font-weight: bold; border: 1px solid #00f2ff; padding: 4px;");

// 1. ADD these declarations at the very top of the file
let currentItems, currentAuth, currentUi, user, heroData;

    
async function initShowroom() {
    try {
        // 1. Fetch only the public nodes required for the UI
        const paths = [
            'navigation', 
            'settings', 
            'hero_section', 
            'showcase-items', 
            'action-cards', 
            'auth_ui'
        ];

        // Fetch all in parallel for speed
        const results = await Promise.all(
            paths.map(path => 
                fetch(`${firebaseConfig.databaseURL}/${path}.json`).then(res => res.json())
            )
        );

        // Map results back to a data object
        const data = {};
        paths.forEach((path, index) => { data[path] = results[index]; });

        if (data && data.settings) {
            // ... Your existing assignment logic remains the same ...
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

// A safe function to set the slug.
const getSafeSlug = async (user) => {
     // 1. Try Session storage first
     let cached = JSON.parse(sessionStorage.getItem('currentUser'));
     if (cached?.slug) return cached.slug;

    // 2. If session empty, fetch from DB
    console.log("Slug missing from session, fetching from Firebase...");
    
    // Added try/catch to log errors during the fetch operation
    try {
        const snapshot = await fetch(`${firebaseConfig.databaseURL}/users/${user.uid}/profile.json`);
        
        // Check if the response is ok (status in the range 200-299)
        if (!snapshot.ok) {
            throw new Error(`HTTP error! status: ${snapshot.status}`);
        }
        
        const profile = await snapshot.json();
            
       if (profile?.slug) {
            sessionStorage.setItem('currentUser', JSON.stringify(profile));
            console.log("getSafeSlug slug retrieved from db is : ", profile.slug);
            return profile.slug;
       }
    } catch (error) {
        console.error("Error retrieving data from the db:", error);
    }

   // 3. Absolute fallback (UID is safer than Display Name)
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
                <button id="arcade-trigger" data-link="${ctaLink}" onclick="window.openAuthHUD('superuser')" class="surreal-3d-btn group relative px-20 py-8 rounded-2xl uppercase text-lg tracking-[0.5em] text-white">
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
