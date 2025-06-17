// src/features/analysis-processing/actions/analysisProcessingActions.ts
'use server';
/**
 * @fileOverview Server Action for initiating the background processing of an analysis.
 * This action calls an HTTPS Callable Firebase Function to set the analysis status,
 * which in turn triggers an event-driven Firebase Function for the actual processing.
 * It also includes an action to retry a failed analysis.
 */

import { httpsCallable } from 'firebase/functions';

import { APP_CONFIG } from '@/config/appConfig';
import { functionsInstance } from '@/lib/firebase';
import { adminDb } from '@/lib/firebase-admin'; // Import adminDb for direct Firestore updates

import type { HttpsCallableResult } from 'firebase/functions';

const MAX_CLIENT_ERROR_MESSAGE_LENGTH = APP_CONFIG.MAX_CLIENT_SERVER_ACTION_ERROR_MESSAGE_LENGTH;
const UPLOAD_COMPLETED_OVERALL_PROGRESS = APP_CONFIG.PROGRESS_PERCENTAGE_UPLOAD_COMPLETE;

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

  // eslint-disable-next-line no-console
  console.info(
    `[SA_processAnalysisFile] Triggered for analysisId: ${analysisId} (input: ${analysisIdInput}), User: ${userId}. Calling 'httpsCallableTriggerProcessing'.`
  );

  if (!analysisId) {
    const criticalMsg = `[SA_processAnalysisFile] CRITICAL: analysisId is invalid ('${analysisIdInput}' -> '${analysisId}'). Aborting.`;
    // eslint-disable-next-line no-console
    console.error(criticalMsg);
    return {
      success: false,
      analysisId: analysisIdInput || 'unknown_id',
      error: criticalMsg.substring(0, MAX_CLIENT_ERROR_MESSAGE_LENGTH),
    };
  }

  const requestData: TriggerProcessingRequestData = { analysisId };

  try {
    const callableFunction = httpsCallable<
      TriggerProcessingRequestData,
      TriggerProcessingResponseData
    >(functionsInstance, 'httpsCallableTriggerProcessing');

    const result: HttpsCallableResult<TriggerProcessingResponseData> =
      await callableFunction(requestData);

    // eslint-disable-next-line no-console
    console.info(
      `[SA_processAnalysisFile] 'httpsCallableTriggerProcessing' for ${analysisId} returned: Success: ${result.data.success}, Msg: ${result.data.message}, Err: ${result.data.error}`
    );

    if (!result.data.success) {
      // If the function itself reported an error (e.g., precondition failed)
      const errorMsg =
        result.data.error ||
        result.data.message ||
        'Falha ao enfileirar análise para processamento (Função HTTPS).';
      // eslint-disable-next-line no-console
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
    // eslint-disable-next-line no-console
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

/**
 * Server Action to retry a failed analysis.
 * This action directly updates the Firestore document to reset its status
 * and clear previous error/result fields, which will trigger the
 * `processAnalysisOnUpdate` Firebase Function.
 * @param {string} userId - The ID of the user who owns the analysis.
 * @param {string} analysisId - The ID of the analysis to retry.
 * @returns {Promise<{ success: boolean; analysisId: string; error?: string }>} Result object.
 */
export async function retryAnalysisAction(
  userId: string,
  analysisId: string
): Promise<{ success: boolean; analysisId: string; error?: string }> {
  // eslint-disable-next-line no-console
  console.info(`[SA_retryAnalysis] Request to retry analysisId: ${analysisId} for user: ${userId}`);

  if (!userId || !analysisId) {
    const criticalMsg = `[SA_retryAnalysis] CRITICAL: userId ('${userId}') or analysisId ('${analysisId}') is invalid. Aborting.`;
    // eslint-disable-next-line no-console
    console.error(criticalMsg);
    return {
      success: false,
      analysisId: analysisId || 'unknown_id',
      error: criticalMsg.substring(0, MAX_CLIENT_ERROR_MESSAGE_LENGTH),
    };
  }

  const analysisDocRef = adminDb.doc(`users/${userId}/analyses/${analysisId}`);

  try {
    const docSnap = await analysisDocRef.get();
    if (!docSnap.exists) {
      const errorMsg = `[SA_retryAnalysis] Analysis document ${analysisId} not found for user ${userId}. Cannot retry.`;
      // eslint-disable-next-line no-console
      console.error(errorMsg);
      return { success: false, analysisId, error: 'Análise não encontrada.' };
    }

    const analysisData = docSnap.data();
    if (analysisData?.status !== 'error') {
      const errorMsg = `[SA_retryAnalysis] Analysis ${analysisId} is not in 'error' state (current: ${analysisData?.status}). Cannot retry.`;
      // eslint-disable-next-line no-console
      console.warn(errorMsg);
      return { success: false, analysisId, error: 'A análise não está em estado de erro.' };
    }
    if (!analysisData.powerQualityDataUrl) {
      const errorMsg = `[SA_retryAnalysis] Analysis ${analysisId} is missing 'powerQualityDataUrl'. Cannot retry without re-upload.`;
      // eslint-disable-next-line no-console
      console.error(errorMsg);
      return {
        success: false,
        analysisId,
        error: 'Dados do arquivo original ausentes. Não é possível tentar novamente.',
      };
    }

    await analysisDocRef.update({
      status: 'summarizing_data', // Reset status to trigger processing
      progress: UPLOAD_COMPLETED_OVERALL_PROGRESS, // Reset progress
      errorMessage: null, // Clear previous error
      powerQualityDataSummary: null,
      identifiedRegulations: null,
      structuredReport: null,
      mdxReportStoragePath: null,
      summary: null,
      completedAt: null,
      // isDataChunked might be kept or reset depending on desired behavior
    });

    // eslint-disable-next-line no-console
    console.info(
      `[SA_retryAnalysis] Analysis ${analysisId} status reset to 'summarizing_data' for retry. Event-driven function should pick it up.`
    );
    return { success: true, analysisId };
  } catch (error: unknown) {
    const message =
      (error instanceof Error ? error.message : String(error)) ||
      'Erro desconhecido ao tentar reiniciar a análise.';
    // eslint-disable-next-line no-console
    console.error(
      `[SA_retryAnalysis] Error updating Firestore for analysis ${analysisId} retry: ${message}`,
      error
    );
    return {
      success: false,
      analysisId,
      error: `Erro ao reiniciar análise: ${message.substring(0, MAX_CLIENT_ERROR_MESSAGE_LENGTH)}`,
    };
  }
}
