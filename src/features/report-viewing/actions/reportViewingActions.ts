// src/features/report-viewing/actions/reportViewingActions.ts
'use server';
/**
 * @fileOverview Server Action for fetching analysis report data.
 * This action now calls an HTTPS Callable Firebase Function.
 */

import { httpsCallable, type HttpsCallableResult } from 'firebase/functions';

import type { AnalyzeComplianceReportOutput } from '@/ai/prompt-configs/analyze-compliance-report-prompt-config';
import { functionsInstance } from '@/lib/firebase';
// Ensure AnalysisReportData type definition is compatible or imported if it's more complex
// For this refactor, the HTTPS function will return a structure matching AnalysisReportData.
import type { AnalysisReportData as ClientAnalysisReportData } from '@/types/analysis';

const MAX_CLIENT_ERROR_MESSAGE_LENGTH = 250;

interface GetAnalysisReportRequestData {
  analysisId: string;
}

// Define the expected response data structure from the HTTPS Callable Function.
// This should match what `httpsCallableGetAnalysisReport` in `analysisHttps.js` returns.
interface HttpsCallableGetAnalysisReportResponseData {
  mdxContent: string | null;
  fileName: string | null;
  analysisId: string; // analysisId is always expected from the function
  error?: string | null; // Error message from the function, if any
  structuredReport?: AnalyzeComplianceReportOutput | null; // Added
}

/**
 * Server Action to fetch analysis report data by calling an HTTPS Firebase Function.
 * @param {string} userIdInput - User ID (for logging/validation).
 * @param {string} analysisIdInput - The ID of the analysis report to fetch.
 * @returns {Promise<ClientAnalysisReportData>} The analysis report data.
 */
export async function getAnalysisReportAction(
  userIdInput: string, // Kept for logging and consistency from hook
  analysisIdInput: string
): Promise<ClientAnalysisReportData> {
  const analysisId = analysisIdInput?.trim();
  const userId = userIdInput?.trim(); // For logging

  const baseReturn: ClientAnalysisReportData = {
    mdxContent: null,
    fileName: null,
    analysisId: analysisId || null,
    structuredReport: null, // Initialize
  };

  // eslint-disable-next-line no-console
  console.debug(
    `[SA_getAnalysisReport] User: ${userId}, AnalysisID: ${analysisId}. Calling 'httpsCallableGetAnalysisReport'.`
  );

  if (!analysisId) {
    const errorMsg = '[SA_getAnalysisReport] Analysis ID é obrigatório.';
    // eslint-disable-next-line no-console
    console.error(`${errorMsg} User: ${userId}, AnalysisID input: ${analysisIdInput}`);
    return { ...baseReturn, error: errorMsg.substring(0, MAX_CLIENT_ERROR_MESSAGE_LENGTH) };
  }

  const requestData: GetAnalysisReportRequestData = { analysisId };

  try {
    const callableFunction = httpsCallable<
      GetAnalysisReportRequestData,
      HttpsCallableGetAnalysisReportResponseData
    >(functionsInstance, 'httpsCallableGetAnalysisReport');

    const result: HttpsCallableResult<HttpsCallableGetAnalysisReportResponseData> =
      await callableFunction(requestData);

    // eslint-disable-next-line no-console
    console.info(
      `[SA_getAnalysisReport] 'httpsCallableGetAnalysisReport' for ${analysisId} returned. Error from func: ${result.data.error}`
    );

    if (result.data.error) {
      // If the function specifically returned an error in its response data
      return {
        ...baseReturn,
        fileName: result.data.fileName,
        analysisId: result.data.analysisId,
        error: result.data.error,
        structuredReport: result.data.structuredReport || null,
      };
    }

    return {
      mdxContent: result.data.mdxContent,
      fileName: result.data.fileName,
      analysisId: result.data.analysisId,
      error: null, // No error if we reach here and function didn't specify one
      structuredReport: result.data.structuredReport || null,
    };
  } catch (error: unknown) {
    const firebaseError = error as { code?: string; message?: string; details?: unknown };
    const code = firebaseError.code || 'unknown';
    const message =
      (error instanceof Error ? error.message : String(error)) ||
      'Erro desconhecido ao buscar relatório via HTTPS Function.';
    // eslint-disable-next-line no-console
    console.error(
      `[SA_getAnalysisReport] Error calling 'httpsCallableGetAnalysisReport' for ${analysisId}: Code: ${code}, Message: ${message}`,
      error
    );
    return {
      ...baseReturn,
      analysisId, // Ensure analysisId is returned even in error cases
      error: `Erro ao carregar o relatório (SA): ${message.substring(
        0,
        MAX_CLIENT_ERROR_MESSAGE_LENGTH
      )}`,
    };
  }
}
