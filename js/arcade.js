import { firebaseConfig, auth } from '../config/firebase-config.js';
import { watchAuthState, logout } from '../config/auth.js';

let user;

// 1. THE BOUNCER: Path is correct, now check the user
watchAuthState((newUser) => {
     user = newUser;
     if (!user) {
         // Kick back to root index if not logged in
         window.location.href = '../index.html';
     } else {
         initArcade();
     }
});

const initArcade = async () => {
    try {
       // 2. Fetch using the Config URL (Realtime DB)
        const response = await fetch(`${firebaseConfig.databaseURL}/.json`);
        const data = await response.json();
        
        if (!data) return;
        
        // Inject Branding from navigation/branding
        const brand = data.navigation.branding;
        document.getElementById('corp-name-display').textContent = brand.parts[0].text + brand.parts[1].text;
        
        // Inject Hero text
        const hero = data.arcade_hero || { title: "Arcade Hub", description: "Authorized" };
        document.getElementById('hero-heading').textContent = hero.title;
        document.getElementById('hero-subheading').textContent = hero.description;

        // Setup logout on the auth-trigger button
        const authBtn = document.getElementById('auth-trigger');
        authBtn.textContent = "SIGN OUT";
        authBtn.onclick = () => logout();

        // 3. Render the Rows
        renderCurrents(data.currents);

    } catch (error) {
        console.error("Arcade System Error:", error);
    }
};

const renderCurrents = (currentsData) => {
    const container = document.getElementById('currents-container');
    if (!currentsData) return;

    let htmlBuffer = "";
    
    // Objective: Iterate through the Currents object from the DB
    Object.keys(currentsData).forEach(id => {
        const current = currentsData[id];
        htmlBuffer += `
            <section class="current-row">
                <div class="current-header">
                    <h3>${current.name}</h3>
                    <div class="current-controls">
                        <button class="btn-sub">Subscribe</button>
                        <div class="try-box">
                            <input type="text" placeholder="Prompt the ${current.name}...">
                            <button class="btn-spark">Spark</button>
                        </div>
                    </div>
                </div>
                <div class="spark-grid" id="grid-${id}"></div>
            </section>
        `;
    });

    container.innerHTML = htmlBuffer;
};
