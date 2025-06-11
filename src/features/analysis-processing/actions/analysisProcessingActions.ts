// src/features/analysis-processing/actions/analysisProcessingActions.ts
'use server';
/**
 * @fileOverview Server Action for initiating the background processing of an analysis.
 * This action calls an HTTPS Callable Firebase Function to set the analysis status,
 * which in turn triggers an event-driven Firebase Function for the actual processing.
 */

import { httpsCallable } from 'firebase/functions';

import { functionsInstance } from '@/lib/firebase';

import type { HttpsCallableResult } from 'firebase/functions';

const MAX_CLIENT_ERROR_MESSAGE_LENGTH = 250;

interface TriggerProcessingRequestData {
  analysisId: string;
}
interface TriggerProcessingResponseData {
  success: boolean;
  analysisId: string;
  message?: string; // Optional message from the function
  error?: string; // Optional error from the function
}

/**
 * Server Action to signal that an analysis file is ready for background processing.
 * It calls the `httpsCallableTriggerProcessing` Firebase Function.
 * @param {string} analysisIdInput - The ID of the analysis to process.
 * @param {string} userIdInput - The ID of the user (for logging/validation on client/SA side).
 * @returns {Promise<{ success: boolean; analysisId: string; error?: string }>} Result object.
 */
export async function processAnalysisFile(
  analysisIdInput: string,
  userIdInput: string // Kept for logging and consistency from hook
): Promise<{ success: boolean; analysisId: string; error?: string }> {
  const analysisId = analysisIdInput?.trim();
  const userId = userIdInput?.trim(); // Used for logging

  console.info(
    `[SA_processAnalysisFile] Triggered for analysisId: ${analysisId} (input: ${analysisIdInput}), User: ${userId}. Calling 'httpsCallableTriggerProcessing'.`
  );

  if (!analysisId) {
    const criticalMsg = `[SA_processAnalysisFile] CRITICAL: analysisId is invalid ('${analysisIdInput}' -> '${analysisId}'). Aborting.`;
    console.error(criticalMsg);
    return {
      success: false,
      analysisId: analysisIdInput || 'unknown_id',
      error: criticalMsg.substring(0, MAX_CLIENT_ERROR_MESSAGE_LENGTH),
    };
  }
  // userId is not strictly needed in requestData if context.auth.uid is used in Function, but good for traceability
  // However, the Firebase function `httpsCallableTriggerProcessing` expects only analysisId in data.

  const requestData: TriggerProcessingRequestData = { analysisId };

  try {
    const callableFunction = httpsCallable<
      TriggerProcessingRequestData,
      TriggerProcessingResponseData
    >(functionsInstance, 'httpsCallableTriggerProcessing');

    const result: HttpsCallableResult<TriggerProcessingResponseData> =
      await callableFunction(requestData);

    console.info(
      `[SA_processAnalysisFile] 'httpsCallableTriggerProcessing' for ${analysisId} returned: Success: ${result.data.success}, Msg: ${result.data.message}, Err: ${result.data.error}`
    );

    if (!result.data.success) {
      // If the function itself reported an error (e.g., precondition failed)
      const errorMsg =
        result.data.error ||
        result.data.message ||
        'Falha ao enfileirar análise para processamento (Função HTTPS).';
      console.error(
        `[SA_processAnalysisFile] 'httpsCallableTriggerProcessing' reported failure for ${analysisId}: ${errorMsg}`
      );
      return { success: false, analysisId, error: errorMsg };
    }

    return { success: true, analysisId };
  } catch (error: unknown) {
    const firebaseError = error as { code?: string; message?: string };
    const message =
      (error instanceof Error ? error.message : String(error)) ||
      'Erro desconhecido ao enfileirar análise via HTTPS Function.';
    console.error(
      `[SA_processAnalysisFile] Error calling 'httpsCallableTriggerProcessing' for ${analysisId}: Code: ${
        firebaseError.code || 'N/A'
      }, Message: ${message}`,
      error
    );
    return {
      success: false,
      analysisId,
      error: `Erro ao enfileirar (SA): ${message.substring(0, MAX_CLIENT_ERROR_MESSAGE_LENGTH)}`,
    };
  }
}
