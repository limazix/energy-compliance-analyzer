// @ts-check
'use strict';

/**
 * @fileOverview HTTPS Callable Firebase Function for updating analysis upload progress.
 * Feature: File Upload (HTTPS Callable)
 * Component: UpdateUploadProgress
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
 * Updates the upload progress of an analysis in Firestore.
 * @type {functions.HttpsFunction}
 * @param {object} data - The data object sent from the client.
 * @param {string} data.analysisId - The ID of the analysis to update.
 * @param {number} data.uploadProgress - The current upload progress percentage (0-100).
 * @param {functions.https.CallableContext} context - The context of the call.
 * @returns {Promise<{success: boolean}>} A promise that resolves with a success status.
 * @throws {functions.https.HttpsError} If unauthenticated, arguments invalid, document not found, or Firestore error.
 */
exports.httpsUpdateAnalysisUploadProgress = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'A função deve ser chamada por um usuário autenticado.'
    );
  }
  const userId = context.auth.uid;
  const { analysisId, uploadProgress } = data;

  if (!analysisId || typeof uploadProgress !== 'number') {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'ID da análise e progresso do upload são obrigatórios.'
    );
  }
  const analysisRef = db.collection('users').doc(userId).collection('analyses').doc(analysisId);

  try {
    const docSnap = await analysisRef.get();
    if (!docSnap.exists) {
      throw new functions.https.HttpsError('not-found', 'Documento da análise não encontrado.');
    }
    const overallProgressBasedOnUpload = Math.min(
      UPLOAD_COMPLETED_OVERALL_PROGRESS - 1,
      Math.round(uploadProgress * (UPLOAD_COMPLETED_OVERALL_PROGRESS / 100))
    );
    await analysisRef.update({
      uploadProgress: Math.round(uploadProgress),
      progress: overallProgressBasedOnUpload,
      status: 'uploading',
    });
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(
      `[FileUpload_UpdateProgress] Firestore error for analysis ${analysisId}: ${errorMessage}`,
      error
    );
    throw new functions.https.HttpsError(
      'internal',
      `Falha ao atualizar progresso: ${errorMessage.substring(0, MAX_ERROR_MESSAGE_LENGTH)}`
    );
  }
});
