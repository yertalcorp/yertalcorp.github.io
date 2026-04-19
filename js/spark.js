import { getArcadeData, saveToRealtimeDB } from '/config/firebase-config.js';
import { watchAuthState } from '/config/auth.js';
import { globalTheme, applyTheme, databaseCache } from './arcade.js';

let allSparks = [];
let currentIndex = -1;
let currentId = '';
let userId = '';
let thumbInterval = null;

console.log(`%c YERTAL SPARKS LOADED | ${new Date().toLocaleDateString()} @ 11:05:00 `, "background: var(--bg-color); color: var(--fg-color); font-weight: bold; border: 1px solid var(--branding-color); padding: 4px;");

// --- START CAPTURE & CROP STATE ---
let currentBurstFrames = []; 
let cropStart = null;
let cropArea = { x: 0, y: 0, w: 0, h: 0 };
let sourceImage = new Image();
const IMGBB_API_KEY = "YOUR_KEY"; // Replace with your actual ImgBB API key
// --- END CAPTURE & CROP STATE ---

/*
 * BURST CAPTURE ENGINE
 * Captures 6 frames with a 500ms gap to catch movement for selection.
 */
async function captureBurst() {
    currentBurstFrames = []; // Reset
    const status = document.getElementById('hud-status');
    
    console.log("%c[CAPTURE] Starting Burst Sequence...", "color: #ff00ff; font-weight: bold;");
    
    for (let i = 0; i < 6; i++) {
        try {
            const iframe = document.getElementById('content-frame');
            if (!iframe) {
                console.warn("[CAPTURE] No content-frame found for burst.");
                return;
            }

            if (status) status.textContent = `BURSTING ${i + 1}/6...`;
            
            const canvas = await html2canvas(iframe.contentWindow.document.body, { 
                useCORS: true, 
                scale: 0.4,
                logging: false,
                backgroundColor: null
            });
            
            const imageData = canvas.toDataURL('image/jpeg', 0.7).split(',')[1];
            const formData = new FormData();
            formData.append("image", imageData);

            const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
                method: "POST",
                body: formData
            });

            const result = await response.json();
            if (result.success) {
                const url = result.data.url;
                currentBurstFrames.push(url);
                console.log(`[CAPTURE] Frame ${i+1} uploaded: ${url}`);
                if (i === 0) updateThumbCanvas(url);
            }
            
            await new Promise(r => setTimeout(r, 500)); 
        } catch (e) {
            console.error("[CAPTURE] Burst frame failed", e);
        }
    }
    if (status) status.textContent = "BURST CAPTURE READY";
}

/*
 * BURST SELECTION GRID
 * Opens the HUD to pick which of the 6 shots to crop.
 */
function openBurstPicker() {
    const hud = document.getElementById('burst-picker-hud');
    const grid = document.getElementById('burst-grid');
    grid.innerHTML = ""; // Clear old

    if (currentBurstFrames.length === 0) {
        console.warn("[HUD] No burst frames available. Try waiting for auto-capture.");
        if (document.getElementById('hud-status')) {
            document.getElementById('hud-status').textContent = "NO BURST DATA";
        }
        return;
    }

    currentBurstFrames.forEach((url) => {
        const img = document.createElement('img');
        img.src = url;
        img.className = "w-40 h-40 object-cover border-2 border-transparent hover:border-cyan-400 cursor-pointer transition-all rounded shadow-lg";
        img.onclick = () => {
            console.log("[HUD] Frame selected for cropping:", url);
            closeBurstPicker();
            openCropTool(url);
        };
        grid.appendChild(img);
    });

    hud.classList.remove('hidden');
}

/*
 * PRECISION CROP TOOL
 * Handles mouse logic for selecting a specific area of the capture.
 */
function openCropTool(imageUrl) {
    const modal = document.getElementById('crop-modal');
    const canvas = document.getElementById('crop-canvas');
    const ctx = canvas.getContext('2d');

    sourceImage = new Image();
    sourceImage.crossOrigin = "anonymous";
    sourceImage.onload = () => {
        // Match canvas to image aspect ratio
        canvas.width = sourceImage.width;
        canvas.height = sourceImage.height;
        ctx.drawImage(sourceImage, 0, 0);
        modal.classList.remove('hidden');
        
        // Reset crop area
        cropArea = { x: 0, y: 0, w: canvas.width, h: canvas.height };
    };
    sourceImage.src = imageUrl;

    // Mouse Logic for Selection
    canvas.onmousedown = (e) => {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        cropStart = { 
            x: (e.clientX - rect.left) * scaleX, 
            y: (e.clientY - rect.top) * scaleY 
        };
    };

    canvas.onmousemove = (e) => {
        if (!cropStart) return;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const currentX = (e.clientX - rect.left) * scaleX;
        const currentY = (e.clientY - rect.top) * scaleY;
        
        // Redraw image + selection rectangle
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(sourceImage, 0, 0);
        ctx.strokeStyle = "#00f2ff";
        ctx.lineWidth = 4;
        ctx.strokeRect(cropStart.x, cropStart.y, currentX - cropStart.x, currentY - cropStart.y);
        
        cropArea = { x: cropStart.x, y: cropStart.y, w: currentX - cropStart.x, h: currentY - cropStart.y };
    };

    canvas.onmouseup = () => { cropStart = null; };
}

/*
 * FINAL UPLOAD
 * Crops the image locally and sends the final selection to ImgBB and Firebase.
 */
async function finalizeAndUploadCrop() {
    const status = document.getElementById('hud-status');
    const finalCanvas = document.createElement('canvas');
    const finalCtx = finalCanvas.getContext('2d');
    
    // Set final size to the cropped dimensions
    finalCanvas.width = Math.abs(cropArea.w);
    finalCanvas.height = Math.abs(cropArea.h);

    finalCtx.drawImage(
        sourceImage, 
        cropArea.x, cropArea.y, cropArea.w, cropArea.h, // Source
        0, 0, finalCanvas.width, finalCanvas.height    // Destination
    );

    try {
        if (status) status.textContent = "SYNCING CROP...";
        const base64Data = finalCanvas.toDataURL('image/jpeg', 0.9).split(',')[1];
        const formData = new FormData();
        formData.append("image", base64Data);

        const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
            method: "POST",
            body: formData
        });

        const result = await response.json();
        if (result.success) {
            const spark = allSparks[currentIndex];
            const cloudUrl = result.data.url;
            const path = `users/${userId}/infrastructure/currents/${currentId}/sparks/${spark.id}/imageUrl`;
            
            await saveToRealtimeDB(path, cloudUrl);
            updateThumbCanvas(cloudUrl);
            
            console.log("[CROP] Final cover saved to DB:", cloudUrl);
            if (status) status.textContent = "COVER FINALIZED";
            closeCropModal();
        }
    } catch (e) {
        if (status) status.textContent = "SYNC FAILED";
        console.error("[CROP] Manual save failed:", e);
    }
}

function closeBurstPicker() {
    document.getElementById('burst-picker-hud').classList.add('hidden');
}

function closeCropModal() {
    document.getElementById('crop-modal').classList.add('hidden');
}

function updateThumbCanvas(url) {
    const canvas = document.getElementById('live-thumb-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    img.src = url;
}

/*
 * Clips the edges and resizes a screenshot to 240x135.
 * @param {string} dataUrl - The raw screenshot DataURL.
 */
async function convertScreenshotToImage(dataUrl) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const thumbCanvas = document.createElement('canvas');
            const ctx = thumbCanvas.getContext('2d');

            // Target dimensions
            thumbCanvas.width = 240;
            thumbCanvas.height = 135;

            // Define the "Clean Clip" (shaving 5% off the edges)
            const margin = 0.05;
            const sx = img.width * margin;
            const sy = img.height * margin;
            const sw = img.width * (1 - (margin * 2));
            const sh = img.height * (1 - (margin * 2));

            // Draw the clipped portion into the 240x135 thumbnail
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, sx, sy, sw, sh, 0, 0, 240, 135);

            resolve(thumbCanvas.toDataURL('image/png'));
        };
        img.src = dataUrl;
    });
}

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
    
    if (thumbInterval) {
        clearInterval(thumbInterval);
        thumbInterval = null;
    }
    
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
        
        setTimeout(() => {
            startLiveThumbnail();
            captureBurst();
        }, 2000);

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
            startLiveThumbnail();
            captureBurst(); 
            if (hudStatus) hudStatus.textContent = "AUTO-CAPTURE ACTIVE";
        };
    }
}

function startLiveThumbnail() {
    if (thumbInterval) clearInterval(thumbInterval);
    
    const canvas = document.getElementById('live-thumb-canvas');
    if (!canvas) return; 
    const ctx = canvas.getContext('2d');
    
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    thumbInterval = setInterval(async () => {
        try {
            const shot = await html2canvas(document.getElementById('spark-content-container'), {
                useCORS: true,
                scale: 0.2,
                backgroundColor: null
            });
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(shot, 0, 0, canvas.width, canvas.height);
        } catch (e) { 
            console.warn("Thumbnail capture paused: Cross-origin protection.");
        }
    }, 5000);
}

/*
 * LEGACY METHOD - Preserved for direct saves
 */
async function setPermanentCover() {
    const status = document.getElementById('hud-status');
    const spark = allSparks[currentIndex];
    
    if (!spark) return;
    status.textContent = "SAVING COVER...";

    try {
        const iframe = document.getElementById('content-frame');
        const canvas = await html2canvas(iframe.contentWindow.document.body, {
            useCORS: true,
            scale: 0.5,
            logging: false, 
            allowTaint: true,
            backgroundColor: null
        });
        
        const thumbCanvas = document.getElementById('live-thumb-canvas');
        if (thumbCanvas) {
            const thumbCtx = thumbCanvas.getContext('2d');
            thumbCanvas.width = thumbCanvas.offsetWidth;
            thumbCanvas.height = thumbCanvas.offsetHeight;
            thumbCtx.clearRect(0, 0, thumbCanvas.width, thumbCanvas.height);
            thumbCtx.drawImage(canvas, 0, 0, thumbCanvas.width, thumbCanvas.height);
        }

        const imageData = canvas.toDataURL('image/jpeg', 0.8);
        if (imageData.length < 1000) throw new Error("Blank Capture Detected");

        const path = `users/${userId}/infrastructure/currents/${currentId}/sparks/${spark.id}/image`;
        await saveToRealtimeDB(path, imageData);
        
        status.textContent = "COVER UPDATED!";
        setTimeout(() => status.textContent = "AUTO-CAPTURE ACTIVE", 2000);
    } catch (e) {
        status.textContent = "SAVE FAILED";
        console.error("Manual save failed:", e);
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
    const setCoverBtn = document.getElementById('set-cover-btn');
    if (setCoverBtn) setCoverBtn.onclick = openBurstPicker;

    const thumbTrigger = document.getElementById('thumb-trigger');
    if (thumbTrigger) thumbTrigger.onclick = openBurstPicker;

    // 3. UI Toggles & Media Controls
    const zenBtn = document.getElementById('zen-btn');
    if (zenBtn) zenBtn.onclick = toggleZen;

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

            if (thumbInterval) {
                clearInterval(thumbInterval);
                thumbInterval = null;
            }

            const container = document.getElementById('spark-content-container');
            if (container) container.innerHTML = '';

            console.log("[SYSTEM] Exiting to Showroom...");
            window.location.href = `/arcade/index.html?user=${userSlug}`;
        }, true); // Capture phase to ensure priority
    }

    // 7. Manual File Upload Trigger
    const manualUpload = document.getElementById('manual-upload');
    if (manualUpload) {
        manualUpload.onchange = (e) => {
            if (typeof handleManualUpload === 'function') {
                handleManualUpload(e);
            }
        };
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
// Bind UI actions to window scope for HTML access
window.loadSpark = loadSpark;
window.closeBurstPicker = closeBurstPicker;
window.closeCropModal = closeCropModal;
window.finalizeAndUploadCrop = finalizeAndUploadCrop;
