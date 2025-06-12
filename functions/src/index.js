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

// New event-triggered function for handling deletion requests
const analysisDeletionTrigger = require('./analysis-management/onDeleteTrigger');
exports.handleAnalysisDeletionRequest = analysisDeletionTrigger.handleAnalysisDeletionRequest;

// --- Import and Export HTTPS Callable Functions ---

// File Upload HTTP Functions
const fileUploadCreateInitial = require('./file-upload-http/createInitial');
const fileUploadUpdateProgress = require('./file-upload-http/updateUploadProgress');
const fileUploadFinalize = require('./file-upload-http/finalizeUpload');
const fileUploadMarkFailed = require('./file-upload-http/markUploadFailed');

exports.httpsCreateInitialAnalysisRecord = fileUploadCreateInitial.httpsCreateInitialAnalysisRecord;
exports.httpsUpdateAnalysisUploadProgress =
  fileUploadUpdateProgress.httpsUpdateAnalysisUploadProgress;
exports.httpsFinalizeFileUploadRecord = fileUploadFinalize.httpsFinalizeFileUploadRecord;
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
// exports.httpsCallableDeleteAnalysis = analysisCrudHttp.httpsCallableDeleteAnalysis; // Removed
exports.httpsCallableCancelAnalysis = analysisCrudHttp.httpsCallableCancelAnalysis;
exports.httpsCallableGetAnalysisReport = analysisReportRetrievalHttp.httpsCallableGetAnalysisReport;
exports.httpsCallableTriggerProcessing = coreAnalysisTriggerHttp.httpsCallableTriggerProcessing;
