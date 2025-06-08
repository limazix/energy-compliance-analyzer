
// src/lib/firebase.ts
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { getDatabase, connectDatabaseEmulator } from 'firebase/database';

// Log the raw environment variables for diagnostics
const rawApiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const rawProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

console.log('[FirebaseSetup] Raw NEXT_PUBLIC_FIREBASE_API_KEY type:', typeof rawApiKey);
if (typeof rawApiKey === 'string' && rawApiKey.length > 6) {
  console.log('[FirebaseSetup] Raw NEXT_PUBLIC_FIREBASE_API_KEY (masked):', `${rawApiKey.substring(0, 3)}...${rawApiKey.substring(rawApiKey.length - 3)}`);
} else if (typeof rawApiKey === 'string') {
  console.log('[FirebaseSetup] Raw NEXT_PUBLIC_FIREBASE_API_KEY (short or empty):', rawApiKey);
}
console.log('[FirebaseSetup] Raw NEXT_PUBLIC_FIREBASE_PROJECT_ID:', rawProjectId);

// Construct Firebase config from individual environment variables
const firebaseConfig = {
  apiKey: rawApiKey,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: rawProjectId,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID, // Optional
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,     // For RTDB
};

console.log('[FirebaseSetup] Constructed firebaseConfig.projectId:', firebaseConfig.projectId);
if (firebaseConfig.apiKey) {
    console.log('[FirebaseSetup] Constructed firebaseConfig.apiKey is present.');
} else {
    console.log('[FirebaseSetup] Constructed firebaseConfig.apiKey is MISSING or undefined.');
}


// Explicitly check for the API key and Project ID before initializing
if (!firebaseConfig.apiKey) {
  console.error("CRITICAL: Firebase API Key (NEXT_PUBLIC_FIREBASE_API_KEY) is undefined or empty. Firebase Auth will fail. Check your .env file or environment variables for deployed environments.");
}
if (!firebaseConfig.projectId) {
  console.error("CRITICAL: Firebase Project ID (NEXT_PUBLIC_FIREBASE_PROJECT_ID) is undefined or empty. Firebase services might not work as expected. Check your .env file or environment variables.");
}

let app: FirebaseApp;

if (getApps().length === 0) {
  app = initializeApp(firebaseConfig); // Firebase App is always initialized
} else {
  app = getApp();
}

const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const rtdb = getDatabase(app);
const googleProvider = new GoogleAuthProvider();

// Emulator connections for localhost
if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
  console.log('Firebase: Connecting to local emulators.');
  try {
    connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
    console.log('Firebase: Auth emulator connected.');
  } catch (e) {
    console.error('Firebase: Error connecting to Auth emulator.', e);
  }
  try {
    connectFirestoreEmulator(db, 'localhost', 8080);
    console.log('Firebase: Firestore emulator connected.');
  } catch (e) {
    console.error('Firebase: Error connecting to Firestore emulator.', e);
  }
  try {
    connectStorageEmulator(storage, 'localhost', 9199);
    console.log('Firebase: Storage emulator connected.');
  } catch (e) {
    console.error('Firebase: Error connecting to Storage emulator.', e);
  }
  try {
    connectDatabaseEmulator(rtdb, 'localhost', 9000);
    console.log('Firebase: Realtime Database emulator connected.');
  } catch (e) {
    console.error('Firebase: Error connecting to RTDB emulator.', e);
  }
} else {
  console.log('Firebase: Connecting to production Firebase services.');
}


export { app, auth, db, storage, rtdb, googleProvider };
