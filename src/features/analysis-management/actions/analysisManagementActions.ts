// src/features/analysis-management/actions/analysisManagementActions.ts
'use server';
/**
 * @fileOverview Server Actions for managing analysis lifecycle (deletion, cancellation).
 * Deletion now directly updates Firestore to trigger an event-driven function.
 * Cancellation directly updates Firestore status.
 */

import { Timestamp, doc, updateDoc } from 'firebase/firestore';
import { httpsCallable, type HttpsCallableResult } from 'firebase/functions';

import { db, functionsInstance } from '@/lib/firebase';

const MAX_CLIENT_ERROR_MESSAGE_LENGTH = 250;

interface AnalysisIdData {
  analysisId: string;
}
interface ActionResponse {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Server Action to request deletion of an analysis.
 * Sets the analysis status to 'pending_deletion' in Firestore.
 * An event-triggered Firebase Function will handle the actual deletion of files and final status update.
 * @param {string} userId - User ID (for constructing Firestore path).
 * @param {string} analysisId - The ID of the analysis to request deletion for.
 * @returns {Promise<void>} Resolves on successful status update, throws on error.
 * @throws {Error} If Firestore update fails.
 */
export async function deleteAnalysisAction(userId: string, analysisId: string): Promise<void> {
  // eslint-disable-next-line no-console
  console.debug(
    `[SA_deleteAnalysis] User: ${userId}, AnalysisID: ${analysisId}. Requesting deletion (setting status to 'pending_deletion').`
  );
  if (!userId || !analysisId) {
    const errorMsg = `[SA_deleteAnalysis] CRITICAL: userId ('${userId}') or analysisId ('${analysisId}') invalid.`;
    // eslint-disable-next-line no-console
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  const analysisDocRef = doc(db, 'users', userId, 'analyses', analysisId);

  try {
    await updateDoc(analysisDocRef, {
      status: 'pending_deletion',
      deletionRequestedAt: Timestamp.now(), // Add a timestamp for the request
      errorMessage: 'Exclusão solicitada pelo usuário...', // Optional: Update error message
    });
    // eslint-disable-next-line no-console
    console.info(
      `[SA_deleteAnalysis] Firestore doc ${analysisId} status set to 'pending_deletion'. Event-driven function will handle cleanup.`
    );
  } catch (error: unknown) {
    const message =
      (error instanceof Error ? error.message : String(error)) ||
      'Erro desconhecido ao solicitar exclusão da análise no Firestore.';
    // eslint-disable-next-line no-console
    console.error(
      `[SA_deleteAnalysis] Error updating Firestore for ${analysisId} to 'pending_deletion': ${message}`,
      error
    );
    throw new Error(
      `Falha ao solicitar exclusão da análise (SA): ${message.substring(
        0,
        MAX_CLIENT_ERROR_MESSAGE_LENGTH
      )}`
    );
  }
}

/**
 * Server Action to cancel an analysis by calling an HTTPS Firebase Function.
 * (Keeping cancel as HTTPS for now as it's a direct status update that the processing function checks)
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
