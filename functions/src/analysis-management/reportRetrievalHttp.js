// @ts-check
'use strict';

/**
 * @fileOverview HTTPS Callable Firebase Function for fetching analysis report data.
 * Feature: Analysis Management
 * Component: Report Retrieval (HTTPS Callable)
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { getAdminFileContentFromStorage } = require('../utils/storage.js'); // Adjusted path

// Initialize Firebase Admin SDK if not already initialized.
if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = admin.firestore();
const MAX_ERROR_MESSAGE_LENGTH = 1500;

/**
 * Fetches analysis report data (MDX content and metadata).
 * Requires `context.auth` for user identification.
 * @type {functions.HttpsFunction}
 * @param {{analysisId: string}} data - The data object containing the analysis ID.
 * @param {functions.https.CallableContext} context - The context of the call.
 * @returns {Promise<import('../../lib/shared/types/analysis.js').AnalysisReportData>} Report data.
 * @throws {functions.https.HttpsError} If unauthenticated, arguments invalid, or an error occurs.
 */
exports.httpsCallableGetAnalysisReport = functions.https.onCall(async (data, context) => {
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
  console.info(
    `[ReportRetrieval_GetReport] Fetching report from ${analysisDocPath}. Project: ${
      process.env.GCLOUD_PROJECT || 'PROJECT_ID_NOT_SET_IN_FUNC_ENV'
    }`
  );
  const analysisRef = db.doc(analysisDocPath);

  try {
    const docSnap = await analysisRef.get();
    if (!docSnap.exists()) {
      throw new functions.https.HttpsError(
        'not-found',
        'Análise não encontrada ou você não tem permissão.'
      );
    }

    const analysisData = docSnap.data();
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
      fileName: analysisData.fileName,
      analysisId,
      error: null,
      structuredReport: analysisData.structuredReport || null,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[ReportRetrieval_GetReport] Error for ${analysisDocPath}:`, errorMessage, error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError(
      'internal',
      `Erro ao carregar o relatório (GetReport Func): ${errorMessage.substring(
        0,
        MAX_ERROR_MESSAGE_LENGTH - 30
      )}`
    );
  }
});
