let currentId, sparkId, sparkList = [];
const db = firebase.database();
let isZen = false;

const params = new URLSearchParams(window.location.search);
currentId = params.get('current');
sparkId = params.get('spark');

async function initSparkView() {
    if (!currentId || !sparkId) return;
    const snapshot = await db.ref(`arcade_infrastructure/currents/${currentId}`).once('value');
    const currentData = snapshot.val();
    if (currentData && currentData.sparks) {
        sparkList = Object.values(currentData.sparks).sort((a, b) => b.created - a.created);
        renderActiveSpark();
    }
}
async function initArcade() {
    const statusText = document.getElementById('engine-status-text');
    try {
        statusText.textContent = "SYNCHRONIZING WITH CORE...";
        
        const response = await fetch(`${firebaseConfig.databaseURL}/.json`);
        databaseCache = await response.json();
        
        if (!databaseCache) throw new Error("Database Empty");

        // 1. GLOBAL UI CONFIG
        const ui = databaseCache.settings['ui-settings'];
        const root = document.documentElement;
        root.style.setProperty('--neon-color', ui['color-neon']);
        root.style.setProperty('--accent-color', ui['color-accent']);
        root.style.setProperty('--nav-font', ui.nav_font);
        
        // 2. HERO & BRANDING
        const hero = databaseCache.arcade_infrastructure.hero;
        const brand = databaseCache.navigation.branding;
        
        document.getElementById('hero-heading').textContent = hero.title;
        document.getElementById('hero-subheading').textContent = hero.subtitle;
        document.getElementById('corp-name-display').innerHTML = 
            `<span style="color: ${brand.parts[0].color}">${brand.parts[0].text}</span> 
             <span style="color: ${brand.parts[1].color}">${brand.parts[1].text}</span>`;

        // 3. ADMIN PRIVILEGES
        const superUserDisplay = document.getElementById('superuser-display');
        if (user && user.email === 'yertal-arcade@gmail.com') {
            superUserDisplay.textContent = "SYS_ADMIN: CONNECTED";
            superUserDisplay.classList.add('pulse-neon'); // Add a subtle glow via CSS
        }

        // 4. RENDER ENGINE
        renderCurrents(databaseCache.arcade_infrastructure.currents);
        
        statusText.textContent = "SYSTEM READY";
        document.body.style.opacity = '1';

    } catch (e) { 
        console.error("Initalization Error:", e);
        statusText.textContent = "CRITICAL ERROR: DATABASE OFFLINE";
        statusText.style.color = "#ff0033";
    }
}
function renderActiveSpark() {
    const spark = sparkList.find(s => s.id === sparkId);
    if (!spark) return;
    document.title = `Spark: ${spark.name}`;
    const container = document.getElementById('spark-content-container');
    if (spark.link && (spark.link.startsWith('http') || spark.link.includes('//'))) {
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
        const newUrl = `${window.location.pathname}?current=${currentId}&spark=${sparkId}`;
        window.history.pushState({path:newUrl},'',newUrl);
        renderActiveSpark();
    }
}

function toggleZen() {
    isZen = !isZen;
    document.body.classList.toggle('zen-active', isZen);
}

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
        } catch (e) { console.warn("CORS Blocked Frame"); }
    }, 4000);
}

// --- ACTIONS ---
document.getElementById('zen-btn').onclick = toggleZen;

document.getElementById('set-cover-btn').onclick = async () => {
    const btn = document.getElementById('set-cover-btn');
    const dataUrl = document.getElementById('live-thumb-canvas').toDataURL('image/webp', 0.8);
    btn.textContent = "SAVING...";
    await db.ref(`arcade_infrastructure/currents/${currentId}/sparks/${sparkId}`).update({ image: dataUrl });
    btn.textContent = "COVER SET!";
    setTimeout(() => { btn.textContent = "SET AS COVER"; }, 2000);
};

document.getElementById('download-btn').onclick = () => {
    const canvas = document.getElementById('live-thumb-canvas');
    const link = document.createElement('a');
    link.download = `spark-${sparkId}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
};

document.getElementById('fallback-url-btn').onclick = async () => {
    const url = prompt("Paste Image URL:");
    if (url) {
        await db.ref(`arcade_infrastructure/currents/${currentId}/sparks/${sparkId}`).update({ image: url });
    }
};

document.getElementById('prev-zone').onclick = () => navigate(1);
document.getElementById('next-zone').onclick = () => navigate(-1);

window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'z') toggleZen();
    if (e.key === 'ArrowLeft') navigate(1);
    if (e.key === 'ArrowRight') navigate(-1);
    if (e.key === 'Escape') isZen ? toggleZen() : window.close();
});

initSparkView();
