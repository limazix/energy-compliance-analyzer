// src/features/analysis-management/actions/analysisManagementActions.ts
'use server';
/**
 * @fileOverview Server Actions for managing analysis lifecycle (deletion, cancellation).
 * Deletion now publishes a Pub/Sub event to trigger an event-driven function.
 * Cancellation directly updates Firestore status (via HTTPS callable).
 */

import { Timestamp } from 'firebase/firestore'; // No longer using doc/updateDoc here for delete

import { APP_CONFIG } from '@/config/appConfig';
import { functionsInstance } from '@/lib/firebase';
// Import the initialized Firebase Admin SDK's PubSub instance
import { adminDb, adminPubSub } from '@/lib/firebase-admin'; // Using adminDb for check before publish

import type { HttpsCallableResult } from 'firebase/functions';

const MAX_CLIENT_ERROR_MESSAGE_LENGTH = APP_CONFIG.MAX_CLIENT_SERVER_ACTION_ERROR_MESSAGE_LENGTH;
const ANALYSIS_DELETION_TOPIC = APP_CONFIG.TOPIC_ANALYSIS_DELETION_REQUEST;

interface AnalysisIdData {
  analysisId: string;
}
interface ActionResponse {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Server Action to request deletion of an analysis by publishing a Pub/Sub message.
 * @param {string} userId - User ID (for constructing Firestore path and Pub/Sub message).
 * @param {string} analysisId - The ID of the analysis to request deletion for.
 * @returns {Promise<void>} Resolves on successful event publishing, throws on error.
 * @throws {Error} If Pub/Sub publishing fails or analysis is not found/owned by user.
 */
export async function deleteAnalysisAction(userId: string, analysisId: string): Promise<void> {
  // eslint-disable-next-line no-console
  console.debug(
    `[SA_deleteAnalysis] User: ${userId}, AnalysisID: ${analysisId}. Publishing to Pub/Sub topic '${ANALYSIS_DELETION_TOPIC}'.`
  );
  if (!userId || !analysisId) {
    const errorMsg = `[SA_deleteAnalysis] CRITICAL: userId ('${userId}') or analysisId ('${analysisId}') invalid.`;
    // eslint-disable-next-line no-console
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  try {
    // Optional: Validate if the analysis exists and belongs to the user before publishing
    const analysisDocRef = adminDb.doc(`users/${userId}/analyses/${analysisId}`);
    const docSnap = await analysisDocRef.get();

    if (!docSnap.exists) {
      const errorMsg = `[SA_deleteAnalysis] Analysis ${analysisId} not found for user ${userId}. Cannot request deletion.`;
      // eslint-disable-next-line no-console
      console.error(errorMsg);
      throw new Error('Análise não encontrada ou você não tem permissão.');
    }
    const analysisData = docSnap.data();
    if (analysisData?.status === 'deleted' || analysisData?.status === 'pending_deletion') {
      const msg = `[SA_deleteAnalysis] Analysis ${analysisId} is already in '${analysisData.status}' state. No action taken.`;
      // eslint-disable-next-line no-console
      console.info(msg);
      // Not an error, but no need to publish again.
      return;
    }

    const messagePayload = {
      userId,
      analysisId,
      requestedAt: Timestamp.now().toMillis(), // Send timestamp as millis for JSON
    };
    const messageBuffer = Buffer.from(JSON.stringify(messagePayload));

    const topic = adminPubSub.topic(ANALYSIS_DELETION_TOPIC);
    const messageId = await topic.publishMessage({ data: messageBuffer });

    // eslint-disable-next-line no-console
    console.info(
      `[SA_deleteAnalysis] Message ${messageId} published to ${ANALYSIS_DELETION_TOPIC} for analysis ${analysisId}.`
    );
  } catch (error: unknown) {
    const message =
      (error instanceof Error ? error.message : String(error)) ||
      'Erro desconhecido ao solicitar exclusão da análise via Pub/Sub.';
    // eslint-disable-next-line no-console
    console.error(
      `[SA_deleteAnalysis] Error publishing to Pub/Sub for ${analysisId}: ${message}`,
      error
    );
    throw new Error(
      `Falha ao solicitar exclusão da análise (SA Pub/Sub): ${message.substring(
        0,
        MAX_CLIENT_ERROR_MESSAGE_LENGTH
      )}`
    );
  }
}

/**
 * Server Action to cancel an analysis by calling an HTTPS Firebase Function.
 * @param {string} userId - User ID (for logging/validation).
 * @param {string} analysisId - The ID of the analysis to cancel.
 * @returns {Promise<ActionResponse>} Success status or an error message.
 */
export async function cancelAnalysisAction(
  userId: string,
  analysisId: string
): Promise<ActionResponse> {
  // eslint-disable-next-line no-console
  console.debug(
    `[SA_cancelAnalysis] User: ${userId}, AnalysisID: ${analysisId}. Calling 'httpsCallableCancelAnalysis'.`
  );
  if (!userId || !analysisId) {
    const errorMsg = `[SA_cancelAnalysis] CRITICAL: userId ('${userId}') or analysisId ('${analysisId}') invalid. Aborting.`;
    // eslint-disable-next-line no-console
    console.error(errorMsg);
    return { success: false, error: errorMsg.substring(0, MAX_CLIENT_ERROR_MESSAGE_LENGTH) };
  }

  const requestData: AnalysisIdData = { analysisId };
  try {
    const callableFunction = httpsCallable<AnalysisIdData, ActionResponse>(
      functionsInstance,
      'httpsCallableCancelAnalysis'
    );
    const result: HttpsCallableResult<ActionResponse> = await callableFunction(requestData);

    // eslint-disable-next-line no-console
    console.info(
      `[SA_cancelAnalysis] 'httpsCallableCancelAnalysis' for ${analysisId} returned: Success: ${result.data.success}, Msg: ${result.data.message}, Err: ${result.data.error}`
    );
    return result.data;
  } catch (error: unknown) {
    const firebaseError = error as { code?: string; message?: string };
    const message =
      (error instanceof Error ? error.message : String(error)) ||
      'Erro desconhecido ao cancelar análise via HTTPS Function.';
    // eslint-disable-next-line no-console
    console.error(
      `[SA_cancelAnalysis] Error calling 'httpsCallableCancelAnalysis' for ${analysisId}: Code: ${
        firebaseError.code || 'N/A'
      }, Message: ${message}`,
      error
    );
    return {
      success: false,
      error: `Falha ao solicitar cancelamento (SA): ${message.substring(
        0,
        MAX_CLIENT_ERROR_MESSAGE_LENGTH
      )}`,
    };
  }
}
