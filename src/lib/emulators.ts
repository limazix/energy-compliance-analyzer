
import { Auth, connectAuthEmulator } from 'firebase/auth';
import { connectFirestoreEmulator, Firestore } from 'firebase/firestore';
import { connectStorageEmulator, FirebaseStorage } from 'firebase/storage';
import { connectDatabaseEmulator, Database } from 'firebase/database';


export function connectEmulators(auth: Auth, db: Firestore, storage: FirebaseStorage, rtdb: Database) {
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
}