import { getArcadeData, saveToRealtimeDB } from '/config/firebase-config.js';
import { watchAuthState } from '/config/auth.js';

let allSparks = [];
let currentIndex = -1;
let currentId = '';
let userId = '';
let thumbInterval = null;

console.log(`%c YERTAL SPARKS LOADED | ${new Date().toLocaleDateString()} @ 22:03:00 `, "background: var(--bg-color); color: var(--fg-color); font-weight: bold; border: 1px solid var(--branding-color); padding: 4px;");

let currentBurstFrames = []; // Temporary storage for the 6 URLs

function openBurstPicker() {
    const hud = document.getElementById('burst-picker-hud');
    const grid = document.getElementById('burst-grid');
    grid.innerHTML = ""; // Clear old

    currentBurstFrames.forEach((url) => {
        const img = document.createElement('img');
        img.src = url;
        img.className = "w-40 h-40 object-cover border-2 border-transparent hover:border-cyan-400 cursor-pointer transition-all";
        img.onclick = () => saveFinalSelection(url);
        grid.appendChild(img);
    });

    hud.classList.remove('hidden');
}

async function saveFinalSelection(selectedUrl) {
    const spark = allSparks[currentIndex];
    const path = `users/${userId}/infrastructure/currents/${currentId}/sparks/${spark.id}/imageUrl`;
    
    await saveToRealtimeDB(path, selectedUrl);
    updateThumbCanvas(selectedUrl);
    closeBurstPicker();
    document.getElementById('hud-status').textContent = "COVER FINALIZED";
}

function closeBurstPicker() {
    document.getElementById('burst-picker-hud').classList.add('hidden');
}

// Update your button listener
document.getElementById('set-cover-btn').onclick = openBurstPicker;
async function captureBurst() {
    const IMGBB_API_KEY = "YOUR_KEY";
    currentBurstFrames = []; // Reset
    const status = document.getElementById('hud-status');
    
    // Capture 6 frames with a 500ms gap to catch movement
    for (let i = 0; i < 6; i++) {
        try {
            const iframe = document.getElementById('content-frame');
            const canvas = await html2canvas(iframe.contentWindow.document.body, { useCORS: true, scale: 0.4 });
            const imageData = canvas.toDataURL('image/jpeg', 0.7).split(',')[1];

            const formData = new FormData();
            formData.append("image", imageData);

            const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
                method: "POST",
                body: formData
            });

            const result = await response.json();
            if (result.success) {
                currentBurstFrames.push(result.data.url);
                // Set the very first one as the immediate preview
                if (i === 0) updateThumbCanvas(result.data.url);
            }
            
            // Wait 500ms before next shot
            await new Promise(r => setTimeout(r, 500));
        } catch (e) {
            console.error("Burst frame failed", e);
        }
    }
    status.textContent = "BURST CAPTURE READY";
}

function updateThumbCanvas(url) {
    const canvas = document.getElementById('live-thumb-canvas');
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


watchAuthState(async (user) => {
    console.log("Auth State Changed. User:", user ? user.uid : "Logged Out");
    if (!user) return;

    userId = user.uid; // The authenticated viewer
    const params = new URLSearchParams(window.location.search);
    const pageOwnerSlug = params.get('user'); 
    currentId = params.get('current');
    const initialSparkId = params.get('spark');
    
    console.log("URL Params - User:", pageOwnerSlug, "Current:", currentId, "Spark:", initialSparkId);

    const data = await getArcadeData();
    console.log("Full Data Received:", data);

    // 1. Identify the Owner UID from the surgically fetched data
    // We grab the first key in the users object, as getArcadeData returns only the owner requested via slug
    const ownerUid = Object.keys(data.users || {})[0];
    
    // 2. Resolve the path using the owner's UID rather than the viewer's UID
    const path = data.users?.[ownerUid]?.infrastructure?.currents?.[currentId];
    console.log("Target Path Object (Owner:", ownerUid, "):", path);

    if (!path) {
        console.error("Path Resolution Failed. Mapping issue or missing 'current' in DB.");
        document.getElementById('active-spark-name').textContent = "SPARK NOT FOUND";
        return;
    }

    // 3. Process Sparks
    const sparksObj = path.sparks || {};
    allSparks = Object.values(sparksObj).sort((a, b) => (a.created || 0) - (b.created || 0));
    
    console.log("Sparks Array Count:", allSparks.length);

    currentIndex = allSparks.findIndex(s => s.id === initialSparkId);

    if (currentIndex !== -1) {
        console.log("Loading Index:", currentIndex);
        loadSpark(allSparks[currentIndex]);
    } else if (allSparks.length > 0) {
        console.warn("Spark ID not found, defaulting to first spark.");
        loadSpark(allSparks[0]);
    } else {
        console.error("No sparks found in this current.");
        document.getElementById('active-spark-name').textContent = "EMPTY CURRENT";
    }
    
    setupInteractions();
});


/*
 * Standardizes raw Spark code to fit the responsive Laboratory Viewport.
 * Dynamically inherits theme colors (Neon-Dark, Autumn-Ember, etc.) 
 * from the parent system via CSS variables.
 * * @param {Object} spark - The spark data object from the DB.
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

function loadSpark(spark) {
    const container = document.getElementById('spark-content-container');
    const titleEl = document.getElementById('active-spark-name');
    const overlay = document.getElementById('spark-title-overlay');
    const hudStatus = document.getElementById('hud-status');
    const fallbackBtn = document.getElementById('fallback-url-btn');
    
    // Log Spark Metadata
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

    if (spark.link) {
        let finalUrl = spark.link;
        if (finalUrl.includes('youtube.com/watch?v=')) {
            finalUrl = finalUrl.replace('watch?v=', 'embed/') + "?autoplay=1&mute=1&enablejsapi=1";
        }
        
        console.log(`[LAB VIEWPORT] Loading External Link: ${finalUrl}`);
        container.innerHTML = `<iframe id="content-frame" src="${finalUrl}" allow="autoplay; fullscreen"></iframe>`;
        container.style.opacity = '1';
        
        if (fallbackBtn) {
            fallbackBtn.onclick = () => window.open(spark.link, '_blank');
            fallbackBtn.classList.remove('hidden');
        }
        
        setTimeout(() => startLiveThumbnail(), 2000);

    } else {
        const iframe = document.createElement('iframe');
        iframe.id = "content-frame";
        iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms');
        container.appendChild(iframe);

        const doc = iframe.contentWindow.document;
        doc.open();
        
        // Final construction of code to be written to iframe
        const standardizedCode = wrapCodeInLaboratory(spark);
        // DEBUG: Output the full generated code to console
        console.groupCollapsed(`%c[LAB VIEWPORT] Code Injected for: ${spark.name}`, "color: #00ff88;");
        console.log("Raw Code Structure:");
        console.log(standardizedCode);
        console.groupEnd();
        
        try {
            console.log("Check visibility:", container.offsetWidth, container.offsetHeight);
            doc.write(standardizedCode);
        } catch (e) {
            console.error("[LAB VIEWPORT] Critical Error during doc.write:", e);
        }
        doc.close();

        if (fallbackBtn) fallbackBtn.classList.add('hidden');

        iframe.onload = () => {
            console.log("[LAB VIEWPORT] Viewport Ready: content-frame fully loaded.");
            container.style.opacity = '1';
            startLiveThumbnail();
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

async function setPermanentCover() {
    const status = document.getElementById('hud-status');
    const spark = allSparks[currentIndex];
    
    if (!spark) return;
    status.textContent = "SAVING COVER...";

    try {
        // Target the iframe explicitly for the capture
        const iframe = document.getElementById('content-frame');
        const canvas = await html2canvas(iframe.contentWindow.document.body, {
            useCORS: true,
            scale: 0.5,
            logging: false, 
            allowTaint: true,
            backgroundColor: null
        });
        
        // UPDATED: Render the captured image to the UI square immediately
        const thumbCanvas = document.getElementById('live-thumb-canvas');
        if (thumbCanvas) {
         const thumbCtx = thumbCanvas.getContext('2d');
         thumbCanvas.width = thumbCanvas.offsetWidth;
         thumbCanvas.height = thumbCanvas.offsetHeight;
         thumbCtx.clearRect(0, 0, thumbCanvas.width, thumbCanvas.height);
         thumbCtx.drawImage(canvas, 0, 0, thumbCanvas.width, thumbCanvas.height);
        }

        const imageData = canvas.toDataURL('image/jpeg', 0.8);
        
        // Safety check: If the image is a tiny black pixel string, abort
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
    
    // Update URL without refresh
    const newUrl = `${window.location.pathname}?current=${currentId}&spark=${nextSpark.id}`;
    window.history.pushState({path: newUrl}, '', newUrl);
    
    loadSpark(nextSpark);
}

/*
 * UI Toggle: Zen Mode
 */
function toggleZen() {
    document.body.classList.toggle('zen-active');
}

/*
 * UI Toggle: Play/Pause Handshake
 */
function togglePlayPause() {
    window.dispatchEvent(new CustomEvent('toggleMedia'));
    const icon = document.getElementById('play-icon');
    if (icon) {
        icon.classList.toggle('fa-play');
        icon.classList.toggle('fa-pause');
    }
}

/*
 * Main Interaction Binder
 */
function setupInteractions() {
    // 1. Navigation & Data Persistence
    document.getElementById('set-cover-btn').onclick = setPermanentCover;
    
    // Explicit binding for side-zone navigation
    document.getElementById('prev-zone').onclick = (e) => {
        e.stopPropagation();
        navigate(-1);
    };
    
    document.getElementById('next-zone').onclick = (e) => {
        e.stopPropagation();
        navigate(1);
    };

    // 2. UI Toggles (Zen & Play/Pause)
    document.getElementById('zen-btn').onclick = toggleZen;
    
    // Play/Pause on the specific button
    document.getElementById('play-pause-btn').onclick = (e) => {
        e.stopPropagation(); // Prevents double-triggering the container click
        togglePlayPause();
    };

    // Play/Pause by clicking the viewport itself
    document.getElementById('spark-content-container').onclick = togglePlayPause;

    // 3. Exit Logic (Handling History vs Direct Link with User Context)
    document.getElementById('exit-btn').onclick = () => {
        const params = new URLSearchParams(window.location.search);
        const userSlug = params.get('user') || 'yertal-arcade';
    
        // ADDED: Clear intervals to stop background processing
        if (thumbInterval) {
             clearInterval(thumbInterval);
             thumbInterval = null;
        }

        // ADDED: Clear the container to stop simulation sounds/logic
        const container = document.getElementById('spark-content-container');
        if (container) container.innerHTML = '';
    
        // Prioritize returning to the specific arcade showroom
        window.location.href = `/arcade/index.html?user=${userSlug}`;
    };
    // 4. File Upload (Custom Thumbnail Trigger)
    document.getElementById('thumb-trigger').onclick = () => {
        document.getElementById('thumb-upload').click();
    };
    
    // 5. Global Keyboard Shortcuts
    window.onkeydown = (e) => {
        if (e.key === 'ArrowLeft') navigate(-1);
        if (e.key === 'ArrowRight') navigate(1);
        if (e.key.toLowerCase() === 'z') toggleZen();
        if (e.key === 'Escape') toggleZen(); 
    };
}
