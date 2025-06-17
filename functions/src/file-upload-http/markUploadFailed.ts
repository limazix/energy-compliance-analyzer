'use strict';

/**
 * @fileOverview HTTPS Callable Firebase Function for marking an analysis upload as failed.
 * Feature: File Upload (HTTPS Callable)
 * Component: MarkUploadFailed
 */

import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

import { APP_CONFIG } from '@/config/appConfig'; // Adjusted path

if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = admin.firestore();
const MAX_ERROR_MESSAGE_LENGTH = APP_CONFIG.MAX_SERVER_ERROR_MESSAGE_LENGTH;

interface RequestData {
  analysisId: string | null;
  uploadErrorMessage: string;
}

interface ResponseData {
  success: boolean;
  message?: string;
}

/**
 * Marks an analysis upload as failed in Firestore.
 * @param {RequestData} data - The data object sent from the client.
 * @param {functions.https.CallableContext} context - The context of the call.
 * @returns {Promise<ResponseData>} A promise that resolves with success status and an optional message.
 * @throws {functions.https.HttpsError} If unauthenticated or a Firestore error occurs (unless doc not found for an existing ID).
 */
export const httpsMarkUploadAsFailed = functions.https.onCall(
  async (data: RequestData, context: functions.https.CallableContext): Promise<ResponseData> => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'A função deve ser chamada por um usuário autenticado.'
      );
    }
    const userId = context.auth.uid;
    const { analysisId, uploadErrorMessage } = data;

    if (!analysisId) {
      // eslint-disable-next-line no-console
      console.warn(
        `[FileUpload_MarkFailed] No valid analysisId provided. Error was: ${uploadErrorMessage}.`
      );
      return { success: true, message: 'Nenhum ID de análise fornecido, nada a marcar no DB.' };
    }
    const analysisRef = db.collection('users').doc(userId).collection('analyses').doc(analysisId);

    try {
      const docSnap = await analysisRef.get();
      if (!docSnap.exists) {
        // eslint-disable-next-line no-console
        console.warn(
          `[FileUpload_MarkFailed] Doc ${analysisId} não encontrado. Error: ${uploadErrorMessage}`
        );
        return { success: true, message: 'Documento da análise não encontrado para marcar falha.' };
      }
      await analysisRef.update({
        status: 'error',
        errorMessage: `Falha no upload: ${String(uploadErrorMessage).substring(
          0,
          MAX_ERROR_MESSAGE_LENGTH - 25
        )}`,
        progress: 0,
        uploadProgress: 0,
      });
      // eslint-disable-next-line no-console
      console.info(`[FileUpload_MarkFailed] Doc ${analysisId} marcado como erro de upload.`);
      return { success: true };
    } catch (error: unknown) {
      // Changed from any to unknown
      const errorMessage = error instanceof Error ? error.message : String(error);
      // eslint-disable-next-line no-console
      console.error(
        `[FileUpload_MarkFailed] Firestore error for analysis ${analysisId}: ${errorMessage}`,
        error
      );
      throw new functions.https.HttpsError(
        'internal',
        `Falha ao marcar falha no upload: ${errorMessage.substring(0, MAX_ERROR_MESSAGE_LENGTH)}`
      );
    }
  }
);
