// @ts-check
'use strict';

/**
 * @fileOverview Pub/Sub-triggered Firebase Function to finalize file upload processing.
 * This function is triggered when a file upload is completed and a message is
 * published to the 'file-upload-completed-topic'. It updates the Firestore
 * document with the file's download URL and sets the status to trigger the
 * main analysis pipeline.
 * Feature: File Upload Processing (Event-Triggered)
 * Component: onFileUploadCompleted
 */

const admin = require('firebase-admin');
const functions = require('firebase-functions');

const { APP_CONFIG } = require('../../lib/shared/config/appConfig.js');

// Initialize Firebase Admin SDK if not already initialized.
if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = admin.firestore();
const FILE_UPLOAD_COMPLETED_TOPIC_NAME = APP_CONFIG.TOPIC_FILE_UPLOAD_COMPLETED;
const UPLOAD_COMPLETED_OVERALL_PROGRESS = APP_CONFIG.PROGRESS_PERCENTAGE_UPLOAD_COMPLETE;
const MAX_ERROR_MSG_LENGTH_FUNC = APP_CONFIG.MAX_SERVER_ERROR_MESSAGE_LENGTH;

/**
 * Handles messages published to the file upload completion topic.
 * Updates the analysis document in Firestore to reflect the completed upload
 * and sets the status to 'summarizing_data' to trigger further processing.
 * @type {functions.CloudFunction<functions.pubsub.Message>}
 */
exports.onFileUploadCompleted = functions
  .region(process.env.GCLOUD_REGION || 'us-central1')
  .pubsub.topic(FILE_UPLOAD_COMPLETED_TOPIC_NAME)
  .onPublish(async (message, context) => {
    const eventId = context.eventId;
    // eslint-disable-next-line no-console
    console.info(
      `[Func_onFileUploadCompleted] Received Pub/Sub message (Event ID: ${eventId}). Topic: ${context.resource.name}`
    );

    let payload;
    try {
      payload = message.json
        ? message.json
        : JSON.parse(Buffer.from(message.data, 'base64').toString());

      if (!payload || typeof payload !== 'object') {
        throw new Error('Payload is not a valid object.');
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      // eslint-disable-next-line no-console
      console.error(
        `[Func_onFileUploadCompleted] Error parsing Pub/Sub message payload (Event ID: ${eventId}): ${errorMsg}. Message data: ${message.data}`
      );
      return null; // Acknowledge the message to prevent retries for malformed payloads.
    }

    const { userId, analysisId, downloadURL } = payload;

    if (!userId || typeof userId !== 'string') {
      // eslint-disable-next-line no-console
      console.error(
        `[Func_onFileUploadCompleted] Invalid or missing userId in payload (Event ID: ${eventId}). Payload:`,
        payload
      );
      return null;
    }
    if (!analysisId || typeof analysisId !== 'string') {
      // eslint-disable-next-line no-console
      console.error(
        `[Func_onFileUploadCompleted] Invalid or missing analysisId in payload (Event ID: ${eventId}). Payload:`,
        payload
      );
      return null;
    }
    if (!downloadURL || typeof downloadURL !== 'string') {
      // eslint-disable-next-line no-console
      console.error(
        `[Func_onFileUploadCompleted] Invalid or missing downloadURL in payload (Event ID: ${eventId}). Payload:`,
        payload
      );
      // We might still want to mark the analysis as error if downloadURL is missing,
      // but for now, we'll just log and exit if the message is incomplete.
      return null;
    }

    // eslint-disable-next-line no-console
    console.info(
      `[Func_onFileUploadCompleted] Processing file upload completion for userId: ${userId}, analysisId: ${analysisId}. Event ID: ${eventId}.`
    );

    const analysisDocRef = db
      .collection('users')
      .doc(userId)
      .collection('analyses')
      .doc(analysisId);

    try {
      const docSnap = await analysisDocRef.get();
      if (!docSnap.exists) {
        // eslint-disable-next-line no-console
        console.warn(
          `[Func_onFileUploadCompleted] Analysis document ${analysisId} for user ${userId} not found. Cannot finalize. Event ID: ${eventId}.`
        );
        return null; // Document doesn't exist, nothing to update.
      }

      const currentData = docSnap.data();
      if (currentData?.status !== 'uploading' && currentData?.status !== 'error') {
        // eslint-disable-next-line no-console
        console.warn(
          `[Func_onFileUploadCompleted] Analysis ${analysisId} is not in 'uploading' or 'error' state (current: ${currentData?.status}). Potentially already processed or finalized by another event. Skipping update. Event ID: ${eventId}.`
        );
        return null; // Avoid race conditions or re-processing.
      }

      const updatePayload = {
        powerQualityDataUrl: downloadURL,
        status: 'summarizing_data', // Trigger for the main analysis pipeline
        progress: UPLOAD_COMPLETED_OVERALL_PROGRESS,
        uploadProgress: 100,
        errorMessage: null, // Clear previous errors
        // Reset fields that will be populated by the main analysis pipeline
        powerQualityDataSummary: null,
        identifiedRegulations: null,
        structuredReport: null,
        mdxReportStoragePath: null,
        summary: null,
        completedAt: null,
      };

      await analysisDocRef.update(updatePayload);
      // eslint-disable-next-line no-console
      console.info(
        `[Func_onFileUploadCompleted] Analysis ${analysisId} finalized. Status set to 'summarizing_data'. Event ID: ${eventId}. This should trigger 'processAnalysisOnUpdate'.`
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      // eslint-disable-next-line no-console
      console.error(
        `[Func_onFileUploadCompleted] Error updating Firestore for analysis ${analysisId} (Event ID: ${eventId}): ${errorMessage}`,
        error
      );
      // Attempt to mark the analysis as error in Firestore if finalization fails
      try {
        await analysisDocRef.update({
          status: 'error',
          errorMessage: `Falha ao finalizar upload (Pub/Sub Func): ${errorMessage.substring(0, MAX_ERROR_MSG_LENGTH_FUNC)}`,
          uploadProgress: 100, // Upload to Storage was successful, but Firestore update failed.
        });
      } catch (updateError) {
        // eslint-disable-next-line no-console
        console.error(
          `[Func_onFileUploadCompleted] CRITICAL: Failed to update Firestore with error state for ${analysisId} after finalization failure (Event ID: ${eventId}):`,
          updateError
        );
      }
      // Depending on the error, you might want to retry (by throwing) or acknowledge.
      // For Firestore errors, retrying might be appropriate. Let Firebase Functions handle retries.
      throw error;
    }
    return null; // Explicitly return null for successful processing
  });
