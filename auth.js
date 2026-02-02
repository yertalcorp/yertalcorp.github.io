import { initializeApp } from "firebase/app";
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged 
} from "firebase/auth";

// TASK: Import the centralized config from your specific config file
import { firebaseConfig } from './firebase-config.js';

// Initialize Firebase App using the imported config
const app = initializeApp(firebaseConfig);

// Initialize and Export Auth Instance
export const auth = getAuth(app);

/* OBJECTIVE: Exported Auth Utilities */

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
