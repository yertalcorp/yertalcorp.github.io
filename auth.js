import { auth } from './firebase-config.js';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

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
