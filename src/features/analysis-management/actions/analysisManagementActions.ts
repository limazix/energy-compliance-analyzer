// src/features/analysis-management/actions/analysisManagementActions.ts
'use server';
/**
 * @fileOverview Server Actions for managing analysis lifecycle (deletion, cancellation).
 * These actions invoke HTTPS Callable Firebase Functions.
 */

import { httpsCallable, type HttpsCallableResult } from 'firebase/functions';

import { functionsInstance } from '@/lib/firebase';

const MAX_CLIENT_ERROR_MESSAGE_LENGTH = 250;

interface AnalysisIdData {
  analysisId: string;
}
interface ActionResponse {
  success: boolean;
  message?: string;
  error?: string; // Include error for consistency
}

/**
 * Server Action to delete an analysis by calling an HTTPS Firebase Function.
 * @param {string} userId - User ID (for logging/validation).
 * @param {string} analysisId - The ID of the analysis to delete.
 * @returns {Promise<void>} Resolves on success, throws on error.
 * @throws {Error} If the HTTPS call fails or the function returns an error.
 */
export async function deleteAnalysisAction(userId: string, analysisId: string): Promise<void> {
  // eslint-disable-next-line no-console
  console.debug(
    `[SA_deleteAnalysis] User: ${userId}, AnalysisID: ${analysisId}. Calling 'httpsCallableDeleteAnalysis'.`
  );
  if (!userId || !analysisId) {
    const errorMsg = `[SA_deleteAnalysis] CRITICAL: userId ('${userId}') or analysisId ('${analysisId}') invalid.`;
    // eslint-disable-next-line no-console
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  const requestData: AnalysisIdData = { analysisId };
  try {
    const callableFunction = httpsCallable<AnalysisIdData, ActionResponse>(
      functionsInstance,
      'httpsCallableDeleteAnalysis'
    );
    const result: HttpsCallableResult<ActionResponse> = await callableFunction(requestData);

    if (!result.data.success) {
      const errorMsg =
        result.data.message || result.data.error || 'Falha ao excluir análise (Função HTTPS).';
      // eslint-disable-next-line no-console
      console.error(
        `[SA_deleteAnalysis] 'httpsCallableDeleteAnalysis' reported failure for ${analysisId}: ${errorMsg}`
      );
      throw new Error(errorMsg);
    }
    // eslint-disable-next-line no-console
    console.info(
      `[SA_deleteAnalysis] 'httpsCallableDeleteAnalysis' successful for ${analysisId}. Message: ${result.data.message}`
    );
  } catch (error: unknown) {
    const firebaseError = error as { code?: string; message?: string };
    const message =
      (error instanceof Error ? error.message : String(error)) ||
      'Erro desconhecido ao excluir análise via HTTPS Function.';
    // eslint-disable-next-line no-console
    console.error(
      `[SA_deleteAnalysis] Error calling 'httpsCallableDeleteAnalysis' for ${analysisId}: Code: ${
        firebaseError.code || 'N/A'
      }, Message: ${message}`,
      error
    );
    throw new Error(
      `Falha ao excluir análise (SA): ${message.substring(0, MAX_CLIENT_ERROR_MESSAGE_LENGTH)}`
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
    return result.data; // Return the {success, message?, error?} object from the function
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
