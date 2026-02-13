// Initialize Firebase
const params = new URLSearchParams(window.location.search);
const currentId = params.get('current');
const sparkId = params.get('spark');

async function loadSpark() {
    if (!currentId || !sparkId) return;

    // Fetch the specific spark from DB
    const snapshot = await db.ref(`arcade_infrastructure/currents/${currentId}/sparks/${sparkId}`).once('value');
    const spark = snapshot.val();

    if (spark) {
        const container = document.getElementById('spark-content-container');
        // If it's a URL, use an iframe; if it's code, inject it
        if (spark.link.startsWith('http')) {
            container.innerHTML = `<iframe src="${spark.link}" class="w-full h-full border-none"></iframe>`;
        } else {
            container.innerHTML = spark.code || 'No content found.';
        }
        startCaptureLoop();
    }
}

function startCaptureLoop() {
    const canvas = document.getElementById('live-thumb-canvas');
    const ctx = canvas.getContext('2d');

    // Set canvas internal resolution
    canvas.width = 400; 
    canvas.height = 225;

    setInterval(async () => {
        const content = document.getElementById('spark-content-container');
        try {
            const tempCanvas = await html2canvas(content, {
                useCORS: true, // Crucial for external images/iframes
                scale: 0.5,
                ignoreElements: (el) => el.id === 'spark-hud'
            });
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height);
        } catch (e) {
            console.warn("Capture frame skipped: ", e);
        }
    }, 4000);
}

document.getElementById('set-cover-btn').addEventListener('click', async () => {
    const btn = document.getElementById('set-cover-btn');
    const canvas = document.getElementById('live-thumb-canvas');
    
    btn.textContent = "SYNCING...";
    btn.disabled = true;

    const dataUrl = canvas.toDataURL('image/webp', 0.6); // WebP is smaller than PNG

    try {
        await db.ref(`arcade_infrastructure/currents/${currentId}/sparks/${sparkId}`).update({
            image: dataUrl
        });
        btn.textContent = "COVER SET!";
        btn.style.background = "#39ff14";
        setTimeout(() => window.close(), 800);
    } catch (e) {
        btn.textContent = "RETRY";
        btn.disabled = false;
    }
});

loadSpark();
