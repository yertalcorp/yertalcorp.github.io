import { auth } from './firebase-config.js';
import { 
    getAuth, 
    signInWithPopup,
    signInWithRedirect,
    GoogleAuthProvider, 
    GithubAuthProvider,
    OAuthProvider,
    signOut, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

/**
 * Objective: Democratic Login Switchboard (Free Tier)
 * Provides seamless entry via Google or GitHub.
 */
export const loginWithProvider = (providerName) => {
    let provider;
    switch(providerName) {
        case 'google': 
            provider = new GoogleAuthProvider(); 
            break;
        case 'github': 
            provider = new GithubAuthProvider(); 
            break;
        case 'yahoo':
            provider = new OAuthProvider('yahoo.com');
            break;
        default: 
            throw new Error("Provider not supported on the free tier.");
    }
    return signInWithPopup(auth, provider).then((result) => {
        localStorage.setItem('yertal_login_provider', result.providerId);
        return result;
    });
};

export const logout = async () => {
    try {
        // 1. Identify the provider from localStorage instead of the volatile currentUser object
        const providerId = localStorage.getItem('yertal_login_provider');

        // 2. Kill the Firebase session
        await signOut(auth);
        localStorage.removeItem('yertal_login_provider');

        // 3. Define Global Logout Endpoints
        const logoutUrls = {
            'google.com': 'https://accounts.google.com/Logout',
            'github.com': 'https://github.com/logout',
            'microsoft.com': 'https://login.microsoftonline.com/common/oauth2/v2.0/logout'
        };

        const targetUrl = logoutUrls[providerId];
        if (targetUrl) {
            window.location.href = targetUrl;
        } else {
            window.location.reload();
        }
        
        return targetUrl || null;
    } catch (error) {
        console.error("Sign out error:", error);
        throw error;
    }
};

/**
 * Objective: Monitor the user's status across the Arcade
 */
export const watchAuthState = (callback) => {
    return onAuthStateChanged(auth, callback);
};

/**
 * Objective: Retrieve verified profile data for the UI
 * Returns the name, email, and avatar from the Federated provider.
 */
export const getUserProfile = () => {
    const user = auth.currentUser;
    return user ? {
        name: user.displayName,
        email: user.email,
        photo: user.photoURL || 'https://via.placeholder.com/40',
        uid: user.uid
    } : null;
};


/**
 * Objective: Security Bouncer for protected folders (Arcade/Apps/Labs)
 * Redirects to root if no session is detected.
 */
export const protectRoute = (redirectPath = "../index.html") => {
     onAuthStateChanged(auth, (user) => {
         if (!user) {
             window.location.href = redirectPath;
         }
     });
};

export async function handleArcadeRouting(authUser, database) {
    const urlParams = new URLSearchParams(window.location.search);
    let urlSlug = urlParams.get('user'); 
    
    const allUsers = database.users || {};
    
    // 1. Identify the logged-in user's slug
    const myEntry = allUsers[authUser.uid];
    const mySlug = myEntry?.profile?.slug || null;

    // 2. Fallback: If URL is empty, go to user's slug or the superuser
    if (!urlSlug || urlSlug === 'undefined') {
        urlSlug = mySlug || 'yertal-arcade';
    }

    // 3. Find the UID by matching the URL string against the 'slug' field
    const viewedUid = Object.keys(allUsers).find(uid => 
        allUsers[uid].profile?.slug === urlSlug
    );

    const viewedData = allUsers[viewedUid];

    if (!viewedData) {
        console.warn(`Slug "${urlSlug}" not found. Falling back to Hub.`);
        return null; 
    }

    return {
        userData: viewedData,
        isOwner: authUser.uid === viewedUid,
        mySlug: mySlug // The slug for the "Home" button
    };
}

