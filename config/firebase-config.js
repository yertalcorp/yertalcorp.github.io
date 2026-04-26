import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, get, push, update, runTransaction } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
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
    const pageOwnerSlug = urlParams.get('user') || 'yertal-arcade';

    const data = {};
    const publicPaths = ['app_manifest', 'chat_config', 'settings', 'search_index']; // Simplified for brevity

    try {
        const snapshots = await Promise.all(
            publicPaths.map(path => get(ref(db, path)).catch(() => null))
        );
        publicPaths.forEach((path, i) => { data[path] = snapshots[i]?.val(); });

        const slugToIndex = data.search_index || {};
        let ownerUid = slugToIndex[pageOwnerSlug];

        // --- NEW MULTI-TIER RESOLUTION ---
        
        // Tier 2: Check if the slug IS a UID (Direct Access)
        if (!ownerUid && pageOwnerSlug.length > 20) {
            ownerUid = pageOwnerSlug;
        }

        // Tier 3: Authenticated Owner Fallback 
        // If we still have no UID, but the user is logged in, check their own profile slug
        if (!ownerUid && currentUser) {
            // We fetch the logged-in user's profile to see if their slug matches the URL
            const ownProfileSnap = await get(ref(db, `users/${currentUser.uid}/profile`)).catch(() => null);
            const ownProfile = ownProfileSnap?.val();
            
            if (ownProfile?.slug === pageOwnerSlug) {
                console.log("getArcadeData: Resolved via Authenticated Profile Match.");
                ownerUid = currentUser.uid;
            }
        }

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
        }

        return data;
    } catch (error) {
        console.error("Critical Failure in getArcadeData:", error);
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

export { ref, set, get, push, runTransaction, update, app, auth, db };
