// @ts-check
'use strict';

/**
 * @fileOverview HTTPS Callable Firebase Function for creating an initial analysis record.
 * Feature: File Upload (HTTPS Callable)
 * Component: CreateInitialRecord
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
 * Creates an initial record for an analysis in Firestore.
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
  const finalTitle = title?.trim() || trimmedFileName;
  const finalDescription = description?.trim() || '';
  const finalLanguageCode = languageCode?.trim() || APP_CONFIG.DEFAULT_LANGUAGE_CODE;

  if (!trimmedFileName) {
    throw new functions.https.HttpsError('invalid-argument', 'Nome do arquivo é obrigatório.');
  }

  const analysisDataForFirestore = {
    userId: userId,
    fileName: trimmedFileName,
    title: finalTitle,
    description: finalDescription,
    languageCode: finalLanguageCode,
    status: 'uploading', // Status is 'uploading'
    progress: 0, // Overall progress starts at 0, or a very small value indicating just record creation
    uploadProgress: 0, // Specific upload progress starts at 0
    isDataChunked: false,
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
    // eslint-disable-next-line no-console
    console.info(`[FileUpload_CreateInitial_Func] Doc created: ${docRef.id} for user ${userId}`);
    return { analysisId: docRef.id };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    // eslint-disable-next-line no-console
    console.error(
      `[FileUpload_CreateInitial_Func] Firestore error for user ${userId}: ${errorMessage}`,
      error
    );
    throw new functions.https.HttpsError(
      'internal',
      `Falha ao criar registro: ${errorMessage.substring(0, MAX_ERROR_MESSAGE_LENGTH)}`
    );
  }
});
