import { auth } from './firebase-config.js';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// Login function
export const login = (email, password) => {
    return signInWithEmailAndPassword(auth, email, password);
};

/**
 * Objective: Democratic Login Switchboard
 */
export const loginWithProvider = (providerName) => {
     let provider;
     switch(providerName) {
     case 'google': provider = new GoogleAuthProvider(); break;
     case 'facebook': provider = new FacebookAuthProvider(); break;
     case 'microsoft': provider = new OAuthProvider('microsoft.com'); break;
     case 'discord': provider = new OAuthProvider('oidc.discord'); break; // Requires Discord setup in Firebase Console
     default: throw new Error("Unknown Provider");
 }
 return signInWithPopup(auth, provider);
};

// Logout function
export const logout = () => {
    return signOut(auth);
};

// State Observer
export const watchAuthState = (callback) => {
    return onAuthStateChanged(auth, callback);
};

/**
 * Objective: Register a new user to the yertal-arcade database.
*/
export const signup = (email, password) => {
   return createUserWithEmailAndPassword(auth, email, password);
};
