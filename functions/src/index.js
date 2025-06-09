// @ts-check Convertido de TypeScript para JavaScript
'use strict';

/**
 * @fileOverview Firebase Functions entry point. Initializes Firebase Admin SDK and exports cloud functions.
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin SDK if not already initialized.
if (admin.apps.length === 0) {
  admin.initializeApp();
}

// Export functions from other files
const { processAnalysisOnUpdate } = require('./processAnalysis');

/**
 * Cloud Function triggered by Firestore document updates to process energy analysis data.
 * @see processAnalysis.processAnalysisOnUpdate for implementation details.
 */
exports.processAnalysisOnUpdate = processAnalysisOnUpdate;
