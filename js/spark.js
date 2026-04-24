import { getArcadeData, saveToRealtimeDB } from '/config/firebase-config.js';
import { watchAuthState } from '/config/auth.js';
import { globalTheme, applyTheme, databaseCache } from './arcade.js';

let allSparks = [];
let currentIndex = -1;
let currentId = '';
let userId = '';

console.log(`%c YERTAL SPARKS LOADED | ${new Date().toLocaleDateString()} @ 16:36:00 `, "background: var(--branding-color); color: var(--bg-color); font-weight: bold; border: 1px solid var(--branding-color); padding: 4px;");

/*
 * Standardizes raw Spark code to fit the responsive Laboratory Viewport.
 * @param {Object} spark - The spark data object from the DB.
 * @returns {string} - The complete HTML string for the iframe.
 */
function wrapCodeInLaboratory(spark) {
    // 1. Extract the code regardless of where it's hidden in the DB object
    const activeCode = spark.code || (spark.data ? spark.data.code : null) || spark.html || (typeof spark === 'string' ? spark : "");

    // 2. Return the full standardized template with theme-aware container coloring
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <style>
                /* The outer 'Stage' of the laboratory */
                body, html { 
                    margin: 0; 
                    padding: 0; 
                    width: 100%; 
                    height: 100%; 
                    overflow: hidden; 
                    
                    /* Apply theme background to the area around the window */
                    background-color: var(--bg-color-mid, #00080f); 
                    
                    /* CENTERED POSITIONING */
                    display: flex; align-items: center; justify-content: center;
                    color: var(--text-main-color, #ffffff);
                    font-family: var(--text-main-font, sans-serif);
                }

                /* The actual simulation viewport */
                canvas { 
                    display: block; 
                    /* STRETCH & CENTER LOGIC */
                    width: 100vw !important; height: 100vh !important; max-width: 100%;
                    max-height: 100%;
                    object-fit: contain;
                    margin: auto;
                    
                    image-rendering: auto; 
                    /* Ensures the canvas background doesn't overwrite our theme */
                    background: transparent !important;
                }

                .system-error {
                    text-align: center;
                    padding: 20px;
                    border: 2px solid var(--error-color, #ff4444);
                    background: var(--bg-color-low, rgba(0,0,0,0.8));
                    color: var(--error-color, #ff4444);
                    text-transform: uppercase;
                    letter-spacing: 1px;
                }
            </style>
        </head>
        <body>
            ${activeCode || '<div class="system-error"><h1>[ System Error ]</h1><p>Diagnostic: No Executable Code Found</p></div>'}

            <script>
                (function() {
                function forceLaboratoryFit() {
                    const cvs = document.querySelector('canvas');
                    if (cvs) {
                    // ADDED: Attempt to force buffer preservation if the library supports it
                        if (cvs.getContext('webgl')) cvs.getContext('webgl', { preserveDrawingBuffer: true });
                        if (cvs.getContext('webgl2')) cvs.getContext('webgl2', { preserveDrawingBuffer: true });

                            cvs.width = window.innerWidth;
                            cvs.height = window.innerHeight;

                            if (typeof window.resize === 'function') window.resize();
                            if (typeof window.setup === 'function') window.setup();
                            if (typeof window.init === 'function') window.init();
                            if (typeof window.resizeCanvas === 'function') {
                                window.resizeCanvas(window.innerWidth, window.innerHeight);
                            }
                        }
                    }

                    window.addEventListener('load', () => {
                        forceLaboratoryFit();
                        setTimeout(forceLaboratoryFit, 150);
                    });

                    window.addEventListener('resize', forceLaboratoryFit);
                })();
            </script>
        </body>
        </html>
    `;
}

/*
 * Objective: Render Spark content and reset HUD visuals.
 * Task: Initialize playable states and reset timing/progress for the new session.
 */
function loadSpark(spark) {
    const container = document.getElementById('spark-content-container');
    const titleEl = document.getElementById('active-spark-name');
    const overlay = document.getElementById('spark-title-overlay');
    const hudStatus = document.getElementById('hud-status');
    const fallbackBtn = document.getElementById('fallback-url-btn');
    
    // 0. HUD CONTROL INITIALIZATION
    window.currentSpark = spark;
    const playPauseBtn = document.getElementById('play-pause-btn');
    const playIcon = document.getElementById('play-icon');
    const curTimeEl = document.getElementById('current-time');
    const totTimeEl = document.getElementById('total-duration');
    const progressFill = document.getElementById('media-progress-bar');

    // CRITICAL FOR TIMING: Reset visuals to zero state immediately
    if (curTimeEl) curTimeEl.textContent = "0:00";
    if (totTimeEl) totTimeEl.textContent = "0:00";
    if (progressFill) progressFill.style.width = "0%";

    // Intelligent Type Detection
    const playableIDs = ['movies', 'videos', 'veo-video', 'arcade-logic', 'games', 'physics-lab', 'optics'];
    const isPlayable = playableIDs.includes(spark.template_type?.toLowerCase()) || 
                       (spark.link && (spark.link.includes('youtube.com') || spark.link.includes('vimeo.com')));

    if (playPauseBtn) {
        playPauseBtn.style.opacity = isPlayable ? '1' : '0.3';
        playPauseBtn.style.pointerEvents = isPlayable ? 'auto' : 'none';
        
        // Default to 'Pause' icon because simulations/videos usually autoplay
        if (playIcon) {
            playIcon.classList.remove('fa-play');
            playIcon.classList.add('fa-pause');
        }
    }

    // 1. IDENTITY & THEME [cite: 2026-02-17]
    if (typeof databaseCache !== 'undefined') {
        applyTheme(globalTheme);
    }
    
    console.log(`%c[YERTAL LAB] Loading Spark: ${spark.name}`, "color: #00f2ff; font-weight: bold;");
        
    container.style.opacity = '0';
    container.innerHTML = '';
    if (hudStatus) hudStatus.textContent = "INITIALIZING...";

    titleEl.textContent = spark.name;
    overlay.style.opacity = "1";
    setTimeout(() => { overlay.style.opacity = "0"; }, 3000);

    // 2. CONTENT INJECTION
    if (spark.link) {
        let finalUrl = spark.link;
        if (finalUrl.includes('youtube.com/watch?v=')) {
            finalUrl = finalUrl.replace('watch?v=', 'embed/') + "?autoplay=1&mute=1&enablejsapi=1";
        }
        
        container.innerHTML = `<iframe id="content-frame" src="${finalUrl}" allow="autoplay; fullscreen"></iframe>`;
        container.style.opacity = '1';
        
    } else {
        const iframe = document.createElement('iframe');
        iframe.id = "content-frame";
        iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms');
        container.appendChild(iframe);

        const doc = iframe.contentWindow.document;
        doc.open();
        
        // Wrap the code – ensure wrapCodeInLaboratory includes the 'TICKER_UPDATE' postMessage logic
        const standardizedCode = wrapCodeInLaboratory(spark);
        
        try {
            doc.write(standardizedCode);
        } catch (e) {
            console.error("[LAB VIEWPORT] Critical Error during doc.write:", e);
        }
        doc.close();

        if (fallbackBtn) fallbackBtn.classList.add('hidden');

        iframe.onload = () => {
            container.style.opacity = '1';
            if (hudStatus) hudStatus.textContent = "SPARK FULLY LOADED";
        };
    }
}

function navigate(dir) {
    currentIndex = (currentIndex + dir + allSparks.length) % allSparks.length;
    const nextSpark = allSparks[currentIndex];
    
    const newUrl = `${window.location.pathname}?current=${currentId}&spark=${nextSpark.id}`;
    window.history.pushState({path: newUrl}, '', newUrl);
    
    loadSpark(nextSpark);
}

function toggleZen() {
    document.body.classList.toggle('zen-active');
}

function togglePlayPause() {
    window.dispatchEvent(new CustomEvent('toggleMedia'));
    const icon = document.getElementById('play-icon');
    if (icon) {
        icon.classList.toggle('fa-play');
        icon.classList.toggle('fa-pause');
    }
}

/*
 * Objective: Initialize HUD and navigation interactions.
 * Task: Restrict navigation to mouse-only via side zones and reserve arrow keys for viewport gameplay.
 */
function setupInteractions() {
    // 1. Navigation: Mouse-Only via side zones
    const prevZone = document.getElementById('prev-zone');
    const nextZone = document.getElementById('next-zone');

    if (prevZone) {
        prevZone.onclick = (e) => {
            e.stopPropagation();
            e.preventDefault();
            console.log("[NAV] Navigating to Previous Spark...");
            navigate(-1);
        };
    }

    if (nextZone) {
        nextZone.onclick = (e) => {
            e.stopPropagation();
            e.preventDefault();
            console.log("[NAV] Navigating to Next Spark...");
            navigate(1);
        };
    }

    // 2. HUD & Cover Bindings
    // ADD: Edit Spark Binding
    const editBtn = document.getElementById('edit-spark-btn');
    if (editBtn) {
        editBtn.onclick = (e) => {
            e.stopPropagation();
            openSparkEditor();
        };
    }
    // 3. UI Toggles & Media Controls
    const zenBtn = document.getElementById('zen-btn');
    if (zenBtn) zenBtn.onclick = toggleZen;

    // ADD THIS: Specific handler for the Zen Exit button
    const exitZenBtn = document.getElementById('exit-zen-btn');
    if (exitZenBtn) {
        exitZenBtn.onclick = (e) => {
            e.stopPropagation(); // Prevent the click from bubbling to the container
            toggleZen();
        };
    }
    const playPauseBtn = document.getElementById('play-pause-btn');
    if (playPauseBtn) {
        playPauseBtn.onclick = (e) => {
            e.stopPropagation();
            togglePlayPause();
        };
    }

    // Toggle play/pause on viewport click (useful for pausing sims/videos)
    const contentContainer = document.getElementById('spark-content-container');
    if (contentContainer) {
        contentContainer.onclick = (e) => {
            // Only trigger if we aren't clicking a link/button inside
            togglePlayPause();
        };
    }

    // 4. Reload Logic: Centralized binding using window.currentSpark
    const reloadBtn = document.getElementById('reload-spark-btn');
    if (reloadBtn) {
        reloadBtn.onclick = () => {
            if (window.currentSpark) {
                console.log("[SYSTEM] Reloading Spark...");
                loadSpark(window.currentSpark);
            }
        };
    }

    // 5. Fallback URL Binding (External Links)
    const fallbackBtn = document.getElementById('fallback-url-btn');
    if (fallbackBtn) {
        fallbackBtn.onclick = () => {
            if (window.currentSpark && window.currentSpark.link) {
                window.open(window.currentSpark.link, '_blank');
            }
        };
    }

    // 6. Exit Logic: Return to Showroom [cite: 2026-02-04]
    const exitBtn = document.getElementById('exit-btn');
    if (exitBtn) {
        exitBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            const params = new URLSearchParams(window.location.search);
            const userSlug = params.get('user') || 'yertal-arcade';

            const container = document.getElementById('spark-content-container');
            if (container) container.innerHTML = '';

            console.log("[SYSTEM] Exiting to Showroom...");
            window.location.href = `/arcade/index.html?user=${userSlug}`;
        }, true); // Capture phase to ensure priority
    }

   // 8. Keyboard Shortcuts: Reserved for System Toggles
    window.onkeydown = (e) => {
        const key = e.key.toLowerCase();

        // Z or Escape for Zen Mode
        if (key === 'z' || key === 'escape') {
            toggleZen();
        }

        // Ctrl+R for a quick logic reset
        if (key === 'r' && e.ctrlKey) {
            e.preventDefault();
            if (window.currentSpark) loadSpark(window.currentSpark);
        }

        // Optional: Spacebar for Play/Pause if not in an input
        if (key === ' ' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
            e.preventDefault();
            togglePlayPause();
        }
    };

    // 9. Auto-Focus Viewport
    const iframe = document.querySelector('#spark-content-container iframe');
    if (iframe) iframe.focus();
}
watchAuthState(async (user) => {
    console.log("%c[AUTH] State Changed", "color: #00ff00;");
    if (!user) return;

    userId = user.uid; 
    const params = new URLSearchParams(window.location.search);
    const pageOwnerSlug = params.get('user'); 
    currentId = params.get('current');
    const initialSparkId = params.get('spark');

    // 1. Helper to scan the cache
    const findOwnerInCache = (data) => {
        const users = data?.users || {};
        // Check for explicit slug match OR fallback to the superuser ID
        return Object.keys(users).find(uid => {
            const profile = users[uid].profile || {};
            return profile.slug === pageOwnerSlug || uid === 'yertal-arcade';
        });
    };

    let ownerUid = findOwnerInCache(databaseCache);

    // 2. Fetch if missing
    if (!databaseCache || Object.keys(databaseCache).length === 0 || !ownerUid) {
        console.log("[CACHE] Cache miss for owner:", pageOwnerSlug, ". Fetching...");
        const freshData = await getArcadeData(); 
        ownerUid = findOwnerInCache(freshData);
    }

// 3. RESOLUTION LOGIC REFINEMENT
const targetUid = ownerUid || userId;
let userRecord = databaseCache?.users?.[targetUid];

// Logic change: If targetUid is found but infrastructure is missing, 
// it's likely a partial cache. Force a refresh.
if (!userRecord || !userRecord.infrastructure) {
    console.log("[SYSTEM] Infrastructure missing for:", targetUid, ". Requesting sync...");
    const freshData = await getArcadeData(); // This should hit the actual DB
    userRecord = freshData?.users?.[targetUid];
}

// Ensure the specific current exists
const currents = userRecord?.infrastructure?.currents || {};
const path = currents[currentId];

if (!path) {
    // Fallback: If 'neural-void' isn't found, try to grab the first available current
    const fallbackCurrent = Object.values(currents)[0];
    if (fallbackCurrent) {
        console.warn("[DATA] Redirecting to fallback current infrastructure.");
        path = fallbackCurrent;
    } else {
        console.error("[DATA] No record for current:", currentId);
        return;
    }
}

    // 4. Load the Spark
    const sparksObj = path.sparks || {};
    allSparks = Object.values(sparksObj).sort((a, b) => (a.created || 0) - (b.created || 0));
    
    // Use the ID from the URL or fallback to the first one
    currentIndex = allSparks.findIndex(s => s.id === initialSparkId);

    if (currentIndex !== -1) {
        loadSpark(allSparks[currentIndex]);
    } else if (allSparks.length > 0) {
        loadSpark(allSparks[0]);
    } else {
        document.getElementById('active-spark-name').textContent = "EMPTY CURRENT";
    }
    
    setupInteractions();
});
window.addEventListener('message', (event) => {
    // 1. Security check: Ensure we have data
    if (!event.data || event.data.type !== 'TICKER_UPDATE') return;

    const { currentTime, duration } = event.data;
    
    // 2. Select the HTML elements from your spark.html
    const curTimeEl = document.getElementById('current-time');
    const totTimeEl = document.getElementById('total-duration');
    const progressFill = document.getElementById('media-progress-bar');

    // 3. Formatter: Converts seconds (65) to string (01:05)
    const format = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // 4. Update the HUD
    if (curTimeEl) curTimeEl.textContent = format(currentTime);
    if (totTimeEl) totTimeEl.textContent = format(duration);
    
    if (progressFill && duration > 0) {
        const percent = (currentTime / duration) * 100;
        progressFill.style.width = `${percent}%`;
    }
});
async function openSparkEditor() {
    const spark = window.currentSpark;
    if (!spark) return;

    let editorOverlay = document.getElementById('spark-editor-modal');
    if (!editorOverlay) {
        editorOverlay = document.createElement('div');
        editorOverlay.id = 'spark-editor-modal';
        editorOverlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(0, 0, 0, 0.85); backdrop-filter: blur(8px);
            display: flex; justify-content: center; align-items: center; z-index: 10000;
        `;
        document.body.appendChild(editorOverlay);
    }

    editorOverlay.innerHTML = `
        <div class="hud-body-centered glass-3d w-full max-w-xl p-8">
            <h2 class="hud-title-metallic">Modify Spark</h2>
            <hr class="metallic-divider w-full">

            <div class="hud-input-group mt-4">
                <label class="hud-label-metallic">Internal Identity (Name)</label>
                <input type="text" id="edit-name-input" value="${spark.name}" class="hud-input">
            </div>

            <div class="hud-input-group">
                <label class="hud-label-metallic">Choose Cover</label>
                <div id="unsplash-grid" class="grid grid-cols-4 gap-3 mb-2 experiment-zone min-h-[120px]">
                    <div class="col-span-4 text-center metallic-text py-10">Scanning Assets...</div>
                </div>
                <div id="attribution-label" class="hud-subtitle-info text-[10px] italic mb-6 min-h-[15px]"></div>
            </div>

            <div class="flex gap-4 w-full justify-center">
                <button onclick="document.getElementById('spark-editor-modal').remove()" 
                        class="ethereal-btn-xs">ABORT</button>
                <button id="save-spark-changes" 
                        class="arcade-button px-10">SAVE & SYNC</button>
            </div>
        </div>
    `;

    try {
        const searchQuery = spark.template_type || spark.name || "technology";
        // fetchUnsplashCovers must return an array of objects: { url, photographer }
        const images = await fetchUnsplashCovers(searchQuery); 
        const grid = document.getElementById('unsplash-grid');
        const attrLabel = document.getElementById('attribution-label');
        
        if (grid) {
            grid.innerHTML = '';
            if (images && images.length > 0) {
                // Slicing to 4 images to match grid-cols-4
                images.slice(0, 4).forEach(imgData => {
                    const img = document.createElement('img');
                    // imgData should be an object from your updated fetchUnsplashCovers
                    img.src = imgData.url; 
                    img.className = 'h-20 w-full object-cover cursor-pointer border-2 border-transparent hover:border-cyan-400 transition-all duration-300 shadow-lg';
                    
                    img.onclick = () => {
                        // UI Visual Update
                        document.querySelectorAll('#unsplash-grid img').forEach(i => i.style.borderColor = 'transparent');
                        img.style.borderColor = 'var(--branding-color)';
                        
                        // Update dynamic label
                        attrLabel.textContent = `Photo By: ${imgData.photographer}`;
                        
                        // Set selection for save logic
                        window.selectedCover = imgData.url;
                        window.selectedPhotographer = imgData.photographer;
                    };
                    grid.appendChild(img);
                });
            } else {
                throw new Error("Empty Assets");
            }
        }
    } catch (e) {
        console.warn("[SYSTEM] Asset API Offline. Loading local recovery library.");
        const grid = document.getElementById('unsplash-grid');
        const placeholders = [
            'assets/covers/default_optics.jpg', 
            'assets/covers/default_logic.jpg'
        ];
        grid.innerHTML = placeholders.map(p => `<img src="${p}" class="h-20 w-full object-cover">`).join('');
    }

    document.getElementById('save-spark-changes').onclick = async () => {
        const newName = document.getElementById('edit-name-input').value;
        const params = new URLSearchParams(window.location.search);
        
        const userSlug = params.get('user') || 'yertal-arcade'; 
        const currentId = params.get('current');
        const sparkId = params.get('spark') || spark.id;

        if (!currentId || !sparkId) {
            console.error("[CRITICAL] Missing identifiers for DB sync.");
            return;
        }

        spark.name = newName;
        if (window.selectedCover) {
            spark.cover = window.selectedCover;
            spark.photographer = window.selectedPhotographer; // Save attribution to DB
        }

        const dbPath = `users/${userSlug}/infrastructure/currents/${currentId}/sparks/${sparkId}`;
        
        try {
            await window.saveToRealtimeDB(dbPath, spark);
            const activeHeader = document.getElementById('active-spark-name');
            if (activeHeader) activeHeader.textContent = newName;
            
            document.getElementById('spark-editor-modal').remove();
            console.log(`[DATABASE] Sync Complete: ${dbPath}`);
        } catch (error) {
            console.error("[DATABASE] Sync Failure:", error);
        }
    };
}

async function fetchUnsplashCovers(query) {
    // 1. Precise retrieval from the imported databaseCache
    const ACCESS_KEY = databaseCache?.app_manifest?.unsplashkey; 
    
    if (!ACCESS_KEY) {
        console.warn("[SYSTEM] Unsplash Key missing from databaseCache. Verify arcade.js sync.");
        return [];
    }

    // 2. Prepare the request with the dynamic key and encoded query
    const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=10&orientation=landscape&client_id=${ACCESS_KEY}`;

    try {
        const response = await fetch(url);
        
        // 3. Status Check (prevents 401/403 crashes)
        if (!response.ok) {
            console.error(`[SYSTEM] Unsplash API Error: ${response.status}`);
            return [];
        }

        const dataResult = await response.json();
        
        // 4. Return objects to support photographer credit in openSparkEditor
        if (dataResult && dataResult.results) {
            return dataResult.results.map(img => ({
                url: img.urls.regular,
                photographer: img.user.name 
            }));
        }
        
        return [];
        
    } catch (error) {
        console.error("[SYSTEM] Network/Fetch Error:", error);
        return [];
    }
}
