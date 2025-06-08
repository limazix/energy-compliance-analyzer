
// src/lib/firebase.ts
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getDatabase } from 'firebase/database';
import { connectEmulators } from './emulators';

const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
const messagingSenderId = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;
const measurementId = process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID;
const databaseURL = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;

if (!apiKey) {
  const errorMsg = 'CRITICAL_CONFIG_ERROR: Firebase API Key (NEXT_PUBLIC_FIREBASE_API_KEY) is undefined or empty. Check your .env file or deployment environment variables.';
  console.error(errorMsg);
  throw new Error(errorMsg);
}
if (!projectId) {
  const errorMsg = 'CRITICAL_CONFIG_ERROR: Firebase Project ID (NEXT_PUBLIC_FIREBASE_PROJECT_ID) is undefined or empty. Check your .env file or deployment environment variables.';
  console.error(errorMsg);
  throw new Error(errorMsg);
}

console.log(`Firebase Init: API Key Type: ${typeof apiKey}, Value (masked): ${apiKey.substring(0, 3)}...${apiKey.substring(apiKey.length - 3)}`);
console.log(`Firebase Init: Project ID: ${projectId}`);
console.log(`Firebase Init: Auth Domain: ${authDomain}`);


const firebaseConfig = {
  apiKey: apiKey,
  authDomain: authDomain,
  projectId: projectId,
  storageBucket: storageBucket,
  messagingSenderId: messagingSenderId,
  appId: appId,
  measurementId: measurementId,
  databaseURL: databaseURL,
};

let app: FirebaseApp;

if (getApps().length === 0) {
  app = initializeApp(firebaseConfig); // Pass the config object here
} else {
  app = getApp();
}

const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const rtdb = getDatabase(app);
const googleProvider = new GoogleAuthProvider();

// Connect emulators if running locally
connectEmulators(auth, db, storage, rtdb);

export { app, auth, db, storage, rtdb, googleProvider };
