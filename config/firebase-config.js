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

// Objective: Internalized Auth Context [cite: 2026-03-21]
export async function getArcadeData() {
    // 1. Internalize the current user from the Firebase Auth instance
    const currentUser = auth.currentUser; 
    const data = {};

    // 2. Define our targets
    const publicPaths = ['auth_ui', 'search_index', 'settings', 'navigation', 'action-cards'];

    try {
        // 3. Fetch Public Nodes (with individual safety catches)
        const snapshots = await Promise.all(
            publicPaths.map(path => 
                get(ref(db, path)).catch(err => {
                    console.warn(`[SECURITY]: Access denied to ${path}. Skipping.`);
                    return null;
                })
            )
        );
        publicPaths.forEach((path, i) => { data[path] = snapshots[i]?.val(); });

        // 4. Fetch User Data (Specific UID if logged in, otherwise the Index)
        if (currentUser) {
            // Fetch the entire users node (requires the .read: auth != null rule at the users level)
            const usersSnap = await get(ref(db, 'users')).catch(() => null);
            data.users = usersSnap?.val() || {};
        }

        // 5. Superuser Only: app_manifest
        if (currentUser?.email === 'yertalcorp@gmail.com') {
            const manifestSnap = await get(ref(db, 'app_manifest')).catch(() => null);
            data.app_manifest = manifestSnap?.val();
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
export { ref, set, get, push, runTransaction, auth, db, update };
