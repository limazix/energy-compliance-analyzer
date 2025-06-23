/**
 * @fileoverview Main Jest setup file.
 * This file imports all individual mock setup modules and global configurations
 * that are COMMON to BOTH frontend and backend test environments.
 * Frontend-specific or backend-specific setups are handled by their respective
 * project configurations in jest.config.ts.
 */

import { Timestamp } from 'firebase/firestore'; // Firebase
import '@testing-library/jest-dom'; // Testing library

// Import feature-specific mock setups that are safe for both environments
import './tests/mocks/custom-hooks.setup';
import './tests/mocks/firebase-auth.setup';
import './tests/mocks/firebase-functions.setup';
import './tests/mocks/firebase-rtdb.setup';
import './tests/mocks/firebase-storage.setup';
import './tests/mocks/next-navigation.setup';
import './tests/mocks/ui-components.setup';

import { TextDecoder, TextEncoder } from 'util'; // Node built-in

// Import global lifecycle hooks LAST, as it might depend on other mocks/globals for clearing.
import './tests/mocks/global-lifecycle.setup';

// Assign TextEncoder and TextDecoder to global for Jest environment (all projects)
Object.assign(global, { TextEncoder, TextDecoder, Timestamp });

// Global assignments that are not part of a specific mock module.

console.info(
  'Jest common setup: Running. Firebase client SDKs are mocked. Environment-specific setups (frontend/backend) will load their respective additional mocks.'
);
