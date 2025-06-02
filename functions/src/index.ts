/**
 * Import function triggers from their respective modules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK
// This should be done only once per a functions deployment.
if (admin.apps.length === 0) {
  admin.initializeApp();
}

// Export functions from other files
export * from './processAnalysis';

// Example HTTP function (can be removed if not needed)
// import {onRequest} from "firebase-functions/v2/https";
// import * as logger from "firebase-functions/logger";
// export const helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });
