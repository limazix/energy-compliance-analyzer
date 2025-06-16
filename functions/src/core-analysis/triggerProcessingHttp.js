// @ts-check
'use strict';

/**
 * @fileOverview HTTPS Callable Firebase Function for triggering analysis processing.
 * Feature: Core Analysis
 * Component: Trigger Processing (HTTPS Callable)
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

const { APP_CONFIG } = require('../../../src/config/appConfig.js');

// Initialize Firebase Admin SDK if not already initialized.
if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = admin.firestore();
const MAX_ERROR_MESSAGE_LENGTH = APP_CONFIG.MAX_SERVER_ERROR_MESSAGE_LENGTH;
const UPLOAD_COMPLETED_OVERALL_PROGRESS = APP_CONFIG.PROGRESS_PERCENTAGE_UPLOAD_COMPLETE;

/**
 * Prepares an analysis for background processing by setting its status.
 * Requires `context.auth` for user identification.
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
    `[CoreAnalysis_TriggerHttp] For analysisId: ${analysisId}, userId: ${userId}. Project: ${
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
      console.info(`[CoreAnalysis_TriggerHttp] ${msg}`);
      return { success: true, analysisId, message: msg };
    }

    console.info(
      `[CoreAnalysis_TriggerHttp] Setting analysis ${analysisId} to 'summarizing_data' to be picked up by event-driven function.`
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
      `[CoreAnalysis_TriggerHttp] Error preparing analysis ${analysisId}:`,
      errorMessage,
      error
    );

    try {
      const currentSnap = await analysisRef.get();
      if (currentSnap.exists()) {
        const currentData = currentSnap.data();
        if (currentData?.status !== 'cancelling' && currentData?.status !== 'cancelled') {
          await analysisRef.update({
            status: 'error',
            errorMessage: `Erro ao enfileirar para processamento (TriggerHttp): ${errorMessage.substring(
              0,
              MAX_ERROR_MESSAGE_LENGTH - 50
            )}`,
          });
        }
      }
    } catch (updateError) {
      console.error(
        `[CoreAnalysis_TriggerHttp] CRITICAL: Failed to update Firestore with error state for ${analysisId}:`,
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
