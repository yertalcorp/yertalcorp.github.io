import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, get, push, update, runTransaction } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

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

// Objective: Granular, Error-Resistant Fetching [cite: 2026-03-21]
export async function getArcadeData() {
    const currentUser = auth.currentUser;
    const urlParams = new URLSearchParams(window.location.search);
    const pageOwnerSlug = urlParams.get('user') || 'yertal-arcade';

    console.log("getArcadeData - Target Slug:", pageOwnerSlug);

    const data = {};
    const publicPaths = ['app_manifest', 'auth_ui', 'search_index', 'settings', 'navigation', 'action-cards', 'showcase-items'];

    try {
        // 1. Fetch Public Nodes (Fails gracefully if one is blocked)
        const snapshots = await Promise.all(
            publicPaths.map(path => get(ref(db, path)).catch(() => null))
        );
        publicPaths.forEach((path, i) => { data[path] = snapshots[i]?.val(); });

        // 2. Identify the Page Owner via the Search Index
        const slugToIndex = data.search_index || {};
        console.log("getArcadeData - Search Index Snapshot:", slugToIndex);

        const ownerUid = Object.keys(slugToIndex).find(uid => slugToIndex[uid] === pageOwnerSlug);
        console.log("getArcadeData - Resolved ownerUid:", ownerUid);

        // 3. SURGICAL FETCH: Get only the Owner's Profile and infrastructure
        if (ownerUid) {
            const [profileSnap, infraSnap] = await Promise.all([
                get(ref(db, `users/${ownerUid}/profile`)).catch(() => null),
                get(ref(db, `users/${ownerUid}/infrastructure`)).catch(() => null)
            ]);
            
            data.users = {
                [ownerUid]: {
                    profile: profileSnap?.val(),
                    infrastructure: infraSnap?.val()
                }
            };
            console.log(`getArcadeData - Data Fetched for ${ownerUid}:`, data.users[ownerUid]);
        } else {
            console.warn("getArcadeData - No UID found for slug:", pageOwnerSlug);
        }

        // 4. SUPERUSER FETCH: manifest by default
        const manifestSnap = await get(ref(db, 'app_manifest')).catch(() => null);
        data.app_manifest = manifestSnap?.val();
        console.log("app_manifest found", data.app_manifest); 

        console.log("getArcadeData - Final Data Object:", data);
        return data;
    } catch (error) {
        console.error("Critical Failure in getArcadeData Pipeline:", error);
        throw error;
    }
}

/* Create a new user in the DB*/
export async function initializeUserIfNeeded(user) {
    const userRef = ref(db, `users/${user.uid}`);
    const snapshot = await get(userRef);

    if (!snapshot.exists()) {
        const fullName = user.displayName || "New Engineer";
        const firstName = fullName.split(' ')[0];
        const baseSlug = fullName.toLowerCase().replace(/\s+/g, '-') + `-${user.uid.substring(0, 4)}`;

        const initialData = {
            profile: {
                display_name: fullName,
                slug: baseSlug,
                arcade_title: `${firstName.toUpperCase()}'S ARCADE`,
                arcade_subtitle: "System Standby. Awaiting Initial Sequence.",
                branding_color: "#00f2ff",
                arcade_logo: "/assets/images/Yertal_Logo_New_HR.png",
                privacy: "private"
            }
            // Infrastructure is left empty here
        };

        await set(userRef, initialData);
        await set(ref(db, `search_index/${baseSlug}`), user.uid);
        return baseSlug;
    }
    return snapshot.val().profile.slug;
}
export { ref, set, get, push, runTransaction, auth, db, update };
