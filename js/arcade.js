import { firebaseConfig, auth, saveToRealtimeDB } from '../config/firebase-config.js';
import { watchAuthState, logout } from '../config/auth.js';
import { ENV } from '../config/env.js';

let user;
let databaseCache = {};
const GEMINI_API_KEY = ENV.GEMINI_KEY;

// 1. THE BOUNCER & INITIALIZATION
watchAuthState((newUser) => {
    user = newUser;
    if (newUser === null) {
        // If at any point the user is null, bounce them out immediately
        window.location.replace('../index.html'); 
    } else if (newUser) {
        initArcade();
    }
});

async function initArcade() {
    try {
        const response = await fetch(`${firebaseConfig.databaseURL}/.json`);
        databaseCache = await response.json();
        
        // 1. APPLY UI GENETICS (From Showroom Style Logic)
        const ui = databaseCache.settings['ui-settings'];
        const root = document.documentElement;
        
        root.style.setProperty('--neon-color', ui['color-neon']);
        root.style.setProperty('--accent-color', ui['color-accent']);
        root.style.setProperty('--nav-font', ui.nav_font);
        
        // Load fonts dynamically as we did in showroom
        const fontLink = document.getElementById('google-fonts-link');
        if (fontLink) fontLink.href = databaseCache.settings.external_assets.google_fonts_url;

        // 2. HERO HUD POPULATION
        const hero = databaseCache.arcade_infrastructure.hero;
        document.getElementById('hero-heading').textContent = hero.title;
        document.getElementById('hero-subheading').textContent = hero.subtitle;
        
        // Handle the 3D Button text (CTA)
        const createBtn = document.getElementById('create-arcade-btn');
        if (createBtn) {
            const btnSpan = createBtn.querySelector('.inner-content');
            btnSpan.textContent = hero.cta_create || "SPAWN NEW CURRENT";
            createBtn.onclick = handleCreateCurrent;
        }

        // 3. BRANDING & AUTH HUD
        const brand = databaseCache.navigation.branding;
        const part1 = `<span style="color: ${brand.parts[0].color}">${brand.parts[0].text}</span>`;
        const part2 = `<span style="color: ${brand.parts[1].color}">${brand.parts[1].text}</span>`;
        document.getElementById('corp-name-display').innerHTML = `${part1} ${part2}`;
        
        const authBtn = document.getElementById('auth-trigger');
        authBtn.textContent = "TERMINATE SESSION";
        authBtn.onclick = () => logout();

        // 4. SUPERUSER VERIFICATION
        const superUserDisplay = document.getElementById('superuser-display');
        if (user && user.email === 'yertal-arcade@gmail.com') {
            superUserDisplay.textContent = "ACCESS: YERTAL-ARCADE-ADMIN";
            superUserDisplay.style.color = 'var(--neon-color)';
        }

        // CHANGE: Pass arcade_infrastructure.currents
        renderCurrents(databaseCache.arcade_infrastructure.currents);
        
        // FINALIZE: Reveal the Lab
        document.body.style.opacity = '1';

    } catch (e) { 
        console.error("Laboratory Initialization Failed:", e); 
        document.getElementById('engine-status-text').textContent = "SYSTEM OFFLINE";
    }
}

function renderCurrents(currents) {
    const container = document.getElementById('currents-container');
    if (!container || !currents) return;

    container.innerHTML = currents.map(current => `
        <section class="current-block mb-12 w-full">
            <div class="flex items-center justify-between gap-4 mb-6">
                <div class="flex items-center gap-4 flex-grow">
                    <h2 class="text-2xl font-black italic uppercase tracking-tighter text-white">${current.name}</h2>
                    <div class="h-[1px] flex-grow bg-gradient-to-r from-white/20 to-transparent"></div>
                </div>
                
                <div class="flex items-center gap-2 bg-white/5 p-2 rounded-lg border border-white/10">
                    <input type="text" id="input-${current.id}" 
                           placeholder="${current.example_prompt}" 
                           class="bg-black/40 border-none text-[10px] text-white px-3 py-1 rounded w-48 focus:ring-1 focus:ring-[var(--neon-color)] outline-none">
                    
                    <select id="mode-${current.id}" class="bg-black/40 text-[9px] text-white border-none rounded px-2 py-1 outline-none">
                        <option value="prompt">LOGIC</option>
                        <option value="sourcing">SOURCE</option>
                    </select>

                    <button onclick="handleCreation('${current.id}')" 
                            class="bg-[var(--neon-color)]/20 hover:bg-[var(--neon-color)]/40 text-[var(--neon-color)] text-[9px] font-bold px-4 py-1 rounded transition uppercase">
                        Generate
                    </button>
                </div>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                ${renderSparks(current.sparks)}
            </div>
        </section>
    `).join('');
}
    
function renderSparks(sparks) {
    // 1. IMPROVED EMPTY STATE
    if (!sparks || Object.keys(sparks).length === 0) {
        return `
            <div class="col-span-full py-10 border border-dashed border-white/10 rounded-xl text-center">
                <p class="text-slate-500 text-[9px] uppercase tracking-widest italic">No sparks generated in this current. Initialize via HUD.</p>
            </div>`;
    }

    // 2. CONVERT & SORT (Newest First)
    const sortedSparks = Object.values(sparks).sort((a, b) => b.created - a.created);

    // 3. MAP TO HTML
    return sortedSparks.map(spark => {
        // DETERMINISTIC UI: Logic for icons/colors based on Template Type
        const isMedia = /video|movie|music/i.test(spark.template_type || '');
        const typeLabel = spark.template_type || 'Custom';
        const currentUserPrefix = user ? user.email.split('@')[0] : null;
        const canDelete = (currentUserPrefix === spark.owner) || (user && user.email === 'yertal-arcade@gmail.com');

        return `
            <div class="action-card glass p-4 rounded-xl border border-white/5 hover:border-[var(--neon-color)] transition-all group">
                <div class="card-top flex justify-between items-start mb-4">
                    <div>
                        <h4 class="text-white font-bold text-xs uppercase tracking-tighter">${spark.name}</h4>
                        <div class="flex items-center gap-2">
                            <small class="text-[9px] text-slate-500 uppercase">${formatTimeAgo(spark.created)}</small>
                            <span class="text-[7px] px-1.5 py-0.5 rounded-sm bg-white/5 text-[var(--neon-color)] font-black uppercase tracking-widest border border-white/5">${typeLabel}</span>
                        </div>
                    </div>
                    <div class="text-[10px] font-black text-white/20 group-hover:text-[var(--neon-color)] transition-colors">#${spark.internal_rank}</div>
                </div>
                
                <div class="card-preview mb-4 overflow-hidden rounded-lg bg-black/40 aspect-video flex items-center justify-center cursor-pointer relative" 
                     onclick="window.open('${spark.link || '#'}', '_blank')">
                    
                    ${isMedia ? `
                        <div class="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/0 transition-all z-10">
                             <div class="w-8 h-8 rounded-full bg-[var(--neon-color)]/20 flex items-center justify-center border border-[var(--neon-color)]/40 shadow-[0_0_15px_rgba(var(--neon-color),0.2)]">
                                <div class="w-0 h-0 border-t-[5px] border-t-transparent border-l-[8px] border-l-white border-b-[5px] border-b-transparent ml-1"></div>
                             </div>
                        </div>
                    ` : ''}

                    <img src="${spark.image || '../assets/sparks/default.jpg'}" alt="Preview" 
                         class="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition duration-500">
                </div>
                <div class="flex justify-between items-center mb-3 px-2">
                    <button onclick="copyLink('?current=${currentId}&spark=${spark.id}')" 
                            class="text-[9px] text-slate-400 hover:text-[var(--neon-color)] uppercase font-bold transition flex items-center gap-1">
                        <span class="opacity-50">#</span> SHARE
                    </button>
    
                    ${canDelete ? `
                        <button onclick="deleteSpark('${currentId}', '${spark.id}', '${spark.owner}')" 
                            class="text-[9px] text-red-500/40 hover:text-red-500 uppercase font-black transition tracking-tighter">
                            [ DECOMMISSION ]
                        </button>
                    ` : ''}
                </div>
                <div class="card-stats grid grid-cols-3 gap-1 border-t border-white/5 pt-3">
                    <div class="text-center"><span class="block text-white text-[10px] font-bold">${spark.stats.views || 0}</span><span class="text-[7px] text-slate-500 uppercase">Views</span></div>
                    <div class="text-center"><span class="block text-white text-[10px] font-bold">${spark.stats.likes || 0}</span><span class="text-[7px] text-slate-500 uppercase">Likes</span></div>
                    <div class="text-center"><span class="block text-white text-[10px] font-bold">${spark.stats.tips || 0}</span><span class="text-[7px] text-slate-500 uppercase">Tips</span></div>
                </div>
            </div>
        `;
    }).join('');
}

// js/arcade.js

window.copyLink = (params) => {
    // Construct the full URL for the yertalcorp.github.io site
    const fullUrl = `${window.location.origin}${window.location.pathname}${params}`;

    navigator.clipboard.writeText(fullUrl).then(() => {
        // Feedback via the existing HUD status if available
        const statusElement = document.getElementById('engine-status-text');
        if (statusElement) {
            const original = statusElement.textContent;
            statusElement.textContent = "LINK ENCRYPTED TO CLIPBOARD";
            statusElement.style.color = "var(--neon-color)";
            
            setTimeout(() => {
                statusElement.textContent = original;
                statusElement.style.color = "";
            }, 2500);
        } else {
            alert("Link copied to clipboard!");
        }
    });
};

window.handleCreation = async (currentId) => {
    const promptInput = document.getElementById(`input-${currentId}`);
    const input = promptInput ? promptInput.value.trim() : '';
    if (!input) return;

    // 1. CLASSIFICATION ENGINE (New)
    let detectedTypeId = 'custom';
    const presets = Object.values(databaseCache.settings['arcade-current-types'] || {});

    // Map input to one of your 16 Categories
    if (/youtube.com|vimeo.com|video|clip/i.test(input)) detectedTypeId = 'videos';
    else if (/imdb.com|movie|film|trailer/i.test(input)) detectedTypeId = 'movies';
    else if (/github.com|app|tool|interface/i.test(input)) detectedTypeId = 'apps';
    else if (/physics|gravity|simulat|engine/i.test(input)) detectedTypeId = 'physics-lab';
    else if (/game|play|level|quest/i.test(input)) detectedTypeId = 'games';
    else if (/stock|price|market|finance|money/i.test(input)) detectedTypeId = 'finance';

    const template = presets.find(t => t.id === detectedTypeId) || { name: 'Custom', logic: 'hybrid' };

    // 2. LOGIC ENFORCEMENT & MODE SELECTION
    const isUrl = /^(http|https):\/\/[^ "]+$/.test(input);
    const isVague = input.length < 15 && !isUrl;
    
    // Automatically switch to 'sourcing' if it's a URL or a source-only template
    let mode = (template.logic === 'source' || isUrl) ? 'sourcing' : 'prompt';

    // 3. VAGUE PROMPT HANDLING (Preserved)
    if (isVague && mode === 'prompt') {
        showBinaryModal(
            `Focus on mechanics/logic`,`Focus on visuals/vibe`,(choice) => {
                executeMassSpark(currentId, `${input} (${choice})`, mode, template.name);
                if (promptInput) promptInput.value = '';
            }
        );
    } else {
        // 4. DIRECT EXECUTION (For URLs, Sourcing, or Detailed Prompts)
        executeMassSpark(currentId, input, mode, template.name);
        if (promptInput) promptInput.value = '';
    }
};

async function executeMassSpark(currentId, prompt, mode) {
    const status = document.getElementById('engine-status-text');
    const countMatch = prompt.match(/\d+/);
    const count = countMatch ? Math.min(parseInt(countMatch[0]), 48) : 6;
    
    status.textContent = `GENERATING ${count} SPARKS...`;

    try {
        if (mode === 'sourcing') {
            const links = await callGeminiAPI(prompt, count, 'source');
            for (const item of links) {
                await saveSpark(currentId, { ...item, type: 'link' });
            }
        } else {
            for (let i = 0; i < count; i++) {
                const code = await callGeminiAPI(prompt, i, 'code');
                await saveSpark(currentId, { name: `${prompt} #${i+1}`, code, type: 'code' });
            }
        }
        status.textContent = "READY";
        initArcade();
    } catch (e) { 
        console.error("Mass Spark Failed:", e);
        status.textContent = "ERROR"; 
    }
}

// 4. API & DB HELPERS
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

// js/arcade.js

function formatTimeAgo(timestamp) {
 if (!timestamp || typeof timestamp !== 'number') return "Unknown date";
 const seconds = Math.floor((Date.now() - timestamp) / 1000);
 if (seconds < 60) return "Just now";
 const minutes = Math.floor(seconds / 60);
 if (minutes < 60) return `${minutes}m ago`;
 const hours = Math.floor(minutes / 60);
 if (hours < 24) return `${hours}h ago`;
 return new Date(timestamp).toLocaleDateString();
}
    
// Updated to accept the template name from handleCreation/executeMassSpark
async function saveSpark(currentId, data, detectedTemplate = 'Custom') {
    const sparkId = `spark_${Date.now()}_${Math.floor(Math.random()*1000)}`;
    const dbPath = `arcade_infrastructure/currents/${currentId}/sparks/${sparkId}`;
    
    // Get numeric index for internal_rank based on current sparks
    const currentSparks = databaseCache.arcade_infrastructure.currents.find(c => c.id === currentId)?.sparks || {};
    const rank = Object.keys(currentSparks).length + 1;

    await saveToRealtimeDB(dbPath, {
        // Core Identity
        id: sparkId,
        name: data.name || "Unnamed Spark",
        desc: data.desc || "AI generated atmospheric logic.",
        owner: user ? user.email.split('@')[0] : "yertal-arcade",
        
        // Metadata & Visuals
        created: Date.now(),template_type: detectedTemplate, // NEW: Persists the template used
        image: data.image || "assets/sparks/default.jpg",
        internal_rank: rank,
        
        // Data Payload
        code: data.code || null,
        link: data.link || null,

        // Full Stats Object
        stats: {
            comments: 0,
            dislikes: 0,
            likes: 0,
            reshares: 0,
            tips: 0,
            views: 0
        }
    });
}

// js/arcade.js

window.deleteSpark = async (currentId, sparkId, ownerPrefix) => {
    // 1. Permission Validation
    const currentUserPrefix = user ? user.email.split('@')[0] : null;
    const isSuperUser = user && user.email === 'yertal-arcade@gmail.com';
    const isOwner = currentUserPrefix === ownerPrefix;

    if (!canDelete) {
        alert("Unauthorized: Only the Spark architect or Yertal Super-user can decommission this.");
        return;
    }

    // 2. Confirmation
    if (!confirm("Are you sure you want to decommission this Spark? This action is irreversible.")) return;

    // 3. Database Execution
    const dbPath = `arcade_infrastructure/currents/${currentId}/sparks/${sparkId}`;
    try {
        await removeFromRealtimeDB(dbPath); // Ensure this helper exists in your firebase-config.js
        console.log(`Spark ${sparkId} decommissioned.`);
        
        // Refresh the local cache and UI
        initArcade(); 
    } catch (error) {
        console.error("Decommission failed:", error);
    }
};
async function handleCreateCurrent() {
    const name = prompt("New Current Name:");
    if (!name) return;
    const id = name.toLowerCase().replace(/\s+/g, '_');
    await saveToRealtimeDB(`currents/${id}`, { name, sparks: {} });
    initArcade();
}

function showBinaryModal(a, b, callback) {
    const modal = document.getElementById('intent-modal');
    const btnA = document.getElementById('choice-a');
    const btnB = document.getElementById('choice-b');
    btnA.textContent = a; btnB.textContent = b;
    modal.style.display = 'flex';
    btnA.onclick = () => { modal.style.display='none'; callback(a); };
    btnB.onclick = () => { modal.style.display='none'; callback(b); };
}
