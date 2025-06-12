// @ts-check
'use strict';

/**
 * @fileOverview Firebase Functions entry point.
 * Initializes Firebase Admin SDK and exports all cloud functions for deployment.
 * Functions are organized by feature into subdirectories.
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin SDK if not already initialized.
if (admin.apps.length === 0) {
  admin.initializeApp();
}

// --- Import and Export Event-Triggered Functions ---
const coreAnalysisTriggers = require('./core-analysis/onUpdateTrigger');
exports.processAnalysisOnUpdate = coreAnalysisTriggers.processAnalysisOnUpdate;

// Firestore-triggered function for handling actual deletion steps
const analysisDeletionTrigger = require('./analysis-management/onDeleteTrigger');
exports.handleAnalysisDeletionRequest = analysisDeletionTrigger.handleAnalysisDeletionRequest;

// Pub/Sub-triggered function for initiating deletion requests
const analysisDeletionPubSubTrigger = require('./analysis-management/onDeletionRequestPublish');
exports.onAnalysisDeletionRequested = analysisDeletionPubSubTrigger.onAnalysisDeletionRequested;

// Pub/Sub-triggered function for finalizing file uploads
const fileUploadProcessingTriggers = require('./file-upload-processing/onFileUploadCompleted');
exports.onFileUploadCompleted = fileUploadProcessingTriggers.onFileUploadCompleted;

// --- Import and Export HTTPS Callable Functions ---

// File Upload HTTP Functions
const fileUploadCreateInitial = require('./file-upload-http/createInitial');
const fileUploadUpdateProgress = require('./file-upload-http/updateUploadProgress');
// finalizeUpload.js is removed as this is now event-driven
const fileUploadMarkFailed = require('./file-upload-http/markUploadFailed');

exports.httpsCreateInitialAnalysisRecord = fileUploadCreateInitial.httpsCreateInitialAnalysisRecord;
exports.httpsUpdateAnalysisUploadProgress =
  fileUploadUpdateProgress.httpsUpdateAnalysisUploadProgress;
// exports.httpsFinalizeFileUploadRecord is removed
exports.httpsMarkUploadAsFailed = fileUploadMarkFailed.httpsMarkUploadAsFailed;

// Report Chat HTTP Functions
const reportChatOrchestrator = require('./report-chat-http/orchestrator');
exports.httpsCallableAskOrchestrator = reportChatOrchestrator.httpsCallableAskOrchestrator;

// Tag Management HTTP Functions
const tagManagementFunctions = require('./tag-management-http/manageTags');
exports.httpsCallableAddTag = tagManagementFunctions.httpsCallableAddTag;
exports.httpsCallableRemoveTag = tagManagementFunctions.httpsCallableRemoveTag;

// Analysis Management & Retrieval HTTP Functions
const analysisCrudHttp = require('./analysis-management/crudHttp');
const analysisReportRetrievalHttp = require('./analysis-management/reportRetrievalHttp');
const coreAnalysisTriggerHttp = require('./core-analysis/triggerProcessingHttp');

exports.httpsCallableGetPastAnalyses = analysisCrudHttp.httpsCallableGetPastAnalyses;
exports.httpsCallableCancelAnalysis = analysisCrudHttp.httpsCallableCancelAnalysis;
exports.httpsCallableGetAnalysisReport = analysisReportRetrievalHttp.httpsCallableGetAnalysisReport;
exports.httpsCallableTriggerProcessing = coreAnalysisTriggerHttp.httpsCallableTriggerProcessing;
