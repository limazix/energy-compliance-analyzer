'use strict';

/**
 * @fileOverview Pub/Sub-triggered Firebase Function to handle analysis deletion requests.
 * This function is triggered by a message on the 'analysis-deletion-request-topic'.
 * It updates the Firestore document status to 'pending_deletion', which then
 * triggers another function to perform the actual file cleanup.
 * Feature: Analysis Management (Pub/Sub Event-Triggered)
 * Component: OnDeletionRequestPublish
 */

import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

import { APP_CONFIG } from '@/config/appConfig'; // Adjusted path to src

// Initialize Firebase Admin SDK if not already initialized.
if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = admin.firestore();

const ANALYSIS_DELETION_TOPIC_NAME = APP_CONFIG.TOPIC_ANALYSIS_DELETION_REQUEST;

interface DeletionRequestPayload {
  userId: string;
  analysisId: string;
  requestedAt?: number; // Milliseconds since epoch
}

/**
 * Handles messages published to the analysis deletion request topic.
 * Updates the Firestore document status to 'pending_deletion'.
 */
export const onAnalysisDeletionRequested = functions
  .region(process.env.GCLOUD_REGION || 'us-central1')
  .pubsub.topic(ANALYSIS_DELETION_TOPIC_NAME)
  .onPublish(async (message, context) => {
    const eventId = context.eventId;
    // eslint-disable-next-line no-console
    console.info(
      `[Func_onDeletionRequestedPubSub] Received Pub/Sub message (Event ID: ${eventId}). Topic: ${context.resource.name}`
    );

    let payload: DeletionRequestPayload;
    try {
      payload = message.json
        ? (message.json as DeletionRequestPayload)
        : (JSON.parse(Buffer.from(message.data, 'base64').toString()) as DeletionRequestPayload);

      if (!payload || typeof payload !== 'object') {
        throw new Error('Payload is not a valid object.');
      }
    } catch (e: unknown) {
      // Changed from any to unknown
      const errorMsg = e instanceof Error ? e.message : String(e);
      // eslint-disable-next-line no-console
      console.error(
        `[Func_onDeletionRequestedPubSub] Error parsing Pub/Sub message payload (Event ID: ${eventId}): ${errorMsg}. Message data: ${message.data}`
      );
      return null;
    }

    const { userId, analysisId, requestedAt } = payload;

    if (!userId || typeof userId !== 'string') {
      // eslint-disable-next-line no-console
      console.error(
        `[Func_onDeletionRequestedPubSub] Invalid or missing userId in payload (Event ID: ${eventId}). Payload:`,
        payload
      );
      return null;
    }
    if (!analysisId || typeof analysisId !== 'string') {
      // eslint-disable-next-line no-console
      console.error(
        `[Func_onDeletionRequestedPubSub] Invalid or missing analysisId in payload (Event ID: ${eventId}). Payload:`,
        payload
      );
      return null;
    }

    // eslint-disable-next-line no-console
    console.info(
      `[Func_onDeletionRequestedPubSub] Processing deletion request for userId: ${userId}, analysisId: ${analysisId} (Event ID: ${eventId}).`
    );

    const analysisDocRef = db.doc(`users/${userId}/analyses/${analysisId}`);

    try {
      const docSnap = await analysisDocRef.get();
      if (!docSnap.exists) {
        // eslint-disable-next-line no-console
        console.warn(
          `[Func_onDeletionRequestedPubSub] Analysis document ${analysisId} for user ${userId} not found. (Event ID: ${eventId}). Nothing to update to 'pending_deletion'.`
        );
        return null;
      }

      const currentData = docSnap.data();
      if (currentData?.status === 'pending_deletion' || currentData?.status === 'deleted') {
        // eslint-disable-next-line no-console
        console.info(
          `[Func_onDeletionRequestedPubSub] Analysis ${analysisId} is already in '${currentData.status}' state. (Event ID: ${eventId}). No update needed.`
        );
        return null;
      }

      const updatePayload: {
        status: 'pending_deletion';
        errorMessage: string;
        deletionRequestedAt: admin.firestore.Timestamp | admin.firestore.FieldValue;
      } = {
        status: 'pending_deletion',
        errorMessage: 'Exclusão solicitada via Pub/Sub e em processamento...',
        deletionRequestedAt: requestedAt
          ? admin.firestore.Timestamp.fromMillis(requestedAt)
          : admin.firestore.FieldValue.serverTimestamp(),
      };

      await analysisDocRef.update(updatePayload);
      // eslint-disable-next-line no-console
      console.info(
        `[Func_onDeletionRequestedPubSub] Analysis ${analysisId} status updated to 'pending_deletion'. (Event ID: ${eventId}) This should trigger the onDeleteTrigger function.`
      );
    } catch (error: unknown) {
      // Changed from any to unknown
      const errorMessage = error instanceof Error ? error.message : String(error);
      // eslint-disable-next-line no-console
      console.error(
        `[Func_onDeletionRequestedPubSub] Error updating Firestore for analysis ${analysisId} (Event ID: ${eventId}): ${errorMessage}`,
        error
      );
      throw error;
    }
    return null;
  });
