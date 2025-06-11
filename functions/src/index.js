// @ts-check
'use strict';

/**
 * @fileOverview Firebase Functions entry point.
 * Initializes Firebase Admin SDK and exports all cloud functions for deployment,
 * including event-triggered functions for analysis processing and HTTPS callable
 * functions for client-invoked operations like file upload management, report chat,
 * tag management, and other analysis operations.
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
const reportChatHttpsFunctions = require('./reportChatHttps');
const tagManagementHttpsFunctions = require('./tagManagementHttps');
const analysisHttpsFunctions = require('./analysisHttps'); // New import for analysis operations

/**
 * Cloud Function triggered by Firestore document updates to process energy analysis data.
 * @see ./processAnalysis.js#processAnalysisOnUpdate for implementation details.
 */
exports.processAnalysisOnUpdate = processAnalysisOnUpdate;

// --- Export HTTPS callable functions for file upload management ---
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

// --- Export HTTPS callable function for report chat ---
/**
 * HTTPS Callable: Orchestrates user interaction with a compliance report via chat.
 * @see ./reportChatHttps.js#httpsCallableAskOrchestrator
 */
exports.httpsCallableAskOrchestrator = reportChatHttpsFunctions.httpsCallableAskOrchestrator;

// --- Export HTTPS callable functions for tag management ---
/**
 * HTTPS Callable: Adds a tag to an analysis document.
 * @see ./tagManagementHttps.js#httpsCallableAddTag
 */
exports.httpsCallableAddTag = tagManagementHttpsFunctions.httpsCallableAddTag;

/**
 * HTTPS Callable: Removes a tag from an analysis document.
 * @see ./tagManagementHttps.js#httpsCallableRemoveTag
 */
exports.httpsCallableRemoveTag = tagManagementHttpsFunctions.httpsCallableRemoveTag;

// --- Export HTTPS callable functions for general analysis operations ---
/**
 * HTTPS Callable: Fetches past analyses for a user.
 * @see ./analysisHttps.js#httpsCallableGetPastAnalyses
 */
exports.httpsCallableGetPastAnalyses = analysisHttpsFunctions.httpsCallableGetPastAnalyses;

/**
 * HTTPS Callable: Deletes an analysis document and its associated files.
 * @see ./analysisHttps.js#httpsCallableDeleteAnalysis
 */
exports.httpsCallableDeleteAnalysis = analysisHttpsFunctions.httpsCallableDeleteAnalysis;

/**
 * HTTPS Callable: Requests cancellation of an analysis.
 * @see ./analysisHttps.js#httpsCallableCancelAnalysis
 */
exports.httpsCallableCancelAnalysis = analysisHttpsFunctions.httpsCallableCancelAnalysis;

/**
 * HTTPS Callable: Triggers the processing of an analysis file by setting its status.
 * @see ./analysisHttps.js#httpsCallableTriggerProcessing
 */
exports.httpsCallableTriggerProcessing = analysisHttpsFunctions.httpsCallableTriggerProcessing;

/**
 * HTTPS Callable: Fetches analysis report data (MDX content and metadata).
 * @see ./analysisHttps.js#httpsCallableGetAnalysisReport
 */
exports.httpsCallableGetAnalysisReport = analysisHttpsFunctions.httpsCallableGetAnalysisReport;
