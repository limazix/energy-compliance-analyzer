// @ts-check
'use strict';

/**
 * @fileOverview HTTPS Callable Firebase Function for finalizing an analysis file upload record.
 * Feature: File Upload (HTTPS Callable)
 * Component: FinalizeUpload
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = admin.firestore();
const MAX_ERROR_MESSAGE_LENGTH = 1500;
const UPLOAD_COMPLETED_OVERALL_PROGRESS = 10;

/**
 * Finalizes the file upload record in Firestore, setting status to trigger background processing.
 * @type {functions.HttpsFunction}
 * @param {object} data - The data object sent from the client.
 * @param {string} data.analysisId - The ID of the analysis to finalize.
 * @param {string} data.downloadURL - The Firebase Storage download URL of the uploaded file.
 * @param {functions.https.CallableContext} context - The context of the call.
 * @returns {Promise<{success: boolean}>} A promise that resolves with a success status.
 * @throws {functions.https.HttpsError} If unauthenticated, arguments invalid, document not found, or Firestore error.
 */
exports.httpsFinalizeFileUploadRecord = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'A função deve ser chamada por um usuário autenticado.'
    );
  }
  const userId = context.auth.uid;
  const { analysisId, downloadURL } = data;

  if (!analysisId || !downloadURL) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'ID da análise e URL de download são obrigatórios.'
    );
  }
  const analysisRef = db.collection('users').doc(userId).collection('analyses').doc(analysisId);

  try {
    const docSnap = await analysisRef.get();
    if (!docSnap.exists) {
      throw new functions.https.HttpsError('not-found', 'Documento da análise não encontrado.');
    }
    await analysisRef.update({
      powerQualityDataUrl: downloadURL,
      status: 'summarizing_data',
      progress: UPLOAD_COMPLETED_OVERALL_PROGRESS,
      uploadProgress: 100,
      errorMessage: null,
      powerQualityDataSummary: null,
      identifiedRegulations: null,
      structuredReport: null,
      mdxReportStoragePath: null,
      summary: null,
      completedAt: null,
    });
    console.info(`[FileUpload_Finalize] Doc ${analysisId} updated. Status 'summarizing_data'.`);
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(
      `[FileUpload_Finalize] Firestore error for analysis ${analysisId}: ${errorMessage}`,
      error
    );
    throw new functions.https.HttpsError(
      'internal',
      `Falha ao finalizar registro: ${errorMessage.substring(0, MAX_ERROR_MESSAGE_LENGTH)}`
    );
  }
});
