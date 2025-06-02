
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';

// Firebase SDK will throw its own errors if critical parts of firebaseConfig are missing/invalid.
// We are relying on next.config.ts to provide these environment variables to the client.

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID!,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL!,
};

let app: FirebaseApp;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const googleProvider = new GoogleAuthProvider();

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
} else {
  console.log('Firebase: Connecting to production Firebase services.');
}


export { app, auth, db, storage, googleProvider };

