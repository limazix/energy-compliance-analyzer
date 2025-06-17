/**
 * @fileOverview HTTPS Callable Firebase Function for fetching analysis report data.
 * Feature: Analysis Management
 * Component: Report Retrieval (HTTPS Callable)
 */
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

import { APP_CONFIG } from '../../lib/shared/config/appConfig';
import { getAdminFileContentFromStorage } from '../utils/storage';

import type { AnalyzeComplianceReportOutput } from '../../lib/shared/ai/prompt-configs/analyze-compliance-report-prompt-config'; // Assuming this type exists
import type { AnalysisReportData } from '../../lib/shared/types/analysis';

// Initialize Firebase Admin SDK if not already initialized.
if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = admin.firestore();
const MAX_ERROR_MESSAGE_LENGTH = APP_CONFIG.MAX_SERVER_ERROR_MESSAGE_LENGTH;

/**
 * Fetches analysis report data (MDX content and metadata).
 * Requires `context.auth` for user identification.
 * @param {{ analysisId: string }} data - The data object containing the analysis ID.
 * @param {functions.https.CallableContext} context - The context of the call.
 * @returns {Promise<AnalysisReportData>} Report data.
 * @throws {functions.https.HttpsError} If unauthenticated, arguments invalid, or an error occurs.
 */
export const httpsCallableGetAnalysisReport = functions.https.onCall(
  async (
    data: { analysisId: string },
    context: functions.https.CallableContext
  ): Promise<AnalysisReportData> => {
    if (!context.auth || !context.auth.uid) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'A função deve ser chamada por um usuário autenticado.'
      );
    }

    const userId = context.auth.uid;
    const { analysisId } = data;

    if (!analysisId || typeof analysisId !== 'string') {
      throw new functions.https.HttpsError('invalid-argument', 'ID da análise é obrigatório.');
    }
    const analysisDocPath = `users/${userId}/analyses/${analysisId}`;
    // eslint-disable-next-line no-console
    console.info(
      `[ReportRetrieval_GetReport] Fetching report from ${analysisDocPath}. Project: ${
        process.env.GCLOUD_PROJECT || 'PROJECT_ID_NOT_SET_IN_FUNC_ENV'
      }`
    ); // Corrected eslint-disable-next-line position

    const analysisRef = db.doc(analysisDocPath);

    try {
      const docSnap = await analysisRef.get();
      if (!docSnap.exists()) {
        throw new functions.https.HttpsError(
          'not-found', // Keep original error code
          'Análise não encontrada ou você não tem permissão.'
        );
      }

      // Define a type for analysisData to ensure type safety
      const analysisData = docSnap.data() as
        | {
            status?: string;
            mdxReportStoragePath?: string;
            fileName?: string;
            structuredReport?: AnalyzeComplianceReportOutput;
          }
        | undefined;
      if (!analysisData) {
        throw new functions.https.HttpsError('internal', 'Dados da análise não encontrados.');
      }

      if (analysisData.status === 'deleted') {
        throw new functions.https.HttpsError('failed-precondition', 'Esta análise foi excluída.');
      }
      if (analysisData.status === 'cancelled' || analysisData.status === 'cancelling') {
        throw new functions.https.HttpsError('failed-precondition', 'Esta análise foi cancelada.');
      }
      if (!analysisData.mdxReportStoragePath) {
        throw new functions.https.HttpsError(
          'not-found',
          'Relatório MDX não encontrado para esta análise.'
        );
      }

      const mdxContent = await getAdminFileContentFromStorage(analysisData.mdxReportStoragePath);

      return {
        mdxContent,
        fileName: analysisData.fileName || '', // Provide a default or handle undefined
        analysisId,
        error: null,
        structuredReport: (analysisData.structuredReport as AnalyzeComplianceReportOutput) || null,
      };
    } catch (error) {
      // eslint-disable-next-line no-console
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(
        `[ReportRetrieval_GetReport] Error for ${analysisDocPath}:`,
        errorMessage,
        error
      );

      if (error instanceof functions.https.HttpsError) throw error; // Re-throw HttpsErrors directly
      throw new functions.https.HttpsError(
        'internal',
        `Erro ao carregar o relatório (GetReport Func): ${errorMessage.substring(
          0,
          MAX_ERROR_MESSAGE_LENGTH - 30
        )}`
      );
    }
  }
);
