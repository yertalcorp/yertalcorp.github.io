// --- 1. CONFIGURATION ---
// These details come from your Firebase Project Settings
const firebaseConfig = {
  apiKey: "AIzaSyAuwxVwXTL78hPTq-7UnXWVwsG1ipXoF_0",
  authDomain: "yertal-arcade.firebaseapp.com",
  databaseURL: "https://yertal-arcade-default-rtdb.firebaseio.com",
  projectId: "yertal-arcade",
  storageBucket: "yertal-arcade.firebasestorage.app",
  messagingSenderId: "218347522316",
  appId: "1:218347522316:web:d0dbabeb8373a663d16129",
  measurementId: "G-2VP21WZ4CG"
};

// --- 2. THE INITIALIZER ---
async function initShowroom() {
    // Connect to Firebase
    const app = window.firebase.initializeApp(firebaseConfig);
    const db = window.firebase.database().ref('/');

    // Fetch the Master JSON
    db.on('value', (snapshot) => {
        const data = snapshot.val();
        
        if (data) {
            // A. Inject External Assets (Fonts/Icons)
            injectExternalAssets(data.settings.external_assets);
            
            // B. Set Global UI Variables (Colors/Blur/Radius)
            applyGlobalStyles(data.settings['ui-settings']);
            
            // C. Render Sections
            renderNavbar(data.navigation, data.settings['ui-settings'], data.auth_ui);
            renderHero(data.hero_section);
            renderShowcase(data['showcase-items'], data.settings['ui-settings']);
            renderActionCards(data['action-cards'], data.settings['ui-settings']);
            renderFooter(data.navigation.footer);
            
            // D. Remove Loading State (Fade in the site)
            document.body.classList.remove('loading-state');
            document.body.style.opacity = '1';
        }
    });
}

// --- 3. HELPER FUNCTIONS ---
function injectExternalAssets(assets) {
    const head = document.head;
    // Inject Fonts
    const fontLink = document.createElement('link');
    fontLink.rel = 'stylesheet';
    fontLink.href = assets.google_fonts_url;
    head.appendChild(fontLink);
    // Inject Icons
    const iconLink = document.createElement('link');
    iconLink.rel = 'stylesheet';
    iconLink.href = assets.font_awesome_url;
    head.appendChild(iconLink);
}

// Export the init function to index.html
window.initShowroom = initShowroom;
