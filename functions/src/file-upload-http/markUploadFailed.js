// @ts-check
'use strict';

/**
 * @fileOverview HTTPS Callable Firebase Function for marking an analysis upload as failed.
 * Feature: File Upload (HTTPS Callable)
 * Component: MarkUploadFailed
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

const { APP_CONFIG } = require('../../lib/shared/config/appConfig.js');

if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = admin.firestore();
const MAX_ERROR_MESSAGE_LENGTH = APP_CONFIG.MAX_SERVER_ERROR_MESSAGE_LENGTH;

/**
 * Marks an analysis upload as failed in Firestore.
 * @type {functions.HttpsFunction}
 * @param {object} data - The data object sent from the client.
 * @param {string | null} data.analysisId - The ID of the analysis to mark as failed. Can be null if record creation itself failed.
 * @param {string} data.uploadErrorMessage - The error message describing the failure.
 * @param {functions.https.CallableContext} context - The context of the call.
 * @returns {Promise<{success: boolean, message?: string}>} A promise that resolves with success status and an optional message.
 * @throws {functions.https.HttpsError} If unauthenticated or a Firestore error occurs (unless doc not found for an existing ID).
 */
exports.httpsMarkUploadAsFailed = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'A função deve ser chamada por um usuário autenticado.'
    );
  }
  const userId = context.auth.uid;
  const { analysisId, uploadErrorMessage } = data;

  if (!analysisId) {
    console.warn(
      `[FileUpload_MarkFailed] No valid analysisId provided. Error was: ${uploadErrorMessage}.`
    );
    return { success: true, message: 'Nenhum ID de análise fornecido, nada a marcar no DB.' };
  }
  const analysisRef = db.collection('users').doc(userId).collection('analyses').doc(analysisId);

  try {
    const docSnap = await analysisRef.get();
    if (!docSnap.exists) {
      console.warn(
        `[FileUpload_MarkFailed] Doc ${analysisId} não encontrado. Error: ${uploadErrorMessage}`
      );
      return { success: true, message: 'Documento da análise não encontrado para marcar falha.' };
    }
    await analysisRef.update({
      status: 'error',
      errorMessage: `Falha no upload: ${String(uploadErrorMessage).substring(0, MAX_ERROR_MESSAGE_LENGTH - 25)}`,
      progress: 0,
      uploadProgress: 0,
    });
    console.info(`[FileUpload_MarkFailed] Doc ${analysisId} marcado como erro de upload.`);
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(
      `[FileUpload_MarkFailed] Firestore error for analysis ${analysisId}: ${errorMessage}`,
      error
    );
    throw new functions.https.HttpsError(
      'internal',
      `Falha ao marcar falha no upload: ${errorMessage.substring(0, MAX_ERROR_MESSAGE_LENGTH)}`
    );
  }
});
