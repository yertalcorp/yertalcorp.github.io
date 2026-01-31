// --- CONFIGURATION ---
// These details come from your Firebase Project Settings
const firebaseConfig = {
  apiKey: "AIzaSyAuwxVwXTL78hPTq-7UnXWVwsG1ipXoF_0",
  authDomain: "yertal-arcade.firebaseapp.com",
  databaseURL: "https://yertal-arcade-default-rtdb.firebaseio.com",
  projectId: "yertal-arcade",
  storageBucket: "yertal-arcade.firebasestorage.app",
  messagingSenderId: "218347522316",
  appId: "1:218347522316:web:d0dbabeb8373a663d16129",
  measurementId: "G-2VP21WZ4CG"
};

// Initialize App
async function initShowroom() {
    try {
        const response = await fetch(`${firebaseConfig.databaseURL}/.json`);
        const data = await response.json();

        if (data) {
            applyGlobalStyles(data.settings);
            renderBranding(data.navigation.branding);
            renderNavbar(data.navigation.menu_items, data.auth_ui);
            renderHero(data.hero_section);
            renderShowcase(data['showcase-items']);
            renderActionCards(data['action-cards']);
            renderFooter(data.navigation.footer);
            renderAdminGate(data.settings['ui-settings']);
            
            // Fade in the body once data is ready
            document.body.style.opacity = '1';
        }
    } catch (error) {
        console.error("System Error: Laboratory Data Unreachable.", error);
    }
}

// --- 2. THE BRANDING & UI ENGINE ---

function applyGlobalStyles(settings) {
    const ui = settings['ui-settings'];
    const root = document.documentElement;
    
    // Inject Fonts & Icons
    document.getElementById('google-fonts-link').href = settings.external_assets.google_fonts_url;
    document.getElementById('font-awesome-link').href = settings.external_assets.font_awesome_url;

    // Set CSS Variables
    root.style.setProperty('--neon-color', ui['color-neon']);
    root.style.setProperty('--accent-color', ui['color-accent']);
    root.style.setProperty('--btn-radius', `${ui['button-radius']}px`);
    root.style.setProperty('--card-blur', ui['card_blur']);
    root.style.setProperty('--nav-font', ui['nav_font']);
}

function renderBranding(brand) {
    const container = document.getElementById('nav-logo');
    container.innerHTML = `
        <a href="${brand.link}" class="flex items-center gap-2 no-underline">
            <span style="color:${brand.parts[0].color}; font-family:'${brand.parts[0].font}'; font-weight:${brand.parts[0].weight}; font-size:1.5rem;">${brand.parts[0].text}</span>
            <span style="color:${brand.parts[1].color}; font-family:'${brand.parts[1].font}'; font-weight:${brand.parts[1].weight}; font-size:1.5rem;">${brand.parts[1].text}</span>
        </a>
    `;
}

function renderNavbar(items, auth) {
    const nav = document.getElementById('nav-menu');
    const mobileNav = document.getElementById('mobile-links');
    const authZone = document.getElementById('auth-zone');

    const linksHTML = items.map(item => `
        <a href="${item.link}" class="hover:text-[var(--neon-color)] transition-colors ${item.external ? 'target="_blank"' : ''}">${item.label}</a>
    `).join('');

    nav.innerHTML = linksHTML;
    mobileNav.innerHTML = linksHTML;

    authZone.innerHTML = `
        <a href="${auth.signup_link}" class="bg-[var(--neon-color)] text-black px-6 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest hover:brightness-110 transition shadow-lg">${auth.signup_label}</a>
    `;
}

// --- 3. HERO & INTERACTION ENGINE ---

function renderHero(hero) {
    const container = document.getElementById('hero-container');
    container.innerHTML = `
        <div class="py-8 animate-fadeIn text-center lg:text-left">
            <h2 class="text-5xl lg:text-7xl font-black uppercase tracking-tighter mb-4">
                <span style="color:${hero.title_parts[0].color}; font-family:'${hero.title_parts[0].font}'; ${hero.title_parts[0].glow ? 'text-shadow: 0 0 20px '+hero.title_parts[0].color : ''}">${hero.title_parts[0].text}</span>
                <span style="color:${hero.title_parts[1].color}; font-family:'${hero.title_parts[1].font}'; font-style:italic;">${hero.title_parts[1].text}</span>
            </h2>
            <p class="text-slate-400 text-lg italic font-light max-w-2xl mx-auto lg:mx-0">${hero.description}</p>
            <div class="w-full flex justify-center mt-12 mb-12" style="perspective: 1000px;">
                <button id="arcade-trigger" onclick="window.location.href='${hero.holographic_cta.link}'" class="surreal-3d-btn group relative px-20 py-8 rounded-2xl font-black uppercase text-lg tracking-[0.4em] text-white">
                    <div class="inner-content flex items-center gap-6">
                        <i class="fas fa-power-off text-blue-400"></i>
                        ${hero.holographic_cta.text}
                        <i class="fas fa-microchip text-blue-400"></i>
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
        btn.style.transform = `rotateX(${-y / 10}deg) rotateY(${x / 15}deg)`;
    });
}

// --- 4. DATA RENDERING (Sequential Loading) ---

async function renderActionCards(cards) {
    const grid = document.getElementById('action-grid');
    const keys = Object.keys(cards);
    grid.innerHTML = '';

    for (let i = 0; i < keys.length; i++) {
        const card = cards[keys[i]];
        const cardEl = document.createElement('div');
        cardEl.className = 'glass-card action-card opacity-0 translate-y-4 transition-all duration-500';
        cardEl.onclick = () => window.open(card.link, '_blank');
        
        cardEl.innerHTML = `
            <div class="flex flex-col h-full p-8">
                <div class="mb-4"><i class="${card.icon} text-3xl text-[var(--neon-color)]"></i></div>
                <h3 class="font-black uppercase tracking-tighter text-white mb-2">${card.title}</h3>
                <p class="text-[11px] text-slate-500 font-light leading-relaxed flex-grow">${card.desc}</p>
                <div class="mt-4 text-[9px] font-bold text-[var(--neon-color)] uppercase tracking-widest">Execute →</div>
            </div>
        `;
        
        grid.appendChild(cardEl);
        
        // Staggered animation
        setTimeout(() => {
            cardEl.classList.remove('opacity-0', 'translate-y-4');
        }, i * 100);
    }
}

function renderShowcase(items) {
    const grid = document.getElementById('showcase-grid');
    grid.innerHTML = Object.keys(items).map(key => {
        const item = items[key];
        return `
            <div class="featured-card flex-1 min-w-[300px] h-[250px] relative rounded-[2.5rem] overflow-hidden group cursor-pointer" onclick="window.location.href='${item.path}'">
                <img src="${item.img}" class="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110">
                <div class="absolute inset-0 bg-black/60 group-hover:bg-black/40 transition-colors"></div>
                <div class="relative z-10 p-8 flex flex-col h-full justify-between">
                    <span class="text-[var(--neon-color)] text-[10px] font-bold tracking-widest uppercase">${item.category}</span>
                    <h3 class="font-black uppercase tracking-tighter text-white text-xl">${item.title}</h3>
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
                    <h4 class="text-[var(--neon-color)] font-bold uppercase text-xs mb-4">${col.heading}</h4>
                    <div class="flex flex-col gap-2 text-xs text-slate-400">
                        ${col.links.map(link => `<a href="${link.url}" class="hover:text-white transition no-underline">${link.label}</a>`).join('')}
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
    gate.innerHTML = `<a href="${config.link}" class="fixed bottom-4 right-4 w-3 h-3 block transition-opacity duration-500 hover:opacity-100" style="background:${config.color}; opacity:${config.opacity}; border-radius:${config.shape === 'circle' ? '50%' : '2px'};"></a>`;
}

// Global Toggles
window.toggleMobileMenu = () => {
    document.getElementById('mobile-menu').classList.toggle('hidden');
    document.getElementById('mobile-menu').classList.toggle('flex');
};

window.closeLegal = () => document.getElementById('legal-modal').classList.add('hidden');

// Initialize on Load
window.onload = initShowroom;
