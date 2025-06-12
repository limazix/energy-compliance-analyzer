// src/lib/firebase-admin.ts
/**
 * @fileOverview Initializes and exports the Firebase Admin SDK instances.
 * This ensures the Admin SDK is initialized only once.
 * For use in server-side environments like Next.js Server Actions.
 */
import * as admin from 'firebase-admin';

const SERVICE_ACCOUNT_PATH = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH;

try {
  if (!admin.apps.length) {
    if (SERVICE_ACCOUNT_PATH) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const serviceAccount = require(SERVICE_ACCOUNT_PATH);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        // Add other admin config like databaseURL if needed for your specific project
        // databaseURL: `https://${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.firebaseio.com`,
      });
      // eslint-disable-next-line no-console
      console.info('[FirebaseAdmin] Admin SDK initialized with service account from path.');
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
      });
      // eslint-disable-next-line no-console
      console.info('[FirebaseAdmin] Admin SDK initialized with Application Default Credentials.');
    } else {
      // Fallback for environments where ADC might be implicitly available (like some GCP environments)
      // or if you configure it via `firebase-admin` specific env vars.
      admin.initializeApp();
      // eslint-disable-next-line no-console
      console.info('[FirebaseAdmin] Admin SDK initialized (attempted default initialization).');
    }
  } else {
    // eslint-disable-next-line no-console
    console.info('[FirebaseAdmin] Admin SDK already initialized.');
  }
} catch (error) {
  // eslint-disable-next-line no-console
  console.error('[FirebaseAdmin] CRITICAL: Firebase Admin SDK initialization failed:', error);
  // Depending on your error handling strategy, you might want to re-throw or exit
}

export const adminAuth = admin.auth();
export const adminDb = admin.firestore();
export const adminStorage = admin.storage();
export const adminPubSub = admin.pubsub(); // Export PubSub instance
export const adminInstance = admin; // Export the core admin instance if needed
