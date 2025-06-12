/**
 * @fileoverview Main Jest setup file.
 * This file imports all individual mock setup modules and global configurations.
 */
import '@testing-library/jest-dom';
import { Timestamp } from 'firebase/firestore';

// Import feature-specific mock setups
// These imports must come after global polyfills or mocks if they depend on them.
import './jest/mocks/jsdom-polyfills.setup'; // JSDOM polyfills should be early
import './jest/mocks/custom-hooks.setup'; // This will also define global mock objects and their types
import './jest/mocks/firebase-auth.setup';
import './jest/mocks/firebase-functions.setup';
import './jest/mocks/firebase-rtdb.setup';
import './jest/mocks/firebase-storage.setup';
import './jest/mocks/next-navigation.setup';
import './jest/mocks/ui-components.setup';

// Global lifecycle hooks should be imported after other mocks if it depends on them for clearing, etc.
import './jest/mocks/global-lifecycle.setup';

// Global assignments that are not part of a specific mock module
globalThis.Timestamp = Timestamp;

// Determine if emulators are connected based on environment variables
// This is a common pattern for conditional logic in tests/setup.
const firestoreEmulatorHost = process.env.FIRESTORE_EMULATOR_HOST;

// Extend globalThis to declare EMULATORS_CONNECTED
declare global {
  // eslint-disable-next-line no-var
  var EMULATORS_CONNECTED: boolean;
}
globalThis.EMULATORS_CONNECTED = !!firestoreEmulatorHost;

// eslint-disable-next-line no-console
console.info(`EMULATORS_CONNECTED: ${globalThis.EMULATORS_CONNECTED}`);
if (globalThis.EMULATORS_CONNECTED) {
  // eslint-disable-next-line no-console
  console.info('Jest setup: Firebase SDKs should connect to emulators.');
} else {
  // eslint-disable-next-line no-console
  console.warn(
    'Jest setup: Firebase SDKs will NOT connect to emulators (emulator env vars not set). Some tests may behave differently or fail.'
  );
}
