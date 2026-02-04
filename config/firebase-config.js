import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// YOUR FIREBASE CONFIG (Replace with your actual keys from Firebase Console)
export const firebaseConfig = {
  apiKey : "AIzaSyAuwxVwXTL78hPTq-7UnXWVwsG1ipXoF_0" , 
  authDomain: "yertal-arcade.firebaseapp.com",
  databaseURL: "https://yertal-arcade-default-rtdb.firebaseio.com",
  projectId: "yertal-arcade",
  storageBucket: "yertal-arcade.firebasestorage.app",
  messagingSenderId: "218347522316",
  appId: "1:218347522316:web:d0dbabeb8373a663d16129",
  measurementId: "G-2VP21WZ4CG"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export initialized services for your other .js files to use
export const auth = getAuth(app);
export const db = getFirestore(app);
