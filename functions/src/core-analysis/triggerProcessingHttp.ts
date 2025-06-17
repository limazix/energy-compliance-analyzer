import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

import { APP_CONFIG } from '../../../src/config/appConfig'; // Adjusted path

if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = admin.firestore();
const MAX_ERROR_MESSAGE_LENGTH = APP_CONFIG.MAX_SERVER_ERROR_MESSAGE_LENGTH;
const UPLOAD_COMPLETED_OVERALL_PROGRESS = APP_CONFIG.PROGRESS_PERCENTAGE_UPLOAD_COMPLETE;
const DEFAULT_ERROR_MESSAGE =
  'Ocorreu um erro inesperado durante o processamento. Entre em contato com o suporte.';

interface ResponseData {
  success: boolean;
  analysisId: string;
  message?: string;
  error?: string;
}

/**
 * Prepares an analysis for background processing by setting its status.
 * Requires `context.auth` for user identification.
 * @param {{analysisId: string}} data - The data object containing the analysis ID.
 * @returns {Promise<ResponseData>} Result.
 * @throws {functions.https.HttpsError} If unauthenticated, arguments invalid, or an error occurs.
 */
export const httpsCallableTriggerProcessing = functions.https.onCall(
  async (data: { analysisId: string }, context): Promise<ResponseData> => {
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
    // eslint-disable-next-line no-console
    console.info(
      `[CoreAnalysis_TriggerHttp] For analysisId: ${analysisId}, userId: ${userId}. Project: ${process.env.GCLOUD_PROJECT || 'PROJECT_ID_NOT_SET_IN_FUNC_ENV'}`
    );

    const analysisDocPath = `users/${userId}/analyses/${analysisId}`;
    const analysisRef = db.doc(analysisDocPath);

    try {
      const analysisSnap = await analysisRef.get();
      if (!analysisSnap.exists) {
        throw new functions.https.HttpsError(
          'not-found',
          `Documento da análise ${analysisId} não encontrado.`
        );
      }

      const analysisData = analysisSnap.data() as
        | {
            status: string;
            powerQualityDataUrl?: string;
            progress?: number;
            errorMessage?: string;
          }
        | undefined;

      if (!analysisData) {
        throw new functions.https.HttpsError('internal', 'Dados da análise não encontrados.');
      }

      if (!analysisData.powerQualityDataUrl) {
        await analysisRef.update({
          status: 'failed', // Use 'failed' instead of 'error' as per common lifecycle
          errorMessage: 'URL do arquivo de dados não encontrada. Reenvie o arquivo.',
          progress: 0,
        });
        throw new functions.https.HttpsError(
          'failed-precondition',
          'URL do arquivo de dados não encontrada. Não é possível enfileirar para processamento.'
        );
      }

      const terminalStatuses = ['completed', 'cancelled', 'deleted', 'failed', 'cancelling'];
      if (terminalStatuses.includes(analysisData.status)) {
        const msg = `Análise ${analysisId} está em status '${analysisData.status}'. Nenhum reprocessamento acionado.`;
        // eslint-disable-next-line no-console
        console.info(`[CoreAnalysis_TriggerHttp] ${msg}`);
        return { success: true, analysisId, message: msg };
      }

      // Ensure progress is at least the upload completion percentage
      const currentProgress = analysisData.progress || 0;
      const updatedProgress = Math.max(currentProgress, UPLOAD_COMPLETED_OVERALL_PROGRESS);

      // eslint-disable-next-line no-console
      console.info(
        `[CoreAnalysis_TriggerHttp] Setting analysis ${analysisId} to 'summarizing_data' to be picked up by event-driven function.`
      );

      await analysisRef.update({
        status: 'summarizing_data',
        progress: updatedProgress,
        errorMessage: null,
      });

      return { success: true, analysisId, message: 'Análise enfileirada para processamento.' };
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`[CoreAnalysis_TriggerHttp] Error preparing analysis ${analysisId}:`, error);

      let publicErrorMessage = DEFAULT_ERROR_MESSAGE;
      if (error instanceof functions.https.HttpsError) {
        // If it's already an HttpsError, log its message and use it publicly (or a generic one)
        // eslint-disable-next-line no-console
        console.error(
          `[CoreAnalysis_TriggerHttp] HttpsError details: code=${error.code}, message=${error.message}`
        );
        publicErrorMessage = error.message; // Use the specific HttpsError message publicly
      } else if (error instanceof Error) {
        publicErrorMessage = `Falha interna: ${error.message}`.substring(
          0,
          MAX_ERROR_MESSAGE_LENGTH
        );
      } else {
        publicErrorMessage = `Erro desconhecido: ${String(error)}`.substring(
          0,
          MAX_ERROR_MESSAGE_LENGTH
        );
      }

      try {
        const currentSnap = await analysisRef.get();
        if (currentSnap.exists()) {
          const currentData = currentSnap.data() as { status?: string } | undefined;
          if (currentData?.status !== 'cancelling' && currentData?.status !== 'cancelled') {
            await analysisRef.update({
              status: 'failed',
              errorMessage: `Erro ao enfileirar para processamento (TriggerHttp): ${publicErrorMessage.substring(0, MAX_ERROR_MESSAGE_LENGTH)}`,
            });
          }
        }
      } catch (updateError) {
        // eslint-disable-next-line no-console
        console.error(
          `[CoreAnalysis_TriggerHttp] CRITICAL: Failed to update Firestore with error state for ${analysisId}:`,
          updateError
        );
      }

      // Rethrow the error appropriately
      if (error instanceof functions.https.HttpsError) throw error;
      throw new functions.https.HttpsError(
        'internal',
        `Falha ao enfileirar para processamento: ${publicErrorMessage.substring(0, MAX_ERROR_MESSAGE_LENGTH)}`,
        error // Include original error details in the HttpsError
      );
    }
  }
);
