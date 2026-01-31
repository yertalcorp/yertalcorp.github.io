// 1. YOUR FIREBASE CONFIG (Replace with your actual keys from Firebase Console)
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "yertal-arcade.firebaseapp.com",
  databaseURL: "https://yertal-arcade-default-rtdb.firebaseio.com",
  projectId: "yertal-arcade",
  storageBucket: "yertal-arcade.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:12345:web:abcde"
};

// 2. Initialize
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();

// 3. The Sync Function
async function applyGlobalSettings() {
    // Check if we have settings saved from the last visit
    // This prevents the browser from showing the transition to styles
    const cachedUI = localStorage.getItem('arcade_ui_settings');
    if (cachedUI) {
        **renderStyles(JSON.parse(cachedUI));
    }

    // Fetch the freshest data from your settings/ui-settings folder
    try {
        const snapshot = await db.ref('settings/ui-settings').once('value');
        const ui = snapshot.val();
        if (ui) {
            localStorage.setItem('arcade_ui_settings', JSON.stringify(ui));
            renderStyles(ui);**
        }
    } catch (e) { console.error("Firebase Sync Failed:", e); }
}

function renderStyles(ui) {
    // This maps your JSON tuples to CSS variables
    const root = document.documentElement;
    root.style.setProperty('--neon-color', ui['neon-color']);
    root.style.setProperty('--color-accent', ui['color-accent']);
    root.style.setProperty('--btn-radius', ui['button-radius'] + 'px');
    root.style.setProperty('--btn-padding', ui['button-padding']);
    document.body.style.fontFamily = ui['font-title'];
}
