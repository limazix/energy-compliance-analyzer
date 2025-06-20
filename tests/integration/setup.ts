// tests/integration/setup.ts
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions';
import { connectStorageEmulator, getStorage } from 'firebase/storage';

// Define a Firebase config object.
// The emulator host environment variables will override these connection details
// when running with `firebase emulators:exec`.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

let app: FirebaseApp;

// Check if Firebase has already been initialized to avoid re-initializing.
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

try {
  // Get instances of the Firebase services
  const auth = getAuth(app);
  const firestore = getFirestore(app);
  const functions = getFunctions(app);
  const storage = getStorage(app);

  // Conditionally connect to the emulators based on environment variables
  // firebase emulators:exec sets these environment variables

  if (process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    const [authHost, authPort] = process.env.FIREBASE_AUTH_EMULATOR_HOST.split(':');
    console.log(`Connecting Auth emulator at http://${authHost}:${authPort}`);
    connectAuthEmulator(auth, `http://${authHost}:${authPort}`);
  }

  if (process.env.FIRESTORE_EMULATOR_HOST) {
    const [firestoreHost, firestorePort] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
    console.log(`Connecting Firestore emulator at http://${firestoreHost}:${firestorePort}`);
    connectFirestoreEmulator(firestore, firestoreHost, parseInt(firestorePort, 10));
  }

  // Functions emulator requires the region
  // Assuming your functions are in 'us-central1', adjust if necessary
  const functionsRegion = 'us-central1';
  if (process.env.FIREBASE_FUNCTIONS_EMULATOR_HOST) {
    const [functionsHost, functionsPort] = process.env.FIREBASE_FUNCTIONS_EMULATOR_HOST.split(':');
    console.log(`Connecting Functions emulator at http://${functionsHost}:${functionsPort}`);
    connectFunctionsEmulator(functions, functionsHost, parseInt(functionsPort, 10), functionsRegion);
  }

  if (process.env.FIREBASE_STORAGE_EMULATOR_HOST) {
    const [storageHost, storagePort] = process.env.FIREBASE_STORAGE_EMULATOR_HOST.split(':');
    // Storage emulator expects the protocol and host, but not the port in the env var,
    // the connectStorageEmulator function takes host and port separately.
    // Need to be careful with how FIREBASE_STORAGE_EMULATOR_HOST is formatted.
    // Standard is host:port. Let's parse assuming host:port.
     console.log(`Connecting Storage emulator at http://${storageHost}:${storagePort}`);
     connectStorageEmulator(storage, storageHost, parseInt(storagePort, 10));
  }

  console.log('Firebase emulator setup complete.');

} catch (error) {
  console.error('Error setting up Firebase emulators:', error);
  // Depending on your testing strategy, you might want to throw the error
  // or handle it differently. For integration tests, failing setup is critical.
   throw new Error(`Failed to connect to Firebase emulators: ${error}`);
}