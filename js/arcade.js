import { firebaseConfig, auth } from '../config/firebase-config.js';
import { watchAuthState, logout, saveToRealtimeDB } from '../config/auth.js';

let user;
let databaseCache = {};

// 1. BOUNCER & INITIALIZATION
watchAuthState((newUser) => {
    user = newUser;
    if (!user) {
        window.location.href = '../index.html';
    } else {
        initArcade();
    }
});

async function initArcade() {
    try {
        const response = await fetch(`${firebaseConfig.databaseURL}/.json`);
        databaseCache = await response.json();
        
        // Bind the "Create Current" button
        const createCurrentBtn = document.getElementById('create-arcade-btn');
        if (createCurrentBtn) {
            createCurrentBtn.textContent = "Spawn New Current";
            createCurrentBtn.onclick = handleCreateCurrent;
        }

        renderCurrents(databaseCache.currents);
    } catch (e) { console.error(e); }
}

// 2. THE CREATION GATE
window.handleCreation = async (currentId) => {
    const inputField = document.getElementById(`input-${currentId}`);
    const prompt = inputField.value;
    const mode = document.querySelector(`input[name="mode-${currentId}"]:checked`).value;

    if (!prompt) return;

    // A. PRE-SCREEN: Determine if "Creation" is even possible
    const check = await geminiPreScreen(prompt, mode);

    if (mode === 'prompt' && check.mustSource) {
        const proceed = confirm(`Yertal Logic: "${prompt}" exceeds creation boundaries and can only be sourced from the net. Continue with Sourcing?`);
        if (!proceed) return;
        executeMassSpark(currentId, prompt, 'sourcing', check.count);
    } else {
        executeMassSpark(currentId, prompt, mode, check.count);
    }
};

// 3. THE MASS SPARK ENGINE
async function executeMassSpark(currentId, prompt, mode, requestedCount) {
    const status = document.getElementById('engine-status-text');
    const count = Math.min(requestedCount || 6, 48); // Cap at 48
    
    status.textContent = `SPARKING ${count} ITEMS...`;

    try {
        if (mode === 'url' || mode === 'sourcing') {
            // Objective: Source data from the web via Gemini
            const links = await geminiSourceData(prompt, count);
            for (const item of links) {
                await saveSpark(currentId, { ...item, type: 'link', dateCreated: new Date().toLocaleDateString() });
            }
        } else {
            // Objective: Generate Code Sparks
            for (let i = 0; i < count; i++) {
                const code = await geminiGenerateCode(prompt, i);
                const snap = await captureScreenshot(code);
                await saveSpark(currentId, {
                    name: `${prompt} #${i+1}`,
                    code: code,
                    screenshot: snap,
                    type: 'code',
                    ownerName: user.email.split('@')[0],
                    dateCreated: new Date().toLocaleDateString()
                });
            }
        }
        status.textContent = "ENGINE READY";
        initArcade(); // Re-render everything
    } catch (e) {
        status.textContent = "SPARK ERROR";
        console.error(e);
    }
}

// 4. DATABASE HELPERS
async function saveSpark(currentId, sparkData) {
    const sparkId = `spark_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const path = `currents/${currentId}/sparks/${sparkId}`;
    await saveToRealtimeDB(path, sparkData);
}

// 5. GEMINI WRAPPERS (To be linked to your API)
async function geminiPreScreen(prompt, mode) {
    // Logic: If prompt contains "Top 10", "Latest", "Movies", "News" -> mustSource: true
    const sourcingKeywords = ['movie', 'latest', 'news', 'top', 'best', 'review'];
    const mustSource = sourcingKeywords.some(k => prompt.toLowerCase().includes(k));
    
    const countMatch = prompt.match(/\d+/);
    return {
        mustSource: mustSource,
        count: countMatch ? parseInt(countMatch[0]) : 6,
        fixedPrompt: prompt
    };
}



async function handleCreateCurrent() {
    const name = prompt("Name your new Current:");
    if (!name) return;
    const id = name.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now();
    await saveToRealtimeDB(`currents/${id}`, {
        name: name,
        focus: "User Defined",
        examplePrompt: "Spark something...",
        sparks: {}
    });
    initArcade();
}

// Objective: Talk to Gemini to get functional HTML/JS code
async function geminiGenerateCode(prompt, index) {
     // In a production environment, you would call your backend or the Google AI SDK
     // For now, we use the prompt to guide a high-level code generation request
     const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=AIzaSyBm_hgTArPco_CCk__xPadS39vK6eJSAMs`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
         contents: [{ parts: [{ text: `Create a single-file web app/game: ${prompt}. No external assets. Include <style> and <script>. Variant #${index}` }] }]
         })
     });
  
     const data = await response.json();
     return data.candidates[0].content.parts[0].text; // Returns the raw code
}

// Objective: Use Gemini to "search" and return structured JSON for links
async function geminiSourceData(prompt, count) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=AIzaSyBm_hgTArPco_CCk__xPadS39vK6eJSAMs`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
             contents: [{ parts: [{ text: `List ${count} real URLs and names for: ${prompt}. Return ONLY a JSON array: [{"name": "...", "url": "...", "screenshot": "..."}]` }] }]
         })
     });
     const data = await response.json();
     const jsonText = data.candidates[0].content.parts[0].text;
     return JSON.parse(jsonText.replace(/```json|```/g, '')); // Cleans up markdown formatting
}
