// @ts-check
'use strict';

/**
 * @fileOverview HTTPS Callable Firebase Functions for file upload related operations.
 * These functions act as the backend API layer, handling Firestore interactions
 * for creating analysis records, updating upload progress, finalizing records post-upload,
 * and marking uploads as failed. They are invoked by client-side Server Actions.
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Initialize Firebase Admin SDK if not already initialized.
if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = admin.firestore();
const MAX_ERROR_MESSAGE_LENGTH = 1500; // Max length for error messages in Firestore
const UPLOAD_COMPLETED_OVERALL_PROGRESS = 10; // Default progress after upload is complete

/**
 * Creates an initial record for an analysis in Firestore.
 * Triggered by an HTTPS call from a Server Action.
 * @type {functions.HttpsFunction}
 * @param {object} data - The data object sent from the client.
 * @param {string} data.fileName - The name of the file being uploaded.
 * @param {string} [data.title] - Optional title for the analysis.
 * @param {string} [data.description] - Optional description for the analysis.
 * @param {string} [data.languageCode] - Optional BCP-47 language code for the analysis.
 * @param {functions.https.CallableContext} context - The context of the call, containing auth information.
 * @returns {Promise<{analysisId: string}>} A promise that resolves with the ID of the created analysis document.
 * @throws {functions.https.HttpsError} If the user is not authenticated, arguments are invalid, or a Firestore error occurs.
 */
exports.httpsCreateInitialAnalysisRecord = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'A função deve ser chamada por um usuário autenticado.'
    );
  }
  const userId = context.auth.uid;
  const { fileName, title, description, languageCode } = data;

  const trimmedFileName = fileName?.trim() ?? '';
  const finalTitle = title?.trim() || trimmedFileName; // Default title to filename if not provided
  const finalDescription = description?.trim() || '';
  const finalLanguageCode = languageCode?.trim() || 'pt-BR'; // Default language

  if (!trimmedFileName) {
    throw new functions.https.HttpsError('invalid-argument', 'Nome do arquivo é obrigatório.');
  }

  const analysisDataForFirestore = {
    userId: userId,
    fileName: trimmedFileName,
    title: finalTitle,
    description: finalDescription,
    languageCode: finalLanguageCode,
    status: 'uploading', // Initial status
    progress: 0,
    uploadProgress: 0,
    isDataChunked: false, // Default, might be updated later
    tags: [],
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    powerQualityDataUrl: null,
    powerQualityDataSummary: null,
    identifiedRegulations: null,
    structuredReport: null,
    mdxReportStoragePath: null,
    errorMessage: null,
    completedAt: null,
  };

  try {
    const analysisCollectionRef = db.collection('users').doc(userId).collection('analyses');
    const docRef = await analysisCollectionRef.add(analysisDataForFirestore);
    console.info(`[Func_httpsCreateInitialRecord] Doc created: ${docRef.id} for user ${userId}`);
    return { analysisId: docRef.id };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(
      `[Func_httpsCreateInitialRecord] Firestore error for user ${userId}: ${errorMessage}`,
      error
    );
    throw new functions.https.HttpsError(
      'internal',
      `Falha ao criar registro: ${errorMessage.substring(0, MAX_ERROR_MESSAGE_LENGTH)}`
    );
  }
});

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
    // Calculate overall progress based on upload, capping at UPLOAD_COMPLETED_OVERALL_PROGRESS - 1 during upload phase
    const overallProgressBasedOnUpload = Math.min(
      UPLOAD_COMPLETED_OVERALL_PROGRESS - 1,
      Math.round(uploadProgress * (UPLOAD_COMPLETED_OVERALL_PROGRESS / 100))
    );
    await analysisRef.update({
      uploadProgress: Math.round(uploadProgress),
      progress: overallProgressBasedOnUpload,
      status: 'uploading', // Maintain uploading status
    });
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(
      `[Func_httpsUpdateProgress] Firestore error for analysis ${analysisId}: ${errorMessage}`,
      error
    );
    throw new functions.https.HttpsError(
      'internal',
      `Falha ao atualizar progresso: ${errorMessage.substring(0, MAX_ERROR_MESSAGE_LENGTH)}`
    );
  }
});

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
      status: 'summarizing_data', // This status triggers the event-driven processing function
      progress: UPLOAD_COMPLETED_OVERALL_PROGRESS,
      uploadProgress: 100,
      errorMessage: null, // Clear any previous error
      // Reset fields that will be populated by the background function
      powerQualityDataSummary: null,
      identifiedRegulations: null,
      structuredReport: null,
      mdxReportStoragePath: null,
      summary: null, // Old summary field, potentially
      completedAt: null,
    });
    console.info(
      `[Func_httpsFinalizeUpload] Doc ${analysisId} updated. Status 'summarizing_data'.`
    );
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(
      `[Func_httpsFinalizeUpload] Firestore error for analysis ${analysisId}: ${errorMessage}`,
      error
    );
    throw new functions.https.HttpsError(
      'internal',
      `Falha ao finalizar registro: ${errorMessage.substring(0, MAX_ERROR_MESSAGE_LENGTH)}`
    );
  }
});

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
    // If analysisId was not even created, there's nothing to mark in DB.
    // This is not an error from the function's perspective, but a client-side flow detail.
    console.warn(
      `[Func_httpsMarkFailed] No valid analysisId provided. Error was: ${uploadErrorMessage}.`
    );
    return { success: true, message: 'Nenhum ID de análise fornecido, nada a marcar no DB.' };
  }
  const analysisRef = db.collection('users').doc(userId).collection('analyses').doc(analysisId);

  try {
    const docSnap = await analysisRef.get();
    if (!docSnap.exists) {
      // If the doc doesn't exist, it means createRecord failed before this could be called, or analysisId is wrong.
      // Similar to above, not necessarily a function error if analysisId was never valid.
      console.warn(
        `[Func_httpsMarkFailed] Doc ${analysisId} não encontrado. Error: ${uploadErrorMessage}`
      );
      return { success: true, message: 'Documento da análise não encontrado para marcar falha.' };
    }
    await analysisRef.update({
      status: 'error',
      errorMessage: `Falha no upload: ${String(uploadErrorMessage).substring(0, MAX_ERROR_MESSAGE_LENGTH - 25)}`, // Prefix to indicate source
      progress: 0,
      uploadProgress: 0,
    });
    console.info(`[Func_httpsMarkFailed] Doc ${analysisId} marcado como erro de upload.`);
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(
      `[Func_httpsMarkFailed] Firestore error for analysis ${analysisId}: ${errorMessage}`,
      error
    );
    throw new functions.https.HttpsError(
      'internal',
      `Falha ao marcar falha no upload: ${errorMessage.substring(0, MAX_ERROR_MESSAGE_LENGTH)}`
    );
  }
});
