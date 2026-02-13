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
        window.location.replace('../index.html'); 
    } else if (newUser) {
        initArcade();
    }
});

async function initArcade() {
    try {
        const response = await fetch(`${firebaseConfig.databaseURL}/.json`);
        databaseCache = await response.json();
        
        // 1. APPLY UI GENETICS
        const ui = databaseCache.settings['ui-settings'];
        const root = document.documentElement;
        
        root.style.setProperty('--neon-color', ui['color-neon']);
        root.style.setProperty('--accent-color', ui['color-accent']);
        root.style.setProperty('--nav-font', ui.nav_font);
        
        const fontLink = document.getElementById('google-fonts-link');
        if (fontLink) fontLink.href = databaseCache.settings.external_assets.google_fonts_url;

        // 2. HERO HUD POPULATION
        const hero = databaseCache.arcade_infrastructure.hero;
        document.getElementById('hero-heading').textContent = hero.title;
        document.getElementById('hero-subheading').textContent = hero.subtitle;
        
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

        renderCurrents(databaseCache.arcade_infrastructure.currents);
        document.body.style.opacity = '1';

    } catch (e) { 
        console.error("Laboratory Initialization Failed:", e); 
        document.getElementById('engine-status-text').textContent = "SYSTEM OFFLINE";
    }
}

function renderCurrents(currents) {
    const container = document.getElementById('currents-container');
    if (!container || !currents) return;

    // Pull limits and types from databaseCache
    const limits = databaseCache.settings?.plan_limits?.free || { max_currents: 16, max_sparks_per_current: 48 };
    const currentTypes = databaseCache.settings?.['arcade-current-types'] || [];
    const currentsArray = Object.values(currents).slice(0, limits.max_currents);
    
    container.innerHTML = currentsArray.map(current => {
        const sparkCount = current.sparks ? Object.keys(current.sparks).length : 0;
        
        // Resolve Type Metadata
        const typeData = currentTypes.find(t => t.id === current.type_ref);
        const templateName = typeData ? typeData.name : "Custom Logic";

        return `
        <section class="current-block mb-12 w-full border-b border-white/5 pb-8">
            <div class="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-1">
                <div class="flex items-center gap-4 flex-grow w-full">
                    <h2 class="text-2xl font-black italic uppercase tracking-tighter text-white mb-0">
                        ${current.name} 
                        <span class="text-[10px] text-slate-500 ml-2 font-normal not-italic">[${sparkCount}/${limits.max_sparks_per_current}]</span>
                    </h2>
                    <div class="h-[1px] flex-grow bg-gradient-to-r from-[var(--neon-color)]/40 to-transparent"></div>
                </div>
                
                <div class="flex items-center gap-2 bg-white/5 p-2 rounded-lg border border-white/10 w-full md:w-auto">
                    <input type="text" id="input-${current.id}" 
                           placeholder="Type to generate..." 
                           class="bg-black/40 border-none text-[10px] text-white px-3 py-1 rounded flex-grow md:w-48 outline-none focus:ring-1 focus:ring-[var(--neon-color)]">
                    
                    <button onclick="handleCreation('${current.id}')" 
                            ${sparkCount >= limits.max_sparks_per_current ? 'disabled' : ''}
                            class="spark-button bg-[var(--neon-color)]/20 hover:bg-[var(--neon-color)]/40 disabled:opacity-30 disabled:cursor-not-allowed text-[var(--neon-color)] text-[9px] font-bold px-4 py-1 rounded transition uppercase">
                        ${sparkCount >= limits.max_sparks_per_current ? 'Full' : 'Generate'}
                    </button>
                </div>
            </div>

            <div class="current-metadata-row mb-6 flex flex-col gap-0.5">
                <div class="text-[9px] uppercase tracking-tight text-white/80">
                    based on <span class="text-[var(--neon-color)] font-bold italic tracking-normal">${templateName}</span>
                </div>
                <div class="text-[8px] text-slate-500 font-mono uppercase tracking-[0.2em] flex gap-3 items-center">
                    <span class="flex items-center gap-1">
                        <span class="text-[var(--neon-color)] opacity-50">●</span> 
                        ARCHITECT: ${current.owner || 'yertal-arcade'}
                    </span>
                    <span class="opacity-20">|</span>
                    <span>EST: ${formatTimeAgo(current.created || Date.now())}</span>
                </div>
            </div>
            
            <div class="grid gap-6 w-full">
                ${renderSparks(current.sparks, current.id)}
            </div>
        </section>
    `}).join('');
}
function renderSparks(sparks, currentId) {
    if (!sparks || Object.keys(sparks).length === 0) {
        return `
            <div class="col-span-full py-10 border border-dashed border-white/10 rounded-xl text-center">
                <p class="text-slate-500 text-[9px] uppercase tracking-widest italic">No sparks generated in this current. Initialize via HUD.</p>
            </div>`;
    }

    const sortedSparks = Object.values(sparks).sort((a, b) => b.created - a.created);

    return sortedSparks.map(spark => {
        const isMedia = /video|movie|music/i.test(spark.template_type || '');
        const currentUserPrefix = user ? user.email.split('@')[0] : null;
        const canDelete = (currentUserPrefix === spark.owner) || (user && user.email === 'yertal-arcade@gmail.com');
        
        const hasRealCover = spark.image && !spark.image.includes('default.jpg');
        const viewportLink = `spark.html?current=${currentId}&spark=${spark.id}`;

        return `
            <div class="spark-unit flex flex-col gap-3 w-full">
                <div class="action-card glass p-4 rounded-xl border border-white/5 hover:border-[var(--neon-color)] transition-all group w-full cursor-pointer relative mt-2"
                     onclick="window.open('${viewportLink}', '_blank')">
                    
                    <div class="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black border border-white/20 px-4 py-0.5 rounded-sm z-20 group-hover:border-[var(--neon-color)] transition-colors">
                        <h4 class="text-white font-black text-[9px] uppercase tracking-tighter mb-0 whitespace-nowrap">
                            ${spark.name}
                        </h4>
                    </div>
                    
                    <div class="absolute top-3 right-3 text-[8px] font-black text-white/10 group-hover:text-[var(--neon-color)] transition-colors">#${spark.internal_rank || 0}</div>
                    
                    <div class="card-preview mb-4 overflow-hidden rounded-lg bg-black/40 aspect-video flex items-center justify-center relative border border-white/5">
                        ${isMedia ? `
                            <div class="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/0 transition-all z-10">
                                 <div class="w-8 h-8 rounded-full bg-[var(--neon-color)]/20 flex items-center justify-center border border-[var(--neon-color)]/40 shadow-[0_0_15px_rgba(var(--neon-color),0.2)]">
                                    <div class="w-0 h-0 border-t-[5px] border-t-transparent border-l-[8px] border-l-white border-b-[5px] border-b-transparent ml-1"></div>
                                 </div>
                            </div>
                        ` : ''}
                        
                        <img src="${spark.image || '/assets/thumbnails/default.jpg'}" alt="Preview" 
                             class="w-full h-full object-cover ${hasRealCover ? 'opacity-100' : 'opacity-20 grayscale'} group-hover:scale-105 transition duration-500">
                        
                        ${!hasRealCover ? `
                            <div class="absolute inset-0 flex items-center justify-center text-[7px] text-white/40 uppercase tracking-[0.4em] font-mono">
                                Awaiting Visual
                            </div>
                        ` : ''}
                    </div>

                    <div class="flex justify-between items-center px-2">
                        <div class="flex gap-4">
                            <button onclick="event.stopPropagation(); handleCoverAction('${currentId}', '${spark.id}')" 
                                    class="text-[9px] ${hasRealCover ? 'text-slate-400' : 'text-[var(--neon-color)]'} hover:text-white uppercase font-black transition flex items-center gap-1">
                                <span class="text-[11px]">${hasRealCover ? '✎' : '📷'}</span> 
                                ${hasRealCover ? 'Edit Cover' : 'Preview & Capture'}
                            </button>

                            <button onclick="event.stopPropagation(); copyLink('?current=${currentId}&spark=${spark.id}')" 
                                    class="text-[9px] text-slate-400 hover:text-[var(--neon-color)] uppercase font-bold transition flex items-center gap-1">
                                <span class="opacity-50">#</span> SHARE
                            </button>
                        </div>
        
                        ${canDelete ? `
                            <button onclick="event.stopPropagation(); deleteSpark('${currentId}', '${spark.id}', '${spark.owner}')" 
                                    class="text-[9px] text-red-500/40 hover:text-red-500 uppercase font-black transition tracking-tighter">
                                [ DECOMMISSION ]
                            </button>
                        ` : ''}
                    </div>
                </div>

                <div class="card-stats-row flex justify-between items-center px-2 text-[9px] uppercase tracking-widest font-bold">
                    <div class="flex gap-1 text-white"><span>${spark.stats?.views || 0}</span><span class="text-slate-500">Views</span></div>
                    <div class="flex gap-1 text-white"><span>${spark.stats?.likes || 0}</span><span class="text-slate-500">Likes</span></div>
                    <div class="flex gap-1 text-white"><span>${spark.stats?.tips || 0}</span><span class="text-slate-500">Tips</span></div>
                </div>
            </div>
        `;
    }).join('');
}

window.copyLink = (params) => {
    const fullUrl = `${window.location.origin}${window.location.pathname}${params}`;
    navigator.clipboard.writeText(fullUrl).then(() => {
        const statusElement = document.getElementById('engine-status-text');
        if (statusElement) {
            const original = statusElement.textContent;
            statusElement.textContent = "LINK ENCRYPTED TO CLIPBOARD";
            statusElement.style.color = "var(--neon-color)";
            setTimeout(() => {
                statusElement.textContent = original;
                statusElement.style.color = "";
            }, 2500);
        }
    });
};

window.handleCreation = async (currentId) => {
    const promptInput = document.getElementById(`input-${currentId}`);
    const input = promptInput ? promptInput.value.trim() : '';
    if (!input) return;

    const status = document.getElementById('engine-status-text');
    status.textContent = "CLASSIFYING INTENT...";

    // 1. Ask Gemini to classify the intent based on your available types
    const typeNames = databaseCache.settings['arcade-current-types'].map(t => t.name).join(', ');
    const classificationPrompt = `Analyze this user request: "${input}". 
    Pick the best category from this list: [${typeNames}]. 
    If it doesn't fit any, respond with "Custom". 
    Return ONLY the name of the category.`;

    try {
        const detectedCategoryName = await callGeminiAPI(classificationPrompt, 1, 'text');
        const presets = Object.values(databaseCache.settings['arcade-current-types'] || {});
        
        // 2. Find the preset metadata (for the image/logic style)
        let template = presets.find(t => t.name.toLowerCase() === detectedCategoryName.toLowerCase()) || 
                       presets.find(t => t.id === 'custom');

        const finalName = template.name;
        const finalImage = template.image;
        
        // 3. Logic Selection
        const isUrl = /^(http|https):\/\/[^ "]+$/.test(input);
        let mode = (template.logic === 'source' || isUrl) ? 'sourcing' : 'prompt';

        executeMassSpark(currentId, input, mode, finalName, finalImage);
        if (promptInput) promptInput.value = '';

    } catch (e) {
        console.error("Classification failed, falling back to Custom:", e);
        executeMassSpark(currentId, input, 'prompt', 'Custom', '/assets/thumbnails/default.jpg');
    }
};

window.handleCoverAction = (currentId, sparkId) => {
    // Both capture and edit now happen within the same specialized viewport
    const viewportUrl = `spark.html?current=${currentId}&spark=${sparkId}`;
    window.open(viewportUrl, '_blank');
};

async function executeMassSpark(currentId, prompt, mode, templateName, templateUrl) {
    const status = document.getElementById('engine-status-text');
    const countMatch = prompt.match(/\d+/);
    const count = countMatch ? Math.min(parseInt(countMatch[0]), 48) : 6;
    
    status.textContent = `GENERATING ${count} SPARKS...`;

    try {
        if (mode === 'sourcing') {
            const links = await callGeminiAPI(prompt, count, 'source');
            for (const item of links) {
                // Pass null for image to force the "Awaiting Visual" state
                await saveSpark(currentId, { ...item, type: 'link', image: null }, templateName, '/assets/thumbnails/default.jpg');
            }
        } else {
            for (let i = 0; i < count; i++) {
                const code = await callGeminiAPI(prompt, i, 'code');
                // Pass null for image to force the "Awaiting Visual" state
                await saveSpark(currentId, { name: `${prompt} #${i+1}`, code, type: 'code', image: null }, templateName, '/assets/thumbnails/default.jpg');
            }
        }
        status.textContent = "READY";
        initArcade();
    } catch (e) { 
        console.error("Mass Spark Failed:", e);
        status.textContent = "ERROR"; 
    }
}

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
    
async function saveSpark(currentId, data, detectedTemplate = 'Custom', templateUrl = '/assets/thumbnails/custom.jpg') {
    const sparkId = `spark_${Date.now()}_${Math.floor(Math.random()*1000)}`;
    const dbPath = `arcade_infrastructure/currents/${currentId}/sparks/${sparkId}`;
    
    const currentCurrent = Object.values(databaseCache.arcade_infrastructure.currents).find(c => c.id === currentId);
    const rank = currentCurrent && currentCurrent.sparks ? Object.keys(currentCurrent.sparks).length + 1 : 1;

    await saveToRealtimeDB(dbPath, {
        id: sparkId,
        name: data.name || "Unnamed Spark",
        desc: data.desc || "AI generated atmospheric logic.",
        owner: user ? user.email.split('@')[0] : "yertal-arcade",
        
        created: Date.now(),
        template_type: detectedTemplate,
        image: data.image || templateUrl,
        internal_rank: rank,
        
        code: data.code || null,
        link: data.link || null,

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

window.deleteSpark = async (currentId, sparkId, ownerPrefix) => {
    const currentUserPrefix = user ? user.email.split('@')[0] : null;
    const isSuperUser = user && user.email === 'yertal-arcade@gmail.com';
    const isOwner = currentUserPrefix === ownerPrefix;

    if (!isOwner && !isSuperUser) {
        alert("Unauthorized: Only the Spark architect or Yertal Super-user can decommission this.");
        return;
    }

    if (!confirm("Are you sure you want to decommission this Spark? This action is irreversible.")) return;

    const dbPath = `arcade_infrastructure/currents/${currentId}/sparks/${sparkId}`;
    try {
        await saveToRealtimeDB(dbPath, null); 
        initArcade(); 
    } catch (error) {
        console.error("Decommission failed:", error);
    }
};

async function handleCreateCurrent() {
    const name = prompt("New Current Name:");
    if (!name) return;

    const currentTypes = databaseCache.settings?.['arcade-current-types'] || [];
    const typeList = currentTypes.map((t, i) => `${i + 1}. ${t.name}`).join('\n');
    const typeChoice = prompt(`Select Type (Number):\n${typeList}`, "1");
    
    const selectedType = currentTypes[parseInt(typeChoice) - 1] || { id: 'custom' };
    const id = name.toLowerCase().replace(/\s+/g, '_');

    await saveToRealtimeDB(`arcade_infrastructure/currents/${id}`, { 
        id, 
        name, 
        type_ref: selectedType.id,
        owner: user ? user.email.split('@')[0] : "yertal-arcade",
        created: Date.now(),
        sparks: {} 
    });
    initArcade();
}

function showBinaryModal(a, b, callback) {
    const modal = document.getElementById('intent-modal');
    const btnA = document.getElementById('choice-a');
    const btnB = document.getElementById('choice-b');

    // MODIFIED: Ensure text is placed in the innermost span if your buttons use them
    if (btnA.querySelector('.inner-content')) {
     btnA.querySelector('.inner-content').textContent = a;
     btnB.querySelector('.inner-content').textContent = b;
    } else {
     btnA.textContent = a;
     btnB.textContent = b;
    }

    // MODIFIED: Handle both display style and Tailwind 'hidden' class
    modal.classList.remove('hidden');
    modal.style.display = 'flex';

    btnA.onclick = () => { 
        modal.classList.add('hidden');
        modal.style.display = 'none'; 
        callback(a); 
    };

    btnB.onclick = () => { 
        modal.classList.add('hidden');
        modal.style.display = 'none'; 
        callback(b); 
    };
}
