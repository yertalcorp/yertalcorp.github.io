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

// Objective: Fetch only allowed nodes to avoid Permission Denied
export async function getArcadeData() {
    try {
        const paths = ['app_manifest', 'auth_ui', 'search_index', 'settings', 'users'];
        const snapshots = await Promise.all(
            paths.map(path => get(ref(db, path)))
        );

        const data = {};
        paths.forEach((path, i) => {
            data[path] = snapshots[i].val();
        });

        return data;
    } catch (error) {
        console.error("Critical: Security policy blocked full tree fetch.");
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
