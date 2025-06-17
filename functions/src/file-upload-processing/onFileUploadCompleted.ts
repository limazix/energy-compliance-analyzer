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

import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

import { APP_CONFIG } from '@/config/appConfig'; // Adjusted to import from @/ for consistency

// Initialize Firebase Admin SDK if not already initialized.
if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = admin.firestore();
const FILE_UPLOAD_COMPLETED_TOPIC_NAME = APP_CONFIG.TOPIC_FILE_UPLOAD_COMPLETED;
const UPLOAD_COMPLETED_OVERALL_PROGRESS = APP_CONFIG.PROGRESS_PERCENTAGE_UPLOAD_COMPLETE;
const MAX_ERROR_MSG_LENGTH_FUNC = APP_CONFIG.MAX_SERVER_ERROR_MESSAGE_LENGTH;

interface FileUploadCompletedPayload {
  userId: string;
  analysisId: string;
  downloadURL: string;
}

/**
 * Handles messages published to the file upload completion topic.
 * Updates the analysis document in Firestore to reflect the completed upload
 * and sets the status to 'summarizing_data' to trigger further processing.
 */
export const onFileUploadCompleted = functions
  .region(process.env.GCLOUD_REGION || 'us-central1')
  .pubsub.topic(FILE_UPLOAD_COMPLETED_TOPIC_NAME)
  .onPublish(async (message, context) => {
    const eventId = context.eventId;
    // eslint-disable-next-line no-console
    console.info(
      `[Func_onFileUploadCompleted] Received Pub/Sub message (Event ID: ${eventId}). Topic: ${context.resource.name}`
    );

    let payload: FileUploadCompletedPayload;
    try {
      payload = message.json
        ? (message.json as FileUploadCompletedPayload)
        : (JSON.parse(
            Buffer.from(message.data, 'base64').toString()
          ) as FileUploadCompletedPayload);

      if (!payload || typeof payload !== 'object') {
        throw new Error('Payload is not a valid object.');
      }
    } catch (e: unknown) {
      // Changed from any to unknown
      const errorMsg = e instanceof Error ? e.message : String(e);
      // eslint-disable-next-line no-console
      console.error(
        `[Func_onFileUploadCompleted] Error parsing Pub/Sub message payload (Event ID: ${eventId}): ${errorMsg}. Message data: ${message.data}`
      );
      return null;
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
        return null;
      }

      const currentData = docSnap.data();
      if (currentData?.status !== 'uploading' && currentData?.status !== 'error') {
        // eslint-disable-next-line no-console
        console.warn(
          `[Func_onFileUploadCompleted] Analysis ${analysisId} is not in 'uploading' or 'error' state (current: ${String(currentData?.status)}). Potentially already processed or finalized by another event. Skipping update. Event ID: ${eventId}.`
        );
        return null;
      }

      const updatePayload: Record<string, unknown> = {
        // Changed from Partial to Record
        powerQualityDataUrl: downloadURL,
        status: 'summarizing_data',
        progress: UPLOAD_COMPLETED_OVERALL_PROGRESS,
        uploadProgress: 100,
        errorMessage: null,
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
    } catch (error: unknown) {
      // Changed from any to unknown
      const errorMessage = error instanceof Error ? error.message : String(error);
      // eslint-disable-next-line no-console
      console.error(
        `[Func_onFileUploadCompleted] Error updating Firestore for analysis ${analysisId} (Event ID: ${eventId}): ${errorMessage}`,
        error
      );
      try {
        await analysisDocRef.update({
          status: 'error',
          errorMessage: `Falha ao finalizar upload (Pub/Sub Func): ${errorMessage.substring(0, MAX_ERROR_MSG_LENGTH_FUNC)}`,
          uploadProgress: 100,
        });
      } catch (updateError: unknown) {
        // Changed from any to unknown
        // eslint-disable-next-line no-console
        console.error(
          `[Func_onFileUploadCompleted] CRITICAL: Failed to update Firestore with error state for ${analysisId} after finalization failure (Event ID: ${eventId}):`,
          updateError
        );
      }
      throw error;
    }
    return null;
  });
