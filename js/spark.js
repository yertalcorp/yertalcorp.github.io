import { getArcadeData, saveToRealtimeDB } from '../config/firebase-config.js';
import { watchAuthState } from '../config/auth.js';

let allSparks = [];
let currentIndex = -1;
let currentId = '';
let userId = '';
let thumbInterval = null;

watchAuthState(async (user) => {
    if (!user) return;
    userId = user.uid;

    const params = new URLSearchParams(window.location.search);
    currentId = params.get('current');
    const initialSparkId = params.get('spark');

    const data = await getArcadeData();
    const sparksObj = data.users?.[userId]?.infrastructure?.currents?.[currentId]?.sparks || {};
    
    // Convert to array and sort by creation time
    allSparks = Object.values(sparksObj).sort((a, b) => (a.created || 0) - (b.created || 0));
    currentIndex = allSparks.findIndex(s => s.id === initialSparkId);

    if (currentIndex !== -1) {
        loadSpark(allSparks[currentIndex]);
    }
    setupInteractions();
});

function loadSpark(spark) {
    const container = document.getElementById('spark-content-container');
    const titleEl = document.getElementById('active-spark-name');
    const overlay = document.getElementById('spark-title-overlay');
    
    container.innerHTML = '';
    
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
        document.getElementById('fallback-url-btn').onclick = () => window.open(spark.link, '_blank');
        document.getElementById('fallback-url-btn').classList.remove('hidden');
    } else {
        const iframe = document.createElement('iframe');
        iframe.id = "content-frame";
        container.appendChild(iframe);
        const doc = iframe.contentWindow.document;
        doc.open();
        doc.write(spark.code || '<h1>No Code Found</h1>');
        doc.close();
        document.getElementById('fallback-url-btn').classList.add('hidden');
    }

    // 3. Reset Live Thumbnail logic
    startLiveThumbnail();
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
