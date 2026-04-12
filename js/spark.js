import { getArcadeData, saveToRealtimeDB } from '/config/firebase-config.js';
import { watchAuthState } from '/config/auth.js';

let allSparks = [];
let currentIndex = -1;
let currentId = '';
let userId = '';
let thumbInterval = null;

console.log(`%c YERTAL SPARKS LOADED | ${new Date().toLocaleDateString()} @ 22:03:00 `, "background: var(--bg-color); color: var(--fg-color); font-weight: bold; border: 1px solid var(--branding-color); padding: 4px;");

// --- START CAPTURE & CROP STATE ---
let currentBurstFrames = []; 
let cropStart = null;
let cropArea = { x: 0, y: 0, w: 0, h: 0 };
let sourceImage = new Image();
const IMGBB_API_KEY = "YOUR_KEY"; // Replace with your actual ImgBB API key
// --- END CAPTURE & CROP STATE ---

/**
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

/**
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

/**
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

/**
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

/**
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

/**
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
        
        // Start Thumbnail cycle + Burst Capture
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

/**
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

function setupInteractions() {
    // Nav & Cover Binding
    document.getElementById('set-cover-btn').onclick = openBurstPicker;
    
    document.getElementById('prev-zone').onclick = (e) => {
        e.stopPropagation();
        navigate(-1);
    };
    
    document.getElementById('next-zone').onclick = (e) => {
        e.stopPropagation();
        navigate(1);
    };

    // UI Toggles
    document.getElementById('zen-btn').onclick = toggleZen;
    document.getElementById('play-pause-btn').onclick = (e) => {
        e.stopPropagation(); 
        togglePlayPause();
    };

    document.getElementById('spark-content-container').onclick = togglePlayPause;

    // Exit Logic
    document.getElementById('exit-btn').onclick = () => {
        const params = new URLSearchParams(window.location.search);
        const userSlug = params.get('user') || 'yertal-arcade';
    
        if (thumbInterval) {
             clearInterval(thumbInterval);
             thumbInterval = null;
        }

        const container = document.getElementById('spark-content-container');
        if (container) container.innerHTML = '';
        window.location.href = `/arcade/index.html?user=${userSlug}`;
    };

    // File Upload / Trigger
    document.getElementById('thumb-trigger').onclick = () => {
        // Option to open picker or upload
        openBurstPicker();
    };
    
    // Keyboard Shortcuts
    window.onkeydown = (e) => {
        if (e.key === 'ArrowLeft') navigate(-1);
        if (e.key === 'ArrowRight') navigate(1);
        if (e.key.toLowerCase() === 'z') toggleZen();
        if (e.key === 'Escape') toggleZen(); 
    };
}

watchAuthState(async (user) => {
    console.log("%c[AUTH] State Changed. User:", "color: #00ff00;", user ? user.uid : "Logged Out");
    if (!user) return;

    userId = user.uid; 
    const params = new URLSearchParams(window.location.search);
    const pageOwnerSlug = params.get('user'); 
    currentId = params.get('current');
    const initialSparkId = params.get('spark');
    
    console.log(`[AUTH] URL Context -> Owner: ${pageOwnerSlug} | Current: ${currentId} | Spark: ${initialSparkId}`);

    const data = await getArcadeData();
    console.log("[DATA] Full Arcade Payload:", data);

    const ownerUid = Object.keys(data.users || {})[0];
    const path = data.users?.[ownerUid]?.infrastructure?.currents?.[currentId];
    console.log(`[DATA] Resolved Path for Owner (${ownerUid}):`, path);

    if (!path) {
        console.error("[DATA] Critical Failure: Path resolution returned null.");
        document.getElementById('active-spark-name').textContent = "SPARK NOT FOUND";
        return;
    }

    // Process Sparks Array
    const sparksObj = path.sparks || {};
    allSparks = Object.values(sparksObj).sort((a, b) => (a.created || 0) - (b.created || 0));
    
    console.log(`[DATA] Sparks inventory loaded: ${allSparks.length} items found.`);

    currentIndex = allSparks.findIndex(s => s.id === initialSparkId);

    if (currentIndex !== -1) {
        console.log(`[LAB] Target index ${currentIndex} found. Loading...`);
        loadSpark(allSparks[currentIndex]);
    } else if (allSparks.length > 0) {
        console.warn("[LAB] Initial Spark ID missing from current. Defaulting to index 0.");
        loadSpark(allSparks[0]);
    } else {
        console.error("[LAB] No sparks in current current.");
        document.getElementById('active-spark-name').textContent = "EMPTY CURRENT";
    }
    
    setupInteractions();
});

// Bind UI actions to window scope for HTML access
window.closeBurstPicker = closeBurstPicker;
window.closeCropModal = closeCropModal;
window.finalizeAndUploadCrop = finalizeAndUploadCrop;
