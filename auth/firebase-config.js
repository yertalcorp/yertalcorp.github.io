import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// YOUR FIREBASE CONFIG (Replace with your actual keys from Firebase Console)
export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "yertal-arcade.firebaseapp.com",
  databaseURL: "https://yertal-arcade-default-rtdb.firebaseio.com",
  projectId: "yertal-arcade",
  storageBucket: "yertal-arcade.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:12345:web:abcde"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export initialized services for your other .js files to use
export const auth = getAuth(app);
export const db = getFirestore(app);
