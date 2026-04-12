import { getArcadeData, saveToRealtimeDB } from '/config/firebase-config.js';
import { watchAuthState } from '/config/auth.js';

let allSparks = [];
let currentIndex = -1;
let currentId = '';
let userId = '';
let thumbInterval = null;

// New State for Capture & Crop System
let currentBurstFrames = []; 
let cropStart = null;
let cropArea = { x: 0, y: 0, w: 0, h: 0 };
let sourceImage = new Image();
const IMGBB_API_KEY = "YOUR_KEY"; // Replace with your actual ImgBB API key

console.log(`%c YERTAL SPARKS LOADED | ${new Date().toLocaleDateString()} @ 10:02:00 `, "background: var(--bg-color); color: var(--fg-color); font-weight: bold; border: 1px solid var(--branding-color); padding: 4px;");

/**
 * BURST CAPTURE LOGIC
 * Fires 6 shots with 500ms intervals to capture movement
 */
async function captureBurst() {
    currentBurstFrames = []; 
    const status = document.getElementById('hud-status');
    
    for (let i = 0; i < 6; i++) {
        try {
            const iframe = document.getElementById('content-frame');
            if (!iframe) return;

            if (status) status.textContent = `BURSTING ${i + 1}/6...`;
            const canvas = await html2canvas(iframe.contentWindow.document.body, { 
                useCORS: true, 
                scale: 0.4,
                logging: false 
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
                if (i === 0) updateThumbCanvas(url);
            }
            await new Promise(r => setTimeout(r, 500)); 
        } catch (e) {
            console.error("Burst frame failed:", e);
        }
    }
    if (status) status.textContent = "BURST CAPTURE READY";
}

/**
 * HUD & CROP CONTROLS
 */
function openBurstPicker() {
    const hud = document.getElementById('burst-picker-hud');
    const grid = document.getElementById('burst-grid');
    grid.innerHTML = ""; 

    if (currentBurstFrames.length === 0) {
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
            closeBurstPicker();
            openCropTool(url);
        };
        grid.appendChild(img);
    });

    hud.classList.remove('hidden');
}

function openCropTool(imageUrl) {
    const modal = document.getElementById('crop-modal');
    const canvas = document.getElementById('crop-canvas');
    const ctx = canvas.getContext('2d');

    sourceImage = new Image();
    sourceImage.crossOrigin = "anonymous";
    sourceImage.onload = () => {
        canvas.width = sourceImage.width;
        canvas.height = sourceImage.height;
        ctx.drawImage(sourceImage, 0, 0);
        modal.classList.remove('hidden');
        cropArea = { x: 0, y: 0, w: canvas.width, h: canvas.height };
    };
    sourceImage.src = imageUrl;

    canvas.onmousedown = (e) => {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        cropStart = { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
    };

    canvas.onmousemove = (e) => {
        if (!cropStart) return;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const currentX = (e.clientX - rect.left) * scaleX;
        const currentY = (e.clientY - rect.top) * scaleY;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(sourceImage, 0, 0);
        ctx.strokeStyle = "#00f2ff";
        ctx.lineWidth = 4;
        ctx.strokeRect(cropStart.x, cropStart.y, currentX - cropStart.x, currentY - cropStart.y);
        cropArea = { x: cropStart.x, y: cropStart.y, w: currentX - cropStart.x, h: currentY - cropStart.y };
    };

    canvas.onmouseup = () => { cropStart = null; };
}

async function finalizeAndUploadCrop() {
    const status = document.getElementById('hud-status');
    const finalCanvas = document.createElement('canvas');
    const finalCtx = finalCanvas.getContext('2d');
    
    finalCanvas.width = Math.abs(cropArea.w);
    finalCanvas.height = Math.abs(cropArea.h);

    finalCtx.drawImage(
        sourceImage, 
        cropArea.x, cropArea.y, cropArea.w, cropArea.h, 
        0, 0, finalCanvas.width, finalCanvas.height
    );

    try {
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
            if (status) status.textContent = "COVER FINALIZED";
            closeCropModal();
        }
    } catch (e) {
        if (status) status.textContent = "SYNC FAILED";
        console.error("Manual save failed:", e);
    }
}

function closeBurstPicker() { document.getElementById('burst-picker-hud').classList.add('hidden'); }
function closeCropModal() { document.getElementById('crop-modal').classList.add('hidden'); }

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

/**
 * Clips the edges and resizes a screenshot to 240x135.
 */
async function convertScreenshotToImage(dataUrl) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const thumbCanvas = document.createElement('canvas');
            const ctx = thumbCanvas.getContext('2d');
            thumbCanvas.width = 240;
            thumbCanvas.height = 135;
            const margin = 0.05;
            const sx = img.width * margin;
            const sy = img.height * margin;
            const sw = img.width * (1 - (margin * 2));
            const sh = img.height * (1 - (margin * 2));
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
 */
function wrapCodeInLaboratory(spark) {
    const activeCode = spark.code || (spark.data ? spark.data.code : null) || spark.html || (typeof spark === 'string' ? spark : "");
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <style>
                body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background-color: var(--bg-color-mid, #00080f); display: flex; align-items: center; justify-content: center; color: var(--text-main-color, #ffffff); font-family: var(--text-main-font, sans-serif); }
                canvas { display: block; width: 100vw !important; height: 100vh !important; max-width: 100%; max-height: 100%; object-fit: contain; margin: auto; background: transparent !important; }
                .system-error { text-align: center; padding: 20px; border: 2px solid var(--error-color, #ff4444); background: var(--bg-color-low, rgba(0,0,0,0.8)); color: var(--error-color, #ff4444); text-transform: uppercase; letter-spacing: 1px; }
            </style>
        </head>
        <body>
            ${activeCode || '<div class="system-error"><h1>[ System Error ]</h1><p>Diagnostic: No Executable Code Found</p></div>'}
            <script>
                (function() {
                function forceLaboratoryFit() {
                    const cvs = document.querySelector('canvas');
                    if (cvs) {
                        if (cvs.getContext('webgl')) cvs.getContext('webgl', { preserveDrawingBuffer: true });
                        if (cvs.getContext('webgl2')) cvs.getContext('webgl2', { preserveDrawingBuffer: true });
                        cvs.width = window.innerWidth; cvs.height = window.innerHeight;
                        if (typeof window.resize === 'function') window.resize();
                        if (typeof window.setup === 'function') window.setup();
                        if (typeof window.init === 'function') window.init();
                        if (typeof window.resizeCanvas === 'function') window.resizeCanvas(window.innerWidth, window.innerHeight);
                    }
                }
                window.addEventListener('load', () => { forceLaboratoryFit(); setTimeout(forceLaboratoryFit, 150); });
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
    
    console.log(`%c[YERTAL LAB] Loading Spark: ${spark.name}`, "color: #00f2ff; font-weight: bold;");
    
    if (thumbInterval) { clearInterval(thumbInterval); thumbInterval = null; }
    
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
        setTimeout(() => { startLiveThumbnail(); captureBurst(); }, 2000);
    } else {
        const iframe = document.createElement('iframe');
        iframe.id = "content-frame";
        iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms');
        container.appendChild(iframe);

        const doc = iframe.contentWindow.document;
        doc.open();
        const standardizedCode = wrapCodeInLaboratory(spark);
        
        console.groupCollapsed(`%c[LAB VIEWPORT] Code Injected for: ${spark.name}`, "color: #00ff88;");
        console.log(standardizedCode);
        console.groupEnd();

        try { doc.write(standardizedCode); } catch (e) { console.error("[LAB VIEWPORT] Critical Error:", e); }
        doc.close();

        if (fallbackBtn) fallbackBtn.classList.add('hidden');

        iframe.onload = () => {
            console.log("[LAB VIEWPORT] Viewport Ready.");
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
            const shot = await html2canvas(document.getElementById('spark-content-container'), { useCORS: true, scale: 0.2, backgroundColor: null });
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(shot, 0, 0, canvas.width, canvas.height);
        } catch (e) { console.warn("Thumbnail capture paused."); }
    }, 5000);
}

async function setPermanentCover() {
    const status = document.getElementById('hud-status');
    const spark = allSparks[currentIndex];
    if (!spark) return;
    status.textContent = "SAVING COVER...";
    try {
        const iframe = document.getElementById('content-frame');
        const canvas = await html2canvas(iframe.contentWindow.document.body, { useCORS: true, scale: 0.5, logging: false, allowTaint: true, backgroundColor: null });
        
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

function toggleZen() { document.body.classList.toggle('zen-active'); }

function togglePlayPause() {
    window.dispatchEvent(new CustomEvent('toggleMedia'));
    const icon = document.getElementById('play-icon');
    if (icon) {
        icon.classList.toggle('fa-play');
        icon.classList.toggle('fa-pause');
    }
}

function setupInteractions() {
    document.getElementById('set-cover-btn').onclick = openBurstPicker;
    document.getElementById('prev-zone').onclick = (e) => { e.stopPropagation(); navigate(-1); };
    document.getElementById('next-zone').onclick = (e) => { e.stopPropagation(); navigate(1); };
    document.getElementById('zen-btn').onclick = toggleZen;
    document.getElementById('play-pause-btn').onclick = (e) => { e.stopPropagation(); togglePlayPause(); };
    document.getElementById('spark-content-container').onclick = togglePlayPause;

    document.getElementById('exit-btn').onclick = () => {
        const params = new URLSearchParams(window.location.search);
        const userSlug = params.get('user') || 'yertal-arcade';
        if (thumbInterval) clearInterval(thumbInterval);
        const container = document.getElementById('spark-content-container');
        if (container) container.innerHTML = '';
        window.location.href = `/arcade/index.html?user=${userSlug}`;
    };

    document.getElementById('thumb-trigger').onclick = () => {
        document.getElementById('thumb-upload').click();
    };

    window.onkeydown = (e) => {
        if (e.key === 'ArrowLeft') navigate(-1);
        if (e.key === 'ArrowRight') navigate(1);
        if (e.key.toLowerCase() === 'z') toggleZen();
        if (e.key === 'Escape') toggleZen(); 
    };
}

watchAuthState(async (user) => {
    console.log("Auth State Changed. User:", user ? user.uid : "Logged Out");
    if (!user) return;

    userId = user.uid;
    const params = new URLSearchParams(window.location.search);
    const pageOwnerSlug = params.get('user'); 
    currentId = params.get('current');
    const initialSparkId = params.get('spark');
    
    console.log("URL Params - User:", pageOwnerSlug, "Current:", currentId, "Spark:", initialSparkId);

    const data = await getArcadeData();
    const ownerUid = Object.keys(data.users || {})[0];
    const path = data.users?.[ownerUid]?.infrastructure?.currents?.[currentId];
    console.log("Target Path Object (Owner:", ownerUid, "):", path);

    if (!path) {
        document.getElementById('active-spark-name').textContent = "SPARK NOT FOUND";
        return;
    }

    const sparksObj = path.sparks || {};
    allSparks = Object.values(sparksObj).sort((a, b) => (a.created || 0) - (b.created || 0));
    currentIndex = allSparks.findIndex(s => s.id === initialSparkId);

    if (currentIndex !== -1) loadSpark(allSparks[currentIndex]);
    else if (allSparks.length > 0) loadSpark(allSparks[0]);
    
    setupInteractions();
});

// Bind UI actions to window
window.closeBurstPicker = closeBurstPicker;
window.closeCropModal = closeCropModal;
window.finalizeAndUploadCrop = finalizeAndUploadCrop;
