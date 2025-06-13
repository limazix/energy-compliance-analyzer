// src/lib/firebase-admin.ts
/**
 * @fileOverview Initializes and exports the Firebase Admin SDK instances.
 * This ensures the Admin SDK is initialized only once.
 * For use in server-side environments like Next.js Server Actions.
 */
import fs from 'fs'; // To read the service account file if path is provided
import path from 'path'; // To resolve the path

import * as admin from 'firebase-admin';

import { APP_CONFIG } from '@/config/appConfig';

const APP_NAME = APP_CONFIG.FIREBASE_ADMIN_APP_NAME_RSC; // Unique name for the app instance
let adminApp: admin.app.App;

// Environment variables for credentials
const SERVICE_ACCOUNT_ENV_PATH = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH;
const GOOGLE_ADC_ENV_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS;
const PROJECT_ID =
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
  process.env.GCLOUD_PROJECT ||
  process.env.GCP_PROJECT;

if (!admin.apps.find((app) => app?.name === APP_NAME)) {
  // eslint-disable-next-line no-console
  console.info(`[FirebaseAdmin] Initializing new Admin SDK app instance: ${APP_NAME}`);
  const appOptions: admin.AppOptions = {};
  let initMethod = 'default (no explicit credentials or path)';

  if (PROJECT_ID) {
    appOptions.projectId = PROJECT_ID;
    // eslint-disable-next-line no-console
    console.info(`[FirebaseAdmin] Using Project ID: ${PROJECT_ID} for app ${APP_NAME}`);
  } else {
    // eslint-disable-next-line no-console
    console.warn(
      `[FirebaseAdmin] Project ID (NEXT_PUBLIC_FIREBASE_PROJECT_ID, GCLOUD_PROJECT, or GCP_PROJECT) not found in env for app ${APP_NAME}. Relying on credentials to infer Project ID.`
    );
  }

  if (SERVICE_ACCOUNT_ENV_PATH) {
    const resolvedPath = path.resolve(SERVICE_ACCOUNT_ENV_PATH);
    // eslint-disable-next-line no-console
    console.info(
      `[FirebaseAdmin] Checking service account path for app ${APP_NAME}: ${resolvedPath}`
    );
    if (fs.existsSync(resolvedPath)) {
      try {
        appOptions.credential = admin.credential.cert(resolvedPath);
        initMethod = `service account file from path: ${resolvedPath}`;
      } catch (certError) {
        // eslint-disable-next-line no-console
        console.error(
          `[FirebaseAdmin] Error creating credential for ${APP_NAME} from cert path ${resolvedPath}:`,
          certError
        );
        // Fall through to try ADC or default
      }
    } else {
      // eslint-disable-next-line no-console
      console.warn(
        `[FirebaseAdmin] Service account file NOT FOUND for ${APP_NAME} at: ${resolvedPath}.`
      );
    }
  } else if (GOOGLE_ADC_ENV_PATH) {
    // If FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH is not used, but GOOGLE_APPLICATION_CREDENTIALS is set,
    // initializeApp (called below without explicit credential) will use it.
    initMethod = 'Application Default Credentials (GOOGLE_APPLICATION_CREDENTIALS)';
  }

  try {
    adminApp = admin.initializeApp(appOptions, APP_NAME);
    // eslint-disable-next-line no-console
    console.info(`[FirebaseAdmin] Admin SDK app '${APP_NAME}' initialized using ${initMethod}.`);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(
      `[FirebaseAdmin] CRITICAL: Firebase Admin SDK app '${APP_NAME}' initialization FAILED with method '${initMethod}'. Error:`,
      e
    );
    // Fallback to trying initializeApp() on the default admin namespace if named app failed,
    // especially if it was due to appOptions being problematic for some reason.
    if (!admin.apps.length) {
      // eslint-disable-next-line no-console
      console.warn(
        `[FirebaseAdmin] Attempting fallback initialization on default admin namespace.`
      );
      admin.initializeApp(); // Simplest form, relies purely on environment.
      adminApp = admin.app(); // Get the default app
      // eslint-disable-next-line no-console
      console.info(
        `[FirebaseAdmin] Fallback initialization on default admin namespace completed. App name: ${adminApp.name}`
      );
    } else {
      adminApp = admin.app(); // Get default app if it was already initialized by someone else
      // eslint-disable-next-line no-console
      console.warn(
        `[FirebaseAdmin] Named app '${APP_NAME}' init failed, but default app exists. Using default app: ${adminApp.name}`
      );
    }
    if (!adminApp) {
      // This is a critical failure state.
      const criticalError = new Error(
        `[FirebaseAdmin] Failed to obtain any initialized Firebase Admin app instance. Last error during named app init: ${e}`
      );
      // eslint-disable-next-line no-console
      console.error(criticalError.message);
      throw criticalError;
    }
  }
} else {
  // eslint-disable-next-line no-console
  console.info(`[FirebaseAdmin] Admin SDK app '${APP_NAME}' already initialized.`);
  adminApp = admin.app(APP_NAME);
}

export const adminAuth = adminApp.auth();
export const adminDb = adminApp.firestore();
export const adminStorage = adminApp.storage();

let pubsubService: admin.pubsub.PubSub | undefined;
try {
  // eslint-disable-next-line no-console
  console.info(
    `[FirebaseAdmin] Accessing adminApp.pubsub() for app '${adminApp.name}'. Type: ${typeof adminApp.pubsub}`
  );
  if (typeof adminApp.pubsub === 'function') {
    pubsubService = adminApp.pubsub();
    // eslint-disable-next-line no-console
    console.info(`[FirebaseAdmin] Pub/Sub service client obtained for app '${adminApp.name}'.`);
  } else {
    // eslint-disable-next-line no-console
    console.error(
      `[FirebaseAdmin] adminApp.pubsub is NOT a function on app '${adminApp.name}'. Available services on app:`,
      Object.keys(adminApp)
    );
  }
} catch (e) {
  // eslint-disable-next-line no-console
  console.error(`[FirebaseAdmin] Error calling adminApp.pubsub() for app '${adminApp.name}':`, e);
  // Log the adminApp object to see its structure if pubsub() call fails.
  // Be cautious with logging entire objects in production due to potential sensitive info.
  // Consider JSON.stringify(adminApp, (key, value) => (key === 'options_' ? '[REDACTED]' : value), 2) for safer logging.
}

export const adminPubSub = pubsubService;
// Export the main admin namespace as well, in case it's needed, though usage should prefer services from adminApp.
export const adminInstance = admin;
