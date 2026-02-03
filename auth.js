import { auth } from './firebase-config.js';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// Login function
export const login = (email, password) => {
    return signInWithEmailAndPassword(auth, email, password);
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
