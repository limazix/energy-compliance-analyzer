// src/features/report-chat/actions/reportChatActions.ts
'use server';
/**
 * @fileOverview Server Action for report chat interactions.
 * This action now acts as a thin client, invoking an HTTPS Callable Firebase Function
 * which handles the core chat orchestration logic, including Genkit AI calls and
 * Firebase database interactions.
 */

import { httpsCallable, type HttpsCallableResult } from 'firebase/functions';

import type { AnalyzeComplianceReportOutput } from '@/ai/prompt-configs/analyze-compliance-report-prompt-config';
import { APP_CONFIG } from '@/config/appConfig';
import { functionsInstance } from '@/lib/firebase'; // Firebase Functions instance for client SDK

const CLIENT_ERROR_MESSAGE_MAX_LENGTH = APP_CONFIG.MAX_CLIENT_SERVER_ACTION_ERROR_MESSAGE_LENGTH;

// --- Types for HTTPS Callable Function Request/Response ---
interface HttpsCallableAskOrchestratorRequestData {
  userId: string; // Important: Server Action must pass this, Function validates against context.auth.uid
  analysisId: string;
  userInputText: string;
  currentReportMdx: string;
  currentStructuredReport: AnalyzeComplianceReportOutput | null;
  analysisFileName: string;
  languageCode: string;
}

interface HttpsCallableAskOrchestratorResponseData {
  success: boolean;
  error?: string;
  aiMessageRtdbKey?: string;
  reportModified?: boolean;
  revisedStructuredReport?: AnalyzeComplianceReportOutput;
  newMdxContent?: string;
}

// Renaming for clarity, as this is what the frontend calls
export interface AskReportOrchestratorServerActionResult {
  success: boolean;
  error?: string;
  aiMessageRtdbKey?: string;
  reportModified?: boolean;
  revisedStructuredReport?: AnalyzeComplianceReportOutput;
  newMdxContent?: string;
}

/**
 * Server Action to process a user's message in the report chat.
 * It calls the `httpsCallableAskOrchestrator` Firebase Function.
 *
 * @param {string} userIdInput - The ID of the authenticated user.
 * @param {string} analysisIdInput - The ID of the analysis being discussed.
 * @param {string} userInputText - The user's message.
 * @param {string} currentReportMdx - Current MDX content of the report.
 * @param {AnalyzeComplianceReportOutput | null} currentStructuredReport - Current structured (JSON) report object.
 * @param {string} analysisFileName - Original filename of the analyzed data.
 * @param {string} languageCode - BCP-47 language code for the interaction.
 * @returns {Promise<AskReportOrchestratorServerActionResult>} Result of the interaction.
 */
export async function askReportOrchestratorAction(
  userIdInput: string,
  analysisIdInput: string,
  userInputText: string,
  currentReportMdx: string,
  currentStructuredReport: AnalyzeComplianceReportOutput | null,
  analysisFileName: string,
  languageCode: string
): Promise<AskReportOrchestratorServerActionResult> {
  const userId = userIdInput?.trim();
  const analysisId = analysisIdInput?.trim();

  if (!userId || !analysisId) {
    const errorMsg = '[SA_askOrchestrator] User ID e Analysis ID são obrigatórios.';
    // eslint-disable-next-line no-console
    console.error(`${errorMsg} User: ${userIdInput}, Analysis: ${analysisIdInput}`);
    return { success: false, error: errorMsg };
  }
  if (!userInputText.trim()) {
    return { success: false, error: '[SA_askOrchestrator] Entrada do usuário vazia.' };
  }
  if (!currentStructuredReport) {
    const errorMsg =
      '[SA_askOrchestrator] O relatório estruturado atual é necessário para processar esta solicitação.';
    // eslint-disable-next-line no-console
    console.error(`${errorMsg} Analysis: ${analysisId}`);
    return { success: false, error: errorMsg };
  }
  if (!currentReportMdx) {
    const errorMsg =
      '[SA_askOrchestrator] O conteúdo MDX do relatório atual é necessário para fornecer contexto à IA.';
    // eslint-disable-next-line no-console
    console.error(`${errorMsg} Analysis: ${analysisId}`);
    return { success: false, error: errorMsg };
  }

  const requestData: HttpsCallableAskOrchestratorRequestData = {
    userId, // Pass userId explicitly for the Function to validate against context.auth.uid
    analysisId,
    userInputText,
    currentReportMdx,
    currentStructuredReport,
    analysisFileName,
    languageCode: languageCode || APP_CONFIG.DEFAULT_LANGUAGE_CODE,
  };

  try {
    // eslint-disable-next-line no-console
    console.info(
      `[SA_askOrchestrator] Calling HTTPS function 'httpsCallableAskOrchestrator' for analysis ${analysisId}.`
    );
    const callableFunction = httpsCallable<
      HttpsCallableAskOrchestratorRequestData,
      HttpsCallableAskOrchestratorResponseData
    >(functionsInstance, 'httpsCallableAskOrchestrator');

    const result: HttpsCallableResult<HttpsCallableAskOrchestratorResponseData> =
      await callableFunction(requestData);

    // eslint-disable-next-line no-console
    console.info(
      `[SA_askOrchestrator] HTTPS function 'httpsCallableAskOrchestrator' returned for analysis ${analysisId}. Success: ${result.data.success}`
    );
    return result.data; // Directly return the data object from the HttpsCallableResult
  } catch (error: unknown) {
    // Handle HttpsError from Firebase Functions
    const firebaseError = error as { code?: string; message?: string; details?: unknown };
    const code = firebaseError.code || 'unknown';
    const message = firebaseError.message || 'Erro desconhecido ao chamar a função de chat.';
    const details = firebaseError.details
      ? ` Detalhes: ${JSON.stringify(firebaseError.details)}`
      : '';

    // eslint-disable-next-line no-console
    console.error(
      `[SA_askOrchestrator] Error calling 'httpsCallableAskOrchestrator' for analysis ${analysisId}: Code: ${code}, Message: ${message}${details}`,
      error
    );

    // Try to extract aiMessageRtdbKey from details if it was an error during AI processing
    const aiMessageRtdbKey =
      firebaseError.details &&
      typeof firebaseError.details === 'object' &&
      'aiMessageRtdbKey' in firebaseError.details
        ? (firebaseError.details as { aiMessageRtdbKey: string }).aiMessageRtdbKey
        : undefined;

    return {
      success: false,
      error: `Erro ao processar sua solicitação (SA): ${message.substring(
        0,
        CLIENT_ERROR_MESSAGE_MAX_LENGTH
      )}`,
      aiMessageRtdbKey, // Pass along if available, so client can still update that specific message with error
    };
  }
}
