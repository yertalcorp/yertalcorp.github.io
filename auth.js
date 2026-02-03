import { auth } from './firebase-config.js';
import { 
    getAuth, 
    signInWithPopup, 
    GoogleAuthProvider, 
    GithubAuthProvider, 
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
        default: 
            throw new Error("Provider not supported on the free tier.");
    }
    return signInWithPopup(auth, provider);
};

/**
 * Objective: Logout and clear session
 */
export const logout = () => {
    return signOut(auth);
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
