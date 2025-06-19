/**
 * @fileoverview Jest setup file for BACKEND-specific mocks.
 * This file is loaded only for the backend test environment.
 */

// Import backend-specific mock setups
import './firebase-admin.setup';

// eslint-disable-next-line no-console
console.info('Jest backend-specific setup: Running. Backend mocks are loaded.');
