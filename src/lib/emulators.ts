/**
 * @fileOverview Utility function to connect Firebase SDKs to local emulators.
 * This module checks if the application is running in a localhost environment
 * and, if so, connects the Auth, Firestore, Storage, Realtime Database, and
 * Functions SDKs to their respective emulators.
 */
import { connectAuthEmulator } from 'firebase/auth';
import { connectDatabaseEmulator } from 'firebase/database';
import { connectFirestoreEmulator } from 'firebase/firestore';
import { connectFunctionsEmulator } from 'firebase/functions';
import { connectStorageEmulator } from 'firebase/storage';

import type { Auth } from 'firebase/auth';
import type { Database } from 'firebase/database';
import type { Firestore } from 'firebase/firestore';
import type { Functions as FirebaseFunctionsService } from 'firebase/functions'; // Renamed import
import type { FirebaseStorage } from 'firebase/storage';

/**
 * Connects Firebase services to their respective emulators if running on localhost.
 * @param {Auth} auth - The Firebase Auth instance.
 * @param {Firestore} db - The Firebase Firestore instance.
 * @param {FirebaseStorage} storage - The Firebase Storage instance.
 * @param {Database} rtdb - The Firebase Realtime Database instance.
 * @param {FirebaseFunctionsService} functionsInstance - The Firebase Functions instance.
 */
export function connectEmulators(
  auth: Auth,
  db: Firestore,
  storage: FirebaseStorage,
  rtdb: Database,
  functionsInstance: FirebaseFunctionsService
) {
  // Emulator connections for localhost
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    // eslint-disable-next-line no-console
    console.info('Firebase: Connecting to local emulators.');
    try {
      connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
      // eslint-disable-next-line no-console
      console.info('Firebase: Auth emulator connected.');
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Firebase: Error connecting to Auth emulator.', e);
    }
    try {
      connectFirestoreEmulator(db, 'localhost', 8080);
      // eslint-disable-next-line no-console
      console.info('Firebase: Firestore emulator connected.');
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Firebase: Error connecting to Firestore emulator.', e);
    }
    try {
      connectStorageEmulator(storage, 'localhost', 9199);
      // eslint-disable-next-line no-console
      console.info('Firebase: Storage emulator connected.');
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Firebase: Error connecting to Storage emulator.', e);
    }
    try {
      connectDatabaseEmulator(rtdb, 'localhost', 9000);
      // eslint-disable-next-line no-console
      console.info('Firebase: Realtime Database emulator connected.');
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Firebase: Error connecting to RTDB emulator.', e);
    }
    try {
      connectFunctionsEmulator(functionsInstance, 'localhost', 5001);
      // eslint-disable-next-line no-console
      console.info('Firebase: Functions emulator connected.');
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Firebase: Error connecting to Functions emulator.', e);
    }
  } else {
    // eslint-disable-next-line no-console
    console.info('Firebase: Connecting to production Firebase services.');
  }
}
