import { getArcadeData, saveToRealtimeDB } from '../config/firebase-config.js';
import { watchAuthState } from '../config/auth.js';

let allSparks = [];
let currentIndex = -1;
let currentId = '';
let userId = '';
let thumbInterval = null;

/*
 * Captures the raw pixel data from the game canvas.
 * @param {HTMLCanvasElement} canvas - The active game canvas.
 */
function takeScreenshot(canvas) {
    // If using Three.js, ensure 'preserveDrawingBuffer: true' was set 
    // in the renderer, or call this inside the render loop.
    return canvas.toDataURL('image/png');
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

    userId = user.uid;
    const params = new URLSearchParams(window.location.search);
    currentId = params.get('current');
    const initialSparkId = params.get('spark');
    
    console.log("URL Params - Current:", currentId, "Spark:", initialSparkId);

    const data = await getArcadeData();
    console.log("Full Data Received:", data);

    const path = data.users?.[userId]?.infrastructure?.currents?.[currentId];
    console.log("Target Path Object:", path);

    const sparksObj = path?.sparks || {};
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
function loadSpark(spark) {
    const container = document.getElementById('spark-content-container');
    const titleEl = document.getElementById('active-spark-name');
    const overlay = document.getElementById('spark-title-overlay');
    const hudStatus = document.getElementById('hud-status');
    const fallbackBtn = document.getElementById('fallback-url-btn');
    
    // 0. Clear previous interval immediately to prevent ghost captures
    if (thumbInterval) {
        clearInterval(thumbInterval);
        thumbInterval = null;
    }
    
    // Clear the container to prevent overlapping iframes during rapid navigation
    container.innerHTML = '';
    if (hudStatus) hudStatus.textContent = "INITIALIZING...";

    // 1. Show Title Animation
    titleEl.textContent = spark.name;
    overlay.style.opacity = "1";
    setTimeout(() => { overlay.style.opacity = "0"; }, 3000);

    // 2. Render Content (Source vs Code)
    if (spark.link) {
        let finalUrl = spark.link;
        if (finalUrl.includes('youtube.com/watch?v=')) {
            finalUrl = finalUrl.replace('watch?v=', 'embed/') + "?autoplay=1&mute=1";
        }
        
        container.innerHTML = `<iframe id="content-frame" src="${finalUrl}" allow="autoplay; fullscreen"></iframe>`;
        
        if (fallbackBtn) {
            fallbackBtn.onclick = () => window.open(spark.link, '_blank');
            fallbackBtn.classList.remove('hidden');
        }
        
        // Start thumbnail logic after a brief delay for external links
        setTimeout(() => startLiveThumbnail(), 2000);

    } else {
        const iframe = document.createElement('iframe');
        iframe.id = "content-frame";
        
        // 2026-02-04: Using standard sandbox permissions to allow same-origin for html2canvas
        iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms');
        container.appendChild(iframe);

        const doc = iframe.contentWindow.document;
        doc.open();
        
        // Injecting base styles to ensure the Spark respects viewport bounds and transparency
        const standardizedCode = `
            <style>
                body { margin: 0; overflow: hidden; background: transparent; }
                canvas { display: block; width: 100vw; height: 100vh; }
            </style>
            ${spark.code || '<h1>No Code Found</h1>'}
        `;
        
        doc.write(standardizedCode);
        doc.close();

        if (fallbackBtn) fallbackBtn.classList.add('hidden');

        // 3. Reset Live Thumbnail logic - Wait for iframe load to ensure DOM is ready
        iframe.onload = () => {
            startLiveThumbnail();
            if (hudStatus) hudStatus.textContent = "AUTO-CAPTURE ACTIVE";
        };
    }
}

function startLiveThumbnail() {
    if (thumbInterval) clearInterval(thumbInterval);
    
    const canvas = document.getElementById('live-thumb-canvas');
    const ctx = canvas.getContext('2d');
    
    // Preview cycle: attempt to snapshot the iframe every 5 seconds for the HUD
    thumbInterval = setInterval(async () => {
        try {
            const shot = await html2canvas(document.getElementById('spark-content-container'), {
                useCORS: true,
                scale: 0.2
            });
            ctx.drawImage(shot, 0, 0, canvas.width, canvas.height);
        } catch (e) { /* Content might be cross-origin protected */ }
    }, 5000);
}

async function setPermanentCover() {
    const status = document.getElementById('hud-status');
    const spark = allSparks[currentIndex];
    status.textContent = "SAVING COVER...";

    try {
        const canvas = await html2canvas(document.getElementById('spark-content-container'), {
            useCORS: true,
            scale: 0.5
        });
        const imageData = canvas.toDataURL('image/jpeg', 0.8);
        const path = `users/${userId}/infrastructure/currents/${currentId}/sparks/${spark.id}/image`;
        
        await saveToRealtimeDB(path, imageData);
        status.textContent = "COVER UPDATED!";
        setTimeout(() => status.textContent = "AUTO-CAPTURE ACTIVE", 2000);
    } catch (e) {
        status.textContent = "SAVE FAILED";
        console.error(e);
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

function setupInteractions() {
    document.getElementById('set-cover-btn').onclick = setPermanentCover;
    document.getElementById('prev-zone').onclick = () => navigate(-1);
    document.getElementById('next-zone').onclick = () => navigate(1);
    document.getElementById('zen-btn').onclick = () => document.body.classList.toggle('zen-active');
    
    window.onkeydown = (e) => {
        if (e.key === 'ArrowLeft') navigate(-1);
        if (e.key === 'ArrowRight') navigate(1);
        if (e.key.toLowerCase() === 'z') document.body.classList.toggle('zen-active');
    };
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
    // 1. Existing Navigation & Core Actions
    document.getElementById('set-cover-btn').onclick = setPermanentCover;
    document.getElementById('prev-zone').onclick = () => navigate(-1);
    document.getElementById('next-zone').onclick = () => navigate(1);

    // 2. Moved UI Toggles
    document.getElementById('zen-btn').onclick = toggleZen;
    
    document.getElementById('play-pause-btn').onclick = (e) => {
        e.stopPropagation();
        togglePlayPause();
    };

    document.getElementById('spark-content-container').onclick = togglePlayPause;

    // 3. Exit Logic
    document.getElementById('exit-btn').onclick = () => {
        if (window.history.length > 1) {
            window.history.back();
        } else {
            window.location.href = '/arcade/index.html?user=yertal-arcade';
        }
    };

    // 4. File Upload Trigger
    document.getElementById('thumb-trigger').onclick = () => {
        document.getElementById('thumb-upload').click();
    };
    
    // 5. Global Keyboard Shortcuts
    window.onkeydown = (e) => {
        if (e.key === 'ArrowLeft') navigate(-1);
        if (e.key === 'ArrowRight') navigate(1);
        if (e.key.toLowerCase() === 'z' || e.key === 'Escape') toggleZen();
    };
}
