import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, get, push, update, increment, runTransaction, query, orderByChild, equalTo } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
// Build Check: Manually update the time string below when pushing new code
console.log(`%c FIREBASE CONFIG LOADED | ${new Date().toLocaleDateString()} @ 19:07:00 `, "background: #000; color: #00f2ff; font-weight: bold; border: 1px solid #00f2ff; padding: 4px;");

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

export async function getArcadeData() {
    const currentUser = auth.currentUser;
    const urlParams = new URLSearchParams(window.location.search);
    const targetRealmId = urlParams.get('realm');

    const data = { realms: {} };
    const publicPaths = ['app_manifest', 'chat_config', 'settings', 'search_index', 'analytics'];

    try {
        // 1. Fetch static global configurations
        const snapshots = await Promise.all(
            publicPaths.map(path => get(ref(db, path)).catch(() => null))
        );
        publicPaths.forEach((path, i) => { data[path] = snapshots[i]?.val(); });

        // 2. Fetch Circuit Templates
        const templatesQuery = query(ref(db, 'realms'), orderByChild('is_circuit_template'), equalTo(true));
        const templatesSnap = await get(templatesQuery).catch(() => null);
        if (templatesSnap?.exists()) {
            Object.assign(data.realms, templatesSnap.val());
        }

        // 3. Fetch User-Owned Realms
        if (currentUser?.uid) {
            const ownedQuery = query(ref(db, 'realms'), orderByChild('realm_ownerid'), equalTo(currentUser.uid));
            const ownedSnap = await get(ownedQuery).catch(() => null);
            if (ownedSnap?.exists()) {
                Object.assign(data.realms, ownedSnap.val());
            }
        }

        // 4. Fetch Targeted External Realm (if specified in URL and not in cache)
        if (targetRealmId && !data.realms[targetRealmId]) {
            const externalSnap = await get(ref(db, `realms/${targetRealmId}`)).catch(() => null);
            if (externalSnap?.exists()) {
                data.realms[targetRealmId] = externalSnap.val();
            }
        }

        // Reference helper pointer for active target
        data.realmData = targetRealmId ? data.realms[targetRealmId] || null : null;

        return data;
    } catch (error) {
        console.error("Critical Failure in getArcadeData:", error);
        throw error;
    }
}

/* Create a new user in the DB*/
/* Create a new user profile in the DB */
export async function initializeUserIfNeeded(user) {
    const userRef = ref(db, `users/${user.uid}/profile`);
    const snapshot = await get(userRef);

    if (!snapshot.exists()) {
        const timestamp = Date.now();
        const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const activeRealmId = `realm-${datePart}-${timestamp}`;

        const initialProfile = {
            uid: user.uid,
            email: user.email,
            photoURL: user.photoURL || "/assets/images/avatar.jpg",
            active_realm_id: activeRealmId,
            last_sync: new Date().toISOString()
        };

        await set(userRef, initialProfile);
        return activeRealmId;
    }
    
    return snapshot.val()?.active_realm_id || null;
}

export { getDatabase, auth, ref, set, get, push, update, increment, runTransaction, query, orderByChild, equalTo, db, app, getAuth, initializeApp };
