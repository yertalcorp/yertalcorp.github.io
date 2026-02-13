/**
 * SPARK VIEWPORT ENGINE
 * Handles: Live Rendering, Auto-Capture, Zen Mode, and Navigation
 */

let currentId, sparkId, sparkList = [];
const db = firebase.database();
let isZen = false;

// 1. INITIALIZATION
const params = new URLSearchParams(window.location.search);
currentId = params.get('current');
sparkId = params.get('spark');

async function initSparkView() {
    if (!currentId || !sparkId) {
        console.error("Viewport Access Denied: Missing IDs");
        return;
    }

    // Fetch the parent Current to enable navigation between sibling sparks
    const snapshot = await db.ref(`arcade_infrastructure/currents/${currentId}`).once('value');
    const currentData = snapshot.val();
    
    if (currentData && currentData.sparks) {
        // Sort sparks by creation date (newest first) to match the Arcade Lobby
        sparkList = Object.values(currentData.sparks).sort((a, b) => b.created - a.created);
        renderActiveSpark();
    }
}

// 2. RENDERING CORE
function renderActiveSpark() {
    const spark = sparkList.find(s => s.id === sparkId);
    if (!spark) return;

    document.title = `ARCADE // ${spark.name.toUpperCase()}`;
    const container = document.getElementById('spark-content-container');
    
    // Logic Selection: External Link vs. Internal Code
    if (spark.link && (spark.link.startsWith('http') || spark.link.includes('//'))) {
        container.innerHTML = `
            <iframe src="${spark.link}" 
                    class="w-full h-full border-none" 
                    allow="autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                    allowfullscreen>
            </iframe>`;
    } else if (spark.code) {
        // Injects AI-generated HTML/JS/CSS directly into the viewport
        // We use an iframe with srcdoc to isolate the spark's CSS/JS from the HUD
        container.innerHTML = `
            <iframe id="spark-frame" 
                    srcdoc="${spark.code.replace(/"/g, '&quot;')}" 
                    class="w-full h-full border-none">
            </iframe>`;
    } else {
        container.innerHTML = `
            <div class="flex items-center justify-center h-full text-white/20 font-mono uppercase tracking-[0.5em]">
                Logic Not Found
            </div>`;
    }

    // Re-initialize the capture loop for the new spark
    startCaptureLoop();
}

// 3. NAVIGATION LOGIC
function navigate(direction) {
    const currentIndex = sparkList.findIndex(s => s.id === sparkId);
    let nextIndex = currentIndex + direction;

    if (nextIndex >= 0 && nextIndex < sparkList.length) {
        sparkId = sparkList[nextIndex].id;
        
        // Update URL without reloading the page
        const newUrl = `${window.location.pathname}?current=${currentId}&spark=${sparkId}`;
        window.history.pushState({ path: newUrl }, '', newUrl);
        
        renderActiveSpark();
    }
}

// 4. THE CAPTURE ENGINE (Using html2canvas)
function startCaptureLoop() {
    const canvas = document.getElementById('live-thumb-canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 400; 
    canvas.height = 225;

    // Clear any existing intervals to prevent memory leaks
    clearInterval(window.captureInterval);

    window.captureInterval = setInterval(async () => {
        const content = document.getElementById('spark-content-container');
        try {
            // Note: If using an iframe, html2canvas might face CORS issues with external links.
            // It works perfectly for internal 'code' based sparks.
            const tempCanvas = await html2canvas(content, {
                useCORS: true,
                scale: 0.5,
                logging: false,
                ignoreElements: (el) => el.id === 'spark-hud' || el.classList.contains('exit-btn')
            });
            
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height);
            
            document.getElementById('hud-status').textContent = "LIVE SYNC ACTIVE";
        } catch (e) { 
            document.getElementById('hud-status').textContent = "SYNC LIMITED (CORS)";
        }
    }, 5000); // Capture frame every 5 seconds
}

// 5. HUD ACTIONS
function toggleZen() {
    isZen = !isZen;
    document.body.classList.toggle('zen-active', isZen);
}

document.getElementById('set-cover-btn').onclick = async () => {
    const btn = document.getElementById('set-cover-btn');
    const canvas = document.getElementById('live-thumb-canvas');
    const dataUrl = canvas.toDataURL('image/webp', 0.7); // Compressed webp for DB efficiency
    
    btn.textContent = "UPLOADING...";
    try {
        await db.ref(`arcade_infrastructure/currents/${currentId}/sparks/${sparkId}`).update({ 
            image: dataUrl 
        });
        btn.textContent = "COVER SAVED";
        setTimeout(() => { btn.textContent = "SET AS COVER"; }, 2000);
    } catch (err) {
        btn.textContent = "ERROR";
    }
};

document.getElementById('download-btn').onclick = () => {
    const canvas = document.getElementById('live-thumb-canvas');
    const link = document.createElement('a');
    link.download = `yertal-spark-${sparkId}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
};

document.getElementById('fallback-url-btn').onclick = async () => {
    const url = prompt("Enter External Image URL for Cover:");
    if (url) {
        await db.ref(`arcade_infrastructure/currents/${currentId}/sparks/${sparkId}`).update({ image: url });
        alert("Image Reference Updated.");
    }
};

// 6. CONTROL INPUTS
document.getElementById('prev-zone').onclick = () => navigate(1);
document.getElementById('next-zone').onclick = () => navigate(-1);

window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'z') toggleZen();
    if (e.key === 'ArrowLeft') navigate(1);
    if (e.key === 'ArrowRight') navigate(-1);
    if (e.key === 'Escape') isZen ? toggleZen() : window.close();
});

// START VIEWPORT
initSparkView();
