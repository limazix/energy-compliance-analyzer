// @ts-check
'use strict';

/**
 * @fileOverview Firebase Functions entry point.
 * Initializes Firebase Admin SDK and exports all cloud functions for deployment,
 * including event-triggered functions for analysis processing and HTTPS callable
 * functions for client-invoked operations like file upload management.
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin SDK if not already initialized.
if (admin.apps.length === 0) {
  admin.initializeApp();
}

// Import event-triggered functions
const { processAnalysisOnUpdate } = require('./processAnalysis');
// Import HTTPS callable functions
const fileUploadHttpsFunctions = require('./fileUploadHttps');

/**
 * Cloud Function triggered by Firestore document updates to process energy analysis data.
 * @see ./processAnalysis.js#processAnalysisOnUpdate for implementation details.
 */
exports.processAnalysisOnUpdate = processAnalysisOnUpdate;

// Export HTTPS callable functions for file upload management
/**
 * HTTPS Callable: Creates an initial record for an analysis in Firestore.
 * @see ./fileUploadHttps.js#httpsCreateInitialAnalysisRecord
 */
exports.httpsCreateInitialAnalysisRecord =
  fileUploadHttpsFunctions.httpsCreateInitialAnalysisRecord;

/**
 * HTTPS Callable: Updates the upload progress of an analysis in Firestore.
 * @see ./fileUploadHttps.js#httpsUpdateAnalysisUploadProgress
 */
exports.httpsUpdateAnalysisUploadProgress =
  fileUploadHttpsFunctions.httpsUpdateAnalysisUploadProgress;

/**
 * HTTPS Callable: Finalizes the file upload record in Firestore.
 * @see ./fileUploadHttps.js#httpsFinalizeFileUploadRecord
 */
exports.httpsFinalizeFileUploadRecord = fileUploadHttpsFunctions.httpsFinalizeFileUploadRecord;

/**
 * HTTPS Callable: Marks an analysis upload as failed in Firestore.
 * @see ./fileUploadHttps.js#httpsMarkUploadAsFailed
 */
exports.httpsMarkUploadAsFailed = fileUploadHttpsFunctions.httpsMarkUploadAsFailed;
