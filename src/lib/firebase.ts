// src/lib/firebase.ts
/**
 * @fileOverview Firebase SDK initialization and configuration.
 * This module initializes the Firebase app and exports instances of Firebase services
 * such as Auth, Firestore, Storage, Realtime Database, and Functions. It also
 * handles connecting to Firebase emulators in a local development environment.
 */
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { getStorage } from 'firebase/storage';

import { connectEmulators } from './emulators';

import type { FirebaseApp } from 'firebase/app';
import type { Functions as FirebaseFunctionsService } from 'firebase/functions';

interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
  databaseURL?: string;
}

const firebaseConfigString = process.env.NEXT_PUBLIC_FIREBASE_CONFIG;

if (!firebaseConfigString) {
  const errorMsg =
    'CRITICAL_CONFIG_ERROR: Firebase config JSON (NEXT_PUBLIC_FIREBASE_CONFIG) is undefined or empty. Check your .env file or deployment environment variables.';
  console.error(errorMsg);
  throw new Error(errorMsg);
}

let firebaseConfig: FirebaseConfig;
try {
  firebaseConfig = JSON.parse(firebaseConfigString);
} catch (e: unknown) {
  const errorMsg = `CRITICAL_CONFIG_ERROR: Failed to parse Firebase config JSON (NEXT_PUBLIC_FIREBASE_CONFIG). Error: ${
    e instanceof Error ? e.message : String(e)
  }. Value: ${firebaseConfigString}`;
  console.error(errorMsg);
  throw new Error(errorMsg);
}

if (!firebaseConfig.apiKey) {
  const errorMsg =
    'CRITICAL_CONFIG_ERROR: "apiKey" is missing in Firebase config JSON (NEXT_PUBLIC_FIREBASE_CONFIG).';
  console.error(errorMsg);
  throw new Error(errorMsg);
}
if (!firebaseConfig.projectId) {
  const errorMsg =
    'CRITICAL_CONFIG_ERROR: "projectId" is missing in Firebase config JSON (NEXT_PUBLIC_FIREBASE_CONFIG).';
  console.error(errorMsg);
  throw new Error(errorMsg);
}

console.info(
  `Firebase Init: Using NEXT_PUBLIC_FIREBASE_CONFIG. Project ID: ${
    firebaseConfig.projectId
  }, API Key (masked): ${String(firebaseConfig.apiKey).substring(0, 3)}...${String(
    firebaseConfig.apiKey
  ).substring(String(firebaseConfig.apiKey).length - 3)}`
);

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
// Specify the region for the Functions client instance
const functionsRegion = process.env.GCLOUD_REGION || 'us-central1';
console.info(`Firebase Init: Initializing Functions client for region: ${functionsRegion}`);
const functionsInstance: FirebaseFunctionsService = getFunctions(app, functionsRegion);
const googleProvider = new GoogleAuthProvider();

connectEmulators(auth, db, storage, rtdb, functionsInstance);

export { app, auth, db, storage, rtdb, googleProvider, functionsInstance };
