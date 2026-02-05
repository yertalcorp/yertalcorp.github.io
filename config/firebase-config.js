// Objective: Centralize the SDK paths
const FIREBASE_VER = "10.7.1";
const FIREBASE_SITE = "https://www.gstatic.com/firebasejs";

// Use backticks and ${} for proper template literals
const DB_SDK = `${FIREBASE_SITE}/${FIREBASE_VER}/firebase-database.js`;
const APP_SDK = `${FIREBASE_SITE}/${FIREBASE_VER}/firebase-app.js`;
const AUTH_SDK = `${FIREBASE_SITE}/${FIREBASE_VER}/firebase-auth.js`;

import { initializeApp } from APP_SDK;
import { getDatabase, ref, set, push } from DB_SDK;
import { getAuth } from AUTH_SDK;

export const firebaseConfig = {
  apiKey : "AIzaSyAuwxVwXTL78hPTq-7UnXWVwsG1ipXoF_0", 
  authDomain: "yertal-arcade.firebaseapp.com",
  databaseURL: "https://yertal-arcade-default-rtdb.firebaseio.com",
  projectId: "yertal-arcade",
  storageBucket: "yertal-arcade.firebasestorage.app",
  messagingSenderId: "218347522316",
  appId: "1:218347522316:web:d0dbabeb8373a663d16129",
  measurementId: "G-2VP21WZ4CG"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app); // Define this BEFORE the helper function

// The helper for the Arcade
export async function saveToRealtimeDB(path, data) {
    return set(ref(db, path), data);
}

export { auth, db };
