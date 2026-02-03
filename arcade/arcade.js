import { db } from './firebase-config.js';

/**
 * Objective: Initialize the arcade UI using data from Firebase.
 * This ensures no hardcoded text or fonts remain in the HTML.
 */
const initArcade = async () => {
    try {
        // 1. Fetch the UI Configuration document
        const uiDoc = await db.collection('arcade_settings').doc('config').get();
        if (!uiDoc.exists) return;
        const ui = uiDoc.data();

        // 2. Apply System-Default Font from DB
        **document.body.style.fontFamily = ui.systemDefaultFont;**

        // 3. Inject Branding & Hero text
        **document.getElementById('corp-name-display').textContent = ui.branding.corpName;**
        **document.getElementById('hero-heading').textContent = ui.hero.title;**
        **document.getElementById('hero-subheading').textContent = ui.hero.subTitle;**
        **document.getElementById('create-arcade-btn').textContent = ui.buttons.createArcade;**
        **document.getElementById('auth-trigger').textContent = ui.buttons.login;**

        // 4. Pull and Render the Currents (Categories)
        renderCurrents();

    } catch (error) {
        console.error("Lab Error: Configuration failed to stream.", error);
    }
};

/**
 * Objective: Render the 3 rows of pre-filled categories (Currents)
 */
const renderCurrents = async () => {
    const container = document.getElementById('currents-container');
    const currentsSnap = await db.collection('currents').orderBy('displayOrder').get();

    let htmlBuffer = "";

    currentsSnap.forEach(doc => {
        const current = doc.data();
        htmlBuffer += `
            <section class="current-row">
                <div class="current-header">
                    <h3>${current.name}</h3>
                    <div class="current-controls">
                        <button class="btn-sub">${current.labels.subscribe}</button>
                        <button class="btn-filter">Filter</button>
                        <div class="try-box">
                            <span>Try it yourself:</span>
                            <input type="text" maxlength="200" placeholder="${current.labels.examplePrompt}">
                            <button class="btn-spark">Spark It</button>
                        </div>
                    </div>
                </div>
                <div class="spark-grid" id="grid-${doc.id}">
                    </div>
            </section>
        `;
    });

    **container.innerHTML = htmlBuffer;**
    
    // After rendering rows, pull the Sparks for each
    currentsSnap.forEach(doc => fetchSparksForCurrent(doc.id));
};

// Start the Lab
initArcade();
