/**
 * @fileOverview Firebase Functions entry point.
 * Initializes Firebase Admin SDK and exports all cloud functions for deployment.
 * Functions are organized by feature into subdirectories.
 */

import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions'; // Keep functions import for type export

// Import HTTPS Callable Functions
import { orchestratorFlow } from './ai/flows/orchestrate-report-interaction';
import { initFirebaseAdmin, initGenkit } from './ai/genkit-instance';
import {
  httpsCallableCancelAnalysis,
  httpsCallableGetPastAnalyses,
} from './analysis-management/crudHttp';
import { handleDeleteTrigger as handleAnalysisDeletionRequest } from './analysis-management/onDeleteTrigger'; // Renamed export
import { onAnalysisDeletionRequested } from './analysis-management/onDeletionRequestPublish';
import { httpsCallableGetAnalysisReport } from './analysis-management/reportRetrievalHttp';
import { processAnalysisOnUpdate } from './core-analysis/onUpdateTrigger';
import { httpsCallableTriggerProcessing } from './core-analysis/triggerProcessingHttp';
import { httpsCreateInitialAnalysisRecord } from './file-upload-http/createInitial';
import { httpsMarkUploadAsFailed } from './file-upload-http/markUploadFailed';
import { httpsUpdateAnalysisUploadProgress } from './file-upload-http/updateUploadProgress';
import { onFileUploadCompleted } from './file-upload-processing/onFileUploadCompleted';
import { httpsCallableAskOrchestrator } from './report-chat-http/orchestrator';
import { httpsCallableAddTag, httpsCallableRemoveTag } from './tag-management-http/manageTags';

// Import Event-Triggered Functions

// Import Genkit related initializers and flows

// Initialize Firebase Admin SDK if not already initialized.
if (admin.apps.length === 0) {
  admin.initializeApp();
}

// Initialize Genkit (if it needs to be done globally for all functions)
initFirebaseAdmin(); // Ensure admin is initialized before Genkit that might use it
initGenkit();

// Export Event-Triggered Functions
export {
  processAnalysisOnUpdate,
  handleAnalysisDeletionRequest,
  onAnalysisDeletionRequested,
  onFileUploadCompleted,
};

// Export HTTPS Callable Functions
export {
  httpsCreateInitialAnalysisRecord,
  httpsUpdateAnalysisUploadProgress,
  httpsMarkUploadAsFailed,
  httpsCallableAskOrchestrator,
  httpsCallableAddTag,
  httpsCallableRemoveTag,
  httpsCallableGetPastAnalyses,
  httpsCallableCancelAnalysis,
  httpsCallableGetAnalysisReport,
  httpsCallableTriggerProcessing,
};

// Export Genkit flows that are intended to be callable (if any beyond orchestrator)
// This specific orchestratorFlow is already being exported as 'orchestrator' below.
// If other flows were meant to be directly callable via HTTPS, export them similarly.

// Example for Genkit orchestrator flow if it's meant to be an HTTPS callable.
// The onFlow in genkit-instance.ts might be for other Genkit internal purposes or if firebase() plugin auto-deploys.
// If orchestratorFlow is indeed the one from onFlow, this explicit export is correct for HTTPS callable.
export const orchestrator = functions.https.onCall(orchestratorFlow);
