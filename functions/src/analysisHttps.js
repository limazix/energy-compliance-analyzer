// @ts-check
'use strict';

/**
 * @fileOverview HTTPS Callable Firebase Functions for various analysis-related operations.
 * This includes fetching past analyses, deleting/canceling analyses,
 * triggering processing, and fetching report details.
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

const {
  getAdminFileContentFromStorage,
  deleteAdminFileFromStorage,
} = require('./adminStorageUtils'); // Utility for Admin SDK Storage operations

// Initialize Firebase Admin SDK if not already initialized.
if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = admin.firestore();
const MAX_ERROR_MESSAGE_LENGTH = 1500;
const UPLOAD_COMPLETED_OVERALL_PROGRESS = 10; // Default progress after upload is complete

/**
 * Validates if a given status string is a valid Analysis status.
 * @param {any} status - The status to validate.
 * @returns {status is import('../lib/shared/types/analysis.js').Analysis['status']} True if valid, false otherwise.
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
  ];
  return typeof status === 'string' && validStatuses.includes(status);
}

/**
 * Fetches past analyses for a user.
 * @type {functions.HttpsFunction}
 * @param {object} _data - The data object sent from the client (not used, userId from context).
 * @param {functions.https.CallableContext} context - The context of the call, containing auth information.
 * @returns {Promise<{analyses: import('../lib/shared/types/analysis.js').Analysis[]}>}
 *          A promise that resolves with an array of analysis objects.
 * @throws {functions.https.HttpsError} If unauthenticated or a Firestore error occurs.
 */
exports.httpsCallableGetPastAnalyses = functions.https.onCall(async (_data, context) => {
  if (!context.auth || !context.auth.uid) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'A função deve ser chamada por um usuário autenticado.'
    );
  }
  const userId = context.auth.uid;
  console.info(
    `[Func_httpsGetPastAnalyses] Fetching for userId: ${userId}, Project: ${
      process.env.GCLOUD_PROJECT || 'PROJECT_ID_NOT_SET_IN_FUNC_ENV'
    }`
  );

  const analysesCol = db.collection('users').doc(userId).collection('analyses');
  const q = analysesCol.orderBy('createdAt', 'desc');

  try {
    const snapshot = await q.get();
    console.info(
      `[Func_httpsGetPastAnalyses] Found ${snapshot.docs.length} analyses for userId: ${userId}`
    );

    /**
     * Maps Firestore Timestamp or ISO string to ISO string.
     * @param {any} timestampFieldValue - The field value from Firestore.
     * @returns {string | undefined} ISO string or undefined.
     */
    const mapTimestampToISO = (timestampFieldValue) => {
      if (timestampFieldValue && typeof timestampFieldValue.toDate === 'function') {
        return timestampFieldValue.toDate().toISOString();
      }
      if (
        typeof timestampFieldValue === 'string' &&
        /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/.test(timestampFieldValue)
      ) {
        return timestampFieldValue;
      }
      return undefined;
    };

    const analyses = snapshot.docs
      .map((docSnap) => {
        const data = docSnap.data();
        /** @type {Partial<import('../lib/shared/types/analysis.js').Analysis>} */
        const analysisResult = {
          id: docSnap.id,
          userId: data.userId,
          fileName: data.fileName,
          title: data.title,
          description: data.description,
          languageCode: data.languageCode,
          status: data.status,
          progress: data.progress,
          uploadProgress: data.uploadProgress,
          powerQualityDataUrl: data.powerQualityDataUrl,
          powerQualityDataSummary: data.powerQualityDataSummary,
          isDataChunked: data.isDataChunked,
          identifiedRegulations: data.identifiedRegulations,
          summary: data.summary,
          structuredReport: data.structuredReport,
          mdxReportStoragePath: data.mdxReportStoragePath,
          errorMessage: data.errorMessage,
          tags: data.tags || [],
          createdAt: mapTimestampToISO(data.createdAt) || new Date(0).toISOString(),
          completedAt: mapTimestampToISO(data.completedAt),
        };

        if (!statusIsValid(analysisResult.status)) {
          console.warn(
            `[Func_httpsGetPastAnalyses] Analysis ${
              docSnap.id
            } has invalid status: ${analysisResult.status}. Defaulting to 'error'.`
          );
          analysisResult.status = 'error';
          analysisResult.errorMessage =
            analysisResult.errorMessage ||
            `Status inválido (${data.status}) recebido do Firestore.`;
        }
        return analysisResult;
      })
      .filter((a) => a.status !== 'deleted'); // Filter out deleted locally

    return {
      analyses: /** @type {import('../lib/shared/types/analysis.js').Analysis[]} */ (analyses),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(
      `[Func_httpsGetPastAnalyses] Firestore error for userId ${userId}: ${errorMessage}`,
      error
    );
    throw new functions.https.HttpsError(
      'internal',
      `Falha ao buscar análises: ${errorMessage.substring(0, MAX_ERROR_MESSAGE_LENGTH)}`
    );
  }
});

/**
 * Deletes an analysis document and its associated files from Storage.
 * @type {functions.HttpsFunction}
 * @param {{analysisId: string}} data - The data object containing the analysis ID.
 * @param {functions.https.CallableContext} context - The context of the call.
 * @returns {Promise<{success: boolean, message?: string}>} Success status.
 * @throws {functions.https.HttpsError} If unauthenticated, arguments invalid, or an error occurs.
 */
exports.httpsCallableDeleteAnalysis = functions.https.onCall(async (data, context) => {
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
  console.info(
    `[Func_httpsDeleteAnalysis] Marking ${analysisDocPath} as 'deleted'. Project: ${
      process.env.GCLOUD_PROJECT || 'PROJECT_ID_NOT_SET_IN_FUNC_ENV'
    }`
  );

  try {
    const analysisSnap = await analysisRef.get();
    if (!analysisSnap.exists()) {
      throw new functions.https.HttpsError('not-found', 'Análise não encontrada para exclusão.');
    }

    const dataToDelete = analysisSnap.data();

    // Mark as deleted in Firestore first
    await analysisRef.update({
      status: 'deleted',
      summary: null,
      structuredReport: null,
      mdxReportStoragePath: null,
      powerQualityDataUrl: null,
      identifiedRegulations: null,
      powerQualityDataSummary: null,
      errorMessage: 'Análise excluída pelo usuário.',
      // Retain progress, completedAt, etc., for audit, or nullify them too
    });
    console.info(`[Func_httpsDeleteAnalysis] Firestore doc ${analysisId} marked as deleted.`);

    // Attempt to delete associated files from Storage
    if (dataToDelete && dataToDelete.powerQualityDataUrl) {
      await deleteAdminFileFromStorage(dataToDelete.powerQualityDataUrl);
    }
    if (dataToDelete && dataToDelete.mdxReportStoragePath) {
      await deleteAdminFileFromStorage(dataToDelete.mdxReportStoragePath);
    }

    return {
      success: true,
      message: 'Análise marcada como excluída e arquivos agendados para remoção.',
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[Func_httpsDeleteAnalysis] Error for ${analysisDocPath}:`, errorMessage, error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError(
      'internal',
      `Falha ao excluir análise: ${errorMessage.substring(0, MAX_ERROR_MESSAGE_LENGTH)}`
    );
  }
});

/**
 * Requests cancellation of an analysis.
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
  console.info(
    `[Func_httpsCancelAnalysis] Requesting cancellation for ${analysisDocPath}. Project: ${
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
      currentStatus === 'deleted'
    ) {
      const msg = `Análise ${analysisId} já está em um estado final (${currentStatus}) e não pode ser cancelada.`;
      console.warn(`[Func_httpsCancelAnalysis] ${msg}`);
      // Not an error from the function's perspective, but a client-side state issue.
      // Return success:false with a message so client can inform user.
      return { success: false, message: msg };
    }
    if (currentStatus === 'cancelling') {
      const msg = `Análise ${analysisId} já está sendo cancelada.`;
      console.info(`[Func_httpsCancelAnalysis] ${msg}`);
      return { success: true, message: msg }; // Already in progress
    }

    await analysisRef.update({
      status: 'cancelling',
      errorMessage: 'Cancelamento solicitado pelo usuário...',
    });
    console.info(`[Func_httpsCancelAnalysis] Analysis ${analysisId} status set to 'cancelling'.`);
    return { success: true, message: 'Solicitação de cancelamento enviada.' };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[Func_httpsCancelAnalysis] Error for ${analysisDocPath}:`, errorMessage, error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError(
      'internal',
      `Falha ao solicitar cancelamento: ${errorMessage.substring(0, MAX_ERROR_MESSAGE_LENGTH)}`
    );
  }
});

/**
 * Prepares an analysis for background processing by setting its status.
 * This function is called after file upload is complete to trigger the event-driven processing.
 * @type {functions.HttpsFunction}
 * @param {{analysisId: string}} data - The data object containing the analysis ID.
 * @param {functions.https.CallableContext} context - The context of the call.
 * @returns {Promise<{success: boolean, analysisId: string, message?: string}>} Result.
 * @throws {functions.https.HttpsError} If unauthenticated, arguments invalid, or an error occurs.
 */
exports.httpsCallableTriggerProcessing = functions.https.onCall(async (data, context) => {
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
  console.info(
    `[Func_httpsTriggerProcessing] For analysisId: ${analysisId}, userId: ${userId}. Project: ${
      process.env.GCLOUD_PROJECT || 'PROJECT_ID_NOT_SET_IN_FUNC_ENV'
    }`
  );

  const analysisDocPath = `users/${userId}/analyses/${analysisId}`;
  const analysisRef = db.doc(analysisDocPath);

  try {
    const analysisSnap = await analysisRef.get();
    if (!analysisSnap.exists()) {
      throw new functions.https.HttpsError(
        'not-found',
        `Documento da análise ${analysisId} não encontrado.`
      );
    }

    const analysisData = analysisSnap.data();
    if (!analysisData) {
      // Should not happen if exists() is true, but good practice.
      throw new functions.https.HttpsError('internal', 'Dados da análise não encontrados.');
    }

    if (!analysisData.powerQualityDataUrl) {
      await analysisRef.update({
        status: 'error',
        errorMessage: 'URL do arquivo de dados não encontrada. Reenvie o arquivo.',
        progress: 0,
      });
      throw new functions.https.HttpsError(
        'failed-precondition',
        'URL do arquivo de dados não encontrada. Não é possível enfileirar para processamento.'
      );
    }

    if (
      analysisData.status === 'completed' ||
      analysisData.status === 'cancelling' ||
      analysisData.status === 'cancelled' ||
      analysisData.status === 'deleted'
    ) {
      const msg = `Análise ${analysisId} está em status '${analysisData.status}'. Nenhum reprocessamento acionado.`;
      console.info(`[Func_httpsTriggerProcessing] ${msg}`);
      return { success: true, analysisId, message: msg };
    }

    console.info(
      `[Func_httpsTriggerProcessing] Setting analysis ${analysisId} to 'summarizing_data' to be picked up by event-driven function.`
    );
    await analysisRef.update({
      status: 'summarizing_data',
      progress:
        analysisData.progress < UPLOAD_COMPLETED_OVERALL_PROGRESS
          ? UPLOAD_COMPLETED_OVERALL_PROGRESS
          : analysisData.progress,
      errorMessage: null,
    });

    return { success: true, analysisId, message: 'Análise enfileirada para processamento.' };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(
      `[Func_httpsTriggerProcessing] Error preparing analysis ${analysisId}:`,
      errorMessage,
      error
    );

    // Attempt to update Firestore with an error state, avoiding race conditions with cancellation.
    try {
      const currentSnap = await analysisRef.get();
      if (currentSnap.exists()) {
        const currentData = currentSnap.data();
        if (currentData?.status !== 'cancelling' && currentData?.status !== 'cancelled') {
          await analysisRef.update({
            status: 'error',
            errorMessage: `Erro ao enfileirar para processamento (Função): ${errorMessage.substring(
              0,
              MAX_ERROR_MESSAGE_LENGTH - 50
            )}`,
          });
        }
      }
    } catch (updateError) {
      console.error(
        `[Func_httpsTriggerProcessing] CRITICAL: Failed to update Firestore with error state for ${analysisId}:`,
        updateError
      );
    }
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError(
      'internal',
      `Falha ao enfileirar para processamento: ${errorMessage.substring(
        0,
        MAX_ERROR_MESSAGE_LENGTH
      )}`
    );
  }
});

/**
 * Fetches analysis report data (MDX content and metadata).
 * @type {functions.HttpsFunction}
 * @param {{analysisId: string}} data - The data object containing the analysis ID.
 * @param {functions.https.CallableContext} context - The context of the call.
 * @returns {Promise<import('../lib/shared/types/analysis.js').AnalysisReportData>} Report data.
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

  /** @type {import('../lib/shared/types/analysis.js').AnalysisReportData} */
  const baseReturn = {
    mdxContent: null,
    fileName: null,
    analysisId: analysisId || null,
    structuredReport: null, // Added to match updated type
  };

  if (!analysisId || typeof analysisId !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'ID da análise é obrigatório.');
  }

  const analysisDocPath = `users/${userId}/analyses/${analysisId}`;
  console.info(
    `[Func_httpsGetAnalysisReport] Fetching report from ${analysisDocPath}. Project: ${
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
    // No need to check analysisData.userId === userId here, path already includes userId from context.auth.uid

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
      error: null, // Explicitly null on success
      structuredReport: analysisData.structuredReport || null, // Include structured report
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(
      `[Func_httpsGetAnalysisReport] Error for ${analysisDocPath}:`,
      errorMessage,
      error
    );
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError(
      'internal',
      `Erro ao carregar o relatório (Função): ${errorMessage.substring(
        0,
        MAX_ERROR_MESSAGE_LENGTH - 30 // Reserve space for prefix
      )}`
    );
  }
});
