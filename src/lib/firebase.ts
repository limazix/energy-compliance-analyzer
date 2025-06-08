
// src/lib/firebase.ts
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getDatabase } from 'firebase/database';
import { connectEmulators } from './emulators';

const firebaseConfigString = process.env.NEXT_PUBLIC_FIREBASE_CONFIG;

if (!firebaseConfigString) {
  const errorMsg = 'CRITICAL_CONFIG_ERROR: Firebase config JSON (NEXT_PUBLIC_FIREBASE_CONFIG) is undefined or empty. Check your .env file or deployment environment variables.';
  console.error(errorMsg);
  throw new Error(errorMsg);
}

let firebaseConfig: any;
try {
  firebaseConfig = JSON.parse(firebaseConfigString);
} catch (e) {
  const errorMsg = `CRITICAL_CONFIG_ERROR: Failed to parse Firebase config JSON (NEXT_PUBLIC_FIREBASE_CONFIG). Error: ${e instanceof Error ? e.message : String(e)}. Value: ${firebaseConfigString}`;
  console.error(errorMsg);
  throw new Error(errorMsg);
}

if (!firebaseConfig.apiKey) {
  const errorMsg = 'CRITICAL_CONFIG_ERROR: "apiKey" is missing in Firebase config JSON (NEXT_PUBLIC_FIREBASE_CONFIG).';
  console.error(errorMsg);
  throw new Error(errorMsg);
}
if (!firebaseConfig.projectId) {
  const errorMsg = 'CRITICAL_CONFIG_ERROR: "projectId" is missing in Firebase config JSON (NEXT_PUBLIC_FIREBASE_CONFIG).';
  console.error(errorMsg);
  throw new Error(errorMsg);
}

console.info(`Firebase Init: Using NEXT_PUBLIC_FIREBASE_CONFIG. Project ID: ${firebaseConfig.projectId}, API Key (masked): ${String(firebaseConfig.apiKey).substring(0, 3)}...${String(firebaseConfig.apiKey).substring(String(firebaseConfig.apiKey).length - 3)}`);

let app: FirebaseApp;

if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
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


    