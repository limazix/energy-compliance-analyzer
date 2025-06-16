// @ts-check
'use strict';

/**
 * @fileOverview HTTPS Callable Firebase Functions for CRUD-like analysis operations.
 * (Get List, Cancel)
 * Delete operation is now handled by an event-triggered function.
 * Feature: Analysis Management
 * Component: CrudHttp (HTTPS Callable)
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

const { APP_CONFIG } = require('../../lib/shared/config/appConfig.js');

// Initialize Firebase Admin SDK if not already initialized.
if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = admin.firestore();
const MAX_ERROR_MESSAGE_LENGTH = APP_CONFIG.MAX_SERVER_ERROR_MESSAGE_LENGTH;

/**
 * Validates if a given status string is a valid Analysis status.
 * @param {any} status - The status to validate.
 * @returns {status is import('../../lib/shared/types/analysis.js').Analysis['status']} True if valid, false otherwise.
 */
function statusIsValid(status) {
  const validStatuses = [
    'uploading',
    'summarizing_data',
    'identifying_regulations',
    'assessing_compliance',
    'completed',
    'error',
    'deleted',
    'cancelling',
    'cancelled',
    'reviewing_report',
    'pending_deletion',
  ];
  return typeof status === 'string' && validStatuses.includes(status);
}

/**
 * Fetches past analyses for a user.
 * @type {functions.HttpsFunction}
 * @param {{userId: string}} data - The data object sent from the client, must contain userId.
 * @param {functions.https.CallableContext} _context - The context of the call (not directly used for UID here, uses data.userId).
 * @returns {Promise<{analyses: import('../../lib/shared/types/analysis.js').Analysis[]}>}
 *          A promise that resolves with an array of analysis objects.
 * @throws {functions.https.HttpsError} If userId is missing or a Firestore error occurs.
 */
exports.httpsCallableGetPastAnalyses = functions.https.onCall(async (data, _context) => {
  const { userId } = data;

  if (!userId || typeof userId !== 'string') {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'O ID do usuário (userId) é obrigatório no payload da solicitação.'
    );
  }

  // eslint-disable-next-line no-console
  console.info(
    `[AnalysisMgmt_GetPast] Fetching for explicit userId: ${userId}, Project: ${
      process.env.GCLOUD_PROJECT || 'PROJECT_ID_NOT_SET_IN_FUNC_ENV'
    }`
  );

  const analysesCol = db.collection('users').doc(userId).collection('analyses');
  const q = analysesCol.orderBy('createdAt', 'desc');

  try {
    const snapshot = await q.get();
    // eslint-disable-next-line no-console
    console.info(
      `[AnalysisMgmt_GetPast] Found ${snapshot.docs.length} analyses for userId: ${userId}`
    );

    const mapTimestampToISO = (timestampFieldValue) => {
      if (timestampFieldValue && typeof timestampFieldValue.toDate === 'function') {
        return timestampFieldValue.toDate().toISOString();
      }
      if (
        typeof timestampFieldValue === 'string' &&
        /\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}.\\d{3}Z/.test(timestampFieldValue)
      ) {
        return timestampFieldValue;
      }
      return undefined;
    };

    const analyses = snapshot.docs
      .map((docSnap) => {
        const docData = docSnap.data();
        const analysisResult = {
          id: docSnap.id,
          userId: docData.userId,
          fileName: docData.fileName,
          title: docData.title,
          description: docData.description,
          languageCode: docData.languageCode,
          status: docData.status,
          progress: docData.progress,
          uploadProgress: docData.uploadProgress,
          powerQualityDataUrl: docData.powerQualityDataUrl,
          powerQualityDataSummary: docData.powerQualityDataSummary,
          isDataChunked: docData.isDataChunked,
          identifiedRegulations: docData.identifiedRegulations,
          summary: docData.summary,
          structuredReport: docData.structuredReport,
          mdxReportStoragePath: docData.mdxReportStoragePath,
          errorMessage: docData.errorMessage,
          tags: docData.tags || [],
          createdAt: mapTimestampToISO(docData.createdAt) || new Date(0).toISOString(),
          completedAt: mapTimestampToISO(docData.completedAt),
          reportLastModifiedAt: mapTimestampToISO(docData.reportLastModifiedAt),
          deletionRequestedAt: mapTimestampToISO(docData.deletionRequestedAt),
        };

        if (!statusIsValid(analysisResult.status)) {
          // eslint-disable-next-line no-console
          console.warn(
            `[AnalysisMgmt_GetPast] Analysis ${
              docSnap.id
            } has invalid status: ${analysisResult.status}. Defaulting to 'error'.`
          );
          analysisResult.status = 'error';
          analysisResult.errorMessage =
            analysisResult.errorMessage ||
            `Status inválido (${docData.status}) recebido do Firestore.`;
        }
        return analysisResult;
      })
      .filter((a) => a.status !== 'deleted' && a.status !== 'pending_deletion');

    return {
      analyses: /** @type {import('../../lib/shared/types/analysis.js').Analysis[]} */ (analyses),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    // eslint-disable-next-line no-console
    console.error(
      `[AnalysisMgmt_GetPast] Firestore error for userId ${userId}: ${errorMessage}`,
      error
    );
    throw new functions.https.HttpsError(
      'internal',
      `Falha ao buscar análises: ${errorMessage.substring(0, MAX_ERROR_MESSAGE_LENGTH)}`
    );
  }
});

/**
 * Requests cancellation of an analysis.
 * Requires `context.auth` for user identification.
 * @type {functions.HttpsFunction}
 * @param {{analysisId: string}} data - The data object containing the analysis ID.
 * @param {functions.https.CallableContext} context - The context of the call.
 * @returns {Promise<{success: boolean, message?: string}>} Success status.
 * @throws {functions.https.HttpsError} If unauthenticated, arguments invalid, or an error occurs.
 */
exports.httpsCallableCancelAnalysis = functions.https.onCall(async (data, context) => {
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
  const analysisRef = db.doc(analysisDocPath);
  // eslint-disable-next-line no-console
  console.info(
    `[AnalysisMgmt_Cancel] Requesting cancellation for ${analysisDocPath}. Project: ${
      process.env.GCLOUD_PROJECT || 'PROJECT_ID_NOT_SET_IN_FUNC_ENV'
    }`
  );

  try {
    const docSnap = await analysisRef.get();
    if (!docSnap.exists()) {
      throw new functions.https.HttpsError(
        'not-found',
        `Análise ${analysisId} não encontrada para cancelamento.`
      );
    }

    const currentStatus = docSnap.data()?.status;
    if (
      currentStatus === 'completed' ||
      currentStatus === 'error' ||
      currentStatus === 'cancelled' ||
      currentStatus === 'deleted' ||
      currentStatus === 'pending_deletion'
    ) {
      const msg = `Análise ${analysisId} já está em um estado final (${currentStatus}) e não pode ser cancelada.`;
      // eslint-disable-next-line no-console
      console.warn(`[AnalysisMgmt_Cancel] ${msg}`);
      return { success: false, message: msg };
    }
    if (currentStatus === 'cancelling') {
      const msg = `Análise ${analysisId} já está sendo cancelada.`;
      // eslint-disable-next-line no-console
      console.info(`[AnalysisMgmt_Cancel] ${msg}`);
      return { success: true, message: msg };
    }

    await analysisRef.update({
      status: 'cancelling',
      errorMessage: 'Cancelamento solicitado pelo usuário...',
    });
    // eslint-disable-next-line no-console
    console.info(`[AnalysisMgmt_Cancel] Analysis ${analysisId} status set to 'cancelling'.`);
    return { success: true, message: 'Solicitação de cancelamento enviada.' };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    // eslint-disable-next-line no-console
    console.error(`[AnalysisMgmt_Cancel] Error for ${analysisDocPath}:`, errorMessage, error);

    // Duck-typing check for HttpsError
    if (
      error &&
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      'httpErrorCode' in error && // This property is specific to HttpsError
      'message' in error &&
      typeof error.message === 'string'
    ) {
      throw error; // It's already an HttpsError (or shaped like one), re-throw it
    }
    // Otherwise, wrap it as an 'internal' HttpsError
    throw new functions.https.HttpsError(
      'internal',
      `Falha ao solicitar cancelamento: ${errorMessage.substring(0, MAX_ERROR_MESSAGE_LENGTH)}`
    );
  }
});
