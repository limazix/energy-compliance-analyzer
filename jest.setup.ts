/**
 * @fileoverview Main Jest setup file.
 * This file imports all individual mock setup modules and global configurations.
 */
import { TextDecoder, TextEncoder } from 'util'; // Node built-in

import { Timestamp } from 'firebase/firestore'; // Firebase
import '@testing-library/jest-dom'; // Testing library

// Import feature-specific mock setups
// These imports must come after global polyfills or mocks if they depend on them.
import './tests/mocks/custom-hooks.setup'; // This will also define global mock objects and their types
import './tests/mocks/firebase-auth.setup';
import './tests/mocks/firebase-functions.setup';
import './tests/mocks/firebase-rtdb.setup';
import './tests/mocks/firebase-storage.setup';
import './tests/mocks/global-lifecycle.setup'; // Global lifecycle hooks should be imported after other mocks if it depends on them for clearing, etc.
import './tests/mocks/jsdom-polyfills.setup'; // JSDOM polyfills should be early
import './tests/mocks/next-navigation.setup';
import './tests/mocks/ui-components.setup';

// Assign TextEncoder and TextDecoder to global for Jest environment
Object.assign(global, { TextEncoder, TextDecoder });

// Global assignments that are not part of a specific mock module
globalThis.Timestamp = Timestamp;

// eslint-disable-next-line no-console
console.info('Jest setup: Running in unit test mode. Firebase SDKs are mocked.');
