let currentId, sparkId, sparkList = [];

const params = new URLSearchParams(window.location.search);
currentId = params.get('current');
sparkId = params.get('spark');

async function initSparkView() {
    if (!currentId || !sparkId) return;

    // Load full current to get navigation order
    const snapshot = await db.ref(`arcade_infrastructure/currents/${currentId}`).once('value');
    const currentData = snapshot.val();
    
    if (currentData && currentData.sparks) {
        // Sort sparks by creation date (descending) to match main UI
        sparkList = Object.values(currentData.sparks).sort((a, b) => b.created - a.created);
        renderActiveSpark();
    }
}

function renderActiveSpark() {
    const spark = sparkList.find(s => s.id === sparkId);
    if (!spark) return;

    document.title = `Spark: ${spark.name}`;
    const container = document.getElementById('spark-content-container');
    
    if (spark.link.startsWith('http')) {
        container.innerHTML = `<iframe src="${spark.link}" class="w-full h-full border-none" allow="autoplay; fullscreen"></iframe>`;
    } else {
        container.innerHTML = spark.code || '<div class="text-white p-20">Source Empty</div>';
    }

    startCaptureLoop();
}

function navigate(direction) {
    const currentIndex = sparkList.findIndex(s => s.id === sparkId);
    let nextIndex = currentIndex + direction;

    if (nextIndex >= 0 && nextIndex < sparkList.length) {
        sparkId = sparkList[nextIndex].id;
        // Update URL without reloading page
        const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname + `?current=${currentId}&spark=${sparkId}`;
        window.history.pushState({path:newUrl},'',newUrl);
        renderActiveSpark();
    }
}

// --- CAPTURE LOGIC ---
function startCaptureLoop() {
    const canvas = document.getElementById('live-thumb-canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 400; canvas.height = 225;

    clearInterval(window.captureInterval);
    window.captureInterval = setInterval(async () => {
        const content = document.getElementById('spark-content-container');
        try {
            const tempCanvas = await html2canvas(content, {
                useCORS: true,
                scale: 0.4,
                ignoreElements: (el) => el.id === 'spark-hud' || el.tagName === 'BUTTON'
            });
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height);
        } catch (e) { console.warn("Canvas capture blocked by CORS"); }
    }, 4000);
}

// --- EVENT LISTENERS ---
document.getElementById('prev-zone').onclick = () => navigate(1); // Higher index = older spark
document.getElementById('next-zone').onclick = () => navigate(-1); // Lower index = newer spark

document.getElementById('set-cover-btn').onclick = async () => {
    const btn = document.getElementById('set-cover-btn');
    const dataUrl = document.getElementById('live-thumb-canvas').toDataURL('image/webp', 0.6);
    btn.textContent = "SAVING...";
    await db.ref(`arcade_infrastructure/currents/${currentId}/sparks/${sparkId}`).update({ image: dataUrl });
    btn.textContent = "COVER SET!";
    setTimeout(() => { btn.textContent = "SET AS COVER"; }, 2000);
};

document.getElementById('fallback-url-btn').onclick = async () => {
    const url = prompt("Paste Image URL:");
    if (url) {
        await db.ref(`arcade_infrastructure/currents/${currentId}/sparks/${sparkId}`).update({ image: url });
        alert("Cover updated via link.");
    }
};

initSparkView();
